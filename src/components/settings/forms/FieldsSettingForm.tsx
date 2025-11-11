import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";

interface FieldsSettingFormProps {
  formData: {
    setting_key: string;
    setting_value: {
      field_name?: string;
      field_label?: string;
      step_name?: string;
      is_required?: boolean;
      is_visible?: boolean;
      help_text?: string;
      display_order?: number;
      validation_rules?: object;
    };
    setting_type?: string;
    display_order: number;
    is_active: boolean;
  };
  onFormDataChange: (data: any) => void;
  onSave: () => void;
  onCancel: () => void;
  isEditing: boolean;
}

const stepOptions = [
  { value: 'personal_info', label: 'Personal Information' },
  { value: 'availability', label: 'Availability' },
  { value: 'employment_history', label: 'Employment History' },
  { value: 'references', label: 'References' },
  { value: 'skills_experience', label: 'Skills & Experience' },
  { value: 'emergency_contact', label: 'Emergency Contact' },
  { value: 'declaration', label: 'Declaration' },
  { value: 'terms_policy', label: 'Terms & Policy' },
];

export function FieldsSettingForm({ 
  formData, 
  onFormDataChange, 
  onSave, 
  onCancel, 
  isEditing
}: FieldsSettingFormProps) {
  const updateFieldValue = (field: string, value: any) => {
    onFormDataChange({
      ...formData,
      setting_value: {
        ...formData.setting_value,
        [field]: value
      }
    });
  };

  return (
    <Card className="border-dashed border-primary/20 bg-gradient-to-br from-background to-muted/20">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border/50">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Form Field Settings</h3>
            <p className="text-sm text-muted-foreground">Configure form field properties and behavior</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="field_name" className="text-sm font-medium">Field Name</Label>
              <Input
                id="field_name"
                value={formData.setting_value.field_name || ''}
                onChange={(e) => {
                  updateFieldValue('field_name', e.target.value);
                  onFormDataChange({
                    ...formData,
                    setting_key: e.target.value
                  });
                }}
                placeholder="e.g., fullName, email, telephone"
                className="mt-2"
              />
            </div>
            
            <div>
              <Label htmlFor="field_label" className="text-sm font-medium">Field Label</Label>
              <Input
                id="field_label"
                value={formData.setting_value.field_label || ''}
                onChange={(e) => updateFieldValue('field_label', e.target.value)}
                placeholder="e.g., Full Name, Email Address"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="step_name" className="text-sm font-medium">Application Step</Label>
              <Select
                value={formData.setting_value.step_name || ''}
                onValueChange={(value) => {
                  updateFieldValue('step_name', value);
                  onFormDataChange({
                    ...formData,
                    setting_type: value
                  });
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select step" />
                </SelectTrigger>
                <SelectContent>
                  {stepOptions.map((step) => (
                    <SelectItem key={step.value} value={step.value}>
                      {step.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="help_text" className="text-sm font-medium">Help Text (Optional)</Label>
              <Textarea
                id="help_text"
                value={formData.setting_value.help_text || ''}
                onChange={(e) => updateFieldValue('help_text', e.target.value)}
                placeholder="Additional help text for this field"
                className="mt-2"
                rows={3}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="display_order" className="text-sm font-medium">Display Order</Label>
              <Input
                id="display_order"
                type="number"
                min="0"
                value={formData.setting_value.display_order || formData.display_order}
                onChange={(e) => {
                  const order = parseInt(e.target.value) || 0;
                  updateFieldValue('display_order', order);
                  onFormDataChange({
                    ...formData,
                    display_order: order
                  });
                }}
                className="mt-2"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.setting_value.is_required ?? true}
                  onCheckedChange={(checked) => updateFieldValue('is_required', checked)}
                />
                <Label className="text-sm font-medium">Required Field</Label>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.setting_value.is_visible ?? true}
                  onCheckedChange={(checked) => updateFieldValue('is_visible', checked)}
                />
                <Label className="text-sm font-medium">Visible</Label>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => onFormDataChange({
                    ...formData,
                    is_active: checked
                  })}
                />
                <Label className="text-sm font-medium">Active</Label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button onClick={onSave} className="flex-1">
            {isEditing ? 'Update Field' : 'Create Field'}
          </Button>
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}