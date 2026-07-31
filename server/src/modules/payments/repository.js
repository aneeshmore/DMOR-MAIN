import { db } from '../../db/index.js';
import { payments, customerTransactions, customers } from '../../db/schema/index.js';
import { eq, desc, sql, and } from 'drizzle-orm';

export class PaymentRepository {
  async createPayment(paymentData, transaction) {
    const tx = transaction || db;
    const [createdPayment] = await tx.insert(payments).values(paymentData).returning();
    return createdPayment;
  }

  async createTransaction(transactionData, transaction) {
    const tx = transaction || db;
    const [createdTx] = await tx.insert(customerTransactions).values(transactionData).returning();
    return createdTx;
  }

  async updateCustomerBalance(customerId, amountChange, transaction) {
    const tx = transaction || db;
    // Amount Change: Positive to increase balance (Debit), Negative to decrease (Credit)
    // SQL: current_balance + amountChange
    const [updatedCustomer] = await tx
      .update(customers)
      .set({
        currentBalance: sql`${customers.currentBalance} + ${amountChange}`,
        updatedAt: new Date(),
      })
      .where(eq(customers.customerId, customerId))
      .returning();
    return updatedCustomer;
  }

  async getCustomerBalance(customerId) {
    const [customer] = await db
      .select({ balance: customers.currentBalance })
      .from(customers)
      .where(eq(customers.customerId, customerId));
    return customer?.balance || 0;
  }

  async getLedger(customerId, fromDate, toDate) {
    // Join payments to expose referenceNo (Cheque No / TXN ID) for PAYMENT rows.
    // Read-only join - does not alter any ledger data or calculations.
    const query = db
      .select({
        transactionId: customerTransactions.transactionId,
        customerId: customerTransactions.customerId,
        type: customerTransactions.type,
        referenceId: customerTransactions.referenceId,
        referenceType: customerTransactions.referenceType,
        description: customerTransactions.description,
        debit: customerTransactions.debit,
        credit: customerTransactions.credit,
        balance: customerTransactions.balance,
        transactionDate: customerTransactions.transactionDate,
        createdAt: customerTransactions.createdAt,
        referenceNo: payments.referenceNo,
        paymentMode: payments.paymentMode,
      })
      .from(customerTransactions)
      .leftJoin(
        payments,
        and(
          eq(customerTransactions.referenceId, payments.paymentId),
          eq(customerTransactions.referenceType, 'payments')
        )
      )
      .where(eq(customerTransactions.customerId, customerId))
      .orderBy(desc(customerTransactions.transactionDate));

    // Add date filters if needed (omitted for brevity, can depend on requirement)

    return await query;
  }

  async findAllPayments({ fromDate, toDate, customerId, paymentMode }) {
    const conditions = [];

    if (customerId) conditions.push(eq(payments.customerId, customerId));
    if (paymentMode) conditions.push(eq(payments.paymentMode, paymentMode));
    if (fromDate) conditions.push(sql`${payments.paymentDate} >= ${new Date(fromDate)}`);
    if (toDate) conditions.push(sql`${payments.paymentDate} <= ${new Date(toDate)}`);

    // Using raw SQL for date comparison might be safer or use between() if available/imported
    // But sql template string is standard in Drizzle.

    const query = db
      .select({
        paymentId: payments.paymentId,
        amount: payments.amount,
        paymentDate: payments.paymentDate,
        paymentMode: payments.paymentMode,
        referenceNo: payments.referenceNo,
        notes: payments.notes,
        customer: {
          id: customers.customerId,
          name: customers.companyName,
        },
      })
      .from(payments)
      .leftJoin(customers, eq(payments.customerId, customers.customerId))
      .where(conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined)
      .orderBy(desc(payments.paymentDate));

    return await query;
  }
  async getPaymentById(paymentId) {
    const [payment] = await db.select().from(payments).where(eq(payments.paymentId, paymentId));
    return payment;
  }

  async updatePayment(paymentId, paymentData, transaction) {
    const tx = transaction || db;
    const [updatedPayment] = await tx
      .update(payments)
      .set({ ...paymentData, updatedAt: new Date() })
      .where(eq(payments.paymentId, paymentId))
      .returning();
    return updatedPayment;
  }

  async updateTransaction(referenceId, referenceType, transactionData, transaction) {
    const tx = transaction || db;
    const [updatedTx] = await tx
      .update(customerTransactions)
      .set(transactionData)
      .where(
        sql`${customerTransactions.referenceId} = ${referenceId} AND ${customerTransactions.referenceType} = ${referenceType}`
      )
      .returning();
    return updatedTx;
  }

  /**
   * Look up an existing ledger entry by its polymorphic reference (and optionally its
   * type). Used as an idempotency guard before posting a debit or reversal, so a retried
   * or duplicate call never double-posts.
   */
  async findTransactionByReference(referenceId, referenceType, type, transaction) {
    const tx = transaction || db;
    const conditions = [
      eq(customerTransactions.referenceId, referenceId),
      eq(customerTransactions.referenceType, referenceType),
    ];
    if (type) conditions.push(eq(customerTransactions.type, type));
    const [existingTx] = await tx
      .select()
      .from(customerTransactions)
      .where(and(...conditions))
      .limit(1);
    return existingTx;
  }

  /**
   * Reverse an order's posted INVOICE debit, if one exists and hasn't already been
   * reversed. Shared by any business event that voids an order's financial obligation
   * (order cancellation, order splitting).
   *
   * Zeroes out the order's own INVOICE row in place (debit -> 0, description updated to
   * explain why) rather than posting a second "reversal" line — the customer's ledger
   * shows one row per order, which flips to a zeroed debit the moment its obligation is
   * voided, instead of the original invoice sitting alongside a separate credit entry.
   *
   * Idempotent by construction: if the INVOICE row's debit is already 0 (already
   * reversed) or no INVOICE row exists at all (order never reached Accounts Approval, so
   * it never had a financial obligation), this is a no-op — nothing is updated.
   *
   * Never touches `payments` rows or PAYMENT-type ledger entries — it only zeroes the
   * order's own INVOICE debit, so customer payments already received are untouched.
   *
   * Note: this mutates a historical ledger row's stored running `balance` to the
   * customer's current balance. For an order reversed shortly after it was billed (the
   * common case), this is exactly correct. If other transactions were posted between the
   * original invoice and this reversal, this row's balance snapshot moves to reflect
   * "now" rather than its original position in the timeline — intervening rows keep
   * their own already-correct snapshots, so only this row's snapshot changes.
   *
   * The original (pre-reversal) amount is appended to the description as a small
   * "(was 1234.56)" marker — no schema change needed — so the ledger UI can show the
   * original amount struck through next to the new 0.00, instead of the amount simply
   * disappearing once the row is zeroed.
   *
   * @returns {Promise<number|null>} the amount reversed, or null if there was nothing to do
   */
  async reverseOrderInvoiceIfExists(orderId, customerId, description, transaction) {
    const existingDebit = await this.findTransactionByReference(
      orderId,
      'orders',
      'INVOICE',
      transaction
    );
    const reversalAmount = existingDebit ? Number(existingDebit.debit) || 0 : 0;
    if (reversalAmount <= 0) return null;

    const postReversal = async tx => {
      const updatedCustomer = await this.updateCustomerBalance(customerId, -reversalAmount, tx);
      if (updatedCustomer) {
        await tx
          .update(customerTransactions)
          .set({
            debit: 0,
            description: `${description} (was ${reversalAmount.toFixed(2)})`,
            balance: updatedCustomer.currentBalance,
            transactionDate: new Date(),
          })
          .where(eq(customerTransactions.transactionId, existingDebit.transactionId));
      }
    };

    if (transaction) {
      await postReversal(transaction);
    } else {
      await db.transaction(postReversal);
    }

    return reversalAmount;
  }
}
