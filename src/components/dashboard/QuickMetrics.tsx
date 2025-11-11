import { Brain, Zap, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface QuickMetricsProps {
  metrics: {
    activeUsers: number;
    pendingApprovals: number;
    overdueCompliance: number;
    expiringDocuments: number;
  };
}

export function QuickMetrics({ metrics }: QuickMetricsProps) {
  const complianceRate = Math.max(0, 100 - (metrics.overdueCompliance * 10));
  const approvalRate = Math.max(0, 100 - (metrics.pendingApprovals * 5));

  return (
    <div className="space-y-6">
      {/* AI Insights Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">AI Insights</h3>
          <p className="text-sm text-muted-foreground">Smart analytics & recommendations</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3 p-4 rounded-lg bg-primary-soft border border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-primary">Compliance Rate</span>
            <CheckCircle2 className="w-4 h-4 text-primary" />
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-primary">{complianceRate}%</div>
            <Progress value={complianceRate} className="h-2" />
          </div>
        </div>

        <div className="space-y-3 p-4 rounded-lg bg-warning-soft border border-warning/20">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-warning">Approval Rate</span>
            <Zap className="w-4 h-4 text-warning" />
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-warning">{approvalRate}%</div>
            <Progress value={approvalRate} className="h-2 [&>div]:bg-warning" />
          </div>
        </div>
      </div>

      {/* Critical Alerts */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Critical Alerts
        </h4>

        {metrics.overdueCompliance > 0 && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-destructive-soft border border-destructive/20">
            <div>
              <p className="text-sm font-medium text-destructive">Overdue Compliance</p>
              <p className="text-xs text-muted-foreground">{metrics.overdueCompliance} tasks need attention</p>
            </div>
            <Badge variant="destructive">High</Badge>
          </div>
        )}

        {metrics.expiringDocuments > 0 && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-warning-soft border border-warning/20">
            <div>
              <p className="text-sm font-medium text-warning">Expiring Soon</p>
              <p className="text-xs text-muted-foreground">Next 7 days</p>
            </div>
            <Badge className="bg-warning text-white">{metrics.expiringDocuments}</Badge>
          </div>
        )}

        {metrics.pendingApprovals > 0 && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary-soft border border-primary/20">
            <div>
              <p className="text-sm font-medium text-primary">Pending Approvals</p>
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </div>
            <Badge variant="secondary">{metrics.pendingApprovals}</Badge>
          </div>
        )}

        {metrics.overdueCompliance === 0 && metrics.expiringDocuments === 0 && metrics.pendingApprovals === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success" />
            <p className="text-sm">All caught up! 🎉</p>
          </div>
        )}
      </div>

      {/* Active Users */}
      <div className="p-4 rounded-lg bg-muted/50 border border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Active Users</span>
          <div className="flex -space-x-2">
            {[...Array(Math.min(5, metrics.activeUsers))].map((_, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full bg-gradient-primary border-2 border-background flex items-center justify-center text-xs font-bold text-white"
              >
                {String.fromCharCode(65 + i)}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {metrics.activeUsers} users active in the last hour
        </p>
      </div>
    </div>
  );
}
