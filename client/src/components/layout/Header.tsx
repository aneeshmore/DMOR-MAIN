import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Palette, ChevronDown, LogOut, User, Settings, Menu, RefreshCw } from 'lucide-react';
import { AuthUser } from '@/types';
import { isThemeEditorEnabled } from '@/plugins/themeEditor';
import { useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/utils/cn';
import { NotificationDropdown } from '@/features/notifications/components';
import { confirmDialog } from '@/components/ui';

interface HeaderProps {
  onThemeToggle: () => void;
  user?: AuthUser | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onThemeToggle, user, onLogout }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const { toggle } = useSidebar();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Handle page refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    // Small delay for visual feedback
    setTimeout(() => {
      window.location.reload();
    }, 200);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    const confirmed = await confirmDialog({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      confirmLabel: 'Logout',
      variant: 'warning',
    });
    if (confirmed && onLogout) {
      setShowUserMenu(false);
      onLogout();
    }
  };

  return (
    <header className="sticky top-0 h-16 bg-[var(--header-bg)] border-b border-[var(--header-border)] flex items-center justify-between px-4 lg:px-6 z-10 backdrop-blur-md">
      <div className="flex items-center gap-4">
        {/* Mobile/Tablet Menu Toggle - visible up to 1280px */}
        <button
          onClick={toggle}
          className="xl:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-highlight)] rounded transition-colors cursor-pointer"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>

        {/* Dynamic Breadcrumbs - only on desktop (1280px+) */}
        <nav className="hidden xl:flex items-center text-sm">
          <Link
            to="/dashboard"
            className="text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors cursor-pointer"
          >
            Home
          </Link>
          {location.pathname !== '/dashboard' &&
            location.pathname
              .split('/')
              .filter(Boolean)
              .map((segment, index, array) => {
                const path = `/${array.slice(0, index + 1).join('/')}`;
                const isLast = index === array.length - 1;
                const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');

                return (
                  <div key={path} className="flex items-center">
                    <span className="mx-2 text-[var(--border)]">/</span>
                    {isLast ? (
                      <span className="font-medium text-[var(--text-primary)]">{label}</span>
                    ) : (
                      <Link
                        to={path}
                        className="text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                      >
                        {label}
                      </Link>
                    )}
                  </div>
                );
              })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {/* Refresh Button - visible on all screens */}
        <button
          onClick={handleRefresh}
          className="p-2 text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--surface-highlight)] rounded transition-colors cursor-pointer"
          title="Refresh Page"
          aria-label="Refresh Page"
          disabled={isRefreshing}
        >
          <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
        </button>

        {isThemeEditorEnabled() && (
          <button
            onClick={onThemeToggle}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--surface-highlight)] rounded transition-colors cursor-pointer"
            title="Customize Theme"
            aria-label="Customize Theme"
          >
            <Palette size={18} />
          </button>
        )}
        <NotificationDropdown />

        <div className="h-6 w-px bg-[var(--border)] mx-1"></div>

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-highlight)] rounded p-1.5 transition-colors cursor-pointer"
            aria-label="User menu"
            aria-expanded={showUserMenu}
          >
            <div className="w-8 h-8 rounded bg-[var(--surface-highlight)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)] text-xs font-bold">
              {user?.FirstName?.charAt(0) || 'U'}
              {user?.LastName?.charAt(0) || ''}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-sm font-medium text-[var(--text-primary)] leading-none">
                {user?.FirstName} {user?.LastName}
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                {user?.Role || 'User'}
              </div>
            </div>
            <ChevronDown
              size={14}
              className={cn(
                'text-[var(--text-secondary)] transition-transform',
                showUserMenu && 'rotate-180'
              )}
            />
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-[var(--surface)] rounded border border-[var(--border)] shadow-lg py-1 z-50 animate-fade-in">
              <div className="py-1">
                <Link
                  to="/settings"
                  className="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-highlight)] flex items-center gap-2 transition-colors cursor-pointer"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Settings size={14} />
                  Settings
                </Link>
              </div>

              <div className="border-t border-[var(--border)] mt-1 pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--surface-highlight)] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
