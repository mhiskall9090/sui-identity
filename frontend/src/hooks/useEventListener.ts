import { useState, useEffect, useCallback } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { startEventListener, setVerificationCallback, stopEventListener, type VerificationCompletedEventData } from '../services/eventListener';

export interface VerificationStatus {
    isListening: boolean;
    isVerified: boolean;
    verificationMessage: string;
    userAddress: string | null;
    userDidId: string | null;
    // Enhanced event data for NFT claiming
    eventData: VerificationCompletedEventData | null;
}

export const useVerificationListener = () => {
    const currentAccount = useCurrentAccount();
    const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>({
        isListening: false,
        isVerified: false,
        verificationMessage: '',
        userAddress: null,
        userDidId: null,
        eventData: null
    });

    // Handle verification completion from event listener
    const handleVerificationEvent = useCallback((eventData: VerificationCompletedEventData) => {
        const currentUserAddress = currentAccount?.address;
        
        console.log(`🎯 Event received for address: ${eventData.user_address}`);
        console.log(`🔍 Current user address: ${currentUserAddress}`);
        console.log(`📅 Signature timestamp: ${eventData.signature_timestamp_ms}`);
        console.log(`🔍 Evidence hash length: ${eventData.evidence_hash.length}`);
        
        // Check if the event is for the current logged-in user
        if (currentUserAddress && eventData.user_address === currentUserAddress) {
            console.log(`✅ Event matches current user!`);
            
            if (eventData.status === 1) { // STATUS_VERIFIED
                setVerificationStatus(prev => ({
                    ...prev,
                    isVerified: true,
                    verificationMessage: '✅ Verification completed from event listener!',
                    userDidId: eventData.user_did_id,
                    eventData: eventData  // Store complete event data for NFT claiming
                }));
                
                // Show success notification
                console.log('🎉 VERIFICATION COMPLETED FROM EVENT LISTENER!');
                
            } else if (eventData.status === 2) { // STATUS_REJECTED
                setVerificationStatus(prev => ({
                    ...prev,
                    isVerified: false,
                    verificationMessage: '❌ Verification rejected from event listener',
                    userDidId: eventData.user_did_id,
                    eventData: eventData
                }));
            }
        } else {
            console.log(`ℹ️ Event for different user, ignoring`);
        }
    }, [currentAccount?.address]);

    // Start listening for verification events
    const startListening = useCallback(async () => {
        if (!currentAccount?.address) {
            console.warn('⚠️ No wallet connected, cannot start event listener');
            return;
        }

        try {
            console.log(`🚀 Starting verification listener for address: ${currentAccount.address}`);
            
            // Set the callback for event notifications
            setVerificationCallback(handleVerificationEvent);
            
            // Start the event listener
            await startEventListener();
            
            setVerificationStatus(prev => ({
                ...prev,
                isListening: true,
                userAddress: currentAccount.address,
                verificationMessage: 'Listening for verification events...',
                userDidId: null
            }));
            
        } catch (error) {
            console.error('❌ Failed to start verification listener:', error);
            setVerificationStatus(prev => ({
                ...prev,
                verificationMessage: 'Failed to start event listener',
                userDidId: null
            }));
        }
    }, [currentAccount?.address, handleVerificationEvent]);

    // Stop listening for verification events
    const stopListening = useCallback(() => {
        console.log('🛑 Stopping verification listener');
        stopEventListener();
        
        setVerificationStatus({
            isListening: false,
            isVerified: false,
            verificationMessage: '',
            userAddress: null,
            userDidId: null,
            eventData: null
        });
    }, []);

    // Reset verification status
    const resetVerification = useCallback(() => {
        setVerificationStatus(prev => ({
            ...prev,
            isVerified: false,
            verificationMessage: prev.isListening ? 'Listening for verification events...' : '',
            userDidId: null,
            eventData: null
        }));
    }, []);

    // Auto-start listener when wallet is connected
    useEffect(() => {
        if (currentAccount?.address && !verificationStatus.isListening) {
            startListening();
        }
        
        // Cleanup on unmount or wallet disconnect
        return () => {
            if (verificationStatus.isListening) {
                stopListening();
            }
        };
    }, [currentAccount?.address]);

    // Update user address when account changes
    useEffect(() => {
        setVerificationStatus(prev => ({
            ...prev,
            userAddress: currentAccount?.address || null,
            userDidId: null
        }));
    }, [currentAccount?.address]);

    return {
        verificationStatus,
        startListening,
        stopListening,
        resetVerification
    };
};



