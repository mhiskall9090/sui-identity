# Sui Identity Contracts & Testing Guide

This document provides an overview of the Sui Identity smart contracts and a step-by-step guide on how to test the identity verification and NFT claiming process on the Sui Testnet.

## Core Smart Contracts

The project's on-chain logic is primarily managed by a set of interconnected Move modules located in the `contracts/sources/` directory.

### 1. `did_registry.move`

This is the central contract for managing Decentralized Identifiers (DIDs).

- **Purpose:** It maintains a registry of verified user identities. It allows for the creation of `UserDID` objects, which represent a user's verified status for a specific identity type (e.g., "Over 18").
- **Key Functionality:**
  - `register_user_did`: Called by a trusted backend (via an enclave) to create a `UserDID` object for a user's wallet address after successful off-chain verification.
  - `claim_did_nft`: A public function that allows a user who has a valid `UserDID` to mint an NFT to their wallet. This NFT serves as a soul-bound, on-chain, verifiable credential of their identity verification. The NFT's metadata includes details about the verification.

### 2. `enclave.move`

This contract acts as a bridge to a trusted execution environment (TEE), or "enclave."

- **Purpose:** It manages the registration and verification of trusted enclaves that are authorized to attest to user identities.
- **Key Functionality:**
  - It stores the public keys of registered enclaves.
  - It provides functions to verify that a signature accompanying a verification request was produced by a legitimate, registered enclave, ensuring that only trusted sources can create `UserDID` objects in the `did_registry`.

### 3. `payment.move`

This module handles the financial aspects of the verification process.

- **Purpose:** To manage payments for identity verification services.
- **Key Functionality:** It defines a `Treasury` and allows for payments to be made in exchange for verification credits or services.

### 4. `seal_whitelist.move`

This is a utility contract for access control.

- **Purpose:** It maintains a whitelist of addresses that are authorized to perform certain privileged actions, such as registering a new enclave.

---

## How to Test on Sui Testnet

Follow these steps to run the application locally, complete the verification flow, and see the results on-chain using Sui Scan.

### Prerequisites

1.  **Sui Wallet:** You must have a Sui-compatible wallet extension installed in your browser (e.g., Sui Wallet, Enoki).
2.  **Testnet SUI:** Ensure your wallet is connected to the **Testnet** network and funded with SUI tokens from a faucet.

### Step-by-Step Guide

**Step 1: Run the Application**

- The backend and frontend services should already be running from our previous steps.
- Open the application in your browser, which is typically at `http://localhost:5173`.

**Step 2: Connect Your Wallet**

- Click the "Connect Wallet" button on the landing page and approve the connection in your wallet.

**Step 3: Complete the KYC Flow**

1.  Navigate to the KYC page (usually by clicking a "Verify Identity" button).
2.  **Select Document:** Choose either "Ghana Card" or "Ghana Passport" and click "Continue".
3.  **Upload Document:** Upload any image file for the document photo and enter a sample phone number (e.g., 9999999999). Click "Continue".
4.  **Face Verification:** Allow camera access and complete the simulated face scan.
5.  **OTP Verification:** This step is currently bypassed. The application will automatically proceed as if the OTP was successful.

**Step 4: Wait for On-Chain Verification**

- After the OTP step, the application will show a "Waiting for Verification" screen.
- In the background, the (mocked) backend processes the request and calls the `register_user_did` function on the smart contract.
- The frontend listens for the successful transaction event.

**Step 5: Claim Your NFT Credential**

1.  Once the on-chain verification is detected, the UI will update to an "Encrypting Document" and then a "Completed" state.
2.  A button labeled **"Claim DID NFT"** will appear. Click it.
3.  Your Sui wallet will pop up, asking you to approve the `claim_did_nft` transaction. **Approve the transaction.**

**Step 6: Verify the Result on Sui Scan**

1.  After approving the transaction, a success modal will appear, containing the **Transaction Hash** and the **NFT ID**.
2.  **Examine the Transaction:**
    - Copy the **Transaction Hash**.
    - Go to `https://suiscan.xyz/testnet/tx/` and paste the hash.
    - In the transaction details, look at the "Changes on-chain" tab. You will see the created NFT object.
3.  **Examine the NFT:**
    - Copy the **NFT ID** from the success modal.
    - Go to `https://suiscan.xyz/testnet/object/` and paste the ID.
    - You can now view your newly minted NFT. Check its "Fields" to see the metadata, including the `name` ("Age Verification NFT") and `description` confirming your verification.

You have successfully completed the end-to-end flow and received an on-chain verifiable credential!
