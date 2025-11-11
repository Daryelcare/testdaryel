import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Leave automation function triggered');

    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Checking if annual leave reset is needed...');

    // Call the database function to check and perform reset if needed
    const { data, error } = await supabase.rpc('run_leave_annual_reset_if_needed');

    if (error) {
      console.error('Error running annual reset check:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const result = data as string;
    console.log('Annual reset check result:', result);

    let message = '';
    let resetPerformed = false;

    switch (result) {
      case 'reset_performed':
        message = 'Annual leave balance reset was performed successfully';
        resetPerformed = true;
        console.log('✅ Annual reset performed - employee leave balances have been reset');
        break;
      case 'no_reset_needed':
        message = 'No reset needed - not yet time for fiscal year reset';
        console.log('ℹ️ No reset needed at this time');
        break;
      case 'auto_reset_disabled':
        message = 'Auto reset is disabled in settings';
        console.log('⚠️ Auto reset is disabled in system settings');
        break;
      default:
        message = `Unknown result: ${result}`;
        console.log('⚠️ Unexpected result:', result);
    }

    // If a reset was performed, log additional details
    if (resetPerformed) {
      console.log('📊 Fetching reset statistics...');
      
      // Get count of active employees for reporting
      const { data: employeeCount, error: countError } = await supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      if (!countError && employeeCount) {
        console.log(`📈 Reset affected ${employeeCount} active employees`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        result: result,
        message: message,
        resetPerformed: resetPerformed,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Unexpected error in leave automation:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});