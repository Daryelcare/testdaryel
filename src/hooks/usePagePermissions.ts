import { usePermissions } from '@/contexts/PermissionsContext';

export function usePagePermissions() {
  const { hasPageAction, isAdmin } = usePermissions();

  // Employees permissions
  const canViewEmployees = () => isAdmin || hasPageAction('employees', 'view');
  const canCreateEmployees = () => isAdmin || hasPageAction('employees', 'create');
  const canEditEmployees = () => isAdmin || hasPageAction('employees', 'edit');
  const canDeleteEmployees = () => isAdmin || hasPageAction('employees', 'delete');

  // Leaves permissions
  const canViewLeaves = () => isAdmin || hasPageAction('leaves', 'view');
  const canCreateLeaves = () => isAdmin || hasPageAction('leaves', 'create');
  const canEditLeaves = () => isAdmin || hasPageAction('leaves', 'edit');
  const canDeleteLeaves = () => isAdmin || hasPageAction('leaves', 'delete');
  const canApproveLeaves = () => isAdmin || hasPageAction('leaves', 'approve');

  // Documents permissions
  const canViewDocuments = () => isAdmin || hasPageAction('documents', 'view');
  const canCreateDocuments = () => isAdmin || hasPageAction('documents', 'create');
  const canEditDocuments = () => isAdmin || hasPageAction('documents', 'edit');
  const canDeleteDocuments = () => isAdmin || hasPageAction('documents', 'delete');
  const canUploadDocuments = () => isAdmin || hasPageAction('documents', 'upload');

  // Document Signing permissions
  const canViewDocumentSigning = () => isAdmin || hasPageAction('document-signing', 'view');
  const canCreateDocumentSigning = () => isAdmin || hasPageAction('document-signing', 'create');
  const canEditDocumentSigning = () => isAdmin || hasPageAction('document-signing', 'edit');
  const canDeleteDocumentSigning = () => isAdmin || hasPageAction('document-signing', 'delete');
  const canSignDocuments = () => isAdmin || hasPageAction('document-signing', 'sign');

  // Compliance permissions
  const canViewCompliance = () => isAdmin || hasPageAction('compliance', 'view');
  const canCreateCompliance = () => isAdmin || hasPageAction('compliance', 'create');
  const canEditCompliance = () => isAdmin || hasPageAction('compliance', 'edit');
  const canDeleteCompliance = () => isAdmin || hasPageAction('compliance', 'delete');
  
  // Specific compliance tab permissions
  const canViewComplianceTypes = () => isAdmin || hasPageAction('compliance-types', 'view');
  const canViewCareWorkerStatements = () => isAdmin || hasPageAction('care-worker-statements', 'view');

  // Reports permissions
  const canViewReports = () => isAdmin || hasPageAction('reports', 'view');
  const canGenerateReports = () => isAdmin || hasPageAction('reports', 'generate');
  const canExportReports = () => isAdmin || hasPageAction('reports', 'export');

  // Job Applications permissions
  const canViewJobApplications = () => isAdmin || hasPageAction('job-applications', 'view');
  const canDeleteJobApplications = () => isAdmin || hasPageAction('job-applications', 'delete');
  const canEditJobApplications = () => isAdmin || hasPageAction('job-applications', 'edit');
  const canDownloadJobApplicationPDF = () => isAdmin || hasPageAction('job-applications', 'download-pdf');
  const canSendReferenceRequest = () => isAdmin || hasPageAction('job-applications', 'reference-send-request');
  const canDownloadReferencePDF = () => isAdmin || hasPageAction('job-applications', 'reference-download-pdf');
  const canManualReferencePDF = () => isAdmin || hasPageAction('job-applications', 'reference-manual-pdf');

  // Settings permissions
  const canViewSettings = () => isAdmin || hasPageAction('settings', 'view');
  const canEditSettings = () => isAdmin || hasPageAction('settings', 'edit');

  // User Management permissions
  const canViewUserManagement = () => isAdmin || hasPageAction('user-management', 'view');
  const canCreateUsers = () => isAdmin || hasPageAction('user-management', 'create');
  const canEditUsers = () => isAdmin || hasPageAction('user-management', 'edit');
  const canDeleteUsers = () => isAdmin || hasPageAction('user-management', 'delete');

  return {
    // Employees
    canViewEmployees,
    canCreateEmployees,
    canEditEmployees,
    canDeleteEmployees,

    // Leaves
    canViewLeaves,
    canCreateLeaves,
    canEditLeaves,
    canDeleteLeaves,
    canApproveLeaves,

    // Documents
    canViewDocuments,
    canCreateDocuments,
    canEditDocuments,
    canDeleteDocuments,
    canUploadDocuments,

    // Document Signing
    canViewDocumentSigning,
    canCreateDocumentSigning,
    canEditDocumentSigning,
    canDeleteDocumentSigning,
    canSignDocuments,

    // Compliance
    canViewCompliance,
    canCreateCompliance,
    canEditCompliance,
    canDeleteCompliance,
    canViewComplianceTypes,
    canViewCareWorkerStatements,

    // Reports
    canViewReports,
    canGenerateReports,
    canExportReports,

    // Job Applications
    canViewJobApplications,
    canDeleteJobApplications,
    canEditJobApplications,
    canDownloadJobApplicationPDF,
    canSendReferenceRequest,
    canDownloadReferencePDF,
    canManualReferencePDF,

    // Settings
    canViewSettings,
    canEditSettings,

    // User Management
    canViewUserManagement,
    canCreateUsers,
    canEditUsers,
    canDeleteUsers,

    // Generic function for custom checks
    hasPageAction
  };
}