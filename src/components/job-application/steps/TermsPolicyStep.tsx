import { TermsPolicy } from '../types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';

interface TermsPolicyStepProps {
  data: TermsPolicy;
  updateData: (field: keyof TermsPolicy, value: string | boolean) => void;
}

export function TermsPolicyStep({ data, updateData }: TermsPolicyStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Terms & Policy</h3>
      </div>

      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-800">Consent to the terms of the Data Protection</CardTitle>
        </CardHeader>
        <CardContent className="text-green-700 text-sm space-y-3">
          <p>
            We process the information you provide on this form as necessary to aid the Recruitment Process 
            to progress your application for employment and, if your application is successful, to administer 
            your personnel record.
          </p>
          <p>
            Please read our Data Protection & Privacy Statement that sets out the terms of use of the site. 
            This contains details of our data collection policies and use of personal data.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-start space-x-3">
        <Checkbox
          id="consentToTerms"
          checked={data.consentToTerms}
          onCheckedChange={(checked) => updateData('consentToTerms', checked === true)}
        />
        <Label htmlFor="consentToTerms" className="text-sm leading-relaxed">
          I declare that, to the best of my knowledge, all parts of this form have been completed and are accurate 
          and apply for the position conditionally upon this declaration. *
        </Label>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="signature">Digital Signature *</Label>
          <Input
            id="signature"
            value={data.signature}
            onChange={(e) => updateData('signature', e.target.value)}
            placeholder="Type your full name as your digital signature"
            required
          />
        </div>

        <div>
          <Label htmlFor="date">Date *</Label>
          <DatePicker
            selected={data.date ? new Date(data.date) : undefined}
            onChange={(date) => {
              updateData('date', date ? date.toISOString().split('T')[0] : '');
            }}
            placeholder="Select today's date"
          />
        </div>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <p className="text-sm text-amber-700">
            By completing this form and clicking submit, you are providing your digital signature and 
            confirming that all information provided is accurate and complete.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}