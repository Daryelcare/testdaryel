import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  variant?: "default" | "success" | "warning" | "danger";
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  variant = "default",
  trend,
  className
}: StatCardProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return {
          card: "border-success/20 bg-gradient-to-br from-success-soft to-card",
          icon: "bg-success text-white",
          trend: "text-success"
        };
      case "warning":
        return {
          card: "border-warning/20 bg-gradient-to-br from-warning-soft to-card",
          icon: "bg-warning text-white",
          trend: "text-warning"
        };
      case "danger":
        return {
          card: "border-destructive/20 bg-gradient-to-br from-destructive-soft to-card",
          icon: "bg-destructive text-white",
          trend: "text-destructive"
        };
      default:
        return {
          card: "border-primary/20 bg-gradient-to-br from-primary-soft to-card",
          icon: "bg-gradient-primary text-white",
          trend: "text-primary"
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div
      className={cn(
        "card-premium p-6 space-y-4 animate-fade-in",
        styles.card,
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
        </div>
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", styles.icon)}>
          <Icon className="w-6 h-6" />
        </div>
      </div>

      {(description || trend) && (
        <div className="space-y-1">
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1">
              <span className={cn("text-sm font-medium", styles.trend)}>
                {trend.value > 0 ? "+" : ""}{trend.value}%
              </span>
              <span className="text-sm text-muted-foreground">{trend.label}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}