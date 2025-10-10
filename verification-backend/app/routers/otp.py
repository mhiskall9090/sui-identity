from fastapi import APIRouter, HTTPException, Depends, Form
from app.models.schemas import APIResponse, OTPRequest, OTPVerification
from app.services.otp_service import get_otp_service, OTPService
from app.services.user_service import get_user_service, UserService
from app.services.redis_service import get_redis_service, RedisService
from app.models.user import VerificationLog, UserUpdate
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/generate-otp", response_model=APIResponse)
async def generate_otp(
    phone: str = Form(...),
    otp_service: OTPService = Depends(get_otp_service)
):
    """Generate OTP for phone number"""
    try:
        # Clean phone number
        phone = phone.strip()
        
        # Validate phone number
        if not otp_service.validate_phone(phone):
            raise HTTPException(
                status_code=400,
                detail="Invalid phone number. Please enter a valid 10-digit Indian mobile number."
            )
        
        # Clean phone format
        phone_clean = phone.replace('+91', '').replace('-', '').replace(' ', '')
        
        # Check if OTP already exists and is still valid
        otp_status = otp_service.get_otp_status(phone_clean)
        if otp_status['exists']:
            return APIResponse(
                success=True,
                message=f"OTP already sent. {otp_status['message']}",
                data={
                    'phone': phone_clean,
                    'otp_status': otp_status,
                    'resend_available': False
                }
            )
        
        # Generate new OTP
        logger.info(f"Generating OTP for phone: {phone_clean}")
        otp = otp_service.generate_otp(phone_clean)
        
        # Send OTP via SMS (mock implementation)
        sms_sent = otp_service.send_otp_sms(phone_clean, otp)
        
        if not sms_sent:
            logger.warning(f"Failed to send SMS for phone: {phone_clean}")
        
        logger.info(f"OTP generated successfully for phone: {phone_clean}")
        return APIResponse(
            success=True,
            message="OTP generated and sent successfully",
            data={
                'phone': phone_clean,
                'otp_sent': sms_sent,
                'expires_in_minutes': otp_service.otp_expiry_minutes,
                'attempts_allowed': 3
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating OTP: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating OTP: {str(e)}"
        )

@router.post("/verify-otp", response_model=APIResponse)
async def verify_otp(
    phone: str = Form(...),
    otp: str = Form(...),
    did: int = Form(...),  # DID from frontend (0=above18, 1=citizenship)
    wallet_address: str = Form(...),  # Wallet address from frontend
    otp_service: OTPService = Depends(get_otp_service),
    user_service: UserService = Depends(get_user_service),
    redis_service: RedisService = Depends(get_redis_service)
):
    """
    Verify OTP and update user verification status
    This is STEP 3 of the flow: OTP verification + update verification flag
    """
    try:
        logger.info(f"OTP verification started for phone: {phone}")
        logger.info(f"DID: {did}")
        logger.info(f"Wallet address from frontend: {wallet_address}")
        
        # Clean inputs
        phone = phone.strip()
        otp = otp.strip()
        wallet_address = wallet_address.strip()
        
        # Validate phone number
        if not otp_service.validate_phone(phone):
            raise HTTPException(
                status_code=400,
                detail="Invalid phone number format"
            )
        
        # Validate OTP format
        if not otp.isdigit() or len(otp) != 6:
            raise HTTPException(
                status_code=400,
                detail="Invalid OTP format. OTP must be 6 digits."
            )
        
        # Validate DID
        if did not in [0, 1]:
            raise HTTPException(
                status_code=400,
                detail="Invalid DID. Must be 0 (above18) or 1 (citizenship)."
            )
        
        # Clean phone format
        phone_clean = phone.replace('+91', '').replace('-', '').replace(' ', '')
        
        # Verify OTP
        logger.info(f"Verifying OTP for phone: {phone_clean}")
        is_verified = otp_service.verify_otp(phone_clean, otp)
        
        if not is_verified:
            raise HTTPException(status_code=400, detail="Invalid OTP")
        
        logger.info(f"OTP verified successfully for phone: {phone_clean}")
        
        # Find user by phone number (from OCR step)
        existing_user = await user_service.get_user_by_phone(phone_clean)
        
        if not existing_user:
            raise HTTPException(
                status_code=404,
                detail=f"User with phone number {phone_clean} not found. Please complete OCR step first."
            )
        
        logger.info(f"Found existing user: {existing_user.full_name}")
        
        # Update user verification status, DID, and wallet address
        update_data = UserUpdate(
            is_verified=1,  # Mark as fully verified
            did=did,  # Set DID from frontend
            wallet_address=wallet_address  # Update with correct wallet address from frontend
        )
        
        logger.info(f"Updating user verification with DID: {did} and wallet address: {wallet_address}")
        updated_user = await user_service.update_user(existing_user.wallet_address, update_data)
        
        if not updated_user:
            raise HTTPException(
                status_code=500,
                detail="Failed to update user verification status"
            )
        
        logger.info(f"User verification completed successfully")
        
        # Send verification data to Redis after successful verification
        redis_sent = False
        try:
            redis_data = {
                'wallet_address': updated_user.wallet_address,
                'did': updated_user.did,
                'is_verified': updated_user.is_verified,
                'aadhaar_number': updated_user.aadhaar_number,
                'date_of_birth': updated_user.date_of_birth,
                'phone_number': updated_user.phone_number
            }
            
            redis_sent = await redis_service.send_verification_data(redis_data)
            if redis_sent:
                logger.info(f"Verification data sent to Redis successfully for user: {updated_user.wallet_address}")
            else:
                logger.warning(f"Failed to send verification data to Redis for user: {updated_user.wallet_address}")
                
        except Exception as redis_error:
            logger.error(f"Redis error (non-blocking): {redis_error}")
            # Don't fail the API response if Redis fails
        
        return APIResponse(
            success=True,
            message="OTP verified successfully! User is now fully verified.",
            data={
                'phone': phone_clean,
                'wallet_address': existing_user.wallet_address,
                'verification_status': 'FULLY_VERIFIED',
                'otp_verified': True,
                'user_verified': True,
                'redis_sent': redis_sent,
                'user_data': {
                    'wallet_address': updated_user.wallet_address,
                    'phone_number': updated_user.phone_number,
                    'aadhaar_number': updated_user.aadhaar_number,
                    'date_of_birth': updated_user.date_of_birth,
                    'full_name': updated_user.full_name,
                    'gender': updated_user.gender,
                    'is_verified': updated_user.is_verified,
                    'did': updated_user.did,
                    'updated_at': updated_user.updated_at.isoformat()
                }
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OTP verification failed: {str(e)}")
        
        # Check if it's an OTP-specific error
        if "Invalid OTP" in str(e) or "expired" in str(e) or "exceeded" in str(e):
            raise HTTPException(
                status_code=400,
                detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Error verifying OTP: {str(e)}"
            )

@router.get("/otp-status/{phone}")
async def get_otp_status(
    phone: str,
    otp_service: OTPService = Depends(get_otp_service)
):
    """Get OTP status for phone number"""
    try:
        # Clean phone number
        phone_clean = phone.replace('+91', '').replace('-', '').replace(' ', '')
        
        # Validate phone number
        if not otp_service.validate_phone(phone_clean):
            raise HTTPException(
                status_code=400,
                detail="Invalid phone number format"
            )
        
        # Get OTP status
        status = otp_service.get_otp_status(phone_clean)
        
        return APIResponse(
            success=True,
            message="OTP status retrieved",
            data={
                'phone': phone_clean,
                'status': status
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting OTP status: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting OTP status: {str(e)}"
        )

@router.post("/resend-otp", response_model=APIResponse)
async def resend_otp(
    phone: str = Form(...),
    otp_service: OTPService = Depends(get_otp_service)
):
    """Resend OTP for phone number"""
    try:
        # Clean phone number
        phone = phone.strip()
        phone_clean = phone.replace('+91', '').replace('-', '').replace(' ', '')
        
        # Validate phone number
        if not otp_service.validate_phone(phone_clean):
            raise HTTPException(
                status_code=400,
                detail="Invalid phone number format"
            )
        
        # Clear any existing OTP for this phone
        if phone_clean in otp_service.otp_storage:
            del otp_service.otp_storage[phone_clean]
        
        # Generate new OTP
        logger.info(f"Resending OTP for phone: {phone_clean}")
        otp = otp_service.generate_otp(phone_clean)
        
        # Send OTP via SMS
        sms_sent = otp_service.send_otp_sms(phone_clean, otp)
        
        logger.info(f"OTP resent successfully for phone: {phone_clean}")
        return APIResponse(
            success=True,
            message="OTP resent successfully",
            data={
                'phone': phone_clean,
                'otp_sent': sms_sent,
                'expires_in_minutes': otp_service.otp_expiry_minutes,
                'attempts_allowed': 3
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resending OTP: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error resending OTP: {str(e)}"
        )