import { Activity, Calendar, FileText, Shield, Users, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  user: string;
}

interface ActivityTimelineProps {
  activities: ActivityItem[];
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case "employee": return Users;
      case "document": return FileText;
      case "compliance": return Shield;
      default: return Activity;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case "employee": return "text-blue-600 bg-blue-500/10";
      case "document": return "text-purple-600 bg-purple-500/10";
      case "compliance": return "text-orange-600 bg-orange-500/10";
      default: return "text-gray-600 bg-gray-500/10";
    }
  };

  return (
    <div className="card-premium p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
          <Clock className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Recent Activity</h3>
          <p className="text-sm text-muted-foreground">Latest system updates</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative space-y-4 max-h-[520px] overflow-y-auto pr-2">
        {/* Timeline line */}
        <div className="absolute left-5 top-3 bottom-3 w-px bg-border"></div>

        {activities.map((activity, index) => {
          const Icon = getIcon(activity.type);
          const colorClass = getColor(activity.type);

          return (
            <div key={activity.id} className="relative flex gap-4 group">
              {/* Icon */}
              <div className={`relative z-10 w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center shrink-0 ring-4 ring-background`}>
                <Icon className="w-5 h-5" />
              </div>

              {/* Content */}
              <div className="flex-1 pb-4">
                <div className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <p className="text-sm font-medium">{activity.message}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-bold text-white">
                      {activity.user.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-xs text-muted-foreground">{activity.user}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
