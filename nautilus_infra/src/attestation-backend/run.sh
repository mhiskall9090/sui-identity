#!/bin/sh
# Copyright (c), Mysten Labs, Inc.
# SPDX-License-Identifier: Apache-2.0


# added dummy ip for now
# - Setup script for nautilus-server that acts as an init script
# - Sets up Python and library paths
# - Configures loopback network and /etc/hosts
# - Waits for secrets.json to be passed from the parent instance. 
# - Forwards VSOCK port 3000 to localhost:3000
# - Optionally pulls secrets and sets in environmen variables.
# - Launches nautilus-server

set -e # Exit immediately if a command exits with a non-zero status
echo "Current directory: $(pwd)"
echo "Available files in root:"
ls -la / | head -10
export LD_LIBRARY_PATH=/lib:$LD_LIBRARY_PATH

# Assign an IP address to local loopback
busybox ip addr add 127.0.0.1/32 dev lo
busybox ip link set dev lo up

# Add external service IP as loopback alias (static - matching secrets.json)
echo "Adding external service IP as loopback alias..."
busybox ip addr add 10.0.0.200/32 dev lo

# Add a hosts record, pointing target service calls to local loopback
echo "127.0.0.1   localhost" > /etc/hosts

# Redirect external service address to localhost to force traffic through forwarder
echo "127.0.0.1 10.0.0.200" >> /etc/hosts

# Add host entry for VSOCK CID 3 (parent) - for Sui proxy communication
echo "127.0.0.1 3" >> /etc/hosts

# Add DNS configuration for external services
echo "nameserver 8.8.8.8" > /etc/resolv.conf
echo "nameserver 1.1.1.1" >> /etc/resolv.conf

echo "Updated /etc/hosts file:"
cat /etc/hosts

# Test if hosts file redirection is working
echo "Testing hosts file redirection:"
nslookup 10.0.0.200 || echo "nslookup not available"
ping -c 1 10.0.0.200 || echo "ping test completed"

# Load environment variables from .env files only (no secrets.json)
echo "Loading environment variables from .env files..."

# Load Rust service environment variables
if [ -f "/attestation_server.env" ]; then
    echo "Loading Rust service environment from attestation_server.env"
    set -a  # automatically export all variables
    source /attestation_server.env
    set +a  # stop automatically exporting
else
    echo "No attestation_server.env found, using defaults"
fi

# Python service now runs externally - no env loading needed

echo "Environment variables configured from .env files"

# Override Redis URL to use local forwarding instead of direct Redis Cloud access
export REDIS_URL="redis://default:8GYkgUdA0XwfqNbdMg5hl6oc1f9wUpH0@localhost:6379"
echo "Redis URL overridden to use local forwarding: $REDIS_URL"

# Run traffic forwarder in background and start the server
# Forwards traffic from 127.0.0.x -> Port 443 at CID 3 Listening on port 800x
# There is a vsock-proxy that listens for this and forwards to the respective domains

# == ATTENTION: code should be generated here that added all hosts to forward traffic ===
# Traffic-forwarder-block
# External API forwarders configured for auction validation services

# Redis service is external (Redis Cloud) - no local forwarding needed
echo "Redis service configured to use external Redis Cloud"
echo "No local Redis forwarding required"

# Listens on Local VSOCK Port 4000 (Rust service) and forwards to localhost 4000
socat VSOCK-LISTEN:4000,reuseaddr,fork TCP:localhost:4000 &

# Forward HTTP requests to CID 3 (parent) for Sui proxy communication
socat TCP-LISTEN:9999,reuseaddr,fork VSOCK-CONNECT:3:9999 &

# Forward Redis requests to CID 3 (parent) for Redis Cloud access
socat TCP-LISTEN:6379,reuseaddr,fork VSOCK-CONNECT:3:6379 &

echo "Starting Rust attestation-server on port 4000..."
/attestation_server &
RUST_SERVER_PID=$!

echo "Enclave service started:"
echo "  - Rust attestation-server: PID $RUST_SERVER_PID (port 4000)"
echo "  - Python verification service runs externally"
echo "  - Main exposed port: 4000 (Rust service)"

# Wait for Rust process
wait $RUST_SERVER_PID
