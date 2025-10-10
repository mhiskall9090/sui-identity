"""
Database package initialization
"""
from .connection import (
    connect_to_mongo,
    close_mongo_connection,
    get_database,
    USERS_COLLECTION,
    OTP_COLLECTION,
    VERIFICATION_LOGS_COLLECTION
)

__all__ = [
    "connect_to_mongo",
    "close_mongo_connection", 
    "get_database",
    "USERS_COLLECTION",
    "OTP_COLLECTION",
    "VERIFICATION_LOGS_COLLECTION"
]