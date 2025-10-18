/// Enclave Module - Manages AWS Nitro Enclave attestation and verification
/// This module provides secure enclave registration and signature verification using AWS Nitro
/// - Validates enclave configurations using PCR (Platform Configuration Register) values
/// - Registers enclaves with their public keys from attestation documents
/// - Verifies signatures from registered enclaves for trusted execution
module suiverify::enclave;

// Import standard library modules
use std::bcs; // Binary Canonical Serialization for encoding data
use std::string::String; // String type for text handling
// Import Sui framework modules
use sui::ed25519; // Ed25519 signature verification
use sui::nitro_attestation::NitroAttestationDocument; // AWS Nitro attestation document type

// Define helper function to convert attestation document to PCRs
use fun to_pcrs as NitroAttestationDocument.to_pcrs;

// Error codes for different failure scenarios
const EInvalidPCRs: u64 = 0; // Error when PCR values don't match expected configuration
const EInvalidConfigVersion: u64 = 1; // Error when enclave config version is outdated
const EInvalidCap: u64 = 2; // Error when capability doesn't match configuration
const EInvalidOwner: u64 = 3; // Error when caller is not the enclave owner

// PCR0: Enclave image file - Hash of the enclave image
// PCR1: Enclave Kernel - Hash of the Linux kernel used
// PCR2: Enclave application - Hash of the application code
/// PCRs struct holds the three Platform Configuration Register values
/// These cryptographic hashes uniquely identify an enclave's configuration
/// Abilities: copy, drop, store - can be copied, dropped, and stored in other objects
public struct Pcrs(vector<u8>, vector<u8>, vector<u8>) has copy, drop, store;

/// EnclaveConfig - Configuration for a specific type of enclave
/// Defines the expected PCR values and versioning for enclave validation
/// Generic type T allows different enclave types to have separate configurations
/// Ability: key - can be owned or shared as an object
public struct EnclaveConfig<phantom T> has key {
    id: UID, // Unique identifier for this configuration
    name: String, // Human-readable name for this enclave type
    pcrs: Pcrs, // Expected PCR values (image, kernel, application)
    capability_id: ID, // ID of the capability that can update this config
    version: u64, // Version number, incremented on each update
}

/// Enclave - A verified enclave instance with its public key
/// Represents a registered and validated AWS Nitro enclave
/// Generic type T links this enclave to its configuration type
/// Ability: key - can be owned or shared
public struct Enclave<phantom T> has key {
    id: UID, // Unique identifier for this enclave instance
    pk: vector<u8>, // Ed25519 public key extracted from attestation document
    config_version: u64, // Version of config this enclave was registered with
    owner: address, // Address of the user who registered this enclave
}

/// Cap - A capability to update enclave configurations
/// Only the holder of this capability can modify the EnclaveConfig
/// Generic type T links this capability to specific enclave configurations
/// Abilities: key (ownable), store (can be stored/transferred)
public struct Cap<phantom T> has key, store {
    id: UID, // Unique identifier for this capability
}

/// IntentMessage - Wrapper for enclave messages with intent and timestamp
/// Used to prevent replay attacks and ensure message freshness
/// Generic type T is the actual payload being signed
/// Abilities: copy, drop - can be copied and dropped (ephemeral)
public struct IntentMessage<T: drop> has copy, drop {
    intent: u8, // Intent scope byte indicating message purpose
    timestamp_ms: u64, // Timestamp in milliseconds for freshness
    payload: T, // The actual message payload
}

/// Create a new Cap using a witness T from a module
/// The witness pattern ensures only the defining module can create this capability
/// _: Witness type T (consumed, proving module ownership)
/// ctx: Transaction context for object creation
/// Returns: New Cap<T> capability
public fun new_cap<T: drop>(_: T, ctx: &mut TxContext): Cap<T> {
    Cap {
        id: object::new(ctx), // Generate unique ID for the capability
    }
}

/// Create a new enclave configuration with PCR values
/// This sets up the trusted enclave parameters that will be validated
/// cap: Capability proving permission to create this config
/// name: Human-readable name for this enclave type
/// pcr0: PCR0 hash (enclave image file)
/// pcr1: PCR1 hash (enclave kernel)
/// pcr2: PCR2 hash (enclave application)
/// ctx: Transaction context for object creation
public fun create_enclave_config<T: drop>(
    cap: &Cap<T>,
    name: String,
    pcr0: vector<u8>,
    pcr1: vector<u8>,
    pcr2: vector<u8>,
    ctx: &mut TxContext,
) {
    // Create the enclave configuration with provided PCRs
    let enclave_config = EnclaveConfig<T> {
        id: object::new(ctx), // Generate unique ID for this config
        name, // Store the enclave name
        pcrs: Pcrs(pcr0, pcr1, pcr2), // Create PCRs struct from the three hashes
        capability_id: cap.id.to_inner(), // Link to the capability that controls this config
        version: 0, // Initial version is 0
    };

    // Share the configuration so anyone can read it
    transfer::share_object(enclave_config);
}

/// Register a new enclave instance with attestation document
/// Validates the attestation document against the config and extracts the public key
/// enclave_config: Reference to the enclave configuration to validate against
/// document: AWS Nitro attestation document from the enclave
/// ctx: Transaction context for object creation and sender info
public fun register_enclave<T>(
    enclave_config: &EnclaveConfig<T>,
    document: NitroAttestationDocument,
    ctx: &mut TxContext,
) {
    // Load and validate the public key from the attestation document
    // This also checks that the PCRs in the document match the config
    let pk = enclave_config.load_pk(&document);

    // Create the enclave instance with validated public key
    let enclave = Enclave<T> {
        id: object::new(ctx), // Generate unique ID for this enclave
        pk, // Store the extracted public key
        config_version: enclave_config.version, // Record config version used
        owner: ctx.sender(), // Record who registered this enclave
    };

    // Share the enclave object so it can be used for verification
    transfer::share_object(enclave);
}

/// Verify a signature from a registered enclave
/// Validates that the signature was created by the enclave's private key
/// enclave: Reference to the registered enclave
/// intent_scope: Intent byte indicating the message purpose
/// timestamp_ms: Timestamp in milliseconds for message freshness
/// payload: The actual data that was signed
/// signature: The Ed25519 signature to verify
/// Returns: true if signature is valid, false otherwise
public fun verify_signature<T, P: drop>(
    enclave: &Enclave<T>,
    intent_scope: u8,
    timestamp_ms: u64,
    payload: P,
    signature: &vector<u8>,
): bool {
    // Create the intent message wrapper with the payload
    let intent_message = create_intent_message(intent_scope, timestamp_ms, payload);
    // Serialize the intent message to bytes using BCS
    let payload = bcs::to_bytes(&intent_message);
    // Verify the signature using Ed25519 with the enclave's public key
    return ed25519::ed25519_verify(signature, &enclave.pk, &payload)
}

/// Update the PCR values in an enclave configuration
/// This increments the version and updates the expected PCR hashes
/// config: Mutable reference to the enclave configuration
/// cap: Capability proving permission to update
/// pcr0: New PCR0 hash (enclave image file)
/// pcr1: New PCR1 hash (enclave kernel)
/// pcr2: New PCR2 hash (enclave application)
public fun update_pcrs<T: drop>(
    config: &mut EnclaveConfig<T>,
    cap: &Cap<T>,
    pcr0: vector<u8>,
    pcr1: vector<u8>,
    pcr2: vector<u8>,
) {
    // Verify the capability is valid for this configuration
    cap.assert_is_valid_for_config(config);
    // Update the PCR values
    config.pcrs = Pcrs(pcr0, pcr1, pcr2);
    // Increment the version number to invalidate old enclaves
    config.version = config.version + 1;
}

/// Update the name of an enclave configuration
/// config: Mutable reference to the enclave configuration
/// cap: Capability proving permission to update
/// name: New name for the enclave configuration
public fun update_name<T: drop>(config: &mut EnclaveConfig<T>, cap: &Cap<T>, name: String) {
    // Verify the capability is valid for this configuration
    cap.assert_is_valid_for_config(config);
    // Update the name
    config.name = name;
}

/// Get PCR0 value from configuration
/// config: Reference to the enclave configuration
/// Returns: Reference to PCR0 hash bytes
public fun pcr0<T>(config: &EnclaveConfig<T>): &vector<u8> {
    &config.pcrs.0 // Return reference to first PCR value
}

/// Get PCR1 value from configuration
/// config: Reference to the enclave configuration
/// Returns: Reference to PCR1 hash bytes
public fun pcr1<T>(config: &EnclaveConfig<T>): &vector<u8> {
    &config.pcrs.1 // Return reference to second PCR value
}

/// Get PCR2 value from configuration
/// config: Reference to the enclave configuration
/// Returns: Reference to PCR2 hash bytes
public fun pcr2<T>(config: &EnclaveConfig<T>): &vector<u8> {
    &config.pcrs.2 // Return reference to third PCR value
}

/// Get the public key from an enclave
/// enclave: Reference to the enclave instance
/// Returns: Reference to the Ed25519 public key bytes
public fun pk<T>(enclave: &Enclave<T>): &vector<u8> {
    &enclave.pk // Return reference to the public key
}

/// Destroy an old enclave that uses an outdated configuration version
/// This allows cleanup of enclaves registered with old config versions
/// e: The enclave instance to destroy
/// config: Reference to the current configuration
public fun destroy_old_enclave<T>(e: Enclave<T>, config: &EnclaveConfig<T>) {
    // Verify the enclave's config version is older than current
    assert!(e.config_version < config.version, EInvalidConfigVersion);
    // Destructure the enclave to access its fields
    let Enclave { id, .. } = e;
    // Delete the enclave object ID
    id.delete();
}

/// Destroy an enclave by its owner
/// Allows the owner to cleanup their own enclave regardless of version
/// e: The enclave instance to destroy
/// ctx: Transaction context to verify ownership
public fun deploy_old_enclave_by_owner<T>(e: Enclave<T>, ctx: &mut TxContext) {
    // Verify the caller is the owner of this enclave
    assert!(e.owner == ctx.sender(), EInvalidOwner);
    // Destructure the enclave to access its fields
    let Enclave { id, .. } = e;
    // Delete the enclave object ID
    id.delete();
}

/// Internal function to verify a capability is valid for a configuration
/// cap: The capability to verify
/// enclave_config: The configuration to verify against
/// Aborts with EInvalidCap if capability doesn't match
fun assert_is_valid_for_config<T>(cap: &Cap<T>, enclave_config: &EnclaveConfig<T>) {
    // Check that the capability ID matches the config's capability_id
    assert!(cap.id.to_inner() == enclave_config.capability_id, EInvalidCap);
}

/// Internal function to load and validate public key from attestation document
/// enclave_config: The configuration with expected PCR values
/// document: The attestation document to validate
/// Returns: The extracted public key bytes
/// Aborts with EInvalidPCRs if PCRs don't match
fun load_pk<T>(enclave_config: &EnclaveConfig<T>, document: &NitroAttestationDocument): vector<u8> {
    // Verify the PCRs in the document match the config's expected PCRs
    assert!(document.to_pcrs() == enclave_config.pcrs, EInvalidPCRs);

    // Extract the public key from the attestation document
    // destroy_some() unwraps the Option<vector<u8>> and consumes it
    (*document.public_key()).destroy_some()
}

/// Internal function to convert attestation document to PCRs struct
/// document: The attestation document to extract PCRs from
/// Returns: Pcrs struct with the three PCR values
fun to_pcrs(document: &NitroAttestationDocument): Pcrs {
    // Get the PCRs array from the attestation document
    let pcrs = document.pcrs();
    // Create Pcrs struct from the three PCR values (0, 1, 2)
    Pcrs(*pcrs[0].value(), *pcrs[1].value(), *pcrs[2].value())
}

/// Internal function to create an intent message wrapper
/// intent: Intent scope byte
/// timestamp_ms: Timestamp in milliseconds
/// payload: The actual payload to wrap
/// Returns: IntentMessage<P> with the payload wrapped
fun create_intent_message<P: drop>(intent: u8, timestamp_ms: u64, payload: P): IntentMessage<P> {
    IntentMessage {
        intent, // Store the intent scope
        timestamp_ms, // Store the timestamp
        payload, // Store the payload
    }
}
