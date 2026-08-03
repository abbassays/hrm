// Domain types for Bitsmiths HRM (PRD-aligned). These mirror the intended
// Supabase schema so the later mock → backend swap only touches the hooks.

import { type CustomField } from '@/schema/payroll';

/** Invited employees enter onboarding; completing it activates them directly. */
export type AccountStatus = 'invited' | 'onboarding' | 'active' | 'disabled';

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'internship';

/** Drives medical-allowance eligibility (Medical Allowance Policy §1) —
 *  probation and notice-period employees aren't eligible even if
 *  full-time. */
export type EmploymentStage = 'probation' | 'confirmed' | 'notice_period';

/** Paid, Sick, and Half Day draw from the shared 22-day pool (half day = 0.5).
 *  Unpaid is separate, uncapped, and the only type that prorates pay. */
export type LeaveType = 'paid' | 'sick' | 'unpaid' | 'half_day';

export type MedicalClaimFor = 'self' | 'parent' | 'spouse' | 'child';

/** Medical Allowance Policy §3 — eligible expense categories. */
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

/** The subset of `Employee` the admin directory list renders. The list query
 *  fetches only these columns so it never ships bank/CNIC/salary/social data for
 *  every employee to the browser — the full `Employee` is loaded per-row on the
 *  detail page instead. */
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
  /** Set by admin when status is 'rejected' — shown to the employee (in the
   *  decision email and their leave history). */
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
  /** Set by admin when status is 'rejected' — shown to the employee. */
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
  /** Set by admin when status is 'rejected' — shown to the employee. */
  rejectionReason: string | null;
  createdAt: string;
};

/** Request sources that feed the unified admin approvals queue. */
export type ApprovalKind = 'leave' | 'medical' | 'overtime';

/** One normalized row from `pending_approvals()`. Each source projects to this
 *  common shape; `amount` is populated only for medical (whole PKR) and null for
 *  the rest, and `submitted_at` unifies each source's timestamp for ordering. */
export type PendingApproval = {
  kind: ApprovalKind;
  item_id: string;
  employee_id: string;
  employee_name: string;
  summary: string;
  amount: number | null;
  submitted_at: string;
};

/** Admin-home aggregation bundle, one guarded `dashboard_summary()` fetch. */
export type DashboardSummary = {
  pendingLeave: number;
  pendingMedical: number;
  pendingOvertime: number;
  activeEmployees: number;
  /** Latest run's status, or null when no payroll run exists yet. */
  payrollCycle: PayrollCycleStatus | null;
};

/** One row per account_status present in the directory. */
export type EmployeeStatusCount = { status: AccountStatus; count: number };

export type Payslip = {
  id: string;
  employeeId: string;
  employeeName: string;
  /** Job title at the time the cycle ran — shown on the payslip PDF. */
  designation: string;
  cycleMonth: string; // e.g. '2026-06'
  baseSalary: number;
  daysWorked: number;
  daysInMonth: number;
  totalBase: number;
  medical: number;
  overtimeHours: number;
  /** Per-hour overtime rate (base ÷ working hours × multiplier), frozen on the
   *  snapshot. Shown on the itemized payslip alongside hours and pay. */
  overtimeRate?: number;
  /** Defaults to the global setting, but admin can override it per employee
   *  while the cycle is open — frozen here once the cycle is locked. */
  overtimeMultiplier: number;
  overtimePay: number;
  /** Tax withheld this cycle (global taxRatePercent × gross earnings),
   *  frozen here once the cycle is locked. */
  taxDeduction: number;
  /** Ad-hoc per-employee line items (bonus, deduction, etc.) admin adds
   *  during the cycle — each folds into `total`. */
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

export type PayslipContactKind = 'site' | 'phone' | 'pin';

export type PayrollCycle = {
  id: string;
  month: string; // e.g. '2026-06'
  status: PayrollCycleStatus;
  totalPayroll: number;
  employeeCount: number;
  lockedAt: string | null;
};

export type HrmSettings = {
  /** Applied to the hourly rate when calculating overtime pay during a
   *  payroll run. Admin-configured only — never shown to employees
   *  (PRD 5.3.1). */
  overtimeMultiplier: number;
  /** Percentage of gross earnings withheld as tax each payroll cycle.
   *  0 disables tax withholding entirely. */
  taxRatePercent: number;
  /** Size of the shared annual leave pool (Paid + Sick + Half Day), in
   *  days. Resets each year. */
  leavePoolDays: number;
  /** Monthly medical allowance accrual, in PKR. */
  medicalMonthlyAccrual: number;
  /** Absolute cap on accrued medical allowance, in PKR. */
  medicalBalanceCap: number;
};

/** App-wide module toggles / feature flags, stored in the `system_config`
 *  singleton. Any authenticated user can read them (the nav shell needs to know
 *  which modules are enabled); only admins can change them (BIT-20). */
export type SystemConfig = {
  /** Whether the Reimbursements module is live. `false` keeps the
   *  Reimbursements nav entry hidden app-wide (Phase 2 stays dark); flipping it
   *  true reveals it. */
  reimbursementsEnabled: boolean;
  /** ISO timestamp of the last change to the toggles. */
  updatedAt: string;
};

/** Keys of `SystemConfig` that are boolean module toggles (excludes metadata
 *  such as `updatedAt`). A nav entry can be gated on one of these. */
export type ModuleFlag = 'reimbursementsEnabled';

/** Admin-managed list employees pick from when logging overtime. */
export type Project = {
  id: string;
  name: string;
  description: string;
  techStack: string[];
  /** Repo or live URL. Optional — some internal projects have none. */
  url: string;
  /** Inactive projects are hidden from overtime logging and onboarding. */
  active: boolean;
};

/** The single reusable invitation email (PRD 6.4) — one template, edited in
 *  admin config and sent on every invite. `{{placeholders}}` are filled in
 *  per recipient when the invite goes out. */
export type OnboardingEmailTemplate = {
  subject: string;
  /** Rich-text body authored in CKEditor, stored as HTML. */
  bodyHtml: string;
};

export type PolicyCategory = 'leave' | 'medical' | 'overtime' | 'general';

export type PolicyVersion = {
  /** The `policy_versions` row id — what an acknowledgment points at. */
  id: string;
  version: number;
  /** Rich-text content authored in CKEditor, stored as HTML — not a PDF —
   *  so a diff against the previous version can highlight exactly what
   *  changed for employees, instead of just swapping in a new file. */
  contentHtml: string;
  publishedAt: string;
};

export type Policy = {
  id: string;
  title: string;
  /** Kebab-case, unique, stable across title edits — the join key M3.5 uses to
   *  tie a policy document to the rule the system actually enforces. */
  slug: string;
  category: PolicyCategory;
  /** Oldest first; the last entry is the current version. */
  versions: PolicyVersion[];
};

/** A policy flattened onto its single active version — what employees see and
 *  what the sidebar badge counts. Deliberately omits `contentHtml`: the list
 *  only needs the heading, and the body is fetched on the detail page. */
export type ActivePolicy = {
  id: string;
  title: string;
  slug: string;
  category: PolicyCategory;
  /** The `policy_versions` row id of the active version — what an
   *  acknowledgment actually points at. The version *number* below is for
   *  display and for comparing against what the employee last acknowledged. */
  versionId: string;
  version: number;
  publishedAt: string;
};

/** One employee's acknowledgment of a policy — separate from `Policy`
 *  itself since each employee can be at a different acknowledged version.
 *  Rows are append-only: acknowledging v2 does not replace the v1 record, so
 *  the admin's per-version roster can still show who signed what, when. */
export type PolicyAcknowledgment = {
  policyId: string;
  employeeId: string;
  /** The acknowledged `policy_versions` row. Carried alongside the version
   *  number because the number is only unique *within* a policy. */
  policyVersionId: string;
  acknowledgedVersion: number;
  acknowledgedAt: string;
};

/** One employee's standing against one policy's currently-active version, as
 *  returned by the `policy_compliance()` RPC. */
export type PolicyComplianceEmployee = {
  employeeId: string;
  fullName: string;
  acknowledged: boolean;
  /** Null exactly when `acknowledged` is false. */
  acknowledgedAt: string | null;
};

/** A policy's compliance roster, rolled up from `policy_compliance()`. Measured
 *  against the active version only — a prior-version acknowledgment does not
 *  count, which is why publishing an update drops the percentage. */
export type PolicyCompliance = {
  policyId: string;
  title: string;
  /** The active version everyone is measured against — shown next to the title
   *  so the grid names what "acknowledged" refers to. */
  version: number;
  employees: PolicyComplianceEmployee[];
  acknowledgedCount: number;
  totalCount: number;
};

/** One row of the admin compliance grid. The grid is a two-level tree — a
 *  policy rollup with its employees as expandable sub-rows — and TanStack Table
 *  needs a single row type for both levels, so `employee` is what distinguishes
 *  a child row from its parent. */
export type PolicyComplianceRow = {
  /** Unique across both levels: the policy id, or `<policyId>:<employeeId>`. */
  id: string;
  policy: PolicyCompliance;
  /** Set on employee rows, absent on the policy rollup row. */
  employee?: PolicyComplianceEmployee;
  subRows?: PolicyComplianceRow[];
};

/** One policy's standing against the rule it governs (BIT-25). Drift is a pure
 *  version comparison — the policy's current active version vs the one an admin
 *  last reconciled — never a diff of policy prose against enforced values. */
export type PolicyLinkage = {
  policyId: string;
  title: string;
  /** The join key into `POLICY_LINKS`; an unmapped slug renders "no linked rule". */
  slug: string;
  /** The `policy_versions` row that is active right now. */
  activeVersionId: string;
  activeVersion: number;
  /** The version an admin last marked reviewed, or null if never reconciled. */
  reconciledVersionId: string | null;
  /** True when the active version differs from the reconciled one — i.e. the
   *  policy changed since it was last confirmed to match the enforced rule. */
  hasDrift: boolean;
};

export type ContractVersion = {
  version: number;
  fileName: string;
  /** Key in the private `contracts` bucket; the UI mints a short-lived signed
   *  URL from it on demand (see `useContractFileUrls`). */
  storagePath: string;
  uploadedAt: string;
  /** e.g. "Annual renewal", "Promoted to Senior Engineer". */
  note: string | null;
};

/** One contract per employee (PRD 6.2 — manual PDF upload, not
 *  system-generated). Admin sees the full version history; the employee
 *  only ever sees their current version — enforced by `contracts_select_own`,
 *  not just by the query. */
export type EmployeeContract = {
  employeeId: string;
  /** Oldest first; the last entry is the current version. */
  versions: ContractVersion[];
};

/** The event kinds a notification can carry. The table is generic (`type` +
 *  `link`), so this is a string on the wire; the union documents the producers
 *  that exist today (BIT-26 ships only `policy_updated`) and stays open for
 *  later ones without a schema change. */
export type NotificationType = 'policy_updated' | (string & {});

/** One row of the signed-in user's in-app notification feed (BIT-26). Rows are
 *  trigger-created, never client-inserted; the client only ever flips
 *  `readAt` via mark-read. */
export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  /** Longer supporting line; null for events that need only a title. */
  body: string | null;
  /** In-app route the bell navigates to on click, e.g. '/policies'. */
  link: string | null;
  /** Null until the recipient reads it — the unread test. */
  readAt: string | null;
  createdAt: string;
};
