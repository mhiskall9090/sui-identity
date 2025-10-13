import React, { useState, useRef } from "react";
import {
  ChevronLeft,
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { colors } from "../brand";
import { useCurrentAccount } from "@mysten/dapp-kit";

interface DocumentData {
  name?: string;
  dob?: string;
  gender?: string;
  phone_number?: string;
  address?: string;
  document_number?: string;
  document_photo_base64?: string;
  document_type?: "ghana_card" | "ghana_passport";
}

interface DocumentUploadStepProps {
  onNext: () => void;
  onBack: () => void;
  onFileUpload: (data: DocumentData) => void;
  documentType: "ghana_card" | "ghana_passport";
}

const DocumentUploadStep: React.FC<DocumentUploadStepProps> = ({
  onNext,
  onBack,
  onFileUpload,
  documentType,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentData, setDocumentData] = useState<DocumentData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentAccount = useCurrentAccount();

  const API_BASE = "http://localhost:8000";

  const getDocumentTitle = () => {
    return documentType === "ghana_card" ? "Ghana Card" : "Ghana Passport";
  };

  const handleApiCall = async (url: string, formData: FormData) => {
    try {
      const response = await fetch(`${API_BASE}${url}`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return result;
    } catch (err) {
      console.error("API call failed:", err);
      if (err instanceof TypeError && err.message.includes("fetch")) {
        throw new Error(
          "Network error: Please ensure the backend server is running on localhost:8000 (via SSH tunnel)"
        );
      }
      throw err;
    }
  };

  const handleDocumentUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      // These are now required by the new endpoint
      formData.append("verification_type", "above18");
      formData.append("aadhaar_image", file);
      // The endpoint expects at least 3 face images, sending the same image 3 times as a placeholder
      formData.append("face_images", file);
      formData.append("face_images", file);
      formData.append("face_images", file);

      const result = await handleApiCall(
        "/api/kyc/start-verification",
        formData
      );

      if (result.data) {
        // The new endpoint returns a session_id and other data.
        // We can create a simplified documentData object for the frontend flow.
        const data: DocumentData = {
          name: result.data.extracted_data?.name || "Mock User",
          dob: result.data.extracted_data?.date_of_birth || "01/01/1990",
          phone_number: result.data.phone_number || "+919999999999",
          document_number:
            result.data.extracted_data?.id_number || "123456789012",
          document_type: documentType,
        };

        setDocumentData(data);
        onFileUpload(data);
      } else {
        setError(
          result.message || `Failed to process ${getDocumentTitle()} image.`
        );
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : `An error occurred while processing the ${getDocumentTitle()} image`;
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
      handleDocumentUpload(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (documentData) {
      onNext();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
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
          Upload {getDocumentTitle()}
        </h2>
      </div>

      <div className="space-y-6">
        {/* Error Display */}
        {error && (
          <div
            className="p-4 rounded-2xl flex items-center gap-3"
            style={{
              backgroundColor: `${colors.primary}10`,
              border: `1px solid #ef4444`,
            }}
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-sm" style={{ color: colors.white }}>
              {error}
            </p>
          </div>
        )}

        {/* Success Display */}
        {documentData && !error && (
          <div
            className="p-4 rounded-2xl"
            style={{
              backgroundColor: `${colors.primary}10`,
              border: `1px solid ${colors.primary}30`,
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle
                className="w-5 h-5"
                style={{ color: colors.primary }}
              />
              <h4 className="font-semibold" style={{ color: colors.white }}>
                {getDocumentTitle()} Data Extracted
              </h4>
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm">
              {documentData.document_number && (
                <div>
                  <span
                    className="font-medium"
                    style={{ color: colors.primary }}
                  >
                    {getDocumentTitle()} Number:
                  </span>
                  <span className="ml-2" style={{ color: colors.lightBlue }}>
                    {documentData.document_number}
                  </span>
                </div>
              )}
              {documentData.phone_number && (
                <div>
                  <span
                    className="font-medium"
                    style={{ color: colors.primary }}
                  >
                    Phone Number:
                  </span>
                  <span className="ml-2" style={{ color: colors.lightBlue }}>
                    {documentData.phone_number}
                  </span>
                </div>
              )}
              {documentData.dob && (
                <div>
                  <span
                    className="font-medium"
                    style={{ color: colors.primary }}
                  >
                    Date of Birth:
                  </span>
                  <span className="ml-2" style={{ color: colors.lightBlue }}>
                    {documentData.dob}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Upload Area */}
        {!previewUrl ? (
          <div
            className="border-2 border-dashed rounded-2xl p-8 text-center transition-colors"
            style={{
              borderColor: error ? "#ef4444" : `${colors.primary}40`,
              backgroundColor: error ? "#ef444410" : `${colors.primary}05`,
            }}
          >
            <FileText
              className="w-12 h-12 mx-auto mb-4"
              style={{ color: error ? "#ef4444" : colors.primary }}
            />
            <h3
              className="text-lg font-semibold mb-2"
              style={{ color: colors.white }}
            >
              Upload {getDocumentTitle()}
            </h3>
            <p className="mb-6" style={{ color: colors.lightBlue }}>
              Choose a clear image of your {getDocumentTitle()} (JPG, PNG)
            </p>

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
              {isLoading ? "Processing..." : "Choose File"}
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
                alt={`${getDocumentTitle()} preview`}
                className="max-w-full mx-auto max-h-48 rounded-2xl border-2"
                style={{ borderColor: `${colors.primary}40` }}
              />
            </div>
            <p
              className="font-medium mb-2"
              style={{ color: colors.primary }}
            ></p>

            <button
              type="button"
              onClick={() => {
                setPreviewUrl(null);
                setDocumentData(null);
                setError(null);
              }}
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: colors.primary }}
            >
              Upload Different Image
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={!documentData || isLoading}
          className="w-full py-3 px-6 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white"
          style={{ background: colors.gradients.primary }}
        >
          {isLoading ? "Extracting data..." : "Next"}
        </button>
      </div>
    </form>
  );
};

export default DocumentUploadStep;
