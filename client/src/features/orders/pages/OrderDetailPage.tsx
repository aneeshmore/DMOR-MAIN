import React from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, User, Calendar, DollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { adminAccountsApi } from '@/features/admin-accounts/api/adminAccountsApi';
import { cn } from '@/utils/cn';
import { bomApi, BOMRequirement } from '@/features/production-manager/api/bomApi';
import { BackButton } from '@/components/ui';
import { useNotifications } from '@/features/notifications/hooks';

// Material Requirements Component
interface MaterialRequirementsProps {
  productId: number;
  quantity: number;
}

const MaterialRequirements: React.FC<MaterialRequirementsProps> = ({ productId, quantity }) => {
  const {
    data: requirements,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['bom-requirements', productId, quantity],
    queryFn: () => bomApi.calculateRequirements(productId, quantity),
    enabled: !!productId && !!quantity,
  });

  if (isLoading) {
    return (
      <div className="mt-4 p-3 bg-[var(--surface-highlight)] border border-[var(--border)] rounded">
        <p className="text-sm text-[var(--text-secondary)]">Loading material requirements...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded">
        <p className="text-sm text-red-700 dark:text-red-400">
          Failed to load material requirements
        </p>
      </div>
    );
  }

  if (!requirements || requirements.length === 0) {
    return (
      <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
        <p className="text-sm text-yellow-700 dark:text-yellow-400">
          No BOM configured for this product
        </p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Critical':
        return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30';
      case 'Low Stock':
        return 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30';
      case 'Sufficient':
        return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30';
      default:
        return 'bg-[var(--surface-highlight)] text-[var(--text-secondary)] border-[var(--border)]';
    }
  };

  return (
    <div className="mt-4 space-y-2">
      <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
        Material Requirements
      </h4>
      {requirements.map((req: BOMRequirement, idx: number) => (
        <div
          key={idx}
          className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded flex items-center justify-between"
        >
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--text-primary)]">{req.RawMaterialName}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Required: {req.RequiredQty.toFixed(2)} {req.Unit} | Available:{' '}
              {req.AvailableQty.toFixed(2)} {req.Unit}
            </p>
          </div>
          <Badge className={cn('ml-3', getStatusColor(req.Status))}>{req.Status}</Badge>
        </div>
      ))}
    </div>
  );
};

const OrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const orderIdNum = parseInt(orderId || '0');

  // Fetch all notifications to filter for this order
  const { data: notifications } = useNotifications();

  const orderNotifications =
    notifications?.filter(
      n => !n.isRead && (n.data?.orderId === orderIdNum || n.data?.orderId === String(orderIdNum))
    ) || [];

  const {
    data: orderData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['order-details', orderIdNum],
    queryFn: () => adminAccountsApi.getOrderDetails(orderIdNum),
    enabled: !!orderIdNum,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (error || !orderData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Order Not Found</h2>
        <p className="text-[var(--text-secondary)] mb-4">
          The order you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to
          view it.
        </p>
        <BackButton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification Banner */}
      {orderNotifications.length > 0 && (
        <div className="space-y-2">
          {orderNotifications.map(notification => (
            <div
              key={notification.notificationId}
              className={`p-4 rounded-lg flex items-start gap-3 border ${
                notification.priority === 'critical'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-orange-50 border-orange-200 text-orange-800'
              }`}
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold">{notification.title}</h4>
                <p className="text-sm mt-1 opacity-90">{notification.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Order #{orderData?.orderId}
          </h1>
          <p className="text-[var(--text-secondary)]">Order details and material requirements</p>
        </div>
      </div>

      {/* Order Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Order Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-[var(--text-secondary)]" />
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Customer</p>
                <p className="font-medium text-[var(--text-primary)]">
                  {orderData?.customerName || 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-[var(--text-secondary)]" />
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Order Date</p>
                <p className="font-medium text-[var(--text-primary)]">
                  {orderData?.orderCreatedDate || orderData?.orderDate
                    ? new Date(
                        orderData.orderCreatedDate || orderData.orderDate
                      ).toLocaleDateString()
                    : 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DollarSign className="w-4 h-4 text-[var(--text-secondary)]" />
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Total Amount</p>
                <p className="font-medium text-[var(--text-primary)]">
                  ₹{orderData?.totalAmount?.toLocaleString() || 'N/A'}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)]">Status</p>
              <Badge
                variant={
                  orderData?.status === 'Factory Approved' || orderData?.status === 'Accepted'
                    ? 'default'
                    : 'secondary'
                }
                className={cn(
                  (orderData?.status === 'Factory Approved' ||
                    orderData?.status === 'Accepted') &&
                    'bg-green-100 text-green-800',
                  orderData?.status === 'On Hold' && 'bg-yellow-100 text-yellow-800'
                )}
              >
                {orderData?.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products */}
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {orderData?.items?.map((item: any, index: number) => (
              <div key={index} className="border border-[var(--border)] rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)]">{item.productName}</h3>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Size: {item.size} | Quantity: {item.quantity} {item.unit}
                    </p>
                  </div>
                  <Badge variant="outline">
                    ₹{item.unitPrice?.toLocaleString()} per {item.unit}
                  </Badge>
                </div>

                {/* Material Requirements */}
                <MaterialRequirements productId={item.productId} quantity={item.quantity} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderDetailPage;
