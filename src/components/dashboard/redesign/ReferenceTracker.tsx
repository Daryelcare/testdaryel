import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ReferenceStatus {
  application_id: string;
  applicant_name: string;
  references_pending: number;
  references_received: number;
  total_references: number;
}

interface ReferenceTrackerProps {
  references: ReferenceStatus[];
}

export function ReferenceTracker({ references }: ReferenceTrackerProps) {
  const totalPending = references.reduce((sum, ref) => sum + ref.references_pending, 0);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Reference Status</CardTitle>
        <UserCheck className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="text-2xl font-bold text-foreground">{totalPending}</div>
            <p className="text-xs text-muted-foreground">references pending</p>
          </div>

          <ScrollArea className="h-[200px] pr-2">
            <div className="space-y-2">
              {references.length === 0 ? (
                <p className="text-xs text-muted-foreground">No pending references</p>
              ) : (
                references.map((ref, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-2 rounded-lg border border-border p-2 hover:bg-accent/50 transition-colors"
                  >
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium text-foreground leading-none">
                        {ref.applicant_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {ref.references_received}/{ref.total_references} received
                        </Badge>
                        {ref.references_pending > 0 && (
                          <Badge className="bg-warning/10 text-warning border-warning/20 text-xs">
                            {ref.references_pending} pending
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
