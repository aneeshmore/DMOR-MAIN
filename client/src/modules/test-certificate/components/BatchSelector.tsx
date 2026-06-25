import React, { useEffect, useState } from 'react';
import { CompletedBatch } from '../types/testCertificate.types';
import { testCertificateApi } from '../services/testCertificateApi';
import { Search, Loader2 } from 'lucide-react';

interface BatchSelectorProps {
  selectedBatchId?: number;
  onSelect: (batch: CompletedBatch) => void;
  disabled?: boolean;
}

export const BatchSelector: React.FC<BatchSelectorProps> = ({
  selectedBatchId,
  onSelect,
  disabled = false,
}) => {
  const [batches, setBatches] = useState<CompletedBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        setLoading(true);
        const data = await testCertificateApi.getCompletedBatches();
        setBatches(data);
      } catch (err) {
        console.error('Failed to load completed batches', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBatches();
  }, []);

  const filteredBatches = batches.filter(
    b =>
      b.batchNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.productName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedBatch = batches.find(b => b.batchId === selectedBatchId);

  return (
    <div className="relative">
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        Select Completed Production Batch <span className="text-red-500">*</span>
      </label>

      {loading ? (
        <div className="flex items-center gap-2 p-2.5 border rounded-lg bg-gray-50 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Loading completed batches...</span>
        </div>
      ) : (
        <div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            className="input text-left flex justify-between items-center cursor-pointer min-h-[42px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedBatch ? (
              <span className="font-semibold text-gray-800">
                {selectedBatch.batchNo} - {selectedBatch.productName} ({selectedBatch.colour})
              </span>
            ) : (
              <span className="text-gray-400">-- Choose completed batch --</span>
            )}
            <span className="text-gray-400">▼</span>
          </button>

          {isOpen && !disabled && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-hidden flex flex-col">
              <div className="relative p-2 border-b">
                <Search className="absolute left-4 top-4.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  className="input pl-9 py-1.5 text-sm"
                  style={{ paddingLeft: '2.25rem' }}
                  placeholder="Search batch no or product name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="overflow-y-auto flex-1">
                {filteredBatches.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    No completed batches found.
                  </div>
                ) : (
                  filteredBatches.map(batch => (
                    <button
                      key={batch.batchId}
                      type="button"
                      onClick={() => {
                        onSelect(batch);
                        setIsOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-primary-50 hover:text-primary transition-colors text-sm border-b border-gray-50 last:border-b-0 flex flex-col gap-0.5"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-800">{batch.batchNo}</span>
                        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100 font-semibold">
                          Completed
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 font-medium">
                        Product: {batch.productName} ({batch.colour})
                      </div>
                      <div className="text-[11px] text-gray-400 flex justify-between">
                        <span>Qty: {batch.actualQuantity} Ltr/Kg</span>
                        <span>Cust: {batch.customerName || 'Make to Stock'}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default BatchSelector;
