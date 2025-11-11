import { useState, useEffect, useMemo } from "react";
import { Calendar, Users, CheckCircle, AlertTriangle, Clock, Eye, Search, Edit, Trash2, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DownloadButton } from "@/components/ui/download-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { useCompliancePeriodEmployeeData } from "@/hooks/queries/useCompliancePeriodQueries";
import { ComplianceRecordViewDialog } from "./ComplianceRecordViewDialog";
import { AddComplianceRecordModal } from "./AddComplianceRecordModal";
import { EditComplianceRecordModal } from "./EditComplianceRecordModal";
import { supabase } from "@/integrations/supabase/client";
import { generateSpotCheckPdf } from "@/lib/spot-check-pdf";
import { generateSupervisionPdf } from "@/lib/supervision-pdf";
import { generateAnnualAppraisalPDF } from "@/lib/annual-appraisal-pdf";
import { generateMedicationCompetencyPdf } from "@/lib/medication-competency-pdf";

interface Employee {
  id: string;
  name: string;
  branch: string;
  created_at: string;
}

interface ComplianceRecord {
  id: string;
  employee_id: string;
  period_identifier: string;
  completion_date: string;
  notes: string | null;
  form_data?: any | null;
  status: string;
  created_at: string;
  updated_at: string;
  completed_by: string | null;
  completion_method?: string;
}

interface EmployeeComplianceStatus {
  employee: Employee;
  record: ComplianceRecord | null;
  status: 'compliant' | 'overdue' | 'due' | 'pending';
}

interface CompliancePeriodEmployeeViewProps {
  complianceTypeId: string;
  complianceTypeName: string;
  periodIdentifier: string;
  frequency: string;
  trigger: React.ReactNode;
}

export function CompliancePeriodEmployeeView({ 
  complianceTypeId, 
  complianceTypeName, 
  periodIdentifier, 
  frequency,
  trigger 
}: CompliancePeriodEmployeeViewProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const { toast } = useToast();
  const { companySettings } = useCompany();

  // Fetch data using React Query
  const { data, isLoading, error, refetch } = useCompliancePeriodEmployeeData(complianceTypeId, periodIdentifier);
  
  const employees = data?.employees || [];
  const records = data?.records || [];

  // Handler to delete a record
  const handleDeleteRecord = async (recordId: string, employeeName: string) => {
    if (!confirm(`Are you sure you want to delete the compliance record for ${employeeName}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('compliance_period_records')
        .delete()
        .eq('id', recordId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Compliance record deleted successfully",
      });

      refetch();
    } catch (error: any) {
      console.error('Error deleting record:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete compliance record",
        variant: "destructive",
      });
    }
  };

  // Helper function to get period end date
  const getPeriodEndDate = (periodIdentifier: string, frequency: string): Date => {
    switch (frequency.toLowerCase()) {
      case 'annual': {
        const year = parseInt(periodIdentifier);
        return new Date(year, 11, 31); // December 31st
      }
      case 'monthly': {
        const [year, month] = periodIdentifier.split('-').map(Number);
        return new Date(year, month, 0); // Last day of the month
      }
      case 'quarterly': {
        const [year, quarterStr] = periodIdentifier.split('-');
        const quarter = parseInt(quarterStr.replace('Q', ''));
        const endMonth = quarter * 3; // Q1=3, Q2=6, Q3=9, Q4=12
        return new Date(parseInt(year), endMonth, 0); // Last day of quarter
      }
      case 'bi-annual': {
        const [year, halfStr] = periodIdentifier.split('-');
        const half = parseInt(halfStr.replace('H', ''));
        const endMonth = half === 1 ? 6 : 12;
        return new Date(parseInt(year), endMonth, 0);
      }
      case 'weekly': {
        const [year, weekStr] = periodIdentifier.split('-W');
        const week = parseInt(weekStr);
        const firstDayOfYear = new Date(parseInt(year), 0, 1);
        const daysToAdd = (week - 1) * 7 + 6; // Last day of the week
        return new Date(firstDayOfYear.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      }
      default:
        return new Date();
    }
  };

  // Helper function to check if a period is overdue
  const isPeriodOverdue = (periodIdentifier: string, frequency: string, currentDate: Date): boolean => {
    const periodEnd = getPeriodEndDate(periodIdentifier, frequency);
    return currentDate > periodEnd;
  };

  // Calculate employee status using useMemo
  const employeeStatusList = useMemo(() => {
    if (!employees || !records) return [];
    
    // Get the period end date to filter employees
    const periodEndDate = getPeriodEndDate(periodIdentifier, frequency);
    
    // Only include employees who existed during or before this period
    const eligibleEmployees = employees.filter(employee => {
      const employeeCreatedDate = new Date(employee.created_at);
      return employeeCreatedDate <= periodEndDate;
    });
    
    return eligibleEmployees.map(employee => {
      // Find the record for this employee in this specific period
      const record = records.find(record => record.employee_id === employee.id);

      let status: 'compliant' | 'overdue' | 'due' | 'pending' = 'pending';

      if (record) {
        // Use the database status field directly (like client compliance does)
        if (record.status === 'completed' || record.completion_date) {
          status = 'compliant';
        } else if (record.status === 'overdue' || record.is_overdue) {
          status = 'overdue';
        } else if (record.status === 'pending') {
          status = 'pending';
        } else {
          status = 'due';
        }
      } else {
        // No record exists - check if we're past the period
        const now = new Date();
        const isOverdue = isPeriodOverdue(periodIdentifier, frequency, now);
        status = isOverdue ? 'overdue' : 'due';
      }

      return {
        employee,
        record: record || null,
        status
      };
    });
  }, [employees, records, periodIdentifier, frequency]);

  const getStatusBadge = (status: 'compliant' | 'overdue' | 'due' | 'pending') => {
    switch (status) {
      case 'compliant':
        return <Badge className="bg-success/10 text-success border-success/20">Compliant</Badge>;
      case 'overdue':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Overdue</Badge>;
      case 'due':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Due</Badge>;
      case 'pending':
        return <Badge className="bg-muted text-muted-foreground border-border">Pending</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground border-border">{status}</Badge>;
    }
  };

  const getStatusColor = (status: 'compliant' | 'overdue' | 'due' | 'pending') => {
    switch (status) {
      case 'compliant':
        return 'bg-success/5 border-success/20';
      case 'overdue':
        return 'bg-destructive/5 border-destructive/20';
      case 'due':
        return 'bg-warning/5 border-warning/20';
      default:
        return '';
    }
  };

  // Calculate stats for this period
  const filteredEmployeeStatusList = employeeStatusList.filter(item => {
    if (!searchTerm.trim()) return true;
    return item.employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           item.employee.branches?.name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const compliantCount = filteredEmployeeStatusList.filter(item => item.status === 'compliant').length;
  const overdueCount = filteredEmployeeStatusList.filter(item => item.status === 'overdue').length;
  const dueCount = filteredEmployeeStatusList.filter(item => item.status === 'due').length;
  const pendingCount = filteredEmployeeStatusList.filter(item => item.status === 'pending').length;
  const completedRecordsCount = employeeStatusList.filter(item => 
    item.record && 
    (item.record.status === 'completed' || item.record.completion_date) &&
    item.record.completion_method &&
    ['spotcheck', 'supervision', 'annual_appraisal', 'medication_competency', 'questionnaire'].includes(item.record.completion_method)
  ).length;

  // Pagination calculations
  const totalItems = filteredEmployeeStatusList.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEmployeeStatusList = filteredEmployeeStatusList.slice(startIndex, endIndex);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  // Handle download all PDFs
  const handleDownloadAllPDFs = async () => {
    setIsDownloadingAll(true);
    setDownloadProgress(0);
    
    const eligibleEmployees = employeeStatusList.filter(item => 
      item.record && 
      (item.record.status === 'completed' || item.record.completion_date) &&
      item.record.completion_method &&
      ['spotcheck', 'supervision', 'annual_appraisal', 'medication_competency', 'questionnaire'].includes(item.record.completion_method)
    );

    toast({
      title: "Starting Bulk Download",
      description: `Preparing to download ${eligibleEmployees.length} PDFs...`,
    });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < eligibleEmployees.length; i++) {
      const item = eligibleEmployees[i];
      setDownloadProgress(i + 1);

      try {
        const method = item.record!.completion_method;
        
        // Add small delay between downloads to prevent overwhelming the browser
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        switch (method) {
          case 'spotcheck':
            const { data: spotCheckData } = await supabase
              .from('spot_check_records')
              .select('*')
              .eq('employee_id', item.employee.id)
              .eq('compliance_type_id', complianceTypeId)
              .eq('period_identifier', item.record!.period_identifier)
              .single();
            
            if (spotCheckData) {
              const formData = {
                serviceUserName: spotCheckData.service_user_name,
                careWorker1: spotCheckData.care_worker1,
                careWorker2: spotCheckData.care_worker2,
                date: spotCheckData.check_date,
                timeFrom: spotCheckData.time_from,
                timeTo: spotCheckData.time_to,
                carriedBy: spotCheckData.carried_by,
                observations: spotCheckData.observations as any
              };
              await generateSpotCheckPdf(formData, {
                name: companySettings?.name || 'Company',
                logo: companySettings?.logo
              });
            }
            break;

          case 'supervision':
            if (item.record?.notes) {
              const parsedData = JSON.parse(item.record.notes);
              await generateSupervisionPdf(parsedData, {
                name: companySettings?.name || 'Company',
                logo: companySettings?.logo
              });
            }
            break;

          case 'annual_appraisal':
            if (item.record?.notes) {
              const parsedData = JSON.parse(item.record.notes);
              await generateAnnualAppraisalPDF(parsedData, item.employee.name, {
                name: companySettings?.name || 'Company',
                logo: companySettings?.logo
              });
            }
            break;

          case 'medication_competency':
          case 'questionnaire':
            const parsedData = item.record!.form_data || (item.record?.notes ? JSON.parse(item.record.notes) : null);
            if (parsedData && parsedData.competencyItems) {
              const responses = parsedData.competencyItems.map((item: any) => ({
                category: item.category || 'General',
                question: item.question,
                response: item.response,
                comments: item.comments || ''
              }));

              const competencyData = {
                employeeId: item.record!.employee_id,
                employeeName: item.employee.name,
                periodIdentifier: item.record!.period_identifier,
                assessmentDate: item.record!.completion_date,
                responses: responses,
                signature: parsedData.acknowledgement?.signature || '',
                completedAt: item.record!.created_at,
                questionnaireName: 'Medication Competency Assessment',
                assessorName: parsedData.signatures?.assessorName || '',
                assessorSignatureData: parsedData.signatures?.assessorSignatureData || '',
                employeeSignatureData: parsedData.signatures?.employeeSignatureData || ''
              };

              await generateMedicationCompetencyPdf(competencyData, {
                name: companySettings?.name,
                logo: companySettings?.logo
              });
            }
            break;
        }
        
        successCount++;
      } catch (error) {
        console.error(`Error downloading PDF for ${item.employee.name}:`, error);
        errorCount++;
      }
    }

    setIsDownloadingAll(false);
    setDownloadProgress(0);

    toast({
      title: "Bulk Download Complete",
      description: `Successfully downloaded ${successCount} PDFs${errorCount > 0 ? `, ${errorCount} failed` : ''}.`,
    });
  };

  // Show error if data fetching failed
  if (error) {
    console.error('Error loading data:', error);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {complianceTypeName} - {periodIdentifier}
          </DialogTitle>
          <DialogDescription>
            Employee compliance status for this specific period
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-8 bg-muted rounded w-64"></div>
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-muted rounded-xl"></div>
              ))}
            </div>
            <div className="h-64 bg-muted rounded-xl"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="card-premium border-success/20 bg-gradient-to-br from-success-soft to-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Compliant</p>
                      <p className="text-2xl font-bold text-success">{compliantCount}</p>
                    </div>
                    <CheckCircle className="w-6 h-6 text-success" />
                  </div>
                </CardContent>
              </Card>

              <Card className="card-premium border-warning/20 bg-gradient-to-br from-warning-soft to-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Due</p>
                      <p className="text-2xl font-bold text-warning">{dueCount}</p>
                    </div>
                    <Clock className="w-6 h-6 text-warning" />
                  </div>
                </CardContent>
              </Card>

              <Card className="card-premium border-destructive/20 bg-gradient-to-br from-destructive-soft to-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                      <p className="text-2xl font-bold text-destructive">{overdueCount}</p>
                    </div>
                    <AlertTriangle className="w-6 h-6 text-destructive" />
                  </div>
                </CardContent>
              </Card>

              <Card className="card-premium border-muted/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Pending</p>
                      <p className="text-2xl font-bold text-muted-foreground">{pendingCount}</p>
                    </div>
                    <Users className="w-6 h-6 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Employee Table */}
            <Card className="card-premium">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-3">
                    <Users className="w-6 h-6" />
                    Employee Status ({totalItems} of {employees.length} employees)
                  </CardTitle>
                  
                  <div className="flex items-center gap-3">
                    {/* Download All PDFs Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadAllPDFs}
                      disabled={isDownloadingAll || completedRecordsCount === 0}
                      className="flex items-center gap-2"
                    >
                      {isDownloadingAll ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Downloading... ({downloadProgress}/{completedRecordsCount})
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Download All PDFs
                        </>
                      )}
                    </Button>

                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search employees..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-64 bg-background border-border/50 focus:border-primary/50"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Completion Date</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEmployeeStatusList.map((item) => (
                      <TableRow key={item.employee.id} className={getStatusColor(item.status)}>
                        <TableCell className="font-medium">
                          {item.employee.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {item.employee.branches?.name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(item.status)}
                        </TableCell>
                        <TableCell>
                          {item.record ? (() => {
                            const date = new Date(item.record.completion_date);
                            return isNaN(date.getTime()) 
                              ? item.record.completion_date 
                              : date.toLocaleDateString();
                          })() : '-'}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate" title={(() => {
                            if (!item.record?.notes) return '';
                            // Filter out auto-generated messages
                            if (item.record.notes.startsWith('Auto-generated for period:')) return '';
                            if (item.record?.completion_method === 'supervision') {
                              try {
                                const j = JSON.parse(item.record.notes);
                                const txt = (j?.freeTextNotes || '').toString().trim();
                                return txt || '';
                              } catch {
                                return '';
                              }
                            }
                            if (item.record?.completion_method === 'annual_appraisal') {
                              try {
                                const j = JSON.parse(item.record.notes);
                                const txt = (j?.freeTextNotes || '').toString().trim();
                                return txt || '';
                              } catch {
                                return '';
                              }
                            }
                            return item.record?.notes || '';
                          })()}>
                            {(() => {
                              if (!item.record?.notes) return '-';
                              // Filter out auto-generated messages
                              if (item.record.notes.startsWith('Auto-generated for period:')) return '-';
                              if (item.record?.completion_method === 'supervision') {
                                try {
                                  const j = JSON.parse(item.record.notes);
                                  const txt = (j?.freeTextNotes || '').toString().trim();
                                  return txt || '-';
                                } catch {
                                  return '-';
                                }
                              }
                              if (item.record?.completion_method === 'annual_appraisal') {
                                try {
                                  const j = JSON.parse(item.record.notes);
                                  const txt = (j?.freeTextNotes || '').toString().trim();
                                  return txt || '-';
                                } catch {
                                  return '-';
                                }
                              }
                              return item.record?.notes || '-';
                            })()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {/* Add Record Button - shown when no record exists */}
                            {!item.record && (
                              <AddComplianceRecordModal
                                employeeId={item.employee.id}
                                employeeName={item.employee.name}
                                complianceTypeId={complianceTypeId}
                                complianceTypeName={complianceTypeName}
                                frequency={frequency}
                                periodIdentifier={periodIdentifier}
                                onRecordAdded={refetch}
                                trigger={
                                  <Button variant="link" size="sm" className="text-primary">
                                    Add Record
                                  </Button>
                                }
                              />
                            )}
                            
                            {/* View Button - shown when record exists */}
                            {item.record && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRecord(item.record);
                                  setSelectedEmployee(item.employee);
                                  setViewDialogOpen(true);
                                }}
                                className="h-8 w-8 p-0"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            
                            {/* Edit Button - shown when record exists */}
                            {item.record && (
                              <EditComplianceRecordModal
                                record={item.record}
                                employeeName={item.employee.name}
                                complianceTypeName={complianceTypeName}
                                frequency={frequency}
                                onRecordUpdated={refetch}
                                trigger={
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    title="Edit Record"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                }
                              />
                            )}
                            
                            {/* Delete Button - shown when record exists */}
                            {item.record && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRecord(item.record.id, item.employee.name);
                                }}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                title="Delete Record"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            {/* Spot Check Download */}
                            {item.record?.completion_method === 'spotcheck' && (
                              <DownloadButton
                                onDownload={async () => {
                                  try {
                                    const { data, error } = await supabase
                                      .from('spot_check_records')
                                      .select('service_user_name, care_worker1, care_worker2, check_date, time_from, time_to, carried_by, observations')
                                      .eq('employee_id', item.employee.id)
                                      .eq('compliance_type_id', complianceTypeId)
                                      .eq('period_identifier', item.record.period_identifier)
                                      .single();
                                    
                                    if (error) throw error;
                                    
                                    const formData = {
                                      serviceUserName: data.service_user_name,
                                      careWorker1: data.care_worker1,
                                      careWorker2: data.care_worker2,
                                      date: data.check_date,
                                      timeFrom: data.time_from,
                                      timeTo: data.time_to,
                                      carriedBy: data.carried_by,
                                      observations: data.observations
                                    } as any;
                                    
                                    const { generateSpotCheckPdf } = await import('@/lib/spot-check-pdf');
                                    await generateSpotCheckPdf(formData, {
                                      name: companySettings?.name || 'Company',
                                      logo: companySettings?.logo
                                    });
                                  } catch (err) {
                                    console.error('Error generating spot check PDF:', err);
                                  }
                                }}
                                downloadingText="Generating PDF..."
                                completedText="Downloaded"
                              />
                            )}
                            
                            {/* Supervision Download */}
                            {item.record?.completion_method === 'supervision' && (
                              <DownloadButton
                                onDownload={async () => {
                                  if (item.record?.notes) {
                                    const parsedData = JSON.parse(item.record.notes);
                                    const { generateSupervisionPdf } = await import('@/lib/supervision-pdf');
                                    await generateSupervisionPdf(parsedData, {
                                      name: companySettings?.name || 'Company',
                                      logo: companySettings?.logo
                                    });
                                  }
                                }}
                                downloadingText="Generating PDF..."
                                completedText="Downloaded"
                              />
                            )}
                            
                            {/* Annual Appraisal Download */}
                            {item.record?.completion_method === 'annual_appraisal' && item.record?.status === 'completed' && (
                              <DownloadButton
                                onDownload={async () => {
                                  if (item.record?.notes) {
                                    const parsedData = JSON.parse(item.record.notes);
                                    const { generateAnnualAppraisalPDF } = await import('@/lib/annual-appraisal-pdf');
                                    await generateAnnualAppraisalPDF(parsedData, item.employee.name, {
                                      name: companySettings?.name || 'Company',
                                      logo: companySettings?.logo
                                    });
                                  }
                                }}
                                downloadingText="Generating PDF..."
                                completedText="Downloaded"
                              />
                            )}
                            
                            {/* Medication Competency Download */}
                            {(item.record?.status === 'completed' && ((item.record?.completion_method === 'medication_competency') || (item.record?.completion_method === 'questionnaire' && item.record?.form_data && (item.record.form_data as any)?.competencyItems))) && ((item.record?.form_data) || item.record?.notes) && (
                              <DownloadButton
                                onDownload={async () => {
                                  const parsedData = item.record.form_data || (item.record?.notes ? JSON.parse(item.record.notes) : null);
                                  if (!parsedData) return;
                                  
                                  // Transform legacy data to new format
                                  const items = parsedData.competencyItems;
                                  const responses = Array.isArray(items)
                                    ? items.map((item: any) => ({
                                        question: item?.performanceCriteria || item?.id || 'Competency Item',
                                        answer: item?.competent === 'yes' ? 'yes' : item?.competent === 'not-yet' ? 'not-yet' : 'yes',
                                        comment: item?.comments || 'No comment provided',
                                        section: 'Competency Assessment',
                                        helpText: item?.examples || 'Direct observation / discussion'
                                      }))
                                    : items && typeof items === 'object'
                                    ? Object.values(items).map((value: any) => ({
                                        question: value?.performanceCriteria || value?.id || 'Competency Item',
                                        answer: value?.competent === 'yes' ? 'yes' : value?.competent === 'not-yet' ? 'not-yet' : 'yes',
                                        comment: value?.comments || 'No comment provided',
                                        section: 'Competency Assessment',
                                        helpText: value?.examples || 'Direct observation / discussion'
                                      }))
                                    : [];

                                  // Add signature if available
                                  if (parsedData.acknowledgement?.signature) {
                                    responses.push({
                                      question: 'Employee Signature',
                                      answer: 'yes',
                                      comment: parsedData.acknowledgement.signature,
                                      section: 'Acknowledgement',
                                      helpText: 'Employee acknowledgement'
                                    });
                                  }
                                  
                                  const competencyData = {
                                    employeeId: item.record.employee_id,
                                    employeeName: item.employee.name,
                                    periodIdentifier: item.record.period_identifier,
                                    assessmentDate: item.record.completion_date,
                                    responses: responses,
                                    signature: parsedData.acknowledgement?.signature || '',
                                    completedAt: item.record.created_at,
                                    questionnaireName: 'Medication Competency Assessment',
                                    assessorName: parsedData.signatures?.assessorName || '',
                                    assessorSignatureData: parsedData.signatures?.assessorSignatureData || '',
                                    employeeSignatureData: parsedData.signatures?.employeeSignatureData || ''
                                  };

                                  const { generateMedicationCompetencyPdf } = await import('@/lib/medication-competency-pdf');
                                  await generateMedicationCompetencyPdf(competencyData, {
                                    name: companySettings?.name || 'Company',
                                    logo: companySettings?.logo
                                  });
                                }}
                                downloadingText="Generating PDF..."
                                completedText="Downloaded"
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                 </Table>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-border/50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Items per page:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => handleItemsPerPageChange(e.target.value)}
                        className="border border-border rounded px-2 py-1 text-sm bg-background"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(page)}
                            className={currentPage === page ? "bg-primary text-primary-foreground" : ""}
                          >
                            {page}
                          </Button>
                        ))}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} employees
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        
        <ComplianceRecordViewDialog
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          employee={selectedEmployee}
          record={selectedRecord}
          completedByUser={selectedRecord?.completed_by_user ? {
            name: selectedRecord.completed_by_user.name,
            created_at: selectedRecord.completion_date || selectedRecord.created_at
          } : null}
          createdByUser={selectedRecord?.created_by_user ? {
            name: selectedRecord.created_by_user.name,
            created_at: selectedRecord.created_at
          } : null}
          updatedByUser={selectedRecord?.updated_by_user ? {
            name: selectedRecord.updated_by_user.name,
            updated_at: selectedRecord.updated_at
          } : null}
        />
      </DialogContent>
    </Dialog>
  );
}