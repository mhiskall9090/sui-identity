import { createContext, useContext, useState, ReactNode } from 'react';
import { DocumentType } from './types';

interface DocumentTypeContextType {
  documentType: DocumentType | null;
  setDocumentType: (type: DocumentType | null) => void;
}

const DocumentTypeContext = createContext<DocumentTypeContextType | undefined>(undefined);

export function DocumentTypeProvider({ children }: { children: ReactNode }) {
  const [documentType, setDocumentType] = useState<DocumentType | null>(null);

  return (
    <DocumentTypeContext.Provider value={{ documentType, setDocumentType }}>
      {children}
    </DocumentTypeContext.Provider>
  );
}

export function useDocumentType() {
  const context = useContext(DocumentTypeContext);
  if (context === undefined) {
    throw new Error('useDocumentType must be used within a DocumentTypeProvider');
  }
  return context;
}