import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

interface ShiftSettingFormProps {
  formData: {
    setting_key: string;
    setting_value: {
      name?: string;
      label?: string;
      start_time?: string;
      end_time?: string;
    };
    display_order: number;
    is_active: boolean;
  };
  onFormDataChange: (data: any) => void;
  onSave: () => void;
  onCancel: () => void;
  isEditing: boolean;
}

export function ShiftSettingForm({ 
  formData, 
  onFormDataChange, 
  onSave, 
  onCancel, 
  isEditing 
}: ShiftSettingFormProps) {
  const updateShiftValue = (field: string, value: string) => {
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
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Shift Configuration</h3>
            <p className="text-sm text-muted-foreground">Define work shift patterns for job applications</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="shift_name" className="text-sm font-medium">Shift Name</Label>
              <Input
                id="shift_name"
                value={formData.setting_value.name || ''}
                onChange={(e) => {
                  updateShiftValue('name', e.target.value);
                  onFormDataChange({
                    ...formData,
                    setting_key: e.target.value
                  });
                }}
                placeholder="e.g., Morning Shift"
                className="mt-2"
              />
            </div>
            
            <div>
              <Label htmlFor="shift_label" className="text-sm font-medium">Display Label</Label>
              <Input
                id="shift_label"
                value={formData.setting_value.label || ''}
                onChange={(e) => updateShiftValue('label', e.target.value)}
                placeholder="e.g., Morning (7:00 AM - 3:00 PM)"
                className="mt-2"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="start_time" className="text-sm font-medium">Start Time</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.setting_value.start_time || ''}
                onChange={(e) => updateShiftValue('start_time', e.target.value)}
                className="mt-2"
              />
            </div>
            
            <div>
              <Label htmlFor="end_time" className="text-sm font-medium">End Time</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.setting_value.end_time || ''}
                onChange={(e) => updateShiftValue('end_time', e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
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

        <div className="flex gap-3 pt-4">
          <Button onClick={onSave} className="flex-1">
            {isEditing ? 'Update Shift' : 'Create Shift'}
          </Button>
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}