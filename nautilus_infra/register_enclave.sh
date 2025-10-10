#!/bin/bash

# Enhanced Nautilus Enclave Registration Script
# Updated to support new contract structure with cap requirements and package upgrade

# Check if all required arguments are provided
if [ "$#" -ne 5 ]; then
    echo "Usage: $0 <enclave_package_id> <enclave_config_id> <cap_object_id> <enclave_url> <original_package_id>"
    echo "Example: $0    ip "
    exit 1
fi

ENCLAVE_PACKAGE_ID=$1
ENCLAVE_CONFIG_OBJECT_ID=$2
CAP_OBJECT_ID=$3
ENCLAVE_URL=$4
ORIGINAL_PACKAGE_ID=$5

echo "=== Enhanced Nautilus Enclave Registration ==="
echo "Current Package ID: $ENCLAVE_PACKAGE_ID"
echo "Original Package ID: $ORIGINAL_PACKAGE_ID"
echo "Enclave Config ID: $ENCLAVE_CONFIG_OBJECT_ID"
echo "Cap Object ID: $CAP_OBJECT_ID"
echo "Enclave URL: $ENCLAVE_URL"
echo ""

# Check if secrets.json exists
if [ ! -f "secrets.json" ]; then
    echo "Error: secrets.json file not found in current directory"
    echo "Please ensure secrets.json exists with the required configuration"
    exit 1
fi

# Read version control from secrets.json
VERSION_CONTROL=$(jq -r '.VERSION_CONTROL // "no_update"' secrets.json)

echo "Version Control Mode: $VERSION_CONTROL"

# Function to get current PCRs from local build
get_current_pcrs() {
    if [ ! -f "out/nitro.pcrs" ]; then
        echo "Error: out/nitro.pcrs file not found. Please run 'make' to build the enclave first."
        exit 1
    fi
    
    PCR0=$(grep "PCR0" out/nitro.pcrs | awk '{print $1}')
    PCR1=$(grep "PCR1" out/nitro.pcrs | awk '{print $1}')
    PCR2=$(grep "PCR2" out/nitro.pcrs | awk '{print $1}')
    
    if [ -z "$PCR0" ] || [ -z "$PCR1" ] || [ -z "$PCR2" ]; then
        echo "Error: Could not extract PCR values from out/nitro.pcrs"
        exit 1
    fi
    
    echo "Current PCRs from build:"
    echo "  PCR0: $PCR0"
    echo "  PCR1: $PCR1"
    echo "  PCR2: $PCR2"
}

# Function to update PCRs on-chain
update_pcrs_onchain() {
    echo ""
    echo "=== Updating PCRs on-chain ==="
    
    echo "Using Cap Object ID: $CAP_OBJECT_ID"
    
    # Update PCRs on-chain using original package ID for type
    echo "Calling update_pcrs function..."
    sui client call \
        --function update_pcrs \
        --module enclave \
        --package $ENCLAVE_PACKAGE_ID \
        --type-args "${ORIGINAL_PACKAGE_ID}::enclave::ENCLAVE" \
        --args $ENCLAVE_CONFIG_OBJECT_ID $CAP_OBJECT_ID 0x$PCR0 0x$PCR1 0x$PCR2 \
        --gas-budget 100000000
    
    if [ $? -eq 0 ]; then
        echo "✓ PCRs updated successfully on-chain"
    else
        echo "✗ Failed to update PCRs on-chain"
        exit 1
    fi
}

# Function to register enclave
register_enclave() {
    echo ""
    echo "=== Registering Enclave ==="
    
    echo "Fetching attestation from enclave..."
    # Fetch attestation and store the hex
    ATTESTATION_HEX=$(curl -s $ENCLAVE_URL/get_attestation | jq -r '.attestation')
    
    echo "Got attestation, length=${#ATTESTATION_HEX}"
    
    if [ ${#ATTESTATION_HEX} -eq 0 ]; then
        echo "Error: Attestation is empty. Please check status of $ENCLAVE_URL and its get_attestation endpoint."
        exit 1
    fi
    
    # Convert hex to array using Python
    echo "Converting attestation to byte array..."
    ATTESTATION_ARRAY=$(python3 - <<EOF
import sys

def hex_to_vector(hex_string):
    byte_values = [str(int(hex_string[i:i+2], 16)) for i in range(0, len(hex_string), 2)]
    rust_array = [f"{byte}u8" for byte in byte_values]
    return f"[{', '.join(rust_array)}]"

print(hex_to_vector("$ATTESTATION_HEX"))
EOF
)
    
    echo "Calling register_enclave function with cap..."
    # Execute sui client command with the converted array and cap
    sui client ptb --assign v "vector$ATTESTATION_ARRAY" \
        --move-call "0x2::nitro_attestation::load_nitro_attestation" v @0x6 \
        --assign result \
        --move-call "${ENCLAVE_PACKAGE_ID}::enclave::register_enclave<${ORIGINAL_PACKAGE_ID}::enclave::ENCLAVE>" @${ENCLAVE_CONFIG_OBJECT_ID} @${CAP_OBJECT_ID} result \
        --gas-budget 100000000
    
    if [ $? -eq 0 ]; then
        echo "✓ Enclave registered successfully"
        echo ""
        echo "IMPORTANT: Save the new Enclave object ID from the transaction output above!"
        echo "You'll need it if you want to destroy this enclave later."
    else
        echo "✗ Failed to register enclave"
        exit 1
    fi
}

# Function to destroy old enclave
destroy_old_enclave() {
    if [ -z "$1" ]; then
        echo "Error: Old enclave ID not provided"
        echo "Usage: destroy_old_enclave <old_enclave_id>"
        return 1
    fi
    
    OLD_ENCLAVE_ID=$1
    echo ""
    echo "=== Destroying Old Enclave ==="
    echo "Old Enclave ID: $OLD_ENCLAVE_ID"
    
    echo "Calling destroy_old_enclave function with cap..."
    sui client call \
        --function destroy_old_enclave \
        --module enclave \
        --package $ENCLAVE_PACKAGE_ID \
        --type-args "${ORIGINAL_PACKAGE_ID}::enclave::ENCLAVE" \
        --args $OLD_ENCLAVE_ID $ENCLAVE_CONFIG_OBJECT_ID $CAP_OBJECT_ID \
        --gas-budget 100000000
    
    if [ $? -eq 0 ]; then
        echo "✓ Old enclave destroyed successfully"
    else
        echo "✗ Failed to destroy old enclave"
        return 1
    fi
}

# Main execution logic
case "$VERSION_CONTROL" in
    "update")
        echo ""
        echo "🔄 UPDATE MODE: Will update PCRs and register enclave"
        
        # Check if OLD_ENCLAVE_ID is provided in secrets.json
        OLD_ENCLAVE_ID=$(jq -r '.OLD_ENCLAVE_ID // empty' secrets.json)
        
        get_current_pcrs
        update_pcrs_onchain
        
        # If old enclave exists, destroy it first
        if [ ! -z "$OLD_ENCLAVE_ID" ]; then
            echo ""
            echo "Found old enclave to destroy: $OLD_ENCLAVE_ID"
            destroy_old_enclave $OLD_ENCLAVE_ID
        fi
        
        register_enclave
        echo ""
        echo "✅ Update mode completed successfully!"
        echo "   - PCRs updated on-chain"
        echo "   - Old enclave destroyed (if specified)"
        echo "   - New enclave registered with new public key"
        ;;
    "no_update")
        echo ""
        echo "🔑 REGISTER MODE: Will only register enclave (no PCR update)"
        register_enclave
        echo ""
        echo "✅ Register mode completed successfully!"
        echo "   - Enclave registered with new public key"
        echo "   - PCRs unchanged"
        ;;
    "destroy_only")
        echo ""
        echo "🗑️  DESTROY MODE: Will only destroy old enclave"
        OLD_ENCLAVE_ID=$(jq -r '.OLD_ENCLAVE_ID // empty' secrets.json)
        
        if [ -z "$OLD_ENCLAVE_ID" ]; then
            echo "Error: OLD_ENCLAVE_ID not found in secrets.json"
            exit 1
        fi
        
        destroy_old_enclave $OLD_ENCLAVE_ID
        echo ""
        echo "✅ Destroy mode completed successfully!"
        ;;
    *)
        echo ""
        echo "⚠️  Unknown VERSION_CONTROL value: $VERSION_CONTROL"
        echo "   Valid values are: 'update', 'no_update', or 'destroy_only'"
        echo "   Defaulting to 'no_update' mode..."
        register_enclave
        echo ""
        echo "✅ Default register mode completed!"
        ;;
esac

echo ""
echo "=== Registration Process Complete ==="