import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, FileText, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  has_questionnaire: boolean;
}

interface Branch {
  id: string;
  name: string;
}

interface Questionnaire {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  compliance_type_id?: string;
  branch_id?: string;
  compliance_types?: { name: string };
  branches?: { name: string };
}

export function QuestionnaireManagement() {
  const [complianceTypes, setComplianceTypes] = useState<ComplianceType[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [selectedComplianceType, setSelectedComplianceType] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [questionnaireName, setQuestionnaireName] = useState("");
  const [questionnaireDescription, setQuestionnaireDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [newQuestion, setNewQuestion] = useState<{
    question_text: string;
    question_type: 'yes_no' | 'text' | 'multiple_choice' | 'number';
    is_required: boolean;
    options: string[];
  }>({
    question_text: "",
    question_type: "yes_no",
    is_required: true,
    options: []
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchComplianceTypes();
    fetchBranches();
    fetchQuestionnaires();
  }, []);

  const fetchComplianceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('compliance_types')
        .select('id, name, description, has_questionnaire')
        .eq('has_questionnaire', true)
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
        title: "Error",
        description: "Failed to load branches",
        variant: "destructive",
      });
    }
  };

  const fetchQuestionnaires = async () => {
    try {
      const { data, error } = await supabase
        .from('compliance_questionnaires')
        .select(`
          *,
          compliance_types(name),
          branches(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuestionnaires(data || []);
    } catch (error) {
      console.error('Error fetching questionnaires:', error);
      toast({
        title: "Error",
        description: "Failed to load questionnaires",
        variant: "destructive",
      });
    }
  };

  const addQuestion = () => {
    if (!newQuestion.question_text.trim()) {
      toast({
        title: "Error",
        description: "Please enter a question text",
        variant: "destructive",
      });
      return;
    }

    const question: Question = {
      id: Date.now().toString(),
      question_text: newQuestion.question_text,
      question_type: newQuestion.question_type,
      is_required: newQuestion.is_required,
      options: newQuestion.question_type === 'multiple_choice' ? newQuestion.options : undefined
    };

    setQuestions([...questions, question]);
    setNewQuestion({
      question_text: "",
      question_type: "yes_no",
      is_required: true,
      options: []
    });
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const addOption = () => {
    setNewQuestion({
      ...newQuestion,
      options: [...newQuestion.options, ""]
    });
  };

  const updateOption = (index: number, value: string) => {
    const updatedOptions = [...newQuestion.options];
    updatedOptions[index] = value;
    setNewQuestion({
      ...newQuestion,
      options: updatedOptions
    });
  };

  const removeOption = (index: number) => {
    setNewQuestion({
      ...newQuestion,
      options: newQuestion.options.filter((_, i) => i !== index)
    });
  };

  const loadSpotCheckTemplate = () => {
    const spotCheckQuestions: Question[] = [
      {
        id: "1",
        question_text: "Care Worker arrives at the Service User's home on time",
        question_type: "yes_no",
        is_required: true
      },
      {
        id: "2", 
        question_text: "Care Worker has keys for entry/Alerts the Service User upon arrival / key safe number",
        question_type: "yes_no",
        is_required: true
      },
      {
        id: "3",
        question_text: "Care Worker is wearing a valid and current ID badge",
        question_type: "yes_no", 
        is_required: true
      },
      {
        id: "4",
        question_text: "Care Worker practices safe hygiene (use of PPE clothing, gloves/aprons etc.",
        question_type: "yes_no",
        is_required: true
      },
      {
        id: "5",
        question_text: "Care Worker checks Service User's care plan upon arrival",
        question_type: "yes_no",
        is_required: true
      },
      {
        id: "6",
        question_text: "Equipment (hoists etc) used properly",
        question_type: "yes_no",
        is_required: true
      },
      {
        id: "7",
        question_text: "Care Worker practices proper food safety and hygiene principles",
        question_type: "yes_no",
        is_required: true
      },
      {
        id: "8",
        question_text: "Care Worker is vigilant for hazards in the Service Users home",
        question_type: "yes_no",
        is_required: true
      },
      {
        id: "9",
        question_text: "Care Worker communicates with the Service User (tasks to be done maintaining confidentiality",
        question_type: "yes_no",
        is_required: true
      },
      {
        id: "10",
        question_text: "Care Worker asks Service User if he/she is satisfied with the service",
        question_type: "yes_no",
        is_required: true
      },
      {
        id: "11",
        question_text: "Care Worker completes Daily Report forms satisfactorily",
        question_type: "yes_no",
        is_required: true
      },
      {
        id: "12",
        question_text: "Snacks left for the Service User are covered and stored properly",
        question_type: "yes_no",
        is_required: true
      },
      {
        id: "13",
        question_text: "Care Worker leaves premises, locking doors behind him/ her",
        question_type: "yes_no",
        is_required: true
      }
    ];

    setQuestions(spotCheckQuestions);
    if (!questionnaireName) {
      setQuestionnaireName("Spot Check Questionnaire");
    }
    toast({
      title: "Template Loaded",
      description: "Spot check template questions have been loaded",
    });
  };

  const saveQuestionnaire = async () => {
    if (!questionnaireName || !selectedComplianceType || !selectedBranch || questions.length === 0) {
      toast({
        title: "Error", 
        description: "Please fill in all required fields and add at least one question",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Check if questionnaire already exists for this compliance type + branch
      const { data: existing } = await supabase
        .from('compliance_questionnaires')
        .select('id')
        .eq('compliance_type_id', selectedComplianceType)
        .eq('branch_id', selectedBranch)
        .single();

      if (existing) {
        toast({
          title: "Error",
          description: "A questionnaire already exists for this compliance type and branch combination",
          variant: "destructive",
        });
        return;
      }

      // Create the questionnaire
      const { data: questionnaire, error: questionnaireError } = await supabase
        .from('compliance_questionnaires')
        .insert({
          name: questionnaireName,
          description: questionnaireDescription,
          compliance_type_id: selectedComplianceType,
          branch_id: selectedBranch,
          is_active: true
        })
        .select()
        .single();

      if (questionnaireError) throw questionnaireError;

      // Create the questions
      const questionsToInsert = questions.map((q, index) => ({
        question_text: q.question_text,
        question_type: q.question_type,
        is_required: q.is_required,
        options: q.options || null,
        order_index: index
      }));

      const { data: createdQuestions, error: questionsError } = await supabase
        .from('compliance_questions')
        .insert(questionsToInsert)
        .select();

      if (questionsError) throw questionsError;

      // Link questions to questionnaire
      const questionnaireQuestions = createdQuestions.map((question, index) => ({
        questionnaire_id: questionnaire.id,
        question_id: question.id,
        order_index: index
      }));

      const { error: linkError } = await supabase
        .from('compliance_questionnaire_questions')
        .insert(questionnaireQuestions);

      if (linkError) throw linkError;

      toast({
        title: "Success",
        description: "Questionnaire saved successfully!",
      });

      // Reset form
      setQuestionnaireName("");
      setQuestionnaireDescription("");
      setSelectedComplianceType("");
      setSelectedBranch("");
      setQuestions([]);
      
      // Refresh questionnaires list
      fetchQuestionnaires();
      
    } catch (error) {
      console.error('Error saving questionnaire:', error);
      toast({
        title: "Error",
        description: "Failed to save questionnaire. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteQuestionnaire = async (id: string) => {
    try {
      const { error } = await supabase
        .from('compliance_questionnaires')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Questionnaire deleted successfully",
      });

      fetchQuestionnaires();
    } catch (error) {
      console.error('Error deleting questionnaire:', error);
      toast({
        title: "Error",
        description: "Failed to delete questionnaire",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Existing Questionnaires */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Existing Questionnaires
          </CardTitle>
        </CardHeader>
        <CardContent>
          {questionnaires.length > 0 ? (
            <div className="space-y-4">
              {questionnaires.map((questionnaire) => (
                <Card key={questionnaire.id} className="border border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium">{questionnaire.name}</h4>
                        {questionnaire.description && (
                          <p className="text-sm text-muted-foreground">
                            {questionnaire.description}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Badge variant={questionnaire.is_active ? "default" : "secondary"}>
                            {questionnaire.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {questionnaire.compliance_types && (
                            <Badge variant="outline">
                              {questionnaire.compliance_types.name}
                            </Badge>
                          )}
                          {questionnaire.branches && (
                            <Badge variant="outline">
                              {questionnaire.branches.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteQuestionnaire(questionnaire.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-6">
              No questionnaires created yet. Create your first questionnaire below.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Questionnaire Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Questionnaire Builder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Compliance Type <span className="text-red-500">*</span></Label>
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
              {complianceTypes.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No compliance types with questionnaire enabled. Enable questionnaires in Compliance Type Management first.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Branch <span className="text-red-500">*</span></Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
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
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Questionnaire Name <span className="text-red-500">*</span></Label>
              <Input
                value={questionnaireName}
                onChange={(e) => setQuestionnaireName(e.target.value)}
                placeholder="e.g., Islington Care Worker Spot Check"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={questionnaireDescription}
                onChange={(e) => setQuestionnaireDescription(e.target.value)}
                placeholder="Brief description..."
              />
            </div>
          </div>

          {/* Template Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={loadSpotCheckTemplate}
              className="flex-1"
            >
              Load Spot Check Template
            </Button>
          </div>

          {/* Add New Question */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add New Question</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Question Text</Label>
                <Textarea
                  value={newQuestion.question_text}
                  onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
                  placeholder="Enter your question..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Question Type</Label>
                  <Select
                    value={newQuestion.question_type}
                    onValueChange={(value: any) => setNewQuestion({ ...newQuestion, question_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes_no">Yes/No</SelectItem>
                      <SelectItem value="text">Text Input</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="required"
                    checked={newQuestion.is_required}
                    onChange={(e) => setNewQuestion({ ...newQuestion, is_required: e.target.checked })}
                  />
                  <Label htmlFor="required">Required</Label>
                </div>
              </div>

              {newQuestion.question_type === 'multiple_choice' && (
                <div className="space-y-2">
                  <Label>Options</Label>
                  {newQuestion.options.map((option, index) => (
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
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addOption}
                  >
                    Add Option
                  </Button>
                </div>
              )}

              <Button onClick={addQuestion} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </Button>
            </CardContent>
          </Card>

          {/* Questions List */}
          {questions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Questions ({questions.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {questions.map((question, index) => (
                  <div key={question.id} className="flex items-start justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">Q{index + 1}</span>
                        <Badge variant={question.question_type === 'yes_no' ? 'default' : 'secondary'}>
                          {question.question_type.replace('_', ' ')}
                        </Badge>
                        {question.is_required && (
                          <Badge variant="destructive" className="text-xs">Required</Badge>
                        )}
                      </div>
                      <p className="text-sm">{question.question_text}</p>
                      {question.options && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground">Options: {question.options.join(', ')}</p>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeQuestion(question.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Save Questionnaire */}
          <div className="flex justify-end">
            <Button 
              onClick={saveQuestionnaire}
              disabled={!questionnaireName || !selectedComplianceType || !selectedBranch || questions.length === 0 || loading}
              className="bg-gradient-primary hover:opacity-90"
            >
              <Settings className="h-4 w-4 mr-2" />
              {loading ? "Saving..." : "Save Questionnaire"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
