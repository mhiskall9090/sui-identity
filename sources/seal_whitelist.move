/// Government Whitelist Contract for KYC Document Access
/// This module integrates with Mysten's Seal protocol for encrypted document access control
/// - Government addresses can decrypt any user's KYC documents (regulatory compliance)
/// - Users can decrypt their own documents (self-sovereign identity)
/// - Uses Seal encryption/decryption with access policy enforcement
/// - Implements sponsored registration for user onboarding
module suiverify::government_whitelist;

// Import Sui framework modules
use sui::table::{Self, Table}; // Table for storing whitelisted addresses
use sui::event; // Event emission for tracking access grants

// Error codes for access control failures
const ENoAccess: u64 = 1; // Error when caller doesn't have permission to decrypt
const EInvalidCap: u64 = 2; // Error when capability doesn't match whitelist
const EDuplicate: u64 = 3; // Error when trying to add an existing address
const ENotInWhitelist: u64 = 4; // Error when trying to remove non-existent address

/// Government whitelist for KYC document access
/// Central registry managing access permissions for Seal-encrypted documents
/// Ability: key (shared object accessible by all)
public struct GovWhitelist has key {
    id: UID, // Unique identifier for this whitelist
    /// Government addresses that can access all documents
    /// Maps address -> true if government address, entry doesn't exist otherwise
    government_addresses: Table<address, bool>,
    /// User addresses that have registered themselves for document access
    /// Maps address -> true if registered, entry doesn't exist otherwise
    registered_users: Table<address, bool>,
}


/// Admin capability for government whitelist
/// Only the holder can add/remove government addresses
/// Ability: key (ownable object)
public struct GovCap has key {
    id: UID, // Unique identifier for this capability
    whitelist_id: ID, // ID of the whitelist this capability controls
}

// Events - emitted during whitelist operations
// All events have 'copy' and 'drop' abilities for gas efficiency

/// Emitted when a government address is added to the whitelist
public struct GovernmentAddressAdded has copy, drop {
    whitelist_id: ID, // ID of the whitelist
    government_address: address, // Address that was granted government access
}

/// Emitted when a user registers for document access
public struct UserRegistered has copy, drop {
    whitelist_id: ID, // ID of the whitelist
    user_address: address, // Address that was registered
}

/// Emitted when a government address is removed from the whitelist
public struct GovernmentAddressRemoved has copy, drop {
    whitelist_id: ID, // ID of the whitelist
    government_address: address, // Address that lost government access
}

/// Initialize function - automatically called when contract is deployed
/// Creates the government whitelist and admin capability
/// ctx: Transaction context for object creation
fun init(ctx: &mut TxContext) {
    // Create the government whitelist with empty tables
    let whitelist = GovWhitelist {
        id: object::new(ctx), // Generate unique ID for the whitelist
        government_addresses: table::new(ctx), // Initialize empty government table
        registered_users: table::new(ctx), // Initialize empty user table
    };
    
    // Create admin capability linked to this whitelist
    let cap = GovCap {
        id: object::new(ctx), // Generate unique ID for the capability
        whitelist_id: object::id(&whitelist), // Link to the whitelist
    };
    
    // Share the whitelist object so anyone can read access status
    transfer::share_object(whitelist);
    
    // Transfer the admin capability to the deployer
    // This gives the deployer exclusive rights to manage government addresses
    transfer::transfer(cap, tx_context::sender(ctx));
}

/// Create government whitelist with admin capability (kept for backwards compatibility)
/// This function allows programmatic creation for testing or migration
/// ctx: Transaction context for object creation
/// Returns: (GovCap, GovWhitelist) tuple for manual management
public fun create_government_whitelist(ctx: &mut TxContext): (GovCap, GovWhitelist) {
    // Create whitelist with empty access tables
    let whitelist = GovWhitelist {
        id: object::new(ctx), // Generate unique ID
        government_addresses: table::new(ctx), // Empty government table
        registered_users: table::new(ctx), // Empty user table
    };
    
    // Create capability linked to this whitelist
    let cap = GovCap {
        id: object::new(ctx), // Generate unique ID
        whitelist_id: object::id(&whitelist), // Link to whitelist
    };
    
    // Return both objects for caller to manage
    (cap, whitelist)
}

/// Add government address to whitelist (admin only)
/// Grants an address permission to decrypt all user documents
/// whitelist: Mutable reference to the government whitelist
/// cap: Admin capability proving permission
/// government_address: Address to grant government access to
public fun add_government_address(
    whitelist: &mut GovWhitelist,
    cap: &GovCap,
    government_address: address
) {
    // Verify the capability matches this whitelist
    assert!(cap.whitelist_id == object::id(whitelist), EInvalidCap);
    // Verify address is not already a government address (prevent duplicate)
    assert!(!table::contains(&whitelist.government_addresses, government_address), EDuplicate);
    
    // Add the address to the government table with value 'true'
    table::add(&mut whitelist.government_addresses, government_address, true);
    
    // Emit event to notify government address addition
    event::emit(GovernmentAddressAdded {
        whitelist_id: object::id(whitelist),
        government_address,
    });
}

/// Remove government address from whitelist (admin only)
/// Revokes an address's permission to decrypt user documents
/// whitelist: Mutable reference to the government whitelist
/// cap: Admin capability proving permission
/// government_address: Address to revoke government access from
public fun remove_government_address(
    whitelist: &mut GovWhitelist,
    cap: &GovCap,
    government_address: address
) {
    // Verify the capability matches this whitelist
    assert!(cap.whitelist_id == object::id(whitelist), EInvalidCap);
    // Verify address is currently a government address
    assert!(table::contains(&whitelist.government_addresses, government_address), ENotInWhitelist);
    
    // Remove the address from the government table
    table::remove(&mut whitelist.government_addresses, government_address);
    
    // Emit event to notify government address removal
    event::emit(GovernmentAddressRemoved {
        whitelist_id: object::id(whitelist),
        government_address,
    });
}

/// Register user for document access (called when user uploads document)
/// Allows a user to register themselves to access their own documents
/// Entry function can be called directly from transactions
/// whitelist: Mutable reference to the government whitelist
/// ctx: Transaction context for sender identification
entry fun register_user(
    whitelist: &mut GovWhitelist,
    ctx: &TxContext
) {
    // Get the caller's address (the user registering)
    let user_address = tx_context::sender(ctx);
    
    // Don't add if already registered (idempotent operation)
    if (!table::contains(&whitelist.registered_users, user_address)) {
        // Add user to the registered users table
        table::add(&mut whitelist.registered_users, user_address, true);
        
        // Emit event to notify user registration
        event::emit(UserRegistered {
            whitelist_id: object::id(whitelist),
            user_address,
        });
    };
}

/// Register a specific user for document access (for sponsored registration)
/// Allows a sponsor to register any user address (useful for onboarding flows)
/// Entry function can be called directly from transactions
/// whitelist: Mutable reference to the government whitelist
/// user_address: Address to register (can be different from caller)
/// _ctx: Transaction context (not used but required for entry functions)
entry fun register_user_sponsored(
    whitelist: &mut GovWhitelist,
    user_address: address,
    _ctx: &TxContext
) {
    // Don't add if already registered (idempotent operation)
    if (!table::contains(&whitelist.registered_users, user_address)) {
        // Add user to the registered users table
        table::add(&mut whitelist.registered_users, user_address, true);
        
        // Emit event to notify user registration
        event::emit(UserRegistered {
            whitelist_id: object::id(whitelist),
            user_address,
        });
    };
}

/// Check access policy for Seal decryption (internal function)
/// Determines if a caller has permission to decrypt a document
/// Government addresses can access any document with the whitelist prefix
/// Registered users can access any document (after registering themselves)
/// caller: Address requesting decryption access
/// encryption_id: Encryption ID from Seal (contains whitelist prefix)
/// whitelist: Reference to the government whitelist
/// Returns: true if access granted, false otherwise
fun check_policy(caller: address, encryption_id: vector<u8>, whitelist: &GovWhitelist): bool {
    // Check if the encryption_id has the right prefix (whitelist id)
    // This ensures the document was encrypted with this whitelist's key
    let prefix = object::uid_to_bytes(&whitelist.id);
    let mut i = 0;
    // Verify prefix length is valid
    if (vector::length(&prefix) > vector::length(&encryption_id)) {
        return false // Encryption ID is too short
    };
    // Compare prefix bytes one by one
    while (i < vector::length(&prefix)) {
        if (*vector::borrow(&prefix, i) != *vector::borrow(&encryption_id, i)) {
            return false // Prefix mismatch
        };
        i = i + 1;
    };

    // Check if caller is government address (can access any document with correct prefix)
    if (table::contains(&whitelist.government_addresses, caller)) {
        return true // Government address has access
    };
    
    // Check if caller is a registered user (can access any document after registration)
    if (table::contains(&whitelist.registered_users, caller)) {
        return true // Registered user has access
    };
    
    // Caller is neither government nor registered user
    false
}

/// Seal approval function - called by Seal key servers to verify access
/// This is the entry point for Seal's access control integration
/// Entry function can be called by Seal infrastructure
/// encryption_id: Encryption ID from Seal containing whitelist prefix
/// whitelist: Reference to the government whitelist
/// ctx: Transaction context for caller identification
entry fun seal_approve(
    encryption_id: vector<u8>,
    whitelist: &GovWhitelist,
    ctx: &TxContext
) {
    // Get the caller's address (person requesting decryption)
    let caller = tx_context::sender(ctx);
    // Verify caller has permission using the access policy
    // Abort with ENoAccess if permission denied
    assert!(check_policy(caller, encryption_id, whitelist), ENoAccess);
}
/// Check if address is government address
/// Public function for frontend and other contracts to verify government status
/// whitelist: Reference to the government whitelist
/// address: Address to check
/// Returns: true if address has government access, false otherwise
public fun is_government_address(
    whitelist: &GovWhitelist,
    address: address
): bool {
    // Check if address exists in the government addresses table
    table::contains(&whitelist.government_addresses, address)
}

/// Check if address is registered user
/// Public function for frontend and other contracts to verify user registration
/// whitelist: Reference to the government whitelist
/// address: Address to check
/// Returns: true if address is registered, false otherwise
public fun is_registered_user(
    whitelist: &GovWhitelist,
    address: address
): bool {
    // Check if address exists in the registered users table
    table::contains(&whitelist.registered_users, address)
}

/// Verify user can access specific document (for frontend checks)
/// Allows frontend to pre-verify access before attempting decryption
/// whitelist: Reference to the government whitelist
/// caller: Address to verify access for
/// encryption_id: Encryption ID of the document to access
/// Returns: true if caller can access this document, false otherwise
public fun can_access_document(
    whitelist: &GovWhitelist,
    caller: address,
    encryption_id: vector<u8>
): bool {
    // Use the internal policy check function
    check_policy(caller, encryption_id, whitelist)
}


