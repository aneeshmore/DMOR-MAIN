import React, { useState, useEffect } from 'react';
import { LogOut, ChevronLeft, ChevronRight, Search, ChevronDown, X } from 'lucide-react';
import { NavItem } from '@/config/routeRegistry';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/cn';
import { confirmDialog } from '@/components/ui';

interface SidebarProps {
  items: NavItem[];
  activePath: string;
  onNavigate: (path: string) => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ items, activePath, onNavigate, onLogout }) => {
  const { isOpen, isCollapsed, toggle, setOpen } = useSidebar();
  const { user } = useAuth();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [mobileExpandedItem, setMobileExpandedItem] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile/tablet on mount and resize (up to 1280px = small laptop)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1280);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Reset mobile expanded item when sidebar closes
  useEffect(() => {
    if (!isOpen) {
      setMobileExpandedItem(null);
    }
  }, [isOpen]);

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>, itemId: string) => {
    // Only use hover on desktop
    if (isMobile) return;

    setHoveredItem(itemId);

    // Calculate position for floating menu
    const rect = e.currentTarget.getBoundingClientRect();
    setDropdownPosition({ top: rect.top });

    if (!isCollapsed) {
      setExpandedItem(itemId);
    }
  };

  const handleMouseLeave = () => {
    // Only use hover on desktop
    if (isMobile) return;

    setHoveredItem(null);
    setDropdownPosition(null);
    if (!isCollapsed) {
      setExpandedItem(null);
    }
  };

  const handleLogout = async () => {
    const confirmed = await confirmDialog({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      confirmLabel: 'Logout',
      variant: 'warning',
    });
    if (confirmed && onLogout) {
      onLogout();
    }
  };

  const [searchQuery, setSearchQuery] = useState('');

  const groupedNav: Record<string, NavItem[]> = {};
  items.forEach(item => {
    const groupName = item.group || 'Other';
    if (!groupedNav[groupName]) groupedNav[groupName] = [];
    groupedNav[groupName].push(item);
  });

  const handleNavigate = (path: string) => {
    onNavigate(path);
    // Close sidebar on mobile after navigation
    if (isMobile) {
      setOpen(false);
      setMobileExpandedItem(null);
    }
  };

  // Handle click on parent item with children (mobile accordion toggle)
  const handleParentClick = (item: NavItem, hasChildren: boolean) => {
    if (isMobile && hasChildren) {
      // On mobile, toggle accordion instead of navigating
      setMobileExpandedItem(prev => (prev === item.id ? null : item.id));
    } else if (hasChildren && !isMobile) {
      // On desktop, navigate to the parent path
      handleNavigate(item.path);
    } else {
      // No children, just navigate
      handleNavigate(item.path);
    }
  };

  // Filter items based on search only - permissions already filtered by useSidebarNavigation
  const filteredGroups = Object.entries(groupedNav).reduce(
    (acc, [group, items]) => {
      const filtered = items
        .map(item => {
          const parentMatches = item.label.toLowerCase().includes(searchQuery.toLowerCase());

          // Filter children by search query only
          const matchingChildren = item.children?.filter(child => {
            if (!searchQuery) return true; // No search = show all
            return child.label.toLowerCase().includes(searchQuery.toLowerCase()) || parentMatches;
          });

          const hasMatchingChildren = matchingChildren && matchingChildren.length > 0;

          // If searching, show if parent matches OR has matching children
          if (searchQuery) {
            if (parentMatches || hasMatchingChildren) {
              return { ...item, children: matchingChildren };
            }
            return null;
          }

          // Not searching - show as-is
          return item;
        })
        .filter(Boolean) as NavItem[];

      if (filtered.length > 0) {
        acc[group] = filtered;
      }
      return acc;
    },
    {} as Record<string, NavItem[]>
  );

  // Get user's full name and initials
  const fullName = user ? `${user.FirstName}${user.LastName ? ' ' + user.LastName : ''}` : 'User';
  const initials = user
    ? `${user.FirstName.charAt(0)}${user.LastName?.charAt(0) || ''}`.toUpperCase()
    : 'U';
  const designation = user?.Role || 'User';

  // Close sidebar when clicking backdrop
  const handleBackdropClick = () => {
    setOpen(false);
    setMobileExpandedItem(null);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-30 xl:hidden animate-fade-in"
          onClick={handleBackdropClick}
          aria-label="Close sidebar"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] transition-all duration-300 ease-in-out xl:relative shadow-xl border-r-0',
          isOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0',
          isCollapsed ? 'w-20' : 'w-72'
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-[var(--sidebar-border)] bg-[var(--sidebar-bg)]">
          <div
            className={cn(
              'flex items-center gap-3 overflow-hidden',
              isCollapsed && 'justify-center w-full'
            )}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm border border-gray-100 overflow-hidden">
              <img src="/morex-logo.png" alt="Morex Logo" className="w-full h-full object-contain" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="font-bold tracking-tight text-base text-[var(--sidebar-text-active)]">
                  MOREX TECH
                </span>
                <span className="text-[11px] text-[var(--sidebar-text)] uppercase tracking-wider font-medium">
                  OMS
                </span>
              </div>
            )}
          </div>

          {/* Desktop collapse button */}
          {!isCollapsed && (
            <button
              onClick={toggle}
              className="hidden xl:flex h-6 w-6 items-center justify-center rounded text-[var(--sidebar-text)] hover:bg-[var(--sidebar-border)] hover:text-[var(--sidebar-text-active)] transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
          )}

          {/* Mobile close button */}
          {!isCollapsed && isMobile && (
            <button
              onClick={() => setOpen(false)}
              className="xl:hidden flex h-8 w-8 items-center justify-center rounded text-[var(--sidebar-text)] hover:bg-[var(--sidebar-border)] hover:text-[var(--sidebar-text-active)] transition-colors"
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Search */}
        {!isCollapsed && (
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--sidebar-text)] opacity-70" />
              <input
                type="text"
                placeholder="Search navigation..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-9 rounded bg-[var(--sidebar-border)] pl-9 pr-4 text-sm text-[var(--sidebar-text-active)] placeholder:text-[var(--sidebar-text)] placeholder:opacity-70 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] transition-all"
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1 xl:scrollbar-hide overscroll-contain">
          {Object.entries(filteredGroups).map(([group, groupItems]) => (
            <div key={group}>
              {groupItems.map(item => {
                const isActive = activePath.startsWith(item.path);
                const isExpanded = expandedItem === item.id;
                const isMobileExpanded = mobileExpandedItem === item.id;
                const hasChildren = item.children && item.children.length > 0;

                return (
                  <div
                    key={item.id}
                    onMouseEnter={e => hasChildren && handleMouseEnter(e, item.id)}
                    onMouseLeave={handleMouseLeave}
                    className="relative"
                  >
                    <button
                      onClick={() => handleParentClick(item, !!hasChildren)}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition-all relative cursor-pointer',
                        isActive
                          ? 'bg-[var(--primary)] text-white shadow-md'
                          : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-border)] hover:text-[var(--sidebar-text-active)]',
                        isCollapsed && 'justify-center px-2'
                      )}
                    >
                      <span className="shrink-0">
                        {item.icon && (
                          <item.icon
                            size={18}
                            className={cn(
                              'shrink-0 transition-colors',
                              isActive
                                ? 'text-white'
                                : 'text-[var(--sidebar-text)] group-hover:text-[var(--sidebar-text-active)]'
                            )}
                          />
                        )}
                      </span>
                      {!isCollapsed && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          {hasChildren && (
                            <ChevronDown
                              size={14}
                              className={cn(
                                'transition-transform duration-200',
                                (isMobile ? isMobileExpanded || searchQuery : isExpanded) &&
                                'rotate-180'
                              )}
                            />
                          )}
                        </>
                      )}
                    </button>

                    {/* Mobile: Inline Accordion Children - Show when expanded OR when searching */}
                    {isMobile &&
                      !isCollapsed &&
                      hasChildren &&
                      (isMobileExpanded || searchQuery) && (
                        <div className="mt-1 space-y-1 animate-accordion-down">
                          {item.children!.map(child => {
                            const isChildActive = activePath === child.path;
                            const ChildIcon = child.icon;

                            return (
                              <button
                                key={child.id}
                                onClick={() => handleNavigate(child.path)}
                                className={cn(
                                  'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ml-6',
                                  isChildActive
                                    ? 'bg-[var(--primary)] text-white'
                                    : 'text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-border)]'
                                )}
                              >
                                {ChildIcon && (
                                  <ChildIcon
                                    size={16}
                                    className="shrink-0 text-[var(--sidebar-text)]"
                                  />
                                )}
                                <span className="flex-1 text-left">{child.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                    {/* Desktop: Floating Dropdown Menu for expanded sidebar */}
                    {!isMobile && !isCollapsed && hasChildren && isExpanded && dropdownPosition && (
                      <div
                        className="fixed left-72 z-[100] min-w-[280px] animate-fade-in-right"
                        style={{
                          top: `${dropdownPosition.top}px`,
                        }}
                      >
                        <div className="p-2 space-y-0.5 max-h-[320px] overflow-y-auto sidebar-scrollbar bg-[var(--sidebar-bg)] border border-[var(--sidebar-border)] shadow-2xl">
                          <div className="px-3 py-2 text-xs font-bold text-[var(--sidebar-text)] uppercase tracking-wider border-b border-[var(--sidebar-border)] mb-2">
                            {item.label}
                          </div>
                          {item.children!.map(child => {
                            const isChildActive = activePath === child.path;
                            const ChildIcon = child.icon;

                            return (
                              <button
                                key={child.id}
                                onClick={() => handleNavigate(child.path)}
                                className={cn(
                                  'group flex w-full items-center gap-2.5 rounded px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                                  isChildActive
                                    ? 'bg-[var(--primary)] text-white'
                                    : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-border)] hover:text-[var(--sidebar-text-active)]'
                                )}
                              >
                                {ChildIcon && <ChildIcon size={16} className="shrink-0" />}
                                <span className="truncate">{child.label}</span>
                              </button>
                            );
                          })}
                        </div>
                        {/* Bridge - on left side with low opacity for hover effect */}
                        <div className="absolute left-0 top-0 -translate-x-full w-16 h-full bg-[var(--sidebar-bg)] opacity-0"></div>
                      </div>
                    )}

                    {/* Desktop: Floating Dropdown Menu for collapsed sidebar */}
                    {!isMobile &&
                      isCollapsed &&
                      hasChildren &&
                      hoveredItem === item.id &&
                      dropdownPosition && (
                        <div
                          className="fixed left-20 z-[100] min-w-[240px] animate-fade-in-right"
                          style={{
                            top: `${dropdownPosition.top}px`,
                          }}
                        >
                          <div className="p-2 space-y-0.5 max-h-[300px] overflow-y-auto sidebar-scrollbar bg-[var(--sidebar-bg)] border border-[var(--sidebar-border)] shadow-2xl">
                            <div className="px-3 py-2 text-xs font-bold text-[var(--sidebar-text)] uppercase tracking-wider border-b border-[var(--sidebar-border)] mb-2">
                              {item.label}
                            </div>
                            {item.children!.map(child => {
                              const isChildActive = activePath === child.path;
                              const ChildIcon = child.icon;

                              return (
                                <button
                                  key={child.id}
                                  onClick={() => handleNavigate(child.path)}
                                  className={cn(
                                    'group flex w-full items-center gap-2.5 rounded px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                                    isChildActive
                                      ? 'bg-[var(--primary)] text-white'
                                      : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-border)] hover:text-[var(--sidebar-text-active)]'
                                  )}
                                >
                                  {ChildIcon && <ChildIcon size={16} className="shrink-0" />}
                                  <span className="truncate">{child.label}</span>
                                </button>
                              );
                            })}
                          </div>
                          {/* Bridge - matches button height to prevent menu disappearing */}
                          <div className="absolute left-0 top-0 -translate-x-full w-4 h-full bg-[var(--sidebar-bg)] opacity-0"></div>
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer / User */}
        <div className="border-t border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] p-3">
          {isCollapsed ? (
            <button
              onClick={toggle}
              className="flex w-full justify-center rounded p-2 text-[var(--sidebar-text)] hover:bg-[var(--sidebar-border)] hover:text-[var(--sidebar-text-active)] cursor-pointer"
            >
              <ChevronRight size={18} />
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded bg-[var(--sidebar-border)] p-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-medium text-white">
                {initials}
              </div>
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate text-xs font-medium text-[var(--sidebar-text-active)]">
                  {fullName}
                </span>
                <span className="truncate text-[10px] text-[var(--sidebar-text)]">
                  {designation}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] cursor-pointer"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
