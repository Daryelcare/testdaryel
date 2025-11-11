import { useState, useEffect } from "react";
import { Archive, Download, Trash2, Calendar, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DataRetentionEntry {
  id: string;
  compliance_type_id: string;
  year: number;
  period_type: string;
  period_identifier: string;
  archival_status: string;
  archival_started_at: string;
  archival_completed_at: string;
  download_available_date: string;
  total_records_archived: number;
  completion_statistics: any;
  archival_notes: string;
}

interface ComplianceType {
  id: string;
  name: string;
}

export function DataRetentionManagement() {
  const [retentionEntries, setRetentionEntries] = useState<DataRetentionEntry[]>([]);
  const [complianceTypes, setComplianceTypes] = useState<ComplianceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [retentionResult, typesResult] = await Promise.all([
        supabase
          .from('compliance_data_retention')
          .select('*')
          .order('year', { ascending: false }),
        supabase
          .from('compliance_types')
          .select('id, name')
      ]);

      if (retentionResult.error) throw retentionResult.error;
      if (typesResult.error) throw typesResult.error;

      setRetentionEntries(retentionResult.data || []);
      setComplianceTypes(typesResult.data || []);
    } catch (error) {
      console.error('Error fetching data retention entries:', error);
      toast({
        title: "Error",
        description: "Failed to load data retention information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRunArchival = async () => {
    setArchiving(true);
    try {
      const { data, error } = await supabase.functions.invoke('compliance-data-archival', {
        body: { forceArchival: false }
      });

      if (error) throw error;

      toast({
        title: "Archival Process Completed",
        description: `Processed ${data.entriesProcessed} entries, archived ${data.recordsArchived} records`,
      });

      // Refresh the data
      await fetchData();
    } catch (error) {
      console.error('Error running archival:', error);
      toast({
        title: "Error",
        description: "Failed to run archival process",
        variant: "destructive",
      });
    } finally {
      setArchiving(false);
    }
  };

  const handleDownloadData = async (entry: DataRetentionEntry) => {
    try {
      // Create a download of the completion statistics and summary
      const downloadData = {
        complianceType: getComplianceTypeName(entry.compliance_type_id),
        year: entry.year,
        periodType: entry.period_type,
        totalRecordsArchived: entry.total_records_archived,
        statistics: entry.completion_statistics,
        archivedAt: entry.archival_completed_at,
        notes: entry.archival_notes
      };

      const blob = new Blob([JSON.stringify(downloadData, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-archive-${entry.year}-${getComplianceTypeName(entry.compliance_type_id)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      // Update download timestamp
      await supabase
        .from('compliance_data_retention')
        .update({ download_requested_at: new Date().toISOString() })
        .eq('id', entry.id);

      toast({
        title: "Download Started",
        description: "Archived compliance data has been downloaded",
      });
    } catch (error) {
      console.error('Error downloading data:', error);
      toast({
        title: "Error",
        description: "Failed to download archived data",
        variant: "destructive",
      });
    }
  };

  const getComplianceTypeName = (typeId: string) => {
    const type = complianceTypes.find(t => t.id === typeId);
    return type?.name || 'Unknown';
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      processing: "outline",
      archived: "default",
      failed: "destructive"
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return <div>Loading data retention information...</div>;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Archive className="w-6 h-6 text-primary" />
          Data Retention & Archival
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">
            Manage compliance data archival and retention policies
          </p>
          <Button 
            onClick={handleRunArchival}
            disabled={archiving}
            className="bg-gradient-primary hover:opacity-90"
          >
            <Archive className="w-4 h-4 mr-2" />
            {archiving ? 'Processing...' : 'Run Archival Process'}
          </Button>
        </div>

        {retentionEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Archive className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No archived data found</p>
            <p className="text-sm">Run the archival process to begin data retention management</p>
          </div>
        ) : (
          <div className="space-y-4">
            {retentionEntries.map((entry) => (
              <Card key={entry.id} className="border-l-4 border-l-primary">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium">
                        {getComplianceTypeName(entry.compliance_type_id)} - {entry.year}
                      </h4>
                      {getStatusBadge(entry.archival_status)}
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.archival_status === 'archived' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadData(entry)}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Records Archived</p>
                      <p className="font-medium">{entry.total_records_archived}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Period Type</p>
                      <p className="font-medium capitalize">{entry.period_type}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Archived Date</p>
                      <p className="font-medium">{formatDate(entry.archival_completed_at)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Download Available</p>
                      <p className="font-medium">{formatDate(entry.download_available_date)}</p>
                    </div>
                  </div>

                  {entry.completion_statistics && Object.keys(entry.completion_statistics).length > 0 && (
                    <div className="mt-3 p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="w-4 h-4" />
                        <span className="text-sm font-medium">Completion Statistics</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        {entry.completion_statistics.completion_rate && (
                          <div>
                            <span className="text-muted-foreground">Completion Rate:</span>
                            <span className="ml-1 font-medium">{entry.completion_statistics.completion_rate}%</span>
                          </div>
                        )}
                        {entry.completion_statistics.total_records && (
                          <div>
                            <span className="text-muted-foreground">Total Records:</span>
                            <span className="ml-1 font-medium">{entry.completion_statistics.total_records}</span>
                          </div>
                        )}
                        {entry.completion_statistics.completed_records && (
                          <div>
                            <span className="text-muted-foreground">Completed:</span>
                            <span className="ml-1 font-medium">{entry.completion_statistics.completed_records}</span>
                          </div>
                        )}
                        {entry.completion_statistics.overdue_records && (
                          <div>
                            <span className="text-muted-foreground">Overdue:</span>
                            <span className="ml-1 font-medium">{entry.completion_statistics.overdue_records}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {entry.archival_notes && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <strong>Notes:</strong> {entry.archival_notes}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}