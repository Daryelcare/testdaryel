import { ApplicationSettingsRedirect } from './ApplicationSettingsRedirect';

export function ApplicationPersonalSettings() {
  return (
    <ApplicationSettingsRedirect
      settingType="personal"
      title="Personal Information Settings"
      description="Manage titles, boroughs, languages, English proficiency levels, DBS options, and personal care options."
    />
  );
}