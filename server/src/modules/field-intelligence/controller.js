import { FieldIntelligenceService } from './service.js';
import db from '../../db/index.js';
import { company } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import logger from '../../config/logger.js';

// Generate valid UUID deterministically from companyId instead of companyName hashing
function getTenantIdFromCompanyId(companyId) {
  if (!companyId) return null;
  const hex = companyId.toString(16).padStart(12, '0');
  return `00000000-0000-0000-0000-${hex}`;
}

// Resolve company_id and tenant_id from logged in user companyName
async function getTenantContext(req) {
  const companyName = req.user?.companyName;
  let cRecord = null;

  if (companyName) {
    const [found] = await db
      .select()
      .from(company)
      .where(eq(company.companyName, companyName))
      .limit(1);
    cRecord = found;
  }

  // Fallback to first company record if not resolved by companyName
  if (!cRecord) {
    const [first] = await db.select().from(company).limit(1);
    cRecord = first;
  }

  if (!cRecord) {
    return null;
  }

  return {
    companyId: cRecord.companyId,
    tenantId: getTenantIdFromCompanyId(cRecord.companyId),
  };
}

export class FieldIntelligenceController {
  constructor() {
    this.service = new FieldIntelligenceService();
  }

  createReport = async (req, res, next) => {
    try {
      const context = await getTenantContext(req);
      if (!context) {
        return res
          .status(403)
          .json({ success: false, message: 'Forbidden: Access denied (Company context missing)' });
      }

      const report = await this.service.createReport(
        req.validatedBody,
        req.user,
        context.companyId,
        context.tenantId
      );

      res.status(201).json({
        success: true,
        data: report,
        message: 'SMART CRM Visit Report created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  updateReport = async (req, res, next) => {
    try {
      const context = await getTenantContext(req);
      if (!context) {
        return res
          .status(403)
          .json({ success: false, message: 'Forbidden: Access denied (Company context missing)' });
      }

      const report = await this.service.updateReport(
        req.params.id,
        req.validatedBody,
        req.user,
        context.companyId,
        context.tenantId
      );

      res.status(200).json({
        success: true,
        data: report,
        message: 'SMART CRM Visit Report updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  deleteReport = async (req, res, next) => {
    try {
      const context = await getTenantContext(req);
      if (!context) {
        return res
          .status(403)
          .json({ success: false, message: 'Forbidden: Access denied (Company context missing)' });
      }

      await this.service.deleteReport(req.params.id, req.user, context.companyId, context.tenantId);

      res.status(200).json({
        success: true,
        message: 'SMART CRM Visit Report deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getReportDetails = async (req, res, next) => {
    try {
      const context = await getTenantContext(req);
      if (!context) {
        return res
          .status(403)
          .json({ success: false, message: 'Forbidden: Access denied (Company context missing)' });
      }

      const report = await this.service.getReportDetails(
        req.params.id,
        req.user,
        context.companyId,
        context.tenantId
      );

      res.status(200).json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  };

  getReportAiInsights = async (req, res, next) => {
    try {
      const context = await getTenantContext(req);
      if (!context) {
        return res
          .status(403)
          .json({ success: false, message: 'Forbidden: Access denied (Company context missing)' });
      }

      const insights = await this.service.getReportAiInsights(
        req.params.id,
        req.user,
        context.companyId,
        context.tenantId
      );

      res.status(200).json({
        success: true,
        data: insights,
      });
    } catch (error) {
      next(error);
    }
  };

  getReportsList = async (req, res, next) => {
    try {
      const context = await getTenantContext(req);
      if (!context) {
        return res
          .status(403)
          .json({ success: false, message: 'Forbidden: Access denied (Company context missing)' });
      }

      const filters = {
        status: req.query.status,
        executiveId: req.query.executiveId ? parseInt(req.query.executiveId, 10) : undefined,
        search: req.query.search,
        sortBy: req.query.sortBy || 'createdAt',
        sortOrder: req.query.sortOrder || 'desc',
        limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset, 10) : undefined,
      };

      const reports = await this.service.getReportsList(
        filters,
        req.user,
        context.companyId,
        context.tenantId
      );

      res.status(200).json({
        success: true,
        data: reports,
      });
    } catch (error) {
      next(error);
    }
  };

  getDashboardSummary = async (req, res, next) => {
    try {
      const context = await getTenantContext(req);
      if (!context) {
        return res
          .status(403)
          .json({ success: false, message: 'Forbidden: Access denied (Company context missing)' });
      }

      const summary = await this.service.getDashboardSummary(
        context.companyId,
        context.tenantId,
        req.user
      );

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  };

  exportToCsv = async (req, res, next) => {
    try {
      const context = await getTenantContext(req);
      if (!context) {
        return res
          .status(403)
          .json({ success: false, message: 'Forbidden: Access denied (Company context missing)' });
      }

      const csvContent = await this.service.exportToCsv(
        context.companyId,
        context.tenantId,
        req.user
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=field_intelligence_reports_${Date.now()}.csv`
      );
      res.status(200).send(csvContent);
    } catch (error) {
      next(error);
    }
  };

  handleFileUpload = async (req, res, next) => {
    try {
      const context = await getTenantContext(req);
      if (!context) {
        return res
          .status(403)
          .json({ success: false, message: 'Forbidden: Access denied (Company context missing)' });
      }

      // Map fileType to subdirectory for building the relative file path
      const subDirMap = {
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
        Document: 'documents',
      };

      let fileData;
      if (req.file) {
        // Physical file upload via multer – build path using subdirectory
        const fileType = req.body.fileType || 'Product Photo';
        const subDir = subDirMap[fileType] || '';
        const relativePath = subDir
          ? `/uploads/field-intelligence/${subDir}/${req.file.filename}`
          : `/uploads/field-intelligence/${req.file.filename}`;

        fileData = {
          fileType,
          fileName: req.file.originalname,
          filePath: relativePath,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
        };
      } else {
        // Fallback for metadata-only JSON payload (backward compatible)
        if (!req.body.fileName || !req.body.filePath) {
          return res.status(400).json({
            success: false,
            message: 'Invalid payload: fileName and filePath are required.',
          });
        }
        // Manual validation for JSON upload limits
        const maxLimit = 25 * 1024 * 1024; // 25MB
        if (req.body.fileSize && parseInt(req.body.fileSize, 10) > maxLimit) {
          return res.status(400).json({ success: false, message: 'File size exceeds 25MB limit.' });
        }
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
        if (req.body.mimeType && !allowedMimeTypes.includes(req.body.mimeType)) {
          return res.status(400).json({ success: false, message: 'Invalid mime type.' });
        }

        fileData = {
          fileType: req.body.fileType || 'Product Photo',
          fileName: req.body.fileName,
          filePath: req.body.filePath,
          mimeType: req.body.mimeType || 'image/jpeg',
          fileSize: req.body.fileSize ? parseInt(req.body.fileSize, 10) : 1024,
        };
      }

      const upload = await this.service.logUpload(
        req.params.id,
        fileData,
        req.user,
        context.companyId,
        context.tenantId
      );

      res.status(201).json({
        success: true,
        data: upload,
        message: 'File upload processed successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // ── Customer Intelligence ─────────────────────────────────────────────────

  getCustomerSummary = async (req, res, next) => {
    try {
      const context = await getTenantContext(req);
      if (!context) return res.status(403).json({ success: false, message: 'Forbidden' });

      const filters = { search: req.query.search };
      const data = await this.service.getCustomerSummary(
        filters,
        context.companyId,
        context.tenantId,
        req.user
      );

      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getCustomerHistory = async (req, res, next) => {
    try {
      const context = await getTenantContext(req);
      if (!context) return res.status(403).json({ success: false, message: 'Forbidden' });

      const visits = await this.service.getCustomerHistory(
        req.params.customerId,
        context.companyId,
        context.tenantId,
        req.user
      );

      res.status(200).json({ success: true, data: visits });
    } catch (error) {
      next(error);
    }
  };

  getCustomerDashboard = async (req, res, next) => {
    try {
      const context = await getTenantContext(req);
      if (!context) return res.status(403).json({ success: false, message: 'Forbidden' });

      const dashboard = await this.service.getCustomerDashboard(
        req.params.customerId,
        context.companyId,
        context.tenantId,
        req.user
      );

      res.status(200).json({ success: true, data: dashboard });
    } catch (error) {
      next(error);
    }
  };

  getCustomerUnlinkedHistory = async (req, res, next) => {
    try {
      const context = await getTenantContext(req);
      if (!context) return res.status(403).json({ success: false, message: 'Forbidden' });

      const history = await this.service.getCustomerUnlinkedHistory(
        req.query.customerName,
        context.companyId,
        context.tenantId,
        req.user
      );

      res.status(200).json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  };

  chatWithCopilot = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { messages } = req.body;
      const context = await getTenantContext(req);

      if (!Array.isArray(messages)) {
        return res.status(400).json({ success: false, message: 'messages array is required' });
      }

      // Configure SSE Headers for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      await this.service.streamChat(
        id,
        messages,
        res,
        req.user,
        context?.companyId,
        context?.tenantId
      );
      res.write('event: end\ndata: [DONE]\n\n');
      res.end();
    } catch (err) {
      logger.error('Smart CRM chatWithCopilot error', { error: err.message });
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: err.message });
      } else {
        res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
        res.end();
      }
    }
  };

  chatWithCompanyCopilot = async (req, res, next) => {
    try {
      const { customerName, customerId, messages } = req.body;
      const context = await getTenantContext(req);

      if (!customerName) {
        return res.status(400).json({ success: false, message: 'customerName is required' });
      }
      if (!Array.isArray(messages)) {
        return res.status(400).json({ success: false, message: 'messages array is required' });
      }

      // Configure SSE Headers for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      await this.service.streamCompanyChat(
        customerName,
        customerId,
        messages,
        res,
        req.user,
        context?.companyId,
        context?.tenantId
      );
      res.write('event: end\ndata: [DONE]\n\n');
      res.end();
    } catch (err) {
      logger.error('Smart CRM chatWithCompanyCopilot error', { error: err.message });
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: err.message });
      } else {
        res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
        res.end();
      }
    }
  };
}
