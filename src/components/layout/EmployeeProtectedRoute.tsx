import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeAuth } from '@/contexts/EmployeeAuthContext';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface EmployeeProtectedRouteProps {
  children: ReactNode;
}

export function EmployeeProtectedRoute({ children }: EmployeeProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { employee, loading: employeeLoading } = useEmployeeAuth();
  const location = useLocation();

  // Show loading state while auth is loading
  if (authLoading || employeeLoading) {
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

  // Check if user is authenticated and is an employee
  if (!user || user.user_metadata?.role !== 'employee') {
    return <Navigate to="/employee-login" state={{ from: location }} replace />;
  }

  // Check if employee data is loaded
  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertTriangle className="w-8 h-8 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Error</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Unable to load employee data. Please try logging in again.
            </p>
            <Button onClick={() => window.location.href = '/employee-login'}>
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}