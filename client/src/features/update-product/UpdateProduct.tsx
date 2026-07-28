import React, { useState } from 'react';
import FinalGoodTable from './components/FinalGoodTable';
import RawMaterialTable from './components/RawMaterialTable';
import PackagingMaterialTable from './components/PackagingMaterialTable';

import { PageHeader } from '@/components/common/PageHeader';

const UpdateProduct = () => {
  const [activeTab, setActiveTab] = useState<'fg' | 'rm' | 'pm'>('fg');

  return (
    <div className="space-y-6">
      <PageHeader
        metadataPath="/masters/update-product"
        title="Update Product"
        description="Manage product details across categories."
      />

      {/* Tabs */}
      <div className="flex justify-center w-full">
        <div className="flex bg-gray-100/50 p-1 rounded-lg border border-gray-200 w-full max-w-4xl">
          <button
            onClick={() => setActiveTab('fg')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
              activeTab === 'fg'
                ? 'bg-white text-[var(--primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-gray-200/50'
            }`}
          >
            Finished Good
          </button>
          <button
            onClick={() => setActiveTab('rm')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
              activeTab === 'rm'
                ? 'bg-white text-[var(--primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-gray-200/50'
            }`}
          >
            Raw Material
          </button>
          <button
            onClick={() => setActiveTab('pm')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
              activeTab === 'pm'
                ? 'bg-white text-[var(--primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-gray-200/50'
            }`}
          >
            Packaging Material
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="animate-fade-in">
        {activeTab === 'fg' && <FinalGoodTable />}
        {activeTab === 'rm' && <RawMaterialTable />}
        {activeTab === 'pm' && <PackagingMaterialTable />}
      </div>
    </div>
  );
};

export default UpdateProduct;
