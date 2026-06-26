import React, { useState } from 'react';
import { useFieldArray, Control, UseFormRegister } from 'react-hook-form';
import { FieldIntelligenceReport } from '../types/fieldIntelligence.types';

interface SectionProps {
  control: Control<FieldIntelligenceReport>;
  register: UseFormRegister<FieldIntelligenceReport>;
}

export const PhotoUploadSection: React.FC<SectionProps> = ({ control, register }) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'uploads',
  });

  const [selectedFileType, setSelectedFileType] = useState('Customer Photo');

  const fileTypes = [
    'Customer Photo',
    'Factory Photo',
    'Product Photo',
    'Shade Sample',
    'Competitor Bucket',
    'Visiting Card',
    'Purchase Order',
    'Complaint Photo',
    'Site Condition',
    'Video Upload',
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      append({
        fileType: selectedFileType,
        fileName: file.name,
        filePath: `/uploads/field-intelligence/${Date.now()}_${file.name}`,
        mimeType: file.type,
        fileSize: file.size,
      });
    }
    // Clear input
    e.target.value = '';
  };

  return (
    <div className="card p-6 mb-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
        <span className="bg-primary-100 text-primary-600 p-1.5 rounded-md">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </span>
        Media & Document Attachments
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 items-end bg-gray-50 p-4 rounded-lg border">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Attachment Type</label>
          <select
            value={selectedFileType}
            onChange={e => setSelectedFileType(e.target.value)}
            className="input"
          >
            {fileTypes.map(type => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Upload File Metadata
          </label>
          <div className="relative">
            <input
              type="file"
              onChange={handleFileChange}
              multiple
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="input border-dashed border-2 border-primary-300 text-center py-2 text-primary bg-white hover:bg-primary-50">
              Click to select / upload files
            </div>
          </div>
        </div>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No attachments uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="flex justify-between items-center border p-3 rounded-lg bg-white shadow-sm relative"
            >
              <input type="hidden" {...register(`uploads.${index}.fileType`)} />
              <input type="hidden" {...register(`uploads.${index}.fileName`)} />
              <input type="hidden" {...register(`uploads.${index}.filePath`)} />
              <input type="hidden" {...register(`uploads.${index}.mimeType`)} />
              <input type="hidden" {...register(`uploads.${index}.fileSize`)} />

              <div className="flex items-center gap-3">
                <span className="bg-primary-50 text-primary p-2 rounded-lg font-bold text-xs">
                  {field.fileType.slice(0, 4).toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-800 truncate max-w-xs">
                    {field.fileName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {field.fileType} • {((field.fileSize || 0) / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => remove(index)}
                className="text-red-500 hover:text-red-700 p-1.5"
                title="Remove attachment"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default PhotoUploadSection;
