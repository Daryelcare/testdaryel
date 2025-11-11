
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ArchivalRequest {
  complianceTypeId?: string;
  year?: number;
  forceArchival?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting compliance data archival process...');
    
    const { complianceTypeId, year, forceArchival = false }: ArchivalRequest = 
      req.method === 'POST' ? await req.json() : {};

    let archivalEntries = [];
    let totalRecordsArchived = 0;
    let totalEntriesProcessed = 0;

    // Get compliance automation settings
    const { data: automationSettings } = await supabase
      .from('compliance_automation_settings')
      .select('auto_archive_completed')
      .single();

    if (!automationSettings?.auto_archive_completed && !forceArchival) {
      console.log('Auto-archival is disabled and not forced');
      return new Response(JSON.stringify({
        success: true,
        message: 'Auto-archival is disabled',
        recordsArchived: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get compliance types to process
    let complianceTypesQuery = supabase.from('compliance_types').select('id, name, frequency');
    if (complianceTypeId) {
      complianceTypesQuery = complianceTypesQuery.eq('id', complianceTypeId);
    }

    const { data: complianceTypes, error: typesError } = await complianceTypesQuery;
    if (typesError) throw typesError;

    // Get client compliance types to process
    let clientComplianceTypesQuery = supabase.from('client_compliance_types').select('id, name, frequency');
    if (complianceTypeId) {
      clientComplianceTypesQuery = clientComplianceTypesQuery.eq('id', complianceTypeId);
    }

    const { data: clientComplianceTypes, error: clientTypesError } = await clientComplianceTypesQuery;
    if (clientTypesError) throw clientTypesError;

    // Process each employee compliance type
    for (const type of complianceTypes) {
      console.log(`Processing archival for compliance type: ${type.name}`);

      // Determine years to archive based on frequency and retention period
      const currentYear = new Date().getFullYear();
      const retentionYears = 6; // Default retention period
      const yearsToCheck = year ? [year] : 
        Array.from({ length: 10 }, (_, i) => currentYear - retentionYears - i - 1);

      for (const archivalYear of yearsToCheck) {
        if (archivalYear >= currentYear - 1) continue; // Don't archive current or previous year

        console.log(`Checking archival readiness for ${type.name} - ${archivalYear}`);

        // Check if archival entry already exists
        const { data: existingEntry } = await supabase
          .from('compliance_data_retention')
          .select('*')
          .eq('compliance_type_id', type.id)
          .eq('year', archivalYear)
          .single();

        if (existingEntry && existingEntry.archival_status === 'archived') {
          console.log(`Already archived: ${type.name} - ${archivalYear}`);
          continue;
        }

        // Check if records are ready for archival
        const { data: readinessCheck } = await supabase
          .rpc('check_archival_readiness', {
            p_compliance_type_id: type.id,
            p_year: archivalYear
          });

        if (!readinessCheck && !forceArchival) {
          console.log(`Not ready for archival: ${type.name} - ${archivalYear}`);
          continue;
        }

        // Generate statistics before archival
        const { data: statistics } = await supabase
          .rpc('generate_compliance_statistics', {
            p_compliance_type_id: type.id,
            p_year: archivalYear
          });

        // Count records to be archived
        const { count: recordCount } = await supabase
          .from('compliance_period_records')
          .select('*', { count: 'exact', head: true })
          .eq('compliance_type_id', type.id)
          .gte('created_at', `${archivalYear}-01-01`)
          .lt('created_at', `${archivalYear + 1}-01-01`);

        if (recordCount === 0) {
          console.log(`No records to archive for ${type.name} - ${archivalYear}`);
          continue;
        }

        // Calculate archive dates (pass frequency explicitly to match function signature)
        const { data: archiveDates, error: archiveDatesError } = await supabase
          .rpc('calculate_archive_dates', {
            frequency: type.frequency,
            base_year: archivalYear
          });

        if (archiveDatesError) {
          console.error('Error calculating archive dates:', archiveDatesError);
        }

        const archiveData = {
          compliance_type_id: type.id,
          year: archivalYear,
          period_type: type.frequency,
          period_identifier: `${archivalYear}`,
          data_summary: statistics || {},
          completion_statistics: statistics || {},
          archive_due_date: archiveDates?.[0]?.archive_due_date,
          download_available_date: archiveDates?.[0]?.download_available_date,
          archival_status: 'processing',
          archival_started_at: new Date().toISOString(),
          total_records_archived: recordCount || 0,
          retention_policy_years: retentionYears,
          archival_notes: `Auto-archived on ${new Date().toISOString()}`
        };

        // Create or update archival entry
        if (existingEntry) {
          const { error: updateError } = await supabase
            .from('compliance_data_retention')
            .update({
              ...archiveData,
              archival_completed_at: new Date().toISOString(),
              archival_status: 'archived'
            })
            .eq('id', existingEntry.id);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('compliance_data_retention')
            .insert({
              ...archiveData,
              archival_completed_at: new Date().toISOString(),
              archival_status: 'archived'
            });

          if (insertError) throw insertError;
        }

        archivalEntries.push({
          complianceType: type.name,
          year: archivalYear,
          recordsArchived: recordCount || 0,
          statistics: statistics || {}
        });

        totalRecordsArchived += recordCount || 0;
        totalEntriesProcessed += 1;

        console.log(`Archived ${recordCount} records for ${type.name} - ${archivalYear}`);
      }
    }

    // Process each client compliance type
    for (const type of clientComplianceTypes) {
      console.log(`Processing archival for client compliance type: ${type.name}`);

      const currentYear = new Date().getFullYear();
      const retentionYears = 6;
      const yearsToCheck = year ? [year] : 
        Array.from({ length: 10 }, (_, i) => currentYear - retentionYears - i - 1);

      for (const archivalYear of yearsToCheck) {
        if (archivalYear >= currentYear - 1) continue;

        console.log(`Checking archival readiness for client ${type.name} - ${archivalYear}`);

        const { data: existingEntry } = await supabase
          .from('compliance_data_retention')
          .select('*')
          .eq('compliance_type_id', type.id)
          .eq('year', archivalYear)
          .single();

        if (existingEntry && existingEntry.archival_status === 'archived') {
          console.log(`Already archived: client ${type.name} - ${archivalYear}`);
          continue;
        }

        const { data: readinessCheck } = await supabase
          .rpc('check_client_archival_readiness', {
            p_compliance_type_id: type.id,
            p_year: archivalYear
          });

        if (!readinessCheck && !forceArchival) {
          console.log(`Not ready for archival: client ${type.name} - ${archivalYear}`);
          continue;
        }

        const { data: statistics } = await supabase
          .rpc('generate_client_compliance_statistics', {
            p_compliance_type_id: type.id,
            p_year: archivalYear
          });

        const { count: recordCount } = await supabase
          .from('client_compliance_period_records')
          .select('*', { count: 'exact', head: true })
          .eq('client_compliance_type_id', type.id)
          .gte('created_at', `${archivalYear}-01-01`)
          .lt('created_at', `${archivalYear + 1}-01-01`);

        if (recordCount === 0) {
          console.log(`No records to archive for client ${type.name} - ${archivalYear}`);
          continue;
        }

        const { data: archiveDates, error: archiveDatesError } = await supabase
          .rpc('calculate_archive_dates', {
            frequency: type.frequency,
            base_year: archivalYear
          });

        if (archiveDatesError) {
          console.error('Error calculating archive dates:', archiveDatesError);
        }

        const archiveData = {
          compliance_type_id: type.id,
          year: archivalYear,
          period_type: type.frequency,
          period_identifier: `${archivalYear}`,
          data_summary: statistics || {},
          completion_statistics: statistics || {},
          archive_due_date: archiveDates?.[0]?.archive_due_date,
          download_available_date: archiveDates?.[0]?.download_available_date,
          archival_status: 'processing',
          archival_started_at: new Date().toISOString(),
          total_records_archived: recordCount || 0,
          retention_policy_years: retentionYears,
          archival_notes: `Auto-archived client compliance on ${new Date().toISOString()}`
        };

        if (existingEntry) {
          const { error: updateError } = await supabase
            .from('compliance_data_retention')
            .update({
              ...archiveData,
              archival_completed_at: new Date().toISOString(),
              archival_status: 'archived'
            })
            .eq('id', existingEntry.id);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('compliance_data_retention')
            .insert({
              ...archiveData,
              archival_completed_at: new Date().toISOString(),
              archival_status: 'archived'
            });

          if (insertError) throw insertError;
        }

        archivalEntries.push({
          complianceType: `Client: ${type.name}`,
          year: archivalYear,
          recordsArchived: recordCount || 0,
          statistics: statistics || {}
        });

        totalRecordsArchived += recordCount || 0;
        totalEntriesProcessed += 1;

        console.log(`Archived ${recordCount} client records for ${type.name} - ${archivalYear}`);
      }
    }

    const response = {
      success: true,
      entriesProcessed: totalEntriesProcessed,
      recordsArchived: totalRecordsArchived,
      archivalEntries: archivalEntries,
      processedAt: new Date().toISOString(),
      message: `Processed ${totalEntriesProcessed} archival entries, archived ${totalRecordsArchived} compliance records`
    };

    console.log('Compliance data archival completed:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in compliance data archival:', error);
    
    // Update any processing entries to failed status
    await supabase
      .from('compliance_data_retention')
      .update({ 
        archival_status: 'failed',
        archival_notes: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
      .eq('archival_status', 'processing');

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
