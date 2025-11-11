import { Users, Shield, UserCog, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

interface UserManagementMetricsProps {
  totalUsers: number;
  adminCount: number;
  userCount: number;
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
}

export function UserManagementMetrics({ 
  totalUsers, 
  adminCount,
  userCount,
  activeFilter,
  onFilterChange
}: UserManagementMetricsProps) {
  const metrics = [
    {
      label: "Total Users",
      value: totalUsers,
      icon: Users,
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
      textColor: "text-blue-600",
      filterValue: null
    },
    {
      label: "Administrators",
      value: adminCount,
      icon: Shield,
      color: "from-red-500 to-pink-500",
      bgColor: "bg-red-500/10",
      textColor: "text-red-600",
      filterValue: "admin"
    },
    {
      label: "Standard Users",
      value: userCount,
      icon: Users,
      color: "from-green-500 to-emerald-500",
      bgColor: "bg-green-500/10",
      textColor: "text-green-600",
      filterValue: "user"
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {metrics.map((metric, index) => (
        <MetricCard 
          key={index} 
          {...metric} 
          index={index} 
          isActive={activeFilter === metric.filterValue}
          onClick={() => onFilterChange(activeFilter === metric.filterValue ? null : metric.filterValue)}
        />
      ))}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  icon: any;
  color: string;
  bgColor: string;
  textColor: string;
  index: number;
  filterValue: string | null;
  isActive: boolean;
  onClick: () => void;
}

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
  textColor,
  index,
  isActive,
  onClick
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
    <button 
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl bg-card border p-6 hover:shadow-lg transition-all hover:scale-[1.02] animate-fade-in text-left w-full ${
        isActive ? 'border-primary ring-2 ring-primary/20' : 'border-border'
      }`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${color} transition-opacity ${
        isActive ? 'opacity-10' : 'opacity-0 group-hover:opacity-5'
      }`}></div>
      
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
            {displayValue.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground font-medium">
            {label}
          </div>
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

        {/* Active indicator */}
        {isActive && (
          <div className="mt-2 text-xs font-medium text-primary">
            ✓ Filtered
          </div>
        )}
      </div>
    </button>
  );
}
