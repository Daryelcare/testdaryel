
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Badge, Building, User, KeyRound, AlertTriangle } from 'lucide-react';
import { CompanyProvider, useCompany } from '@/contexts/CompanyContext';

function PublicHomeContent() {
  const { user, userRole, loading, signOut } = useAuth();
  const { companySettings, loading: companyLoading } = useCompany();
  const navigate = useNavigate();
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  useEffect(() => {
    if (!loading && user && userRole !== null) {
      // Redirect authenticated users to their appropriate dashboard
      if (userRole === 'admin') {
        navigate('/admin');
      } else if (userRole === 'user') {
        // For regular users, redirect to admin panel as they should have access to basic features
        navigate('/admin');
      }
    }
  }, [user, userRole, loading, navigate]);

  // Add timeout protection to prevent infinite loading
  useEffect(() => {
    const randomTimeout = Math.random() * 3000 + 3000; // Random 3-6 seconds
    const timeout = setTimeout(() => {
      if (loading || (user && userRole === null)) {
        setLoadingTimeout(true);
      }
    }, randomTimeout);

    return () => clearTimeout(timeout);
  }, [loading, user, userRole]);

  // Handle loading timeout - show error UI
  if (loadingTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-6">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
            <AlertTriangle className="w-12 h-12 text-yellow-500" />
            <h3 className="text-lg font-semibold">Loading Timeout</h3>
            <p className="text-sm text-muted-foreground text-center">
              We're having trouble loading your session. This might be due to a network issue or an expired session.
            </p>
            <div className="flex gap-2 w-full">
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline"
                className="flex-1"
              >
                Retry
              </Button>
              <Button 
                onClick={async () => {
                  await signOut();
                  window.location.reload();
                }}
                className="flex-1"
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || (user && userRole === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <Card className="w-80">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">Checking authentication...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show both job application and employee login for non-authenticated users
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 pt-8">
          <div className={`mx-auto mb-6 w-20 h-20 rounded-lg flex items-center justify-center ${companySettings.logo ? '' : 'bg-primary/10'}`}>
            {!companyLoading && companySettings.logo ? (
              <img
                src={companySettings.logo}
                alt={companySettings.name}
                className="h-16 w-16 object-contain"
              />
            ) : (
              <Building className="w-10 h-10 text-primary" />
            )}
          </div>
          <h1 className="text-4xl font-bold mb-2">{companySettings.name}</h1>
          <p className="text-lg text-muted-foreground mb-2">{!companyLoading && companySettings.tagline}</p>
          <p className="text-lg text-muted-foreground">Choose what you need to do today</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Job Application Portal */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Apply for a Job</CardTitle>
              <CardDescription>
                Join our team! Submit your application and we'll review it promptly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => navigate('/job-application')} 
                className="w-full"
                size="lg"
              >
                Start Application
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Complete our multi-step application form with your details, experience, and skills
              </p>
            </CardContent>
          </Card>

          {/* Employee Portal */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <div className="relative">
                  <User className="w-6 h-6 text-primary" />
                  <KeyRound className="w-3 h-3 text-primary absolute -bottom-1 -right-1" />
                </div>
              </div>
              <CardTitle className="text-2xl">Employee Portal</CardTitle>
              <CardDescription>
                Current employees: Login to manage your leave requests and view your information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => navigate('/login')} 
                className="w-full"
                size="lg"
              >
                Login
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Access your dashboard to request leaves, view leave history, and manage your documents. 
                The system will automatically detect your account type.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function PublicHome() {
  return (
    <CompanyProvider>
      <PublicHomeContent />
    </CompanyProvider>
  );
}
