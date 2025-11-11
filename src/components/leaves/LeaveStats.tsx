
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, CheckCircle, XCircle } from "lucide-react";
import { Leave, StatusFilter } from "./types";

interface LeaveStatsProps {
  leaves: Leave[];
  onStatusFilter: (status: StatusFilter) => void;
}

export function LeaveStats({ leaves, onStatusFilter }: LeaveStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-slide-up">
      <Card 
        className="card-premium cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => onStatusFilter('all')}
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
              <p className="text-2xl font-bold">{leaves.length}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card 
        className="card-premium cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => onStatusFilter('pending')}
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">
                {leaves.filter(l => l.status === 'pending').length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-warning to-warning/80 flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card 
        className="card-premium cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => onStatusFilter('approved')}
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Approved</p>
              <p className="text-2xl font-bold">
                {leaves.filter(l => l.status === 'approved').length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-success to-success/80 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card 
        className="card-premium cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => onStatusFilter('rejected')}
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Rejected</p>
              <p className="text-2xl font-bold">
                {leaves.filter(l => l.status === 'rejected').length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-destructive to-destructive/80 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
