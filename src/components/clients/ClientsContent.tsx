import { useState, useRef } from "react";
import { Plus, Search, Eye, Edit3, Trash2, Building, Upload, Download, X, FileSpreadsheet, AlertCircle, Check, Square, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useClientData } from "@/hooks/useClientData";
import { useClientActions } from "@/hooks/queries/useClientQueries";
import { useActivitySync } from "@/hooks/useActivitySync";
import { ClientDeleteConfirmDialog } from "./ClientDeleteConfirmDialog";
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface Client {
  id: string;
  name: string;
  branch_id: string;
  branch?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Branch {
  id: string;
  name: string;
}

interface ImportClient {
  name: string;
  branch: string;
  error?: string;
}

export type ClientSortField = 'name' | 'branch' | 'created_at';
export type ClientSortDirection = 'asc' | 'desc';

export function ClientsContent() {
  const { clients, branches, loading, refetchData } = useClientData();
  const { syncNow } = useActivitySync();
  const [searchTerm, setSearchTerm] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [sortField, setSortField] = useState<ClientSortField>('name');
  const [sortDirection, setSortDirection] = useState<ClientSortDirection>('asc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [importData, setImportData] = useState<ImportClient[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const { isAdmin, hasPageAction, getAccessibleBranches } = usePermissions();
  const { toast } = useToast();

  const [newClient, setNewClient] = useState({
    name: "",
    branch_id: "",
    created_at: new Date()
  });

  const [editedClient, setEditedClient] = useState({
    name: "",
    branch_id: "",
    created_at: new Date()
  });

  const { createClient, updateClient, deleteClient } = useClientActions();

  const handleAddClient = () => {
    if (!hasPageAction('clients', 'create')) {
      toast({
        title: "Access denied",
        description: "You don't have permission to create clients.",
        variant: "destructive",
      });
      return;
    }
    
    if (!newClient.name || !newClient.branch_id) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    createClient.mutate({
      name: newClient.name,
      branch_id: newClient.branch_id,
      is_active: true,
      created_at: newClient.created_at.toISOString()
    }, {
      onSuccess: () => {
        syncNow();
        setDialogOpen(false);
        setNewClient({
          name: "",
          branch_id: "",
          created_at: new Date()
        });
      }
    });
  };

  const openViewDialog = (client: Client) => {
    setSelectedClient(client);
    setEditedClient({
      name: client.name || "",
      branch_id: client.branch_id || "",
      created_at: client.created_at ? new Date(client.created_at) : new Date()
    });
    setEditMode(false);
    setViewDialogOpen(true);
  };

  const handleUpdateClient = () => {
    if (!hasPageAction('clients', 'edit')) {
      toast({
        title: "Access denied",
        description: "You don't have permission to edit clients.",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedClient) return;
    
    updateClient.mutate({
      id: selectedClient.id,
      name: editedClient.name,
      branch_id: editedClient.branch_id,
      created_at: editedClient.created_at.toISOString()
    }, {
      onSuccess: () => {
        syncNow();
        setEditMode(false);
        setViewDialogOpen(false);
      }
    });
  };

  const handleDeleteClient = (clientId: string) => {
    if (!hasPageAction('clients', 'delete')) {
      toast({
        title: "Access denied",
        description: "You don't have permission to delete clients.",
        variant: "destructive",
      });
      return;
    }
    
    deleteClient.mutate(clientId, {
      onSuccess: () => {
        syncNow();
        setDeleteDialogOpen(false);
        setSelectedClient(null);
      }
    });
  };

  const batchDeleteClients = async () => {
    if (!hasPageAction('clients', 'bulk-delete')) {
      toast({
        title: "Access denied",
        description: "You don't have permission to delete clients.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const deletePromises = selectedClients.map(clientId => 
        deleteClient.mutateAsync(clientId)
      );

      await Promise.all(deletePromises);

      toast({
        title: "Clients deleted",
        description: `Successfully deleted ${selectedClients.length} clients.`,
      });

      syncNow();
      setBatchDeleteDialogOpen(false);
      setSelectedClients([]);
    } catch (error) {
      console.error('Error deleting clients:', error);
      toast({
        title: "Error deleting clients",
        description: "Could not delete clients. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleSelectClient = (clientId: string) => {
    setSelectedClients(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedClients.length === paginatedClients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(paginatedClients.map(client => client.id));
    }
  };

  const handleSort = (field: ClientSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: ClientSortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const handlePageSizeChange = (value: string) => {
    if (value === "all") {
      setPageSize(filteredAndSortedClients.length || 999999);
    } else {
      setPageSize(parseInt(value));
    }
    setPage(1);
  };

  const getBranchName = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || 'Unknown Branch';
  };

  // Import functionality
  const downloadTemplate = () => {
    const template = [
      {
        'Name': 'Example Client',
        'Branch': 'Main Office'
      }
    ];

    const csvContent = Papa.unparse(template);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'client_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Template downloaded",
      description: "Client import template has been downloaded.",
    });
  };

  const processFileData = (data: any[]): ImportClient[] => {
    return data.map((row, index) => {
      const client: ImportClient = {
        name: '',
        branch: '',
        error: ''
      };

      // Map column names (case-insensitive)
      Object.keys(row).forEach(key => {
        const lowerKey = key.toLowerCase().replace(/\s+/g, '_');
        const value = row[key];

        if (lowerKey.includes('name')) {
          client.name = value?.toString().trim() || '';
        } else if (lowerKey.includes('branch')) {
          client.branch = value?.toString().trim() || '';
        }
      });

      // Validate required fields
      const errors = [];
      if (!client.name) errors.push('Name is required');
      if (!client.branch) errors.push('Branch is required');

      // Validate branch exists
      if (client.branch && !branches.find(b => b.name.toLowerCase() === client.branch.toLowerCase())) {
        errors.push(`Branch "${client.branch}" not found`);
      }

      client.error = errors.join(', ');
      return client;
    });
  };

  const handleFileUpload = (file: File) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const processedData = processFileData(results.data);
          setImportData(processedData);
          setPreviewDialogOpen(true);
          setImportDialogOpen(false);
        },
        error: (error) => {
          toast({
            title: "Error parsing CSV",
            description: error.message,
            variant: "destructive",
          });
        }
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          
          const processedData = processFileData(jsonData);
          setImportData(processedData);
          setPreviewDialogOpen(true);
          setImportDialogOpen(false);
        } catch (error) {
          toast({
            title: "Error parsing Excel file",
            description: "Failed to read the Excel file.",
            variant: "destructive",
          });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast({
        title: "Unsupported file format",
        description: "Please upload a CSV or Excel file.",
        variant: "destructive",
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleImportClients = async () => {
    setImporting(true);
    
    try {
      const validClients = importData.filter(client => !client.error);
      
      if (validClients.length === 0) {
        toast({
          title: "No valid clients",
          description: "Please fix all errors before importing.",
          variant: "destructive",
        });
        setImporting(false);
        return;
      }
      
      if (validClients.length !== importData.length) {
        toast({
          title: "Some clients have errors",
          description: `${validClients.length} of ${importData.length} clients will be imported. Fix errors and re-import if needed.`,
          variant: "destructive",
        });
      }

      const clientsToInsert = validClients.map(client => {
        const branch = branches.find(b => b.name.toLowerCase() === client.branch.toLowerCase());
        return {
          name: client.name,
          branch_id: branch!.id,
          is_active: true
        };
      });

      // Use the bulk import mutation from useClientActions
      const promises = clientsToInsert.map(client => 
        createClient.mutateAsync({
          ...client,
          created_at: new Date().toISOString()
        })
      );

      await Promise.all(promises);

      toast({
        title: "Import successful", 
        description: `Successfully imported ${validClients.length} clients.`,
      });

      setPreviewDialogOpen(false);
      setImportData([]);
    } catch (error) {
      console.error('Error importing clients:', error);
      toast({
        title: "Import failed",
        description: "Failed to import clients. Please try again.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  // Filter and sort clients
  const filteredAndSortedClients = clients
    .filter((client) => {
      const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesBranch = branchFilter === "all" || client.branch_id === branchFilter;
      return matchesSearch && matchesBranch;
    })
    .sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'branch':
          aValue = getBranchName(a.branch_id).toLowerCase();
          bValue = getBranchName(b.branch_id).toLowerCase();
          break;
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  // Calculate pagination
  const effectivePageSize = pageSize >= 999999 ? filteredAndSortedClients.length : pageSize;
  const totalPages = Math.ceil(filteredAndSortedClients.length / effectivePageSize);
  const startIndex = (page - 1) * effectivePageSize;
  const endIndex = startIndex + effectivePageSize;
  const paginatedClients = filteredAndSortedClients.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Clients</h1>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Clients</h1>
        </div>
        <div className="flex gap-2">
          {hasPageAction('clients', 'import') && (
            <Button onClick={() => setImportDialogOpen(true)} variant="outline" className="gap-2">
              <Upload className="w-4 h-4" />
              Import
            </Button>
          )}
          {selectedClients.length > 0 && hasPageAction('clients', 'delete') && (
            <Button
              variant="destructive"
              onClick={() => setBatchDeleteDialogOpen(true)}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected ({selectedClients.length})
            </Button>
          )}
          {hasPageAction('clients', 'create') && (
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Client
            </Button>
          )}
        </div>
      </div>


      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full sm:w-64">
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches
                    .filter(branch => isAdmin || getAccessibleBranches().includes(branch.id))
                    .map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Clients ({filteredAndSortedClients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {(hasPageAction('clients', 'delete') || hasPageAction('clients', 'edit')) && (
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={selectedClients.length === paginatedClients.length && paginatedClients.length > 0}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all clients"
                      />
                    </TableHead>
                  )}
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto font-medium hover:bg-transparent"
                      onClick={() => handleSort('name')}
                    >
                      Name {getSortIcon('name')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto font-medium hover:bg-transparent"
                      onClick={() => handleSort('branch')}
                    >
                      Branch {getSortIcon('branch')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto font-medium hover:bg-transparent"
                      onClick={() => handleSort('created_at')}
                    >
                      Created {getSortIcon('created_at')}
                    </Button>
                  </TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedClients.map((client) => (
                  <TableRow key={client.id} className="hover:bg-muted/50 transition-colors">
                    {(hasPageAction('clients', 'delete') || hasPageAction('clients', 'edit')) && (
                      <TableCell>
                        <Checkbox 
                          checked={selectedClients.includes(client.id)}
                          onCheckedChange={() => toggleSelectClient(client.id)}
                          aria-label={`Select ${client.name}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Building className="w-3 h-3" />
                        {client.branch || getBranchName(client.branch_id)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(client.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openViewDialog(client)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {hasPageAction('clients', 'delete') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedClient(client);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedClients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={(hasPageAction('clients', 'delete') || hasPageAction('clients', 'edit')) ? 5 : 4} className="text-center text-muted-foreground">
                      No clients found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {filteredAndSortedClients.length > pageSize && pageSize < 999999 && (
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Items per page:</span>
                <Select value={pageSize >= 999999 ? "all" : pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page > 1) {
                          setPage(page - 1);
                          window.scrollTo(0, 0);
                        }
                      }}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    const pageNumber = start + i;
                    if (pageNumber > totalPages) return null;
                    return (
                      <PaginationItem key={pageNumber}>
                        <PaginationLink
                          href="#"
                          isActive={pageNumber === page}
                          className={pageNumber === page ? "bg-primary text-primary-foreground" : ""}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(pageNumber);
                            window.scrollTo(0, 0);
                          }}
                        >
                          {pageNumber}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page < totalPages) {
                          setPage(page + 1);
                          window.scrollTo(0, 0);
                        }
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>



      {/* Add Client Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Client Name</Label>
              <Input
                id="name"
                value={newClient.name}
                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                placeholder="Enter client name"
              />
            </div>
            <div>
              <Label htmlFor="branch">Branch</Label>
              <Select
                value={newClient.branch_id}
                onValueChange={(value) => setNewClient({ ...newClient, branch_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches
                    .filter(branch => isAdmin || getAccessibleBranches().includes(branch.id))
                    .map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="created_at">Creation Date (for compliance periods)</Label>
              <DatePicker
                selected={newClient.created_at}
                onChange={(date) => setNewClient({ ...newClient, created_at: date || new Date() })}
                placeholder="Select creation date"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This determines which compliance periods the client will appear in
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddClient}>Add Client</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View/Edit Client Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editMode ? "Edit Client" : "View Client"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Client Name</Label>
              <Input
                id="edit-name"
                value={editedClient.name}
                onChange={(e) => setEditedClient({ ...editedClient, name: e.target.value })}
                disabled={!editMode}
              />
            </div>
            <div>
              <Label htmlFor="edit-branch">Branch</Label>
              <Select
                value={editedClient.branch_id}
                onValueChange={(value) => setEditedClient({ ...editedClient, branch_id: value })}
                disabled={!editMode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-created-at">Creation Date (for compliance periods)</Label>
              {editMode ? (
                <>
                  <DatePicker
                    selected={editedClient.created_at}
                    onChange={(date) => setEditedClient({ ...editedClient, created_at: date || new Date() })}
                    placeholder="Select creation date"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This determines which compliance periods the client will appear in
                  </p>
                </>
              ) : (
                <div className="p-2 bg-muted rounded text-sm">
                  {selectedClient?.created_at ? new Date(selectedClient.created_at).toLocaleDateString('en-GB', { 
                    day: '2-digit', 
                    month: 'long', 
                    year: 'numeric' 
                  }) : 'N/A'}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            {editMode ? (
              <>
                <Button variant="outline" onClick={() => setEditMode(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateClient}>Save Changes</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                  Close
                </Button>
                {hasPageAction('clients', 'edit') && (
                  <Button onClick={() => setEditMode(true)}>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Import Clients</DialogTitle>
            <DialogDescription>
              Upload a CSV or Excel file to import multiple clients at once.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Template Download */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-sm font-medium">Download Template</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={downloadTemplate}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>

            {/* Required Fields Info */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Required columns:</strong> Name, Branch<br/>
                Branch name must match an existing branch in the system.
              </AlertDescription>
            </Alert>

            {/* Drag and Drop Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                {dragActive ? 'Drop your file here' : 'Drop your file here or click to browse'}
              </p>
              <p className="text-sm text-muted-foreground">
                Supports CSV and Excel files (.csv, .xlsx, .xls)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[600px]">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
            <DialogDescription>
              Review the data before importing. Rows with errors will be skipped.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {importData.length > 0 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {importData.filter(client => !client.error).length} valid / {importData.length} total clients
                </div>
                {importData.some(client => client.error) && (
                  <Badge variant="destructive">
                    {importData.filter(client => client.error).length} errors found
                  </Badge>
                )}
              </div>
            )}

            <div className="border rounded-lg max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Branch</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importData.map((client, index) => (
                    <TableRow key={index} className={client.error ? 'bg-destructive/10' : 'bg-success/10'}>
                      <TableCell>
                        {client.error ? (
                          <div className="flex items-center gap-1 text-destructive">
                            <X className="w-4 h-4" />
                            <span className="text-xs">Error</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-green-600">
                            <span className="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center">
                              <span className="text-white text-xs">✓</span>
                            </span>
                            <span className="text-xs">Valid</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{client.name || 'Missing'}</div>
                          {client.error && (
                            <div className="text-xs text-destructive">{client.error}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{client.branch || 'Missing'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleImportClients}
              disabled={importing || importData.filter(client => !client.error).length === 0}
              className="bg-gradient-primary hover:opacity-90"
            >
              {importing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Importing...
                </>
              ) : (
                `Import ${importData.filter(client => !client.error).length} Clients`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Delete Confirmation Dialog */}
      <AlertDialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {selectedClients.length} selected clients
              and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={batchDeleteClients}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {selectedClients.length} Clients
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <ClientDeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        client={selectedClient}
        onConfirm={() => {
          if (selectedClient) {
            handleDeleteClient(selectedClient.id);
          }
        }}
        isDeleting={deleteClient.isPending}
      />
    </div>
  );
}