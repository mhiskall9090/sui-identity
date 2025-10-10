from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from ..models.document_types import DocumentType, VerificationType
from ..services.document_verification import DocumentVerificationService
import json

router = APIRouter()
verification_service = DocumentVerificationService()

@router.post("/verify-document")
async def verify_document(
    document: UploadFile = File(...),
    face_image: Optional[UploadFile] = File(None),
    document_type: DocumentType = Form(...),
    verification_type: VerificationType = Form(...),
):
    """
    Verify a Ghana document (Ghana Card or Passport) with optional face verification
    """
    try:
        # Read document image
        document_bytes = await document.read()
        
        # Read face image if provided
        face_bytes = await face_image.read() if face_image else None
        
        # Verify document
        success, data, message = verification_service.verify_document(
            document_type=document_type,
            document_image=document_bytes,
            face_image=face_bytes,
            verification_type=verification_type
        )
        
        if not success:
            raise HTTPException(status_code=400, detail=message)
        
        return {
            "success": True,
            "message": message,
            "data": data
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/document-requirements/{document_type}")
async def get_document_requirements(document_type: DocumentType):
    """
    Get the requirements for a specific document type
    """
    try:
        from ..models.document_types import DocumentFields, VERIFICATION_CONFIG
        
        fields = DocumentFields.get_fields(document_type)
        config = VERIFICATION_CONFIG[document_type]
        
        return {
            "document_type": document_type,
            "required_fields": fields["required"],
            "optional_fields": fields["optional"],
            "verification_config": {
                "age_verification": config["age_verification"],
                "citizenship_verification": config["citizenship_verification"]
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/validate-document-number")
async def validate_document_number(
    document_type: DocumentType = Form(...),
    document_number: str = Form(...)
):
    """
    Validate a Ghana document number format
    """
    try:
        from ..models.document_types import VALIDATION_PATTERNS
        
        pattern = None
        if document_type == DocumentType.GHANA_CARD:
            pattern = VALIDATION_PATTERNS["GHANA_CARD_NUMBER"]
        else:
            pattern = VALIDATION_PATTERNS["GHANA_PASSPORT_NUMBER"]
            
        import re
        is_valid = bool(re.match(pattern, document_number))
        
        return {
            "valid": is_valid,
            "document_type": document_type,
            "document_number": document_number
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))