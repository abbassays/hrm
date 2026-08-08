export enum QueryKeys {
  USER = 'user',

  // Employee & Onboarding domain
  EMPLOYEES = 'employees', // list
  EMPLOYEE = 'employee', // detail, keyed by id
  CURRENT_EMPLOYEE = 'current-employee', // signed-in user's identity (sidebar/greeting)
  MY_PROFILE = 'my-profile', // caller's full self-service profile (BIT-11)
  ONBOARDING = 'onboarding', // caller's own onboarding wizard data (M1.4)
  EMPLOYEE_DOCUMENTS = 'employee-documents',
  IDENTITY_DOC_FILES = 'identity-doc-files', // signed URLs + mime for previews

  // Payroll, leave & settings domain
  LEAVE_REQUESTS = 'leave-requests',
  LEAVE_BALANCE = 'leave-balance',
  MEDICAL_CLAIMS = 'medical-claims',
  MEDICAL_BALANCE = 'medical-balance',
  MEDICAL_PROOF_URLS = 'medical-proof-urls',
  OVERTIME_LOGS = 'overtime-logs',
  PAYSLIPS = 'payslips',
  PAYROLL_CYCLES = 'payroll-cycles',
  PAYROLL_SETTINGS = 'payroll-settings', // singleton payroll_settings row (BIT-15)
  PAYROLL_RUNS = 'payroll-runs', // admin run list / a run by month (BIT-15)
  RUN_PAYSLIPS = 'run-payslips', // draft/frozen payslips for one run (BIT-15)
  RUN_EXPORTS = 'run-exports', // Payoneer export artifacts for one run (BIT-16)
  POLICIES = 'policies', // admin repository: policies + full version history (BIT-21)
  ACTIVE_POLICIES = 'active-policies', // employee view: one active version per policy (BIT-21)
  POLICY_ACKNOWLEDGMENTS = 'policy-acknowledgments', // the caller's own acknowledgments (BIT-23)
  CONTRACTS = 'contracts', // admin view: one employee's full version history (BIT-22)
  MY_CONTRACT = 'my-contract', // employee view: own active contract only (BIT-22)
  CONTRACT_FILE_URLS = 'contract-file-urls', // signed URLs for contract PDFs
  HRM_SETTINGS = 'hrm-settings',
  PROJECTS = 'projects',
  ONBOARDING_EMAIL_TEMPLATE = 'onboarding-email-template',
  FX_RATES = 'fx-rates', // live exchange rates, keyed by base currency (BIT-16)

  // In-app notifications (BIT-26)
  NOTETAKER_MEETINGS = 'notetaker-meetings', // caller's own + shared Fireflies meetings
  NOTIFICATIONS = 'notifications', // caller's own notification feed (bell dropdown)
  NOTIFICATIONS_UNREAD = 'notifications-unread', // caller's unread count (bell badge)

  // System configuration & module toggles (BIT-20)
  SYSTEM_CONFIG = 'system-config', // singleton system_config row (feature flags)

  // Admin dashboard aggregations (BIT-17)
  DASHBOARD_SUMMARY = 'dashboard-summary', // guarded jsonb bundle for the admin home
  EMPLOYEES_BY_STATUS = 'employees-by-status', // count per account_status

  // Admin approvals (BIT-18)
  PENDING_APPROVALS = 'pending-approvals', // guarded pending_approvals() union across the four sources

  // Admin dashboard widgets (BIT-19)
  PAYROLL_CYCLE_COST = 'payroll-cycle-cost', // guarded sum(payslips.total_pay) for a run
  LEAVE_BALANCES_ALL = 'leave-balances-all', // guarded per-active-employee leave rollup by year
}
