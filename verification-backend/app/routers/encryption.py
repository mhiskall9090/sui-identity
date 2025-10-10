from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
import logging

from ..models.encryption_metadata import (
    EncryptionMetadata,
    EncryptionMetadataCreate,
    EncryptionMetadataUpdate,
    GovernmentDecryptionRequest,
    GovernmentDecryptionResponse,
    UserEncryptionSummary,
    DIDType
)
from ..services.encryption_service import encryption_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/encryption", tags=["encryption"])

@router.post("/store", response_model=EncryptionMetadata)
async def store_encryption_metadata(metadata: EncryptionMetadataCreate):
    """
    Store encryption metadata for a user's document
    
    This endpoint is called after successful document encryption and Walrus upload
    to store all the necessary metadata for government decryption access.
    """
    try:
        result = await encryption_service.store_encryption_metadata(metadata)
        return result
    except Exception as e:
        logger.error(f"Failed to store encryption metadata: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to store metadata: {str(e)}")

@router.get("/user/{user_address}", response_model=List[EncryptionMetadata])
async def get_user_documents(
    user_address: str,
    did_type: Optional[DIDType] = Query(None, description="Filter by DID type")
):
    """
    Get all encrypted documents for a specific user
    
    Optionally filter by DID type (age_verification, citizenship_verification, etc.)
    """
    try:
        documents = await encryption_service.get_user_documents(user_address, did_type)
        return documents
    except Exception as e:
        logger.error(f"Failed to retrieve user documents: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve documents: {str(e)}")

@router.post("/government/access", response_model=GovernmentDecryptionResponse)
async def get_government_accessible_documents(request: GovernmentDecryptionRequest):
    """
    Get documents accessible by government for decryption
    
    This endpoint is used by government officials to retrieve encryption metadata
    for documents they have permission to decrypt via the whitelist contract.
    """
    try:
        # TODO: Add government wallet verification here
        # Verify that the government_wallet is whitelisted in the contract
        
        response = await encryption_service.get_government_accessible_documents(request.user_address)
        
        # Filter by specific DID types if requested
        if request.did_types:
            response.accessible_documents = [
                doc for doc in response.accessible_documents 
                if doc.did_type in request.did_types
            ]
        
        # Log the access request for audit purposes
        logger.info(f"Government access request: {request.government_wallet} accessing {request.user_address} documents")
        
        return response
    except Exception as e:
        logger.error(f"Failed to retrieve government accessible documents: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve documents: {str(e)}")

@router.get("/blob/{blob_id}", response_model=EncryptionMetadata)
async def get_metadata_by_blob_id(blob_id: str):
    """
    Get encryption metadata by Walrus blob ID
    
    Useful for retrieving decryption parameters when you have the blob ID
    """
    try:
        metadata = await encryption_service.get_by_blob_id(blob_id)
        if not metadata:
            raise HTTPException(status_code=404, detail="Metadata not found for blob ID")
        return metadata
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve metadata by blob ID: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve metadata: {str(e)}")

@router.get("/encryption/{encryption_id}", response_model=EncryptionMetadata)
async def get_metadata_by_encryption_id(encryption_id: str):
    """
    Get encryption metadata by Seal encryption ID
    
    Useful for retrieving metadata when you have the encryption ID from Seal
    """
    try:
        metadata = await encryption_service.get_by_encryption_id(encryption_id)
        if not metadata:
            raise HTTPException(status_code=404, detail="Metadata not found for encryption ID")
        return metadata
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve metadata by encryption ID: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve metadata: {str(e)}")

@router.put("/blob/{blob_id}", response_model=EncryptionMetadata)
async def update_encryption_metadata(blob_id: str, update_data: EncryptionMetadataUpdate):
    """
    Update encryption metadata
    
    Used to update metadata after verification completion, NFT claiming, etc.
    """
    try:
        updated_metadata = await encryption_service.update_encryption_metadata(blob_id, update_data)
        if not updated_metadata:
            raise HTTPException(status_code=404, detail="Metadata not found for blob ID")
        return updated_metadata
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update encryption metadata: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update metadata: {str(e)}")

@router.get("/user/{user_address}/summary", response_model=UserEncryptionSummary)
async def get_user_summary(user_address: str):
    """
    Get summary of user's encrypted documents
    
    Provides overview of document counts, verification status, etc.
    """
    try:
        summary = await encryption_service.get_user_summary(user_address)
        return summary
    except Exception as e:
        logger.error(f"Failed to generate user summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")

@router.post("/verification/complete/{user_did_id}")
async def mark_verification_complete(
    user_did_id: str,
    verification_status: str,
    nautilus_signature: str
):
    """
    Mark all documents for a UserDID as verification complete
    
    Called when verification is completed via the blockchain event listener
    """
    try:
        updated_docs = await encryption_service.mark_verification_complete(
            user_did_id, verification_status, nautilus_signature
        )
        return {
            "message": f"Marked {len(updated_docs)} documents as verification complete",
            "user_did_id": user_did_id,
            "updated_count": len(updated_docs)
        }
    except Exception as e:
        logger.error(f"Failed to mark verification complete: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update verification status: {str(e)}")

@router.post("/cleanup/expired")
async def cleanup_expired_documents():
    """
    Clean up expired documents
    
    Administrative endpoint to mark expired documents
    """
    try:
        expired_count = await encryption_service.cleanup_expired_documents()
        return {
            "message": f"Marked {expired_count} documents as expired",
            "expired_count": expired_count
        }
    except Exception as e:
        logger.error(f"Failed to cleanup expired documents: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cleanup documents: {str(e)}")

@router.get("/government/decryption-data/{user_address}")
async def get_decryption_data_for_government(
    user_address: str,
    government_wallet: str = Query(..., description="Government wallet address"),
    did_type: Optional[DIDType] = Query(None, description="Filter by DID type")
):
    """
    Get decryption data specifically formatted for government use
    
    Returns the exact data needed for the government decryption page:
    - Blob IDs
    - Encryption IDs  
    - User address
    - DID types
    - Document metadata
    """
    try:
        # Get accessible documents
        documents = await encryption_service.get_user_documents(user_address, did_type)
        
        # Filter only government accessible documents
        accessible_docs = [doc for doc in documents if doc.is_government_accessible]
        
        # Format for government decryption interface
        decryption_data = {
            "user_address": user_address,
            "government_wallet": government_wallet,
            "total_documents": len(accessible_docs),
            "documents": [
                {
                    "blob_id": doc.blob_id,
                    "encryption_id": doc.encryption_id,
                    "did_type": doc.did_type,
                    "document_type": doc.document_type,
                    "file_name": doc.file_name,
                    "created_at": doc.created_at,
                    "verification_completed": doc.verification_completed,
                    "verification_status": doc.verification_status,
                    "walrus_url": f"https://sui-walrus-tn-aggregator.bwarelabs.com/v1/blobs/{doc.blob_id}",
                    "sui_explorer_url": f"https://suiscan.xyz/testnet/object/{doc.sui_ref}"
                }
                for doc in accessible_docs
            ]
        }
        
        logger.info(f"Government decryption data requested: {government_wallet} for user {user_address}")
        return decryption_data
        
    except Exception as e:
        logger.error(f"Failed to get government decryption data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get decryption data: {str(e)}")
