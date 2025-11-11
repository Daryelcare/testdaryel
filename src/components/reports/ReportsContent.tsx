import { useState, useEffect } from "react";
import { BarChart3, Download, FileSpreadsheet, Filter, ChevronDown, FileX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-picker";
import { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Branch {
  id: string;
  name: string;
}

interface LeaveType {
  id: string;
  name: string;
}

interface DocumentType {
  id: string;
  name: string;
}

interface ComplianceType {
  id: string;
  name: string;
  frequency: string;
  target_table?: string;
  isClientType?: boolean;
}

export function ReportsContent() {
  const [selectedReport, setSelectedReport] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>("all");
  const [selectedLeaveStatus, setSelectedLeaveStatus] = useState<string>("all");
  const [selectedComplianceType, setSelectedComplianceType] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedQuarters, setSelectedQuarters] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [complianceTypes, setComplianceTypes] = useState<ComplianceType[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<{[key: string]: string[]}>({});
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const { toast } = useToast();
  const { isAdmin, getAccessibleBranches } = usePermissions();

  useEffect(() => {
    fetchBranches();
    fetchLeaveTypes();
    fetchDocumentTypes();
    fetchComplianceTypes();
  }, []);

  // Re-initialize columns when document types change (for dynamic Documents Report)
  useEffect(() => {
    if (selectedReport === 'documents' && documentTypes.length > 0) {
      initializeSelectedColumns('documents');
    }
  }, [documentTypes, selectedReport]);

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
      toast({
        title: "Error loading branches",
        description: "Could not fetch branch data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_types')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setLeaveTypes(data || []);
    } catch (error) {
      console.error('Error fetching leave types:', error);
      toast({
        title: "Error loading leave types",
        description: "Could not fetch leave type data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const fetchDocumentTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('document_types')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setDocumentTypes(data || []);
    } catch (error) {
      console.error('Error fetching document types:', error);
    }
  };

  const fetchComplianceTypes = async () => {
    try {
      // Fetch only from compliance_types to match Compliance page behavior
      const { data: complianceTypesData, error } = await supabase
        .from('compliance_types')
        .select('id, name, frequency, target_table')
        .order('name');

      if (error) throw error;

      // Map types and mark client types based on target_table
      const allTypes: ComplianceType[] = (complianceTypesData || []).map(t => ({ 
        ...t, 
        isClientType: t.target_table === 'clients'
      }));

      setComplianceTypes(allTypes);
    } catch (error) {
      console.error('Error fetching compliance types:', error);
      toast({
        title: "Error loading compliance types",
        description: "Could not fetch compliance type data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const reportTypes = [
    {
      id: "employees",
      name: "Employees Report",
      description: "Complete employee directory with all details",
      icon: "👥",
      fields: ["Name", "Employee Code", "Job Title", "Branch", "Days Taken", "Days Remaining", "Hours", "Email", "Phone"]
    },
    {
      id: "clients",
      name: "Clients Report",
      description: "Complete client directory with all details",
      icon: "🏢",
      fields: ["Name", "Branch", "Status", "Created Date", "Is Active"]
    },
    {
      id: "leaves",
      name: "Leaves Report", 
      description: "Leave requests and balances",
      icon: "🌴",
      fields: ["Employee", "Employee Code", "Branch", "Type", "Start Date", "End Date", "Duration", "Days Remaining", "Status", "Reason", "Submitted Date", "Manager Notes", "Approved/Rejected By", "Approved Date", "Rejected Date"]
    },
    {
      id: "documents",
      name: "Documents Report",
      description: "Document expiration tracking",
      icon: "📄",
      fields: ["Employee Name", "Branch", "Status", "Country", "Sponsored", "20 Hours Restriction", ...documentTypes.flatMap(dt => [dt.name, `${dt.name} Days Left`])]
    },
    {
      id: "compliance",
      name: "Compliance Report",
      description: "Employee and client compliance task completion status",
      icon: "🛡️",
      fields: ["Type", "Task Name", "Employee/Client", "Branch", "Period", "Completion Date", "Status", "Notes", "Frequency"]
    }
  ];

  // Initialize selected columns when report type changes or document types change
  const initializeSelectedColumns = (reportId: string) => {
    const reportType = reportTypes.find(r => r.id === reportId);
    if (reportType && (!selectedColumns[reportId] || reportId === 'documents')) {
      // For documents report, always reinitialize to get latest document types
      setSelectedColumns(prev => ({
        ...prev,
        [reportId]: [...reportType.fields]
      }));
    }
  };

  // Handle column selection
  const handleColumnToggle = (reportId: string, column: string, checked: boolean) => {
    setSelectedColumns(prev => ({
      ...prev,
      [reportId]: checked 
        ? [...(prev[reportId] || []), column]
        : (prev[reportId] || []).filter(col => col !== column)
    }));
  };

  // Select/Deselect all columns
  const handleSelectAllColumns = (reportId: string, selectAll: boolean) => {
    const reportType = reportTypes.find(r => r.id === reportId);
    if (reportType) {
      setSelectedColumns(prev => ({
        ...prev,
        [reportId]: selectAll ? [...reportType.fields] : []
      }));
    }
  };

  const getCurrentComplianceType = () => {
    return complianceTypes.find(type => type.id === selectedComplianceType);
  };

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 1; i++) {
      years.push(i.toString());
    }
    return years;
  };

  const getMonthOptions = () => {
    return [
      { value: "01", label: "January" },
      { value: "02", label: "February" },
      { value: "03", label: "March" },
      { value: "04", label: "April" },
      { value: "05", label: "May" },
      { value: "06", label: "June" },
      { value: "07", label: "July" },
      { value: "08", label: "August" },
      { value: "09", label: "September" },
      { value: "10", label: "October" },
      { value: "11", label: "November" },
      { value: "12", label: "December" }
    ];
  };

  const getQuarterOptions = () => {
    return [
      { value: "Q1", label: "Q1 (Jan-Mar)" },
      { value: "Q2", label: "Q2 (Apr-Jun)" },
      { value: "Q3", label: "Q3 (Jul-Sep)" },
      { value: "Q4", label: "Q4 (Oct-Dec)" }
    ];
  };

  const handleMonthToggle = (month: string) => {
    setSelectedMonths(prev => 
      prev.includes(month) 
        ? prev.filter(m => m !== month)
        : [...prev, month]
    );
  };

  const handleQuarterToggle = (quarter: string) => {
    setSelectedQuarters(prev => 
      prev.includes(quarter) 
        ? prev.filter(q => q !== quarter)
        : [...prev, quarter]
    );
  };

  const calculateDaysLeft = (expiryDate: string): number => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatDate = (dateString: string): string => {
    // Check if it's a valid date format (YYYY-MM-DD or similar)
    if (dateString && dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-GB');
      }
    }
    // Return the original string if it's not a valid date
    return dateString || '';
  };

  const generateDocumentHeaders = () => {
    const baseHeaders = ['Employee Name', 'Branch', 'Status', 'Country', 'Sponsored', '20 Hours Restriction'];
    const documentHeaders: string[] = [];
    
    documentTypes.forEach(docType => {
      documentHeaders.push(docType.name);
      documentHeaders.push(`${docType.name} Days Left`);
    });
    
    return [...baseHeaders, ...documentHeaders];
  };

  const generateDocumentRow = (employee: any) => {
    // Get documents array from the tracker
    const tracker = employee.document_tracker;
    const documents = (tracker?.documents || []) as any[];
    
    const baseData = {
      'Employee Name': employee.name,
      'Branch': employee.branches?.name || '',
      'Status': tracker?.nationality_status || '',
      'Country': tracker?.country || '',
      'Sponsored': employee.sponsored ? 'Yes' : 'No',
      '20 Hours Restriction': employee.twenty_hours ? 'Yes' : 'No'
    };

    const documentData: any = {};
    documentTypes.forEach(docType => {
      const doc = documents.find((d: any) => 
        d.document_type_id === docType.id
      );
      
      documentData[docType.name] = doc ? formatDate(doc.expiry_date) : '';
      documentData[`${docType.name} Days Left`] = doc ? calculateDaysLeft(doc.expiry_date) : '';
    });

    return { ...baseData, ...documentData };
  };

  const handleExport = async (format: 'xlsx' | 'csv') => {
    if (!selectedReport) {
      toast({
        title: "No report selected",
        description: "Please select a report type before exporting.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);

    try {
      let filename = "";

      switch (selectedReport) {
        case "documents":
          const { data: employeesWithDocs, error: docsError } = await supabase
            .from('employees')
            .select(`
              name,
              branch_id,
              sponsored,
              twenty_hours,
              branches!employees_branch_id_fkey(id, name),
              document_tracker (
                documents,
                country,
                nationality_status
              )
            `)
            .not('document_tracker', 'is', null)
            .order('name');
          
          if (docsError) throw docsError;

          // Only include employees who actually have documents in their tracker
          const filteredEmployees = (employeesWithDocs || [])
            .filter(emp => {
              const docs = (emp.document_tracker as any)?.documents;
              return docs && Array.isArray(docs) && docs.length > 0;
            });

          const allEmployees = filteredEmployees
            .filter(emp => !emp.sponsored && !emp.twenty_hours)
            .map(emp => generateDocumentRow(emp));

          const sponsoredAndTwentyHours = filteredEmployees
            .filter(emp => emp.sponsored || emp.twenty_hours)
            .map(emp => generateDocumentRow(emp));

          filename = `documents_report_${new Date().toISOString().split('T')[0]}`;

          let csvContent = '';
          csvContent += 'Sheet1: All Employees\n';
          csvContent += convertToCSV(allEmployees, selectedColumns[selectedReport]) + '\n\n';
          csvContent += 'Sheet2: Sponsored/20 Hours\n';
          csvContent += convertToCSV(sponsoredAndTwentyHours, selectedColumns[selectedReport]);

          downloadFile(csvContent, `${filename}.csv`, 'text/csv');
          break;

        case "employees":
          const { data: employeesData, error: employeesError } = await supabase
            .from('employees')
            .select(`
              name, 
              employee_code, 
              job_title, 
              branch_id,
              leave_taken, 
              remaining_leave_days, 
              working_hours, 
              email, 
              phone,
              branches!employees_branch_id_fkey(id, name)
            `)
            .order('name');
          
          if (employeesError) throw employeesError;
          
          const transformedEmployeesData = (employeesData || []).map(emp => ({
            'Name': emp.name,
            'Employee Code': emp.employee_code,
            'Job Title': emp.job_title || '',
            'Branch': (emp.branches as any)?.name || '',
            'Days Taken': emp.leave_taken || 0,
            'Days Remaining': emp.remaining_leave_days || 0,
            'Hours': emp.working_hours || '',
            'Email': emp.email || '',
            'Phone': emp.phone || ''
          }));
          
          const csvContentEmployees = convertToCSV(transformedEmployeesData, selectedColumns[selectedReport]);
          filename = `employees_report_${new Date().toISOString().split('T')[0]}`;
          downloadFile(csvContentEmployees, `${filename}.csv`, 'text/csv');
          break;

        case "clients":
          let clientQuery = supabase
            .from('clients')
            .select(`
              *,
              branches (name)
            `)
            .order('name');

          // Apply branch filter if selected
          if (selectedBranch !== "all") {
            clientQuery = clientQuery.eq('branches.name', selectedBranch);
          }
          
          const { data: clientsData, error: clientsError } = await clientQuery;
          
          if (clientsError) throw clientsError;
          
          const transformedClientsData = (clientsData || []).map(client => ({
            'Name': client.name,
            'Branch': client.branches?.name || '',
            'Status': client.is_active ? 'Active' : 'Inactive',
            'Created Date': new Date(client.created_at).toLocaleDateString('en-GB'),
            'Is Active': client.is_active ? 'Yes' : 'No'
          }));
          
          const csvContentClients = convertToCSV(transformedClientsData, selectedColumns[selectedReport]);
          filename = `clients_report_${new Date().toISOString().split('T')[0]}`;
          downloadFile(csvContentClients, `${filename}.csv`, 'text/csv');
          break;

        case "leaves":
          let query = supabase
            .from('leave_requests')
            .select(`
              *,
              employees!leave_requests_employee_id_fkey (
                name, 
                employee_code, 
                remaining_leave_days, 
                branch_id,
                branches!employees_branch_id_fkey(id, name)
              ),
              leave_types!leave_requests_leave_type_id_fkey (name)
            `)
            .order('start_date', { ascending: false });

          if (selectedBranch !== "all") {
            const branchId = branches.find(b => b.name === selectedBranch)?.id;
            if (branchId) {
              query = query.eq('employees.branch_id', branchId);
            }
          }

          if (selectedLeaveType !== "all") {
            query = query.eq('leave_types.name', selectedLeaveType);
          }

          if (selectedLeaveStatus !== "all") {
            query = query.eq('status', selectedLeaveStatus);
          }

          if (dateRange?.from && dateRange?.to) {
            query = query
              .gte('start_date', dateRange.from.toISOString().split('T')[0])
              .lte('end_date', dateRange.to.toISOString().split('T')[0]);
          }
          
          const { data: leavesData, error: leavesError } = await query;
          
          if (leavesError) throw leavesError;
          
          // Fetch user roles to get emails for approved_by and rejected_by IDs
          const approvedByIds = (leavesData || [])
            .map(leave => leave.approved_by)
            .filter(id => id) as string[];
          
          const rejectedByIds = (leavesData || [])
            .map(leave => leave.rejected_by)
            .filter(id => id) as string[];
          
          const allUserIds = [...new Set([...approvedByIds, ...rejectedByIds])];
          
          let userRoles: any[] = [];
          if (allUserIds.length > 0) {
            const { data: userRolesData } = await supabase
              .from('user_roles')
              .select('user_id, email')
              .in('user_id', allUserIds);
            userRoles = userRolesData || [];
          }
          
          const transformedLeavesData = (leavesData || []).map(leave => {
            const approvedByUser = userRoles.find(ur => ur.user_id === leave.approved_by);
            const rejectedByUser = userRoles.find(ur => ur.user_id === leave.rejected_by);
            
            // Determine which email to show based on status
            let actionByEmail = '';
            if (leave.status === 'approved' && approvedByUser) {
              actionByEmail = approvedByUser.email;
            } else if (leave.status === 'rejected' && rejectedByUser) {
              actionByEmail = rejectedByUser.email;
            }
            
            return {
              Employee: leave.employees?.name || '',
              'Employee Code': leave.employees?.employee_code || '',
              Branch: (leave.employees as any)?.branches?.name || '',
              Type: leave.leave_types?.name || '',
              'Start Date': new Date(leave.start_date).toLocaleDateString('en-GB'),
              'End Date': new Date(leave.end_date).toLocaleDateString('en-GB'),
              Duration: leave.days_requested || 0,
              'Days Remaining': leave.employees?.remaining_leave_days || 0,
              Status: leave.status || '',
              Reason: leave.notes || '',
              'Submitted Date': new Date(leave.created_at).toLocaleDateString('en-GB'),
              'Manager Notes': leave.manager_notes || '',
              'Approved/Rejected By': actionByEmail,
              'Approved Date': leave.approved_date ? new Date(leave.approved_date).toLocaleDateString('en-GB') : '',
              'Rejected Date': leave.rejected_date ? new Date(leave.rejected_date).toLocaleDateString('en-GB') : ''
            };
          });
          
          const csvContentLeaves = convertToCSV(transformedLeavesData, selectedColumns[selectedReport]);
          filename = `leaves_report_${new Date().toISOString().split('T')[0]}`;
          downloadFile(csvContentLeaves, `${filename}.csv`, 'text/csv');
          break;

        case "compliance":
          // First, determine if the selected compliance type is for employees or clients
          let allComplianceData: any[] = [];
          let isEmployeeComplianceType = false;
          let isClientComplianceType = false;

          // Check what type of compliance is selected
          if (selectedComplianceType !== "all") {
            const selectedType = complianceTypes.find(ct => ct.id === selectedComplianceType);
            if (selectedType) {
              if (selectedType.isClientType) {
                isClientComplianceType = true;
              } else {
                isEmployeeComplianceType = true;
              }
            }
          }

          // Fetch employee compliance records (only if "all" or employee compliance type selected)
          if (selectedComplianceType === "all" || isEmployeeComplianceType) {
            try {
              let employeeComplianceQuery = supabase
                .from('compliance_period_records')
                .select(`
                  *,
                  employees!compliance_period_records_employee_id_fkey (
                    name, 
                    branch_id,
                    branches!employees_branch_id_fkey(id, name)
                  ),
                  compliance_types (name, frequency)
                `)
                .order('completion_date', { ascending: false });

              // Apply branch filter (will be done in memory after fetching data)

              if (selectedComplianceType !== "all") {
                employeeComplianceQuery = employeeComplianceQuery.eq('compliance_type_id', selectedComplianceType);
              }

            const currentComplianceType = getCurrentComplianceType();
            if (currentComplianceType) {
              if (currentComplianceType.frequency.toLowerCase() === 'annual') {
                employeeComplianceQuery = employeeComplianceQuery.like('period_identifier', `${selectedYear}%`);
              } else if (currentComplianceType.frequency.toLowerCase() === 'monthly' && selectedMonths.length > 0) {
                const monthFilters = selectedMonths.map(month => `${selectedYear}-${month}`);
                employeeComplianceQuery = employeeComplianceQuery.in('period_identifier', monthFilters);
              } else if (currentComplianceType.frequency.toLowerCase() === 'quarterly' && selectedQuarters.length > 0) {
                const quarterFilters = selectedQuarters.map(quarter => `${selectedYear}-${quarter}`);
                employeeComplianceQuery = employeeComplianceQuery.in('period_identifier', quarterFilters);
              }
            }

            const { data: employeeComplianceData, error: employeeComplianceError } = await employeeComplianceQuery;
            
            if (!employeeComplianceError && employeeComplianceData) {
              // Apply branch filter in memory if needed
              let filteredEmployeeData = employeeComplianceData;
              if (selectedBranch !== "all") {
                filteredEmployeeData = employeeComplianceData.filter(record => {
                  const empBranchName = (record.employees as any)?.branches?.name;
                  return empBranchName === selectedBranch;
                });
              }

              const transformedEmployeeData = filteredEmployeeData
                .filter(record => {
                  // Filter out records for compliance types that have target_table = 'clients'
                  // These should only appear in the client compliance section
                  const complianceType = complianceTypes.find(ct => ct.name === record.compliance_types?.name);
                  return complianceType?.target_table !== 'clients';
                })
                .map(record => {
                  let notes = record.notes || '';
                  // Extract freeTextNotes from JSON if present
                  if (notes) {
                    try {
                      const parsedNotes = JSON.parse(notes);
                      notes = parsedNotes.freeTextNotes || '';
                    } catch {
                      // Not JSON, keep the original notes
                    }
                  }
                  
                  return {
                    'Type': 'Employee Compliance',
                    'Task Name': record.compliance_types?.name || '',
                    'Employee/Client': record.employees?.name || '',
                    'Branch': (record.employees as any)?.branches?.name || '',
                    'Period': record.period_identifier || '',
                    'Completion Date': record.completion_date && record.completion_date.match(/^\d{4}-\d{2}-\d{2}/) 
                      ? new Date(record.completion_date).toLocaleDateString('en-GB') 
                      : record.completion_date || '',
                    'Status': record.status || '',
                    'Notes': notes,
                    'Frequency': record.compliance_types?.frequency || ''
                  };
                });
                allComplianceData = [...allComplianceData, ...transformedEmployeeData];
              }
            } catch (error) {
              console.error('Error fetching employee compliance data:', error);
            }
          }

          // Fetch client compliance records (only if "all" or client compliance type selected)
          if (selectedComplianceType === "all" || isClientComplianceType) {
            try {
              let clientComplianceQuery = supabase
                .from('client_compliance_period_records')
                .select(`
                  *,
                  clients!client_compliance_period_records_client_id_fkey (
                    name,
                    branches!clients_branch_id_fkey (name)
                  ),
                  client_compliance_types!client_compliance_period_records_client_compliance_type_id_fkey (name, frequency)
                `)
                .order('completion_date', { ascending: false });

              // Note: We'll filter by compliance type name in memory since the type exists in both tables

            const currentComplianceTypeForClient = getCurrentComplianceType();
            if (currentComplianceTypeForClient) {
              if (currentComplianceTypeForClient.frequency.toLowerCase() === 'annual') {
                clientComplianceQuery = clientComplianceQuery.like('period_identifier', `${selectedYear}%`);
              } else if (currentComplianceTypeForClient.frequency.toLowerCase() === 'monthly' && selectedMonths.length > 0) {
                const monthFilters = selectedMonths.map(month => `${selectedYear}-${month}`);
                clientComplianceQuery = clientComplianceQuery.in('period_identifier', monthFilters);
              } else if (currentComplianceTypeForClient.frequency.toLowerCase() === 'quarterly' && selectedQuarters.length > 0) {
                const quarterFilters = selectedQuarters.map(quarter => `${selectedYear}-${quarter}`);
                clientComplianceQuery = clientComplianceQuery.in('period_identifier', quarterFilters);
              }
            }

              const { data: clientComplianceData, error: clientComplianceError } = await clientComplianceQuery;
              
              if (!clientComplianceError && clientComplianceData) {
                // Apply compliance type filter in memory (matching by name)
                let filteredClientData = clientComplianceData;
                
                if (selectedComplianceType !== "all" && isClientComplianceType) {
                  const selectedTypeData = complianceTypes.find(ct => ct.id === selectedComplianceType);
                  if (selectedTypeData) {
                    filteredClientData = clientComplianceData.filter(record => 
                      record.client_compliance_types?.name === selectedTypeData.name
                    );
                  }
                }
                
                // Apply branch filter in memory if needed
                if (selectedBranch !== "all") {
                  filteredClientData = filteredClientData.filter(record => {
                    const clientBranchName = record.clients?.branches?.name;
                    return clientBranchName === selectedBranch;
                  });
                }

                const transformedClientData = filteredClientData.map(record => {
                  return {
                    'Type': 'Client Compliance',
                    'Task Name': record.client_compliance_types?.name || '',
                    'Employee/Client': record.clients?.name || '',
                    'Branch': record.clients?.branches?.name || '',
                    'Period': record.period_identifier || '',
                    'Completion Date': record.completion_date && record.completion_date.match(/^\d{4}-\d{2}-\d{2}/) 
                      ? new Date(record.completion_date).toLocaleDateString('en-GB') 
                      : record.completion_date || '',
                    'Status': record.status || '',
                    'Notes': record.notes || '',
                    'Frequency': record.client_compliance_types?.frequency || ''
                  };
                });
                allComplianceData = [...allComplianceData, ...transformedClientData];
              }
            } catch (error) {
              console.error('Error fetching client compliance data:', error);
            }
          }

          // If no data found, create a message
          if (allComplianceData.length === 0) {
            allComplianceData = [{
              'Type': 'No Data',
              'Task Name': 'No compliance records found',
              'Employee/Client': 'Please check your filters',
              'Branch': '',
              'Period': '',
              'Completion Date': '',
              'Status': '',
              'Notes': '',
              'Frequency': ''
            }];
          }
          
          const csvContentCompliance = convertToCSV(allComplianceData, selectedColumns[selectedReport]);
          
          // Helper function to format names for filename
          const formatNameForFilename = (name: string) => {
            return name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
          };

          // Get compliance type name and frequency
          const complianceType = complianceTypes.find(ct => ct.id === selectedComplianceType);
          const formattedComplianceType = complianceType ? formatNameForFilename(complianceType.name) : 'UnknownCompliance';
          
          // Generate frequency suffix based on compliance type frequency
          let frequencySuffix = '';
          if (complianceType) {
            const frequency = complianceType.frequency.toLowerCase();
            
            if (frequency === 'quarterly') {
              if (selectedQuarters.length === 1) {
                frequencySuffix = selectedQuarters[0].toLowerCase(); // e.g., "q3"
              } else if (selectedQuarters.length > 1) {
                frequencySuffix = selectedQuarters.map(q => q.toLowerCase()).join(''); // e.g., "q1q2q3"
              }
            } else if (frequency === 'monthly') {
              if (selectedMonths.length === 1) {
                const monthNames = ['', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                const monthIndex = parseInt(selectedMonths[0]);
                frequencySuffix = monthNames[monthIndex] || selectedMonths[0];
              } else if (selectedMonths.length > 1) {
                frequencySuffix = 'multimonth';
              }
            } else if (frequency === 'weekly') {
              frequencySuffix = 'weekly';
            } else if (frequency === 'daily') {
              frequencySuffix = 'daily';
            }
            // For annual and other frequencies, no suffix needed
          }
          
          // Get branch name
          const formattedBranch = selectedBranch === 'all' 
            ? 'allbranches' 
            : (() => {
                const branch = branches.find(b => b.name === selectedBranch);
                return branch ? formatNameForFilename(branch.name) : 'UnknownBranch';
              })();

          filename = `${formattedComplianceType}${frequencySuffix}${selectedYear}${formattedBranch}`;
          downloadFile(csvContentCompliance, `${filename}.csv`, 'text/csv');
          break;
      }

      toast({
        title: "Report exported successfully",
        description: `Your ${selectedReport} report has been downloaded.`,
      });

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "There was an error exporting the report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const convertToCSV = (data: any[], selectedCols?: string[]): string => {
    if (!data.length) return '';
    
    const allHeaders = Object.keys(data[0]);
    const headers = selectedCols ? allHeaders.filter(h => selectedCols.includes(h)) : allHeaders;
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        if (typeof value === 'object' && value !== null) {
          return JSON.stringify(value);
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  };

  const downloadFile = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Reports & Analytics
          </h1>
          <p className="text-lg text-muted-foreground">
            Generate comprehensive reports and export data for analysis
          </p>
        </div>
      </div>

      {/* Report Configuration */}
      <Card className="card-premium animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-primary" />
            Report Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Report Type</label>
              <Select value={selectedReport} onValueChange={(value) => {
                setSelectedReport(value);
                initializeSelectedColumns(value);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((report) => (
                    <SelectItem key={report.id} value={report.id}>
                      <div className="flex items-center gap-2">
                        <span>{report.icon}</span>
                        <span>{report.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Branch Filter</label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches
                    .filter(branch => isAdmin || getAccessibleBranches().includes(branch.id))
                    .map((branch) => (
                      <SelectItem key={branch.id} value={branch.name}>
                        {branch.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {selectedReport === "leaves" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Leave Type</label>
                  <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Leave Types</SelectItem>
                      {leaveTypes.map((leaveType) => (
                        <SelectItem key={leaveType.id} value={leaveType.name}>
                          {leaveType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Leave Status</label>
                  <Select value={selectedLeaveStatus} onValueChange={setSelectedLeaveStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {selectedReport === "compliance" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Compliance Type</label>
                <Select value={selectedComplianceType} onValueChange={setSelectedComplianceType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select compliance type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Compliance Types</SelectItem>
                    {complianceTypes.map((complianceType) => (
                      <SelectItem key={complianceType.id} value={complianceType.id}>
                        {complianceType.name} ({complianceType.frequency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {selectedReport === "leaves" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <DatePickerWithRange date={dateRange} setDate={setDateRange} />
            </div>
          )}

          {selectedReport === "compliance" && selectedComplianceType !== "all" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Year</label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getYearOptions().map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {getCurrentComplianceType()?.frequency.toLowerCase() === 'monthly' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Months</label>
                  <div className="grid grid-cols-3 gap-2">
                    {getMonthOptions().map((month) => (
                      <div key={month.value} className="flex items-center space-x-2">
                        <Checkbox 
                          id={month.value}
                          checked={selectedMonths.includes(month.value)}
                          onCheckedChange={() => handleMonthToggle(month.value)}
                        />
                        <label htmlFor={month.value} className="text-sm">
                          {month.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {getCurrentComplianceType()?.frequency.toLowerCase() === 'quarterly' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quarters</label>
                  <div className="grid grid-cols-2 gap-2">
                    {getQuarterOptions().map((quarter) => (
                      <div key={quarter.value} className="flex items-center space-x-2">
                        <Checkbox 
                          id={quarter.value}
                          checked={selectedQuarters.includes(quarter.value)}
                          onCheckedChange={() => handleQuarterToggle(quarter.value)}
                        />
                        <label htmlFor={quarter.value} className="text-sm">
                          {quarter.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Column Selection */}
          {selectedReport && (
            <Collapsible open={isColumnSelectorOpen} onOpenChange={setIsColumnSelectorOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <FileX className="w-4 h-4" />
                    Select Columns ({selectedColumns[selectedReport]?.length || 0} selected)
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isColumnSelectorOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Choose columns to include:</span>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleSelectAllColumns(selectedReport, true)}
                    >
                      Select All
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleSelectAllColumns(selectedReport, false)}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                  {reportTypes.find(r => r.id === selectedReport)?.fields.map((field) => (
                    <div key={field} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`${selectedReport}-${field}`}
                        checked={selectedColumns[selectedReport]?.includes(field) || false}
                        onCheckedChange={(checked) => handleColumnToggle(selectedReport, field, checked as boolean)}
                      />
                      <label 
                        htmlFor={`${selectedReport}-${field}`} 
                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {field}
                      </label>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Export Section */}
          {selectedReport && (
            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Ready to export {reportTypes.find(r => r.id === selectedReport)?.name}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => handleExport('csv')}
                  disabled={!selectedReport || isExporting || !selectedColumns[selectedReport]?.length}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
                <Button 
                  onClick={() => handleExport('xlsx')}
                  disabled={!selectedReport || isExporting || !selectedColumns[selectedReport]?.length}
                  className="bg-gradient-primary hover:opacity-90"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportTypes.map((report, index) => (
          <Card 
            key={report.id} 
            className={`card-premium animate-fade-in cursor-pointer transition-all duration-300 hover:shadow-glow ${
              selectedReport === report.id ? 'ring-2 ring-primary border-primary/50' : ''
            }`}
            style={{ animationDelay: `${index * 100}ms` }}
            onClick={() => {
              setSelectedReport(report.id);
              initializeSelectedColumns(report.id);
            }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{report.icon}</div>
                <div>
                  <CardTitle className="text-lg">{report.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{report.description}</p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">Included Fields:</h4>
                <div className="flex flex-wrap gap-1">
                  {report.fields.map((field) => (
                    <span key={field} className="text-xs px-2 py-1 bg-muted rounded-md">
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
