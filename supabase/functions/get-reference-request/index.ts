import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const handler = async (req)=>{
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!token) {
      return new Response(JSON.stringify({
        error: 'Token is required'
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    // Get reference request by token
    const { data, error } = await supabase.from('reference_requests').select('*').eq('reference_token', token).single();
    if (error || !data) {
      return new Response(JSON.stringify({
        error: 'Invalid or expired token'
      }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    // Check if already expired or submitted
    if (data.is_expired || data.submitted_at) {
      return new Response(JSON.stringify({
        error: 'This reference link has already been used or has expired',
        expired: true
      }), {
        status: 410,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    // Check if expired by date
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      // Mark as expired
      await supabase.from('reference_requests').update({
        is_expired: true
      }).eq('id', data.id);
      return new Response(JSON.stringify({
        error: 'This reference link has expired',
        expired: true
      }), {
        status: 410,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      referenceRequest: data
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error("Error in get-reference-request function:", error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
};
serve(handler);
