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
import ClientSpotCheckFormDialog, { ClientSpotCheckFormData } from "@/components/clients/ClientSpotCheckFormDialog";

interface AddClientComplianceRecordModalProps {
  clientId?: string;
  clientName?: string;
  complianceTypeId: string;
  complianceTypeName: string;
  frequency: string;
  periodIdentifier?: string;
  onRecordAdded: () => void;
  trigger?: ReactNode;
}

export function AddClientComplianceRecordModal({
  clientId,
  clientName,
  complianceTypeId,
  complianceTypeName,
  frequency,
  periodIdentifier,
  onRecordAdded,
  trigger
}: AddClientComplianceRecordModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [completionDate, setCompletionDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState('');
  const [recordType, setRecordType] = useState<'date' | 'new' | 'spotcheck'>('date');
  const [newText, setNewText] = useState('');
  const [spotcheckOpen, setSpotcheckOpen] = useState(false);
  const [spotcheckData, setSpotcheckData] = useState<ClientSpotCheckFormData | null>(null);
  const [selectedClientId, setSelectedClientId] = useState(clientId || '');
  const [selectedClientName, setSelectedClientName] = useState(clientName || '');
  const [selectedPeriod, setSelectedPeriod] = useState(periodIdentifier || getCurrentPeriodIdentifier(frequency));
  const [clients, setClients] = useState<Array<{id: string, name: string}>>([]);
  const { toast } = useToast();
  const { getAccessibleBranches, isAdmin } = usePermissions();
  const { companySettings } = useCompany();

  // Fetch clients if not provided
  useEffect(() => {
    if (!clientId) {
      fetchClients();
    }
  }, [clientId]);

  const fetchClients = async () => {
    try {
      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      
      if (clientsError) throw clientsError;

      setClients(clientsData || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
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
    
    if (!frequency || !period) {
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
        const year = parseInt(period);
        if (isNaN(year)) throw new Error('Invalid year');
        minDate = new Date(year, 0, 1);
        maxDate = new Date(year, 11, 31);
      } else if (frequency.toLowerCase() === 'monthly') {
        const [year, month] = period.split('-');
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);
        if (isNaN(yearNum) || isNaN(monthNum)) throw new Error('Invalid date components');
        const monthIndex = monthNum - 1;
        minDate = new Date(yearNum, monthIndex, 1);
        maxDate = new Date(yearNum, monthIndex + 1, 0);
      } else if (frequency.toLowerCase() === 'quarterly') {
        const [year, quarterStr] = period.split('-Q');
        const yearNum = parseInt(year);
        const quarter = parseInt(quarterStr);
        if (isNaN(yearNum) || isNaN(quarter)) throw new Error('Invalid date components');
        const startMonth = (quarter - 1) * 3;
        const endMonth = startMonth + 2;
        minDate = new Date(yearNum, startMonth, 1);
        maxDate = new Date(yearNum, endMonth + 1, 0);
      } else if (frequency.toLowerCase() === 'bi-annual') {
        const [year, halfStr] = period.split('-H');
        const yearNum = parseInt(year);
        const half = parseInt(halfStr);
        if (isNaN(yearNum) || isNaN(half)) throw new Error('Invalid date components');
        const startMonth = half === 1 ? 0 : 6;
        const endMonth = half === 1 ? 5 : 11;
        minDate = new Date(yearNum, startMonth, 1);
        maxDate = new Date(yearNum, endMonth + 1, 0);
      } else {
        const year = parseInt(period) || now.getFullYear();
        minDate = new Date(year, 0, 1);
        maxDate = new Date(year, 11, 31);
      }
      
      if (!isValid(minDate) || !isValid(maxDate)) {
        throw new Error('Invalid calculated dates');
      }
      
      return { minDate, maxDate };
    } catch (error) {
      console.error('Error calculating date range:', error);
      const currentYear = now.getFullYear();
      return {
        minDate: new Date(currentYear, 0, 1),
        maxDate: now
      };
    }
  };

  const { minDate, maxDate } = getValidDateRange();

  // Handle spot check submission directly with data
  const handleSubmitWithSpotCheck = async (spotCheckData: ClientSpotCheckFormData) => {
    if (!selectedClientId || !selectedPeriod) {
      toast({
        title: "Missing information",
        description: "Please select a client and period.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // First, check if a compliance record already exists
      const { data: existingRecord, error: checkError } = await supabase
        .from('client_compliance_period_records')
        .select('id')
        .eq('client_compliance_type_id', complianceTypeId)
        .eq('client_id', selectedClientId)
        .eq('period_identifier', selectedPeriod)
        .maybeSingle();

      if (checkError) throw checkError;

      // Save spot check form
      const observationsPayload: any = spotCheckData.observations
        ? JSON.parse(JSON.stringify(spotCheckData.observations))
        : null;

      await supabase.from('client_spot_check_records').insert({
        service_user_name: spotCheckData.serviceUserName,
        care_workers: spotCheckData.completedBy,
        date: spotCheckData.date,
        time: new Date().toTimeString().slice(0, 5),
        performed_by: spotCheckData.completedBy,
        observations: observationsPayload,
        client_id: selectedClientId,
        compliance_record_id: existingRecord?.id || null,
      });

      if (existingRecord) {
        // UPDATE existing record
        const { error: updateError } = await supabase
          .from('client_compliance_period_records')
          .update({
            status: 'completed',
            completion_date: spotCheckData.date,
            completion_method: 'spotcheck',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRecord.id);

        if (updateError) throw updateError;
      } else {
        // INSERT new record (for backwards compatibility if automation didn't run)
        const { error: insertError } = await supabase
          .from('client_compliance_period_records')
          .insert({
            client_compliance_type_id: complianceTypeId,
            client_id: selectedClientId,
            period_identifier: selectedPeriod,
            status: 'completed',
            completion_date: spotCheckData.date,
            completion_method: 'spotcheck',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (insertError) throw insertError;
      }

      toast({
        title: "Success",
        description: "Spot check record has been saved successfully.",
      });

      onRecordAdded();
      setIsOpen(false);
      setCompletionDate(new Date());
      setNotes('');
      setRecordType('date');
      setNewText('');
      setSpotcheckData(null);
    } catch (error) {
      console.error('Error saving spot check:', error);
      toast({
        title: "Error",
        description: "Could not save the spot check record. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedClientId || !selectedPeriod) {
      toast({
        title: "Missing information",
        description: "Please select a client and period.",
        variant: "destructive",
      });
      return;
    }
    
    if (recordType === 'date') {
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
      if (!newText.trim()) {
        toast({
          title: "Text required",
          description: "Please enter text for the new record type.",
          variant: "destructive",
        });
        return;
      }
    } else if (recordType === 'spotcheck') {
      toast({
        title: "Spot check form required",
        description: "Please complete the spot check form first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Check if a compliance record already exists
      const { data: existingRecord, error: checkError } = await supabase
        .from('client_compliance_period_records')
        .select('id')
        .eq('client_compliance_type_id', complianceTypeId)
        .eq('client_id', selectedClientId)
        .eq('period_identifier', selectedPeriod)
        .maybeSingle();

      if (checkError) throw checkError;

      const recordData = {
        status: 'completed',
        completion_date: recordType === 'date' ? format(completionDate, 'yyyy-MM-dd') : newText,
        completion_method: recordType === 'date' ? 'date_entry' : 'text_entry',
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (existingRecord) {
        // UPDATE existing record
        const { error: updateError } = await supabase
          .from('client_compliance_period_records')
          .update(recordData)
          .eq('id', existingRecord.id);

        if (updateError) throw updateError;
      } else {
        // INSERT new record
        const { error: insertError } = await supabase
          .from('client_compliance_period_records')
          .insert({
            ...recordData,
            client_compliance_type_id: complianceTypeId,
            client_id: selectedClientId,
            period_identifier: selectedPeriod,
            created_at: new Date().toISOString(),
          });

        if (insertError) throw insertError;
      }

      toast({
        title: "Record added successfully",
        description: `Compliance record for ${selectedClientName || 'client'} has been added.`,
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
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          {trigger || defaultTrigger}
        </DialogTrigger>
        <DialogContent className="w-[95vw] max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Client Compliance Record</DialogTitle>
            <DialogDescription>
              Add a new compliance record for {complianceTypeName}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {!clientId && (
              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <Select value={selectedClientId} onValueChange={(value) => {
                  setSelectedClientId(value);
                  const client = clients.find(cli => cli.id === value);
                  setSelectedClientName(client?.name || '');
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {clientId && (
              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <Input
                  id="client"
                  value={selectedClientName}
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
                  New (before client joined)
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
              </div>
            </div>

            {recordType === 'date' && (
              <div className="space-y-2">
                <Label>Completion Date</Label>
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
                      {completionDate ? format(completionDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={completionDate}
                      onSelect={(date) => date && setCompletionDate(date)}
                      disabled={(date) =>
                        date > new Date() || 
                        date < minDate || 
                        date > maxDate
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-sm text-muted-foreground">
                  Date must be between {format(minDate, 'dd/MM/yyyy')} and {format(maxDate, 'dd/MM/yyyy')}
                </p>
              </div>
            )}

            {recordType === 'new' && (
              <div className="space-y-2">
                <Label htmlFor="newText">Record Text</Label>
                <Input
                  id="newText"
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="Enter record information"
                  required
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
                {isLoading ? "Adding..." : "Add Record"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Client Spot Check Dialog */}
      <ClientSpotCheckFormDialog
        open={spotcheckOpen}
        onOpenChange={(open) => {
          setSpotcheckOpen(open);
          if (!open) {
            setSpotcheckData(null);
          }
        }}
        onSubmit={async (data) => {
          setSpotcheckData(data);
          setSpotcheckOpen(false);
          // Directly call submit with the spot check data
          await handleSubmitWithSpotCheck(data);
        }}
        periodIdentifier={selectedPeriod}
        frequency={frequency}
        clientName={selectedClientName}
      />
    </>
  );
}