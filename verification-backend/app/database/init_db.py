"""
Database initialization script
"""
import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.database.connection import connect_to_mongo, get_database, USERS_COLLECTION, VERIFICATION_LOGS_COLLECTION

logger = logging.getLogger(__name__)

async def create_indexes():
    """Create database indexes for optimal performance"""
    try:
        await connect_to_mongo()
        db = get_database()
        
        # Create indexes for users collection
        try:
            await db[USERS_COLLECTION].create_index("wallet_address", unique=True)
            logger.info("Created unique index on wallet_address")
        except Exception as e:
            logger.info(f"Index on wallet_address already exists: {e}")
        
        try:
            await db[USERS_COLLECTION].create_index("phone_number")
            await db[USERS_COLLECTION].create_index("is_verified")
            await db[USERS_COLLECTION].create_index("created_at")
            logger.info("Created indexes for users collection")
        except Exception as e:
            logger.info(f"Some user indexes already exist: {e}")
        
        # Create indexes for verification logs collection
        try:
            await db[VERIFICATION_LOGS_COLLECTION].create_index("wallet_address")
            await db[VERIFICATION_LOGS_COLLECTION].create_index("verification_type")
            await db[VERIFICATION_LOGS_COLLECTION].create_index("status")
            logger.info("Created basic indexes for verification logs collection")
        except Exception as e:
            logger.info(f"Some verification log indexes already exist: {e}")
        
        try:
            await db[VERIFICATION_LOGS_COLLECTION].create_index([
                ("wallet_address", 1),
                ("timestamp", -1)
            ])
            logger.info("Created compound index for verification logs")
        except Exception as e:
            logger.info(f"Compound index already exists: {e}")
        
        logger.info("Database initialization completed successfully")
        
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise

async def drop_collections():
    """Drop all collections (for testing/reset purposes)"""
    try:
        await connect_to_mongo()
        db = get_database()
        
        await db[USERS_COLLECTION].drop()
        await db[VERIFICATION_LOGS_COLLECTION].drop()
        
        logger.info("Dropped all collections")
        
    except Exception as e:
        logger.error(f"Error dropping collections: {e}")
        raise

if __name__ == "__main__":
    # Run database initialization
    asyncio.run(create_indexes())