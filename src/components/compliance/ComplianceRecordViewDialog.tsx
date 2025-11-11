import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  branch_id?: string;
  branches?: {
    id: string;
    name: string;
  };
}

interface ComplianceRecord {
  id: string;
  employee_id: string;
  compliance_type_id: string;
  period_identifier: string;
  status: string;
  completion_date?: string;
  completion_method?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  completed_by?: string;
  created_by?: string;
  updated_by?: string;
}

interface ComplianceRecordViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  record: ComplianceRecord | null;
  completedByUser?: { name: string; created_at: string } | null;
  createdByUser?: { name: string; created_at: string } | null;
  updatedByUser?: { name: string; updated_at: string } | null;
}

export function ComplianceRecordViewDialog({
  open,
  onOpenChange,
  employee,
  record,
  completedByUser,
  createdByUser,
  updatedByUser
}: ComplianceRecordViewDialogProps) {
  if (!employee || !record) return null;

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return "bg-success/10 text-success border-success/20";
      case 'pending':
        return "bg-warning/10 text-warning border-warning/20";
      case 'overdue':
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'Compliant';
      case 'pending':
        return 'Pending';
      case 'overdue':
        return 'Overdue';
      default:
        return status;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Compliance Record Details
          </DialogTitle>
          <DialogDescription>
            View details for this compliance record.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground">Employee</h4>
              <p className="font-medium">{employee.name}</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground">Branch</h4>
              <p className="font-medium">{employee.branches?.name || 'Unassigned'}</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground">Period</h4>
              <p className="font-medium">{record.period_identifier}</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground">Status</h4>
              <Badge className={getStatusBadge(record.status)}>
                {getStatusText(record.status)}
              </Badge>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground">Completion Date</h4>
              <p className="font-medium">{(() => {
                if (!record.completion_date) return 'N/A';
                const date = new Date(record.completion_date);
                return isNaN(date.getTime()) 
                  ? record.completion_date 
                  : date.toLocaleDateString();
              })()}</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground">Created</h4>
              <p className="font-medium">{new Date(record.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Audit Trail Section */}
          <div className="border-t pt-4">
            <h4 className="font-semibold text-sm text-muted-foreground mb-3">Audit Trail</h4>
            <div className="space-y-3">
              {createdByUser && (
                <div className="bg-muted p-3 rounded-md">
                  <p className="font-medium text-sm">Created By</p>
                  <p className="font-medium">{createdByUser.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(createdByUser.created_at).toLocaleDateString()} at{' '}
                    {new Date(createdByUser.created_at).toLocaleTimeString()}
                  </p>
                </div>
              )}
              
              {completedByUser && (
                <div className="bg-muted p-3 rounded-md">
                  <p className="font-medium text-sm">Completed By</p>
                  <p className="font-medium">{completedByUser.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(completedByUser.created_at).toLocaleDateString()} at{' '}
                    {new Date(completedByUser.created_at).toLocaleTimeString()}
                  </p>
                </div>
              )}

              {updatedByUser && (
                <div className="bg-muted p-3 rounded-md">
                  <p className="font-medium text-sm">Last Updated By</p>
                  <p className="font-medium">{updatedByUser.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(updatedByUser.updated_at).toLocaleDateString()} at{' '}
                    {new Date(updatedByUser.updated_at).toLocaleTimeString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {record.notes && !record.notes.startsWith('Auto-generated for period:') && (
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">Notes</h4>
              <p className="text-sm bg-muted p-3 rounded-md">
                {record.notes}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}