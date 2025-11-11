import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface BranchHealth {
  branch_name: string;
  compliance_rate: number;
  document_validity_rate: number;
  leave_backlog: number;
  active_employees: number;
  overall_score: number;
}

interface BranchHealthScoreProps {
  branches: BranchHealth[];
}

export function BranchHealthScore({ branches }: BranchHealthScoreProps) {
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
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Branch Health Score</CardTitle>
        <Building2 className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {branches.length === 0 ? (
            <p className="text-xs text-muted-foreground">No branch data available</p>
          ) : (
            branches.map((branch, index) => (
              <div
                key={index}
                className="space-y-2 rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">{branch.branch_name}</h4>
                  <Badge className={getScoreBadge(branch.overall_score)}>
                    {branch.overall_score}%
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Compliance</span>
                    <span className={getScoreColor(branch.compliance_rate)}>{branch.compliance_rate}%</span>
                  </div>
                  <Progress value={branch.compliance_rate} className="h-1" />

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Document Validity</span>
                    <span className={getScoreColor(branch.document_validity_rate)}>{branch.document_validity_rate}%</span>
                  </div>
                  <Progress value={branch.document_validity_rate} className="h-1" />

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-muted-foreground">Active Employees</span>
                    <span className="text-foreground font-medium">{branch.active_employees}</span>
                  </div>

                  {branch.leave_backlog > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Leave Backlog</span>
                      <Badge variant="secondary" className="text-xs">{branch.leave_backlog}</Badge>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
