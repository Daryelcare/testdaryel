import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Check, Download, Save, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface YesNoQuestion {
  id: string;
  question: string;
  value: "yes" | "no" | "";
  comment: string;
}

interface QuestionnaireFormData {
  id?: string;
  employeeName: string;
  supervisorName: string;
  date: string;
  timeFrom: string;
  timeTo: string;
  complianceOfficer: string;
  questions: YesNoQuestion[];
  lastSaved?: string;
  status?: "draft" | "completed" | "submitted";
  branch: string;
  additionalEmployees: string[];
  notes: string;
}

interface QuestionnaireFormProps {
  complianceTypeId: string;
  complianceTypeName: string;
  employeeId?: string;
  employeeName?: string;
  periodIdentifier: string;
  onComplete: () => void;
}

export function QuestionnaireForm({
  complianceTypeId,
  complianceTypeName,
  employeeId,
  employeeName,
  periodIdentifier,
  onComplete
}: QuestionnaireFormProps) {
  const [formData, setFormData] = useState<QuestionnaireFormData>({
    employeeName: employeeName || "",
    supervisorName: "",
    date: format(new Date(), "dd/MM/yyyy"),
    timeFrom: "",
    timeTo: "",
    complianceOfficer: "",
    questions: [],
    status: "draft",
    branch: "",
    additionalEmployees: [],
    notes: ""
  });

  const [questions, setQuestions] = useState<any[]>([]);
  const [questionnaire, setQuestionnaire] = useState<any>(null);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchQuestionnaireData();
    fetchBranches();
  }, [complianceTypeId]);

  const fetchQuestionnaireData = async () => {
    try {
      // Fetch compliance type with questionnaire
      const { data: complianceType, error: complianceError } = await supabase
        .from('compliance_types')
        .select(`
          id,
          questionnaire_id,
          compliance_questionnaires (
            id,
            name,
            description
          )
        `)
        .eq('id', complianceTypeId)
        .single();

      if (complianceError) throw complianceError;

      if (complianceType?.questionnaire_id) {
        // Fetch questionnaire questions
        const { data: questionnaireQuestions, error: questionsError } = await supabase
          .from('compliance_questionnaire_questions')
          .select(`
            compliance_questions (
              id,
              question_text,
              question_type,
              options,
              is_required,
              order_index
            )
          `)
          .eq('questionnaire_id', complianceType.questionnaire_id)
          .order('order_index');

        if (questionsError) throw questionsError;

        const questionsData = questionnaireQuestions?.map(q => q.compliance_questions).filter(Boolean) || [];
        setQuestions(questionsData);
        setQuestionnaire(complianceType.compliance_questionnaires);

        // Initialize form questions
        const formQuestions: YesNoQuestion[] = questionsData.map((q, index) => ({
          id: q.id,
          question: q.question_text,
          value: "",
          comment: ""
        }));

        setFormData(prev => ({
          ...prev,
          questions: formQuestions
        }));
      }
    } catch (error) {
      console.error('Error fetching questionnaire:', error);
      toast({
        title: "Error",
        description: "Failed to load questionnaire data",
        variant: "destructive",
      });
    }
  };

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
    }
  };

  const handleInputChange = (field: keyof QuestionnaireFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error for this field if it exists
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleQuestionChange = (id: string, field: "value" | "comment", value: string) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map(q => 
        q.id === id ? { ...q, [field]: value } : q
      )
    }));

    // Clear error for this question if it exists
    if (formErrors[`question_${id}_${field}`]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`question_${id}_${field}`];
        return newErrors;
      });
    }
  };

  const addAdditionalEmployee = () => {
    setFormData(prev => ({
      ...prev,
      additionalEmployees: [...prev.additionalEmployees, ""]
    }));
  };

  const updateAdditionalEmployee = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      additionalEmployees: prev.additionalEmployees.map((emp, i) => 
        i === index ? value : emp
      )
    }));
  };

  const removeAdditionalEmployee = (index: number) => {
    setFormData(prev => ({
      ...prev,
      additionalEmployees: prev.additionalEmployees.filter((_, i) => i !== index)
    }));
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate required fields
    if (!formData.branch) errors.branch = "Branch is required";
    if (!formData.employeeName) errors.employeeName = "Employee name is required";
    if (!formData.supervisorName) errors.supervisorName = "Supervisor name is required";
    if (!formData.date) errors.date = "Date is required";
    if (!formData.timeFrom) errors.timeFrom = "Start time is required";
    if (!formData.timeTo) errors.timeTo = "End time is required";
    if (!formData.complianceOfficer) errors.complianceOfficer = "Compliance officer is required";

    // Validate date format (DD/MM/YYYY)
    if (formData.date) {
      const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
      if (!dateRegex.test(formData.date)) {
        errors.date = "Date must be in DD/MM/YYYY format";
      }
    }

    // Validate questions - require both answer and comment for all questions
    formData.questions.forEach(q => {
      if (!q.value) {
        errors[`question_${q.id}_value`] = "Please select Yes or No";
      }
      if (!q.comment.trim()) {
        errors[`question_${q.id}_comment`] = "Comment is required for all responses";
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveAsDraft = async () => {
    setIsLoading(true);
    try {
      const draftData = {
        ...formData,
        status: "draft" as const,
        lastSaved: new Date().toISOString()
      };

      // Save to localStorage as draft
      const draftKey = `compliance_draft_${complianceTypeId}_${employeeId || 'new'}`;
      localStorage.setItem(draftKey, JSON.stringify(draftData));
      
      setLastSaved(draftData.lastSaved);
      toast({
        title: "Draft saved",
        description: "Your progress has been saved as a draft",
      });
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        title: "Error",
        description: "Failed to save draft",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Create questionnaire response
      const { data: responseData, error: responseError } = await supabase
        .from('compliance_questionnaire_responses')
        .insert({
          employee_id: employeeId,
          questionnaire_id: questionnaire?.id,
          compliance_record_id: null, // Will be updated after creating the record
          completed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (responseError) throw responseError;

      // Create individual question responses
      const responses = formData.questions.map(q => ({
        questionnaire_response_id: responseData.id,
        question_id: q.id,
        response_value: JSON.stringify({
          answer: q.value,
          comment: q.comment
        })
      }));

      const { error: responsesError } = await supabase
        .from('compliance_responses')
        .insert(responses);

      if (responsesError) throw responsesError;

      // Create the compliance period record
      const { error: recordError } = await supabase
        .from('compliance_period_records')
        .insert({
          employee_id: employeeId,
          compliance_type_id: complianceTypeId,
          period_identifier: periodIdentifier,
          completion_date: format(new Date(), 'yyyy-MM-dd'),
          completion_method: 'questionnaire',
          status: 'completed',
          notes: formData.notes || null
        });

      if (recordError) throw recordError;

      // Clear draft from localStorage
      const draftKey = `compliance_draft_${complianceTypeId}_${employeeId || 'new'}`;
      localStorage.removeItem(draftKey);

      toast({
        title: "Questionnaire completed",
        description: "Your compliance questionnaire has been submitted successfully",
      });

      onComplete();
    } catch (error) {
      console.error('Error submitting questionnaire:', error);
      toast({
        title: "Error",
        description: "Failed to submit questionnaire. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!questionnaire || questions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">No Questionnaire Available</h3>
              <p className="text-muted-foreground">
                This compliance type ({complianceTypeName}) doesn't have a questionnaire assigned yet.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Please contact your administrator to set up a questionnaire, or use the Date/Text entry options instead.
              </p>
            </div>
            <Button variant="outline" onClick={onComplete}>
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">{complianceTypeName} - {questionnaire.name}</h2>
          <p className="text-muted-foreground">{questionnaire.description || "Complete the compliance questionnaire"}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            onClick={saveAsDraft}
            disabled={isLoading}
            className="flex-1 sm:flex-none"
          >
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 sm:flex-none"
          >
            <Check className="mr-2 h-4 w-4" />
            Submit
          </Button>
        </div>
      </div>

      {lastSaved && (
        <Alert className="bg-blue-50 border-blue-200">
          <Check className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Draft saved</AlertTitle>
          <AlertDescription className="text-blue-700">
            Last saved at {new Date(lastSaved).toLocaleTimeString()}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{complianceTypeName} Compliance Check</CardTitle>
          <CardDescription>Complete all sections of the compliance questionnaire</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold border-b pb-2">A: DETAILS OF COMPLIANCE CHECK</h2>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={addAdditionalEmployee}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Employee
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="branch" className="font-medium">
                  Branch <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.branch} onValueChange={(value) => handleInputChange("branch", value)}>
                  <SelectTrigger className={formErrors.branch ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.branch && <p className="text-red-500 text-sm">{formErrors.branch}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeeName" className="font-medium">
                  Employee Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="employeeName"
                  value={formData.employeeName}
                  onChange={(e) => handleInputChange("employeeName", e.target.value)}
                  className={formErrors.employeeName ? "border-red-500" : ""}
                  disabled={!!employeeName}
                />
                {formErrors.employeeName && <p className="text-red-500 text-sm">{formErrors.employeeName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="supervisorName" className="font-medium">
                  Supervisor/Manager <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="supervisorName"
                  value={formData.supervisorName}
                  onChange={(e) => handleInputChange("supervisorName", e.target.value)}
                  className={formErrors.supervisorName ? "border-red-500" : ""}
                />
                {formErrors.supervisorName && <p className="text-red-500 text-sm">{formErrors.supervisorName}</p>}
              </div>

              {/* Additional employees */}
              {formData.additionalEmployees.map((employee, index) => (
                <div key={`additional-employee-${index}`} className="space-y-2 col-span-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor={`additional-employee-${index}`} className="font-medium">
                      Additional Employee
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAdditionalEmployee(index)}
                      className="h-6 w-6 p-0 text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    id={`additional-employee-${index}`}
                    value={employee}
                    onChange={(e) => updateAdditionalEmployee(index, e.target.value)}
                  />
                </div>
              ))}

              <div className="space-y-2">
                <Label htmlFor="date" className="font-medium">
                  Date of Check <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="date"
                  placeholder="DD/MM/YYYY"
                  value={formData.date}
                  onChange={(e) => handleInputChange("date", e.target.value)}
                  className={formErrors.date ? "border-red-500" : ""}
                />
                {formErrors.date && <p className="text-red-500 text-sm">{formErrors.date}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeFrom" className="font-medium">
                  Time (From) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="timeFrom"
                  placeholder="e.g. 09:00 AM"
                  value={formData.timeFrom}
                  onChange={(e) => handleInputChange("timeFrom", e.target.value)}
                  className={formErrors.timeFrom ? "border-red-500" : ""}
                />
                {formErrors.timeFrom && <p className="text-red-500 text-sm">{formErrors.timeFrom}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeTo" className="font-medium">
                  Time (To) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="timeTo"
                  placeholder="e.g. 09:45 AM"
                  value={formData.timeTo}
                  onChange={(e) => handleInputChange("timeTo", e.target.value)}
                  className={formErrors.timeTo ? "border-red-500" : ""}
                />
                {formErrors.timeTo && <p className="text-red-500 text-sm">{formErrors.timeTo}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="complianceOfficer" className="font-medium">
                  Check carried out by <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="complianceOfficer"
                  value={formData.complianceOfficer}
                  onChange={(e) => handleInputChange("complianceOfficer", e.target.value)}
                  className={formErrors.complianceOfficer ? "border-red-500" : ""}
                />
                {formErrors.complianceOfficer && <p className="text-red-500 text-sm">{formErrors.complianceOfficer}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold border-b pb-2">B: COMPLIANCE QUESTIONS</h2>

            <Alert className="bg-blue-50 border-blue-200 mb-4">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">Important</AlertTitle>
              <AlertDescription className="text-blue-700">
                Comments are required for all responses, whether Yes or No.
              </AlertDescription>
            </Alert>

            {formData.questions.map((question, index) => (
              <div key={question.id} className="space-y-2 mb-6 border-b pb-4">
                <div className="font-medium">
                  {index + 1}. {question.question} <span className="text-red-500">*</span>
                </div>

                <RadioGroup
                  value={question.value}
                  onValueChange={(value) => handleQuestionChange(question.id, "value", value)}
                  className="flex items-center gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id={`${question.id}-yes`} />
                    <Label htmlFor={`${question.id}-yes`}>Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id={`${question.id}-no`} />
                    <Label htmlFor={`${question.id}-no`}>No</Label>
                  </div>
                </RadioGroup>

                {formErrors[`question_${question.id}_value`] && (
                  <p className="text-red-500 text-sm">{formErrors[`question_${question.id}_value`]}</p>
                )}

                <div className="mt-2">
                  <Label htmlFor={`${question.id}-comment`} className="text-sm text-gray-600">
                    Observation/comments <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id={`${question.id}-comment`}
                    value={question.comment}
                    onChange={(e) => handleQuestionChange(question.id, "comment", e.target.value)}
                    placeholder="Enter your observations or comments..."
                    className={`mt-1 ${formErrors[`question_${question.id}_comment`] ? "border-red-500" : ""}`}
                    rows={3}
                  />
                  {formErrors[`question_${question.id}_comment`] && (
                    <p className="text-red-500 text-sm">{formErrors[`question_${question.id}_comment`]}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold border-b pb-2">C: ADDITIONAL NOTES</h2>
            <div className="space-y-2">
              <Label htmlFor="notes" className="font-medium">
                Additional Notes/Comments (Optional)
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder="Enter any additional notes or comments..."
                rows={4}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={saveAsDraft}
              disabled={isLoading}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Draft
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
            >
              <Check className="mr-2 h-4 w-4" />
              {isLoading ? "Submitting..." : "Submit Questionnaire"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}