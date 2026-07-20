import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/common';
import { Button } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { NotificationRule, rulesApi } from '../api/rulesApi';
import { authApi, Role } from '@/features/authority/api/authApi';
import { departmentApi } from '@/features/masters/api';
import { Department } from '@/features/masters/types';
import { Trash2, Plus, RefreshCw, Bell, ShoppingCart, Settings, AlertTriangle, Truck } from 'lucide-react';
import { showToast } from '@/utils/toast';

const NOTIFICATION_TYPE_CONFIG = [
  {
    type: 'NewOrder',
    label: 'New Order',
    icon: ShoppingCart,
    iconColor: 'text-blue-500',
    description: 'Triggered when a salesperson places a new customer order and it enters the approval queue.',
    suggestedRoles: 'SuperAdmin, Admin, Accounts Manager',
  },
  {
    type: 'OrderUpdate',
    label: 'Order Update',
    icon: Settings,
    iconColor: 'text-purple-500',
    description: 'Sent on every order status change: Accounts approval → Factory approval → Production → Ready for Dispatch.',
    suggestedRoles: 'SuperAdmin, Admin, Production Manager, Sales Person',
  },
  {
    type: 'MaterialShortage',
    label: 'Material Shortage',
    icon: AlertTriangle,
    iconColor: 'text-yellow-500',
    description: 'Raised when raw material stock falls below the minimum required to fulfil active orders.',
    suggestedRoles: 'SuperAdmin, Admin, Accounts Manager, Production Manager',
  },
  {
    type: 'Dispatch',
    label: 'Dispatch',
    icon: Truck,
    iconColor: 'text-green-500',
    description: 'Sent when an order is dispatched / delivered. Salesperson receives updates for their own orders.',
    suggestedRoles: 'SuperAdmin, Admin, Sales Person',
  },
];

const NOTIFICATION_TYPES = NOTIFICATION_TYPE_CONFIG.map(c => c.type);

const NotificationSettings = () => {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<string>(NOTIFICATION_TYPES[0]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [targetType, setTargetType] = useState<'ROLE' | 'DEPARTMENT'>('ROLE');
  const [targetId, setTargetId] = useState<number | ''>('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await rulesApi.getAllRules();
      setRules(data);
    } catch {
      showToast.error('Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const [rData, dData] = await Promise.all([authApi.getRoles(), departmentApi.getAll()]);

      // Handle nested { data: [...] } or { success: true, data: [...] } structures
      const rolesArray = (rData?.data || rData || []) as Role[];
      const deptsArray = (dData?.data || dData || []) as Department[];

      console.log('[NotificationSettings] Roles loaded:', rolesArray.length);
      console.log('[NotificationSettings] Departments loaded:', deptsArray.length);

      setRoles(rolesArray);
      setDepartments(deptsArray);
    } catch (e) {
      console.error('[NotificationSettings] Failed to load options:', e);
    }
  };

  useEffect(() => {
    fetchData();
    fetchOptions();
  }, []);

  const handleAddRule = async () => {
    if (!targetId) return;

    try {
      await rulesApi.createRule({
        notificationType: activeType,
        targetType,
        targetId: Number(targetId),
      });
      showToast.success('Rule added');
      setIsModalOpen(false);
      fetchData();
    } catch (e) {
      showToast.error('Failed to add rule');
    }
  };

  const handleDeleteRule = async (id: number) => {
    try {
      await rulesApi.deleteRule(id);
      showToast.success('Rule deleted');
      setRules(prev => prev.filter(r => r.ruleId !== id));
    } catch (e) {
      showToast.error('Failed to delete rule');
    }
  };

  const handleSeed = async () => {
    try {
      const res = await rulesApi.seedRules();
      showToast.success(`Seeded ${res.seeded} rules`);
      fetchData();
    } catch (e) {
      showToast.error('Failed to seed rules');
    }
  };

  const filteredRules = rules.filter(r => r.notificationType === activeType);

  const getTargetName = (rule: NotificationRule) => {
    if (rule.targetType === 'ROLE') {
      // Handle both camelCase (roleId) and PascalCase (RoleID) from API
      const found = roles.find(r => {
        const rId = (r as any).roleId || (r as any).RoleID;
        return rId === rule.targetId;
      });
      const name = found ? (found as any).roleName || (found as any).RoleName : null;
      return name || `Role #${rule.targetId}`;
    }
    if (rule.targetType === 'DEPARTMENT') {
      const found = departments.find(d => {
        const dId = (d as any).departmentId || (d as any).DepartmentID;
        return dId === rule.targetId;
      });
      const name = found ? (found as any).departmentName || (found as any).DepartmentName : null;
      return name || `Dept #${rule.targetId}`;
    }
    return `User #${rule.targetId}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="Notification Settings"
          description="Configure who receives system notifications."
        />
        <Button variant="secondary" onClick={handleSeed} size="sm">
          <RefreshCw className="mr-2 h-4 w-4" /> Reseed Defaults
        </Button>
      </div>

      <div className="bg-[var(--surface)] rounded-lg shadow border border-[var(--border)] p-6">
        {/* Tabs */}
        <div className="flex border-b border-[var(--border)] overflow-x-auto no-scrollbar mb-6">
          {NOTIFICATION_TYPE_CONFIG.map(({ type, label, icon: Icon, iconColor }) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 whitespace-nowrap transition-colors ${
                activeType === type
                  ? 'border-blue-600 text-blue-600 font-medium'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon size={15} className={activeType === type ? 'text-blue-500' : iconColor} />
              {label}
            </button>
          ))}
        </div>

        {/* Type Description */}
        {(() => {
          const cfg = NOTIFICATION_TYPE_CONFIG.find(c => c.type === activeType);
          return cfg ? (
            <div className="mb-6 p-3 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)] flex items-start gap-3 text-sm">
              <cfg.icon size={16} className={`mt-0.5 shrink-0 ${cfg.iconColor}`} />
              <div>
                <p className="text-[var(--text-primary)]">{cfg.description}</p>
                <p className="text-[var(--text-secondary)] text-xs mt-1">
                  <span className="font-medium">Suggested roles:</span> {cfg.suggestedRoles}
                </p>
              </div>
            </div>
          ) : null;
        })()}

        {/* Content */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
              <Bell className="h-5 w-5 text-[var(--text-secondary)]" />
              Subscribers
            </h3>
            <Button onClick={() => setIsModalOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" /> Add Subscriber
            </Button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-gray-500">Loading...</div>
          ) : filteredRules.length === 0 ? (
            <div className="py-8 text-center bg-[var(--surface-elevated)] rounded-lg border border-dashed border-[var(--border)]">
              <p className="text-[var(--text-secondary)]">
                No subscribers configured for this notification type.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRules.map(rule => (
                <div
                  key={rule.ruleId}
                  className="flex justify-between items-center p-3 bg-[var(--surface-elevated)] rounded border border-[var(--border)] group hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                >
                  <div>
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded mr-2 ${rule.targetType === 'ROLE'
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        }`}
                    >
                      {rule.targetType}
                    </span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {getTargetName(rule)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteRule(rule.ruleId)}
                    className="text-[var(--text-secondary)] hover:text-red-600 transition-colors p-1"
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Add Subscriber for ${activeType}`}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="targetType"
                  checked={targetType === 'ROLE'}
                  onChange={() => setTargetType('ROLE')}
                />
                <span>Role</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="targetType"
                  checked={targetType === 'DEPARTMENT'}
                  onChange={() => setTargetType('DEPARTMENT')}
                />
                <span>Department</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select {targetType === 'ROLE' ? 'Role' : 'Department'}
            </label>
            <select
              className="w-full border border-[var(--border)] rounded-md p-2 bg-[var(--surface)] text-[var(--text-primary)]"
              value={targetId}
              onChange={e => setTargetId(Number(e.target.value))}
            >
              <option value="">-- Select --</option>
              {targetType === 'ROLE'
                ? roles.map(r => {
                  const id = (r as any).roleId || (r as any).RoleID;
                  const name = (r as any).roleName || (r as any).RoleName;
                  return (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  );
                })
                : departments.map(d => {
                  const id = (d as any).departmentId || (d as any).DepartmentID;
                  const name = (d as any).departmentName || (d as any).DepartmentName;
                  return (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  );
                })}
            </select>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRule} disabled={!targetId}>
              Add Subscriber
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default NotificationSettings;
