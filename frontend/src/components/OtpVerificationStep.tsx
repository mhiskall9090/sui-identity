import React, { useState } from 'react';
import { ChevronLeft, Phone, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { colors } from '../brand';
import { DocumentData } from './types';

interface OtpVerificationStepProps {
  onNext: () => void;
  onBack: () => void;
  phoneNumber: string;
  documentData?: DocumentData;
  verificationType?: string; // 'above18' or 'citizenship'
}

const OtpVerificationStep: React.FC<OtpVerificationStepProps> = ({ onNext, onBack, phoneNumber, documentData, verificationType = 'above18' }) => {
  const [step, setStep] = useState<'generate' | 'verify'>('generate');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const currentAccount = useCurrentAccount();
  // Auto-set DID based on verification type
  const getDid = () => {
    return verificationType === 'above18' ? 0 : 1;
  };

  const API_BASE = 'http://localhost:8000';

  const handleApiCall = async (url: string, params: Record<string, string>) => {
    try {
      const response = await fetch(`${API_BASE}${url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params).toString(),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return result;
    } catch (err) {
      console.error('API call failed:', err);
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new Error('Network error: Please ensure the backend server is running on localhost:8000 (via SSH tunnel)');
      }
      throw err;
    }
  };
  const generateOtp = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = {
        phone: phoneNumber
      };

      const result = await handleApiCall('/api/otp/generate-otp', params);

      if (result.success) {
        setOtpSent(true);
        setStep('verify');
      } else {
        setError(result.message || 'Failed to generate OTP. Please check the phone number.');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate OTP';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpVerification = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if wallet is connected
      if (!currentAccount?.address) {
        setError('Please connect your wallet first');
        setIsLoading(false);
        return;
      }

      const params: Record<string, string> = {
        phone: phoneNumber,
        otp: otp,
        wallet_address: currentAccount.address,
        did: getDid().toString(),
      };

      console.log(`🔍 Frontend: Sending OTP verification with DID: ${getDid()} for verification type: ${verificationType}`);
      console.log(`🔍 Frontend: Wallet address: ${currentAccount.address}`);

      // Add document data if available
      if (documentData) {
        if (documentData.document_number) params.document_number = documentData.document_number;
        if (documentData.dob) params.date_of_birth = documentData.dob;
        if (documentData.name) params.full_name = documentData.name;
        if (documentData.gender) params.gender = documentData.gender;
        params.document_type = documentData.document_type || '';
        params.verification_type = verificationType;
      }

      const result = await handleApiCall('/api/otp/verify-otp', params);

      if (result.success) {
        localStorage.setItem('verificationCompleted', 'true');

        // Store user data if saved to database
        if (result.data.user_saved && result.data.wallet_address) {
          localStorage.setItem('userWalletAddress', result.data.wallet_address);
          localStorage.setItem('userData', JSON.stringify(result.data.user_data));

          // Show success toast for database save
          toast.success('🎉 Verification completed! Your data has been saved successfully.', {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        } else {
          // Show success toast for OTP verification only
          toast.success('✅ OTP verified successfully!', {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        }

        // Show success message
        console.log('✅ OTP Verification Successful:', result.message);

        onNext();
      } else {
        setError(result.message || 'OTP verification failed. Please check the code and try again.');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'OTP verification failed';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length === 6) {
      handleOtpVerification();
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-4 mb-6">
        <button 
          type="button" 
          onClick={onBack} 
          className="p-2 rounded-full transition-colors"
          style={{ backgroundColor: `${colors.primary}20` }}
        >
          <ChevronLeft className="w-5 h-5" style={{ color: colors.primary }} />
        </button>
        <h2 className="text-xl font-semibold" style={{ color: colors.white }}>
          {step === 'generate' ? 'Generate OTP' : 'Verify OTP'}
        </h2>
      </div>

      <div className="space-y-6">
        {/* Error Display */}
        {error && (
          <div className="p-4 rounded-2xl flex items-center gap-3" style={{ backgroundColor: `${colors.primary}10`, border: `1px solid #ef4444` }}>
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-sm" style={{ color: colors.white }}>{error}</p>
          </div>
        )}

        {/* Success Display */}
        {otpSent && (
          <div className="p-4 rounded-2xl flex items-center gap-3" style={{ backgroundColor: `${colors.primary}10`, border: `1px solid #10b981` }}>
            <CheckCircle className="w-5 h-5" style={{ color: '#10b981' }} />
            <p className="text-sm" style={{ color: colors.white }}>OTP sent successfully to {phoneNumber}</p>
          </div>
        )}

        {step === 'generate' ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${colors.primary}20` }}>
              <Phone className="w-8 h-8" style={{ color: colors.primary }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: colors.white }}>Send OTP</h3>
            <p className="mb-4" style={{ color: colors.lightBlue }}>
              We'll send a 6-digit verification code to:
            </p>
            <p className="text-lg font-semibold mb-6" style={{ color: colors.white }}>{phoneNumber}</p>

            <button
              onClick={generateOtp}
              disabled={isLoading}
              className="w-full py-3 px-6 rounded-xl font-medium transition-colors text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: colors.gradients.primary }}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Phone className="w-5 h-5" />
              )}
              {isLoading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleOtpSubmit} className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${colors.primary}20` }}>
                <svg className="w-8 h-8" style={{ color: colors.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: colors.white }}>Enter Verification Code</h3>
              <p className="text-sm mb-4" style={{ color: colors.lightBlue }}>We've sent a 6-digit code to {phoneNumber}</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.white }}>
                6-Digit OTP<span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 rounded-xl text-center text-2xl font-mono tracking-widest text-white placeholder-gray-400 focus:ring-2 focus:ring-opacity-50"
                style={{ 
                  backgroundColor: `${colors.primary}10`,
                  border: `1px solid ${colors.primary}40`,
                }}
                placeholder="000000"
                maxLength={6}
                required
              />
            </div>

            {/* Show verification type info */}
            <div className="p-3 rounded-2xl" style={{ backgroundColor: `${colors.primary}10`, border: `1px solid ${colors.primary}30` }}>
              <p className="text-sm" style={{ color: colors.white }}>
                <strong>Verification Type:</strong> {verificationType === 'above18' ? 'Above 18 Verification' : 'Citizenship Application'}
              </p>
              <p className="text-xs mt-1" style={{ color: colors.lightBlue }}>
                DID will be automatically set to {getDid()} for this verification type
              </p>
            </div>

            <button
              type="submit"
              disabled={otp.length !== 6 || isLoading}
              className="w-full py-3 px-6 rounded-xl font-medium transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: colors.gradients.primary }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify & Complete'
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={generateOtp}
                disabled={isLoading}
                className="text-sm disabled:opacity-50 hover:opacity-80 transition-opacity"
                style={{ color: colors.primary }}
              >
                Didn't receive code? Resend
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default OtpVerificationStep;
