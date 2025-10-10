/**
 * SuiVerify SDK - Core Implementation
 */

import {
  SuiVerifyConfig,
  VerificationResult,
  NFTVerificationData,
  EnclaveSignature,
  DIDMetadata,
  VerificationOptions,
  SDKError
} from './types';

// Simplified client interface for demonstration
interface SuiClientInterface {
  getObject(params: any): Promise<any>;
  getOwnedObjects(params: any): Promise<any>;
  devInspectTransactionBlock(params: any): Promise<any>;
}

export class SuiVerifySDK {
  private client: SuiClientInterface;
  private config: SuiVerifyConfig;

  constructor(config: SuiVerifyConfig) {
    this.config = config;
    // Initialize with a mock client for now - replace with actual SuiClient when dependencies are installed
    this.client = this.createMockClient();
  }

  private createMockClient(): SuiClientInterface {
    return {
      async getObject(params: any) {
        console.log('Mock getObject called with:', params);
        return { data: null };
      },
      async getOwnedObjects(params: any) {
        console.log('Mock getOwnedObjects called with:', params);
        return { data: [] };
      },
      async devInspectTransactionBlock(params: any) {
        console.log('Mock devInspectTransactionBlock called with:', params);
        return { effects: { status: { status: 'success' } }, events: [] };
      }
    };
  }

  /**
   * Verify a DID NFT's authenticity and Nautilus enclave signature
   */
  async verifyDIDNFT(
    nftObjectId: string,
    options: VerificationOptions = {}
  ): Promise<VerificationResult> {
    try {
      // Get NFT object from Sui
      const nftObject = await this.client.getObject({
        id: nftObjectId,
        options: {
          showContent: true,
          showOwner: true,
          showType: true
        }
      });

      if (!nftObject.data) {
        return {
          isValid: false,
          message: 'NFT not found'
        };
      }

      // Extract verification data
      const verificationData = this.extractVerificationData(nftObject.data);
      
      // Perform verifications
      const results = await Promise.all([
        this.verifyEnclaveSignature(verificationData.enclaveSignature),
        this.verifyNFTMetadata(verificationData.metadata),
        options.checkOwnership ? this.verifyOwnership(verificationData) : Promise.resolve(true)
      ]);

      const isValid = results.every(result => result === true);

      return {
        isValid,
        message: isValid ? 'NFT verification successful' : 'NFT verification failed',
        data: verificationData
      };

    } catch (error) {
      return {
        isValid: false,
        message: `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Verify Nautilus enclave signature using on-chain contract
   */
  async verifyEnclaveSignatureOnChain(
    enclaveObjectId: string,
    intentScope: number,
    timestampMs: number,
    payload: any,
    signature: string
  ): Promise<VerificationResult> {
    try {
      console.log('🔍 Calling enclave.move verify_signature function...');
      console.log('Parameters:', {
        enclaveObjectId,
        intentScope,
        timestampMs,
        payload,
        signature: signature.substring(0, 20) + '...'
      });

      // Prepare transaction parameters for the enclave.move verify_signature call
      const txParams = {
        target: `${this.config.packageId}::enclave::verify_signature`,
        typeArguments: [`${this.config.packageId}::enclave::ENCLAVE`, 'vector<u8>'],
        arguments: [
          enclaveObjectId,
          intentScope,
          timestampMs,
          this.encodePayload(payload),
          this.hexToBytes(signature)
        ]
      };

      // Call the on-chain verification function
      const tx = await this.client.devInspectTransactionBlock({
        transactionBlock: txParams,
        sender: '0x0000000000000000000000000000000000000000000000000000000000000000'
      });

      // Check if the verification succeeded
      const isValid = tx.effects?.status?.status === 'success';
      
      return {
        isValid,
        message: isValid ? 'Enclave signature verified on-chain' : 'On-chain verification failed',
        data: {
          transactionEffects: tx.effects,
          events: tx.events,
          functionCall: `${this.config.packageId}::enclave::verify_signature`
        }
      };

    } catch (error) {
      return {
        isValid: false,
        message: `On-chain verification error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Helper function to encode payload for Move function call
   */
  private encodePayload(payload: any): number[] {
    const jsonString = JSON.stringify(payload);
    return Array.from(new TextEncoder().encode(jsonString));
  }

  /**
   * Helper function to convert hex string to byte array
   */
  private hexToBytes(hex: string): number[] {
    const cleanHex = hex.replace('0x', '');
    const bytes: number[] = [];
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes.push(parseInt(cleanHex.substr(i, 2), 16));
    }
    return bytes;
  }

  /**
   * Verify Nautilus enclave signature (local verification)
   * Note: This is a simplified implementation. For production, use proper cryptographic libraries.
   */
  async verifyEnclaveSignature(signature: EnclaveSignature): Promise<boolean> {
    try {
      console.log('🔍 Verifying enclave signature locally...');
      console.log('Signature data:', {
        publicKey: signature.publicKey.substring(0, 20) + '...',
        message: signature.message,
        signature: signature.signature.substring(0, 20) + '...'
      });

      // For now, return true as a placeholder
      // In production, implement proper Ed25519 signature verification
      // using @noble/ed25519 or similar library
      
      return true; // Placeholder - implement actual verification
    } catch (error) {
      console.error('Enclave signature verification failed:', error);
      return false;
    }
  }

  /**
   * Verify NFT metadata integrity
   */
  async verifyNFTMetadata(metadata: DIDMetadata): Promise<boolean> {
    try {
      // Basic metadata validation
      if (!metadata.id || !metadata.owner) {
        return false;
      }

      // Additional metadata checks can be added here
      return true;
    } catch (error) {
      console.error('Metadata verification failed:', error);
      return false;
    }
  }

  /**
   * Verify NFT ownership
   */
  async verifyOwnership(data: NFTVerificationData): Promise<boolean> {
    try {
      // Verify that the claimed owner matches the actual NFT owner
      return data.owner === data.metadata.owner;
    } catch (error) {
      console.error('Ownership verification failed:', error);
      return false;
    }
  }

  /**
   * Extract verification data from NFT object
   */
  private extractVerificationData(nftData: any): NFTVerificationData {
    // This would be customized based on your NFT structure
    const content = nftData.content;
    
    return {
      tokenId: nftData.objectId,
      owner: nftData.owner?.AddressOwner || '',
      metadata: {
        id: content?.fields?.id || '',
        owner: content?.fields?.owner || '',
        isVerified: content?.fields?.is_verified || false,
        verificationLevel: content?.fields?.verification_level || 0,
        createdAt: content?.fields?.created_at || '',
        updatedAt: content?.fields?.updated_at || ''
      },
      enclaveSignature: {
        signature: content?.fields?.enclave_signature || '',
        publicKey: content?.fields?.enclave_public_key || '',
        message: content?.fields?.signed_message || ''
      }
    };
  }

  /**
   * Get DID NFTs owned by an address
   */
  async getDIDNFTsByOwner(ownerAddress: string): Promise<string[]> {
    try {
      const objects = await this.client.getOwnedObjects({
        owner: ownerAddress,
        filter: {
          StructType: `${this.config.packageId}::did_nft::DIDNFT`
        }
      });

      return objects.data.map((obj: any) => obj.data?.objectId || '').filter((id: string) => id);
    } catch (error) {
      console.error('Failed to get DID NFTs:', error);
      return [];
    }
  }

  /**
   * Batch verify multiple NFTs
   */
  async batchVerifyNFTs(
    nftObjectIds: string[],
    options: VerificationOptions = {}
  ): Promise<VerificationResult[]> {
    const results = await Promise.all(
      nftObjectIds.map(id => this.verifyDIDNFT(id, options))
    );
    return results;
  }
}

export default SuiVerifySDK;
