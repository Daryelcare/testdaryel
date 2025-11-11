import { useState, useEffect, useMemo } from "react";
import { Calendar, Download, AlertTriangle, Plus, Eye, Edit, Trash2, Filter, Users, Search, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle, Clock, Shield, Loader2 } from "lucide-react";
import { ClientCompliancePeriodDialog } from "./ClientCompliancePeriodDialog";
import { Button } from "@/components/ui/button";
import { DownloadButton } from "@/components/ui/download-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import ClientSpotCheckFormDialog, { ClientSpotCheckFormData } from "./ClientSpotCheckFormDialog";
import { ClientSpotCheckViewDialog } from "./ClientSpotCheckViewDialog";
import { ClientComplianceRecordViewDialog } from "./ClientComplianceRecordViewDialog";
import { ClientDeleteConfirmDialog } from "./ClientDeleteConfirmDialog";
import { generateClientSpotCheckPdf } from "@/lib/client-spot-check-pdf";

import { AddClientComplianceRecordModal } from "./AddClientComplianceRecordModal";

interface ClientCompliancePeriodViewProps {
  complianceTypeId: string;
  complianceTypeName: string;
  frequency: string;
  selectedFilter?: string | null;
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

interface Client {
  id: string;
  name: string;
  branch_id: string;
  created_at: string;
  branches?: {
    name: string;
  };
}

interface ClientSpotCheckRecord {
  id?: string;
  service_user_name?: string;
  care_workers?: string;
  date?: string;
  time?: string;
  performed_by?: string;
  observations?: any[];
}

interface ClientComplianceRecord {
  id: string;
  client_id: string;
  period_identifier: string;
  status: string;
  completion_date?: string;
  completion_method?: string;
  notes?: string;
  clients?: Client;
  client_spot_check_records?: ClientSpotCheckRecord[];
}

export function ClientCompliancePeriodView({ 
  complianceTypeId, 
  complianceTypeName, 
  frequency,
  selectedFilter
}: ClientCompliancePeriodViewProps) {
  const [periods, setPeriods] = useState<PeriodData[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [clients, setClients] = useState<Client[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [spotCheckDialogOpen, setSpotCheckDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"status" | "periods">("status");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<'name' | 'branch' | 'status' | 'completion_date'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [genericViewDialogOpen, setGenericViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSpotCheckRecord, setSelectedSpotCheckRecord] = useState<any>(null);
  const [selectedComplianceRecord, setSelectedComplianceRecord] = useState<any>(null);
  const [editingSpotCheckData, setEditingSpotCheckData] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const { toast } = useToast();
  const { companySettings } = useCompany();
  const { getAccessibleBranches, isAdmin } = usePermissions();

  useEffect(() => {
    fetchData();
  }, [complianceTypeId, frequency, selectedYear]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Get accessible branches for the current user
      const accessibleBranches = getAccessibleBranches();
      
      // Build the query with branch filtering for non-admin users
      let clientsQuery = supabase
        .from('clients')
        .select(`
          *,
          branches (
            name
          )
        `);
      
      // Apply branch filtering for non-admin users
      if (!isAdmin && accessibleBranches.length > 0) {
        clientsQuery = clientsQuery.in('branch_id', accessibleBranches);
      }
      
      const { data: clientsData, error: clientsError } = await clientsQuery.order('name');

      if (clientsError) throw clientsError;

      // Fetch client compliance records
      const { data: recordsData, error: recordsError } = await supabase
        .from('client_compliance_period_records')
        .select('*')
        .eq('client_compliance_type_id', complianceTypeId)
        .order('completion_date', { ascending: false });

      if (recordsError) throw recordsError;

      setClients(clientsData || []);
      setRecords(recordsData || []);
      
      generatePeriods(clientsData || [], recordsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error loading data",
        description: "Could not fetch client compliance data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPeriod = () => {
    const now = new Date();
    switch (frequency.toLowerCase()) {
      case 'quarterly':
        return `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
      case 'annual':
        return now.getFullYear().toString();
      case 'monthly':
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      case 'weekly':
        // Calculate week number (ISO week)
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
        return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      case 'bi-annual':
      case 'biannual':
        const half = now.getMonth() < 6 ? 1 : 2;
        return `${now.getFullYear()}-H${half}`;
      default:
        return now.getFullYear().toString();
    }
  };

  const calculatePeriodStats = (periodId: string, clientsData: Client[], recordsData: any[]) => {
    const totalClients = clientsData.length;
    const periodRecords = recordsData.filter(record => record.period_identifier === periodId);
    const completedRecords = periodRecords.filter(record => 
      record.status === 'completed' || record.completion_date
    );
    
    return {
      record_count: periodRecords.length,
      completion_rate: totalClients > 0 ? (completedRecords.length / totalClients) * 100 : 0
    };
  };

  const generatePeriods = (clientsData: Client[], recordsData: any[]) => {
    const currentYear = new Date().getFullYear();
    const periods: PeriodData[] = [];
    
    const startYear = Math.max(2025, currentYear - 5);
    const endYear = currentYear;
    
    for (let year = endYear; year >= startYear; year--) {
      const isCurrentYear = year === currentYear;
      const yearsOld = currentYear - year;
      const shouldShowDownload = yearsOld >= 1; // Changed from >= 5 to >= 1 for easier testing
      const archiveDueYear = year + 6;
      
      switch (frequency.toLowerCase()) {
        case 'quarterly':
          if (year === selectedYear) {
            const currentQuarter = year === currentYear ? Math.ceil((new Date().getMonth() + 1) / 3) : 4;
            for (let quarter = currentQuarter; quarter >= 1; quarter--) {
              const periodId = `${year}-Q${quarter}`;
              const isCurrentQuarter = year === currentYear && quarter === Math.ceil((new Date().getMonth() + 1) / 3);
              const quarterStats = calculatePeriodStats(periodId, clientsData, recordsData);
              periods.push({
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
        
        case 'monthly':
          if (year === selectedYear) {
            const currentMonth = year === currentYear ? new Date().getMonth() + 1 : 12;
            for (let month = currentMonth; month >= 1; month--) {
              const periodId = `${year}-${String(month).padStart(2, '0')}`;
              const isCurrentMonth = year === currentYear && month === new Date().getMonth() + 1;
              const monthStats = calculatePeriodStats(periodId, clientsData, recordsData);
              periods.push({
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
        
        case 'weekly':
          if (year === selectedYear) {
            const now = new Date();
            const currentWeek = year === currentYear ? (() => {
              const startOfYear = new Date(year, 0, 1);
              const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
              return Math.ceil((days + startOfYear.getDay() + 1) / 7);
            })() : 52;
            
            for (let week = currentWeek; week >= 1; week--) {
              const periodId = `${year}-W${String(week).padStart(2, '0')}`;
              const isCurrentWeek = year === currentYear && week === currentWeek;
              const weekStats = calculatePeriodStats(periodId, clientsData, recordsData);
              periods.push({
                period_identifier: periodId,
                year,
                record_count: weekStats.record_count,
                completion_rate: weekStats.completion_rate,
                download_available: shouldShowDownload,
                archive_due_date: shouldShowDownload ? `${archiveDueYear}-01-01` : undefined,
                download_available_date: shouldShowDownload ? `${archiveDueYear - 1}-10-01` : undefined,
                is_current: isCurrentWeek
              });
            }
          }
          break;
        
        case 'bi-annual':
        case 'biannual':
          if (year === selectedYear) {
            const currentHalf = year === currentYear ? (new Date().getMonth() < 6 ? 1 : 2) : 2;
            for (let half = currentHalf; half >= 1; half--) {
              const periodId = `${year}-H${half}`;
              const isCurrentHalf = year === currentYear && ((new Date().getMonth() < 6 && half === 1) || (new Date().getMonth() >= 6 && half === 2));
              const halfStats = calculatePeriodStats(periodId, clientsData, recordsData);
              periods.push({
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
        
        case 'annual':
          const annualStats = calculatePeriodStats(year.toString(), clientsData, recordsData);
          periods.push({
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
      }
    }
    
    setPeriods(periods);
    if (periods.length > 0 && !selectedPeriod) {
      const currentPeriod = periods.find(p => p.is_current) || periods[0];
      setSelectedPeriod(currentPeriod.period_identifier);
    }
  };

  const handleSpotCheckSubmit = async (data: ClientSpotCheckFormData) => {
    if (!selectedClient || !selectedPeriod) return;
    if (!complianceTypeId) {
      toast({
        title: "Setup required",
        description: "Client compliance type is not linked. Please configure it in Settings.",
        variant: "destructive",
      });
      return;
    }

    console.log('💾 Saving spot check with complianceTypeId:', complianceTypeId);
    console.log('💾 Editing mode:', !!editingSpotCheckData);

    try {
      // Get current user for audit trail
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      // Create or update the compliance period record
      const { data: updated, error: updateError } = await supabase
        .from('client_compliance_period_records')
        .update({
          status: 'completed',
          completion_date: data.date,
          completion_method: 'spotcheck',
          completed_by: userId,
          updated_by: userId
        })
        .eq('client_compliance_type_id', complianceTypeId)
        .eq('client_id', selectedClient.id)
        .eq('period_identifier', selectedPeriod)
        .select('id');

      if (updateError) throw updateError;

      let complianceRecordId: string;

      if (updated && updated.length > 0) {
        complianceRecordId = updated[0].id;
        console.log('✅ Updated compliance record:', complianceRecordId);
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('client_compliance_period_records')
          .insert({
            client_compliance_type_id: complianceTypeId,
            client_id: selectedClient.id,
            period_identifier: selectedPeriod,
            status: 'completed',
            completion_date: data.date,
            completion_method: 'spotcheck',
            completed_by: userId,
            created_by: userId,
            updated_by: userId
          })
          .select('id')
          .maybeSingle();

        if (insertError) throw insertError;
        if (!inserted) throw new Error('Failed to create compliance record');
        complianceRecordId = inserted.id;
        console.log('✅ Created compliance record:', complianceRecordId);
      }

      // Check if we're editing an existing spot check
      if (editingSpotCheckData) {
        // Find existing spot check record
        const { data: existing } = await supabase
          .from('client_spot_check_records')
          .select('id')
          .eq('compliance_record_id', complianceRecordId)
          .maybeSingle();

        if (existing) {
          // Update existing record
          console.log('📝 Updating existing spot check:', existing.id);
          const { error: updateSpotCheckError } = await supabase
            .from('client_spot_check_records')
            .update({
              service_user_name: data.serviceUserName,
              date: data.date,
              performed_by: data.completedBy,
              observations: data.observations as any,
              updated_by: userId,
              time: null
            })
            .eq('id', existing.id);

          if (updateSpotCheckError) throw updateSpotCheckError;
        } else {
          // Insert new record if not found
          console.log('➕ Creating new spot check (editing mode but no existing record)');
          const { error: insertSpotCheckError } = await supabase
            .from('client_spot_check_records')
            .insert({
              client_id: selectedClient.id,
              compliance_record_id: complianceRecordId,
              service_user_name: data.serviceUserName,
              care_workers: '',
              date: data.date,
              time: null,
              performed_by: data.completedBy,
              observations: data.observations as any,
              created_by: userId,
              updated_by: userId
            });

          if (insertSpotCheckError) throw insertSpotCheckError;
        }
      } else {
        // Insert new spot check record
        console.log('➕ Creating new spot check');
        const { error: spotCheckError } = await supabase
          .from('client_spot_check_records')
          .insert({
            client_id: selectedClient.id,
            compliance_record_id: complianceRecordId,
            service_user_name: data.serviceUserName,
            care_workers: '',
            date: data.date,
            time: null,
            performed_by: data.completedBy,
            observations: data.observations as any,
            created_by: userId,
            updated_by: userId
          });

        if (spotCheckError) throw spotCheckError;
      }

      toast({
        title: editingSpotCheckData ? "Spot check updated" : "Spot check completed",
        description: `Spot check for ${selectedClient.name} has been saved successfully.`,
      });

      setSpotCheckDialogOpen(false);
      setSelectedClient(null);
      setEditingSpotCheckData(null);
      fetchData();
    } catch (error) {
      console.error('❌ Error saving spot check:', error);
      toast({
        title: "Error saving spot check",
        description: "Could not save the spot check. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditSpotCheck = async (client: Client) => {
    try {
      console.log('🔍 Starting edit spot check for client:', client.name);
      console.log('🔍 Period:', selectedPeriod);
      console.log('🔍 Compliance Type ID:', complianceTypeId);

      // Fetch the compliance record for this client and period
      const { data: complianceRecord, error: complianceError } = await supabase
        .from('client_compliance_period_records')
        .select('*')
        .eq('client_compliance_type_id', complianceTypeId)
        .eq('client_id', client.id)
        .eq('period_identifier', selectedPeriod)
        .maybeSingle();

      if (complianceError) {
        console.error('❌ Compliance record error:', complianceError);
        throw complianceError;
      }

      console.log('📄 Compliance record:', complianceRecord);

      if (!complianceRecord) {
        // No existing compliance record; proceed to fallback lookup by client/date range
        console.log('❌ No compliance record found. Proceeding with fallback lookup by client/date.');
      }

      // Try to fetch existing spot check record for this compliance record when available
      let spotCheckRecord: any = null;
      if (complianceRecord?.id) {
        const { data: scByCompliance, error: spotCheckError } = await supabase
          .from('client_spot_check_records')
          .select('*')
          .eq('compliance_record_id', complianceRecord.id)
          .maybeSingle();

        if (spotCheckError && spotCheckError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          console.error('❌ Spot check record error:', spotCheckError);
          throw spotCheckError;
        }
        spotCheckRecord = scByCompliance;
      }

      console.log('🎯 Spot check record (by compliance link):', spotCheckRecord);

      let formData;
      
      if (spotCheckRecord) {
        // Transform the database record to match the form data structure
        let observations = [];
        try {
          if (spotCheckRecord.observations) {
            console.log('📋 Raw observations:', spotCheckRecord.observations);
            if (typeof spotCheckRecord.observations === 'string') {
              observations = JSON.parse(spotCheckRecord.observations);
            } else if (Array.isArray(spotCheckRecord.observations)) {
              observations = spotCheckRecord.observations;
            } else if (typeof spotCheckRecord.observations === 'object') {
              observations = Object.values(spotCheckRecord.observations);
            }
            console.log('✅ Parsed observations:', observations);
          }
        } catch (e) {
          console.warn('Failed to parse observations:', e);
          observations = [];
        }

        formData = {
          serviceUserName: spotCheckRecord.service_user_name || client.name,
          date: spotCheckRecord.date || complianceRecord.completion_date || '',
          completedBy: spotCheckRecord.performed_by || '',
          observations: observations
        };
        console.log('📝 Setting form data from spot check:', formData);
      } else {
        // Try fallback: find spot check by client_id and date range when compliance_record_id is missing
        try {
          const periodId = selectedPeriod;
          const freq = (frequency || '').toLowerCase();
          const toISO = (d: Date) => d.toISOString().slice(0,10);
          let start: string; let end: string;
          if (freq === 'quarterly' && /\d{4}-Q[1-4]/.test(periodId)) {
            const [y, qStr] = periodId.split('-Q');
            const year = parseInt(y, 10); const q = parseInt(qStr, 10);
            const mStart = (q - 1) * 3; // 0-indexed
            start = toISO(new Date(year, mStart, 1));
            end = toISO(new Date(year, mStart + 3, 0));
          } else if (freq === 'monthly' && /\d{4}-\d{2}/.test(periodId)) {
            const [y, m] = periodId.split('-');
            const year = parseInt(y, 10); const month = parseInt(m, 10) - 1;
            start = toISO(new Date(year, month, 1));
            end = toISO(new Date(year, month + 1, 0));
          } else {
            const year = parseInt(periodId.slice(0,4), 10);
            start = toISO(new Date(year, 0, 1));
            end = toISO(new Date(year, 11, 31));
          }

          const { data: fallbackRecord, error: fbErr } = await supabase
            .from('client_spot_check_records')
            .select('*')
            .eq('client_id', client.id)
            .gte('date', start)
            .lte('date', end)
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (fbErr && fbErr.code !== 'PGRST116') {
            console.warn('⚠️ Fallback query error:', fbErr);
          }

          if (fallbackRecord) {
            let observations: any[] = [];
            try {
              const raw = fallbackRecord.observations;
              if (typeof raw === 'string') {
                observations = JSON.parse(raw);
              } else if (Array.isArray(raw)) {
                observations = raw;
              } else if (raw && typeof raw === 'object') {
                observations = Object.values(raw as any);
              }
            } catch (e) {
              console.warn('Failed to parse fallback observations:', e);
            }
            formData = {
              serviceUserName: fallbackRecord.service_user_name || client.name,
              date: fallbackRecord.date || complianceRecord?.completion_date || '',
              completedBy: fallbackRecord.performed_by || '',
              observations
            };
            console.log('📝 Using fallback spot check data:', formData);
          } else {
            // No spot check record found anywhere, create basic form data from compliance record
            formData = {
              serviceUserName: client.name,
              date: complianceRecord.completion_date || '',
              completedBy: '',
              observations: []
            };
            console.log('📝 No spot check found, setting basic form data:', formData);
          }
        } catch (e) {
          console.warn('Fallback retrieval failed, defaulting to basic form:', e);
          formData = {
            serviceUserName: client.name,
            date: complianceRecord.completion_date || '',
            completedBy: '',
            observations: []
          };
        }
      }

      // Set state and wait for it to update
      setSelectedClient(client);
      setEditingSpotCheckData(formData);
      
      // Wait for next tick to ensure state has updated
      await new Promise(resolve => setTimeout(resolve, 0));
      
      console.log('🚀 Opening dialog');
      setSpotCheckDialogOpen(true);
      
    } catch (error) {
      console.error('❌ Error fetching spot check data:', error);
      toast({
        title: "Error loading data",
        description: "Could not load existing compliance data for editing.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadPeriod = async (period: PeriodData) => {
    try {
      // Fetch all client compliance records for this period (don't filter by status - include all records that have data)
      const { data: periodRecords, error: recordsError } = await supabase
        .from('client_compliance_period_records')
        .select(`
          *,
          clients (
            name,
            branches (
              name
            )
          ),
          client_spot_check_records (
            *
          )
        `)
        .eq('client_compliance_type_id', complianceTypeId)
        .eq('period_identifier', period.period_identifier);

      if (recordsError) throw recordsError;

      if (!periodRecords || periodRecords.length === 0) {
        toast({
          title: "No data to download",
          description: "No completed compliance records found for this period.",
          variant: "destructive",
        });
        return;
      }

      let downloadCount = 0;

       for (const record of periodRecords) {
         // Prefer nested spot check, but fall back to client/date-range lookup when missing
         let sc: any = (record as any)?.client_spot_check_records?.[0];
 
         // Helper to parse observations stored as JSON text/array/object map
         const parseObs = (raw: any) => {
           let obs: any = raw;
           if (typeof obs === 'string') {
             try { obs = JSON.parse(obs); } catch { obs = []; }
           }
           if (obs && !Array.isArray(obs) && typeof obs === 'object') {
             obs = Object.values(obs);
           }
           return Array.isArray(obs)
             ? obs.map((o: any) => ({
                 label: o?.label || 'Unknown Question',
                 value: o?.value || 'Not Rated',
                 comments: o?.comments || ''
               }))
             : [];
         };
 
         // Fallback query when no nested link or empty observations
         let transformedObservations: any[] = parseObs(sc?.observations);
         if (!sc || transformedObservations.length === 0) {
           const periodId = period.period_identifier;
           const freq = (frequency || '').toLowerCase();
           const toISO = (d: Date) => d.toISOString().slice(0,10);
           let start: string; let end: string;
           if (freq === 'quarterly' && /\d{4}-Q[1-4]/.test(periodId)) {
             const [y, qStr] = periodId.split('-Q');
             const year = parseInt(y, 10); const q = parseInt(qStr, 10);
             const mStart = (q - 1) * 3; // 0-indexed
             start = toISO(new Date(year, mStart, 1));
             end = toISO(new Date(year, mStart + 3, 0));
           } else if (freq === 'monthly' && /\d{4}-\d{2}/.test(periodId)) {
             const [y, m] = periodId.split('-');
             const year = parseInt(y, 10); const month = parseInt(m, 10) - 1;
             start = toISO(new Date(year, month, 1));
             end = toISO(new Date(year, month + 1, 0));
           } else {
             const year = parseInt(periodId.slice(0,4), 10);
             start = toISO(new Date(year, 0, 1));
             end = toISO(new Date(year, 11, 31));
           }
           const { data: fallbackSC } = await supabase
             .from('client_spot_check_records')
             .select('*')
             .eq('client_id', record.client_id)
             .gte('date', start)
             .lte('date', end)
             .order('date', { ascending: false })
             .maybeSingle();
           if (fallbackSC) {
             sc = fallbackSC;
             transformedObservations = parseObs(fallbackSC.observations);
           }
         }
 
         if (sc && transformedObservations.length > 0) {
           const pdfData = {
             serviceUserName: sc?.service_user_name || record.clients?.name || 'Unknown',
             date: sc?.date || record.completion_date || '',
             completedBy: sc?.performed_by || 'Not specified',
             observations: transformedObservations,
           };
 
           await generateClientSpotCheckPdf(pdfData, {
             name: companySettings?.name,
             logo: companySettings?.logo
           });
           downloadCount++;
         }
       }

      if (downloadCount === 0) {
        toast({
          title: "No spot check data found",
          description: "No spot check records found for completed compliance records.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Download completed",
        description: `Downloaded ${downloadCount} compliance records for ${getPeriodLabel(period.period_identifier)}.`,
      });

    } catch (error) {
      console.error('Error downloading period data:', error);
      toast({
        title: "Download failed",
        description: "Could not download the compliance records. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadAllPDFs = async () => {
    setIsDownloadingAll(true);
    setDownloadProgress(0);
    
    const eligibleClients = filteredAndSortedClients.filter(client => {
      const record = getClientRecordForPeriod(client.id, selectedPeriod);
      return record && 
        (record.status === 'completed' || record.completion_date) &&
        record.completion_method &&
        ['spotcheck', 'supervision', 'annual_appraisal', 'medication_competency', 'questionnaire'].includes(record.completion_method);
    });

    toast({
      title: "Starting Bulk Download",
      description: `Preparing to download ${eligibleClients.length} PDFs...`,
    });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < eligibleClients.length; i++) {
      const client = eligibleClients[i];
      setDownloadProgress(i + 1);

      try {
        const record = getClientRecordForPeriod(client.id, selectedPeriod);
        if (!record) continue;

        const method = record.completion_method;
        
        // Add small delay between downloads to prevent overwhelming the browser
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        switch (method) {
          case 'spotcheck':
            // Fetch spot check record
            let sc: any = null;
            const { data: spotCheckData } = await supabase
              .from('client_spot_check_records')
              .select('*')
              .eq('compliance_record_id', record.id)
              .maybeSingle();

            if (spotCheckData) {
              sc = spotCheckData;
            } else {
              // Fallback query when no linked spot check
              const periodId = selectedPeriod;
              const freq = (frequency || '').toLowerCase();
              const toISO = (d: Date) => d.toISOString().slice(0,10);
              let start: string; let end: string;
              if (freq === 'quarterly' && /\d{4}-Q[1-4]/.test(periodId)) {
                const [y, qStr] = periodId.split('-Q');
                const year = parseInt(y, 10); const q = parseInt(qStr, 10);
                const mStart = (q - 1) * 3;
                start = toISO(new Date(year, mStart, 1));
                end = toISO(new Date(year, mStart + 3, 0));
              } else if (freq === 'monthly' && /\d{4}-\d{2}/.test(periodId)) {
                const [y, m] = periodId.split('-');
                const year = parseInt(y, 10); const month = parseInt(m, 10) - 1;
                start = toISO(new Date(year, month, 1));
                end = toISO(new Date(year, month + 1, 0));
              } else {
                const year = parseInt(periodId.slice(0,4), 10);
                start = toISO(new Date(year, 0, 1));
                end = toISO(new Date(year, 11, 31));
              }
              const { data: fallbackSC } = await supabase
                .from('client_spot_check_records')
                .select('*')
                .eq('client_id', client.id)
                .gte('date', start)
                .lte('date', end)
                .order('date', { ascending: false })
                .maybeSingle();
              if (fallbackSC) sc = fallbackSC;
            }

            if (sc) {
              // Parse observations
              let observations: any = sc.observations;
              if (typeof observations === 'string') {
                try { observations = JSON.parse(observations); } catch { observations = []; }
              }
              if (observations && !Array.isArray(observations) && typeof observations === 'object') {
                observations = Object.values(observations);
              }
              const transformedObservations = Array.isArray(observations)
                ? observations.map((o: any) => ({
                    label: o?.label || 'Unknown Question',
                    value: o?.value || 'Not Rated',
                    comments: o?.comments || ''
                  }))
                : [];

              if (transformedObservations.length > 0) {
                const pdfData = {
                  serviceUserName: sc.service_user_name || client.name,
                  date: sc.date || record.completion_date || '',
                  completedBy: sc.performed_by || 'Not specified',
                  observations: transformedObservations,
                };

                await generateClientSpotCheckPdf(pdfData, {
                  name: companySettings?.name,
                  logo: companySettings?.logo
                });
              }
            }
            break;

          case 'supervision':
          case 'annual_appraisal':
          case 'medication_competency':
          case 'questionnaire':
            // Future client compliance methods can be implemented here
            // For now, these are not supported for clients
            console.warn(`Completion method "${method}" not yet implemented for client compliance`);
            break;
        }
        
        successCount++;
      } catch (error) {
        console.error(`Error downloading PDF for ${client.name}:`, error);
        errorCount++;
      }
    }

    setIsDownloadingAll(false);
    setDownloadProgress(0);

    toast({
      title: "Bulk Download Complete",
      description: `Successfully downloaded ${successCount} PDFs${errorCount > 0 ? `, ${errorCount} failed` : ''}.`,
    });
  };

  const getPeriodLabel = (periodId: string) => {
    switch (frequency.toLowerCase()) {
      case 'quarterly':
        return periodId.replace('-', ' ');
      case 'monthly':
        const [year, month] = periodId.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
      case 'weekly':
        const [weekYear, weekNum] = periodId.split('-W');
        return `Week ${parseInt(weekNum)} ${weekYear}`;
      case 'bi-annual':
      case 'biannual':
        const [halfYear, half] = periodId.split('-H');
        return `H${half} ${halfYear}`;
      case 'annual':
        return `Year ${periodId}`;
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

  const getClientRecordForPeriod = (clientId: string, periodId: string) => {
    return records.find(r => 
      r.client_id === clientId && 
      r.period_identifier === periodId
    );
  };

  const isPeriodOverdue = (periodIdentifier: string, frequency: string, currentDate: Date): boolean => {
    const now = currentDate;
    
    switch (frequency.toLowerCase()) {
      case 'annual': {
        const year = parseInt(periodIdentifier);
        const endOfYear = new Date(year, 11, 31); // December 31st
        return now > endOfYear;
      }
      case 'monthly': {
        const [year, month] = periodIdentifier.split('-').map(Number);
        const endOfMonth = new Date(year, month, 0); // Last day of the month
        return now > endOfMonth;
      }
      case 'quarterly': {
        const [year, quarterStr] = periodIdentifier.split('-');
        const quarter = parseInt(quarterStr.replace('Q', ''));
        const endMonth = quarter * 3; // Q1=3, Q2=6, Q3=9, Q4=12
        const endOfQuarter = new Date(parseInt(year), endMonth, 0); // Last day of quarter
        return now > endOfQuarter;
      }
      case 'weekly': {
        const [year, weekStr] = periodIdentifier.split('-W');
        const weekNum = parseInt(weekStr);
        // Calculate end of week (Sunday)
        const startOfYear = new Date(parseInt(year), 0, 1);
        const daysToAdd = (weekNum * 7) - startOfYear.getDay();
        const endOfWeek = new Date(parseInt(year), 0, daysToAdd);
        return now > endOfWeek;
      }
      case 'bi-annual':
      case 'biannual': {
        const [year, halfStr] = periodIdentifier.split('-H');
        const half = parseInt(halfStr);
        const endMonth = half === 1 ? 6 : 12;
        const endOfHalf = new Date(parseInt(year), endMonth, 0);
        return now > endOfHalf;
      }
      default:
        return false;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'compliant':
        return "bg-success/10 text-success border-success/20";
      case 'overdue':
        return "bg-destructive/10 text-destructive border-destructive/20";
      case 'due':
        return "bg-warning/10 text-warning border-warning/20";
      case 'pending':
      default:
        return "bg-warning/10 text-warning border-warning/20";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
      case 'compliant':
        return 'Compliant';
      case 'overdue':
        return 'Overdue';
      case 'due':
        return 'Due';
      case 'pending':
      default:
        return 'Due';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'compliant':
        return 'bg-success/5 border-success/20';
      case 'overdue':
        return 'bg-destructive/5 border-destructive/20';
      case 'due':
        return 'bg-warning/5 border-warning/20';
      case 'pending':
      default:
        return 'bg-warning/5 border-warning/20';
    }
  };

  // Filtered and sorted clients
  const filteredAndSortedClients = useMemo(() => {
    // Early return if required data is not yet available
    if (!selectedPeriod || !frequency) {
      return [];
    }

    // Calculate period end date to filter out clients created after this period
    const getPeriodEndDate = (periodId: string, freq: string): Date => {
      switch (freq.toLowerCase()) {
        case 'annual': {
          const year = parseInt(periodId);
          return new Date(year, 11, 31); // December 31st
        }
        case 'monthly': {
          const [year, month] = periodId.split('-').map(Number);
          return new Date(year, month, 0); // Last day of the month
        }
        case 'quarterly': {
          const [year, quarterStr] = periodId.split('-');
          const quarter = parseInt(quarterStr.replace('Q', ''));
          const endMonth = quarter * 3; // Q1=3, Q2=6, Q3=9, Q4=12
          return new Date(parseInt(year), endMonth, 0); // Last day of quarter
        }
        case 'bi-annual':
        case 'biannual': {
          const [year, halfStr] = periodId.split('-');
          const half = parseInt(halfStr.replace('H', ''));
          const endMonth = half === 1 ? 6 : 12;
          return new Date(parseInt(year), endMonth, 0);
        }
        case 'weekly': {
          const [year, weekStr] = periodId.split('-W');
          const week = parseInt(weekStr);
          const firstDayOfYear = new Date(parseInt(year), 0, 1);
          const daysToAdd = (week - 1) * 7 + 6; // Last day of the week
          return new Date(firstDayOfYear.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        }
        default:
          return new Date();
      }
    };

    const periodEndDate = getPeriodEndDate(selectedPeriod, frequency);
    
    // Filter out clients created after the period end date
    let filtered = clients.filter(client => {
      const clientCreatedDate = new Date(client.created_at);
      return clientCreatedDate <= periodEndDate;
    });

    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.branches?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by branch
    if (selectedBranch !== "all") {
      filtered = filtered.filter(client => client.branch_id === selectedBranch);
    }

    // Filter by status if selectedFilter is provided
    if (selectedFilter) {
      filtered = filtered.filter(client => {
        const record = getClientRecordForPeriod(client.id, selectedPeriod);
        // Check both status field and is_overdue flag
        const status = (record?.status === 'overdue' || record?.is_overdue === true) 
          ? 'overdue' 
          : (record?.status || 'pending');
        
        switch (selectedFilter) {
          case 'completed':
            return status === 'completed';
          case 'due':
            return status === 'pending';
          case 'overdue':
            return status === 'overdue';
          case 'pending':
            return status === 'pending';
          default:
            return true;
        }
      });
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'branch':
          aValue = a.branches?.name || 'Unassigned';
          bValue = b.branches?.name || 'Unassigned';
          break;
        case 'status':
          const aRecord = getClientRecordForPeriod(a.id, selectedPeriod);
          const bRecord = getClientRecordForPeriod(b.id, selectedPeriod);
          const statusOrder = { 'completed': 3, 'pending': 2, 'overdue': 1 };
          // Check both status field and is_overdue flag for sorting
          const aStatus = (aRecord?.status === 'overdue' || aRecord?.is_overdue === true) 
            ? 'overdue' 
            : (aRecord?.status || 'pending');
          const bStatus = (bRecord?.status === 'overdue' || bRecord?.is_overdue === true) 
            ? 'overdue' 
            : (bRecord?.status || 'pending');
          aValue = statusOrder[aStatus] || 0;
          bValue = statusOrder[bStatus] || 0;
          break;
        case 'completion_date':
          const aRecordDate = getClientRecordForPeriod(a.id, selectedPeriod);
          const bRecordDate = getClientRecordForPeriod(b.id, selectedPeriod);
          aValue = aRecordDate?.completion_date ? new Date(aRecordDate.completion_date).getTime() : 0;
          bValue = bRecordDate?.completion_date ? new Date(bRecordDate.completion_date).getTime() : 0;
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [clients, searchTerm, selectedBranch, selectedFilter, selectedPeriod, sortField, sortDirection]);

  // Calculate completed records count for download all button
  const completedRecordsCount = useMemo(() => {
    return filteredAndSortedClients.filter(client => {
      const record = getClientRecordForPeriod(client.id, selectedPeriod);
      return record && 
        (record.status === 'completed' || record.completion_date) &&
        record.completion_method === 'spotcheck';
    }).length;
  }, [filteredAndSortedClients, selectedPeriod]);

  // Pagination calculations
  const totalItems = filteredAndSortedClients.length;
  const effectiveItemsPerPage = itemsPerPage >= 999999 ? totalItems : itemsPerPage;
  const totalPages = Math.ceil(totalItems / effectiveItemsPerPage);
  const startIndex = (currentPage - 1) * effectiveItemsPerPage;
  const endIndex = startIndex + effectiveItemsPerPage;
  const paginatedClients = filteredAndSortedClients.slice(startIndex, endIndex);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranch, selectedPeriod]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    if (value === "all") {
      setItemsPerPage(filteredAndSortedClients.length || 999999);
    } else {
      setItemsPerPage(parseInt(value));
    }
    setCurrentPage(1);
  };

  const getUniqueBranches = () => {
    const branches = clients.map(client => ({
      id: client.branch_id || 'unassigned',
      name: client.branches?.name || 'Unassigned'
    }));
    
    // Remove duplicates
    const uniqueBranches = branches.filter((branch, index, self) => 
      index === self.findIndex(b => b.id === branch.id)
    );
    
    return uniqueBranches;
  };

  const handleSort = (field: 'name' | 'branch' | 'status' | 'completion_date') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: 'name' | 'branch' | 'status' | 'completion_date') => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4" />
      : <ArrowDown className="w-4 h-4" />;
  };

  if (loading) {
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
      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "status" | "periods")} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-gradient-to-r from-muted/50 to-muted/30 p-1">
          <TabsTrigger 
            value="status" 
            className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground"
          >
            <Users className="w-4 h-4" />
            Client Compliance Status
          </TabsTrigger>
          <TabsTrigger 
            value="periods"
            className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground"
          >
            <Calendar className="w-4 h-4" />
            Period Records
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-6">
          {selectedPeriod && (
            <div className="space-y-6">
              <div className="flex flex-col space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                      Client Compliance Overview
                    </h3>
                    <p className="text-muted-foreground">Current Period: {getPeriodLabel(selectedPeriod)}</p>
                  </div>
                </div>
                
                <Card className="bg-gradient-to-br from-card via-card/50 to-background border-border/50 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                          <Shield className="w-5 h-5 text-primary" />
                        </div>
                        <CardTitle className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent font-bold">
                          Client Compliance Status
                        </CardTitle>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        {/* Search */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="Search clients..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 w-64 bg-background border-border/50 focus:border-primary/50"
                          />
                        </div>
                        
                        {/* Branch Filter */}
                        <div className="flex items-center gap-2">
                          <Filter className="w-4 h-4 text-muted-foreground" />
                          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                            <SelectTrigger className="w-40 bg-background border-border/50 focus:border-primary/50">
                              <SelectValue placeholder="All Branches" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50">
                              <SelectItem value="all">All Branches</SelectItem>
                              {getUniqueBranches().map((branch) => (
                                <SelectItem key={branch.id} value={branch.id}>
                                  {branch.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Download All PDFs Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownloadAllPDFs}
                          disabled={isDownloadingAll || completedRecordsCount === 0 || !selectedPeriod}
                          className="flex items-center gap-2"
                        >
                          {isDownloadingAll ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Downloading... ({downloadProgress}/{completedRecordsCount})
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              Download All PDFs ({completedRecordsCount})
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-muted/50 to-muted/30 hover:bg-muted/60">
                          <TableHead 
                            className="font-semibold cursor-pointer hover:bg-muted/20 transition-colors"
                            onClick={() => handleSort('name')}
                          >
                            <div className="flex items-center gap-2">
                              Client Name
                              {getSortIcon('name')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="font-semibold cursor-pointer hover:bg-muted/20 transition-colors"
                            onClick={() => handleSort('branch')}
                          >
                            <div className="flex items-center gap-2">
                              Branch
                              {getSortIcon('branch')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="font-semibold cursor-pointer hover:bg-muted/20 transition-colors"
                            onClick={() => handleSort('status')}
                          >
                            <div className="flex items-center gap-2">
                              Status
                              {getSortIcon('status')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="font-semibold cursor-pointer hover:bg-muted/20 transition-colors"
                            onClick={() => handleSort('completion_date')}
                          >
                            <div className="flex items-center gap-2">
                              Completion Date
                              {getSortIcon('completion_date')}
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold">Notes</TableHead>
                          <TableHead className="font-semibold">Actions</TableHead>
                        </TableRow>
                       </TableHeader>
                        <TableBody>
                           {paginatedClients.map((client) => {
                            const record = getClientRecordForPeriod(client.id, selectedPeriod);
                            
                            // Determine status - show as compliant or due (not pending)
                            let status: string;
                            if (record?.status === 'completed' || record?.completion_date) {
                              status = 'compliant';
                            } else {
                              // Check if period is overdue based on actual dates
                              const now = new Date();
                              const isOverdue = isPeriodOverdue(selectedPeriod, frequency, now);
                              status = isOverdue ? 'overdue' : 'due';
                            }
                            
                            const isCompleted = status === 'compliant';
                      
                            return (
                              <TableRow key={client.id} className={`group hover:bg-gradient-to-r hover:from-muted/20 hover:to-transparent transition-all duration-200 border-b border-border/50 ${getStatusColor(status)}`}>
                               <TableCell className="font-semibold text-foreground">{client.name}</TableCell>
                               <TableCell className="text-muted-foreground">{client.branches?.name || 'Unassigned'}</TableCell>
                               <TableCell>
                                 <Badge className={`${getStatusBadge(status)} font-medium`}>
                                   {getStatusText(status)}
                                 </Badge>
                               </TableCell>
                               <TableCell className="text-muted-foreground">
                                 {record?.completion_date && record.completion_date !== '' 
                                   ? record.completion_date 
                                   : '-'
                                 }
                               </TableCell>
                                <TableCell className="text-muted-foreground">
                                  <div className="max-w-xs truncate">
                                    {(() => {
                                      const notes = record?.notes || '';
                                      // Filter out auto-generated messages
                                      if (!notes || notes.startsWith('Auto-generated for period:')) return '-';
                                      return notes;
                                    })()}
                                  </div>
                                </TableCell>
                               <TableCell>
                                  <div className="flex items-center gap-2">
                                    {isCompleted && (
                                      <>
                                        {record?.completion_method === 'spotcheck' && (
                                          <DownloadButton
                                            onDownload={async () => {
                                              const record = getClientRecordForPeriod(client.id, selectedPeriod);
                                              if (!record) {
                                                toast({
                                                  title: "No record found",
                                                  description: "No compliance record found for this client.",
                                                  variant: "destructive",
                                                });
                                                return;
                                              }

                                              // Get spot check data for this client and period
                                              const { data: spotCheckData, error: spotCheckError } = await supabase
                                                .from('client_spot_check_records')
                                                .select('*')
                                                .eq('compliance_record_id', record.id)
                                                .maybeSingle();

                                              if (spotCheckError) {
                                                console.error('Error fetching spot check data:', spotCheckError);
                                              }

                                              // If no direct link, try to find by client_id and date range
                                              let finalSpotCheckData = spotCheckData;
                                              if (!spotCheckData) {
                                                // Parse period to get date range
                                                const periodDate = parseFloat(selectedPeriod);
                                                if (!isNaN(periodDate)) {
                                                  const startDate = new Date(periodDate, 0, 1).toISOString().split('T')[0];
                                                  const endDate = new Date(periodDate, 11, 31).toISOString().split('T')[0];
                                                  
                                                  const { data: fallbackData, error: fallbackError } = await supabase
                                                    .from('client_spot_check_records')
                                                    .select('*')
                                                    .eq('client_id', client.id)
                                                    .gte('date', startDate)
                                                    .lte('date', endDate)
                                                    .order('created_at', { ascending: false })
                                                    .limit(1)
                                                    .maybeSingle();

                                                  if (!fallbackError && fallbackData) {
                                                    finalSpotCheckData = fallbackData;
                                                  }
                                                }
                                              }

                                              // Generate client compliance PDF
                                              const { generateClientSpotCheckPdf } = await import('@/lib/client-spot-check-pdf');
                                              
                                              let observations = [];
                                              if (finalSpotCheckData?.observations) {
                                                try {
                                                  // Handle different data formats
                                                  if (Array.isArray(finalSpotCheckData.observations)) {
                                                    observations = finalSpotCheckData.observations;
                                                  } else if (typeof finalSpotCheckData.observations === 'string') {
                                                    observations = JSON.parse(finalSpotCheckData.observations);
                                                  } else if (typeof finalSpotCheckData.observations === 'object') {
                                                    // Convert object keys to array format
                                                    observations = Object.entries(finalSpotCheckData.observations).map(([key, value]: [string, any]) => ({
                                                      id: key,
                                                      label: value.label || key,
                                                      value: value.value || value,
                                                      comments: value.comments || ''
                                                    }));
                                                  }
                                                } catch (e) {
                                                  console.error('Error parsing observations:', e);
                                                  observations = [];
                                                }
                                              }

                                              await generateClientSpotCheckPdf({
                                                serviceUserName: finalSpotCheckData?.service_user_name || client.name,
                                                date: finalSpotCheckData?.date || '',
                                                completedBy: finalSpotCheckData?.performed_by || '',
                                                observations: observations
                                              }, {
                                                name: companySettings?.name,
                                                logo: companySettings?.logo
                                              });
                                              
                                              toast({
                                                title: "PDF Downloaded",
                                                description: `Compliance record for ${client.name} has been downloaded.`,
                                              });
                                            }}
                                            downloadingText="Generating PDF..."
                                            completedText="Downloaded"
                                            className="h-8 w-8"
                                          />
                                        )}
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
                                          title="View Record"
                                          onClick={() => {
                                            const spotCheckRecord = record.client_spot_check_records?.[0];
                                            if (spotCheckRecord && spotCheckRecord.id) {
                                              setSelectedSpotCheckRecord(spotCheckRecord);
                                              setSelectedClient(client);
                                              setViewDialogOpen(true);
                                            } else {
                                              setSelectedComplianceRecord({
                                                ...record,
                                                completed_by_user: record.completed_by_user,
                                                created_by_user: record.created_by_user,  
                                                updated_by_user: record.updated_by_user
                                              });
                                              setSelectedClient(client);
                                              setGenericViewDialogOpen(true);
                                            }
                                          }}
                                        >
                                          <Eye className="w-4 h-4" />
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
                                          title="Edit Record"
                                          onClick={() => {
                                            // Consistent form-based vs modal-based editing
                                            const method = record?.completion_method;
                                            switch (method) {
                                              case 'spotcheck':
                                                handleEditSpotCheck(client);
                                                break;
                                              default:
                                                // For simple completion methods, show informative message
                                                toast({
                                                  title: "Edit not available",
                                                  description: "Form-based editing is only available for spot checks. Simple records use date/text completion.",
                                                  variant: "destructive",
                                                });
                                            }
                                          }}
                                        >
                                          <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors text-destructive hover:text-destructive hover:bg-destructive/10"
                                          title="Delete Record"
                                          onClick={() => {
                                            setSelectedClient(client);
                                            setDeleteDialogOpen(true);
                                          }}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </>
                                    )}
                                     {!isCompleted && (
                                      <AddClientComplianceRecordModal
                                        clientId={client.id}
                                        clientName={client.name}
                                        complianceTypeId={complianceTypeId}
                                        complianceTypeName={complianceTypeName || ''}
                                        frequency={frequency}
                                        periodIdentifier={selectedPeriod}
                                        onRecordAdded={fetchData}
                                        trigger={
                                          <Button variant="outline" size="sm">
                                            Add Record
                                          </Button>
                                        }
                                      />
                                    )}
                                 </div>
                               </TableCell>
                             </TableRow>
                           );
                         })}
                       
                         {paginatedClients.length === 0 && (
                           <TableRow>
                             <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                               No clients found
                             </TableCell>
                           </TableRow>
                         )}
                       </TableBody>
                      </Table>
                      
                       {/* Pagination */}
                       {totalPages > 1 && itemsPerPage < 999999 && (
                         <div className="flex items-center justify-between px-6 py-4 border-t border-border/50">
                           <div className="flex items-center gap-2">
                             <span className="text-sm text-muted-foreground">Items per page:</span>
                             <select
                               value={itemsPerPage >= 999999 ? "all" : itemsPerPage}
                               onChange={(e) => handleItemsPerPageChange(e.target.value)}
                               className="border border-border rounded px-2 py-1 text-sm bg-background"
                             >
                               <option value={10}>10</option>
                               <option value={25}>25</option>
                               <option value={50}>50</option>
                               <option value={100}>100</option>
                               <option value="all">All</option>
                             </select>
                           </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePageChange(currentPage - 1)}
                              disabled={currentPage === 1}
                            >
                              Previous
                            </Button>
                            
                            <div className="flex items-center gap-1">
                              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <Button
                                  key={page}
                                  variant={currentPage === page ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handlePageChange(page)}
                                  className={currentPage === page ? "bg-primary text-primary-foreground" : ""}
                                >
                                  {page}
                                </Button>
                              ))}
                            </div>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePageChange(currentPage + 1)}
                              disabled={currentPage === totalPages}
                            >
                              Next
                            </Button>
                          </div>
                          
                          <div className="text-sm text-muted-foreground">
                            Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} clients
                          </div>
                        </div>
                      )}
                    </CardContent>
                 </Card>
               </div>
             </div>
           )}
         </TabsContent>

         <TabsContent value="periods" className="space-y-6">
        <div className="space-y-6">
          {/* Period Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-xl font-semibold">Client Compliance Records</h3>
            
            {frequency.toLowerCase() !== 'annual' && (
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger className="w-40 bg-background border border-input">
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
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
            {periods.map((period, index) => (
              <Card 
                key={period.period_identifier} 
                className={`card-premium transition-all duration-300 hover:shadow-lg ${
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
                      <p className="font-semibold text-lg">{period.record_count}</p>
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
                  {period.download_available ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadPeriod(period);
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Archive
                    </Button>
                  ) : (
                    <ClientCompliancePeriodDialog
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
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      }
                    />
                  )}
                </CardContent>
              </Card>
            ))}
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
        </TabsContent>
      </Tabs>

      {/* Spot Check Dialog */}
      <ClientSpotCheckFormDialog
        open={spotCheckDialogOpen}
        onOpenChange={(open) => {
          setSpotCheckDialogOpen(open);
          if (!open) {
            setEditingSpotCheckData(null);
            setSelectedClient(null);
          }
        }}
        onSubmit={handleSpotCheckSubmit}
        initialData={editingSpotCheckData}
        periodIdentifier={selectedPeriod}
        frequency={frequency}
        clientName={selectedClient?.name}
      />

      {/* View Spot Check Dialog */}
      <ClientSpotCheckViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        client={selectedClient}
        spotCheckRecord={selectedSpotCheckRecord}
      />

      {/* Generic Compliance Record View Dialog */}
      <ClientComplianceRecordViewDialog
        open={genericViewDialogOpen}
        onOpenChange={setGenericViewDialogOpen}
        client={selectedClient}
        record={selectedComplianceRecord}
        completedByUser={selectedComplianceRecord?.completed_by_user ? {
          name: selectedComplianceRecord.completed_by_user.name,
          created_at: selectedComplianceRecord.completion_date || selectedComplianceRecord.created_at
        } : null}
        createdByUser={selectedComplianceRecord?.created_by_user ? {
          name: selectedComplianceRecord.created_by_user.name,
          created_at: selectedComplianceRecord.created_at
        } : null}
        updatedByUser={selectedComplianceRecord?.updated_by_user ? {
          name: selectedComplianceRecord.updated_by_user.name,
          updated_at: selectedComplianceRecord.updated_at
        } : null}
      />

      {/* Delete Confirmation Dialog */}
      <ClientDeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        client={selectedClient}
        isDeleting={isDeleting}
        onConfirm={async () => {
          if (!selectedClient) return;
          
          try {
            setIsDeleting(true);
            const record = getClientRecordForPeriod(selectedClient.id, selectedPeriod);
            if (!record) return;
            
            // Delete the spot check record first
            const { error: spotCheckError } = await supabase
              .from('client_spot_check_records')
              .delete()
              .eq('compliance_record_id', record.id);
            
            if (spotCheckError) throw spotCheckError;
            
            // Delete the compliance record
            const { error: complianceError } = await supabase
              .from('client_compliance_period_records')
              .delete()
              .eq('id', record.id);
            
            if (complianceError) throw complianceError;
            
            toast({
              title: "Record deleted",
              description: `Spot check record for ${selectedClient.name} has been deleted.`,
            });
            
            setDeleteDialogOpen(false);
            setSelectedClient(null);
            // Refresh the data
            fetchData();
            
          } catch (error) {
            console.error('Error deleting client record:', error);
            toast({
              title: "Delete failed",
              description: "Could not delete the record. Please try again.",
              variant: "destructive",
            });
          } finally {
            setIsDeleting(false);
          }
        }}
      />
    </div>
  );
}