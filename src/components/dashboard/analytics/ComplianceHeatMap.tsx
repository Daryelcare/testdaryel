import { useEffect, useState } from "react";
import { ResponsiveContainer, Cell, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";

interface ComplianceData {
  department: string;
  score: number;
  total: number;
  completed: number;
}

export function ComplianceHeatMap() {
  const [data, setData] = useState<ComplianceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComplianceData();
  }, []);

  const fetchComplianceData = async () => {
    try {
      // Get unique branches (departments)
      const { data: branches } = await supabase
        .from('branches')
        .select('id, name');

      const complianceData = await Promise.all(
        (branches || []).map(async (branch) => {
          const { count: total } = await supabase
            .from('compliance_period_records')
            .select('*, employees!inner(*)', { count: 'exact', head: true })
            .eq('employees.branch_id', branch.id);

          const { count: completed } = await supabase
            .from('compliance_period_records')
            .select('*, employees!inner(*)', { count: 'exact', head: true })
            .eq('employees.branch_id', branch.id)
            .eq('status', 'completed');

          const score = total > 0 ? Math.round((completed / total) * 100) : 0;

          return {
            department: branch.name,
            score,
            total: total || 0,
            completed: completed || 0
          };
        })
      );

      setData(complianceData);
    } catch (error) {
      console.error('Error fetching compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'hsl(var(--success))';
    if (score >= 75) return 'hsl(var(--warning))';
    if (score >= 50) return '#ff9800';
    return 'hsl(var(--destructive))';
  };

  const getScoreBackground = (score: number) => {
    if (score >= 90) return 'hsl(var(--success-soft))';
    if (score >= 75) return 'hsl(var(--warning-soft))';
    if (score >= 50) return '#fff3e0';
    return 'hsl(var(--destructive-soft))';
  };

  if (loading) {
    return (
      <div className="h-60 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading compliance heat map...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Compliance Score by Department</h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(var(--success))' }}></div>
            <span>90%+</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(var(--warning))' }}></div>
            <span>75-89%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ff9800' }}></div>
            <span>50-74%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(var(--destructive))' }}></div>
            <span>&lt;50%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((item) => (
          <div
            key={item.department}
            className="p-4 rounded-lg border transition-all hover:shadow-md"
            style={{ 
              backgroundColor: getScoreBackground(item.score),
              borderColor: getScoreColor(item.score)
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-sm">{item.department}</h4>
              <span 
                className="text-2xl font-bold"
                style={{ color: getScoreColor(item.score) }}
              >
                {item.score}%
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {item.completed} of {item.total} completed
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${item.score}%`,
                  backgroundColor: getScoreColor(item.score)
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}