import { UnifiedJobApplicationSettings } from "./UnifiedJobApplicationSettings";

export function ApplicationSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Job Application Settings</h2>
        <p className="text-muted-foreground">
          Configure all aspects of your job application process and forms in one unified interface.
        </p>
      </div>

      <UnifiedJobApplicationSettings />
    </div>
  );
}