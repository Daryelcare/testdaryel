import { Calendar, Clock, Target, GraduationCap } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface Event {
  id: string;
  title: string;
  date: string;
  type: string;
}

interface UpcomingEventsProps {
  events: Event[];
}

export function UpcomingEvents({ events }: UpcomingEventsProps) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case "training": return GraduationCap;
      case "deadline": return Target;
      case "review": return Calendar;
      default: return Clock;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case "training": return "text-blue-600 bg-blue-500/10 border-blue-500/20";
      case "deadline": return "text-red-600 bg-red-500/10 border-red-500/20";
      case "review": return "text-purple-600 bg-purple-500/10 border-purple-500/20";
      default: return "text-gray-600 bg-gray-500/10 border-gray-500/20";
    }
  };

  return (
    <div className="card-premium p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Upcoming Events</h3>
          <p className="text-sm text-muted-foreground">Next 7 days</p>
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {events.map((event) => {
          const Icon = getEventIcon(event.type);
          const colorClass = getEventColor(event.type);
          const eventDate = new Date(event.date);

          return (
            <div
              key={event.id}
              className="group p-4 rounded-lg border border-border hover:border-primary/30 bg-card hover:bg-muted/50 transition-all cursor-pointer"
            >
              <div className="flex gap-3">
                <div className={`w-12 h-12 rounded-lg ${colorClass} flex items-center justify-center shrink-0 border`}>
                  <Icon className="w-6 h-6" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-medium group-hover:text-primary transition-colors">
                      {event.title}
                    </h4>
                    <Badge variant="secondary" className="text-xs">
                      {event.type}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {format(eventDate, 'MMM d, yyyy')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDistanceToNow(eventDate, { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* View Calendar */}
      <button className="w-full py-3 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors">
        View full calendar
      </button>
    </div>
  );
}
