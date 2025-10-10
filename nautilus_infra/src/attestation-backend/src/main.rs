// main.rs
use anyhow::Result;
use axum::{routing::get, routing::post, Router};
use fastcrypto::{ed25519::Ed25519KeyPair, traits::{KeyPair, ToFromBytes}};
use attestation_server::common::{get_attestation, health_check};
use attestation_server::app::{process_kyc};
// use attestation_server::zklogin::{get_salt, get_zk_proof}; // COMMENTED OUT - No longer using zkLogin
use attestation_server::AppState;
use std::sync::Arc;
// CORS imports moved to function scope
use tracing::{info, error};

mod redis_sui_processor;
use redis_sui_processor::start_redis_sui_processor;
// use rand::SeedableRng;

#[tokio::main]
async fn main() -> Result<()> {
    // Load environment variables from local .env file first
    dotenvy::dotenv().ok();
    
    // Log which env file is being used
    if std::path::Path::new(".env").exists() {
        info!("Loading environment variables from attestation-backend/.env");
    } else {
        info!("No local .env file found, using system environment variables");
    }
    
    // Initialize tracing
    tracing_subscriber::fmt::init();
    
    // Debug: Log key environment variables (without sensitive data)
    info!("Environment variables loaded (.env files only, no secrets.json):");
    info!("  REDIS_URL: {}", if std::env::var("REDIS_URL").is_ok() { "✅ Set" } else { "❌ Not set" });
    info!("  REDIS_STREAM_NAME: {}", std::env::var("REDIS_STREAM_NAME").unwrap_or("default".to_string()));
    info!("  SUI_PACKAGE_ID: {}", if std::env::var("SUI_PACKAGE_ID").is_ok() { "✅ Set" } else { "❌ Using default" });

    

    // Use NSM hardware entropy for key generation in enclave
    let eph_kp = if std::env::var("ENCLAVE_MODE").is_ok() {
        // In enclave: use NSM hardware entropy
        #[cfg(feature = "aws")]
        {
            use aws_nitro_enclaves_nsm_api::driver;
            use aws_nitro_enclaves_nsm_api::api::{Request, Response};
            
            // Get entropy from NSM
            let fd = driver::nsm_init();
            let request = Request::GetRandom;
            match driver::nsm_process_request(fd, request) {
                Response::GetRandom { random } => {
                    driver::nsm_exit(fd);
                    let seed: [u8; 32] = random[..32].try_into().expect("Invalid entropy length");
                    use rand::SeedableRng;
                    let mut rng = rand::rngs::StdRng::from_seed(seed);
                    Ed25519KeyPair::generate(&mut rng)
                }
                _ => {
                    driver::nsm_exit(fd);
                    // Fallback to thread_rng if NSM fails
                    Ed25519KeyPair::generate(&mut rand::thread_rng())
                }
            }
        }
        #[cfg(not(feature = "aws"))]
        {
            // Fallback if aws feature not available
            Ed25519KeyPair::generate(&mut rand::thread_rng())
        }
    } else {
        // Local development: use standard RNG
        Ed25519KeyPair::generate(&mut rand::thread_rng())
    };

    // Clone the keypair for the Redis processor
    let redis_keypair = Ed25519KeyPair::from_bytes(eph_kp.as_bytes())?;
    let state = Arc::new(AppState { eph_kp });

    info!("Starting attestation server with API and Redis processor");

    // Start both API server and Redis processor concurrently
    let api_handle = tokio::spawn(run_api_server(state));
    let redis_handle = tokio::spawn(start_redis_sui_processor(redis_keypair));

    // Wait for either to complete (or fail)
    tokio::select! {
        result = api_handle => {
            match result {
                Ok(Ok(())) => info!("API server completed successfully"),
                Ok(Err(e)) => error!("API server failed: {}", e),
                Err(e) => error!("API server task panicked: {}", e),
            }
        }
        result = redis_handle => {
            match result {
                Ok(Ok(())) => info!("Redis processor completed successfully"),
                Ok(Err(e)) => error!("Redis processor failed: {}", e),
                Err(e) => error!("Redis processor task panicked: {}", e),
            }
        }
    }

    Ok(())
}

async fn run_api_server(state: Arc<AppState>) -> Result<()> {
    use tower_http::cors::CorsLayer;
    use tower_http::cors::Any;
    
    let cors = CorsLayer::new()
        .allow_methods(Any)
        .allow_headers(Any)
        .allow_origin(Any); // For development

    let app = Router::new()
        .route("/", get(ping))
        .route("/health", get(health_check))
        .route("/get_attestation", get(get_attestation))
        .route("/process_kyc", post(process_kyc))
        // zkLogin endpoints - COMMENTED OUT - No longer using zkLogin for now
        // .route("/get_salt", post(get_salt))
        // .route("/get_zk_proof", post(get_zk_proof))
        .with_state(state)
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:4000").await?;
    info!("Attestation server listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app)
        .await
        .map_err(|e| anyhow::anyhow!("Server error: {}", e))
}

async fn ping() -> &'static str {
    " Backend Ready!"
}
