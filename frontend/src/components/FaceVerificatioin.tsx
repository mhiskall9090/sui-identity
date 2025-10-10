import React, { useState, useRef, useCallback } from 'react';
import { ChevronLeft, Camera, RotateCcw, User } from 'lucide-react';
import Webcam from 'react-webcam';

interface FaceVerificationProps {
  onNext: () => void;
  onBack: () => void;
  aadhaarFile: File | null;
}

const FaceVerification: React.FC<FaceVerificationProps> = ({ onNext, onBack, aadhaarFile }) => {
  const webcamRef = useRef<Webcam>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedImage(imageSrc);
    }
  }, []);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
  }, []);

  const handleVerification = () => {
    setIsProcessing(true);
    
    // Simulate face verification process
    setTimeout(() => {
      setIsProcessing(false);
      onNext();
    }, 3000);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Face Verification</h2>
            <p className="text-gray-600">Take a live photo to verify your identity</p>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
              ✓
            </div>
            <div className="w-16 h-1 bg-[#00BFFF] mx-2"></div>
            <div className="w-8 h-8 bg-[#00BFFF] rounded-full flex items-center justify-center text-white text-sm font-medium">
              2
            </div>
          </div>
        </div>

        {/* Aadhaar Confirmation */}
        {aadhaarFile && (
          <div className="bg-gray-100 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-gray-900 font-medium">Aadhaar Uploaded</p>
                <p className="text-gray-600 text-sm">{aadhaarFile.name}</p>
              </div>
            </div>
          </div>
        )}

        {/* Camera Section */}
        <div className="mb-8">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Live Face Capture</h3>
            <p className="text-gray-600 text-sm">Position your face in the center and take a clear photo</p>
          </div>

          <div className="relative max-w-md mx-auto">
            {!capturedImage ? (
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
                {/* Face outline overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-60 border-2 border-[#00BFFF] rounded-full opacity-50"></div>
                </div>
              </div>
            ) : (
              <div className="relative">
                <img 
                  src={capturedImage} 
                  alt="Captured face" 
                  className="w-full rounded-lg border-2 border-gray-300" 
                />
                {isProcessing && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                    <div className="text-center text-gray-900">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00BFFF] mx-auto mb-2"></div>
                      <p className="text-sm">Verifying face...</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h4 className="text-blue-700 font-medium mb-2">Instructions:</h4>
          <ul className="text-blue-600 text-sm space-y-1">
            <li>• Look directly at the camera</li>
            <li>• Ensure good lighting</li>
            <li>• Remove glasses if possible</li>
            <li>• Keep a neutral expression</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          {!capturedImage ? (
            <button
              onClick={capture}
              className="w-full bg-[#00BFFF] text-white py-4 px-6 rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" />
              Take Photo
            </button>
          ) : (
            <div className="flex gap-4">
              <button
                onClick={retakePhoto}
                className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Retake
              </button>
              <button
                onClick={handleVerification}
                disabled={isProcessing}
                className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Verifying...' : 'Verify & Complete'}
              </button>
            </div>
          )}
          
          <button
            onClick={onBack}
            className="w-full bg-gray-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            Back to Aadhaar Upload
          </button>
        </div>
      </div>
    </div>
  );
};

export default FaceVerification;
