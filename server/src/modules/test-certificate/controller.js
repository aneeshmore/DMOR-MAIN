import { TestCertificateService } from './service.js';
import db from '../../db/index.js';
import { company } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';

function getTenantIdFromCompanyId(companyId) {
  if (!companyId) return null;
  const hex = companyId.toString(16).padStart(12, '0');
  return `00000000-0000-0000-0000-${hex}`;
}

/**
 * Resolves the tenant context strictly from the authenticated user's companyName.
 * Throws an error or returns null if no valid context exists.
 */
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

export class TestCertificateController {
  constructor() {
    this.service = new TestCertificateService();
  }

  getTestCertificatesList = async (req, res, next) => {
    try {
      const context = await getTenantContext(req);
      if (!context) {
        return res
          .status(403)
          .json({ success: false, message: 'Forbidden: Access denied (Tenant context missing)' });
      }

      const filters = {
        search: req.query.search,
        status: req.query.status,
      };

      const certs = await this.service.getTestCertificatesList(
        filters,
        context.companyId,
        context.tenantId
      );
      res.status(200).json({ success: true, data: certs });
    } catch (error) {
      next(error);
    }
  };

  getTestCertificateDetails = async (req, res, next) => {
    try {
      const context = await getTenantContext(req);
      if (!context) {
        return res
          .status(403)
          .json({ success: false, message: 'Forbidden: Access denied (Tenant context missing)' });
      }

      const certId = parseInt(req.params.id, 10);
      const cert = await this.service.getTestCertificateDetails(
        certId,
        context.companyId,
        context.tenantId
      );
      res.status(200).json({ success: true, data: cert });
    } catch (error) {
      next(error);
    }
  };

  createTestCertificate = async (req, res, next) => {
    try {
      const context = await getTenantContext(req);
      if (!context) {
        return res
          .status(403)
          .json({ success: false, message: 'Forbidden: Access denied (Tenant context missing)' });
      }

      const cert = await this.service.createTestCertificate(
        req.validatedBody,
        req.user,
        context.companyId,
        context.tenantId
      );

      res.status(201).json({
        success: true,
        data: cert,
        message: 'Test Certificate created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  updateTestCertificate = async (req, res, next) => {
    try {
      const context = await getTenantContext(req);
      if (!context) {
        return res
          .status(403)
          .json({ success: false, message: 'Forbidden: Access denied (Tenant context missing)' });
      }

      const certId = parseInt(req.params.id, 10);
      const cert = await this.service.updateTestCertificate(
        certId,
        req.validatedBody,
        context.companyId,
        context.tenantId
      );

      res.status(200).json({
        success: true,
        data: cert,
        message: 'Test Certificate updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  deleteTestCertificate = async (req, res, next) => {
    try {
      const context = await getTenantContext(req);
      if (!context) {
        return res
          .status(403)
          .json({ success: false, message: 'Forbidden: Access denied (Tenant context missing)' });
      }

      const certId = parseInt(req.params.id, 10);
      await this.service.deleteTestCertificate(certId, context.companyId, context.tenantId);

      res.status(200).json({
        success: true,
        message: 'Test Certificate deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getCompletedBatches = async (req, res, next) => {
    try {
      const context = await getTenantContext(req);
      if (!context) {
        return res
          .status(403)
          .json({ success: false, message: 'Forbidden: Access denied (Tenant context missing)' });
      }

      const batches = await this.service.getCompletedBatches(context.companyId, context.tenantId);
      res.status(200).json({ success: true, data: batches });
    } catch (error) {
      next(error);
    }
  };

  getCompletedBatchDetails = async (req, res, next) => {
    try {
      const context = await getTenantContext(req);
      if (!context) {
        return res
          .status(403)
          .json({ success: false, message: 'Forbidden: Access denied (Tenant context missing)' });
      }

      const batchId = parseInt(req.params.id, 10);
      const batch = await this.service.getCompletedBatchDetails(
        batchId,
        context.companyId,
        context.tenantId
      );
      res.status(200).json({ success: true, data: batch });
    } catch (error) {
      next(error);
    }
  };
}
