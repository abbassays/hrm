# HRM Screen Outlines (Content-First)

Level-1 fidelity per the prototype skill: what each screen must answer, before any
layout or code. Source of truth for scope is `Bitsmiths_HRM_PRD.pdf`; leave rule
confirmed 2026-07-06: 22-day pool = Paid + Sick + Half Day (0.5), Unpaid separate,
uncapped, only Unpaid prorates pay.

Build order: Slice 0 (shell + shared primitives) → Onboarding → Leave → Medical →
Overtime → Payroll → Policy & Contract + Admin dashboard home.

---

## Employee side `(employee)` route group

### Dashboard `/dashboard`

Answers: "Where do I stand, and is anything waiting on me?"

- Greeting + account status (if not Active, onboarding CTA banner)
- Balance cards: leave pool (used / 22), medical balance (accrued / 50,000 cap)
- My pending requests (leave + medical + overtime, with status badges)
- Latest payslip link
- Unacknowledged policies prompt (if any)

### Onboarding `/onboarding`

Answers: "What do I need to provide to become active?"

- 5-step wizard with progress indicator: Personal Info → Bank Info → Social
  Accounts → Identity Documents (CNIC front/back, photo) → Consent & Agreement
- Each step: required fields per PRD 4.2.3, inline validation, save-and-continue
- Final state: account is immediately Active (decided 2026-07-06: no admin
  review/verification step — overrides PRD 4.2.4)

### Leave `/leave`

Answers: "How many days do I have left, what's the status of my requests, how do I ask?"

- Balance card: pool remaining (X of 22), unpaid days taken this year (separate line)
- "Request leave" action → form: type (Paid/Sick/Unpaid/Half Day), reason, date(s),
  number of days
- History table: date, type, days, status (Pending/Approved/Rejected)
- Link to Leave Policy

### Medical `/medical`

Answers: "How much allowance do I have, and how do I claim?"

- Balance card: current balance, monthly accrual (5,000/mo), cap (50,000)
- "Submit claim" action → form: for (Self/Parent/Spouse/Child), service type
  (OPD/Medicine/Procedure/Hospitalization), description, amount PKR, expense date,
  proof upload (≤5 files, 10MB each)
- Claims history table: date, for, type, amount, status
- Link to Medical Policy

### Overtime `/overtime`

Answers: "What overtime have I logged and was it approved?"

- "Log overtime" action → form: date, hours, project, task
- Logs table: date, hours, project, status
- Note: pay shows on payslip once approved + payroll runs

### Payslips `/payslips`

Answers: "What was I paid and how was it calculated?"

- List of payslips by cycle (month)
- Payslip detail: Base Salary, Days Worked, Total Base, Medical, Overtime Hours &
  Pay, Total — itemized per PRD 5.5.4

### Policies & Contract `/policies`

Answers: "What are the rules, and what have I agreed to?"

- Policy list (active versions), read view
- Acknowledgment state per policy; re-acknowledge prompt when a policy updates
- My contract (view only)

### Profile `/profile`

Answers: "What does the company know about me, and what can I fix myself?"

- All profile sections (personal, bank, social, documents) — read
- Editable subset: contact info, emergency contact
- Admin-set fields visible but locked: employment type, salary, working hours

---

## Admin side `/admin` route group

### Dashboard `/admin`

Answers: "What needs my action, and what's the state of the org?"

- Pending approvals count (leave + medical + overtime)
- Current payroll cycle status (open / calculating / locked)
- Active employee count; employees by status
- Employees nearing 50,000 medical cap
- Policy acknowledgment gaps

### Approvals `/admin/approvals`

Answers: "What's waiting, and can I action it quickly one at a time?"

- Unified queue, filterable by type (Leave / Medical / Overtime)
- Row → detail sheet: full request fields, proof files, employee context
  (current balances), approve / reject with optional note
- No bulk actions (MVP)

### Employees `/admin/employees`

Answers: "Who works here, in what state, and how do I add someone?"

- "Invite employee" action → name + email → sends invitation
- Directory table: name, email, status (Invited/Onboarding/Active),
  employment type; search + filter
- Employee detail: full profile, all sections editable by admin, employment &
  payroll config (type, base salary, working hours)

### Payroll `/admin/payroll`

Answers: "What will this cycle cost, is it correct, and how do I pay it?"

- Current cycle: per-employee calculated rows (Base, Days Worked, Total Base,
  Medical, Overtime, Total) with manual Days Worked override
- Review → Lock cycle (confirm; figures become read-only)
- Payoneer export (per-employee currency balance selection; recipient PKR)
- Wise export (same per-employee source currency selection, plus one payment
  reference for the file; recipient PKR) — see `wise-export-spec.md`
- History: past locked cycles → drill into payslips

### Policies & Contracts `/admin/policies`

Answers: "What rules are published, who has agreed, and are contracts current?"

- Policy list with versions; upload new version
- Compliance matrix: employee × policy acknowledgment status
- Contracts: per-employee contract upload/replace, version history
- System-wide rules and onboarding email configuration moved into this section

---

## Shared state rules (every screen)

- Loading → `Skeleton` shaped like the content
- Empty → explicit empty state with CTA where sensible
- Error → `toast.error` / `FormMessage`; no raw server errors
- All statuses render via the shared `StatusBadge` mapping
- Currency: PKR formatting via a shared util (no inline `toLocaleString` scattering)

## Validation next

- Review these outlines (5 min read) — catches IA mistakes before code
- Per slice: click through the primary task with mock data + states pass
  (empty/loading/error/dark) + Storybook stories for shared components
