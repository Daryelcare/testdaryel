import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPage?: string;
  fallbackPath?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredPage, 
  fallbackPath = "/admin" 
}: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { hasPageAccess, loading: permissionsLoading, error, isAdmin } = usePermissions();
  const location = useLocation();

  // Show loading state while auth or permissions are loading
  if (authLoading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Card className="w-80">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Prevent employees from accessing admin routes
  if (user.user_metadata?.role === 'employee') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertTriangle className="w-8 h-8 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Employee accounts cannot access the admin portal. Please use the employee login.
            </p>
            <Button onClick={() => window.location.href = '/employee-login'}>
              Go to Employee Portal
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state if there's a permissions error
  if (error && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertTriangle className="w-8 h-8 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Permission Error</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Failed to load permissions. Please try refreshing the page.
            </p>
            <Button onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check page access permission (admins bypass this check)
  if (requiredPage && !isAdmin && !hasPageAccess(requiredPage)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertTriangle className="w-8 h-8 text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              You don't have permission to access this page. Please contact your administrator.
            </p>
            <Button onClick={() => window.history.back()}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}