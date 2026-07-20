import { QuotationsRepository } from './repository.js';
import { OrdersService } from '../orders/service.js';
import db from '../../db/index.js';
import { products as productsSchema } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';

export class QuotationsService {
  constructor() {
    this.repository = new QuotationsRepository();
    this.ordersService = new OrdersService();
  }

  async createQuotation(data) {
    // Generate quotation number if not provided
    const quotationNo = data.quotationNo || (await this.repository.getNextQuotationNumber());

    return await this.repository.create({
      quotationNo,
      quotationDate:
        data.date ||
        data.quotationDate ||
        new Date()
          .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
          .replace(/ /g, '-'),
      companyName: data.companyName,
      buyerName: data.buyerName,
      customerId: data.customerId || null,
      content: data.content || data, // Support both formats
      status: 'Pending',
      createdBy: data.createdBy || null,
    });
  }

  async getAllQuotations(customerId = null, createdBy = null) {
    if (customerId) {
      return await this.repository.findByCustomerId(customerId, createdBy);
    }
    return await this.repository.findAll(createdBy);
  }

  async updateStatus(id, status, rejectionRemark = null) {
    return await this.repository.updateStatus(id, status, rejectionRemark);
  }

  async approveQuotation(id) {
    return await this.updateStatus(id, 'Approved');
  }

  async rejectQuotation(id, remark) {
    return await this.updateStatus(id, 'Rejected', remark);
  }

  async updateQuotation(id, data, userContext = {}) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new Error('Quotation not found');

    // Ownership check: non-admins can only update their own quotations
    if (!userContext.isAdmin && userContext.userId && existing.createdBy !== userContext.userId) {
      throw new Error('Access denied: You can only update your own quotations');
    }

    if (existing.status !== 'Rejected' && existing.status !== 'Pending' && existing.status !== 'Approved') {
      throw new Error('Only rejected, pending, or approved quotations can be updated');
    }

    return await this.repository.update(id, {
      quotationNo: data.quotationNo || existing.quotationNo,
      quotationDate: data.quotationDate || existing.quotationDate,
      companyName: data.companyName || existing.companyName,
      buyerName: data.buyerName || existing.buyerName,
      customerId: data.customerId || existing.customerId,
      content: data.content || data,
      status: 'Pending', // Reset status to Pending when updated for re-approval
    });
  }

  async convertToOrder(id, userContext = {}) {
    const quotation = await this.repository.findById(id);
    if (!quotation) throw new Error('Quotation not found');

    // Ownership check: non-admins can only convert their own quotations
    if (!userContext.isAdmin && userContext.userId && quotation.createdBy !== userContext.userId) {
      throw new Error('Access denied: You can only convert your own quotations');
    }

    if (quotation.status === 'Converted') {
      throw new Error('Quotation already converted to order');
    }

    if (quotation.status !== 'Approved') {
      throw new Error('Only approved quotations can be converted to orders');
    }

    const content = quotation.content;
    const items = content.items || [];
    const orderDetails = [];

    // 1. Validate and Map Products
    for (const item of items) {
      if (!item.quantity) continue;

      // Try to find product by name
      const [product] = await db
        .select()
        .from(productsSchema)
        .where(eq(productsSchema.productName, item.description));

      if (!product) {
        throw new Error(
          `Cannot convert to order: Product '${item.description}' not found in master. Please ensure exact product name match.`
        );
      }

      orderDetails.push({
        productId: product.productId,
        quantity: item.quantity,
        unitPrice: item.rate,
        discount: item.discount,
      });
    }

    // 2. Resolve Customer (Buyer)
    const { customers } = await import('../../db/schema/index.js');

    let customerId = quotation.customerId;

    // If not linked, try to find by GSTIN or company name
    if (!customerId && content.buyerGSTIN) {
      const [existing] = await db
        .select()
        .from(customers)
        .where(eq(customers.gstin, content.buyerGSTIN));
      if (existing) customerId = existing.customerId;
    }

    if (!customerId && content.buyerName) {
      const [existing] = await db
        .select()
        .from(customers)
        .where(eq(customers.companyName, content.buyerName));
      if (existing) customerId = existing.customerId;
    }

    // Create customer if not exists
    if (!customerId) {
      const [newCust] = await db
        .insert(customers)
        .values({
          companyName: content.buyerName || 'Unknown Buyer',
          address: content.buyerAddress,
          gstin: content.buyerGSTIN,
          state: content.buyerState,
          stateCode: content.buyerCode,
          contactPerson: 'Director',
          mobile: '0000000000',
        })
        .returning();
      customerId = newCust.customerId;
    }

    // 3. Create Order - Get salesperson from quotation.createdBy or from content.salespersonId
    const salespersonId = quotation.createdBy || content.salespersonId || null;

    const orderData = {
      customerId,
      salespersonId,
      orderDate: new Date().toISOString(),
      orderDetails,
      deliveryAddress: content.customerAddress || content.buyerAddress,
      remarks: `Converted from Quotation #${quotation.quotationNo}`,
      // No explicit status: OrdersService.createOrder applies the standard
      // 'Pending Accounts Approval' default, so an order converted from a
      // quotation enters the same approval workflow as one created directly.
      // Previously this passed the legacy 'Pending' status, which overrode
      // that default and mislabelled the order in Recent Orders.
      priority: 'Normal',
    };

    const newOrder = await this.ordersService.createOrder(orderData);

    // 4. Update Quotation Status
    await this.updateStatus(id, 'Converted');

    return newOrder;
  }
}
