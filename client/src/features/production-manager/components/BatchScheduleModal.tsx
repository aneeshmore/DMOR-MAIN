import { useState, useEffect } from 'react';
import { X, Package, Weight, AlertCircle, CheckCircle2, Calendar } from 'lucide-react';
import { productionManagerApi, MaterialRequirement } from '../api/productionManagerApi';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { showToast } from '@/utils/toast';
import { formatQty } from '@/utils/formatters';

interface MasterProductSummary {
  masterProductId: number;
  masterProductName: string;
  totalWeight: number;
  products: {
    productId: number;
    productName: string;
    quantity: number;
    weight: number;
  }[];
}

interface BatchScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
  orderNumber: string;
  expectedDeliveryDate: string;
  pmRemarks?: string;
  onSuccess: () => void;
}

export function BatchScheduleModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  expectedDeliveryDate,
  pmRemarks,
  onSuccess,
}: BatchScheduleModalProps) {
  const [loading, setLoading] = useState(false);
  const [masterProducts, setMasterProducts] = useState<MasterProductSummary[]>([]);
  const [materials, setMaterials] = useState<MaterialRequirement[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchOrderDetails();
    }
  }, [isOpen, orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const response = await productionManagerApi.getOrderDetails(orderId);
      const details = response.details || [];

      // Group by master product
      const grouped: Record<number, MasterProductSummary> = {};

      details.forEach((item: any) => {
        const masterProductId =
          item.product?.masterProductId || item.masterProduct?.masterProductId;
        const masterProductName =
          item.product?.masterProductName || item.masterProduct?.masterProductName || 'Unknown';

        if (!masterProductId) return;

        if (!grouped[masterProductId]) {
          grouped[masterProductId] = {
            masterProductId,
            masterProductName,
            totalWeight: 0,
            products: [],
          };
        }

        const weight = (item.orderDetail?.quantity || 0) * (item.product?.packageCapacityKg || 0);

        grouped[masterProductId].products.push({
          productId: item.product?.id || item.orderDetail?.productId,
          productName: item.product?.productName || 'Unknown',
          quantity: item.orderDetail?.quantity || 0,
          weight,
        });

        grouped[masterProductId].totalWeight += weight;
      });

      const masterProductsList = Object.values(grouped);
      setMasterProducts(masterProductsList);

      // Calculate BOM for all products
      if (details.length > 0) {
        await calculateBOM(details);
      }
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      showToast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const calculateBOM = async (details: any[]) => {
    try {
      setLoadingMaterials(true);
      const products = details.map((item: any) => ({
        productId: item.product?.id || item.orderDetail?.productId,
        quantity: item.orderDetail?.quantity || 0,
      }));

      const bomResults = await productionManagerApi.calculateBOM(products);
      setMaterials(bomResults);
    } catch (error) {
      console.error('Failed to calculate BOM:', error);
      showToast.error('Failed to calculate materials');
    } finally {
      setLoadingMaterials(false);
    }
  };

  const handleSchedule = async () => {
    try {
      setLoading(true);

      await productionManagerApi.updateOrderDetails(orderId, {
        expectedDeliveryDate,
        pmRemarks,
      });

      await productionManagerApi.autoScheduleOrder({
        orderId,
        expectedDeliveryDate,
      });

      showToast.success('Batch scheduled successfully!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to schedule batch:', error);
      showToast.error(error.response?.data?.message || 'Failed to schedule batch');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const allMaterialsAvailable = materials.every(m => m.availableQuantity >= m.requiredQuantity);

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--surface)] rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-[var(--border)]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)] bg-[var(--surface-secondary)]">
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Package className="w-5 h-5 text-[var(--primary)]" />
              Schedule Batch - Order #{orderNumber}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Review master products and materials before scheduling
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--surface-highlight)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Delivery Info */}
              <div className="bg-[var(--surface-secondary)] rounded-lg p-4 border border-[var(--border)]">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-[var(--primary)]" />
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    Delivery Information
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[var(--text-secondary)]">Expected Delivery:</span>
                    <span className="ml-2 font-medium text-[var(--text-primary)]">
                      {new Date(expectedDeliveryDate).toLocaleDateString()}
                    </span>
                  </div>
                  {pmRemarks && (
                    <div>
                      <span className="text-[var(--text-secondary)]">Remarks:</span>
                      <span className="ml-2 font-medium text-[var(--text-primary)]">
                        {pmRemarks}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Master Products Summary */}
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <Weight className="w-5 h-5 text-[var(--primary)]" />
                  Master Products Summary
                </h3>
                <div className="space-y-3">
                  {masterProducts.map(mp => (
                    <div
                      key={mp.masterProductId}
                      className="bg-[var(--surface-secondary)] rounded-lg p-4 border border-[var(--border)]"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-[var(--primary)] uppercase text-sm">
                          {mp.masterProductName}
                        </h4>
                        <div className="text-right">
                          <div className="text-xs text-[var(--text-secondary)]">Total Weight</div>
                          <div className="text-lg font-bold text-[var(--primary)]">
                            {formatQty(mp.totalWeight)} kg
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {mp.products.map((product, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm bg-[var(--surface)]/50 rounded px-3 py-2"
                          >
                            <span className="text-[var(--text-primary)]">
                              {product.productName}
                            </span>
                            <div className="flex items-center gap-4 text-[var(--text-secondary)]">
                              <span>Qty: {product.quantity}</span>
                              <span className="font-medium text-[var(--text-primary)]">
                                {formatQty(product.weight)} kg
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Raw Materials */}
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <Package className="w-5 h-5 text-[var(--primary)]" />
                  Raw Materials Required
                </h3>
                {loadingMaterials ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {materials.map((material, idx) => {
                      const isAvailable = material.availableQuantity >= material.requiredQuantity;
                      const shortage = material.requiredQuantity - material.availableQuantity;

                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isAvailable
                              ? 'bg-[var(--success)]/5 border-[var(--success)]/30'
                              : 'bg-[var(--danger)]/5 border-[var(--danger)]/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {isAvailable ? (
                              <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-[var(--danger)]" />
                            )}
                            <span className="font-medium text-[var(--text-primary)]">
                              {material.materialName}
                            </span>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div>
                              <span className="text-[var(--text-secondary)]">Required: </span>
                              <span className="font-medium text-[var(--text-primary)]">
                                {formatQty(material.requiredQuantity)} kg
                              </span>
                            </div>
                            <div>
                              <span className="text-[var(--text-secondary)]">Available: </span>
                              <span
                                className={`font-medium ${
                                  isAvailable ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                                }`}
                              >
                                {formatQty(material.availableQuantity)} kg
                              </span>
                            </div>
                            {!isAvailable && (
                              <div className="text-[var(--danger)] font-medium">
                                Shortage: {formatQty(shortage)} kg
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Warning if materials not available */}
              {!allMaterialsAvailable && materials.length > 0 && (
                <div className="bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-[var(--warning)] mb-1">
                      Material Shortage Detected
                    </h4>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Some raw materials are not available in sufficient quantities. The batch will
                      be scheduled, but production cannot start until materials are restocked.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--border)] bg-[var(--surface-secondary)]">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSchedule}
            disabled={loading || masterProducts.length === 0}
            leftIcon={loading ? undefined : <Package className="w-4 h-4" />}
          >
            {loading ? 'Scheduling...' : 'Schedule Batch'}
          </Button>
        </div>
      </div>
    </div>
  );
}
