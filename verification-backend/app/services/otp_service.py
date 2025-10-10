import random
import string
from datetime import datetime, timedelta
from typing import Dict, Optional
import re
import os
from twilio.rest import Client
import logging

logger = logging.getLogger(__name__)

class OTPService:
    def __init__(self):
        self.otp_storage = {}  # In production, use Redis or database
        self.otp_expiry_minutes = 5  # OTP expires in 5 minutes
        
        # Twilio configuration
        self.twilio_account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        self.twilio_auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        self.twilio_phone_number = os.getenv('TWILIO_PHONE_NUMBER')
        
        # Initialize Twilio client if credentials are provided
        self.twilio_client = None
        if self.twilio_account_sid and self.twilio_auth_token:
            try:
                self.twilio_client = Client(self.twilio_account_sid, self.twilio_auth_token)
                logger.info("Twilio client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Twilio client: {str(e)}")
                self.twilio_client = None
        else:
            logger.warning("Twilio credentials not provided. Using mock SMS implementation.")
    
    def generate_otp(self, phone: str) -> str:
        """Generate 6-digit OTP for phone number"""
        try:
            # Validate phone number
            if not self.validate_phone(phone):
                raise Exception("Invalid phone number format")
            
            # Generate 6-digit OTP
            otp = ''.join(random.choices(string.digits, k=6))
            
            # Store OTP with expiry time
            expiry_time = datetime.now() + timedelta(minutes=self.otp_expiry_minutes)
            self.otp_storage[phone] = {
                'otp': otp,
                'expiry': expiry_time,
                'attempts': 0
            }
            
            return otp
        
        except Exception as e:
            raise Exception(f"Error generating OTP: {str(e)}")
    
    def verify_otp(self, phone: str, provided_otp: str) -> bool:
        """Verify OTP for phone number"""
        try:
            # Validate phone number
            if not self.validate_phone(phone):
                raise Exception("Invalid phone number format")
            
            # Check if OTP exists for this phone
            if phone not in self.otp_storage:
                raise Exception("No OTP found for this phone number")
            
            otp_data = self.otp_storage[phone]
            
            # Check if OTP has expired
            if datetime.now() > otp_data['expiry']:
                # Clean up expired OTP
                del self.otp_storage[phone]
                raise Exception("OTP has expired. Please generate a new OTP.")
            
            # Check attempt limit (max 3 attempts)
            if otp_data['attempts'] >= 3:
                # Clean up after max attempts
                del self.otp_storage[phone]
                raise Exception("Maximum OTP verification attempts exceeded. Please generate a new OTP.")
            
            # Increment attempt counter
            otp_data['attempts'] += 1
            
            # Verify OTP
            if otp_data['otp'] == provided_otp:
                # OTP verified successfully, clean up
                del self.otp_storage[phone]
                return True
            else:
                raise Exception(f"Invalid OTP. {3 - otp_data['attempts']} attempts remaining.")
        
        except Exception as e:
            raise Exception(f"Error verifying OTP: {str(e)}")
    
    def validate_phone(self, phone: str) -> bool:
        """Validate Indian phone number format"""
        # Remove any non-digit characters
        phone_clean = re.sub(r'\D', '', phone)
        
        # Check if it's a valid 10-digit Indian mobile number
        if len(phone_clean) == 10 and phone_clean[0] in '6789':
            return True
        
        return False
    
    def get_otp_status(self, phone: str) -> Dict:
        """Get OTP status for phone number"""
        if phone not in self.otp_storage:
            return {
                'exists': False,
                'message': 'No OTP found for this phone number'
            }
        
        otp_data = self.otp_storage[phone]
        
        # Check if expired
        if datetime.now() > otp_data['expiry']:
            del self.otp_storage[phone]
            return {
                'exists': False,
                'message': 'OTP has expired'
            }
        
        # Calculate remaining time
        remaining_seconds = int((otp_data['expiry'] - datetime.now()).total_seconds())
        
        return {
            'exists': True,
            'attempts_remaining': 3 - otp_data['attempts'],
            'expires_in_seconds': remaining_seconds,
            'message': f'OTP valid for {remaining_seconds} seconds'
        }
    
    def cleanup_expired_otps(self):
        """Clean up expired OTPs (should be called periodically)"""
        current_time = datetime.now()
        expired_phones = [
            phone for phone, data in self.otp_storage.items()
            if current_time > data['expiry']
        ]
        
        for phone in expired_phones:
            del self.otp_storage[phone]
        
        return len(expired_phones)
    
    def send_otp_sms(self, phone: str, otp: str) -> bool:
        """Send OTP via SMS using Twilio"""
        try:
            # Format phone number for international format
            if phone.startswith('91'):
                formatted_phone = f"+{phone}"
            elif phone.startswith('+91'):
                formatted_phone = phone
            else:
                formatted_phone = f"+91{phone}"
            
            logger.info(f"Formatted phone number: {formatted_phone}")
            
            # Create OTP message
            message_body = f"Your Aadhaar verification OTP is {otp}. Valid for {self.otp_expiry_minutes} minutes. Do not share with anyone. - SuiFoundry"
            
            # Send via Twilio if available
            if self.twilio_client and self.twilio_phone_number:
                try:
                    logger.info(f"Sending SMS from {self.twilio_phone_number} to {formatted_phone}")
                    message = self.twilio_client.messages.create(
                        body=message_body,
                        from_=self.twilio_phone_number,
                        to=formatted_phone
                    )
                    
                    logger.info(f"SMS sent successfully via Twilio. SID: {message.sid}")
                    logger.info(f"Message status: {message.status}")
                    
                    # Check message status after a brief delay
                    import time
                    time.sleep(2)  # Wait 2 seconds
                    
                    # Fetch updated message status
                    try:
                        updated_message = self.twilio_client.messages(message.sid).fetch()
                        logger.info(f"Updated message status: {updated_message.status}")
                        if updated_message.error_code:
                            logger.error(f"Twilio error code: {updated_message.error_code} - {updated_message.error_message}")
                    except Exception as status_error:
                        logger.warning(f"Could not fetch message status: {str(status_error)}")
                    
                    return True
                    
                except Exception as twilio_error:
                    logger.error(f"Twilio SMS failed: {str(twilio_error)}")
                    # Fall back to mock implementation
                    return self._send_mock_sms(phone, otp, message_body)
            else:
                # Use mock implementation if Twilio is not configured
                return self._send_mock_sms(phone, otp, message_body)
        
        except Exception as e:
            logger.error(f"Error sending SMS: {str(e)}")
            return False
    
    def _send_mock_sms(self, phone: str, otp: str, message_body: str) -> bool:
        """Mock SMS implementation for development"""
        try:
            logger.info(f"Mock SMS sent to +91{phone} with OTP: {otp}")
            return True
        
        except Exception as e:
            logger.error(f"Mock SMS error: {str(e)}")
            return False

# Global OTP service instance
otp_service = None

def get_otp_service() -> OTPService:
    """Get OTP service instance"""
    global otp_service
    if otp_service is None:
        otp_service = OTPService()
    return otp_service