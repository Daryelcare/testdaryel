
import { useState, useEffect, ReactNode } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useCompany } from "@/contexts/CompanyContext";
import SpotCheckFormDialog, { SpotCheckFormData } from "@/components/compliance/SpotCheckFormDialog";
import SupervisionFormDialog, { SupervisionFormData } from "@/components/compliance/SupervisionFormDialog";
import AnnualAppraisalFormDialog, { AnnualAppraisalFormData } from "@/components/compliance/AnnualAppraisalFormDialog";
import { MedicationCompetencyForm } from "@/components/compliance/MedicationCompetencyForm";
import { generateSpotCheckPdf } from "@/lib/spot-check-pdf";
import { generateSupervisionPdf } from "@/lib/supervision-pdf";
import { downloadAnnualAppraisalPDF } from "@/lib/annual-appraisal-pdf";

interface AddComplianceRecordModalProps {
  employeeId?: string;
  employeeName?: string;
  complianceTypeId: string;
  complianceTypeName: string;
  frequency: string;
  periodIdentifier?: string;
  onRecordAdded: () => void;
  trigger?: ReactNode;
}

export function AddComplianceRecordModal({
  employeeId,
  employeeName,
  complianceTypeId,
  complianceTypeName,
  frequency,
  periodIdentifier,
  onRecordAdded,
  trigger
}: AddComplianceRecordModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [completionDate, setCompletionDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState('');
const [recordType, setRecordType] = useState<'date' | 'new' | 'spotcheck' | 'supervision' | 'annualappraisal' | 'medication_competency'>('date');
const [newText, setNewText] = useState('');
const [spotcheckOpen, setSpotcheckOpen] = useState(false);
const [spotcheckData, setSpotcheckData] = useState<SpotCheckFormData | null>(null);
const [supervisionOpen, setSupervisionOpen] = useState(false);
const [supervisionData, setSupervisionData] = useState<SupervisionFormData | null>(null);
const [annualOpen, setAnnualOpen] = useState(false);
const [annualData, setAnnualData] = useState<AnnualAppraisalFormData | null>(null);
const [medicationCompetencyOpen, setMedicationCompetencyOpen] = useState(false);
const [selectedEmployeeId, setSelectedEmployeeId] = useState(employeeId || '');
const [selectedEmployeeName, setSelectedEmployeeName] = useState(employeeName || '');
const [selectedPeriod, setSelectedPeriod] = useState(periodIdentifier || getCurrentPeriodIdentifier(frequency));
  const [employees, setEmployees] = useState<Array<{id: string, name: string, branch_id?: string, branches?: {id: string, name: string}}>>([]);
  const [branches, setBranches] = useState<Array<{id: string, name: string}>>([]);
  const { toast } = useToast();
  const { getAccessibleBranches, isAdmin } = usePermissions();
  const { companySettings } = useCompany();

  // Fetch employees if not provided
  useEffect(() => {
    if (!employeeId) {
      fetchEmployees();
    }
  }, [employeeId]);

  const fetchEmployees = async () => {
    try {
      // Fetch employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select(`
          id, name, branch_id,
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

      // Filter employees based on branch access for non-admin users
      const accessibleBranches = getAccessibleBranches();
      let filteredEmployees = employeesData || [];
      
      if (!isAdmin && accessibleBranches.length > 0) {
        filteredEmployees = employeesData?.filter(employee => {
          return accessibleBranches.includes(employee.branch_id || '');
        }) || [];
      }

      setEmployees(filteredEmployees);
      setBranches(branchesData || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  function getCurrentPeriodIdentifier(freq: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const quarter = Math.ceil(month / 3);

    switch (freq?.toLowerCase()) {
      case 'annual':
        return year.toString();
      case 'monthly':
        return `${year}-${month.toString().padStart(2, '0')}`;
      case 'quarterly':
        return `${year}-Q${quarter}`;
      case 'bi-annual':
        return `${year}-H${month <= 6 ? '1' : '2'}`;
      default:
        return year.toString();
    }
  }

  // Calculate valid date range based on period and frequency
  const getValidDateRange = () => {
    const now = new Date();
    const period = selectedPeriod;
    
    // Add null check for frequency and period
    if (!frequency || !period) {
      console.warn('Frequency or period is undefined, using default year range');
      const currentYear = now.getFullYear();
      return {
        minDate: new Date(currentYear, 0, 1),
        maxDate: now
      };
    }
    
    let minDate: Date;
    let maxDate: Date;
    
    try {
      if (frequency.toLowerCase() === 'annual') {
        // For annual: entire year is selectable
        const year = parseInt(period);
        if (isNaN(year)) throw new Error('Invalid year');
        minDate = new Date(year, 0, 1); // January 1st
        maxDate = new Date(year, 11, 31); // December 31st
      } else if (frequency.toLowerCase() === 'monthly') {
        // For monthly: only that specific month
        const [year, month] = period.split('-');
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);
        if (isNaN(yearNum) || isNaN(monthNum)) throw new Error('Invalid date components');
        const monthIndex = monthNum - 1; // Month is 0-indexed
        minDate = new Date(yearNum, monthIndex, 1);
        maxDate = new Date(yearNum, monthIndex + 1, 0); // Last day of month
      } else if (frequency.toLowerCase() === 'quarterly') {
        // For quarterly: only that specific quarter
        const [year, quarterStr] = period.split('-Q');
        const yearNum = parseInt(year);
        const quarter = parseInt(quarterStr);
        if (isNaN(yearNum) || isNaN(quarter)) throw new Error('Invalid date components');
        const startMonth = (quarter - 1) * 3;
        const endMonth = startMonth + 2;
        minDate = new Date(yearNum, startMonth, 1);
        maxDate = new Date(yearNum, endMonth + 1, 0); // Last day of quarter
      } else if (frequency.toLowerCase() === 'bi-annual') {
        // For bi-annual: the specific half year
        const [year, halfStr] = period.split('-H');
        const yearNum = parseInt(year);
        const half = parseInt(halfStr);
        if (isNaN(yearNum) || isNaN(half)) throw new Error('Invalid date components');
        const startMonth = half === 1 ? 0 : 6;
        const endMonth = half === 1 ? 5 : 11;
        minDate = new Date(yearNum, startMonth, 1);
        maxDate = new Date(yearNum, endMonth + 1, 0); // Last day of half
      } else {
        // Default fallback
        const year = parseInt(period) || now.getFullYear();
        minDate = new Date(year, 0, 1);
        maxDate = new Date(year, 11, 31);
      }
      
      // Validate the dates
      if (!isValid(minDate) || !isValid(maxDate)) {
        throw new Error('Invalid calculated dates');
      }
      
      return { minDate, maxDate };
    } catch (error) {
      console.error('Error calculating date range:', error);
      // Fallback to current year
      const currentYear = now.getFullYear();
      return {
        minDate: new Date(currentYear, 0, 1),
        maxDate: now
      };
    }
  };

  const { minDate, maxDate } = getValidDateRange();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!selectedEmployeeId || !selectedPeriod) {
      toast({
        title: "Missing information",
        description: "Please select an employee and period.",
        variant: "destructive",
      });
      return;
    }
    
    if (recordType === 'date') {
      // Validate date is within the allowed range
      if (!isValid(completionDate) || completionDate < minDate || completionDate > maxDate) {
        const minDateStr = isValid(minDate) ? format(minDate, 'dd/MM/yyyy') : 'Invalid';
        const maxDateStr = isValid(maxDate) ? format(maxDate, 'dd/MM/yyyy') : 'Invalid';
        toast({
          title: "Invalid date",
          description: `Please select a valid date between ${minDateStr} and ${maxDateStr} for this ${frequency?.toLowerCase() || 'compliance'} period.`,
          variant: "destructive",
        });
        return;
      }
    } else if (recordType === 'new') {
      // For "new" type, validate that text is entered
      if (!newText.trim()) {
        toast({
          title: "Text required",
          description: "Please enter text for the new record type.",
          variant: "destructive",
        });
        return;
      }
    } else if (recordType === 'spotcheck') {
      if (!spotcheckData) {
        toast({
          title: "Spot check incomplete",
          description: "Please complete the spot check form.",
          variant: "destructive",
        });
        return;
      }
    } else if (recordType === 'supervision') {
      if (!supervisionData) {
        toast({
          title: "Supervision incomplete",
          description: "Please complete the supervision form.",
          variant: "destructive",
        });
        return;
      }
    } else if (recordType === 'annualappraisal') {
      if (!annualData) {
        toast({
          title: "Annual appraisal incomplete",
          description: "Please complete the annual appraisal form.",
          variant: "destructive",
        });
        return;
      }
    } else if (recordType === 'medication_competency') {
      // Medication competency form doesn't need validation here as it handles its own validation
    }

    setIsLoading(true);

    try {
      // Save spot check form when provided
      if (recordType === 'spotcheck' && spotcheckData) {
        // Serialize observations to plain JSON and loosen the type for Supabase Json
        const observationsPayload: any = spotcheckData.observations
          ? JSON.parse(JSON.stringify(spotcheckData.observations))
          : null;

        await supabase.from('spot_check_records').insert({
          service_user_name: spotcheckData.serviceUserName,
          care_worker1: spotcheckData.careWorker1,
          care_worker2: spotcheckData.careWorker2 || null,
          check_date: spotcheckData.date,
          time_from: spotcheckData.timeFrom,
          time_to: spotcheckData.timeTo,
          carried_by: spotcheckData.carriedBy,
          observations: observationsPayload,
          employee_id: selectedEmployeeId,
          compliance_type_id: complianceTypeId,
          period_identifier: selectedPeriod,
        });
      }

      // Save annual appraisal data (stored in notes field for now until types are updated)
      // TODO: Update Supabase types to include annual_appraisals table

      const recordData = {
        employee_id: selectedEmployeeId,
        compliance_type_id: complianceTypeId,
        period_identifier: selectedPeriod,
        completion_date:
          recordType === 'date'
            ? format(completionDate, 'yyyy-MM-dd')
            : recordType === 'spotcheck'
              ? (spotcheckData?.date || format(new Date(), 'yyyy-MM-dd'))
              : recordType === 'supervision'
                ? (supervisionData?.dateOfSupervision || format(new Date(), 'yyyy-MM-dd'))
              : recordType === 'annualappraisal'
                ? (annualData?.appraisal_date || format(new Date(), 'yyyy-MM-dd'))
                : recordType === 'medication_competency'
                  ? format(new Date(), 'yyyy-MM-dd')
                  : newText,
        completion_method:
          recordType === 'date' ? 'date_entry' : 
          recordType === 'spotcheck' ? 'spotcheck' : 
          recordType === 'supervision' ? 'supervision' : 
          recordType === 'annualappraisal' ? 'annual_appraisal' : 
          recordType === 'medication_competency' ? 'medication_competency' : 'text_entry',
        notes: recordType === 'supervision' 
          ? JSON.stringify({ ...(supervisionData as any), freeTextNotes: notes.trim() || '' }) 
          : recordType === 'annualappraisal'
            ? JSON.stringify({ ...(annualData as any), freeTextNotes: notes.trim() || '' })
            : (notes.trim() || null),
        status: recordType === 'new' ? 'compliant' : (recordType === 'supervision' ? (supervisionData?.officeComplete ? 'completed' : 'pending') : 'completed'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('compliance_period_records')
        .insert(recordData);

      if (error) throw error;

      toast({
        title: "Record added successfully",
        description: `Compliance record for ${selectedEmployeeName || 'employee'} has been added.`,
      });

      setIsOpen(false);
      setCompletionDate(new Date());
      setNotes('');
      setRecordType('date');
      setNewText('');
      onRecordAdded();
    } catch (error) {
      console.error('Error adding compliance record:', error);
      toast({
        title: "Error adding record",
        description: "Could not add compliance record. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const defaultTrigger = (
    <Button>
      Add Compliance Record
    </Button>
  );


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Compliance Record</DialogTitle>
          <DialogDescription>
            Add a new compliance record for {complianceTypeName}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {!employeeId && (
            <div className="space-y-2">
              <Label htmlFor="employee">Employee</Label>
              <Select value={selectedEmployeeId} onValueChange={(value) => {
                setSelectedEmployeeId(value);
                const employee = employees.find(emp => emp.id === value);
                setSelectedEmployeeName(employee?.name || '');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name} ({employee.branches?.name || 'No Branch'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {employeeId && (
            <div className="space-y-2">
              <Label htmlFor="employee">Employee</Label>
              <Input
                id="employee"
                value={selectedEmployeeName}
                disabled
                className="bg-muted"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="period">Period</Label>
            <Input
              id="period"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              placeholder="Enter period identifier"
            />
          </div>

          <div className="space-y-3">
            <Label>Record Type</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                type="button"
                variant={recordType === 'date' ? 'default' : 'outline'}
                onClick={() => setRecordType('date')}
                className="w-full"
              >
                Date
              </Button>
              <Button
                type="button"
                variant={recordType === 'new' ? 'default' : 'outline'}
                onClick={() => setRecordType('new')}
                className="w-full text-center px-2"
              >
                New (before employee joined)
              </Button>
              {complianceTypeName?.toLowerCase().includes('spot') && (
                <Button
                  type="button"
                  variant={recordType === 'spotcheck' ? 'default' : 'outline'}
                  onClick={() => {
                    setRecordType('spotcheck');
                    setSpotcheckOpen(true);
                  }}
                  className="w-full col-span-1 sm:col-span-2"
                >
                  Complete Spot Check
                </Button>
              )}
              {complianceTypeName?.toLowerCase().includes('supervis') && (
                <Button
                  type="button"
                  variant={recordType === 'supervision' ? 'default' : 'outline'}
                  onClick={() => {
                    setRecordType('supervision');
                    setSupervisionOpen(true);
                  }}
                  className="w-full col-span-1 sm:col-span-2"
                >
                  Complete Supervision
                </Button>
              )}
              {complianceTypeName?.toLowerCase().includes('appraisal') && (
                <Button
                  type="button"
                  variant={recordType === 'annualappraisal' ? 'default' : 'outline'}
                  onClick={() => {
                    setRecordType('annualappraisal');
                    setAnnualOpen(true);
                  }}
                  className="w-full col-span-1 sm:col-span-2"
                >
                  Complete Annual Appraisal
                </Button>
              )}
              {complianceTypeName?.toLowerCase().includes('medication') && (
                <Button
                  type="button"
                  variant={recordType === 'medication_competency' ? 'default' : 'outline'}
                  onClick={() => {
                    setRecordType('medication_competency');
                    setMedicationCompetencyOpen(true);
                  }}
                  className="w-full col-span-1 sm:col-span-2"
                >
                  Complete Medication Competency
                </Button>
              )}
            </div>
          </div>

          {recordType === 'date' ? (
            <div className="space-y-2">
              <Label>Completion Date</Label>
              {isValid(minDate) && isValid(maxDate) && (
                <p className="text-sm text-muted-foreground mb-2">
                  Valid range for {frequency?.toLowerCase() || 'compliance'} period: {format(minDate, 'dd/MM/yyyy')} - {format(maxDate, 'dd/MM/yyyy')}
                </p>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !completionDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {completionDate && isValid(completionDate) ? format(completionDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={completionDate}
                    onSelect={(date) => date && setCompletionDate(date)}
                    disabled={(date) => !isValid(minDate) || !isValid(maxDate) || date < minDate || date > maxDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          ) : recordType === 'new' ? (
            <div className="space-y-2">
              <Label htmlFor="newText">Text</Label>
              <Input
                id="newText"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Enter text (e.g., 'new', 'N/A', etc.)"
              />
              <p className="text-sm text-muted-foreground">
                This text will be stored as the completion date.
              </p>
            </div>
          ) : null}


          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            {recordType === 'spotcheck' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => spotcheckData ? generateSpotCheckPdf(spotcheckData, companySettings) : undefined}
                disabled={!spotcheckData}
              >
                Download PDF
              </Button>
            )}
            {recordType === 'supervision' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => supervisionData ? generateSupervisionPdf(supervisionData, companySettings) : undefined}
                disabled={!supervisionData}
              >
                Download PDF
              </Button>
            )}
            {recordType === 'annualappraisal' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => annualData ? downloadAnnualAppraisalPDF(annualData, selectedEmployeeName, { name: companySettings?.name, logo: companySettings?.logo }) : undefined}
                disabled={!annualData}
              >
                Download PDF
              </Button>
            )}
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Adding..." : "Add Record"}
            </Button>
          </div>
        </form>
      </DialogContent>
      <SpotCheckFormDialog
        open={spotcheckOpen}
        onOpenChange={setSpotcheckOpen}
        periodIdentifier={selectedPeriod}
        frequency={frequency}
        onSubmit={(data) => {
          setSpotcheckData(data);
          setSpotcheckOpen(false);
        }}
        employeeName={employeeName}
      />
      <SupervisionFormDialog
        open={supervisionOpen}
        onOpenChange={setSupervisionOpen}
        initialData={supervisionData || undefined}
        employeeName={selectedEmployeeName}
        periodIdentifier={selectedPeriod}
        frequency={frequency}
        onSubmit={(data) => {
          setSupervisionData(data);
          setSupervisionOpen(false);
        }}
      />
      <AnnualAppraisalFormDialog
        open={annualOpen}
        onOpenChange={setAnnualOpen}
        initialData={annualData || undefined}
        employeeName={selectedEmployeeName}
        onSubmit={(data) => {
          setAnnualData(data);
          setAnnualOpen(false);
        }}
      />
      {medicationCompetencyOpen && (
        <Dialog open={medicationCompetencyOpen} onOpenChange={setMedicationCompetencyOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Medication Competency Assessment</DialogTitle>
              <DialogDescription>
                Complete the medication administration competency assessment for {selectedEmployeeName}
              </DialogDescription>
            </DialogHeader>
            <MedicationCompetencyForm
              complianceTypeId={complianceTypeId}
              employeeId={selectedEmployeeId}
              employeeName={selectedEmployeeName}
              periodIdentifier={selectedPeriod}
              onComplete={() => {
                setMedicationCompetencyOpen(false);
                onRecordAdded();
                setIsOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
