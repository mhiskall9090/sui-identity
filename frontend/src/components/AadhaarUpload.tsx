import React, { useState, useRef } from 'react';
import { ChevronLeft, Upload, Camera, Check, FileText } from 'lucide-react';

interface AadhaarUploadProps {
  onNext: (file: File) => void;
  onBack: () => void;
}

const AadhaarUpload: React.FC<AadhaarUploadProps> = ({ onNext, onBack }) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === "image/jpeg" || file.type === "image/png")) {
      setUploadedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const openCamera = () => {
    setIsCameraOpen(true);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => console.error("Error accessing camera:", err));
  };

  const captureImage = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      
      const file = new File([blob], 'aadhaar-capture.jpg', {
        type: "image/jpeg",
      });
      setUploadedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setIsCameraOpen(false);
      
      const stream = video.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    }, "image/jpeg");
  };

  const handleSubmit = () => {
    if (uploadedFile) {
      onNext(uploadedFile);
    }
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Aadhaar Card</h2>
            <p className="text-gray-600">Please upload a clear image of your Aadhaar card</p>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-[#00BFFF] rounded-full flex items-center justify-center text-white text-sm font-medium">
              1
            </div>
            <div className="w-16 h-1 bg-gray-300 mx-2"></div>
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 text-sm font-medium">
              2
            </div>
          </div>
        </div>

        {/* Upload Area */}
        <div className="mb-8">
          {!previewUrl ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <FileText className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Aadhaar Card</h3>
              <p className="text-gray-600 mb-6">Choose a file or take a photo</p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 bg-[#00BFFF] text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  Choose File
                </button>
                
                <button
                  onClick={openCamera}
                  className="flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Camera className="w-5 h-5" />
                  Take Photo
                </button>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg, image/png"
                onChange={handleFileChange}
                className="hidden"
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
              
              <button
                onClick={() => {
                  setUploadedFile(null);
                  setPreviewUrl(null);
                }}
                className="text-[#00BFFF] hover:text-blue-400 text-sm"
              >
                Upload different image
              </button>
            </div>
          )}
        </div>

        {/* Camera Modal */}
        {isCameraOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-lg w-full mx-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Take Photo</h3>
              <video ref={videoRef} autoPlay className="w-full rounded-lg mb-4"></video>
              <canvas
                ref={canvasRef}
                width="640"
                height="480"
                className="hidden"
              ></canvas>
              <div className="flex gap-4">
                <button
                  onClick={captureImage}
                  className="flex-1 bg-[#00BFFF] text-white py-3 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Capture
                </button>
                <button
                  onClick={() => {
                    setIsCameraOpen(false);
                    const video = videoRef.current;
                    if (video?.srcObject) {
                      const stream = video.srcObject as MediaStream;
                      stream.getTracks().forEach((track) => track.stop());
                    }
                  }}
                  className="flex-1 bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={!uploadedFile}
            className="flex-1 bg-[#00BFFF] text-white py-3 px-6 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next: Face Verification
          </button>
        </div>
      </div>
    </div>
  );
};

export default AadhaarUpload;
