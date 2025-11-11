import React, { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, CheckCircle2, AlertCircle, Info, ChevronsUpDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export interface ClientSpotCheckObservation {
  id: string;
  label: string;
  value?: "poor" | "fair" | "good" | "very_good" | "excellent" | "not_applicable";
  comments?: string;
  isRequired?: boolean;
  section?: string;
}

export interface ClientSpotCheckFormData {
  serviceUserName: string;
  date: string;
  completedBy: string;
  observations: ClientSpotCheckObservation[];
}

interface ClientSpotCheckFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ClientSpotCheckFormData) => void;
  initialData?: ClientSpotCheckFormData | null;
  periodIdentifier?: string;
  frequency?: string;
  clientName?: string; // Pre-fill service user name
}

export default function ClientSpotCheckFormDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  initialData, 
  periodIdentifier, 
  frequency,
  clientName 
}: ClientSpotCheckFormDialogProps) {
  const { companySettings } = useCompany();
  const { toast } = useToast();

  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [serviceUserPopoverOpen, setServiceUserPopoverOpen] = useState(false);

  const [errors, setErrors] = useState<{
    serviceUserName?: string;
    date?: string;
    completedBy?: string;
    observations?: Record<string, string>;
  }>({});

  const [form, setForm] = useState<ClientSpotCheckFormData>({
    serviceUserName: "",
    date: "",
    completedBy: "",
    observations: [],
  });

  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  const observationItems = useMemo<ClientSpotCheckObservation[]>(
    () => [
      // Environmental Safety Section
      { id: "lighting", label: "Lighting: Assess the adequacy of lighting in all areas of the home.", isRequired: true, section: "Environmental Safety" },
      { id: "home_temperature", label: "Home Temperature: Comment on the comfort level of the home's temperature.", isRequired: true, section: "Environmental Safety" },
      { id: "security_doors_windows", label: "Security of Doors and Windows: Evaluate the security and functionality of doors and windows.", isRequired: true, section: "Environmental Safety" },
      { id: "trip_hazards", label: "Trip Hazards: Identify and assess potential trip hazards.", isRequired: true, section: "Environmental Safety" },
      { id: "mobility", label: "Mobility: Discuss the ease of maneuvering with mobility aids in the home.", isRequired: true, section: "Environmental Safety" },
      
      // Personal Care Section
      { id: "personal_hygiene", label: "Personal Hygiene: Evaluate the service user's personal hygiene.", isRequired: true, section: "Personal Care" },
      { id: "incontinence_supplies", label: "Assess the quantity of incontinence pad and Catheter bag.", isRequired: false, section: "Personal Care" },
      { id: "skin_health", label: "Skin Health: Note observations regarding the service user's skin condition.", isRequired: true, section: "Personal Care" },
      { id: "clothing", label: "Service User's Clothing: Discuss the cleanliness and regularity of change in the service user's clothing.", isRequired: true, section: "Personal Care" },
      
      // Living Environment Section
      { id: "kitchen_hygiene", label: "Kitchen Hygiene: Provide details on the state of the kitchen, especially the fridge.", isRequired: true, section: "Living Environment" },
      { id: "toilet_area", label: "Toilet Area: Describe the condition and cleanliness of the toilet area.", isRequired: true, section: "Living Environment" },
      { id: "bathroom_safety", label: "Bathroom Safety: Describe the safety features in the bathroom.", isRequired: true, section: "Living Environment" },
      { id: "bedroom_safety", label: "Bedroom Safety and Comfort: Evaluate the safety and comfort of the service user's bedroom.", isRequired: true, section: "Living Environment" },
      { id: "pets_plants", label: "Pets and Plant Care: Comment on the condition and care of any pets or plants.", isRequired: false, section: "Living Environment" },
      { id: "pest_infestation", label: "Pest Infestation: Observe any signs of pest infestation.", isRequired: true, section: "Living Environment" },
      
      // Medication & Health Section
      { id: "medication_storage", label: "Medication Storage: Assess how medications are stored.", isRequired: true, section: "Medication & Health" },
      { id: "medication_expiry", label: "Medication Expiry and Confusion Risk: Evaluate the presence of excess or expired medications.", isRequired: true, section: "Medication & Health" },
      { id: "nutrition_hydration", label: "Nutrition and Hydration: Provide insights on the service user's nutrition and hydration.", isRequired: true, section: "Medication & Health" },
      { id: "mental_wellbeing", label: "Mental and Emotional Well-being: Comment on the service user's mental and emotional state.", isRequired: true, section: "Medication & Health" },
    ],
    []
  );

  // Group observations by section
  const observationSections = useMemo(() => {
    const sections: Record<string, ClientSpotCheckObservation[]> = {};
    observationItems.forEach(item => {
      const section = item.section || "Other";
      if (!sections[section]) sections[section] = [];
      sections[section].push(item);
    });
    return sections;
  }, [observationItems]);

  // Calculate progress
  const progress = useMemo(() => {
    const totalQuestions = observationItems.length + 3; // +3 for header fields
    let completed = 0;
    
    if (form.serviceUserName.trim()) completed++;
    if (form.date) completed++;
    if (form.completedBy.trim()) completed++;
    
    form.observations.forEach(obs => {
      if (obs.value && (obs.value === "not_applicable" || obs.comments?.trim())) {
        completed++;
      }
    });
    
    return Math.round((completed / totalQuestions) * 100);
  }, [form, observationItems.length]);

  // Real-time validation
  const validateField = (fieldName: string, value?: string) => {
    const newErrors = { ...errors };
    
    if (fieldName === 'serviceUserName') {
      if (!form.serviceUserName.trim()) {
        newErrors.serviceUserName = "Service User Name is required";
      } else {
        delete newErrors.serviceUserName;
      }
    } else if (fieldName === 'date') {
      if (!form.date) {
        newErrors.date = "Date is required";
      } else {
        delete newErrors.date;
      }
    } else if (fieldName === 'completedBy') {
      if (!form.completedBy.trim()) {
        newErrors.completedBy = "Completed By is required";
      } else {
        delete newErrors.completedBy;
      }
    }
    
    setErrors(newErrors);
  };

  const validateObservation = (obsId: string) => {
    const obs = form.observations.find(o => o.id === obsId);
    const newErrors = { ...errors };
    if (!newErrors.observations) newErrors.observations = {};
    
    if (!obs?.value) {
      newErrors.observations[obsId] = "Please select an option";
    } else if (obs.isRequired && obs.value === "not_applicable") {
      newErrors.observations[obsId] = "Not Applicable is not valid for this question";
    } else if (obs.isRequired && !obs.comments?.trim()) {
      newErrors.observations[obsId] = "Descriptive comment is required";
    } else if (!obs.isRequired && obs.value !== "not_applicable" && !obs.comments?.trim()) {
      newErrors.observations[obsId] = "Descriptive comment is required unless 'Not Applicable' is selected";
    } else {
      delete newErrors.observations[obsId];
    }
    
    setErrors(newErrors);
  };

  // Fetch clients
  useEffect(() => {
    const fetchClients = async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (error) {
        console.error('Error fetching clients:', error);
        toast({ title: "Error loading clients", variant: "destructive" });
      } else {
        setClients(data || []);
      }
    };

    if (open) {
      fetchClients();
    }
  }, [open, toast]);

  // Initialize form on open and reset on close
  React.useEffect(() => {
    if (!open) {
      // Reset form when dialog closes
      setForm({
        serviceUserName: "",
        date: "",
        completedBy: "",
        observations: [],
      });
      setErrors({});
      setTouchedFields(new Set());
      return;
    }

    console.log('🎯 Dialog initializing with data:', initialData);

    const baseObservations = observationItems.map((item) => ({ 
      id: item.id, 
      label: item.label, 
      isRequired: item.isRequired 
    } as ClientSpotCheckObservation));

    console.log('📋 Base observations template:', baseObservations);

    if (initialData) {
      console.log('✅ Using initial data for form population');
      console.log('📝 Initial observations:', initialData.observations);
      
      const mergedObservations = baseObservations.map((base) => {
        const existing = initialData.observations.find((o) => o.id === base.id || o.label === base.label);
        const merged = existing ? { ...base, value: (existing as any).value, comments: (existing as any).comments } : base;
        if (existing) {
          console.log(`🔗 Merged observation ${base.id} (via ${existing.id ? 'id' : 'label'}):`, merged);
        }
        return merged;
      });

      const formData = {
        serviceUserName: initialData.serviceUserName || "",
        date: initialData.date || "",
        completedBy: initialData.completedBy || "",
        observations: mergedObservations,
      };

      console.log('🚀 Setting form with merged data:', formData);
      setForm(formData);
    } else {
      console.log('❌ No initial data, using empty form');
      setForm({
        serviceUserName: clientName || "", // Auto-fill with client name if provided
        date: "",
        completedBy: "",
        observations: baseObservations,
      });
    }
  }, [open, initialData, observationItems, clientName]);

  const updateField = (key: keyof ClientSpotCheckFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setTouchedFields(prev => new Set(prev).add(key));
    // Real-time validation
    setTimeout(() => validateField(key, value), 100);
  };

  const updateObservation = (id: string, changes: Partial<ClientSpotCheckObservation>) => {
    setForm((prev) => ({
      ...prev,
      observations: prev.observations.map((obs) => (obs.id === id ? { ...obs, ...changes } : obs)),
    }));
    setTouchedFields(prev => new Set(prev).add(id));
    // Real-time validation
    setTimeout(() => validateObservation(id), 100);
  };

  const handleSubmit = () => {
    const newErrors: typeof errors = { observations: {} };

    if (!form.serviceUserName) newErrors.serviceUserName = "Required";
    if (!form.date) newErrors.date = "Required";
    if (!form.completedBy) newErrors.completedBy = "Required";

    for (const obs of form.observations) {
      if (!obs.value) {
        newErrors.observations![obs.id] = "Please select an option";
      } else if (obs.isRequired && obs.value === "not_applicable") {
        newErrors.observations![obs.id] = "Not Applicable is not valid for this question";
      } else if (obs.isRequired && !obs.comments?.trim()) {
        newErrors.observations![obs.id] = "Descriptive comment is required";
      } else if (!obs.isRequired && obs.value !== "not_applicable" && !obs.comments?.trim()) {
        newErrors.observations![obs.id] = "Descriptive comment is required unless 'Not Applicable' is selected";
      }
    }

    const hasErrors =
      !!newErrors.serviceUserName ||
      !!newErrors.date ||
      !!newErrors.completedBy ||
      Object.keys(newErrors.observations || {}).length > 0;

    if (hasErrors) {
      setErrors(newErrors);
      const errorCount = Object.keys(newErrors.observations || {}).length + 
        (newErrors.serviceUserName ? 1 : 0) + 
        (newErrors.date ? 1 : 0) + 
        (newErrors.completedBy ? 1 : 0);
      toast({ 
        title: `Please fix ${errorCount} highlighted field${errorCount > 1 ? 's' : ''}`, 
        description: "Scroll through the form to see all validation errors.",
        variant: "destructive" 
      });
      return;
    }

    setErrors({});
    onSubmit(form);
    onOpenChange(false);
  };

  const getSelectOptions = (obs: ClientSpotCheckObservation) => {
    const baseOptions = [
      { value: "poor", label: "Poor" },
      { value: "fair", label: "Fair" },
      { value: "good", label: "Good" },
      { value: "very_good", label: "Very Good" },
      { value: "excellent", label: "Excellent" },
    ];

    // Add "Not Applicable" for specific questions
    if (obs.id === "incontinence_supplies" || obs.id === "pets_plants") {
      baseOptions.push({ value: "not_applicable", label: "Not Applicable" });
    }

    return baseOptions;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="space-y-4">
            <div>
              <DialogTitle className="text-xl sm:text-2xl">Service Quality Spot Check</DialogTitle>
              <DialogDescription className="text-sm sm:text-base">
                Complete all sections of the spot check form below. Progress will be saved as you go.
              </DialogDescription>
            </div>
            
            {/* Progress indicator */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Form Progress</span>
                <span className="text-muted-foreground">{progress}% complete</span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="h-3 w-3" />
                <span>{observationItems.length + 3} total questions • {Math.ceil((observationItems.length + 3) * (progress / 100))} completed</span>
              </div>
            </div>

            {/* Error summary */}
            {Object.keys(errors).some(key => errors[key as keyof typeof errors]) && (
              <Alert variant="destructive" className="animate-fade-in">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Please complete all required fields and fix validation errors before submitting.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Logo */}
          {companySettings?.logo && (
            <div className="flex justify-center">
              <img
                src={companySettings.logo}
                alt={`${companySettings.name || "Company"} logo`}
                className="h-10 sm:h-12 object-contain"
                loading="lazy"
              />
            </div>
          )}

          {/* Instructions */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Instructions:</strong> Complete all header information, then assess each area by selecting a rating and providing detailed comments. 
              Required fields are marked with an asterisk (*).
            </AlertDescription>
          </Alert>

          {/* Header Information Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Header Information</h3>
              <div className="flex items-center gap-1">
                {form.serviceUserName && form.date && form.completedBy && (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-sm font-medium">
                  Service User Name *
                  {form.serviceUserName && <CheckCircle2 className="inline h-3 w-3 text-green-600 ml-1" />}
                </Label>
                <Popover open={serviceUserPopoverOpen} onOpenChange={setServiceUserPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={serviceUserPopoverOpen}
                      aria-invalid={!!errors.serviceUserName}
                      className={cn(
                        "w-full justify-between",
                        errors.serviceUserName && "border-destructive focus-visible:ring-destructive",
                        form.serviceUserName && "border-green-500"
                      )}
                    >
                      {form.serviceUserName || "Select service user..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-popover" align="start">
                    <Command>
                      <CommandInput placeholder="Search clients..." />
                      <CommandList>
                        <CommandEmpty>No client found.</CommandEmpty>
                        <CommandGroup>
                          {clients.map((client) => (
                            <CommandItem
                              key={client.id}
                              value={client.name}
                              onSelect={(currentValue) => {
                                updateField("serviceUserName", currentValue === form.serviceUserName ? "" : currentValue);
                                setServiceUserPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  form.serviceUserName === client.name ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {client.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {errors.serviceUserName && touchedFields.has("serviceUserName") && (
                  <p className="text-destructive text-xs mt-1 animate-fade-in">{errors.serviceUserName}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium">
                  Date *
                  {form.date && <CheckCircle2 className="inline h-3 w-3 text-green-600 ml-1" />}
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-start text-left font-normal ${
                        errors.date ? "border-destructive" : form.date ? "border-green-500" : ""
                      }`}
                      aria-invalid={!!errors.date}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.date && !isNaN(Date.parse(form.date)) ? format(new Date(form.date), "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.date && !isNaN(Date.parse(form.date)) ? new Date(form.date) : undefined}
                      onSelect={(date) => date && updateField("date", format(date, "yyyy-MM-dd"))}
                      disabled={(date) => {
                        if (frequency?.toLowerCase() === 'quarterly' && periodIdentifier?.includes('-Q')) {
                          const [y, qStr] = periodIdentifier.split('-Q');
                          const year = parseInt(y);
                          const q = parseInt(qStr);
                          if (!isNaN(year) && !isNaN(q)) {
                            const startMonth = (q - 1) * 3;
                            const minDate = new Date(year, startMonth, 1);
                            const maxDate = new Date(year, startMonth + 3, 0);
                            return date < minDate || date > maxDate;
                          }
                        }
                        return false;
                      }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {errors.date && touchedFields.has("date") && (
                  <p className="text-destructive text-xs mt-1 animate-fade-in">{errors.date}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium">
                  Completed By *
                  {form.completedBy && <CheckCircle2 className="inline h-3 w-3 text-green-600 ml-1" />}
                </Label>
                <Input
                  value={form.completedBy}
                  onChange={(e) => updateField("completedBy", e.target.value)}
                  onBlur={() => validateField("completedBy")}
                  aria-invalid={!!errors.completedBy}
                  className={errors.completedBy ? "border-destructive focus-visible:ring-destructive" : 
                    form.completedBy ? "border-green-500" : ""}
                  placeholder="Enter your name"
                />
                {errors.completedBy && touchedFields.has("completedBy") && (
                  <p className="text-destructive text-xs mt-1 animate-fade-in">{errors.completedBy}</p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Assessment Sections */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Assessment Questions</h3>
              <div className="text-sm text-muted-foreground">
                ({Object.values(observationSections).flat().length} questions across {Object.keys(observationSections).length} sections)
              </div>
            </div>
            
            {Object.entries(observationSections).map(([sectionName, items]) => {
              const sectionProgress = items.filter(item => {
                const current = form.observations.find(o => o.id === item.id);
                return current?.value && (current.value === "not_applicable" || current.comments?.trim());
              }).length;
              
              return (
                <div key={sectionName} className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-semibold text-primary">{sectionName}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {sectionProgress}/{items.length} complete
                        </span>
                        {sectionProgress === items.length && (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                    </div>
                    <Progress value={(sectionProgress / items.length) * 100} className="h-1" />
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {items.map((item) => {
                      const current = form.observations.find((o) => o.id === item.id);
                      const err = errors.observations?.[item.id];
                      const options = getSelectOptions(item);
                      const isComplete = current?.value && (current.value === "not_applicable" || current.comments?.trim());
                      
                      return (
                        <div key={item.id} className={`rounded-lg border p-4 space-y-3 transition-colors ${
                          isComplete ? "border-green-200 bg-green-50/50" : 
                          err && touchedFields.has(item.id) ? "border-destructive bg-destructive/5" : 
                          "hover:border-primary/20"
                        }`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium text-sm leading-relaxed">{item.label}</div>
                            <div className="flex items-center gap-1 mt-1">
                              {item.isRequired && <span className="text-destructive text-xs">*</span>}
                              {isComplete && <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" />}
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground">Rating</Label>
                            <Select
                              value={current?.value || ""}
                              onValueChange={(value) => updateObservation(item.id, { value: value as any })}
                            >
                              <SelectTrigger className={`text-sm ${
                                err && touchedFields.has(item.id) ? "border-destructive" : 
                                current?.value ? "border-green-500" : ""
                              }`}>
                                <SelectValue placeholder="Select rating" />
                              </SelectTrigger>
                              <SelectContent>
                                {options.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground">
                              Comments
                              {item.isRequired && current?.value !== "not_applicable" && (
                                <span className="text-destructive ml-1">*</span>
                              )}
                              {!item.isRequired && current?.value && current.value !== "not_applicable" && (
                                <span className="text-destructive ml-1">*</span>
                              )}
                            </Label>
                            <Textarea
                              placeholder={
                                current?.value === "not_applicable" 
                                  ? "Comments not required for 'Not Applicable'" 
                                  : "Provide detailed observations and comments..."
                              }
                              value={current?.comments || ""}
                              onChange={(e) => updateObservation(item.id, { comments: e.target.value })}
                              onBlur={() => validateObservation(item.id)}
                              disabled={current?.value === "not_applicable"}
                              aria-invalid={!!err}
                              className={`text-sm resize-none ${
                                err && touchedFields.has(item.id) ? "border-destructive focus-visible:ring-destructive" : 
                                current?.comments?.trim() ? "border-green-500" : ""
                              }`}
                              rows={2}
                            />
                          </div>
                          
                          {err && touchedFields.has(item.id) && (
                            <div className="flex items-center gap-2 text-destructive text-xs animate-fade-in">
                              <AlertCircle className="h-3 w-3" />
                              <span>{err}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {sectionName !== Object.keys(observationSections)[Object.keys(observationSections).length - 1] && (
                    <Separator className="my-6" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Action buttons with progress summary */}
          <div className="space-y-4">
            <Separator />
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{progress}% Complete</span> • 
                {progress === 100 ? " Ready to submit" : ` ${Math.ceil((observationItems.length + 3) * ((100 - progress) / 100))} fields remaining`}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  className="w-full sm:w-auto"
                  disabled={progress < 100}
                >
                  {progress < 100 ? `Complete Form (${progress}%)` : "Save Spot Check"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}