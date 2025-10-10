import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit';
import { useNavigate } from 'react-router-dom';
import { SessionKey } from '@mysten/seal';
import { AlertCircle, Clock, FileText, Shield, Search, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { colors } from '../brand';
import DashboardHeader from '../components/ui/DashboardHeader';
import { documentDecryptionService, DocumentDecryptionService, type DocumentMetadata } from '../services/decryptionService';

interface DecryptionData {
  user_address: string;
  government_wallet: string;
  total_documents: number;
  documents: DocumentMetadata[];
}

function GovernmentDecryptionPage() {
  const [userAddress, setUserAddress] = useState('');
  const [decryptionData, setDecryptionData] = useState<DecryptionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [decryptedFileUrls, setDecryptedFileUrls] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptionProgress, setDecryptionProgress] = useState('');
  const [currentSessionKey, setCurrentSessionKey] = useState<SessionKey | null>(null);
  
  const currentAccount = useCurrentAccount();
  const { mutate: signPersonalMessage } = useSignPersonalMessage();
  const navigate = useNavigate();

  // Check admin authentication
  useEffect(() => {
    const isAuthenticated = localStorage.getItem('adminAuthenticated');
    if (isAuthenticated !== 'true') {
      navigate('/admin/login');
    }
  }, [navigate]);

  const fetchDecryptionData = async () => {
    if (!userAddress.trim() || !currentAccount?.address) {
      setError('Please enter a user address and connect your wallet');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Fetching decryption data for user:', userAddress);
      console.log('🏛️ Government wallet:', currentAccount.address);

      const response = await fetch(
        `http://localhost:8000/api/encryption/government/decryption-data/${userAddress}?government_wallet=${currentAccount.address}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch data: ${response.status} - ${errorText}`);
      }

      const data: DecryptionData = await response.json();
      setDecryptionData(data);
      console.log('📊 Decryption data loaded:', data);

    } catch (error) {
      console.error('❌ Failed to fetch decryption data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch decryption data');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentSelection = (blobId: string, checked: boolean) => {
    if (checked) {
      setSelectedDocuments(prev => [...prev, blobId]);
    } else {
      setSelectedDocuments(prev => prev.filter(id => id !== blobId));
    }
  };

  const decryptSelectedDocuments = async () => {
    if (!selectedDocuments.length || !decryptionData || !currentAccount?.address) {
      setError('Please select documents and connect your wallet');
      return;
    }

    try {
      setIsDecrypting(true);
      setError(null);
      setDecryptionProgress('Preparing decryption...');
      
      console.log('🔓 Starting decryption process...');
      console.log('📄 Selected documents:', selectedDocuments.length);
      console.log('🏛️ Government wallet:', currentAccount.address);
      
      // Filter selected documents from the full list
      const documentsToDecrypt = decryptionData.documents.filter(
        doc => selectedDocuments.includes(doc.blob_id)
      );
      
      console.log('📋 Documents to decrypt:', documentsToDecrypt.map(d => ({
        file_name: d.file_name,
        blob_id: d.blob_id,
        encryption_id: d.encryption_id
      })));

      // Check if we have a valid session key that hasn't expired
      if (currentSessionKey && !currentSessionKey.isExpired() && 
          currentSessionKey.getAddress() === currentAccount.address) {
        console.log('✅ Using existing session key');
        
        // Use existing session key
        const result = await documentDecryptionService.downloadAndDecryptDocuments(
          documentsToDecrypt,
          currentSessionKey,
          setDecryptionProgress
        );
        
        if (result.success && result.decryptedFileUrls) {
          console.log('🎉 Decryption completed successfully!');
          setDecryptedFileUrls(result.decryptedFileUrls);
          setIsDialogOpen(true);
          setDecryptionProgress('Decryption completed!');
        } else {
          throw new Error(result.error || 'Decryption failed');
        }
      } else {
        // Need to create and sign a new session key
        console.log('🔑 Creating new session key...');
        setDecryptionProgress('Creating session key for decryption...');
        
        const sessionKey = documentDecryptionService.createSessionKey(currentAccount.address);
        
        // Request personal message signature
        signPersonalMessage(
          {
            message: sessionKey.getPersonalMessage(),
          },
          {
            onSuccess: async (result) => {
              try {
                console.log('✅ Personal message signed successfully');
                setDecryptionProgress('Signature obtained, starting decryption...');
                
                // Set the signature on the session key
                await sessionKey.setPersonalMessageSignature(result.signature);
                setCurrentSessionKey(sessionKey);
                
                // Now decrypt with the signed session key
                const decryptResult = await documentDecryptionService.downloadAndDecryptDocuments(
                  documentsToDecrypt,
                  sessionKey,
                  setDecryptionProgress
                );
                
                if (decryptResult.success && decryptResult.decryptedFileUrls) {
                  console.log('🎉 Decryption completed successfully!');
                  console.log('📁 Decrypted files:', decryptResult.decryptedFileUrls.length);
                  setDecryptedFileUrls(decryptResult.decryptedFileUrls);
                  setIsDialogOpen(true);
                  setDecryptionProgress('Decryption completed!');
                } else {
                  throw new Error(decryptResult.error || 'Decryption failed');
                }
              } catch (error) {
                console.error('❌ Error after signature:', error);
                setError(`Error during decryption: ${error instanceof Error ? error.message : String(error)}`);
                setDecryptionProgress('');
              }
            },
            onError: (error) => {
              console.error('❌ Error during signing:', error);
              setError(`Error during signing: ${error.message}`);
              setDecryptionProgress('');
              setIsDecrypting(false);
            }
          }
        );
      }
      
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      setError(error instanceof Error ? error.message : 'Decryption failed');
      setDecryptionProgress('');
    } finally {
      setIsDecrypting(false);
    }
  };

  const downloadDecryptedFile = (url: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
  };

  const closeDialog = () => {
    // Clean up object URLs to prevent memory leaks
    DocumentDecryptionService.cleanupBlobUrls(decryptedFileUrls);
    setDecryptedFileUrls([]);
    setIsDialogOpen(false);
  };

  return (
    <div className="w-full" style={{ backgroundColor: colors.darkerNavy, position: 'relative', minHeight: '100vh' }}>
      {/* Grid Pattern Background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, ${colors.primary}20 1px, transparent 1px),
            linear-gradient(to bottom, ${colors.primary}20 1px, transparent 1px)
          `,
          backgroundSize: "20px 30px",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 0%, #000 60%, transparent 100%)",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 0%, #000 60%, transparent 100%)",
        }}
      />

      {/* Header */}
      <div className="relative z-10">
        <div className="absolute top-4 w-full z-50">
          <DashboardHeader />
        </div>
        
        {/* Hero Section */}
        <div className="pt-[10rem] pb-12">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center max-w-4xl mx-auto mb-12"
            >
              <motion.h1
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="text-4xl md:text-6xl font-bold mb-4"
              >
                <motion.span style={{ color: colors.primary }}>Government</motion.span>
                <motion.span style={{ color: colors.white }}> Document Access</motion.span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="text-xl"
                style={{ color: colors.lightBlue }}
              >
                Access encrypted user documents for verification purposes
              </motion.p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pb-20">

        {/* Government Access Status Card */}
        {/* <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 hover:border-[#00BFFF] hover:shadow-lg transition-all">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Government Access Status</h3>
          {currentAccount?.address ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-green-700 font-medium">
                  Authorized for government document access
                </p>
              </div>
              {currentSessionKey && !currentSessionKey.isExpired() && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Key className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-blue-700 font-medium">
                    Active session key available
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-yellow-700 font-medium">
                Please connect your government wallet to access encrypted documents
              </p>
            </div>
          )}
        </div> */}

        {/* User Document Lookup Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white/10 backdrop-blur-sm rounded-3xl border p-8 mb-8"
          style={{ borderColor: `${colors.primary}30` }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl" style={{ backgroundColor: `${colors.primary}20` }}>
              <Search className="w-6 h-6" style={{ color: colors.primary }} />
            </div>
            <h3 className="text-2xl font-bold" style={{ color: colors.white }}>User Document Lookup</h3>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="userAddress" className="block text-sm font-medium mb-2" style={{ color: colors.lightBlue }}>
                User Wallet Address
              </label>
              <input
                type="text"
                id="userAddress"
                value={userAddress}
                onChange={(e) => setUserAddress(e.target.value)}
                placeholder="Enter user's Sui wallet address (0x...)"
                className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-opacity-50"
                style={{ 
                  backgroundColor: `${colors.primary}10`,
                  border: `1px solid ${colors.primary}40`
                }}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchDecryptionData}
                disabled={loading || !currentAccount?.address}
                className={`px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                  loading || !currentAccount?.address
                    ? 'text-gray-200 cursor-not-allowed'
                    : 'text-white'
                }`}
                style={{
                  background: loading || !currentAccount?.address 
                    ? '#9ca3af' 
                    : colors.gradients.primary
                }}
              >
                {loading ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Fetch Documents
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-6 mb-8 flex items-center gap-3"
            style={{ backgroundColor: `${colors.primary}10`, border: `1px solid #ef4444` }}
          >
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${colors.primary}20` }}>
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <p className="font-medium" style={{ color: colors.white }}>{error}</p>
          </motion.div>
        )}
        
        {/* Progress Display */}
        {decryptionProgress && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-6 mb-8 flex items-center gap-3"
            style={{ backgroundColor: `${colors.primary}10`, border: `1px solid ${colors.primary}30` }}
          >
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${colors.primary}20` }}>
              <Clock className="w-5 h-5" style={{ color: colors.primary }} />
            </div>
            <p className="font-medium" style={{ color: colors.white }}>{decryptionProgress}</p>
          </motion.div>
        )}

        {/* Documents List */}
        {decryptionData && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-white/10 backdrop-blur-sm rounded-3xl border p-8 mb-8"
            style={{ borderColor: `${colors.primary}30` }}
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl" style={{ backgroundColor: `${colors.primary}20` }}>
                  <Shield className="w-6 h-6" style={{ color: colors.primary }} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold" style={{ color: colors.white }}>
                    Accessible Documents ({decryptionData.total_documents})
                  </h3>
                  <p className="text-sm mt-1" style={{ color: colors.lightBlue }}>Select documents to decrypt and view</p>
                </div>
              </div>
              <button
                onClick={decryptSelectedDocuments}
                disabled={!selectedDocuments.length || !currentAccount?.address || isDecrypting}
                className={`px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                  !selectedDocuments.length || !currentAccount?.address || isDecrypting
                    ? 'text-gray-200 cursor-not-allowed'
                    : 'text-white'
                }`}
                style={{
                  background: !selectedDocuments.length || !currentAccount?.address || isDecrypting
                    ? '#9ca3af'
                    : colors.gradients.primary
                }}
              >
                {isDecrypting ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    Decrypting...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    Decrypt Documents ({selectedDocuments.length})
                  </>
                )}
              </button>
            </div>

            {decryptionData.documents.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 mx-auto mb-4" style={{ color: colors.lightBlue }} />
                <p className="text-lg" style={{ color: colors.white }}>
                  No accessible documents found for this user address
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {decryptionData.documents.map((doc, index) => (
                  <motion.div
                    key={doc.blob_id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    whileHover={{ y: -8, scale: 1.02 }}
                    className="rounded-2xl p-6 transition-all duration-300 flex flex-col h-full"
                    style={{
                      backgroundColor: colors.darkNavy,
                      border: `1px solid ${colors.primary}30`
                    }}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <input
                        type="checkbox"
                        id={`doc-${index}`}
                        checked={selectedDocuments.includes(doc.blob_id)}
                        onChange={(e) => handleDocumentSelection(doc.blob_id, e.target.checked)}
                        className="mt-1 h-5 w-5 rounded flex-shrink-0"
                        style={{ accentColor: colors.primary }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="mb-3">
                          <h4 className="font-bold text-lg" style={{ color: colors.white }}>{doc.file_name}</h4>
                        </div>
                        <div className="space-y-3 mb-4">
                          <div className="grid grid-cols-3 gap-3 text-sm">
                            <div className="rounded-xl p-3" style={{ backgroundColor: `${colors.primary}10` }}>
                              <p className="text-xs font-medium mb-1" style={{ color: colors.lightBlue }}>Document Type</p>
                              <p className="font-semibold" style={{ color: colors.white }}>{doc.document_type}</p>
                            </div>
                            <div className="rounded-xl p-3" style={{ backgroundColor: `${colors.primary}10` }}>
                              <p className="text-xs font-medium mb-1" style={{ color: colors.lightBlue }}>DID Type</p>
                              <p className="font-semibold" style={{ color: colors.white }}>{doc.did_type}</p>
                            </div>
                            <div className="rounded-xl p-3" style={{ backgroundColor: `${colors.primary}10` }}>
                              <p className="text-xs font-medium mb-1" style={{ color: colors.lightBlue }}>Created</p>
                              <p className="font-semibold" style={{ color: colors.white }}>{new Date(doc.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action buttons and blob info at bottom */}
                    <div className="mt-auto space-y-3">
                      <div className="flex justify-center">
                        <a
                          href={doc.sui_explorer_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                          style={{ 
                            backgroundColor: `${colors.primary}20`,
                            color: colors.primary
                          }}
                        >
                          🔍 Sui Explorer
                        </a>
                      </div>
                      <div className="rounded-xl p-3 text-xs font-mono" style={{ backgroundColor: colors.darkerNavy, color: colors.lightBlue }}>
                        <div><strong>Blob ID:</strong> {doc.blob_id}</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Decrypted Files Dialog */}
        {isDialogOpen && decryptedFileUrls.length > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="rounded-3xl p-6 max-w-6xl max-h-[90vh] overflow-auto" style={{ backgroundColor: colors.darkNavy }}>
              <div className="flex justify-between items-center mb-4" style={{ borderBottom: `1px solid ${colors.primary}30` }}>
                <h3 className="text-xl font-semibold" style={{ color: colors.white }}>Decrypted Documents</h3>
                <button
                  onClick={closeDialog}
                  className="text-white hover:opacity-80 text-2xl font-bold p-2 rounded-lg transition-opacity"
                  style={{ backgroundColor: `${colors.primary}20` }}
                >
                  ×
                </button>
              </div>
              
              <p className="mb-4" style={{ color: colors.lightBlue }}>
                These documents have been successfully decrypted using Seal protocol and are only visible to authorized government personnel.
              </p>
              
              <div className="grid gap-4">
                {decryptedFileUrls.map((url, index) => {
                  const selectedDoc = decryptionData?.documents.filter(
                    doc => selectedDocuments.includes(doc.blob_id)
                  )[index];
                  return (
                    <div key={index} className="rounded-2xl p-4" style={{ border: `1px solid ${colors.primary}30` }}>
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold" style={{ color: colors.white }}>
                          {selectedDoc?.file_name || `Document ${index + 1}`}
                        </h4>
                        <button
                          onClick={() => downloadDecryptedFile(
                            url, 
                            selectedDoc?.file_name || `decrypted-document-${index + 1}.jpg`
                          )}
                          className="px-3 py-1 text-white rounded-xl hover:opacity-90 text-sm transition-opacity flex items-center gap-1"
                          style={{ backgroundColor: colors.primary }}
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </button>
                      </div>
                      <div className="w-full">
                        <img 
                          src={url} 
                          alt={`Decrypted document ${index + 1}`} 
                          className="w-full h-auto border rounded-2xl"
                          style={{ borderColor: `${colors.primary}30` }}
                        />
                      </div>
                      {selectedDoc && (
                        <div className="mt-2 text-xs space-y-1" style={{ color: colors.lightBlue }}>
                          <div><strong>Document Type:</strong> {selectedDoc.document_type}</div>
                          <div><strong>DID Type:</strong> {selectedDoc.did_type}</div>
                          <div><strong>Verification Status:</strong> {selectedDoc.verification_status || 'Pending'}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <div className="flex justify-end mt-4">
                <button
                  onClick={closeDialog}
                  className="px-6 py-2 text-white rounded-xl hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: colors.darkerNavy, border: `1px solid ${colors.primary}40` }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GovernmentDecryptionPage;