/// Government Whitelist Contract for KYC Document Access
/// - Government addresses can decrypt any user's KYC documents
/// - Users can decrypt their own documents
/// - Integrates with Seal for encryption/decryption
module suiverify::government_whitelist {

use sui::table::{Self, Table};
use sui::event;

// Error codes
const ENoAccess: u64 = 1;
const EInvalidCap: u64 = 2;
const EDuplicate: u64 = 3;
const ENotInWhitelist: u64 = 4;

/// Government whitelist for KYC document access
public struct GovWhitelist has key {
    id: UID,
    /// Government addresses that can access all documents
    government_addresses: Table<address, bool>,
    /// User addresses that have registered themselves for document access
    registered_users: Table<address, bool>,
}


/// Admin capability for government whitelist
public struct GovCap has key {
    id: UID,
    whitelist_id: ID,
}

// Events
public struct GovernmentAddressAdded has copy, drop {
    whitelist_id: ID,
    government_address: address,
}

public struct UserRegistered has copy, drop {
    whitelist_id: ID,
    user_address: address,
}

public struct GovernmentAddressRemoved has copy, drop {
    whitelist_id: ID,
    government_address: address,
}



/// Initialize function - automatically called when contract is deployed
/// Creates the government whitelist and transfers objects to deployer
fun init(ctx: &mut TxContext) {
    let whitelist = GovWhitelist {
        id: object::new(ctx),
        government_addresses: table::new(ctx),
        registered_users: table::new(ctx),
    };
    
    let cap = GovCap {
        id: object::new(ctx),
        whitelist_id: object::id(&whitelist),
    };
    
    // Share the whitelist object so anyone can read it
    transfer::share_object(whitelist);
    
    // Transfer the admin capability to the deployer
    transfer::transfer(cap, tx_context::sender(ctx));
}

/// Create government whitelist with admin capability (kept for backwards compatibility)
public fun create_government_whitelist(ctx: &mut TxContext): (GovCap, GovWhitelist) {
    let whitelist = GovWhitelist {
        id: object::new(ctx),
        government_addresses: table::new(ctx),
        registered_users: table::new(ctx),
    };
    
    let cap = GovCap {
        id: object::new(ctx),
        whitelist_id: object::id(&whitelist),
    };
    
    (cap, whitelist)
}

/// Add government address to whitelist (admin only)
public fun add_government_address(
    whitelist: &mut GovWhitelist,
    cap: &GovCap,
    government_address: address
) {
    assert!(cap.whitelist_id == object::id(whitelist), EInvalidCap);
    assert!(!table::contains(&whitelist.government_addresses, government_address), EDuplicate);
    
    table::add(&mut whitelist.government_addresses, government_address, true);
    
    event::emit(GovernmentAddressAdded {
        whitelist_id: object::id(whitelist),
        government_address,
    });
}

/// Remove government address from whitelist (admin only)
public fun remove_government_address(
    whitelist: &mut GovWhitelist,
    cap: &GovCap,
    government_address: address
) {
    assert!(cap.whitelist_id == object::id(whitelist), EInvalidCap);
    assert!(table::contains(&whitelist.government_addresses, government_address), ENotInWhitelist);
    
    table::remove(&mut whitelist.government_addresses, government_address);
    
    event::emit(GovernmentAddressRemoved {
        whitelist_id: object::id(whitelist),
        government_address,
    });
}

/// Register user for document access (called when user uploads document)
entry fun register_user(
    whitelist: &mut GovWhitelist,
    ctx: &TxContext
) {
    let user_address = tx_context::sender(ctx);
    
    // Don't add if already registered
    if (!table::contains(&whitelist.registered_users, user_address)) {
        table::add(&mut whitelist.registered_users, user_address, true);
        
        event::emit(UserRegistered {
            whitelist_id: object::id(whitelist),
            user_address,
        });
    };
}

/// Register a specific user for document access (for sponsored registration)
/// This allows a sponsor to register any user address
entry fun register_user_sponsored(
    whitelist: &mut GovWhitelist,
    user_address: address,
    _ctx: &TxContext
) {
    // Don't add if already registered
    if (!table::contains(&whitelist.registered_users, user_address)) {
        table::add(&mut whitelist.registered_users, user_address, true);
        
        event::emit(UserRegistered {
            whitelist_id: object::id(whitelist),
            user_address,
        });
    };
}

/// Check access policy for Seal decryption
/// Government addresses can access any document with the whitelist prefix
/// Registered users can access any document (after registering themselves)
fun check_policy(caller: address, encryption_id: vector<u8>, whitelist: &GovWhitelist): bool {
    // Check if the encryption_id has the right prefix (whitelist id)
    let prefix = object::uid_to_bytes(&whitelist.id);
    let mut i = 0;
    if (vector::length(&prefix) > vector::length(&encryption_id)) {
        return false
    };
    while (i < vector::length(&prefix)) {
        if (*vector::borrow(&prefix, i) != *vector::borrow(&encryption_id, i)) {
            return false
        };
        i = i + 1;
    };

    // Check if caller is government address (can access any document with correct prefix)
    if (table::contains(&whitelist.government_addresses, caller)) {
        return true
    };
    
    // Check if caller is a registered user (can access any document after registration)
    if (table::contains(&whitelist.registered_users, caller)) {
        return true
    };
    
    false
}

/// Seal approval function - called by Seal key servers to verify access
entry fun seal_approve(
    encryption_id: vector<u8>,
    whitelist: &GovWhitelist,
    ctx: &TxContext
) {
    let caller = tx_context::sender(ctx);
    assert!(check_policy(caller, encryption_id, whitelist), ENoAccess);
}


/// Check if address is government address
public fun is_government_address(
    whitelist: &GovWhitelist,
    address: address
): bool {
    table::contains(&whitelist.government_addresses, address)
}

/// Check if address is registered user
public fun is_registered_user(
    whitelist: &GovWhitelist,
    address: address
): bool {
    table::contains(&whitelist.registered_users, address)
}

/// Verify user can access specific document (for frontend checks)
public fun can_access_document(
    whitelist: &GovWhitelist,
    caller: address,
    encryption_id: vector<u8>
): bool {
    check_policy(caller, encryption_id, whitelist)
}



}
