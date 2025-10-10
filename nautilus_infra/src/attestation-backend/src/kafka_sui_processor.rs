// Kafka consumer using rskafka (pure Rust) that polls verification data and executes Sui CLI commands
use anyhow::{Result, anyhow};
use rskafka::{
    client::{ClientBuilder, partition::UnknownTopicHandling},
    record::Record,
};
use serde::{Deserialize, Serialize};
use tokio::time::{Duration, Instant};
use tracing::{error, info, warn};
use fastcrypto::{ed25519::Ed25519KeyPair, traits::Signer};
use chrono::DateTime;
use hex;
use base64::{Engine as _, engine::general_purpose};
use std::process::Command;

// DID type constants (matching your Move contract)
const DID_AGE_VERIFY: u8 = 1;        // Contract value for age verification
const DID_CITIZENSHIP_VERIFY: u8 = 2; // Contract value for citizenship verification

// Kafka message structure from your verification service
#[derive(Debug, Clone, Deserialize, Serialize)]
struct VerificationMessage {
    user_wallet: String,
    #[serde(deserialize_with = "deserialize_string_to_u8")]
    did_id: u8,  // Parse string to u8
    result: String,
    evidence_hash: String,
    verified_at: String,
}

// Custom deserializer to handle string to u8 conversion
fn deserialize_string_to_u8<'de, D>(deserializer: D) -> Result<u8, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::{self, Visitor};
    
    struct StringToU8Visitor;
    
    impl<'de> Visitor<'de> for StringToU8Visitor {
        type Value = u8;
        
        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("a string or integer that can be converted to u8")
        }
        
        fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
        where
            E: de::Error,
        {
            value.parse::<u8>().map_err(de::Error::custom)
        }
        
        fn visit_u64<E>(self, value: u64) -> Result<Self::Value, E>
        where
            E: de::Error,
        {
            if value <= u8::MAX as u64 {
                Ok(value as u8)
            } else {
                Err(de::Error::custom(format!("u64 value {} is too large for u8", value)))
            }
        }
        
        fn visit_i64<E>(self, value: i64) -> Result<Self::Value, E>
        where
            E: de::Error,
        {
            if value >= 0 && value <= u8::MAX as i64 {
                Ok(value as u8)
            } else {
                Err(de::Error::custom(format!("i64 value {} is out of range for u8", value)))
            }
        }
    }
    
    deserializer.deserialize_any(StringToU8Visitor)
}

// Throughput tracker
#[derive(Debug)]
pub struct ThroughputTracker {
    total_messages: u64,
    start_time: Instant,
    last_report_time: Instant,
}

impl ThroughputTracker {
    pub fn new() -> Self {
        let now = Instant::now();
        Self {
            total_messages: 0,
            start_time: now,
            last_report_time: now,
        }
    }

    pub fn record_message(&mut self) {
        self.total_messages += 1;
    }

    pub fn get_throughput(&self) -> f64 {
        let elapsed = self.start_time.elapsed().as_secs_f64();
        if elapsed > 0.0 {
            self.total_messages as f64 / elapsed
        } else {
            0.0
        }
    }

    pub fn maybe_report(&mut self, interval_secs: u64) -> bool {
        let elapsed = self.last_report_time.elapsed();
        
        if elapsed >= Duration::from_secs(interval_secs) {
            let throughput = self.get_throughput();
            info!("THROUGHPUT: {:.1} messages/sec (total: {})", throughput, self.total_messages);
            self.last_report_time = Instant::now();
            true
        } else {
            false
        }
    }
}

pub struct RSKafkaSuiProcessor {
    keypair: Ed25519KeyPair,
    bootstrap_servers: Vec<String>,
    topic: String,
    partition: i32,
    throughput_tracker: ThroughputTracker,
    // Sui contract parameters
    package_id: String,
    registry_id: String,
    cap_id: String,
    clock_id: String,
    // Offset tracking
    current_offset: i64,
}

impl RSKafkaSuiProcessor {
    const REPORT_INTERVAL_SECS: u64 = 10;

    pub fn new(
        bootstrap_servers: &str,
        topic: &str,
        partition: i32,
        keypair: Ed25519KeyPair,
    ) -> Result<Self> {
        let servers: Vec<String> = bootstrap_servers
            .split(',')
            .map(|s| s.trim().to_string())
            .collect();

        Ok(RSKafkaSuiProcessor {
            keypair,
            bootstrap_servers: servers,
            topic: topic.to_string(),
            partition,
            throughput_tracker: ThroughputTracker::new(),
            package_id: "0x3611276dabf733007d7975e17989e505eb93e11f4998f93d5c74c3a44231833d".to_string(),
            registry_id: "0xea43902e5184fc2cbbc194e63c236321d7cd4aebd006b2d4a7c76f8f03f194b9".to_string(),
            cap_id: "0x678a8ad11edf87246cafad705bed96960990b8d94c7708a0dce4ba68bfeec13a".to_string(),
            clock_id: "0x0000000000000000000000000000000000000000000000000000000000000006".to_string(),
            current_offset: 0, // Start from beginning
        })
    }

    pub async fn start_processing(&mut self) -> Result<()> {
        info!("Starting RSKafka-Sui processor...");
        info!("Contract parameters:");
        info!("   Package: {}", self.package_id);
        info!("   Registry: {}", self.registry_id);
        info!("   Cap: {}", self.cap_id);
        info!("   Topic: {}, Partition: {}", self.topic, self.partition);
        
        // Test sui client configuration
        self.test_sui_client().await?;

        // Create Kafka client
        let client = ClientBuilder::new(self.bootstrap_servers.clone())
            .build()
            .await?;

        // Get partition client
        let partition_client = client
            .partition_client(
                self.topic.clone(),
                self.partition,
                UnknownTopicHandling::Retry,
            )
            .await?;

        info!("Successfully connected to topic: {} partition: {}", self.topic, self.partition);

        // Inspect topic status first
        self.inspect_topic_status(&partition_client).await;

        // Discover the correct starting offset
        self.discover_starting_offset(&partition_client).await?;

        // Start consuming messages from discovered offset
        loop {
            match partition_client
                .fetch_records(
                    self.current_offset,
                    1..1_000_000,  // min..max bytes
                    1_000,         // max wait time (ms)
                )
                .await
            {
                Ok((records, high_watermark)) => {
                    if records.is_empty() {
                        // No new messages, check if topic has any data
                        if high_watermark <= 0 {
                            info!("Topic is empty (high_watermark: {}), waiting for messages...", high_watermark);
                        } else {
                            info!("No new messages, current offset: {}, high watermark: {}", self.current_offset, high_watermark);
                        }
                    } else {
                        info!("Fetched {} records, high watermark: {}", records.len(), high_watermark);
                        
                        for record_and_offset in records {
                            self.throughput_tracker.record_message();
                            
                            if let Err(e) = self.process_kafka_record(&record_and_offset.record).await {
                                error!("Failed to process Kafka record: {}", e);
                            }
                            
                            // Update offset to next message
                            self.current_offset = record_and_offset.offset + 1;
                        }
                        
                        // Report throughput
                        self.throughput_tracker.maybe_report(Self::REPORT_INTERVAL_SECS);
                    }
                    
                    // Always wait a bit before polling again to avoid busy loop
                    tokio::time::sleep(Duration::from_millis(1000)).await;
                }
                Err(e) => {
                    // Handle offset out of range errors by rediscovering offset
                    if e.to_string().contains("OffsetOutOfRange") {
                        warn!("Offset out of range, rediscovering starting offset...");
                        if let Err(discover_err) = self.discover_starting_offset(&partition_client).await {
                            error!("Failed to rediscover offset: {}", discover_err);
                            tokio::time::sleep(Duration::from_secs(5)).await;
                        }
                    } else {
                        error!("Kafka fetch error: {}", e);
                        tokio::time::sleep(Duration::from_secs(1)).await;
                    }
                }
            }
        }
    }

    async fn inspect_topic_status(&self, partition_client: &rskafka::client::partition::PartitionClient) {
        info!("=== TOPIC INSPECTION ===");
        info!("Topic: {}, Partition: {}", self.topic, self.partition);
        
        // Try different offsets to understand the topic state
        let test_offsets = vec![0, 1, 10, 100];
        
        for offset in test_offsets {
            match partition_client.fetch_records(offset, 1..100, 500).await {
                Ok((records, high_watermark)) => {
                    info!("Offset {}: {} records, high_watermark: {}", offset, records.len(), high_watermark);
                    if !records.is_empty() {
                        info!("  First record at offset {}: timestamp: {:?}", 
                              records[0].offset, records[0].record.timestamp);
                    }
                }
                Err(e) => {
                    info!("Offset {}: ERROR - {}", offset, e);
                }
            }
        }
        
        info!("=== END INSPECTION ===");
    }

    async fn discover_starting_offset(&mut self, partition_client: &rskafka::client::partition::PartitionClient) -> Result<()> {
        info!("Discovering starting offset for topic: {} partition: {}", self.topic, self.partition);
        
        // Strategy: Start from the end (latest messages) to avoid OffsetOutOfRange errors
        // This is safer for topics with retention policies or compaction
        
        // First, try a small fetch to get the current high watermark
        match partition_client.fetch_records(0, 1..100, 100).await {
            Ok((records, high_watermark)) => {
                info!("Topic status - Records at offset 0: {}, High watermark: {}", records.len(), high_watermark);
                
                if high_watermark <= 0 {
                    // Topic is truly empty, start from beginning
                    info!("Topic is empty, will wait for new messages starting from offset 0");
                    self.current_offset = 0;
                } else {
                    // Topic has messages, start from the latest to consume only new messages
                    info!("Topic has {} messages, starting from latest to consume only new messages", high_watermark);
                    self.current_offset = high_watermark;
                }
            }
            Err(e) => {
                if e.to_string().contains("OffsetOutOfRange") {
                    warn!("Offset 0 is out of range, topic may have retention policy. Attempting to find valid range...");
                    
                    // Binary search approach to find the earliest available offset
                    if let Some(valid_offset) = self.find_earliest_valid_offset(partition_client).await {
                        info!("Found earliest valid offset: {}", valid_offset);
                        self.current_offset = valid_offset;
                    } else {
                        // Fallback: start from a reasonable offset and let the system handle errors
                        warn!("Could not determine valid offset range, starting from offset 1");
                        self.current_offset = 1;
                    }
                } else {
                    return Err(anyhow!("Failed to discover starting offset: {}", e));
                }
            }
        }
        
        info!("Starting consumption from offset: {}", self.current_offset);
        Ok(())
    }

    async fn find_earliest_valid_offset(&self, partition_client: &rskafka::client::partition::PartitionClient) -> Option<i64> {
        // Try to find a valid offset using exponential search
        let mut test_offset = 1i64;
        let max_offset = 1000000i64; // Reasonable upper limit
        
        // First, find an upper bound where fetch works
        while test_offset < max_offset {
            match partition_client.fetch_records(test_offset, 1..100, 100).await {
                Ok((_, high_watermark)) => {
                    info!("Found working offset: {}, high_watermark: {}", test_offset, high_watermark);
                    // Start from the high watermark (latest) to consume only new messages
                    return Some(high_watermark.max(test_offset));
                }
                Err(e) => {
                    if !e.to_string().contains("OffsetOutOfRange") {
                        // Different error, stop searching
                        break;
                    }
                    test_offset *= 2; // Exponential search
                }
            }
        }
        
        warn!("Could not find any valid offset in range 1 to {}", max_offset);
        None
    }

    async fn process_kafka_record(&mut self, record: &Record) -> Result<()> {
        if let Some(payload) = &record.value {
            let message_str = std::str::from_utf8(payload)?;
            info!("Received Kafka message: {}", message_str);

            // Parse the verification message
            let verification: VerificationMessage = serde_json::from_str(message_str)?;
            
            info!("User: {}, DID: {}, Result: {}", 
                  verification.user_wallet, verification.did_id, verification.result);
            
            // Process the verification
            if let Some(user_did_id) = self.execute_start_verification(
                &verification.user_wallet,
                verification.did_id,
            ).await? {
                info!("UserDID created successfully: {}", user_did_id);
                
                if verification.result == "verified" {
                    info!("Processing verified result - calling update_verification_status");
                    
                    let signature = self.generate_nautilus_signature(&verification)?;
                    let signature_timestamp_ms = self.parse_timestamp_to_ms(&verification.verified_at)?;
                    
                    self.execute_update_verification_status(
                        &verification.user_wallet,
                        &user_did_id,
                        true,
                        signature,
                        signature_timestamp_ms,
                        &verification.evidence_hash,
                    ).await?;
                } else {
                    info!("Skipping update for non-verified result: {}", verification.result);
                }
            } else {
                warn!("Could not extract UserDID ID, skipping update_verification_status");
            }
        }

        Ok(())
    }

    async fn test_sui_client(&self) -> Result<()> {
        info!("Testing sui client configuration...");
        
        let output = Command::new("sui")
            .args(["client", "active-address"])
            .output()
            .map_err(|e| anyhow!("Failed to execute sui client: {}", e))?;

        if output.status.success() {
            let active_address = String::from_utf8_lossy(&output.stdout).trim().to_string();
            info!("Sui client active address: {}", active_address);
            
            // Test gas balance
            let gas_output = Command::new("sui")
                .args(["client", "gas"])
                .output()
                .map_err(|e| anyhow!("Failed to check gas: {}", e))?;
                
            if gas_output.status.success() {
                info!("Gas coins available");
                info!("Gas info: {}", String::from_utf8_lossy(&gas_output.stdout).lines().take(3).collect::<Vec<_>>().join(" | "));
            } else {
                warn!("Could not check gas coins: {}", String::from_utf8_lossy(&gas_output.stderr));
            }
        } else {
            return Err(anyhow!("Sui client not configured properly: {}", String::from_utf8_lossy(&output.stderr)));
        }
        
        Ok(())
    }

    async fn execute_start_verification(
        &self,
        user_address: &str,
        kafka_did_id: u8,
    ) -> Result<Option<String>> {
        info!("Executing start_verification transaction...");
        
        // Map Kafka DID ID to contract DID type:
        // Kafka 0 → Contract 1 (DID_AGE_VERIFY)
        // Kafka 1 → Contract 2 (DID_CITIZENSHIP_VERIFY)
        let contract_did_type = match kafka_did_id {
            0 => DID_AGE_VERIFY,        // Age verification
            1 => DID_CITIZENSHIP_VERIFY, // Citizenship verification
            _ => {
                warn!("Unknown DID ID from Kafka: {}, defaulting to age verification", kafka_did_id);
                DID_AGE_VERIFY
            }
        };
        
        info!("Mapping: Kafka DID {} → Contract DID {}", kafka_did_id, contract_did_type);
        
        // Execute sui client call command for start_verification
        let output = Command::new("sui")
            .args([
                "client",
                "call",
                "--package", &self.package_id,
                "--module", "did_registry",
                "--function", "start_verification",
                "--args", 
                &self.registry_id,              // registry
                &self.cap_id,                   // cap
                user_address,                   // user_address
                &contract_did_type.to_string(), // did_type (contract value)
                &self.clock_id,                 // clock
                "--gas-budget", "10000000"
            ])
            .output()
            .map_err(|e| anyhow!("Failed to execute sui command: {}", e))?;

        // Process the output
        if output.status.success() {
            info!("start_verification executed successfully for user: {}", user_address);
            let output_str = String::from_utf8_lossy(&output.stdout);
            info!("Output: {}", output_str);
            
            // Extract UserDID object ID from the transaction output
            if let Some(user_did_id) = extract_user_did_id(&output_str) {
                info!("Extracted UserDID ID: {}", user_did_id);
                return Ok(Some(user_did_id));
            } else {
                warn!("Could not extract UserDID ID from transaction output");
            }
            
            if !output.stderr.is_empty() {
                warn!("Warnings: {}", String::from_utf8_lossy(&output.stderr));
            }
        } else {
            error!("start_verification failed for user: {}", user_address);
            error!("Exit code: {}", output.status.code().unwrap_or(-1));
            error!("STDERR: {}", String::from_utf8_lossy(&output.stderr));
            error!("STDOUT: {}", String::from_utf8_lossy(&output.stdout));
            
            return Err(anyhow!("Transaction execution failed with exit code: {} - STDERR: {} - STDOUT: {}", 
                output.status.code().unwrap_or(-1),
                String::from_utf8_lossy(&output.stderr),
                String::from_utf8_lossy(&output.stdout)));
        }

        Ok(None)
    }

    fn generate_nautilus_signature(&self, verification: &VerificationMessage) -> Result<Vec<u8>> {
        // Create a payload to sign (this should match your verification format)
        let payload = format!(
            "{}:{}:{}:{}:{}",
            verification.user_wallet,
            verification.did_id,
            verification.result,
            verification.evidence_hash,
            verification.verified_at
        );
        
        // Sign the payload with the enclave keypair
        let signature = self.keypair.sign(payload.as_bytes());
        
        info!("Generated Nautilus signature for user: {}", verification.user_wallet);
        
        Ok(signature.as_ref().to_vec())
    }

    /// Parse ISO timestamp to milliseconds since epoch
    fn parse_timestamp_to_ms(&self, timestamp_str: &str) -> Result<u64> {
        let dt = DateTime::parse_from_rfc3339(&format!("{}Z", timestamp_str))
            .or_else(|_| {
                // Try parsing without timezone if the above fails
                let utc_str = if timestamp_str.ends_with('Z') {
                    timestamp_str.to_string()
                } else {
                    format!("{}Z", timestamp_str)
                };
                DateTime::parse_from_rfc3339(&utc_str)
            })
            .map_err(|e| anyhow!("Failed to parse timestamp '{}': {}", timestamp_str, e))?;
        
        let timestamp_ms = dt.timestamp_millis() as u64;
        info!("Converted timestamp '{}' to {} ms", timestamp_str, timestamp_ms);
        
        Ok(timestamp_ms)
    }

    async fn execute_update_verification_status(
        &self,
        user_address: &str,
        user_did_id: &str,
        verified: bool,
        nautilus_signature: Vec<u8>,
        signature_timestamp_ms: u64,  // When signature was created
        evidence_hash: &str,          // OCR hash from Python
    ) -> Result<()> {
        info!("Executing update_verification_status transaction...");
        info!("Signature timestamp: {}", signature_timestamp_ms);
        info!("Evidence hash: {}", evidence_hash);
        
        // Encode signature as base64 for CLI
        let signature_b64 = general_purpose::STANDARD.encode(&nautilus_signature);
        
        // Convert evidence hash to vector<u8> format for CLI
        let evidence_hash_bytes = hex::decode(evidence_hash)
            .map_err(|e| anyhow!("Failed to decode evidence hash: {}", e))?;
        let evidence_hash_b64 = general_purpose::STANDARD.encode(&evidence_hash_bytes);
        
        info!("Processing address: {}", user_address);
        
        // Execute sui client call command
        let output = Command::new("sui")
            .args([
                "client",
                "call",
                "--package", &self.package_id,
                "--module", "did_registry",
                "--function", "update_verification_status",
                "--args", 
                &self.registry_id,                    // registry
                &self.cap_id,                         // cap
                user_did_id,                          // user_did (the UserDID object ID we extracted)
                &verified.to_string(),                // verified
                &signature_b64,                       // nautilus_signature
                &signature_timestamp_ms.to_string(),  // signature_timestamp_ms
                &evidence_hash_b64,                   // evidence_hash
                &self.clock_id,                       // clock
                "--gas-budget", "10000000"
            ])
            .output()
            .map_err(|e| anyhow!("Failed to execute sui command: {}", e))?;

        // Process the output
        if output.status.success() {
            info!("update_verification_status executed successfully for user: {}", user_address);
            info!("Output: {}", String::from_utf8_lossy(&output.stdout));
            
            if !output.stderr.is_empty() {
                warn!("Warnings: {}", String::from_utf8_lossy(&output.stderr));
            }
        } else {
            error!("update_verification_status failed for user: {}", user_address);
            error!("Exit code: {}", output.status.code().unwrap_or(-1));
            error!("STDERR: {}", String::from_utf8_lossy(&output.stderr));
            error!("STDOUT: {}", String::from_utf8_lossy(&output.stdout));
            
            return Err(anyhow!("update_verification_status failed with exit code: {} - STDERR: {} - STDOUT: {}", 
                output.status.code().unwrap_or(-1),
                String::from_utf8_lossy(&output.stderr),
                String::from_utf8_lossy(&output.stdout)));
        }

        Ok(())
    }
}

/// Extract UserDID object ID from Sui transaction output
fn extract_user_did_id(output: &str) -> Option<String> {
    let lines: Vec<&str> = output.lines().collect();
    let mut i = 0;
    
    // Look for Created Objects section and find the UserDID object
    while i < lines.len() {
        let line = lines[i];
        
        // Look for ObjectID line
        if line.contains("ObjectID:") && line.contains("0x") {
            // Extract the object ID
            if let Some(start) = line.find("0x") {
                let id_part = &line[start..];
                let object_id = if let Some(end) = id_part.find(char::is_whitespace) {
                    &id_part[..end]
                } else {
                    id_part.trim()
                };
                
                // Look ahead for ObjectType line to check if this is a UserDID
                for j in (i+1)..(i+5).min(lines.len()) {
                    let next_line = lines[j];
                    if next_line.contains("ObjectType:") && next_line.contains("::did_registry::UserDID") {
                        info!("Found UserDID object: {}", object_id);
                        return Some(object_id.to_string());
                    }
                    // Stop looking if we hit another ObjectID (next object)
                    if next_line.contains("ObjectID:") {
                        break;
                    }
                }
            }
        }
        i += 1;
    }
    
    warn!("Could not find UserDID object in transaction output");
    None
}

// Function to start the RSKafka-Sui processor as a background task
pub async fn start_kafka_sui_processor(keypair: Ed25519KeyPair) -> Result<()> {
    // Read Kafka configuration from environment variables
    let kafka_host = std::env::var("KAFKA_HOST")
        .unwrap_or_else(|_| "localhost".to_string());
    let kafka_port = std::env::var("KAFKA_PORT")
        .unwrap_or_else(|_| "9092".to_string());
    let kafka_topic = std::env::var("KAFKA_TOPIC")
        .unwrap_or_else(|_| "verified-user-data".to_string());
    
    let bootstrap_servers = format!("{}:{}", kafka_host, kafka_port);
    
    info!("Starting Kafka processor with configuration:");
    info!("  Bootstrap servers: {}", bootstrap_servers);
    info!("  Topic: {}", kafka_topic);
    
    let mut processor = RSKafkaSuiProcessor::new(
        &bootstrap_servers,
        &kafka_topic,
        0,                              // Partition (start with partition 0)
        keypair,
    )?;
    
    processor.start_processing().await
}
