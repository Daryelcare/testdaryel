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
    const { token, formData } = await req.json();
    if (!token || !formData) {
      return new Response(JSON.stringify({
        error: 'Token and form data are required'
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
    const { data: referenceRequest, error: fetchError } = await supabase.from('reference_requests').select('*').eq('reference_token', token).single();
    if (fetchError || !referenceRequest) {
      return new Response(JSON.stringify({
        error: 'Invalid token'
      }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    // Check if already submitted or expired
    if (referenceRequest.submitted_at || referenceRequest.is_expired) {
      return new Response(JSON.stringify({
        error: 'This reference has already been submitted or has expired'
      }), {
        status: 410,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    // Update reference request with form data and mark as submitted
    const { error: updateError } = await supabase.from('reference_requests').update({
      form_data: formData,
      submitted_at: new Date().toISOString(),
      status: 'completed',
      is_expired: true // Expire the link after submission
    }).eq('id', referenceRequest.id);
    if (updateError) {
      console.error("Database update error:", updateError);
      throw new Error(`Failed to submit reference: ${updateError.message}`);
    }
    console.log("Reference submitted successfully for token:", token);
    return new Response(JSON.stringify({
      success: true,
      message: 'Reference submitted successfully'
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error("Error in submit-reference function:", error);
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
