import React, { useState, useRef } from 'react';
import { ChevronLeft, Upload, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { colors } from '../brand';
import { useCurrentAccount } from '@mysten/dapp-kit';

interface AadhaarData {
  name?: string;
  dob?: string;
  gender?: string;
  phone_number?: string;
  address?: string;
  aadhaar_number?: string;
  aadhaar_photo_base64?: string;
}

interface AadhaarUploadStepProps {
  onNext: () => void;
  onBack: () => void;
  onFileUpload: (data: AadhaarData) => void;
}

const AadhaarUploadStep: React.FC<AadhaarUploadStepProps> = ({ onNext, onBack, onFileUpload }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aadhaarData, setAadhaarData] = useState<AadhaarData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentAccount = useCurrentAccount();

  const API_BASE = 'http://localhost:8000';

  const handleApiCall = async (url: string, formData: FormData) => {
    try {
      const response = await fetch(`${API_BASE}${url}`, {
        method: 'POST',
        body: formData,
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

  const handleAadhaarUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Add wallet address if connected
      if (currentAccount?.address) {
        formData.append('wallet_address', currentAccount.address);
      }
      
      const result = await handleApiCall('/api/aadhaar/extract-aadhaar-data', formData);
      
      if (result.data) {
        const data = result.data as AadhaarData;
        
        // // Check if the message indicates no readable data found
        // if (result.message && result.message.includes('Image processed but no readable data found')) {
        //   setError('Please upload a clearer image.');
        //   setPreviewUrl(null); // Clear the preview
        //   return;
        // }
        
        setAadhaarData(data);
        onFileUpload(data);
      } else {
        setError(result.message || 'Failed to process Aadhaar image.');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred while processing the Aadhaar image';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === "image/jpeg" || file.type === "image/png")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      handleAadhaarUpload(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (aadhaarData) {
      onNext();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full"
    >
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
          Upload Aadhaar Card
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
        {aadhaarData && !error && (
          <div className="p-4 rounded-2xl" style={{ backgroundColor: `${colors.primary}10`, border: `1px solid ${colors.primary}30` }}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5" style={{ color: colors.primary }} />
              <h4 className="font-semibold" style={{ color: colors.white }}>Aadhaar Data Extracted</h4>
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm">
              {aadhaarData.aadhaar_number && (
                <div>
                  <span className="font-medium" style={{ color: colors.primary }}>Aadhaar Number:</span>
                  <span className="ml-2" style={{ color: colors.lightBlue }}>{aadhaarData.aadhaar_number}</span>
                </div>
              )}
              {aadhaarData.phone_number && (
                <div>
                  <span className="font-medium" style={{ color: colors.primary }}>Phone Number:</span>
                  <span className="ml-2" style={{ color: colors.lightBlue }}>{aadhaarData.phone_number}</span>
                </div>
              )}
              {aadhaarData.dob && (
                <div>
                  <span className="font-medium" style={{ color: colors.primary }}>Date of Birth:</span>
                  <span className="ml-2" style={{ color: colors.lightBlue }}>{aadhaarData.dob}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Upload Area */}
        {!previewUrl ? (
          <div className="border-2 border-dashed rounded-2xl p-8 text-center transition-colors"
               style={{ 
                 borderColor: error ? '#ef4444' : `${colors.primary}40`,
                 backgroundColor: error ? '#ef444410' : `${colors.primary}05`
               }}>
            <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: error ? '#ef4444' : colors.primary }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: colors.white }}>Upload Aadhaar Card</h3>
            <p className="mb-6" style={{ color: colors.lightBlue }}>Choose a clear image of your Aadhaar card (JPG, PNG)</p>
            
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="inline-flex items-center underline underline-offset-2 gap-2 px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 text-white"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {isLoading ? 'Processing...' : 'Choose File'}
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg, image/png"
              onChange={handleFileChange}
              className="hidden"
              disabled={isLoading}
            />
          </div>
        ) : (
          <div className="text-center">
            <div className="relative inline-block mx-auto">
              <img
                src={previewUrl}
                alt="Aadhaar preview"
                className="max-w-full mx-auto max-h-48 rounded-2xl border-2"
                style={{ borderColor: `${colors.primary}40` }}
              />
            </div>
            <p className="font-medium mb-2" style={{ color: colors.primary }}></p>
            
            <button
              type="button"
              onClick={() => {setPreviewUrl(null); setAadhaarData(null); setError(null);}}
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: colors.primary }}
            >
              Upload Different Image
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={!aadhaarData || isLoading}
          className="w-full py-3 px-6 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white"
          style={{ background: colors.gradients.primary }}
        >
         {isLoading ? "Extracting  data..." : "Next"}
        </button>
      </div>
    </form>
  );
};

export default AadhaarUploadStep;
