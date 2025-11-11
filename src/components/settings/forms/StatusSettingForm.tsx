import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flag } from "lucide-react";

interface StatusSettingFormProps {
  formData: {
    setting_key: string;
    setting_value: {
      status_name?: string;
      status_label?: string;
      status_color?: string;
      is_default?: boolean;
    };
    display_order: number;
    is_active: boolean;
  };
  onFormDataChange: (data: any) => void;
  onSave: () => void;
  onCancel: () => void;
  isEditing: boolean;
}

const predefinedColors = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Yellow', value: '#f59e0b' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Gray', value: '#64748b' },
  { name: 'Orange', value: '#f97316' },
];

export function StatusSettingForm({ 
  formData, 
  onFormDataChange, 
  onSave, 
  onCancel, 
  isEditing 
}: StatusSettingFormProps) {
  const updateStatusValue = (field: string, value: any) => {
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
            <Flag className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Application Status</h3>
            <p className="text-sm text-muted-foreground">Configure status options for job applications</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="status_name" className="text-sm font-medium">Status Name</Label>
              <Input
                id="status_name"
                value={formData.setting_value.status_name || ''}
                onChange={(e) => {
                  updateStatusValue('status_name', e.target.value);
                  onFormDataChange({
                    ...formData,
                    setting_key: e.target.value
                  });
                }}
                placeholder="e.g., under_review"
                className="mt-2"
              />
            </div>
            
            <div>
              <Label htmlFor="status_label" className="text-sm font-medium">Display Label</Label>
              <Input
                id="status_label"
                value={formData.setting_value.status_label || ''}
                onChange={(e) => updateStatusValue('status_label', e.target.value)}
                placeholder="e.g., Under Review"
                className="mt-2"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Status Color</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {predefinedColors.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => updateStatusValue('status_color', color.value)}
                    className={`w-8 h-8 rounded-md border-2 transition-all ${
                      formData.setting_value.status_color === color.value
                        ? 'border-primary scale-110'
                        : 'border-border hover:border-primary/50'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
              <Input
                type="color"
                value={formData.setting_value.status_color || '#64748b'}
                onChange={(e) => updateStatusValue('status_color', e.target.value)}
                className="mt-2 h-10"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={formData.setting_value.is_default || false}
                onCheckedChange={(checked) => updateStatusValue('is_default', checked)}
              />
              <Label className="text-sm font-medium">Default Status</Label>
            </div>
          </div>
        </div>

        {formData.setting_value.status_label && (
          <div className="p-4 bg-muted/50 rounded-lg border">
            <Label className="text-sm font-medium mb-2 block">Preview</Label>
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: formData.setting_value.status_color || '#64748b' }}
              />
              <span className="text-sm">{formData.setting_value.status_label}</span>
              {formData.setting_value.is_default && <Badge variant="secondary">Default</Badge>}
            </div>
          </div>
        )}

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
            {isEditing ? 'Update Status' : 'Create Status'}
          </Button>
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}