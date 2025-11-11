import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { PDFDocument, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import fontkit from 'https://esm.sh/@pdf-lib/fontkit@1.1.1';
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
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    const { compliance_type_id, branch_ids, period_identifier } = await req.json();
    console.log('Bulk PDF generation started for:', {
      compliance_type_id,
      branch_ids,
      period_identifier
    });
    // Get company info
    const { data: companyData } = await supabaseClient.from('company_settings').select('*').single();
    const company = {
      name: companyData?.name || 'Company',
      logo: companyData?.logo
    };
    // Fetch compliance records with related data
    let query = supabaseClient.from('compliance_period_records').select(`
        *,
        employee:employees!compliance_period_records_employee_id_fkey(name, branch, branch_id),
        compliance_type:compliance_types(name, frequency)
      `).eq('compliance_type_id', compliance_type_id).eq('status', 'completed');
    if (branch_ids && branch_ids.length > 0) {
      query = query.in('employee.branch_id', branch_ids);
    }
    if (period_identifier) {
      query = query.eq('period_identifier', period_identifier);
    }
    const { data: records, error } = await query;
    if (error) {
      console.error('Error fetching compliance records:', error);
      throw error;
    }
    if (!records || records.length === 0) {
      return new Response(JSON.stringify({
        error: 'No completed compliance records found'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`Found ${records.length} compliance records`);
    // Group records by branch
    const recordsByBranch = records.reduce((acc, record)=>{
      const branchName = record.employee?.branch || 'Unknown Branch';
      if (!acc[branchName]) {
        acc[branchName] = [];
      }
      acc[branchName].push(record);
      return acc;
    }, {});
    // Create ZIP file structure
    const zipEntries = [];
    // Process each branch
    for (const [branchName, branchRecords] of Object.entries(recordsByBranch)){
      console.log(`Processing branch: ${branchName} with ${branchRecords.length} records`);
      for (const record of branchRecords){
        try {
          let pdfBytes;
          // Determine PDF generation method based on completion_method
          if (record.completion_method === 'questionnaire') {
            pdfBytes = await generateQuestionnairePdf(record, company, supabaseClient);
          } else {
            // For legacy methods, generate basic PDF
            pdfBytes = await generateBasicCompliancePdf(record, company);
          }
          const sanitizedEmployeeName = record.employee.name.replace(/[^a-zA-Z0-9\s-]/g, '');
          const sanitizedBranchName = branchName.replace(/[^a-zA-Z0-9\s-]/g, '');
          const fileName = `${sanitizedEmployeeName}_${record.period_identifier}_${record.compliance_type.name.replace(/[^a-zA-Z0-9\s-]/g, '')}.pdf`;
          const fullPath = `${sanitizedBranchName}/${fileName}`;
          zipEntries.push({
            name: fullPath,
            content: pdfBytes
          });
        } catch (error) {
          console.error(`Error generating PDF for record ${record.id}:`, error);
        // Continue with other records
        }
      }
    }
    // Create ZIP file
    const zipContent = await createZipFile(zipEntries);
    const complianceTypeName = records[0]?.compliance_type?.name || 'Compliance';
    const timestamp = new Date().toISOString().split('T')[0];
    const zipFileName = `${complianceTypeName.replace(/[^a-zA-Z0-9\s-]/g, '')}_${timestamp}.zip`;
    return new Response(zipContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"`
      }
    });
  } catch (error) {
    console.error('Error in bulk-compliance-pdf function:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
async function generateQuestionnairePdf(record, company, supabaseClient) {
  // Fetch questionnaire responses
  const { data: responses } = await supabaseClient.from('compliance_questionnaire_responses').select(`
      *,
      questionnaire:compliance_questionnaires(name),
      responses:compliance_responses(question_id, response_value),
      dynamic_entity_groups(*)
    `).eq('compliance_record_id', record.id).single();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // Load fonts
  const fontUrls = {
    regular: 'https://github.com/dejavu-fonts/dejavu-fonts/raw/master/ttf/DejaVuSans.ttf',
    bold: 'https://github.com/dejavu-fonts/dejavu-fonts/raw/master/ttf/DejaVuSans-Bold.ttf'
  };
  const regularBytes = await fetch(fontUrls.regular).then((r)=>r.arrayBuffer());
  const boldBytes = await fetch(fontUrls.bold).then((r)=>r.arrayBuffer());
  const font = await doc.embedFont(new Uint8Array(regularBytes), {
    subset: true
  });
  const boldFont = await doc.embedFont(new Uint8Array(boldBytes), {
    subset: true
  });
  let page = doc.addPage();
  const margin = 40;
  const lineHeight = 16;
  let y = page.getHeight() - margin;
  // Helper functions
  const drawText = (text, opts)=>{
    const f = opts?.bold ? boldFont : font;
    const size = opts?.size ?? 11;
    page.drawText(text || '', {
      x: margin,
      y: y - lineHeight,
      size,
      font: f,
      color: rgb(0, 0, 0)
    });
    y -= lineHeight;
  };
  const addSpacer = (amount = 8)=>{
    y -= amount;
  };
  // Header
  drawText(company.name || 'Company', {
    bold: true,
    size: 16
  });
  drawText(record.compliance_type.name, {
    bold: true,
    size: 14
  });
  addSpacer(10);
  // Employee info
  drawText(`Employee: ${record.employee.name}`, {
    bold: true
  });
  drawText(`Branch: ${record.employee.branch}`);
  drawText(`Period: ${record.period_identifier}`);
  drawText(`Completed: ${record.completion_date}`);
  addSpacer(15);
  // Process responses
  if (responses?.responses) {
    drawText('Responses:', {
      bold: true,
      size: 12
    });
    addSpacer(5);
    responses.responses.forEach((response)=>{
      let responseValue = '';
      if (response.response_value) {
        try {
          const parsedResponse = JSON.parse(response.response_value);
          responseValue = parsedResponse.value || response.response_value;
        } catch  {
          responseValue = response.response_value;
        }
      }
      if (responseValue) {
        drawText(`Q: ${response.question_id}`);
        drawText(`A: ${responseValue}`);
        addSpacer(5);
      }
      // Check if we need a new page
      if (y < margin + 50) {
        page = doc.addPage();
        y = page.getHeight() - margin;
      }
    });
  }
  return await doc.save();
}
async function generateBasicCompliancePdf(record, company) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // Load fonts
  const fontUrls = {
    regular: 'https://github.com/dejavu-fonts/dejavu-fonts/raw/master/ttf/DejaVuSans.ttf',
    bold: 'https://github.com/dejavu-fonts/dejavu-fonts/raw/master/ttf/DejaVuSans-Bold.ttf'
  };
  const regularBytes = await fetch(fontUrls.regular).then((r)=>r.arrayBuffer());
  const boldBytes = await fetch(fontUrls.bold).then((r)=>r.arrayBuffer());
  const font = await doc.embedFont(new Uint8Array(regularBytes), {
    subset: true
  });
  const boldFont = await doc.embedFont(new Uint8Array(boldBytes), {
    subset: true
  });
  const page = doc.addPage();
  const margin = 40;
  const lineHeight = 16;
  let y = page.getHeight() - margin;
  const drawText = (text, opts)=>{
    const f = opts?.bold ? boldFont : font;
    const size = opts?.size ?? 11;
    page.drawText(text || '', {
      x: margin,
      y: y - lineHeight,
      size,
      font: f,
      color: rgb(0, 0, 0)
    });
    y -= lineHeight;
  };
  // Header
  drawText(company.name || 'Company', {
    bold: true,
    size: 16
  });
  drawText(record.compliance_type.name, {
    bold: true,
    size: 14
  });
  y -= 20;
  // Content
  drawText(`Employee: ${record.employee.name}`, {
    bold: true
  });
  drawText(`Branch: ${record.employee.branch}`);
  drawText(`Period: ${record.period_identifier}`);
  drawText(`Completed: ${record.completion_date}`);
  y -= 15;
  if (record.notes) {
    drawText('Notes:', {
      bold: true
    });
    drawText(record.notes);
  }
  return await doc.save();
}
async function createZipFile(entries) {
  // Simple ZIP file creation
  // This is a basic implementation - for production, consider using a proper ZIP library
  const files = entries.map((entry)=>({
      name: entry.name,
      data: entry.content
    }));
  // Create a simple ZIP-like structure
  let totalSize = 0;
  const fileHeaders = files.map((file)=>{
    const header = new TextEncoder().encode(`${file.name}\n`);
    totalSize += header.length + file.data.length + 4; // 4 bytes for length prefix
    return {
      header,
      data: file.data
    };
  });
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const { header, data } of fileHeaders){
    // Write header length
    const lengthBytes = new Uint8Array(4);
    new DataView(lengthBytes.buffer).setUint32(0, header.length, true);
    result.set(lengthBytes, offset);
    offset += 4;
    // Write header
    result.set(header, offset);
    offset += header.length;
    // Write data
    result.set(data, offset);
    offset += data.length;
  }
  return result;
}
