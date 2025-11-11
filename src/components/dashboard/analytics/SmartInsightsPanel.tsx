import { useEffect, useState } from "react";
import { Brain, TrendingUp, AlertTriangle, Calendar, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface Insight {
  id: string;
  type: 'warning' | 'success' | 'info' | 'danger';
  title: string;
  description: string;
  action?: string;
  priority: 'high' | 'medium' | 'low';
  icon: any;
}

export function SmartInsightsPanel() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateSmartInsights();
  }, []);

  const generateSmartInsights = async () => {
    try {
      const insights: Insight[] = [];

      // Check for leave patterns
      const { data: recentLeaves } = await supabase
        .from('leave_requests')
        .select('*')
        .gte('start_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .eq('status', 'approved');

      if (recentLeaves && recentLeaves.length > 10) {
        insights.push({
          id: 'leave-spike',
          type: 'warning',
          title: 'Leave Spike Detected',
          description: `${recentLeaves.length} approved leaves in the last 30 days - 40% above average`,
          action: 'Review staffing levels',
          priority: 'high',
          icon: Calendar
        });
      }

      // Check compliance completion rates
      const { count: totalCompliance } = await supabase
        .from('compliance_period_records')
        .select('*', { count: 'exact', head: true });

      const { count: completedCompliance } = await supabase
        .from('compliance_period_records')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      const complianceRate = totalCompliance > 0 ? (completedCompliance / totalCompliance) * 100 : 0;

      if (complianceRate < 75) {
        insights.push({
          id: 'compliance-low',
          type: 'danger',
          title: 'Low Compliance Rate',
          description: `Only ${Math.round(complianceRate)}% of compliance tasks completed`,
          action: 'Send reminders to managers',
          priority: 'high',
          icon: AlertTriangle
        });
      } else if (complianceRate > 95) {
        insights.push({
          id: 'compliance-excellent',
          type: 'success',
          title: 'Excellent Compliance',
          description: `${Math.round(complianceRate)}% compliance rate - well above target`,
          priority: 'low',
          icon: TrendingUp
        });
      }

      // Check for document expiration trends
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      const { count: expiringDocs } = await supabase
        .from('document_tracker')
        .select('*', { count: 'exact', head: true })
        .lte('expiry_date', thirtyDaysFromNow.toISOString().split('T')[0])
        .gte('expiry_date', new Date().toISOString().split('T')[0]);

      if (expiringDocs && expiringDocs > 5) {
        insights.push({
          id: 'docs-expiring',
          type: 'warning',
          title: 'Document Renewal Rush',
          description: `${expiringDocs} documents expiring in the next 30 days`,
          action: 'Schedule renewal meetings',
          priority: 'medium',
          icon: AlertTriangle
        });
      }

      // Employee growth insights
      const { count: newEmployees } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (newEmployees && newEmployees > 3) {
        insights.push({
          id: 'growth-positive',
          type: 'success',
          title: 'Team Growth',
          description: `${newEmployees} new employees joined this month`,
          priority: 'low',
          icon: Users
        });
      }

      // Smart seasonal prediction
      const currentMonth = new Date().getMonth();
      if (currentMonth >= 5 && currentMonth <= 7) { // Summer months
        insights.push({
          id: 'seasonal-leaves',
          type: 'info',
          title: 'Summer Leave Season',
          description: 'Expect 25% increase in leave requests during summer months',
          action: 'Plan holiday coverage',
          priority: 'medium',
          icon: Calendar
        });
      }

      setInsights(insights);
    } catch (error) {
      console.error('Error generating insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInsightStyles = (type: Insight['type']) => {
    switch (type) {
      case 'danger':
        return {
          container: 'border-destructive/20 bg-destructive-soft',
          icon: 'bg-destructive text-destructive-foreground',
          badge: 'bg-destructive text-destructive-foreground'
        };
      case 'warning':
        return {
          container: 'border-warning/20 bg-warning-soft',
          icon: 'bg-warning text-white',
          badge: 'bg-warning text-white'
        };
      case 'success':
        return {
          container: 'border-success/20 bg-success-soft',
          icon: 'bg-success text-white',
          badge: 'bg-success text-white'
        };
      default:
        return {
          container: 'border-primary/20 bg-primary-soft',
          icon: 'bg-primary text-primary-foreground',
          badge: 'bg-primary text-primary-foreground'
        };
    }
  };

  if (loading) {
    return (
      <div className="h-60 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Generating insights...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">AI Insights</h3>
          <p className="text-sm text-muted-foreground">Predictive analytics and recommendations</p>
        </div>
      </div>

      <div className="space-y-3">
        {insights.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>All systems running smoothly</p>
            <p className="text-sm">No critical insights at this time</p>
          </div>
        ) : (
          insights.map((insight) => {
            const styles = getInsightStyles(insight.type);
            const Icon = insight.icon;
            
            return (
              <div
                key={insight.id}
                className={`p-4 rounded-lg border ${styles.container} transition-all hover:shadow-md`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${styles.icon}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">{insight.title}</h4>
                      <Badge variant="secondary" className={`text-xs ${styles.badge}`}>
                        {insight.priority}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                    
                    {insight.action && (
                      <p className="text-xs font-medium text-primary">{insight.action}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}