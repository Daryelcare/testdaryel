import { supabase } from "@/integrations/supabase/client";

export async function createAdminUser(adminEmail?: string) {
  try {
    // Get admin email from settings or use provided email
    const { data: emailSettings } = await supabase.rpc('get_email_settings');
    const settings = emailSettings as any;
    const defaultAdminEmail = settings?.admin_email || 'admin@yourcompany.com';
    
    const { data, error } = await supabase.functions.invoke('create-admin-user', {
      body: {
        email: adminEmail || defaultAdminEmail,
        password: '111111'
      }
    });

    if (error) throw error;

    console.log('Admin user created:', data);
    return data;
  } catch (error) {
    console.error('Error creating admin user:', error);
    throw error;
  }
}