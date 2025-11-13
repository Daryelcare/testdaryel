import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';
import { corsHeaders } from '../_shared/cors.ts';

interface UpdateEmailRequest {
  employeeId: string;
  newEmail: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin using admin client to bypass RLS
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'admin') {
      throw new Error('Unauthorized: Admin access required');
    }

    const { employeeId, newEmail }: UpdateEmailRequest = await req.json();

    if (!employeeId || !newEmail) {
      throw new Error('Missing required fields: employeeId and newEmail');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      throw new Error('Invalid email format');
    }

    console.log('Updating email for employee:', employeeId, 'to:', newEmail);

    // Get the employee record to find the associated auth user
    const { data: employee, error: employeeError } = await supabaseClient
      .from('employees')
      .select('id, email, name')
      .eq('id', employeeId)
      .single();

    if (employeeError || !employee) {
      throw new Error('Employee not found');
    }

    const oldEmail = employee.email;
    console.log('Old email:', oldEmail);

    // Find the auth user by the old email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      throw new Error('Failed to list users');
    }

    const authUser = users.find(u => 
      u.email === oldEmail || u.user_metadata?.employee_id === employeeId
    );

    if (!authUser) {
      console.log('No auth user found for this employee, updating database only');
      
      // Just update the database
      const { error: updateError } = await supabaseClient
        .from('employees')
        .update({ email: newEmail })
        .eq('id', employeeId);

      if (updateError) {
        throw updateError;
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email updated in database (no auth user found)',
          updated_auth: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found auth user:', authUser.id);

    // Check if new email is already in use by another user
    const existingUser = users.find(u => u.email === newEmail && u.id !== authUser.id);
    if (existingUser) {
      throw new Error('Email already in use by another user');
    }

    // Update the auth user's email
    const { data: updatedUser, error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      { email: newEmail }
    );

    if (updateAuthError) {
      console.error('Error updating auth email:', updateAuthError);
      throw new Error(`Failed to update auth email: ${updateAuthError.message}`);
    }

    console.log('Auth email updated successfully');

    // Update the employee record in the database
    const { error: updateDbError } = await supabaseClient
      .from('employees')
      .update({ email: newEmail })
      .eq('id', employeeId);

    if (updateDbError) {
      console.error('Error updating database email:', updateDbError);
      throw new Error(`Failed to update database email: ${updateDbError.message}`);
    }

    console.log('Database email updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email updated successfully in both auth and database',
        updated_auth: true,
        auth_user_id: authUser.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-update-employee-email:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
