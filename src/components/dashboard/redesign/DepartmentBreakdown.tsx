import { Building2 } from "lucide-react";

interface Department {
  name: string;
  count: number;
  color: string;
}

interface DepartmentBreakdownProps {
  departments: Department[];
}

export function DepartmentBreakdown({ departments }: DepartmentBreakdownProps) {
  const total = departments.reduce((sum, dept) => sum + dept.count, 0);

  return (
    <div className="card-premium p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Department Distribution</h3>
          <p className="text-sm text-muted-foreground">{total} total employees</p>
        </div>
      </div>

      {/* Donut Chart */}
      <div className="flex items-center justify-center">
        <div className="relative w-48 h-48">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {departments.map((dept, index) => {
              const prevSum = departments.slice(0, index).reduce((sum, d) => sum + d.count, 0);
              const offset = (prevSum / total) * 283;
              const length = (dept.count / total) * 283;
              
              return (
                <circle
                  key={dept.name}
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke={dept.color}
                  strokeWidth="10"
                  strokeDasharray={`${length} 283`}
                  strokeDashoffset={-offset}
                  className="transition-all duration-1000"
                  style={{ opacity: 0.9 }}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold">{total}</div>
              <div className="text-xs text-muted-foreground">Employees</div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {departments.map((dept) => {
          const percentage = ((dept.count / total) * 100).toFixed(1);
          return (
            <div key={dept.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: dept.color }}
                />
                <span className="text-sm font-medium">{dept.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{dept.count}</span>
                <span className="text-sm font-semibold" style={{ color: dept.color }}>
                  {percentage}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
