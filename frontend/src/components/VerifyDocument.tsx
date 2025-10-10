import React from 'react';
import { ChevronLeft, UserSquare2, Scan } from 'lucide-react';

interface VerifyDocumentProps {
  onNext: () => void;
  onBack: () => void;
}

const VerifyDocument: React.FC<VerifyDocumentProps> = ({ onNext, onBack }) => {
  return (
    <div className="max-w-lg mx-auto p-4 sm:p-6 md:p-8 bg-white rounded-lg">
      <div className="flex items-center gap-4 mb-6 sm:mb-8">
        <button
          onClick={onBack}
          className="p-2 rounded-full bg-gray-100"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold mb-2">Verify your ID document</h2>
          <p className="text-gray-600 text-sm sm:text-base">We'll use this info to confirm your identity and comply with our legal requirements.</p>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="p-4 bg-gray-50 rounded-lg flex items-center gap-4">
          <UserSquare2 className="w-6 h-6 sm:w-8 sm:h-8" />
          <div>
            <h3 className="font-semibold text-sm sm:text-base">Your photo ID</h3>
            <p className="text-gray-600 text-xs sm:text-sm">We accept most common forms of ID.</p>
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg flex items-center gap-4">
          <Scan className="w-6 h-6 sm:w-8 sm:h-8" />
          <div>
            <h3 className="font-semibold text-sm sm:text-base">A quick scan of your face</h3>
            <p className="text-gray-600 text-xs sm:text-sm">This is to confirm that you match your ID</p>
          </div>
        </div>

        <button
          onClick={onNext}
          className="w-full bg-blue-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-blue-700 transition-all z-10"
        >
          Get Started
        </button>
      </div>
    </div>
  );
};

export default VerifyDocument;
