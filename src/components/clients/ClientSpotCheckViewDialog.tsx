import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ClientSpotCheckRecord {
  id: string;
  service_user_name: string;
  date: string;
  performed_by: string;
  observations: Array<{
    label: string;
    value: string;
    comments?: string;
  }>;
}

interface Client {
  id: string;
  name: string;
  branches?: {
    name: string;
  };
}

interface ClientSpotCheckViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  spotCheckRecord: ClientSpotCheckRecord | null;
}

export function ClientSpotCheckViewDialog({
  open,
  onOpenChange,
  client,
  spotCheckRecord
}: ClientSpotCheckViewDialogProps) {
  if (!client || !spotCheckRecord) return null;

  const getRatingBadge = (value: string) => {
    const normalizedValue = value?.toLowerCase();
    switch (normalizedValue) {
      case 'excellent':
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case 'very_good':
      case 'very good':
        return "bg-green-100 text-green-800 border-green-200";
      case 'good':
        return "bg-lime-100 text-lime-800 border-lime-200";
      case 'fair':
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case 'poor':
        return "bg-red-100 text-red-800 border-red-200";
      case 'not_applicable':
      case 'n/a':
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getRatingText = (value: string) => {
    switch (value?.toLowerCase()) {
      case 'very_good':
        return 'Very Good';
      case 'not_applicable':
        return 'N/A';
      default:
        return value?.charAt(0).toUpperCase() + value?.slice(1) || 'Not Rated';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-muted-foreground" />
            <DialogTitle className="text-lg font-semibold">
              Compliance Record Details
            </DialogTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-muted"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>
        
        <div className="text-sm text-muted-foreground mb-6">
          View details for this compliance record.
        </div>
        
        <div className="space-y-6">
          {/* Client and Branch Row */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Client</div>
              <div className="text-base font-semibold text-foreground">{client.name}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Branch</div>
              <div className="text-base text-foreground">{client.branches?.name || 'Unassigned'}</div>
            </div>
          </div>
          
          {/* Period and Status Row */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Period</div>
              <div className="text-base text-foreground">{spotCheckRecord.date ? (() => {
                const date = new Date(spotCheckRecord.date);
                const year = date.getFullYear();
                const quarter = Math.ceil((date.getMonth() + 1) / 3);
                return `${year}-Q${quarter}`;
              })() : 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Status</div>
              <Badge className="bg-success/10 text-success border-success/20">
                Compliant
              </Badge>
            </div>
          </div>
          
          {/* Completion Date and Created Row */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Completion Date</div>
              <div className="text-base text-foreground">{spotCheckRecord.date || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Created</div>
              <div className="text-base text-foreground">{spotCheckRecord.date || 'N/A'}</div>
            </div>
          </div>
          
          {/* Service User Name */}
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-1">Service User Name</div>
            <div className="text-base text-foreground">{spotCheckRecord.service_user_name}</div>
          </div>
          
          {/* Completed By */}
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-1">Completed By</div>
            <div className="text-base text-foreground">{spotCheckRecord.performed_by}</div>
          </div>
          
          {/* Assessment Summary */}
          {spotCheckRecord.observations && spotCheckRecord.observations.length > 0 && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Assessment Summary</div>
              <div className="text-sm text-foreground">
                {spotCheckRecord.observations.length} assessment question{spotCheckRecord.observations.length !== 1 ? 's' : ''} completed
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}