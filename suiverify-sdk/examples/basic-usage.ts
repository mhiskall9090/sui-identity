/**
 * SuiVerify SDK - Basic Usage Example
 * Demonstrates how to verify enclave signatures using the enclave.move contract
 */

import { SuiVerifySDK } from '../src';

async function main() {
  // Initialize SDK with your actual package ID
  const sdk = new SuiVerifySDK({
    network: 'testnet',
    rpcUrl: 'https://fullnode.testnet.sui.io:443',
    packageId: '0xcfedf4e2445497ba1a5d57349d6fc116b194eca41524f46f593c63a7a70a8eab' // Your actual package ID
  });

  try {
    console.log('🔍 Testing Enclave Signature Verification...');
    
    // Example enclave signature verification using the contract
    const enclaveObjectId = '0x...'; // Replace with actual enclave object ID
    const intentScope = 1; // Intent scope for the message
    const timestampMs = Date.now();
    const payload = { message: "Hello from SuiVerify!" };
    const signature = '0x...'; // Replace with actual signature from enclave
    
    // Call the enclave.move verify_signature function
    const verificationResult = await sdk.verifyEnclaveSignatureOnChain(
      enclaveObjectId,
      intentScope,
      timestampMs,
      payload,
      signature
    );

    if (verificationResult.isValid) {
      console.log('✅ Enclave signature verification successful!');
      console.log('📄 Transaction result:', verificationResult.data);
    } else {
      console.log('❌ Enclave signature verification failed:', verificationResult.message);
    }

    console.log('\n🔍 Verifying DID NFT...');
    
    // Example NFT object ID (replace with actual ID)
    const nftObjectId = '0x...';
    
    // Verify NFT using the SDK
    const nftResult = await sdk.verifyDIDNFT(nftObjectId, {
      checkOwnership: true,
      validateSignature: true,
      requireEnclave: true
    });

    if (nftResult.isValid) {
      console.log('✅ NFT verification successful!');
      console.log('📄 Verification data:', nftResult.data);
    } else {
      console.log('❌ NFT verification failed:', nftResult.message);
    }

    // Get all DID NFTs for an address
    const ownerAddress = '0x...'; // Replace with actual address
    console.log('\n🔍 Getting DID NFTs for owner...');
    
    const nftIds = await sdk.getDIDNFTsByOwner(ownerAddress);
    console.log(`📋 Found ${nftIds.length} DID NFTs`);

    // Batch verify multiple NFTs
    if (nftIds.length > 0) {
      console.log('\n🔍 Batch verifying NFTs...');
      const batchResults = await sdk.batchVerifyNFTs(nftIds.slice(0, 3)); // Verify first 3
      
      const validCount = batchResults.filter(r => r.isValid).length;
      console.log(`✅ ${validCount}/${batchResults.length} NFTs are valid`);
    }

    console.log('\n📋 Summary:');
    console.log('✅ SDK demonstrates integration with enclave.move verify_signature function');
    console.log('✅ On-chain verification calls the actual Sui Move contract');
    console.log('✅ Local verification provides fallback for offline scenarios');
    console.log('✅ Batch operations enable efficient verification of multiple NFTs');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Additional example: Direct enclave verification
async function demonstrateEnclaveVerification() {
  console.log('\n🔧 === Direct Enclave Verification Demo ===');
  
  const sdk = new SuiVerifySDK({
    network: 'testnet',
    rpcUrl: 'https://fullnode.testnet.sui.io:443',
    packageId: '0xcfedf4e2445497ba1a5d57349d6fc116b194eca41524f46f593c63a7a70a8eab'
  });

  // Example: Verify a message signed by the Nautilus enclave
  const enclaveSignature = {
    signature: '0x1234567890abcdef...', // Replace with actual signature from enclave
    publicKey: '0xabcdef1234567890...', // Replace with actual enclave public key
    message: 'Hello from SuiVerify Nautilus Enclave!'
  };

  console.log('🔍 Testing local signature verification...');
  const localResult = await sdk.verifyEnclaveSignature(enclaveSignature);
  console.log(`Local verification result: ${localResult ? '✅ Valid' : '❌ Invalid'}`);

  console.log('\n🔍 Testing on-chain signature verification...');
  const onChainResult = await sdk.verifyEnclaveSignatureOnChain(
    '0x...', // Enclave object ID
    1,       // Intent scope
    Date.now(),
    { message: 'Test verification' },
    '0x1234567890abcdef...' // Signature
  );
  
  console.log(`On-chain verification result: ${onChainResult.isValid ? '✅ Valid' : '❌ Invalid'}`);
  console.log('Function called:', onChainResult.data?.functionCall);
}

// Run example
if (require.main === module) {
  main().catch(console.error);
}
