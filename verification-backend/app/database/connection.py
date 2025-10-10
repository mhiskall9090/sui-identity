"""
MongoDB connection and database configuration
"""
import os
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class MongoDB:
    client: Optional[AsyncIOMotorClient] = None
    database = None

# MongoDB connection instance
mongodb = MongoDB()

async def connect_to_mongo():
    """Create database connection"""
    try:
        # Get MongoDB URI from environment variables
        mongodb_uri = os.getenv("MONGODB_URI")
        
        if not mongodb_uri:
            raise ValueError("MONGODB_URI environment variable is required but not set")
        
        # Create MongoDB client
        mongodb.client = AsyncIOMotorClient(mongodb_uri)
        
        # Get database name from URI or use default
        database_name = os.getenv("DATABASE_NAME", "suiverify")
        mongodb.database = mongodb.client[database_name]
        
        # Test the connection
        await mongodb.client.admin.command('ping')
        logger.info(f"Successfully connected to MongoDB database: {database_name}")
        
    except ConnectionFailure as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error connecting to MongoDB: {e}")
        raise

async def close_mongo_connection():
    """Close database connection"""
    if mongodb.client:
        mongodb.client.close()
        logger.info("MongoDB connection closed")

def get_database():
    """Get database instance"""
    return mongodb.database

# Collection names
USERS_COLLECTION = "users"
OTP_COLLECTION = "otps"
VERIFICATION_LOGS_COLLECTION = "verification_logs"