
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { DateTextPicker } from "@/components/ui/date-text-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import countries from "world-countries";
import { determineNationalityStatus } from "@/utils/nationalityStatus";

const COUNTRY_NAMES = countries.map((c) => c.name.common).sort();
interface Document {
  id: string;
  employee_id: string;
  document_type_id: string;
  branch_id: string;
  document_number?: string;
  issue_date?: string;
  expiry_date: string;
  status: string;
  notes?: string;
  country?: string;
  nationality_status?: string;
  employees?: {
    name: string;
    email: string;
    branches?: {
      id: string;
      name: string;
    };
  };
  document_types?: {
    name: string;
  };
}

interface Employee {
  id: string;
  name: string;
  email: string;
  branch_id: string;
  sponsored?: boolean;
  twenty_hours?: boolean;
  branches?: {
    id: string;
    name: string;
  };
}

interface DocumentType {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
}

interface DocumentEditDialogProps {
  document: Document | null;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  employees: Employee[];
  documentTypes: DocumentType[];
  branches: Branch[];
}

export function DocumentEditDialog({ 
  document, 
  open, 
  onClose, 
  onSave,
  employees,
  documentTypes,
  branches
}: DocumentEditDialogProps) {
  const [editDocument, setEditDocument] = useState({
    employee_id: "",
    document_type_id: "",
    branch_id: "",
    document_number: "",
    issue_date: null as Date | string | null,
    expiry_date: null as Date | string | null,
    notes: "",
    country: "",
    nationality_status: ""
  });
  const [sponsored, setSponsored] = useState(false);
  const [twentyHours, setTwentyHours] = useState(false);
  const { toast } = useToast();

  // Helper function to check if a string is a valid date
  const isValidDate = (dateStr: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) && dateStr !== 'N/A' && dateStr !== 'NOT REQUIRED';
  };

  useEffect(() => {
    if (document && open) {
      setEditDocument({
        employee_id: document.employee_id,
        document_type_id: document.document_type_id,
        branch_id: document.branch_id,
        document_number: document.document_number || "",
        issue_date: document.issue_date && isValidDate(document.issue_date) ? new Date(document.issue_date) : document.issue_date,
        expiry_date: document.expiry_date && isValidDate(document.expiry_date) ? new Date(document.expiry_date) : document.expiry_date,
        notes: document.notes || "",
        country: document.country || "",
        nationality_status: document.nationality_status || ""
      });

      // Pre-populate employee status from employee data
      const selectedEmployee = employees.find(emp => emp.id === document.employee_id);
      if (selectedEmployee) {
        setSponsored(selectedEmployee.sponsored || false);
        setTwentyHours(selectedEmployee.twenty_hours || false);
      }
    }
  }, [document, open, employees]);

  const handleEmployeeChange = (employeeId: string) => {
    const selectedEmployee = employees.find(emp => emp.id === employeeId);
    setEditDocument(prev => ({
      ...prev,
      employee_id: employeeId,
      branch_id: selectedEmployee?.branch_id || ""
    }));

    // Update employee status when employee changes
    if (selectedEmployee) {
      setSponsored(selectedEmployee.sponsored || false);
      setTwentyHours(selectedEmployee.twenty_hours || false);
    }
  };

  const handleDocumentTypeChange = async (documentTypeId: string) => {
    setEditDocument(prev => ({
      ...prev,
      document_type_id: documentTypeId
    }));
    
    // Auto-populate fields from existing document of same type for this employee
    if (editDocument.employee_id && documentTypeId) {
      try {
        const { data: existingDoc, error } = await supabase
          .from('document_tracker')
          .select('*')
          .eq('employee_id', editDocument.employee_id)
          .eq('document_type_id', documentTypeId)
          .neq('id', document?.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (existingDoc) {
          setEditDocument(prev => ({
            ...prev,
            document_type_id: documentTypeId,
            document_number: existingDoc.document_number || prev.document_number,
            issue_date: existingDoc.issue_date && isValidDate(existingDoc.issue_date) ? new Date(existingDoc.issue_date) : existingDoc.issue_date,
            notes: existingDoc.notes || prev.notes
          }));
        }
      } catch (error) {
        console.error('Error fetching existing document:', error);
      }
    }
  };

  const handleSave = async () => {
    if (!document || !editDocument.expiry_date) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Handle both Date and string values for dates
      let status = 'valid';
      let expiryDateString = '';
      let issueDateString = '';
      
      // Process expiry date
      if (editDocument.expiry_date instanceof Date) {
        const expiryDate = editDocument.expiry_date;
        const today = new Date();
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
        
        if (daysUntilExpiry < 0) {
          status = 'expired';
        } else if (daysUntilExpiry <= 30) {
          status = 'expiring';
        }
        expiryDateString = new Date(expiryDate.getTime() - expiryDate.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      } else {
        // For text values, save as-is and set status to valid (no calculations)
        expiryDateString = editDocument.expiry_date as string;
        status = 'valid'; // Don't calculate status for text values
      }

      // Process issue date
      if (editDocument.issue_date instanceof Date) {
        issueDateString = new Date(editDocument.issue_date.getTime() - editDocument.issue_date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      } else {
        issueDateString = editDocument.issue_date as string;
      }

      // Update employee sponsored/twenty_hours status if changed
      const selectedEmployee = employees.find(emp => emp.id === editDocument.employee_id);
      if (selectedEmployee && (sponsored !== selectedEmployee.sponsored || twentyHours !== selectedEmployee.twenty_hours)) {
        const { error: updateError } = await supabase
          .from('employees')
          .update({ 
            sponsored: sponsored,
            twenty_hours: twentyHours 
          })
          .eq('id', editDocument.employee_id);

        if (updateError) throw updateError;
      }

      const { error } = await supabase
        .from('document_tracker')
        .update({
          employee_id: editDocument.employee_id,
          document_type_id: editDocument.document_type_id,
          branch_id: editDocument.branch_id,
          document_number: editDocument.document_number || null,
          issue_date: issueDateString || null,
          expiry_date: expiryDateString,
          notes: editDocument.notes || null,
          country: editDocument.country || null,
          nationality_status: editDocument.nationality_status || null,
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', document.id);

      if (error) throw error;

      toast({
        title: "Document updated",
        description: "The document has been updated successfully.",
      });

      onSave();
      onClose();
    } catch (error) {
      console.error('Error updating document:', error);
      toast({
        title: "Error updating document",
        description: "Could not update document. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Document</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Employee</Label>
              <Select
                value={editDocument.employee_id}
                onValueChange={handleEmployeeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} ({emp.branches?.name || 'No Branch'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="document_type">Document Type</Label>
              <Select
                value={editDocument.document_type_id}
                onValueChange={handleDocumentTypeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="document_number">Document Number</Label>
            <Input
              id="document_number"
              value={editDocument.document_number}
              onChange={(e) => setEditDocument(prev => ({ ...prev, document_number: e.target.value }))}
              placeholder="e.g., ABC123456"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Issue Date</Label>
              <DateTextPicker
                value={editDocument.issue_date}
                onChange={(value) => setEditDocument(prev => ({ ...prev, issue_date: value }))}
                placeholder="Pick date or enter text (e.g., N/A)"
              />
            </div>
            <div className="space-y-2">
              <Label>Expiry Date *</Label>
              <DateTextPicker
                value={editDocument.expiry_date}
                onChange={(value) => setEditDocument(prev => ({ ...prev, expiry_date: value }))}
                placeholder="Pick date or enter text (e.g., NOT REQUIRED)"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={editDocument.notes}
              onChange={(e) => setEditDocument(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional information..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={editDocument.country}
              onChange={(e) => setEditDocument(prev => ({ ...prev, country: e.target.value }))}
              placeholder="Country"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nationality_status">Nationality Status</Label>
            <Input
              id="nationality_status"
              value={editDocument.nationality_status}
              onChange={(e) => setEditDocument(prev => ({ ...prev, nationality_status: e.target.value }))}
              placeholder="Nationality Status"
            />
          </div>

          {/* Employee Status Options */}
          <div className="space-y-3 p-4 border rounded-lg bg-gradient-subtle border-primary/20">
            <h4 className="text-sm font-semibold text-foreground">Employee Status</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sponsored-edit"
                  checked={sponsored}
                  onCheckedChange={(checked) => setSponsored(checked === true)}
                />
                <Label htmlFor="sponsored-edit" className="text-sm font-medium cursor-pointer">
                  Sponsored Employee
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="twenty-hours-edit"
                  checked={twentyHours}
                  onCheckedChange={(checked) => setTwentyHours(checked === true)}
                />
                <Label htmlFor="twenty-hours-edit" className="text-sm font-medium cursor-pointer">
                  20 Hours Restriction
                </Label>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-gradient-primary hover:opacity-90">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
