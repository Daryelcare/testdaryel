import { Declaration } from '../types';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DeclarationStepProps {
  data: Declaration;
  updateData: (field: keyof Declaration, value: string) => void;
}

export function DeclarationStep({ data, updateData }: DeclarationStepProps) {
  const hasAnyYesAnswers = Object.entries(data).some(([key, value]) => 
    !key.includes('Details') && value === 'yes'
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Applicant Declaration</h3>
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800">Protection of Children, Vulnerable Adults and criminal convictions</CardTitle>
          </CardHeader>
          <CardContent className="text-amber-700 text-sm">
            <p className="mb-3">
              United Kingdom legislation and guidance relating to the welfare of children and vulnerable adults has at its core, 
              the principle that the welfare of vulnerable persons must be the paramount consideration.
            </p>
            <p className="mb-3">
              Our care Agency fully supports this principle and therefore, we require that everyone who may come into contact 
              with children and vulnerable persons or have access to their personal details, complete and sign this declaration.
            </p>
            <p>
              This record is to ensure that the children and vulnerable person's welfare is safeguarded. 
              It will be kept with the strictest confidence.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <div>
          <Label>Has any Social Service Department or Police Service ever conducted an enquiry or investigation into any allegations or concerns that you may pose an actual or potential risk to children or vulnerable adults? *</Label>
          <Select value={data.socialServiceEnquiry} onValueChange={(value) => updateData('socialServiceEnquiry', value)}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
          {data.socialServiceEnquiry === 'yes' && (
            <div className="mt-3">
              <Label>Please provide details:</Label>
              <Textarea
                value={data.socialServiceDetails || ''}
                onChange={(e) => updateData('socialServiceDetails', e.target.value)}
                placeholder="Please provide full details..."
                rows={3}
                className="mt-2"
              />
            </div>
          )}
        </div>

        <div>
          <Label>Have you ever been convicted of any offence relating to children or vulnerable adults? *</Label>
          <Select value={data.convictedOfOffence} onValueChange={(value) => updateData('convictedOfOffence', value)}>
            <SelectTrigger className="min-h-[44px] mt-2">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
          {data.convictedOfOffence === 'yes' && (
            <div className="mt-3">
              <Label>Please provide details:</Label>
              <Textarea
                value={data.convictedDetails || ''}
                onChange={(e) => updateData('convictedDetails', e.target.value)}
                placeholder="Please provide full details..."
                rows={3}
                className="mt-2"
              />
            </div>
          )}
        </div>

        <div>
          <Label>Have you ever been subject to any safeguarding investigation, criminal investigation or any investigations by previous employer? *</Label>
          <Select value={data.safeguardingInvestigation} onValueChange={(value) => updateData('safeguardingInvestigation', value)}>
            <SelectTrigger className="min-h-[44px] mt-2">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
          {data.safeguardingInvestigation === 'yes' && (
            <div className="mt-3">
              <Label>Please provide details:</Label>
              <Textarea
                value={data.safeguardingDetails || ''}
                onChange={(e) => updateData('safeguardingDetails', e.target.value)}
                placeholder="Please provide full details..."
                rows={3}
                className="mt-2"
              />
            </div>
          )}
        </div>

        <div>
          <Label>Do you have any criminal convictions spent or unspent? *</Label>
          <Select value={data.criminalConvictions} onValueChange={(value) => updateData('criminalConvictions', value)}>
            <SelectTrigger className="min-h-[44px] mt-2">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
          {data.criminalConvictions === 'yes' && (
            <div className="mt-3">
              <Label>Please provide details:</Label>
              <Textarea
                value={data.criminalDetails || ''}
                onChange={(e) => updateData('criminalDetails', e.target.value)}
                placeholder="Please provide full details..."
                rows={3}
                className="mt-2"
              />
            </div>
          )}
        </div>

        <div>
          <Label>Do you have any physical or mental health conditions which may hinder your ability to carry on or work for the purpose of care activities? *</Label>
          <Select value={data.healthConditions} onValueChange={(value) => updateData('healthConditions', value)}>
            <SelectTrigger className="min-h-[44px] mt-2">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
          {data.healthConditions === 'yes' && (
            <div className="mt-3">
              <Label>Please provide details:</Label>
              <Textarea
                value={data.healthDetails || ''}
                onChange={(e) => updateData('healthDetails', e.target.value)}
                placeholder="Please provide full details..."
                rows={3}
                className="mt-2"
              />
            </div>
          )}
        </div>

        <div>
          <Label>Have you received cautions, reprimands or final warnings which are spent or unspent? *</Label>
          <Select value={data.cautionsReprimands} onValueChange={(value) => updateData('cautionsReprimands', value)}>
            <SelectTrigger className="min-h-[44px] mt-2">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
          {data.cautionsReprimands === 'yes' && (
            <div className="mt-3">
              <Label>Please provide details:</Label>
              <Textarea
                value={data.cautionsDetails || ''}
                onChange={(e) => updateData('cautionsDetails', e.target.value)}
                placeholder="Please provide full details..."
                rows={3}
                className="mt-2"
              />
            </div>
          )}
        </div>

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-700">
              I declare that to the best of my knowledge the above information, and that submitted in any accompanying documents, is correct, and:
            </p>
            <ul className="list-disc list-inside text-sm text-blue-700 mt-3 space-y-1">
              <li>I give permission for any enquiries that need to be made to confirm such matters as qualifications, experience and dates of employment and for the release by other people or organisations of such information as may be necessary for that purpose.</li>
              <li>I confirm that the above information given by me is correct and that I consent to my personal data being processed and kept for the purpose described above in accordance with the Data Protection Act 1998.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}