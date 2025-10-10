#!/usr/bin/env python3
"""
Sui CLI Proxy Services
Runs on the host and provides HTTP API for Sui CLI calls from the enclave

Requirements: pip install flask
"""

from flask import Flask, request, jsonify
import subprocess
import json
import logging
import os

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "sui-proxy"})

@app.route('/sui/client/active-address', methods=['GET'])
def get_active_address():
    """Get the active Sui address"""
    try:
        result = subprocess.run(['sui', 'client', 'active-address'], 
                              capture_output=True, text=True, timeout=10)
        return jsonify({
            'success': result.returncode == 0,
            'stdout': result.stdout.strip(),
            'stderr': result.stderr.strip(),
            'returncode': result.returncode
        })
    except Exception as e:
        logger.error(f"Error getting active address: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/sui/client/gas', methods=['GET'])
def get_gas():
    """Get gas coins"""
    try:
        result = subprocess.run(['sui', 'client', 'gas'], 
                              capture_output=True, text=True, timeout=10)
        return jsonify({
            'success': result.returncode == 0,
            'stdout': result.stdout.strip(),
            'stderr': result.stderr.strip(),
            'returncode': result.returncode
        })
    except Exception as e:
        logger.error(f"Error getting gas: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/sui/client/call', methods=['POST'])
def call_contract():
    """Execute a contract call"""
    try:
        data = request.json
        package_id = data.get('package_id')
        module = data.get('module')
        function = data.get('function')
        args = data.get('args', [])
        type_args = data.get('type_args', [])
        gas_budget = data.get('gas_budget', '10000000')
        
        # Build sui client call command
        cmd = ['sui', 'client', 'call', 
               '--package', package_id,
               '--module', module,
               '--function', function,
               '--gas-budget', gas_budget]
        
        # Add type arguments if provided
        for type_arg in type_args:
            cmd.extend(['--type-args', type_arg])
        
        # Add function arguments
        for arg in args:
            cmd.extend(['--args', str(arg)])
        
        logger.info(f"Executing command: {' '.join(cmd)}")
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        return jsonify({
            'success': result.returncode == 0,
            'stdout': result.stdout.strip(),
            'stderr': result.stderr.strip(),
            'returncode': result.returncode,
            'command': ' '.join(cmd)
        })
        
    except Exception as e:
        logger.error(f"Error executing contract call: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/sui/client/ptb', methods=['POST'])
def execute_ptb():
    """Execute a Programmable Transaction Block"""
    try:
        data = request.json
        ptb_commands = data.get('commands', [])
        gas_budget = data.get('gas_budget', '10000000')
        
        # For now, we'll use a simple approach
        # In production, you might want to build the PTB more carefully
        cmd = ['sui', 'client', 'ptb', '--gas-budget', gas_budget]
        
        # Add PTB commands (this is simplified - you may need to adjust based on your needs)
        for command in ptb_commands:
            cmd.extend(['--assign', command])
        
        logger.info(f"Executing PTB command: {' '.join(cmd)}")
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        return jsonify({
            'success': result.returncode == 0,
            'stdout': result.stdout.strip(),
            'stderr': result.stderr.strip(),
            'returncode': result.returncode,
            'command': ' '.join(cmd)
        })
        
    except Exception as e:
        logger.error(f"Error executing PTB: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    # Check if sui CLI is available
    try:
        result = subprocess.run(['sui', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            logger.info(f"Sui CLI available: {result.stdout.strip()}")
        else:
            logger.error("Sui CLI not available or not working")
    except Exception as e:
        logger.error(f"Error checking Sui CLI: {e}")
    
    # Start the Flask server
    logger.info("Starting Sui Proxy Service on port 9999")
    app.run(host='0.0.0.0', port=9999, debug=False)
