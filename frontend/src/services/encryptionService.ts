// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - temporary: silence type errors caused by mismatched @mysten/sui / @mysten/seal versions
import { SuiClient } from '@mysten/sui/client';
import { SealClient } from '@mysten/seal';
import { fromHex, toHex } from '@mysten/sui/utils';

// Configuration for Walrus and Seal - using working service from main frontend
const WALRUS_PUBLISHER_URL = import.meta.env.VITE_WALRUS_PUBLISHER_URL;
const NUM_EPOCH = 1;

// Sui configuration
const SUI_CLIENT = new SuiClient({ url: 'https://fullnode.testnet.sui.io:443' });
// Reverted to pre-deployment TESTNET package ID
const PACKAGE_ID = '0x3611276dabf733007d7975e17989e505eb93e11f4998f93d5c74c3a44231833d';


const API_BASE_URL = "http://localhost:8000/api";
// Government whitelist ID (should match the deployed whitelist)
const GOVERNMENT_WHITELIST_ID = '0xca700b2604763639ba3fbf0237d4f1ab34470ac509d407d34030621b1a254747';

// Seal server configurations
const serverObjectIds = [
  '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75', // mysten-testnet-1
  '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8', // mysten-testnet-2
  '0x6068c0acb197dddbacd4746a9de7f025b2ed5a5b6c1b1ab44dade4426d141da2', // Ruby Nodes
  '0x5466b7df5c15b508678d51496ada8afab0d6f70a01c10613123382b1b8131007'  // NodeInfra
];

// Cast to any to avoid types mismatch between different versions of @mysten/sui used by Seal
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sealClient = new SealClient({
  suiClient: SUI_CLIENT as any,
  serverConfigs: serverObjectIds.map((id) => ({
    objectId: id,
    weight: 1,
  })),
  verifyKeyServers: false,
});

export interface EncryptionResult {
  success: boolean;
  blobId?: string;
  encryptionId?: string;
  suiRef?: string;
  error?: string;
}

interface EncryptionMetadataPayload {
  user_address: string;
  blob_id: string;
  encryption_id: string;
  did_type: string;
  document_type: string;
  file_name: string;
  file_size: number;
  content_type: string;
  sui_ref: string;
  government_whitelist_id: string;
}

export class DocumentEncryptionService {
  async encryptAndUploadDocument(file: File, userAddress: string): Promise<EncryptionResult> {
    try {
      console.log('🔐 Starting document encryption process...');
      console.log('📄 File:', file.name, file.size, 'bytes');
      console.log('👤 User Address:', userAddress);
      console.log('🏛️ Government Whitelist ID:', GOVERNMENT_WHITELIST_ID);

      // Step 1: Generate encryption ID
      const nonce = crypto.getRandomValues(new Uint8Array(5));
      const policyObjectBytes = fromHex(GOVERNMENT_WHITELIST_ID);
      const encryptionId = toHex(new Uint8Array([...policyObjectBytes, ...nonce]));
      
      console.log('🔑 Generated Encryption ID:', encryptionId);
      console.log('🔄 Encryption ID format: [whitelist_id][nonce]');

      // Step 2: Convert file to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);
      
      console.log('📊 File converted to Uint8Array:', fileData.length, 'bytes');

      // Step 3: Encrypt with Seal
      console.log('🔒 Encrypting with Seal protocol...');
      const { encryptedObject: encryptedBytes } = await sealClient.encrypt({
        threshold: 2,
        packageId: PACKAGE_ID,
        id: encryptionId,
        data: fileData,
      });
      
      console.log('✅ Document encrypted successfully');
      console.log('📦 Encrypted data size:', encryptedBytes.length, 'bytes');

      // Step 4: Upload to Walrus
      console.log('☁️ Uploading to Walrus storage...');
      const storageInfo = await this.storeBlob(encryptedBytes);
      
      if (!storageInfo) {
        throw new Error('Failed to upload to Walrus storage');
      }

      console.log('🎉 Upload completed successfully!');
      
      // Step 5: Extract blob information using the same logic as EncryptAndUpload.tsx
      let blobId: string;
      let suiRef: string;
      
      // Coerce unknown info to any for property access (response shape is dynamic)
      const info: any = storageInfo.info;
      if ('alreadyCertified' in info) {
        blobId = info.alreadyCertified.blobId;
        suiRef = info.alreadyCertified.event.txDigest;
        console.log('📋 Status: Already certified');
      } else if ('newlyCreated' in info) {
        blobId = info.newlyCreated.blobObject.blobId;
        suiRef = info.newlyCreated.blobObject.id;
        console.log('📋 Status: Newly created');
      } else {
        console.error('Unhandled successful response!', storageInfo);
        throw new Error('Unexpected storage response format');
      }

      console.log('🆔 Blob ID:', blobId);
      console.log('🔗 Sui Reference:', suiRef);
      console.log('🔐 Encryption ID:', encryptionId);

      // Store encryption metadata in database
      try {
        await this.storeEncryptionMetadata({
          user_address: userAddress,
          blob_id: blobId,
          encryption_id: encryptionId,
          did_type: 'identity_verification', // Default, can be parameterized
          document_type: 'ghana',
          file_name: file.name,
          file_size: file.size,
          content_type: file.type || 'image/jpeg',
          sui_ref: suiRef,
          government_whitelist_id: GOVERNMENT_WHITELIST_ID
        });
        console.log('✅ Encryption metadata stored in database');
      } catch (metadataError) {
        console.warn('⚠️ Failed to store encryption metadata:', metadataError);
        // Don't fail the whole process if metadata storage fails
      }

      return {
        success: true,
        blobId,
        encryptionId,
        suiRef
      };

    } catch (error) {
      console.error('❌ Encryption failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Return type is conservative; storage response shape varies
  private async storeBlob(encryptedData: Uint8Array): Promise<{ info: unknown } | null> {
    try {
      console.log('📤 Uploading', encryptedData.length, 'bytes to Walrus...');
      
      // Use the same URL pattern as the working EncryptAndUpload.tsx
      const url = `${WALRUS_PUBLISHER_URL}/v1/blobs?epochs=${NUM_EPOCH}`;
      console.log('📤 Publishing blob to URL:', url);
      
      const response = await fetch(url, {
        method: 'PUT',
        // Cast to BodyInit to satisfy TS; runtime accepts Uint8Array
        body: encryptedData as unknown as BodyInit,
      });

      if (response.status === 200) {
        const result = await response.json();
        console.log('📨 Walrus response:', result);
        return { info: result };
      } else {
        const errorText = await response.text();
        throw new Error(`Walrus upload failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Walrus upload error:', error);
      throw error;
    }
  }

  // Helper method to get the aggregator URL for a blob
  static getBlobUrl(blobId: string): string {
    // Default reliable aggregator URL for testnet
    return `https://sui-walrus-tn-aggregator.bwarelabs.com/v1/blobs/${blobId}`;
  }

  // Store encryption metadata in backend database
  private async storeEncryptionMetadata(metadata: EncryptionMetadataPayload): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/encryption/store`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to store metadata: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('📊 Metadata stored:', result);
    } catch (error) {
      console.error('❌ Failed to store encryption metadata:', error);
      throw error;
    }
  }

  // Helper method to get Sui explorer URL
  static getSuiExplorerUrl(objectId: string, type: 'tx' | 'object' = 'object'): string {
    const baseUrl = type === 'tx' 
      ? 'https://suiscan.xyz/testnet/tx' 
      : 'https://suiscan.xyz/testnet/object';
    return `${baseUrl}/${objectId}`;
  }
}

export const documentEncryptionService = new DocumentEncryptionService();
