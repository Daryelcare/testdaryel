import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateTextPicker } from "@/components/ui/date-text-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, CheckCircle, Clock, Edit2, Save, X } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePagePermissions } from "@/hooks/usePagePermissions";
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

interface DocumentViewDialogProps {
  document: Document | null;
  open: boolean;
  onClose: () => void;
}

export function DocumentViewDialog({ document, open, onClose }: DocumentViewDialogProps) {
  const [employeeDocuments, setEmployeeDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingDocument, setEditingDocument] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [editingEmployeeInfo, setEditingEmployeeInfo] = useState(false);
  const [employeeInfoValues, setEmployeeInfoValues] = useState({
    country: '',
    nationality_status: '',
    sponsored: false,
    twenty_hours: false
  });
  const [employeeData, setEmployeeData] = useState<any>(null);
  const { toast } = useToast();
  const { canEditDocuments } = usePagePermissions();

  useEffect(() => {
    if (document && open) {
      fetchEmployeeDocuments(document.employee_id);
    }
  }, [document, open]);

  const fetchEmployeeDocuments = async (employeeId: string) => {
    setLoading(true);
    try {
      // Fetch the single tracker row for this employee
      const { data: trackerData, error } = await supabase
        .from('document_tracker')
        .select('*')
        .eq('employee_id', employeeId)
        .single();

      if (error) throw error;

      // Fetch employee data for sponsored and twenty_hours
      const { data: empData } = await supabase
        .from('employees')
        .select('sponsored, twenty_hours')
        .eq('id', employeeId)
        .single();

      if (empData) {
        setEmployeeData(empData);
        setEmployeeInfoValues({
          country: trackerData?.country || '',
          nationality_status: trackerData?.nationality_status || '',
          sponsored: empData.sponsored || false,
          twenty_hours: empData.twenty_hours || false
        });
      }

      if (trackerData && trackerData.documents) {
        // Extract documents from JSONB array
        const docsArray = trackerData.documents as any[];
        
        // Fetch document type names for each document
        const documentsWithTypes = await Promise.all(
          docsArray.map(async (doc: any) => {
            const { data: docType } = await supabase
              .from('document_types')
              .select('name')
              .eq('id', doc.document_type_id)
              .single();
            
            return {
              ...doc,
              employee_id: trackerData.employee_id,
              branch_id: trackerData.branch_id,
              country: trackerData.country,
              nationality_status: trackerData.nationality_status,
              document_types: docType ? { name: docType.name } : null
            };
          })
        );
        
        setEmployeeDocuments(documentsWithTypes);
      } else {
        setEmployeeDocuments([]);
      }
    } catch (error) {
      console.error('Error fetching employee documents:', error);
      setEmployeeDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (docId: string, doc: Document) => {
    setEditingDocument(docId);
    setEditValues({
      document_number: doc.document_number || '',
      issue_date: doc.issue_date || null,
      expiry_date: doc.expiry_date || null
    });
  };

  const cancelEdit = () => {
    setEditingDocument(null);
    setEditValues({});
  };

  const saveEdit = async (docId: string) => {
    try {
      if (!document) return;

      // Find the document being edited to get its document_type_id
      const docToEdit = employeeDocuments.find(d => d.id === docId);
      if (!docToEdit) return;

      // Handle both Date and string values for dates
      let expiryDateValue = '';
      let issueDateValue = '';
      
      // Process expiry date
      if (editValues.expiry_date instanceof Date) {
        expiryDateValue = new Date(editValues.expiry_date.getTime() - editValues.expiry_date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      } else {
        expiryDateValue = editValues.expiry_date as string;
      }

      // Process issue date
      if (editValues.issue_date instanceof Date) {
        issueDateValue = new Date(editValues.issue_date.getTime() - editValues.issue_date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      } else {
        issueDateValue = editValues.issue_date as string;
      }

      // Build the document object for upsert
      const documentData = {
        id: docId,
        document_type_id: docToEdit.document_type_id,
        document_number: editValues.document_number || null,
        issue_date: issueDateValue || null,
        expiry_date: expiryDateValue
      };

      // Use the RPC function to update the document in the JSONB array
      const { error } = await supabase.rpc('upsert_employee_document', {
        p_employee_id: document.employee_id,
        p_document: documentData,
        p_country: document.country || null,
        p_nationality_status: document.nationality_status || null,
        p_branch_id: document.branch_id
      });

      if (error) throw error;

      toast({
        title: "Document updated",
        description: "Document details updated successfully.",
      });

      setEditingDocument(null);
      setEditValues({});
      
      // Refresh the documents in the modal
      await fetchEmployeeDocuments(document.employee_id);
      
      // Trigger a page refresh to update the main table
      window.dispatchEvent(new Event('document-updated'));
    } catch (error) {
      console.error('Error updating document:', error);
      toast({
        title: "Error",
        description: "Failed to update document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const startEditingEmployeeInfo = () => {
    setEditingEmployeeInfo(true);
    setEmployeeInfoValues({
      country: document?.country || '',
      nationality_status: document?.nationality_status || '',
      sponsored: employeeData?.sponsored || false,
      twenty_hours: employeeData?.twenty_hours || false
    });
  };

  const cancelEmployeeInfoEdit = () => {
    setEditingEmployeeInfo(false);
  };

  const saveEmployeeInfo = async () => {
    try {
      if (!document) return;

      // Update document_tracker for country and nationality_status
      const { error: trackerError } = await supabase.rpc('upsert_employee_document', {
        p_employee_id: document.employee_id,
        p_document: null,
        p_country: employeeInfoValues.country || null,
        p_nationality_status: employeeInfoValues.nationality_status || null,
        p_branch_id: document.branch_id
      });

      if (trackerError) throw trackerError;

      // Update employees table for sponsored and twenty_hours
      const { error: employeeError } = await supabase
        .from('employees')
        .update({
          sponsored: employeeInfoValues.sponsored,
          twenty_hours: employeeInfoValues.twenty_hours
        })
        .eq('id', document.employee_id);

      if (employeeError) throw employeeError;

      toast({
        title: "Employee info updated",
        description: "Employee document information updated successfully.",
      });

      setEditingEmployeeInfo(false);
      
      // Refresh the documents in the modal
      await fetchEmployeeDocuments(document.employee_id);
      
      // Trigger a page refresh to update the main table
      window.dispatchEvent(new Event('document-updated'));
    } catch (error) {
      console.error('Error updating employee info:', error);
      toast({
        title: "Error",
        description: "Failed to update employee information. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCountryChange = (country: string) => {
    const status = determineNationalityStatus(country);
    setEmployeeInfoValues({
      ...employeeInfoValues,
      country,
      nationality_status: status
    });
  };

  if (!document) return null;

  const getStatusBadge = (document: Document) => {
    // If expiry_date is not a valid date (text entry), show as valid
    if (isNaN(Date.parse(document.expiry_date))) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        Valid
      </Badge>;
    }

    const expiryDate = new Date(document.expiry_date);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (daysUntilExpiry < 0) {
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Expired
      </Badge>;
    } else if (daysUntilExpiry <= 30) {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
        <Clock className="w-3 h-3 mr-1" />
        Expiring ({daysUntilExpiry} days)
      </Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        Valid
      </Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Document Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Employee Information - Read Only */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Employee</label>
              <p className="text-sm font-medium">{document.employees?.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="text-sm">{document.employees?.email || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Branch</label>
              <p className="text-sm">{document.employees?.branches?.name || 'No Branch'}</p>
            </div>
          </div>

          {/* Employee Document Information */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Employee Document Information</h3>
              {!editingEmployeeInfo && canEditDocuments() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startEditingEmployeeInfo}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>

            {editingEmployeeInfo ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Country</label>
                    <Select
                      value={employeeInfoValues.country}
                      onValueChange={handleCountryChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {COUNTRY_NAMES.map((country) => (
                          <SelectItem key={country} value={country}>
                            {country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nationality Status</label>
                    <Select
                      value={employeeInfoValues.nationality_status}
                      onValueChange={(value) => setEmployeeInfoValues({...employeeInfoValues, nationality_status: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="British">British</SelectItem>
                        <SelectItem value="EU">EU</SelectItem>
                        <SelectItem value="Non-EU">Non-EU</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sponsored"
                      checked={employeeInfoValues.sponsored}
                      onCheckedChange={(checked) => setEmployeeInfoValues({...employeeInfoValues, sponsored: checked as boolean})}
                    />
                    <label
                      htmlFor="sponsored"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Sponsored
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="twenty_hours"
                      checked={employeeInfoValues.twenty_hours}
                      onCheckedChange={(checked) => setEmployeeInfoValues({...employeeInfoValues, twenty_hours: checked as boolean})}
                    />
                    <label
                      htmlFor="twenty_hours"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      20 Hours Restriction
                    </label>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={saveEmployeeInfo}
                    className="bg-gradient-primary hover:opacity-90"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelEmployeeInfoEdit}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Country</label>
                  <p className="text-sm">{document.country || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nationality Status</label>
                  <p className="text-sm">{document.nationality_status || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Sponsored</label>
                  <p className="text-sm">{employeeData?.sponsored ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">20 Hours Restriction</label>
                  <p className="text-sm">{employeeData?.twenty_hours ? 'Yes' : 'No'}</p>
                </div>
              </div>
            )}
          </div>

          {/* All Document Types for Employee */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">All Document Types</label>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading documents...</p>
            ) : (
              <div className="space-y-4 mt-2">
                {employeeDocuments.map((doc) => (
                  <div key={doc.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{doc.document_types?.name}</h4>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(doc)}
                        {editingDocument !== doc.id && canEditDocuments() && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditing(doc.id, doc)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {editingDocument === doc.id ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Document Number</label>
                            <Input
                              value={editValues.document_number || ''}
                              onChange={(e) => setEditValues({...editValues, document_number: e.target.value})}
                              placeholder="e.g., ABC123456"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Expiry Date</label>
                            <DateTextPicker
                              value={editValues.expiry_date}
                              onChange={(value) => setEditValues({...editValues, expiry_date: value})}
                              placeholder="Pick date or enter text"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Issue Date</label>
                          <DateTextPicker
                            value={editValues.issue_date}
                            onChange={(value) => setEditValues({...editValues, issue_date: value})}
                            placeholder="Pick date or enter text"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveEdit(doc.id)}
                            className="bg-gradient-primary hover:opacity-90"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelEdit}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Document Number:</span>
                            <p className="font-mono">{doc.document_number || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Expiry Date:</span>
                            <p>{isNaN(Date.parse(doc.expiry_date)) ? doc.expiry_date : new Date(doc.expiry_date).toLocaleDateString()}</p>
                          </div>
                        </div>

                        <div className="text-sm">
                          <div>
                            <span className="text-muted-foreground">Issue Date:</span>
                            <p>{doc.issue_date ? (isNaN(Date.parse(doc.issue_date)) ? doc.issue_date : new Date(doc.issue_date).toLocaleDateString()) : 'N/A'}</p>
                          </div>
                        </div>

                        {doc.notes && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Notes:</span>
                            <p className="mt-1">{doc.notes}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}