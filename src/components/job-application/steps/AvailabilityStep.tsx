import { Availability } from '../types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { useUnifiedJobApplicationSettings, transformShiftSettings } from '@/hooks/queries/useUnifiedJobApplicationSettings';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AvailabilityStepProps {
  data: Availability;
  updateData: (field: keyof Availability, value: string | Record<string, string[]>) => void;
}

interface TimeSlot {
  id: string;
  name: string;
  label: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface RightToWorkSetting {
  id: string;
  setting_type: string;
  setting_value: { value: string };
  is_active: boolean;
}

const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

export function AvailabilityStep({ data, updateData }: AvailabilityStepProps) {
  const { data: shiftSettings, isLoading } = useUnifiedJobApplicationSettings('shift');
  const [rightToWorkOptions, setRightToWorkOptions] = useState<string[]>([]);
  
  const timeSlots = shiftSettings ? transformShiftSettings(shiftSettings) : [];

  useEffect(() => {
    fetchRightToWorkSettings();
  }, []);

  const fetchRightToWorkSettings = async () => {
    const { data: settings } = await supabase
      .from('job_application_settings')
      .select('*')
      .eq('category', 'personal')
      .eq('setting_type', 'right_to_work')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (settings) {
      setRightToWorkOptions(settings.map(s => {
        const value = s.setting_value as { value: string };
        return value.value;
      }));
    }
  };

  const handleDayToggle = (timeSlotId: string, day: string, checked: boolean) => {
    const currentTimeSlots = data.timeSlots || {};
    const currentDays = currentTimeSlots[timeSlotId] || [];
    
    let updatedDays: string[];
    if (checked) {
      updatedDays = [...currentDays, day];
    } else {
      updatedDays = currentDays.filter(d => d !== day);
    }
    
    const updatedTimeSlots = {
      ...currentTimeSlots,
      [timeSlotId]: updatedDays
    };
    
    updateData('timeSlots', updatedTimeSlots);
  };

  if (isLoading) {
    return <div>Loading time slot options...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Availability</h3>
        <p className="text-muted-foreground mb-6">Please Specify What Days And Time You Are Available To Work (You May Choose More Than One Shift Pattern).</p>
      </div>

      <div className="space-y-6">
        {timeSlots.map(timeSlot => (
          <div key={timeSlot.id} className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-foreground">{timeSlot.label}</h4>
              </div>
              <div className="flex-shrink-0">
                <span className="inline-flex items-center px-3 py-1 rounded-md bg-muted text-sm font-medium text-muted-foreground">
                  {timeSlot.start_time} - {timeSlot.end_time}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
              {DAYS_OF_WEEK.map(day => (
                <div key={`${timeSlot.id}-${day}`} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <Checkbox
                    id={`${timeSlot.id}-${day}`}
                    checked={data.timeSlots?.[timeSlot.id]?.includes(day) || false}
                    onCheckedChange={(checked) => handleDayToggle(timeSlot.id, day, checked === true)}
                    className="h-5 w-5"
                  />
                  <Label 
                    htmlFor={`${timeSlot.id}-${day}`} 
                    className="text-sm font-medium cursor-pointer flex-1 min-h-[44px] flex items-center"
                  >
                    {day}
                  </Label>
                </div>
              ))}
            </div>
            
            {timeSlot.id !== timeSlots[timeSlots.length - 1]?.id && (
              <div className="border-b border-border"></div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div>
          <Label htmlFor="hoursPerWeek">How many hours per week are you willing to work? *</Label>
          <Input
            id="hoursPerWeek"
            type="number"
            value={data.hoursPerWeek}
            onChange={(e) => updateData('hoursPerWeek', e.target.value)}
            placeholder="Hours"
            min="1"
            max="168"
            required
          />
        </div>

        <div>
          <Label htmlFor="hasRightToWork">Do you have current right to live and work in the UK? *</Label>
          <Select value={data.hasRightToWork} onValueChange={(value) => updateData('hasRightToWork', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {rightToWorkOptions.map(option => (
                <SelectItem key={option.toLowerCase()} value={option.toLowerCase()}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}