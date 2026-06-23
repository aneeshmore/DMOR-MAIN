import { Router } from 'express';
import { FieldIntelligenceController } from './controller.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validateCreateReport, validateUpdateReport } from './validators.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base uploads directory
const baseUploadDir = path.resolve(__dirname, '../../../uploads/field-intelligence');

// Categorized subdirectories for new uploads
const uploadSubDirs = {
  'Customer Photo': 'customer-photos',
  'Factory Photo': 'customer-photos',
  'Product Photo': 'customer-photos',
  'Shade Sample': 'shade-samples',
  'Competitor Bucket': 'competitor-photos',
  'Competitor Photo': 'competitor-photos',
  'Visiting Card': 'documents',
  'Purchase Order': 'documents',
  'Complaint Photo': 'complaint-photos',
  'Site Condition': 'site-photos',
  'Site Photo': 'site-photos',
  'Video Upload': 'videos',
  'Document': 'documents',
};

// Ensure all subdirectories exist (and legacy root too for backward compat)
const allDirs = [
  baseUploadDir,
  ...Object.values(uploadSubDirs).map(d => path.join(baseUploadDir, d)),
];
allDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine sub-directory from fileType body param; fall back to root (legacy compat)
    const fileType = req.body?.fileType || 'Product Photo';
    const subDir = uploadSubDirs[fileType] || '';
    const dest = subDir ? path.join(baseUploadDir, subDir) : baseUploadDir;
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Sanitize original filename to avoid path traversal
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, uniqueSuffix + '-' + sanitized);
  },
});

const allowedMimeTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'video/mp4',
  'video/mpeg',
];

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB – accommodates video uploads
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Invalid file type. Allowed: JPEG, PNG, GIF, WEBP, PDF, DOC, DOCX, MP4, MPEG.'
        )
      );
    }
  },
});

const handleUploadMiddleware = (req, res, next) => {
  upload.single('file')(req, res, err => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

const router = Router();
const controller = new FieldIntelligenceController();

router.get(
  '/dashboard',
  requirePermission('GET:/field-intelligence/dashboard'),
  controller.getDashboardSummary
);

router.get('/export', requirePermission('GET:/field-intelligence/export'), controller.exportToCsv);

router.get('/', requirePermission('GET:/field-intelligence'), controller.getReportsList);

router.post(
  '/',
  requirePermission('POST:/field-intelligence'),
  validateCreateReport,
  controller.createReport
);

router.get('/:id', requirePermission('GET:/field-intelligence/:id'), controller.getReportDetails);

router.patch(
  '/:id',
  requirePermission('PATCH:/field-intelligence/:id'),
  validateUpdateReport,
  controller.updateReport
);

router.delete('/:id', requirePermission('DELETE:/field-intelligence/:id'), controller.deleteReport);

router.post(
  '/:id/upload',
  requirePermission('POST:/field-intelligence/:id/upload'),
  handleUploadMiddleware,
  controller.handleFileUpload
);

export const fieldIntelligenceRoutes = router;
export default router;
