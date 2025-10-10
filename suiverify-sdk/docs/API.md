# SuiVerify SDK API Documentation

## Classes

### SuiVerifySDK

Main SDK class for interacting with SuiVerify protocol.

#### Constructor

```typescript
constructor(config: SuiVerifyConfig)
```

**Parameters:**
- `config`: Configuration object containing network settings and package ID

#### Methods

##### verifyDIDNFT()

Verifies a DID NFT's authenticity and enclave signature.

```typescript
async verifyDIDNFT(
  nftObjectId: string,
  options?: VerificationOptions
): Promise<VerificationResult>
```

##### batchVerifyNFTs()

Verifies multiple DID NFTs in batch.

```typescript
async batchVerifyNFTs(
  nftObjectIds: string[],
  options?: VerificationOptions
): Promise<VerificationResult[]>
```

##### getDIDNFTsByOwner()

Gets all DID NFTs owned by a specific address.

```typescript
async getDIDNFTsByOwner(ownerAddress: string): Promise<string[]>
```

## Types

### SuiVerifyConfig

```typescript
interface SuiVerifyConfig {
  rpcUrl: string;
  packageId: string;
  network: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
}
```

### VerificationResult

```typescript
interface VerificationResult {
  isValid: boolean;
  message: string;
  data?: any;
}
```

### VerificationOptions

```typescript
interface VerificationOptions {
  checkOwnership?: boolean;
  validateSignature?: boolean;
  requireEnclave?: boolean;
}
```
