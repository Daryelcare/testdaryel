import { ApplicationSettingsRedirect } from './ApplicationSettingsRedirect';

export function ApplicationEmergencySettings() {
  return (
    <ApplicationSettingsRedirect
      settingType="emergency"
      title="Emergency Contact Settings"
      description="Manage relationship types and 'How did you hear about us' options for the emergency contact step."
    />
  );
}