import { SuiClient } from '@mysten/sui/client';
import type { EventId, SuiEvent, SuiEventFilter } from '@mysten/sui/client';
import { TESTNET_PACKAGE_ID } from '../Contansts';

// Sui Configuration
const fullnode = 'https://fullnode.testnet.sui.io:443';
const client = new SuiClient({ url: fullnode });

// Updated package ID
const packageId = TESTNET_PACKAGE_ID;

// Configuration
const POLLING_INTERVAL_MS = 2000; // 2 seconds

type SuiEventsCursor = EventId | null | undefined;

type EventExecutionResult = {
    cursor: SuiEventsCursor;
    hasNextPage: boolean;
};

type EventTracker = {
    type: string;
    filter: SuiEventFilter;
    callback: (events: SuiEvent[], type: string) => Promise<void>;
};

// In-memory cursor storage
const cursors: Map<string, EventId> = new Map();

// Enhanced event data interface for VerificationCompleted events
export interface VerificationCompletedEventData {
    user_address: string;
    status: number;
    user_did_id: string;
    did_type: number;
    registry_id: string;
    nautilus_signature: number[];
    signature_timestamp_ms: string;  // Will be converted from number to string
    evidence_hash: number[];         // Byte array from contract
}

// Callback function to notify the UI about verification completion
let verificationCallback: ((eventData: VerificationCompletedEventData) => void) | null = null;

// Set the callback function from the UI
export const setVerificationCallback = (callback: (eventData: VerificationCompletedEventData) => void) => {
    verificationCallback = callback;
};

// Event handlers for DID Registry events
const handleDIDRegistryEvents = async (events: SuiEvent[], type: string): Promise<void> => {
    console.log(`📋 Processing ${events.length} DID Registry events from ${type}`);
    
    for (const event of events) {
        console.log(`🔔 DID Registry Event Detected:`);
        console.log(`   - Event Type: ${event.type}`);
        console.log(`   - Transaction Digest: ${event.id.txDigest}`);
        console.log(`   - Sender: ${event.sender}`);
        console.log(`   - Timestamp: ${event.timestampMs ? new Date(parseInt(event.timestampMs)) : 'N/A'}`);
        
        if (event.parsedJson) {
            console.log(`   - Event Data:`, JSON.stringify(event.parsedJson, null, 2));
        }
        
        // Process the DID event
        await processDIDEvent(event);
    }
};

// Custom DID event processing logic
const processDIDEvent = async (event: SuiEvent): Promise<void> => {
    try {
        const eventType = event.type;
        const eventData = event.parsedJson as any;
        
        // Handle VerificationCompleted events
        if (eventType.includes('::VerificationCompleted')) {
            console.log(`🎉 VERIFICATION COMPLETED EVENT!`);
            console.log(`📍 User Address: ${eventData.user_address}`);
            console.log(`🆔 DID Type: ${eventData.did_type} (${getDIDTypeName(eventData.did_type)})`);
            console.log(`✅ Status: ${eventData.status} (${getStatusName(eventData.status)})`);
            console.log(`🔐 Nautilus Signature: ${eventData.nautilus_signature ? 'Present' : 'Missing'}`);
            console.log(`🎯 User DID ID: ${eventData.user_did_id}`);
            console.log(`📅 Signature Timestamp: ${eventData.signature_timestamp_ms || 'N/A'}`);
            console.log(`🔍 Evidence Hash: ${eventData.evidence_hash ? 'Present' : 'Missing'}`);
            
            // Create enhanced event data object
            const enhancedEventData: VerificationCompletedEventData = {
                user_address: eventData.user_address,
                status: eventData.status,
                user_did_id: eventData.user_did_id,
                did_type: eventData.did_type,
                registry_id: eventData.registry_id,
                nautilus_signature: eventData.nautilus_signature || [],
                signature_timestamp_ms: eventData.signature_timestamp_ms?.toString() || '0',
                evidence_hash: eventData.evidence_hash || []
            };
            
            // Notify the UI about verification completion with enhanced data
            if (verificationCallback) {
                verificationCallback(enhancedEventData);
            }
            
            // Handle verification completion
            await handleVerificationCompleted(eventData);
            
        } else if (eventType.includes('::VerificationStarted')) {
            console.log(`🚀 VERIFICATION STARTED EVENT!`);
            console.log(`📍 User Address: ${eventData.user_address}`);
            console.log(`🆔 DID Type: ${eventData.did_type} (${getDIDTypeName(eventData.did_type)})`);
            console.log(`🎯 User DID ID: ${eventData.user_did_id}`);
            
        } else if (eventType.includes('::DIDClaimed')) {
            console.log(`🏆 DID NFT CLAIMED EVENT!`);
            console.log(`📍 User Address: ${eventData.user_address}`);
            console.log(`🎨 NFT ID: ${eventData.nft_id}`);
        }
        
    } catch (error) {
        console.error(`❌ Error processing DID event ${event.id.txDigest}:`, error);
    }
};

// Helper functions for DID types and statuses
const getDIDTypeName = (didType: number): string => {
    switch (didType) {
        case 1: return 'Age Verification';
        case 2: return 'Citizenship Verification';
        default: return 'Unknown';
    }
};

const getStatusName = (status: number): string => {
    switch (status) {
        case 0: return 'Pending';
        case 1: return 'Verified';
        case 2: return 'Rejected';
        default: return 'Unknown';
    }
};

// Custom handler for verification completed events
const handleVerificationCompleted = async (eventData: any): Promise<void> => {
    try {
        console.log(`🔄 Processing verification completion for user ${eventData.user_address}`);
        
        if (eventData.status === 1) { // STATUS_VERIFIED
            console.log(`✅ User ${eventData.user_address} successfully verified!`);
        } else if (eventData.status === 2) { // STATUS_REJECTED
            console.log(`❌ User ${eventData.user_address} verification rejected`);
        }
        
    } catch (error) {
        console.error(`❌ Error handling verification completion:`, error);
    }
};

// Events to track - DID Registry events
const EVENTS_TO_TRACK: EventTracker[] = [
    {
        type: `${packageId}::did_registry`,
        filter: {
            MoveEventModule: {
                module: 'did_registry',
                package: packageId,
            },
        },
        callback: handleDIDRegistryEvents,
    },
];

const executeEventJob = async (
    client: SuiClient,
    tracker: EventTracker,
    cursor: SuiEventsCursor,
): Promise<EventExecutionResult> => {
    try {
        // Get the events from the chain
        const { data, hasNextPage, nextCursor } = await client.queryEvents({
            query: tracker.filter,
            cursor,
            order: 'ascending',
        });
        
        if (data.length > 0) {
            console.log(`📋 Found ${data.length} new events for ${tracker.type}`);
            
            // Handle the events
            await tracker.callback(data, tracker.type);
            
            // Update the cursor if we fetched new data
            if (nextCursor) {
                await saveLatestCursor(tracker, nextCursor);
                return {
                    cursor: nextCursor,
                    hasNextPage,
                };
            }
        }
        
    } catch (error) {
        console.error(`❌ Error in executeEventJob for ${tracker.type}:`, error);
    }
    
    return {
        cursor,
        hasNextPage: false,
    };
};

const runEventJob = async (client: SuiClient, tracker: EventTracker, cursor: SuiEventsCursor) => {
    const result = await executeEventJob(client, tracker, cursor);
    
    // Continue polling
    setTimeout(
        () => {
            runEventJob(client, tracker, result.cursor);
        },
        result.hasNextPage ? 0 : POLLING_INTERVAL_MS,
    );
};

// Get the latest cursor for an event tracker
const getLatestCursor = async (tracker: EventTracker): Promise<SuiEventsCursor> => {
    return cursors.get(tracker.type) || undefined;
};

// Save the latest cursor for an event tracker
const saveLatestCursor = async (tracker: EventTracker, cursor: EventId): Promise<void> => {
    cursors.set(tracker.type, cursor);
    console.log(`💾 Saved cursor for ${tracker.type}: ${cursor.eventSeq}`);
};

// Start the event listener
export const startEventListener = async (): Promise<void> => {
    console.log('🚀 Starting Sui Event Listener for user verification...');
    
    try {
        // Test connection
        const latestCheckpoint = await client.getLatestCheckpointSequenceNumber();
        console.log(`✅ Connected to Sui network. Latest checkpoint: ${latestCheckpoint}`);
        
        console.log('⚙️ Configuration:');
        console.log(`   - Package ID: ${packageId}`);
        console.log(`   - Polling Interval: ${POLLING_INTERVAL_MS}ms`);
        
        // Start listening for events
        for (const event of EVENTS_TO_TRACK) {
            console.log(`🎯 Starting listener for: ${event.type}`);
            const cursor = await getLatestCursor(event);
            runEventJob(client, event, cursor);
        }
        
        console.log('✅ Event listener is now running');
        
    } catch (error) {
        console.error('❌ Failed to start event listener:', error);
        throw error;
    }
};

// Stop the event listener
export const stopEventListener = () => {
    console.log('🛑 Stopping Sui Event Listener...');
    // Clear all cursors
    cursors.clear();
    verificationCallback = null;
};
