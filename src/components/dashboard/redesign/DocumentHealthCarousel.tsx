import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { FileCheck, AlertCircle, FileX2, CheckCircle2, FileText, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DocumentStats {
  total: number;
  valid: number;
  expiring: number;
  expired: number;
}

interface ExpiringDocument {
  employee_name: string;
  document_type: string;
  expiry_date: string;
  status: 'valid' | 'expiring' | 'expired';
}

interface DocumentHealthCarouselProps {
  stats: DocumentStats;
  expiringDocuments: ExpiringDocument[];
}

export function DocumentHealthCarousel({ stats, expiringDocuments }: DocumentHealthCarouselProps) {
  const healthScore = stats.total > 0 ? Math.round((stats.valid / stats.total) * 100) : 0;

  const statusItems = [
    {
      label: "Valid",
      value: stats.valid,
      icon: CheckCircle2,
      color: "text-success",
      bgColor: "bg-success/10"
    },
    {
      label: "Expiring",
      value: stats.expiring,
      icon: AlertCircle,
      color: "text-warning",
      bgColor: "bg-warning/10"
    },
    {
      label: "Expired",
      value: stats.expired,
      icon: FileX2,
      color: "text-destructive",
      bgColor: "bg-destructive/10"
    }
  ];

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

  const expiredCount = expiringDocuments.filter(d => d.status === 'expired').length;
  const expiringCount = expiringDocuments.filter(d => d.status === 'expiring').length;

  // Group documents by employee
  const groupedDocuments = expiringDocuments.reduce((acc, doc) => {
    if (!acc[doc.employee_name]) {
      acc[doc.employee_name] = [];
    }
    acc[doc.employee_name].push(doc);
    return acc;
  }, {} as Record<string, ExpiringDocument[]>);

  const groupedDocumentsList = Object.entries(groupedDocuments).map(([employee, docs]) => {
    // Determine overall status - if any expired, show expired; else if any expiring, show expiring
    const hasExpired = docs.some(d => d.status === 'expired');
    const hasExpiring = docs.some(d => d.status === 'expiring');
    const overallStatus = hasExpired ? 'expired' : hasExpiring ? 'expiring' : 'valid';
    
    return {
      employee_name: employee,
      documents: docs,
      status: overallStatus
    };
  });

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
          {/* Document Health View */}
          <CarouselItem>
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Document Health</h3>
                  <p className="text-sm text-muted-foreground">{stats.total} total documents</p>
                </div>
              </div>

              {/* Health Score Circle */}
              <div className="flex items-center justify-center">
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    {/* Background circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="hsl(var(--muted))"
                      strokeWidth="8"
                    />
                    {/* Progress circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="url(#healthGradient)"
                      strokeWidth="8"
                      strokeDasharray={`${(healthScore / 100) * 251.2} 251.2`}
                      strokeLinecap="round"
                      className="transition-all duration-1000"
                    />
                    <defs>
                      <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-4xl font-bold text-success">{healthScore}%</div>
                    <div className="text-xs text-muted-foreground">Health Score</div>
                  </div>
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="space-y-2">
                {statusItems.map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center justify-between p-3 rounded-lg ${item.bgColor}`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={`w-5 h-5 ${item.color}`} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${item.color}`}>{item.value}</span>
                      <span className="text-xs text-muted-foreground">
                        ({stats.total > 0 ? Math.round((item.value / stats.total) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CarouselItem>

          {/* Documents Expiring Soon View */}
          <CarouselItem>
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Documents Expiring Soon</h3>
                  <p className="text-sm text-muted-foreground">next 30 days</p>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <div className="text-3xl font-bold">{groupedDocumentsList.length}</div>
                  <div className="text-xs text-muted-foreground">Employees with Issues</div>
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

              {/* Document List */}
              <ScrollArea className="h-[360px] pr-2">
                <div className="space-y-2">
                  {groupedDocumentsList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                      <CheckCircle2 className="w-12 h-12 text-success/50 mb-3" />
                      <p className="text-sm text-muted-foreground">No documents expiring soon</p>
                    </div>
                  ) : (
                    groupedDocumentsList.map((group, index) => (
                      <div
                        key={index}
                        className={`rounded-lg border p-3 transition-colors hover:bg-muted/50 ${getStatusColor(group.status)}`}
                      >
                        <div className="flex items-start gap-3">
                          <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 space-y-2 min-w-0">
                            <p className="text-sm font-medium leading-none">
                              {group.employee_name}
                            </p>
                            <div className="space-y-1">
                              {group.documents.map((doc, docIndex) => (
                                <div key={docIndex} className="flex items-center justify-between text-xs opacity-80">
                                  <span className="truncate">{doc.document_type}</span>
                                  <span className="ml-2 whitespace-nowrap">
                                    {new Date(doc.expiry_date).toLocaleDateString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </CarouselItem>
        </CarouselContent>
      </Carousel>
    </div>
  );
}
