import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Plus, Trash2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Question {
  id: string;
  question_text: string;
  question_type: 'yes_no' | 'text' | 'multiple_choice' | 'number';
  is_required: boolean;
  options?: string[];
}

interface ComplianceType {
  id: string;
  name: string;
  description?: string;
}

export function SpotCheckFormManagement() {
  const [complianceTypes, setComplianceTypes] = useState<ComplianceType[]>([]);
  const [selectedComplianceType, setSelectedComplianceType] = useState('');
  const [questionnaireName, setQuestionnaireName] = useState('');
  const [questionnaireDescription, setQuestionnaireDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<'yes_no' | 'text' | 'multiple_choice' | 'number'>('yes_no');
  const [newQuestionRequired, setNewQuestionRequired] = useState(true);
  const [newQuestionOptions, setNewQuestionOptions] = useState<string[]>(['']);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Default spot check questions for quick setup
  const defaultSpotCheckQuestions = [
    "Care Worker arrives at the Service User's home on time",
    "Care Worker has keys for entry/Alerts the Service User upon arrival / key safe number",
    "Care Worker is wearing a valid and current ID badge",
    "Care Worker practices safe hygiene (use of PPE clothing, gloves/aprons etc.)",
    "Care Worker checks Service User's care plan upon arrival",
    "Equipment (hoists etc) used properly",
    "Care Worker practices proper food safety and hygiene principles",
    "Care Worker is vigilant for hazards in the Service Users home",
    "Care Worker communicates with the Service User (tasks to be done maintaining confidentiality)",
    "Care Worker asks Service User if he/she is satisfied with the service",
    "Care Worker completes Daily Report forms satisfactorily",
    "Snacks left for the Service User are covered and stored properly",
    "Care Worker leaves premises, locking doors behind him/ her"
  ];

  useEffect(() => {
    fetchComplianceTypes();
  }, []);

  const fetchComplianceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('compliance_types')
        .select('id, name, description')
        .order('name');

      if (error) throw error;
      setComplianceTypes(data || []);
    } catch (error) {
      console.error('Error fetching compliance types:', error);
      toast({
        title: "Error",
        description: "Failed to load compliance types",
        variant: "destructive",
      });
    }
  };

  const loadSpotCheckTemplate = () => {
    setQuestionnaireName('Spot Check Questionnaire');
    setQuestionnaireDescription('Standard spot check form for care workers');
    
    const spotCheckQuestions: Question[] = defaultSpotCheckQuestions.map((questionText, index) => ({
      id: `default_${index + 1}`,
      question_text: questionText,
      question_type: 'yes_no',
      is_required: true,
      options: undefined
    }));

    setQuestions(spotCheckQuestions);
    
    toast({
      title: "Template loaded",
      description: "Spot check template has been loaded with default questions",
    });
  };

  const addQuestion = () => {
    if (!newQuestionText.trim()) {
      toast({
        title: "Error",
        description: "Question text is required",
        variant: "destructive",
      });
      return;
    }

    const newQuestion: Question = {
      id: `new_${Date.now()}`,
      question_text: newQuestionText.trim(),
      question_type: newQuestionType,
      is_required: newQuestionRequired,
      options: newQuestionType === 'multiple_choice' ? newQuestionOptions.filter(opt => opt.trim()) : undefined
    };

    setQuestions(prev => [...prev, newQuestion]);
    setNewQuestionText('');
    setNewQuestionType('yes_no');
    setNewQuestionRequired(true);
    setNewQuestionOptions(['']);
  };

  const removeQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const addOption = () => {
    setNewQuestionOptions(prev => [...prev, '']);
  };

  const updateOption = (index: number, value: string) => {
    setNewQuestionOptions(prev => prev.map((opt, i) => i === index ? value : opt));
  };

  const removeOption = (index: number) => {
    setNewQuestionOptions(prev => prev.filter((_, i) => i !== index));
  };

  const saveQuestionnaire = async () => {
    if (!selectedComplianceType) {
      toast({
        title: "Error",
        description: "Please select a compliance type",
        variant: "destructive",
      });
      return;
    }

    if (!questionnaireName.trim()) {
      toast({
        title: "Error",
        description: "Questionnaire name is required",
        variant: "destructive",
      });
      return;
    }

    if (questions.length === 0) {
      toast({
        title: "Error",
        description: "At least one question is required",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Create questionnaire
      const { data: questionnaire, error: questionnaireError } = await supabase
        .from('compliance_questionnaires')
        .insert({
          name: questionnaireName.trim(),
          description: questionnaireDescription.trim() || null,
          compliance_type_id: selectedComplianceType,
          is_active: true
        })
        .select()
        .single();

      if (questionnaireError) throw questionnaireError;

      // Create questions
      const { data: createdQuestions, error: questionsError } = await supabase
        .from('compliance_questions')
        .insert(
          questions.map((q, index) => ({
            question_text: q.question_text,
            question_type: q.question_type,
            is_required: q.is_required,
            options: q.options ? JSON.stringify(q.options) : null,
            order_index: index
          }))
        )
        .select();

      if (questionsError) throw questionsError;

      // Link questions to questionnaire
      const { error: linkError } = await supabase
        .from('compliance_questionnaire_questions')
        .insert(
          createdQuestions.map((q, index) => ({
            questionnaire_id: questionnaire.id,
            question_id: q.id,
            order_index: index
          }))
        );

      if (linkError) throw linkError;

      // Update compliance type to link to this questionnaire
      const { error: updateError } = await supabase
        .from('compliance_types')
        .update({ questionnaire_id: questionnaire.id })
        .eq('id', selectedComplianceType);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Questionnaire created and linked to compliance type successfully",
      });

      // Reset form
      setSelectedComplianceType('');
      setQuestionnaireName('');
      setQuestionnaireDescription('');
      setQuestions([]);
    } catch (error) {
      console.error('Error saving questionnaire:', error);
      toast({
        title: "Error",
        description: "Failed to save questionnaire",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="card-premium animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-primary" />
          Spot Check Form Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertDescription>
            Create and manage spot check questionnaires for different compliance types. Each compliance type can have its own questionnaire.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="compliance-type">Compliance Type *</Label>
              <Select value={selectedComplianceType} onValueChange={setSelectedComplianceType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select compliance type" />
                </SelectTrigger>
                <SelectContent>
                  {complianceTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="questionnaire-name">Questionnaire Name *</Label>
              <Input
                id="questionnaire-name"
                value={questionnaireName}
                onChange={(e) => setQuestionnaireName(e.target.value)}
                placeholder="e.g., Spot Check Questionnaire"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="questionnaire-description">Description</Label>
              <Textarea
                id="questionnaire-description"
                value={questionnaireDescription}
                onChange={(e) => setQuestionnaireDescription(e.target.value)}
                placeholder="Brief description of this questionnaire"
                rows={3}
              />
            </div>

            <Button onClick={loadSpotCheckTemplate} variant="outline" className="w-full">
              <FileText className="w-4 h-4 mr-2" />
              Load Spot Check Template
            </Button>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Add New Question</h3>
            
            <div className="space-y-2">
              <Label htmlFor="question-text">Question Text *</Label>
              <Textarea
                id="question-text"
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                placeholder="Enter your question"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="question-type">Question Type</Label>
              <Select value={newQuestionType} onValueChange={(value: any) => setNewQuestionType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes_no">Yes/No</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newQuestionType === 'multiple_choice' && (
              <div className="space-y-2">
                <Label>Options</Label>
                {newQuestionOptions.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeOption(index)}
                      disabled={newQuestionOptions.length <= 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOption}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Option
                </Button>
              </div>
            )}

            <Button onClick={addQuestion} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Question
            </Button>
          </div>
        </div>

        {questions.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Questions ({questions.length})</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {questions.map((question, index) => (
                <div key={question.id} className="flex justify-between items-start p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{index + 1}. {question.question_text}</p>
                    <p className="text-sm text-muted-foreground">
                      Type: {question.question_type.replace('_', ' ')}
                      {question.is_required && ' (Required)'}
                    </p>
                    {question.options && (
                      <p className="text-sm text-muted-foreground">
                        Options: {question.options.join(', ')}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQuestion(question.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <Button onClick={saveQuestionnaire} disabled={isLoading}>
            <Save className="w-4 h-4 mr-2" />
            {isLoading ? "Saving..." : "Save Questionnaire"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}