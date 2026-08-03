import {
  AccountStatus,
  EmploymentStage,
  EmploymentType,
  LeaveType,
  MedicalClaimFor,
  MedicalServiceType,
  PayrollCycleStatus,
  PolicyCategory,
  RequestStatus,
} from '@/types/hrm';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

type StatusPresentation = { label: string; variant: BadgeVariant };

export const requestStatusLabels: Record<RequestStatus, StatusPresentation> = {
  pending: { label: 'Pending', variant: 'secondary' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
};

export const accountStatusLabels: Record<AccountStatus, StatusPresentation> = {
  invited: { label: 'Invited', variant: 'outline' },
  onboarding: { label: 'Onboarding', variant: 'secondary' },
  active: { label: 'Active', variant: 'default' },
  disabled: { label: 'Disabled', variant: 'destructive' },
};

export const payrollCycleStatusLabels: Record<
  PayrollCycleStatus,
  StatusPresentation
> = {
  open: { label: 'Open', variant: 'secondary' },
  calculating: { label: 'Calculating', variant: 'outline' },
  locked: { label: 'Locked', variant: 'default' },
};

export const leaveTypeLabels: Record<LeaveType, string> = {
  paid: 'Paid Leave',
  sick: 'Sick Leave',
  unpaid: 'Unpaid Leave',
  half_day: 'Half Day',
};

export const employmentTypeLabels: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
};

export const employmentStageLabels: Record<EmploymentStage, string> = {
  probation: 'Probation',
  confirmed: 'Confirmed',
  notice_period: 'Notice Period',
};

export const medicalClaimForLabels: Record<MedicalClaimFor, string> = {
  self: 'Self',
  parent: 'Parent',
  spouse: 'Spouse',
  child: 'Child',
};

export const medicalServiceTypeLabels: Record<MedicalServiceType, string> = {
  consultation: 'Doctor Consultation',
  hospitalization: 'Hospital Admission & Treatment',
  medication: 'Prescription Medication',
  lab_diagnostics: 'Lab Tests & Diagnostics',
  emergency: 'Emergency Care',
  dental: 'Dental (Medical Necessity)',
  vision: 'Vision Care',
};

export const policyCategoryLabels: Record<PolicyCategory, string> = {
  leave: 'Leave',
  medical: 'Medical',
  overtime: 'Overtime',
  general: 'General',
};
