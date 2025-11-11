import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const leaveRequestSchema = z.object({
  leave_type_id: z.string().min(1, 'Please select a leave type'),
  start_date: z.date({
    required_error: 'Please select a start date',
  }),
  end_date: z.date({
    required_error: 'Please select an end date',
  }),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.start_date && data.end_date) {
    return data.end_date >= data.start_date;
  }
  return true;
}, {
  message: "End date must be the same or after start date",
  path: ["end_date"],
});

type LeaveRequestFormData = z.infer<typeof leaveRequestSchema>;

interface LeaveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  onSuccess: () => void;
}

export function LeaveRequestDialog({ open, onOpenChange, employeeId, onSuccess }: LeaveRequestDialogProps) {
  const [loading, setLoading] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { toast } = useToast();

  const form = useForm<LeaveRequestFormData>({
    resolver: zodResolver(leaveRequestSchema),
  });

  // Fetch leave types when dialog opens
  React.useEffect(() => {
    if (open) {
      fetchLeaveTypes();
    }
  }, [open]);

  const fetchLeaveTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_types')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setLeaveTypes(data || []);
    } catch (error) {
      console.error('Error fetching leave types:', error);
      toast({
        title: 'Error',
        description: 'Failed to load leave types',
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (data: LeaveRequestFormData) => {
    setLoading(true);
    try {
      // Format dates properly to avoid timezone issues
      const formatDateForDB = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const { error } = await supabase
        .from('leave_requests')
        .insert({
          employee_id: employeeId,
          leave_type_id: data.leave_type_id,
          start_date: formatDateForDB(data.start_date),
          end_date: formatDateForDB(data.end_date),
          notes: data.notes || null,
          status: 'pending',
        });

      if (error) throw error;

      // Show confirmation popup instead of success toast
      setShowConfirmation(true);
    } catch (error) {
      console.error('Error submitting leave request:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit leave request',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmationOk = () => {
    setShowConfirmation(false);
    
    // Reset form
    form.reset();
    
    // Close dialog and refresh
    onOpenChange(false);
    onSuccess();
    
    toast({
      title: "Success",
      description: "Leave request submitted successfully",
    });
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Holiday</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-1">
            <FormField
              control={form.control}
              name="leave_type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Leave Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select leave type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="z-50 bg-background">
                      {leaveTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full h-11 pl-3 text-left font-normal justify-start',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP')
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full h-11 pl-3 text-left font-normal justify-start',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP')
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Duration Display */}
            {form.watch('start_date') && form.watch('end_date') && (
              <div className="p-3 bg-secondary rounded-lg border border-border">
                <p className="text-sm text-muted-foreground">
                  Duration: <span className={`font-medium ${(() => {
                    const startDate = form.watch('start_date');
                    const endDate = form.watch('end_date');
                    if (startDate && endDate) {
                      return endDate < startDate ? 'text-destructive' : 'text-success';
                    }
                    return '';
                  })()}`}>
                    {(() => {
                      const startDate = form.watch('start_date');
                      const endDate = form.watch('end_date');
                      if (startDate && endDate) {
                        const diffTime = endDate.getTime() - startDate.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                        if (diffDays < 0) {
                          return `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} (Invalid: End date is before start date)`;
                        }
                        return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
                      }
                      return '0 days';
                    })()}
                  </span>
                </p>
                <div className="text-xs text-primary mt-1">
                  {form.watch('start_date') && form.watch('end_date') && (
                    <>From {form.watch('start_date')?.toLocaleDateString()} to {form.watch('end_date')?.toLocaleDateString()}</>
                  )}
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any additional information..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />


            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Leave Request Submitted</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-sm">
            <div className="p-3 bg-warning-soft border border-warning rounded-lg">
              <p className="font-medium text-warning mb-2">
                <strong>Important:</strong> Submitting this form does not guarantee approval. You must call the office to have your leave/holiday officially approved.
              </p>
              <p className="font-medium text-warning text-sm">
                <strong>Muhiim:</strong><br />
                Soo gudbinta fasaxan macnaheedu maaha in la ansixiyay fasaxa<br />
                Waa inaad so wacdaa xafiiska si aad fasaxaaga si rasmi ah loogu ogolaado.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleConfirmationOk}>
            OK
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
