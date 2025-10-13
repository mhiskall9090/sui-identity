#!/usr/bin/env python3
"""Redis service for sending verification data using Redis Streams"""

import json
import hashlib
import os
from datetime import datetime
from typing import Optional
import logging
import redis

logger = logging.getLogger(__name__)

class RedisService:
    def __init__(self):
        # Redis configuration from environment variables
        self.redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        self.redis_host = os.getenv('REDIS_HOST', 'localhost')
        self.redis_port = int(os.getenv('REDIS_PORT', '6379'))
        self.redis_password = os.getenv('REDIS_PASSWORD')
        self.redis_username = os.getenv('REDIS_USERNAME')
        self.stream_name = os.getenv('REDIS_STREAM_NAME', 'verification_stream')
        
        # Redis connection configuration
        self.redis_config = {
            'host': self.redis_host,
            'port': self.redis_port,
            'password': self.redis_password,
            'username': self.redis_username,
            'decode_responses': False,  # Keep as bytes for stream compatibility
            'socket_timeout': 30,
            'socket_connect_timeout': 30,
            'retry_on_timeout': True,
            'health_check_interval': 30
        }
        
        # Redis stream configuration
        self.max_stream_length = 10000  # Keep last 10k messages
        
        # Connection status
        self.is_connected = False
        self.connection_error = None
        
        # Redis client
        self.redis_client = None
        
        # Log configuration on initialization
        logger.info(f"Redis Service initialized with:")
        logger.info(f"  Host: {self.redis_host}")
        logger.info(f"  Port: {self.redis_port}")
        logger.info(f"  Stream: {self.stream_name}")
    
    def _get_redis_client(self) -> redis.Redis:
        """Get or create Redis client with connection pooling"""
        if self.redis_client is None:
            try:
                self.redis_client = redis.Redis(**self.redis_config)
                logger.info("Redis client created successfully")
            except Exception as e:
                logger.error(f"Failed to create Redis client: {e}")
                raise
        return self.redis_client
    
    async def test_connection(self) -> bool:
        """Test Redis connection and update connection status"""
        try:
            logger.info(f"Testing Redis connection to {self.redis_config['host']}:{self.redis_config['port']}...")
            
            client = self._get_redis_client()
            
            # Test basic connectivity with ping
            result = client.ping()
            if result:
                self.is_connected = True
                self.connection_error = None
                logger.info(f"✅ Redis connection successful")
                
                # Test stream operations
                test_data = {"test": "connection", "timestamp": datetime.now().isoformat()}
                stream_id = client.xadd("test_stream", test_data, maxlen=1)
                logger.info(f"✅ Redis stream test successful, message ID: {stream_id}")
                
                # Clean up test stream
                client.delete("test_stream")
                
                return True
            else:
                self.connection_error = "Redis ping failed"
                self.is_connected = False
                logger.error(f"❌ Redis ping failed")
                return False
                
        except ConnectionError as e:
            self.connection_error = f"Redis connection error: {str(e)}"
            self.is_connected = False
            logger.error(f"❌ Redis connection failed: {self.connection_error}")
            return False
        except TimeoutError as e:
            self.connection_error = f"Redis timeout error: {str(e)}"
            self.is_connected = False
            logger.error(f"❌ Redis timeout: {self.connection_error}")
            return False
        except Exception as e:
            self.connection_error = f"Redis test error: {str(e)}"
            self.is_connected = False
            logger.error(f"❌ Redis connection test failed: {self.connection_error}")
            return False
    
    async def health_check(self) -> dict:
        """Health check for Redis service"""
        await self.test_connection()
        return {
            "service": "redis",
            "status": "healthy" if self.is_connected else "unhealthy",
            "host": self.redis_config['host'],
            "port": self.redis_config['port'],
            "stream": self.stream_name,
            "connected": self.is_connected,
            "error": self.connection_error
        }
    
    def _create_evidence_hash(self, aadhaar_number: str, dob: str, phone_number: str) -> str:
        """Create SHA256 hash from OCR data"""
        try:
            # Combine the three fields
            combined_data = f"{aadhaar_number}{dob}{phone_number}"
            
            # Create SHA256 hash
            hash_object = hashlib.sha256(combined_data.encode('utf-8'))
            evidence_hash = hash_object.hexdigest()
            
            logger.info(f"Evidence hash created for user data")
            return evidence_hash
            
        except Exception as e:
            logger.error(f"Failed to create evidence hash: {e}")
            raise
    
    async def send_verification_data(self, user_data: dict) -> bool:
        """
        Send verification data to Redis Stream
        
        Args:
            user_data: Dictionary containing user verification data
            Expected fields: wallet_address, did, is_verified, aadhaar_number, date_of_birth, phone_number
        """
        try:
            # Create evidence hash from OCR data
            evidence_hash = self._create_evidence_hash(
                aadhaar_number=user_data.get('aadhaar_number', ''),
                dob=user_data.get('date_of_birth', ''),
                phone_number=user_data.get('phone_number', '')
            )
            
            # Prepare message payload (same format as Kafka)
            verification_message = {
                "user_wallet": user_data.get('wallet_address'),
                "did_id": str(user_data.get('did', 0)),
                "result": "verified" if user_data.get('is_verified') == 1 else "unverified",
                "evidence_hash": evidence_hash,
                "verified_at": datetime.now().isoformat()
            }
            
            logger.info(f"Sending verification data to Redis")
            logger.info(f"Message: {json.dumps(verification_message, indent=2)}")
            
            # Send to Redis Stream
            success = await self._send_to_redis_stream(verification_message)
            
            if success:
                logger.info("✅ Message successfully sent to Redis")
                return True
            else:
                logger.error("❌ Failed to send message to Redis")
                return False
                
        except Exception as e:
            logger.error(f"Failed to send verification data: {e}")
            return False
    
    async def _send_to_redis_stream(self, verification_message: dict) -> bool:
        """Send message to Redis Stream"""
        try:
            client = self._get_redis_client()
            
            # Add message to Redis Stream with automatic ID generation
            stream_id = client.xadd(
                self.stream_name,
                verification_message,
                maxlen=self.max_stream_length  # Keep only last N messages
            )
            
            logger.info(f"✅ Message sent to Redis stream '{self.stream_name}' with ID: {stream_id}")
            
            # Log stream info
            stream_info = client.xinfo_stream(self.stream_name)
            logger.info(f"Stream info - Length: {stream_info.get('length', 0)}, "
                       f"First ID: {stream_info.get('first-entry', ['N/A'])[0] if stream_info.get('first-entry') else 'N/A'}, "
                       f"Last ID: {stream_info.get('last-entry', ['N/A'])[0] if stream_info.get('last-entry') else 'N/A'}")
            
            return True
            
        except RedisError as e:
            logger.error(f"Redis stream error: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending to Redis stream: {e}")
            return False
    
    async def get_stream_info(self) -> dict:
        """Get information about the verification stream"""
        try:
            client = self._get_redis_client()
            
            # Check if stream exists
            if not client.exists(self.stream_name):
                return {
                    "stream_exists": False,
                    "message": f"Stream '{self.stream_name}' does not exist"
                }
            
            # Get stream information
            stream_info = client.xinfo_stream(self.stream_name)
            
            return {
                "stream_exists": True,
                "stream_name": self.stream_name,
                "length": stream_info.get('length', 0),
                "first_entry_id": stream_info.get('first-entry', ['N/A'])[0] if stream_info.get('first-entry') else 'N/A',
                "last_entry_id": stream_info.get('last-entry', ['N/A'])[0] if stream_info.get('last-entry') else 'N/A',
                "radix_tree_keys": stream_info.get('radix-tree-keys', 0),
                "radix_tree_nodes": stream_info.get('radix-tree-nodes', 0),
                "groups": stream_info.get('groups', 0)
            }
            
        except Exception as e:
            logger.error(f"Failed to get stream info: {e}")
            return {
                "stream_exists": False,
                "error": str(e)
            }
    
    async def close(self):
        """Close Redis connection"""
        if self.redis_client:
            try:
                self.redis_client.close()
                logger.info("Redis connection closed")
            except Exception as e:
                logger.error(f"Error closing Redis connection: {e}")
            finally:
                self.redis_client = None
                self.is_connected = False

# Global instance
redis_service = RedisService()

def get_redis_service() -> RedisService:
    """Dependency injection for Redis service"""
    return redis_service
