import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Award } from "lucide-react";

interface SkillsSettingFormProps {
  formData: {
    setting_key: string;
    setting_value: {
      name?: string;
      description?: string;
      category_id?: string;
      id?: string;
    };
    setting_type?: string;
    display_order: number;
    is_active: boolean;
  };
  onFormDataChange: (data: any) => void;
  onSave: () => void;
  onCancel: () => void;
  isEditing: boolean;
  existingCategories?: Array<{ id: string; name: string; }>;
}

const skillSettingTypes = [
  { value: 'category', label: 'Skill Category' },
  { value: 'skill', label: 'Individual Skill' },
];

export function SkillsSettingForm({ 
  formData, 
  onFormDataChange, 
  onSave, 
  onCancel, 
  isEditing,
  existingCategories = []
}: SkillsSettingFormProps) {
  const updateSkillValue = (field: string, value: any) => {
    onFormDataChange({
      ...formData,
      setting_value: {
        ...formData.setting_value,
        [field]: value
      }
    });
  };

  const isCategory = formData.setting_type === 'category';

  return (
    <Card className="border-dashed border-primary/20 bg-gradient-to-br from-background to-muted/20">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border/50">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Award className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Skills & Categories</h3>
            <p className="text-sm text-muted-foreground">Manage skill categories and individual skills</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="setting_type" className="text-sm font-medium">Type</Label>
              <Select
                value={formData.setting_type || ''}
                onValueChange={(value) => {
                  onFormDataChange({
                    ...formData,
                    setting_type: value,
                    setting_value: value === 'category' 
                      ? { name: '', description: '', id: crypto.randomUUID() }
                      : { name: '', category_id: '' }
                  });
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {skillSettingTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="skill_name" className="text-sm font-medium">
                {isCategory ? 'Category Name' : 'Skill Name'}
              </Label>
              <Input
                id="skill_name"
                value={formData.setting_value.name || ''}
                onChange={(e) => {
                  updateSkillValue('name', e.target.value);
                  onFormDataChange({
                    ...formData,
                    setting_key: e.target.value
                  });
                }}
                placeholder={isCategory ? "e.g., Clinical Skills" : "e.g., Medication Administration"}
                className="mt-2"
              />
            </div>

            {isCategory && (
              <div>
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Textarea
                  id="description"
                  value={formData.setting_value.description || ''}
                  onChange={(e) => updateSkillValue('description', e.target.value)}
                  placeholder="Brief description of this skill category"
                  className="mt-2"
                  rows={3}
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            {!isCategory && (
              <div>
                <Label htmlFor="category" className="text-sm font-medium">Skill Category</Label>
                <Select
                  value={formData.setting_value.category_id || ''}
                  onValueChange={(value) => updateSkillValue('category_id', value)}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
            
            <div className="flex items-center gap-3 mt-6">
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
            {isEditing ? `Update ${isCategory ? 'Category' : 'Skill'}` : `Create ${isCategory ? 'Category' : 'Skill'}`}
          </Button>
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}