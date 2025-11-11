import { Building2, Activity } from "lucide-react";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface Branch {
  name: string;
  employeeCount: number;
  clientCount: number;
  color: string;
}

interface BranchHealth {
  branch_name: string;
  compliance_rate: number;
  document_validity_rate: number;
  leave_backlog: number;
  active_employees: number;
  overall_score: number;
}

interface BranchBreakdownProps {
  branches: Branch[];
  branchHealth: BranchHealth[];
}

export function BranchBreakdown({ branches, branchHealth }: BranchBreakdownProps) {
  const views = ['employees', 'clients', 'health'] as const;
  
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-success';
    if (score >= 70) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return 'bg-success/10 text-success border-success/20';
    if (score >= 70) return 'bg-warning/10 text-warning border-warning/20';
    return 'bg-destructive/10 text-destructive border-destructive/20';
  };
  
  return (
    <div className="card-premium p-6 flex flex-col min-h-[620px]">
      <Carousel 
        className="w-full flex-1 flex flex-col"
        opts={{ loop: true }}
        plugins={[
          Autoplay({
            delay: 4000,
            stopOnInteraction: false,
            stopOnMouseEnter: true,
          }),
        ]}
      >
        <CarouselContent>
          {views.map((view) => {
            if (view === 'health') {
              const totalScore = branchHealth.reduce((sum, branch) => sum + branch.overall_score, 0);
              const avgScore = branchHealth.length > 0 ? Math.round(totalScore / branchHealth.length) : 0;

              return (
                <CarouselItem key={view}>
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                        <Activity className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Branch Health Score</h3>
                        <p className="text-sm text-muted-foreground">
                          Overall performance metrics
                        </p>
                      </div>
                    </div>

                    {branchHealth.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No branch data available</p>
                    ) : (
                      <>
                        {/* Donut Chart */}
                        <div className="flex items-center justify-center">
                          <div className="relative w-48 h-48">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                              {branchHealth.map((branch, index) => {
                                const prevSum = branchHealth.slice(0, index).reduce((sum, b) => sum + b.overall_score, 0);
                                const offset = (prevSum / totalScore) * 283;
                                const length = (branch.overall_score / totalScore) * 283;
                                
                                // Get color based on score
                                let color = '#ef4444'; // destructive
                                if (branch.overall_score >= 90) color = '#22c55e'; // success
                                else if (branch.overall_score >= 70) color = '#f59e0b'; // warning
                                
                                return (
                                  <circle
                                    key={index}
                                    cx="50"
                                    cy="50"
                                    r="45"
                                    fill="none"
                                    stroke={color}
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
                                <div className="text-3xl font-bold">{avgScore}%</div>
                                <div className="text-xs text-muted-foreground">
                                  Avg Score
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Legend */}
                        <ScrollArea className="h-[280px] pr-4">
                          <div className="space-y-2">
                            {branchHealth.map((branch, index) => {
                            const percentage = totalScore > 0 ? ((branch.overall_score / totalScore) * 100).toFixed(1) : '0.0';
                            let color = '#ef4444';
                            if (branch.overall_score >= 90) color = '#22c55e';
                            else if (branch.overall_score >= 70) color = '#f59e0b';

                            return (
                              <HoverCard key={index}>
                                <HoverCardTrigger asChild>
                                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                                    <div className="flex items-center gap-3">
                                      <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: color }}
                                      />
                                      <span className="text-sm font-medium">{branch.branch_name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <Badge className={getScoreBadge(branch.overall_score)}>
                                        {branch.overall_score}%
                                      </Badge>
                                      <span className="text-sm font-semibold" style={{ color }}>
                                        {percentage}%
                                      </span>
                                    </div>
                                  </div>
                                </HoverCardTrigger>
                                <HoverCardContent side="top" align="start" sideOffset={8} className="w-80 bg-card border-border shadow-lg z-50">
                                  <div className="space-y-4">
                                    <h4 className="font-semibold text-base text-foreground">{branch.branch_name}</h4>
                                    <div className="space-y-3">
                                      <div className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                          <span className="text-muted-foreground">Compliance Rate</span>
                                          <span className={`font-semibold ${getScoreColor(branch.compliance_rate)}`}>{branch.compliance_rate}%</span>
                                        </div>
                                        <Progress value={branch.compliance_rate} className="h-2" />
                                      </div>
                                      
                                      <div className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                          <span className="text-muted-foreground">Document Validity</span>
                                          <span className={`font-semibold ${getScoreColor(branch.document_validity_rate)}`}>{branch.document_validity_rate}%</span>
                                        </div>
                                        <Progress value={branch.document_validity_rate} className="h-2" />
                                      </div>
                                      
                                      <div className="flex items-center justify-between text-sm pt-1 border-t border-border">
                                        <span className="text-muted-foreground">Active Employees</span>
                                        <span className="font-semibold text-foreground">{branch.active_employees}</span>
                                      </div>
                                      
                                      {branch.leave_backlog > 0 && (
                                        <div className="flex items-center justify-between text-sm">
                                          <span className="text-muted-foreground">Leave Backlog</span>
                                          <Badge variant="secondary" className="text-xs font-semibold">{branch.leave_backlog}</Badge>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                            );
                          })}
                          </div>
                        </ScrollArea>
                      </>
                    )}
                  </div>
                </CarouselItem>
              );
            }

            const total = branches.reduce((sum, branch) => 
              sum + (view === 'employees' ? branch.employeeCount : branch.clientCount), 0
            );

            return (
              <CarouselItem key={view}>
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Branch Distribution</h3>
                      <p className="text-sm text-muted-foreground">
                        {total} total {view === 'employees' ? 'employees' : 'clients'}
                      </p>
                    </div>
                  </div>

                  {/* Donut Chart */}
                  <div className="flex items-center justify-center">
                    <div className="relative w-48 h-48">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        {branches.map((branch, index) => {
                          const count = view === 'employees' ? branch.employeeCount : branch.clientCount;
                          const prevSum = branches.slice(0, index).reduce((sum, b) => 
                            sum + (view === 'employees' ? b.employeeCount : b.clientCount), 0
                          );
                          const offset = (prevSum / total) * 283;
                          const length = (count / total) * 283;
                          
                          return (
                            <circle
                              key={branch.name}
                              cx="50"
                              cy="50"
                              r="45"
                              fill="none"
                              stroke={branch.color}
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
                          <div className="text-xs text-muted-foreground">
                            {view === 'employees' ? 'Employees' : 'Clients'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <ScrollArea className="h-[280px] pr-4">
                    <div className="space-y-2">
                      {branches.map((branch) => {
                      const count = view === 'employees' ? branch.employeeCount : branch.clientCount;
                      const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
                      return (
                        <div key={branch.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: branch.color }}
                            />
                            <span className="text-sm font-medium">{branch.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">{count}</span>
                            <span className="text-sm font-semibold" style={{ color: branch.color }}>
                              {percentage}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </ScrollArea>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>
    </div>
  );
}
