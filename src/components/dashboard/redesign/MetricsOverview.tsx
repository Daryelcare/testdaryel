import { Users, Briefcase, CheckCircle2, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

interface MetricsOverviewProps {
  totalEmployees: number;
  activeProjects: number;
  pendingTasks: number;
  completionRate: number;
  leavesByBranch?: Record<string, number>;
  complianceRates?: Record<string, number>;
}

export function MetricsOverview({ 
  totalEmployees, 
  activeProjects, 
  pendingTasks, 
  completionRate,
  leavesByBranch,
  complianceRates 
}: MetricsOverviewProps) {
  const leaveBreakdown = leavesByBranch 
    ? Object.entries(leavesByBranch)
        .map(([branch, count]) => `${branch} ${count}`)
        .join(', ')
    : '';

  const complianceBreakdown = complianceRates
    ? Object.entries(complianceRates)
        .map(([branch, rate]) => `${branch} ${rate}%`)
        .join(', ')
    : '';

  const metrics = [
    {
      label: "Total Employees",
      value: totalEmployees,
      icon: Users,
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
      textColor: "text-blue-600"
    },
    {
      label: "Total Clients",
      value: activeProjects,
      icon: Briefcase,
      color: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-500/10",
      textColor: "text-purple-600"
    },
    {
      label: "Pending Leaves",
      value: pendingTasks,
      icon: CheckCircle2,
      color: "from-orange-500 to-red-500",
      bgColor: "bg-orange-500/10",
      textColor: "text-orange-600",
      breakdown: leaveBreakdown
    },
    {
      label: "Completion Rate",
      value: completionRate,
      suffix: "%",
      icon: TrendingUp,
      color: "from-green-500 to-emerald-500",
      bgColor: "bg-green-500/10",
      textColor: "text-green-600",
      breakdown: complianceBreakdown
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metrics.map((metric, index) => (
        <MetricCard key={index} {...metric} index={index} />
      ))}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  suffix?: string;
  icon: any;
  color: string;
  bgColor: string;
  textColor: string;
  index: number;
  breakdown?: string;
}

function MetricCard({
  label,
  value,
  suffix = "",
  icon: Icon,
  color,
  bgColor,
  textColor,
  index,
  breakdown
}: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animated counter
    let start = 0;
    const duration = 1500;
    const increment = value / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);

    // Progress animation
    const progressTimer = setTimeout(() => {
      setProgress(85);
    }, index * 100);

    return () => {
      clearInterval(timer);
      clearTimeout(progressTimer);
    };
  }, [value, index]);

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-card border border-border p-6 hover:shadow-lg transition-all hover:scale-[1.02]">
      {/* Background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-5 transition-opacity`}></div>
      
      {/* Progress bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
        <div 
          className={`h-full bg-gradient-to-r ${color} transition-all duration-1000`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="relative space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${textColor}`} />
          </div>
        </div>

        {/* Value */}
        <div className="space-y-1">
          <div className="text-3xl font-bold tabular-nums">
            {displayValue.toLocaleString()}{suffix}
          </div>
          <div className="text-sm text-muted-foreground font-medium">
            {label}
          </div>
          {breakdown && (
            <div className="text-xs text-muted-foreground/70 mt-1">
              {breakdown}
            </div>
          )}
        </div>

        {/* Mini sparkline */}
        <svg className="w-full h-8 opacity-30" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={textColor}
            points="0,20 20,15 40,18 60,10 80,12 100,8"
          />
        </svg>
      </div>
    </div>
  );
}
