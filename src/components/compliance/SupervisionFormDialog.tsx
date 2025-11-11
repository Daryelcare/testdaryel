import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, startOfQuarter, endOfQuarter, isWithinInterval } from "date-fns";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { Check, X, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import BodyDiagramModal from "./BodyDiagramModal";
import { supabase } from "@/integrations/supabase/client";

export type YesNo = "yes" | "no";

export interface BodyMarker {
  x: number;
  y: number;
  bodyPart: string;
}

export interface SupervisionServiceUserQA {
  serviceUserName: string;
  concerns?: { value?: YesNo; reason?: string };
  comfortable?: { value?: YesNo; reason?: string };
  commentsAboutService?: { value?: YesNo; reason?: string };
  complaintsByServiceUser?: { value?: YesNo; reason?: string };
  safeguardingIssues?: { value?: YesNo; reason?: string };
  otherDiscussion?: { value?: YesNo; reason?: string };
  bruises?: { value?: YesNo; reason?: string };
  bruisesCauses?: string;
  bruisesLocations?: BodyMarker[];
  pressureSores?: { value?: YesNo; reason?: string };
  pressureSoresLocations?: BodyMarker[];
}

export interface OfficeActionItem {
  issue?: string;
  action?: string;
  byWhom?: string;
  dateCompleted?: string; // yyyy-MM-dd
}

export interface SupervisionFormData {
  // Header
  dateOfSupervision: string; // yyyy-MM-dd
  signatureEmployee: string;

  // Personal Questions
  howAreYou?: string;
  proceduralGuidelines?: string;
  staffIssues?: string;
  trainingAndDevelopment?: string;
  keyAreasOfResponsibility?: string;
  otherIssues?: string;
  annualLeaveTaken?: string;
  annualLeaveBooked?: string;

  // Service Users
  serviceUsersCount: number;
  serviceUserNames: string[];
  perServiceUser: SupervisionServiceUserQA[];

  // Office Use Only
  office: {
    employeeName?: string;
    project?: string;
    supervisor?: string;
    date?: string; // yyyy-MM-dd
    actions: OfficeActionItem[];
  };

  // Derived
  officeComplete: boolean;
}

interface SupervisionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: SupervisionFormData) => void;
  initialData?: SupervisionFormData | null;
  employeeName?: string; // for signature default
  periodIdentifier?: string;
  frequency?: string;
}

export default function SupervisionFormDialog({ open, onOpenChange, onSubmit, initialData, employeeName, periodIdentifier, frequency }: SupervisionFormDialogProps) {
  const { companySettings } = useCompany();
  const { toast } = useToast();

  // Calculate period date range based on periodIdentifier and frequency
  const getPeriodDateRange = () => {
    const now = new Date();
    
    if (!periodIdentifier || !frequency) {
      // Fallback to current quarter
      return {
        start: startOfQuarter(now),
        end: endOfQuarter(now)
      };
    }

    try {
      if (frequency.toLowerCase() === 'annual') {
        const year = parseInt(periodIdentifier);
        return {
          start: new Date(year, 0, 1),
          end: new Date(year, 11, 31)
        };
      } else if (frequency.toLowerCase() === 'monthly') {
        const [year, month] = periodIdentifier.split('-');
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);
        const monthIndex = monthNum - 1;
        return {
          start: new Date(yearNum, monthIndex, 1),
          end: new Date(yearNum, monthIndex + 1, 0)
        };
      } else if (frequency.toLowerCase() === 'quarterly') {
        const [year, quarterStr] = periodIdentifier.split('-Q');
        const yearNum = parseInt(year);
        const quarter = parseInt(quarterStr);
        const startMonth = (quarter - 1) * 3;
        const endMonth = startMonth + 2;
        return {
          start: new Date(yearNum, startMonth, 1),
          end: new Date(yearNum, endMonth + 1, 0)
        };
      } else if (frequency.toLowerCase() === 'bi-annual') {
        const [year, halfStr] = periodIdentifier.split('-H');
        const yearNum = parseInt(year);
        const half = parseInt(halfStr);
        const startMonth = half === 1 ? 0 : 6;
        const endMonth = half === 1 ? 5 : 11;
        return {
          start: new Date(yearNum, startMonth, 1),
          end: new Date(yearNum, endMonth + 1, 0)
        };
      }
    } catch (error) {
      console.error('Error parsing period:', error);
    }

    // Fallback to current quarter
    return {
      start: startOfQuarter(now),
      end: endOfQuarter(now)
    };
  };

  const periodDateRange = getPeriodDateRange();

  const [step, setStep] = useState<number>(1); // 1: personal, 2: service users list, 3..n: per user, last: office
  const [showPersonalErrors, setShowPersonalErrors] = useState(false);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [serviceUserPopovers, setServiceUserPopovers] = useState<Record<number, boolean>>({});
  const [bodyDiagramModal, setBodyDiagramModal] = useState<{
    open: boolean;
    type: "bruises" | "pressureSores";
    serviceUserIndex: number;
  }>({ open: false, type: "bruises", serviceUserIndex: -1 });

  const [form, setForm] = useState<SupervisionFormData>({
    dateOfSupervision: "",
    signatureEmployee: employeeName || "",
    howAreYou: "",
    proceduralGuidelines: "",
    staffIssues: "",
    trainingAndDevelopment: "",
    keyAreasOfResponsibility: "",
    otherIssues: "",
    annualLeaveTaken: "",
    annualLeaveBooked: "",
    serviceUsersCount: 0,
    serviceUserNames: [],
    perServiceUser: [],
    office: {
      employeeName: employeeName || "",
      project: "Supervision",
      supervisor: "",
      date: "",
      actions: [
        { issue: "", action: "", byWhom: "", dateCompleted: "" },
      ],
    },
    officeComplete: false,
  });

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

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setShowPersonalErrors(false);
    if (initialData) {
      setForm({ ...initialData, signatureEmployee: initialData.signatureEmployee || employeeName || "" });
    } else {
      setForm((prev) => ({
        ...prev,
        signatureEmployee: employeeName || prev.signatureEmployee,
        office: { ...prev.office, employeeName: employeeName || prev.office.employeeName },
      }));
    }
  }, [open, initialData, employeeName]);

  const totalSteps = useMemo(() => {
    // personal (1) + service users list (1) + per service user (count) + office (1)
    return 1 + 1 + Math.max(1, form.serviceUsersCount) + 1;
  }, [form.serviceUsersCount]);

  const currentServiceUserIndex = useMemo(() => {
    // Step mapping: 1=personal, 2=list, 3..(2+count)=per-user, last=office
    if (step < 3 || step > 2 + Math.max(1, form.serviceUsersCount)) return -1;
    return step - 3; // 0-based index
  }, [step, form.serviceUsersCount]);

  const updateForm = <K extends keyof SupervisionFormData>(key: K, value: SupervisionFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateOffice = (idx: number, changes: Partial<OfficeActionItem>) => {
    setForm((prev) => ({
      ...prev,
      office: {
        ...prev.office,
        actions: prev.office.actions.map((a, i) => (i === idx ? { ...a, ...changes } : a)),
      },
    }));
  };

  const addOfficeAction = () => {
    setForm((prev) => ({
      ...prev,
      office: { ...prev.office, actions: [...prev.office.actions, { issue: "", action: "", byWhom: "", dateCompleted: "" }] },
    }));
  };

  const removeOfficeAction = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      office: { ...prev.office, actions: prev.office.actions.filter((_, i) => i !== idx) },
    }));
  };

  const setServiceUsersCount = (count: number) => {
    const c = Math.max(0, Math.min(20, Math.floor(count)));
    const names = Array.from({ length: c }, (_, i) => form.serviceUserNames[i] || "");
    const details = Array.from({ length: c }, (_, i) => form.perServiceUser[i] || ({ serviceUserName: names[i] || "" } as SupervisionServiceUserQA));
    setForm((prev) => ({ ...prev, serviceUsersCount: c, serviceUserNames: names, perServiceUser: details }));
  };

  const updateServiceUserName = (index: number, name: string) => {
    const names = [...form.serviceUserNames];
    names[index] = name;
    const per = [...form.perServiceUser];
    per[index] = { ...(per[index] || {}), serviceUserName: name } as SupervisionServiceUserQA;
    setForm((prev) => ({ ...prev, serviceUserNames: names, perServiceUser: per }));
    setServiceUserPopovers((prev) => ({ ...prev, [index]: false }));
  };

  const updatePerUser = (index: number, changes: Partial<SupervisionServiceUserQA>) => {
    const per = [...form.perServiceUser];
    per[index] = { ...(per[index] || { serviceUserName: form.serviceUserNames[index] || "" }), ...changes } as SupervisionServiceUserQA;
    setForm((prev) => ({ ...prev, perServiceUser: per }));
  };

  const setYN = (obj: { value?: YesNo; reason?: string } | undefined, value: YesNo) => {
    const next: { value?: YesNo; reason?: string } = { ...(obj || {}) };
    next.value = value;
    next.reason = value === "yes" ? (next.reason || "") : "None";
    return next;
  };

  const validatePersonal = () => {
    const missing: string[] = []
    if (!form.howAreYou?.trim()) missing.push("howAreYou")
    if (!form.proceduralGuidelines?.trim()) missing.push("proceduralGuidelines")
    if (!form.staffIssues?.trim()) missing.push("staffIssues")
    if (!form.trainingAndDevelopment?.trim()) missing.push("trainingAndDevelopment")
    if (!form.keyAreasOfResponsibility?.trim()) missing.push("keyAreasOfResponsibility")
    if (!form.otherIssues?.trim()) missing.push("otherIssues")

    const dateValid = !!form.dateOfSupervision && isWithinInterval(new Date(form.dateOfSupervision), { start: periodDateRange.start, end: periodDateRange.end })
    if (!dateValid) missing.push("dateOfSupervision")

    return missing
  }

  const validateServiceUsersList = () => {
    if (form.serviceUsersCount > 0 && form.serviceUserNames.some((n) => !n?.trim())) return "Please enter all service user names";
    return null;
  };

  const validateOfficeCompletion = () => {
    const hasAnyField =
      !!form.office.employeeName || !!form.office.project || !!form.office.supervisor || !!form.office.date ||
      form.office.actions.some((a) => a.issue || a.action || a.byWhom || a.dateCompleted);
    if (!hasAnyField) return false; // nothing filled = not complete

    // consider complete if at least one action is fully filled
    const anyComplete = form.office.actions.some((a) => a.issue && a.action && a.byWhom && a.dateCompleted);
    return anyComplete;
  };

  const handleNext = () => {
    if (step === 1) {
      const missing = validatePersonal();
      if (missing.length) {
        setShowPersonalErrors(true);
        toast({ title: "Please complete required fields (within selected period)", variant: "destructive" });
        return;
      }
      setShowPersonalErrors(false);
    }
    if (step === 2) {
      const err = validateServiceUsersList();
      if (err) { toast({ title: err, variant: "destructive" }); return; }
    }
    if (step >= 3 && currentServiceUserIndex >= 0) {
      // Per user basic validation: minimal for now
    }
    setStep((s) => Math.min(totalSteps, s + 1));
  };

  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = () => {
    const officeComplete = validateOfficeCompletion();
    const payload: SupervisionFormData = { ...form, officeComplete };
    onSubmit(payload);
    onOpenChange(false);
  };

  const openBodyDiagram = (type: "bruises" | "pressureSores", serviceUserIndex: number) => {
    setBodyDiagramModal({ open: true, type, serviceUserIndex });
  };

  const saveBodyDiagram = (markers: BodyMarker[]) => {
    const { type, serviceUserIndex } = bodyDiagramModal;
    if (type === "bruises") {
      updatePerUser(serviceUserIndex, { bruisesLocations: markers });
    } else {
      updatePerUser(serviceUserIndex, { pressureSoresLocations: markers });
    }
    setBodyDiagramModal({ open: false, type: "bruises", serviceUserIndex: -1 });
  };

  const renderYN = (label: string, obj: { value?: YesNo; reason?: string } | undefined, onChange: (next: { value?: YesNo; reason?: string }) => void, showBodyDiagram?: { type: "bruises" | "pressureSores", serviceUserIndex: number, locations?: BodyMarker[] }) => {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex items-center gap-3">
          <Button 
            variant={obj?.value === "yes" ? "default" : "outline"} 
            size="sm" 
            onClick={() => {
              onChange(setYN(obj, "yes"));
              if (showBodyDiagram && obj?.value !== "yes") {
                setTimeout(() => openBodyDiagram(showBodyDiagram.type, showBodyDiagram.serviceUserIndex), 100);
              }
            }}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button variant={obj?.value === "no" ? "destructive" : "outline"} size="sm" onClick={() => onChange(setYN(obj, "no"))}>
            <X className="h-4 w-4" />
          </Button>
          {showBodyDiagram && obj?.value === "yes" && (
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => openBodyDiagram(showBodyDiagram.type, showBodyDiagram.serviceUserIndex)}
            >
              Mark Body Locations
            </Button>
          )}
        </div>
        <Input placeholder={obj?.value === "yes" ? "Reason required" : "None"} value={obj?.reason || (obj?.value === "no" ? "None" : "")} onChange={(e) => onChange({ ...(obj || {}), reason: e.target.value })} />
        {showBodyDiagram && showBodyDiagram.locations && showBodyDiagram.locations.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Marked locations: {showBodyDiagram.locations.map(l => l.bodyPart).join(", ")}
          </div>
        )}
      </div>
    );
  };

  const renderPersonal = () => (
    <div className="space-y-4">
      {companySettings?.logo && (
        <div className="flex justify-center">
          <img src={companySettings.logo} alt={`${companySettings.name || "Company"} logo`} className="h-12 object-contain" loading="lazy" />
        </div>
      )}

      <h3 className="text-base font-semibold">Personal Questions</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(() => {
          const dateInvalid = !form.dateOfSupervision || !isWithinInterval(new Date(form.dateOfSupervision), { start: periodDateRange.start, end: periodDateRange.end });
          
          return (
            <>
              <div className="space-y-1">
                <Label>HOW ARE YOU (e.g., feelings, motivation, morale, issues to discuss)</Label>
                <Textarea value={form.howAreYou} onChange={(e) => updateForm("howAreYou", e.target.value)} rows={3} className={cn("bg-accent/10 border-accent/40 focus-visible:ring-2 focus-visible:ring-accent", showPersonalErrors && !form.howAreYou?.trim() && "border-destructive focus-visible:ring-destructive")} />
                {showPersonalErrors && !form.howAreYou?.trim() && (<p className="text-destructive text-xs">Required</p>)}
              </div>
              <div className="space-y-1">
                <Label>Company and Statutory Procedural Guidelines and Policy discussions</Label>
                <Textarea value={form.proceduralGuidelines} onChange={(e) => updateForm("proceduralGuidelines", e.target.value)} rows={3} className={cn("bg-accent/10 border-accent/40 focus-visible:ring-2 focus-visible:ring-accent", showPersonalErrors && !form.proceduralGuidelines?.trim() && "border-destructive focus-visible:ring-destructive")} />
                {showPersonalErrors && !form.proceduralGuidelines?.trim() && (<p className="text-destructive text-xs">Required</p>)}
              </div>
              <div className="space-y-1">
                <Label>Staff Issues (Teamwork, Supervision, observation, performance etc)</Label>
                <Textarea value={form.staffIssues} onChange={(e) => updateForm("staffIssues", e.target.value)} rows={3} className={cn("bg-accent/10 border-accent/40 focus-visible:ring-2 focus-visible:ring-accent", showPersonalErrors && !form.staffIssues?.trim() && "border-destructive focus-visible:ring-destructive")} />
                {showPersonalErrors && !form.staffIssues?.trim() && (<p className="text-destructive text-xs">Required</p>)}
              </div>
              <div className="space-y-1">
                <Label>Training and development (e.g., Training needs, application of what learnt)</Label>
                <Textarea value={form.trainingAndDevelopment} onChange={(e) => updateForm("trainingAndDevelopment", e.target.value)} rows={3} className={cn("bg-accent/10 border-accent/40 focus-visible:ring-2 focus-visible:ring-accent", showPersonalErrors && !form.trainingAndDevelopment?.trim() && "border-destructive focus-visible:ring-destructive")} />
                {showPersonalErrors && !form.trainingAndDevelopment?.trim() && (<p className="text-destructive text-xs">Required</p>)}
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>KEY AREAS OF RESPONSIBILITY (e.g., how is it going, any development needed)</Label>
                <Textarea value={form.keyAreasOfResponsibility} onChange={(e) => updateForm("keyAreasOfResponsibility", e.target.value)} rows={3} className={cn("bg-accent/10 border-accent/40 focus-visible:ring-2 focus-visible:ring-accent", showPersonalErrors && !form.keyAreasOfResponsibility?.trim() && "border-destructive focus-visible:ring-destructive")} />
                {showPersonalErrors && !form.keyAreasOfResponsibility?.trim() && (<p className="text-destructive text-xs">Required</p>)}
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Other issues</Label>
                <Textarea value={form.otherIssues} onChange={(e) => updateForm("otherIssues", e.target.value)} rows={3} className={cn("bg-accent/10 border-accent/40 focus-visible:ring-2 focus-visible:ring-accent", showPersonalErrors && !form.otherIssues?.trim() && "border-destructive focus-visible:ring-destructive")} />
                {showPersonalErrors && !form.otherIssues?.trim() && (<p className="text-destructive text-xs">Required</p>)}
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Annual Leave - Taken / Booked</Label>
                <Textarea
                  rows={2}
                  placeholder={"Taken\nBooked"}
                  value={`${form.annualLeaveTaken || ""}${form.annualLeaveBooked ? "\n" + form.annualLeaveBooked : ""}`}
                  onChange={(e) => {
                    const [taken, booked = ""] = e.target.value.split(/\r?\n/, 2)
                    updateForm("annualLeaveTaken", taken)
                    updateForm("annualLeaveBooked", booked)
                  }}
                  className={cn("bg-accent/10 border-accent/40 focus-visible:ring-2 focus-visible:ring-accent")}
                />
              </div>
              <div className="space-y-1">
                <Label>Date of the Supervision</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", showPersonalErrors && dateInvalid && "border-destructive focus-visible:ring-destructive")}> 
                      {form.dateOfSupervision ? format(new Date(form.dateOfSupervision), "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.dateOfSupervision ? new Date(form.dateOfSupervision) : undefined}
                      onSelect={(date) => date && updateForm("dateOfSupervision", format(date, "yyyy-MM-dd"))}
                      disabled={(date) => date < periodDateRange.start || date > periodDateRange.end}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {showPersonalErrors && dateInvalid && (<p className="text-destructive text-xs">Select a date within the selected period</p>)}
              </div>
            </>
          )
        })()}
      </div>

      <div className="pt-2 flex justify-between">
        <div />
        <Button onClick={handleNext}>Next</Button>
      </div>
    </div>
  );

  const renderServiceUsersList = () => (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Add Service Users</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="space-y-1">
          <Label>How many service users do you visit?</Label>
          <Input type="number" min={0} max={20} value={String(form.serviceUsersCount)} onChange={(e) => setServiceUsersCount(parseInt(e.target.value || "0", 10))} />
        </div>
      </div>
      {form.serviceUsersCount > 0 && (
        <div className="space-y-2">
          <Label>Service Users Names</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: form.serviceUsersCount }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Popover open={serviceUserPopovers[i] || false} onOpenChange={(open) => setServiceUserPopovers((prev) => ({ ...prev, [i]: open }))}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={serviceUserPopovers[i] || false}
                      className="w-full justify-between"
                    >
                      {form.serviceUserNames[i] || `Select service user ${i + 1}...`}
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
                                updateServiceUserName(i, currentValue === form.serviceUserNames[i] ? "" : currentValue);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  form.serviceUserNames[i] === client.name ? "opacity-100" : "opacity-0"
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
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="pt-2 flex justify-between">
        <Button variant="outline" onClick={handleBack}>Back</Button>
        <Button onClick={handleNext}>Next</Button>
      </div>
    </div>
  );

  const renderPerServiceUser = (index: number) => {
    const su = form.perServiceUser[index] || ({ serviceUserName: form.serviceUserNames[index] || "" } as SupervisionServiceUserQA);
    return (
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Service User: - {su.serviceUserName || `#${index + 1}`}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderYN("Are there any concerns you have regarding this service user?", su.concerns, (v) => updatePerUser(index, { concerns: v }))}
          {renderYN("Are you comfortable working with this service user?", su.comfortable, (v) => updatePerUser(index, { comfortable: v }))}
          {renderYN("Any comments the service user made regarding the service by you, other carers or the agency?", su.commentsAboutService, (v) => updatePerUser(index, { commentsAboutService: v }))}
          {renderYN("Any complaint the service user made regarding the service by you, other carers or the agency?", su.complaintsByServiceUser, (v) => updatePerUser(index, { complaintsByServiceUser: v }))}
          {renderYN("Have you noticed any safeguarding issues with this client?", su.safeguardingIssues, (v) => updatePerUser(index, { safeguardingIssues: v }))}
          {renderYN("Is there anything else you want to discuss?", su.otherDiscussion, (v) => updatePerUser(index, { otherDiscussion: v }))}
          {renderYN("Are there any bruises with service user?", su.bruises, (v) => updatePerUser(index, { bruises: v }), { type: "bruises", serviceUserIndex: index, locations: su.bruisesLocations })}
          <div className="space-y-1 md:col-span-2">
            <Label>What are the causes for these bruises</Label>
            <Input value={su.bruisesCauses || ""} onChange={(e) => updatePerUser(index, { bruisesCauses: e.target.value })} disabled={su.bruises?.value !== "yes"} placeholder={su.bruises?.value === "yes" ? "Describe causes" : "N/A"} />
          </div>
          {renderYN("Are there any pressure sores with service user?", su.pressureSores, (v) => updatePerUser(index, { pressureSores: v }), { type: "pressureSores", serviceUserIndex: index, locations: su.pressureSoresLocations })}
        </div>
        <div className="pt-2 flex justify-between">
          <Button variant="outline" onClick={handleBack}>Back</Button>
          <Button onClick={handleNext}>{index === form.serviceUsersCount - 1 ? "Next" : "Next"}</Button>
        </div>
      </div>
    );
  };

  const renderOffice = () => (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">For Office Use Only</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Name of employee</Label>
          <Input value={form.office.employeeName || ""} onChange={(e) => setForm((prev) => ({ ...prev, office: { ...prev.office, employeeName: e.target.value } }))} />
        </div>
        <div className="space-y-1">
          <Label>Project</Label>
          <Input value={form.office.project || ""} onChange={(e) => setForm((prev) => ({ ...prev, office: { ...prev.office, project: e.target.value } }))} />
        </div>
        <div className="space-y-1">
          <Label>Supervisor</Label>
          <Input value={form.office.supervisor || ""} onChange={(e) => setForm((prev) => ({ ...prev, office: { ...prev.office, supervisor: e.target.value } }))} />
        </div>
        <div className="space-y-1">
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                {form.office.date ? format(new Date(form.office.date), "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={form.office.date ? new Date(form.office.date) : undefined}
                onSelect={(date) => date && setForm((prev) => ({ ...prev, office: { ...prev.office, date: format(date, "yyyy-MM-dd") } }))}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Issues Identified For Actions / Action Plan</Label>
        <div className="space-y-3">
          {form.office.actions.map((action, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-3 border rounded-md p-3">
              <Input placeholder="Issue" value={action.issue || ""} onChange={(e) => updateOffice(idx, { issue: e.target.value })} className="bg-accent/5 border-accent/30 focus-visible:ring-accent" />
              <Input placeholder="Action to be taken" value={action.action || ""} onChange={(e) => updateOffice(idx, { action: e.target.value })} className="bg-accent/5 border-accent/30 focus-visible:ring-accent" />
              <Input placeholder="By whom" value={action.byWhom || ""} onChange={(e) => updateOffice(idx, { byWhom: e.target.value })} className="bg-accent/5 border-accent/30 focus-visible:ring-accent" />
              <Input type="date" placeholder="Date Completed" value={action.dateCompleted || ""} onChange={(e) => updateOffice(idx, { dateCompleted: e.target.value })} className="bg-accent/5 border-accent/30 focus-visible:ring-accent" />
              <div className="md:col-span-4 flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => removeOfficeAction(idx)}>Remove</Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={addOfficeAction}>Add Action</Button>
        </div>
      </div>

      <div className="pt-2 flex justify-between">
        <Button variant="outline" onClick={handleBack}>Back</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSubmit}>Save Draft</Button>
          <Button onClick={handleSubmit}>Submit</Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Supervision</DialogTitle>
            <DialogDescription>Fill out the supervision form below</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Progress (minimal) */}
            <div className="text-sm text-muted-foreground">Step {step} of {totalSteps}</div>

            {step === 1 && renderPersonal()}
            {step === 2 && renderServiceUsersList()}
            {step >= 3 && currentServiceUserIndex >= 0 && currentServiceUserIndex < Math.max(1, form.serviceUsersCount) && renderPerServiceUser(currentServiceUserIndex)}
            {step === 2 + Math.max(1, form.serviceUsersCount) + 1 && renderOffice()}
          </div>
        </DialogContent>
      </Dialog>

      <BodyDiagramModal
        open={bodyDiagramModal.open}
        onOpenChange={(open) => setBodyDiagramModal(prev => ({ ...prev, open }))}
        onSave={saveBodyDiagram}
        title={bodyDiagramModal.type === "bruises" ? "Mark Bruise Locations" : "Mark Pressure Sore Locations"}
        initialMarkers={
          bodyDiagramModal.serviceUserIndex >= 0 
            ? (bodyDiagramModal.type === "bruises" 
                ? form.perServiceUser[bodyDiagramModal.serviceUserIndex]?.bruisesLocations 
                : form.perServiceUser[bodyDiagramModal.serviceUserIndex]?.pressureSoresLocations) || []
            : []
        }
      />
    </>
  );
}
