import React from 'react';
import { ShiftSettingForm } from './ShiftSettingForm';
import { StatusSettingForm } from './StatusSettingForm';
import { PersonalSettingForm } from './PersonalSettingForm';
import { EmergencySettingForm } from './EmergencySettingForm';
import { SkillsSettingForm } from './SkillsSettingForm';
import { FieldsSettingForm } from './FieldsSettingForm';
import { ReferenceSettingForm } from './ReferenceSettingForm';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Settings2 } from "lucide-react";

interface FormRendererProps {
  category: string;
  formData: any;
  onFormDataChange: (data: any) => void;
  onSave: () => void;
  onCancel: () => void;
  isEditing: boolean;
  existingSettings?: any[];
}

export function FormRenderer({ 
  category, 
  formData, 
  onFormDataChange, 
  onSave, 
  onCancel, 
  isEditing,
  existingSettings = []
}: FormRendererProps) {
  // Extract existing categories for skills
  const existingCategories = existingSettings
    .filter(s => s.category === 'skills' && s.setting_type === 'category')
    .map(s => ({ 
      id: s.setting_value?.id || s.id, 
      name: s.setting_value?.name || s.setting_key 
    }));

  switch (category) {
    case 'shift':
      return (
        <ShiftSettingForm
          formData={formData}
          onFormDataChange={onFormDataChange}
          onSave={onSave}
          onCancel={onCancel}
          isEditing={isEditing}
        />
      );

    case 'status':
      return (
        <StatusSettingForm
          formData={formData}
          onFormDataChange={onFormDataChange}
          onSave={onSave}
          onCancel={onCancel}
          isEditing={isEditing}
        />
      );

    case 'personal':
      return (
        <PersonalSettingForm
          formData={formData}
          onFormDataChange={onFormDataChange}
          onSave={onSave}
          onCancel={onCancel}
          isEditing={isEditing}
        />
      );

    case 'emergency':
      return (
        <EmergencySettingForm
          formData={formData}
          onFormDataChange={onFormDataChange}
          onSave={onSave}
          onCancel={onCancel}
          isEditing={isEditing}
        />
      );

    case 'skills':
      return (
        <SkillsSettingForm
          formData={formData}
          onFormDataChange={onFormDataChange}
          onSave={onSave}
          onCancel={onCancel}
          isEditing={isEditing}
          existingCategories={existingCategories}
        />
      );

    case 'fields':
      return (
        <FieldsSettingForm
          formData={formData}
          onFormDataChange={onFormDataChange}
          onSave={onSave}
          onCancel={onCancel}
          isEditing={isEditing}
        />
      );

    case 'reference':
      return (
        <ReferenceSettingForm
          formData={formData}
          onFormDataChange={onFormDataChange}
          onSave={onSave}
          onCancel={onCancel}
          isEditing={isEditing}
        />
      );

    // Generic form for steps category
    default:
      return (
        <GenericSettingForm
          category={category}
          formData={formData}
          onFormDataChange={onFormDataChange}
          onSave={onSave}
          onCancel={onCancel}
          isEditing={isEditing}
        />
      );
  }
}

// Generic form component for less complex categories
function GenericSettingForm({ 
  category, 
  formData, 
  onFormDataChange, 
  onSave, 
  onCancel, 
  isEditing 
}: {
  category: string;
  formData: any;
  onFormDataChange: (data: any) => void;
  onSave: () => void;
  onCancel: () => void;
  isEditing: boolean;
}) {
  const getCategoryInfo = (cat: string) => {
    switch (cat) {
      case 'steps':
        return { 
          icon: Settings2, 
          title: 'Application Step', 
          description: 'Configure application step settings' 
        };
      case 'fields':
        return { 
          icon: FileText, 
          title: 'Form Field', 
          description: 'Configure form field properties' 
        };
      case 'reference':
        return { 
          icon: FileText, 
          title: 'Reference Setting', 
          description: 'Configure reference requirements' 
        };
      default:
        return { 
          icon: Settings2, 
          title: 'Setting', 
          description: 'Configure setting' 
        };
    }
  };

  const { icon: Icon, title, description } = getCategoryInfo(category);

  return (
    <Card className="border-dashed border-primary/20 bg-gradient-to-br from-background to-muted/20">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border/50">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="setting_key" className="text-sm font-medium">Setting Key</Label>
              <Input
                id="setting_key"
                value={formData.setting_key}
                onChange={(e) => onFormDataChange({ ...formData, setting_key: e.target.value })}
                placeholder="Enter setting key"
                className="mt-2"
              />
            </div>
            
            <div>
              <Label htmlFor="display_order" className="text-sm font-medium">Display Order</Label>
              <Input
                id="display_order"
                type="number"
                min="0"
                value={formData.display_order}
                onChange={(e) => onFormDataChange({
                  ...formData,
                  display_order: parseInt(e.target.value) || 0
                })}
                className="mt-2"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="setting_value" className="text-sm font-medium">Setting Value (JSON)</Label>
              <Textarea
                id="setting_value"
                value={JSON.stringify(formData.setting_value, null, 2)}
                onChange={(e) => {
                  try {
                    onFormDataChange({ ...formData, setting_value: JSON.parse(e.target.value) });
                  } catch (error) {
                    // Invalid JSON, keep the raw value
                  }
                }}
                placeholder='{"key": "value"}'
                rows={4}
                className="mt-2"
              />
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

        <div className="flex gap-3 pt-4">
          <Button onClick={onSave} className="flex-1">
            {isEditing ? 'Update Setting' : 'Create Setting'}
          </Button>
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
