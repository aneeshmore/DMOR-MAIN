import React, { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/common';
import { authApi } from '@/features/authority/api/authApi';
import { Role, Permission, RolePermission } from '@/types';
import { showToast } from '@/utils/toast';
import {
  Shield,
  Check,
  ChevronDown,
  ChevronRight,
  Save,
  RotateCcw,
  Settings,
  Users,
  UserCog,
  Copy,
  Search,
  Loader2,
} from 'lucide-react';
import { Modal, Input, Button } from '@/components/ui';
import { routeRegistry, flattenRoutes, ApiDependency } from '@/config/routeRegistry';
import { Link } from 'react-router-dom';

// Build a map of module -> APIs from route registry (only visible routes)
const buildApiMap = () => {
  const map: Record<string, { label: string; path: string; apis: ApiDependency[] }> = {};
  const allRoutes = flattenRoutes(routeRegistry);

  allRoutes.forEach(route => {
    if (route.permission?.module) {
      // Skip hidden routes (showInSidebar: false)
      if (route.showInSidebar === false) return;

      // Don't overwrite if already exists (first visible occurrence wins)
      if (map[route.permission.module]) return;

      map[route.permission.module] = {
        label: route.label,
        path: route.path,
        apis: route.apis || [],
      };
    }
  });

  return map;
};

const apiMap = buildApiMap();

// Get API route key for permission storage
const getApiKey = (api: ApiDependency) => `${api.method}:${api.route}`;

// Database-driven categorization using pageGroup field
const categorizePermissions = (permissions: Permission[]) => {
  const categories: Record<string, Permission[]> = {};

  permissions.forEach(p => {
    const category = p.pageGroup || 'Other';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(p);
  });

  const categoryOrder = [
    'Main',
    'Sales',
    'Inventory',
    'Operations',
    'Quality',
    'Masters',
    'Reports',
    'Settings',
    'Other',
  ];

  const sorted: Record<string, Permission[]> = {};
  categoryOrder.forEach(cat => {
    if (categories[cat] && categories[cat].length > 0) {
      sorted[cat] = categories[cat];
    }
  });

  Object.keys(categories).forEach(cat => {
    if (!sorted[cat] && categories[cat].length > 0) {
      sorted[cat] = categories[cat];
    }
  });

  return sorted;
};

const PermissionManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [matrix, setMatrix] = useState<RolePermission[]>([]);
  const [originalMatrix, setOriginalMatrix] = useState<RolePermission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [expandedPermissions, setExpandedPermissions] = useState<Record<number, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [duplicating, setDuplicating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchMetadata = async () => {
    try {
      setLoading(true);
      const [rolesRes, permsRes, matrixRes] = await Promise.all([
        authApi.getRoles(),
        authApi.getPermissions(),
        authApi.getRolePermissions(),
      ]);

      if (rolesRes.success) {
        setRoles(rolesRes.data);
        const superAdmin = rolesRes.data.find((r: Role) => r.roleName === 'SuperAdmin');
        if (superAdmin) setSelectedRoleId(superAdmin.roleId);
        else if (rolesRes.data.length > 0) setSelectedRoleId(rolesRes.data[0].roleId);
      }
      if (permsRes.success) setPermissions(permsRes.data);
      if (matrixRes.success) {
        setMatrix(matrixRes.data);
        setOriginalMatrix(matrixRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch permission metadata:', error);
      showToast.error('Failed to load permission data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  const categorizedPermissions = useMemo(() => categorizePermissions(permissions), [permissions]);

  // Filter permissions by search query
  const filteredCategorizedPermissions = useMemo(() => {
    if (!searchQuery.trim()) return categorizedPermissions;

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, Permission[]> = {};

    Object.entries(categorizedPermissions).forEach(([category, perms]) => {
      const matchingPerms = perms.filter(p => {
        const label = (p.pageLabel || p.permissionName || '').toLowerCase();
        const name = (p.permissionName || '').toLowerCase();
        const routeInfo = apiMap[p.permissionName];
        const path = routeInfo?.path?.toLowerCase() || '';
        return label.includes(query) || name.includes(query) || path.includes(query);
      });
      if (matchingPerms.length > 0) {
        filtered[category] = matchingPerms;
      }
    });

    return filtered;
  }, [categorizedPermissions, searchQuery]);

  const selectedRole = useMemo(
    () => roles.find(r => r.roleId === selectedRoleId),
    [roles, selectedRoleId]
  );

  // Get granted actions (now contains API routes like 'GET:/orders')
  const getGrantedActions = (permissionId: number) => {
    if (!selectedRoleId) return [];
    const found = matrix.find(m => m.roleId === selectedRoleId && m.permissionId === permissionId);
    return found ? found.grantedActions : [];
  };

  // Check if permission has page access (has any granted action or VIEW_PAGE marker)
  const hasPageAccess = (permissionId: number) => {
    const actions = getGrantedActions(permissionId);
    return actions.length > 0;
  };

  // Check if specific API is granted
  const hasApiAccess = (permissionId: number, apiKey: string) => {
    const actions = getGrantedActions(permissionId);
    return actions.includes(apiKey);
  };

  // Toggle page access - grants/revokes all APIs
  const handleTogglePageAccess = (permission: Permission) => {
    if (!selectedRoleId) return;
    const permissionId = permission.permissionId;
    const currentlyHasAccess = hasPageAccess(permissionId);

    // Get APIs from route registry
    const routeInfo = apiMap[permission.permissionName];
    const allApiKeys = routeInfo?.apis.map(getApiKey) || [];

    // If currently has access, revoke all. Otherwise, grant all.
    const newActions = currentlyHasAccess ? [] : allApiKeys;

    setMatrix(prev => {
      const existingIndex = prev.findIndex(
        m => m.roleId === selectedRoleId && m.permissionId === permissionId
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], grantedActions: newActions };
        return updated;
      }
      return [...prev, { roleId: selectedRoleId, permissionId, grantedActions: newActions }];
    });
  };

  // Toggle individual API access
  const handleToggleApi = (permissionId: number, apiKey: string) => {
    if (!selectedRoleId) return;
    const currentActions = getGrantedActions(permissionId);
    const isGranting = !currentActions.includes(apiKey);

    const newActions = isGranting
      ? [...currentActions, apiKey]
      : currentActions.filter(a => a !== apiKey);

    setMatrix(prev => {
      const existingIndex = prev.findIndex(
        m => m.roleId === selectedRoleId && m.permissionId === permissionId
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], grantedActions: newActions };
        return updated;
      }
      return [...prev, { roleId: selectedRoleId, permissionId, grantedActions: newActions }];
    });
  };

  // Toggle accordion expansion
  const toggleExpanded = (permissionId: number) => {
    setExpandedPermissions(prev => ({ ...prev, [permissionId]: !prev[permissionId] }));
  };

  const hasChanges = useMemo(() => {
    if (!selectedRoleId) return false;
    const currentPerms = matrix.filter(m => m.roleId === selectedRoleId);
    const originalPerms = originalMatrix.filter(m => m.roleId === selectedRoleId);
    return JSON.stringify(currentPerms) !== JSON.stringify(originalPerms);
  }, [matrix, originalMatrix, selectedRoleId]);

  const handleSaveChanges = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    try {
      const rolePerms = matrix.filter(m => m.roleId === selectedRoleId);
      for (const rp of rolePerms) {
        await authApi.updateRolePermission(rp.roleId, rp.permissionId, rp.grantedActions);
      }
      setOriginalMatrix([...matrix]);
      showToast.success('Permissions saved successfully');
    } catch (error) {
      console.error('Failed to save permissions:', error);
      showToast.error('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleResetChanges = () => setMatrix([...originalMatrix]);

  const handleDuplicateRole = async () => {
    if (!selectedRoleId || !newRoleName.trim()) return;
    setDuplicating(true);
    try {
      const result = await authApi.duplicateRole(selectedRoleId, newRoleName.trim());
      if (result.success) {
        showToast.success(result.message || 'Role duplicated successfully');
        setShowDuplicateModal(false);
        setNewRoleName('');
        await fetchMetadata();
        if (result.data?.roleId) {
          setSelectedRoleId(result.data.roleId);
        }
      }
    } catch (error) {
      console.error('Failed to duplicate role:', error);
      showToast.error('Failed to duplicate role');
    } finally {
      setDuplicating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin h-8 w-8 text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="shrink-0 mb-4">
        <PageHeader
          title="Permission Management"
          description="Configure page and API access for each role"
        />

        {/* Quick Links */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Link
            to="/settings/roles"
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--background)]"
          >
            <Users size={14} /> Roles
          </Link>
          <Link
            to="/masters/departments"
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--background)]"
          >
            <Settings size={14} /> Departments
          </Link>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 pb-20">
        {/* Left Panel: Role Selector */}
        <div className="lg:w-72 shrink-0">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm lg:sticky lg:top-4">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              <UserCog size={16} className="inline mr-2" />
              Select Role
            </label>
            <div className="relative mb-4">
              <select
                value={selectedRoleId || ''}
                onChange={e => setSelectedRoleId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-sm"
              >
                <option value="">-- Select --</option>
                {roles.map(role => (
                  <option key={role.roleId} value={role.roleId}>
                    {role.roleName} {!role.isActive && '(Inactive)'}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none"
              />
            </div>

            {selectedRole && (
              <div className="bg-[var(--background)] rounded-lg p-3 border border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
                    <Shield size={16} className="text-[var(--primary)]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-[var(--text-primary)] truncate">
                      {selectedRole.roleName}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] truncate">
                      {selectedRole.description || 'No description'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setNewRoleName(`${selectedRole.roleName} (Copy)`);
                    setShowDuplicateModal(true);
                  }}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--background)] transition-colors"
                >
                  <Copy size={14} />
                  Duplicate Role
                </button>
              </div>
            )}

            {/* Info Box */}
            <div className="mt-4 p-2 bg-blue-500/10 rounded-lg text-xs text-blue-600 dark:text-blue-400">
              <strong>New Design:</strong> Grant page access via toggle, then enable/disable
              specific APIs.
            </div>
          </div>
        </div>

        {/* Right Panel: Permission Cards (Accordion) */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Search Bar */}
          <div className="mb-4 sticky top-0 z-10 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
              />
              <input
                type="text"
                placeholder="Search permissions, pages, or paths..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {selectedRoleId ? (
            <div className="space-y-3">
              {Object.keys(filteredCategorizedPermissions).length === 0 ? (
                <div className="text-center py-8 text-[var(--text-secondary)]">
                  No permissions matching &quot;{searchQuery}&quot;
                </div>
              ) : (
                Object.entries(filteredCategorizedPermissions).map(([category, perms]) => {
                  const isCategoryExpanded = expandedCategories[category] !== false; // Default to expanded
                  return (
                    <div key={category} className="space-y-2">
                      {/* Category Accordion Header */}
                      <button
                        onClick={() =>
                          setExpandedCategories(prev => ({
                            ...prev,
                            [category]: !isCategoryExpanded,
                          }))
                        }
                        className="flex items-center justify-between w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--background)] transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {isCategoryExpanded ? (
                            <ChevronDown size={16} />
                          ) : (
                            <ChevronRight size={16} />
                          )}
                          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                            {category}
                          </h3>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                            {perms.length}
                          </span>
                        </div>
                      </button>

                      {/* Category Content */}
                      {isCategoryExpanded && (
                        <div className="space-y-2 pl-2">
                          {/* Permission Accordion Cards */}
                          {perms.map(permission => {
                            const isExpanded =
                              expandedPermissions[permission.permissionId] || false;
                            const routeInfo = apiMap[permission.permissionName];
                            const apis = routeInfo?.apis || [];
                            const pageEnabled = hasPageAccess(permission.permissionId);
                            const grantedApiCount = apis.filter(api =>
                              hasApiAccess(permission.permissionId, getApiKey(api))
                            ).length;

                            return (
                              <div
                                key={permission.permissionId}
                                className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm"
                              >
                                {/* Accordion Header */}
                                <div className="flex items-center justify-between px-4 py-3 bg-[var(--background)] border-b border-[var(--border)]">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    {/* Expand/Collapse Button */}
                                    {apis.length > 0 && (
                                      <button
                                        onClick={() => toggleExpanded(permission.permissionId)}
                                        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                      >
                                        {isExpanded ? (
                                          <ChevronDown size={18} />
                                        ) : (
                                          <ChevronRight size={18} />
                                        )}
                                      </button>
                                    )}

                                    {/* Permission Info */}
                                    <div className="min-w-0 flex-1">
                                      <h4 className="font-medium text-sm text-[var(--text-primary)] truncate">
                                        {permission.pageLabel || permission.permissionName}
                                      </h4>
                                      {routeInfo?.path && (
                                        <p className="text-[10px] text-[var(--text-secondary)] truncate">
                                          {routeInfo.path}
                                        </p>
                                      )}
                                    </div>

                                    {/* API Count Badge */}
                                    {apis.length > 0 && (
                                      <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                                        {grantedApiCount}/{apis.length} APIs
                                      </span>
                                    )}
                                  </div>

                                  {/* Page Access Toggle */}
                                  <button
                                    onClick={() => handleTogglePageAccess(permission)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                      pageEnabled
                                        ? 'bg-green-500 text-white border-green-500'
                                        : 'bg-transparent text-[var(--text-secondary)] border-[var(--border)] hover:border-green-500 hover:text-green-600'
                                    }`}
                                  >
                                    {pageEnabled && <Check size={12} />}
                                    {pageEnabled ? 'Enabled' : 'Enable'}
                                  </button>
                                </div>

                                {/* Accordion Body - API Checkboxes */}
                                {isExpanded && apis.length > 0 && (
                                  <div className="px-4 py-3 divide-y divide-[var(--border)]">
                                    {apis.map(api => {
                                      const apiKey = getApiKey(api);
                                      const isGranted = hasApiAccess(
                                        permission.permissionId,
                                        apiKey
                                      );

                                      return (
                                        <div
                                          key={apiKey}
                                          className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
                                        >
                                          <div className="flex items-center gap-2">
                                            <span
                                              className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                                                api.method === 'GET'
                                                  ? 'bg-blue-100 text-blue-700'
                                                  : api.method === 'POST'
                                                    ? 'bg-green-100 text-green-700'
                                                    : api.method === 'PUT' || api.method === 'PATCH'
                                                      ? 'bg-amber-100 text-amber-700'
                                                      : 'bg-red-100 text-red-700'
                                              }`}
                                            >
                                              {api.method}
                                            </span>
                                            <span className="text-sm text-[var(--text-primary)]">
                                              {api.label}
                                            </span>
                                            <span className="text-[10px] text-[var(--text-secondary)] font-mono">
                                              {api.route}
                                            </span>
                                          </div>

                                          {/* API Checkbox */}
                                          <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={isGranted}
                                              onChange={() =>
                                                handleToggleApi(permission.permissionId, apiKey)
                                              }
                                              className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--primary)]/50 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
                                          </label>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* No APIs Message */}
                                {isExpanded && apis.length === 0 && (
                                  <div className="px-4 py-3 text-sm text-[var(--text-secondary)] italic">
                                    No API dependencies configured
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-8 text-center h-full flex flex-col items-center justify-center">
              <Shield size={32} className="text-[var(--text-secondary)] mb-3" />
              <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
                Select a Role
              </h3>
              <p className="text-sm text-slate-500">
                Define which routes and actions this role can access. Toggle &quot;Enable&quot; on a
                category to grant full access, or expand to fine-tune individual API permissions.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Save Bar */}
      {hasChanges && (
        <div className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6 flex gap-2 bg-[var(--surface)] p-3 rounded-xl shadow-lg border border-[var(--border)] z-50 animate-fade-in">
          <button
            onClick={handleResetChanges}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--background)] text-sm"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={handleSaveChanges}
            disabled={saving}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-50 text-sm"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>
      )}

      {/* Duplicate Role Modal */}
      <Modal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        title="Duplicate Role"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Create a new role with all permissions from <strong>{selectedRole?.roleName}</strong>
          </p>
          <Input
            label="New Role Name"
            value={newRoleName}
            onChange={e => setNewRoleName(e.target.value)}
            placeholder="Enter new role name"
            autoFocus
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowDuplicateModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDuplicateRole}
              disabled={duplicating || !newRoleName.trim()}
            >
              {duplicating ? (
                <Loader2 size={14} className="animate-spin mr-2" />
              ) : (
                <Copy size={14} className="mr-2" />
              )}
              Create Copy
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PermissionManagement;
