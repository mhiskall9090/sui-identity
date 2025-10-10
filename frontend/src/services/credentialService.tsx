export interface CredentialData {
    id: string;
    title: string;
    description: string;
    status: 'verified' | 'pending' | 'expired';
    issuer: string;
    issuedDate: string;
    expiryDate: string;
    type: 'nft' | 'document';
    nftId?: string;
    suiExplorerUrl?: string;
    walrusUrl?: string;
    blobId?: string;
    userAddress: string;
    didType: string;
    createdAt: string;
  }
  
  export interface CredentialStats {
    total: number;
    verified: number;
    pending: number;
  }
  
import { config } from '../config/environment';

  class CredentialService {
    private baseUrl = config.VERIFICATION_API_URL;
  
    /**
     * Fetch user credentials from backend
     */
    async getUserCredentials(userAddress: string): Promise<{
      credentials: CredentialData[];
      stats: CredentialStats;
    }> {
      try {
        const response = await fetch(`${this.baseUrl}/credentials/user/${userAddress}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
  
        if (!response.ok) {
          throw new Error(`Failed to fetch credentials: ${response.status}`);
        }
  
        const data = await response.json();
        
        // Calculate stats from credentials
        const credentials: CredentialData[] = data.credentials || [];
        const stats: CredentialStats = {
          total: credentials.length,
          verified: credentials.filter(c => c.status === 'verified').length,
          pending: credentials.filter(c => c.status === 'pending').length,
        };
  
        return { credentials, stats };
      } catch (error) {
        console.error('Error fetching user credentials:', error);
        
        // Return empty data on error
        return {
          credentials: [],
          stats: { total: 0, verified: 0, pending: 0 }
        };
      }
    }
  
    /**
     * Save NFT credential after successful claim
     */
    async saveNFTCredential(credentialData: {
      userAddress: string;
      nftId: string;
      didType: string;
      title: string;
      description: string;
      suiExplorerUrl: string;
      walrusUrl?: string;
      blobId?: string;
      transactionHash: string;
    }): Promise<{ success: boolean; error?: string; credentialId?: string }> {
      try {
        const response = await fetch(`${this.baseUrl}/credentials/nft`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...credentialData,
            status: 'verified',
            type: 'nft',
            issuer: 'SuiVerify Identity Service',
            issuedDate: new Date().toISOString(),
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
          }),
        });
  
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to save NFT credential: ${response.status} - ${errorText}`);
        }
  
        const result = await response.json();
        return { success: true, credentialId: result.credentialId, ...result };
      } catch (error) {
        console.error('Error saving NFT credential:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to save credential' 
        };
      }
    }
  
    /**
     * Update credential status
     */
    async updateCredentialStatus(
      credentialId: string, 
      status: 'verified' | 'pending' | 'expired'
    ): Promise<{ success: boolean; error?: string; credentialId?: string }> {
      try {
        const response = await fetch(`${this.baseUrl}/credentials/${credentialId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        });
  
        if (!response.ok) {
          throw new Error(`Failed to update credential: ${response.status}`);
        }
  
        return { success: true };
      } catch (error) {
        console.error('Error updating credential status:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to update credential' 
        };
      }
    }
  }
  
  export const credentialService = new CredentialService();
  