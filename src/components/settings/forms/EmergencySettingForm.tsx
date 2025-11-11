import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone } from "lucide-react";

interface EmergencySettingFormProps {
  formData: {
    setting_key: string;
    setting_value: {
      value?: string;
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

const emergencySettingTypes = [
  { value: 'relationship', label: 'Relationship Type' },
  { value: 'contact_type', label: 'Contact Type' },
];

export function EmergencySettingForm({ 
  formData, 
  onFormDataChange, 
  onSave, 
  onCancel, 
  isEditing 
}: EmergencySettingFormProps) {
  const updateEmergencyValue = (field: string, value: string) => {
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
            <Phone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Emergency Contact Option</h3>
            <p className="text-sm text-muted-foreground">Add options for emergency contact fields</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="setting_type" className="text-sm font-medium">Setting Type</Label>
              <Select
                value={formData.setting_type || ''}
                onValueChange={(value) => onFormDataChange({
                  ...formData,
                  setting_type: value
                })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select a setting type" />
                </SelectTrigger>
                <SelectContent>
                  {emergencySettingTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="option_value" className="text-sm font-medium">Option Value</Label>
              <Input
                id="option_value"
                value={formData.setting_value.value || ''}
                onChange={(e) => {
                  updateEmergencyValue('value', e.target.value);
                  onFormDataChange({
                    ...formData,
                    setting_key: `${formData.setting_type || 'option'}_${e.target.value}`
                  });
                }}
                placeholder="e.g., Spouse, Parent, Phone, Email, etc."
                className="mt-2"
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
            {isEditing ? 'Update Option' : 'Create Option'}
          </Button>
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}