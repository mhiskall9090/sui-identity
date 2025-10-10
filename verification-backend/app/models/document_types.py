from enum import Enum

class DocumentType(str, Enum):
    GHANA_CARD = "ghana_card"
    GHANA_PASSPORT = "ghana_passport"

class VerificationType(str, Enum):
    AGE_VERIFICATION = "age_verification"
    CITIZENSHIP_VERIFICATION = "citizenship_verification"

class DocumentFields:
    GHANA_CARD = {
        "required": ["card_number", "full_name", "date_of_birth", "gender", "nationality", "expiry_date"],
        "optional": ["place_of_birth", "height", "document_type"]
    }
    
    GHANA_PASSPORT = {
        "required": ["passport_number", "full_name", "date_of_birth", "gender", "nationality", "expiry_date"],
        "optional": ["place_of_birth", "type", "authority", "document_type"]
    }
    
    @staticmethod
    def get_fields(doc_type: DocumentType):
        if doc_type == DocumentType.GHANA_CARD:
            return DocumentFields.GHANA_CARD
        elif doc_type == DocumentType.GHANA_PASSPORT:
            return DocumentFields.GHANA_PASSPORT
        raise ValueError(f"Unknown document type: {doc_type}")

# Validation patterns for Ghana documents
VALIDATION_PATTERNS = {
    "GHANA_CARD_NUMBER": r"^GHA-\d{9}-\d{1}$",  # Format: GHA-123456789-1
    "GHANA_PASSPORT_NUMBER": r"^G\d{7}$",  # Format: G1234567
    "GHANA_PHONE": r"^233[0-9]{9}$",  # Ghana phone format: 233XXXXXXXXX
}

# Document verification settings
VERIFICATION_CONFIG = {
    DocumentType.GHANA_CARD: {
        "age_verification": {
            "min_age": 18,
            "require_face_match": True,
            "face_match_threshold": 0.85,
            "expiry_check": True,
        },
        "citizenship_verification": {
            "allowed_nationalities": ["Ghanaian"],
            "require_face_match": True,
            "face_match_threshold": 0.90,
            "expiry_check": True,
        }
    },
    DocumentType.GHANA_PASSPORT: {
        "age_verification": {
            "min_age": 18,
            "require_face_match": True,
            "face_match_threshold": 0.85,
            "expiry_check": True,
        },
        "citizenship_verification": {
            "allowed_nationalities": ["Ghanaian"],
            "require_face_match": True,
            "face_match_threshold": 0.90,
            "expiry_check": True,
            "validate_mrz": True,
        }
    }
}