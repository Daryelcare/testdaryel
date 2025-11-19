import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RequestBody {
  applicationId: string;
  applicantEmail: string;
  applicantName: string;
  requiredDocuments?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { applicationId, applicantEmail, applicantName, requiredDocuments = [] }: RequestBody = await req.json();

    console.log('Sending document upload link for application:', applicationId);

    // Generate secure token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Store token in database
    const { error: tokenError } = await supabase
      .from('document_upload_tokens')
      .insert({
        application_id: applicationId,
        token,
        applicant_email: applicantEmail,
        applicant_name: applicantName,
        required_documents: requiredDocuments,
        expires_at: expiresAt.toISOString()
      });

    if (tokenError) {
      console.error('Token creation error:', tokenError);
      throw tokenError;
    }

    // Generate upload link
    const uploadLink = `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/document-upload?token=${token}`;

    // Get company settings for email
    const { data: companyData } = await supabase
      .from('company_settings')
      .select('name, email')
      .single();

    const companyName = companyData?.name || 'Our Company';
    const fromEmail = companyData?.email || 'noreply@company.com';

    // Send email via Brevo
    const emailContent = {
      sender: {
        name: companyName,
        email: fromEmail
      },
      to: [{ email: applicantEmail, name: applicantName }],
      subject: 'Document Upload Request - Action Required',
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .documents { background-color: white; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Document Upload Request</h1>
            </div>
            <div class="content">
              <p>Dear ${applicantName},</p>
              
              <p>Thank you for your application. We need you to upload some documents to proceed with your application.</p>
              
              ${requiredDocuments.length > 0 ? `
                <div class="documents">
                  <strong>📄 Required Documents:</strong>
                  <ul>
                    ${requiredDocuments.map(doc => `<li>${doc}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              
              <p><strong>What's included in our upload system:</strong></p>
              <ul>
                <li>📸 <strong>Camera feature</strong> - Take photos directly from your device</li>
                <li>🔍 <strong>Document detection</strong> - Automatic edge detection and quality checking</li>
                <li>📤 <strong>File upload</strong> - Upload existing files from your device</li>
                <li>✓ <strong>Real-time quality feedback</strong> - Ensures clear, readable documents</li>
              </ul>
              
              <p style="text-align: center;">
                <a href="${uploadLink}" class="button">Upload Documents Now</a>
              </p>
              
              <p><strong>Important:</strong></p>
              <ul>
                <li>This link will expire in 7 days</li>
                <li>All documents should be clear and legible</li>
                <li>Maximum file size: 10MB per document</li>
                <li>Accepted formats: JPEG, PNG, PDF</li>
              </ul>
              
              <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
              
              <p>Best regards,<br>${companyName}</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply directly to this message.</p>
              <p>If you did not apply for a position, please disregard this email.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY!,
        'content-type': 'application/json'
      },
      body: JSON.stringify(emailContent)
    });

    if (!brevoResponse.ok) {
      const errorText = await brevoResponse.text();
      console.error('Brevo API error:', errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    console.log('Document upload email sent successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Document upload link sent successfully',
        uploadLink
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in send-document-upload-link:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
