import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface AnalyticsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    trend: 'up' | 'down' | 'neutral';
    period: string;
  };
  icon: LucideIcon;
  children?: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function AnalyticsCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  children, 
  variant = 'default' 
}: AnalyticsCardProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'border-success/20 bg-gradient-to-br from-success-soft to-success-soft/50';
      case 'warning':
        return 'border-warning/20 bg-gradient-to-br from-warning-soft to-warning-soft/50';
      case 'danger':
        return 'border-destructive/20 bg-gradient-to-br from-destructive-soft to-destructive-soft/50';
      default:
        return 'border-border bg-gradient-card';
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up': return 'text-success';
      case 'down': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up': return '↗';
      case 'down': return '↘';
      default: return '→';
    }
  };

  return (
    <div className={`card-premium p-6 space-y-4 ${getVariantStyles()}`}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>

      {change && (
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium flex items-center gap-1 ${getTrendColor(change.trend)}`}>
            {getTrendIcon(change.trend)}
            {Math.abs(change.value)}%
          </span>
          <span className="text-xs text-muted-foreground">{change.period}</span>
        </div>
      )}

      {children && (
        <div className="pt-2 border-t border-border/50">
          {children}
        </div>
      )}
    </div>
  );
}