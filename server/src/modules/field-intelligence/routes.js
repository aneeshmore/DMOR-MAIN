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

// Define storage location: server/uploads/field-intelligence/
const uploadDir = path.resolve(__dirname, '../../../uploads/field-intelligence');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'video/mp4',
      'video/mpeg',
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Invalid file type. Only JPEGs, PNGs, GIFs, WEBPs, PDFs, and MP4/MPEG videos are allowed.'
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
