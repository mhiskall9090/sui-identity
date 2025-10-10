from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from app.models.schemas import APIResponse, FaceMatchRequest
from app.services.face_recognition_service import get_face_recognition_service, HighAccuracyFaceService
from typing import Optional
from pydantic import BaseModel
import base64
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

class FaceVerificationRequest(BaseModel):
    aadhaar_photo_base64: str
    live_photo_base64: str
    phone_number: str  # Added phone number for OTP sending

@router.post("/verify-face", response_model=APIResponse)
async def verify_face(
    request: FaceVerificationRequest,
    face_service: HighAccuracyFaceService = Depends(get_face_recognition_service)
):
    """Verify live photo against Aadhaar photo using face_recognition library"""
    try:
        # Decode base64 images
        try:
            aadhaar_image_bytes = base64.b64decode(request.aadhaar_photo_base64)
            live_image_bytes = base64.b64decode(request.live_photo_base64)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail="Invalid base64 image data"
            )
        
        # Validate both images have faces
        logger.info("Validating Aadhaar photo...")
        aadhaar_validation = face_service.validate_face_quality(aadhaar_image_bytes)
        if not aadhaar_validation['is_valid']:
            raise HTTPException(
                status_code=400,
                detail=f"Aadhaar photo validation failed: {aadhaar_validation['reason']}"
            )
        
        logger.info("Validating live photo...")
        live_validation = face_service.validate_face_quality(live_image_bytes)
        if not live_validation['is_valid']:
            raise HTTPException(
                status_code=400,
                detail=f"Live photo validation failed: {live_validation['reason']}"
            )
        
        # Perform face comparison using OpenCV face recognition
        logger.info("Comparing faces using OpenCV face recognition...")
        comparison_result = face_service.compare_faces(request.aadhaar_photo_base64, request.live_photo_base64)
        
        # Check for technical/system errors (not face mismatch)
        error_type = comparison_result.get('error_type')
        if error_type and error_type in ['DECODE_ERROR', 'COMPARISON_ERROR', 'NO_FACE_REFERENCE', 'NO_FACE_LIVE', 'MULTIPLE_FACES_REFERENCE', 'MULTIPLE_FACES_LIVE']:
            # These are technical errors, not legitimate verification results
            status_code = 500 if error_type in ['DECODE_ERROR', 'COMPARISON_ERROR'] else 400
            raise HTTPException(
                status_code=status_code,
                detail=comparison_result.get('message', 'Face verification failed')
            )
        
        # Face mismatch is a legitimate result, not an error
        match_result = comparison_result['match']
        confidence = comparison_result['confidence']
        face_distance = comparison_result.get('face_distance', 0)
        
        logger.info(f"Face verification result: {match_result}, confidence: {confidence:.1f}%, distance: {face_distance:.3f}")
        
        # Return face verification result
        verification_message = comparison_result['message']
        
        return APIResponse(
            success=True,
            message=verification_message,
            data={
                'match': match_result,
                'confidence': round(confidence, 1),
                'message': verification_message,
                'face_distance': round(face_distance, 3),
                'detection_method': comparison_result.get('detection_method', 'OpenCV'),
                'error_type': error_type
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in face verification: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Face verification failed: {str(e)}"
        )
