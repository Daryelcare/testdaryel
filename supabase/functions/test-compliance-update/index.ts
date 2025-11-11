import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const { test_date } = await req.json();
    if (!test_date) {
      return new Response(JSON.stringify({
        error: 'test_date is required'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log(`Updating compliance statuses for test date: ${test_date}`);
    // Update employee compliance statuses
    const { data: employeeRecords, error: employeeUpdateError } = await supabase.rpc('update_compliance_statuses_with_date', {
      test_date
    });
    if (employeeUpdateError) {
      console.error('Error updating employee compliance:', employeeUpdateError);
      throw employeeUpdateError;
    }
    // Update client compliance statuses
    const { data: clientRecords, error: clientUpdateError } = await supabase.rpc('update_client_compliance_statuses_with_date', {
      test_date
    });
    if (clientUpdateError) {
      console.error('Error updating client compliance:', clientUpdateError);
      throw clientUpdateError;
    }
    console.log(`Updated ${employeeRecords || 0} employee records and ${clientRecords || 0} client records`);
    return new Response(JSON.stringify({
      success: true,
      employee_records_updated: employeeRecords || 0,
      client_records_updated: clientRecords || 0,
      test_date
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
