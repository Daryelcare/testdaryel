
import { supabase } from '@/integrations/supabase/client';

export async function initializeAdminUser() {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    // Get admin email from settings
    const { data: emailSettings } = await supabase.rpc('get_email_settings');
    const settings = emailSettings as any;
    const adminEmail = settings?.admin_email || 'admin@yourcompany.com';

    // Check if user is the configured admin
    if (user.email === adminEmail) {
      // Check if user already has admin role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      // If no admin role exists, create one
      if (!existingRole) {
        const { error } = await supabase
          .from('user_roles')
          .insert({
            user_id: user.id,
            role: 'admin'
          });

        if (error) {
          console.error('Error creating admin role:', error);
        } else {
          console.log(`Admin role created for ${adminEmail}`);
        }
      }
    }
  } catch (error) {
    console.error('Error initializing admin user:', error);
  }
}
