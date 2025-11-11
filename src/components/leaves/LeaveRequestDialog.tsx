
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import { differenceInDays, parseISO, format } from "date-fns";

interface Employee {
  id: string;
  name: string;
  employee_code: string;
  branches?: {
    id: string;
    name: string;
  };
}

interface LeaveType {
  id: string;
  name: string;
  reduces_allowance: boolean;
}

interface LeaveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function LeaveRequestDialog({ open, onOpenChange, onSuccess }: LeaveRequestDialogProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedLeaveType, setSelectedLeaveType] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { getAccessibleBranches, isAdmin } = usePermissions();

  useEffect(() => {
    if (open) {
      fetchEmployeesAndLeaveTypes();
    }
  }, [open]);

  const fetchEmployeesAndLeaveTypes = async () => {
    try {
      // Fetch employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select(`
          id, name, employee_code, branch_id,
          branches!employees_branch_id_fkey (id, name)
        `)
        .order('name');

      if (employeesError) throw employeesError;

      // Fetch branches
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');

      if (branchesError) throw branchesError;

      // Fetch leave types
      const { data: leaveTypesData, error: leaveTypesError } = await supabase
        .from('leave_types')
        .select('id, name, reduces_allowance')
        .order('name');

      if (leaveTypesError) throw leaveTypesError;

      // Filter employees based on branch access for non-admin users
      const accessibleBranches = getAccessibleBranches();
      let filteredEmployees = employeesData || [];
      
      if (!isAdmin && accessibleBranches.length > 0) {
        filteredEmployees = employeesData?.filter(employee => {
          const employeeBranchId = employee.branch_id;
          return accessibleBranches.includes(employeeBranchId || '');
        }) || [];
      }

      setEmployees(filteredEmployees);
      setBranches(branchesData || []);
      setLeaveTypes(leaveTypesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Could not load employees and leave types",
        variant: "destructive",
      });
    }
  };

  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    return Math.max(0, differenceInDays(endDate, startDate) + 1);
  };

  const handleSubmit = async () => {
    if (!selectedEmployee || !selectedLeaveType || !startDate || !endDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (endDate < startDate) {
      toast({
        title: "Validation Error",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const days = calculateDays();
      
      const { error } = await supabase
        .from('leave_requests')
        .insert({
          employee_id: selectedEmployee,
          leave_type_id: selectedLeaveType,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          notes: notes || null,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Leave request submitted successfully",
      });
      
      // Reset form
      setSelectedEmployee("");
      setSelectedLeaveType("");
      setStartDate(undefined);
      setEndDate(undefined);
      setNotes("");
      
      // Close dialog and refresh
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error submitting leave request:', error);
      toast({
        title: "Error",
        description: "Could not submit leave request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Leave</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="employee">Employee *</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-background">
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name} ({employee.branches?.name || 'No Branch'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="leave-type">Leave Type *</Label>
            <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-background">
                {leaveTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <DatePicker date={startDate} onDateChange={setStartDate} />
            </div>
            <div className="space-y-2">
              <Label>End Date *</Label>
              <DatePicker date={endDate} onDateChange={setEndDate} />
            </div>
          </div>

          {startDate && endDate && (
            <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="text-sm font-medium text-blue-900">
                Leave Duration: {calculateDays()} day(s)
              </div>
              <div className="text-xs text-blue-700 mt-1">
                From {startDate.toLocaleDateString()} to {endDate.toLocaleDateString()}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about your leave request"
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="w-full sm:w-auto">
            {loading ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
