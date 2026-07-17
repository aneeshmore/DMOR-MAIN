import { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTheme, ThemeEditor, isThemeEditorEnabled } from '@/plugins/themeEditor';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { Sidebar, Header } from '@/components/layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useSidebarNavigation } from '@/hooks/useSidebarNavigation';
import { AppRouter } from '@/router/AppRouter';
import LoginPage from '@/features/authority/pages/LoginPage';
import { TopAlertBanner } from '@/features/notifications/components';
import { GlobalLoader } from '@/components/ui/GlobalLoader';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user is locked
  if ((user as any)?.Status === 'Locked') {
    logout();
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { theme, setTheme } = useTheme();
  const [isThemeEditorOpen, setIsThemeEditorOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { navItems } = useSidebarNavigation();

  const handlePageChange = (path: string) => {
    navigate(path);
  };

  // Login page doesn't need layout
  if (location.pathname === '/login') {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <ProtectedRoute>
      <div className="h-screen w-full bg-[var(--background)] flex">
        <Sidebar
          items={navItems}
          activePath={location.pathname}
          onNavigate={handlePageChange}
          onLogout={logout}
        />

        {/* Main Content Area - Floating Card Style */}
        <div className="flex-1 flex flex-col min-w-0 h-full relative">
          <Header onThemeToggle={() => setIsThemeEditorOpen(true)} user={user} onLogout={logout} />
          <TopAlertBanner />

          <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 scroll-smooth">
            <div className="max-w-[1600px] mx-auto w-full animate-fade-in pb-24 md:pb-0">
              <AppRouter />
            </div>
          </main>
        </div>

        {isThemeEditorEnabled() && (
          <ThemeEditor
            isOpen={isThemeEditorOpen}
            onClose={() => setIsThemeEditorOpen(false)}
            currentTheme={theme}
            onThemeChange={setTheme}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}

import { Toaster } from '@/components/ui/Toaster';
import { ToastSwipeProvider } from '@/hooks/useToastSwipeDismiss';
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialog';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <SidebarProvider>
              <ToastSwipeProvider>
                <ConfirmDialogProvider>
                  <GlobalLoader />
                  <AppContent />
                  <Toaster />
                </ConfirmDialogProvider>
              </ToastSwipeProvider>
            </SidebarProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
