import cv2
import numpy as np
import pytesseract
import re
import base64
from typing import Optional, Dict, Tuple
import json
from PIL import Image
import io
import os
import logging

# Set up logger
logger = logging.getLogger(__name__)

class OCRService:
    def __init__(self):
        # Set Tesseract path for Linux (auto-detect or use system path)
        import platform
        if platform.system() == "Windows":
            pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
            os.environ['TESSDATA_PREFIX'] = r'C:\Program Files\Tesseract-OCR\tessdata'
        else:
            # Linux/Unix - use system installation
            pytesseract.pytesseract.tesseract_cmd = '/usr/bin/tesseract'
            # TESSDATA_PREFIX is usually auto-detected on Linux, but can be set if needed
            # os.environ['TESSDATA_PREFIX'] = '/usr/share/tesseract-ocr/4.00/tessdata'
        
        logger.info("OCR Service initialized with Tesseract")
    
    def preprocess_image(self, image_bytes: bytes) -> np.ndarray:
        """Preprocess image for better OCR accuracy with Tesseract"""
        # Convert bytes to PIL Image
        pil_image = Image.open(io.BytesIO(image_bytes))
        
        # Convert PIL to OpenCV format
        opencv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
        
        # Convert to grayscale
        gray = cv2.cvtColor(opencv_image, cv2.COLOR_BGR2GRAY)
        
        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        
        # Apply adaptive threshold for better text detection
        thresh = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        
        # Morphological operations to clean up the image
        kernel = np.ones((2, 2), np.uint8)
        cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel)
        
        return cleaned
    
    def extract_text(self, image_bytes: bytes) -> str:
        """Extract text from image using Tesseract OCR with multiple methods"""
        try:
            # Convert bytes to PIL Image
            pil_image = Image.open(io.BytesIO(image_bytes))
            
            # Method 1: Direct extraction (English). Language selection can be adjusted per-country in profiles
            text1 = pytesseract.image_to_string(pil_image, lang='eng', config='--psm 6')
            
            # Method 2: Preprocessed image
            processed_image = self.preprocess_image(image_bytes)
            pil_processed = Image.fromarray(processed_image)
            # Use a safer second pass with only English to avoid noisy language packs on some systems
            text2 = pytesseract.image_to_string(pil_processed, lang='eng', config='--psm 6')
            
            # Method 3: Different PSM mode for better layout analysis
            text3 = pytesseract.image_to_string(pil_image, lang='eng+tam', config='--psm 3')
            
            # Combine all extracted text
            combined_text = f"{text1}\n{text2}\n{text3}"
            
            logger.info(f"Tesseract extracted text length: {len(combined_text)}")
            
            return combined_text
            
        except Exception as e:
            logger.error(f"Error extracting text: {str(e)}")
            return ""
            
            return extracted_text
        except Exception as e:
            raise Exception(f"Error extracting text: {str(e)}")
    
    def extract_name(self, text: str) -> Optional[str]:
        """Extract name from ID text"""
        # Common patterns for names on Aadhaar
        name_patterns = [
            r'(?:Name|NAME)[\s:]*([A-Z][A-Z\s]+?)(?:\n|DOB|Date|Gender|Male|Female|$)',
            r'^([A-Z][A-Z\s]+?)(?:\n|DOB|Date|Gender|Male|Female)',
            r'([A-Z][A-Z\s]{2,30})(?:\s+(?:Male|Female|MALE|FEMALE))'
        ]
        
        for pattern in name_patterns:
            match = re.search(pattern, text, re.MULTILINE | re.IGNORECASE)
            if match:
                name = match.group(1).strip()
                # Clean up the name
                name = re.sub(r'\s+', ' ', name)
                if len(name) > 3 and len(name) < 50:
                    return name
        
        return None
    
    def extract_dob(self, text: str) -> Optional[str]:
        """Extract date of birth from ID text with improved regex"""

        
        # Multiple patterns for different DOB formats
        dob_patterns = [
            # Tamil/DOB: 22/10/2004 (mixed Tamil-English format from your Aadhaar)
            r'நாள்/DOB\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})',
            # பிறந்த நாள்/DOB: 22/10/2004 (full Tamil format)
            r'பிறந்த\s+நாள்/DOB\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})',
            # DOB: 22/10/2004 or DOB: 22-10-2004
            r'DOB\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})',
            # Date of Birth: 22/10/2004
            r'Date\s+of\s+Birth\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})',
            # Born: 22/10/2004
            r'Born\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})',
            # Standalone date patterns (DD/MM/YYYY or DD-MM-YYYY)
            r'\b(\d{1,2}[/-]\d{1,2}[/-](?:19|20)\d{2})\b',
            # Common Aadhaar formats
            r'(\d{2}/\d{2}/\d{4})',
            r'(\d{2}-\d{2}-\d{4})'
        ]
        
        for i, pattern in enumerate(dob_patterns):
            matches = re.findall(pattern, text, re.IGNORECASE)

            
            for match in matches:
                if isinstance(match, tuple):
                    dob = match[0] if match[0] else match
                else:
                    dob = match
                
                # Validate date format and range
                if self._is_valid_date(dob):
                    # Standardize format to DD/MM/YYYY
                    dob = re.sub(r'[-]', '/', dob)

                    return dob
        

        return None
    
    def _is_valid_date(self, date_str: str) -> bool:
        """Validate if the date string is a reasonable birth date"""
        try:
            # Remove any extra spaces and standardize separators
            date_str = re.sub(r'[-]', '/', date_str.strip())
            
            # Parse date
            day, month, year = map(int, date_str.split('/'))
            
            # Basic validation
            if not (1 <= day <= 31 and 1 <= month <= 12 and 1900 <= year <= 2010):
                return False
            
            # Additional validation with datetime
            from datetime import datetime
            datetime(year, month, day)
            return True
        except (ValueError, IndexError):
            return False
        
        return None
    
    def extract_gender(self, text: str) -> Optional[str]:
        """Extract gender from ID text"""
        gender_patterns = [
            r'(Male|Female|MALE|FEMALE|M|F)\b'
        ]
        
        for pattern in gender_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                gender = match.group(1).upper()
                if gender in ['M', 'MALE']:
                    return 'Male'
                elif gender in ['F', 'FEMALE']:
                    return 'Female'
        
        return None
    
    def extract_phone(self, text: str) -> Optional[str]:
        """Extract phone number from ID text with improved regex"""

        
        # Multiple patterns for different phone formats
        # Default patterns include common international formats; country-specific normalization
        phone_patterns = [
            r'(?:Mobile|Phone|Mob|Contact)\s*:?\s*(\+?\d{7,15})',
            r'\b(\+?\d{7,15})\b',
            r'\b(\d{3,4})\s*[-\s]*(\d{4,12})\b',
        ]
        
        for i, pattern in enumerate(phone_patterns):
            matches = re.findall(pattern, text, re.IGNORECASE)

            
            for match in matches:
                if isinstance(match, tuple):
                    # Handle patterns with multiple groups (like space-separated numbers)
                    if len(match) == 2 and match[0] and match[1]:
                        phone = match[0] + match[1]  # Combine parts
                    else:
                        phone = match[0] if match[0] else match[1]
                else:
                    phone = match
                
                # Normalize phone (strip spaces/dashes)
                phone = re.sub(r'[\s\-()]', '', phone)
                # Keep international numbers or local numbers with 7-15 digits
                if phone.isdigit() and 7 <= len(phone) <= 15:
                    return phone
        

        return None
    
    def extract_aadhaar_number(self, text: str) -> Optional[str]:
        """Extract Aadhaar number from text with improved regex"""
        # Improved pattern for Aadhaar number (12-digit starting with 2-9, spaces allowed)
        aadhaar_regex = r"\b[2-9]{1}[0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\b"
        
        match = re.search(aadhaar_regex, text)
        if match:
            aadhaar = match.group(0)
            # Remove any existing spaces and reformat
            aadhaar_clean = re.sub(r'\s', '', aadhaar)
            if len(aadhaar_clean) == 12 and aadhaar_clean.isdigit():
                # Format as XXXX XXXX XXXX for display
                return f"{aadhaar_clean[:4]} {aadhaar_clean[4:8]} {aadhaar_clean[8:]}"
        
        return None

    def extract_ghana_card_number(self, text: str) -> Optional[str]:
        """Attempt to extract Ghana Card number (basic patterns). Ghana Card IDs are alphanumeric, often 9-12 chars.
        This is a conservative pattern and should be improved with sample images.
        """
        # Common Ghana Card patterns: alphanumeric sequences that include letters and digits
        patterns = [r"\b([A-Z0-9]{8,12})\b", r"\b(GH[A-Z0-9]{6,10})\b"]
        for pat in patterns:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                candidate = match.group(1).strip()
                # Filter out short numeric-only strings
                if len(candidate) >= 8:
                    return candidate
        return None

    def extract_passport_mrz(self, image_bytes: bytes) -> Optional[Dict[str, str]]:
        """Very small MRZ parser stub: attempts to locate and parse MRZ lines from passport images.
        Returns dictionary with raw MRZ and parsed fields when detected. This is a conservative helper.
        """
        try:
            text = self.extract_text(image_bytes)
            # MRZ lines are two lines of 44 chars or 3 lines of 30 chars; look for '<<' pattern
            mrz_lines = [line for line in text.split('\n') if '<<' in line]
            if not mrz_lines:
                return None
            # Very naive parse: return raw MRZ lines
            return {'mrz_raw': '\n'.join(mrz_lines)}
        except Exception:
            return None

    def extract_ghana_id_data(self, image_bytes: bytes, doc_type: str = 'card') -> Dict:
        """Country-specific extraction for Ghana IDs (Ghana Card, Passport).
        This is a conservative starter implementation; accuracy improves with sample images.
        """
        try:
            extracted_text = self.extract_text(image_bytes)

            id_number = None
            if doc_type.lower() == 'passport':
                mrz = self.extract_passport_mrz(image_bytes)
                if mrz and mrz.get('mrz_raw'):
                    id_number = mrz.get('mrz_raw').split('\n')[0][:20]
            else:
                id_number = self.extract_ghana_card_number(extracted_text)

            phone = self.extract_phone(extracted_text)
            dob = self.extract_dob(extracted_text)
            name = self.extract_name(extracted_text)

            # Attempt to extract photo using face detection fallback (instead of Aadhaar coordinates)
            photo_b64 = None
            try:
                # Use face detection to crop a face region if possible
                np_img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
                gray = cv2.cvtColor(np_img, cv2.COLOR_BGR2GRAY)
                face_cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
                face_cascade = cv2.CascadeClassifier(face_cascade_path)
                faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
                if len(faces) > 0:
                    x, y, w, h = faces[0]
                    face_region = np_img[y:y+h, x:x+w]
                    face_rgb = cv2.cvtColor(face_region, cv2.COLOR_BGR2RGB)
                    pil_face = Image.fromarray(face_rgb)
                    pil_face = pil_face.resize((150, 200), Image.LANCZOS)
                    buffer = io.BytesIO()
                    pil_face.save(buffer, format='JPEG', quality=85)
                    photo_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            except Exception:
                photo_b64 = None

            return {
                'id_number': id_number,
                'ghana_card_number': id_number,
                'phone_number': phone,
                'dob': dob,
                'name': name,
                'photo_base64': photo_b64,
                'raw_text': extracted_text,
                'success': True
            }
        except Exception as e:
            logger.error(f"Error extracting Ghana ID data: {e}")
            return {'error': str(e), 'success': False}
    
    def extract_address(self, text: str) -> Optional[str]:
        """Extract address from Aadhaar text"""
        # This is more complex as address can vary greatly
        # We'll look for common address patterns
        lines = text.split('\n')
        
        # Look for lines that might contain address
        address_lines = []
        skip_keywords = ['name', 'dob', 'male', 'female', 'aadhaar', 'uid', 'government']
        
        for line in lines:
            line_clean = line.strip().lower()
            if (len(line_clean) > 10 and 
                not any(keyword in line_clean for keyword in skip_keywords) and
                not re.match(r'^\d{2}[/-]\d{2}[/-]\d{4}', line_clean) and
                not re.match(r'^[6-9]\d{9}', line_clean)):
                address_lines.append(line.strip())
        
        if address_lines:
            # Take the longest line as potential address or combine multiple lines
            return ' '.join(address_lines[:2])  # Take first 2 address lines
        
        return None
    
    def extract_photo_from_aadhaar(self, image_bytes: bytes) -> Optional[str]:
        """Extract user photo from Aadhaar card and return as base64"""
        try:
            # Convert bytes to PIL Image
            pil_image = Image.open(io.BytesIO(image_bytes))
            
            # Convert PIL to OpenCV format
            opencv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
            
            # Get image dimensions
            height, width = opencv_image.shape[:2]

            
            # Based on your exact Aadhaar image layout
            # Photo is in left side, starting from roughly 20% from top to 90% height
            photo_x_start = int(width * 0.01)   # Start 1% from left edge  
            photo_x_end = int(width * 0.24)     # End at 24% from left (photo width)
            photo_y_start = int(height * 0.20)  # Start 20% from top
            photo_y_end = int(height * 0.90)    # End at 90% from top
            

            
            # Extract the photo region
            photo_region = opencv_image[photo_y_start:photo_y_end, photo_x_start:photo_x_end]
            
            if photo_region.size == 0:

                return None
            

            
            # Convert back to PIL Image
            photo_rgb = cv2.cvtColor(photo_region, cv2.COLOR_BGR2RGB)
            photo_pil = Image.fromarray(photo_rgb)
            
            # Resize to standard size (passport photo size)
            photo_pil = photo_pil.resize((150, 200), Image.LANCZOS)
            
            # Convert to base64
            buffer = io.BytesIO()
            photo_pil.save(buffer, format='JPEG', quality=85)
            photo_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            

            return photo_base64
            
        except Exception as e:
            logger.error(f"Error extracting photo: {str(e)}")
            return None
    
    def extract_aadhaar_data(self, image_bytes: bytes) -> Dict:
        """Extract focused Aadhaar data: Aadhaar number, phone, DOB, and photo"""
        try:
            # Extract text from image
            extracted_text = self.extract_text(image_bytes)
            
            # Extract only the three required fields
            aadhaar_number = self.extract_aadhaar_number(extracted_text)
            phone = self.extract_phone(extracted_text)
            dob = self.extract_dob(extracted_text)
            
            # Extract user photo from Aadhaar
            aadhaar_photo_base64 = self.extract_photo_from_aadhaar(image_bytes)
            
            return {
                'aadhaar_number': aadhaar_number,
                'phone_number': phone,
                'dob': dob,
                'aadhaar_photo_base64': aadhaar_photo_base64,
                'raw_text': extracted_text,
                'success': True
            }
        except Exception as e:
            logger.error(f"Error in extraction: {str(e)}")
            return {
                'error': f"Error processing Aadhaar data: {str(e)}",
                'success': False
            }

# Global OCR service instance
ocr_service = None

def get_ocr_service() -> OCRService:
    """Get OCR service instance"""
    global ocr_service
    if ocr_service is None:
        ocr_service = OCRService()
    return ocr_service