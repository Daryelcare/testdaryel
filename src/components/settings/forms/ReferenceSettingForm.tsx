import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";

interface ReferenceSettingFormProps {
  formData: {
    setting_key: string;
    setting_value: {
      employment_based_text?: {
        employed?: {
          description?: string;
          minimum_employment_years?: number;
        };
        unemployed?: {
          description?: string;
        };
      };
      character_reference_text?: {
        description?: string;
      };
      minimum_references?: number;
      reference_types?: string[];
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

const referenceTypes = [
  { value: 'references_config', label: 'Reference Configuration' },
  { value: 'reference_type', label: 'Reference Type' },
];

export function ReferenceSettingForm({ 
  formData, 
  onFormDataChange, 
  onSave, 
  onCancel, 
  isEditing
}: ReferenceSettingFormProps) {
  const updateReferenceValue = (field: string, value: any) => {
    onFormDataChange({
      ...formData,
      setting_value: {
        ...formData.setting_value,
        [field]: value
      }
    });
  };

  const updateEmploymentText = (employmentType: 'employed' | 'unemployed', field: string, value: any) => {
    onFormDataChange({
      ...formData,
      setting_value: {
        ...formData.setting_value,
        employment_based_text: {
          ...formData.setting_value.employment_based_text,
          [employmentType]: {
            ...formData.setting_value.employment_based_text?.[employmentType],
            [field]: value
          }
        }
      }
    });
  };

  const updateCharacterText = (field: string, value: any) => {
    onFormDataChange({
      ...formData,
      setting_value: {
        ...formData.setting_value,
        character_reference_text: {
          ...formData.setting_value.character_reference_text,
          [field]: value
        }
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
            <h3 className="font-semibold text-lg">Reference Settings</h3>
            <p className="text-sm text-muted-foreground">Configure reference requirements and descriptions</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="setting_type" className="text-sm font-medium">Reference Type</Label>
              <Select
                value={formData.setting_type || ''}
                onValueChange={(value) => {
                  onFormDataChange({
                    ...formData,
                    setting_type: value,
                    setting_key: value
                  });
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select reference type" />
                </SelectTrigger>
                <SelectContent>
                  {referenceTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <div>
              <Label htmlFor="minimum_references" className="text-sm font-medium">Minimum References Required</Label>
              <Input
                id="minimum_references"
                type="number"
                min="1"
                max="10"
                value={formData.setting_value.minimum_references || 2}
                onChange={(e) => updateReferenceValue('minimum_references', parseInt(e.target.value) || 2)}
                className="mt-2"
              />
            </div>
          </div>

          {/* Employment-based reference settings */}
          <div className="space-y-4">
            <h4 className="font-medium text-base">Employment-Based References</h4>
            
            <div>
              <Label htmlFor="employed_description" className="text-sm font-medium">Description for Employed Applicants</Label>
              <Textarea
                id="employed_description"
                value={formData.setting_value.employment_based_text?.employed?.description || ''}
                onChange={(e) => updateEmploymentText('employed', 'description', e.target.value)}
                placeholder="Instructions for applicants who are currently employed"
                className="mt-2"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="minimum_employment_years" className="text-sm font-medium">Minimum Employment Years</Label>
              <Input
                id="minimum_employment_years"
                type="number"
                min="0"
                max="10"
                value={formData.setting_value.employment_based_text?.employed?.minimum_employment_years || 2}
                onChange={(e) => updateEmploymentText('employed', 'minimum_employment_years', parseInt(e.target.value) || 2)}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="unemployed_description" className="text-sm font-medium">Description for Unemployed Applicants</Label>
              <Textarea
                id="unemployed_description"
                value={formData.setting_value.employment_based_text?.unemployed?.description || ''}
                onChange={(e) => updateEmploymentText('unemployed', 'description', e.target.value)}
                placeholder="Instructions for applicants who are currently unemployed"
                className="mt-2"
                rows={3}
              />
            </div>
          </div>

          {/* Character reference settings */}
          <div className="space-y-4">
            <h4 className="font-medium text-base">Character References</h4>
            
            <div>
              <Label htmlFor="character_description" className="text-sm font-medium">Character Reference Description</Label>
              <Textarea
                id="character_description"
                value={formData.setting_value.character_reference_text?.description || ''}
                onChange={(e) => updateCharacterText('description', e.target.value)}
                placeholder="Instructions for character references"
                className="mt-2"
                rows={3}
              />
            </div>
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

        <div className="flex gap-3 pt-4">
          <Button onClick={onSave} className="flex-1">
            {isEditing ? 'Update Reference Setting' : 'Create Reference Setting'}
          </Button>
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}