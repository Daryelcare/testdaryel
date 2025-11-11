
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Calendar, ArrowUpDown, ArrowUp, ArrowDown, Eye, Edit, Trash2, CheckCircle, XCircle } from "lucide-react";
import { Leave, SortField, SortDirection } from "./types";

interface LeaveTableProps {
  leaves: Leave[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onViewLeave?: (leave: Leave) => void;
  onEditLeave?: (leave: Leave) => void;
  onDeleteLeave?: (leave: Leave) => void;
  onUpdateStatus?: (leaveId: string, status: 'approved' | 'rejected' | 'pending', managerNotes?: string) => void;
}

export function LeaveTable({ 
  leaves, 
  sortField, 
  sortDirection, 
  onSort, 
  onViewLeave, 
  onEditLeave, 
  onDeleteLeave, 
  onUpdateStatus 
}: LeaveTableProps) {
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="card-premium animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Leave Requests ({leaves.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {leaves.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No leave requests found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search or filters, or get started by submitting your first leave request.
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto font-medium hover:bg-transparent"
                      onClick={() => onSort('employee_name')}
                    >
                      Employee {getSortIcon('employee_name')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto font-medium hover:bg-transparent"
                      onClick={() => onSort('leave_type')}
                    >
                      Leave Type {getSortIcon('leave_type')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto font-medium hover:bg-transparent"
                      onClick={() => onSort('start_date')}
                    >
                      Duration {getSortIcon('start_date')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto font-medium hover:bg-transparent"
                      onClick={() => onSort('days')}
                    >
                      Days {getSortIcon('days')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto font-medium hover:bg-transparent"
                      onClick={() => onSort('status')}
                    >
                      Status {getSortIcon('status')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto font-medium hover:bg-transparent"
                      onClick={() => onSort('created_at')}
                    >
                      Submitted {getSortIcon('created_at')}
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.map((leave) => (
                  <TableRow key={leave.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center">
                          <span className="text-xs font-medium text-white">
                            {leave.employee?.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{leave.employee?.name}</div>
                          <div className="text-sm text-muted-foreground">{leave.employee?.employee_code}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline">{leave.leave_type?.name}</Badge>
                        <div className="text-xs text-muted-foreground">
                          {leave.employee?.branches?.name || 'No Branch'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{format(new Date(leave.start_date), 'MMM dd, yyyy')}</div>
                        <div className="text-muted-foreground">to {format(new Date(leave.end_date), 'MMM dd, yyyy')}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{leave.days_requested} days</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(leave.status)}>
                        {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(leave.created_at), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {onViewLeave && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => onViewLeave(leave)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {onEditLeave && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => onEditLeave(leave)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {onDeleteLeave && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => onDeleteLeave(leave)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        {onUpdateStatus && (
                          <>
                            {leave.status === 'pending' && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="text-green-600 hover:text-green-700"
                                  onClick={() => onUpdateStatus(leave.id, 'approved')}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => onUpdateStatus(leave.id, 'rejected')}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {(leave.status === 'approved' || leave.status === 'rejected') && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-blue-600 hover:text-blue-700"
                                onClick={() => onUpdateStatus(leave.id, 'pending')}
                              >
                                Reset to Pending
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
