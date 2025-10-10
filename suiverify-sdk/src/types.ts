/**
 * SuiVerify SDK Type Definitions
 */

export interface VerificationResult {
  isValid: boolean;
  message: string;
  data?: any;
}

export interface EnclaveSignature {
  signature: string;
  publicKey: string;
  message: string;
}

export interface DIDMetadata {
  id: string;
  owner: string;
  isVerified: boolean;
  verificationLevel: number;
  createdAt: string;
  updatedAt: string;
}

export interface NFTVerificationData {
  tokenId: string;
  owner: string;
  metadata: DIDMetadata;
  enclaveSignature: EnclaveSignature;
}

export interface SuiVerifyConfig {
  rpcUrl: string;
  packageId: string;
  network: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
}

export interface VerificationOptions {
  checkOwnership?: boolean;
  validateSignature?: boolean;
  requireEnclave?: boolean;
}

export interface SDKError {
  code: string;
  message: string;
  details?: any;
}
