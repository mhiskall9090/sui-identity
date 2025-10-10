/*
// zklogin.rs - COMMENTED OUT - No longer using zkLogin functionality
use crate::AppState;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use sha2::{Sha256, Digest};
use hkdf::Hkdf;
use base64::{Engine as _, engine::general_purpose};
use reqwest::Client;
use tracing::{info, error, warn};
use std::env;
use dotenvy::dotenv;

// JWT payload structure
#[derive(Debug, Serialize, Deserialize)]
pub struct JwtPayload {
    pub iss: String,      // Issuer
    pub sub: String,      // Subject ID
    pub aud: String,      // Audience (client ID)
    pub exp: u64,         // Expiration time
    pub iat: u64,         // Issued at
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nonce: Option<String>,
}

// Salt request/response
#[derive(Debug, Deserialize)]
pub struct SaltRequest {
    pub jwt: String,
}

#[derive(Debug, Serialize)]
pub struct SaltResponse {
    pub salt: String,
}

// ZK Proof request/response - Updated for Enoki API
#[derive(Debug, Deserialize)]
pub struct ZkProofRequest {
    pub jwt: String,
    #[serde(rename = "ephemeralPublicKey")]
    pub ephemeral_public_key: String,
    #[serde(rename = "maxEpoch")]
    pub max_epoch: u64,
    pub randomness: String,
    pub network: String, // Added for Enoki API
}

// Enoki API request structure
#[derive(Debug, Serialize)]
struct EnokiZkProofRequest {
    pub network: String,
    #[serde(rename = "ephemeralPublicKey")]
    pub ephemeral_public_key: String,
    #[serde(rename = "maxEpoch")]
    pub max_epoch: u64,
    pub randomness: String,
}

// Enoki API response structure
#[derive(Debug, Deserialize)]
struct EnokiZkProofResponse {
    pub data: EnokiZkProofData,
}

#[derive(Debug, Deserialize)]
struct EnokiZkProofData {
    #[serde(rename = "proofPoints")]
    pub proof_points: Option<ProofPoints>,
    #[serde(rename = "issBase64Details")]
    pub iss_base64_details: Option<IssBase64Details>,
    #[serde(rename = "headerBase64")]
    pub header_base64: Option<String>,
    #[serde(rename = "addressSeed")]
    pub address_seed: String,
}

// Keep existing response structure for compatibility
#[derive(Debug, Serialize, Deserialize)]
pub struct ZkProofResponse {
    #[serde(rename = "proofPoints")]
    pub proof_points: ProofPoints,
    #[serde(rename = "issBase64Details")]
    pub iss_base64_details: IssBase64Details,
    #[serde(rename = "headerBase64")]
    pub header_base64: String,
    #[serde(rename = "addressSeed")]
    pub address_seed: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProofPoints {
    pub a: Vec<String>,
    pub b: Vec<Vec<String>>,
    pub c: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IssBase64Details {
    pub value: String,
    #[serde(rename = "indexMod4")]
    pub index_mod4: u32,
}

// Master seed for salt derivation (in production, use secure key management)
const MASTER_SEED: &[u8] = b"zklogin_master_seed_change_in_production_secure_random_32_bytes!";

// Enoki API configuration - Add these to your environment variables
const ENOKI_API_URL: &str = "https://api.enoki.mystenlabs.com/v1/zklogin/zkp";


fn get_enoki_token() -> Result<String, &'static str> {
    // Load variables from .env (only needs to be called once, usually in main)
    dotenv().ok();

    env::var("ENOKI_API_TOKEN").map_err(|_| "ENOKI_API_TOKEN not set in .env")
}

// Helper function to create error responses with logging
fn error_response(status: StatusCode, message: &str) -> Response {
    error!("Request failed: {}", message);
    let body = Json(json!({
        "error": message,
        "status": status.as_u16()
    }));
    (status, body).into_response()
}

/// Generate user salt using HKDF derivation
/// This implements Option 4: HKDF(ikm = seed, salt = iss || aud, info = sub)
pub async fn get_salt(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<SaltRequest>,
) -> Response {
    info!("Salt request received");
    
    // Decode JWT without verification (we'll verify issuer manually)
    let jwt_parts: Vec<&str> = request.jwt.split('.').collect();
    if jwt_parts.len() != 3 {
        return error_response(StatusCode::BAD_REQUEST, "Invalid JWT format");
    }

    // Decode JWT payload
    let payload_bytes = match general_purpose::URL_SAFE_NO_PAD.decode(jwt_parts[1]) {
        Ok(bytes) => bytes,
        Err(e) => {
            return error_response(StatusCode::BAD_REQUEST, &format!("JWT decode error: {}", e));
        }
    };
    
    let payload: JwtPayload = match serde_json::from_slice(&payload_bytes) {
        Ok(payload) => payload,
        Err(e) => {
            return error_response(StatusCode::BAD_REQUEST, &format!("JWT parse error: {}", e));
        }
    };

    info!("JWT decoded - iss: {}, sub: {}, aud: {}", payload.iss, payload.sub, payload.aud);

    // Validate issuer
    if !is_valid_issuer(&payload.iss) {
        warn!("Invalid issuer attempted: {}", payload.iss);
        return error_response(StatusCode::BAD_REQUEST, "Invalid or unsupported issuer");
    }

    // Generate salt using HKDF
    let salt_input = format!("{}{}", payload.iss, payload.aud);
    let hk = Hkdf::<Sha256>::new(Some(salt_input.as_bytes()), MASTER_SEED);
    
    let mut salt_bytes = [0u8; 16]; // 16 bytes for salt
    if let Err(e) = hk.expand(payload.sub.as_bytes(), &mut salt_bytes) {
        return error_response(StatusCode::INTERNAL_SERVER_ERROR, &format!("HKDF expand error: {}", e));
    }

    // Convert to big integer string (less than 2^128)
    let salt_bigint = u128::from_be_bytes(salt_bytes);
    let salt_string = salt_bigint.to_string();

    info!("Generated salt for user {} from issuer {}", payload.sub, payload.iss);

    let response = SaltResponse {
        salt: salt_string,
    };

    (StatusCode::OK, Json(response)).into_response()
}

/// Generate ZK proof by calling Enoki API
pub async fn get_zk_proof(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<ZkProofRequest>,
) -> Response {
    info!("ZK proof request received for Enoki API");

    // Get Enoki API token
    let enoki_token = match get_enoki_token() {
        Ok(token) => token,
        Err(e) => {
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, e);
        }
    };

    // Create the request payload for Enoki API
    let enoki_payload = EnokiZkProofRequest {
        network: request.network,
        ephemeral_public_key: request.ephemeral_public_key,
        max_epoch: request.max_epoch,
        randomness: request.randomness,
    };

    info!("Calling Enoki API zkLogin service...");

    // Call the Enoki API
    let client = Client::new();
    let response = match client
        .post(ENOKI_API_URL)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", enoki_token))
        .header("zklogin-jwt", &request.jwt)
        .json(&enoki_payload)
        .send()
        .await
    {
        Ok(response) => response,
        Err(e) => {
            return error_response(StatusCode::BAD_GATEWAY, &format!("Enoki API service error: {}", e));
        }
    };

    if !response.status().is_success() {
        let status_code = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        error!("Enoki API returned error ({}): {}", status_code, error_text);
        return error_response(StatusCode::BAD_GATEWAY, &format!("Enoki API failed ({}): {}", status_code, error_text));
    }

    let enoki_response: EnokiZkProofResponse = match response.json().await {
        Ok(resp) => resp,
        Err(e) => {
            return error_response(StatusCode::BAD_GATEWAY, &format!("Enoki API response parse error: {}", e));
        }
    };

    // Check if the proof data is present
    let proof_points = match enoki_response.data.proof_points {
        Some(points) => points,
        None => {
            return error_response(StatusCode::BAD_GATEWAY, "Enoki API returned null proof points");
        }
    };

    let iss_base64_details = match enoki_response.data.iss_base64_details {
        Some(details) => details,
        None => {
            return error_response(StatusCode::BAD_GATEWAY, "Enoki API returned null iss_base64_details");
        }
    };

    let header_base64 = match enoki_response.data.header_base64 {
        Some(header) => header,
        None => {
            return error_response(StatusCode::BAD_GATEWAY, "Enoki API returned null header_base64");
        }
    };

    // Convert Enoki response to our expected format
    let zk_proof = ZkProofResponse {
        proof_points,
        iss_base64_details,
        header_base64,
        address_seed: enoki_response.data.address_seed,
    };

    info!("ZK proof generated successfully via Enoki API");

    (StatusCode::OK, Json(zk_proof)).into_response()
}

/// Validate if the issuer is supported
fn is_valid_issuer(iss: &str) -> bool {
    let valid_issuers = vec![
        "https://accounts.google.com",
        "https://www.facebook.com", 
        "https://id.twitch.tv/oauth2",
        "https://appleid.apple.com",
        // Add more supported issuers as needed
    ];
    
    valid_issuers.contains(&iss)
}
*/