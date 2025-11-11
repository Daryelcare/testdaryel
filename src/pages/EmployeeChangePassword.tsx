import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeAuth } from '@/contexts/EmployeeAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function EmployeeChangePassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { employee } = useEmployeeAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      // Hash the new password
      const { data: hashedPassword, error: hashError } = await supabase.rpc('hash_password', {
        password: newPassword
      });

      if (hashError) throw hashError;

      // Update Supabase Auth password
      const { error: authUpdateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (authUpdateError) throw authUpdateError;

      // Update employee password hash in database
      const { error: updateError } = await supabase
        .from('employees')
        .update({
          password_hash: hashedPassword as string,
          must_change_password: false
        })
        .eq('id', employee?.id);

      if (updateError) throw updateError;

      toast({
        title: "Password changed successfully",
        description: "Your password has been updated. You can now access your dashboard.",
      });

      navigate('/employee-dashboard');
    } catch (error: any) {
      console.error('Password change error:', error);
      setError('Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!employee) {
    navigate('/employee-login');
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-md shadow-glow">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center">
            <Key className="w-6 h-6 text-warning" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Change Password Required</CardTitle>
            <CardDescription>
              You must change your password before accessing your dashboard
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="transition-all focus:shadow-glow"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
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
              Change Password
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Welcome, {employee.name}! Please create a secure password.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}