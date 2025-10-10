/// module handling protocol registration, vaults, and NFT settlements
module suiverify::payment {

use sui::table::{Self, Table};
use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::event;
use sui::clock::{Self, Clock};
use std::string::String;

// Error codes
const EInvalidProtocol: u64 = 1;
const EInsufficientFunds: u64 = 2;
const EAlreadySettled: u64 = 3;
const EInvalidAmount: u64 = 4;
const EProtocolExists: u64 = 5;

// Constant
const MIN_VAULT_AMOUNT: u64 = 5_000_000_000; // 5 SUI minimum
const SETTLEMENT_FEE: u64 = 10_000_000_000;  // 10 SUI per NFT

/// Protocol vault for storing funds
public struct ProtocolVault has key, store {
    id: UID,
    protocol_name: String,
    protocol_address: address,
    balance: Balance<SUI>,
    created_at: u64,
    total_settlements: u64,
}

/// Main payment registry
public struct PaymentRegistry has key {
    id: UID,
    /// Protocol vaults: protocol_address -> ProtocolVault_ID
    protocol_vaults: Table<address, ID>,
    /// NFT settlement tracking: nft_id -> bool (settled or not)
    nft_settlements: Table<ID, bool>,
    /// SuiVerify treasury vault
    suiverify_vault: Balance<SUI>,
    /// Total protocols registered
    total_protocols: u64,
    /// Total settlements processed
    total_settlements: u64,
}

/// Admin capability
public struct PaymentCap has key {
    id: UID,
    registry_id: ID,
}

// Events
public struct ProtocolRegistered has copy, drop {
    protocol_address: address,
    protocol_name: String,
    vault_id: ID,
    initial_amount: u64,
    timestamp: u64,
}

public struct VaultFunded has copy, drop {
    protocol_address: address,
    amount: u64,
    new_balance: u64,
    timestamp: u64,
}

public struct NFTSettled has copy, drop {
    protocol_address: address,
    nft_id: ID,
    settlement_amount: u64,
    timestamp: u64,
}

public struct TreasuryWithdrawal has copy, drop {
    amount: u64,
    withdrawn_to: address,
    timestamp: u64,
}

/// Initialize payment registry
fun init(ctx: &mut TxContext) {
    let registry = PaymentRegistry {
        id: object::new(ctx),
        protocol_vaults: table::new(ctx),
        nft_settlements: table::new(ctx),
        suiverify_vault: balance::zero(),
        total_protocols: 0,
        total_settlements: 0,
    };
    
    let cap = PaymentCap {
        id: object::new(ctx),
        registry_id: object::id(&registry),
    };
    
    transfer::share_object(registry);
    transfer::transfer(cap, tx_context::sender(ctx));
}

/// Register protocol and create vault with minimum funding
entry fun register_protocol(
    registry: &mut PaymentRegistry,
    protocol_name: String,
    initial_funding: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let protocol_address = tx_context::sender(ctx);
    
    // Check protocol doesn't already exist
    assert!(!table::contains(&registry.protocol_vaults, protocol_address), EProtocolExists);
    
    // Check minimum funding
    let funding_amount = coin::value(&initial_funding);
    assert!(funding_amount >= MIN_VAULT_AMOUNT, EInvalidAmount);
    
    // Create protocol vault
    let vault = ProtocolVault {
        id: object::new(ctx),
        protocol_name,
        protocol_address,
        balance: coin::into_balance(initial_funding),
        created_at: clock::timestamp_ms(clock),
        total_settlements: 0,
    };
    
    let vault_id = object::id(&vault);
    
    // Register vault in registry
    table::add(&mut registry.protocol_vaults, protocol_address, vault_id);
    registry.total_protocols = registry.total_protocols + 1;
    
    // Share the vault object
    transfer::share_object(vault);
    
    event::emit(ProtocolRegistered {
        protocol_address,
        protocol_name,
        vault_id,
        initial_amount: funding_amount,
        timestamp: clock::timestamp_ms(clock),
    });
}

/// Add funds to protocol vault
entry fun fund_vault(
    _registry: &PaymentRegistry,
    vault: &mut ProtocolVault,
    funding: Coin<SUI>,
    clock: &Clock,
    ctx: &TxContext,
) {
    let protocol_address = tx_context::sender(ctx);
    
    // Verify sender owns this vault
    assert!(vault.protocol_address == protocol_address, EInvalidProtocol);
    
    let funding_amount = coin::value(&funding);
    balance::join(&mut vault.balance, coin::into_balance(funding));
    
    let new_balance = balance::value(&vault.balance);
    
    event::emit(VaultFunded {
        protocol_address,
        amount: funding_amount,
        new_balance,
        timestamp: clock::timestamp_ms(clock),
    });
}

/// Settle NFT payment - called by protocol after SDK verification returns true
/// This is the key function called when verification is successful
entry fun settle_nft_payment(
    registry: &mut PaymentRegistry,
    vault: &mut ProtocolVault,
    nft_id: ID,
    clock: &Clock,
    ctx: &TxContext,
) {
    let protocol_address = tx_context::sender(ctx);
    
    // Verify sender owns this vault
    assert!(vault.protocol_address == protocol_address, EInvalidProtocol);
    
    // Check if NFT already settled
    if (table::contains(&registry.nft_settlements, nft_id)) {
        assert!(!*table::borrow(&registry.nft_settlements, nft_id), EAlreadySettled);
    } else {
        table::add(&mut registry.nft_settlements, nft_id, false);
    };
    
    // Check vault has sufficient balance
    assert!(balance::value(&vault.balance) >= SETTLEMENT_FEE, EInsufficientFunds);
    
    // Transfer settlement fee from protocol vault to SuiVerify vault
    let settlement = balance::split(&mut vault.balance, SETTLEMENT_FEE);
    balance::join(&mut registry.suiverify_vault, settlement);
    
    // Mark NFT as settled
    *table::borrow_mut(&mut registry.nft_settlements, nft_id) = true;
    
    // Update counters
    vault.total_settlements = vault.total_settlements + 1;
    registry.total_settlements = registry.total_settlements + 1;
    
    event::emit(NFTSettled {
        protocol_address,
        nft_id,
        settlement_amount: SETTLEMENT_FEE,
        timestamp: clock::timestamp_ms(clock),
    });
}

/// Check if NFT has been settled (one-time payment check)
public fun is_nft_settled(
    registry: &PaymentRegistry,
    nft_id: ID,
): bool {
    if (table::contains(&registry.nft_settlements, nft_id)) {
        *table::borrow(&registry.nft_settlements, nft_id)
    } else {
        false
    }
}

/// Get protocol vault balance
public fun get_vault_balance(vault: &ProtocolVault): u64 {
    balance::value(&vault.balance)
}

/// Get protocol vault info
public fun get_vault_info(vault: &ProtocolVault): (String, address, u64, u64, u64) {
    (
        vault.protocol_name,
        vault.protocol_address,
        balance::value(&vault.balance),
        vault.created_at,
        vault.total_settlements
    )
}

/// Check if protocol is registered
public fun is_protocol_registered(
    registry: &PaymentRegistry,
    protocol_address: address,
): bool {
    table::contains(&registry.protocol_vaults, protocol_address)
}

/// Get registry stats
public fun get_registry_stats(registry: &PaymentRegistry): (u64, u64, u64) {
    (
        registry.total_protocols,
        registry.total_settlements,
        balance::value(&registry.suiverify_vault)
    )
}

/// Withdraw from SuiVerify treasury (admin only)
public fun withdraw_treasury(
    registry: &mut PaymentRegistry,
    cap: &PaymentCap,
    amount: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): Coin<SUI> {
    assert!(cap.registry_id == object::id(registry), EInvalidProtocol);
    
    let withdrawn = balance::split(&mut registry.suiverify_vault, amount);
    
    event::emit(TreasuryWithdrawal {
        amount,
        withdrawn_to: tx_context::sender(ctx),
        timestamp: clock::timestamp_ms(clock),
    });
    
    coin::from_balance(withdrawn, ctx)
}

/// Emergency withdraw from protocol vault (protocol owner only)
public fun emergency_withdraw_vault(
    vault: &mut ProtocolVault,
    amount: u64,
    ctx: &mut TxContext,
): Coin<SUI> {
    let protocol_address = tx_context::sender(ctx);
    assert!(vault.protocol_address == protocol_address, EInvalidProtocol);
    
    let withdrawn = balance::split(&mut vault.balance, amount);
    coin::from_balance(withdrawn, ctx)
}

}
