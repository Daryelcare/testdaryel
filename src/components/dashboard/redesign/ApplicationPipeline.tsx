import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ApplicationStats {
  [key: string]: number;
}

interface ApplicationPipelineProps {
  stats: ApplicationStats;
}

export function ApplicationPipeline({ stats }: ApplicationPipelineProps) {
  const total = Object.values(stats).reduce((sum, count) => sum + count, 0);

  const getStatusLabel = (status: string) => {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getStatusColor = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'new') return 'bg-primary/10 text-primary border-primary/20';
    if (lowerStatus === 'reviewing' || lowerStatus === 'in review') return 'bg-info/10 text-info border-info/20';
    if (lowerStatus === 'interviewed') return 'bg-warning/10 text-warning border-warning/20';
    if (lowerStatus === 'accepted') return 'bg-success/10 text-success border-success/20';
    if (lowerStatus === 'rejected') return 'bg-destructive/10 text-destructive border-destructive/20';
    return 'bg-muted text-muted-foreground border-border';
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Application Pipeline</CardTitle>
        <Briefcase className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="text-2xl font-bold text-foreground">{total}</div>
            <p className="text-xs text-muted-foreground">total applications</p>
          </div>

          <div className="space-y-2">
            {Object.entries(stats).map(([status, count]) => (
              <div
                key={status}
                className="flex items-center justify-between rounded-lg border border-border p-2 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${getStatusColor(status).split(' ')[0].replace('bg-', 'bg-')}`} />
                  <span className="text-sm font-medium text-foreground">
                    {getStatusLabel(status)}
                  </span>
                </div>
                <Badge className={getStatusColor(status)}>
                  {count}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
