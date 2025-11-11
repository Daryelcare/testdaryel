import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface RealTimeMetrics {
  activeUsers: number;
  pendingApprovals: number;
  overdueCompliance: number;
  expiringDocuments: number;
  recentActivity: Array<{
    id: string;
    type: 'leave' | 'compliance' | 'document' | 'employee';
    message: string;
    timestamp: string;
  }>;
}

export function useRealTimeAnalytics() {
  const [metrics, setMetrics] = useState<RealTimeMetrics>({
    activeUsers: 0,
    pendingApprovals: 0,
    overdueCompliance: 0,
    expiringDocuments: 0,
    recentActivity: []
  });
  const [connectionStatus, setConnectionStatus] = useState({
    leave: false,
    compliance: false,
    employee: false,
    document: false,
    presence: false
  });
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Initial data fetch
    fetchRealTimeMetrics();

    // Set up real-time subscriptions
    const leaveChannel = supabase
      .channel('leave-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'leave_requests' },
        (payload) => {
          console.log('Leave request change:', payload);
          handleLeaveChange(payload);
        }
      )
      .subscribe((status) => {
        setConnectionStatus(prev => ({ ...prev, leave: status === 'SUBSCRIBED' }));
      });

    const complianceChannel = supabase
      .channel('compliance-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'compliance_period_records' },
        (payload) => {
          console.log('Compliance change:', payload);
          handleComplianceChange(payload);
        }
      )
      .subscribe((status) => {
        setConnectionStatus(prev => ({ ...prev, compliance: status === 'SUBSCRIBED' }));
      });

    const employeeChannel = supabase
      .channel('employee-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'employees' },
        (payload) => {
          console.log('Employee change:', payload);
          handleEmployeeChange(payload);
        }
      )
      .subscribe((status) => {
        setConnectionStatus(prev => ({ ...prev, employee: status === 'SUBSCRIBED' }));
      });

    const documentChannel = supabase
      .channel('document-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'document_tracker' },
        (payload) => {
          console.log('Document change:', payload);
          handleDocumentChange(payload);
        }
      )
      .subscribe((status) => {
        setConnectionStatus(prev => ({ ...prev, document: status === 'SUBSCRIBED' }));
      });

    // Track active users using presence
    const presenceChannel = supabase
      .channel('online-users')
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const userCount = Object.keys(state).length;
        setMetrics(prev => ({ ...prev, activeUsers: userCount }));
      })
      .subscribe(async (status) => {
        setConnectionStatus(prev => ({ ...prev, presence: status === 'SUBSCRIBED' }));
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });

    // Refresh metrics every 30 seconds
    const interval = setInterval(fetchRealTimeMetrics, 30000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(leaveChannel);
      supabase.removeChannel(complianceChannel);
      supabase.removeChannel(employeeChannel);
      supabase.removeChannel(documentChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, []);

  // Update connection status whenever individual statuses change
  useEffect(() => {
    const allConnected = Object.values(connectionStatus).every(status => status);
    setIsConnected(allConnected);
  }, [connectionStatus]);

  const fetchRealTimeMetrics = async () => {
    try {
      const [pendingLeaves, overdueCompliance, expiringDocs] = await Promise.all([
        // Pending leave approvals
        supabase
          .from('leave_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
        
        // Overdue compliance
        supabase
          .from('compliance_period_records')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'overdue'),
        
        // Expiring documents (next 7 days)
        supabase
          .from('document_tracker')
          .select('*', { count: 'exact', head: true })
          .lte('expiry_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .gte('expiry_date', new Date().toISOString().split('T')[0])
      ]);

      // Fetch recent activity
      const recentActivity = await fetchRecentActivity();

      setMetrics({
        activeUsers: Math.floor(Math.random() * 25) + 5, // Simulated for now
        pendingApprovals: pendingLeaves.count || 0,
        overdueCompliance: overdueCompliance.count || 0,
        expiringDocuments: expiringDocs.count || 0,
        recentActivity
      });
    } catch (error) {
      console.error('Error fetching real-time metrics:', error);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      // Get recent leaves with employee names
      const { data: recentLeaves } = await supabase
        .from('leave_requests')
        .select('id, status, created_at, employees(name)')
        .order('created_at', { ascending: false })
        .limit(3);

      // Get recent compliance updates with employee names
      const { data: recentCompliance } = await supabase
        .from('compliance_period_records')
        .select('id, status, updated_at, employees(name), compliance_types(name)')
        .order('updated_at', { ascending: false })
        .limit(2);

      // Get recent document updates
      const { data: recentDocuments } = await supabase
        .from('document_tracker')
        .select('id, status, updated_at, employees(name), document_types(name)')
        .order('updated_at', { ascending: false })
        .limit(2);

      const activity: Array<{
        id: string;
        type: 'leave' | 'compliance' | 'document' | 'employee';
        message: string;
        timestamp: string;
      }> = [];

      // Process leave activities
      (recentLeaves || []).forEach(leave => {
        const employeeName = (leave.employees as any)?.name || 'Unknown';
        const timeAgo = formatDistanceToNow(new Date(leave.created_at), { addSuffix: true });
        activity.push({
          id: `leave-${leave.id}`,
          type: 'leave' as const,
          message: `${employeeName} ${leave.status === 'pending' ? 'submitted' : leave.status} leave request ${timeAgo}`,
          timestamp: leave.created_at
        });
      });

      // Process compliance activities
      (recentCompliance || []).forEach(compliance => {
        const employeeName = (compliance.employees as any)?.name || 'Unknown';
        const complianceType = (compliance.compliance_types as any)?.name || 'task';
        const timeAgo = formatDistanceToNow(new Date(compliance.updated_at), { addSuffix: true });
        activity.push({
          id: `compliance-${compliance.id}`,
          type: 'compliance' as const,
          message: `${employeeName} ${compliance.status} ${complianceType} ${timeAgo}`,
          timestamp: compliance.updated_at
        });
      });

      // Process document activities
      (recentDocuments || []).forEach(doc => {
        const employeeName = (doc.employees as any)?.name || 'Unknown';
        const docType = (doc.document_types as any)?.name || 'document';
        const timeAgo = formatDistanceToNow(new Date(doc.updated_at), { addSuffix: true });
        activity.push({
          id: `document-${doc.id}`,
          type: 'document' as const,
          message: `${employeeName}'s ${docType} ${doc.status === 'expiring' ? 'expiring soon' : doc.status} ${timeAgo}`,
          timestamp: doc.updated_at
        });
      });

      // Sort by timestamp and take most recent 5
      return activity
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      return [];
    }
  };

  const handleLeaveChange = (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    setMetrics(prev => {
      const newActivity = [...prev.recentActivity];
      const timeAgo = formatDistanceToNow(new Date(), { addSuffix: true });
      
      if (eventType === 'INSERT') {
        newActivity.unshift({
          id: `leave-${newRecord.id}`,
          type: 'leave' as const,
          message: `New leave request submitted ${timeAgo}`,
          timestamp: newRecord.created_at
        });
      } else if (eventType === 'UPDATE' && oldRecord.status !== newRecord.status) {
        newActivity.unshift({
          id: `leave-${newRecord.id}`,
          type: 'leave' as const,
          message: `Leave request ${newRecord.status} ${timeAgo}`,
          timestamp: new Date().toISOString()
        });
      }

      return {
        ...prev,
        recentActivity: newActivity.slice(0, 5),
        pendingApprovals: newRecord?.status === 'pending' ? prev.pendingApprovals + 1 : 
                         oldRecord?.status === 'pending' && newRecord?.status !== 'pending' ? prev.pendingApprovals - 1 : 
                         prev.pendingApprovals
      };
    });
    
    // Refresh full data to get employee names
    fetchRealTimeMetrics();
  };

  const handleComplianceChange = (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    setMetrics(prev => {
      const newActivity = [...prev.recentActivity];
      const timeAgo = formatDistanceToNow(new Date(), { addSuffix: true });
      
      if (eventType === 'UPDATE' && oldRecord.status !== newRecord.status) {
        newActivity.unshift({
          id: `compliance-${newRecord.id}`,
          type: 'compliance' as const,
          message: `Compliance task ${newRecord.status} ${timeAgo}`,
          timestamp: new Date().toISOString()
        });
      }

      return {
        ...prev,
        recentActivity: newActivity.slice(0, 5),
        overdueCompliance: newRecord?.status === 'overdue' ? prev.overdueCompliance + 1 :
                          oldRecord?.status === 'overdue' && newRecord?.status !== 'overdue' ? prev.overdueCompliance - 1 :
                          prev.overdueCompliance
      };
    });
    
    // Refresh full data to get employee names
    fetchRealTimeMetrics();
  };

  const handleEmployeeChange = (payload: any) => {
    const { eventType, new: newRecord } = payload;
    const timeAgo = formatDistanceToNow(new Date(), { addSuffix: true });
    
    if (eventType === 'INSERT') {
      setMetrics(prev => ({
        ...prev,
        recentActivity: [{
          id: `employee-${newRecord.id}`,
          type: 'employee' as const,
          message: `${newRecord.name} joined the team ${timeAgo}`,
          timestamp: newRecord.created_at
        }, ...prev.recentActivity].slice(0, 5)
      }));
    }
  };

  const handleDocumentChange = (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    if (eventType === 'UPDATE' && oldRecord.status !== newRecord.status) {
      const timeAgo = formatDistanceToNow(new Date(), { addSuffix: true });
      setMetrics(prev => {
        const newActivity = [...prev.recentActivity];
        newActivity.unshift({
          id: `document-${newRecord.id}`,
          type: 'document' as const,
          message: `Document ${newRecord.status === 'expiring' ? 'expiring soon' : newRecord.status} ${timeAgo}`,
          timestamp: new Date().toISOString()
        });

        return {
          ...prev,
          recentActivity: newActivity.slice(0, 5),
          expiringDocuments: newRecord.status === 'expiring' ? prev.expiringDocuments + 1 :
                            oldRecord.status === 'expiring' && newRecord.status !== 'expiring' ? prev.expiringDocuments - 1 :
                            prev.expiringDocuments
        };
      });
      
      // Refresh full data to get employee names
      fetchRealTimeMetrics();
    }
  };

  return {
    metrics,
    isConnected,
    refresh: fetchRealTimeMetrics
  };
}