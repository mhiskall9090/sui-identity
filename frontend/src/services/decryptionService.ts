// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - temporary: silence type errors caused by mismatched @mysten/sui / @mysten/seal versions
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { SealClient, SessionKey, EncryptedObject } from '@mysten/seal';
import { fromHex } from '@mysten/sui/utils';

// Configuration matching the encryption service
const SUI_CLIENT = new SuiClient({ url: 'https://fullnode.testnet.sui.io:443' });
// Reverted to pre-deployment TESTNET package ID
const PACKAGE_ID = '0x3611276dabf733007d7975e17989e505eb93e11f4998f93d5c74c3a44231833d';

// Government whitelist ID (should match the deployed whitelist)
const GOVERNMENT_WHITELIST_ID = '0xca700b2604763639ba3fbf0237d4f1ab34470ac509d407d34030621b1a254747';

// Walrus configuration
const WALRUS_AGGREGATOR_URL = import.meta.env.VITE_WALRUS_AGGREGATOR_URL ;

// Seal server configurations
const serverObjectIds = [
  '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75', // mysten-testnet-1
  '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8', // mysten-testnet-2
  '0x6068c0acb197dddbacd4746a9de7f025b2ed5a5b6c1b1ab44dade4426d141da2', // Ruby Nodes
  '0x5466b7df5c15b508678d51496ada8afab0d6f70a01c10613123382b1b8131007'  // NodeInfra
];

// Initialize Seal client
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

export interface DecryptionResult {
  success: boolean;
  decryptedFileUrls?: string[];
  error?: string;
  personalMessage?: string;
  sessionKey?: SessionKey;
}

export interface DocumentMetadata {
  blob_id: string;
  encryption_id: string;
  did_type: string;
  document_type: string;
  file_name: string;
  created_at: string;
  verification_completed: boolean;
  verification_status: string;
  walrus_url: string;
  sui_explorer_url: string;
}

export type MoveCallConstructor = (tx: Transaction, id: string) => void;

export class DocumentDecryptionService {
  private TTL_MIN = 10;

  /**
   * Creates a session key for decryption
   */
  createSessionKey(governmentAddress: string): SessionKey {
    return new SessionKey({
      address: governmentAddress,
      packageId: PACKAGE_ID,
      ttlMin: this.TTL_MIN,
    });
  }

  /**
   * Creates the move call constructor for government whitelist authorization
   * This matches the pattern from main frontend
   */
  private createMoveCallConstructor(whitelistId: string): MoveCallConstructor {
    return (tx: Transaction, fullId: string) => {
      tx.moveCall({
        target: `${PACKAGE_ID}::government_whitelist::seal_approve`,
        arguments: [
          tx.pure.vector('u8', fromHex(fullId)),
          tx.object(whitelistId)
        ],
      });
    };
  }

  /**
   * Downloads and decrypts documents using Seal SDK
   */
  async downloadAndDecryptDocuments(
    documents: DocumentMetadata[],
    sessionKey: SessionKey,
    onProgress?: (progress: string) => void
  ): Promise<DecryptionResult> {
    try {
      console.log('🔓 Starting document decryption process...');
      console.log('📄 Documents to decrypt:', documents.length);

      if (!documents.length) {
        return {
          success: false,
          error: 'No documents provided for decryption'
        };
      }

      // Check if session key is expired
      if (sessionKey.isExpired()) {
        return {
          success: false,
          error: 'Session key has expired. Please sign a new personal message.'
        };
      }

      const decryptedFileUrls: string[] = [];
      const moveCallConstructor = this.createMoveCallConstructor(GOVERNMENT_WHITELIST_ID);

      // Process each document
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        onProgress?.(`Decrypting document ${i + 1}/${documents.length}: ${doc.file_name}...`);

        try {
          // Step 1: Download encrypted file from Walrus
          const encryptedData = await this.downloadEncryptedFile(doc.blob_id, onProgress);
          
          if (!encryptedData) {
            console.error(`Failed to download blob ${doc.blob_id}`);
            continue;
          }

          // Step 2: Parse encrypted object and decrypt using Seal SDK
          console.log(`🔓 Decrypting with Seal SDK for blob ${doc.blob_id}`);
          console.log(`🔑 Using encryption ID: ${doc.encryption_id}`);
          console.log(`📦 Encrypted data size: ${encryptedData.byteLength} bytes`);
          
          // Convert ArrayBuffer to Uint8Array if needed
          const encryptedBytes = encryptedData instanceof ArrayBuffer 
            ? new Uint8Array(encryptedData)
            : encryptedData;
          
          console.log(`📦 Encrypted bytes length: ${encryptedBytes.length}`);
          
          // Parse the encrypted object to get the full ID (same as main frontend)
          const fullId = EncryptedObject.parse(encryptedBytes).id;
          console.log(`🆔 Full ID from encrypted object: ${fullId}`);
          
          // Create transaction for move call (same as main frontend)
          const tx = new Transaction();
          moveCallConstructor(tx, fullId);
          const txBytes = await tx.build({ client: SUI_CLIENT, onlyTransactionKind: true });
          
          const decryptedData = await sealClient.decrypt({
            data: encryptedBytes,
            sessionKey,
            txBytes,
          });

          console.log(`✅ Decryption successful for ${doc.file_name}`);

          // Step 3: Create blob URL for decrypted data
          const mimeType = this.getMimeType(doc.file_name);
          const blob = new Blob([decryptedData], { type: mimeType });
          const url = URL.createObjectURL(blob);
          decryptedFileUrls.push(url);

        } catch (error) {
          console.error(`Failed to decrypt ${doc.file_name}:`, error);
          // Continue with other documents even if one fails
        }
      }

      if (decryptedFileUrls.length === 0) {
        return {
          success: false,
          error: 'Failed to decrypt any documents. Check if you have proper authorization.'
        };
      }

      onProgress?.(`Successfully decrypted ${decryptedFileUrls.length} of ${documents.length} documents.`);

      return {
        success: true,
        decryptedFileUrls,
        sessionKey
      };

    } catch (error) {
      console.error('❌ Decryption process failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Downloads a single encrypted file from Walrus
   */
  private async downloadEncryptedFile(
    blobId: string,
    onProgress?: (progress: string) => void
  ): Promise<ArrayBuffer | null> {
    const reliableAggregators = [
      WALRUS_AGGREGATOR_URL,
      'https://aggregator.walrus-testnet.walrus.space',
      'https://wal-aggregator-testnet.staketab.org',
      'https://aggregator.walrus.banansen.dev',
      'https://suiftly-testnet-agg.mhax.io',
      'https://sui-walrus-tn-aggregator.bwarelabs.com'
    ];

    for (const aggregatorBase of reliableAggregators) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        
        const aggregatorUrl = `${aggregatorBase}/v1/blobs/${blobId}`;
        console.log(`Attempting download from ${aggregatorBase}`);
        
        const response = await fetch(aggregatorUrl, { 
          signal: controller.signal,
          mode: 'cors'
        });
        
        clearTimeout(timeout);
        
        if (response.ok) {
          console.log(`✅ Successfully downloaded from ${aggregatorBase}`);
          return await response.arrayBuffer();
        }
      } catch (err) {
        console.log(`Failed from ${aggregatorBase}:`, err);
        continue;
      }
    }

    console.error(`All download attempts failed for blob ${blobId}`);
    return null;
  }

  /**
   * Helper to determine mime type from filename
   */
  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  /**
   * Cleanup function to revoke blob URLs
   */
  static cleanupBlobUrls(urls: string[]): void {
    urls.forEach(url => URL.revokeObjectURL(url));
  }

  /**
   * Helper method to get Walrus blob URL
   */
  static getBlobUrl(blobId: string): string {
    return `https://sui-walrus-tn-aggregator.bwarelabs.com/v1/blobs/${blobId}`;
  }

  /**
   * Helper method to get Sui explorer URL
   */
  static getSuiExplorerUrl(objectId: string, type: 'tx' | 'object' = 'object'): string {
    const baseUrl = type === 'tx' 
      ? 'https://suiscan.xyz/testnet/tx' 
      : 'https://suiscan.xyz/testnet/object';
    return `${baseUrl}/${objectId}`;
  }
}

export const documentDecryptionService = new DocumentDecryptionService();