import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, CheckCircle, Clock, Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useState, useMemo } from "react";
import { DeleteDocumentDialog } from "./DeleteDocumentDialog";

interface Document {
  id: string;
  employee_id: string;
  document_type_id: string;
  branch_id: string;
  document_number?: string;
  issue_date?: string;
  expiry_date: string;
  status: string;
  notes?: string;
  country?: string;
  nationality_status?: string;
  employees?: {
    name: string;
    email: string;
    branches?: {
      id: string;
      name: string;
    };
  };
  document_types?: {
    name: string;
  };
}

interface Employee {
  id: string;
  name: string;
  email: string;
  branch_id: string;
  sponsored?: boolean;
  twenty_hours?: boolean;
  branches?: {
    id: string;
    name: string;
  };
}

interface DocumentType {
  id: string;
  name: string;
}

interface DocumentTableProps {
  documents: Document[];
  employees: Employee[];
  documentTypes: DocumentType[];
  selectedDocuments?: string[];
  onView?: (document: Document) => void;
  onEdit?: (document: Document) => void;
  onDelete?: (document: Document) => void;
  onSelectDocument?: (documentId: string) => void;
  onSelectAll?: () => void;
}

type SortField = 'employee' | 'branch' | 'country' | string;
type SortDirection = 'asc' | 'desc';

export function DocumentTable({ documents, employees, documentTypes, selectedDocuments = [], onView, onEdit, onDelete, onSelectDocument, onSelectAll }: DocumentTableProps) {
  const [sortField, setSortField] = useState<SortField>('employee');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentsToDelete, setDocumentsToDelete] = useState<Document[]>([]);
  const [selectedDocumentToDelete, setSelectedDocumentToDelete] = useState<Document | null>(null);

  // Get document types that actually have documents
  const activeDocumentTypes = useMemo(() => {
    const typeIds = new Set(documents.map(doc => doc.document_type_id));
    return documentTypes.filter(type => typeIds.has(type.id));
  }, [documents, documentTypes]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const handleDeleteClick = (employeeDocuments: Document[]) => {
    if (employeeDocuments.length === 1) {
      // If there's only one document, delete it directly
      setSelectedDocumentToDelete(employeeDocuments[0]);
      setDocumentsToDelete([]);
      setDeleteDialogOpen(true);
    } else {
      // If there are multiple documents, let user choose
      setDocumentsToDelete(employeeDocuments);
      setSelectedDocumentToDelete(null);
      setDeleteDialogOpen(true);
    }
  };

  const handleDeleteConfirm = (documentsToDelete: Document[]) => {
    // Call onDelete for each document
    documentsToDelete.forEach(document => {
      onDelete?.(document);
    });
    setDeleteDialogOpen(false);
    setDocumentsToDelete([]);
    setSelectedDocumentToDelete(null);
  };

  const getExpiryInfo = (document: Document) => {
    // Check if expiry_date is a valid date
    const expiryDate = new Date(document.expiry_date);
    const isValidDate = !isNaN(expiryDate.getTime()) && document.expiry_date !== 'N/A' && document.expiry_date !== 'NOT REQUIRED';
    
    if (!isValidDate) {
      // For text values, just show the text as-is with valid status
      return {
        badge: (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Valid
          </Badge>
        ),
        daysText: document.expiry_date, // Show the text as-is
        sortValue: 0 // Neutral sort value for text entries
      };
    }

    // Only calculate days for valid dates
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (daysUntilExpiry < 0) {
      return {
        badge: (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Expired
          </Badge>
        ),
        daysText: `${Math.abs(daysUntilExpiry)} days ago`,
        sortValue: daysUntilExpiry
      };
    } else if (daysUntilExpiry <= 30) {
      return {
        badge: (
          <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
            <Clock className="w-3 h-3 mr-1" />
            Expiring Soon
          </Badge>
        ),
        daysText: `${daysUntilExpiry} days left`,
        sortValue: daysUntilExpiry
      };
    } else {
      return {
        badge: (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Valid
          </Badge>
        ),
        daysText: `${daysUntilExpiry} days left`,
        sortValue: daysUntilExpiry
      };
    }
  };

  // Group documents by employee
  const groupedDocuments = documents.reduce((acc, document) => {
    const key = document.employee_id;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(document);
    return acc;
  }, {} as Record<string, Document[]>);

  // Sort grouped documents
  const sortedGroupedDocuments = Object.entries(groupedDocuments).sort(([, documentsA], [, documentsB]) => {
    const firstDocA = documentsA[0];
    const firstDocB = documentsB[0];
    
    let valueA: any;
    let valueB: any;

    switch (sortField) {
      case 'employee':
        valueA = firstDocA.employees?.name || '';
        valueB = firstDocB.employees?.name || '';
        break;
      case 'branch':
        valueA = firstDocA.employees?.branches?.name || '';
        valueB = firstDocB.employees?.branches?.name || '';
        break;
      case 'country':
        valueA = firstDocA.country || '';
        valueB = firstDocB.country || '';
        break;
      default:
        // Handle dynamic document type columns
        const documentTypeA = documentsA.find(doc => doc.document_types?.name === sortField);
        const documentTypeB = documentsB.find(doc => doc.document_types?.name === sortField);
        valueA = documentTypeA ? new Date(documentTypeA.expiry_date).getTime() : 0;
        valueB = documentTypeB ? new Date(documentTypeB.expiry_date).getTime() : 0;
        break;
    }

    if (typeof valueA === 'string' && typeof valueB === 'string') {
      return sortDirection === 'asc' 
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    }

    return sortDirection === 'asc' 
      ? valueA - valueB
      : valueB - valueA;
  });

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {onSelectDocument && (
                <TableHead className="w-12">
                  <Checkbox 
                    checked={selectedDocuments.length === documents.length && documents.length > 0}
                    onCheckedChange={onSelectAll}
                    aria-label="Select all documents"
                  />
                </TableHead>
              )}
              <TableHead>
                <Button
                  variant="ghost"
                  className="p-0 h-auto font-medium hover:bg-transparent flex items-center"
                  onClick={() => handleSort('employee')}
                >
                  EMPLOYEE
                  {getSortIcon('employee')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  className="p-0 h-auto font-medium hover:bg-transparent flex items-center"
                  onClick={() => handleSort('branch')}
                >
                  BRANCH
                  {getSortIcon('branch')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  className="p-0 h-auto font-medium hover:bg-transparent flex items-center"
                  onClick={() => handleSort('country')}
                >
                  COUNTRY
                  {getSortIcon('country')}
                </Button>
              </TableHead>
              {activeDocumentTypes.map((docType) => (
                <TableHead key={docType.id}>
                  <Button
                    variant="ghost"
                    className="p-0 h-auto font-medium hover:bg-transparent flex items-center"
                    onClick={() => handleSort(docType.name)}
                  >
                    {docType.name.toUpperCase()}
                    {getSortIcon(docType.name)}
                  </Button>
                </TableHead>
              ))}
              <TableHead className="text-right">ACTIONS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedGroupedDocuments.map(([employeeId, employeeDocuments]) => {
              const firstDocument = employeeDocuments[0];
              
              // Get the most critical status (expired > expiring > valid)
              const getWorstStatus = (docs: Document[]) => {
                const statuses = docs.map(doc => {
                  const expiryDate = new Date(doc.expiry_date);
                  const isValidDate = !isNaN(expiryDate.getTime()) && doc.expiry_date !== 'N/A' && doc.expiry_date !== 'NOT REQUIRED';
                  
                  if (!isValidDate) {
                    return { priority: 1, doc }; // Text values get lowest priority (valid)
                  }
                  
                  const today = new Date();
                  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                  
                  if (daysUntilExpiry < 0) return { priority: 3, doc };
                  if (daysUntilExpiry <= 30) return { priority: 2, doc };
                  return { priority: 1, doc };
                });
                
                return statuses.sort((a, b) => b.priority - a.priority)[0].doc;
              };

              const worstStatusDoc = getWorstStatus(employeeDocuments);
              const expiryInfo = getExpiryInfo(worstStatusDoc);

              return (
                <TableRow key={employeeId} className="hover:bg-muted/50 transition-colors">
                  {onSelectDocument && (
                    <TableCell>
                      <Checkbox 
                        checked={employeeDocuments.every(doc => selectedDocuments.includes(doc.id))}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            employeeDocuments.forEach(doc => {
                              if (!selectedDocuments.includes(doc.id)) {
                                onSelectDocument(doc.id);
                              }
                            });
                          } else {
                            employeeDocuments.forEach(doc => {
                              if (selectedDocuments.includes(doc.id)) {
                                onSelectDocument(doc.id);
                              }
                            });
                          }
                        }}
                        aria-label={`Select all documents for ${firstDocument.employees?.name}`}
                      />
                    </TableCell>
                  )}
                <TableCell className="font-medium">
                  <div className="space-y-1">
                    <div>{firstDocument.employees?.name}</div>
                    <div className="flex gap-1">
                      {(() => {
                        const employee = employees.find(emp => emp.id === employeeId);
                        const badges = [];
                        if (employee?.sponsored) {
                          badges.push(
                            <Badge key="sponsored" variant="secondary" className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-100">
                              Sponsored
                            </Badge>
                          );
                        }
                        if (employee?.twenty_hours) {
                          badges.push(
                            <Badge key="twenty-hours" variant="secondary" className="text-xs bg-purple-100 text-purple-800 hover:bg-purple-100">
                              20 Hours
                            </Badge>
                          );
                        }
                        return badges;
                      })()}
                    </div>
                  </div>
                </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {firstDocument.employees?.branches?.name || 'No Branch'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{firstDocument.country || 'N/A'}</div>
                    {firstDocument.nationality_status && (
                      <div className="text-xs text-muted-foreground">
                        {firstDocument.nationality_status}
                      </div>
                    )}
                  </TableCell>
                  {activeDocumentTypes.map((docType) => {
                    const docForType = employeeDocuments.find(doc => doc.document_types?.name === docType.name);
                    return (
                      <TableCell key={docType.id} className="text-sm">
                        {docForType ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {(() => {
                                const expiryDate = new Date(docForType.expiry_date);
                                const isValidDate = !isNaN(expiryDate.getTime()) && docForType.expiry_date !== 'N/A' && docForType.expiry_date !== 'NOT REQUIRED';
                                
                                if (isValidDate) {
                                  return (
                                    <>
                                      <span>{expiryDate.toLocaleDateString('en-GB')}</span>
                                      <Badge 
                                        className={`text-xs ${
                                          getExpiryInfo(docForType).sortValue < 0 
                                            ? 'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-200' :
                                          getExpiryInfo(docForType).sortValue <= 30 && getExpiryInfo(docForType).sortValue > 0
                                            ? 'bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900 dark:text-orange-200' 
                                            : 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200'
                                        }`}
                                      >
                                        {getExpiryInfo(docForType).sortValue < 0 ? 'expired' :
                                         getExpiryInfo(docForType).sortValue <= 30 && getExpiryInfo(docForType).sortValue > 0 ? 'expiring soon' : 'valid'}
                                      </Badge>
                                    </>
                                  );
                                } else {
                                  return (
                                    <>
                                      <span>{docForType.expiry_date}</span>
                                      <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200">
                                        valid
                                      </Badge>
                                    </>
                                  );
                                }
                              })()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {getExpiryInfo(docForType).daysText}
                            </div>
                          </div>
                        ) : (
                          <div className="text-muted-foreground">N/A</div>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {onView && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onView(firstDocument)}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {/* {onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(firstDocument)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )} */}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(employeeDocuments)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <DeleteDocumentDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onOpenChange={setDeleteDialogOpen}
        documents={documentsToDelete}
        selectedDocument={selectedDocumentToDelete}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
