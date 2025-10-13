# SuiVerify Project Architecture and On-Chain Logic

This document provides a detailed explanation of the SuiVerify project, its architecture, and how the Sui Move smart contracts function in unison with the backend and frontend components.

## 1. High-Level Architecture

The SuiVerify project is a comprehensive identity verification system built on the Sui blockchain. It allows users to verify their identity through a KYC (Know Your Customer) process and receive a non-transferable, soul-bound NFT as proof of verification. This NFT can then be used by other protocols to confirm a user's identity without accessing their personal data.

The project consists of several key components:

- **Frontend (`frontend/`)**: A React and TypeScript application that provides the user interface for the entire KYC process. Users upload their identity documents and perform face verification here.
- **Verification Backend (`verification-backend/`)**: A Python FastAPI server that orchestrates the off-chain verification logic. This includes:
  - **OCR (Optical Character Recognition)** to extract data from identity documents.
  - **Face Recognition** to match the user's selfie with the photo on their ID.
  - **OTP (One-Time Password)** verification.
  - **Database management** (MongoDB) to store verification metadata.
  - **Communication** with the on-chain smart contracts to update verification status.
- **Sui Smart Contracts (`contracts/`)**: Move modules that handle the on-chain logic, including the DID registry, payment processing, and management of secure enclaves.
- **Nautilus Enclave Infrastructure (`nautilus_infra/`)**: A Rust-based application designed to run in a secure Trusted Execution Environment (TEE), such as an AWS Nitro Enclave. It provides cryptographic attestations that the off-chain verification was performed securely.
- **SuiVerify SDK (`suiverify-sdk/`)**: A TypeScript library that allows third-party applications to easily interact with the SuiVerify system and verify users' soul-bound NFTs.

## 2. The End-to-End Verification Flow

Here is a step-by-step breakdown of how a user gets verified:

1. **Initiate KYC (Frontend)**: The user starts the KYC process from the web application.
2. **Document & Face Upload (Frontend -> Backend)**: The user uploads an image of their ID document (e.g., Ghana Card) and takes a selfie. These are sent to the `verification-backend`.
3. **Off-Chain Verification (Backend)**:
   - The backend's **OCR service** extracts information from the ID document.
   - The **Face Recognition service** compares the user's selfie with the photo from the ID.
   - An **OTP** is sent to the user's phone number (extracted from the ID) for verification.
4. **Attestation (Backend -> Nautilus Enclave)**: Once the off-chain checks are complete, the backend sends the verification results to the **Nautilus Enclave**. The enclave, running in a secure environment, cryptographically signs the verification data, creating a secure attestation.
5. **Update On-Chain Status (Backend -> Sui Blockchain)**: The backend calls the `did_registry` smart contract on the Sui blockchain, providing the user's address, the verification status, and the signature from the Nautilus Enclave.
6. **Claim NFT (Frontend -> Sui Blockchain)**: The user, now verified on-chain, can claim their soul-bound `DIDSoulBoundNFT`. This NFT contains the verification details and the secure signature, serving as their decentralized identity credential.

## 3. Deep Dive into Sui Move Smart Contracts

The on-chain logic is the core of the system's trust model. It is composed of several modules:

### `did_registry.move`

This is the central contract for managing decentralized identities.

- **`UserDID` struct**: Stores the verification status (`PENDING`, `VERIFIED`, `REJECTED`), DID type (e.g., Age Verification), and the secure attestation data (`nautilus_signature`, `evidence_hash`) for each user.
- **`DIDSoulBoundNFT` struct**: A non-transferable NFT that represents a user's verified identity. It is minted only after successful verification and contains all the necessary data for other protocols to verify its authenticity.
- **Key Functions**:
  - `start_verification`: An admin-only function (called by the backend) to create a `UserDID` record when a user begins the KYC process.
  - `update_verification_status`: An admin-only function to update the user's status to `VERIFIED` or `REJECTED` after the off-chain process is complete. It stores the crucial `nautilus_signature` and `evidence_hash` on-chain.
  - `claim_did_nft`: A public function that allows a verified user to mint their `DIDSoulBoundNFT`. This can only be called if their status is `VERIFIED`.
  - `verify_did_for_protocol`: Allows external smart contracts to check the validity of a user's DID.

### `enclave.move`

This contract ensures that the off-chain attestations are coming from a legitimate, secure source.

- **`EnclaveConfig` & `Enclave` structs**: These manage the registration of secure enclaves. An enclave is registered with its public key and its **PCRs (Platform Configuration Registers)**, which are cryptographic hashes of the software running inside the enclave.
- **Key Functions**:
  - `register_enclave`: Allows the registration of a new enclave instance. The function verifies that the enclave's PCRs match a whitelisted configuration, ensuring that only trusted software can provide attestations.
  - `verify_signature`: A function that can be used to verify a signature that was generated by a registered enclave. This is how the `did_registry` can trust the `nautilus_signature`.

### `payment.move`

This module handles the financial aspects of the protocol, allowing other dApps to pay for identity verification services.

- **`ProtocolVault` struct**: A vault for each registered protocol to deposit SUI tokens.
- **Key Functions**:
  - `register_protocol`: Allows a new protocol to register and create a vault.
  - `settle_nft_verification`: When a third-party protocol uses a SuiVerify NFT for verification, this function can be called to handle the settlement, transferring a fee from the protocol's vault to the SuiVerify treasury.

### `seal_whitelist.move`

This contract manages access control for decrypting sensitive user documents, likely for government or user-authorized access.

- **`GovWhitelist` struct**: Contains a list of whitelisted government addresses and registered user addresses.
- **Key Functions**:
  - `add_government_address`: Allows an admin to add a government address to the whitelist.
  - `can_access`: A (conceptual) function that would check if a given address (user or government) has the right to decrypt and view a user's KYC data.

## 4. Deployment and Next Steps

To get the SuiVerify project ready for production, the following steps are essential:

1. **Environment Configuration**:

   - Create a `.env` file in the `verification-backend` directory with credentials for **MongoDB** and **Redis**.
   - Ensure the correct Sui `packageId` is set in `frontend/src/Contansts.ts` for the target network (Testnet, Mainnet).

2. **Build and Deploy Components**:

   - **Smart Contracts**: Deploy the Move contracts to the Sui network. This can be done using the Sui CLI. The resulting package ID must be updated in the frontend and backend configurations.
   - **Verification Backend**: Build a Docker image for the Python FastAPI application. This will require installing all dependencies from `requirements.txt`.
   - **Frontend**: Build the static assets for the React application by running `pnpm run build` in the `frontend` directory.
   - **Nautilus Enclave**: The Rust application in `nautilus_infra` needs to be compiled and configured to run within an AWS Nitro Enclave.

3. **Infrastructure Setup**:

   - **Web Server**: A server (like Nginx) is needed to serve the static frontend assets.
   - **Application Hosting**: The backend Docker container needs to be hosted on a service like AWS ECS, EKS, or a virtual machine.
   - **Database and Cache**: Set up production instances of MongoDB and Redis.
   - **AWS Nitro Enclave**: Provision and configure a Nitro Enclave to run the `nautilus_infra` application. This is a complex step that involves creating the enclave image and setting up the necessary IAM roles and security groups.

4. **Final Configuration and Testing**:
   - Update all service URLs and API endpoints in the frontend and backend configurations to point to the production services.
   - Thoroughly test the end-to-end flow on a staging or test network before moving to mainnet.
   - Set up monitoring and logging for all services to ensure reliability.
