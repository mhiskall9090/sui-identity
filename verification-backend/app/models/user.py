"""
User model and schemas for MongoDB
"""
from datetime import datetime
from typing import Optional, Dict, Any
try:
    from typing import Annotated
except ImportError:
    from typing_extensions import Annotated
from pydantic import BaseModel, Field, field_validator, ConfigDict
from bson import ObjectId
import re

class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")

    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

class UserBase(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    wallet_address: str = Field(..., description="Sui wallet address (primary key)")
    phone_number: Optional[str] = Field(None, description="User's phone number")
    aadhaar_number: Optional[str] = Field(None, description="Aadhaar card number (legacy)")
    id_number: Optional[str] = Field(None, description="Generic ID number (country-specific, e.g., Ghana Card or Passport)")
    country: Optional[str] = Field(None, description="Country code for the ID (e.g., IN, GH)")
    date_of_birth: Optional[str] = Field(None, description="Date of birth from Aadhaar")
    full_name: Optional[str] = Field(None, description="Full name from Aadhaar")
    gender: Optional[str] = Field(None, description="Gender from Aadhaar")
    is_verified: int = Field(default=0, description="Verification status: 0=not verified, 1=verified")
    did: Optional[int] = Field(default=None, description="DID status: 0=above 18 verification, 1=citizenship application")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    @field_validator('wallet_address')
    @classmethod
    def validate_wallet_address(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Wallet address cannot be empty')
        # Basic validation - just ensure it starts with 0x for now
        if not v.startswith('0x'):
            raise ValueError('Wallet address must start with 0x')
        return v.lower()  # Store in lowercase for consistency
    
    @field_validator('phone_number')
    @classmethod
    def validate_phone_number(cls, v):
        if v is not None:
            # Remove any non-digit characters
            phone_digits = re.sub(r'\D', '', v)
            if len(phone_digits) != 10:
                raise ValueError('Phone number must be 10 digits')
            return phone_digits
        return v
    
    @field_validator('aadhaar_number')
    @classmethod
    def validate_aadhaar_number(cls, v):
        if v is not None:
            # Remove any non-digit characters
            aadhaar_digits = re.sub(r'\D', '', v)
            if len(aadhaar_digits) != 12:
                raise ValueError('Aadhaar number must be 12 digits')
            return aadhaar_digits
        return v

    @field_validator('id_number')
    @classmethod
    def validate_id_number(cls, v):
        if v is not None:
            v_clean = v.strip()
            if len(v_clean) < 5:
                raise ValueError('id_number seems too short')
            return v_clean
        return v
    
    @field_validator('is_verified')
    @classmethod
    def validate_verification_status(cls, v):
        if v not in [0, 1]:
            raise ValueError('Verification status must be 0 or 1')
        return v
    
    @field_validator('did')
    @classmethod
    def validate_did_status(cls, v):
        if v is not None and v not in [0, 1]:
            raise ValueError('DID status must be 0 or 1')
        return v

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    wallet_address: Optional[str] = None
    phone_number: Optional[str] = None
    aadhaar_number: Optional[str] = None
    date_of_birth: Optional[str] = None
    full_name: Optional[str] = None
    gender: Optional[str] = None
    is_verified: Optional[int] = None
    did: Optional[int] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    @field_validator('phone_number')
    @classmethod
    def validate_phone_number(cls, v):
        if v is not None:
            phone_digits = re.sub(r'\D', '', v)
            if len(phone_digits) != 10:
                raise ValueError('Phone number must be 10 digits')
            return phone_digits
        return v
    
    @field_validator('aadhaar_number')
    @classmethod
    def validate_aadhaar_number(cls, v):
        if v is not None:
            aadhaar_digits = re.sub(r'\D', '', v)
            if len(aadhaar_digits) != 12:
                raise ValueError('Aadhaar number must be 12 digits')
            return aadhaar_digits
        return v
    
    @field_validator('is_verified')
    @classmethod
    def validate_verification_status(cls, v):
        if v is not None and v not in [0, 1]:
            raise ValueError('Verification status must be 0 or 1')
        return v
    
    @field_validator('did')
    @classmethod
    def validate_did_status(cls, v):
        if v is not None and v not in [0, 1]:
            raise ValueError('DID status must be 0 or 1')
        return v

class UserInDB(UserBase):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )
    
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")

class UserResponse(BaseModel):
    model_config = ConfigDict(
        json_encoders={
            datetime: lambda v: v.isoformat()
        }
    )
    
    wallet_address: str
    phone_number: Optional[str]
    aadhaar_number: Optional[str]
    date_of_birth: Optional[str]
    full_name: Optional[str]
    gender: Optional[str]
    is_verified: int
    did: Optional[int]
    created_at: datetime
    updated_at: datetime

class VerificationLog(BaseModel):
    model_config = ConfigDict(
        json_encoders={
            datetime: lambda v: v.isoformat()
        }
    )
    
    wallet_address: str
    verification_type: str  # "aadhaar", "face", "otp"
    status: str  # "success", "failed", "pending"
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)