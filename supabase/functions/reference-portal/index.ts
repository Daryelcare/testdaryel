import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';
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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    if (req.method === "GET") {
      // Get reference request details by token
      const url = new URL(req.url);
      const token = url.searchParams.get('token');
      if (!token) {
        return new Response(JSON.stringify({
          error: "Token is required",
          valid: false
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      const { data: referenceRequest, error } = await supabase.from('reference_requests').select('*').eq('token', token).single();
      if (error || !referenceRequest) {
        return new Response(JSON.stringify({
          error: "Invalid or expired token",
          valid: false
        }), {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      // Check if token is expired
      const now = new Date();
      const expiresAt = new Date(referenceRequest.expires_at);
      if (now > expiresAt || referenceRequest.status === 'completed') {
        return new Response(JSON.stringify({
          error: "This reference link has expired or has already been completed",
          valid: false
        }), {
          status: 410,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      return new Response(JSON.stringify({
        valid: true,
        data: {
          applicant_name: referenceRequest.applicant_name,
          position_applied_for: referenceRequest.position_applied_for,
          company_name: referenceRequest.company_name,
          reference_name: referenceRequest.reference_name
        }
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    if (req.method === "POST") {
      // Submit reference form
      const { token, responses } = await req.json();
      if (!token || !responses) {
        return new Response(JSON.stringify({
          error: "Token and responses are required"
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      // Get and validate reference request
      const { data: referenceRequest, error: fetchError } = await supabase.from('reference_requests').select('*').eq('token', token).single();
      if (fetchError || !referenceRequest) {
        return new Response(JSON.stringify({
          error: "Invalid or expired token"
        }), {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      // Check if already completed or expired
      const now = new Date();
      const expiresAt = new Date(referenceRequest.expires_at);
      if (now > expiresAt || referenceRequest.status === 'completed') {
        return new Response(JSON.stringify({
          error: "This reference link has expired or has already been completed"
        }), {
          status: 410,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      // Update reference request with responses and mark as completed
      const { error: updateError } = await supabase.from('reference_requests').update({
        responses: responses,
        status: 'completed',
        submitted_at: new Date().toISOString()
      }).eq('id', referenceRequest.id);
      if (updateError) {
        console.error("Error updating reference request:", updateError);
        return new Response(JSON.stringify({
          error: "Failed to submit reference"
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      console.log("Reference submitted successfully for:", referenceRequest.applicant_name);
      return new Response(JSON.stringify({
        success: true,
        message: "Reference submitted successfully"
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    return new Response(JSON.stringify({
      error: "Method not allowed"
    }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error("Error in reference-portal function:", error);
    return new Response(JSON.stringify({
      error: error.message,
      success: false
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
