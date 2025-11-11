import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ExpiringDocument {
  employee_name: string;
  document_type: string;
  expiry_date: string;
  status: 'valid' | 'expiring' | 'expired';
}

interface DocumentsExpiringProps {
  documents: ExpiringDocument[];
}

export function DocumentsExpiring({ documents }: DocumentsExpiringProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid':
        return 'bg-success/10 text-success border-success/20';
      case 'expiring':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'expired':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const expiredCount = documents.filter(d => d.status === 'expired').length;
  const expiringCount = documents.filter(d => d.status === 'expiring').length;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Documents Expiring Soon</CardTitle>
        <AlertTriangle className="h-4 w-4 text-warning" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-foreground">{documents.length}</div>
              <p className="text-xs text-muted-foreground">next 30 days</p>
            </div>
            <div className="flex gap-2">
              {expiredCount > 0 && (
                <Badge variant="destructive" className="text-xs">{expiredCount} expired</Badge>
              )}
              {expiringCount > 0 && (
                <Badge className="bg-warning/10 text-warning border-warning/20 text-xs">{expiringCount} expiring</Badge>
              )}
            </div>
          </div>

          <ScrollArea className="h-[200px] pr-2">
            <div className="space-y-2">
              {documents.length === 0 ? (
                <p className="text-xs text-muted-foreground">No documents expiring soon</p>
              ) : (
                documents.map((doc, index) => (
                  <div
                    key={index}
                    className={`flex items-start space-x-2 rounded-lg border p-2 transition-colors ${getStatusColor(doc.status)}`}
                  >
                    <FileText className="h-4 w-4 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {doc.employee_name}
                      </p>
                      <p className="text-xs opacity-80">
                        {doc.document_type}
                      </p>
                      <p className="text-xs opacity-80">
                        Expires: {new Date(doc.expiry_date).toLocaleDateString()}
                      </p>
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
