export type RatingValue = "A" | "B" | "C" | "D" | "E";

export const ratingOptions: { value: RatingValue; label: string }[] = [
  { value: "A", label: "A: Provides exceptional care, exceeding client expectations" },
  { value: "B", label: "B: Provides good quality care, meeting most client needs" },
  { value: "C", label: "C: Provides satisfactory care, meeting basic client needs" },
  { value: "D", label: "D: Inconsistent in providing adequate care" },
  { value: "E", label: "E: Unsatisfactory care, immediate action required" },
];

export const questions = [
  { id: "clientCare", title: "Client Care – How effective is the employee in providing care to clients?", options: ratingOptions },
  { id: "careStandards", title: "Knowledge of Care Standards – How well does the employee adhere to policies?", options: [
    { value: "A", label: "A: Demonstrates excellent understanding and adherence" },
    { value: "B", label: "B: Generally follows care standards with minor lapses" },
    { value: "C", label: "C: Adequate understanding of care standards, some areas unclear" },
    { value: "D", label: "D: Limited understanding, further training required" },
    { value: "E", label: "E: Poor adherence to care standards, immediate improvement needed" },
  ] },
  { id: "safetyHealth", title: "Safety and Health Compliance – How consistently does the employee follow safety and health guidelines?", options: [
    { value: "A", label: "A: Always follows guidelines, ensuring client and personal safety" },
    { value: "B", label: "B: Generally safe practices with minor lapses" },
    { value: "C", label: "C: Adequate safety practices, occasional reminders needed" },
    { value: "D", label: "D: Frequently neglects safety and health guidelines" },
    { value: "E", label: "E: Disregards safety and health guidelines, immediate action required" },
  ] },
  { id: "medicationManagement", title: "Medication Management – How effectively does the employee manage and administer medication?", options: [
    { value: "A", label: "A: Flawless in medication management and administration" },
    { value: "B", label: "B: Good medication management with minor errors" },
    { value: "C", label: "C: Adequate medication management, some errors" },
    { value: "D", label: "D: Frequent errors in medication management, further training required" },
    { value: "E", label: "E: Consistent errors in medication management, immediate action required" },
  ] },
  { id: "communication", title: "Communication with Clients & Team – How effective is the employee in communicating with clients and team?", options: [
    { value: "A", label: "A: Consistently clear and respectful communication" },
    { value: "B", label: "B: Generally good communication with minor misunderstandings" },
    { value: "C", label: "C: Adequate communication skills" },
    { value: "D", label: "D: Poor communication skills, leading to misunderstandings and issues" },
    { value: "E", label: "E: Ineffective communication, immediate improvement needed" },
  ] },
  { id: "responsiveness", title: "Responsiveness and Adaptability – How well does the employee adapt to changing client needs and situations?", options: [
    { value: "A", label: "A: Quickly and effectively adapts" },
    { value: "B", label: "B: Adequately responsive with minor delays" },
    { value: "C", label: "C: Satisfactory responsiveness but slow to adapt" },
    { value: "D", label: "D: Struggles with responsiveness and adaptability" },
    { value: "E", label: "E: Unable to adapt to changing situations, immediate action required" },
  ] },
  { id: "professionalDevelopment", title: "Professional Development – How actively does the employee engage in professional development?", options: [
    { value: "A", label: "A: Actively seeks and engages in opportunities" },
    { value: "B", label: "B: Participates in professional development" },
    { value: "C", label: "C: Occasionally engages in professional development" },
    { value: "D", label: "D: Rarely engages in professional development opportunities" },
    { value: "E", label: "E: Does not engage in professional development" },
  ] },
  { id: "attendance", title: "Attendance & Punctuality – What is the employee's pattern of absence and punctuality?", options: [
    { value: "A", label: "A: Always punctual, rarely absent" },
    { value: "B", label: "B: Generally punctual with acceptable attendance" },
    { value: "C", label: "C: Occasional lateness or absence" },
    { value: "D", label: "D: Frequent lateness or absences, attention required" },
    { value: "E", label: "E: Consistently late and/or absent, immediate action required" },
  ] },
] as const;