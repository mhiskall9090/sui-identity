"""
User service for managing user data in MongoDB
"""
from datetime import datetime
from typing import Optional, List, Dict
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError
import logging

from app.database import get_database, USERS_COLLECTION, VERIFICATION_LOGS_COLLECTION
from app.models.user import UserCreate, UserUpdate, UserInDB, UserResponse, VerificationLog

logger = logging.getLogger(__name__)

class UserService:
    def __init__(self):
        self.db: AsyncIOMotorDatabase = None
    
    async def get_db(self):
        if self.db is None:
            self.db = get_database()

        return self.db
    
    async def create_user(self, user_data: UserCreate) -> UserResponse:
        """Create a new user"""
        try:
            db = await self.get_db()
            
            if db is None:
                raise ValueError("Database connection is None")
            
            # Check if user already exists
            existing_user = await db[USERS_COLLECTION].find_one(
                {"wallet_address": user_data.wallet_address}
            )
            
            if existing_user:
                logger.warning(f"User already exists with wallet: {user_data.wallet_address}")
                raise ValueError(f"User with wallet address {user_data.wallet_address} already exists")
            
            # Create user document
            user_dict = user_data.dict()
            user_dict["created_at"] = datetime.utcnow()
            user_dict["updated_at"] = datetime.utcnow()
            
            # Insert user
            result = await db[USERS_COLLECTION].insert_one(user_dict)
            
            # Retrieve created user
            created_user = await db[USERS_COLLECTION].find_one({"_id": result.inserted_id})
            
            if not created_user:
                raise ValueError("Failed to retrieve created user")
            
            logger.info(f"Created new user with wallet address: {user_data.wallet_address}")
            return UserResponse(**created_user)
            
        except DuplicateKeyError as e:
            logger.error(f"Duplicate key error: {e}")
            raise ValueError(f"User with wallet address {user_data.wallet_address} already exists")
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            raise
    
    async def get_user_by_wallet(self, wallet_address: str) -> Optional[UserResponse]:
        """Get user by wallet address"""
        try:
            db = await self.get_db()
            user = await db[USERS_COLLECTION].find_one({"wallet_address": wallet_address.lower()})
            
            if user:
                return UserResponse(**user)
            return None
            
        except Exception as e:
            logger.error(f"Error getting user by wallet {wallet_address}: {e}")
            raise
    
    async def update_user(self, wallet_address: str, user_update: UserUpdate) -> Optional[UserResponse]:
        """Update user data"""
        try:
            db = await self.get_db()
            
            # Prepare update data
            update_data = {k: v for k, v in user_update.dict().items() if v is not None}
            update_data["updated_at"] = datetime.utcnow()
            
            # Update user
            result = await db[USERS_COLLECTION].update_one(
                {"wallet_address": wallet_address.lower()},
                {"$set": update_data}
            )
            
            if result.matched_count == 0:
                return None
            
            # Return updated user - use new wallet address if it was updated
            search_wallet = user_update.wallet_address.lower() if user_update.wallet_address else wallet_address.lower()
            updated_user = await db[USERS_COLLECTION].find_one({"wallet_address": search_wallet})
            logger.info(f"Updated user with wallet address: {wallet_address}")
            
            if updated_user is None:
                logger.error(f"Could not find updated user with wallet address: {search_wallet}")
                return None
                
            return UserResponse(**updated_user)
            
        except Exception as e:
            logger.error(f"Error updating user {wallet_address}: {e}")
            raise
    
    async def verify_user(self, wallet_address: str) -> Optional[UserResponse]:
        """Mark user as verified"""
        try:
            update_data = UserUpdate(is_verified=1)
            return await self.update_user(wallet_address, update_data)
            
        except Exception as e:
            logger.error(f"Error verifying user {wallet_address}: {e}")
            raise
    
    async def get_user_verification_status(self, wallet_address: str) -> bool:
        """Check if user is verified"""
        try:
            user = await self.get_user_by_wallet(wallet_address)
            return user.is_verified == 1 if user else False
            
        except Exception as e:
            logger.error(f"Error checking verification status for {wallet_address}: {e}")
            return False
    
    async def log_verification_attempt(self, log_data: VerificationLog) -> bool:
        """Log verification attempt"""
        try:
            db = await self.get_db()
            
            log_dict = log_data.dict()
            await db[VERIFICATION_LOGS_COLLECTION].insert_one(log_dict)
            
            logger.info(f"Logged verification attempt for {log_data.wallet_address}: {log_data.verification_type}")
            return True
            
        except Exception as e:
            logger.error(f"Error logging verification attempt: {e}")
            return False
    
    async def get_user_verification_logs(self, wallet_address: str) -> List[VerificationLog]:
        """Get verification logs for a user"""
        try:
            db = await self.get_db()
            
            cursor = db[VERIFICATION_LOGS_COLLECTION].find(
                {"wallet_address": wallet_address.lower()}
            ).sort("timestamp", -1)
            
            logs = []
            async for log in cursor:
                logs.append(VerificationLog(**log))
            
            return logs
            
        except Exception as e:
            logger.error(f"Error getting verification logs for {wallet_address}: {e}")
            return []
    
    async def get_all_verified_users(self) -> List[UserResponse]:
        """Get all verified users"""
        try:
            db = await self.get_db()
            
            cursor = db[USERS_COLLECTION].find({"is_verified": 1}).sort("updated_at", -1)
            
            users = []
            async for user in cursor:
                users.append(UserResponse(**user))
            
            return users
            
        except Exception as e:
            logger.error(f"Error getting verified users: {e}")
            return []
    
    async def get_user_count_by_verification_status(self) -> Dict[str, int]:
        """Get count of users by verification status"""
        try:
            db = await self.get_db()
            
            total_users = await db[USERS_COLLECTION].count_documents({})
            verified_users = await db[USERS_COLLECTION].count_documents({"is_verified": 1})
            unverified_users = await db[USERS_COLLECTION].count_documents({"is_verified": 0})
            
            return {
                "total_users": total_users,
                "verified_users": verified_users,
                "unverified_users": unverified_users
            }
            
        except Exception as e:
            logger.error(f"Error getting user counts: {e}")
            return {"total_users": 0, "verified_users": 0, "unverified_users": 0}
    


    async def get_user_by_phone(self, phone_number: str) -> Optional[UserResponse]:
        """Get user by phone number"""
        try:
            db = await self.get_db()
            user = await db[USERS_COLLECTION].find_one({"phone_number": phone_number})
            
            if user:
                return UserResponse(**user)
            return None
            
        except Exception as e:
            logger.error(f"Error getting user by phone {phone_number}: {e}")
            raise

# Dependency injection
_user_service = None

def get_user_service() -> UserService:
    global _user_service
    if _user_service is None:
        _user_service = UserService()
    return _user_service