from datetime import datetime
from typing import Dict, Any, Optional, Tuple
import re
import pytesseract
import cv2
import numpy as np
from PIL import Image
import io

from ..models.document_types import (
    DocumentType, 
    DocumentFields, 
    VALIDATION_PATTERNS, 
    VERIFICATION_CONFIG
)

class DocumentVerificationService:
    def __init__(self):
        # Configure Tesseract
        pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'  # Update path as needed

    def verify_document(
        self, 
        document_type: DocumentType,
        document_image: bytes,
        face_image: Optional[bytes] = None,
        verification_type: str = "age_verification"
    ) -> Tuple[bool, Dict[str, Any], str]:
        """
        Verify a Ghana document (Ghana Card or Passport)
        Returns: (success, extracted_data, error_message)
        """
        try:
            # Convert image bytes to OpenCV format
            nparr = np.frombuffer(document_image, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Preprocess image
            preprocessed = self._preprocess_image(img)
            
            # Extract text using OCR
            extracted_text = pytesseract.image_to_string(preprocessed)
            
            # Parse document fields based on type
            if document_type == DocumentType.GHANA_CARD:
                data = self._parse_ghana_card(extracted_text)
            else:
                data = self._parse_ghana_passport(extracted_text)
            
            # Validate required fields
            fields = DocumentFields.get_fields(document_type)
            for field in fields["required"]:
                if field not in data or not data[field]:
                    return False, {}, f"Missing required field: {field}"
            
            # Add document type
            data["document_type"] = document_type
            
            # Validate document number format
            if document_type == DocumentType.GHANA_CARD:
                if not re.match(VALIDATION_PATTERNS["GHANA_CARD_NUMBER"], data["card_number"]):
                    return False, {}, "Invalid Ghana Card number format"
            else:
                if not re.match(VALIDATION_PATTERNS["GHANA_PASSPORT_NUMBER"], data["passport_number"]):
                    return False, {}, "Invalid Ghana Passport number format"
            
            # Get verification config
            config = VERIFICATION_CONFIG[document_type][verification_type]
            
            # Check expiry if required
            if config["expiry_check"]:
                expiry_date = datetime.strptime(data["expiry_date"], "%Y-%m-%d")
                if expiry_date < datetime.now():
                    return False, {}, "Document has expired"
            
            # Verify age for age verification
            if verification_type == "age_verification":
                dob = datetime.strptime(data["date_of_birth"], "%Y-%m-%d")
                age = (datetime.now() - dob).days / 365
                if age < config["min_age"]:
                    return False, {}, f"Person is under {config['min_age']} years old"
            
            # Verify nationality for citizenship verification
            if verification_type == "citizenship_verification":
                if data["nationality"] not in config["allowed_nationalities"]:
                    return False, {}, "Not a Ghanaian citizen"
            
            # Verify face if required
            if config["require_face_match"] and face_image:
                face_match_score = self._verify_face_match(document_image, face_image)
                if face_match_score < config["face_match_threshold"]:
                    return False, {}, "Face verification failed"
                data["face_match_score"] = face_match_score
            
            return True, data, "Verification successful"
            
        except Exception as e:
            return False, {}, f"Verification failed: {str(e)}"

    def _preprocess_image(self, img):
        """Preprocess image for better OCR results"""
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Apply thresholding
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Remove noise
        denoised = cv2.fastNlMeansDenoising(thresh)
        
        return denoised

    def _parse_ghana_card(self, text: str) -> Dict[str, str]:
        """Parse Ghana Card text using regex patterns"""
        data = {}
        
        # Example patterns - adjust based on actual Ghana Card format
        patterns = {
            "card_number": r"GHA-\d{9}-\d{1}",
            "full_name": r"Name:\s*([A-Z\s]+)",
            "date_of_birth": r"Date of Birth:\s*(\d{2}-\d{2}-\d{4})",
            "gender": r"Sex:\s*([MF])",
            "nationality": r"Nationality:\s*(\w+)",
            "expiry_date": r"Date of Expiry:\s*(\d{2}-\d{2}-\d{4})"
        }
        
        for field, pattern in patterns.items():
            match = re.search(pattern, text)
            if match:
                data[field] = match.group(1)
        
        return data

    def _parse_ghana_passport(self, text: str) -> Dict[str, str]:
        """Parse Ghana Passport text using regex patterns"""
        data = {}
        
        # Example patterns - adjust based on actual Ghana Passport format
        patterns = {
            "passport_number": r"G\d{7}",
            "full_name": r"Surname/Nom\s*([A-Z\s]+)",
            "date_of_birth": r"Date of Birth/Date de naissance\s*(\d{2}\s\w{3}\s\d{4})",
            "gender": r"Sex/Sexe\s*([MF])",
            "nationality": r"Nationality/Nationalité\s*(\w+)",
            "expiry_date": r"Date of Expiry/Date d'expiration\s*(\d{2}\s\w{3}\s\d{4})"
        }
        
        for field, pattern in patterns.items():
            match = re.search(pattern, text)
            if match:
                data[field] = match.group(1)
        
        return data

    def _verify_face_match(self, doc_image: bytes, face_image: bytes) -> float:
        """
        Verify if the face in the selfie matches the face in the document
        Returns a confidence score between 0 and 1
        """
        # Convert images to PIL format
        doc_img = Image.open(io.BytesIO(doc_image))
        face_img = Image.open(io.BytesIO(face_image))
        
        # Extract face from document image
        doc_face = self._extract_face(doc_img)
        
        # Extract face from selfie
        selfie_face = self._extract_face(face_img)
        
        if doc_face is None or selfie_face is None:
            return 0.0
        
        # TODO: Implement face comparison using a face recognition library
        # For now, returning a placeholder score
        return 0.9

    def _extract_face(self, image: Image) -> Optional[np.ndarray]:
        """Extract face from an image using OpenCV"""
        # Convert PIL image to OpenCV format
        img = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        
        # Load face detection cascade
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # Detect faces
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        
        if len(faces) == 0:
            return None
        
        # Get the largest face
        largest_face = max(faces, key=lambda rect: rect[2] * rect[3])
        x, y, w, h = largest_face
        
        # Extract face ROI
        face_roi = img[y:y+h, x:x+w]
        
        return face_roi