#!/bin/bash
# Save info
# basically used to pass the secrets.json to the enclave for setting up the service
ENCLAVE_ID=$(sudo nitro-cli describe-enclaves | jq -r ".[0].EnclaveID")
ENCLAVE_CID=$(sudo nitro-cli describe-enclaves | jq -r ".[0].EnclaveCID")

echo "Enclave ID: $ENCLAVE_ID"
echo "Enclave CID: $ENCLAVE_CID"

# Kill only the port 3000 forwarder (not the parent VSOCK forwarders)
pkill -f "TCP4-LISTEN:3000"
pkill vsock-proxy

# Send secrets to the enclave (it's waiting on VSOCK port 7777)
echo "Sending secrets..."
cat secrets.json | /usr/local/bin/socat - VSOCK-CONNECT:$ENCLAVE_CID:7777

sleep 2

# Set up port forwarding from external port 3000 to enclave VSOCK port 3000
echo "Setting up port forwarding..."
/usr/local/bin/socat TCP4-LISTEN:3000,reuseaddr,fork VSOCK-CONNECT:$ENCLAVE_CID:3000 &

echo "Port forwarding established. Service should be accessible on port 3000"
