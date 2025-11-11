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
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { questions, type RatingValue } from "./annual-appraisal-constants";

export interface AnnualAppraisalFormData {
  job_title: string;
  appraisal_date: string; // yyyy-MM-dd
  ratings: {
    clientCare: RatingValue;
    careStandards: RatingValue;
    safetyHealth: RatingValue;
    medicationManagement: RatingValue;
    communication: RatingValue;
    responsiveness: RatingValue;
    professionalDevelopment: RatingValue;
    attendance: RatingValue;
  };
  comments_manager?: string;
  comments_employee?: string;
  signature_manager: string;
  signature_employee: string;
  action_training?: string;
  action_career?: string;
  action_plan?: string;
}

interface AnnualAppraisalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AnnualAppraisalFormData) => void;
  initialData?: Partial<AnnualAppraisalFormData> | null;
  employeeName?: string;
}

export default function AnnualAppraisalFormDialog({ open, onOpenChange, onSubmit, initialData, employeeName }: AnnualAppraisalFormDialogProps) {
  const [errors, setErrors] = useState<Partial<Record<keyof AnnualAppraisalFormData, string>>>({});
  const [form, setForm] = useState<AnnualAppraisalFormData>({
    job_title: "Support Worker/Carer",
    appraisal_date: "",
    ratings: {
      clientCare: undefined as any,
      careStandards: undefined as any,
      safetyHealth: undefined as any,
      medicationManagement: undefined as any,
      communication: undefined as any,
      responsiveness: undefined as any,
      professionalDevelopment: undefined as any,
      attendance: undefined as any,
    },
    comments_manager: "",
    comments_employee: "",
    signature_manager: "",
    signature_employee: employeeName || "",
    action_training: "",
    action_career: "",
    action_plan: "",
  });

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (initialData) {
      setForm((prev) => ({
        ...prev,
        ...initialData,
        ratings: { ...prev.ratings, ...(initialData.ratings || {}) } as AnnualAppraisalFormData["ratings"],
      }));
    }
  }, [open, initialData]);

  const update = <K extends keyof AnnualAppraisalFormData>(key: K, value: AnnualAppraisalFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setRating = (key: keyof AnnualAppraisalFormData["ratings"], value: RatingValue) => {
    setForm((prev) => ({ ...prev, ratings: { ...prev.ratings, [key]: value } }));
  };

  const validate = () => {
    const e: Partial<Record<keyof AnnualAppraisalFormData, string>> = {};
    if (!form.job_title?.trim()) e.job_title = "Job title is required";
    if (!form.appraisal_date) e.appraisal_date = "Date of appraisal is required";
    (Object.keys(form.ratings) as (keyof AnnualAppraisalFormData["ratings"])[]).forEach((k) => {
      if (!form.ratings[k]) e.ratings = "All ratings required" as any;
    });
    if (!form.signature_manager?.trim()) e.signature_manager = "Supervisor/Manager signature is required";
    if (!form.signature_employee?.trim()) e.signature_employee = "Employee signature is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit(form);
  };

  const appDateObj = useMemo(() => (form.appraisal_date ? new Date(form.appraisal_date) : undefined), [form.appraisal_date]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Annual Appraisal</DialogTitle>
          <DialogDescription>Complete the annual appraisal form and submit.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          {/* Personal Info */}
          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="job_title">Job Title</Label>
              <Input id="job_title" value={form.job_title} onChange={(e) => update("job_title", e.target.value)} />
              {errors.job_title && <p className="text-sm text-destructive">{errors.job_title}</p>}
            </div>
            <div className="space-y-2">
              <Label>Date of Appraisal</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.appraisal_date && "text-muted-foreground")}
                    >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {appDateObj ? format(appDateObj, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={appDateObj}
                    onSelect={(d) => d && update("appraisal_date", format(d, "yyyy-MM-dd"))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {errors.appraisal_date && <p className="text-sm text-destructive">{errors.appraisal_date}</p>}
            </div>
          </section>

          {/* Performance Assessment */}
          <section className="space-y-4">
            <h3 className="text-base font-medium">Performance Assessment</h3>
            <div className="space-y-4">
              {questions.map((q) => (
                <div key={q.id} className="border rounded-md p-4">
                  <p className="font-medium mb-2">{q.title}</p>
                  <div className="grid gap-2">
                    {q.options.map((opt) => (
                      <label key={opt.value} className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name={q.id}
                          value={opt.value}
                          checked={(form.ratings as any)[q.id] === opt.value}
                          onChange={() => setRating(q.id as any, opt.value)}
                          className="mt-1"
                        />
                        <span className="text-sm leading-snug">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {errors.ratings && <p className="text-sm text-destructive">All ratings are required</p>}
          </section>

          {/* Comments */}
          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="comments_manager">General comments by supervisor/manager</Label>
              <Textarea id="comments_manager" rows={5} value={form.comments_manager || ""} onChange={(e) => update("comments_manager", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comments_employee">Comments by employee</Label>
              <Textarea id="comments_employee" rows={5} value={form.comments_employee || ""} onChange={(e) => update("comments_employee", e.target.value)} />
            </div>
          </section>

          {/* Signatures */}
          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="signature_manager">Supervisor/Manager signature (typed name)</Label>
              <Input id="signature_manager" value={form.signature_manager} onChange={(e) => update("signature_manager", e.target.value)} />
              {errors.signature_manager && <p className="text-sm text-destructive">{errors.signature_manager}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="signature_employee">Employee signature (typed name)</Label>
              <Input id="signature_employee" value={form.signature_employee} onChange={(e) => update("signature_employee", e.target.value)} />
              {errors.signature_employee && <p className="text-sm text-destructive">{errors.signature_employee}</p>}
            </div>
          </section>

          {/* Action Plan */}
          <section className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="action_training">Actions plans agreed to develop employee and/or the job include any Training or counselling requirements</Label>
              <Textarea id="action_training" rows={4} value={form.action_training || ""} onChange={(e) => update("action_training", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="action_career">Career development - possible steps in career development</Label>
              <Textarea id="action_career" rows={4} value={form.action_career || ""} onChange={(e) => update("action_career", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="action_plan">Agreed action plan, job & development objectives, and time scale</Label>
              <Textarea id="action_plan" rows={6} value={form.action_plan || ""} onChange={(e) => update("action_plan", e.target.value)} />
            </div>
          </section>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={handleSubmit}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
