import * as React from "react";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Download, Save } from "lucide-react";

const ratingOptions = [
  { value: "A", label: "A: Provides exceptional care, exceeding client expectations" },
  { value: "B", label: "B: Provides good quality care, meeting most client needs" },
  { value: "C", label: "C: Provides satisfactory care, meeting basic client needs" },
  { value: "D", label: "D: Inconsistent in providing adequate care" },
  { value: "E", label: "E: Unsatisfactory care, immediate action required" },
];

const questions = [
  {
    id: "clientCare",
    title: "Client Care – How effective is the employee in providing care to clients?",
    options: ratingOptions,
  },
  {
    id: "careStandards",
    title: "Knowledge of Care Standards – How well does the employee adhere to policies?",
    options: [
      { value: "A", label: "A: Demonstrates excellent understanding and adherence" },
      { value: "B", label: "B: Generally follows care standards with minor lapses" },
      { value: "C", label: "C: Adequate understanding of care standards, some areas unclear" },
      { value: "D", label: "D: Limited understanding, further training required" },
      { value: "E", label: "E: Poor adherence to care standards, immediate improvement needed" },
    ],
  },
  {
    id: "safetyHealth",
    title:
      "Safety and Health Compliance – How consistently does the employee follow safety and health guidelines?",
    options: [
      { value: "A", label: "A: Always follows guidelines, ensuring client and personal safety" },
      { value: "B", label: "B: Generally safe practices with minor lapses" },
      { value: "C", label: "C: Adequate safety practices, occasional reminders needed" },
      { value: "D", label: "D: Frequently neglects safety and health guidelines" },
      { value: "E", label: "E: Disregards safety and health guidelines, immediate action required" },
    ],
  },
  {
    id: "medicationManagement",
    title:
      "Medication Management – How effectively does the employee manage and administer medication?",
    options: [
      { value: "A", label: "A: Flawless in medication management and administration" },
      { value: "B", label: "B: Good medication management with minor errors" },
      { value: "C", label: "C: Adequate medication management, some errors" },
      { value: "D", label: "D: Frequent errors in medication management, further training required" },
      { value: "E", label: "E: Consistent errors in medication management, immediate action required" },
    ],
  },
  {
    id: "communication",
    title:
      "Communication with Clients & Team – How effective is the employee in communicating with clients and team?",
    options: [
      { value: "A", label: "A: Consistently clear and respectful communication" },
      { value: "B", label: "B: Generally good communication with minor misunderstandings" },
      { value: "C", label: "C: Adequate communication skills" },
      { value: "D", label: "D: Poor communication skills, leading to misunderstandings and issues" },
      { value: "E", label: "E: Ineffective communication, immediate improvement needed" },
    ],
  },
  {
    id: "responsiveness",
    title:
      "Responsiveness and Adaptability – How well does the employee adapt to changing client needs and situations?",
    options: [
      { value: "A", label: "A: Quickly and effectively adapts" },
      { value: "B", label: "B: Adequately responsive with minor delays" },
      { value: "C", label: "C: Satisfactory responsiveness but slow to adapt" },
      { value: "D", label: "D: Struggles with responsiveness and adaptability" },
      { value: "E", label: "E: Unable to adapt to changing situations, immediate action required" },
    ],
  },
  {
    id: "professionalDevelopment",
    title:
      "Professional Development – How actively does the employee engage in professional development?",
    options: [
      { value: "A", label: "A: Actively seeks and engages in opportunities" },
      { value: "B", label: "B: Participates in professional development" },
      { value: "C", label: "C: Occasionally engages in professional development" },
      { value: "D", label: "D: Rarely engages in professional development opportunities" },
      { value: "E", label: "E: Does not engage in professional development" },
    ],
  },
  {
    id: "attendance",
    title:
      "Attendance & Punctuality – What is the employee’s pattern of absence and punctuality?",
    options: [
      { value: "A", label: "A: Always punctual, rarely absent" },
      { value: "B", label: "B: Generally punctual with acceptable attendance" },
      { value: "C", label: "C: Occasional lateness or absence" },
      { value: "D", label: "D: Frequent lateness or absences, attention required" },
      { value: "E", label: "E: Consistently late and/or absent, immediate action required" },
    ],
  },
] as const;

const ratingEnum = z.enum(["A","B","C","D","E"]);
const RatingsSchema = z.object({
  clientCare: ratingEnum,
  careStandards: ratingEnum,
  safetyHealth: ratingEnum,
  medicationManagement: ratingEnum,
  communication: ratingEnum,
  responsiveness: ratingEnum,
  professionalDevelopment: ratingEnum,
  attendance: ratingEnum,
});

const FormSchema = z.object({
  job_title: z.string().min(1, "Job title is required"),
  appraisal_date: z.date({ required_error: "Date of appraisal is required" }),
  ratings: RatingsSchema,
  comments_manager: z.string().optional(),
  comments_employee: z.string().optional(),
  signature_manager: z.string().min(1, "Supervisor/Manager signature is required"),
  signature_employee: z.string().min(1, "Employee signature is required"),
  action_training: z.string().optional(),
  action_career: z.string().optional(),
  action_plan: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

export default function AnnualAppraisalForm() {
  const [dateOpen, setDateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const defaultValues: FormValues = useMemo(
    () => ({
      job_title: "Support Worker/Carer",
      appraisal_date: new Date(),
      ratings: Object.fromEntries(questions.map((q) => [q.id, undefined])) as any,
      comments_manager: "",
      comments_employee: "",
      signature_manager: "",
      signature_employee: "",
      action_training: "",
      action_career: "",
      action_plan: "",
    }),
    []
  );

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(FormSchema), defaultValues });

  const appDate = watch("appraisal_date");
  const year = appDate?.getFullYear?.() ?? new Date().getFullYear();

  const onSubmit = async (values: FormValues) => {
    try {
      setSaving(true);
      const payload = {
        job_title: values.job_title,
        appraisal_date: values.appraisal_date.toISOString().slice(0, 10),
        year: values.appraisal_date.getFullYear(),
        ratings: values.ratings,
        comments_manager: values.comments_manager || null,
        comments_employee: values.comments_employee || null,
        signature_manager: values.signature_manager,
        signature_employee: values.signature_employee,
        action_training: values.action_training || null,
        action_career: values.action_career || null,
        action_plan: values.action_plan || null,
      };

      
      const { error } = await (supabase as any).from("annual_appraisals").insert(payload as any);
      if (error) throw error;

      const ts = new Date().toLocaleString();
      setSavedAt(ts);
      toast({ title: "Appraisal saved", description: `Saved at ${ts}` });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Unknown error" });
    } finally {
      setSaving(false);
    }
  };

  const exportPDF = async () => {
    const target = pdfRef.current;
    if (!target) return;
    const canvas = await html2canvas(target, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgProps = (pdf as any).getImageProperties(imgData);
    const imgWidth = pageWidth;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

    let position = 0;
    let heightLeft = imgHeight;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`annual-appraisal-${year}.pdf`);
  };

  return (
    <main className="container py-8">
      <header className="mb-6 flex items-center gap-4">
        <img src="/favicon.ico" alt="Company logo" className="h-10 w-10" />
        <div>
          <h1 className="text-2xl font-semibold">Annual Appraisal</h1>
          <p className="text-sm text-muted-foreground">Year: {year}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" onClick={exportPDF} aria-label="Export as PDF">
            <Download className="h-4 w-4 mr-2" /> Export PDF
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={saving} aria-label="Save appraisal">
            <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </header>

      {savedAt && (
        <p className="mb-4 text-sm text-muted-foreground">Saved at: {savedAt}</p>
      )}

      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="signatures">Signatures</TabsTrigger>
          <TabsTrigger value="action">Action Plan</TabsTrigger>
          <TabsTrigger value="review">Review</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Card>
            <CardHeader>
              <CardTitle>Personal Info</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="job_title">Job Title</Label>
                <Input id="job_title" placeholder="Enter job title" {...register("job_title")} />
                {errors.job_title && (
                  <p className="text-sm text-destructive">{errors.job_title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Date of Appraisal</Label>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !appDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {appDate ? format(appDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={appDate}
                      onSelect={(d) => d && setValue("appraisal_date", d, { shouldValidate: true })}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {errors.appraisal_date && (
                  <p className="text-sm text-destructive">{errors.appraisal_date.message as string}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <div className="space-y-6">
            {questions.map((q) => (
              <Card key={q.id}>
                <CardHeader>
                  <CardTitle className="text-base font-medium">{q.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    onValueChange={(val) => setValue(`ratings.${q.id}` as any, val as any, { shouldValidate: true })}
                    defaultValue={undefined as any}
                    className="grid gap-2"
                  >
                    {q.options.map((opt) => (
                      <div key={opt.value} className="flex items-start gap-3">
                        <RadioGroupItem value={opt.value} id={`${q.id}-${opt.value}`} />
                        <Label htmlFor={`${q.id}-${opt.value}`} className="leading-snug">
                          {opt.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {errors.ratings && (errors.ratings as any)[q.id] && (
                    <p className="mt-2 text-sm text-destructive">Selection required</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="comments">
          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="comments_manager">General comments by supervisor/manager</Label>
                <Textarea id="comments_manager" rows={6} {...register("comments_manager")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comments_employee">Comments by employee</Label>
                <Textarea id="comments_employee" rows={6} {...register("comments_employee")} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signatures">
          <Card>
            <CardHeader>
              <CardTitle>Signatures</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="signature_manager">Supervisor/Manager signature (typed name)</Label>
                <Input id="signature_manager" placeholder="Type name" {...register("signature_manager")} />
                {errors.signature_manager && (
                  <p className="text-sm text-destructive">{errors.signature_manager.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="signature_employee">Employee signature (typed name)</Label>
                <Input id="signature_employee" placeholder="Type name" {...register("signature_employee")} />
                {errors.signature_employee && (
                  <p className="text-sm text-destructive">{errors.signature_employee.message}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="action">
          <Card>
            <CardHeader>
              <CardTitle>Action Plan</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="space-y-2">
                <Label htmlFor="action_training">Training or counselling requirements</Label>
                <Textarea id="action_training" rows={4} {...register("action_training")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="action_career">Career development steps</Label>
                <Textarea id="action_career" rows={4} {...register("action_career")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="action_plan">Agreed action plan, job & development objectives, and time scale</Label>
                <Textarea id="action_plan" rows={6} {...register("action_plan")} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review">
          <div ref={pdfRef} className="space-y-4">
            <div className="flex items-center gap-4 border rounded-md p-4">
              <img src="/favicon.ico" alt="Company logo" className="h-10 w-10" />
              <div>
                <h2 className="text-xl font-semibold">Annual Appraisal Summary</h2>
                <p className="text-sm text-muted-foreground">Year: {year}</p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Personal Info</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <p><strong>Job Title:</strong> {watch("job_title") || "—"}</p>
                <p>
                  <strong>Date of Appraisal:</strong> {appDate ? format(appDate, "PPP") : "—"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Assessment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {questions.map((q) => {
                  const val = (watch("ratings") as any)?.[q.id];
                  const label = q.options.find((o) => o.value === val)?.label || "—";
                  return (
                    <div key={q.id} className="grid gap-1">
                      <p className="font-medium">{q.title}</p>
                      <p className="text-sm text-muted-foreground">{label}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Comments</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <p>
                  <strong>Supervisor/Manager:</strong> {watch("comments_manager") || "—"}
                </p>
                <p>
                  <strong>Employee:</strong> {watch("comments_employee") || "—"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Signatures</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <p>
                  <strong>Supervisor/Manager:</strong> {watch("signature_manager") || "—"}
                </p>
                <p>
                  <strong>Employee:</strong> {watch("signature_employee") || "—"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Action Plan</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <p>
                  <strong>Training/Counselling:</strong> {watch("action_training") || "—"}
                </p>
                <p>
                  <strong>Career Development:</strong> {watch("action_career") || "—"}
                </p>
                <p>
                  <strong>Objectives & Time Scale:</strong> {watch("action_plan") || "—"}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <footer className="mt-8 flex justify-end gap-2">
        <Button variant="secondary" onClick={exportPDF} aria-label="Export as PDF">
          <Download className="h-4 w-4 mr-2" /> Export PDF
        </Button>
        <Button onClick={handleSubmit(onSubmit)} disabled={saving} aria-label="Save appraisal">
          <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save"}
        </Button>
      </footer>
    </main>
  );
}
