import { Activity, Calendar, Shield, Users, FileText, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  type: "leave" | "compliance" | "document" | "employee";
  message: string;
  timestamp: string;
}

interface LiveActivityFeedProps {
  activities: ActivityItem[];
  isConnected: boolean;
}

export function LiveActivityFeed({ activities, isConnected }: LiveActivityFeedProps) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "leave": return Calendar;
      case "compliance": return Shield;
      case "employee": return Users;
      case "document": return FileText;
      default: return Activity;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "leave": return "text-primary bg-primary/10";
      case "compliance": return "text-warning bg-warning/10";
      case "employee": return "text-success bg-success/10";
      case "document": return "text-destructive bg-destructive/10";
      default: return "text-muted-foreground bg-muted";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Live Activity Feed</h3>
            <p className="text-sm text-muted-foreground">Real-time system updates</p>
          </div>
        </div>
        <Badge 
          variant={isConnected ? "default" : "secondary"}
          className={cn(
            "flex items-center gap-2",
            isConnected && "animate-pulse"
          )}
        >
          <div className={cn(
            "w-2 h-2 rounded-full",
            isConnected ? "bg-success" : "bg-muted-foreground"
          )} />
          {isConnected ? "Live" : "Offline"}
        </Badge>
      </div>

      {/* Activity list */}
      <div className="space-y-2">
        {activities.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          activities.map((activity, index) => {
            const Icon = getActivityIcon(activity.type);
            const colorClass = getActivityColor(activity.type);
            
            return (
              <div
                key={activity.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-all cursor-pointer group",
                  "animate-fade-in"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", colorClass)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">
                    {activity.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
