from pydantic import BaseModel, validator
from typing import Optional
from datetime import datetime
import re

class AadhaarData(BaseModel):
    name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    aadhaar_number: Optional[str] = None
    
    @validator('date_of_birth')
    def validate_dob(cls, v):
        if v:
            # Try to parse different date formats
            date_patterns = [
                r'\d{2}/\d{2}/\d{4}',
                r'\d{2}-\d{2}-\d{4}',
                r'\d{4}-\d{2}-\d{2}'
            ]
            for pattern in date_patterns:
                if re.match(pattern, v):
                    return v
        return v
    
    @validator('phone')
    def validate_phone(cls, v):
        if v:
            # Remove any non-digit characters
            phone_clean = re.sub(r'\D', '', v)
            if len(phone_clean) == 10:
                return phone_clean
        return v


class IDData(BaseModel):
    name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    id_number: Optional[str] = None
    country: Optional[str] = None

    @validator('date_of_birth')
    def validate_dob(cls, v):
        if v:
            date_patterns = [r'\d{2}/\d{2}/\d{4}', r'\d{2}-\d{2}-\d{4}', r'\d{4}-\d{2}-\d{2}']
            for pattern in date_patterns:
                if re.match(pattern, v):
                    return v
        return v

    @validator('phone')
    def validate_phone_generic(cls, v):
        if v:
            phone_clean = re.sub(r'\D', '', v)
            if 7 <= len(phone_clean) <= 15:
                return phone_clean
        return v

class OTPRequest(BaseModel):
    phone: str
    
class OTPVerification(BaseModel):
    phone: str
    otp: str

class FaceMatchRequest(BaseModel):
    confidence_threshold: Optional[float] = 0.6

class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
    error: Optional[str] = None