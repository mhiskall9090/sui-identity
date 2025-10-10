// Re-export components and named exports used across the app
export { default as SelectDocument } from './SelectDocument';
export { default as VerifyDocument } from './VerifyDocument';
export { default as DocumentUploadStep } from './DocumentUploadStep';
export { default as FaceVerificationStep } from './FaceVerificationStep';
export { default as OtpVerificationStep } from './OtpVerificationStep';
export { default as KycModal } from './KycModal';
// NFTClaimSuccess exports a named component `NFTClaimSuccessModal` — re-export it
export { NFTClaimSuccessModal } from './NFTClaimSuccess';

// Contexts and types
export * from './DocumentTypeContext';
export * from './types';
