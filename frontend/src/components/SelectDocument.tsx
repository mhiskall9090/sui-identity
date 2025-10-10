import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useDocumentType } from './DocumentTypeContext';
import { DocumentType } from './types';

interface Country {
  code: string;
  name: string;
}

interface SelectDocumentProps {
  onNext: () => void;
}

const countries: Country[] = [
  { code: 'AF', name: 'Afghanistan' }, { code: 'AL', name: 'Albania' }, { code: 'DZ', name: 'Algeria' },
  { code: 'AD', name: 'Andorra' }, { code: 'AO', name: 'Angola' }, { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AR', name: 'Argentina' }, { code: 'AM', name: 'Armenia' }, { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' }, { code: 'AZ', name: 'Azerbaijan' }, { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' }, { code: 'BD', name: 'Bangladesh' }, { code: 'BB', name: 'Barbados' },
  { code: 'BY', name: 'Belarus' }, { code: 'BE', name: 'Belgium' }, { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' }, { code: 'BT', name: 'Bhutan' }, { code: 'BO', name: 'Bolivia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' }, { code: 'BW', name: 'Botswana' }, { code: 'BR', name: 'Brazil' },
  { code: 'BN', name: 'Brunei' }, { code: 'BG', name: 'Bulgaria' }, { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' }, { code: 'CV', name: 'Cabo Verde' }, { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' }, { code: 'CA', name: 'Canada' }, { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' }, { code: 'CL', name: 'Chile' }, { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' }, { code: 'KM', name: 'Comoros' }, { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'Democratic Republic of the Congo' }, { code: 'CR', name: 'Costa Rica' }, { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'HR', name: 'Croatia' }, { code: 'CU', name: 'Cuba' }, { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czechia' }, { code: 'DK', name: 'Denmark' }, { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominica' }, { code: 'DO', name: 'Dominican Republic' }, { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' }, { code: 'SV', name: 'El Salvador' }, { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' }, { code: 'EE', name: 'Estonia' }, { code: 'SZ', name: 'Eswatini' },
  { code: 'ET', name: 'Ethiopia' }, { code: 'FJ', name: 'Fiji' }, { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' }, { code: 'GA', name: 'Gabon' }, { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgia' }, { code: 'DE', name: 'Germany' }, { code: 'GH', name: 'Ghana' },
  { code: 'GR', name: 'Greece' }, { code: 'GD', name: 'Grenada' }, { code: 'GT', name: 'Guatemala' },
  { code: 'GN', name: 'Guinea' }, { code: 'GW', name: 'Guinea-Bissau' }, { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' }, { code: 'HN', name: 'Honduras' }, { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' }, { code: 'IN', name: 'India' }, { code: 'ID', name: 'Indonesia' },
  { code: 'IR', name: 'Iran' }, { code: 'IQ', name: 'Iraq' }, { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' }, { code: 'IT', name: 'Italy' }, { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' }, { code: 'JO', name: 'Jordan' }, { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' }, { code: 'KR', name: 'South Korea' }, { code: 'KW', name: 'Kuwait' },
  { code: 'KG', name: 'Kyrgyzstan' }, { code: 'LA', name: 'Laos' }, { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' }, { code: 'LS', name: 'Lesotho' }, { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' }, { code: 'LI', name: 'Liechtenstein' }, { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' }, { code: 'MG', name: 'Madagascar' }, { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' }, { code: 'MV', name: 'Maldives' }, { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' }, { code: 'MX', name: 'Mexico' }, { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' }, { code: 'MN', name: 'Mongolia' }, { code: 'ME', name: 'Montenegro' },
  { code: 'MA', name: 'Morocco' }, { code: 'MZ', name: 'Mozambique' }, { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibia' }, { code: 'NP', name: 'Nepal' }, { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' }, { code: 'NI', name: 'Nicaragua' }, { code: 'NG', name: 'Nigeria' },
  { code: 'PK', name: 'Pakistan' }, { code: 'PH', name: 'Philippines' }, { code: 'QA', name: 'Qatar' },
  { code: 'RU', name: 'Russia' }, { code: 'SA', name: 'Saudi Arabia' }, { code: 'SG', name: 'Singapore' }
];

const allDocumentTypes = [
  { id: 'ghana_card' as const, name: 'Ghana Card' },
  { id: 'ghana_passport' as const, name: 'Ghana Passport' },
  { id: 'aadhaar_card' as const, name: 'Aadhaar Card' },
  { id: 'passport' as const, name: 'Passport' },
  { id: 'drivers_license' as const, name: "Driver's License" }
];

const SelectDocument: React.FC<SelectDocumentProps> = ({ onNext }) => {
  const [country, setCountry] = useState('');
  const [selectedDocumentType, setSelectedDocumentType] = useState('');

  const { setDocumentType } = useDocumentType();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (country && selectedDocumentType) {
      const selectedCountryObj = countries.find(c => c.code === country);
      if (selectedCountryObj) {
        localStorage.setItem('selectedCountryName', selectedCountryObj.name);
        localStorage.setItem('documentType', selectedDocumentType);
        setDocumentType(selectedDocumentType as DocumentType);
        console.log('Selected country:', selectedCountryObj.name);
        console.log('Selected document type:', selectedDocumentType);
      }
      onNext();
    }
  };

  const filteredDocuments = country === 'IN'
    ? allDocumentTypes.filter(doc => doc.id === 'aadhaar_card' || doc.id === 'passport' || doc.id === 'drivers_license')
    : country === 'GH'
    ? allDocumentTypes.filter(doc => doc.id === 'ghana_card' || doc.id === 'ghana_passport')
    : allDocumentTypes.filter(doc => !['aadhaar_card', 'ghana_card', 'ghana_passport'].includes(doc.id));

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg mx-auto p-4 sm:p-6 md:p-8 bg-white rounded-lg"
    >
      <div className="flex items-center gap-4 mb-6 sm:mb-8">
        <button type="button" className="p-2 rounded-full bg-gray-100">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl sm:text-2xl font-semibold">
          Select your country and identity document
        </h2>
      </div>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Issuing country<span className="text-red-500">*</span>
          </label>
          <select
            className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg bg-white focus:ring focus:ring-blue-300"
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setSelectedDocumentType('');
            }}
            required
          >
            <option value="">Select country</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Document type<span className="text-red-500">*</span>
          </label>
          <select
            className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg bg-white focus:ring focus:ring-blue-300"
            value={selectedDocumentType}
            onChange={(e) => setSelectedDocumentType(e.target.value)}
            required
          >
            <option value="">Select document type</option>
            {filteredDocuments.map((docType) => (
              <option key={docType.id} value={docType.id}>
                {docType.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-blue-700 transition-all z-10"
        >
          Next
        </button>
      </div>
    </form>
  );
};

export default SelectDocument;
