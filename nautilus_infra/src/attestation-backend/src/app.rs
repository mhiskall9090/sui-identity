// app.rs
use crate::common::{to_signed_response, IntentScope, ProcessDataRequest, ProcessedDataResponse};
use crate::{AppState, EnclaveError};
use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use base64::{Engine as _, engine::general_purpose};
use fastcrypto::ed25519::Ed25519KeyPair;
use fastcrypto::traits::KeyPair as FcKeyPair;
use fastcrypto::traits::ToFromBytes;
use crate::common::IntentMessage;


// Add KYC structures and functions
#[derive(Debug, Serialize, Deserialize)]
pub struct KYCRequest {
    pub encrypted_doc: String,
    pub encrypted_faces: Vec<String>,
    pub encrypted_session_key: String,
    pub wallet_address: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KYCResponse {
    pub verified: bool,
    pub wallet_address: String,
    pub attestation_hash: String,
}

pub async fn process_kyc(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ProcessDataRequest<KYCRequest>>,
) -> Result<Json<ProcessedDataResponse<IntentMessage<KYCResponse>>>, EnclaveError>{
    let kyc_data = &request.payload;
    
    // For demo, simple decryption (in production, use proper crypto)
    let doc_data = decrypt_demo(&kyc_data.encrypted_doc)?;
    let face_frames: Vec<Vec<u8>> = kyc_data.encrypted_faces
        .iter()
        .map(|f| decrypt_demo(f))
        .collect::<Result<Vec<_>, _>>()?;
    
    // Verify faces match and liveness
    let verification_result = verify_identity(doc_data, face_frames)?;
    
    // Generate attestation
    let attestation_hash = generate_attestation_hash(&state.eph_kp, &verification_result)?;
 
    
    let response = KYCResponse {
        verified: verification_result,
        wallet_address: kyc_data.wallet_address.clone(),
        attestation_hash,
    };

    Ok(Json(to_signed_response(
        &state.eph_kp,
        response,
        current_timestamp()?,
        IntentScope::KYCVerification,
    )))
}

fn decrypt_demo(encrypted: &str) -> Result<Vec<u8>, EnclaveError> {
    general_purpose::STANDARD
        .decode(encrypted)
        .map_err(|e| EnclaveError::GenericError(format!("Decryption failed: {}", e)))
}

fn verify_identity(doc: Vec<u8>, faces: Vec<Vec<u8>>) -> Result<bool, EnclaveError> {
    Ok(!doc.is_empty() && faces.len() >= 5)
}

fn generate_attestation_hash(
    keypair: &Ed25519KeyPair, 
    verified: &bool
) -> Result<String, EnclaveError> {
    use sha2::{Sha256, Digest};
    
    let mut hasher = Sha256::new();
    hasher.update(verified.to_string());
    hasher.update(keypair.public().as_bytes());
    
    Ok(hex::encode(hasher.finalize()))
}

fn current_timestamp() -> Result<u64, EnclaveError> {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .map_err(|e| EnclaveError::GenericError(format!("Time error: {}", e)))
}