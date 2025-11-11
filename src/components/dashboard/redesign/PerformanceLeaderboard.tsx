import { Trophy, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Performer {
  id: string;
  name: string;
  score: number;
  avatar: string;
  trend: number;
}

interface PerformanceLeaderboardProps {
  performers: Performer[];
}

export function PerformanceLeaderboard({ performers }: PerformanceLeaderboardProps) {
  return (
    <div className="card-premium p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Top Performers</h3>
          <p className="text-sm text-muted-foreground">This month's leaders</p>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="space-y-3">
        {performers.map((performer, index) => {
          const isTop3 = index < 3;
          const medalColors = [
            "from-amber-400 to-yellow-500",
            "from-gray-300 to-gray-400",
            "from-orange-400 to-amber-600"
          ];

          return (
            <div
              key={performer.id}
              className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-all hover:scale-[1.02] group"
            >
              {/* Rank */}
              <div className={`relative w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0 ${
                isTop3 ? `bg-gradient-to-br ${medalColors[index]}` : 'bg-muted-foreground'
              }`}>
                {index + 1}
                {isTop3 && (
                  <div className="absolute -top-1 -right-1">
                    <Trophy className="w-4 h-4 text-amber-400 drop-shadow" />
                  </div>
                )}
              </div>

              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-sm font-bold text-white">
                {performer.avatar}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{performer.name}</div>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-primary transition-all duration-1000"
                      style={{ width: `${performer.score}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-primary tabular-nums">
                    {performer.score}
                  </span>
                </div>
              </div>

              {/* Trend */}
              <Badge
                variant={performer.trend > 0 ? "default" : "secondary"}
                className={performer.trend > 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}
              >
                {performer.trend > 0 ? (
                  <TrendingUp className="w-3 h-3 mr-1" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-1" />
                )}
                {Math.abs(performer.trend)}%
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
