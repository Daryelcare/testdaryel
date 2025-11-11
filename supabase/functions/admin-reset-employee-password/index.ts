import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employeeId } = await req.json();

    if (!employeeId) {
      throw new Error('Employee ID is required');
    }

    // Create admin client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid authentication token');
    }

    // Check if user is admin
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !['admin', 'user'].includes(userRole?.role)) {
      throw new Error('Admin or user access required');
    }

    // Fetch employee to get email and name
    const { data: employeeRec, error: empFetchError } = await supabase
      .from('employees')
      .select('id, email, name')
      .eq('id', employeeId)
      .single();

    if (empFetchError || !employeeRec?.email) {
      throw new Error('Employee not found or missing email');
    }

    // Hash the default password "123456"
    const { data: hashedPassword, error: hashError } = await supabase
      .rpc('hash_password', { password: '123456' });

    if (hashError) {
      console.error('Password hashing error:', hashError);
      throw new Error('Failed to hash password');
    }

    // Update employee password and force password change
    const { error: updateError } = await supabase
      .from('employees')
      .update({
        password_hash: hashedPassword,
        must_change_password: true,
        failed_login_attempts: 0,
        locked_until: null
      })
      .eq('id', employeeId);

    if (updateError) {
      console.error('Employee update error:', updateError);
      throw new Error('Failed to reset employee password');
    }

    // Ensure Supabase Auth user exists and set the same password
    let authUserId: string | null = null;

    // listUsers API exists in supabase-js v2; get first page and match by email
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) {
      console.error('Auth admin listUsers error:', listErr);
    }
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === employeeRec.email.toLowerCase());

    if (existing) {
      authUserId = existing.id;
      const { error: updateAuthError } = await supabase.auth.admin.updateUserById(existing.id, {
        password: '123456',
        user_metadata: {
          role: 'employee',
          employee_id: employeeId,
          name: employeeRec.name,
        },
      });
      if (updateAuthError) {
        console.error('Auth admin update password error:', updateAuthError);
      }
    } else {
      const { data: created, error: createUserError } = await supabase.auth.admin.createUser({
        email: employeeRec.email,
        password: '123456',
        email_confirm: true,
        user_metadata: {
          role: 'employee',
          employee_id: employeeId,
          name: employeeRec.name,
        },
      });
      if (createUserError) {
        console.error('Auth admin createUser error:', createUserError);
      } else {
        authUserId = created.user?.id ?? null;
      }
    }

    // Link employee record to auth user if available
    if (authUserId) {
      const { error: linkError } = await supabase
        .from('employees')
        .update({ user_id: authUserId })
        .eq('id', employeeId);
      if (linkError) {
        console.warn('Failed to link employee to auth user:', linkError?.message);
      }
    }

    console.log(`Password reset for employee ${employeeId} by admin ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Employee password reset successfully. They will be prompted to change it on next login.' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in admin-reset-employee-password function:', error);
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'An unexpected error occurred' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});