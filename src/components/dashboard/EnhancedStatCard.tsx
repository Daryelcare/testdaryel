import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface EnhancedStatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  trend?: {
    value: number;
    direction: "up" | "down";
    label: string;
  };
  sparklineData?: number[];
  variant?: "default" | "success" | "warning" | "danger";
}

export function EnhancedStatCard({
  title,
  value,
  icon: Icon,
  trend,
  sparklineData = [30, 40, 35, 50, 49, 60, 70],
  variant = "default"
}: EnhancedStatCardProps) {
  const [displayValue, setDisplayValue] = useState(0);

  // Animated counter
  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 1000;
    const increment = end / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  const variantStyles = {
    default: "from-primary/5 to-primary/10 border-primary/20",
    success: "from-success/5 to-success/10 border-success/20",
    warning: "from-warning/5 to-warning/10 border-warning/20",
    danger: "from-destructive/5 to-destructive/10 border-destructive/20"
  };

  const iconStyles = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive"
  };

  const max = Math.max(...sparklineData);
  const min = Math.min(...sparklineData);

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-xl border bg-gradient-to-br p-6 transition-all hover:shadow-lg hover:scale-[1.02]",
      variantStyles[variant]
    )}>
      {/* Sparkline background */}
      <div className="absolute bottom-0 right-0 w-full h-20 opacity-20">
        <svg className="w-full h-full" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            points={sparklineData
              .map((point, i) => {
                const x = (i / (sparklineData.length - 1)) * 100;
                const y = 100 - ((point - min) / (max - min)) * 100;
                return `${x},${y}`;
              })
              .join(" ")}
          />
        </svg>
      </div>

      <div className="relative space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110",
            iconStyles[variant]
          )}>
            <Icon className="w-6 h-6" />
          </div>

          {trend && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
              trend.direction === "up" 
                ? "bg-success/10 text-success" 
                : "bg-destructive/10 text-destructive"
            )}>
              {trend.direction === "up" ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {trend.value}%
            </div>
          )}
        </div>

        {/* Value */}
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tabular-nums">
            {displayValue.toLocaleString()}
          </p>
        </div>

        {/* Trend label */}
        {trend && (
          <p className="text-xs text-muted-foreground">
            {trend.label}
          </p>
        )}
      </div>

      {/* Hover glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
    </div>
  );
}
