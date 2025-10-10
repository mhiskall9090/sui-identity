import React, { useState, useRef } from 'react';
import { X, Upload, Camera, Check, FileText, RotateCcw, AlertCircle, CheckCircle, Phone, Loader2 } from 'lucide-react';
import Webcam from 'react-webcam';
import { toast } from 'react-toastify';

type KycStep = 'aadhaar' | 'face' | 'generate-otp' | 'verify-otp' | 'complete';

// Types for API responses
interface AadhaarData {
  aadhaar_number?: string;
  phone_number?: string;
  dob?: string;
  aadhaar_photo_base64?: string;
}

interface FaceMatchResult {
  match: boolean;
  confidence: number;
  message: string;
  face_distance?: number;
  detection_method?: string;
  error_type?: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  data?: AadhaarData;
  error?: string;
}

interface KycModalProps {
  isOpen: boolean;
  onClose: () => void;
  verificationType: string;
}

const KycModal: React.FC<KycModalProps> = ({ isOpen, onClose, verificationType }) => {
  const [step, setStep] = useState<KycStep>('aadhaar');
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  
  // Backend integration state
  const [aadhaarData, setAadhaarData] = useState<AadhaarData | null>(null);
  const [faceResult, setFaceResult] = useState<FaceMatchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // API Configuration
  const API_BASE = 'http://localhost:8000';

  // Reset modal state when closed
  const handleClose = () => {
    setStep('aadhaar');
    setFaceImage(null);
    setOtp('');
    setAadhaarData(null);
    setFaceResult(null);
    setIsLoading(false);
    setError(null);
    setPhoneNumber('');
    setPreviewUrl(null);
    setIsProcessing(false);
    onClose();
  };

  // API call helper
  const handleApiCall = async (url: string, formData: FormData): Promise<ApiResponse> => {
    try {
      const response = await fetch(`${API_BASE}${url}`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (err) {
      console.error('API call failed:', err);
      throw new Error('Network error: Please ensure the backend server is running on localhost:8000 (via SSH tunnel)');
    }
  };

  const handleAadhaarUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const result = await handleApiCall('/api/aadhaar/extract-aadhaar-data', formData);
      
      console.log('API Response:', result);
      
      // Handle different response structures
      if (result.success && result.data) {
        setAadhaarData(result.data);
        setPhoneNumber(result.data.phone_number || '');
        toast.success('Aadhaar card uploaded successfully!');
        setStep('face');
      } else if (result.data && !result.success) {
        setAadhaarData(result.data);
        setPhoneNumber(result.data.phone_number || '');
        toast.success('Aadhaar card uploaded successfully!');
        setStep('face');
      } else {
        setError(result.message ||  'Failed to process Aadhaar image. Please ensure the image is clear and readable.');
        toast.error('Failed to extract Aadhaar data');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred while processing the Aadhaar image';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFaceVerification = async (capturedImage: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!aadhaarData?.aadhaar_photo_base64) {
        setError('Aadhaar photo not found. Please upload Aadhaar card first.');
        return;
      }

      if (!aadhaarData?.phone_number) {
        setError('Phone number not found in Aadhaar data. Cannot proceed with verification.');
        return;
      }
      
      const base64Image = capturedImage.includes(',') ? capturedImage.split(',')[1] : capturedImage;
      
      const response = await fetch(`${API_BASE}/api/face/verify-face`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aadhaar_photo_base64: aadhaarData.aadhaar_photo_base64,
          live_photo_base64: base64Image,
          phone_number: aadhaarData.phone_number
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        const errorMessage = result.detail || result.message || `HTTP error! status: ${response.status}`;
        setError(errorMessage);
        toast.error('Face verification failed');
        return;
      }
      
      if (result.success && result.data) {
        setFaceResult(result.data);
        
        if (result.data.match) {
          toast.success('Face verification successful!');
          setStep('generate-otp');
        } else {
          const failureMessage = result.data.message || 'Face verification failed. The faces do not match with sufficient confidence.';
          setError(`Face verification failed: ${failureMessage}`);
          toast.error('Face verification failed');
        }
      } else {
        setError(result.message || 'Face comparison failed. Please try again.');
        toast.error('Face verification failed');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Face verification failed';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate OTP
  const generateOtp = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('phone', phoneNumber);
      
      const result = await handleApiCall('/api/otp/generate-otp', formData);
      
      if (result.success) {
        toast.success('OTP sent successfully!');
        setStep('verify-otp');
      } else {
        setError(result.message || 'Failed to generate OTP. Please check the phone number.');
        toast.error('Failed to send OTP');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate OTP';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpVerification = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('phone', phoneNumber);
      formData.append('otp', otp);
      
      const result = await handleApiCall('/api/otp/verify-otp', formData);
      
      if (result.success) {
        toast.success('Verification completed successfully!');
        setStep('complete');
        localStorage.setItem('verificationCompleted', 'true');
        setTimeout(() => {
          handleClose();
          window.location.reload(); // Refresh to update the dashboard
        }, 2000);
      } else {
        setError(result.message || 'OTP verification failed. Please check the code and try again.');
        toast.error('OTP verification failed');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'OTP verification failed';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // File upload handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === "image/jpeg" || file.type === "image/png")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      handleAadhaarUpload(file);
    }
  };

  const capturePhoto = () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setFaceImage(imageSrc);
      setIsProcessing(true);
      handleFaceVerification(imageSrc).finally(() => {
        setIsProcessing(false);
      });
    }
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length === 6) {
      handleOtpVerification();
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{verificationType}</h2>
            <p className="text-sm text-gray-600">Complete your identity verification</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 py-4 bg-gray-50">
          <div className="flex items-center justify-center">
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                step === 'aadhaar' ? 'bg-[#00BFFF]' : 'bg-green-500'
              }`}>
                {step === 'aadhaar' ? '1' : '✓'}
              </div>
              <div className={`w-16 h-1 mx-2 ${
                ['face', 'generate-otp', 'verify-otp', 'complete'].includes(step) ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                step === 'face' ? 'bg-[#00BFFF]' : ['generate-otp', 'verify-otp', 'complete'].includes(step) ? 'bg-green-500' : 'bg-gray-300'
              }`}>
                {step === 'face' ? '2' : ['generate-otp', 'verify-otp', 'complete'].includes(step) ? '✓' : '2'}
              </div>
              <div className={`w-16 h-1 mx-2 ${
                ['generate-otp', 'verify-otp', 'complete'].includes(step) ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                step === 'generate-otp' ? 'bg-[#00BFFF]' : ['verify-otp', 'complete'].includes(step) ? 'bg-green-500' : 'bg-gray-300'
              }`}>
                {step === 'generate-otp' ? '3' : ['verify-otp', 'complete'].includes(step) ? '✓' : '3'}
              </div>
              <div className={`w-16 h-1 mx-2 ${
                ['verify-otp', 'complete'].includes(step) ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                step === 'verify-otp' ? 'bg-[#00BFFF]' : step === 'complete' ? 'bg-green-500' : 'bg-gray-300'
              }`}>
                {step === 'verify-otp' ? '4' : step === 'complete' ? '✓' : '4'}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
          {/* Step 1: Aadhaar Upload */}
          {step === 'aadhaar' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Aadhaar Card</h3>
              
              {/* Aadhaar Data Display */}
              {aadhaarData && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold text-green-800">Aadhaar Data Extracted</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    {aadhaarData.aadhaar_number && (
                      <div>
                        <span className="text-green-600 font-medium">Aadhaar Number:</span>
                        <p className="text-green-800">{aadhaarData.aadhaar_number}</p>
                      </div>
                    )}
                    {aadhaarData.phone_number && (
                      <div>
                        <span className="text-green-600 font-medium">Phone Number:</span>
                        <p className="text-green-800">{aadhaarData.phone_number}</p>
                      </div>
                    )}
                    {aadhaarData.dob && (
                      <div>
                        <span className="text-green-600 font-medium">Date of Birth:</span>
                        <p className="text-green-800">{aadhaarData.dob}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!previewUrl ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <FileText className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Upload Aadhaar Card</h4>
                  <p className="text-gray-600 mb-6">Choose a clear image of your Aadhaar card</p>
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-[#00BFFF] text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 mx-auto"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5" />
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
                  <div className="relative inline-block mb-4">
                    <img
                      src={previewUrl}
                      alt="Aadhaar preview"
                      className="max-w-full max-h-64 rounded-lg border border-gray-300"
                    />
                    <div className="absolute top-2 right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className="text-green-600 mb-4">✓ Aadhaar card uploaded successfully</p>
                </div>
              )}
            </div>
          )}
          {/* Step 2: Face Verification */}
          {step === 'face' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Face Verification</h3>
              
              {/* Face Verification Result */}
              {faceResult && (
                <div className={`mb-6 p-4 border rounded-lg ${
                  faceResult.match ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {faceResult.match ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    <h4 className={`font-semibold ${
                      faceResult.match ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {faceResult.match ? 'Face Verification Successful' : 'Face Verification Failed'}
                    </h4>
                  </div>
                  <div className="text-sm space-y-1">
                    <p className={faceResult.match ? 'text-green-700' : 'text-red-700'}>
                      Confidence: {faceResult.confidence.toFixed(1)}%
                    </p>
                    {faceResult.face_distance && (
                      <p className={faceResult.match ? 'text-green-700' : 'text-red-700'}>
                        Face Distance: {faceResult.face_distance.toFixed(3)}
                      </p>
                    )}
                    <p className={faceResult.match ? 'text-green-700' : 'text-red-700'}>
                      {faceResult.message}
                    </p>
                  </div>
                </div>
              )}

              <div className="text-center mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Live Face Capture</h4>
                <p className="text-gray-600 text-sm">Position your face in the center and take a clear photo</p>
              </div>

              <div className="relative max-w-md mx-auto mb-6">
                {!faceImage ? (
                  <div className="relative">
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      className="w-full rounded-lg border-2 border-gray-300"
                      videoConstraints={{
                        width: 640,
                        height: 480,
                        facingMode: "user"
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-60 border-2 border-[#00BFFF] rounded-full opacity-50"></div>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <img 
                      src={faceImage} 
                      alt="Captured face" 
                      className="w-full rounded-lg border-2 border-gray-300" 
                    />
                    {isProcessing && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                        <div className="text-center text-white">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00BFFF] mx-auto mb-2"></div>
                          <p className="text-sm">Verifying face...</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-4">
                {!faceImage ? (
                  <button
                    onClick={capturePhoto}
                    disabled={isLoading}
                    className="flex-1 bg-[#00BFFF] text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5" />
                    )}
                    {isLoading ? 'Processing...' : 'Take Photo'}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {setFaceImage(null); setError(null); setFaceResult(null);}}
                      disabled={isLoading}
                      className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <RotateCcw className="w-5 h-5" />
                      Retake
                    </button>
                    <button
                      onClick={() => faceResult?.match && setStep('generate-otp')}
                      disabled={isProcessing || !faceResult?.match}
                      className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {isProcessing ? 'Verifying...' : 'Next: Generate OTP'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Generate OTP */}
          {step === 'generate-otp' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate OTP</h3>
              
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-8 h-8 text-[#00BFFF]" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Send OTP</h4>
                <p className="text-gray-600 mb-4">
                  We'll send a 6-digit verification code to:
                </p>
                <p className="text-lg font-semibold text-gray-900 mb-6">{phoneNumber}</p>
                
                <button
                  onClick={generateOtp}
                  disabled={isLoading}
                  className="bg-[#00BFFF] text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Phone className="w-5 h-5" />
                  )}
                  {isLoading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Verify OTP */}
          {step === 'verify-otp' && (
            <>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Verify OTP</h3>
              
              <form onSubmit={handleOtpSubmit} className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-[#00BFFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Enter Verification Code</h4>
                  <p className="text-gray-600 text-sm mb-4">We've sent a 6-digit code to {phoneNumber}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    6-Digit OTP
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-center text-2xl font-mono tracking-widest focus:ring-2 focus:ring-[#00BFFF] focus:border-[#00BFFF]"
                    placeholder="000000"
                    maxLength={6}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={otp.length !== 6 || isLoading}
                  className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              </form>

              <div className="mt-6 text-center">
                <button 
                  onClick={generateOtp}
                  disabled={isLoading}
                  className="text-[#00BFFF] hover:text-blue-600 text-sm disabled:opacity-50"
                >
                  Didn't receive code? Resend
                </button>
              </div>
            </div>
            </>
          )}

          {/* Step 5: Complete */}
          {step === 'complete' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Verification Complete!</h3>
              <p className="text-gray-600 mb-4">Your credential NFT has been minted and added to your dashboard.</p>
              <div className="animate-pulse text-[#00BFFF]">Updating dashboard...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KycModal;