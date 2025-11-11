import { useParams, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ClientCompliancePeriodView } from "@/components/clients/ClientCompliancePeriodView";
import { ArrowLeft, Calendar, CheckCircle, Clock, AlertTriangle, Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";

interface ComplianceType {
  id: string;
  name: string;
  description: string;
  frequency: string;
}

interface ComplianceStats {
  totalClients: number;
  completedClients: number;
  dueClients: number;
  overdueClients: number;
  pendingClients: number;
  completionRate: number;
}

interface BranchStats {
  branchName: string;
  completionRate: number;
  totalClients: number;
  completedClients: number;
}

export default function ClientCompliance() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getAccessibleBranches, isAdmin } = usePermissions();
  
  const [stats, setStats] = useState<ComplianceStats>({
    totalClients: 0,
    completedClients: 0,
    dueClients: 0,
    overdueClients: 0,
    pendingClients: 0,
    completionRate: 0
  });
  const [branchStats, setBranchStats] = useState<BranchStats[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [clientTypeId, setClientTypeId] = useState<string | null>(null);
  
  const complianceType = location.state?.complianceType as ComplianceType;

  useEffect(() => {
    const resolveClientComplianceTypeId = async () => {
      try {
        console.log('Resolving client compliance type for:', complianceType.name);
        
        const { data: existing, error } = await supabase
          .from('client_compliance_types')
          .select('id')
          .eq('name', complianceType.name)
          .maybeSingle();
        
        if (error) throw error;
        
        if (existing) {
          console.log('Found existing client compliance type:', existing.id);
          setClientTypeId(existing.id);
          return;
        }
        
        console.log('Creating new client compliance type');
        const { data: created, error: createError } = await supabase
          .from('client_compliance_types')
          .insert({
            name: complianceType.name,
            frequency: complianceType.frequency,
            description: complianceType.description,
          })
          .select('id')
          .maybeSingle();
          
        if (createError) throw createError;
        
        console.log('Created client compliance type:', created?.id);
        setClientTypeId(created?.id ?? null);
      } catch (e) {
        console.error('Failed to resolve client compliance type ID:', e);
        setClientTypeId(null);
        toast({
          title: 'Setup required',
          description: 'Client compliance type is not configured. Please add it in Settings.',
          variant: 'destructive',
        });
      }
    };

    if (id && complianceType) {
      resolveClientComplianceTypeId();
    }
  }, [id, complianceType, toast]);

  useEffect(() => {
    if (clientTypeId) {
      fetchComplianceStats();
    }
  }, [clientTypeId]);

  const getCurrentPeriod = () => {
    const now = new Date();
    switch (complianceType.frequency.toLowerCase()) {
      case 'quarterly':
        return `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
      case 'annual':
        return now.getFullYear().toString();
      case 'monthly':
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      default:
        return now.getFullYear().toString();
    }
  };

  const fetchComplianceStats = async () => {
    try {
      setLoading(true);
      const period = getCurrentPeriod();
      setCurrentPeriod(period);

      // Get accessible branches for the current user
      const accessibleBranches = getAccessibleBranches();
      
      // Build the query with branch filtering for non-admin users
      let clientsQuery = supabase
        .from('clients')
        .select(`
          *,
          branches (
            name
          )
        `)
        .eq('is_active', true);

      // Apply branch filtering for non-admin users
      if (!isAdmin && accessibleBranches.length > 0) {
        clientsQuery = clientsQuery.in('branch_id', accessibleBranches);
      }

      const { data: clients, error: clientsError } = await clientsQuery.order('name');

      if (clientsError) throw clientsError;

      // Get client IDs for accessible clients only
      const accessibleClientIds = clients?.map(client => client.id) || [];

      // Fetch compliance records for current period - only for accessible clients
      const { data: records, error: recordsError } = await supabase
        .from('client_compliance_period_records')
        .select('*')
        .eq('client_compliance_type_id', clientTypeId as string)
        .eq('period_identifier', period)
        .in('client_id', accessibleClientIds);

      if (recordsError) throw recordsError;

      // Calculate overall stats - based on accessible clients only
      const totalClients = clients?.length || 0;
      const completedRecords = records?.filter(r => r.status === 'completed') || [];
      
      // Filter out empty auto-generated records from pending (same as employee compliance)
      const pendingRecords = records?.filter(r => {
        const isEmptyAutoGeneratedRecord = r.status === 'pending' && 
          (!r.completion_date || r.completion_date === '') &&
          (!r.notes || r.notes === '');
        
        // Only count as pending if it's NOT an empty auto-generated record
        return r.status === 'pending' && !isEmptyAutoGeneratedRecord;
      }) || [];
      
      const overdueRecords = records?.filter(r => r.status === 'overdue') || [];
      
      const completedClients = completedRecords.length;
      const pendingClients = pendingRecords.length;
      const overdueClients = overdueRecords.length;
      const dueClients = totalClients - completedClients;
      const completionRate = totalClients > 0 ? (completedClients / totalClients) * 100 : 0;

      setStats({
        totalClients,
        completedClients,
        dueClients,
        overdueClients,
        pendingClients,
        completionRate
      });

      // Calculate branch stats - only for accessible branches
      const branchMap = new Map<string, { total: number; completed: number; name: string }>();
      
      clients?.forEach(client => {
        // Only include clients from accessible branches
        if (isAdmin || accessibleBranches.length === 0 || accessibleBranches.includes(client.branch_id || '')) {
          const branchName = client.branches?.name || 'Unassigned';
          if (!branchMap.has(client.branch_id || 'unassigned')) {
            branchMap.set(client.branch_id || 'unassigned', {
              total: 0,
              completed: 0,
              name: branchName
            });
          }
          const branch = branchMap.get(client.branch_id || 'unassigned')!;
          branch.total++;

          const clientRecord = records?.find(r => r.client_id === client.id);
          if (clientRecord?.status === 'completed') {
            branch.completed++;
          }
        }
      });

      const branchStatsArray: BranchStats[] = Array.from(branchMap.entries()).map(([_, data]) => ({
        branchName: data.name,
        completionRate: data.total > 0 ? (data.completed / data.total) * 100 : 0,
        totalClients: data.total,
        completedClients: data.completed
      }));

      setBranchStats(branchStatsArray);
    } catch (error) {
      console.error('Error fetching compliance stats:', error);
      toast({
        title: "Error loading data",
        description: "Could not fetch compliance statistics.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!id || !complianceType) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/compliance')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Compliance
          </Button>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-foreground mb-4">Compliance Type Not Found</h1>
            <p className="text-muted-foreground">The requested compliance type could not be found.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted rounded-xl"></div>
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/compliance')}
            className="p-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-primary" />
              <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                  {complianceType.name}
                </h1>
                <p className="text-lg text-muted-foreground mt-1">{complianceType.description}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Compliance Requirements Card */}
        <Card className="card-premium animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-primary" />
              Compliance Requirements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Frequency</h3>
                  <Badge className="capitalize">
                    {complianceType.frequency}
                  </Badge>
                </div>
                
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Current Period</h3>
                  <Badge variant="secondary">
                    {currentPeriod}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Client Compliance</h3>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.completedClients}/{stats.totalClients}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {stats.completionRate.toFixed(0)}% compliant
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Branch Completion</h3>
                  <div className="space-y-2">
                    {branchStats.map((branch, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{branch.branchName}</span>
                        <span className="text-sm font-medium">{branch.completionRate.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card 
            className={`card-premium border-success/20 bg-gradient-to-br from-success-soft to-card cursor-pointer transition-all duration-300 hover:shadow-glow ${
              selectedFilter === 'completed' ? 'ring-2 ring-success' : ''
            }`}
            onClick={() => setSelectedFilter(selectedFilter === 'completed' ? null : 'completed')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Compliant</p>
                  <p className="text-2xl font-bold text-success">{stats.completedClients}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`card-premium border-warning/20 bg-gradient-to-br from-warning-soft to-card cursor-pointer transition-all duration-300 hover:shadow-glow ${
              selectedFilter === 'due' ? 'ring-2 ring-warning' : ''
            }`}
            onClick={() => setSelectedFilter(selectedFilter === 'due' ? null : 'due')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Due</p>
                  <p className="text-2xl font-bold text-warning">{stats.dueClients}</p>
                </div>
                <Clock className="w-8 h-8 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`card-premium border-destructive/20 bg-gradient-to-br from-destructive-soft to-card cursor-pointer transition-all duration-300 hover:shadow-glow ${
              selectedFilter === 'overdue' ? 'ring-2 ring-destructive' : ''
            }`}
            onClick={() => setSelectedFilter(selectedFilter === 'overdue' ? null : 'overdue')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold text-destructive">{stats.overdueClients}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`card-premium border-muted/20 bg-gradient-to-br from-muted/5 to-card cursor-pointer transition-all duration-300 hover:shadow-glow ${
              selectedFilter === 'pending' ? 'ring-2 ring-border' : ''
            }`}
            onClick={() => setSelectedFilter(selectedFilter === 'pending' ? null : 'pending')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-muted-foreground">{stats.pendingClients}</p>
                </div>
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Period View */}
        <ClientCompliancePeriodView 
          complianceTypeId={clientTypeId || ''}
          complianceTypeName={complianceType.name}
          frequency={complianceType.frequency}
          selectedFilter={selectedFilter}
        />
      </div>
    </MainLayout>
  );
}