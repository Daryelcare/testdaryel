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
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(application);
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

  const handleDownloadJson = () => {
    try {
      const data = toJobAppData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'job-application.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('JSON download failed', err);
      toast({ title: 'Download Error', description: 'Failed to download JSON.', variant: 'destructive' });
    }
  };

  const downloadApplication = async () => {
try {
      await generateJobApplicationPdf(toJobAppData() as any, {
        logoUrl: companySettings.logo,
        companyName: companySettings.name,
      });
      toast({
        title: "PDF Generated",
        description: "The application has been downloaded as a PDF.",
      });
    } catch (err) {
      console.error('PDF generation failed', err);
      toast({
        title: "PDF Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };
  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({
          personal_info: editData.personal_info,
          availability: editData.availability,
          emergency_contact: editData.emergency_contact,
          employment_history: editData.employment_history,
          reference_info: editData.reference_info,
          skills_experience: editData.skills_experience,
          declarations: editData.declarations,
          consent: editData.consent
        })
        .eq('id', editData.id);

      if (error) throw error;

      // Update the local application state with the saved data
      Object.assign(application, editData);

      toast({
        title: "Application Updated",
        description: "The job application has been updated successfully.",
      });

      syncNow?.();
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error updating application:', error);
      toast({
        title: "Error",
        description: "Failed to update application",
        variant: "destructive",
      });
    }
  };

  const displayData = isEditing ? editData : application;

  return (
    <div className="space-y-6">
      {/* Header with Edit and Download buttons */}
      <div className="sticky top-0 z-10 bg-background pb-4 border-b mb-4 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">
            {displayData.personal_info?.fullName || 
             `${displayData.personal_info?.firstName || ''} ${displayData.personal_info?.lastName || ''}`.trim() ||
             'Unknown Applicant'}
          </h3>
          <p className="text-sm text-muted-foreground">
            Applied: {new Date(displayData.created_at).toLocaleDateString()}
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
          {isEditing ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
            </div>
          ) : (
            (isAdmin || hasPageAction('job-applications', 'edit')) && (
              <Button size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )
          )}
        </div>
      </div>


      {/* Application Content - Using ReviewSummary layout but with editing capability */}
      {isEditing ? (
        // Editing mode - keep the detailed form layout for editing
        <EditableApplicationContent 
          editData={editData}
          setEditData={setEditData}
          onSendReferenceEmail={onSendReferenceEmail}
        />
      ) : (
        // View mode - use comprehensive ReviewSummary layout
        <ReviewSummary data={toJobAppData() as any} />
      )}
      
      {/* Reference Email Actions */}
      {!isEditing && (
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
      )}
    </div>
  );
};

// Separate component for editing to keep the existing detailed form layout
function EditableApplicationContent({ 
  editData, 
  setEditData, 
  onSendReferenceEmail 
}: { 
  editData: any; 
  setEditData: (data: any) => void;
  onSendReferenceEmail: (app: JobApplication, refIndex: number) => void;
}) {
  // Initialize missing objects if they don't exist
  const initializeData = () => {
    const initialized = { ...editData };
    if (!initialized.personal_info) initialized.personal_info = {};
    if (!initialized.availability) initialized.availability = {};
    if (!initialized.emergency_contact) initialized.emergency_contact = {};
    if (!initialized.employment_history) initialized.employment_history = {};
    if (!initialized.reference_info) initialized.reference_info = {};
    if (!initialized.skills_experience) initialized.skills_experience = {};
    if (!initialized.declarations) initialized.declarations = {};
    if (!initialized.consent) initialized.consent = {};
    
    // Initialize nested objects
    if (!initialized.employment_history.recentEmployer) initialized.employment_history.recentEmployer = {};
    if (!initialized.employment_history.previousEmployers) initialized.employment_history.previousEmployers = [];
    if (!initialized.reference_info.reference1) initialized.reference_info.reference1 = {};
    if (!initialized.reference_info.reference2) initialized.reference_info.reference2 = {};
    if (!initialized.availability.timeSlots) initialized.availability.timeSlots = {};
    
    return initialized;
  };

  const safeEditData = initializeData();

  const updatePersonalInfo = (field: string, value: any) => {
    setEditData({
      ...editData,
      personal_info: { ...editData.personal_info, [field]: value }
    });
  };

  const updateAvailability = (field: string, value: any) => {
    setEditData({
      ...editData,
      availability: { ...editData.availability, [field]: value }
    });
  };

  const updateEmergencyContact = (field: string, value: any) => {
    setEditData({
      ...editData,
      emergency_contact: { ...editData.emergency_contact, [field]: value }
    });
  };

  const updateEmploymentHistory = (field: string, value: any) => {
    setEditData({
      ...editData,
      employment_history: { ...editData.employment_history, [field]: value }
    });
  };

  const updateRecentEmployer = (field: string, value: any) => {
    setEditData({
      ...editData,
      employment_history: { 
        ...editData.employment_history, 
        recentEmployer: { ...editData.employment_history?.recentEmployer, [field]: value }
      }
    });
  };

  const updateReference = (refKey: 'reference1' | 'reference2', field: string, value: any) => {
    setEditData({
      ...editData,
      reference_info: {
        ...editData.reference_info,
        [refKey]: { ...editData.reference_info?.[refKey], [field]: value }
      }
    });
  };

  const updateSkillsExperience = (field: string, value: any) => {
    setEditData({
      ...editData,
      skills_experience: { ...editData.skills_experience, [field]: value }
    });
  };

  const updateDeclarations = (field: string, value: any) => {
    setEditData({
      ...editData,
      declarations: { ...editData.declarations, [field]: value }
    });
  };

  const updatePreviousEmployer = (index: number, field: string, value: any) => {
    const currentEmployers = editData.employment_history?.previousEmployers || [];
    const updated = currentEmployers.map((emp, i) => 
      i === index ? { ...emp, [field]: value } : emp
    );
    setEditData({
      ...editData,
      employment_history: { 
        ...editData.employment_history, 
        previousEmployers: updated
      }
    });
  };

  const addPreviousEmployer = () => {
    const currentEmployers = editData.employment_history?.previousEmployers || [];
    const emptyEmployer = {
      company: '',
      name: '',
      email: '',
      position: '',
      address: '',
      address2: '',
      town: '',
      postcode: '',
      telephone: '',
      from: '',
      to: '',
      leavingDate: '',
      keyTasks: '',
      reasonForLeaving: '',
    };
    setEditData({
      ...editData,
      employment_history: { 
        ...editData.employment_history, 
        previousEmployers: [...currentEmployers, emptyEmployer]
      }
    });
  };

  const removePreviousEmployer = (index: number) => {
    const currentEmployers = editData.employment_history?.previousEmployers || [];
    setEditData({
      ...editData,
      employment_history: { 
        ...editData.employment_history, 
        previousEmployers: currentEmployers.filter((_, i) => i !== index)
      }
    });
  };

  const addReference = () => {
    const currentReferences = [...(editData.reference_info?.additionalReferences || [])];
    const emptyReference = {
      name: '',
      company: '',
      jobTitle: '',
      email: '',
      address: '',
      address2: '',
      town: '',
      contactNumber: '',
      postcode: '',
    };
    setEditData({
      ...editData,
      reference_info: {
        ...editData.reference_info,
        additionalReferences: [...currentReferences, emptyReference]
      }
    });
  };

  const removeReference = (index: number) => {
    const currentReferences = editData.reference_info?.additionalReferences || [];
    setEditData({
      ...editData,
      reference_info: {
        ...editData.reference_info,
        additionalReferences: currentReferences.filter((_, i) => i !== index)
      }
    });
  };

  const updateAdditionalReference = (index: number, field: string, value: any) => {
    const currentReferences = editData.reference_info?.additionalReferences || [];
    const updated = currentReferences.map((ref, i) => 
      i === index ? { ...ref, [field]: value } : ref
    );
    setEditData({
      ...editData,
      reference_info: {
        ...editData.reference_info,
        additionalReferences: updated
      }
    });
  };

  const updateConsent = (field: string, value: any) => {
    setEditData({
      ...editData,
      consent: { ...editData.consent, [field]: value }
    });
  };

  // Initialize additionalReferences if it doesn't exist
  if (!safeEditData.reference_info?.additionalReferences) {
    safeEditData.reference_info = {
      ...safeEditData.reference_info,
      additionalReferences: []
    };
  }

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Title</label>
              <Input
                value={safeEditData.personal_info?.title || ''}
                onChange={(e) => updatePersonalInfo('title', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Full Name</label>
              <Input
                value={safeEditData.personal_info?.fullName || ''}
                onChange={(e) => updatePersonalInfo('fullName', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Email</label>
              <Input
                value={safeEditData.personal_info?.email || ''}
                onChange={(e) => updatePersonalInfo('email', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Confirm Email</label>
              <Input
                value={safeEditData.personal_info?.confirmEmail || ''}
                onChange={(e) => updatePersonalInfo('confirmEmail', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Telephone/Mobile</label>
              <Input
                value={safeEditData.personal_info?.telephone || ''}
                onChange={(e) => updatePersonalInfo('telephone', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Date of Birth</label>
              <DatePicker
                selected={safeEditData.personal_info?.dateOfBirth ? new Date(safeEditData.personal_info.dateOfBirth) : undefined}
                onChange={(date) => updatePersonalInfo('dateOfBirth', date ? date.toISOString().split('T')[0] : '')}
                placeholder="Select date of birth"
                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Street Address</label>
              <Input
                value={safeEditData.personal_info?.streetAddress || ''}
                onChange={(e) => updatePersonalInfo('streetAddress', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Street Address 2</label>
              <Input
                value={safeEditData.personal_info?.streetAddress2 || ''}
                onChange={(e) => updatePersonalInfo('streetAddress2', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Town</label>
              <Input
                value={safeEditData.personal_info?.town || ''}
                onChange={(e) => updatePersonalInfo('town', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Borough</label>
              <Input
                value={safeEditData.personal_info?.borough || ''}
                onChange={(e) => updatePersonalInfo('borough', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Postcode</label>
              <Input
                value={safeEditData.personal_info?.postcode || ''}
                onChange={(e) => updatePersonalInfo('postcode', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">English Proficiency</label>
              <Select
                value={safeEditData.personal_info?.englishProficiency || ''}
                onValueChange={(value) => updatePersonalInfo('englishProficiency', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select proficiency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fluent">Fluent</SelectItem>
                  <SelectItem value="Good">Good</SelectItem>
                  <SelectItem value="Basic">Basic</SelectItem>
                  <SelectItem value="Limited">Limited</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Position Applied For</label>
              <Input
                value={safeEditData.personal_info?.positionAppliedFor || ''}
                onChange={(e) => updatePersonalInfo('positionAppliedFor', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Which personal care Are you willing to do?</label>
              <Select
                value={safeEditData.personal_info?.personalCareWillingness || ''}
                onValueChange={(value) => updatePersonalInfo('personalCareWillingness', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select personal care willingness" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-md z-50">
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">DBS</label>
              <Select
                value={safeEditData.personal_info?.hasDBS || ''}
                onValueChange={(value) => updatePersonalInfo('hasDBS', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select DBS status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Car & Licence</label>
              <Select
                value={safeEditData.personal_info?.hasCarAndLicense || ''}
                onValueChange={(value) => updatePersonalInfo('hasCarAndLicense', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select car & licence status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">NI Number</label>
              <Input
                value={safeEditData.personal_info?.nationalInsuranceNumber || ''}
                onChange={(e) => updatePersonalInfo('nationalInsuranceNumber', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Availability */}
      <Card>
        <CardHeader>
          <CardTitle>Availability</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Hours Per Week</label>
                <Input
                  value={safeEditData.availability?.hoursPerWeek || ''}
                  onChange={(e) => updateAvailability('hoursPerWeek', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Right to Work (UK)</label>
                <Select
                  value={safeEditData.availability?.hasRightToWork || ''}
                  onValueChange={(value) => updateAvailability('hasRightToWork', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select right to work status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Time Slots Editor */}
            <div>
              <label className="text-sm font-medium text-gray-500 mb-2 block">Time Slots</label>
              <div className="border rounded-lg p-4 space-y-3">
                {safeEditData.availability?.timeSlots && Object.keys(safeEditData.availability.timeSlots).length > 0 ? (
                  <TimeSlotsList timeSlots={safeEditData.availability.timeSlots} />
                ) : (
                  <p className="text-sm text-muted-foreground">No time slots selected</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Emergency Contact</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Full Name</label>
              <Input
                value={safeEditData.emergency_contact?.fullName || ''}
                onChange={(e) => updateEmergencyContact('fullName', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Relationship</label>
              <Input
                value={safeEditData.emergency_contact?.relationship || ''}
                onChange={(e) => updateEmergencyContact('relationship', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Contact Number</label>
              <Input
                value={safeEditData.emergency_contact?.contactNumber || ''}
                onChange={(e) => updateEmergencyContact('contactNumber', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">How Did You Hear About Us</label>
              <Input
                value={safeEditData.emergency_contact?.howDidYouHear || ''}
                onChange={(e) => updateEmergencyContact('howDidYouHear', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employment History */}
      <Card>
        <CardHeader>
          <CardTitle>Employment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Previously Employed</label>
              <Select
                value={safeEditData.employment_history?.previouslyEmployed || ''}
                onValueChange={(value) => updateEmploymentHistory('previouslyEmployed', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employment status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {safeEditData.employment_history?.previouslyEmployed === 'yes' && (
              <div className="space-y-4">
                <h4 className="font-medium">Most Recent Employer</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Company</label>
                    <Input
                      value={safeEditData.employment_history?.recentEmployer?.company || ''}
                      onChange={(e) => updateRecentEmployer('company', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Name</label>
                    <Input
                      value={safeEditData.employment_history?.recentEmployer?.name || ''}
                      onChange={(e) => updateRecentEmployer('name', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <Input
                      value={safeEditData.employment_history?.recentEmployer?.email || ''}
                      onChange={(e) => updateRecentEmployer('email', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Position Held</label>
                    <Input
                      value={safeEditData.employment_history?.recentEmployer?.position || ''}
                      onChange={(e) => updateRecentEmployer('position', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Address</label>
                    <Input
                      value={safeEditData.employment_history?.recentEmployer?.address || ''}
                      onChange={(e) => updateRecentEmployer('address', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Town</label>
                    <Input
                      value={safeEditData.employment_history?.recentEmployer?.town || ''}
                      onChange={(e) => updateRecentEmployer('town', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Postcode</label>
                    <Input
                      value={safeEditData.employment_history?.recentEmployer?.postcode || ''}
                      onChange={(e) => updateRecentEmployer('postcode', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Telephone</label>
                    <Input
                      value={safeEditData.employment_history?.recentEmployer?.telephone || ''}
                      onChange={(e) => updateRecentEmployer('telephone', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">From</label>
                    <DatePicker
                      selected={safeEditData.employment_history?.recentEmployer?.from ? new Date(safeEditData.employment_history.recentEmployer.from) : undefined}
                      onChange={(date) => updateRecentEmployer('from', date ? date.toISOString().split('T')[0] : '')}
                      placeholder="Select start date"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">To</label>
                    <DatePicker
                      selected={safeEditData.employment_history?.recentEmployer?.to ? new Date(safeEditData.employment_history.recentEmployer.to) : undefined}
                      onChange={(date) => updateRecentEmployer('to', date ? date.toISOString().split('T')[0] : '')}
                      placeholder="Select end date"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Reason for Leaving</label>
                    <Input
                      value={safeEditData.employment_history?.recentEmployer?.reasonForLeaving || ''}
                      onChange={(e) => updateRecentEmployer('reasonForLeaving', e.target.value)}
                    />
                  </div>
                </div>

                {/* Previous Employers Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Previous Employers (from most recent)</h4>
                    <Button type="button" onClick={addPreviousEmployer} size="sm" variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Previous Employer
                    </Button>
                  </div>

                  {safeEditData.employment_history?.previousEmployers?.map((employer, index) => (
                    <Card key={index} className="relative">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">Previous Employer {index + 1}</CardTitle>
                          <Button 
                            type="button" 
                            onClick={() => removePreviousEmployer(index)} 
                            size="sm" 
                            variant="outline"
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-500">Company</label>
                            <Input
                              value={employer.company || ''}
                              onChange={(e) => updatePreviousEmployer(index, 'company', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-500">Name</label>
                            <Input
                              value={employer.name || ''}
                              onChange={(e) => updatePreviousEmployer(index, 'name', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-500">Email</label>
                            <Input
                              value={employer.email || ''}
                              onChange={(e) => updatePreviousEmployer(index, 'email', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-500">Position</label>
                            <Input
                              value={employer.position || ''}
                              onChange={(e) => updatePreviousEmployer(index, 'position', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-500">Address</label>
                            <Input
                              value={employer.address || ''}
                              onChange={(e) => updatePreviousEmployer(index, 'address', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-500">Town</label>
                            <Input
                              value={employer.town || ''}
                              onChange={(e) => updatePreviousEmployer(index, 'town', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-500">Postcode</label>
                            <Input
                              value={employer.postcode || ''}
                              onChange={(e) => updatePreviousEmployer(index, 'postcode', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-500">Telephone</label>
                            <Input
                              value={employer.telephone || ''}
                              onChange={(e) => updatePreviousEmployer(index, 'telephone', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-500">From</label>
                            <DatePicker
                              selected={employer.from ? new Date(employer.from) : undefined}
                              onChange={(date) => updatePreviousEmployer(index, 'from', date ? date.toISOString().split('T')[0] : '')}
                              placeholder="Select start date"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-500">To</label>
                            <DatePicker
                              selected={employer.to ? new Date(employer.to) : undefined}
                              onChange={(date) => updatePreviousEmployer(index, 'to', date ? date.toISOString().split('T')[0] : '')}
                              placeholder="Select end date"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-sm font-medium text-gray-500">Key Tasks</label>
                            <Textarea
                              value={employer.keyTasks || ''}
                              onChange={(e) => updatePreviousEmployer(index, 'keyTasks', e.target.value)}
                              rows={2}
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-sm font-medium text-gray-500">Reason for Leaving</label>
                            <Textarea
                              value={employer.reasonForLeaving || ''}
                              onChange={(e) => updatePreviousEmployer(index, 'reasonForLeaving', e.target.value)}
                              rows={2}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* References */}
      <Card>
        <CardHeader>
          <CardTitle>References</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Reference 1 */}
            <div>
              <h4 className="font-medium mb-3">Reference 1</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Name</label>
                  <Input
                    value={safeEditData.reference_info?.reference1?.name || ''}
                    onChange={(e) => updateReference('reference1', 'name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Company</label>
                  <Input
                    value={safeEditData.reference_info?.reference1?.company || ''}
                    onChange={(e) => updateReference('reference1', 'company', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Job Title</label>
                  <Input
                    value={safeEditData.reference_info?.reference1?.jobTitle || ''}
                    onChange={(e) => updateReference('reference1', 'jobTitle', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <Input
                    value={safeEditData.reference_info?.reference1?.email || ''}
                    onChange={(e) => updateReference('reference1', 'email', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Contact Number</label>
                  <Input
                    value={safeEditData.reference_info?.reference1?.contactNumber || ''}
                    onChange={(e) => updateReference('reference1', 'contactNumber', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Address</label>
                  <Input
                    value={safeEditData.reference_info?.reference1?.address || ''}
                    onChange={(e) => updateReference('reference1', 'address', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Town</label>
                  <Input
                    value={safeEditData.reference_info?.reference1?.town || ''}
                    onChange={(e) => updateReference('reference1', 'town', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Postcode</label>
                  <Input
                    value={safeEditData.reference_info?.reference1?.postcode || ''}
                    onChange={(e) => updateReference('reference1', 'postcode', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Reference 2 */}
            <div>
              <h4 className="font-medium mb-3">Reference 2</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Name</label>
                  <Input
                    value={safeEditData.reference_info?.reference2?.name || ''}
                    onChange={(e) => updateReference('reference2', 'name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Company</label>
                  <Input
                    value={safeEditData.reference_info?.reference2?.company || ''}
                    onChange={(e) => updateReference('reference2', 'company', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Job Title</label>
                  <Input
                    value={safeEditData.reference_info?.reference2?.jobTitle || ''}
                    onChange={(e) => updateReference('reference2', 'jobTitle', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <Input
                    value={safeEditData.reference_info?.reference2?.email || ''}
                    onChange={(e) => updateReference('reference2', 'email', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Contact Number</label>
                  <Input
                    value={safeEditData.reference_info?.reference2?.contactNumber || ''}
                    onChange={(e) => updateReference('reference2', 'contactNumber', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Address</label>
                  <Input
                    value={safeEditData.reference_info?.reference2?.address || ''}
                    onChange={(e) => updateReference('reference2', 'address', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Town</label>
                  <Input
                    value={safeEditData.reference_info?.reference2?.town || ''}
                    onChange={(e) => updateReference('reference2', 'town', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Postcode</label>
                  <Input
                    value={safeEditData.reference_info?.reference2?.postcode || ''}
                    onChange={(e) => updateReference('reference2', 'postcode', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Additional References */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Additional References</h4>
                <Button type="button" onClick={addReference} size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Reference
                </Button>
              </div>

              {safeEditData.reference_info?.additionalReferences?.map((reference, index) => (
                <Card key={index} className="relative">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Additional Reference {index + 1}</CardTitle>
                      <Button 
                        type="button" 
                        onClick={() => removeReference(index)} 
                        size="sm" 
                        variant="outline"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Name</label>
                        <Input
                          value={reference.name || ''}
                          onChange={(e) => updateAdditionalReference(index, 'name', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Company</label>
                        <Input
                          value={reference.company || ''}
                          onChange={(e) => updateAdditionalReference(index, 'company', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Job Title</label>
                        <Input
                          value={reference.jobTitle || ''}
                          onChange={(e) => updateAdditionalReference(index, 'jobTitle', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Email</label>
                        <Input
                          value={reference.email || ''}
                          onChange={(e) => updateAdditionalReference(index, 'email', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Contact Number</label>
                        <Input
                          value={reference.contactNumber || ''}
                          onChange={(e) => updateAdditionalReference(index, 'contactNumber', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Address</label>
                        <Input
                          value={reference.address || ''}
                          onChange={(e) => updateAdditionalReference(index, 'address', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Town</label>
                        <Input
                          value={reference.town || ''}
                          onChange={(e) => updateAdditionalReference(index, 'town', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Postcode</label>
                        <Input
                          value={reference.postcode || ''}
                          onChange={(e) => updateAdditionalReference(index, 'postcode', e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skills & Experience */}
      <Card>
        <CardHeader>
          <CardTitle>Skills & Experience</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {safeEditData.skills_experience?.skills && Object.keys(safeEditData.skills_experience.skills).length > 0 ? (
              Object.entries(safeEditData.skills_experience.skills).map(([skill, level]) => (
                <div key={skill} className="flex items-center justify-between">
                  <span className="font-medium">{skill}</span>
                  <Select
                    value={String(level)}
                    onValueChange={(value) => updateSkillsExperience('skills', {
                      ...safeEditData.skills_experience.skills,
                      [skill]: value
                    })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Basic">Basic</SelectItem>
                      <SelectItem value="None">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No skills recorded</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Declaration */}
      <Card>
        <CardHeader>
          <CardTitle>Declaration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Social Service Enquiry</label>
                <Select
                  value={safeEditData.declarations?.socialServiceEnquiry || ''}
                  onValueChange={(value) => updateDeclarations('socialServiceEnquiry', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
                {safeEditData.declarations?.socialServiceEnquiry === 'yes' && (
                  <div className="mt-3">
                    <label className="text-sm font-medium text-gray-500">Please provide details *</label>
                    <Textarea
                      value={safeEditData.declarations?.socialServiceDetails || ''}
                      onChange={(e) => updateDeclarations('socialServiceDetails', e.target.value)}
                      placeholder="Please provide full details..."
                      rows={3}
                      className="mt-2"
                      required
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Convicted of Offence</label>
                <Select
                  value={safeEditData.declarations?.convictedOfOffence || ''}
                  onValueChange={(value) => updateDeclarations('convictedOfOffence', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
                {safeEditData.declarations?.convictedOfOffence === 'yes' && (
                  <div className="mt-3">
                    <label className="text-sm font-medium text-gray-500">Please provide details *</label>
                    <Textarea
                      value={safeEditData.declarations?.convictedDetails || ''}
                      onChange={(e) => updateDeclarations('convictedDetails', e.target.value)}
                      placeholder="Please provide full details..."
                      rows={3}
                      className="mt-2"
                      required
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Safeguarding Investigation</label>
                <Select
                  value={safeEditData.declarations?.safeguardingInvestigation || ''}
                  onValueChange={(value) => updateDeclarations('safeguardingInvestigation', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
                {safeEditData.declarations?.safeguardingInvestigation === 'yes' && (
                  <div className="mt-3">
                    <label className="text-sm font-medium text-gray-500">Please provide details *</label>
                    <Textarea
                      value={safeEditData.declarations?.safeguardingDetails || ''}
                      onChange={(e) => updateDeclarations('safeguardingDetails', e.target.value)}
                      placeholder="Please provide full details..."
                      rows={3}
                      className="mt-2"
                      required
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Criminal Convictions</label>
                <Select
                  value={safeEditData.declarations?.criminalConvictions || ''}
                  onValueChange={(value) => updateDeclarations('criminalConvictions', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
                {safeEditData.declarations?.criminalConvictions === 'yes' && (
                  <div className="mt-3">
                    <label className="text-sm font-medium text-gray-500">Please provide details *</label>
                    <Textarea
                      value={safeEditData.declarations?.criminalDetails || ''}
                      onChange={(e) => updateDeclarations('criminalDetails', e.target.value)}
                      placeholder="Please provide full details..."
                      rows={3}
                      className="mt-2"
                      required
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Health Conditions</label>
                <Select
                  value={safeEditData.declarations?.healthConditions || ''}
                  onValueChange={(value) => updateDeclarations('healthConditions', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
                {safeEditData.declarations?.healthConditions === 'yes' && (
                  <div className="mt-3">
                    <label className="text-sm font-medium text-gray-500">Please provide details *</label>
                    <Textarea
                      value={safeEditData.declarations?.healthDetails || ''}
                      onChange={(e) => updateDeclarations('healthDetails', e.target.value)}
                      placeholder="Please provide full details..."
                      rows={3}
                      className="mt-2"
                      required
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Cautions / Reprimands</label>
                <Select
                  value={safeEditData.declarations?.cautionsReprimands || ''}
                  onValueChange={(value) => updateDeclarations('cautionsReprimands', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
                {safeEditData.declarations?.cautionsReprimands === 'yes' && (
                  <div className="mt-3">
                    <label className="text-sm font-medium text-gray-500">Please provide details *</label>
                    <Textarea
                      value={safeEditData.declarations?.cautionsDetails || ''}
                      onChange={(e) => updateDeclarations('cautionsDetails', e.target.value)}
                      placeholder="Please provide full details..."
                      rows={3}
                      className="mt-2"
                      required
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Terms & Policy */}
      <Card>
        <CardHeader>
          <CardTitle>Terms & Policy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Consent to Terms</label>
              <Select
                value={safeEditData.consent?.consentToTerms ? 'yes' : 'no'}
                onValueChange={(value) => updateConsent('consentToTerms', value === 'yes')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select consent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Digital Signature (Name)</label>
              <Input
                value={safeEditData.consent?.signature || ''}
                onChange={(e) => updateConsent('signature', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Date</label>
              <Input
                type="date"
                value={safeEditData.consent?.date || ''}
                onChange={(e) => updateConsent('date', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}