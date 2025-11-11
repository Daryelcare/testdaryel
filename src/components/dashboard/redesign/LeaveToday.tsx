import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LeaveEntry {
  employee_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
}

interface LeaveTodayProps {
  leaves: LeaveEntry[];
}

export function LeaveToday({ leaves }: LeaveTodayProps) {
  const today = new Date().toISOString().split('T')[0];
  const endOfWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const todayLeaves = leaves.filter(
    leave => leave.start_date <= today && leave.end_date >= today
  );

  const thisWeekLeaves = leaves.filter(
    leave => leave.start_date <= endOfWeek && leave.end_date >= today
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Who's on Leave</CardTitle>
        <Calendar className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="text-2xl font-bold text-foreground">{todayLeaves.length}</div>
            <p className="text-xs text-muted-foreground">on leave today</p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">This Week</span>
              <Badge variant="secondary" className="text-xs">{thisWeekLeaves.length}</Badge>
            </div>
            
            <ScrollArea className="h-[200px] pr-2">
              <div className="space-y-2">
                {thisWeekLeaves.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No leaves this week</p>
                ) : (
                  thisWeekLeaves.map((leave, index) => (
                    <div
                      key={index}
                      className="flex items-start space-x-2 rounded-lg border border-border p-2 hover:bg-accent/50 transition-colors"
                    >
                      <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium text-foreground leading-none">
                          {leave.employee_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {leave.leave_type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
