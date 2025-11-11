
import { useState, ReactNode } from "react";
import { CalendarIcon, Download } from "lucide-react";
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
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import AnnualAppraisalFormDialog, { type AnnualAppraisalFormData } from "./AnnualAppraisalFormDialog";
import { downloadAnnualAppraisalPDF } from "@/lib/annual-appraisal-pdf";
import { generateMedicationCompetencyPdf } from "@/lib/medication-competency-pdf";
import { MedicationCompetencyForm } from "./MedicationCompetencyForm";

interface ComplianceRecord {
  id: string;
  employee_id: string;
  period_identifier: string;
  completion_date: string;
  notes: string;
  form_data?: any | null;
  status: string;
  created_at: string;
  updated_at: string;
  completed_by: string | null;
  completion_method?: string;
}

interface EditComplianceRecordModalProps {
  record: ComplianceRecord;
  employeeName: string;
  complianceTypeName: string;
  frequency: string;
  onRecordUpdated: () => void;
  trigger: ReactNode;
}

export function EditComplianceRecordModal({
  record,
  employeeName,
  complianceTypeName,
  frequency,
  onRecordUpdated,
  trigger
}: EditComplianceRecordModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Safely parse the completion date with fallback
  const parseCompletionDate = (dateString: string): Date => {
    const parsed = new Date(dateString);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };
  
  const [completionDate, setCompletionDate] = useState<Date>(parseCompletionDate(record.completion_date));
  const [notes, setNotes] = useState(() => {
    // For annual appraisals, extract freeTextNotes from JSON
    if (record.completion_method === 'annual_appraisal' && record.notes) {
      try {
        const parsed = JSON.parse(record.notes);
        return parsed.freeTextNotes || '';
      } catch (e) {
        console.error('Error parsing annual appraisal notes:', e);
      }
    }
    return record.notes || '';
  });
  const [recordType, setRecordType] = useState<'date' | 'new' | 'annualappraisal' | 'medicationcompetency'>(() => {
    if (record.completion_method === 'annual_appraisal') return 'annualappraisal';
    if (record.completion_method === 'questionnaire' && record.form_data) return 'medicationcompetency';
    return 'date';
  });
  const [newText, setNewText] = useState('');
  const [annualData, setAnnualData] = useState<AnnualAppraisalFormData | null>(() => {
    // Parse existing annual appraisal data from notes if available
    try {
      if (record.completion_method === 'annual_appraisal' && record.notes) {
        const parsed = JSON.parse(record.notes);
        if (parsed.job_title && parsed.ratings) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error parsing annual appraisal data:', e);
    }
    return null;
  });
  const [annualOpen, setAnnualOpen] = useState(false);
  const [medicationData, setMedicationData] = useState<any | null>(() => {
    // Parse existing medication competency data from form_data if available
    try {
      if (record.form_data && typeof record.form_data === 'object') {
        return record.form_data;
      }
    } catch (e) {
      console.error('Error parsing medication competency data:', e);
    }
    return null;
  });
  const [medicationOpen, setMedicationOpen] = useState(false);
  const { toast } = useToast();
  const { companySettings } = useCompany();

  // Calculate valid date range based on period and frequency
  const getValidDateRange = () => {
    const now = new Date();
    const period = record.period_identifier;
    
    // Add null check for frequency
    if (!frequency) {
      console.warn('Frequency is undefined, using default year range');
      const currentYear = now.getFullYear();
      return {
        minDate: new Date(currentYear, 0, 1),
        maxDate: now
      };
    }
    
    let minDate: Date;
    let maxDate: Date;
    
    if (frequency.toLowerCase() === 'annual') {
      // For annual: entire year is selectable (not limited to today)
      const year = parseInt(period);
      minDate = new Date(year, 0, 1); // January 1st
      maxDate = new Date(year, 11, 31); // December 31st
    } else if (frequency.toLowerCase() === 'monthly') {
      // For monthly: only that specific month
      const [year, month] = period.split('-');
      const monthIndex = parseInt(month) - 1; // Month is 0-indexed
      minDate = new Date(parseInt(year), monthIndex, 1);
      maxDate = new Date(parseInt(year), monthIndex + 1, 0); // Last day of month
    } else if (frequency.toLowerCase() === 'quarterly') {
      // For quarterly: only that specific quarter
      const [year, quarter] = period.split('-Q');
      const quarterNum = parseInt(quarter);
      const startMonth = (quarterNum - 1) * 3;
      const endMonth = startMonth + 2;
      minDate = new Date(parseInt(year), startMonth, 1);
      maxDate = new Date(parseInt(year), endMonth + 1, 0); // Last day of quarter
    } else if (frequency.toLowerCase() === 'bi-annual') {
      // For bi-annual: the specific half year
      const [year, half] = period.split('-H');
      const halfNum = parseInt(half);
      const startMonth = halfNum === 1 ? 0 : 6;
      const endMonth = halfNum === 1 ? 5 : 11;
      minDate = new Date(parseInt(year), startMonth, 1);
      maxDate = new Date(parseInt(year), endMonth + 1, 0); // Last day of half
    } else {
      // Default fallback
      const year = parseInt(period);
      minDate = new Date(year, 0, 1);
      maxDate = new Date(year, 11, 31);
    }
    
    return { minDate, maxDate };
  };

  const { minDate, maxDate } = getValidDateRange();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (recordType === 'date') {
      // Validate date is within the allowed range
      if (completionDate < minDate || completionDate > maxDate) {
        toast({
          title: "Invalid date",
          description: `Please select a date between ${format(minDate, 'dd/MM/yyyy')} and ${format(maxDate, 'dd/MM/yyyy')} for this ${frequency?.toLowerCase() || 'compliance'} period.`,
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
    } else if (recordType === 'annualappraisal') {
      // For annual appraisal, validate that the form data exists
      if (!annualData) {
        toast({
          title: "Annual appraisal incomplete",
          description: "Please complete the annual appraisal form.",
          variant: "destructive",
        });
        return;
      }
    } else if (recordType === 'medicationcompetency') {
      // For medication competency, validate that the form data exists
      if (!medicationData) {
        toast({
          title: "Medication competency incomplete",
          description: "Please complete the medication competency form.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);

    try {
      // TODO: When authentication is implemented, get the current user ID
      // const { data: { user } } = await supabase.auth.getUser();
      
      const updateData: any = {
        completion_date: recordType === 'date' 
          ? format(completionDate, 'yyyy-MM-dd') 
          : recordType === 'annualappraisal'
            ? (annualData?.appraisal_date || format(new Date(), 'yyyy-MM-dd'))
            : recordType === 'medicationcompetency'
              ? format(new Date(), 'yyyy-MM-dd')
              : newText,
        notes: recordType === 'annualappraisal'
          ? JSON.stringify({ ...(annualData as any), freeTextNotes: notes.trim() || '' })
          : recordType === 'medicationcompetency'
            ? (notes.trim() || null)
            : (notes.trim() || null),
        updated_at: new Date().toISOString(),
        status: recordType === 'new' ? 'new' : 'completed',
        completion_method: recordType === 'date' ? 'date_entry' : 
                          recordType === 'annualappraisal' ? 'annual_appraisal' :
                          recordType === 'medicationcompetency' ? 'questionnaire' : 'text_entry',
        // TODO: When authentication is implemented, uncomment this line:
        // completed_by: user?.id || null,
      };

      // Add form_data for medication competency
      if (recordType === 'medicationcompetency' && medicationData) {
        updateData.form_data = medicationData;
      }

      const { error } = await supabase
        .from('compliance_period_records')
        .update(updateData)
        .eq('id', record.id);

      if (error) throw error;

      toast({
        title: "Record updated successfully",
        description: `Compliance record for ${employeeName} has been updated.`,
      });

      setIsOpen(false);
      onRecordUpdated();
    } catch (error) {
      console.error('Error updating compliance record:', error);
      toast({
        title: "Error updating record",
        description: "Could not update compliance record. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle trigger click directly instead of nesting dialogs
  const handleTriggerClick = () => {
    setIsOpen(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <div onClick={handleTriggerClick} className="contents">
        {trigger}
      </div>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Compliance Record</DialogTitle>
          <DialogDescription>
            Edit the compliance record for {employeeName} - {complianceTypeName}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employee">Employee</Label>
            <Input
              id="employee"
              value={employeeName}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="period">Period</Label>
            <Input
              id="period"
              value={record.period_identifier}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label>Record Type</Label>
            <Select value={recordType} onValueChange={(value: 'date' | 'new' | 'annualappraisal' | 'medicationcompetency') => setRecordType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="new">New (before employee joined)</SelectItem>
                {complianceTypeName?.toLowerCase().includes('appraisal') && (
                  <SelectItem value="annualappraisal">Annual Appraisal</SelectItem>
                )}
                {complianceTypeName?.toLowerCase().includes('medication') && (
                  <SelectItem value="medicationcompetency">Medication Competency</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {recordType === 'date' ? (
            <div className="space-y-2">
              <Label>Completion Date</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Valid range for {frequency?.toLowerCase() || 'compliance'} period: {format(minDate, 'dd/MM/yyyy')} - {format(maxDate, 'dd/MM/yyyy')}
              </p>
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
                    {completionDate ? format(completionDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={completionDate}
                    onSelect={(date) => date && setCompletionDate(date)}
                    disabled={(date) => date < minDate || date > maxDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          ) : recordType === 'annualappraisal' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Annual Appraisal Form</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAnnualOpen(true)}
                  >
                    {annualData ? 'Edit Form' : 'Complete Form'}
                  </Button>
                  {annualData && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => downloadAnnualAppraisalPDF(annualData, employeeName, { name: companySettings?.name, logo: companySettings?.logo })}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      PDF
                    </Button>
                  )}
                </div>
              </div>
              {annualData ? (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">
                    ✓ Annual appraisal completed for {annualData.job_title} on {annualData.appraisal_date}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-destructive/10 rounded-md">
                  <p className="text-sm text-destructive">
                    Annual appraisal form needs to be completed
                  </p>
                </div>
              )}
            </div>
          ) : recordType === 'medicationcompetency' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Medication Competency Form</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMedicationOpen(true)}
                  >
                    {medicationData ? 'Edit Form' : 'Complete Form'}
                  </Button>
                  {medicationData && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => generateMedicationCompetencyPdf(medicationData, { name: companySettings?.name, logo: companySettings?.logo })}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      PDF
                    </Button>
                  )}
                </div>
              </div>
              {medicationData ? (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">
                    ✓ Medication competency completed - {medicationData.competencyItems?.filter((c: any) => c.competent === 'yes').length || 0} competent items
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-destructive/10 rounded-md">
                  <p className="text-sm text-destructive">
                    Medication competency form needs to be completed
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="newText">Text</Label>
              <Input
                id="newText"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Enter text (e.g., 'new', 'N/A', etc.)"
              />
            </div>
          )}

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
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update Record"}
            </Button>
          </div>
        </form>
        
        <AnnualAppraisalFormDialog
          open={annualOpen}
          onOpenChange={setAnnualOpen}
          initialData={annualData || undefined}
          employeeName={employeeName}
          onSubmit={(data) => {
            setAnnualData(data);
            setAnnualOpen(false);
          }}
        />

        <Dialog open={medicationOpen} onOpenChange={setMedicationOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Medication Competency Form</DialogTitle>
              <DialogDescription>
                Complete or edit the medication competency assessment
              </DialogDescription>
            </DialogHeader>
            <MedicationCompetencyForm
              complianceTypeId=""
              employeeId={record.employee_id}
              employeeName={employeeName}
              periodIdentifier={record.period_identifier}
              initialData={medicationData}
              recordId={record.id}
              onComplete={() => {
                setMedicationOpen(false);
                onRecordUpdated();
              }}
            />
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
