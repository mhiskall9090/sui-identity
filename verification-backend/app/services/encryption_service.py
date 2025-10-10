from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorCollection
from pymongo import ASCENDING, DESCENDING
import logging

from ..database.connection import mongodb
from ..models.encryption_metadata import (
    EncryptionMetadata,
    EncryptionMetadataCreate,
    EncryptionMetadataUpdate,
    GovernmentDecryptionResponse,
    UserEncryptionSummary,
    DIDType,
    EncryptionStatus
)

logger = logging.getLogger(__name__)

class EncryptionMetadataService:
    """Service for managing encryption metadata in MongoDB"""
    
    def __init__(self):
        self.collection_name = "encryption_metadata"
    
    @property
    def collection(self) -> AsyncIOMotorCollection:
        """Get the MongoDB collection"""
        return mongodb.database[self.collection_name]
    
    async def create_indexes(self):
        """Create database indexes for optimal performance"""
        try:
            await self.collection.create_index("user_address")
            await self.collection.create_index("blob_id", unique=True)
            await self.collection.create_index("encryption_id", unique=True)
            await self.collection.create_index("did_type")
            await self.collection.create_index("created_at")
            await self.collection.create_index([("user_address", ASCENDING), ("did_type", ASCENDING)])
            await self.collection.create_index([("user_address", ASCENDING), ("blob_id", ASCENDING)])
            await self.collection.create_index([("user_address", ASCENDING), ("created_at", DESCENDING)])
            
            logger.info("Successfully created encryption metadata indexes")
        except Exception as e:
            logger.error(f"Failed to create indexes: {e}")
    
    async def store_encryption_metadata(self, metadata: EncryptionMetadataCreate) -> EncryptionMetadata:
        """Store encryption metadata for a user's document"""
        try:
            # Create full metadata document
            full_metadata = EncryptionMetadata(
                **metadata.dict(),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            # Insert into MongoDB
            result = await self.collection.insert_one(full_metadata.dict())
            
            if result.inserted_id:
                logger.info(f"Stored encryption metadata for user {metadata.user_address}, blob {metadata.blob_id}")
                return full_metadata
            else:
                raise Exception("Failed to insert metadata")
                
        except Exception as e:
            logger.error(f"Error storing encryption metadata: {e}")
            raise
    
    async def get_user_documents(self, user_address: str, did_type: Optional[DIDType] = None) -> List[EncryptionMetadata]:
        """Get all encrypted documents for a user"""
        try:
            query = {"user_address": user_address}
            if did_type:
                query["did_type"] = did_type
            
            cursor = self.collection.find(query).sort("created_at", DESCENDING)
            documents = []
            
            async for doc in cursor:
                documents.append(EncryptionMetadata(**doc))
            
            logger.info(f"Retrieved {len(documents)} documents for user {user_address}")
            return documents
            
        except Exception as e:
            logger.error(f"Error retrieving user documents: {e}")
            raise
    
    async def get_government_accessible_documents(self, user_address: str) -> GovernmentDecryptionResponse:
        """Get documents accessible by government for a specific user"""
        try:
            query = {
                "user_address": user_address,
                "is_government_accessible": True,
                "status": {"$ne": EncryptionStatus.EXPIRED}
            }
            
            cursor = self.collection.find(query).sort("created_at", DESCENDING)
            documents = []
            
            async for doc in cursor:
                documents.append(EncryptionMetadata(**doc))
            
            total_count = await self.collection.count_documents({"user_address": user_address})
            
            response = GovernmentDecryptionResponse(
                user_address=user_address,
                total_documents=total_count,
                accessible_documents=documents,
                message=f"Found {len(documents)} accessible documents out of {total_count} total documents"
            )
            
            logger.info(f"Government access: {len(documents)} accessible documents for user {user_address}")
            return response
            
        except Exception as e:
            logger.error(f"Error retrieving government accessible documents: {e}")
            raise
    
    async def update_encryption_metadata(self, blob_id: str, update_data: EncryptionMetadataUpdate) -> Optional[EncryptionMetadata]:
        """Update encryption metadata"""
        try:
            update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
            update_dict["updated_at"] = datetime.utcnow()
            
            result = await self.collection.find_one_and_update(
                {"blob_id": blob_id},
                {"$set": update_dict},
                return_document=True
            )
            
            if result:
                logger.info(f"Updated encryption metadata for blob {blob_id}")
                return EncryptionMetadata(**result)
            else:
                logger.warning(f"No metadata found for blob {blob_id}")
                return None
                
        except Exception as e:
            logger.error(f"Error updating encryption metadata: {e}")
            raise
    
    async def get_by_blob_id(self, blob_id: str) -> Optional[EncryptionMetadata]:
        """Get encryption metadata by blob ID"""
        try:
            doc = await self.collection.find_one({"blob_id": blob_id})
            if doc:
                return EncryptionMetadata(**doc)
            return None
            
        except Exception as e:
            logger.error(f"Error retrieving metadata by blob ID: {e}")
            raise
    
    async def get_by_encryption_id(self, encryption_id: str) -> Optional[EncryptionMetadata]:
        """Get encryption metadata by encryption ID"""
        try:
            doc = await self.collection.find_one({"encryption_id": encryption_id})
            if doc:
                return EncryptionMetadata(**doc)
            return None
            
        except Exception as e:
            logger.error(f"Error retrieving metadata by encryption ID: {e}")
            raise
    
    async def get_user_summary(self, user_address: str) -> UserEncryptionSummary:
        """Get summary of user's encrypted documents"""
        try:
            # Get total count
            total_count = await self.collection.count_documents({"user_address": user_address})
            
            # Get count by DID type
            pipeline = [
                {"$match": {"user_address": user_address}},
                {"$group": {"_id": "$did_type", "count": {"$sum": 1}}}
            ]
            
            did_type_counts = {}
            async for doc in self.collection.aggregate(pipeline):
                did_type_counts[doc["_id"]] = doc["count"]
            
            # Get latest document
            latest_doc = await self.collection.find_one(
                {"user_address": user_address},
                sort=[("created_at", DESCENDING)]
            )
            
            latest_metadata = EncryptionMetadata(**latest_doc) if latest_doc else None
            
            # Get verification status counts
            verification_pipeline = [
                {"$match": {"user_address": user_address}},
                {"$group": {"_id": "$verification_completed", "count": {"$sum": 1}}}
            ]
            
            verification_status = {}
            async for doc in self.collection.aggregate(verification_pipeline):
                status = "completed" if doc["_id"] else "pending"
                verification_status[status] = doc["count"]
            
            summary = UserEncryptionSummary(
                user_address=user_address,
                total_documents=total_count,
                by_did_type=did_type_counts,
                latest_document=latest_metadata,
                verification_status=verification_status
            )
            
            logger.info(f"Generated summary for user {user_address}: {total_count} documents")
            return summary
            
        except Exception as e:
            logger.error(f"Error generating user summary: {e}")
            raise
    
    async def mark_verification_complete(self, user_did_id: str, verification_status: str, nautilus_signature: str) -> List[EncryptionMetadata]:
        """Mark all documents for a user as verification complete"""
        try:
            # Update all documents with the user_did_id
            update_data = {
                "verification_completed": True,
                "verification_status": verification_status,
                "nautilus_signature": nautilus_signature,
                "status": EncryptionStatus.ACCESSIBLE,
                "updated_at": datetime.utcnow()
            }
            
            result = await self.collection.update_many(
                {"user_did_id": user_did_id},
                {"$set": update_data}
            )
            
            logger.info(f"Marked {result.modified_count} documents as verification complete for UserDID {user_did_id}")
            
            # Return updated documents
            cursor = self.collection.find({"user_did_id": user_did_id})
            updated_docs = []
            async for doc in cursor:
                updated_docs.append(EncryptionMetadata(**doc))
            
            return updated_docs
            
        except Exception as e:
            logger.error(f"Error marking verification complete: {e}")
            raise
    
    async def cleanup_expired_documents(self) -> int:
        """Clean up expired documents"""
        try:
            current_time = datetime.utcnow()
            
            # Mark documents as expired if they're past expiration
            result = await self.collection.update_many(
                {
                    "expires_at": {"$lt": current_time},
                    "status": {"$ne": EncryptionStatus.EXPIRED}
                },
                {
                    "$set": {
                        "status": EncryptionStatus.EXPIRED,
                        "updated_at": current_time
                    }
                }
            )
            
            logger.info(f"Marked {result.modified_count} documents as expired")
            return result.modified_count
            
        except Exception as e:
            logger.error(f"Error cleaning up expired documents: {e}")
            raise

# Global service instance
encryption_service = EncryptionMetadataService()
