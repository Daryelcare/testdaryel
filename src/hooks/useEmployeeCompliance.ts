import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ComplianceItem {
  id: string;
  name: string;
  frequency: string;
  period: string;
  status: 'due' | 'completed' | 'overdue';
  isOverdue?: boolean;
  completedDate?: string;
  quarterlyTimeline?: QuarterlyPeriod[];
  monthlyTimeline?: MonthlyPeriod[];
  biAnnualTimeline?: BiAnnualPeriod[];
}

interface QuarterlyPeriod {
  quarter: number;
  period: string;
  label: string;
  status: 'completed' | 'due' | 'overdue' | 'upcoming';
  completedDate?: string;
}

interface MonthlyPeriod {
  month: number;
  period: string;
  label: string;
  status: 'completed' | 'due' | 'overdue' | 'upcoming';
  completedDate?: string;
}

interface BiAnnualPeriod {
  half: number;
  period: string;
  label: string;
  status: 'completed' | 'due' | 'overdue' | 'upcoming';
  completedDate?: string;
}

interface ComplianceData {
  dueItems: ComplianceItem[];
  completedItems: ComplianceItem[];
  loading: boolean;
  error: string | null;
}

// Helper function to check if a period is overdue based on its end date
const isPeriodOverdue = (period: string, frequency: string, now: Date): boolean => {
  const [year, periodPart] = period.split('-');
  const yearNum = parseInt(year);
  
  if (frequency === 'monthly') {
    const month = parseInt(periodPart);
    const endOfMonth = new Date(yearNum, month, 0, 23, 59, 59); // Last day of the month
    return now > endOfMonth;
  } else if (frequency === 'quarterly') {
    const quarter = parseInt(periodPart.replace('Q', ''));
    const endMonth = quarter * 3;
    const endOfQuarter = new Date(yearNum, endMonth, 0, 23, 59, 59); // Last day of quarter
    return now > endOfQuarter;
  } else if (frequency === 'bi-annual') {
    const half = parseInt(periodPart.replace('H', ''));
    const endMonth = half === 1 ? 6 : 12;
    const endOfHalf = new Date(yearNum, endMonth, 0, 23, 59, 59); // Last day of half
    return now > endOfHalf;
  }
  
  return false;
};

export function useEmployeeCompliance(employeeId: string | undefined): ComplianceData {
  const [data, setData] = useState<ComplianceData>({
    dueItems: [],
    completedItems: [],
    loading: true,
    error: null
  });

  useEffect(() => {
    if (!employeeId) return;

    const fetchComplianceData = async () => {
      try {
        setData(prev => ({ ...prev, loading: true, error: null }));

        // Get all compliance types for employees that are visible in portal
        const { data: complianceTypes, error: typesError } = await supabase
          .from('compliance_types')
          .select('*')
          .eq('target_table', 'employees')
          .eq('visible_in_employee_portal', true);

        if (typesError) throw typesError;

        // Get employee's compliance records
        const { data: complianceRecords, error: recordsError } = await supabase
          .from('compliance_period_records')
          .select('*')
          .eq('employee_id', employeeId)
          .order('created_at', { ascending: false });

        if (recordsError) throw recordsError;

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const currentQuarter = Math.ceil(currentMonth / 3);

        const dueItems: ComplianceItem[] = [];
        const completedItems: ComplianceItem[] = [];

        // Process each compliance type
        complianceTypes?.forEach(type => {
          if (type.frequency === 'quarterly') {
            // For quarterly items, create timeline view
            const quarterlyTimeline: QuarterlyPeriod[] = [];
            
            for (let q = 1; q <= 4; q++) {
              const quarterPeriod = `${currentYear}-Q${q}`;
              const record = complianceRecords?.find(
                r => r.compliance_type_id === type.id && r.period_identifier === quarterPeriod
              );

              const quarterLabels = {
                1: 'Q1 Jan to Mar',
                2: 'Q2 Apr to Jun', 
                3: 'Q3 Jul to Sep',
                4: 'Q4 Oct to Dec'
              };

              let status: 'completed' | 'due' | 'overdue' | 'upcoming';
              const isCompleted = record?.status === 'completed' || record?.status === 'compliant';
              
              if (isPeriodOverdue(quarterPeriod, 'quarterly', now)) {
                // Past the end date of this quarter
                status = isCompleted ? 'completed' : 'overdue';
              } else if (q === currentQuarter) {
                // Current quarter
                status = isCompleted ? 'completed' : 'due';
              } else {
                // Future quarters: upcoming
                status = 'upcoming';
              }

              quarterlyTimeline.push({
                quarter: q,
                period: quarterPeriod,
                label: quarterLabels[q as keyof typeof quarterLabels],
                status,
                completedDate: record?.updated_at
              });
            }

            // Check if any quarter is overdue
            const hasOverdueQuarter = quarterlyTimeline.some(q => q.status === 'overdue');
            
            // Find the current quarter's status
            const currentQuarterRecord = complianceRecords?.find(
              record => record.compliance_type_id === type.id && 
              record.period_identifier === `${currentYear}-Q${currentQuarter}`
            );

            const complianceItem: ComplianceItem = {
              id: type.id,
              name: type.name,
              frequency: type.frequency,
              period: `${currentYear}-Q${currentQuarter}`,
              status: hasOverdueQuarter ? 'overdue' : ((currentQuarterRecord?.status === 'completed' || currentQuarterRecord?.status === 'compliant') ? 'completed' : 'due'),
              isOverdue: hasOverdueQuarter || currentQuarterRecord?.is_overdue || false,
              completedDate: currentQuarterRecord?.updated_at,
              quarterlyTimeline
            };

            // Only mark as completed if ALL 4 quarters for the year are completed
            const allQuartersCompleted = quarterlyTimeline.every(q => q.status === 'completed');

            if (allQuartersCompleted) {
              completedItems.push(complianceItem);
            } else {
              dueItems.push(complianceItem);
            }
          } else if (type.frequency === 'monthly') {
            // For monthly items, create timeline view for all 12 months
            const monthlyTimeline: MonthlyPeriod[] = [];
            
            for (let m = 1; m <= 12; m++) {
              const monthPeriod = `${currentYear}-${m.toString().padStart(2, '0')}`;
              const record = complianceRecords?.find(
                r => r.compliance_type_id === type.id && r.period_identifier === monthPeriod
              );

              const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

              let status: 'completed' | 'due' | 'overdue' | 'upcoming';
              const isCompleted = record?.status === 'completed' || record?.status === 'compliant';
              
              if (isPeriodOverdue(monthPeriod, 'monthly', now)) {
                // Past the end date of this month
                status = isCompleted ? 'completed' : 'overdue';
              } else if (m === currentMonth) {
                // Current month
                status = isCompleted ? 'completed' : 'due';
              } else {
                // Future months: upcoming
                status = 'upcoming';
              }

              monthlyTimeline.push({
                month: m,
                period: monthPeriod,
                label: monthLabels[m - 1],
                status,
                completedDate: record?.updated_at
              });
            }

            const hasOverdueMonth = monthlyTimeline.some(m => m.status === 'overdue');
            const currentMonthRecord = complianceRecords?.find(
              record => record.compliance_type_id === type.id && 
              record.period_identifier === `${currentYear}-${currentMonth.toString().padStart(2, '0')}`
            );

            const complianceItem: ComplianceItem = {
              id: type.id,
              name: type.name,
              frequency: type.frequency,
              period: `${currentYear}-${currentMonth.toString().padStart(2, '0')}`,
              status: hasOverdueMonth ? 'overdue' : ((currentMonthRecord?.status === 'completed' || currentMonthRecord?.status === 'compliant') ? 'completed' : 'due'),
              isOverdue: hasOverdueMonth || currentMonthRecord?.is_overdue || false,
              completedDate: currentMonthRecord?.updated_at,
              monthlyTimeline
            };

            // Only mark as completed if ALL 12 months for the year are completed
            const allMonthsCompleted = monthlyTimeline.every(m => m.status === 'completed');

            if (allMonthsCompleted) {
              completedItems.push(complianceItem);
            } else {
              dueItems.push(complianceItem);
            }
          } else if (type.frequency === 'bi-annual') {
            // For bi-annual items, create timeline view for both halves
            const biAnnualTimeline: BiAnnualPeriod[] = [];
            const currentHalf = currentMonth <= 6 ? 1 : 2;
            
            for (let h = 1; h <= 2; h++) {
              const halfPeriod = `${currentYear}-H${h}`;
              const record = complianceRecords?.find(
                r => r.compliance_type_id === type.id && r.period_identifier === halfPeriod
              );

              const halfLabels = {
                1: 'H1 Jan to Jun',
                2: 'H2 Jul to Dec'
              };

              let status: 'completed' | 'due' | 'overdue' | 'upcoming';
              const isCompleted = record?.status === 'completed' || record?.status === 'compliant';
              
              if (isPeriodOverdue(halfPeriod, 'bi-annual', now)) {
                // Past the end date of this half
                status = isCompleted ? 'completed' : 'overdue';
              } else if (h === currentHalf) {
                // Current half
                status = isCompleted ? 'completed' : 'due';
              } else {
                // Future half: upcoming
                status = 'upcoming';
              }

              biAnnualTimeline.push({
                half: h,
                period: halfPeriod,
                label: halfLabels[h as keyof typeof halfLabels],
                status,
                completedDate: record?.updated_at
              });
            }

            const hasOverdueHalf = biAnnualTimeline.some(h => h.status === 'overdue');
            const currentHalfRecord = complianceRecords?.find(
              record => record.compliance_type_id === type.id && 
              record.period_identifier === `${currentYear}-H${currentHalf}`
            );

            const complianceItem: ComplianceItem = {
              id: type.id,
              name: type.name,
              frequency: type.frequency,
              period: `${currentYear}-H${currentHalf}`,
              status: hasOverdueHalf ? 'overdue' : ((currentHalfRecord?.status === 'completed' || currentHalfRecord?.status === 'compliant') ? 'completed' : 'due'),
              isOverdue: hasOverdueHalf || currentHalfRecord?.is_overdue || false,
              completedDate: currentHalfRecord?.updated_at,
              biAnnualTimeline
            };

            // Only mark as completed if BOTH halves for the year are completed
            const allHalvesCompleted = biAnnualTimeline.every(h => h.status === 'completed');

            if (allHalvesCompleted) {
              completedItems.push(complianceItem);
            } else {
              dueItems.push(complianceItem);
            }
          } else {
            // Handle annual and other frequency types
            const currentPeriod = type.frequency === 'annual' ? currentYear.toString() : currentYear.toString();

            const currentRecord = complianceRecords?.find(
              record => record.compliance_type_id === type.id && 
              record.period_identifier === currentPeriod
            );

            const complianceItem: ComplianceItem = {
              id: type.id,
              name: type.name,
              frequency: type.frequency,
              period: currentPeriod,
              status: 'due',
              isOverdue: false,
              completedDate: currentRecord?.updated_at
            };

            if (currentRecord) {
              if (currentRecord.status === 'completed' || currentRecord.status === 'compliant') {
                complianceItem.status = 'completed';
                completedItems.push(complianceItem);
              } else if (currentRecord.status === 'overdue' || currentRecord.is_overdue) {
                complianceItem.status = 'overdue';
                complianceItem.isOverdue = true;
                dueItems.push(complianceItem);
              } else {
                complianceItem.status = 'due';
                dueItems.push(complianceItem);
              }
            } else {
              dueItems.push(complianceItem);
            }
          }
        });

        // Also get recently completed items from previous periods (annual only)
        const recentCompleted = complianceRecords?.filter(record => {
          if (record.status !== 'completed' && record.status !== 'compliant') return false;
          const type = complianceTypes?.find(t => t.id === record.compliance_type_id);
          // Skip quarterly, monthly, and bi-annual items (they use timeline logic)
          if (type?.frequency === 'quarterly' || type?.frequency === 'monthly' || type?.frequency === 'bi-annual') return false;
          const recordDate = new Date(record.updated_at);
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          return recordDate >= threeMonthsAgo;
        });

        recentCompleted?.forEach(record => {
          const type = complianceTypes?.find(t => t.id === record.compliance_type_id);
          if (type && !completedItems.find(item => item.id === type.id && item.period === record.period_identifier)) {
            completedItems.push({
              id: type.id,
              name: type.name,
              frequency: type.frequency,
              period: record.period_identifier,
              status: 'completed'
            });
          }
        });

        setData({
          dueItems: dueItems, // Show all due items
          completedItems: completedItems, // Show all completed items
          loading: false,
          error: null
        });

      } catch (error) {
        console.error('Error fetching compliance data:', error);
        setData(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch compliance data'
        }));
      }
    };

    fetchComplianceData();
  }, [employeeId]);

  return data;
}