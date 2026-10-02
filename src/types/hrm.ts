// Domain types for Bitsmiths HRM (PRD-aligned). These mirror the intended
// Supabase schema so the later mock → backend swap only touches the hooks.

import { type CustomField } from '@/schema/payroll';

export type AccountStatus = 'invited' | 'onboarding' | 'active' | 'disabled';

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'internship';

export type EmploymentStage = 'probation' | 'confirmed' | 'notice_period';

export type LeaveType = 'paid' | 'sick' | 'unpaid' | 'half_day';

export type MedicalClaimFor = 'self' | 'parent' | 'spouse' | 'child';

export type MedicalServiceType =
  | 'consultation'
  | 'hospitalization'
  | 'medication'
  | 'lab_diagnostics'
  | 'emergency'
  | 'dental'
  | 'vision';

export type PayrollCycleStatus = 'open' | 'calculating' | 'locked';

export type BankInfo = {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  iban: string;
  branch?: string;
};

export type SocialAccounts = {
  github: string;
  linkedin: string;
  twitter?: string;
};

export type Employee = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  emergencyContact: string;
  address: string;
  city: string;
  postalCode: string;
  cnic: string;
  dateOfBirth: string; // ISO date
  bank: BankInfo | null;
  social: SocialAccounts | null;
  employmentType: EmploymentType;
  employmentStage: EmploymentStage;
  baseSalary: number; // PKR
  workingHours: number; // standard hours per month
  designation: string;
  department: string;
  // Per-employee allowance overrides; null means inherit the global setting.
  leavePoolDaysOverride: number | null;
  medicalAccrualMonthlyOverride: number | null; // PKR
  medicalCapOverride: number | null; // PKR
  otMultiplierOverride: number | null;
  status: AccountStatus;
  disabledAt: string | null;
  invitedAt: string;
  joinedAt: string | null;
};

export type EmployeeListItem = Pick<
  Employee,
  | 'id'
  | 'fullName'
  | 'email'
  | 'designation'
  | 'department'
  | 'employmentType'
  | 'status'
  | 'disabledAt'
  | 'invitedAt'
  | 'social'
>;

export type LeaveRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  type: LeaveType;
  reason: string;
  startDate: string;
  days: number; // 0.5 for half day
  status: RequestStatus;
  rejectionReason: string | null;
  createdAt: string;
};

export type MedicalClaim = {
  id: string;
  employeeId: string;
  employeeName: string;
  claimFor: MedicalClaimFor;
  serviceType: MedicalServiceType;
  description: string;
  amount: number; // PKR
  expenseDate: string;
  proofFiles: string[]; // file names/URLs
  status: RequestStatus;
  rejectionReason: string | null;
  createdAt: string;
};

export type OvertimeLog = {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  hours: number;
  project: string;
  task: string;
  status: RequestStatus;
  rejectionReason: string | null;
  createdAt: string;
};

export type ApprovalKind = 'leave' | 'medical' | 'overtime';

export type PendingApproval = {
  kind: ApprovalKind;
  item_id: string;
  employee_id: string;
  employee_name: string;
  summary: string;
  amount: number | null;
  submitted_at: string;
};

export type DashboardSummary = {
  pendingLeave: number;
  pendingMedical: number;
  pendingOvertime: number;
  activeEmployees: number;
  payrollCycle: PayrollCycleStatus | null;
};

export type EmployeeStatusCount = { status: AccountStatus; count: number };

export type Payslip = {
  id: string;
  employeeId: string;
  employeeName: string;
  designation: string;
  cycleMonth: string; // e.g. '2026-06'
  baseSalary: number;
  daysWorked: number;
  daysInMonth: number;
  totalBase: number;
  medical: number;
  overtimeHours: number;
  overtimeRate?: number;
  overtimeMultiplier: number;
  overtimePay: number;
  taxDeduction: number;
  customFields: CustomField[];
  total: number;
};

export type PayslipMetaField = {
  label: string;
  value: string;
};

export type PayslipLineItem = {
  label: string;
  note?: string;
  amount: number;
};

export type PayslipLogoVariant = 'default' | 'light' | 'watermark';

export type PayslipContactKind = 'site' | 'phone';

export type PayrollCycle = {
  id: string;
  month: string; // e.g. '2026-06'
  status: PayrollCycleStatus;
  totalPayroll: number;
  employeeCount: number;
  lockedAt: string | null;
};

export type HrmSettings = {
  overtimeMultiplier: number;
  taxRatePercent: number;
  leavePoolDays: number;
  medicalMonthlyAccrual: number;
  medicalBalanceCap: number;
};

export type SystemConfig = {
  reimbursementsEnabled: boolean;
  updatedAt: string;
};

export type ModuleFlag = 'reimbursementsEnabled';

export type Project = {
  id: string;
  name: string;
  description: string;
  techStack: string[];
  url: string;
  active: boolean;
};

export type OnboardingEmailTemplate = {
  subject: string;
  bodyHtml: string;
};

export type PolicyCategory = 'leave' | 'medical' | 'overtime' | 'general';

export type PolicyVersion = {
  id: string;
  version: number;
  contentHtml: string;
  publishedAt: string;
  isActive: boolean;
};

export type Policy = {
  id: string;
  title: string;
  slug: string;
  category: PolicyCategory;
  versions: PolicyVersion[];
};
export type ActivePolicy = {
  id: string;
  title: string;
  slug: string;
  category: PolicyCategory;
  versionId: string;
  version: number;
  publishedAt: string;
};
export type PolicyAcknowledgment = {
  policyId: string;
  employeeId: string;
  policyVersionId: string;
  acknowledgedVersion: number;
  acknowledgedAt: string;
};
export type PolicyComplianceEmployee = {
  employeeId: string;
  fullName: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
};
export type PolicyCompliance = {
  policyId: string;
  title: string;
  version: number;
  employees: PolicyComplianceEmployee[];
  acknowledgedCount: number;
  totalCount: number;
};
export type PolicyComplianceRow = {
  id: string;
  policy: PolicyCompliance;
  employee?: PolicyComplianceEmployee;
  subRows?: PolicyComplianceRow[];
};
export type PolicyLinkage = {
  policyId: string;
  title: string;
  slug: string;
  activeVersionId: string;
  activeVersion: number;
  // The version an admin last marked reviewed, or null if never reconciled.
  reconciledVersionId: string | null;
  hasDrift: boolean;
};

export type ContractVersion = {
  version: number;
  fileName: string;
  storagePath: string;
  uploadedAt: string;
  note: string | null;
};
export type EmployeeContract = {
  employeeId: string;
  versions: ContractVersion[];
};

export type NotificationType = 'policy_updated' | (string & {});

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type PayrollExportRow = {
  employeeId: string;
  employeeName: string;
  total: number;
};
