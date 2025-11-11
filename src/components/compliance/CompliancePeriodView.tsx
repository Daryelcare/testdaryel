
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Download, AlertTriangle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompliancePeriodEmployeeView } from "./CompliancePeriodEmployeeView";
import { useToast } from "@/hooks/use-toast";
import { useCompliancePeriodData } from "@/hooks/queries/useCompliancePeriodQueries";

interface CompliancePeriodViewProps {
  complianceTypeId: string;
  complianceTypeName: string;
  frequency: string;
}

interface PeriodData {
  period_identifier: string;
  year: number;
  record_count: number;
  completion_rate: number;
  download_available: boolean;
  archive_due_date?: string;
  download_available_date?: string;
  is_current: boolean;
}

export function CompliancePeriodView({ complianceTypeId, complianceTypeName, frequency }: CompliancePeriodViewProps) {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [currentPeriod, setCurrentPeriod] = useState<string>("");
  const { toast } = useToast();

  // Fetch data using React Query
  const { data, isLoading, error } = useCompliancePeriodData(complianceTypeId, frequency, selectedYear);
  
  const employees = data?.employees || [];
  const records = data?.records || [];

  const getCurrentPeriod = () => {
    const now = new Date();
    switch (frequency.toLowerCase()) {
      case 'annual':
        return now.getFullYear().toString();
      case 'monthly':
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      case 'quarterly':
        return `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
      case 'bi-annual':
        return `${now.getFullYear()}-H${now.getMonth() < 6 ? '1' : '2'}`;
      case 'weekly':
        const weekNumber = getWeekNumber(now);
        return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
      default:
        return now.getFullYear().toString();
    }
  };

  const getWeekNumber = (date: Date) => {
    const start = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + start.getDay() + 1) / 7);
  };

  const calculatePeriodStats = (periodId: string, employeesData: any[], recordsData: any[]) => {
    const totalEmployees = employeesData.length;
    const periodRecords = recordsData.filter(record => record.period_identifier === periodId);
    const completedRecords = periodRecords.filter(record => 
      record.status === 'completed' || record.completion_date
    );
    
    return {
      record_count: periodRecords.length,
      completion_rate: totalEmployees > 0 ? (completedRecords.length / totalEmployees) * 100 : 0
    };
  };

  // Generate periods using useMemo for better performance
  const periods = useMemo(() => {
    if (!employees || !records) return [];
    
    const currentYear = new Date().getFullYear(); // 2025
    const generatedPeriods: PeriodData[] = [];
    
    // Only generate periods for years that make sense (current year going back to 6 years)
    // But start from 2025 and only show years that have passed or are current
    const startYear = Math.max(2025, currentYear - 5); // Start from 2025 or 6 years ago, whichever is later
    const endYear = currentYear;
    
    for (let year = endYear; year >= startYear; year--) {
      const isCurrentYear = year === currentYear;
      const yearsOld = currentYear - year;
      const shouldShowDownload = yearsOld >= 5; // Show download for data 5+ years old
      const archiveDueYear = year + 6; // Delete after 6 years
      
      switch (frequency.toLowerCase()) {
        case 'annual':
          const annualStats = calculatePeriodStats(year.toString(), employees, records);
          generatedPeriods.push({
            period_identifier: year.toString(),
            year,
            record_count: annualStats.record_count,
            completion_rate: annualStats.completion_rate,
            download_available: shouldShowDownload,
            archive_due_date: shouldShowDownload ? `${archiveDueYear}-01-01` : undefined,
            download_available_date: shouldShowDownload ? `${archiveDueYear - 1}-10-01` : undefined,
            is_current: isCurrentYear
          });
          break;
        
        case 'monthly':
          if (year === selectedYear) {
            const monthsToShow = year === currentYear ? new Date().getMonth() + 1 : 12;
            for (let month = monthsToShow; month >= 1; month--) {
              const periodId = `${year}-${String(month).padStart(2, '0')}`;
              const isCurrentMonth = year === currentYear && month === new Date().getMonth() + 1;
              const monthStats = calculatePeriodStats(periodId, employees, records);
              generatedPeriods.push({
                period_identifier: periodId,
                year,
                record_count: monthStats.record_count,
                completion_rate: monthStats.completion_rate,
                download_available: shouldShowDownload,
                archive_due_date: shouldShowDownload ? `${archiveDueYear}-01-01` : undefined,
                download_available_date: shouldShowDownload ? `${archiveDueYear - 1}-10-01` : undefined,
                is_current: isCurrentMonth
              });
            }
          }
          break;
        
        case 'quarterly':
          if (year === selectedYear) {
            const currentQuarter = year === currentYear ? Math.ceil((new Date().getMonth() + 1) / 3) : 4;
            for (let quarter = currentQuarter; quarter >= 1; quarter--) {
              const periodId = `${year}-Q${quarter}`;
              const isCurrentQuarter = year === currentYear && quarter === Math.ceil((new Date().getMonth() + 1) / 3);
              const quarterStats = calculatePeriodStats(periodId, employees, records);
              generatedPeriods.push({
                period_identifier: periodId,
                year,
                record_count: quarterStats.record_count,
                completion_rate: quarterStats.completion_rate,
                download_available: shouldShowDownload,
                archive_due_date: shouldShowDownload ? `${archiveDueYear}-01-01` : undefined,
                download_available_date: shouldShowDownload ? `${archiveDueYear - 1}-10-01` : undefined,
                is_current: isCurrentQuarter
              });
            }
          }
          break;
        
        case 'bi-annual':
          if (year === selectedYear) {
            const currentHalf = year === currentYear ? (new Date().getMonth() < 6 ? 1 : 2) : 2;
            for (let half = currentHalf; half >= 1; half--) {
              const periodId = `${year}-H${half}`;
              const isCurrentHalf = year === currentYear && half === (new Date().getMonth() < 6 ? 1 : 2);
              const halfStats = calculatePeriodStats(periodId, employees, records);
              generatedPeriods.push({
                period_identifier: periodId,
                year,
                record_count: halfStats.record_count,
                completion_rate: halfStats.completion_rate,
                download_available: shouldShowDownload,
                archive_due_date: shouldShowDownload ? `${archiveDueYear}-01-01` : undefined,
                download_available_date: shouldShowDownload ? `${archiveDueYear - 1}-10-01` : undefined,
                is_current: isCurrentHalf
              });
            }
          }
          break;
        
        case 'weekly':
          if (year === selectedYear) {
            const currentWeek = year === currentYear ? getWeekNumber(new Date()) : 52;
            // Show every 4th week for brevity, but only up to current week for current year
            for (let week = Math.floor(currentWeek / 4) * 4; week >= 1; week -= 4) {
              const periodId = `${year}-W${String(week).padStart(2, '0')}`;
              const isCurrentWeek = year === currentYear && week === getWeekNumber(new Date());
              const weekStats = calculatePeriodStats(periodId, employees, records);
              generatedPeriods.push({
                period_identifier: periodId,
                year,
                record_count: weekStats.record_count,
                completion_rate: weekStats.completion_rate,
                download_available: shouldShowDownload,
                archive_due_date: shouldShowDownload ? `${archiveDueYear - 1}-10-01` : undefined,
                download_available_date: shouldShowDownload ? `${archiveDueYear - 1}-10-01` : undefined,
                is_current: isCurrentWeek
              });
            }
          }
          break;
      }
    }
    
    return generatedPeriods;
  }, [employees, records, frequency, selectedYear]);

  const handleDownload = async (period: PeriodData) => {
    try {
      toast({
        title: "Download Started",
        description: `Downloading data for ${period.period_identifier}...`,
      });
      
      // In a real implementation, this would trigger a backend process
      // to generate and download the archived data
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "Could not download the archived data.",
        variant: "destructive",
      });
    }
  };

  const getPeriodLabel = (periodId: string) => {
    switch (frequency.toLowerCase()) {
      case 'annual':
        return `Year ${periodId}`;
      case 'monthly':
        const [year, month] = periodId.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
      case 'quarterly':
        return periodId.replace('-', ' ');
      case 'bi-annual':
        return periodId.replace('-H', ' Half ');
      case 'weekly':
        return periodId.replace('-W', ' Week ');
      default:
        return periodId;
    }
  };

  const getAvailableYears = () => {
    const currentYear = new Date().getFullYear();
    const startYear = Math.max(2025, currentYear - 5);
    const years = [];
    for (let year = currentYear; year >= startYear; year--) {
      years.push(year);
    }
    return years;
  };

  const getCompletionBadge = (rate: number) => {
    if (rate >= 90) return "bg-success/10 text-success border-success/20";
    if (rate >= 70) return "bg-warning/10 text-warning border-warning/20";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-64"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h3 className="text-xl font-semibold">Compliance Period Records</h3>
        
        {frequency.toLowerCase() !== 'annual' && (
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
              {getAvailableYears().map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Periods Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {periods.map((period, index) => {
          const showDownload = period.download_available && period.download_available_date;
          
          return (
            <Card 
              key={period.period_identifier} 
              className={`card-premium transition-all duration-300 ${
                period.is_current ? 'ring-2 ring-primary border-primary bg-primary/5' : ''
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    {getPeriodLabel(period.period_identifier)}
                  </CardTitle>
                  {period.is_current && (
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      Current
                    </Badge>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Records</p>
                    <p className="font-semibold">{period.record_count}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Completion</p>
                    <Badge className={getCompletionBadge(period.completion_rate)}>
                      {period.completion_rate.toFixed(1)}%
                    </Badge>
                  </div>
                </div>

                {/* Archive Warning */}
                {period.archive_due_date && (
                  <div className="flex items-center gap-2 p-2 bg-warning/10 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                    <span className="text-sm text-warning">
                      Archive due: {new Date(period.archive_due_date).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {/* Download Button */}
                {showDownload && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => handleDownload(period)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Archive
                  </Button>
                )}

                {/* View Details Button for current periods */}
                {!period.download_available && (
                  <CompliancePeriodEmployeeView
                    complianceTypeId={complianceTypeId}
                    complianceTypeName={complianceTypeName}
                    periodIdentifier={period.period_identifier}
                    frequency={frequency}
                    trigger={
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="w-full bg-gradient-primary hover:opacity-90"
                      >
                        View Details
                      </Button>
                    }
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Legend */}
      <Card className="card-premium">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary rounded-full"></div>
              <span>Current Period</span>
            </div>
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-muted-foreground" />
              <span>Download Available (3 months before deletion)</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <span>Archive Due</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
