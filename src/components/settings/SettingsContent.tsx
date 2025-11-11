
import { Calendar, FileText, Shield, Building2, Briefcase } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanySettings } from "./CompanySettings";
import { LeaveSettings } from "./LeaveSettings";
import { DocumentSettings } from "./DocumentSettings";
import { ComplianceSettings } from "./ComplianceSettings";
import { BranchSettings } from "./BranchSettings";
import { JobPositionSettings } from "./JobPositionSettings";
import { ApplicationSettings } from "./ApplicationSettings";

export function SettingsContent() {

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            System Settings
          </h1>
          <p className="text-lg text-muted-foreground">
            Configure your HR platform settings and preferences
          </p>
        </div>
      </div>

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Company
          </TabsTrigger>
          <TabsTrigger value="applications" className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Applications
          </TabsTrigger>
          <TabsTrigger value="branches" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Branches
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="leave" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Leave Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="space-y-6">
          <CompanySettings />
        </TabsContent>

        <TabsContent value="leave" className="space-y-6">
          <LeaveSettings />
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <DocumentSettings />
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <ComplianceSettings />
        </TabsContent>

        <TabsContent value="branches" className="space-y-6">
          <BranchSettings />
        </TabsContent>

        <TabsContent value="applications" className="space-y-6">
          <ApplicationSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
