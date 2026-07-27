import { useState, useEffect, useRef } from 'react';
import { Edit2, Trash2, Loader2, Plus, Users, Check } from 'lucide-react';
import logger from '@/utils/logger';
import { showToast } from '@/utils/toast';
import { Department } from '../types';
import { departmentApi } from '../api';
import { authApi, Role, Permission } from '@/features/authority/api/authApi';
import { PageHeader } from '@/components/common';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Input, Button, Modal } from '@/components/ui';
import { ColumnDef } from '@tanstack/react-table';
import { getModuleTitleByPath } from '@/config/moduleDisplayMetadata';
import { routeRegistry, RouteNode } from '@/config/routeRegistry';

// Top-level route-registry section ids used to group the Page After Login
// selector. This mirrors the registry's own sequence (Dashboard, Masters,
// Operations, Reports, Settings) — nothing here reorders the registry itself.
const LANDING_PAGE_SECTION_IDS = new Set(['masters', 'operations', 'reports', 'settings']);

interface RouteOrderInfo {
  order: number;
  group: string;
}

// Flattens the existing route registry, depth-first, into a path -> {order, group}
// map exactly once. This is the single source of truth for landing-page option
// SEQUENCE (registry order), while moduleDisplayMetadata.ts remains the single
// source of truth for the visible TITLE only.
const buildRouteOrderMap = (
  nodes: RouteNode[],
  map: Map<string, RouteOrderInfo> = new Map(),
  counter: { n: number } = { n: 0 },
  currentGroup: string = 'Dashboard'
): Map<string, RouteOrderInfo> => {
  nodes.forEach(node => {
    const group = LANDING_PAGE_SECTION_IDS.has(node.id) ? node.label : currentGroup;
    if (node.path && !map.has(node.path)) {
      map.set(node.path, { order: counter.n++, group });
    }
    if (node.children && node.children.length) {
      buildRouteOrderMap(node.children, map, counter, group);
    }
  });
  return map;
};

const ROUTE_ORDER_MAP = buildRouteOrderMap(routeRegistry);

// Shared validation function
const validateDepartmentName = (name: string) => {
  if (!name) return ''; // Let browser handle empty check
  if (/\d/.test(name)) return 'Department name cannot contain numbers';
  if (/[^a-zA-Z\s]/.test(name)) return 'Department name cannot contain special characters';
  if (name.trim().length < 2 || name.trim().length > 50)
    return 'Department name must be between 2 and 50 characters';
  return '';
};

const validateRoleName = (name: string) => {
  if (!name) return '';
  if (name.trim().length < 2 || name.trim().length > 100)
    return 'Role name must be between 2 and 100 characters';
  return '';
};

// Role Form Component
const RoleForm = ({
  role,
  departmentId,
  onSave,
  onCancel,
  permissions,
  isSaving,
}: {
  role: Role | null;
  departmentId: number;
  onSave: (role: Partial<Role>) => void;
  onCancel: () => void;
  permissions: Permission[];
  isSaving: boolean;
}) => {
  const [formData, setFormData] = useState({
    roleName: role?.roleName || '',
    description: role?.description || '',
    landingPage: role?.landingPage || '/dashboard',
  });
  const [error, setError] = useState('');

  // Sync form data when role prop changes (e.g., when editing a different role)
  useEffect(() => {
    setFormData({
      roleName: role?.roleName || '',
      description: role?.description || '',
      landingPage: role?.landingPage || '/dashboard',
    });
  }, [role]);

  type LandingPageOption = {
    id: string | number;
    value: string;
    label: string;
    group: string;
    searchableText: string;
  };

  // Permission.pagePath is `string | undefined`. This type guard narrows it to
  // `string` (and excludes blank/whitespace-only paths) BEFORE any sorting or
  // mapping, so nothing downstream ever needs `!` or a fake `''` fallback —
  // permissions without a valid route simply never become an option.
  const hasValidPagePath = (
    permission: Permission
  ): permission is Permission & { pagePath: string } =>
    typeof permission.pagePath === 'string' && permission.pagePath.trim().length > 0;

  // Filter only page permissions for landing page options, ordered by their
  // position in the existing route registry (NOT alphabetically, and NOT by
  // the new display title). Entries with no registry match sort after all
  // matched entries but are never dropped — Array.prototype.sort is stable.
  const pageOptions = permissions
    .filter(p => p.isPage)
    .filter(hasValidPagePath)
    .sort((a, b) => {
      const orderA = ROUTE_ORDER_MAP.get(a.pagePath)?.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = ROUTE_ORDER_MAP.get(b.pagePath)?.order ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });

  // Complete option list/order is unchanged from the registry. Only the
  // VISIBLE label is renamed to the approved module title where one exists;
  // the underlying `value` (route path) is untouched, and the old label is
  // kept as part of the searchable text so both old and new names still find it.
  const landingPageSelectOptions: LandingPageOption[] = [
    {
      id: '/dashboard',
      value: '/dashboard',
      label: 'Dashboard (Default)',
      searchableText: 'dashboard (default) dashboard',
      group: 'Dashboard',
    },
    ...pageOptions.map(p => {
      // p.pagePath is `string` here — narrowed by hasValidPagePath above.
      const oldLabel = `${p.pageLabel || p.permissionName} (${p.pagePath})`;
      const displayLabel = getModuleTitleByPath(p.pagePath, p.pageLabel || p.permissionName);
      return {
        id: p.permissionId,
        value: p.pagePath,
        label: displayLabel,
        searchableText: `${displayLabel} ${oldLabel}`.toLowerCase(),
        group: ROUTE_ORDER_MAP.get(p.pagePath)?.group ?? 'Other',
      };
    }),
  ];

  // --- Page After Login combobox state ---
  // Three SEPARATE pieces of state: formData.landingPage = selected route
  // VALUE, landingPageSearch = the user's typed query only (never pre-filled
  // with the selected label), and the selected LABEL is derived (not stored)
  // so it can never leak into the search and filter the list down to one item.
  const [isLandingPageOpen, setIsLandingPageOpen] = useState(false);
  const [landingPageSearch, setLandingPageSearch] = useState('');
  const landingPageWrapperRef = useRef<HTMLDivElement>(null);

  const selectedLandingPageOption = landingPageSelectOptions.find(
    o => o.value === formData.landingPage
  );

  const filteredLandingPageOptions = landingPageSearch.trim()
    ? landingPageSelectOptions.filter(o =>
        o.searchableText.includes(landingPageSearch.trim().toLowerCase())
      )
    : landingPageSelectOptions;

  // Insert a group header row whenever the group changes while walking the
  // (already registry-ordered) filtered list — rendering only, never reorders.
  type LandingPageRow =
    | { kind: 'header'; group: string }
    | { kind: 'option'; option: LandingPageOption };

  const landingPageRows: LandingPageRow[] = [];
  let lastLandingPageGroup: string | null = null;
  filteredLandingPageOptions.forEach(option => {
    if (option.group !== lastLandingPageGroup) {
      landingPageRows.push({ kind: 'header', group: option.group });
      lastLandingPageGroup = option.group;
    }
    landingPageRows.push({ kind: 'option', option });
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        landingPageWrapperRef.current &&
        !landingPageWrapperRef.current.contains(event.target as Node)
      ) {
        setIsLandingPageOpen(false);
        setLandingPageSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectLandingPage = (value: string) => {
    setFormData(prev => ({ ...prev, landingPage: value }));
    setIsLandingPageOpen(false);
    setLandingPageSearch('');
  };

  const handleSubmit = () => {
    const validationError = validateRoleName(formData.roleName);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSave({
      ...formData,
      departmentId,
      roleId: role?.roleId,
    });
  };

  return (
    <div className="space-y-4">
      <Input
        label="Role Name"
        value={formData.roleName}
        onChange={e => {
          setFormData({ ...formData, roleName: e.target.value });
          setError(validateRoleName(e.target.value));
        }}
        placeholder="Enter role name"
        required
        autoFocus
        error={error}
      />
      <Input
        label="Description"
        value={formData.description}
        onChange={e => setFormData({ ...formData, description: e.target.value })}
        placeholder="Enter role description (optional)"
      />

      <div className="space-y-1">
        <label className="text-sm font-medium text-[var(--text-primary)]">Page After Login</label>
        <div className="relative" ref={landingPageWrapperRef}>
          <Input
            type="text"
            value={isLandingPageOpen ? landingPageSearch : selectedLandingPageOption?.label || ''}
            onChange={e => setLandingPageSearch(e.target.value)}
            onFocus={() => {
              // Opening always starts from an empty query, so the full list
              // shows first — the selected label is never used as the filter.
              setLandingPageSearch('');
              setIsLandingPageOpen(true);
            }}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                setIsLandingPageOpen(false);
                setLandingPageSearch('');
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const firstOption = filteredLandingPageOptions[0];
                if (firstOption) {
                  selectLandingPage(firstOption.value);
                }
              }
            }}
            placeholder="Select page after login"
            autoComplete="off"
          />
          {isLandingPageOpen && (
            <div
              className="absolute z-[9999] w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-md shadow-lg overflow-y-auto"
              style={{ maxHeight: '340px' }}
            >
              {landingPageRows.length > 0 ? (
                landingPageRows.map(row =>
                  row.kind === 'header' ? (
                    <div
                      key={`group-${row.group}`}
                      className="px-4 pt-2.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--surface)]"
                    >
                      {row.group}
                    </div>
                  ) : (
                    <div
                      key={row.option.id}
                      onClick={() => selectLandingPage(row.option.value)}
                      className={`px-4 py-2 text-sm cursor-pointer flex items-center justify-between ${
                        formData.landingPage === row.option.value
                          ? 'bg-[var(--surface-hover)] text-[var(--text-primary)]'
                          : 'text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      <span className="font-medium">{row.option.label}</span>
                      {formData.landingPage === row.option.value && <Check size={16} />}
                    </div>
                  )
                )
              ) : (
                <div className="px-4 py-2 text-sm text-[var(--text-secondary)]">
                  No results found
                </div>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          Select the page this role will open after login.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
        <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!!error || isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : role?.roleId ? (
            'Save Changes'
          ) : (
            'Add Role'
          )}
        </Button>
      </div>
    </div>
  );
};

// Expandable Row Component for Roles
const RolesSubRow = ({
  department,
  onAddRole,
  onEditRole,
  onDeleteRole,
}: {
  department: Department;
  onAddRole: (departmentId: number) => void;
  onEditRole: (role: Role) => void;
  onDeleteRole: (roleId: number) => void;
}) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRoles();
  }, [department.DepartmentID]);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const response = await authApi.getRolesByDepartment(department.DepartmentID);
      if (response.success && response.data) {
        setRoles(response.data);
      }
    } catch (error) {
      logger.error('Failed to load roles for department:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--primary)]" />
        <span className="ml-2 text-sm text-[var(--text-secondary)]">Loading roles...</span>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface-secondary)] p-4 border-t border-[var(--border)]">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Users size={16} className="text-[var(--primary)]" />
          Roles in {department.DepartmentName}
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAddRole(department.DepartmentID)}
          className="text-[var(--primary)] hover:bg-[var(--primary)]/10"
        >
          <Plus size={14} className="mr-1" />
          Add Role
        </Button>
      </div>

      {roles.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)] italic py-2">
          No roles assigned to this department yet.
        </p>
      ) : (
        <div className="space-y-2">
          {roles.map(role => (
            <div
              key={role.roleId}
              className="flex items-center justify-between bg-[var(--surface)] p-3 rounded-lg border border-[var(--border)]"
            >
              <div>
                <span className="font-medium text-[var(--text-primary)]">{role.roleName}</span>
                {role.description && (
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{role.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!role.isSystemRole &&
                  !['Admin', 'Administrator', 'SuperAdmin'].includes(role.roleName) && (
                    <button
                      onClick={() => onEditRole(role)}
                      className="p-1.5 rounded-md hover:bg-[var(--surface-highlight)] text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
                      title="Edit Role"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                {!role.isSystemRole &&
                  !['Admin', 'Administrator', 'SuperAdmin'].includes(role.roleName) && (
                    <button
                      onClick={() => onDeleteRole(role.roleId)}
                      className="p-1.5 rounded-md hover:bg-red-50 text-[var(--text-secondary)] hover:text-red-500 transition-colors"
                      title="Delete Role"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DepartmentForm = ({
  item,
  onSave,
  onCancel,
  existingDepartments,
}: {
  item: Partial<Department> | null;
  onSave: (item: Department) => void;
  onCancel: () => void;
  existingDepartments: Department[];
}) => {
  const [formData, setFormData] = useState<Partial<Department>>({
    DepartmentName: item?.DepartmentName || '',
  });
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData({ ...formData, DepartmentName: val });

    // Immediate validation
    const validationError = validateDepartmentName(val);
    if (validationError) {
      setError(validationError);
    } else if (
      existingDepartments.some(
        d =>
          d.DepartmentName.toLowerCase() === val.trim().toLowerCase() &&
          d.DepartmentID !== item?.DepartmentID
      )
    ) {
      setError('Department already existing');
    } else {
      setError('');
    }
  };

  const handleSubmit = () => {
    if (!formData.DepartmentName?.trim()) {
      if (inputRef.current) {
        inputRef.current.reportValidity();
      }
      return;
    }

    const validationError = validateDepartmentName(formData.DepartmentName || '');
    if (validationError) {
      setError(validationError);
      return;
    }

    // Check if department already exists
    const name = formData.DepartmentName?.trim();
    if (
      existingDepartments.some(
        d =>
          d.DepartmentName.toLowerCase() === name?.toLowerCase() &&
          d.DepartmentID !== item?.DepartmentID
      )
    ) {
      setError('Department already existing');
      return;
    }

    onSave({
      DepartmentID: item?.DepartmentID || 0,
      DepartmentName: name,
    } as Department);
  };

  return (
    <div className="space-y-6">
      <Input
        ref={inputRef}
        label="Department Name"
        value={formData.DepartmentName || ''}
        onChange={handleChange}
        placeholder="Enter department name"
        required
        autoFocus
        error={error}
      />

      <div className="flex justify-end gap-3 pt-6 border-t border-[var(--border)] mt-6">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!!error}>
          {item?.DepartmentID ? 'Save Changes' : 'Add Department'}
        </Button>
      </div>
    </div>
  );
};

export default function DepartmentMaster() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [addError, setAddError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);

  // Edit & Confirmation States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Department | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isAddConfirmModalOpen, setIsAddConfirmModalOpen] = useState(false);
  const [pendingUpdateItem, setPendingUpdateItem] = useState<Department | null>(null);

  // Role Modal States
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [isSavingRole, setIsSavingRole] = useState(false);

  // Delete Modals States
  const [isDeleteDeptModalOpen, setIsDeleteDeptModalOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<number | null>(null);
  
  const [isDeleteRoleModalOpen, setIsDeleteRoleModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<number | null>(null);

  const [permissions, setPermissions] = useState<Permission[]>([]);

  useEffect(() => {
    loadDepartments();
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const response = await authApi.getPermissions();
      if (response.success && response.data) {
        setPermissions(response.data);
      }
    } catch (error) {
      logger.error('Failed to load permissions:', error);
    }
  };

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const response = await departmentApi.getAll();
      if (response.success && response.data) {
        setDepartments(response.data);
      }
    } catch (error) {
      logger.error('Failed to load departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const confirmAdd = async () => {
    try {
      setIsAdding(true);
      const createData: Omit<Department, 'DepartmentID'> = {
        DepartmentName: newDepartmentName.trim(),
      };
      logger.info('Creating department:', createData);
      const response = await departmentApi.create(createData);
      logger.info('Create response:', response);
      if (response.success && response.data) {
        setDepartments(prev => [...prev, response.data as Department]);
        showToast.success('Department created successfully');
        setNewDepartmentName('');
        setAddError('');
        setIsAddConfirmModalOpen(false);
        setFormResetKey(prev => prev + 1);
      } else if (!response.success) {
        logger.error('Create failed:', response.error);
      }
    } catch (error) {
      logger.error('Failed to create department:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleEdit = (item: Department) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  const initiateUpdate = (item: Department) => {
    setPendingUpdateItem(item);
    setIsConfirmModalOpen(true);
  };

  const confirmUpdate = async () => {
    if (!pendingUpdateItem) return;

    try {
      const updateData: Omit<Department, 'DepartmentID'> = {
        DepartmentName: pendingUpdateItem.DepartmentName,
      };
      logger.info('Updating department:', { id: pendingUpdateItem.DepartmentID, data: updateData });
      const response = await departmentApi.update(pendingUpdateItem.DepartmentID, {
        ...updateData,
        DepartmentID: pendingUpdateItem.DepartmentID,
      } as Department);

      if (response.success && response.data) {
        setDepartments(prev =>
          prev.map(d =>
            d.DepartmentID === pendingUpdateItem.DepartmentID ? (response.data as Department) : d
          )
        );
        showToast.success('Department updated successfully');
        setIsEditModalOpen(false);
        setIsConfirmModalOpen(false);
        setPendingUpdateItem(null);
      } else if (!response.success) {
        logger.error('Update failed:', response.error);
      }
    } catch (error) {
      logger.error('Failed to update department:', error);
    }
  };

  const handleDelete = (id: number) => {
    setDeptToDelete(id);
    setIsDeleteDeptModalOpen(true);
  };

  const confirmDeleteDept = async () => {
    if (!deptToDelete) return;
    try {
      logger.info('Deleting department:', { id: deptToDelete });
      const response = await departmentApi.delete(deptToDelete);

      if (response.success) {
        setDepartments(prev => prev.filter(d => d.DepartmentID !== deptToDelete));
        showToast.success('Department deleted successfully');
        logger.info('Department deleted successfully:', { id: deptToDelete });
      } else {
        // Handle error from backend (e.g., system department)
        showToast.error(response.error || 'Failed to delete department');
        logger.error('Delete failed:', response.error);
      }
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error || error?.message || 'Failed to delete department';
      showToast.error(errorMessage);
      logger.error('Failed to delete department:', error);
    } finally {
      setIsDeleteDeptModalOpen(false);
      setDeptToDelete(null);
    }
  };

  // Role handlers
  const handleAddRole = (departmentId: number) => {
    setSelectedDepartmentId(departmentId);
    setEditingRole(null);
    setIsRoleModalOpen(true);
  };

  const handleEditRole = (role: Role) => {
    setSelectedDepartmentId(role.departmentId || null);
    setEditingRole(role);
    setIsRoleModalOpen(true);
  };

  const handleDeleteRole = (roleId: number) => {
    setRoleToDelete(roleId);
    setIsDeleteRoleModalOpen(true);
  };

  const confirmDeleteRole = async () => {
    if (!roleToDelete) return;
    try {
      await authApi.deleteRole(roleToDelete);
      showToast.success('Role deleted successfully');
      // Refresh the expanded rows
      loadDepartments();
    } catch (error) {
      logger.error('Failed to delete role:', error);
    } finally {
      setIsDeleteRoleModalOpen(false);
      setRoleToDelete(null);
    }
  };

  const handleSaveRole = async (roleData: Partial<Role>) => {
    try {
      setIsSavingRole(true);
      let savedRoleId = roleData.roleId;

      if (roleData.roleId) {
        // Update
        await authApi.updateRole(roleData.roleId, roleData);
        showToast.success('Role updated successfully');
      } else {
        // Create
        const response = await authApi.createRole(roleData);
        if (response && response.data) {
          savedRoleId = response.data.roleId;
        }
        showToast.success('Role created successfully');
      }

      // Auto-assign permission for the landing page
      if (savedRoleId && roleData.landingPage && roleData.landingPage !== '/dashboard') {
        const targetPermission = permissions.find(p => p.pagePath === roleData.landingPage);
        if (targetPermission) {
          try {
            await authApi.updateRolePermission(
              savedRoleId,
              targetPermission.permissionId,
              ['view'] // Default to view permission
            );
            logger.info(
              `Auto-assigned view permission for ${roleData.landingPage} to role ${savedRoleId}`
            );
          } catch (permError) {
            logger.error('Failed to auto-assign landing page permission:', permError);
            showToast.error(
              'Role saved, but failed to auto-assign landing page permission. Please set it manually.'
            );
          }
        }
      }

      setIsRoleModalOpen(false);
      setEditingRole(null);
      // Reload departments to refresh role data
      loadDepartments();
    } catch (error) {
      logger.error('Failed to save role:', error);
    } finally {
      setIsSavingRole(false);
    }
  };

  const columns: ColumnDef<Department>[] = [
    {
      id: 'srNo',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Sr. No." />,
      cell: ({ row }) => <span>{row.index + 1}</span>,
    },
    {
      accessorKey: 'DepartmentName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => <span className="font-medium">{row.original.DepartmentName}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const isDefault = [
          'Accounts',
          'Administration',
          'Production',
          'Sales & Marketing',
          'Dealer',
          'Administrator',
        ].includes(row.original.DepartmentName);

        if (isDefault) {
          return (
            <div className="flex items-center justify-end">
              <span className="text-[var(--text-secondary)] italic text-sm">Default</span>
            </div>
          );
        }

        return (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => handleEdit(row.original)}
              className="p-2 rounded-lg hover:bg-[var(--surface-highlight)] text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors border border-transparent hover:border-[var(--border)] focus-ring"
              title="Edit"
              aria-label="Edit"
            >
              <Edit2 size={16} />
            </button>
            {!row.original.IsSystemDepartment && (
              <button
                onClick={() => handleDelete(row.original.DepartmentID)}
                className="p-2 rounded-lg hover:bg-red-50 text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors border border-transparent hover:border-red-200 focus-ring"
                title="Delete"
                aria-label="Delete"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  if (loading && departments.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        {/* Page Header */}
        <PageHeader
          metadataPath="/masters/departments"
        title="Department Master"
          description="Manage your department records and associated roles"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Department Form Section - Left Side (1/3 width) */}
          <div className="lg:col-span-1">
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6 sticky top-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
                {editingItem ? 'Edit Department' : 'Add New Department'}
              </h2>
              <DepartmentForm
                key={`add-form-${formResetKey}`}
                item={editingItem}
                existingDepartments={departments}
                onSave={
                  editingItem
                    ? initiateUpdate
                    : item => {
                        setNewDepartmentName(item.DepartmentName);
                        setIsAddConfirmModalOpen(true);
                      }
                }
                onCancel={() => {
                  setEditingItem(null);
                  setNewDepartmentName('');
                  setAddError('');
                }}
              />
            </div>
          </div>

          {/* Department List Section - Right Side (2/3 width) */}
          <div className="lg:col-span-2">
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
              <DataTable
                data={departments}
                columns={columns}
                searchPlaceholder="Search departments..."
                getRowCanExpand={() => true}
                renderSubComponent={({ row }) => (
                  <RolesSubRow
                    department={row.original}
                    onAddRole={handleAddRole}
                    onEditRole={handleEditRole}
                    onDeleteRole={handleDeleteRole}
                  />
                )}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Department"
          size="lg"
        >
          <DepartmentForm
            item={editingItem}
            existingDepartments={departments}
            onSave={initiateUpdate}
            onCancel={() => setIsEditModalOpen(false)}
          />
        </Modal>
      )}

      {/* Confirmation Modal for Update */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Department Details"
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">Department ID:</span>
              <p>{pendingUpdateItem?.DepartmentID}</p>
            </div>
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">Department Name:</span>
              <p>{pendingUpdateItem?.DepartmentName}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setIsConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmUpdate}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal for Add */}
      <Modal
        isOpen={isAddConfirmModalOpen}
        onClose={() => setIsAddConfirmModalOpen(false)}
        title="Confirm Department Details"
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 text-sm">
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">Department Name:</span>
              <p>{newDepartmentName}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setIsAddConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmAdd} disabled={isAdding}>
              {isAdding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Role Modal */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => {
          setIsRoleModalOpen(false);
          setEditingRole(null);
        }}
        title={editingRole ? 'Edit Role' : 'Add New Role'}
        size="md"
      >
        {selectedDepartmentId && (
          <RoleForm
            role={editingRole}
            departmentId={selectedDepartmentId}
            onSave={handleSaveRole}
            onCancel={() => {
              setIsRoleModalOpen(false);
              setEditingRole(null);
            }}
            permissions={permissions}
            isSaving={isSavingRole}
          />
        )}
      </Modal>
      {/* Delete Department Modal */}
      <Modal
        isOpen={isDeleteDeptModalOpen}
        onClose={() => setIsDeleteDeptModalOpen(false)}
        title="Delete Department"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Are you sure you want to delete this department? This will also remove any roles associated with it. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setIsDeleteDeptModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmDeleteDept} className="bg-red-600 hover:bg-red-700 text-white border-transparent">
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Role Modal */}
      <Modal
        isOpen={isDeleteRoleModalOpen}
        onClose={() => setIsDeleteRoleModalOpen(false)}
        title="Delete Role"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Are you sure you want to delete this role? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => setIsDeleteRoleModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmDeleteRole} className="bg-red-600 hover:bg-red-700 text-white border-transparent">
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
