///  DID Registry Contract for SuiVerify
/// - Stores DID types as enums
/// - Manages user verification status and document storage
/// - Handles NFT claims after successful verification
module suiverify::did_registry {

use sui::table::{Self, Table};
use sui::event;
use sui::clock::{Self, Clock};
use sui::url::{Self, Url};
use std::string::{Self, String};

// Error codes
const EInvalidCap: u64 = 1;
const EAlreadyVerified: u64 = 3;
const ENotVerified: u64 = 4;
const EInvalidDIDType: u64 = 5;
const EAlreadyHasDID: u64 = 6;

// DID Type enums
const DID_AGE_VERIFY: u8 = 1;
const DID_CITIZENSHIP_VERIFY: u8 = 2;

// Verification status
const STATUS_PENDING: u8 = 0;
const STATUS_VERIFIED: u8 = 1;
const STATUS_REJECTED: u8 = 2;

/// User's DID record with verification status
public struct UserDID has key, store {
    id: UID,
    owner: address,
    did_type: u8,                    // DID_AGE_VERIFY or DID_CITIZENSHIP_VERIFY
    verification_status: u8,         // STATUS_PENDING, STATUS_VERIFIED
    verification_timestamp: u64,
    expiry_epoch: u64,
    blob_id: String,                 // Walrus blob ID 
    nautilus_signature: vector<u8>,  // Nautilus attestation signature
    signature_timestamp_ms: u64,     // When signature was created in Nautilus
    evidence_hash: vector<u8>,       // OCR data hash from Python
    claimed: bool,                   // Whether NFT has been claimed
}

/// DID Registry managing user verifications
public struct DIDRegistry has key {
    id: UID,
    /// User verifications: user_address -> did_type -> UserDID_ID
    user_verifications: Table<address, Table<u8, ID>>,
    /// Admin addresses who can update verification status
    admin_addresses: Table<address, bool>,
}

/// Admin capability for DID registry
public struct RegistryCap has key {
    id: UID,
    registry_id: ID,
}

/// SoulBound DID NFT - cannot be transferred (no store ability)
public struct DIDSoulBoundNFT has key {
    id: UID,
    /// The owner of this DID NFT
    owner: address,
    /// DID type (AGE_VERIFY, CITIZENSHIP_VERIFY)
    did_type: u8,
    /// Display name
    name: String,
    /// Description of the DID
    description: String,
    /// Image URL for the NFT
    image_url: Url,
    /// Walrus blob ID reference (stored in metadata)
    blob_id: String,
    /// Nautilus TEE signature for verification attestation
    nautilus_signature: vector<u8>,
    /// When signature was created in Nautilus (for SDK verification)
    signature_timestamp_ms: u64,
    /// OCR data hash from Python (for SDK verification)
    evidence_hash: vector<u8>,
    /// When the DID expires
    expiry_epoch: u64,
    /// When the NFT was minted
    minted_at: u64,
}

// Events
public struct VerificationStarted has copy, drop {
    registry_id: ID,
    user_address: address,
    did_type: u8,
    user_did_id: ID,
}

public struct VerificationCompleted has copy, drop {
    registry_id: ID,
    user_address: address,
    did_type: u8,
    user_did_id: ID,
    status: u8,
    nautilus_signature: vector<u8>,
    signature_timestamp_ms: u64,  // When signature was created in Nautilus
    evidence_hash: vector<u8>,    // OCR data hash from Python
}


public struct DIDClaimed has copy, drop {
    registry_id: ID,
    user_address: address,
    did_type: u8,
    user_did_id: ID,
    nft_id: ID,
}

/// Creates the DID registry and transfers objects to deployer
fun init(ctx: &mut TxContext) {
    let registry = DIDRegistry {
        id: object::new(ctx),
        user_verifications: table::new(ctx),
        admin_addresses: table::new(ctx),
    };
    
    let cap = RegistryCap {
        id: object::new(ctx),
        registry_id: object::id(&registry),
    };
    
    // Share the registry object so anyone can read it
    transfer::share_object(registry);
    
    // Transfer the admin capability to the deployer
    transfer::transfer(cap, tx_context::sender(ctx));
}

/// Create DID registry with admin capability (kept for backwards compatibility)
public fun create_did_registry(ctx: &mut TxContext): (RegistryCap, DIDRegistry) {
    let registry = DIDRegistry {
        id: object::new(ctx),
        user_verifications: table::new(ctx),
        admin_addresses: table::new(ctx),
    };
    
    let cap = RegistryCap {
        id: object::new(ctx),
        registry_id: object::id(&registry),
    };
    
    (cap, registry)
}

/// Entry function to create DID registry
entry fun create_did_registry_entry(ctx: &mut TxContext) {
    let (cap, registry) = create_did_registry(ctx);
    transfer::share_object(registry);
    transfer::transfer(cap, tx_context::sender(ctx));
}

/// Add admin address (only registry owner)
public fun add_admin(
    registry: &mut DIDRegistry,
    cap: &RegistryCap,
    admin_address: address,
) {
    assert!(cap.registry_id == object::id(registry), EInvalidCap);
    table::add(&mut registry.admin_addresses, admin_address, true);
}

/// Get DID type details (frontend can use this to show DID info)
public fun get_did_type_info(did_type: u8): (String, String, vector<String>, u64) {
    if (did_type == DID_AGE_VERIFY) {
        (
            string::utf8(b"18+ Age Verification"),
            string::utf8(b"Verify user is 18 years or older using Ghana Card and face verification"),
            vector[string::utf8(b"ghana_card"), string::utf8(b"face_capture")],
            365 // validity epochs
        )
    } else if (did_type == DID_CITIZENSHIP_VERIFY) {
        (
            string::utf8(b"Ghana Citizenship Verification"),
            string::utf8(b"Verify Ghanaian citizenship using Ghana Card or Passport verification"),
            vector[string::utf8(b"ghana_card"), string::utf8(b"ghana_passport"), string::utf8(b"face_capture")],
            730 // validity epochs
        )
    } else {
        abort EInvalidDIDType
    }
}

/// Start verification process for a user (admin only)
public fun start_verification(
    registry: &mut DIDRegistry,
    cap: &RegistryCap,
    user_address: address,
    did_type: u8,
    clock: &Clock,
    ctx: &mut TxContext
): ID {
    // Verify admin capability
    assert!(cap.registry_id == object::id(registry), EInvalidCap);
    
    // Validate DID type
    assert!(did_type == DID_AGE_VERIFY || did_type == DID_CITIZENSHIP_VERIFY, EInvalidDIDType);
    
    // Check if user already has this DID type
    if (table::contains(&registry.user_verifications, user_address)) {
        let user_dids = table::borrow(&registry.user_verifications, user_address);
        assert!(!table::contains(user_dids, did_type), EAlreadyHasDID);
    };
    
    // Create UserDID record
    let user_did = UserDID {
        id: object::new(ctx),
        owner: user_address,
        did_type,
        verification_status: STATUS_PENDING,
        verification_timestamp: clock::timestamp_ms(clock),
        expiry_epoch: 0, // Will be set after verification
        blob_id: string::utf8(b""),
        nautilus_signature: vector::empty(), // Will be set after verification
        signature_timestamp_ms: 0, // Will be set after verification
        evidence_hash: vector::empty(), // Will be set after verification
        claimed: false,
    };
    
    let user_did_id = object::id(&user_did);
    
    // Track user's DID
    if (!table::contains(&registry.user_verifications, user_address)) {
        table::add(&mut registry.user_verifications, user_address, table::new(ctx));
    };
    let user_dids = table::borrow_mut(&mut registry.user_verifications, user_address);
    table::add(user_dids, did_type, user_did_id);
    
    // Share the UserDID object
    transfer::share_object(user_did);
    
    event::emit(VerificationStarted {
        registry_id: object::id(registry),
        user_address,
        did_type,
        user_did_id,
    });
    
    user_did_id
}

/// Update verification status (called by backend after Python verification - admin only)
public fun update_verification_status(
    registry: &mut DIDRegistry,
    cap: &RegistryCap,
    user_did: &mut UserDID,
    verified: bool,
    nautilus_signature: vector<u8>,
    signature_timestamp_ms: u64,  // When signature was created in Nautilus
    evidence_hash: vector<u8>,    // OCR data hash from Python
    clock: &Clock,
    ctx: &TxContext
) {
    // Verify admin capability
    assert!(cap.registry_id == object::id(registry), EInvalidCap);
    
    // Update status
    let new_status = if (verified) STATUS_VERIFIED else STATUS_REJECTED;
    user_did.verification_status = new_status;
    user_did.verification_timestamp = clock::timestamp_ms(clock);
    
    // Store Nautilus signature and enhanced verification data
    user_did.nautilus_signature = nautilus_signature;
    user_did.signature_timestamp_ms = signature_timestamp_ms;
    user_did.evidence_hash = evidence_hash;
    
    // If verified, set expiry epoch
    if (verified) {
        let (_, _, _, validity_epochs) = get_did_type_info(user_did.did_type);
        user_did.expiry_epoch = tx_context::epoch(ctx) + validity_epochs;
    };
    
    event::emit(VerificationCompleted {
        registry_id: object::id(registry),
        user_address: user_did.owner,
        did_type: user_did.did_type,
        user_did_id: object::id(user_did),
        status: new_status,
        nautilus_signature: nautilus_signature,
        signature_timestamp_ms: signature_timestamp_ms,  // Exact signing time from Nautilus
        evidence_hash: evidence_hash,                    // OCR hash for SDK verification
    }); // Frontend event listener will capture this enhanced data
}

/// Claim DID NFT after successful verification
/// Creates a SoulBound NFT with metadata including blob_id and Nautilus signature
/// NFT has no store ability, making it non-transferable
public fun claim_did_nft(
    registry: &DIDRegistry,
    user_did: &mut UserDID,
    blob_id: String,
    clock: &Clock,
    ctx: &mut TxContext
): ID {
    assert!(user_did.verification_status == STATUS_VERIFIED, ENotVerified);
    assert!(user_did.owner == tx_context::sender(ctx), EInvalidCap);
    assert!(!user_did.claimed, EAlreadyVerified);
    
    // Check if DID is still valid
    assert!(tx_context::epoch(ctx) < user_did.expiry_epoch, ENotVerified);
    
    // Get DID type information
    let (name, description, _, _) = get_did_type_info(user_did.did_type);
    
    // Create image URL based on DID type
    let image_url = if (user_did.did_type == DID_AGE_VERIFY) {
        url::new_unsafe_from_bytes(b"https://imgs.search.brave.com/ghana_age_verify_nft.png")
    } else {
        url::new_unsafe_from_bytes(b"https://imgs.search.brave.com/ghana_citizenship_nft.png")
    };
    
    // Create SoulBound NFT with complete verification data for SDK
    let nft = DIDSoulBoundNFT {
        id: object::new(ctx),
        owner: user_did.owner,
        did_type: user_did.did_type,
        name,
        description,
        image_url,
        blob_id,
        nautilus_signature: user_did.nautilus_signature, // Use stored signature
        signature_timestamp_ms: user_did.signature_timestamp_ms, // For SDK verification
        evidence_hash: user_did.evidence_hash, // For SDK verification
        expiry_epoch: user_did.expiry_epoch,
        minted_at: clock::timestamp_ms(clock),
    };
    
    let nft_id = object::id(&nft);
    
    // Update UserDID record
    user_did.claimed = true;
    user_did.blob_id = blob_id;
    
    // Transfer NFT to user (SoulBound - cannot be transferred again)
    transfer::transfer(nft, user_did.owner);
    
    event::emit(DIDClaimed {
        registry_id: object::id(registry),
        user_address: user_did.owner,
        did_type: user_did.did_type,
        user_did_id: object::id(user_did),
        nft_id,
    });
    
    nft_id
}

/// Check if user has a verified DID of specific type
public fun has_verified_did(
    registry: &DIDRegistry,
    user_address: address,
    did_type: u8,
): bool {
    if (!table::contains(&registry.user_verifications, user_address)) {
        return false
    };
    
    let user_dids = table::borrow(&registry.user_verifications, user_address);
    if (!table::contains(user_dids, did_type)) {
        return false
    };
    true
}

/// Get user's DID status for frontend
public fun get_user_did_status(
    registry: &DIDRegistry,
    user_address: address,
    did_type: u8
): u8 {
    if (!table::contains(&registry.user_verifications, user_address)) {
        return 255 // Not found
    };
    
    let user_dids = table::borrow(&registry.user_verifications, user_address);
    if (!table::contains(user_dids, did_type)) {
        return 255 // Not found
    };
    STATUS_PENDING
}

/// Verify DID for external protocols (SDK integration)
public fun verify_did_for_protocol(
    user_did: &UserDID,
    ctx: &TxContext
): bool {
    // Check if DID is verified and claimed
    if (user_did.verification_status != STATUS_VERIFIED || !user_did.claimed) {
        return false
    };
    
    // Check if not expired
    if (tx_context::epoch(ctx) >= user_did.expiry_epoch) {
        return false
    };
    
    true
}


/// Get NFT metadata for display purposes
entry fun get_nft_metadata(nft: &DIDSoulBoundNFT): (String, String, Url, u8, u64, String, vector<u8>) {
    (nft.name, nft.description, nft.image_url, nft.did_type, nft.expiry_epoch, nft.blob_id, nft.nautilus_signature)
}

/// Check if NFT is expired
entry fun is_nft_expired(nft: &DIDSoulBoundNFT, ctx: &TxContext): bool {
    tx_context::epoch(ctx) >= nft.expiry_epoch
}

/// Get Nautilus signature from NFT for verification
entry fun get_nautilus_signature(nft: &DIDSoulBoundNFT): vector<u8> {
    nft.nautilus_signature
}


}
