import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ComplianceType {
  id: string;
  name: string;
  frequency: string;
}

interface ClientComplianceType {
  id: string;
  name: string;
  frequency: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting compliance automation process...');

    // Get current date info
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentQuarter = Math.ceil(currentMonth / 3);
    const currentWeek = getWeekNumber(now);

    // Fetch all employee compliance types
    const { data: complianceTypes, error: typesError } = await supabase
      .from('compliance_types')
      .select('id, name, frequency');

    if (typesError) {
      console.error('Error fetching compliance types:', typesError);
      throw typesError;
    }

    // Fetch all client compliance types
    const { data: clientComplianceTypes, error: clientTypesError } = await supabase
      .from('client_compliance_types')
      .select('id, name, frequency');

    if (clientTypesError) {
      console.error('Error fetching client compliance types:', clientTypesError);
      throw clientTypesError;
    }

    let totalRecordsCreated = 0;
    let clientRecordsCreated = 0;
    let statusUpdates = 0;
    let clientStatusUpdates = 0;

    // Process each employee compliance type
    for (const type of complianceTypes as ComplianceType[]) {
      console.log(`Processing employee compliance type: ${type.name} (${type.frequency})`);
      
      let periodIdentifier = '';
      let shouldGenerate = false;

      // Determine if we should generate records for this period
      switch (type.frequency) {
        case 'annual':
          periodIdentifier = currentYear.toString();
          shouldGenerate = currentMonth === 1; // Generate on January 1st
          break;
        case 'quarterly':
          periodIdentifier = `${currentYear}-Q${currentQuarter}`;
          shouldGenerate = [1, 4, 7, 10].includes(currentMonth); // Quarter starts
          break;
        case 'monthly':
          periodIdentifier = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
          shouldGenerate = true; // Generate monthly
          break;
        case 'bi-annual':
          const half = currentMonth <= 6 ? 1 : 2;
          periodIdentifier = `${currentYear}-H${half}`;
          shouldGenerate = currentMonth === 1 || currentMonth === 7; // Jan 1st or July 1st
          break;
        case 'weekly':
          periodIdentifier = `${currentYear}-W${currentWeek.toString().padStart(2, '0')}`;
          shouldGenerate = true; // Generate weekly
          break;
        default:
          console.log(`Unknown frequency: ${type.frequency}`);
          continue;
      }

      if (shouldGenerate) {
        console.log(`Generating employee records for ${type.name} - ${periodIdentifier}`);
        
        // Call the database function to generate records
        const { data: result, error: generateError } = await supabase
          .rpc('generate_compliance_records_for_period', {
            p_compliance_type_id: type.id,
            p_period_identifier: periodIdentifier
          });

        if (generateError) {
          console.error(`Error generating employee records for ${type.name}:`, generateError);
        } else {
          const recordsCreated = result || 0;
          totalRecordsCreated += recordsCreated;
          console.log(`Created ${recordsCreated} employee records for ${type.name}`);
        }
      }
    }

    // Process each client compliance type
    for (const type of clientComplianceTypes as ClientComplianceType[]) {
      console.log(`Processing client compliance type: ${type.name} (${type.frequency})`);
      
      let periodIdentifier = '';
      let shouldGenerate = false;

      // Determine if we should generate records for this period
      switch (type.frequency) {
        case 'annual':
          periodIdentifier = currentYear.toString();
          shouldGenerate = currentMonth === 1; // Generate on January 1st
          break;
        case 'quarterly':
          periodIdentifier = `${currentYear}-Q${currentQuarter}`;
          shouldGenerate = [1, 4, 7, 10].includes(currentMonth); // Quarter starts
          break;
        case 'monthly':
          periodIdentifier = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
          shouldGenerate = true; // Generate monthly
          break;
        case 'bi-annual':
          const half2 = currentMonth <= 6 ? 1 : 2;
          periodIdentifier = `${currentYear}-H${half2}`;
          shouldGenerate = currentMonth === 1 || currentMonth === 7; // Jan 1st or July 1st
          break;
        case 'weekly':
          periodIdentifier = `${currentYear}-W${currentWeek.toString().padStart(2, '0')}`;
          shouldGenerate = true; // Generate weekly
          break;
        default:
          console.log(`Unknown client frequency: ${type.frequency}`);
          continue;
      }

      if (shouldGenerate) {
        console.log(`Generating client records for ${type.name} - ${periodIdentifier}`);
        
        // Call the database function to generate client records
        const { data: result, error: generateError } = await supabase
          .rpc('generate_client_compliance_records_for_period', {
            p_compliance_type_id: type.id,
            p_period_identifier: periodIdentifier
          });

        if (generateError) {
          console.error(`Error generating client records for ${type.name}:`, generateError);
        } else {
          const recordsCreated = result || 0;
          clientRecordsCreated += recordsCreated;
          console.log(`Created ${recordsCreated} client records for ${type.name}`);
        }
      }
    }

    // Update employee compliance statuses (check for overdue items)
    console.log('Updating employee compliance statuses...');
    const { data: updateResult, error: updateError } = await supabase
      .rpc('update_compliance_statuses');

    if (updateError) {
      console.error('Error updating employee compliance statuses:', updateError);
    } else {
      statusUpdates = updateResult || 0;
      console.log(`Updated ${statusUpdates} overdue employee records`);
    }

    // Update client compliance statuses (check for overdue items)
    console.log('Updating client compliance statuses...');
    const { data: clientUpdateResult, error: clientUpdateError } = await supabase
      .rpc('update_client_compliance_statuses');

    if (clientUpdateError) {
      console.error('Error updating client compliance statuses:', clientUpdateError);
    } else {
      clientStatusUpdates = clientUpdateResult || 0;
      console.log(`Updated ${clientStatusUpdates} overdue client records`);
    }

    const response = {
      success: true,
      employeeRecordsCreated: totalRecordsCreated,
      clientRecordsCreated: clientRecordsCreated,
      employeeStatusUpdates: statusUpdates,
      clientStatusUpdates: clientStatusUpdates,
      processedAt: now.toISOString(),
      message: `Processed ${complianceTypes.length} employee compliance types and ${clientComplianceTypes.length} client compliance types. Created ${totalRecordsCreated} employee records, ${clientRecordsCreated} client records. Updated ${statusUpdates} employee statuses, ${clientStatusUpdates} client statuses.`
    };

    console.log('Compliance automation completed:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in compliance automation:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}