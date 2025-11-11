import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Save, Send, Signature } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SignatureCanvas from 'react-signature-canvas';

interface CareWorkerStatement {
  id: string;
  care_worker_name: string;
  client_name: string;
  client_address: string;
  report_date: string;
  statement: string | null;
  person_completing_report: string | null;
  position: string | null;
  digital_signature: string | null;
  completion_date: string | null;
  status: string;
  rejection_reason?: string | null;
}

interface CareWorkerStatementFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statement?: CareWorkerStatement | null;
  onSuccess: () => void;
  readOnly?: boolean;
}

export function CareWorkerStatementForm({ 
  open, 
  onOpenChange, 
  statement, 
  onSuccess,
  readOnly = false
}: CareWorkerStatementFormProps) {
  const [loading, setLoading] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const signatureRef = useRef<SignatureCanvas>(null);
  
  const [formData, setFormData] = useState({
    care_worker_name: "",
    client_name: "",
    client_address: "",
    report_date: new Date(),
    statement: "",
    person_completing_report: "",
    position: "",
    completion_date: new Date(),
    digital_signature: "",
  });

  const { toast } = useToast();

  useEffect(() => {
    if (statement && open) {
      setFormData({
        care_worker_name: statement.care_worker_name,
        client_name: statement.client_name,
        client_address: statement.client_address,
        report_date: new Date(statement.report_date),
        statement: statement.statement || "",
        person_completing_report: statement.person_completing_report || statement.care_worker_name,
        position: statement.position || "Support Worker",
        completion_date: statement.completion_date ? new Date(statement.completion_date) : new Date(),
        digital_signature: statement.digital_signature || "",
      });
    }
  }, [statement, open]);

  const handleSaveSignature = () => {
    if (signatureRef.current) {
      const signatureData = signatureRef.current.toDataURL();
      setFormData({ ...formData, digital_signature: signatureData });
      setShowSignature(false);
      toast({
        title: "Success",
        description: "Signature saved successfully",
      });
    }
  };

  const clearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
    }
  };

  const handleSubmit = async (e: React.FormEvent, saveAsDraft = false) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!statement) {
        toast({
          title: "Error",
          description: "No statement to update",
          variant: "destructive",
        });
        return;
      }

      const updateData = {
        statement: formData.statement,
        person_completing_report: formData.person_completing_report,
        position: formData.position,
        digital_signature: formData.digital_signature,
        completion_date: formData.completion_date.toISOString().split('T')[0],
        status: saveAsDraft ? 'draft' : 'submitted',
      };

      const { error } = await supabase
        .from('care_worker_statements')
        .update(updateData)
        .eq('id', statement.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: saveAsDraft ? "Statement saved as draft" : "Statement submitted successfully",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving statement:', error);
      toast({
        title: "Error",
        description: "Failed to save statement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!statement) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6 [&>button]:bg-red-500 [&>button]:text-white [&>button]:hover:bg-red-600 [&>button]:transition-colors">
        <DialogHeader>
          <DialogTitle>
            Care Worker Statement - {statement.care_worker_name}
            {readOnly && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                (Read Only)
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Care Worker & Client Details Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Care Worker & Client Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Care Worker Name</Label>
                <Input value={formData.care_worker_name} disabled className="bg-muted" />
              </div>
              <div>
                <Label>Client Name</Label>
                <Input value={formData.client_name} disabled className="bg-muted" />
              </div>
              <div className="sm:col-span-2">
                <Label>Client Address</Label>
                <Input value={formData.client_address} disabled className="bg-muted" />
              </div>
              <div>
                <Label>Report Date</Label>
                <Input value={format(formData.report_date, "PPP")} disabled className="bg-muted" />
              </div>
              <div>
                <Label htmlFor="person_completing_report">Person Completing Report</Label>
                <Input
                  id="person_completing_report"
                  value={formData.person_completing_report}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={formData.position}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
          </div>

          {/* Statement Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Statement</h3>
            <div>
              <Label htmlFor="statement">Care Worker Statement</Label>
              <Textarea
                id="statement"
                placeholder="Enter your detailed statement here..."
                value={formData.statement}
                onChange={(e) => setFormData({ ...formData, statement: e.target.value })}
                rows={8}
                disabled={readOnly}
                required
              />
            </div>
          </div>

          {/* Signature & Confirmation Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Signature & Confirmation</h3>
            
            <div>
              <Label>Completion Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.completion_date && "text-muted-foreground"
                    )}
                    disabled={readOnly}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.completion_date ? format(formData.completion_date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.completion_date}
                    onSelect={(date) => setFormData({ ...formData, completion_date: date || new Date() })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Digital Signature */}
            <div className="space-y-3">
              <Label>Digital Signature</Label>
              {formData.digital_signature ? (
                <div className="space-y-3">
                  <div className="border rounded-lg p-4 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20">
                    <img 
                      src={formData.digital_signature} 
                      alt="Digital signature" 
                      className="max-h-32 mx-auto"
                    />
                  </div>
                  {!readOnly && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowSignature(true)}
                      className="w-full sm:w-auto bg-gradient-to-r from-violet-500 to-purple-500 text-white border-0 hover:from-violet-600 hover:to-purple-600"
                    >
                      <Signature className="mr-2 h-4 w-4" />
                      Update Signature
                    </Button>
                  )}
                </div>
              ) : (
                !readOnly && (
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setShowSignature(true)}
                    className="w-full sm:w-auto bg-gradient-to-r from-violet-500 to-purple-500 text-white border-0 hover:from-violet-600 hover:to-purple-600"
                  >
                    <Signature className="mr-2 h-4 w-4" />
                    Add Digital Signature
                  </Button>
                )
              )}
            </div>

            {/* Signature Canvas Modal */}
            {showSignature && !readOnly && (
              <Dialog open={showSignature} onOpenChange={setShowSignature}>
                <DialogContent className="w-[95vw] max-w-lg p-4 sm:p-6">
                  <DialogHeader>
                    <DialogTitle className="text-center bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                      Digital Signature
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="border-2 border-violet-200 rounded-lg overflow-hidden bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20">
                      <SignatureCanvas
                        ref={signatureRef}
                        canvasProps={{
                          width: Math.min(450, window.innerWidth - 80),
                          height: 200,
                          className: 'signature-canvas w-full'
                        }}
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:justify-between">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={clearSignature}
                        className="w-full sm:w-auto"
                      >
                        Clear
                      </Button>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setShowSignature(false)}
                          className="w-full sm:w-auto"
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="button" 
                          onClick={handleSaveSignature}
                          className="w-full sm:w-auto bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
                        >
                          Save Signature
                        </Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Rejection Reason (if applicable) */}
          {statement.status === 'rejected' && statement.rejection_reason && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-red-600">Rejection Reason</h3>
              <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                <p className="text-red-800">{statement.rejection_reason}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!readOnly && (
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto bg-gradient-to-r from-red-500 to-rose-500 text-white border-0 hover:from-red-600 hover:to-rose-600"
              >
                Cancel
              </Button>
              
              <Button 
                type="button" 
                variant="outline"
                onClick={(e) => handleSubmit(e, true)}
                disabled={loading}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 hover:from-blue-600 hover:to-cyan-600"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </Button>
              
              <Button 
                type="button"
                onClick={(e) => handleSubmit(e, false)}
                disabled={loading || !formData.digital_signature || !formData.statement}
                className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 hover:from-green-600 hover:to-emerald-600"
              >
                <Send className="mr-2 h-4 w-4" />
                Complete Statement
              </Button>
            </div>
          )}

          {readOnly && (
            <div className="flex justify-end pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}