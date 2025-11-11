import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useClientsForStatements, useCompliancePeriodActions } from "@/hooks/queries/useCompliancePeriodQueries";

interface Employee {
  id: string;
  name: string;
  branch_id?: string;
  branches?: {
    name: string;
  };
}

interface Client {
  id: string;
  name: string;
  branch_id?: string;
  branches?: {
    name: string;
  };
}

interface CareWorkerStatement {
  id: string;
  care_worker_name: string;
  client_name: string;
  client_address: string;
  report_date: string;
  assigned_employee_id: string | null;
}

interface Branch {
  id: string;
  name: string;
}

interface CareWorkerStatementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statement?: CareWorkerStatement | null;
  branches: Branch[];
  onSuccess: () => void;
}

export function CareWorkerStatementModal({ 
  open, 
  onOpenChange, 
  statement,
  branches,
  onSuccess 
}: CareWorkerStatementModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [formData, setFormData] = useState({
    care_worker_name: "",
    client_id: "",
    client_name: "",
    client_address: "",
    report_date: new Date(),
    assigned_employee_id: "",
    branch_id: "",
  });

  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, getAccessibleBranches } = usePermissions();
  const { createStatement, updateStatement } = useCompliancePeriodActions();

  // Fetch clients with branch permissions
  const accessibleBranches = getAccessibleBranches();
  const { data: clients = [] } = useClientsForStatements(accessibleBranches, isAdmin);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (statement) {
      setFormData({
        care_worker_name: statement.care_worker_name,
        client_id: "",
        client_name: statement.client_name,
        client_address: statement.client_address,
        report_date: new Date(statement.report_date),
        assigned_employee_id: statement.assigned_employee_id || "",
        branch_id: "",
      });
    } else {
      setFormData({
        care_worker_name: "",
        client_id: "",
        client_name: "",
        client_address: "",
        report_date: new Date(),
        assigned_employee_id: "",
        branch_id: "",
      });
    }
  }, [statement, open]);

  const fetchEmployees = async () => {
    try {
      const accessibleBranches = getAccessibleBranches();
      
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, branch_id, branches(name)')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      
      // Filter employees by accessible branches for non-admin users
      let filteredEmployees = data || [];
      
      if (!isAdmin && accessibleBranches.length > 0) {
        filteredEmployees = (data || []).filter(employee => 
          employee.branch_id && accessibleBranches.includes(employee.branch_id)
        );
      }
      
      setEmployees(filteredEmployees);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        title: "Error",
        description: "Failed to load employees",
        variant: "destructive",
      });
    }
  };

  const handleEmployeeChange = (employeeId: string) => {
    const selectedEmployee = employees.find(emp => emp.id === employeeId);
    setFormData({ 
      ...formData, 
      assigned_employee_id: employeeId,
      care_worker_name: statement ? formData.care_worker_name : (selectedEmployee?.name || ""),
      branch_id: selectedEmployee?.branch_id || ""
    });
  };

  const handleClientChange = (clientId: string) => {
    const selectedClient = clients.find(client => client.id === clientId);
    setFormData({ 
      ...formData, 
      client_id: clientId,
      client_name: selectedClient?.name || "",
      client_address: "" // Reset address when client changes
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get selected employee's name and branch
      const selectedEmployee = employees.find(emp => emp.id === formData.assigned_employee_id);
      const employeeName = selectedEmployee?.name || "";
      
      // Get employee's branch
      let employeeBranchId = null;
      if (selectedEmployee) {
        const { data: empData } = await supabase
          .from('employees')
          .select('branch_id')
          .eq('id', selectedEmployee.id)
          .single();
        employeeBranchId = empData?.branch_id || null;
      }

      const submitData = {
        care_worker_name: formData.care_worker_name || employeeName,
        client_name: formData.client_name,
        client_address: formData.client_address,
        report_date: formData.report_date.toISOString().split('T')[0],
        assigned_employee_id: formData.assigned_employee_id || null,
        branch_id: formData.branch_id || employeeBranchId,
        created_by: user?.id,
      };

      if (statement) {
        await updateStatement.mutateAsync({ 
          statementId: statement.id, 
          statementData: submitData 
        });
      } else {
        await createStatement.mutateAsync(submitData);
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      // Error handling is done by the mutations
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {statement ? 'Edit' : 'Create New'} Care Worker Statement
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="client_name">Service User's Name</Label>
            <Popover open={clientOpen} onOpenChange={setClientOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={clientOpen}
                  className={cn(
                    "w-full justify-between",
                    formData.client_id && "border-green-500"
                  )}
                >
                  {formData.client_id
                    ? clients.find((client) => client.id === formData.client_id)?.name
                    : "Select service user..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search service users..." />
                  <CommandList>
                    <CommandEmpty>No service user found.</CommandEmpty>
                    <CommandGroup>
                      {clients.map((client) => (
                        <CommandItem
                          key={client.id}
                          value={client.name}
                          onSelect={() => {
                            handleClientChange(client.id);
                            setClientOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.client_id === client.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {client.name}
                          {client.branches?.name && (
                            <span className="ml-2 text-muted-foreground">
                              ({client.branches.name})
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="client_address">Client Address</Label>
            <Input
              id="client_address"
              value={formData.client_address}
              onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Report Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.report_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.report_date ? format(formData.report_date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.report_date}
                    onSelect={(date) => setFormData({ ...formData, report_date: date || new Date() })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="assigned_employee">Assign to Employee</Label>
              <Popover open={employeeOpen} onOpenChange={setEmployeeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={employeeOpen}
                    className={cn(
                      "w-full justify-between",
                      formData.assigned_employee_id && "border-green-500"
                    )}
                  >
                    {formData.assigned_employee_id
                      ? (() => {
                          const emp = employees.find((employee) => employee.id === formData.assigned_employee_id);
                          return emp ? `${emp.name}${emp.branches?.name ? ` (${emp.branches.name})` : ''}` : "Select employee...";
                        })()
                      : "Select employee..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search employees..." />
                    <CommandList>
                      <CommandEmpty>No employee found.</CommandEmpty>
                      <CommandGroup>
                        {employees.map((employee) => (
                          <CommandItem
                            key={employee.id}
                            value={employee.name}
                            onSelect={() => {
                              handleEmployeeChange(employee.id);
                              setEmployeeOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.assigned_employee_id === employee.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {employee.name}
                            {employee.branches?.name && (
                              <span className="ml-2 text-muted-foreground">
                                ({employee.branches.name})
                              </span>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : statement ? 'Update' : 'Create'} Statement
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}