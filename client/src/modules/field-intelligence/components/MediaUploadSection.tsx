import React, { useState, useRef, useCallback } from 'react';
import { FILE_TYPES } from '../constants/firConstants';

export interface MediaFile {
  id: string;
  fileType: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  // Client-side only: object URL for preview
  previewUrl?: string;
  uploadedAt?: string;
}

interface MediaUploadSectionProps {
  value: MediaFile[];
  onChange: (files: MediaFile[]) => void;
}

/**
 * Enhanced media upload section with:
 *  - Camera capture (mobile-first)
 *  - File upload (desktop)
 *  - Thumbnail previews for images
 *  - Lightbox / fullscreen view
 *  - Document metadata display
 *  - Remove & download actions
 */
export const MediaUploadSection: React.FC<MediaUploadSectionProps> = ({ value = [], onChange }) => {
  const [selectedFileType, setSelectedFileType] = useState<string>('Customer Photo');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isImage = (mime: string) =>
    ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'].includes(mime);
  const isVideo = (mime: string) => mime.startsWith('video/');
  const isPdf = (mime: string) => mime === 'application/pdf';

  const processFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const newItems: MediaFile[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Validate size: 25MB max
        if (file.size > 25 * 1024 * 1024) {
          alert(`File "${file.name}" exceeds the 25MB size limit and was skipped.`);
          continue;
        }
        const previewUrl =
          isImage(file.type) || isVideo(file.type) ? URL.createObjectURL(file) : undefined;

        newItems.push({
          id: `local_${Date.now()}_${i}`,
          fileType: selectedFileType,
          fileName: file.name,
          filePath: `/uploads/field-intelligence/${Date.now()}_${file.name}`,
          mimeType: file.type,
          fileSize: file.size,
          previewUrl,
          uploadedAt: new Date().toISOString(),
        });
      }

      onChange([...value, ...newItems]);
    },
    [value, onChange, selectedFileType]
  );

  const handleRemove = (id: string) => {
    const item = value.find(f => f.id === id);
    if (item?.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
    onChange(value.filter(f => f.id !== id));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mime: string) => {
    if (isImage(mime)) return '🖼️';
    if (isVideo(mime)) return '🎥';
    if (isPdf(mime)) return '📄';
    return '📎';
  };

  return (
    <div className="card p-6 mb-6 border-2 border-dashed border-blue-100 bg-blue-50/30">
      {/* Section header */}
      <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-3 flex items-center gap-2">
        <span className="bg-blue-500 text-white p-1.5 rounded-md">
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
        {value.length > 0 && (
          <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {value.length} file{value.length !== 1 ? 's' : ''}
          </span>
        )}
      </h3>

      {/* Upload Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        {/* Attachment type selector */}
        <div className="mb-3">
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
            Attachment Category
          </label>
          <div className="flex flex-wrap gap-2">
            {FILE_TYPES.slice(0, 8).map((type: string) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedFileType(type)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  selectedFileType === type
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[var(--primary)]'
                }`}
              >
                {type}
              </button>
            ))}
            <select
              value={FILE_TYPES.slice(8).includes(selectedFileType as any) ? selectedFileType : ''}
              onChange={e => e.target.value && setSelectedFileType(e.target.value)}
              className="px-2 py-1 rounded-full text-xs border border-gray-200 bg-white text-gray-600"
            >
              <option value="">More...</option>
              {FILE_TYPES.slice(8).map((t: string) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Upload action button */}
        <div className="flex flex-col gap-3">
          {/* Capture or upload files */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="
              flex items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed
              border-blue-300 bg-blue-50/40 text-blue-700 font-semibold text-sm
              hover:bg-blue-100 hover:border-blue-500 transition-all active:scale-98
              touch-manipulation cursor-pointer w-full
            "
          >
            <span className="text-2xl">📷 📁</span>
            <div className="text-left">
              <p className="font-bold text-blue-900">Capture or Upload Files</p>
              <p className="text-xs font-normal text-blue-500/80">
                Photos, PDFs, Videos up to 25MB
              </p>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,video/mp4"
            multiple
            className="hidden"
            onChange={e => {
              processFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* Preview Grid */}
      {value.length === 0 ? (
        <div className="text-center py-6 text-gray-400">
          <svg
            className="w-10 h-10 mx-auto mb-2 opacity-40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm">No attachments yet. Capture photos or upload files above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {value.map(file => (
            <div
              key={file.id}
              className="relative group rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Thumbnail or icon */}
              {isImage(file.mimeType) && file.previewUrl ? (
                <button
                  type="button"
                  onClick={() => setLightboxUrl(file.previewUrl!)}
                  className="w-full block focus:outline-none"
                >
                  <img
                    src={file.previewUrl}
                    alt={file.fileName}
                    className="w-full h-28 object-cover"
                  />
                </button>
              ) : isVideo(file.mimeType) && file.previewUrl ? (
                <video
                  src={file.previewUrl}
                  className="w-full h-28 object-cover bg-black"
                  muted
                  playsInline
                />
              ) : (
                <div className="w-full h-28 flex items-center justify-center bg-gray-50 text-4xl">
                  {getFileIcon(file.mimeType)}
                </div>
              )}

              {/* File info bar */}
              <div className="p-2">
                <p className="text-xs font-semibold text-gray-700 truncate" title={file.fileName}>
                  {file.fileName}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {file.fileType} · {formatSize(file.fileSize)}
                </p>
              </div>

              {/* Action buttons – visible on hover */}
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Remove */}
                <button
                  type="button"
                  onClick={() => handleRemove(file.id)}
                  className="bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-700"
                  title="Remove"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>

                {/* Download (for already-uploaded files with server path) */}
                {!file.previewUrl && file.filePath && (
                  <a
                    href={file.filePath}
                    download={file.fileName}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-gray-700 text-white rounded-full p-1 shadow hover:bg-gray-900"
                    title="Download"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                  </a>
                )}

                {/* Expand image */}
                {isImage(file.mimeType) && file.previewUrl && (
                  <button
                    type="button"
                    onClick={() => setLightboxUrl(file.previewUrl!)}
                    className="bg-gray-700 text-white rounded-full p-1 shadow hover:bg-gray-900"
                    title="Fullscreen"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {/* Upload status badge */}
              <div className="absolute top-1.5 left-1.5">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    file.previewUrl ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                  }`}
                >
                  {file.previewUrl ? 'Local' : 'Saved'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 text-white bg-white/20 hover:bg-white/40 rounded-full p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <img
            src={lightboxUrl}
            alt="Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default MediaUploadSection;
