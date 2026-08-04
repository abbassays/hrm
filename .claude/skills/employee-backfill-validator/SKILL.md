# Employee Data Backfill Validator Skill

**Purpose:** Ensure complete, accurate, and safe historical employee data imports into the HRM database without data loss, referential integrity violations, or unauthorized state changes. This skill enforces the canonical rules from `docs/backend/employee-data-backfill.md` at every stage.

**Triggers:** Use whenever importing, backfilling, or bulk-writing employee data, Auth identities, storage objects, or any row referencing employees.

---

## Critical Principles (Non-Negotiable)

1. **No guessing or inference** — if a value is missing, reject or document explicit approval.
2. **Idempotent operations** — never create duplicate employees, documents, contracts, requests, or payslips on retry.
3. **Transaction atomicity** — one transaction per logical batch; Auth and Storage require compensating actions in manifest.
4. **Preserve source history** — timestamps, amounts, and state must reflect source records, not import execution time.
5. **Validate stricter than SQL** — database constraints are floors, not ceilings; application rules are the truth.
6. **Manifest-driven rollback** — every UUID and path tagged; only rollback what was created, never by date/email/prefix.
7. **RLS and Auth metadata in sync** — explicit verification; triggers alone do not guarantee consistency.

---

## Pre-Import Checklist: Resolve All Blockers

Before writing any PII, employment, or identity data:

### Schema Drift & Catalog Verification

- [ ] **Employee PII exposure:** RLS policy `employees_select_authenticated` must be replaced with a safe directory view/RPC or column-privilege design. Test with anon, employee, and admin tokens.
  - Current risk: all columns (CNIC, DOB, address, phone) exposed to any role with SELECT.
  - Fix required before importing real data.

- [ ] **Account status mirroring:** `mirror_role_to_jwt()` currently writes only `role`, not `account_status`.
  - Decision: add migration to mirror status OR explicitly update Auth `app_metadata.account_status` and validate for every user post-import.

- [ ] **Employment type enum:** migrations define only `full_time`, `part_time`; application accepts `contract`, `internship`.
  - Decision: inspect target enum, add missing values via migration, or reject/map source values with written approval. No silent coercion.

- [ ] **Employment stage missing:** application requires `probation`, `confirmed`, `notice_period`; schema has no `employment_stage` column.
  - Decision: add column/enum or explicitly exclude from backfill scope.

- [ ] **Employment history not tracked:** `employment_details` stores current snapshot only; no start/end periods or change history.
  - Decision: limit scope to current configuration snapshot OR add effective-dated model before import.

- [ ] **Termination/resignation not modeled:** `disabled` is account-access state, not termination. No employment end date.
  - Decision: do not translate termination to `disabled`. Add HR lifecycle fields or document approved limitation + separate Auth ban.

- [ ] **Identity bucket creation absent:** migrations define `employee_documents` policies for `identity-docs`, but no migration creates the bucket.
  - Fix: confirm live bucket exists; if not, add migration defining privacy, size, and MIME rules.

- [ ] **Generated types vs. migrations drift:** `src/types/supabase.ts` may reflect live state; migrations remain source of truth.
  - Fix: compare target database catalog with both before loading; resolve drift rather than importing against assumptions.

### Minimum Catalog Checks (Run Against Target Database)

```sql
-- Check migration history matches expectations
select version, name from supabase_migrations.schema_migrations order by version;

-- Verify all required enums exist with correct values
select n.nspname, t.typname, e.enumlabel, e.enumsortorder
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where t.typname in (
  'user_role', 'account_status', 'employment_type', 'leave_type',
  'request_status', 'medical_for', 'service_type', 'payroll_status',
  'notification_status', 'policy_category'
) and n.nspname = 'public'
order by n.nspname, t.typname, e.enumsortorder;

-- Verify all required buckets exist
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('identity-docs', 'medical-proofs', 'contracts', 'payroll-exports')
order by id;

-- Inspect RLS policies
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'employees'
order by policyname;
```

---

## Core Import Rules by Data Category

### 1. Canonical Employee Identity

**Rule:** `public.employees.id` = `auth.users.id` (foreign key enforced, cascades on Auth deletion).

**For every person:**

- [ ] Normalize email: `trim().toLowerCase()` before duplicate detection.
- [ ] Enforce one unique email across `auth.users` AND `public.employees`.
- [ ] **Create Auth user first** via Auth Admin API; never insert `auth.users` directly. Auth assigns UUID.
- [ ] Insert `public.employees` with **exactly the Auth UUID** — not generated separately.
- [ ] **Explicitly set** Auth `app_metadata.role` and `app_metadata.account_status` to match employee row values.
  - Current trigger mirrors only `role`; status metadata must be explicitly set/verified.
  - Refresh or revoke existing sessions when relevant.
- [ ] Store source-system IDs in external manifest; never overload CNIC, email, or other business field as import key.
- [ ] **Admin actors** (reviewed_by, locked_by, uploaded_by, disabled_by, exported_by, reconciled_by) must also have `employees` rows.

**Auth metadata and email:**
- Email delivery is separate from user creation; no accidental invite emails during historical load.
- Auth audit fields reflect import time, not historical HR event — preserve source dates in manifest.
- Password recovery/onboarding decided explicitly; neither proves HR consent.
- Admin role granted **only to currently authorized admins**. `public.is_admin()` trusts JWT role; middleware skips disabled check for admins.
  - **Never assign admin role to inactive person.** Remove/delay role, ban Auth identity, revoke sessions during deprovisioning.

**Lifecycle States:** Only `invited`, `onboarding`, `active`, `disabled` allowed. Former `submitted` state is forbidden.

| State        | Required Consistency                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `invited`    | `invited_at` present; `accepted_at`, `consent_at`, `activated_at` null unless documented legacy.                        |
| `onboarding` | `invited_at` and `accepted_at` present; activation/consent normally null.                                               |
| `active`     | **`activated_at` required** (financial significance: medical balance accrual starts here). Preserve other dates on evidence only. |
| `disabled`   | **`disabled_at` and `disabled_from_status` required**; `disabled_from_status` ≠ `disabled`. `disabled_by` identifies admin. Auth user **must be banned**. |

**Non-disabled state invariant:** `disabled_at`, `disabled_by`, `disabled_from_status` all null.

**Disabled employee invariant:** future Auth `banned_until` timestamp required; enabled employee must not remain banned.

**Use `set_employee_access(employee_id, disabled)` RPC for post-import state transitions**, not direct updates. It owns protected status change but requires Auth ban/unban separately.

---

### 2. Employee Profile & Configuration

**Core employee row:**

| Field           | Rules                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `id`            | Same as Auth `users.id`; generated by Auth.                                                    |
| `email`         | Unique, normalized (trim + lowercase); matches Auth email exactly.                             |
| `role`          | `employee` or `admin`; mirrored to Auth `app_metadata.role`.                                   |
| `account_status` | `invited`, `onboarding`, `active`, `disabled`; mirrored to Auth `app_metadata.account_status`. |

**Profile fields (stricter than SQL):**

| Field                 | Application Rules                                                                      |
| --------------------- | -------------------------------------------------------------------------------------- |
| `full_name`           | Min 2 chars; required for active employees.                                            |
| `date_of_birth`       | Valid ISO date (YYYY-MM-DD); required for active employees.                            |
| `cnic`                | Format `12345-1234567-1`; do not fabricate or remove leading zeroes. Not unique in DB. |
| `phone`               | Digits only, 10–15 chars. Pakistan format `03XXXXXXXXX` (11 digits). Must differ from `emergency_contact`. |
| `emergency_contact`   | Digits only, 10–15 chars. Pakistan format `03XXXXXXXXX` (11 digits). Must differ from `phone`. |
| `address`             | Min 5 chars; required.                                                                 |
| `city`                | Min 2 chars; required.                                                                 |
| `postal_code`         | 4–6 digits; required.                                                                  |

**Bank details (zero or one per employee):**

- Upsert on `employee_id`; do not create blank row if no source exists.
- `bank_name`, `account_holder`: min 2 chars.
- `account_number`: 6–20 digits.
- **Pakistan IBAN:** 24 chars, format `PK` + 2 digits + 4 letters + 16 digits. Normalize to uppercase; remove spaces only after comparing with signed source.
- Treat all fields as sensitive; store hashes if auditing required.

**Socials (zero or one per employee):**

- Upsert on `employee_id`; do not create blank row.
- Store **full profile URLs** (not handles).
- `github_url`, `linkedin_url`: required by onboarding; must be valid URLs on their respective hosts.
- `twitter_url`: optional.

**Employment details (zero or one per employee; required for payroll inclusion):**

- Upsert on `employee_id`.
- `base_salary`: positive whole PKR; required for payroll inclusion.
- `working_hours`: positive, max 400/month; required. Payroll RPC falls back to 160 if null—do not rely on fallback to hide missing data.
- `designation`: min 2 chars; required for configured employees.
- `department`: optional.
- `employment_type`: one of enum values (after resolving schema drift).
- `ot_multiplier_override`: null (inherit default) or positive ≤ 9.99.
- `leave_pool_days_override`, `medical_accrual_monthly_override`, `medical_cap_override`: null (inherit) or non-negative.
  - Zero is explicit override (no allowance); never convert blank to zero.
  - Leave override max: 60 days.

**Active employee profile completeness check:**

```sql
-- Reject import if any required field is missing/empty
select e.id, e.email
from public.employees e
where e.account_status = 'active' and e.role = 'employee'
  and (
    nullif(trim(e.full_name), '') is null or e.date_of_birth is null or
    nullif(trim(e.phone), '') is null or nullif(trim(e.emergency_contact), '') is null or
    nullif(trim(e.address), '') is null or nullif(trim(e.city), '') is null or
    nullif(trim(e.postal_code), '') is null or nullif(trim(e.cnic), '') is null
  );
```

**Onboarding completeness:**

Completed profile must have exactly one `cnic_front`, one `cnic_back`, one `photo` in `employee_documents`. SQL does not enforce; validator must.

---

### 3. Documents & Storage

**Critical:** Storage is private. Metadata rows must never point to missing objects. Verify checksums, MIME types, and object readability after upload.

| Data               | Bucket & Path                            | Rules                                                                                                         |
| ------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Identity documents | `identity-docs/<employee_uuid>/<doc_type>` | `doc_type` ∈ {`cnic_front`, `cnic_back`, `photo`}. One per employee/type. Upload object, then upsert metadata. |
| Medical proofs     | `medical-proofs/<employee_uuid>/<claim_uuid>/<file>` | Private; PNG, JPEG, WebP, PDF; max 10 MB each. Insert claim first, upload objects, then ≤5 file rows. |
| Contracts          | `contracts/<employee_uuid>/<uuid>.pdf`   | Private PDF only; max 10 MB. Path must begin with employee UUID. Upload object, then call `upload_contract()`. |
| Payroll exports    | `payroll-exports/<run_uuid>/...`         | Private, admin only; XLSX/CSV; max 10 MB. Backfill only when preserving real artifact + audit row. |

**Before inserting metadata:**

- [ ] Verify bucket exists and configuration (privacy, size limits, MIME rules).
- [ ] Verify object path, byte size, MIME type, checksum, source filename, owner UUID prefix.
- [ ] Mint short-lived signed URL under intended user context; verify RLS and readability.
- [ ] Application-enforced limits: identity docs PNG/PDF max 5 MB (bucket limits not yet in migrations).

**Application-specific constraints:**

- Profile photo filename must be exactly `photo` for authenticated-user visibility; CNIC objects must use different names.
- Medical claim file insertion is serialized; concurrent transactions can race around count-based limit — post-load count check mandatory.

**Contract history (append-only):**

- Versions are positive and unique per employee; exactly one active row per employee.
- `storage_path` globally unique; must begin with employee UUID.
- Import versions in ascending order via `upload_contract()` where practical.
- If preserving original `uploaded_at`, `uploaded_by`, version requires direct insert, serialize per employee, set only newest row active, validate unique index.

---

### 4. Leave History

**Table:** `leave_requests` references employee and optional reviewing employee.

| Field            | Rules                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------- |
| `leave_type`     | `paid`, `sick`, `unpaid`, `half_day`                                                 |
| `num_days`       | Positive, 1 decimal place. App uses 0.5 increments; `half_day` must equal 0.5.      |
| `start_date`     | Past dates allowed during import (live form rejects past). No future dates.           |
| `status`         | `pending`, `approved`, `rejected`                                                    |
| `reviewed_by`    | FK to employee (reviewer); null for pending.                                         |
| `reviewed_at`    | Required for approved/rejected; null for pending.                                    |
| `rejection_reason` | ≥5 chars for rejected rows; null for approved/pending.                               |
| `reason`         | ≥10 chars; required.                                                                 |

**Review state consistency:**

- **Pending:** no `reviewed_by`, `reviewed_at`, or `rejection_reason`.
- **Approved:** `reviewed_by` and `reviewed_at` required; `rejection_reason` null.
- **Rejected:** `reviewed_by`, `reviewed_at`, and `rejection_reason` (≥5 chars) required.

**Payroll impact:**

- Approved `paid`, `sick`, `half_day`: reduce annual pool for year of `start_date`.
- Approved `unpaid`: reduce payroll days in month of `start_date`.
- Multi-month leave not expanded: entire `num_days` assigned to month containing `start_date`. Split source records by payroll month if needed.

**Balance enforcement:**

- `leave_balance()` can return negative remainder if approved unpaid days exceed calendar days.
- No enforcement in current RPC; report negatives and resolve against source/business policy.
- Changing global or employee overrides re-prices all historical balances (not snapshotted).

---

### 5. Medical History

**Table:** `medical_claims` references employee, optional reviewer, optional payroll run, 0–5 proof rows.

| Field           | Rules                                                                          |
| --------------- | ------------------------------------------------------------------------------ |
| `claim_for`     | `self`, `parent`, `spouse`, `child`                                           |
| `service_type`  | `consultation`, `hospitalization`, `medication`, `lab_diagnostics`, `emergency`, `dental`, `vision` |
| `amount`        | Positive whole PKR; required.                                                 |
| `description`   | Required; app expects ≥10 chars.                                              |
| `expense_date`  | Preserve real date. 30-day window is live-submission rule; do not rewrite old history. |
| `status`        | `pending`, `approved`, `rejected`                                             |
| `reviewed_by`   | FK to employee (reviewer); null for pending.                                  |
| `reviewed_at`   | Required for approved/rejected; null for pending.                             |
| `rejection_reason` | ≥5 chars for rejected; null for approved/pending.                             |
| `payroll_run_id` | FK to payroll run if claim paid; null if unswept. Must reference month of expense date. |

**Review state consistency:**

- Same as leave: pending (no review fields), approved (review fields required), rejected (review fields + reason ≥5 chars).

**Payroll integration:**

- Approved claims contribute to `medical_balance().spent` regardless of payroll status.
- Paid claim must reference exact `payroll_run_id`; unswept claims null.
- Historical approvals: reconcile against historically intended allowance; do not reject merely to satisfy derived balance.

**Balance calculation (derived, not stored):**

- Monthly accrual: 5,000 PKR (per-employee override takes precedence).
- Annual cap: 50,000 PKR (per-employee override takes precedence).
- Accrual counts completed calendar months from `age(now(), activated_at)` (zero before first full month).
- Changing activation dates or allowance retroactively changes displayed balance; does not rewrite locked payslips.

**Medical proof files (≤5 per claim):**

- Bucket: `medical-proofs/<employee_uuid>/<claim_uuid>/<file>`.
- MIME: PNG, JPEG, WebP, PDF; max 10 MB each.
- Serialize insertion per claim; concurrent transactions can race around count limit.
- Require ≥1 proof for imported claims when source evidence says proofs exist; document approved exceptions.

---

### 6. Overtime History

**Table:** `overtime_logs` references employee, project, optional reviewer, optional payroll run.

| Field          | Rules                                                                |
| -------------- | -------------------------------------------------------------------- |
| `hours`        | Positive, fits `numeric(5,2)`; live form caps at 16 hours.          |
| `work_date`    | Cannot be future-dated for live submissions. Preserve historical dates. |
| `project_id`   | FK to `projects` row. Create/match projects before logs.            |
| `task`         | Required; app expects ≥10 chars.                                    |
| `status`       | `pending`, `approved`, `rejected`                                   |
| `reviewed_by`  | FK to employee (reviewer); null for pending.                        |
| `reviewed_at`  | Required for approved/rejected; null for pending.                   |
| `rejection_reason` | ≥5 chars for rejected; null for approved/pending.                  |
| `payroll_run_id` | FK to payroll run if paid; null if unswept. Must reference month of work date. |

**Review state consistency:**

- Same as leave and medical.

**Payroll integration:**

- Approved paid logs must reference exact `payroll_run_id`; unswept null.
- Rate/pay are snapshots on payslip; never store historical hourly rate on log.

**Projects:**

- Must exist before creating logs. Do not use arbitrary fallback without approval.
- Keep retired projects with `is_active = false`; do not delete.

---

### 7. Payroll History

**Highest-risk section.** Choose and document exactly one mode per run; never mix.

#### Mode 1: Source-Event Reconstruction

Import configuration, leave, medical, overtime → create runs → call `calculate_payroll()` → review drafts → call `lock_payroll()`.

**Use only when:** today's settings, cohort, configuration, and logic accurately reproduce history.

**Formulas (current engine; all money rounded to integers):**

```
days_worked = coalesce(days_worked_override, days_in_month - approved_unpaid_days)
total_base = round(base_salary * days_worked / days_in_month)
overtime_rate = base_salary * effective_multiplier / working_hours
overtime_pay = round(overtime_rate * effective_overtime_hours)
medical = sum(approved, unswept claims in run month)
tax_base = base_salary + medical + overtime_pay + positive custom_fields  [NOT prorated]
total_pay = round(total_base + medical + overtime_pay + sum(custom_fields) - tax_deduction)
```

**Gotchas:**

- Current RPC includes only employees with `status = 'active'`, `employment_details` row, and non-null `base_salary`.
- Does not check `activated_at` against run month; no employment end date.
- Uses current salary/hours/designation/overrides/tax/multiplier for backdated runs → may include later hires, exclude disabled-now-paid-then, apply wrong config.
- Reopening clears payroll run links; recalculation can change history.

**Reject if negative derived `days_worked`.** Schema has no lower-bound guard; resolve source condition explicitly.

#### Mode 2: Historical Snapshot Preservation

Insert exact source runs and payslips with every derived amount and override. Link paid medical/overtime items to run.

**Use when:** historical payroll must remain exactly as paid, even if today's rules differ.

**Payroll runs row:**

| Field          | Rules                                  |
| -------------- | -------------------------------------- |
| `period_month` | First day of month; unique per run.   |
| `days_in_month` | Matches calendar month (28–31).       |
| `status`       | `open` (lock fields null) or `locked`. |
| `locked_by`    | FK to admin; required if locked.      |
| `locked_at`    | Timestamp; required if locked.        |
| `total_payroll` | Null if open; equals sum of payslips if locked. |

**Payslips row (one per run/employee):**

| Field                    | Rules                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `period_month`           | Equals run month; insert trigger fills if null.                                   |
| `employee_id`            | FK to employee; must have payslip in this run.                                    |
| `payroll_run_id`         | FK to run.                                                                         |
| `base_salary`            | Preserve exact paid amount.                                                        |
| `designation`            | As paid.                                                                            |
| `days_in_month`          | Matches run.                                                                       |
| `days_worked`            | Effective days worked.                                                             |
| `unpaid_leave_days`      | Deducted days.                                                                     |
| `medical_reimbursement`  | Approved, unswept claims in run month.                                            |
| `overtime_hours`         | Approved, unswept logs in run month.                                              |
| `overtime_rate`          | Preserve exact rate.                                                               |
| `overtime_multiplier`    | Effective multiplier (override or default).                                       |
| `overtime_pay`           | Preserve exact amount.                                                             |
| `tax_deduction`          | Preserve exact tax.                                                                |
| `custom_fields`          | JSON array `[{label, amount}, ...]`; positive = earning, negative = deduction.   |
| `total_pay`              | Preserve exact total; must equal base + medical + overtime + custom − tax.        |
| `days_worked_override`   | Null unless explicit run-specific override. Zero is explicit.                    |
| `overtime_hours_override` | Null unless explicit run-specific override. Zero is explicit.                    |
| `overtime_multiplier_override` | Null unless explicit run-specific override. Zero is explicit.                 |
| `notification_status`    | `pending` (no send), `sent` (sent), `failed` (retried). Do not label old mail sent without evidence. |
| `notification_sent_at`   | Populated only if `notification_status = 'sent'`.                                |

**Reconciliation:**

- Every medical claim or overtime log paid by the run must point to it.
- No item swept into two runs.
- Total payroll = sum of payslips (when locked).
- Do not call `calculate_payroll()` on locked snapshot unless recalculation explicitly intended.

---

### 8. Policies, Acknowledgments, Notifications

**Policy acknowledgments (legal/evidence data):**

- Insert only when source proves employee acknowledged exact `policy_version_id` at recorded time.
- Unique per employee/version; append-only via normal RLS.
- **Never infer acknowledgment** from employment or onboarding consent.
- Historical acknowledgments for superseded versions require privileged import path; never temporarily activate old version to insert evidence.
- Onboarding `consent_at` is NOT substitute for per-version acknowledgment.

**Notifications (event feed):**

- Normally do not backfill.
- If required, deduplicate using manifest (no natural uniqueness constraint).
- Backfilled pending leave/medical/overtime fire in-app admin triggers. Direct SQL/service-role inserts do not send Next.js emails.
- **To avoid historical alert spam, insert final non-pending history directly.** Handle genuine pending rows explicitly.
- If notification triggers must be disabled, do so only in maintenance window, in same reviewed transaction, with concurrent writes stopped. Never disable globally.

**Active policy version fan-out:**

- Publishing an active policy version fans notifications to every active employee.
- Load policy library before activating employee accounts, OR deliberately control trigger during migration.

**Actor references (must exist):**

- `contracts.uploaded_by`, request `reviewed_by`, payroll `locked_by`, employee `disabled_by`, export `exported_by`, reconciliation `reconciled_by`: FK to admin or null where allowed.

---

## RPCs & Triggers Relevant to Import

| Object                                | Import Relevance                                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `accept_onboarding()`                 | Caller-only `invited → onboarding`; stamps acceptance and Auth metadata. NOT bulk historical import RPC.             |
| `submit_onboarding()`                 | Caller-only `onboarding → active`; stamps consent/activation. Do NOT call on behalf of employee.                    |
| `set_employee_access()`               | Admin disable/enable transition; database half. Auth ban/unban still required separately.                            |
| `upload_contract()`                   | Preferred atomic contract version allocator and active-version flip.                                                |
| `leave_balance()` / `medical_balance()` | Post-import derived-balance validation; read-only.                                                                   |
| `is_admin()`                          | Reads JWT `app_metadata.role`; basis of admin RLS and privileged RPC checks. Service-role bypass does not bypass this check for real sessions. |
| `calculate_payroll()`                 | Rebuilds open draft payslips from current rules/config; removes stale members. Do not use on locked snapshots.      |
| `lock_payroll()` / `unlock_payroll()` | Recalculate/sweep/finalize and release respectively. Never casual use on preserved historical snapshots.            |
| `ensure_current_run()`                | Creates only current month; not for historical months.                                                              |
| `create_policy()` / `publish_policy_version()` | Atomically manage versions; fan out notifications. Use instead of ad hoc writes unless suppression intended. |
| `policy_compliance()`                 | Admin-only derived validation; read-only.                                                                            |
| `mirror_role_to_jwt` trigger          | Mirrors only `role`, not status. Fix or explicitly update/verify Auth status metadata.                              |
| `guard_employee_columns` trigger      | Blocks non-admin role/status changes. Use controlled privileged path, not global disable.                            |
| `set_updated_at` triggers             | Preserve source update times on initial insert or store in manifest.                                                |
| Admin notification triggers (`trg_notify_admins_*`) | Control during historical import to avoid spam; former onboarding trigger dropped.                    |
| `trg_notify_policy_update()`          | Suppress during active policy version insert or load policies before activating employees.                          |

**Service-role JWT caveat:**

- Bypasses RLS but does NOT contain `app_metadata.role = 'admin'`.
- Fails explicit `is_admin()` check inside admin RPCs (upload_contract, calculate_payroll, lock_payroll, etc.).
- Use authenticated admin session for RPC calls OR purpose-built temporary import function.
- Never weaken `is_admin()` or grant permanent bypass.

**Transaction scope:**

- Multiple Supabase REST calls are NOT one transaction.
- If atomicity across table writes required, put in reviewed SQL migration or single RPC.
- Auth Admin and Storage calls remain outside transaction; require manifest-driven compensation.

---

## Recommended Insertion Sequence

1. **Manifest setup:** Freeze/checksum source extracts; create row-level import manifest with source ID, target UUID, action, checksum, result.
2. **Backups & inventory:** Back up database; list all four buckets and object checksums.
3. **Schema verification:** Apply/verify migrations; resolve all blockers above.
4. **Data validation:** Normalize emails, identify duplicates, shared bank accounts, duplicate CNICs, unknown projects, missing reviewers.
5. **Shared config:** Create/match global data: payroll settings, system config, projects, policies, policy versions. Load active policies before activating employees, or control trigger.
6. **Auth setup:** Create/map Auth users (no emails). Create/map all admins first.
7. **Employee rows:** Insert with final lifecycle timestamps; verify Auth role/status metadata and ban state.
8. **Satellites:** Insert bank_details, socials, employment_details (upsert on employee_id).
9. **Identity documents:** Upload objects, verify checksums, upsert employee_documents.
10. **Contracts:** Upload objects, insert history per employee/version order.
11. **Requests:** Insert leave, medical (with proofs), overtime with status/reviewer consistency.
12. **Policy evidence:** Insert acknowledgments from evidence only.
13. **Payroll:** Single mode per run; reconcile linked items and exports.
14. **Notifications:** Insert only if explicitly in scope.
15. **Validation:** Run full SQL validation suite; compare counts/totals against source.
16. **Finalize:** Save signed report and manifest; only then enable login/recovery.

---

## Post-Import Validation Checklist

Every query in `docs/backend/employee-data-backfill.md` "Required post-import validation" section must return **zero rows** before considering import complete.

### Critical Checks

- [ ] Auth/public identity matches (email, UUID, role, status).
- [ ] No duplicate normalized emails.
- [ ] Auth metadata matches employee row (role and status).
- [ ] Employee ban state aligns with account status.
- [ ] Admin accounts active.
- [ ] Lifecycle state consistency (disabled fields, timestamps).
- [ ] Active employees have complete profile, employment details, documents.
- [ ] Profile format rules (CNIC, phone, postal code, IBAN).
- [ ] Employment config validity (salary > 0, hours > 0 ≤ 400, multiplier > 0 ≤ 9.99, overrides non-negative).
- [ ] Leave balance not negative (reconcile exceptions).
- [ ] Medical balance not overspent (reconcile exceptions).
- [ ] Request review state consistency (pending/approved/rejected fields).
- [ ] Medical proof count ≤ 5 per claim.
- [ ] Claims/logs linked to payroll are approved.
- [ ] Storage metadata paths own employee/claim/run prefix.
- [ ] Storage objects exist for every metadata row (verify via API).
- [ ] Contract version uniqueness and active row count (exactly 1 active).
- [ ] Payroll run totals reconcile (sum of payslips).
- [ ] Payslip month matches run month.
- [ ] Payslip values reconcile to formulas.
- [ ] Custom fields JSON valid.
- [ ] Swept items in correct payroll month.
- [ ] Paid items belong to employee with payslip in run.
- [ ] Payslip notification state consistency.

### Storage Validation (via API)

- [ ] Metadata row with no object.
- [ ] Object with no metadata row.
- [ ] Owner UUID/path mismatch.
- [ ] Checksum, MIME, size mismatch.
- [ ] >1 identity object per employee/type.
- [ ] Contract object outside employee prefix.
- [ ] Signed read URL generation fails (RLS issue).

### RLS Test Matrix

Test with anon, employee, admin, service-role clients:

- [ ] Anon cannot read employees or private objects.
- [ ] Employee cannot read another's CNIC, DOB, address, phone, bank, employment, documents, superseded contracts, requests, acknowledgments, notifications, payslips.
- [ ] Safe directory path exposes only approved columns and authenticated photos.
- [ ] Employee sees only active contract and locked personal payslips.
- [ ] Admin performs intended HR operations; cannot create policy acknowledgment for employee.
- [ ] Disabled employee cannot authenticate.
- [ ] Service role confined to import process; never shipped to browser.

### Source Reconciliation

- [ ] Per-table counts match source extract.
- [ ] Per-employee monetary totals match (payroll, medical, overtime).
- [ ] No data lost during import (zero-row SQL checks necessary but not sufficient).

---

## Rollback & Audit Requirements

- [ ] Every created UUID and Storage path tagged in manifest.
- [ ] Auth user IDs, public row IDs, paths in same manifest.
- [ ] Rollback only manifest-created rows/objects. Never delete by date range, email domain, prefix, or guessed UUID.
- [ ] Deleting Auth user can be blocked by actor FKs (reviewed_by, locked_by, etc.) — resolve deliberately, do not globally drop constraints.
- [ ] No secrets, raw bank details, CNIC, or document contents in logs, reports, diffs, or manifest. Store identifiers, hashes, counts only.
- [ ] Preserve source extract, transformation code, operator, timestamps, row counts, validation output, exceptions, business approvals.

---

## Using This Skill

**When to invoke:** Any time you import, backfill, or bulk-write employee data, Auth identities, or any row referencing employees.

**What to do:**

1. **Pre-import:** Run all blockers checklist. Verify schema catalog. Run minimum catalog checks against target.
2. **During import:** Follow insertion sequence step-by-step. After each major section (employees, satellites, storage, requests, payroll), validate intermediate state.
3. **Post-import:** Run full SQL validation suite. Test RLS. Reconcile against source. Save manifest and signed report.
4. **On error:** Consult manifest, not guesses. Rollback only tagged rows/objects. Fix root cause; do not disable constraints globally.

**Output guarantees:**

- ✅ Complete data preservation: source history, amounts, timestamps, relationships.
- ✅ Referential integrity: all FKs valid, no orphaned rows, no circular references.
- ✅ Auth consistency: role/status mirrored, ban state aligned, admin checks pass.
- ✅ Idempotency: retry-safe; no duplicate employees, documents, contracts, requests, payslips.
- ✅ Auditability: manifest traces every write; rollback deterministic.

**Do not compromise on:**

- Never infer missing legal, financial, approval, consent, or acknowledgment facts.
- Never disable triggers or constraints globally (use controlled privileged functions).
- Never send invitations, approval emails, or notifications without separate approval.
- Never use browser/client session for bulk operations; always use reviewed server-side script.
- Never create duplicate identities or records on retry; always use deterministic mappings.

