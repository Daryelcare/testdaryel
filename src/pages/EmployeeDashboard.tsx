import { useEffect, useState } from 'react';
import { useEmployeeAuth } from '@/contexts/EmployeeAuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Calendar, FileText, User, LogOut, Clock, CheckCircle, XCircle, Shield, Plus } from 'lucide-react';
import { LeaveRequestDialog } from '@/components/employee/LeaveRequestDialog';
import { DocumentUploadDialog } from '@/components/employee/DocumentUploadDialog';
import { ComplianceOverview } from '@/components/employee/ComplianceOverview';
import { CompanyProvider, useCompany } from '@/contexts/CompanyContext';
import { CareWorkerStatementForm } from '@/components/compliance/CareWorkerStatementForm';
import { format } from 'date-fns';
import { useTheme } from 'next-themes';
interface LeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  notes: string;
  leave_type: {
    name: string;
  };
  created_at: string;
}
function EmployeeDashboardContent() {
  const {
    employee,
    loading,
    signOut
  } = useEmployeeAuth();
  const {
    companySettings
  } = useCompany();
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);
  const [statements, setStatements] = useState([]);
  const [selectedStatement, setSelectedStatement] = useState(null);
  const [isStatementFormOpen, setIsStatementFormOpen] = useState(false);
  
  useEffect(() => {
    // Force light mode on this page
    setTheme('light');
  }, [setTheme]);
  
  useEffect(() => {
    if (!loading && !employee) {
      navigate('/employee-login');
      return;
    }
    if (employee) {
      fetchLeaveRequests();
      fetchStatements();
    }
  }, [employee, loading, navigate]);
  const fetchLeaveRequests = async () => {
    if (!employee) return;
    try {
      // Fetch leave requests
      const {
        data: leaveData,
        error: leaveError
      } = await supabase.from('leave_requests').select(`
          *,
          leave_type:leave_types(name)
        `).eq('employee_id', employee.id).order('created_at', {
        ascending: false
      });
      if (leaveError) throw leaveError;
      setLeaveRequests(leaveData || []);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    }
  };

  const fetchStatements = async () => {
    if (!employee) return;
    try {
      const { data, error } = await supabase
        .from('care_worker_statements')
        .select('*')
        .eq('assigned_employee_id', employee.id)
        .order('status', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Custom sort: draft/rejected first, then submitted/approved, with newest first within each group
      const sorted = (data || []).sort((a, b) => {
        const statusOrder: Record<string, number> = { draft: 0, rejected: 0, submitted: 1, approved: 1 };
        const statusDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
        
        // If same priority group, sort by created_at descending (newest first)
        if (statusDiff === 0) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return statusDiff;
      });
      
      setStatements(sorted);
    } catch (error) {
      console.error('Error fetching statements:', error);
    }
  };
  const handleSignOut = async () => {
    await signOut();
    navigate('/employee-login');
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-white" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>;
  }
  if (!employee) {
    return <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Employee Profile Not Found</h2>
          <p className="text-muted-foreground mb-4">Please contact your administrator to set up your employee profile.</p>
          <Button onClick={handleSignOut}>Sign Out</Button>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-[hsl(var(--employee-background))] overflow-x-hidden">
      {/* Modern Header */}
      <header className="bg-white border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Company Info */}
            <div className="flex items-center gap-3 sm:gap-6 min-w-0 flex-1">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                {companySettings.logo ? <div className="relative flex-shrink-0">
                    <img src={companySettings.logo} alt={companySettings.name} className="h-10 w-10 sm:h-12 sm:w-12 object-contain rounded-xl" />
                  </div> : <div className="h-10 w-10 sm:h-12 sm:w-12 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
                    <Shield className="h-5 w-5 sm:h-7 sm:w-7 text-primary-foreground" />
                  </div>}
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate">
                    {companySettings.name}
                  </h1>
                  {companySettings.tagline && <p className="text-xs sm:text-sm text-muted-foreground truncate">{companySettings.tagline}</p>}
                </div>
              </div>
              <div className="hidden lg:block w-px h-12 bg-border flex-shrink-0" />
              <div className="hidden lg:block">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 bg-success rounded-full animate-pulse" />
                  <span className="text-lg font-semibold text-foreground">Welcome back!</span>
                </div>
                
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <Button 
                onClick={handleSignOut} 
                variant="destructive"
                className="text-xs sm:text-sm px-3 sm:px-4"
              >
                <LogOut className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-primary p-6 sm:p-8 text-primary-foreground shadow-lg">
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-2">Dashboard Overview</h2>
                <p className="text-primary-foreground/90 text-base sm:text-lg">Track your progress and stay compliant</p>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card className="group hover:shadow-lg transition-all duration-300 animate-fade-in border-l-4 border-l-success">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-success mb-1">Total Allowance</p>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground truncate">{employee.leave_allowance}</p>
                  <p className="text-xs text-muted-foreground mt-1">Days per year</p>
                </div>
                <div className="relative flex-shrink-0 ml-3">
                  <div className="h-12 w-12 sm:h-14 sm:w-14 bg-success rounded-xl sm:rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                    <Calendar className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="group hover:shadow-lg transition-all duration-300 animate-fade-in border-l-4 border-l-warning" style={{
          animationDelay: '0.1s'
        }}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-warning mb-1">Days Taken</p>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground truncate">{employee.leave_taken}</p>
                  <p className="text-xs text-muted-foreground mt-1">This year</p>
                </div>
                <div className="relative flex-shrink-0 ml-3">
                  <div className="h-12 w-12 sm:h-14 sm:w-14 bg-warning rounded-xl sm:rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                    <Clock className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="group hover:shadow-lg transition-all duration-300 animate-fade-in sm:col-span-2 lg:col-span-1 border-l-4 border-l-primary" style={{
          animationDelay: '0.2s'
        }}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-primary mb-1">Remaining</p>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground truncate">{employee.remaining_leave_days}</p>
                  <p className="text-xs text-muted-foreground mt-1">Days available</p>
                </div>
                <div className="relative flex-shrink-0 ml-3">
                  <div className="h-12 w-12 sm:h-14 sm:w-14 bg-primary rounded-xl sm:rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                    <CheckCircle className="w-5 h-5 sm:w-7 sm:h-7 text-primary-foreground" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Enhanced Personal Information */}
          <Card className="hover:shadow-lg transition-all duration-300 animate-fade-in" style={{
          animationDelay: '0.3s'
        }}>
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg">
                <div className="h-8 w-8 sm:h-10 sm:w-10 bg-primary rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                </div>
                <span className="truncate">Personal Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:gap-4">
                  {[{
                  label: 'Full Name',
                  value: employee.name,
                  icon: User
                }, {
                  label: 'Email Address',
                  value: employee.email,
                  icon: FileText
                }, {
                  label: 'Branch Location',
                  value: employee.branches?.name || 'Not specified',
                  icon: Calendar
                }, {
                  label: 'Job Title',
                  value: employee.job_title || 'Not specified',
                  icon: CheckCircle
                }].map((item, index) => <div key={item.label} className="flex items-start sm:items-center gap-3 sm:gap-4 p-2 sm:p-3 rounded-lg sm:rounded-xl hover:bg-secondary transition-colors min-h-[44px]">
                      <div className="h-7 w-7 sm:h-8 sm:w-8 bg-secondary rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0 mt-1 sm:mt-0">
                        <item.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm text-muted-foreground leading-tight">{item.label}</p>
                        <p className="font-medium text-foreground text-sm sm:text-base truncate leading-tight mt-0.5 sm:mt-0">{item.value}</p>
                      </div>
                    </div>)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Compliance Overview */}
          <div className="animate-fade-in" style={{
          animationDelay: '0.4s'
        }}>
            <ComplianceOverview employeeId={employee.id} />
          </div>
        </div>

        {/* Leave Management Section */}
        <Card className="hover:shadow-lg transition-all duration-300 animate-fade-in border-t-4 border-t-primary" style={{
          animationDelay: '0.5s'
        }}>
          <CardHeader className="pb-3 sm:pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <CardTitle className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg">
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
                </div>
                <div>
                  <span className="block truncate">Leave Management</span>
                  <span className="text-xs sm:text-sm font-normal text-muted-foreground">Track and request your time off</span>
                </div>
              </CardTitle>
              <Button 
                onClick={() => setShowLeaveDialog(true)} 
                className="bg-success hover:bg-success/90 text-white text-sm sm:text-base px-4 sm:px-6 py-2.5 min-h-[44px] w-full sm:w-auto"
              >
                <Plus className="w-4 h-4 mr-2" />
                Request Holiday
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-6">
            {leaveRequests.length === 0 ? (
              <div className="text-center py-12 sm:py-16">
                <div className="h-16 w-16 sm:h-20 sm:w-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                </div>
                <p className="text-muted-foreground mb-2 text-base sm:text-lg font-medium">No leave requests found</p>
                <p className="text-sm sm:text-base text-gray-500">Click "Request Holiday" above to submit your first request</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {leaveRequests.map((leave, index) => (
                  <div 
                    key={leave.id} 
                    className={cn(
                      "relative flex flex-col gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl hover:shadow-lg transition-all duration-300 group",
                      leave.status === 'approved' 
                        ? "bg-gradient-to-br from-white to-green-50/30 border-2 border-transparent bg-origin-border [background-clip:padding-box,border-box] [background-image:linear-gradient(white,white),linear-gradient(135deg,hsl(142_76%_45%),hsl(142_76%_60%))] hover:shadow-green-200"
                        : "bg-gradient-to-br from-white to-blue-50/30 border-2 border-blue-100 hover:border-blue-300"
                    )}
                    style={{ animationDelay: `${0.1 * index}s` }}
                  >
                    <div className={cn(
                      "absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl transition-all duration-300",
                      leave.status === 'approved'
                        ? "bg-gradient-to-br from-green-500/5 to-transparent group-hover:from-green-500/10"
                        : "bg-gradient-to-br from-blue-500/5 to-transparent group-hover:from-blue-500/10"
                    )} />
                    <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0 relative z-10">
                      <div className={cn(
                        "h-12 w-12 sm:h-14 sm:w-14 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform duration-300",
                        leave.status === 'approved'
                          ? "bg-gradient-to-br from-green-500 to-emerald-600"
                          : "bg-gradient-to-br from-blue-500 to-indigo-600"
                      )}>
                        {getStatusIcon(leave.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-gray-900 text-base sm:text-lg mb-1">{leave.leave_type.name}</h4>
                            <p className="text-sm sm:text-base text-gray-600 font-medium">
                              {format(new Date(leave.start_date), 'MMM dd')} - {format(new Date(leave.end_date), 'MMM dd, yyyy')}
                            </p>
                          </div>
                          <Badge 
                            variant={getStatusColor(leave.status)} 
                            className={cn(
                              "text-xs sm:text-sm px-3 py-1.5 min-h-[28px] w-fit font-medium shadow-sm",
                              leave.status === 'approved' && "bg-gradient-to-r from-green-500 to-emerald-600 text-white border-transparent hover:from-green-600 hover:to-emerald-700"
                            )}
                          >
                            {leave.status}
                          </Badge>
                        </div>
                        {leave.notes && (
                          <p className="text-sm sm:text-base text-gray-600 mt-3 p-3 bg-white/60 rounded-lg border border-blue-100">
                            {leave.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Care Worker Statements Section */}
        <Card className="relative overflow-hidden hover:shadow-xl transition-all duration-300 animate-fade-in" style={{
          animationDelay: '0.6s'
        }}>
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500" />
          <CardHeader className="pb-3 sm:pb-4 pt-6">
            <CardTitle className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg">
              <div className="h-10 w-10 sm:h-12 sm:w-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <span className="block truncate">Care Worker Statements</span>
                <span className="text-xs sm:text-sm font-normal text-muted-foreground">Complete your assigned statements</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-6">
            {statements.length === 0 ? (
              <div className="text-center py-12 sm:py-16">
                <div className="h-16 w-16 sm:h-20 sm:w-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-purple-500" />
                </div>
                <p className="text-gray-600 mb-2 text-base sm:text-lg font-medium">No statements assigned</p>
                <p className="text-sm sm:text-base text-gray-500">Your care worker statements will appear here when assigned</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {statements.map((statement, index) => (
                  <div 
                    key={statement.id} 
                    className={cn(
                      "relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl hover:shadow-lg transition-all duration-300 group",
                      statement.status === 'draft' 
                        ? "bg-gradient-to-br from-white to-red-50/30 border-2 border-transparent bg-origin-border [background-clip:padding-box,border-box] [background-image:linear-gradient(white,white),linear-gradient(135deg,hsl(0_84%_60%),hsl(0_84%_75%))] hover:shadow-red-200"
                        : statement.status === 'approved'
                        ? "bg-gradient-to-br from-white to-green-50/30 border-2 border-transparent bg-origin-border [background-clip:padding-box,border-box] [background-image:linear-gradient(white,white),linear-gradient(135deg,hsl(142_76%_45%),hsl(142_76%_60%))] hover:shadow-green-200"
                        : "bg-gradient-to-br from-white to-purple-50/30 border-2 border-purple-100 hover:border-purple-300"
                    )}
                    style={{ animationDelay: `${0.1 * index}s` }}
                  >
                    <div className={cn(
                      "absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl transition-all duration-300",
                      statement.status === 'draft'
                        ? "bg-gradient-to-br from-red-500/5 to-transparent group-hover:from-red-500/10"
                        : statement.status === 'approved'
                        ? "bg-gradient-to-br from-green-500/5 to-transparent group-hover:from-green-500/10"
                        : "bg-gradient-to-br from-purple-500/5 to-transparent group-hover:from-purple-500/10"
                    )} />
                    <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0 relative z-10">
                      <div className={cn(
                        "h-12 w-12 sm:h-14 sm:w-14 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform duration-300",
                        statement.status === 'draft'
                          ? "bg-gradient-to-br from-red-500 to-red-600"
                          : statement.status === 'approved'
                          ? "bg-gradient-to-br from-green-500 to-emerald-600"
                          : "bg-gradient-to-br from-purple-500 to-pink-600"
                      )}>
                        <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 mb-2">
                          <span className="font-bold text-gray-900 text-base sm:text-lg">{statement.care_worker_name}</span>
                          <Badge 
                            variant={
                              statement.status === 'approved' ? 'default' : 
                              statement.status === 'submitted' ? 'secondary' : 
                              statement.status === 'rejected' ? 'destructive' : 
                              'outline'
                            } 
                            className={cn(
                              "text-xs sm:text-sm px-3 py-1.5 w-fit font-medium shadow-sm",
                              (statement.status === 'draft' || statement.status === 'submitted') && "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-transparent hover:from-blue-600 hover:to-blue-700",
                              statement.status === 'approved' && "bg-gradient-to-r from-green-500 to-emerald-600 text-white border-transparent hover:from-green-600 hover:to-emerald-700"
                            )}
                          >
                            {statement.status.charAt(0).toUpperCase() + statement.status.slice(1)}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm sm:text-base text-gray-700 font-medium">
                            <span className="text-gray-500">Client:</span> {statement.client_name}
                          </p>
                          <p className="text-xs sm:text-sm text-gray-600">
                            <span className="text-gray-500">Report Date:</span> {new Date(statement.report_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="lg"
                      onClick={() => {
                        setSelectedStatement(statement);
                        setIsStatementFormOpen(true);
                      }}
                      className={cn(
                        "text-sm sm:text-base px-6 min-h-[44px] w-full sm:w-auto relative z-10 shadow-md hover:shadow-lg transition-all duration-300",
                        statement.status === 'draft' || statement.status === 'rejected' 
                          ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                          : "bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 hover:from-green-600 hover:to-emerald-600"
                      )}
                    >
                      {statement.status === 'draft' || statement.status === 'rejected' ? 'Write Statement' : 'View Completed Statement'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Dialogs */}
      <LeaveRequestDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog} employeeId={employee.id} onSuccess={fetchLeaveRequests} />
      
      <DocumentUploadDialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog} employeeId={employee.id} />
      
      <CareWorkerStatementForm
        open={isStatementFormOpen}
        onOpenChange={setIsStatementFormOpen}
        statement={selectedStatement}
        onSuccess={() => {
          fetchStatements();
          setSelectedStatement(null);
        }}
        readOnly={selectedStatement?.status === 'approved' || selectedStatement?.status === 'submitted'}
      />
    </div>;
}
export default function EmployeeDashboard() {
  return <CompanyProvider>
      <EmployeeDashboardContent />
    </CompanyProvider>;
}