import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Filter, Download, Eye, Edit, Check, X, FileText, ArrowUpDown, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CareWorkerStatementModal } from "./CareWorkerStatementModal";
import { CareWorkerStatementForm } from "./CareWorkerStatementForm";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import { generateCareWorkerStatementPDF } from "@/lib/care-worker-statement-pdf";
import { useActivitySync } from "@/hooks/useActivitySync";
import { useCareWorkerStatements, useStatementBranches, useCompliancePeriodActions } from "@/hooks/queries/useCompliancePeriodQueries";
import { supabase } from "@/integrations/supabase/client";
import { StatementRejectionDialog } from "./StatementRejectionDialog";

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
  assigned_employee_id: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
  employees?: {
    name: string;
  } | null;
  branches?: {
    name: string;
  } | null;
}

interface Branch {
  id: string;
  name: string;
}

export type StatementSortField = 'care_worker_name' | 'client_name' | 'client_address' | 'branch' | 'report_date' | 'status' | 'created_at';
export type StatementSortDirection = 'asc' | 'desc';

export function CareWorkerStatementContent() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState<CareWorkerStatement | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<StatementSortField>('created_at');
  const [sortDirection, setSortDirection] = useState<StatementSortDirection>('desc');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statementToDelete, setStatementToDelete] = useState<CareWorkerStatement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [statementToReject, setStatementToReject] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, getAccessibleBranches } = usePermissions();
  const { 
    canViewCompliance,
    canCreateCompliance,
    canEditCompliance,
    canDeleteCompliance
  } = usePagePermissions();

  // Fetch data using React Query
  const { data: statementsData, isLoading: statementsLoading, refetch: refetchStatements } = useCareWorkerStatements();
  const { data: branchesData, isLoading: branchesLoading } = useStatementBranches();
  const { updateStatementStatus } = useCompliancePeriodActions();
  const { syncNow } = useActivitySync();

  // Filter statements based on user permissions
  const statements = useMemo(() => {
    if (!statementsData) return [];
    
    let filteredData = statementsData;
    const accessibleBranches = getAccessibleBranches();
    
    if (!isAdmin && accessibleBranches.length > 0) {
      filteredData = statementsData.filter(statement => {
        return accessibleBranches.includes(statement.branch_id);
      });
    }
    
    return filteredData;
  }, [statementsData, isAdmin, getAccessibleBranches]);

  // Filter branches based on user permissions
  const branches = useMemo(() => {
    if (!branchesData) return [];
    
    let filteredBranches = branchesData;
    const accessibleBranches = getAccessibleBranches();
    
    if (!isAdmin && accessibleBranches.length > 0) {
      filteredBranches = branchesData.filter(branch => 
        accessibleBranches.includes(branch.id)
      );
    }
    
    return filteredBranches;
  }, [branchesData, isAdmin, getAccessibleBranches]);

  const loading = statementsLoading || branchesLoading;

  const handleStatusUpdate = (statementId: string, status: string, rejectionReason?: string) => {
    updateStatementStatus.mutate({ statementId, status, rejectionReason });
    syncNow(); // Trigger immediate sync after status update
  };

  const handleDeleteClick = (statement: CareWorkerStatement) => {
    setStatementToDelete(statement);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!statementToDelete) return;

    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('care_worker_statements')
        .delete()
        .eq('id', statementToDelete.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Care worker statement deleted successfully",
      });

      syncNow(); // Trigger immediate sync after deletion
      refetchStatements();
      setDeleteDialogOpen(false);
      setStatementToDelete(null);
    } catch (error) {
      console.error('Error deleting statement:', error);
      toast({
        title: "Error",
        description: "Failed to delete statement",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const exportToPDF = async (statement: CareWorkerStatement) => {
    try {
      const pdfBlob = await generateCareWorkerStatementPDF(statement);
      
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `care-worker-statement-${statement.care_worker_name.replace(/\s+/g, '-')}-${new Date(statement.report_date).toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "PDF downloaded successfully",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  const handleSort = (field: StatementSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: StatementSortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'submitted': return 'secondary';
      case 'rejected': return 'destructive';
      case 'draft': return 'outline';
      default: return 'outline';
    }
  };

  const filteredStatements = statements.filter(statement => {
    const matchesSearch = 
      statement.care_worker_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      statement.client_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || statement.status === statusFilter;
    const matchesBranch = branchFilter === "all" || statement.branch_id === branchFilter;
    
    return matchesSearch && matchesStatus && matchesBranch;
  }).sort((a, b) => {
    let aVal: any;
    let bVal: any;
    
    switch (sortField) {
      case 'care_worker_name':
        aVal = a.care_worker_name || '';
        bVal = b.care_worker_name || '';
        break;
      case 'client_name':
        aVal = a.client_name || '';
        bVal = b.client_name || '';
        break;
      case 'client_address':
        aVal = a.client_address || '';
        bVal = b.client_address || '';
        break;
      case 'branch':
        aVal = a.branches?.name || '';
        bVal = b.branches?.name || '';
        break;
      case 'report_date':
        aVal = new Date(a.report_date).getTime();
        bVal = new Date(b.report_date).getTime();
        break;
      case 'status':
        aVal = a.status || '';
        bVal = b.status || '';
        break;
      case 'created_at':
        aVal = new Date(a.created_at).getTime();
        bVal = new Date(b.created_at).getTime();
        break;
      default:
        return 0;
    }
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      const comparison = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? comparison : -comparison;
    } else {
      const comparison = aVal - bVal;
      return sortDirection === 'asc' ? comparison : -comparison;
    }
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Statements</h1>
          <p className="text-muted-foreground">Manage care worker statement reports</p>
        </div>
        {canCreateCompliance() && (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Statement
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor="search">Search by Care Worker or Client Name</Label>
            <Input
              id="search"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="branch">Branch</Label>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Statements Table */}
      <Card>
        <CardHeader>
          <CardTitle>Care Worker Statements ({filteredStatements.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    className="p-0 h-auto font-medium hover:bg-transparent"
                    onClick={() => handleSort('care_worker_name')}
                  >
                    Care Worker {getSortIcon('care_worker_name')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    className="p-0 h-auto font-medium hover:bg-transparent"
                    onClick={() => handleSort('client_name')}
                  >
                    Client Name {getSortIcon('client_name')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    className="p-0 h-auto font-medium hover:bg-transparent"
                    onClick={() => handleSort('client_address')}
                  >
                    Client Address {getSortIcon('client_address')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    className="p-0 h-auto font-medium hover:bg-transparent"
                    onClick={() => handleSort('created_at')}
                  >
                    Created {getSortIcon('created_at')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    className="p-0 h-auto font-medium hover:bg-transparent"
                    onClick={() => handleSort('status')}
                  >
                    Status {getSortIcon('status')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    className="p-0 h-auto font-medium hover:bg-transparent"
                    onClick={() => handleSort('report_date')}
                  >
                    Report Date {getSortIcon('report_date')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStatements.map((statement) => (
                <TableRow key={statement.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{statement.care_worker_name}</span>
                      <Badge variant="outline" className="text-xs">
                        {statement.branches?.name || 'No branch'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{statement.client_name}</TableCell>
                  <TableCell>{statement.client_address}</TableCell>
                  <TableCell>{new Date(statement.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(statement.status)}>
                      {statement.status.charAt(0).toUpperCase() + statement.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(statement.report_date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedStatement(statement);
                          setIsFormOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      {canEditCompliance() && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedStatement(statement);
                            setIsModalOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}

                      {canEditCompliance() && statement.status === 'submitted' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusUpdate(statement.id, 'approved')}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setStatementToReject(statement.id);
                              setRejectionDialogOpen(true);
                            }}
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => exportToPDF(statement)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>

                      {canDeleteCompliance() && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(statement)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredStatements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No statements found</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CareWorkerStatementModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        statement={selectedStatement}
        branches={branches}
        onSuccess={() => {
          setSelectedStatement(null);
          refetchStatements(); // Auto-refresh the table
        }}
      />

      <CareWorkerStatementForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        statement={selectedStatement}
        onSuccess={() => {
          setSelectedStatement(null);
          refetchStatements(); // Auto-refresh the table
        }}
        readOnly={!canEditCompliance() && selectedStatement?.status !== 'draft' && selectedStatement?.status !== 'rejected'}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Care Worker Statement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the statement for{' '}
              <strong>{statementToDelete?.care_worker_name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StatementRejectionDialog
        open={rejectionDialogOpen}
        onOpenChange={setRejectionDialogOpen}
        onConfirm={(reason) => {
          if (statementToReject) {
            handleStatusUpdate(statementToReject, 'rejected', reason);
            setStatementToReject(null);
          }
        }}
      />
    </div>
  );
}