/// DID Registry Contract for SuiVerify
/// This contract manages decentralized identity (DID) verification for users
/// - Stores DID types as enums (age verification, citizenship verification)
/// - Manages user verification status and document storage
/// - Handles NFT claims after successful verification
/// - Integrates with Nautilus TEE for secure attestations
module suiverify::did_registry {

// Import Sui framework modules for data structures and utilities
use sui::table::{Self, Table}; // Table for key-value mappings
use sui::event; // Event emission for frontend notifications
use sui::clock::{Self, Clock}; // Clock for timestamps
use sui::url::{Self, Url}; // URL handling for NFT metadata
use std::string::{Self, String}; // String utilities

// Error codes - unique identifiers for different error conditions
const EInvalidCap: u64 = 1; // Error when admin capability is invalid or doesn't match registry
const EAlreadyVerified: u64 = 3; // Error when user tries to claim NFT that's already claimed
const ENotVerified: u64 = 4; // Error when user tries to claim NFT without being verified
const EInvalidDIDType: u64 = 5; // Error when an unknown DID type is provided
const EAlreadyHasDID: u64 = 6; // Error when user already has this DID type

// DID Type enums - defines different types of identity verification
const DID_AGE_VERIFY: u8 = 1; // Age verification (18+ using Ghana Card)
const DID_CITIZENSHIP_VERIFY: u8 = 2; // Citizenship verification (Ghana nationality)

// Verification status enums - tracks the state of a verification request
const STATUS_PENDING: u8 = 0; // Verification request submitted but not yet processed
const STATUS_VERIFIED: u8 = 1; // Verification completed successfully
const STATUS_REJECTED: u8 = 2; // Verification failed or rejected

/// User's DID record with verification status
/// This struct stores all verification data for a single user's DID request
/// Abilities: key (can be owned/shared), store (can be stored in other objects)
public struct UserDID has key, store {
    id: UID, // Unique identifier for this DID record
    owner: address, // Sui address of the user who owns this DID
    did_type: u8, // Type of DID (DID_AGE_VERIFY or DID_CITIZENSHIP_VERIFY)
    verification_status: u8, // Current status (STATUS_PENDING, STATUS_VERIFIED, STATUS_REJECTED)
    verification_timestamp: u64, // Timestamp (in milliseconds) when verification was last updated
    expiry_epoch: u64, // Sui epoch when this DID expires (0 if not yet verified)
    blob_id: String, // Walrus blob ID where encrypted documents are stored
    nautilus_signature: vector<u8>, // Signature from Nautilus TEE attesting to verification
    signature_timestamp_ms: u64, // Exact timestamp when Nautilus created the signature
    evidence_hash: vector<u8>, // Hash of OCR data from Python backend for SDK verification
    claimed: bool, // Whether the user has claimed their NFT (true after claim)
}

/// DID Registry managing all user verifications in the system
/// This is the central registry that tracks all DIDs across all users
/// Ability: key (shared object accessible by all)
public struct DIDRegistry has key {
    id: UID, // Unique identifier for this registry
    /// User verifications: nested table mapping user_address -> did_type -> UserDID_ID
    /// Allows O(1) lookup of any user's DID by address and type
    user_verifications: Table<address, Table<u8, ID>>,
    /// Admin addresses who can update verification status
    /// Maps address -> true if admin, entry doesn't exist if not admin
    admin_addresses: Table<address, bool>,
}

/// Admin capability for DID registry
/// This capability grants permission to manage the registry
/// Only the holder of this object can add admins and update verification status
/// Abilities: key (can be owned/transferred)
public struct RegistryCap has key {
    id: UID, // Unique identifier for this capability
    registry_id: ID, // ID of the registry this capability controls
}

/// SoulBound DID NFT - cannot be transferred after minting
/// This NFT proves the user's verified identity and contains all verification data
/// Note: Intentionally does NOT have 'store' ability, making it non-transferable (soulbound)
/// Abilities: key (can be owned but not transferred)
public struct DIDSoulBoundNFT has key {
    id: UID, // Unique identifier for this NFT
    /// The owner of this DID NFT - cannot change due to soulbound property
    owner: address,
    /// DID type (AGE_VERIFY, CITIZENSHIP_VERIFY) - determines what this NFT proves
    did_type: u8,
    /// Display name for the NFT (shown in wallets and marketplaces)
    name: String,
    /// Description of the DID and what it certifies
    description: String,
    /// Image URL for the NFT visual representation
    image_url: Url,
    /// Walrus blob ID reference where encrypted documents are stored
    blob_id: String,
    /// Nautilus TEE signature for verification attestation - proves authenticity
    nautilus_signature: vector<u8>,
    /// When signature was created in Nautilus (for SDK verification and replay protection)
    signature_timestamp_ms: u64,
    /// OCR data hash from Python backend (for SDK verification of document data)
    evidence_hash: vector<u8>,
    /// When the DID expires (Sui epoch number) - NFT becomes invalid after this
    expiry_epoch: u64,
    /// When the NFT was minted (timestamp in milliseconds)
    minted_at: u64,
}

// Events - emitted during contract execution to notify frontend and indexers
// All events have 'copy' and 'drop' abilities for gas efficiency

/// Emitted when a user starts a new verification process
public struct VerificationStarted has copy, drop {
    registry_id: ID, // ID of the registry managing this verification
    user_address: address, // Address of the user starting verification
    did_type: u8, // Type of DID being verified
    user_did_id: ID, // ID of the created UserDID object
}

/// Emitted when verification is completed (approved or rejected)
/// Frontend event listeners capture this to update UI and show results
public struct VerificationCompleted has copy, drop {
    registry_id: ID, // ID of the registry managing this verification
    user_address: address, // Address of the verified user
    did_type: u8, // Type of DID that was verified
    user_did_id: ID, // ID of the UserDID object
    status: u8, // Final status (STATUS_VERIFIED or STATUS_REJECTED)
    nautilus_signature: vector<u8>, // Signature from TEE for verification proof
    signature_timestamp_ms: u64, // When signature was created in Nautilus
    evidence_hash: vector<u8>, // OCR data hash from Python backend
}

/// Emitted when a user claims their DID NFT after successful verification
public struct DIDClaimed has copy, drop {
    registry_id: ID, // ID of the registry managing this DID
    user_address: address, // Address of the user claiming the NFT
    did_type: u8, // Type of DID being claimed
    user_did_id: ID, // ID of the UserDID object
    nft_id: ID, // ID of the newly minted NFT
}

/// Initialize function - automatically called once when the module is published
/// Creates the DID registry and admin capability, then transfers them appropriately
/// ctx: Transaction context providing sender address and object creation utilities
fun init(ctx: &mut TxContext) {
    // Create the main DID registry with empty tables
    let registry = DIDRegistry {
        id: object::new(ctx), // Generate unique ID for the registry
        user_verifications: table::new(ctx), // Initialize empty verification table
        admin_addresses: table::new(ctx), // Initialize empty admin table
    };
    
    // Create admin capability that controls the registry
    let cap = RegistryCap {
        id: object::new(ctx), // Generate unique ID for the capability
        registry_id: object::id(&registry), // Link capability to registry
    };
    
    // Share the registry object so anyone can read verification status
    // Shared objects are accessible by all addresses but can only be modified by authorized users
    transfer::share_object(registry);
    
    // Transfer the admin capability to the deployer (module publisher)
    // This gives the deployer exclusive admin rights
    transfer::transfer(cap, tx_context::sender(ctx));
}

/// Create DID registry with admin capability (kept for backwards compatibility)
/// This function allows programmatic creation of registries for testing or migration
/// Returns: (RegistryCap, DIDRegistry) tuple for the caller to manage
/// ctx: Transaction context for object creation
public fun create_did_registry(ctx: &mut TxContext): (RegistryCap, DIDRegistry) {
    // Create new registry instance with empty tables
    let registry = DIDRegistry {
        id: object::new(ctx), // Generate unique registry ID
        user_verifications: table::new(ctx), // Empty verification mapping
        admin_addresses: table::new(ctx), // Empty admin mapping
    };
    
    // Create capability linked to this registry
    let cap = RegistryCap {
        id: object::new(ctx), // Generate unique capability ID
        registry_id: object::id(&registry), // Store registry ID for validation
    };
    
    // Return both objects for caller to share/transfer as needed
    (cap, registry)
}

/// Entry function to create DID registry
/// Entry functions can be called directly from transactions
/// Automatically shares the registry and transfers capability to sender
/// ctx: Transaction context
entry fun create_did_registry_entry(ctx: &mut TxContext) {
    // Create registry and capability using the helper function
    let (cap, registry) = create_did_registry(ctx);
    // Make registry accessible to all addresses
    transfer::share_object(registry);
    // Give capability to the caller
    transfer::transfer(cap, tx_context::sender(ctx));
}

/// Add admin address to the registry (only registry owner can call this)
/// Admins can update verification status and start verification processes
/// registry: Mutable reference to the shared DID registry
/// cap: Admin capability proving caller has permission
/// admin_address: Address to grant admin privileges to
public fun add_admin(
    registry: &mut DIDRegistry,
    cap: &RegistryCap,
    admin_address: address,
) {
    // Verify the capability is valid for this registry
    // This prevents using a capability from a different registry
    assert!(cap.registry_id == object::id(registry), EInvalidCap);
    // Add the address to the admin table with value 'true'
    table::add(&mut registry.admin_addresses, admin_address, true);
}

/// Get DID type details for frontend display and validation
/// Returns information about a specific DID type
/// did_type: The DID type to get information for
/// Returns: (name, description, required_documents, validity_epochs)
public fun get_did_type_info(did_type: u8): (String, String, vector<String>, u64) {
    // Check if this is the age verification DID
    if (did_type == DID_AGE_VERIFY) {
        (
            // Display name for the DID type
            string::utf8(b"18+ Age Verification"),
            // Detailed description of what this DID certifies
            string::utf8(b"Verify user is 18 years or older using Ghana Card and face verification"),
            // List of required documents for this verification type
            vector[string::utf8(b"ghana_card"), string::utf8(b"face_capture")],
            // How long this DID remains valid (in epochs, ~365 days)
            365
        )
    } else if (did_type == DID_CITIZENSHIP_VERIFY) {
        // Citizenship verification has different requirements
        (
            string::utf8(b"Ghana Citizenship Verification"),
            string::utf8(b"Verify Ghanaian citizenship using Ghana Card or Passport verification"),
            // More document options for citizenship
            vector[string::utf8(b"ghana_card"), string::utf8(b"ghana_passport"), string::utf8(b"face_capture")],
            // Longer validity period for citizenship (730 epochs ~2 years)
            730
        )
    } else {
        // Invalid DID type - abort transaction with error
        abort EInvalidDIDType
    }
}

/// Start verification process for a user (admin only)
/// Creates a UserDID record and initiates the verification workflow
/// registry: Mutable reference to the shared DID registry
/// cap: Admin capability proving caller has permission
/// user_address: Address of the user to verify
/// did_type: Type of DID to create (AGE_VERIFY or CITIZENSHIP_VERIFY)
/// clock: Shared clock object for timestamps
/// ctx: Transaction context
/// Returns: ID of the created UserDID object
public fun start_verification(
    registry: &mut DIDRegistry,
    cap: &RegistryCap,
    user_address: address,
    did_type: u8,
    clock: &Clock,
    ctx: &mut TxContext
): ID {
    // Verify admin capability matches this registry
    assert!(cap.registry_id == object::id(registry), EInvalidCap);
    
    // Validate DID type is one of the supported types
    assert!(did_type == DID_AGE_VERIFY || did_type == DID_CITIZENSHIP_VERIFY, EInvalidDIDType);
    
    // Check if user already has this DID type to prevent duplicates
    if (table::contains(&registry.user_verifications, user_address)) {
        // User has some DIDs, check if they have this specific type
        let user_dids = table::borrow(&registry.user_verifications, user_address);
        assert!(!table::contains(user_dids, did_type), EAlreadyHasDID);
    };
    
    // Create UserDID record with pending status and empty verification data
    let user_did = UserDID {
        id: object::new(ctx), // Generate unique ID for this DID
        owner: user_address, // Set the user as owner
        did_type, // Store the DID type
        verification_status: STATUS_PENDING, // Initial status is pending
        verification_timestamp: clock::timestamp_ms(clock), // Record creation time
        expiry_epoch: 0, // Will be set after successful verification
        blob_id: string::utf8(b""), // Empty initially, set when documents are uploaded
        nautilus_signature: vector::empty(), // Empty initially, set after verification
        signature_timestamp_ms: 0, // Zero initially, set when signature is created
        evidence_hash: vector::empty(), // Empty initially, set after OCR processing
        claimed: false, // NFT not yet claimed
    };
    
    // Get the ID of the UserDID object before moving it
    let user_did_id = object::id(&user_did);
    
    // Track user's DID in the registry
    if (!table::contains(&registry.user_verifications, user_address)) {
        // User has no DIDs yet, create a new inner table for them
        table::add(&mut registry.user_verifications, user_address, table::new(ctx));
    };
    // Get mutable reference to user's DID table
    let user_dids = table::borrow_mut(&mut registry.user_verifications, user_address);
    // Add this DID to the user's table
    table::add(user_dids, did_type, user_did_id);
    
    // Share the UserDID object so it can be read and updated
    transfer::share_object(user_did);
    
    // Emit event to notify frontend that verification has started
    event::emit(VerificationStarted {
        registry_id: object::id(registry),
        user_address,
        did_type,
        user_did_id,
    });
    
    // Return the UserDID ID for reference
    user_did_id
}

/// Update verification status after backend processing (admin only)
/// Called by backend after Python OCR and Nautilus TEE verification completes
/// registry: Reference to the DID registry (for validation)
/// cap: Admin capability proving caller has permission
/// user_did: Mutable reference to the UserDID object to update
/// verified: True if verification succeeded, false if rejected
/// nautilus_signature: Signature from Nautilus TEE attesting to verification
/// signature_timestamp_ms: Exact timestamp when Nautilus created the signature
/// evidence_hash: Hash of OCR data from Python backend for SDK verification
/// clock: Shared clock object for timestamps
/// ctx: Transaction context for epoch information
public fun update_verification_status(
    registry: &mut DIDRegistry,
    cap: &RegistryCap,
    user_did: &mut UserDID,
    verified: bool,
    nautilus_signature: vector<u8>,
    signature_timestamp_ms: u64,
    evidence_hash: vector<u8>,
    clock: &Clock,
    ctx: &TxContext
) {
    // Verify admin capability matches this registry
    assert!(cap.registry_id == object::id(registry), EInvalidCap);
    
    // Determine new status based on verification result
    let new_status = if (verified) STATUS_VERIFIED else STATUS_REJECTED;
    // Update the verification status
    user_did.verification_status = new_status;
    // Update the timestamp to current time
    user_did.verification_timestamp = clock::timestamp_ms(clock);
    
    // Store Nautilus signature and enhanced verification data for later proof
    user_did.nautilus_signature = nautilus_signature;
    user_did.signature_timestamp_ms = signature_timestamp_ms;
    user_did.evidence_hash = evidence_hash;
    
    // If verified, set expiry epoch based on DID type
    if (verified) {
        // Get validity period for this DID type
        let (_, _, _, validity_epochs) = get_did_type_info(user_did.did_type);
        // Set expiry to current epoch + validity period
        user_did.expiry_epoch = tx_context::epoch(ctx) + validity_epochs;
    };
    
    // Emit event for frontend listeners to update UI
    // Frontend will capture this enhanced data to show verification results
    event::emit(VerificationCompleted {
        registry_id: object::id(registry),
        user_address: user_did.owner,
        did_type: user_did.did_type,
        user_did_id: object::id(user_did),
        status: new_status,
        nautilus_signature: nautilus_signature,
        signature_timestamp_ms: signature_timestamp_ms, // Exact signing time from Nautilus
        evidence_hash: evidence_hash, // OCR hash for SDK verification
    });
}

/// Claim DID NFT after successful verification
/// Creates a SoulBound NFT with metadata including blob_id and Nautilus signature
/// NFT has no 'store' ability, making it permanently non-transferable (soulbound)
/// registry: Reference to the DID registry (for validation)
/// user_did: Mutable reference to the UserDID object
/// blob_id: Walrus blob ID where encrypted documents are stored
/// clock: Shared clock object for timestamps
/// ctx: Transaction context
/// Returns: ID of the newly minted NFT
public fun claim_did_nft(
    registry: &DIDRegistry,
    user_did: &mut UserDID,
    blob_id: String,
    clock: &Clock,
    ctx: &mut TxContext
): ID {
    // Verify the DID is in verified status
    assert!(user_did.verification_status == STATUS_VERIFIED, ENotVerified);
    // Verify caller is the owner of this DID
    assert!(user_did.owner == tx_context::sender(ctx), EInvalidCap);
    // Verify NFT hasn't been claimed already (prevent double claiming)
    assert!(!user_did.claimed, EAlreadyVerified);
    
    // Check if DID is still valid (not expired)
    assert!(tx_context::epoch(ctx) < user_did.expiry_epoch, ENotVerified);
    
    // Get DID type information for NFT metadata
    let (name, description, _, _) = get_did_type_info(user_did.did_type);
    
    // Create image URL based on DID type for NFT visual
    let image_url = if (user_did.did_type == DID_AGE_VERIFY) {
        // Age verification NFT image
        url::new_unsafe_from_bytes(b"https://imgs.search.brave.com/ghana_age_verify_nft.png")
    } else {
        // Citizenship verification NFT image
        url::new_unsafe_from_bytes(b"https://imgs.search.brave.com/ghana_citizenship_nft.png")
    };
    
    // Create SoulBound NFT with complete verification data for SDK verification
    let nft = DIDSoulBoundNFT {
        id: object::new(ctx), // Generate unique NFT ID
        owner: user_did.owner, // Set owner address
        did_type: user_did.did_type, // Store DID type
        name, // Display name from DID type info
        description, // Description from DID type info
        image_url, // Image URL based on DID type
        blob_id, // Walrus blob ID for document storage
        nautilus_signature: user_did.nautilus_signature, // Use stored TEE signature
        signature_timestamp_ms: user_did.signature_timestamp_ms, // For SDK verification
        evidence_hash: user_did.evidence_hash, // For SDK verification
        expiry_epoch: user_did.expiry_epoch, // When DID expires
        minted_at: clock::timestamp_ms(clock), // Record minting time
    };
    
    // Get NFT ID before moving the object
    let nft_id = object::id(&nft);
    
    // Update UserDID record to mark as claimed
    user_did.claimed = true;
    // Store the blob_id in the UserDID for reference
    user_did.blob_id = blob_id;
    
    // Transfer NFT to user (SoulBound - cannot be transferred again due to no 'store' ability)
    transfer::transfer(nft, user_did.owner);
    
    // Emit event to notify frontend of NFT claim
    event::emit(DIDClaimed {
        registry_id: object::id(registry),
        user_address: user_did.owner,
        did_type: user_did.did_type,
        user_did_id: object::id(user_did),
        nft_id,
    });
    
    // Return NFT ID for reference
    nft_id
}

/// Check if user has a verified DID of specific type
/// Used by frontend and other contracts to verify user's identity status
/// registry: Reference to the DID registry
/// user_address: Address to check
/// did_type: Type of DID to check for
/// Returns: true if user has verified DID of this type, false otherwise
public fun has_verified_did(
    registry: &DIDRegistry,
    user_address: address,
    did_type: u8,
): bool {
    // Check if user has any DIDs registered
    if (!table::contains(&registry.user_verifications, user_address)) {
        return false // User has no DIDs at all
    };
    
    // Get user's DID table
    let user_dids = table::borrow(&registry.user_verifications, user_address);
    // Check if user has this specific DID type
    if (!table::contains(user_dids, did_type)) {
        return false // User doesn't have this DID type
    };
    // User has this DID type registered
    true
}

/// Get user's DID status for frontend display
/// Returns the status code or 255 if not found
/// registry: Reference to the DID registry
/// user_address: Address to check
/// did_type: Type of DID to check for
/// Returns: Status code (STATUS_PENDING, STATUS_VERIFIED, STATUS_REJECTED, or 255 if not found)
public fun get_user_did_status(
    registry: &DIDRegistry,
    user_address: address,
    did_type: u8
): u8 {
    // Check if user has any DIDs registered
    if (!table::contains(&registry.user_verifications, user_address)) {
        return 255 // Not found - using 255 as special "not exists" code
    };
    
    // Get user's DID table
    let user_dids = table::borrow(&registry.user_verifications, user_address);
    // Check if user has this specific DID type
    if (!table::contains(user_dids, did_type)) {
        return 255 // Not found - user doesn't have this DID type
    };
    // Return pending status (actual status would require reading the UserDID object)
    STATUS_PENDING
}

/// Verify DID for external protocols (SDK integration)
/// Called by external protocols to check if a user's DID is valid
/// This is the main verification function used by the SDK
/// user_did: Reference to the UserDID object to verify
/// ctx: Transaction context for epoch checking
/// Returns: true if DID is verified, claimed, and not expired
public fun verify_did_for_protocol(
    user_did: &UserDID,
    ctx: &TxContext
): bool {
    // Check if DID is verified and NFT has been claimed
    if (user_did.verification_status != STATUS_VERIFIED || !user_did.claimed) {
        return false // Not verified or NFT not claimed yet
    };
    
    // Check if DID has not expired (current epoch < expiry epoch)
    if (tx_context::epoch(ctx) >= user_did.expiry_epoch) {
        return false // DID has expired
    };
    
    // All checks passed - DID is valid
    true
}


/// Get NFT metadata for display purposes
/// Entry function can be called from transactions to fetch NFT details
/// nft: Reference to the DID NFT
/// Returns: (name, description, image_url, did_type, expiry_epoch, blob_id, nautilus_signature)
entry fun get_nft_metadata(nft: &DIDSoulBoundNFT): (String, String, Url, u8, u64, String, vector<u8>) {
    // Return all NFT metadata fields as a tuple
    (nft.name, nft.description, nft.image_url, nft.did_type, nft.expiry_epoch, nft.blob_id, nft.nautilus_signature)
}

/// Check if NFT is expired
/// Entry function to check validity of an NFT
/// nft: Reference to the DID NFT
/// ctx: Transaction context for current epoch
/// Returns: true if NFT is expired, false if still valid
entry fun is_nft_expired(nft: &DIDSoulBoundNFT, ctx: &TxContext): bool {
    // Compare current epoch with expiry epoch
    tx_context::epoch(ctx) >= nft.expiry_epoch
}

/// Get Nautilus signature from NFT for verification
/// Entry function to retrieve the TEE attestation signature
/// nft: Reference to the DID NFT
/// Returns: Nautilus signature bytes for external verification
entry fun get_nautilus_signature(nft: &DIDSoulBoundNFT): vector<u8> {
    // Return copy of the signature
    nft.nautilus_signature
}


}
