import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { motion } from "framer-motion";
import LightRays from "../components/ui/lightRays";
import {
  DocumentUploadStep,
  FaceVerificationStep,
  OtpVerificationStep,
  NFTClaimSuccessModal,
  useDocumentType,
  DocumentData,
  SelectDocument,
} from "../components";
import { useVerificationListener } from "../hooks/useEventListener";
import {
  documentEncryptionService,
  DocumentEncryptionService,
} from "../services/encryptionService";
import { credentialService } from "../services/credentialService";
import { colors } from "../brand";

function KycPage() {
  const [step, setStep] = useState("select-document");
  const [documentData, setDocumentData] = useState<DocumentData | null>(null);
  const { documentType } = useDocumentType();
  const [otpVerified, setOtpVerified] = useState(false);
  const [encryptionResult, setEncryptionResult] = useState<{
    blobId?: string;
    encryptionId?: string;
    suiRef?: string;
  } | null>(null);
  const [userDidId, setUserDidId] = useState<string | null>(null);
  const [isClaimingNft, setIsClaimingNft] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [nftClaimData, setNftClaimData] = useState<{
    nftId: string;
    title: string;
    description: string;
    suiExplorerUrl: string;
    walrusUrl?: string;
    transactionHash: string;
    userAddress: string;
  } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const currentAccount = useCurrentAccount();
  const { verificationStatus, startListening } = useVerificationListener();

  // Get verification type from location state or default
  // const verificationType = location.state?.verificationType || 'Verify Above 18';
  const verificationDescription =
    location.state?.verificationDescription ||
    "Verify your identity using your Ghana Card or Ghana Passport. Required for DeFi protocols and Gaming protocols on SUI ecosystem.";

  // Sui client and transaction execution
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      await suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showRawEffects: true,
          showEffects: true,
        },
      }),
  });

  // Contract configuration
  const PACKAGE_ID =
    "0x3611276dabf733007d7975e17989e505eb93e11f4998f93d5c74c3a44231833d";
  const CLOCK_ID =
    "0x0000000000000000000000000000000000000000000000000000000000000006";

  const handleDocumentSelected = () => {
    setStep("document");
  };

  const handleOtpSuccess = () => {
    setOtpVerified(true);
    setStep("waiting");
    startListening();
  };

  const handleNext = () => {
    if (step === "document") setStep("face");
    else if (step === "face") setStep("otp");
    // else if (step === "otp") {
    //   // After OTP verification, start listening for blockchain events
    //   setOtpVerified(true);
    //   setStep("waiting");
    //   startListening();
    // }
  };

  const encryptAndUploadDocument = useCallback(
    async (file: File) => {
      try {
        console.log("🔄 Starting real encryption and upload process...");

        const result = await documentEncryptionService.encryptAndUploadDocument(
          file,
          currentAccount!.address
        );

        if (result.success) {
          console.log("✅ Encryption and upload successful!");
          console.log("📋 Results:", result);

          // Store the encryption results
          setEncryptionResult({
            blobId: result.blobId,
            encryptionId: result.encryptionId,
            suiRef: result.suiRef,
          });

          setStep("completed");
        } else {
          console.error("❌ Encryption failed:", result.error);
          setStep("error");
        }
      } catch (error) {
        console.error("❌ Unexpected error during encryption:", error);
        setStep("error");
      }
    },
    [currentAccount]
  );

  const handleDocumentEncryption = useCallback(async () => {
    if (!documentData?.document_photo_base64 || !currentAccount?.address) {
      console.error("Missing document data or wallet address");
      return;
    }

    try {
      console.log("🔐 Starting document encryption and upload process...");
      setStep("encrypting");

      // Convert base64 to File object for encryption
      const base64Data = documentData.document_photo_base64;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const fileName = `${documentData.document_type || "document"}.jpg`;
      const file = new File([byteArray], fileName, { type: "image/jpeg" });

      console.log(
        "📄 Document converted to file:",
        file.name,
        file.size,
        "bytes"
      );

      // Use the encryption logic from EncryptAndUpload.tsx
      await encryptAndUploadDocument(file);
    } catch (error) {
      console.error("❌ Error in document encryption:", error);
      setStep("error");
    }
  }, [
    documentData?.document_photo_base64,
    currentAccount?.address,
    documentData?.document_type,
    encryptAndUploadDocument,
  ]);

  // Handle successful verification from event listener
  useEffect(() => {
    if (verificationStatus.isVerified && otpVerified) {
      // Store the UserDID object ID from the verification event
      if (verificationStatus.userDidId) {
        setUserDidId(verificationStatus.userDidId);
        console.log(
          "🎯 UserDID object ID captured from event:",
          verificationStatus.userDidId
        );
      }

      // Log enhanced event data for SDK verification
      if (verificationStatus.eventData) {
        console.log("📋 Enhanced Event Data Available:");
        console.log(
          "   🔐 Nautilus Signature Length:",
          verificationStatus.eventData.nautilus_signature.length
        );
        console.log(
          "   📅 Signature Timestamp:",
          verificationStatus.eventData.signature_timestamp_ms
        );
        console.log(
          "   🔍 Evidence Hash Length:",
          verificationStatus.eventData.evidence_hash.length
        );
        console.log("   🆔 DID Type:", verificationStatus.eventData.did_type);
        console.log(
          "   📋 Registry ID:",
          verificationStatus.eventData.registry_id
        );

        // This enhanced data can now be used for SDK verification calls
        // Example: await enclave.verify_signature(enclave_id, 1, parseInt(eventData.signature_timestamp_ms), payload, eventData.nautilus_signature);
      }

      // Start document encryption and upload process
      handleDocumentEncryption();
    }
  }, [
    verificationStatus.isVerified,
    otpVerified,
    verificationStatus.userDidId,
    verificationStatus.eventData,
    handleDocumentEncryption,
  ]);

  // NFT Claiming function
  const claimDidNft = async () => {
    if (!encryptionResult?.blobId || !currentAccount?.address) {
      console.error("❌ Missing blob ID or user address");
      return;
    }

    if (!userDidId) {
      console.error("❌ Missing UserDID object ID from verification event");
      alert(
        "Error: UserDID object ID not found. Please complete verification first."
      );
      return;
    }

    try {
      setIsClaimingNft(true);
      console.log("🏆 Starting DID NFT claim process...");
      console.log("🎯 Using UserDID object ID from event:", userDidId);

      // Log enhanced verification data available for future SDK integration
      if (verificationStatus.eventData) {
        console.log("📋 Enhanced verification data available:");
        console.log(
          "   📅 Signature Timestamp (ms):",
          verificationStatus.eventData.signature_timestamp_ms
        );
        console.log(
          "   🔐 Nautilus Signature Available:",
          verificationStatus.eventData.nautilus_signature.length > 0
        );
        console.log(
          "   🔍 Evidence Hash Available:",
          verificationStatus.eventData.evidence_hash.length > 0
        );
        console.log("   🆔 DID Type:", verificationStatus.eventData.did_type);
      }

      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::did_registry::claim_did_nft`,
        arguments: [
          tx.object(
            "0xea43902e5184fc2cbbc194e63c236321d7cd4aebd006b2d4a7c76f8f03f194b9"
          ), // registry (updated)
          tx.object(userDidId), // user_did object (from verification event)
          tx.pure.string(encryptionResult.blobId), // blob_id
          tx.object(CLOCK_ID), // clock
        ],
      });
      tx.setGasBudget(10000000);

      signAndExecute(
        {
          // Cast transaction to any to work around minor type differences between installed @mysten/sui versions
          transaction: tx as any,
        },
        {
          onSuccess: async (result) => {
            console.log("🎉 NFT Claim Transaction Success:", result);

            // Extract the NFT object ID from the transaction result
            const nftObject = result.effects?.created?.find(
              (item) =>
                item.owner &&
                typeof item.owner === "object" &&
                "AddressOwner" in item.owner
            );
            const nftId = nftObject?.reference?.objectId;

            console.log("🏆 DID NFT Created:", nftId);

            if (nftId) {
              console.log("🎉 NFT Claimed Successfully! Saving to backend...");

              // Prepare NFT data for modal and backend
              const nftData = {
                nftId,
                title: "Age Verification NFT",
                description: `Verified above 18 years using ${
                  documentType === "ghana_card"
                    ? "Ghana Card"
                    : "Ghana Passport"
                }`,
                suiExplorerUrl: `https://suiscan.xyz/testnet/object/${nftId}`,
                walrusUrl: encryptionResult.blobId
                  ? `https://walrus.site/blob/${encryptionResult.blobId}`
                  : undefined,
                transactionHash: result.digest,
                userAddress: currentAccount.address,
              };

              // Save NFT credential to backend
              try {
                const saveResult = await credentialService.saveNFTCredential({
                  userAddress: currentAccount.address,
                  nftId,
                  didType: userDidId || "1",
                  title: "Age Verification NFT",
                  description: `Verified above 18 years using ${
                    documentType === "ghana_card"
                      ? "Ghana Card"
                      : "Ghana Passport"
                  }`,
                  suiExplorerUrl: `https://suiscan.xyz/testnet/object/${nftId}`,
                  walrusUrl: encryptionResult.blobId
                    ? `https://walrus.site/blob/${encryptionResult.blobId}`
                    : undefined,
                  blobId: encryptionResult.blobId,
                  transactionHash: result.digest,
                });

                if (saveResult.success) {
                  console.log(
                    "✅ NFT credential saved to backend:",
                    saveResult.credentialId
                  );
                } else {
                  console.error(
                    "❌ Failed to save NFT credential:",
                    saveResult.error
                  );
                }
              } catch (error) {
                console.error(
                  "❌ Error saving NFT credential to backend:",
                  error
                );
              }

              // Show success modal
              setNftClaimData(nftData);
              setShowSuccessModal(true);
              setStep("nft-claimed");
            }
          },
          onError: (error) => {
            console.error("❌ NFT Claim Transaction Failed:", error);
            alert(
              `Failed to claim DID NFT: ${error.message || "Unknown error"}`
            );
          },
        }
      );
    } catch (error) {
      console.error("❌ Error claiming NFT:", error);
      alert(
        `Error claiming NFT: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsClaimingNft(false);
    }
  };

  const handleBack = () => {
    if (step === "face") setStep("document");
    else if (step === "otp") setStep("face");
    else if (step === "document") navigate("/dashboard");
  };

  const handleDocumentUpload = (data: DocumentData) => {
    setDocumentData(data);
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: colors.darkerNavy }}
    >
      {/* LightRays Background */}
      <div className="fixed inset-0 z-0">
        <LightRays raysColor={colors.primary} />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 min-h-screen">
        {/* Hero Section */}
        <div className="flex items-center justify-center min-h-screen px-6">
          <div className="text-center max-w-4xl mx-auto my-16 ">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="mb-8"
            >
              <motion.h1
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="text-4xl md:text-6xl font-bold mb-4 "
              >
                <motion.span style={{ color: colors.primary }}>
                  Identity
                </motion.span>
                <motion.span style={{ color: colors.white }}>
                  {" "}
                  Verification
                </motion.span>
              </motion.h1>

              {/* <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="text-xl mb-2"
                style={{ color: colors.white }}
              >
                {verificationType}
              </motion.p> */}

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="text-lg max-w-2xl mx-auto mb-8"
                style={{ color: colors.lightBlue }}
              >
                {verificationDescription}
              </motion.p>
            </motion.div>

            {/* Content Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border max-w-2xl mx-auto"
              style={{ borderColor: `${colors.primary}30` }}
            >
              {step === "select-document" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <SelectDocument onNext={handleDocumentSelected} />
                </motion.div>
              )}
              {step === "document" && documentType && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <DocumentUploadStep
                    onNext={handleNext}
                    onBack={handleBack}
                    onFileUpload={handleDocumentUpload}
                    documentType={
                      documentType === "ghana_card" ||
                      documentType === "ghana_passport"
                        ? documentType
                        : "ghana_card"
                    }
                  />
                </motion.div>
              )}
              {step === "face" && documentData && (
                <FaceVerificationStep
                  onNext={handleNext}
                  onBack={handleBack}
                  documentData={documentData}
                />
              )}
              {step === "otp" && documentData && (
                <OtpVerificationStep
                  onNext={handleOtpSuccess}
                  onBack={handleBack}
                  phoneNumber={documentData.phone_number || ""}
                  documentData={documentData}
                />
              )}
              {step === "waiting" && (
                <div className="text-center py-12">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    className="mb-8"
                  >
                    <div
                      className="w-20 h-20 border-4 rounded-full animate-spin mx-auto mb-6"
                      style={{
                        borderColor: `${colors.primary}20`,
                        borderTopColor: colors.primary,
                      }}
                    ></div>
                    <h2
                      className="text-2xl font-bold mb-3"
                      style={{ color: colors.white }}
                    >
                      Waiting for Blockchain Verification
                    </h2>
                    <p
                      className="text-lg mb-6"
                      style={{ color: colors.lightBlue }}
                    >
                      Your OTP has been verified. Now waiting for on-chain
                      attestation...
                    </p>
                  </motion.div>

                  {currentAccount?.address && (
                    <div
                      className="rounded-2xl p-4 mb-6"
                      style={{
                        backgroundColor: `${colors.primary}10`,
                        border: `1px solid ${colors.primary}30`,
                      }}
                    >
                      <p
                        className="text-sm mb-2"
                        style={{ color: colors.white }}
                      >
                        <strong>Listening for address:</strong>
                      </p>
                      <p
                        className="text-xs font-mono px-3 py-2 rounded-lg"
                        style={{
                          backgroundColor: colors.darkNavy,
                          color: colors.lightBlue,
                        }}
                      >
                        {currentAccount.address}
                      </p>
                    </div>
                  )}

                  <div
                    className="rounded-2xl p-4"
                    style={{
                      backgroundColor: `${colors.darkNavy}80`,
                      border: `1px solid ${colors.primary}20`,
                    }}
                  >
                    <p className="text-sm mb-2" style={{ color: colors.white }}>
                      <strong>Event Listener Status:</strong>
                    </p>
                    <p className="text-sm" style={{ color: colors.lightBlue }}>
                      {verificationStatus.verificationMessage ||
                        "Initializing..."}
                    </p>

                    {verificationStatus.isVerified && (
                      <div
                        className="mt-4 p-4 rounded-xl"
                        style={{
                          backgroundColor: `${colors.primary}10`,
                          border: `1px solid ${colors.primary}30`,
                        }}
                      >
                        <p
                          className="font-semibold mb-2"
                          style={{ color: colors.white }}
                        >
                          ✅ Verification completed from event listener!
                        </p>
                        <p
                          className="text-sm mb-3"
                          style={{ color: colors.lightBlue }}
                        >
                          Starting document encryption process...
                        </p>

                        {verificationStatus.eventData && (
                          <div
                            className="mt-3 p-3 rounded-lg text-xs"
                            style={{
                              backgroundColor: colors.darkNavy,
                              border: `1px solid ${colors.primary}20`,
                            }}
                          >
                            <p
                              className="font-semibold mb-2"
                              style={{ color: colors.white }}
                            >
                              Enhanced Event Data:
                            </p>
                            <div
                              className="space-y-1"
                              style={{ color: colors.lightBlue }}
                            >
                              <p>
                                🆔 DID Type:{" "}
                                {verificationStatus.eventData.did_type}
                              </p>
                              <p>
                                📅 Signature Time:{" "}
                                {new Date(
                                  parseInt(
                                    verificationStatus.eventData
                                      .signature_timestamp_ms
                                  )
                                ).toLocaleString()}
                              </p>
                              <p>
                                🔐 Nautilus Signature:{" "}
                                {verificationStatus.eventData.nautilus_signature
                                  .length > 0
                                  ? "✅ Available"
                                  : "❌ Missing"}
                              </p>
                              <p>
                                🔍 Evidence Hash:{" "}
                                {verificationStatus.eventData.evidence_hash
                                  .length > 0
                                  ? "✅ Available"
                                  : "❌ Missing"}
                              </p>
                            </div>
                            <p
                              className="text-sm mt-2"
                              style={{ color: colors.primary }}
                            >
                              Ready for SDK verification calls!
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {step === "encrypting" && (
                <div className="text-center py-12">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    className="mb-8"
                  >
                    <div
                      className="w-20 h-20 border-4 rounded-full animate-spin mx-auto mb-6"
                      style={{
                        borderColor: `${colors.primary}20`,
                        borderTopColor: colors.primary,
                      }}
                    ></div>
                    <h2
                      className="text-2xl font-bold mb-3"
                      style={{ color: colors.white }}
                    >
                      Encrypting Documents
                    </h2>
                    <p
                      className="text-lg mb-6"
                      style={{ color: colors.lightBlue }}
                    >
                      Converting documents to secure encrypted format...
                    </p>
                  </motion.div>

                  <div
                    className="rounded-2xl p-4 mb-6"
                    style={{
                      backgroundColor: `${colors.primary}10`,
                      border: `1px solid ${colors.primary}30`,
                    }}
                  >
                    <div
                      className="space-y-2 text-sm"
                      style={{ color: colors.white }}
                    >
                      <p>🔐 Converting base64 to file format...</p>
                      <p>📄 Preparing document for encryption...</p>
                      <p>🔄 Encrypting with Seal protocol...</p>
                      <p>☁️ Uploading to Walrus storage...</p>
                    </div>
                  </div>

                  <div
                    className="rounded-2xl p-4"
                    style={{
                      backgroundColor: `${colors.darkNavy}80`,
                      border: `1px solid ${colors.primary}20`,
                    }}
                  >
                    <p className="text-sm" style={{ color: colors.lightBlue }}>
                      <strong>Process:</strong> Document → Base64 → Python
                      Backend → Encryption → Walrus Upload
                    </p>
                  </div>
                </div>
              )}

              {step === "completed" && (
                <div className="text-center py-12">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    className="mb-8"
                  >
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                      style={{
                        backgroundColor: `${colors.primary}20`,
                        border: `2px solid ${colors.primary}`,
                      }}
                    >
                      <svg
                        className="w-10 h-10"
                        style={{ color: colors.primary }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <h2
                      className="text-2xl font-bold mb-3"
                      style={{ color: colors.white }}
                    >
                      Verification Complete!
                    </h2>
                    <p
                      className="text-lg mb-6"
                      style={{ color: colors.lightBlue }}
                    >
                      Your documents have been encrypted and stored securely.
                    </p>
                  </motion.div>

                  <div
                    className="rounded-2xl p-4 mb-6"
                    style={{
                      backgroundColor: `${colors.primary}10`,
                      border: `1px solid ${colors.primary}30`,
                    }}
                  >
                    {/* <div className="space-y-2 text-sm" style={{ color: colors.white }}>
                    <p>✅ Blockchain verification confirmed</p>
                    <p>✅ Documents encrypted with Seal protocol</p>
                    <p>✅ Secure storage on Walrus network</p>
                    <p>✅ Ready to claim DID NFT</p>
                  </div> */}

                    {encryptionResult && (
                      <div
                        className="mt-4 pt-4"
                        style={{ borderTop: `1px solid ${colors.primary}30` }}
                      >
                        <p
                          className="text-xs font-semibold mb-2"
                          style={{ color: colors.white }}
                        >
                          Encryption Details:
                        </p>
                        <div
                          className="space-y-1 text-xs font-mono"
                          style={{ color: colors.lightBlue }}
                        >
                          <p>
                            <strong>Blob ID:</strong> {encryptionResult.blobId}
                          </p>
                          {/* <p><strong>Encryption ID:</strong> {encryptionResult.encryptionId}</p> */}
                          {/* <p><strong>Sui Reference:</strong> {encryptionResult.suiRef}</p> */}
                        </div>
                        <div className="mt-2 space-y-1">
                          {/* <a 
                          href={DocumentEncryptionService.getBlobUrl(encryptionResult.blobId!)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline block hover:opacity-80 transition-opacity"
                          style={{ color: colors.primary }}
                        >
                          🔗 View on Walrus
                        </a> */}
                          <a
                            href={DocumentEncryptionService.getSuiExplorerUrl(
                              encryptionResult.suiRef!,
                              "object"
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs underline block hover:opacity-80 transition-opacity"
                            style={{ color: colors.primary }}
                          >
                            🔍 View on Sui Explorer
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <motion.button
                      onClick={claimDidNft}
                      disabled={isClaimingNft || !encryptionResult?.blobId}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                        isClaimingNft || !encryptionResult?.blobId
                          ? "text-gray-300 cursor-not-allowed"
                          : "text-white shadow-lg"
                      }`}
                      style={{
                        background:
                          isClaimingNft || !encryptionResult?.blobId
                            ? "#4b5563"
                            : colors.gradients.primary,
                      }}
                    >
                      {isClaimingNft
                        ? "🔄 Claiming NFT..."
                        : "🏆 Claim Your DID NFT"}
                    </motion.button>

                    <motion.button
                      onClick={() => navigate("/dashboard")}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-3 px-6 rounded-xl font-medium transition-all duration-300 text-white"
                      style={{
                        backgroundColor: colors.darkNavy,
                        border: `1px solid ${colors.primary}40`,
                      }}
                    >
                      Go to Dashboard
                    </motion.button>
                  </div>
                </div>
              )}

              {step === "error" && (
                <div className="text-center py-12">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    className="mb-8"
                  >
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                      style={{
                        backgroundColor: `${colors.primary}20`,
                        border: `2px solid #ef4444`,
                      }}
                    >
                      <svg
                        className="w-10 h-10 text-red-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </div>
                    <h2
                      className="text-2xl font-bold mb-3"
                      style={{ color: colors.white }}
                    >
                      Process Failed
                    </h2>
                    <p
                      className="text-lg mb-6"
                      style={{ color: colors.lightBlue }}
                    >
                      There was an error during the document encryption process.
                    </p>
                  </motion.div>

                  <div
                    className="rounded-2xl p-4 mb-6"
                    style={{
                      backgroundColor: `${colors.primary}10`,
                      border: `1px solid #ef4444`,
                    }}
                  >
                    <p className="text-sm" style={{ color: colors.white }}>
                      Please check the console for detailed error information.
                    </p>
                  </div>

                  <motion.button
                    onClick={() => setStep("waiting")}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-3 px-6 rounded-xl font-medium transition-all duration-300 text-white"
                    style={{ backgroundColor: colors.primary }}
                  >
                    Try Again
                  </motion.button>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* NFT Claim Success Modal */}
      {showSuccessModal && nftClaimData && (
        <NFTClaimSuccessModal
          isOpen={showSuccessModal}
          onClose={() => {
            setShowSuccessModal(false);
            setNftClaimData(null);
            // Navigate to user dashboard to see the new credential
            navigate("/dashboard");
          }}
          nftData={nftClaimData}
        />
      )}
    </div>
  );
}

export default KycPage;
