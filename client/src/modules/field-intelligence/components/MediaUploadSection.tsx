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
  executiveName?: string;
  customerName?: string;
  latitude?: string;
  longitude?: string;
  disabled?: boolean;
  onLocationDetected?: (lat: string, lon: string) => void;
}

const STORAGE_LIMIT = 500 * 1024; // 500 KB

const compressAndWatermarkImage = (
  file: File,
  executiveName: string,
  customerName: string,
  latitude: string,
  longitude: string
): Promise<File> => {
  return new Promise(resolve => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      // 1. Resize to max-width: 1920px
      let w = img.width;
      let h = img.height;
      const MAX_WIDTH = 1920;
      if (w > MAX_WIDTH) {
        h = Math.round((h * MAX_WIDTH) / w);
        w = MAX_WIDTH;
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      // Draw original downscaled image
      ctx.drawImage(img, 0, 0, w, h);

      // 2. Gather Forensic Details
      const ua = navigator.userAgent || '';
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const sourceStr = isMobile ? 'MOBILE CAMERA' : 'DESKTOP / LAPTOP UPLOAD';

      const formatDecimal = (val: string) => {
        if (!val || val === 'N/A' || val === 'undefined') return 'Not Available';
        const num = parseFloat(val);
        return isNaN(num) ? 'Not Available' : num.toFixed(6);
      };

      const latStr = formatDecimal(latitude);
      const lonStr = formatDecimal(longitude);

      // Date Format: DD MMM YYYY (e.g. 20 Jul 2026)
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      // Time Format: HH:MM:SS AM/PM
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      const lines = [
        `DATE : ${dateStr}`,
        `TIME : ${timeStr}`,
        `LAT : ${latStr}`,
        `LON : ${lonStr}`,
        `SOURCE : ${sourceStr}`,
      ];

      // 3. Dynamic Font Scaling & Layout calculation
      const base = Math.min(w, h);
      let fontSize = (Math.max(10, Math.round(base * 0.013)) + 2.5) * 2;
      let margin = Math.round(base * 0.025) + Math.round(fontSize * 0.25);

      ctx.font = `bold ${fontSize}px Inter, Roboto, sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';

      // Overflow Auto-Fit Logic
      const maxAllowedWidth = w - margin * 2;
      let widestWidth = 0;
      lines.forEach(line => {
        const metrics = ctx.measureText(line);
        if (metrics.width > widestWidth) widestWidth = metrics.width;
      });

      if (widestWidth > maxAllowedWidth) {
        fontSize = Math.max(9, Math.floor((fontSize * maxAllowedWidth) / widestWidth));
        ctx.font = `bold ${fontSize}px Inter, Roboto, sans-serif`;
        margin = Math.round(base * 0.025) + Math.round(fontSize * 0.25);
      }

      const lineHeight = Math.round(fontSize * 1.4);

      // 4. Render Legibility Halo Text (Dark stroke outline + white fill for 100% contrast)
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.lineWidth = Math.max(2.5, fontSize * 0.16);
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
      ctx.shadowBlur = Math.max(2, Math.round(fontSize / 5));
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      lines.forEach((line, index) => {
        // Draw bottom-up: last line at index 4 drawn closest to bottom margin
        const lineOffset = (lines.length - 1 - index) * lineHeight;
        const x = w - margin;
        const y = h - margin - lineOffset;
        ctx.strokeText(line, x, y);
        ctx.fillText(line, x, y);
      });

      // Clear shadow and stroke properties for clean export
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // 5. Final JPEG quality reduction loop to ensure <= 500 KB limit
      const attemptBlobExport = (quality: number): Promise<Blob | null> => {
        return new Promise(resBlob => {
          canvas.toBlob(b => resBlob(b), 'image/jpeg', quality);
        });
      };

      const compressLoop = async () => {
        let quality = 0.9;
        let blob = await attemptBlobExport(quality);

        while (blob && blob.size > 500 * 1024 && quality > 0.3) {
          quality -= 0.15;
          blob = await attemptBlobExport(quality);
        }

        if (blob) {
          const watermarkedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(watermarkedFile);
        } else {
          resolve(file);
        }
        URL.revokeObjectURL(img.src);
      };

      compressLoop();
    };
    img.onerror = () => {
      resolve(file);
    };
  });
};

export const MediaUploadSection: React.FC<MediaUploadSectionProps> = ({
  value = [],
  onChange,
  executiveName = 'N/A',
  customerName = 'N/A',
  latitude = 'N/A',
  longitude = 'N/A',
  disabled = false,
  onLocationDetected,
}) => {
  const [selectedFileType, setSelectedFileType] = useState<string>('Customer Photo');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isImage = (mime: string) =>
    ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'].includes(mime);
  const isVideo = (mime: string) => mime.startsWith('video/');
  const isPdf = (mime: string) => mime === 'application/pdf';

  const totalSize = value.reduce((sum, file) => sum + file.fileSize, 0);

  const processFiles = useCallback(
    async (files: FileList | null) => {
      if (disabled || !files || files.length === 0) return;
      const newItems: MediaFile[] = [];

      let currentTotalSize = value.reduce((sum, f) => sum + f.fileSize, 0);

      // Resolve coordinates (on-the-fly fallback if not provided)
      let finalLat = latitude;
      let finalLon = longitude;
      let locationDetected = false;

      if (
        (!finalLat || finalLat === 'N/A' || finalLat === 'undefined' || finalLat.trim() === '') &&
        navigator.geolocation
      ) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolvePos, rejectPos) => {
            navigator.geolocation.getCurrentPosition(resolvePos, rejectPos, {
              enableHighAccuracy: true,
              timeout: 6000,
            });
          });
          finalLat = pos.coords.latitude.toFixed(6);
          finalLon = pos.coords.longitude.toFixed(6);
          locationDetected = true;
        } catch (err) {
          console.warn('Fallback on-the-fly geolocation failed:', err);
        }
      }

      if (locationDetected && finalLat && finalLon) {
        onLocationDetected?.(finalLat, finalLon);
      }

      for (let i = 0; i < files.length; i++) {
        const rawFile = files[i];

        let file = rawFile;
        if (isImage(rawFile.type)) {
          file = await compressAndWatermarkImage(
            rawFile,
            executiveName,
            customerName,
            finalLat,
            finalLon
          );
        }

        // Check Combined Storage Limit
        if (currentTotalSize + file.size > STORAGE_LIMIT) {
          alert('Storage Limit Reached: Combined file size cannot exceed 500 KB.');
          break;
        }

        currentTotalSize += file.size;

        const previewUrl =
          isImage(file.type) || isVideo(file.type) ? URL.createObjectURL(file) : undefined;

        // Persist the actual (compressed + watermarked) bytes as a base64 data URL
        // in filePath, so the image survives save/reload and renders in Report
        // Details. The uploads.file_path column is TEXT and the API body limit is
        // 10mb, so no schema or backend change is needed.
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        newItems.push({
          id: `local_${Date.now()}_${i}`,
          fileType: selectedFileType,
          fileName: file.name,
          filePath: dataUrl,
          mimeType: file.type,
          fileSize: file.size,
          previewUrl,
          uploadedAt: new Date().toISOString(),
        });
      }

      onChange([...value, ...newItems]);
    },
    [
      value,
      onChange,
      selectedFileType,
      disabled,
      executiveName,
      customerName,
      latitude,
      longitude,
      onLocationDetected,
    ]
  );

  const handleRemove = (id: string) => {
    if (disabled) return;
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

      {/* Storage Capacity Progress Indicator */}
      <div className="mb-4 bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex justify-between items-center text-xs font-semibold mb-1 text-gray-500">
          <span>Camera only - images are automatically compressed</span>
          <span>
            {formatSize(totalSize)} of {formatSize(STORAGE_LIMIT)} (
            {Math.min(100, Math.round((totalSize / STORAGE_LIMIT) * 100))}% Used)
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
          <div
            className={`h-full transition-all duration-300 ${
              totalSize / STORAGE_LIMIT > 0.9
                ? 'bg-red-500'
                : totalSize / STORAGE_LIMIT > 0.7
                  ? 'bg-amber-500'
                  : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(100, (totalSize / STORAGE_LIMIT) * 100)}%` }}
          />
        </div>
      </div>

      {disabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4 flex items-center gap-2.5 text-amber-800 text-xs font-medium shadow-sm">
          <svg
            className="w-4 h-4 text-amber-600 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span>
            Media attachments are locked in draft edit mode. Uploaded images cannot be removed nor
            can new images be added.
          </span>
        </div>
      )}

      {!disabled && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
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
                value={
                  FILE_TYPES.slice(8).includes(selectedFileType as any) ? selectedFileType : ''
                }
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

          <div className="flex flex-col gap-3">
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
              <span className="text-2xl">📷</span>
              <div className="text-left">
                <p className="font-bold text-blue-900">Capture Photo (Mobile Camera Only)</p>
                <p className="text-xs font-normal text-blue-500/80">
                  Secure environment-capture only
                </p>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => {
                processFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        </div>
      )}

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
          <p className="text-sm">No attachments yet. Capture photos above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {value.map(file => (
            <div
              key={file.id}
              className="relative group rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
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

              <div className="p-2">
                <p className="text-xs font-semibold text-gray-700 truncate" title={file.fileName}>
                  {file.fileName}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {file.fileType} · {formatSize(file.fileSize)}
                </p>
              </div>

              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!disabled && (
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
                )}

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
