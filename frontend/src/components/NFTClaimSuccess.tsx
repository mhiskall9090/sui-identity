import React from 'react';
import { CheckCircle, ExternalLink, X, Copy } from 'lucide-react';
import { colors } from '../brand';

interface NFTClaimSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  nftData: {
    nftId: string;
    title: string;
    description: string;
    suiExplorerUrl: string;
    walrusUrl?: string;
    transactionHash: string;
    userAddress: string;
  };
}

export function NFTClaimSuccessModal({ isOpen, onClose, nftData }: NFTClaimSuccessModalProps) {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-auto" style={{ backgroundColor: colors.darkNavy }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6" style={{ borderBottom: `1px solid ${colors.primary}30` }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full" style={{ backgroundColor: `${colors.primary}20` }}>
              <CheckCircle className="w-6 h-6" style={{ color: '#10b981' }} />
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: colors.white }}>NFT Claimed Successfully!</h2>
              <p className="text-sm" style={{ color: colors.lightBlue }}>Your identity verification NFT has been minted</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:opacity-80"
            style={{ backgroundColor: `${colors.primary}20` }}
          >
            <X className="w-5 h-5" style={{ color: colors.white }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* NFT Details */}
          <div className="rounded-2xl p-6" style={{ backgroundColor: `${colors.primary}10`, border: `1px solid ${colors.primary}30` }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: colors.white }}>NFT Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium" style={{ color: colors.lightBlue }}>Title</p>
                <p className="font-semibold" style={{ color: colors.white }}>{nftData.title}</p>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: colors.lightBlue }}>Description</p>
                <p style={{ color: colors.white }}>{nftData.description}</p>
              </div>
            </div>
          </div>

          {/* Technical Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: colors.white }}>Technical Information</h3>
            
            {/* NFT ID */}
            <div className="rounded-xl p-4" style={{ backgroundColor: `${colors.primary}05`, border: `1px solid ${colors.primary}20` }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium" style={{ color: colors.lightBlue }}>NFT Object ID</p>
                <button
                  onClick={() => copyToClipboard(nftData.nftId, 'nftId')}
                  className="flex items-center gap-1 text-xs hover:opacity-80 transition-opacity"
                  style={{ color: colors.primary }}
                >
                  {copiedField === 'nftId' ? 'Copied!' : 'Copy'}
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <p className="font-mono text-sm p-2 rounded border break-all" style={{ color: colors.white, backgroundColor: colors.darkerNavy, borderColor: `${colors.primary}30` }}>
                {nftData.nftId}
              </p>
            </div>

            {/* Transaction Hash */}
            <div className="rounded-xl p-4" style={{ backgroundColor: `${colors.primary}05`, border: `1px solid ${colors.primary}20` }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium" style={{ color: colors.lightBlue }}>Transaction Hash</p>
                <button
                  onClick={() => copyToClipboard(nftData.transactionHash, 'txHash')}
                  className="flex items-center gap-1 text-xs hover:opacity-80 transition-opacity"
                  style={{ color: colors.primary }}
                >
                  {copiedField === 'txHash' ? 'Copied!' : 'Copy'}
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <p className="font-mono text-sm p-2 rounded border break-all" style={{ color: colors.white, backgroundColor: colors.darkerNavy, borderColor: `${colors.primary}30` }}>
                {nftData.transactionHash}
              </p>
            </div>

            {/* User Address */}
            {/* <div className="rounded-xl p-4" style={{ backgroundColor: `${colors.primary}05`, border: `1px solid ${colors.primary}20` }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium" style={{ color: colors.lightBlue }}>Owner Address</p>
                <button
                  onClick={() => copyToClipboard(nftData.userAddress, 'address')}
                  className="flex items-center gap-1 text-xs hover:opacity-80 transition-opacity"
                  style={{ color: colors.primary }}
                >
                  {copiedField === 'address' ? 'Copied!' : 'Copy'}
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <p className="font-mono text-sm p-2 rounded border break-all" style={{ color: colors.white, backgroundColor: colors.darkerNavy, borderColor: `${colors.primary}30` }}>
                {nftData.userAddress}
              </p>
            </div> */}
          </div>

          {/* Action Links */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold" style={{ color: colors.white }}>View Your NFT</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <a
                href={nftData.suiExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl hover:opacity-90 transition-opacity font-medium"
                style={{ background: colors.gradients.primary }}
              >
                <ExternalLink className="w-4 h-4" />
                View on Sui Explorer
              </a>
              {/* {nftData.walrusUrl && (
                <a
                  href={nftData.walrusUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl hover:opacity-90 transition-opacity font-medium"
                  style={{ backgroundColor: colors.darkNavy, border: `1px solid ${colors.primary}40` }}
                >
                  <ExternalLink className="w-4 h-4" />
                  View on Walrus
                </a>
              )} */}
            </div>
          </div>

          {/* Success Message */}
          <div className="rounded-2xl p-4" style={{ backgroundColor: `${colors.primary}10`, border: `1px solid #10b981` }}>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#10b981' }} />
              <div>
                <p className="font-medium" style={{ color: colors.white }}>Verification Complete!</p>
                <p className="text-sm mt-1" style={{ color: colors.lightBlue }}>
                  Your identity has been successfully verified and stored as an NFT on the Sui blockchain. 
                  This NFT serves as cryptographic proof of your identity verification and can be used 
                  across compatible applications.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6" style={{ borderTop: `1px solid ${colors.primary}30` }}>
          <button
            onClick={onClose}
            className="px-6 py-2 text-white rounded-xl hover:opacity-90 transition-opacity font-medium"
            style={{ backgroundColor: colors.darkNavy, border: `1px solid ${colors.primary}40` }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
