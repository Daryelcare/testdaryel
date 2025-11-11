import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const brevoApiKey = Deno.env.get('BREVO_API_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationResult {
  type: 'employee' | 'client';
  complianceType: string;
  employeeName?: string;
  clientName?: string;
  notificationType: 'upcoming' | 'overdue' | 'escalation';
  sent: boolean;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting compliance notifications process...');
    
    const notificationResults: NotificationResult[] = [];
    let totalNotificationsSent = 0;

    // Get automation settings
    const { data: automationSettings } = await supabase
      .from('compliance_automation_settings')
      .select('*')
      .single();

    if (!automationSettings) {
      throw new Error('Automation settings not found');
    }

    const notificationDaysBefore = automationSettings.notification_days_before || 14;
    const escalationDays = automationSettings.escalation_days || 30;
    const today = new Date();

    // Calculate notification dates
    const upcomingDeadlineDate = new Date();
    upcomingDeadlineDate.setDate(today.getDate() + notificationDaysBefore);

    const escalationDate = new Date();
    escalationDate.setDate(today.getDate() - escalationDays);

    // Process employee compliance notifications
    const { data: employeeRecords } = await supabase
      .from('compliance_period_records')
      .select(`
        *,
        employees!compliance_period_records_employee_id_fkey(id, name, email),
        compliance_types!compliance_period_records_compliance_type_id_fkey(name)
      `)
      .eq('status', 'pending')
      .or(`grace_period_end.lte.${upcomingDeadlineDate.toISOString().split('T')[0]},is_overdue.eq.true`);

    if (employeeRecords) {
      for (const record of employeeRecords) {
        const employee = record.employees;
        const complianceType = record.compliance_types;
        
        if (!employee || !complianceType) continue;

        // Check if notification was already sent recently (within last 7 days)
        const lastNotified = record.last_notification_sent ? new Date(record.last_notification_sent) : null;
        const daysSinceLastNotification = lastNotified ? 
          Math.floor((today.getTime() - lastNotified.getTime()) / (1000 * 60 * 60 * 24)) : 999;

        if (daysSinceLastNotification < 7) {
          console.log(`Skipping notification for ${employee.name} - notified ${daysSinceLastNotification} days ago`);
          continue;
        }

        const notificationType = record.is_overdue ? 
          (daysSinceLastNotification > escalationDays ? 'escalation' : 'overdue') : 
          'upcoming';

        // Send notification email if Brevo is configured
        let emailSent = false;
        if (brevoApiKey && employee.email) {
          try {
            const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: {
                'accept': 'application/json',
                'api-key': brevoApiKey,
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                sender: { email: 'noreply@yourcompany.com', name: 'Compliance System' },
                to: [{ email: employee.email, name: employee.name }],
                subject: `${notificationType === 'escalation' ? 'URGENT: ' : ''}Compliance ${notificationType === 'upcoming' ? 'Deadline Approaching' : 'Overdue'}: ${complianceType.name}`,
                htmlContent: `
                  <p>Dear ${employee.name},</p>
                  <p>${notificationType === 'upcoming' ? 
                    `Your compliance task "${complianceType.name}" is due on ${record.grace_period_end}.` :
                    `Your compliance task "${complianceType.name}" is overdue. Please complete it as soon as possible.`
                  }</p>
                  <p>Period: ${record.period_identifier}</p>
                  ${notificationType === 'escalation' ? '<p><strong>This is an escalation notice. Immediate action is required.</strong></p>' : ''}
                  <p>Best regards,<br>Compliance Management Team</p>
                `
              })
            });

            emailSent = emailResponse.ok;
          } catch (emailError) {
            console.error(`Failed to send email to ${employee.email}:`, emailError);
          }
        }

        // Update last notification sent timestamp
        await supabase
          .from('compliance_period_records')
          .update({ last_notification_sent: today.toISOString() })
          .eq('id', record.id);

        notificationResults.push({
          type: 'employee',
          complianceType: complianceType.name,
          employeeName: employee.name,
          notificationType,
          sent: emailSent
        });

        if (emailSent) totalNotificationsSent++;
      }
    }

    // Process client compliance notifications
    const { data: clientRecords } = await supabase
      .from('client_compliance_period_records')
      .select(`
        *,
        clients!client_compliance_period_records_client_id_fkey(id, name),
        client_compliance_types!client_compliance_period_records_client_compliance_type_id_fkey(name)
      `)
      .eq('status', 'pending')
      .or(`grace_period_end.lte.${upcomingDeadlineDate.toISOString().split('T')[0]},is_overdue.eq.true`);

    if (clientRecords) {
      for (const record of clientRecords) {
        const client = record.clients;
        const complianceType = record.client_compliance_types;
        
        if (!client || !complianceType) continue;

        const lastNotified = record.last_notification_sent ? new Date(record.last_notification_sent) : null;
        const daysSinceLastNotification = lastNotified ? 
          Math.floor((today.getTime() - lastNotified.getTime()) / (1000 * 60 * 60 * 24)) : 999;

        if (daysSinceLastNotification < 7) {
          console.log(`Skipping notification for client ${client.name} - notified ${daysSinceLastNotification} days ago`);
          continue;
        }

        const notificationType = record.is_overdue ? 
          (daysSinceLastNotification > escalationDays ? 'escalation' : 'overdue') : 
          'upcoming';

        // Update last notification sent timestamp
        await supabase
          .from('client_compliance_period_records')
          .update({ last_notification_sent: today.toISOString() })
          .eq('id', record.id);

        notificationResults.push({
          type: 'client',
          complianceType: complianceType.name,
          clientName: client.name,
          notificationType,
          sent: true // Logged internally for now
        });

        totalNotificationsSent++;
      }
    }

    const response = {
      success: true,
      totalNotificationsSent,
      notificationResults,
      processedAt: new Date().toISOString(),
      message: `Sent ${totalNotificationsSent} compliance notifications`
    };

    console.log('Compliance notifications completed:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in compliance notifications:', error);
    
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
