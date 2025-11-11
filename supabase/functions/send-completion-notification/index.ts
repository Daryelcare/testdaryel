import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CompletionNotificationEmail {
  adminEmail: string;
  signerEmail?: string;
  documentTitle: string;
  signedDocumentUrl: string;
  allSignersNames: string[];
  adminName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      adminEmail, 
      signerEmail,
      documentTitle, 
      recipientName,
      recipientEmail
    } = await req.json();

    // Note: This function signature was changed - we no longer need all the email data
    // as the signing process automatically expires links and this is just for logging

    console.log("Completion notification logged for:", { documentTitle, recipientName, recipientEmail });

    // Just return success - no email sending needed as the link expires automatically
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Completion logged successfully" 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-completion-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);