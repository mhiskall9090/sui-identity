from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import datetime
import logging
from app.database import get_database

logger = logging.getLogger(__name__)

router = APIRouter()

class CredentialData(BaseModel):
    id: str
    title: str
    description: str
    status: str
    issuer: str
    issuedDate: str
    expiryDate: str
    type: str
    nftId: Optional[str] = None
    suiExplorerUrl: Optional[str] = None
    walrusUrl: Optional[str] = None
    blobId: Optional[str] = None
    userAddress: str
    didType: str
    createdAt: str

class NFTCredentialRequest(BaseModel):
    userAddress: str
    nftId: str
    didType: str
    title: str
    description: str
    suiExplorerUrl: str
    walrusUrl: Optional[str] = None
    blobId: Optional[str] = None
    transactionHash: str
    status: Optional[str] = "verified"
    type: Optional[str] = "nft"
    issuer: Optional[str] = "SuiVerify Identity Service"

class StatusUpdate(BaseModel):
    status: str

@router.get("/credentials/user/{user_address}")
async def get_user_credentials(user_address: str, db=Depends(get_database)):
    """
    Get all credentials for a specific user address
    """
    try:
        logger.info(f"Fetching credentials for user: {user_address}")
        
        # Get credentials collection
        credentials_collection = db.credentials
        
        # Find all credentials for this user
        credentials_cursor = credentials_collection.find({"userAddress": user_address})
        credentials_list = []
        
        async for credential in credentials_cursor:
            # Convert MongoDB ObjectId to string
            credential["_id"] = str(credential["_id"])
            credential["id"] = credential["_id"]
            credentials_list.append(credential)
        
        # Calculate stats
        total = len(credentials_list)
        verified = len([c for c in credentials_list if c.get("status") == "verified"])
        pending = len([c for c in credentials_list if c.get("status") == "pending"])
        
        logger.info(f"Found {total} credentials for user {user_address}")
        
        return {
            "credentials": credentials_list,
            "total": total,
            "verified": verified,
            "pending": pending
        }
        
    except Exception as e:
        logger.error(f"Error fetching credentials for {user_address}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch credentials: {str(e)}")

@router.post("/credentials/nft")
async def save_nft_credential(credential: NFTCredentialRequest, db=Depends(get_database)):
    """
    Save NFT credential after successful claim
    """
    try:
        logger.info(f"Saving NFT credential for user: {credential.userAddress}")
        
        # Get credentials collection
        credentials_collection = db.credentials
        
        # Generate credential ID based on timestamp
        credential_id = f"cred_{int(datetime.datetime.now().timestamp() * 1000)}"
        
        # Prepare credential document
        credential_doc = {
            "id": credential_id,
            "userAddress": credential.userAddress,
            "nftId": credential.nftId,
            "didType": credential.didType,
            "title": credential.title,
            "description": credential.description,
            "suiExplorerUrl": credential.suiExplorerUrl,
            "walrusUrl": credential.walrusUrl,
            "blobId": credential.blobId,
            "transactionHash": credential.transactionHash,
            "status": credential.status,
            "type": credential.type,
            "issuer": credential.issuer,
            "issuedDate": datetime.datetime.now().isoformat(),
            "expiryDate": (datetime.datetime.now() + datetime.timedelta(days=365)).isoformat(),
            "createdAt": datetime.datetime.now().isoformat(),
            "updatedAt": datetime.datetime.now().isoformat()
        }
        
        # Insert into database
        result = await credentials_collection.insert_one(credential_doc)
        
        if result.inserted_id:
            logger.info(f"Successfully saved NFT credential: {credential_id}")
            return {
                "success": True,
                "credentialId": credential_id,
                "message": "NFT credential saved successfully"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to save credential to database")
            
    except Exception as e:
        logger.error(f"Error saving NFT credential: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save NFT credential: {str(e)}")

@router.patch("/credentials/{credential_id}/status")
async def update_credential_status(credential_id: str, status_update: StatusUpdate, db=Depends(get_database)):
    """
    Update credential status
    """
    try:
        logger.info(f"Updating credential {credential_id} status to: {status_update.status}")
        
        # Validate status
        valid_statuses = ["verified", "pending", "expired"]
        if status_update.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        
        # Get credentials collection
        credentials_collection = db.credentials
        
        # Update the credential
        result = await credentials_collection.update_one(
            {"id": credential_id},
            {
                "$set": {
                    "status": status_update.status,
                    "updatedAt": datetime.datetime.now().isoformat()
                }
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Credential not found")
        
        if result.modified_count > 0:
            logger.info(f"Successfully updated credential {credential_id}")
            return {"success": True, "message": "Credential status updated successfully"}
        else:
            return {"success": True, "message": "No changes made (status was already set)"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating credential status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update credential: {str(e)}")

@router.delete("/credentials/{credential_id}")
async def delete_credential(credential_id: str, db=Depends(get_database)):
    """
    Delete a credential (optional endpoint)
    """
    try:
        logger.info(f"Deleting credential: {credential_id}")
        
        # Get credentials collection
        credentials_collection = db.credentials
        
        # Delete the credential
        result = await credentials_collection.delete_one({"id": credential_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Credential not found")
        
        logger.info(f"Successfully deleted credential {credential_id}")
        return {"success": True, "message": "Credential deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting credential: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete credential: {str(e)}")

# Health check endpoint
@router.get("/credentials/health")
async def credentials_health_check():
    """
    Health check for credentials service
    """
    return {
        "status": "healthy",
        "service": "credentials",
        "timestamp": datetime.datetime.now().isoformat()
    }
