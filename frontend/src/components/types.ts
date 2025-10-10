export type DocumentType = 'ghana_card' | 'ghana_passport' | 'aadhaar_card';

export interface DocumentData {
  name?: string;
  dob?: string;
  gender?: string;
  phone_number?: string;
  address?: string;
  document_number?: string;
  document_photo_base64?: string;
  document_type?: DocumentType;
}

export type KycStep = 'document' | 'face' | 'generate-otp' | 'verify-otp' | 'complete';