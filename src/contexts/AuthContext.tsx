import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { cleanupAuthState, forceSignOut } from '@/utils/authCleanup';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [initialAuthCheckComplete, setInitialAuthCheckComplete] = useState(false);

  const fetchUserRole = async (userId: string): Promise<string> => {
    try {
      // Add timeout to prevent hanging (random 3-6 seconds)
      const randomTimeout = Math.random() * 3000 + 3000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Role fetch timeout')), randomTimeout);
      });

      const fetchPromise = supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .limit(1);

      const { data: roles, error } = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (error) {
        console.error('Error fetching user role:', error);
        throw error;
      }
      
      return roles?.[0]?.role || 'user';
    } catch (error) {
      console.error('Error fetching user role:', error);
      // Force sign out on role fetch failure
      await forceSignOut(supabase);
      throw error;
    }
  };

  const handleAuthState = async (session: Session | null) => {
    setSession(session);
    setUser(session?.user ?? null);
    
    if (session?.user) {
      // Skip user_roles validation for employee users
      if (session.user.user_metadata?.role === 'employee') {
        // This is an employee, let EmployeeAuthContext handle validation
        setUserRole(null);
        setLoading(false);
        setInitialAuthCheckComplete(true);
        return;
      }
      
      // Verify user still exists in user_roles table (for admin/manager users only)
      const { data: roleCheck, error: roleCheckError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      if (roleCheckError) {
        console.error('Error checking user role:', roleCheckError);
      }
      
      if (!roleCheck) {
        // User was deleted, force sign out
        console.log('User has no role record, forcing sign out');
        await forceSignOut(supabase);
        setSession(null);
        setUser(null);
        setUserRole(null);
        setLoading(false);
        setInitialAuthCheckComplete(true);
        return;
      }
      
      // User is valid, set their role
      setUserRole(roleCheck.role);
    } else {
      setUserRole(null);
    }
    
    setLoading(false);
    setInitialAuthCheckComplete(true);
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        // Check for existing session first
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          cleanupAuthState();
          if (isMounted) {
            setLoading(false);
            setInitialAuthCheckComplete(true);
          }
          return;
        }

        if (isMounted) {
          await handleAuthState(session);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        cleanupAuthState();
        if (isMounted) {
          setLoading(false);
          setInitialAuthCheckComplete(true);
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        console.log('Auth state change:', event, session ? 'session exists' : 'no session');
        
        if (event === 'SIGNED_OUT') {
          cleanupAuthState();
          setSession(null);
          setUser(null);
          setUserRole(null);
          setLoading(false);
          setInitialAuthCheckComplete(true);
        } else {
          // Synchronous state updates only
          setSession(session);
          setUser(session?.user ?? null);
          
          // Skip role fetching for employees
          if (session?.user?.user_metadata?.role === 'employee') {
            setUserRole(null);
            setLoading(false);
            setInitialAuthCheckComplete(true);
            return;
          }
          
          // Defer async operations for admin users
          if (session?.user) {
            setTimeout(async () => {
              try {
                const role = await fetchUserRole(session.user.id);
                if (isMounted) {
                  setUserRole(role);
                }
              } catch (error) {
                console.error('Error fetching user role:', error);
                if (isMounted) {
                  // Clear session on error
                  cleanupAuthState();
                  setSession(null);
                  setUser(null);
                  setUserRole(null);
                }
              }
            }, 0);
          } else {
            setUserRole(null);
          }
          
          setLoading(false);
          setInitialAuthCheckComplete(true);
        }
      }
    );

    // Initialize auth
    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await forceSignOut(supabase);
      
      // Reset state
      setUser(null);
      setSession(null);
      setUserRole(null);
      setLoading(false);
      
      // Force page reload for clean state
      window.location.href = '/auth';
    } catch (error) {
      console.error('Sign out error:', error);
      // Force page reload anyway
      window.location.href = '/auth';
    }
  };

  const value = {
    user,
    session,
    loading: loading && !initialAuthCheckComplete,
    userRole,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}