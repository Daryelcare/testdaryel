import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReferenceEmailRequest {
  applicationId: string;
  applicantName: string;
  applicantFirstName: string;
  applicantAddress: string;
  applicantPostcode: string;
  positionAppliedFor?: string;
  referenceEmail: string;
  referenceName: string;
  referenceCompany?: string;
  referenceAddress?: string;
  companyName?: string;
  referenceType: 'employer' | 'character';
  employmentDetails?: {
    startDate?: string;
    endDate?: string;
    company?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      applicationId,
      applicantName,
      applicantFirstName,
      applicantAddress,
      applicantPostcode,
      positionAppliedFor,
      referenceEmail,
      referenceName,
      referenceCompany,
      referenceAddress,
      companyName,
      referenceType,
      employmentDetails
    }: ReferenceEmailRequest = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get email settings from database
    const { data: emailSettings, error: settingsError } = await supabase.rpc('get_email_settings');
    if (settingsError) {
      console.error("Error fetching email settings:", settingsError);
      throw new Error("Failed to fetch email settings. Please configure email settings in the admin panel.");
    }

    if (!emailSettings?.sender_email || !emailSettings?.sender_name) {
      throw new Error("Email sender settings are not configured. Please set sender email and name in the admin panel.");
    }

    const senderEmail = emailSettings.sender_email;
    const senderName = emailSettings.sender_name;

    // Get company settings from database if not provided
    let finalCompanyName = companyName && companyName.trim().length > 0 ? companyName : null;
    let companyLogo = null;
    
    if (!finalCompanyName) {
      const { data: companySettings, error: companyError } = await supabase
        .from('company_settings')
        .select('name, logo')
        .single();
      
      if (companyError) {
        console.error("Error fetching company settings:", companyError);
        throw new Error("Failed to fetch company settings. Please configure your company name in Settings.");
      }
      
      if (!companySettings?.name || companySettings.name.trim().length === 0) {
        throw new Error("Company name is not configured. Please set your company name in Settings → Company Settings.");
      }
      
      finalCompanyName = companySettings.name;
      companyLogo = companySettings.logo;
    } else {
      // If company name was provided, still fetch the logo
      const { data: companySettings, error: companyError } = await supabase
        .from('company_settings')
        .select('logo')
        .single();
      
      if (!companyError) {
        companyLogo = companySettings.logo;
      }
    }

    // Derive site origin from request for building public URL
    const siteOrigin = req.headers.get("origin") || `${new URL(req.url).protocol}//${new URL(req.url).host}`;
    const referenceToken = crypto.randomUUID();
    
    if (!positionAppliedFor || positionAppliedFor.trim().length === 0) {
      throw new Error("Position applied for is not specified. Please ensure the applicant has filled in the position field.");
    }
    
    const roleTitle = positionAppliedFor.trim();
    const referenceLink = `${siteOrigin}/reference?token=${referenceToken}`;

    console.log("Sending reference email to:", referenceEmail, "for applicant:", applicantName);

    // Generate email content based on reference type
    let emailSubject: string;
    let emailContent: string;

    if (referenceType === 'employer') {
      emailSubject = `Request for Employer Reference for ${applicantName}`;
      emailContent = `
        <p style="margin:0 0 16px 0;">Dear ${referenceName},</p>
        <p style="margin:0 0 16px 0;">I hope this message finds you well.</p>
        <p style="margin:0 0 16px 0;">
          ${applicantName} has applied for the position of ${roleTitle} at ${finalCompanyName}, and listed you as a previous employer. 
          As part of our recruitment process, we would appreciate it if you could provide an employment reference regarding 
          ${applicantFirstName}'s time at ${employmentDetails?.company || referenceCompany}${employmentDetails?.startDate && employmentDetails?.endDate ? `, from ${employmentDetails.startDate} to ${employmentDetails.endDate}` : ''}.
        </p>
      `;
    } else {
      emailSubject = `Request for Character Reference for ${applicantName}`;
      emailContent = `
        <p style="margin:0 0 16px 0;">Dear ${referenceName},</p>
        <p style="margin:0 0 16px 0;">I hope this message finds you well.</p>
        <p style="margin:0 0 16px 0;">
          ${applicantName} has applied for the position of ${roleTitle} at ${finalCompanyName} and has listed you as a character reference. 
          We would appreciate it if you could provide your perspective on ${applicantFirstName}'s personal qualities, integrity, reliability, and overall character.
        </p>
      `;
    }

    const emailHtml = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${emailSubject}</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;margin:0;padding:0}
      .container{max-width:640px;margin:0 auto;background:#fff}
      .header{padding:24px 32px;border-bottom:1px solid #e5e7eb;text-align:center}
      .logo{max-width:120px;height:auto;display:inline-block}
      .content{padding:32px}
      .btn{display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600}
      .footer{background:#f3f4f6;padding:20px;text-align:center;color:#6b7280;font-size:12px}
      @media only screen and (max-width:600px){.header{padding:16px}.logo{max-width:100px}}
    </style>
  </head>
  <body>
    <div class="container">
      ${companyLogo ? `<div class="header"><img src="${companyLogo}" alt="${finalCompanyName}" class="logo" /></div>` : ''}
      <div class="content">
        ${emailContent}
        <p style="margin:0 0 16px 0;">To provide your reference, please click the link below and complete the short form:</p>
        <p style="margin:0 0 24px 0;">
          <a href="${referenceLink}" class="btn">👉 Provide Reference</a>
        </p>
        <p style="margin:0 0 16px 0;">Your feedback will be treated with confidentiality and will play a valuable role in helping us make an informed hiring decision.</p>
        <p style="margin:0 0 16px 0;">If you have any questions or prefer to speak with us directly, feel free to contact me at your convenience.</p>
        <p style="margin:0 0 8px 0; color:#6b7280; font-size:12px;">
          If the button does not work, copy and paste this URL into your browser:
        </p>
        <p style="word-break:break-all; color:#374151; font-size:12px;">${referenceLink}</p>
        <p style="margin:24px 0 0 0;">Thank you very much for your time and assistance.</p>
        <p style="margin:16px 0 0 0;">Best regards,<br/>${senderName}<br/>HR Team<br/>${finalCompanyName}</p>
      </div>
      <div class="footer">
        <p style="margin:0;">This link is unique to you. Please do not share it.</p>
      </div>
    </div>
  </body>
</html>
`;


    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (!apiKey) {
      throw new Error("BREVO_API_KEY environment variable is not set");
    }

    // Store reference request in database
    const { data: requestData, error: dbError } = await supabase
      .from('reference_requests')
      .insert({
        application_id: applicationId,
        applicant_name: applicantName,
        applicant_address: applicantAddress,
        applicant_postcode: applicantPostcode,
        position_applied_for: positionAppliedFor,
        reference_email: referenceEmail,
        reference_name: referenceName,
        reference_company: referenceCompany,
        reference_address: referenceAddress,
        company_name: finalCompanyName,
        reference_type: referenceType,
        token: referenceToken,
        reference_data: {
          company: referenceCompany,
          address: referenceAddress,
          employmentDetails: employmentDetails
        }
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    const payload = {
      sender: { name: finalCompanyName, email: senderEmail },
      replyTo: { name: finalCompanyName, email: senderEmail },
      to: [{ email: referenceEmail, name: referenceName }],
      subject: emailSubject,
      htmlContent: emailHtml,
    };

    const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Brevo API error response:", errorText);
      throw new Error(`Brevo API error: ${emailResponse.status} - ${errorText}`);
    }

    const result = await emailResponse.json();

    console.log("Reference email sent successfully:", result);

    return new Response(JSON.stringify({ 
      success: true,
      provider: "brevo",
      messageId: result?.messageId ?? null,
      referenceLink,
      referenceToken
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-reference-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);