import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LeaveData {
  month: string;
  approved: number;
  pending: number;
  rejected: number;
}

interface LeaveTypeData {
  name: string;
  value: number;
  color: string;
}

export function LeaveAnalyticsChart() {
  const [monthlyData, setMonthlyData] = useState<LeaveData[]>([]);
  const [typeData, setTypeData] = useState<LeaveTypeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaveData();
  }, []);

  const fetchLeaveData = async () => {
    try {
      // Monthly leave trends
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        months.push({
          date: date.toISOString().slice(0, 7),
          name: date.toLocaleDateString('en-US', { month: 'short' })
        });
      }

      const monthlyLeaveData = await Promise.all(
        months.map(async (month) => {
          const [approved, pending, rejected] = await Promise.all([
            supabase.from('leave_requests').select('*', { count: 'exact', head: true })
              .gte('start_date', `${month.date}-01`)
              .lte('start_date', `${month.date}-31`)
              .eq('status', 'approved'),
            supabase.from('leave_requests').select('*', { count: 'exact', head: true })
              .gte('start_date', `${month.date}-01`)
              .lte('start_date', `${month.date}-31`)
              .eq('status', 'pending'),
            supabase.from('leave_requests').select('*', { count: 'exact', head: true })
              .gte('start_date', `${month.date}-01`)
              .lte('start_date', `${month.date}-31`)
              .eq('status', 'rejected')
          ]);

          return {
            month: month.name,
            approved: approved.count || 0,
            pending: pending.count || 0,
            rejected: rejected.count || 0
          };
        })
      );

      // Leave types distribution
      const { data: leaveTypes } = await supabase
        .from('leave_types')
        .select('id, name');

      const typeDistribution = await Promise.all(
        (leaveTypes || []).map(async (type, index) => {
          const { count } = await supabase
            .from('leave_requests')
            .select('*', { count: 'exact', head: true })
            .eq('leave_type_id', type.id)
            .eq('status', 'approved');

          const colors = [
            'hsl(var(--primary))',
            'hsl(var(--success))',
            'hsl(var(--warning))',
            'hsl(var(--destructive))',
            'hsl(var(--accent))'
          ];

          return {
            name: type.name,
            value: count || 0,
            color: colors[index % colors.length]
          };
        })
      );

      setMonthlyData(monthlyLeaveData);
      setTypeData(typeDistribution.filter(t => t.value > 0));
    } catch (error) {
      console.error('Error fetching leave data:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartConfig = {
    approved: {
      label: "Approved",
      color: "hsl(var(--success))",
    },
    pending: {
      label: "Pending",
      color: "hsl(var(--warning))",
    },
    rejected: {
      label: "Rejected",
      color: "hsl(var(--destructive))",
    },
  };

  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="trends" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="trends">Monthly Trends</TabsTrigger>
        <TabsTrigger value="types">Leave Types</TabsTrigger>
      </TabsList>

      <TabsContent value="trends">
        <ChartContainer config={chartConfig} className="h-64 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
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
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="approved" fill="hsl(var(--success))" radius={[2, 2, 0, 0]} />
              <Bar dataKey="pending" fill="hsl(var(--warning))" radius={[2, 2, 0, 0]} />
              <Bar dataKey="rejected" fill="hsl(var(--destructive))" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </TabsContent>

      <TabsContent value="types">
        <ChartContainer config={{}} className="h-64 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={typeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {typeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </TabsContent>
    </Tabs>
  );
}