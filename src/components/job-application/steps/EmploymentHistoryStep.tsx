import { useState, useEffect } from 'react';
import { EmploymentHistory } from '../types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Minus, AlertCircle } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EmploymentHistoryStepProps {
  data: EmploymentHistory;
  updateData: (field: keyof EmploymentHistory, value: any) => void;
}

const emptyEmployer = {
  company: '',
  name: '',
  email: '',
  position: '',
  address: '',
  address2: '',
  town: '',
  postcode: '',
  telephone: '',
  from: '',
  to: '',
  leavingDate: '',
  keyTasks: '',
  reasonForLeaving: '',
};

export function EmploymentHistoryStep({ data, updateData }: EmploymentHistoryStepProps) {
  const [dateErrors, setDateErrors] = useState<{[key: string]: string[]}>({});

  // Helper function to validate employer dates
  const validateEmployerDates = (employer: any, key: string) => {
    const errors: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (employer.from && employer.to) {
      const fromDate = new Date(employer.from);
      const toDate = new Date(employer.to);
      
      if (fromDate > today) {
        errors.push('Start date cannot be in the future');
      }
      
      if (toDate > today) {
        errors.push('End date cannot be in the future');
      }
      
      if (fromDate >= toDate) {
        errors.push('Start date must be before end date');
      }
      
      const diffYears = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (diffYears > 60) {
        errors.push('Employment duration seems unrealistic (more than 60 years)');
      }
      
      if (employer.leavingDate) {
        const leavingDate = new Date(employer.leavingDate);
        if (leavingDate < toDate) {
          errors.push('Leaving date should be on or after end date');
        }
      }
    }
    
    setDateErrors(prev => ({
      ...prev,
      [key]: errors
    }));
  };

  // Validate recent employer dates when they change
  useEffect(() => {
    if (data.recentEmployer) {
      validateEmployerDates(data.recentEmployer, 'recent');
    }
  }, [data.recentEmployer?.from, data.recentEmployer?.to, data.recentEmployer?.leavingDate]);

  // Validate previous employers dates when they change
  useEffect(() => {
    data.previousEmployers?.forEach((emp, index) => {
      validateEmployerDates(emp, `prev-${index}`);
    });
  }, [data.previousEmployers]);

  const addPreviousEmployer = () => {
    const currentEmployers = data.previousEmployers || [];
    updateData('previousEmployers', [...currentEmployers, { ...emptyEmployer }]);
  };

  const removePreviousEmployer = (index: number) => {
    const currentEmployers = data.previousEmployers || [];
    updateData('previousEmployers', currentEmployers.filter((_, i) => i !== index));
  };

  const updateRecentEmployer = (field: string, value: string) => {
    updateData('recentEmployer', { ...data.recentEmployer, [field]: value });
  };

  const updatePreviousEmployer = (index: number, field: string, value: string) => {
    const currentEmployers = data.previousEmployers || [];
    const updated = currentEmployers.map((emp, i) => 
      i === index ? { ...emp, [field]: value } : emp
    );
    updateData('previousEmployers', updated);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Employment History</h3>
        <p className="text-muted-foreground mb-6">Please tell us about your employment history.</p>
      </div>

      <div>
        <Label htmlFor="previouslyEmployed">Were you previously employed? *</Label>
        <Select value={data.previouslyEmployed} onValueChange={(value) => updateData('previouslyEmployed', value)}>
          <SelectTrigger className="min-h-[44px]">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.previouslyEmployed === 'yes' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Most Recent Employer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <Label>Company *</Label>
                  <Input
                    value={data.recentEmployer?.company || ''}
                    onChange={(e) => updateRecentEmployer('company', e.target.value)}
                    placeholder="Employer Name"
                  />
                </div>
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={data.recentEmployer?.name || ''}
                    onChange={(e) => updateRecentEmployer('name', e.target.value)}
                    placeholder="Name"
                  />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={data.recentEmployer?.email || ''}
                    onChange={(e) => updateRecentEmployer('email', e.target.value)}
                    placeholder="Email"
                  />
                </div>
                <div>
                  <Label>Position Held *</Label>
                  <Input
                    value={data.recentEmployer?.position || ''}
                    onChange={(e) => updateRecentEmployer('position', e.target.value)}
                    placeholder="Position"
                  />
                </div>
                <div>
                  <Label>Address *</Label>
                  <Input
                    value={data.recentEmployer?.address || ''}
                    onChange={(e) => updateRecentEmployer('address', e.target.value)}
                    placeholder="Address"
                  />
                </div>
                <div>
                  <Label>Address 2</Label>
                  <Input
                    value={data.recentEmployer?.address2 || ''}
                    onChange={(e) => updateRecentEmployer('address2', e.target.value)}
                    placeholder="Address 2"
                  />
                </div>
                <div>
                  <Label>Town *</Label>
                  <Input
                    value={data.recentEmployer?.town || ''}
                    onChange={(e) => updateRecentEmployer('town', e.target.value)}
                    placeholder="Town"
                  />
                </div>
                <div>
                  <Label>Postcode *</Label>
                  <Input
                    value={data.recentEmployer?.postcode || ''}
                    onChange={(e) => updateRecentEmployer('postcode', e.target.value)}
                    placeholder="Postcode"
                  />
                </div>
                <div>
                  <Label>Telephone Number *</Label>
                  <Input
                    type="tel"
                    value={data.recentEmployer?.telephone || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      updateRecentEmployer('telephone', value);
                    }}
                    placeholder="Contact Number"
                  />
                </div>
                <div>
                  <Label>From *</Label>
                  <DatePicker
                    selected={data.recentEmployer?.from ? new Date(data.recentEmployer.from) : undefined}
                    onChange={(date) => {
                      if (date) {
                        // Use local date string to avoid timezone issues
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        updateRecentEmployer('from', `${year}-${month}-${day}`);
                      } else {
                        updateRecentEmployer('from', '');
                      }
                    }}
                    placeholder="Select start date"
                    maxDate={new Date()}
                  />
                  <p className="text-xs text-muted-foreground mt-1">When did you start this position?</p>
                </div>
                <div>
                  <Label>To *</Label>
                  <DatePicker
                    selected={data.recentEmployer?.to ? new Date(data.recentEmployer.to) : undefined}
                    onChange={(date) => {
                      if (date) {
                        // Use local date string to avoid timezone issues
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        updateRecentEmployer('to', `${year}-${month}-${day}`);
                      } else {
                        updateRecentEmployer('to', '');
                      }
                    }}
                    placeholder="Select end date"
                    maxDate={new Date()}
                    minDate={data.recentEmployer?.from ? new Date(data.recentEmployer.from) : undefined}
                  />
                  <p className="text-xs text-muted-foreground mt-1">When did you leave or are you still working here?</p>
                </div>
                <div>
                  <Label>Leaving date or notice (if relevant)</Label>
                  <DatePicker
                    selected={data.recentEmployer?.leavingDate ? new Date(data.recentEmployer.leavingDate) : undefined}
                    onChange={(date) => {
                      if (date) {
                        // Use local date string to avoid timezone issues
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        updateRecentEmployer('leavingDate', `${year}-${month}-${day}`);
                      } else {
                        updateRecentEmployer('leavingDate', '');
                      }
                    }}
                    placeholder="Select leaving date"
                    minDate={data.recentEmployer?.to ? new Date(data.recentEmployer.to) : undefined}
                  />
                  <p className="text-xs text-muted-foreground mt-1">If you're serving notice, when is your last day?</p>
                </div>
              </div>
              {dateErrors['recent'] && dateErrors['recent'].length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1">
                      {dateErrors['recent'].map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              <div>
                <Label>Key Tasks/Responsibilities</Label>
                <Textarea
                  value={data.recentEmployer?.keyTasks || ''}
                  onChange={(e) => updateRecentEmployer('keyTasks', e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <Label>Reason for leaving *</Label>
                <Textarea
                  value={data.recentEmployer?.reasonForLeaving || ''}
                  onChange={(e) => updateRecentEmployer('reasonForLeaving', e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-semibold">Previous Employers (from most recent)</h4>
              <Button type="button" onClick={addPreviousEmployer} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Previous Employer
              </Button>
            </div>

            {data.previousEmployers?.map((employer, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Previous Employer {index + 1}</CardTitle>
                    <Button 
                      type="button" 
                      onClick={() => removePreviousEmployer(index)} 
                      size="sm" 
                      variant="outline"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <Label>Company *</Label>
                      <Input
                        value={employer.company}
                        onChange={(e) => updatePreviousEmployer(index, 'company', e.target.value)}
                        placeholder="Employer Name"
                      />
                    </div>
                    <div>
                      <Label>Name *</Label>
                      <Input
                        value={employer.name}
                        onChange={(e) => updatePreviousEmployer(index, 'name', e.target.value)}
                        placeholder="Name"
                      />
                    </div>
                    <div>
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        value={employer.email}
                        onChange={(e) => updatePreviousEmployer(index, 'email', e.target.value)}
                        placeholder="Email"
                      />
                    </div>
                    <div>
                      <Label>Position Held *</Label>
                      <Input
                        value={employer.position}
                        onChange={(e) => updatePreviousEmployer(index, 'position', e.target.value)}
                        placeholder="Position"
                      />
                    </div>
                    <div>
                      <Label>Address *</Label>
                      <Input
                        value={employer.address}
                        onChange={(e) => updatePreviousEmployer(index, 'address', e.target.value)}
                        placeholder="Address"
                      />
                    </div>
                    <div>
                      <Label>Address 2</Label>
                      <Input
                        value={employer.address2}
                        onChange={(e) => updatePreviousEmployer(index, 'address2', e.target.value)}
                        placeholder="Address 2"
                      />
                    </div>
                    <div>
                      <Label>Town *</Label>
                      <Input
                        value={employer.town}
                        onChange={(e) => updatePreviousEmployer(index, 'town', e.target.value)}
                        placeholder="Town"
                      />
                    </div>
                    <div>
                      <Label>Postcode *</Label>
                      <Input
                        value={employer.postcode}
                        onChange={(e) => updatePreviousEmployer(index, 'postcode', e.target.value)}
                        placeholder="Postcode"
                      />
                    </div>
                    <div>
                      <Label>Telephone Number *</Label>
                      <Input
                        type="tel"
                        value={employer.telephone}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          updatePreviousEmployer(index, 'telephone', value);
                        }}
                        placeholder="Contact Number"
                      />
                    </div>
                    <div>
                      <Label>From *</Label>
                      <DatePicker
                        selected={employer.from ? new Date(employer.from) : undefined}
                        onChange={(date) => {
                          if (date) {
                            // Use local date string to avoid timezone issues
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            updatePreviousEmployer(index, 'from', `${year}-${month}-${day}`);
                          } else {
                            updatePreviousEmployer(index, 'from', '');
                          }
                        }}
                        placeholder="Select start date"
                        maxDate={new Date()}
                      />
                      <p className="text-xs text-muted-foreground mt-1">When did you start this position?</p>
                    </div>
                    <div>
                      <Label>To *</Label>
                      <DatePicker
                        selected={employer.to ? new Date(employer.to) : undefined}
                        onChange={(date) => {
                          if (date) {
                            // Use local date string to avoid timezone issues
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            updatePreviousEmployer(index, 'to', `${year}-${month}-${day}`);
                          } else {
                            updatePreviousEmployer(index, 'to', '');
                          }
                        }}
                        placeholder="Select end date"
                        maxDate={new Date()}
                        minDate={employer.from ? new Date(employer.from) : undefined}
                      />
                      <p className="text-xs text-muted-foreground mt-1">When did you leave this position?</p>
                    </div>
                    <div>
                      <Label>Leaving date or notice (if relevant)</Label>
                      <DatePicker
                        selected={employer.leavingDate ? new Date(employer.leavingDate) : undefined}
                        onChange={(date) => {
                          if (date) {
                            // Use local date string to avoid timezone issues
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            updatePreviousEmployer(index, 'leavingDate', `${year}-${month}-${day}`);
                          } else {
                            updatePreviousEmployer(index, 'leavingDate', '');
                          }
                        }}
                        placeholder="Select leaving date"
                        minDate={employer.to ? new Date(employer.to) : undefined}
                      />
                      <p className="text-xs text-muted-foreground mt-1">If you served notice, when was your last day?</p>
                    </div>
                  </div>
                  {dateErrors[`prev-${index}`] && dateErrors[`prev-${index}`].length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <ul className="list-disc list-inside space-y-1">
                          {dateErrors[`prev-${index}`].map((error, i) => (
                            <li key={i}>{error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                  <div>
                    <Label>Key Tasks/Responsibilities</Label>
                    <Textarea
                      value={employer.keyTasks}
                      onChange={(e) => updatePreviousEmployer(index, 'keyTasks', e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Reason for leaving *</Label>
                    <Textarea
                      value={employer.reasonForLeaving}
                      onChange={(e) => updatePreviousEmployer(index, 'reasonForLeaving', e.target.value)}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {data.previouslyEmployed === 'no' && (
        <div>
          <h4 className="text-md font-semibold mb-4">Character References</h4>
          <p className="text-muted-foreground">Since you haven't been previously employed, we'll collect character references in the next step.</p>
        </div>
      )}
    </div>
  );

}