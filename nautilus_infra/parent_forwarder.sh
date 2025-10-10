#!/bin/bash
# Kill any existing forwarders
pkill -f "VSOCK-LISTEN:9999"
pkill -f "VSOCK-LISTEN:6379"

echo "Starting parent forwarder script..."

# Start Sui CLI proxy service
echo "Starting Sui CLI proxy service on port 9999..."
python3 sui_proxy.py &
SUI_PROXY_PID=$!
echo "Sui proxy started with PID: $SUI_PROXY_PID"

# Forward VSOCK port 9999 to local Sui proxy
echo "Setting up VSOCK forwarding for Sui proxy..."
/usr/local/bin/socat VSOCK-LISTEN:9999,fork,reuseaddr TCP:127.0.0.1:9999 &
SUI_VSOCK_PID=$!
echo "Sui VSOCK forwarder started with PID: $SUI_VSOCK_PID"

# Forward VSOCK port 6379 to YOUR Redis Cloud instance
echo "Setting up VSOCK forwarding for Redis Cloud..."
/usr/local/bin/socat VSOCK-LISTEN:6379,fork,reuseaddr TCP:redis-18401.c261.us-east-1-4.ec2.redns.redis-cloud.com:18401 &
REDIS_VSOCK_PID=$!
echo "Redis VSOCK forwarder started with PID: $REDIS_VSOCK_PID"

echo "Parent forwarders setup complete"
echo "PIDs: Sui Proxy=$SUI_PROXY_PID, Sui VSOCK=$SUI_VSOCK_PID, Redis VSOCK=$REDIS_VSOCK_PID"

# Keep script running
wait
