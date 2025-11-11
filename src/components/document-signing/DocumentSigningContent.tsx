import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Send, 
  CheckCircle, 
  Plus, 
  Upload,
  Users,
  Clock,
  TrendingUp,
  ArrowRight,
  Zap,
  Shield,
  Globe
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TemplateManager } from "./TemplateManager";
import { SigningRequestManager } from "./SigningRequestManager";
import { CompletedDocuments } from "./CompletedDocuments";

export function DocumentSigningContent() {
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch dashboard data
  const { data: dashboardStats } = useQuery({
    queryKey: ["document-signing-stats"],
    queryFn: async () => {
      const [templatesRes, requestsRes, completedRes] = await Promise.all([
        supabase.from("document_templates").select("id", { count: 'exact' }),
        supabase.from("signing_requests").select("id, status", { count: 'exact' }),
        supabase.from("signed_documents").select("id", { count: 'exact' })
      ]);

      const pendingRequests = requestsRes.data?.filter(r => r.status === 'sent').length || 0;
      const completionRate = requestsRes.count ? Math.round((completedRes.count || 0) / requestsRes.count * 100) : 0;

      return {
        templates: templatesRes.count || 0,
        totalRequests: requestsRes.count || 0,
        pendingRequests,
        completedDocuments: completedRes.count || 0,
        completionRate
      };
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto p-6 space-y-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 rounded-3xl" />
          <div className="relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-3xl p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex-1 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-xl">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                      Digital Signatures
                    </Badge>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Document Signing Hub
                  </h1>
                  <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
                    Streamline your document workflow with secure digital signatures. 
                    Create templates, send for signing, and manage completions - all in one place.
                  </p>
                </div>
                
              </div>
              
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex justify-center">
            <TabsList className="grid grid-cols-4 w-full max-w-2xl h-14 bg-muted/50 backdrop-blur-sm border border-border/50 rounded-2xl p-2">
              <TabsTrigger 
                value="overview" 
                className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-xl transition-all duration-200"
              >
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger 
                value="templates" 
                className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-xl transition-all duration-200"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Templates</span>
              </TabsTrigger>
              <TabsTrigger 
                value="requests" 
                className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-xl transition-all duration-200"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Requests</span>
              </TabsTrigger>
              <TabsTrigger 
                value="completed" 
                className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-xl transition-all duration-200"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Completed</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20 hover:shadow-lg transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{dashboardStats?.templates || 0}</p>
                      <p className="text-sm text-muted-foreground">Templates</p>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-xl">
                      <Upload className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20 hover:shadow-lg transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{dashboardStats?.totalRequests || 0}</p>
                      <p className="text-sm text-muted-foreground">Total Requests</p>
                    </div>
                    <div className="p-3 bg-blue-500/10 rounded-xl">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20 hover:shadow-lg transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{dashboardStats?.pendingRequests || 0}</p>
                      <p className="text-sm text-muted-foreground">Pending</p>
                    </div>
                    <div className="p-3 bg-amber-500/10 rounded-xl">
                      <Clock className="w-6 h-6 text-amber-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20 hover:shadow-lg transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{dashboardStats?.completionRate || 0}%</p>
                      <p className="text-sm text-muted-foreground">Success Rate</p>
                    </div>
                    <div className="p-3 bg-green-500/10 rounded-xl">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Workflow Steps */}
            <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  How It Works
                </CardTitle>
                <CardDescription>
                  Simple steps to get your documents signed digitally
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col items-center text-center space-y-4 group">
                    <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl group-hover:from-primary/20 group-hover:to-primary/10 transition-all duration-200">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">1. Upload Template</h3>
                      <p className="text-muted-foreground">Upload your PDF or Word document and add signature fields</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center text-center space-y-4 group">
                    <div className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-2xl group-hover:from-blue-500/20 group-hover:to-blue-500/10 transition-all duration-200">
                      <Send className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">2. Send Request</h3>
                      <p className="text-muted-foreground">Add recipients and send signing requests via email</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center text-center space-y-4 group">
                    <div className="p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-2xl group-hover:from-green-500/20 group-hover:to-green-500/10 transition-all duration-200">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">3. Get Signed</h3>
                      <p className="text-muted-foreground">Download completed documents with all signatures</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Features */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-green-600" />
                    Security Features
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-sm">End-to-end encryption</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-sm">Audit trail tracking</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-sm">Legal compliance</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-600" />
                    Global Access
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <span className="text-sm">Sign from anywhere</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <span className="text-sm">Mobile-friendly interface</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <span className="text-sm">Real-time notifications</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <TemplateManager />
          </TabsContent>

          <TabsContent value="requests" className="space-y-6">
            <SigningRequestManager />
          </TabsContent>

          <TabsContent value="completed" className="space-y-6">
            <CompletedDocuments />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}