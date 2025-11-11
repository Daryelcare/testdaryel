import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, Lock, Shield, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CompanyProvider, useCompany } from '@/contexts/CompanyContext';

function EmployeeLoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { companySettings, loading: companyLoading } = useCompany();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // First, find the employee record
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single();

      if (empError || !employee) {
        throw new Error('Invalid email or password');
      }

      // Check if account is locked
      if (employee.locked_until && new Date(employee.locked_until) > new Date()) {
        throw new Error('Account is temporarily locked. Please try again later.');
      }

      // Try to sign in with Supabase auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (authError) {
        // If employee doesn't have Supabase auth account, create one
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
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

        if (signUpError) {
          // If signup fails, try password verification with the stored hash
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

          // Password is correct, but no Supabase auth account exists
          // Create the auth account
          const { error: createAuthError } = await supabase.auth.signUp({
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

          if (createAuthError) {
            throw new Error('Failed to create authentication account');
          }
        }

        // Try to sign in again after creating the account
        const { error: retrySignInError } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (retrySignInError) {
          throw new Error('Authentication failed');
        }
      }

      // Update last login and reset failed attempts
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

      // Check if password change is required
      if (employee.must_change_password) {
        navigate('/employee-change-password');
      } else {
        navigate('/employee-dashboard');
      }

    } catch (error: any) {
      console.error('Employee login error:', error);
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
            <CardTitle className="text-2xl font-bold">{companySettings.name}</CardTitle>
            <CardDescription className="space-y-1">
              <div>{companySettings.tagline}</div>
              <div className="text-sm">Employee Portal - Sign in with your credentials</div>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmployeeLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your work email"
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
            
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Lock className="mr-2 h-4 w-4" />
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Having trouble signing in? Contact your administrator.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function EmployeeLogin() {
  return (
    <CompanyProvider>
      <EmployeeLoginContent />
    </CompanyProvider>
  );
}