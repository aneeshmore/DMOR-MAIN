/**
 * Low Stock Sweep Job
 *
 * The low-stock notification hook in inventory-transaction.service.js only fires
 * on stock MOVEMENTS. Products already below their minimum stock level (e.g.
 * configured before the hook existed, or set below minimum by direct edits)
 * would otherwise never generate a stored notification.
 *
 * This sweep runs once at server startup: it reuses the inventory low-stock
 * query (FG + RM + PM) and creates a MaterialShortage/lowStock notification for
 * any product below minimum that does not already have an active one.
 * Fully idempotent — the per-product duplicate guard makes re-runs no-ops.
 * Non-blocking: failures are logged and never affect server startup.
 */

import { InventoryRepository } from '../modules/inventory/repository.js';
import { NotificationsService } from '../modules/notifications/service.js';

/** Create a low-stock notification for one low-stock query row (with duplicate guard). */
async function createForRow(notificationsService, p) {
  const productId = p.product_id ?? p.productId;
  const productType = p.product_type ?? p.productType ?? 'FG';
  if (!productId) return false;

  const exists = await notificationsService.repository.hasActiveLowStockNotification(productId, productType);
  if (exists) return false;

  await notificationsService.createLowStockNotification({
    productId,
    productName: p.product_name ?? p.productName ?? `Product #${productId}`,
    availableQty: parseFloat(p.available_quantity ?? p.availableQuantity ?? 0),
    minLevel: parseFloat(p.min_stock_level ?? p.minStockLevel ?? 0),
    productType,
  });
  return true;
}

/**
 * [MIN-STOCK EDIT] Reconcile the low-stock notification state for ONE product
 * after its minimum stock level (or stock) is edited outside a stock movement
 * (e.g. Update Product page). Creates the alert if the product is now below
 * minimum; clears any active alert if it no longer is. Non-blocking.
 */
export async function reconcileLowStockForProduct(productId) {
  try {
    const id = Number(productId);
    if (Number.isNaN(id)) return;

    const inventoryRepository = new InventoryRepository();
    const notificationsService = new NotificationsService();

    const lowStockProducts = await inventoryRepository.getLowStockProducts();
    const row = (lowStockProducts || []).find(
      p => Number(p.product_id ?? p.productId) === id
    );

    if (row) {
      const created = await createForRow(notificationsService, row);
      if (created) {
        console.log(`[LowStockSweep] Notification created for product ${id} (min stock edited)`);
      }
    } else {
      // Product is not below minimum anymore — clear any active alert for it
      await notificationsService.repository.deleteByMaterialId(id);
    }
  } catch (err) {
    console.error(`[LowStockSweep] Reconcile failed for product ${productId}:`, err.message);
  }
}

export async function sweepLowStockNotifications() {
  try {
    const inventoryRepository = new InventoryRepository();
    const notificationsService = new NotificationsService();

    const lowStockProducts = await inventoryRepository.getLowStockProducts();
    if (!lowStockProducts || lowStockProducts.length === 0) return;

    let created = 0;
    for (const p of lowStockProducts) {
      try {
        if (await createForRow(notificationsService, p)) {
          created++;
        }
      } catch (perProductErr) {
        console.error(
          `[LowStockSweep] Failed for product ${p.product_id ?? p.productId}:`,
          perProductErr.message
        );
      }
    }

    if (created > 0) {
      console.log(
        `[LowStockSweep] Created ${created} low-stock notification(s) for products below minimum`
      );
    }
  } catch (err) {
    console.error('[LowStockSweep] Sweep failed (non-blocking):', err.message);
  }
}
