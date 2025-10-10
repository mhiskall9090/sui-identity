import { getFullnodeUrl } from '@mysten/sui/client';
import { createNetworkConfig } from '@mysten/dapp-kit';
import { TESTNET_PACKAGE_ID } from './Contansts';

const { networkConfig, useNetworkVariable, useNetworkVariables } = createNetworkConfig({
  testnet: {
    url: getFullnodeUrl('testnet'),
    variables: {
      packageId: TESTNET_PACKAGE_ID,
      gqlClient: 'https://sui-testnet.mystenlabs.com/graphql',
    },
  },
  devnet: {
    url: getFullnodeUrl('devnet'),
    variables: {
      // Add any devnet-specific variables here
    },
  },
  mainnet: {
    url: getFullnodeUrl('mainnet'),
    variables: {
      // Add any mainnet-specific variables here
    },
  },
});

export { useNetworkVariable, useNetworkVariables, networkConfig };