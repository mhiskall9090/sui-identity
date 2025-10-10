from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

from .document_types import DocumentType, VerificationType

class DIDType(str, Enum):
    AGE_VERIFICATION = VerificationType.AGE_VERIFICATION
    CITIZENSHIP_VERIFICATION = VerificationType.CITIZENSHIP_VERIFICATION

class EncryptionStatus(str, Enum):
    ENCRYPTED = "encrypted"
    STORED = "stored"
    ACCESSIBLE = "accessible"
    EXPIRED = "expired"

class EncryptionMetadata(BaseModel):
    """
    MongoDB document model for storing encryption metadata
    Required for government decryption access
    """
    # Primary identifiers
    user_address: str = Field(..., description="Sui wallet address of the user")
    blob_id: str = Field(..., description="Walrus blob ID for encrypted document")
    encryption_id: str = Field(..., description="Seal encryption ID (whitelist_id + nonce)")
    
    # Document metadata
    did_type: DIDType = Field(..., description="Type of DID verification")
    document_type: str = Field(..., description="Type of document (aadhaar, passport, etc.)")
    file_name: str = Field(..., description="Original filename")
    file_size: int = Field(..., description="File size in bytes")
    content_type: str = Field(default="image/jpeg", description="MIME type of the document")
    
    # Blockchain references
    sui_ref: str = Field(..., description="Sui transaction/object reference")
    user_did_id: Optional[str] = Field(None, description="UserDID object ID from verification")
    nft_id: Optional[str] = Field(None, description="DID NFT object ID if claimed")
    
    # Seal/Walrus specific data
    government_whitelist_id: str = Field(..., description="Government whitelist object ID")
    seal_threshold: int = Field(default=2, description="Seal decryption threshold")
    walrus_epochs: int = Field(default=1, description="Walrus storage epochs")
    
    # Access control
    status: EncryptionStatus = Field(default=EncryptionStatus.ENCRYPTED, description="Current status")
    is_government_accessible: bool = Field(default=True, description="Whether government can access")
    access_granted_to: List[str] = Field(default=[], description="Wallet addresses with access")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update timestamp")
    expires_at: Optional[datetime] = Field(None, description="Expiration timestamp")
    
    # Verification metadata
    verification_completed: bool = Field(default=False, description="Whether verification is complete")
    verification_status: Optional[str] = Field(None, description="Verification result")
    nautilus_signature: Optional[str] = Field(None, description="Nautilus attestation signature")
    
    class Config:
        # MongoDB collection name
        collection_name = "encryption_metadata"
        # Create indexes
        indexes = [
            "user_address",
            "blob_id", 
            "encryption_id",
            "did_type",
            "created_at",
            ("user_address", "did_type"),  # Compound index
            ("user_address", "blob_id"),   # Compound index
        ]

class EncryptionMetadataCreate(BaseModel):
    """Model for creating new encryption metadata"""
    user_address: str
    blob_id: str
    encryption_id: str
    did_type: DIDType
    document_type: str
    file_name: str
    file_size: int
    content_type: str = "image/jpeg"
    sui_ref: str
    government_whitelist_id: str
    user_did_id: Optional[str] = None

class EncryptionMetadataUpdate(BaseModel):
    """Model for updating encryption metadata"""
    user_did_id: Optional[str] = None
    nft_id: Optional[str] = None
    status: Optional[EncryptionStatus] = None
    verification_completed: Optional[bool] = None
    verification_status: Optional[str] = None
    nautilus_signature: Optional[str] = None
    is_government_accessible: Optional[bool] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class GovernmentDecryptionRequest(BaseModel):
    """Model for government decryption requests"""
    user_address: str = Field(..., description="Target user's wallet address")
    government_wallet: str = Field(..., description="Government official's wallet address")
    reason: str = Field(..., description="Reason for accessing encrypted documents")
    did_types: Optional[List[DIDType]] = Field(None, description="Specific DID types to access")

class GovernmentDecryptionResponse(BaseModel):
    """Response model for government decryption data"""
    user_address: str
    total_documents: int
    accessible_documents: List[EncryptionMetadata]
    message: str

class UserEncryptionSummary(BaseModel):
    """Summary of user's encrypted documents"""
    user_address: str
    total_documents: int
    by_did_type: dict
    latest_document: Optional[EncryptionMetadata]
    verification_status: dict
