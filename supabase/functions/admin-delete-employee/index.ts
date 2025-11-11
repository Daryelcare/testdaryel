import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get the authenticated user from the JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Verify the JWT token using the supabase admin client
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin using the database
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || userRole?.role !== 'admin') {
      console.error('Role check failed:', roleError, 'User role:', userRole?.role)
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { employeeId } = await req.json()

    if (!employeeId) {
      return new Response(
        JSON.stringify({ error: 'Missing employeeId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Deleting employee:', employeeId)

    // First, get the employee data to find their email
    const { data: employee, error: employeeFetchError } = await supabaseAdmin
      .from('employees')
      .select('id, email, name')
      .eq('id', employeeId)
      .single()

    if (employeeFetchError || !employee) {
      console.error('Error fetching employee:', employeeFetchError)
      return new Response(
        JSON.stringify({ error: 'Employee not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find the auth user by email
    let authUserId: string | null = null
    if (employee.email) {
      const { data: authUsers, error: authUserError } = await supabaseAdmin.auth.admin.listUsers()
      
      if (authUserError) {
        console.error('Error listing auth users:', authUserError)
      } else {
        const authUser = authUsers.users.find(u => u.email?.toLowerCase() === employee.email.toLowerCase())
        if (authUser) {
          authUserId = authUser.id
          console.log('Found auth user for employee:', authUserId)
        } else {
          console.warn('No auth user found for employee email:', employee.email)
        }
      }
    }

    // If we found an auth user, delete it
    if (authUserId) {
      // First, sign out all sessions for this user
      const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(authUserId, 'global')
      if (signOutError) {
        console.warn('Error signing out user sessions:', signOutError)
        // Continue even if this fails
      }

      // Hard delete the user from Supabase Auth
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
        authUserId,
        false // shouldSoftDelete = false for hard delete
      )

      if (authDeleteError) {
        console.error('Error deleting auth user:', authDeleteError)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to delete auth account: ' + authDeleteError.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Auth user deleted successfully:', authUserId)
    }

    // Finally, delete the employee record from the database
    // This will cascade delete related records due to foreign key constraints
    const { error: employeeDeleteError } = await supabaseAdmin
      .from('employees')
      .delete()
      .eq('id', employeeId)

    if (employeeDeleteError) {
      console.error('Error deleting employee record:', employeeDeleteError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Auth deleted but employee record deletion failed: ' + employeeDeleteError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Employee deleted successfully:', employeeId, employee.name)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Employee ${employee.name} deleted successfully` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in admin-delete-employee function:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
