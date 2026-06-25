import React from 'react';

interface CertificateHeaderProps {
  companyInfo?: {
    companyName?: string;
    address?: string;
    factoryAddress?: string;
    email?: string;
    contactNumber?: string;
  };
}

export const CertificateHeader: React.FC<CertificateHeaderProps> = ({ companyInfo }) => {
  const name = companyInfo?.companyName || 'DMOR POLYMERS PRIVATE LIMITED';
  const address = companyInfo?.address || '1/8, Shivajinagar, Pune - 411005, Maharashtra, India';
  const factoryAddress =
    companyInfo?.factoryAddress || 'Gate No. 248, Alandi-Markal Road, Markal, Pune - 412105';
  const email = companyInfo?.email || 'sales@dmorpolymers.com';
  const contact = companyInfo?.contactNumber || '+91 20 2553 0000';

  return (
    <div className="text-center border-b-2 border-primary-500 pb-4 mb-6 animate-fade-in">
      <h1 className="text-2xl font-black tracking-wider text-gray-800 uppercase font-sans">
        {name}
      </h1>
      <p className="text-xs font-bold text-primary-600 uppercase tracking-widest mt-1">
        Manufacturers of Architectural & Industrial Coatings
      </p>

      <div className="text-[11px] text-gray-500 mt-2 space-y-0.5 leading-tight">
        <div>
          <span className="font-semibold text-gray-700">Regd. Office:</span> {address}
        </div>
        <div>
          <span className="font-semibold text-gray-700">Factory:</span> {factoryAddress}
        </div>
        <div className="flex justify-center gap-4 text-[10px] text-gray-400 font-medium pt-1">
          <span>Ph: {contact}</span>
          <span>•</span>
          <span>Email: {email}</span>
          <span>•</span>
          <span>Web: www.dmorpolymers.com</span>
        </div>
      </div>
    </div>
  );
};
export default CertificateHeader;
