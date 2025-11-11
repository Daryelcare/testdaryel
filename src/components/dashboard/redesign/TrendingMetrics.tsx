import { TrendingUp, TrendingDown, Activity } from "lucide-react";

interface Trend {
  label: string;
  current: number;
  previous: number;
  change: number;
}

interface TrendingMetricsProps {
  trends: Trend[];
}

export function TrendingMetrics({ trends }: TrendingMetricsProps) {
  return (
    <div className="card-premium p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Trending Metrics</h3>
          <p className="text-sm text-muted-foreground">Performance indicators</p>
        </div>
      </div>

      {/* Trends */}
      <div className="space-y-4">
        {trends.map((trend, index) => {
          const isPositive = trend.change > 0;
          const changeAbs = Math.abs(trend.change);

          return (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{trend.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold tabular-nums">
                    {trend.current.toLocaleString()}
                    {trend.label.includes('Rate') || trend.label.includes('Satisfaction') ? '' : ' days'}
                  </span>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                    isPositive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {isPositive ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {changeAbs.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Progress comparison */}
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`absolute top-0 left-0 h-full transition-all duration-1000 ${
                    isPositive ? 'bg-gradient-to-r from-success to-success/80' : 'bg-gradient-to-r from-destructive to-destructive/80'
                  }`}
                  style={{ width: `${Math.min((trend.current / (trend.previous * 1.5)) * 100, 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Previous: {trend.previous}</span>
                <span>Target: {(trend.previous * 1.1).toFixed(1)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
