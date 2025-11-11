import React, { useEffect, useState } from 'react';
import type { JobApplicationData } from './types';
import { getTimeSlotMappings, mapTimeSlotIds } from '@/utils/timeSlotUtils';
import { EnhancedSkillsSection } from './EnhancedSkillsSection';

interface Props {
  data: JobApplicationData;
}

export function ReviewSummary({ data }: Props) {
  const [timeSlotMappings, setTimeSlotMappings] = useState<Record<string, string>>({});

  useEffect(() => {
    getTimeSlotMappings().then(setTimeSlotMappings);
  }, []);

  const pi = data.personalInfo || ({} as any);
  const av = data.availability || ({} as any);
  const ec = data.emergencyContact || ({} as any);
  const eh = data.employmentHistory || ({} as any);
  const refs: any[] = Object.values<any>(data.references || {});
  const skills = data.skillsExperience?.skills || {};
  const dec = data.declaration || ({} as any);
  const tp = data.termsPolicy || ({} as any);

  // Helper function to format date from YYYY-MM-DD to DD-MM-YYYY
  const formatDateToDDMMYYYY = (dateString: string | null | undefined): string => {
    if (!dateString) return 'Not provided';
    
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      return dateString; // Return original if conversion fails
    }
  };

  // Map time slots to readable labels
  const mappedTimeSlots = av.timeSlots ? mapTimeSlotIds(av.timeSlots, timeSlotMappings) : {};

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold">Personal Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3">
          <Field label="Title" value={pi.title} />
          <Field label="Full Name" value={pi.fullName} />
          <Field label="Email" value={pi.email} />
          <Field label="Confirm Email" value={pi.confirmEmail} />
          <Field label="Telephone/Mobile" value={pi.telephone} />
          <Field label="Date of Birth" value={formatDateToDDMMYYYY(pi.dateOfBirth)} />
          <Field label="Street Address" value={pi.streetAddress} />
          <Field label="Street Address 2" value={pi.streetAddress2} />
          <Field label="Town" value={pi.town} />
          <Field label="Borough" value={pi.borough} />
          <Field label="Postcode" value={pi.postcode} />
          <Field label="English Proficiency" value={pi.englishProficiency} />
          <Field label="Other Languages" value={(pi.otherLanguages || []).join(', ')} />
          <Field label="Position Applied For" value={pi.positionAppliedFor} />
          <Field label="Which personal care Are you willing to do?" value={pi.personalCareWillingness === 'yes' ? 'Not specified' : (pi.personalCareWillingness || 'Not specified')} />
          <Field label="DBS" value={pi.hasDBS} />
          <Field label="Car & Licence" value={pi.hasCarAndLicense} />
          <Field label="NI Number" value={pi.nationalInsuranceNumber} />
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold">Availability</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3">
          <Field label="Hours per Week" value={av.hoursPerWeek} />
          <Field label="Right to Work (UK)" value={av.hasRightToWork} />
        </div>
        {Object.keys(mappedTimeSlots).length > 0 && (
          <div className="mt-3">
            <div className="text-sm text-muted-foreground">Selected Time Slots</div>
            <ul className="list-disc pl-5 mt-1">
              {Object.entries(mappedTimeSlots).map(([slotLabel, days]) => (
                <li key={slotLabel}>
                  <span className="font-medium">{slotLabel}:</span> {(Array.isArray(days) ? days : [days]).join(', ')}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-lg font-semibold">Emergency Contact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3">
          <Field label="Full Name" value={ec.fullName} />
          <Field label="Relationship" value={ec.relationship} />
          <Field label="Contact Number" value={ec.contactNumber} />
          <Field label="How did you hear about us" value={ec.howDidYouHear} />
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold">Employment History</h3>
        <div className="mt-3 space-y-3">
          <Field label="Previously Employed" value={eh.previouslyEmployed} />
          {eh.previouslyEmployed === 'yes' && eh.recentEmployer && (
            <div>
              <div className="text-sm font-medium">Most Recent Employer</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-2">
                <Field label="Company" value={eh.recentEmployer.company} />
                <Field label="Name" value={eh.recentEmployer.name} />
                <Field label="Email" value={eh.recentEmployer.email} />
                <Field label="Position Held" value={eh.recentEmployer.position} />
                <Field label="Address 1" value={eh.recentEmployer.address} />
                <Field label="Address 2" value={eh.recentEmployer.address2} />
                <Field label="Town" value={eh.recentEmployer.town} />
                <Field label="Postcode" value={eh.recentEmployer.postcode} />
                <Field label="Telephone" value={eh.recentEmployer.telephone} />
                <Field label="From" value={formatDateToDDMMYYYY(eh.recentEmployer.from)} />
                <Field label="To" value={formatDateToDDMMYYYY(eh.recentEmployer.to)} />
                <Field label="Leaving Date/Notice" value={eh.recentEmployer.leavingDate} />
                <Field label="Reason for Leaving" value={eh.recentEmployer.reasonForLeaving} />
              </div>
              {eh.recentEmployer.keyTasks && (
                <div className="mt-2">
                  <div className="text-sm font-medium">Key Tasks</div>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{eh.recentEmployer.keyTasks}</p>
                </div>
              )}
            </div>
          )}
          {(eh.previousEmployers || []).length > 0 && (
            <div>
              <div className="text-sm font-medium">Previous Employers</div>
              <div className="space-y-4 mt-2">
                {(eh.previousEmployers || []).map((emp: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <Field label="Company" value={emp.company} />
                    <Field label="Name" value={emp.name} />
                    <Field label="Email" value={emp.email} />
                    <Field label="Position Held" value={emp.position} />
                    <Field label="Address 1" value={emp.address} />
                    <Field label="Address 2" value={emp.address2} />
                    <Field label="Town" value={emp.town} />
                    <Field label="Postcode" value={emp.postcode} />
                    <Field label="Telephone" value={emp.telephone} />
                    <Field label="From" value={formatDateToDDMMYYYY(emp.from)} />
                    <Field label="To" value={formatDateToDDMMYYYY(emp.to)} />
                    <Field label="Leaving Date/Notice" value={emp.leavingDate} />
                    <Field label="Reason for Leaving" value={emp.reasonForLeaving} />
                    {emp.keyTasks && (
                      <div className="sm:col-span-2">
                        <div className="text-sm font-medium">Key Tasks</div>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{emp.keyTasks}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold">References</h3>
        <div className="space-y-4 mt-3">
          {refs.filter((r) => r && (r.name || r.company || r.email)).length === 0 && (
            <p className="text-sm text-muted-foreground">No references provided.</p>
          )}
          {refs
            .filter((r) => r && (r.name || r.company || r.email))
            .map((ref, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Field label="Name" value={ref.name} />
                <Field label="Company" value={ref.company} />
                <Field label="Job Title" value={ref.jobTitle} />
                <Field label="Email" value={ref.email} />
                <Field label="Contact Number" value={ref.contactNumber} />
                <Field label="Address 1" value={ref.address} />
                <Field label="Address 2" value={ref.address2} />
                <Field label="Town" value={ref.town} />
                <Field label="Postcode" value={ref.postcode} />
              </div>
            ))}
        </div>
      </section>

      <EnhancedSkillsSection data={data} />

      <section>
        <h3 className="text-lg font-semibold">Declaration</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3">
          <Field label="Social Service Enquiry" value={dec.socialServiceEnquiry} />
          <Field label="Convicted of Offence" value={dec.convictedOfOffence} />
          <Field label="Safeguarding Investigation" value={dec.safeguardingInvestigation} />
          <Field label="Criminal Convictions" value={dec.criminalConvictions} />
          <Field label="Health Conditions" value={dec.healthConditions} />
          <Field label="Cautions / Reprimands" value={dec.cautionsReprimands} />
        </div>
        <div className="mt-3 space-y-2">
          {dec.socialServiceDetails && <Detail label="Details" value={dec.socialServiceDetails} />}
          {dec.convictedDetails && <Detail label="Details" value={dec.convictedDetails} />}
          {dec.safeguardingDetails && <Detail label="Details" value={dec.safeguardingDetails} />}
          {dec.criminalDetails && <Detail label="Details" value={dec.criminalDetails} />}
          {dec.healthDetails && <Detail label="Details" value={dec.healthDetails} />}
          {dec.cautionsDetails && <Detail label="Details" value={dec.cautionsDetails} />}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold">Terms & Policy</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3">
          <Field label="Consent to Terms" value={tp.consentToTerms ? 'Yes' : 'No'} />
          <Field label="Signature (name)" value={tp.signature} />
          <Field label="Date" value={formatDateToDDMMYYYY(tp.date)} />
        </div>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="text-sm">{value || 'Not provided'}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-sm font-medium">{label}</div>
      <p className="text-sm text-muted-foreground whitespace-pre-line">{value}</p>
    </div>
  );
}

export default ReviewSummary;
