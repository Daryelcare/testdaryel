import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { statementId } = await req.json();

    if (!statementId) {
      throw new Error('Statement ID is required');
    }

    console.log('Generating PDF for statement:', statementId);

    // Fetch the statement data
    const { data: statement, error } = await supabase
      .from('care_worker_statements')
      .select(`
        *,
        employees:assigned_employee_id(name)
      `)
      .eq('id', statementId)
      .single();

    if (error || !statement) {
      console.error('Error fetching statement:', error);
      throw new Error('Statement not found');
    }

    console.log('Statement data retrieved:', statement);

    // Generate HTML content for the PDF
    const htmlContent = generateStatementHTML(statement);

    // For now, return the HTML content as a response
    // In a production environment, you would use a library like Puppeteer to generate actual PDF
    const response = new Response(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="care-worker-statement-${statement.id}.html"`,
        ...corsHeaders,
      },
    });

    return response;

  } catch (error) {
    console.error('Error generating PDF:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

function generateStatementHTML(statement: any): string {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Care Worker Statement - ${statement.care_worker_name}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            color: #333;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0;
            color: #2c3e50;
        }
        .section {
            margin-bottom: 25px;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        .section-title {
            background: #f8f9fa;
            padding: 10px;
            margin: -15px -15px 15px -15px;
            font-weight: bold;
            font-size: 16px;
            color: #2c3e50;
            border-bottom: 1px solid #ddd;
        }
        .field-group {
            display: flex;
            margin-bottom: 10px;
        }
        .field-label {
            font-weight: bold;
            width: 200px;
            flex-shrink: 0;
        }
        .field-value {
            flex: 1;
        }
        .statement-text {
            background: #f8f9fa;
            padding: 15px;
            border-left: 4px solid #007bff;
            margin: 10px 0;
            white-space: pre-wrap;
        }
        .signature-section {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-top: 20px;
        }
        .signature-image {
            max-width: 300px;
            max-height: 100px;
            border: 1px solid #ddd;
            padding: 10px;
        }
        .status-badge {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-approved { background: #d4edda; color: #155724; }
        .status-submitted { background: #d1ecf1; color: #0c5460; }
        .status-draft { background: #f8d7da; color: #721c24; }
        .status-rejected { background: #f5c6cb; color: #721c24; }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
        @media print {
            body { padding: 0; }
            .section { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Care Worker Statement</h1>
        <p>Generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}</p>
        <span class="status-badge status-${statement.status}">${statement.status}</span>
    </div>

    <div class="section">
        <div class="section-title">Care Worker & Client Information</div>
        <div class="field-group">
            <span class="field-label">Care Worker Name:</span>
            <span class="field-value">${statement.care_worker_name}</span>
        </div>
        <div class="field-group">
            <span class="field-label">Client Name:</span>
            <span class="field-value">${statement.client_name}</span>
        </div>
        <div class="field-group">
            <span class="field-label">Client Address:</span>
            <span class="field-value">${statement.client_address}</span>
        </div>
        <div class="field-group">
            <span class="field-label">Report Date:</span>
            <span class="field-value">${formatDate(statement.report_date)}</span>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Statement Details</div>
        ${statement.statement ? `
        <div class="statement-text">${statement.statement}</div>
        ` : '<p><em>No statement provided</em></p>'}
        
        <div class="field-group">
            <span class="field-label">Person Completing Report:</span>
            <span class="field-value">${statement.person_completing_report || 'Not specified'}</span>
        </div>
        <div class="field-group">
            <span class="field-label">Position:</span>
            <span class="field-value">${statement.position || 'Not specified'}</span>
        </div>
        <div class="field-group">
            <span class="field-label">Completion Date:</span>
            <span class="field-value">${statement.completion_date ? formatDate(statement.completion_date) : 'Not completed'}</span>
        </div>
    </div>

    ${statement.digital_signature ? `
    <div class="section">
        <div class="section-title">Digital Signature</div>
        <div class="signature-section">
            <img src="${statement.digital_signature}" alt="Digital Signature" class="signature-image" />
            <div>
                <p><strong>Signed by:</strong> ${statement.person_completing_report || 'Unknown'}</p>
                <p><strong>Date:</strong> ${statement.completion_date ? formatDate(statement.completion_date) : 'Unknown'}</p>
            </div>
        </div>
    </div>
    ` : ''}

    <div class="section">
        <div class="section-title">Record Information</div>
        <div class="field-group">
            <span class="field-label">Status:</span>
            <span class="field-value">
                <span class="status-badge status-${statement.status}">${statement.status}</span>
            </span>
        </div>
        <div class="field-group">
            <span class="field-label">Created:</span>
            <span class="field-value">${formatDate(statement.created_at)}</span>
        </div>
        <div class="field-group">
            <span class="field-label">Last Updated:</span>
            <span class="field-value">${formatDate(statement.updated_at)}</span>
        </div>
        ${statement.assigned_employee_id && statement.employees ? `
        <div class="field-group">
            <span class="field-label">Assigned to:</span>
            <span class="field-value">${statement.employees.name}</span>
        </div>
        ` : ''}
        ${statement.rejection_reason ? `
        <div class="field-group">
            <span class="field-label">Rejection Reason:</span>
            <span class="field-value" style="color: #d32f2f;">${statement.rejection_reason}</span>
        </div>
        ` : ''}
    </div>

    <div class="footer">
        <p>This document was automatically generated from the Care Worker Statement system.</p>
        <p>Statement ID: ${statement.id}</p>
    </div>
</body>
</html>
  `;
}