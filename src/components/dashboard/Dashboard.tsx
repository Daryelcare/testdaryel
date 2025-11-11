import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRealTimeAnalytics } from "@/hooks/useRealTimeAnalytics";
import { MinimalistHeader } from "./redesign/MinimalistHeader";
import { MetricsOverview } from "./redesign/MetricsOverview";
import { BranchBreakdown } from "./redesign/BranchBreakdown";
import { ActivityTimeline } from "./redesign/ActivityTimeline";
import { DocumentHealthCarousel } from "./redesign/DocumentHealthCarousel";
import { DocumentCountryMap } from "./DocumentCountryMap";

interface DashboardData {
  totalEmployees: number;
  activeProjects: number;
  pendingTasks: number;
  completionRate: number;
  leavesByBranch?: Record<string, number>;
  complianceRates?: Record<string, number>;
  branches: Array<{ name: string; employeeCount: number; clientCount: number; color: string }>;
  recentActivity: Array<{ id: string; type: string; message: string; timestamp: string; user: string }>;
  leavesToday: Array<{
    employee_name: string;
    leave_type: string;
    start_date: string;
    end_date: string;
  }>;
  documentsExpiring: Array<{
    employee_name: string;
    document_type: string;
    expiry_date: string;
    status: 'valid' | 'expiring' | 'expired';
  }>;
  applicationStats: Record<string, number>;
  referenceStatus: Array<{
    application_id: string;
    applicant_name: string;
    references_pending: number;
    references_received: number;
    total_references: number;
  }>;
  branchHealth: Array<{
    branch_name: string;
    compliance_rate: number;
    document_validity_rate: number;
    leave_backlog: number;
    active_employees: number;
    overall_score: number;
  }>;
  documentStats: { total: number; valid: number; expiring: number; expired: number };
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { metrics, isConnected } = useRealTimeAnalytics();

  useEffect(() => {
    fetchDashboardData();
    
    // Debounced refetch to prevent multiple rapid updates
    let refetchTimeout: NodeJS.Timeout;
    const debouncedRefetch = () => {
      clearTimeout(refetchTimeout);
      refetchTimeout = setTimeout(() => {
        fetchDashboardData();
      }, 2000); // Wait 2 seconds before refetching
    };
    
    // Set up real-time subscriptions with debounced refetch
    const channel = supabase
      .channel('dashboard-activity')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, debouncedRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_tracker' }, debouncedRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compliance_period_records' }, debouncedRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, debouncedRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications' }, debouncedRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, debouncedRefetch)
      .subscribe();

    return () => {
      clearTimeout(refetchTimeout);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Get accessible branches for current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const { data: accessibleBranchData } = await supabase
        .rpc('get_user_accessible_branches', { user_id: user.id });
      
      // Extract branch_id values from the returned objects
      const branchIds = (accessibleBranchData || []).map((b: any) => b.branch_id);

      // Phase 1: Parallel Query Execution - Group independent queries with branch filtering
      const [
        employeesResult,
        clientsResult,
        leavesResult,
        complianceResult,
        branchesResult,
        documentsResult
      ] = await Promise.all([
        // Employees - filter by accessible branches
        supabase.from('employees')
          .select('*', { count: 'exact' })
          .in('branch_id', branchIds),
        
        // Clients - filter by accessible branches
        supabase.from('clients')
          .select('*', { count: 'exact' })
          .eq('is_active', true)
          .in('branch_id', branchIds),
        
        // Leaves - filter by accessible branches via employees
        supabase.from('leave_requests').select(`
          *,
          employees!leave_requests_employee_id_fkey(name, branch_id),
          leave_types!leave_requests_leave_type_id_fkey(name)
        `),
        
        // Compliance - filter by accessible branches via employees
        supabase.from('compliance_period_records')
          .select('status, employee_id, employees!compliance_period_records_employee_id_fkey(branch_id)'),
        
        // Branches - only accessible branches
        supabase.from('branches')
          .select('id, name')
          .in('id', branchIds),
        
        // Documents - filter by accessible branches via employees
        supabase.from('document_tracker')
          .select('*, employees(name, branch_id)')
          .order('created_at', { ascending: true })
      ]);

      const employeesData = employeesResult.data;
      const employeeCount = employeesResult.count;
      const clientsData = clientsResult.data;
      const clientsCount = clientsResult.count;
      const leavesData = leavesResult.data;
      const allCompliance = complianceResult.data;
      const branchesData = branchesResult.data;
      const documents = documentsResult.data;

      // Filter leaves to only include those from accessible branches
      const filteredLeaves = leavesData?.filter(l => {
        const employeeBranchId = l.employees?.branch_id;
        return branchIds.includes(employeeBranchId);
      }) || [];

      // Filter compliance to only include those from accessible branches
      const filteredCompliance = allCompliance?.filter(c => {
        const employeeBranchId = (c.employees as any)?.branch_id;
        return branchIds.includes(employeeBranchId);
      }) || [];

      // Fetch all document types to map names
      const { data: docTypes } = await supabase
        .from('document_types')
        .select('id, name');
      
      const docTypeMap = new Map(docTypes?.map(dt => [dt.id, dt.name]) || []);
      
      // Flatten JSONB documents array and filter by accessible branches
      const flattenedDocuments = [];
      if (documents) {
        for (const tracker of documents) {
          const employeeBranchId = tracker.employees?.branch_id;
          if (!branchIds.includes(employeeBranchId)) continue;
          
          const docs = (tracker.documents as any[]) || [];
          for (const doc of docs) {
            flattenedDocuments.push({
              id: doc.id,
              employee_id: tracker.employee_id,
              document_type_id: doc.document_type_id,
              document_number: doc.document_number,
              issue_date: doc.issue_date,
              expiry_date: doc.expiry_date,
              status: doc.status,
              notes: doc.notes,
              employees: tracker.employees,
              document_types: {
                name: docTypeMap.get(doc.document_type_id) || 'Unknown'
              }
            });
          }
        }
      }
      
      const filteredDocuments = flattenedDocuments;

      // Process leaves
      const pendingLeaves = filteredLeaves?.filter(l => l.status === 'pending') || [];
      const leavesToday = filteredLeaves
        ?.filter(l => l.status === 'approved')
        .map(leave => ({
          employee_name: leave.employees?.name || 'Unknown',
          leave_type: leave.leave_types?.name || 'Leave',
          start_date: leave.start_date,
          end_date: leave.end_date
        })) || [];

      const leavesByBranch = pendingLeaves.reduce((acc, leave) => {
        const branchId = leave.employees?.branch_id;
        const branch = branchesData?.find(b => b.id === branchId)?.name || 'Unknown';
        acc[branch] = (acc[branch] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Calculate compliance rates using filtered data
      const complianceByBranch = filteredCompliance?.reduce((acc, record) => {
        const branchId = (record.employees as any)?.branch_id;
        const branch = branchesData?.find(b => b.id === branchId)?.name || 'Unknown';
        if (!acc[branch]) {
          acc[branch] = { total: 0, completed: 0 };
        }
        acc[branch].total++;
        if (record.status === 'completed') {
          acc[branch].completed++;
        }
        return acc;
      }, {} as Record<string, { total: number; completed: number }>) || {};

      const complianceRates = Object.entries(complianceByBranch).reduce((acc, [branch, data]) => {
        acc[branch] = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
        return acc;
      }, {} as Record<string, number>);

      const overallCompletionRate = filteredCompliance && filteredCompliance.length > 0
        ? Math.round((filteredCompliance.filter(r => r.status === 'completed').length / filteredCompliance.length) * 100)
        : 0;

      // Optimized branch counts - Calculate from already fetched data
      const branchColors = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
      
      const branches = (branchesData || []).map((branch, index) => {
        const empCount = employeesData?.filter(e => e.branch_id === branch.id && e.is_active !== false).length || 0;
        const clientCount = clientsData?.filter(c => c.branch_id === branch.id).length || 0;
        
        return {
          name: branch.name,
          employeeCount: empCount,
          clientCount: clientCount,
          color: branchColors[index % branchColors.length]
        };
      });

      // Date calculations for document status - used in multiple places
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysFromNow = new Date(today);
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      
      // Process documents expiring soon
      const documentsExpiring = filteredDocuments
        .filter(doc => {
          if (!doc.expiry_date || !/^\d{4}-\d{2}-\d{2}$/.test(doc.expiry_date)) return false;
          const [year, month, day] = doc.expiry_date.split('-').map(Number);
          const expiryDate = new Date(year, month - 1, day);
          expiryDate.setHours(0, 0, 0, 0);
          return expiryDate <= thirtyDaysFromNow;
        })
        .map(doc => {
          const [year, month, day] = doc.expiry_date.split('-').map(Number);
          const expiryDate = new Date(year, month - 1, day);
          expiryDate.setHours(0, 0, 0, 0);
          let status: 'valid' | 'expiring' | 'expired';
          
          if (expiryDate < today) {
            status = 'expired';
          } else if (expiryDate <= thirtyDaysFromNow) {
            status = 'expiring';
          } else {
            status = 'valid';
          }
          
          return {
            employee_name: doc.employees?.name || 'Unknown',
            document_type: doc.document_types?.name || 'Document',
            expiry_date: doc.expiry_date,
            status
          };
        })
        .slice(0, 10);

      // Calculate document status dynamically based on expiry dates
      let validCount = 0;
      let expiringCount = 0;
      let expiredCount = 0;
      
      filteredDocuments.forEach(doc => {
        if (!doc.expiry_date || !/^\d{4}-\d{2}-\d{2}$/.test(doc.expiry_date)) {
          validCount++; // No expiry date = valid
          return;
        }
        
        // Parse date as YYYY-MM-DD and set to midnight local time for accurate comparison
        const [year, month, day] = doc.expiry_date.split('-').map(Number);
        const expiryDate = new Date(year, month - 1, day); // month is 0-indexed
        expiryDate.setHours(0, 0, 0, 0);
        
        if (expiryDate < today) {
          expiredCount++;
        } else if (expiryDate <= thirtyDaysFromNow) {
          expiringCount++;
        } else {
          validCount++;
        }
      });
      
      const documentStats = {
        total: filteredDocuments.length,
        valid: validCount,
        expiring: expiringCount,
        expired: expiredCount,
      };

      // Phase 2: Parallel activity queries
      const [
        recentEmployees,
        recentDocs,
        recentCompliance,
        recentLeaves,
        recentApps
      ] = await Promise.all([
        supabase.from('employees')
          .select('id, name, created_at')
          .order('created_at', { ascending: false })
          .limit(3),
        
        supabase.from('document_tracker')
          .select('id, updated_at, employees(name)')
          .order('updated_at', { ascending: false })
          .limit(3),
        
        supabase.from('compliance_period_records')
          .select('id, updated_at, status, employees(name), compliance_types(name)')
          .eq('status', 'completed')
          .order('updated_at', { ascending: false })
          .limit(3),
        
        supabase.from('leave_requests')
          .select('id, created_at, status, employees(name)')
          .order('created_at', { ascending: false })
          .limit(3),
        
        supabase.from('job_applications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3)
      ]);

      // Build activity feed
      const recentActivity = [];

      recentEmployees.data?.forEach(emp => {
        recentActivity.push({
          id: `emp-${emp.id}`,
          type: 'employee',
          message: `New employee onboarded: ${emp.name}`,
          timestamp: emp.created_at,
          user: 'System'
        });
      });

      recentDocs.data?.forEach(doc => {
        const employeeName = (doc.employees as any)?.name || 'Unknown';
        recentActivity.push({
          id: `doc-${doc.id}`,
          type: 'document',
          message: `Document updated for ${employeeName}`,
          timestamp: doc.updated_at,
          user: employeeName
        });
      });

      recentCompliance.data?.forEach(comp => {
        const employeeName = (comp.employees as any)?.name || 'Unknown';
        const complianceType = (comp.compliance_types as any)?.name || 'training';
        recentActivity.push({
          id: `comp-${comp.id}`,
          type: 'compliance',
          message: `${complianceType} completed by ${employeeName}`,
          timestamp: comp.updated_at,
          user: employeeName
        });
      });

      recentLeaves.data?.forEach(leave => {
        const employeeName = (leave.employees as any)?.name || 'Unknown';
        recentActivity.push({
          id: `leave-${leave.id}`,
          type: 'document',
          message: `Leave request ${leave.status} for ${employeeName}`,
          timestamp: leave.created_at,
          user: employeeName
        });
      });

      recentApps.data?.forEach(app => {
        const personalInfo = app.personal_info as any;
        const name = personalInfo?.firstName && personalInfo?.lastName 
          ? `${personalInfo.firstName} ${personalInfo.lastName}`
          : 'Applicant';
        recentActivity.push({
          id: `app-${app.id}`,
          type: 'employee',
          message: `New job application received from ${name}`,
          timestamp: app.created_at,
          user: name
        });
      });

      // Application stats
      const applicationStats: Record<string, number> = {};
      recentApps.data?.forEach(app => {
        const status = app.status || 'new';
        applicationStats[status] = (applicationStats[status] || 0) + 1;
      });
      
      // Reference status
      const referenceStatus = recentApps.data
        ?.filter(app => app.reference_info)
        .map(app => {
          const personalInfo = app.personal_info as any;
          const refInfo = app.reference_info as any;
          const references = refInfo?.references || [];
          const received = references.filter((r: any) => r.status === 'received').length;
          const pending = references.length - received;
          
          return {
            application_id: app.id,
            applicant_name: personalInfo?.firstName && personalInfo?.lastName 
              ? `${personalInfo.firstName} ${personalInfo.lastName}`
              : 'Unknown Applicant',
            references_pending: pending,
            references_received: received,
            total_references: references.length
          };
        })
        .filter(ref => ref.references_pending > 0)
        .slice(0, 10) || [];

      // Calculate branch health scores (using filtered data)
      const branchHealth = (branchesData || []).map((branch) => {
        const branchEmployees = employeesData?.filter(e => e.branch_id === branch.id) || [];
        const branchDocuments = flattenedDocuments?.filter(d => d.employees?.branch_id === branch.id) || [];
        const branchCompliance = filteredCompliance?.filter(c => {
          const employee = employeesData?.find(e => e.id === c.employee_id);
          return employee?.branch_id === branch.id;
        }) || [];
        
        const activeEmployees = branchEmployees.filter(e => e.is_active !== false).length;
        
        // Calculate valid documents based on expiry dates
        const validDocuments = branchDocuments.filter(d => {
          if (!d.expiry_date || !/^\d{4}-\d{2}-\d{2}$/.test(d.expiry_date)) return true;
          const [year, month, day] = d.expiry_date.split('-').map(Number);
          const expiryDate = new Date(year, month - 1, day);
          expiryDate.setHours(0, 0, 0, 0);
          return expiryDate >= today;
        }).length;
        
        const completedCompliance = branchCompliance.filter(c => c.status === 'completed').length;
        
        const documentValidityRate = branchDocuments.length > 0 
          ? Math.round((validDocuments / branchDocuments.length) * 100)
          : 100;
        const complianceRate = branchCompliance.length > 0
          ? Math.round((completedCompliance / branchCompliance.length) * 100)
          : 100;
        
        const pendingLeaveRequests = filteredLeaves?.filter(l => {
          const employee = employeesData?.find(e => e.id === l.employee_id);
          return employee?.branch_id === branch.id && l.status === 'pending';
        }).length || 0;
        
        const overallScore = Math.round((complianceRate + documentValidityRate) / 2);
        
        return {
          branch_name: branch.name,
          compliance_rate: complianceRate,
          document_validity_rate: documentValidityRate,
          leave_backlog: pendingLeaveRequests,
          active_employees: activeEmployees,
          overall_score: overallScore
        };
      });

      // Sort activities
      const sortedActivity = recentActivity
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      setData({
        totalEmployees: employeeCount || 0,
        activeProjects: clientsCount || 0,
        pendingTasks: pendingLeaves.length,
        completionRate: overallCompletionRate,
        leavesByBranch,
        complianceRates,
        branches,
        recentActivity: sortedActivity,
        leavesToday,
        documentsExpiring,
        applicationStats,
        referenceStatus,
        branchHealth,
        documentStats,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error loading dashboard",
        description: "Could not fetch dashboard data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-64 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-3xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-muted/50 rounded-2xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-muted/50 rounded-2xl"></div>
          <div className="h-96 bg-muted/50 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <MinimalistHeader isConnected={isConnected} />

      {/* Metrics Overview */}
      <MetricsOverview
        totalEmployees={data.totalEmployees}
        activeProjects={data.activeProjects}
        pendingTasks={data.pendingTasks}
        completionRate={data.completionRate}
        leavesByBranch={data.leavesByBranch}
        complianceRates={data.complianceRates}
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Branch */}
        <div className="space-y-6">
          <BranchBreakdown branches={data.branches} branchHealth={data.branchHealth} />
        </div>

        {/* Center Column - Activity */}
        <div className="space-y-6">
          <ActivityTimeline activities={data.recentActivity} />
        </div>

        {/* Right Column - Documents */}
        <div className="space-y-6">
          <DocumentHealthCarousel 
            stats={data.documentStats}
            expiringDocuments={data.documentsExpiring}
          />
        </div>
      </div>

      <DocumentCountryMap />
    </div>
  );
}
