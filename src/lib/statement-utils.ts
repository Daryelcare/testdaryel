/**
 * Utility functions for Care Worker Statement management
 */

export const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'approved':
      return 'default';
    case 'submitted':
      return 'secondary';
    case 'rejected':
      return 'destructive';
    case 'draft':
      return 'outline';
    default:
      return 'outline';
  }
};

export const getStatusText = (status: string) => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export const canEditStatement = (status: string) => {
  return status === 'draft' || status === 'rejected';
};

export const formatStatementDate = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return 'Invalid date';
  }
};

export const getNextDueDate = (frequency: string, lastCompletionDate?: string) => {
  const baseDate = lastCompletionDate ? new Date(lastCompletionDate) : new Date();
  
  switch (frequency.toLowerCase()) {
    case 'weekly':
      baseDate.setDate(baseDate.getDate() + 7);
      break;
    case 'monthly':
      baseDate.setMonth(baseDate.getMonth() + 1);
      break;
    case 'quarterly':
      baseDate.setMonth(baseDate.getMonth() + 3);
      break;
    case 'bi-annual':
      baseDate.setMonth(baseDate.getMonth() + 6);
      break;
    case 'annual':
    default:
      baseDate.setFullYear(baseDate.getFullYear() + 1);
      break;
  }
  
  return baseDate;
};

export const validateStatementForm = (formData: any) => {
  const errors: string[] = [];

  if (!formData.care_worker_name?.trim()) {
    errors.push('Care worker name is required');
  }

  if (!formData.client_name?.trim()) {
    errors.push('Client name is required');
  }

  if (!formData.client_address?.trim()) {
    errors.push('Client address is required');
  }

  if (!formData.statement?.trim()) {
    errors.push('Statement content is required');
  }

  if (!formData.person_completing_report?.trim()) {
    errors.push('Person completing report is required');
  }

  if (!formData.position?.trim()) {
    errors.push('Position is required');
  }

  if (!formData.digital_signature) {
    errors.push('Digital signature is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};