import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, User, Shield, Lock, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CompanyProvider, useCompany } from '@/contexts/CompanyContext';

function UnifiedAuthContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { companySettings } = useCompany();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Feature flag to control sign-up visibility
  const ENABLE_SIGNUP = false;

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await redirectBasedOnUserType(session.user);
      }
    };
    checkUser();
  }, [navigate]);

  const redirectBasedOnUserType = async (user: any) => {
    try {
      // Check if user has admin role in user_roles table
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (userRole?.role) {
        // User has admin role
        navigate('/');
        return;
      }

      // Check if user is an employee by checking user metadata
      if (user.user_metadata?.role === 'employee') {
        // Check if password change is required
        const { data: employee } = await supabase
          .from('employees')
          .select('must_change_password')
          .eq('id', user.user_metadata.employee_id)
          .single();

        if (employee?.must_change_password) {
          navigate('/employee-change-password');
        } else {
          navigate('/employee-dashboard');
        }
        return;
      }

      // If no role found, try to find employee by email
      const { data: employee } = await supabase
        .from('employees')
        .select('*')
        .eq('email', user.email)
        .eq('is_active', true)
        .single();

      if (employee) {
        // Update user metadata to include employee info
        await supabase.auth.updateUser({
          data: {
            role: 'employee',
            employee_id: employee.id,
            name: employee.name
          }
        });

        if (employee.must_change_password) {
          navigate('/employee-change-password');
        } else {
          navigate('/employee-dashboard');
        }
      } else {
        // Default to admin dashboard
        navigate('/');
      }
    } catch (error) {
      console.error('Error determining user type:', error);
      // Default to admin dashboard on error
      navigate('/');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // First try regular auth sign in
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw authError;
      }

      // Verify user still has a valid role record or is an employee
      if (authData.user) {
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('user_id', authData.user.id)
          .maybeSingle();

        // Check if user is an employee
        const isEmployee = authData.user.user_metadata?.role === 'employee';

        if (!userRole && !isEmployee) {
          // User was deleted, sign them out
          await supabase.auth.signOut();
          throw new Error('This account has been deleted. Please contact your administrator.');
        }

        await redirectBasedOnUserType(authData.user);
      }

    } catch (error: any) {
      console.error('Login error:', error);
      
      // If initial auth failed, check if this might be an employee login
      if (error.message && !error.message.includes('deleted')) {
        try {
          const { data: employee } = await supabase
            .from('employees')
            .select('*')
            .eq('email', email)
            .eq('is_active', true)
            .single();

          if (employee) {
            // Check if account is locked
            if (employee.locked_until && new Date(employee.locked_until) > new Date()) {
              throw new Error('Account is temporarily locked. Please try again later.');
            }

            // Verify password using the stored hash
            const { data: passwordCheckResult, error: passwordError } = await supabase
              .rpc('verify_password', {
                password_input: password,
                password_hash: employee.password_hash
              });

            if (passwordError || !passwordCheckResult) {
              // Increment failed login attempts
              await supabase
                .from('employees')
                .update({ 
                  failed_login_attempts: employee.failed_login_attempts + 1,
                  locked_until: employee.failed_login_attempts >= 4 ? 
                    new Date(Date.now() + 30 * 60 * 1000).toISOString() : null
                })
                .eq('id', employee.id);
              
              throw new Error('Invalid email or password');
            }

            // Password is correct, create/update auth account
            const { error: signUpError } = await supabase.auth.signUp({
              email: email,
              password: password,
              options: {
                data: {
                  role: 'employee',
                  employee_id: employee.id,
                  name: employee.name
                }
              }
            });

            if (signUpError && !signUpError.message.includes('already registered')) {
              throw signUpError;
            }

            // Try to sign in again
            const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
              email,
              password,
            });

            if (retryError) {
              throw retryError;
            }

            // Update employee last login
            await supabase
              .from('employees')
              .update({
                last_login: new Date().toISOString(),
                failed_login_attempts: 0,
                locked_until: null
              })
              .eq('id', employee.id);

            toast({
              title: "Login successful",
              description: `Welcome back, ${employee.name}!`,
            });

            await redirectBasedOnUserType(retryData.user);
            return;
          }
        } catch (employeeError) {
          console.error('Employee login fallback error:', employeeError);
        }
      }
      
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) throw error;

      setError('Check your email for the confirmation link!');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <Button
        variant="ghost"
        onClick={() => navigate('/')}
        className="absolute top-4 left-4 flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Button>
      <Card className="w-full max-w-md shadow-glow">
        <CardHeader className="text-center space-y-4">
          <div className={`mx-auto w-16 h-16 rounded-lg flex items-center justify-center ${companySettings.logo ? '' : 'bg-primary/10'}`}>
            {companySettings.logo ? (
              <img
                src={companySettings.logo}
                alt={companySettings.name}
                className="h-12 w-12 object-contain"
              />
            ) : (
              <Shield className="w-8 h-8 text-primary" />
            )}
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">{companySettings.name || 'Welcome'}</CardTitle>
            <CardDescription>
              {companySettings.tagline && <div>{companySettings.tagline}</div>}
              <div>Sign in to access your dashboard or employee portal</div>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className={`grid w-full ${ENABLE_SIGNUP ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <TabsTrigger value="signin" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Sign In
              </TabsTrigger>
              {ENABLE_SIGNUP && (
                <TabsTrigger value="signup" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Sign Up
                </TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="transition-all focus:shadow-glow"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="transition-all focus:shadow-glow"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Lock className="mr-2 h-4 w-4" />
                  Sign In
                </Button>
              </form>
            </TabsContent>
            
            {ENABLE_SIGNUP && (
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email Address</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="transition-all focus:shadow-glow"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Create a password (min 6 characters)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="transition-all focus:shadow-glow"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <User className="mr-2 h-4 w-4" />
                    Create Account
                  </Button>
                </form>
              </TabsContent>
            )}
          </Tabs>

          {error && (
            <Alert className={`mt-4 ${error.includes('Check your email') ? '' : 'variant-destructive'}`}>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              The system will automatically detect your account type and redirect you accordingly.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function UnifiedAuth() {
  return (
    <CompanyProvider>
      <UnifiedAuthContent />
    </CompanyProvider>
  );
}