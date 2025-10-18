/// Payment Module - Handles protocol registration, vaults, and NFT settlement payments
/// This module manages the economic layer of the SuiVerify system
/// - Protocols register and deposit funds into vaults
/// - Protocols pay settlement fees when verifying user DIDs
/// - Fees are collected into SuiVerify treasury
/// - Supports one-time NFT settlement payments to prevent double-charging
module suiverify::payment;

// Import Sui framework modules for payment handling
use sui::table::{Self, Table}; // Table for key-value mappings
use sui::balance::{Self, Balance}; // Balance for holding coins
use sui::coin::{Self, Coin}; // Coin for transferring SUI tokens
use sui::sui::SUI; // SUI token type
use sui::event; // Event emission for frontend notifications
use sui::clock::{Self, Clock}; // Clock for timestamps
use std::string::String; // String for protocol names 

// Error codes for payment-related failures
const EInvalidProtocol: u64 = 1; // Error when protocol doesn't exist or unauthorized
const EInsufficientFunds: u64 = 2; // Error when vault doesn't have enough balance
const EAlreadySettled: u64 = 3; // Error when trying to settle an NFT twice
const EInvalidAmount: u64 = 4; // Error when amount is below minimum requirements
const EProtocolExists: u64 = 5; // Error when trying to register an existing protocol

// Constants for payment amounts (in MIST, 1 SUI = 1,000,000,000 MIST)
const MIN_VAULT_AMOUNT: u64 = 5_000_000_000; // 5 SUI minimum to register a protocol
const SETTLEMENT_FEE: u64 = 10_000_000_000; // 10 SUI per NFT verification settlement

/// Protocol vault for storing funds
/// Each registered protocol has its own vault to pay for verification settlements
/// Abilities: key (can be owned/shared), store (can be stored)
public struct ProtocolVault has key, store {
    id: UID, // Unique identifier for this vault
    protocol_name: String, // Human-readable name of the protocol
    protocol_address: address, // Sui address of the protocol owner
    balance: Balance<SUI>, // SUI token balance held in this vault
    created_at: u64, // Timestamp when vault was created
    total_settlements: u64, // Count of NFT settlements processed
}

/// Main payment registry
/// Central registry tracking all protocol vaults and NFT settlements
/// Ability: key (shared object accessible by all)
public struct PaymentRegistry has key {
    id: UID, // Unique identifier for this registry
    /// Protocol vaults: maps protocol_address -> ProtocolVault_ID
    /// Allows O(1) lookup of a protocol's vault
    protocol_vaults: Table<address, ID>,
    /// NFT settlement tracking: maps nft_id -> bool (true if settled)
    /// Prevents double-charging for the same NFT verification
    nft_settlements: Table<ID, bool>,
    /// SuiVerify treasury vault - collects all settlement fees
    suiverify_vault: Balance<SUI>,
    /// Total protocols registered in the system
    total_protocols: u64,
    /// Total settlements processed across all protocols
    total_settlements: u64,
}

/// Admin capability for payment registry
/// Only the holder can withdraw from the SuiVerify treasury
/// Ability: key (ownable object)
public struct PaymentCap has key {
    id: UID, // Unique identifier for this capability
    registry_id: ID, // ID of the registry this capability controls
}

// Events - emitted during payment operations to notify indexers and frontend
// All events have 'copy' and 'drop' abilities for gas efficiency

/// Emitted when a protocol registers and creates a vault
public struct ProtocolRegistered has copy, drop {
    protocol_address: address, // Address of the registered protocol
    protocol_name: String, // Name of the protocol
    vault_id: ID, // ID of the created vault object
    initial_amount: u64, // Initial funding amount in MIST
    timestamp: u64, // When registration occurred
}

/// Emitted when a protocol adds funds to their vault
public struct VaultFunded has copy, drop {
    protocol_address: address, // Address of the protocol
    amount: u64, // Amount added in MIST
    new_balance: u64, // Total vault balance after funding
    timestamp: u64, // When funding occurred
}

/// Emitted when an NFT settlement is processed
/// This is the key event for tracking verification payments
public struct NFTSettled has copy, drop {
    protocol_address: address, // Protocol that paid for the settlement
    nft_id: ID, // ID of the NFT that was verified
    settlement_amount: u64, // Amount paid (SETTLEMENT_FEE)
    timestamp: u64, // When settlement occurred
}

/// Emitted when admin withdraws from SuiVerify treasury
public struct TreasuryWithdrawal has copy, drop {
    amount: u64, // Amount withdrawn in MIST
    withdrawn_to: address, // Address that received the funds
    timestamp: u64, // When withdrawal occurred
}

/// Initialize payment registry - automatically called when module is published
/// Creates the payment registry and admin capability
/// ctx: Transaction context for object creation
fun init(ctx: &mut TxContext) {
    // Create the main payment registry with empty tables and zero balance
    let registry = PaymentRegistry {
        id: object::new(ctx), // Generate unique ID for the registry
        protocol_vaults: table::new(ctx), // Initialize empty protocol vaults table
        nft_settlements: table::new(ctx), // Initialize empty settlements table
        suiverify_vault: balance::zero(), // Initialize treasury with zero balance
        total_protocols: 0, // Start with zero registered protocols
        total_settlements: 0, // Start with zero settlements
    };
    
    // Create admin capability for treasury management
    let cap = PaymentCap {
        id: object::new(ctx), // Generate unique ID for the capability
        registry_id: object::id(&registry), // Link capability to registry
    };
    
    // Share the registry so all protocols can access it
    transfer::share_object(registry);
    // Transfer admin capability to the deployer
    transfer::transfer(cap, tx_context::sender(ctx));
}

/// Register protocol and create vault with minimum funding
/// Entry function protocols call to register themselves
/// registry: Mutable reference to the payment registry
/// protocol_name: Human-readable name for the protocol
/// initial_funding: Coin with at least MIN_VAULT_AMOUNT SUI
/// clock: Shared clock for timestamps
/// ctx: Transaction context for sender and object creation
entry fun register_protocol(
    registry: &mut PaymentRegistry,
    protocol_name: String,
    initial_funding: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Get the caller's address (the protocol being registered)
    let protocol_address = tx_context::sender(ctx);
    
    // Check protocol doesn't already exist to prevent duplicate registration
    assert!(!table::contains(&registry.protocol_vaults, protocol_address), EProtocolExists);
    
    // Check minimum funding requirement is met
    let funding_amount = coin::value(&initial_funding);
    assert!(funding_amount >= MIN_VAULT_AMOUNT, EInvalidAmount);
    
    // Create protocol vault with initial funding
    let vault = ProtocolVault {
        id: object::new(ctx), // Generate unique ID for the vault
        protocol_name, // Store protocol name
        protocol_address, // Store protocol address
        balance: coin::into_balance(initial_funding), // Convert coin to balance
        created_at: clock::timestamp_ms(clock), // Record creation time
        total_settlements: 0, // Start with zero settlements
    };
    
    // Get vault ID before moving the object
    let vault_id = object::id(&vault);
    
    // Register vault in the protocol vaults table
    table::add(&mut registry.protocol_vaults, protocol_address, vault_id);
    // Increment total protocols counter
    registry.total_protocols = registry.total_protocols + 1;
    
    // Share the vault object so it can be accessed and funded
    transfer::share_object(vault);
    
    // Emit event to notify protocol registration
    event::emit(ProtocolRegistered {
        protocol_address,
        protocol_name,
        vault_id,
        initial_amount: funding_amount,
        timestamp: clock::timestamp_ms(clock),
    });
}

/// Add funds to protocol vault
/// Allows protocols to top up their vault balance for future settlements
/// _registry: Reference to registry (for validation, not modified)
/// vault: Mutable reference to the protocol's vault
/// funding: Coin with SUI to add to vault
/// clock: Shared clock for timestamps
/// ctx: Transaction context for sender verification
entry fun fund_vault(
    _registry: &PaymentRegistry,
    vault: &mut ProtocolVault,
    funding: Coin<SUI>,
    clock: &Clock,
    ctx: &TxContext,
) {
    // Get the caller's address
    let protocol_address = tx_context::sender(ctx);
    
    // Verify sender owns this vault (only owner can fund their vault)
    assert!(vault.protocol_address == protocol_address, EInvalidProtocol);
    
    // Get funding amount before consuming the coin
    let funding_amount = coin::value(&funding);
    // Add the funding to the vault balance
    balance::join(&mut vault.balance, coin::into_balance(funding));
    
    // Get the new total balance after funding
    let new_balance = balance::value(&vault.balance);
    
    // Emit event to notify vault funding
    event::emit(VaultFunded {
        protocol_address,
        amount: funding_amount,
        new_balance,
        timestamp: clock::timestamp_ms(clock),
    });
}

/// Settle NFT payment - called by protocol after SDK verification returns true
/// This is the key function called when DID verification is successful
/// Protocol pays SETTLEMENT_FEE which goes to SuiVerify treasury
/// registry: Mutable reference to the payment registry
/// vault: Mutable reference to the protocol's vault
/// nft_id: ID of the NFT that was verified successfully
/// clock: Shared clock for timestamps
/// ctx: Transaction context for sender verification
entry fun settle_nft_payment(
    registry: &mut PaymentRegistry,
    vault: &mut ProtocolVault,
    nft_id: ID,
    clock: &Clock,
    ctx: &TxContext,
) {
    // Get the caller's address
    let protocol_address = tx_context::sender(ctx);
    
    // Verify sender owns this vault (only vault owner can settle)
    assert!(vault.protocol_address == protocol_address, EInvalidProtocol);
    
    // Check if NFT already settled to prevent double-charging
    if (table::contains(&registry.nft_settlements, nft_id)) {
        // NFT exists in settlements table, check it's not already settled
        assert!(!*table::borrow(&registry.nft_settlements, nft_id), EAlreadySettled);
    } else {
        // NFT not in table yet, add it with false (not settled)
        table::add(&mut registry.nft_settlements, nft_id, false);
    };
    
    // Check vault has sufficient balance to pay settlement fee
    assert!(balance::value(&vault.balance) >= SETTLEMENT_FEE, EInsufficientFunds);
    
    // Transfer settlement fee from protocol vault to SuiVerify treasury
    let settlement = balance::split(&mut vault.balance, SETTLEMENT_FEE);
    balance::join(&mut registry.suiverify_vault, settlement);
    
    // Mark NFT as settled (true) to prevent future settlements
    *table::borrow_mut(&mut registry.nft_settlements, nft_id) = true;
    
    // Update settlement counters
    vault.total_settlements = vault.total_settlements + 1; // Increment vault counter
    registry.total_settlements = registry.total_settlements + 1; // Increment global counter
    
    // Emit event to notify NFT settlement
    event::emit(NFTSettled {
        protocol_address,
        nft_id,
        settlement_amount: SETTLEMENT_FEE,
        timestamp: clock::timestamp_ms(clock),
    });
}

/// Check if NFT has been settled (one-time payment check)
/// Used to verify if a settlement payment was already made for an NFT
/// registry: Reference to the payment registry
/// nft_id: ID of the NFT to check
/// Returns: true if NFT has been settled, false otherwise
public fun is_nft_settled(
    registry: &PaymentRegistry,
    nft_id: ID,
): bool {
    // Check if NFT exists in the settlements table
    if (table::contains(&registry.nft_settlements, nft_id)) {
        // Return the settlement status (true if settled)
        *table::borrow(&registry.nft_settlements, nft_id)
    } else {
        // NFT not in table means never settled
        false
    }
}

/// Get protocol vault balance
/// Returns the current SUI balance in a protocol's vault
/// vault: Reference to the protocol vault
/// Returns: Balance in MIST (1 SUI = 1,000,000,000 MIST)
public fun get_vault_balance(vault: &ProtocolVault): u64 {
    balance::value(&vault.balance) // Return balance value
}

/// Get protocol vault info
/// Returns comprehensive information about a protocol vault
/// vault: Reference to the protocol vault
/// Returns: (name, address, balance, created_at, total_settlements)
public fun get_vault_info(vault: &ProtocolVault): (String, address, u64, u64, u64) {
    (
        vault.protocol_name, // Protocol name
        vault.protocol_address, // Protocol owner address
        balance::value(&vault.balance), // Current balance in MIST
        vault.created_at, // Creation timestamp
        vault.total_settlements // Number of settlements processed
    )
}

/// Check if protocol is registered
/// Verifies whether a protocol address has been registered
/// registry: Reference to the payment registry
/// protocol_address: Address to check
/// Returns: true if protocol is registered, false otherwise
public fun is_protocol_registered(
    registry: &PaymentRegistry,
    protocol_address: address,
): bool {
    // Check if address exists in the protocol vaults table
    table::contains(&registry.protocol_vaults, protocol_address)
}

/// Get registry stats
/// Returns overall statistics about the payment system
/// registry: Reference to the payment registry
/// Returns: (total_protocols, total_settlements, treasury_balance)
public fun get_registry_stats(registry: &PaymentRegistry): (u64, u64, u64) {
    (
        registry.total_protocols, // Number of registered protocols
        registry.total_settlements, // Total settlements processed
        balance::value(&registry.suiverify_vault) // Treasury balance in MIST
    )
}

/// Withdraw from SuiVerify treasury (admin only)
/// Allows admin to withdraw collected settlement fees
/// registry: Mutable reference to the payment registry
/// cap: Admin capability proving permission
/// amount: Amount to withdraw in MIST
/// clock: Shared clock for timestamps
/// ctx: Transaction context for sender info
/// Returns: Coin<SUI> with the withdrawn amount
public fun withdraw_treasury(
    registry: &mut PaymentRegistry,
    cap: &PaymentCap,
    amount: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): Coin<SUI> {
    // Verify the capability matches this registry
    assert!(cap.registry_id == object::id(registry), EInvalidProtocol);
    
    // Split the requested amount from the treasury balance
    let withdrawn = balance::split(&mut registry.suiverify_vault, amount);
    
    // Emit event to notify treasury withdrawal
    event::emit(TreasuryWithdrawal {
        amount,
        withdrawn_to: tx_context::sender(ctx),
        timestamp: clock::timestamp_ms(clock),
    });
    
    // Convert balance to coin and return it
    coin::from_balance(withdrawn, ctx)
}

/// Emergency withdraw from protocol vault (protocol owner only)
/// Allows protocol owner to withdraw funds from their vault
/// vault: Mutable reference to the protocol vault
/// amount: Amount to withdraw in MIST
/// ctx: Transaction context for owner verification
/// Returns: Coin<SUI> with the withdrawn amount
public fun emergency_withdraw_vault(
    vault: &mut ProtocolVault,
    amount: u64,
    ctx: &mut TxContext,
): Coin<SUI> {
    // Get the caller's address
    let protocol_address = tx_context::sender(ctx);
    // Verify caller is the vault owner
    assert!(vault.protocol_address == protocol_address, EInvalidProtocol);
    
    // Split the requested amount from the vault balance
    let withdrawn = balance::split(&mut vault.balance, amount);
    // Convert balance to coin and return it
    coin::from_balance(withdrawn, ctx)
}

}
