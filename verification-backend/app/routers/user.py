"""
User management API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Form
from typing import List
import logging

from app.models.user import UserCreate, UserUpdate, UserResponse, VerificationLog
from app.models.schemas import APIResponse
from app.services.user_service import UserService, get_user_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["users"])

@router.post("/register", response_model=APIResponse)
async def register_user(
    wallet_address: str = Form(...),
    phone_number: str = Form(None),
    user_service: UserService = Depends(get_user_service)
):
    """Register a new user with wallet address"""
    try:
        # Create user data
        user_data = UserCreate(
            wallet_address=wallet_address,
            phone_number=phone_number,
            is_verified=0
        )
        
        # Check if user already exists
        existing_user = await user_service.get_user_by_wallet(wallet_address)
        if existing_user:
            return APIResponse(
                success=True,
                message="User already registered",
                data=existing_user.dict()
            )
        
        # Create new user
        new_user = await user_service.create_user(user_data)
        
        return APIResponse(
            success=True,
            message="User registered successfully",
            data=new_user.dict()
        )
        
    except ValueError as e:
        logger.error(f"Validation error registering user: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error registering user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{wallet_address}", response_model=APIResponse)
async def get_user(
    wallet_address: str,
    user_service: UserService = Depends(get_user_service)
):
    """Get user by wallet address"""
    try:
        user = await user_service.get_user_by_wallet(wallet_address)
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return APIResponse(
            success=True,
            message="User retrieved successfully",
            data=user.dict()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user {wallet_address}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/{wallet_address}", response_model=APIResponse)
async def update_user(
    wallet_address: str,
    phone_number: str = Form(None),
    user_service: UserService = Depends(get_user_service)
):
    """Update user information"""
    try:
        # Create update data
        update_data = UserUpdate()
        if phone_number:
            update_data.phone_number = phone_number
        
        # Update user
        updated_user = await user_service.update_user(wallet_address, update_data)
        
        if not updated_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return APIResponse(
            success=True,
            message="User updated successfully",
            data=updated_user.dict()
        )
        
    except ValueError as e:
        logger.error(f"Validation error updating user: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user {wallet_address}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/{wallet_address}/verify", response_model=APIResponse)
async def verify_user(
    wallet_address: str,
    user_service: UserService = Depends(get_user_service)
):
    """Mark user as verified (called after successful KYC)"""
    try:
        verified_user = await user_service.verify_user(wallet_address)
        
        if not verified_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Log verification success
        log_data = VerificationLog(
            wallet_address=wallet_address,
            verification_type="kyc_complete",
            status="success",
            details={"verified_at": verified_user.updated_at.isoformat()}
        )
        await user_service.log_verification_attempt(log_data)
        
        return APIResponse(
            success=True,
            message="User verified successfully",
            data=verified_user.dict()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying user {wallet_address}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{wallet_address}/status", response_model=APIResponse)
async def get_verification_status(
    wallet_address: str,
    user_service: UserService = Depends(get_user_service)
):
    """Get user verification status"""
    try:
        is_verified = await user_service.get_user_verification_status(wallet_address)
        
        return APIResponse(
            success=True,
            message="Verification status retrieved",
            data={
                "wallet_address": wallet_address,
                "is_verified": is_verified
            }
        )
        
    except Exception as e:
        logger.error(f"Error getting verification status for {wallet_address}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{wallet_address}/logs", response_model=APIResponse)
async def get_verification_logs(
    wallet_address: str,
    user_service: UserService = Depends(get_user_service)
):
    """Get verification logs for a user"""
    try:
        logs = await user_service.get_user_verification_logs(wallet_address)
        
        return APIResponse(
            success=True,
            message="Verification logs retrieved",
            data=[log.dict() for log in logs]
        )
        
    except Exception as e:
        logger.error(f"Error getting verification logs for {wallet_address}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/{wallet_address}", response_model=APIResponse)
async def delete_user(
    wallet_address: str,
    user_service: UserService = Depends(get_user_service)
):
    """Delete user (admin/testing only)"""
    try:
        deleted = await user_service.delete_user(wallet_address)
        
        if not deleted:
            raise HTTPException(status_code=404, detail="User not found")
        
        return APIResponse(
            success=True,
            message="User deleted successfully",
            data={"wallet_address": wallet_address}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user {wallet_address}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")