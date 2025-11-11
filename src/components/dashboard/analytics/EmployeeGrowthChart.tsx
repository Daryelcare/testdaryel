import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";

interface GrowthData {
  month: string;
  employees: number;
  hires: number;
}

export function EmployeeGrowthChart() {
  const [data, setData] = useState<GrowthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGrowthData();
  }, []);

  const fetchGrowthData = async () => {
    try {
      // Get last 6 months of data
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        months.push({
          date: date.toISOString().slice(0, 7), // YYYY-MM
          name: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        });
      }

      const growthData = await Promise.all(
        months.map(async (month) => {
          const { count: totalEmployees } = await supabase
            .from('employees')
            .select('*', { count: 'exact', head: true })
            .lte('created_at', `${month.date}-31`);

          const { count: newHires } = await supabase
            .from('employees')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', `${month.date}-01`)
            .lte('created_at', `${month.date}-31`);

          return {
            month: month.name,
            employees: totalEmployees || 0,
            hires: newHires || 0
          };
        })
      );

      setData(growthData);
    } catch (error) {
      console.error('Error fetching growth data:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartConfig = {
    employees: {
      label: "Total Employees",
      color: "hsl(var(--primary))",
    },
    hires: {
      label: "New Hires",
      color: "hsl(var(--success))",
    },
  };

  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading chart...</div>
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-64 sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="month" 
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            width={40}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            type="monotone"
            dataKey="employees"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: "hsl(var(--primary))", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="hires"
            stroke="hsl(var(--success))"
            strokeWidth={2}
            dot={{ fill: "hsl(var(--success))", strokeWidth: 2, r: 3 }}
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}