// Environment configuration for API endpoints
export const config = {
  // Backend API Configuration (via SSH tunnel)
  API_BASE_URL: 'http://localhost:8000',
  VERIFICATION_API_URL: 'http://localhost:8000/api',
  
  // Enclave Rust Service (for attestation)
  ENCLAVE_API_URL: 'http://3.8.99.98:4000',
  
  // Environment
  NODE_ENV: 'development'
};
