# SuiVerify Identity Verification System - Backend
# Python FastAPI Backend

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# from app.routers import face, otp, user, kyc, encryption, credentials, document_verification
from app.routers import otp, user, kyc, encryption, credentials, document_verification
# from app.services.ocr_service import OCRService
# from app.services.face_recognition_service import get_face_recognition_service
from app.services.otp_service import OTPService
from app.services.user_service import get_user_service
from app.services.encryption_service import encryption_service
from app.services.redis_service import get_redis_service
from app.database import connect_to_mongo, close_mongo_connection

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global services
ocr_service = None
face_recognition_service = None
otp_service = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global ocr_service, face_recognition_service, otp_service
    
    logger.info("Starting SuiVerify System with MongoDB integration...")
    
    # Connect to MongoDB
    try:
        await connect_to_mongo()
        logger.info("MongoDB connected successfully")
        
        # Create encryption metadata indexes
        await encryption_service.create_indexes()
        logger.info("Encryption metadata indexes created")
        
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise
    # Initialize services
    # ocr_service = OCRService()
    # face_recognition_service = get_face_recognition_service()
    otp_service = OTPService()
    
    # Test Redis connection
    redis_service = get_redis_service()
    try:
        if await redis_service.test_connection():
            logger.info(f"✅ Redis connected successfully to {redis_service.redis_host}:{redis_service.redis_port}")
        else:
            logger.warning(f"⚠️ Redis connection failed: {redis_service.connection_error}")
    except Exception as e:
        logger.warning(f"⚠️ Redis connection test failed: {e}")
    
    logger.info("All services initialized successfully")
    yield
    
    # Cleanup
    logger.info("Shutting down SuiVerify System...")
    await close_mongo_connection()
    
    # Close Redis service
    try:
        await redis_service.close()
    except Exception as e:
        logger.warning(f"Error closing Redis service: {e}")

# Create FastAPI app
app = FastAPI(
    title="SuiVerify Identity Verification System",
    description="Secure identity verification with OCR, face recognition, and OTP. Supports Ghana Card and Ghana Passport verification.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS - UPDATED TO INCLUDE YOUR SERVER
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://api.suiverify.xyz",
        "http://localhost:5173",
        "http://localhost:5175",
        "https://13.232.254.187",  # Your server IP
        "https://suiverify.xyz",   # If you have a domain
        "https://www.suiverify.xyz",  # If you have www subdomain
        "*"  # Allow all origins for testing - remove in production
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include routers
app.include_router(user.router, prefix="/api", tags=["User Management"])
app.include_router(kyc.router, prefix="/api", tags=["KYC Verification"])
app.include_router(document_verification.router, prefix="/api/identity", tags=["Identity Document Processing"])
# app.include_router(face.router, prefix="/api/face", tags=["Face Recognition"])
app.include_router(otp.router, prefix="/api/otp", tags=["OTP Verification"])
app.include_router(encryption.router, prefix="/api", tags=["Encryption Metadata"])
app.include_router(credentials.router, prefix="/api", tags=["Credentials Management"])

@app.get("/")
async def root():
    """Health check endpoint"""
    # Get Redis status
    redis_service = get_redis_service()
    redis_status = "connected" if redis_service.is_connected else "disconnected"
    
    return {
        "message": "SuiVerify API - Identity Verification System",
        "version": "1.0.0",
        "status": "active",
        "services": {
            "mongodb": "connected",
            "user_management": "ready",
            "ocr": "ready",
            "face_recognition": "ready", 
            "otp": "ready",
            "encryption_metadata": "ready",
            "redis": redis_status
        }
    }
@app.get("/health")
async def health_check():
    """Detailed health check"""
    global ocr_service, face_recognition_service, otp_service
    
    health_status = {
        "status": "healthy",
        "services": {}
    }
    
    # Check OCR service
    try:
        if ocr_service:
            health_status["services"]["ocr"] = "healthy"
        else:
            health_status["services"]["ocr"] = "not_initialized"
    except Exception as e:
        health_status["services"]["ocr"] = f"error: {str(e)}"
    
    # Check Face service
    try:
        if face_recognition_service:
            health_status["services"]["face"] = "healthy"
        else:
            health_status["services"]["face"] = "not_initialized"
    except Exception as e:
        health_status["services"]["face"] = f"error: {str(e)}"
    
    # Check OTP service
    try:
        if otp_service:
            health_status["services"]["otp"] = "healthy"
        else:
            health_status["services"]["otp"] = "not_initialized"
    except Exception as e:
        health_status["services"]["otp"] = f"error: {str(e)}"
    
    # Check Redis
    try:
        redis_service = get_redis_service()
        if redis_service.is_connected:
            health_status["services"]["redis"] = "connected"
        else:
            health_status["services"]["redis"] = "disconnected"
    except Exception as e:
        health_status["services"]["redis"] = f"error: {str(e)}"
    
    # Overall status
    unhealthy_services = [k for k, v in health_status["services"].items() 
                         if "error" in str(v) or "not_initialized" in str(v)]
    
    if unhealthy_services:
        health_status["status"] = "degraded"
        health_status["unhealthy_services"] = unhealthy_services
    
    return health_status
# Dependency to get services
def get_ocr_service():
    global ocr_service
    if not ocr_service:
        raise HTTPException(status_code=503, detail="OCR service not available")
    return ocr_service

def get_face_service():  # FIXED FUNCTION NAME
    global face_recognition_service
    if not face_recognition_service:
        raise HTTPException(status_code=503, detail="Face recognition service not available")
    return face_recognition_service

def get_otp_service_dependency():  # RENAMED TO AVOID CONFLICT
    global otp_service
    if not otp_service:
        raise HTTPException(status_code=503, detail="OTP service not available")
    return otp_service

if __name__ == "__main__":
    # Check if SSL certificates exist for direct SSL mode
    ssl_keyfile = "/etc/ssl/private/suiverify-api.key"
    ssl_certfile = "/etc/ssl/certs/suiverify-api.crt"
    
    # Check if we should run with SSL directly or let Nginx handle it
    use_direct_ssl = os.path.exists(ssl_keyfile) and os.path.exists(ssl_certfile) and os.getenv("USE_DIRECT_SSL", "false").lower() == "true"
    
    if use_direct_ssl:
        logger.info("Running FastAPI with direct SSL")
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            ssl_keyfile=ssl_keyfile,
            ssl_certfile=ssl_certfile,
            log_level="info"
        )
    else:
        logger.info("Running FastAPI without SSL (Nginx will handle SSL)")
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            reload=False,  # Changed to False for production
            log_level="info"
        )
