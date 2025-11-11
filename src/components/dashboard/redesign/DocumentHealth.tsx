import { FileCheck, AlertCircle, FileX2, CheckCircle2 } from "lucide-react";

interface DocumentStats {
  total: number;
  valid: number;
  expiring: number;
  expired: number;
}

interface DocumentHealthProps {
  stats: DocumentStats;
}

export function DocumentHealth({ stats }: DocumentHealthProps) {
  const healthScore = stats.total > 0 ? Math.round((stats.valid / stats.total) * 100) : 0;

  const statusItems = [
    {
      label: "Valid",
      value: stats.valid,
      icon: CheckCircle2,
      color: "text-success",
      bgColor: "bg-success/10"
    },
    {
      label: "Expiring",
      value: stats.expiring,
      icon: AlertCircle,
      color: "text-warning",
      bgColor: "bg-warning/10"
    },
    {
      label: "Expired",
      value: stats.expired,
      icon: FileX2,
      color: "text-destructive",
      bgColor: "bg-destructive/10"
    }
  ];

  return (
    <div className="card-premium p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
          <FileCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Document Health</h3>
          <p className="text-sm text-muted-foreground">{stats.total} total documents</p>
        </div>
      </div>

      {/* Health Score Circle */}
      <div className="flex items-center justify-center">
        <div className="relative w-40 h-40">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="url(#healthGradient)"
              strokeWidth="8"
              strokeDasharray={`${(healthScore / 100) * 251.2} 251.2`}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
            <defs>
              <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-bold text-success">{healthScore}%</div>
            <div className="text-xs text-muted-foreground">Health Score</div>
          </div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="space-y-2">
        {statusItems.map((item) => (
          <div
            key={item.label}
            className={`flex items-center justify-between p-3 rounded-lg ${item.bgColor}`}
          >
            <div className="flex items-center gap-3">
              <item.icon className={`w-5 h-5 ${item.color}`} />
              <span className="text-sm font-medium">{item.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${item.color}`}>{item.value}</span>
              <span className="text-xs text-muted-foreground">
                ({stats.total > 0 ? Math.round((item.value / stats.total) * 100) : 0}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
