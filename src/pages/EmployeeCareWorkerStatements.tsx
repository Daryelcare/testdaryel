import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Eye, Edit, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEmployeeAuth } from "@/contexts/EmployeeAuthContext";
import { CareWorkerStatementForm } from "@/components/compliance/CareWorkerStatementForm";
import { cn } from "@/lib/utils";

interface CareWorkerStatement {
  id: string;
  care_worker_name: string;
  client_name: string;
  client_address: string;
  report_date: string;
  statement: string | null;
  person_completing_report: string | null;
  position: string | null;
  digital_signature: string | null;
  completion_date: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export default function EmployeeCareWorkerStatements() {
  const [statements, setStatements] = useState<CareWorkerStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatement, setSelectedStatement] = useState<CareWorkerStatement | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  const { toast } = useToast();
  const { employee } = useEmployeeAuth();

  useEffect(() => {
    if (employee) {
      fetchMyStatements();
    }
  }, [employee]);

  const fetchMyStatements = async () => {
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
      toast({
        title: "Error",
        description: "Failed to load your care worker statements",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'submitted': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'draft': return <AlertCircle className="h-4 w-4 text-orange-600" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    return status;
  };

  const handleViewStatement = (statement: CareWorkerStatement) => {
    setSelectedStatement(statement);
    setIsFormOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-64"></div>
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-muted rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">My Care Worker Statements</h1>
          <p className="text-muted-foreground">
            View and complete your assigned care worker statements
          </p>
        </div>

        {/* Statements List */}
        {statements.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No statements assigned</h3>
              <p className="text-muted-foreground text-center">
                You don't have any care worker statements assigned to you yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {statements.map((statement) => (
              <Card key={statement.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getStatusIcon(statement.status)}
                        {statement.care_worker_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Client: {statement.client_name}
                      </p>
                    </div>
                    <Badge 
                      className={cn(
                        "capitalize",
                        statement.status === 'approved' && "bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0",
                        statement.status === 'submitted' && "bg-blue-500 text-white border-0",
                        statement.status === 'rejected' && "bg-red-500 text-white border-0",
                        statement.status === 'draft' && "bg-orange-500 text-white border-0"
                      )}
                    >
                      {statement.status}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Report Date:</span>
                      <p className="text-muted-foreground">
                        {new Date(statement.report_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium">Created:</span>
                      <p className="text-muted-foreground">
                        {new Date(statement.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {statement.rejection_reason && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm font-medium text-red-800 mb-1">Rejection Reason:</p>
                      <p className="text-sm text-red-700">{statement.rejection_reason}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => handleViewStatement(statement)}
                      className={cn(
                        "flex items-center gap-1",
                        statement.status === 'draft' || statement.status === 'rejected' 
                          ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                          : "bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 hover:from-green-600 hover:to-emerald-600"
                      )}
                    >
                      {statement.status === 'draft' || statement.status === 'rejected' ? (
                        <>
                          <Edit className="h-4 w-4" />
                          Write Statement
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4" />
                          View Completed Statement
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <CareWorkerStatementForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          statement={selectedStatement}
          onSuccess={() => {
            fetchMyStatements();
            setSelectedStatement(null);
          }}
          readOnly={selectedStatement?.status === 'approved' || selectedStatement?.status === 'submitted'}
        />
      </div>
    </div>
  );
}