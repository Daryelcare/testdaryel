import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, Eye, FileText, Edit, Trash2, Send, ArrowUpDown, ArrowUp, ArrowDown, Plus, Minus, Languages, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { generateJobApplicationPdf } from "@/lib/job-application-pdf";
import { ReviewSummary } from "@/components/job-application/ReviewSummary";
import { usePermissions } from "@/contexts/PermissionsContext";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { useActivitySync } from "@/hooks/useActivitySync";
import { DatePickerWithRange, DatePicker } from "@/components/ui/date-picker";
import { DateRange } from "react-day-picker";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { TimeSlotsList } from "./TimeSlotsList";
import { ReferenceButtons } from "./ReferenceButtons";
import { DownloadButton } from "@/components/ui/download-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { EditApplicationDialog } from "./EditApplicationDialog";
import { RequestDocumentsDialog } from "./RequestDocumentsDialog";
import { UploadedDocumentsView } from "./UploadedDocumentsView";
// Helper function to format dates from YYYY-MM-DD to MM/DD/YYYY
const formatDateDisplay = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Not provided';
  
  // Check if it's already in MM/DD/YYYY format
  if (dateString.includes('/')) return dateString;
  
  // Convert from YYYY-MM-DD to MM/DD/YYYY
  try {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  } catch (error) {
    return dateString; // Return original if conversion fails
  }
};

interface JobApplication {
  id: string;
  personal_info: any;
  availability: any;
  emergency_contact: any;
  employment_history: any;
  reference_info: any;
  skills_experience: any;
  declarations: any;
  consent: any;
  status: string;
  created_at: string;
  updated_at: string;
}

export type JobApplicationSortField = 'applicant_name' | 'position' | 'created_at' | 'postcode' | 'english_proficiency';
export type JobApplicationSortDirection = 'asc' | 'desc';

export function JobApplicationsContent() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const { syncNow } = useActivitySync();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<JobApplicationSortField>('created_at');
  const [sortDirection, setSortDirection] = useState<JobApplicationSortDirection>('desc');
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [statusOptions, setStatusOptions] = useState<string[]>(['new','reviewing','interviewed','accepted','rejected']);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [languageSearch, setLanguageSearch] = useState("");
  const [isLanguagePopoverOpen, setIsLanguagePopoverOpen] = useState(false);
  
  // Comprehensive list of common languages
  const allPossibleLanguages = [
    "Afrikaans", "Albanian", "Amharic", "Arabic", "Armenian", "Assamese", "Azerbaijani",
    "Basque", "Belarusian", "Bengali", "Bosnian", "Bulgarian", "Burmese",
    "Catalan", "Cebuano", "Chinese", "Corsican", "Croatian", "Czech",
    "Danish", "Dutch",
    "English", "Esperanto", "Estonian",
    "Filipino", "Finnish", "French", "Frisian",
    "Galician", "Georgian", "German", "Greek", "Gujarati",
    "Haitian Creole", "Hausa", "Hawaiian", "Hebrew", "Hindi", "Hmong", "Hungarian",
    "Icelandic", "Igbo", "Indonesian", "Irish", "Italian",
    "Japanese", "Javanese",
    "Kannada", "Kazakh", "Khmer", "Korean", "Kurdish", "Kyrgyz",
    "Lao", "Latin", "Latvian", "Lithuanian", "Luxembourgish",
    "Macedonian", "Malagasy", "Malay", "Malayalam", "Maltese", "Mandarin", "Maori", "Marathi", "Mongolian",
    "Nepali", "Norwegian",
    "Odia", "Pashto", "Persian", "Polish", "Portuguese", "Punjabi",
    "Romanian", "Russian",
    "Samoan", "Scots Gaelic", "Serbian", "Sesotho", "Shona", "Sindhi", "Sinhala", "Slovak", "Slovenian", 
    "Somali", "Spanish", "Sundanese", "Swahili", "Swedish",
    "Tagalog", "Tajik", "Tamil", "Tatar", "Telugu", "Thai", "Turkish", "Turkmen",
    "Ukrainian", "Urdu", "Uyghur", "Uzbek",
    "Vietnamese",
    "Welsh",
    "Xhosa",
    "Yiddish", "Yoruba",
    "Zulu"
  ];
  const { toast } = useToast();
  const { companySettings } = useCompany();
  const { user } = useAuth();
  const { getAccessibleBranches, isAdmin } = usePermissions();
  const { hasPageAction } = usePermissions();

  // Check if user has permission to view job applications
  if (!isAdmin && !hasPageAction('job-applications', 'view')) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          You don't have permission to view job applications.
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetchStatusOptions();
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchApplications();
  }, [statusFilter, sortField, sortDirection, dateRange, page, pageSize]);

  // Extract available languages from applications
  useEffect(() => {
    const languagesSet = new Set<string>();
    applications.forEach(app => {
      const langs = app.personal_info?.otherLanguages || [];
      if (Array.isArray(langs)) {
        langs.forEach((lang: string) => {
          if (lang && lang.trim()) {
            languagesSet.add(lang.trim());
          }
        });
      }
    });
    setAvailableLanguages(Array.from(languagesSet).sort());
  }, [applications]);

  // Filter languages based on search - use all possible languages, not just from applicants
  const filteredLanguages = useMemo(() => {
    if (!languageSearch) return [];
    
    // Combine applicant languages with all possible languages
    const allLanguages = new Set([...availableLanguages, ...allPossibleLanguages]);
    
    return Array.from(allLanguages)
      .filter(lang => lang.toLowerCase().includes(languageSearch.toLowerCase()))
      .sort();
  }, [availableLanguages, languageSearch, allPossibleLanguages]);

  // Filter applications locally using useMemo
  const filteredApplications = useMemo(() => {
    let filtered = applications;

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(app => 
        (app.personal_info?.fullName || '').toLowerCase().includes(term) ||
        (app.personal_info?.email || '').toLowerCase().includes(term) ||
        (app.personal_info?.positionAppliedFor || '').toLowerCase().includes(term)
      );
    }

    // Filter by language
    if (selectedLanguages.length > 0) {
      filtered = filtered.filter(app => {
        const appLanguages = app.personal_info?.otherLanguages || [];
        if (!Array.isArray(appLanguages)) return false;
        
        // Check if applicant speaks ANY of the selected languages
        return selectedLanguages.some(selectedLang => 
          appLanguages.some((appLang: string) => 
            appLang.toLowerCase().includes(selectedLang.toLowerCase())
          )
        );
      });
    }

    return filtered;
  }, [applications, searchTerm, selectedLanguages]);

  const fetchStatusOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('job_application_settings')
        .select('setting_value, display_order, is_active')
        .eq('category', 'status')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (!error && data) {
        const opts = data.map((d: any) => {
          try {
            const statusValue = typeof d.setting_value === 'string' 
              ? JSON.parse(d.setting_value) 
              : d.setting_value;
            return statusValue?.status_name || statusValue?.value;
          } catch {
            return d.setting_value?.status_name || d.setting_value?.value;
          }
        }).filter(Boolean);
        if (opts.length) setStatusOptions(opts);
      }
    } catch (e) {
      // ignore, use defaults
    }
  };

  const fetchApplications = async () => {
    try {
      let query = supabase
        .from('job_applications')
        .select('*', { count: 'exact' });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        const toDate = new Date(dateRange.to);
        toDate.setDate(toDate.getDate() + 1); // exclusive upper bound
        query = query.lt('created_at', toDate.toISOString());
      }

      if (sortField === 'created_at') {
        query = query.order('created_at', { ascending: sortDirection === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const from = (page - 1) * pageSize;
      const toIdx = from + pageSize - 1;
      const { data, error, count } = await query.range(from, toIdx);

      if (error) throw error;
      setApplications(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast({
        title: "Error",
        description: "Failed to fetch job applications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  const deleteApplication = async (id: string) => {
    try {
      const { error } = await supabase
        .from('job_applications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setApplications(prev => prev.filter(app => app.id !== id));
      syncNow();

      toast({
        title: "Application Deleted",
        description: "The job application has been deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting application:', error);
      toast({
        title: "Error",
        description: "Failed to delete application",
        variant: "destructive",
      });
    }
  };

  const sendReferenceEmail = (application: JobApplication, referenceIndex: number) => {
    const reference = referenceIndex === 1 
      ? application.employment_history?.recentEmployer 
      : application.employment_history?.previousEmployers?.[0];
    
    if (!reference?.email) {
      toast({
        title: "Error",
        description: "No email address found for this reference",
        variant: "destructive",
      });
      return;
    }

    const applicantName = application.personal_info?.fullName || 
                         `${application.personal_info?.firstName || ''} ${application.personal_info?.lastName || ''}`.trim() ||
                         'Unknown Applicant';
    const position = application.personal_info?.positionAppliedFor || 'Unknown Position';
    const referenceName = reference.name || reference.company || 'Reference';
    const referenceCompany = reference.company || 'Unknown Company';
    const referenceAddress = [
      reference.address,
      reference.address2,
      reference.town,
      reference.postcode
    ].filter(Boolean).join(', ') || 'Address not provided';
    
    const subject = `Reference Request for ${applicantName} - ${position} Position`;
    const body = `Dear ${referenceName},

We hope this email finds you well.

We are writing to request a reference for ${applicantName}, who has applied for the position of ${position} with our company. ${applicantName} has listed you as a reference.

Could you please provide information about:
- The nature and duration of your relationship with ${applicantName}
- Their professional capabilities and work ethic
- Any relevant skills or qualities that would be pertinent to this role
- Their reliability and punctuality
- Would you employ this person again? If not, why not?

Your insights would be greatly appreciated and will help us make an informed decision.

Thank you for your time and assistance.

Best regards,
Mohamed Ahmed
HR Department

Reference Details:
Company: ${referenceCompany}
Contact Person: ${referenceName}
Position: ${reference.position || 'Not specified'}
Phone: ${reference.telephone || 'Not provided'}
Address: ${referenceAddress}

Please complete and return this reference as soon as possible.`;

    const mailtoLink = `mailto:${reference.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };

  const handleSort = (field: JobApplicationSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: JobApplicationSortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const displayedApplications = sortField === 'created_at'
    ? filteredApplications
    : [...filteredApplications].sort((a, b) => {
      let aVal: any;
      let bVal: any;
      
      switch (sortField) {
        case 'applicant_name':
          aVal = a.personal_info?.fullName || '';
          bVal = b.personal_info?.fullName || '';
          break;
        case 'position':
          aVal = a.personal_info?.positionAppliedFor || '';
          bVal = b.personal_info?.positionAppliedFor || '';
          break;
        case 'postcode':
          aVal = a.personal_info?.postcode || '';
          bVal = b.personal_info?.postcode || '';
          break;
        case 'english_proficiency':
          aVal = a.personal_info?.englishProficiency || '';
          bVal = b.personal_info?.englishProficiency || '';
          break;
        default:
          return 0;
      }
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? comparison : -comparison;
      } else {
        const comparison = (aVal || 0) - (bVal || 0);
        return sortDirection === 'asc' ? comparison : -comparison;
      }
    });

  const handlePageSizeChange = (newPageSize: string) => {
    if (newPageSize === "all") {
      setPageSize(filteredApplications.length || 999999);
    } else {
      setPageSize(parseInt(newPageSize));
    }
    setPage(1); // Reset to first page when changing page size
  };

  const effectivePageSize = pageSize >= 999999 ? filteredApplications.length : pageSize;
  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / effectivePageSize));
  const paginatedApplications = displayedApplications.slice((page - 1) * effectivePageSize, page * effectivePageSize);
  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading job applications...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Company Settings Warning */}
      {(!companySettings.name || companySettings.name.trim().length === 0) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 text-yellow-600 dark:text-yellow-400">⚠️</div>
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Company Settings Required</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Your company name is not configured. This is required for sending reference emails.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => window.location.href = '/settings'}
              >
                Go to Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Job Applications</h1>
          <p className="text-muted-foreground">Manage and review job applications</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{filteredApplications.length}</div>
          <div className="text-sm text-muted-foreground">
            {searchTerm ? `Filtered Results` : `Total Applications`}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search by name, email, or position..."
            value={searchTerm}
            onChange={(e) => { setPage(1); setSearchTerm(e.target.value); }}
            className="pl-10"
          />
        </div>
        <Popover open={isLanguagePopoverOpen} onOpenChange={(open) => {
          setIsLanguagePopoverOpen(open);
          if (!open) setLanguageSearch("");
        }}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full sm:w-auto sm:min-w-[200px] justify-between"
              onClick={() => setIsLanguagePopoverOpen(true)}
            >
              <Languages className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">
                {selectedLanguages.length > 0
                  ? `${selectedLanguages.length} selected`
                  : "Search languages..."}
              </span>
              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput 
                placeholder="Type to search languages..." 
                value={languageSearch}
                onValueChange={setLanguageSearch}
              />
              <CommandList>
                {languageSearch.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Start typing to search languages...
                  </div>
                ) : filteredLanguages.length === 0 ? (
                  <CommandEmpty>No languages found.</CommandEmpty>
                ) : (
                  <CommandGroup>
                    {filteredLanguages.map((language) => {
                      const count = applications.filter(app => {
                        const langs = app.personal_info?.otherLanguages || [];
                        return Array.isArray(langs) && langs.includes(language);
                      }).length;
                      const isSelected = selectedLanguages.includes(language);

                      return (
                        <CommandItem
                          key={language}
                          value={language}
                          onSelect={() => {
                            setPage(1);
                            if (isSelected) {
                              setSelectedLanguages(selectedLanguages.filter(l => l !== language));
                            } else {
                              setSelectedLanguages([...selectedLanguages, language]);
                            }
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              isSelected ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="flex-1">{language}</span>
                          <Badge variant="secondary" className="ml-2">
                            {count}
                          </Badge>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      
      {/* Selected Languages Display */}
      {selectedLanguages.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Filtering by:</span>
          {selectedLanguages.map(lang => (
            <Badge 
              key={lang} 
              variant="secondary" 
              className="gap-1 pr-1 pl-2.5"
            >
              {lang}
              <button
                onClick={() => {
                  setPage(1);
                  setSelectedLanguages(prev => prev.filter(l => l !== lang));
                }}
                className="hover:bg-background/50 rounded-full p-0.5 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPage(1);
              setSelectedLanguages([]);
            }}
            className="h-6 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}
      {/* Applications Table */}
      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>
                     <Button 
                       variant="ghost" 
                       className="p-0 h-auto font-medium hover:bg-transparent"
                       onClick={() => handleSort('applicant_name')}
                     >
                       Applicant {getSortIcon('applicant_name')}
                     </Button>
                   </TableHead>
                   <TableHead>
                     <Button 
                       variant="ghost" 
                       className="p-0 h-auto font-medium hover:bg-transparent"
                       onClick={() => handleSort('position')}
                     >
                       Position Applied {getSortIcon('position')}
                     </Button>
                   </TableHead>
                   <TableHead>
                     <Button 
                       variant="ghost" 
                       className="p-0 h-auto font-medium hover:bg-transparent"
                       onClick={() => handleSort('created_at')}
                     >
                       Date {getSortIcon('created_at')}
                     </Button>
                   </TableHead>
                   <TableHead>
                     <Button 
                       variant="ghost" 
                       className="p-0 h-auto font-medium hover:bg-transparent"
                       onClick={() => handleSort('postcode')}
                     >
                       Postcode {getSortIcon('postcode')}
                     </Button>
                   </TableHead>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        className="p-0 h-auto font-medium hover:bg-transparent"
                        onClick={() => handleSort('english_proficiency')}
                      >
                        Proficiency In English {getSortIcon('english_proficiency')}
                      </Button>
                    </TableHead>
                    <TableHead>Actions</TableHead>
                 </TableRow>
               </TableHeader>
              <TableBody>
                {paginatedApplications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell>
                      <div className="font-medium">
                        {application.personal_info?.fullName || 'Unknown'}
                      </div>
                    </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span>{application.personal_info?.positionAppliedFor || 'Not specified'}</span>
                  {application.personal_info?.personalCareWillingness && (
                    <Badge variant="secondary" className="capitalize">
                      {application.personal_info.personalCareWillingness}
                    </Badge>
                  )}
                </div>
              </TableCell>
                    <TableCell>
                      {new Date(application.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {application.personal_info?.postcode || 'Not provided'}
                    </TableCell>
                     <TableCell>
                       {application.personal_info?.englishProficiency || 'Not specified'}
                     </TableCell>
                     <TableCell>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedApplication(application)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-6xl max-h-[90vh]">
                            <DialogHeader>
                              <DialogTitle>Application Details - {application.personal_info?.fullName}</DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="max-h-[75vh]">
                              {selectedApplication && (
                               <ApplicationDetails 
                                  application={selectedApplication} 
                                  onUpdate={fetchApplications}
                                  onSendReferenceEmail={sendReferenceEmail}
                                  syncNow={syncNow}
                                />
                              )}
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                        
                         {(isAdmin || hasPageAction('job-applications', 'delete')) && (
                           <AlertDialog>
                             <AlertDialogTrigger asChild>
                               <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                                 <Trash2 className="w-4 h-4 mr-1" />
                                 Delete
                               </Button>
                             </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Application</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the application from {application.personal_info?.fullName}? 
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteApplication(application.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                           </AlertDialogContent>
                         </AlertDialog>
                         )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {totalCount > pageSize && pageSize < 999999 && (
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Items per page:</span>
            <Select value={pageSize >= 999999 ? "all" : pageSize.toString()} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page > 1) {
                      setPage(page - 1);
                      window.scrollTo(0, 0);
                    }
                  }}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const pageNumber = start + i;
                if (pageNumber > totalPages) return null;
                return (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      href="#"
                      isActive={pageNumber === page}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(pageNumber);
                        window.scrollTo(0, 0);
                      }}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page < totalPages) {
                      setPage(page + 1);
                      window.scrollTo(0, 0);
                    }
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
      {displayedApplications.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No applications found</h3>
          <p className="text-gray-500">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filters'
              : 'Job applications will appear here once submitted'
            }
          </p>
        </div>
      )}
    </div>
  );
}

function ApplicationDetails({ 
  application, 
  onUpdate, 
  onSendReferenceEmail,
  syncNow
}: { 
  application: JobApplication; 
  onUpdate?: () => void;
  onSendReferenceEmail: (app: JobApplication, refIndex: number) => void;
  syncNow?: () => void;
}) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const { companySettings } = useCompany();
  const { isAdmin, hasPageAction } = usePermissions();

  const toJobAppData = () => {
    const pi = application.personal_info || {};
    const fullName = pi.fullName || `${pi.firstName || ''} ${pi.lastName || ''}`.trim();

    const personalInfo = {
      title: pi.title || '',
      fullName,
      email: pi.email || '',
      confirmEmail: pi.confirmEmail || pi.email || '',
      telephone: pi.telephone || '',
      dateOfBirth: pi.dateOfBirth || pi.dob || '',
      streetAddress: pi.streetAddress || pi.address || '',
      streetAddress2: pi.streetAddress2 || pi.address2 || '',
      town: pi.town || pi.city || '',
      borough: pi.borough || '',
      postcode: pi.postcode || '',
      englishProficiency: pi.englishProficiency || '',
      otherLanguages: Array.isArray(pi.otherLanguages)
        ? pi.otherLanguages
        : (pi.otherLanguages ? String(pi.otherLanguages).split(',').map((s:string)=>s.trim()).filter(Boolean) : []),
      positionAppliedFor: pi.positionAppliedFor || '',
      personalCareWillingness: pi.personalCareWillingness || '',
      hasDBS: pi.hasDBS || '',
      hasCarAndLicense: pi.hasCarAndLicense || '',
      nationalInsuranceNumber: pi.nationalInsuranceNumber || '',
    };

    const av = application.availability || {};
    const availability = {
      timeSlots: av.timeSlots || av.selectedSlots || {},
      hoursPerWeek: av.hoursPerWeek || '',
      hasRightToWork: typeof av.hasRightToWork === 'boolean' ? (av.hasRightToWork ? 'Yes' : 'No') : (av.hasRightToWork || ''),
    };

    const ec = application.emergency_contact || {};
    const emergencyContact = {
      fullName: ec.fullName || '',
      relationship: ec.relationship || '',
      contactNumber: ec.contactNumber || '',
      howDidYouHear: ec.howDidYouHear || '',
    };

    const eh = application.employment_history || {};
    const recent = eh.recentEmployer || null;
    const previous = Array.isArray(eh.previousEmployers) ? eh.previousEmployers : [];
    const previouslyEmployed = typeof eh.previouslyEmployed === 'boolean'
      ? (eh.previouslyEmployed ? 'yes' : 'no')
      : (eh.previouslyEmployed || ((recent || previous.length) ? 'yes' : 'no'));

    const references: Record<string, any> = {};
    let refCount = 0;
    const addRef = (ref: any) => {
      if (!ref) return;
      const hasAny = ref.name || ref.company || ref.email || ref.contactNumber || ref.jobTitle || ref.address;
      if (!hasAny) return;
      refCount += 1;
      references[`reference${refCount}`] = {
        name: ref.name || '',
        company: ref.company || '',
        jobTitle: ref.jobTitle || ref.position || '',
        email: ref.email || '',
        contactNumber: ref.contactNumber || ref.telephone || '',
        address: ref.address || '',
        address2: ref.address2 || '',
        town: ref.town || '',
        postcode: ref.postcode || '',
      };
    };
    const rinfo = application.reference_info || {};
    addRef(rinfo.reference1);
    addRef(rinfo.reference2);
    if (Array.isArray(rinfo.references)) rinfo.references.forEach(addRef);
    if (Array.isArray(rinfo.additionalReferences)) rinfo.additionalReferences.forEach(addRef);
    if (recent) addRef(recent);
    previous.forEach(addRef);

    const skillsExperience = {
      skills: application.skills_experience?.skills || application.skills_experience || {},
    };

    const declaration = application.declarations || {};
    const termsPolicy = application.consent || {};

    return {
      personalInfo,
      availability,
      emergencyContact,
      employmentHistory: {
        previouslyEmployed,
        recentEmployer: recent || undefined,
        previousEmployers: previous || [],
      },
      references: references as any,
      skillsExperience,
      declaration,
      termsPolicy,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header with Edit and Download buttons */}
      <div className="sticky top-0 z-10 bg-background pb-4 border-b mb-4 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">
            {application.personal_info?.fullName || 
             `${application.personal_info?.firstName || ''} ${application.personal_info?.lastName || ''}`.trim() ||
             'Unknown Applicant'}
          </h3>
          <p className="text-sm text-muted-foreground">
            Applied: {new Date(application.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          {(isAdmin || hasPageAction('job-applications', 'download-pdf')) && (
            <DownloadButton
              onDownload={async () => {
                await generateJobApplicationPdf(toJobAppData() as any, {
                  logoUrl: companySettings.logo,
                  companyName: companySettings.name,
                });
                toast({
                  title: "PDF Generated",
                  description: "The application has been downloaded as a PDF.",
                });
              }}
              downloadingText="Generating PDF..."
              completedText="Downloaded"
            >
              Download PDF
            </DownloadButton>
          )}
          {(isAdmin || hasPageAction('job-applications', 'edit')) && (
            <Button size="sm" onClick={() => setIsEditDialogOpen(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* View mode - use comprehensive ReviewSummary layout */}
      <ReviewSummary data={toJobAppData() as any} />
      
      {/* Reference Email Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Reference Management</CardTitle>
        </CardHeader>
        <CardContent>
          <ReferenceButtons 
            application={application}
            references={toJobAppData().references}
            onUpdate={onUpdate}
          />
        </CardContent>
      </Card>

      {/* Document Upload Request */}
      <Card>
        <CardHeader>
          <CardTitle>Document Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Request documents from the applicant using our secure upload portal with camera scanning.
            </p>
            <RequestDocumentsDialog 
              application={application}
              onSuccess={onUpdate}
            />
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Documents Section */}
      <UploadedDocumentsView applicationId={application.id} />

      {/* Edit Dialog */}
      <EditApplicationDialog
        application={application}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={() => {
          onUpdate?.();
          syncNow?.();
        }}
      />
    </div>
  );
};