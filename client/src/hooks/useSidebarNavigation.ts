import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { routeRegistry, RouteNode, NavItem, NavSubItem } from '@/config/routeRegistry';
import { LucideIcon } from 'lucide-react';

/**
 * Hook to get navigation items based on user permissions
 *
 * Features:
 * - Filters routes by user permissions
 * - Shows parent menus if ANY child is accessible
 * - Removes individual items user can't access
 * - Removes parent items only if NO children are accessible AND parent permission not granted
 */
export function useSidebarNavigation() {
  const { user, hasPermission } = useAuth();

  const navItems = useMemo(() => {
    const isAdmin = user?.Role === 'Admin' || user?.Role === 'SuperAdmin';

    const mapAndFilter = (nodes: RouteNode[]): NavItem[] => {
      return nodes
        .map(node => {
          // Skip hidden items
          if (node.showInSidebar === false) return null;
          if (!node.label) return null;

          // Admin bypass - show everything
          if (isAdmin) {
            let children: NavSubItem[] | undefined = undefined;
            if (node.children) {
              const filteredChildren = mapAndFilter(node.children);
              if (filteredChildren.length > 0) {
                children = filteredChildren.map(c => ({
                  id: c.id,
                  label: c.label,
                  path: c.path,
                  icon: c.icon,
                }));
              }
            }
            return {
              id: node.id,
              label: node.label,
              icon: node.icon as LucideIcon,
              path: node.path,
              group: node.group || 'Main',
              children,
            };
          }

          // Process children FIRST (before checking parent permission)
          let children: NavSubItem[] | undefined = undefined;
          if (node.children) {
            const filteredChildren = mapAndFilter(node.children);
            if (filteredChildren.length > 0) {
              children = filteredChildren.map(c => ({
                id: c.id,
                label: c.label,
                path: c.path,
                icon: c.icon,
              }));
            }
          }

          // If has accessible children, show this parent regardless of parent permission
          if (children && children.length > 0) {
            return {
              id: node.id,
              label: node.label,
              icon: node.icon as LucideIcon,
              path: node.path,
              group: node.group || 'Main',
              children,
            };
          }

          // If parent route itself is accessible and user has permission,
          // show parent menu even if children are hidden from sidebar.
          if (node.permission) {
            if (!hasPermission(node.permission.module, 'view')) {
              return null;
            }
            return {
              id: node.id,
              label: node.label,
              icon: node.icon as LucideIcon,
              path: node.path,
              group: node.group || 'Main',
              children: undefined,
            };
          }

          // If this node HAD children defined but NONE are accessible, hide the parent entirely
          if (node.children && node.children.length > 0) {
            return null; // Don't show empty parent menu
          }

          // Has permission (or no permission required) - show it
          return {
            id: node.id,
            label: node.label,
            icon: node.icon as LucideIcon,
            path: node.path,
            group: node.group || 'Main',
            children,
          };
        })
        .filter(Boolean) as NavItem[];
    };

    const allItems = mapAndFilter(routeRegistry);
    return allItems;
  }, [user, hasPermission]);

  const groupedNavItems = useMemo(() => {
    const groups: Record<string, NavItem[]> = {};
    navItems.forEach(item => {
      const group = item.group || 'Main';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(item);
    });
    return Object.fromEntries(Object.entries(groups).filter(([_, items]) => items.length > 0));
  }, [navItems]);

  const flatNavItems = navItems;

  return {
    navItems: flatNavItems,
    groupedNavItems,
    hasGroupItems: (groupName: string) => {
      return (groupedNavItems[groupName]?.length || 0) > 0;
    },
  };
}

export default useSidebarNavigation;
