# SuiVerify SDK

A TypeScript SDK for verifying Nautilus enclave signatures and DID NFT authenticity on the Sui blockchain.

## Features

- ✅ **DID NFT Verification** - Verify the authenticity of identity NFTs
- ✅ **Enclave Signature Validation** - Validate Nautilus enclave signatures
- ✅ **Ownership Verification** - Check NFT ownership
- ✅ **Batch Operations** - Verify multiple NFTs efficiently
- ✅ **TypeScript Support** - Full type definitions included

## Installation

```bash
npm install suiverify-sdk
```

## Quick Start

```typescript
import { SuiVerifySDK } from 'suiverify-sdk';

// Initialize SDK
const sdk = new SuiVerifySDK({
  network: 'testnet',
  packageId: '0x...' // Your package ID
});

// Verify a DID NFT
const result = await sdk.verifyDIDNFT('0x...', {
  checkOwnership: true,
  validateSignature: true
});

if (result.isValid) {
  console.log('✅ NFT is authentic!');
} else {
  console.log('❌ Verification failed:', result.message);
}
```

## API Reference

### SuiVerifySDK

#### Constructor

```typescript
new SuiVerifySDK(config: SuiVerifyConfig)
```

#### Methods

- `verifyDIDNFT(nftObjectId, options?)` - Verify a single DID NFT
- `batchVerifyNFTs(nftObjectIds, options?)` - Verify multiple NFTs
- `getDIDNFTsByOwner(ownerAddress)` - Get all DID NFTs for an address
- `verifyEnclaveSignature(signature)` - Verify Nautilus enclave signature

## Examples

See the `examples/` directory for complete usage examples.

## Development

```bash
# Install dependencies
npm install

# Build the SDK
npm run build

# Run example
npm run example:basic

# Run tests
npm test
```

## License

MIT
