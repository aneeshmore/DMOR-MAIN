import React, { useState } from 'react';
import { FileText, FileSpreadsheet, Download } from 'lucide-react';
import { Modal, Button } from '@/components/ui';

export interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (format: 'pdf' | 'xlsx') => Promise<void> | void;
  title?: string;
  subtitle?: string;
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Export Report',
  subtitle = 'Choose Format',
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'xlsx'>('pdf');
  const [isExporting, setIsExporting] = useState(false);

  const handleDownload = async () => {
    try {
      setIsExporting(true);
      await onConfirm(selectedFormat);
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-sm"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleDownload}
            disabled={isExporting}
            isLoading={isExporting}
            leftIcon={<Download size={16} />}
            className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white"
          >
            Download
          </Button>
        </div>
      }
    >
      <div className="py-2 space-y-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{subtitle}</p>

        <div className="space-y-3">
          {/* PDF Option */}
          <label
            onClick={() => setSelectedFormat('pdf')}
            className={`flex items-center justify-between p-3.5 rounded-lg border cursor-pointer transition-all ${
              selectedFormat === 'pdf'
                ? 'border-green-600 bg-green-50/50 dark:bg-green-950/20 ring-1 ring-green-500'
                : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="exportFormat"
                value="pdf"
                checked={selectedFormat === 'pdf'}
                onChange={() => setSelectedFormat('pdf')}
                className="w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300"
              />
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Export as PDF
                </span>
              </div>
            </div>
          </label>

          {/* Excel Option */}
          <label
            onClick={() => setSelectedFormat('xlsx')}
            className={`flex items-center justify-between p-3.5 rounded-lg border cursor-pointer transition-all ${
              selectedFormat === 'xlsx'
                ? 'border-green-600 bg-green-50/50 dark:bg-green-950/20 ring-1 ring-green-500'
                : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="exportFormat"
                value="xlsx"
                checked={selectedFormat === 'xlsx'}
                onChange={() => setSelectedFormat('xlsx')}
                className="w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300"
              />
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Export as Excel (.xlsx)
                </span>
              </div>
            </div>
          </label>
        </div>
      </div>
    </Modal>
  );
};
