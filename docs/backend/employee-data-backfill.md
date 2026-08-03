# Employee data backfill rules and runbook

## Purpose

This document is the source-of-truth checklist for importing historical employee data into the HRM database. The objective is not merely to create an `employees` row. A complete backfill must preserve the employee's Auth identity, lifecycle, profile, employment configuration, documents, contract history, leave, medical, overtime, payroll, and policy evidence wherever source records exist.

The rules below were derived from the checked-in Supabase migrations, generated database types, server actions, Zod schemas, RPCs, triggers, RLS policies, and storage access patterns as of 2026-08-03. This repository audit is not proof that a target database has the same catalog. The target catalog and bucket configuration must be captured and compared before any production write.

## Non-negotiable rules

1. Backfill from a signed-off, immutable source extract. Do not infer missing legal, financial, approval, consent, or acknowledgment facts.
2. Preserve source timestamps and source identifiers in the import manifest. The employee UUID comes from the Auth user; generate other target UUIDs once and reuse them on every retry.
3. Normalize and validate before writing. A database constraint passing does not mean the value satisfies the application's stricter rules.
4. Import parent rows before child rows and storage objects before their metadata rows.
5. Use one database transaction per logical batch where possible. Auth and Storage operations are outside the public-schema transaction, so record compensating actions in the manifest.
6. Make the import idempotent. Use deterministic mappings and conflict targets; never create a second employee, document, contract version, request, or payslip on retry.
7. Do not disable triggers or constraints globally. If a protected lifecycle field must be set for historical import, run a controlled admin migration or a narrowly scoped `SECURITY DEFINER` import function, then verify Auth metadata.
8. Never use the browser/client session for bulk import. Use a reviewed server-side script. Use the service role for direct table/Storage work, the Auth Admin API for `auth.users`, and a real authenticated admin JWT for RPCs whose bodies call `public.is_admin()`.
9. Do not send invitations, approval emails, payroll emails, or notifications during the historical load unless that is separately approved.
10. Take a database backup and bucket inventory before the first production write. Rehearse the same manifest against a disposable environment first.
11. Define a cutover timestamp and timezone. Freeze source changes or capture deltas after that timestamp so records changed during the load are not silently lost.
12. Store `timestamptz` values as ISO-8601 instants with an explicit offset/UTC conversion. Treat SQL `date` values as calendar dates and never shift them through UTC parsing.

## Pre-backfill blockers and schema drift

Resolve these before importing employee PII, employment records, or identity documents:

| Finding                                                 | Current repository state                                                                                                                                                                                                                                                                                                                                                      | Required decision                                                                                                                                                                                               |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Employee PII is exposed by roster RLS                   | `employees_select_authenticated` is a row policy with `using (role = 'employee')`, has no `TO authenticated` restriction, and cannot limit columns. It therefore permits all columns—including CNIC, DOB, address, and phone—for every employee-role row to any API role to which table `SELECT` is granted. The application's narrow select list is not a security boundary. | Replace this with a safe directory view/RPC or column-privilege design and explicitly scope access before loading real PII. Test with anon and ordinary employee tokens.                                        |
| Account status is not generally mirrored to Auth        | `mirror_role_to_jwt()` writes only `app_metadata.role`. The later trigger fires on role/status changes but its function body still does not write `account_status`. Only `accept_onboarding()` and `submit_onboarding()` explicitly write status metadata.                                                                                                                    | Add a migration that correctly mirrors status, or have the import explicitly update Auth `app_metadata.account_status` and validate it for every user.                                                          |
| Employment type sources disagree                        | The reproducible migration creates only `full_time` and `part_time`, while the application and generated type file accept `contract` and `internship`. This suggests untracked live-schema drift.                                                                                                                                                                             | Inspect the target enum. Add a checked-in migration for missing values, or reject/map those source values with written business approval. Do not silently coerce them.                                          |
| Employment stage is not persisted                       | The application requires `probation`, `confirmed`, or `notice_period`, but `employment_details` has no `employment_stage` column and the update action does not write one.                                                                                                                                                                                                    | Add a column/enum and regenerate types, or explicitly exclude this field from the backfill scope.                                                                                                               |
| Employment configuration has no history/effective dates | `employment_details` stores only the current salary, hours, designation, department, type, and overrides. There is no employment start/end period or change history.                                                                                                                                                                                                          | Decide whether only the current snapshot is in scope. If salary/title/employment history is required beyond frozen payslips/contracts, add an effective-dated model before import.                              |
| Former-worker status is not modeled                     | `disabled` is an account-access state that remembers a prior lifecycle status; it is not a termination/resignation record, and there is no employment end date.                                                                                                                                                                                                               | Do not silently translate termination into `disabled` as if the meanings were identical. Add the required HR lifecycle fields/model or document the approved limitation while separately disabling Auth access. |
| Identity bucket creation is absent                      | Migrations create `employee_documents` and policies for `identity-docs`, but no checked-in migration inserts the bucket.                                                                                                                                                                                                                                                      | Confirm the live bucket exists. If not, add a migration defining its privacy, size, and MIME rules before uploading.                                                                                            |
| Generated types are not the migration source            | `src/types/supabase.ts` reflects a live/generated state but migrations remain the reproducible schema history.                                                                                                                                                                                                                                                                | Compare the target database catalog with both before loading; resolve any drift rather than importing against assumptions.                                                                                      |

Minimum catalog checks:

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;

select n.nspname, t.typname, e.enumlabel, e.enumsortorder
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where t.typname in (
  'user_role', 'account_status', 'employment_type', 'leave_type',
  'request_status', 'medical_for', 'service_type', 'payroll_status',
  'notification_status', 'policy_category'
)
  and n.nspname = 'public'
order by n.nspname, t.typname, e.enumsortorder;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('identity-docs', 'medical-proofs', 'contracts', 'payroll-exports')
order by id;

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'employees'
order by policyname;
```

## Canonical employee identity

`public.employees.id` is the same UUID as `auth.users.id`. A foreign key enforces this relationship and requests a cascade to the public employee row when the Auth user is deleted, although actor-reference foreign keys can block that deletion as described under rollback. All employee-owned rows ultimately reference this UUID.

For every person:

- Normalize email with `trim().toLowerCase()` before duplicate detection.
- Require one unique email across both `auth.users` and `public.employees`.
- Create or locate the Auth user first through the Auth Admin API; never insert directly into `auth.users`. Auth assigns the UUID for a newly created user.
- Insert `public.employees` with exactly the Auth UUID.
- Set Auth `app_metadata.role` and `app_metadata.account_status` to the same values as the employee row. The current trigger mirrors only `role`; the import must explicitly set/verify status metadata and refresh or revoke existing sessions when relevant.
- Keep source-system IDs in the external import manifest unless a dedicated mapping column/table is added. Do not overload CNIC, email, or another business field as an import key.
- Admin identities also require an `employees` row if they appear in `reviewed_by`, `locked_by`, `uploaded_by`, `disabled_by`, `exported_by`, or `reconciled_by`.

Auth creation and email delivery are separate concerns. Creating historical active employees must not accidentally send invite emails. Decide password recovery/onboarding separately after the data load.

Auth-managed audit fields may reflect the import rather than the historical HR event, and the Admin API does not expose every `auth.users` column for arbitrary preservation. Do not bypass the API to rewrite Auth internals. Preserve the source account dates in the manifest and use the public employee lifecycle timestamps for HR history. Decide email-confirmation and password/recovery state explicitly; neither is proof of HR consent.

Grant `role = 'admin'` only to actual, currently authorized administrators. `public.is_admin()` trusts the JWT role, and middleware skips the employee disabled-state database check for admins. Do not assign the admin role to an inactive person; remove/delay the role, ban the Auth identity, and revoke live sessions as part of deprovisioning.

### Lifecycle states

Allowed account states are `invited`, `onboarding`, `active`, and `disabled`. The former `submitted` state was removed and must not be imported.

| State        | Required semantic consistency                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invited`    | `invited_at` should be present; `accepted_at`, `consent_at`, and `activated_at` should be null unless documented legacy semantics require otherwise.                                              |
| `onboarding` | `invited_at` and `accepted_at` should be present; activation/consent are normally null.                                                                                                           |
| `active`     | `activated_at` must represent the real eligibility start date. Preserve `accepted_at` and `consent_at` only when supported by evidence.                                                           |
| `disabled`   | `disabled_at` and `disabled_from_status` are required; `disabled_from_status` cannot be `disabled`. `disabled_by` should identify the acting admin when known. The Auth user must also be banned. |

For any non-disabled state, `disabled_at`, `disabled_by`, and `disabled_from_status` must all be null. Use `set_employee_access(employee_id, disabled)` through an authenticated admin session for normal post-import transitions. It owns the protected status change but does not ban/unban Auth; the application action performs both operations with compensation. A disabled employee must also have a future Auth `banned_until`; an enabled employee must not remain banned by the import.

`activated_at` is financially significant: `medical_balance()` uses `coalesce(activated_at, created_at)` as the accrual start. Do not replace an unknown activation date with the import date without written approval. `created_at` and all historical event timestamps should represent source history, not execution time.

## Employee data map

The singleton/configuration tables `payroll_settings`, `system_config`, and `onboarding_email_template`, plus the shared `projects`, `policies`, and `policy_versions` tables, are not employee-owned records. They are nevertheless prerequisites for correct balances, payroll calculations, overtime references, and acknowledgment imports. Capture their target values in the pre-backfill snapshot; do not overwrite them once per employee. `policy_reconciliations` and `payroll_exports` are operational/audit data and should be loaded only when matching source evidence is in scope.

### Core and one-to-one records

| Table                | Cardinality               | Backfill rules                                                                                                                                                                                                  |
| -------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `employees`          | Exactly one per Auth user | Required: `id`, normalized unique `email`, `role`, `account_status`. Preserve lifecycle timestamps. Profile fields are nullable in SQL but should satisfy the application rules below for a completed employee. |
| `bank_details`       | Zero or one per employee  | Upsert on `employee_id`. Do not create a blank row if no source record exists. Treat account fields as sensitive.                                                                                               |
| `socials`            | Zero or one per employee  | Upsert on `employee_id`. Store full profile URLs, not handles.                                                                                                                                                  |
| `employment_details` | Zero or one per employee  | Required for payroll inclusion. Upsert on `employee_id`; an active employee without a non-null `base_salary` is deliberately omitted from payroll calculation.                                                  |

Application-level profile validation is stricter than the database:

- `full_name`: at least 2 characters.
- `date_of_birth`: valid ISO date (`YYYY-MM-DD`).
- `cnic`: `12345-1234567-1` format. Do not fabricate or remove leading zeroes.
- `phone` and `emergency_contact`: digits only, 10–15 digits; a local Pakistan number beginning with `0` must be exactly 11 digits in `03XXXXXXXXX` format; the two numbers must differ.
- `address`: at least 5 characters; `city`: at least 2; `postal_code`: 4–6 digits.
- Bank name and account holder: at least 2 characters; account number: 6–20 digits.
- Pakistan IBAN: 24 characters matching `PK` + 2 digits + 4 letters + 16 digits. Normalize to uppercase and remove presentation spaces only after comparing with the signed source.
- GitHub and LinkedIn are required by onboarding and must be full URLs on their respective hosts; Twitter/X is optional.

CNIC is not unique in the database. Treat a duplicate normalized CNIC as a manual identity-resolution case, not as an automatic merge and not as permission to create two people without approval.

A completed onboarding record is also expected to have one `cnic_front`, one `cnic_back`, and one `photo` metadata/object pair. SQL does not enforce this completeness, and `submit_onboarding()` does not re-check it server-side, so the import validator must.

Employment configuration rules:

- `base_salary` is a positive whole PKR amount in current application flows.
- `working_hours` is positive and at most 400 per month. The payroll RPC falls back to 160 when it is null or zero, but the import must not rely on that fallback to hide missing data.
- `designation` is at least 2 characters for configured employees; `department` may be null.
- `ot_multiplier_override` is null to inherit the company default, or positive and at most 9.99.
- `leave_pool_days_override`, `medical_accrual_monthly_override`, and `medical_cap_override` are null to inherit global settings. Zero is a real override meaning no allowance; never convert blank to zero. All must be non-negative, and the application's leave override maximum is 60.

### Documents and Storage

Storage is private. Metadata rows do not contain the file and must never point to a missing object.

| Data               | Bucket and path                                      | Rules                                                                                                                                                                                       |
| ------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity documents | `identity-docs/<employee_uuid>/<doc_type>`           | `doc_type` is exactly `cnic_front`, `cnic_back`, or `photo`. There is at most one row per employee/type. Upload with upsert, then upsert `employee_documents` on `(employee_id, doc_type)`. |
| Medical proofs     | `medical-proofs/<employee_uuid>/<claim_uuid>/<file>` | Private, maximum 10 MB each; PNG, JPEG/JPG, WebP, or PDF. Insert the claim first, upload objects, then insert at most five `medical_claim_files` rows.                                      |
| Contracts          | `contracts/<employee_uuid>/<uuid>.pdf`               | Private PDF only, maximum 10 MB. `storage_path` is globally unique and must begin with the employee UUID. Upload object first, then use `upload_contract()` for normal versioning.          |
| Payroll exports    | `payroll-exports/<run_uuid>/...`                     | Private, admin only, maximum 10 MB; XLSX or CSV. Only backfill when preserving a real generated artifact and its audit row.                                                                 |

Before inserting any metadata row, verify bucket, object path, byte size, MIME type, checksum, source filename, and owner prefix. Afterward, mint a short-lived signed URL under the intended user/admin context to verify RLS and object readability.

The application accepts identity documents only as PNG or PDF up to 5 MB. Because the bucket itself is absent from checked-in creation migrations, these limits are only application-side until the live bucket or a new migration proves server-side enforcement. Profile photos are readable by any authenticated user when the object filename is exactly `photo`; CNIC objects must not use that filename.

Serialize medical proof metadata insertion per claim. `enforce_max_medical_files()` counts existing rows in a row trigger, but concurrent transactions can race around a count-based limit; the post-load count check remains mandatory.

Contract history is append-only: versions are positive and unique per employee, `storage_path` is unique, and the database permits at most one active row. A complete history with any versions should have exactly one active row. Import versions in ascending order through `upload_contract()` where practical. If preserving original `uploaded_at`, `uploaded_by`, or version numbers requires direct inserts, serialize per employee, set only the newest intended row active, and validate the partial unique index.

### Leave history

`leave_requests` references the employee and optionally the reviewing employee.

- Allowed types: `paid`, `sick`, `unpaid`, `half_day`.
- `num_days` is positive and stored to one decimal place. Application-created requests use 0.5 increments, and `half_day` must equal 0.5.
- Historical dates may be in the past even though the live submission form rejects past starts.
- Allowed statuses: `pending`, `approved`, `rejected`.
- An approved row should have `reviewed_by` and `reviewed_at`; `rejection_reason` must be null.
- A rejected row should have `reviewed_by`, `reviewed_at`, and a source-backed reason of at least 5 characters.
- A pending row should not have review fields or a rejection reason.
- Approved `paid`, `sick`, and `half_day` rows reduce the annual pool for the year of `start_date`; approved `unpaid` rows reduce payroll days in the month of `start_date`.
- Multi-month leave is not expanded by the payroll function: it assigns the entire `num_days` to the month containing `start_date`. Split source records by payroll month if that is the intended accounting treatment.
- Leave approval does not enforce the available pool in the current server action or database. `leave_balance()` can therefore return a negative remainder. Report any negative result and resolve it against source/business policy; do not silently alter history.
- Changing global or employee-specific leave settings re-prices all derived historical balances because balances are not snapshotted.

### Medical history

`medical_claims` references the employee, optional reviewer, optional payroll run, and zero-to-five proof rows.

- `claim_for`: `self`, `parent`, `spouse`, or `child`.
- `service_type`: `consultation`, `hospitalization`, `medication`, `lab_diagnostics`, `emergency`, `dental`, or `vision`.
- `amount`: positive whole PKR integer.
- `description`: required; the application expects at least 10 characters.
- Preserve the real `expense_date`. The 30-day window is a live-submission rule and must not cause legitimate older history to be rewritten.
- Apply the same pending/approved/rejected review-field consistency as leave.
- Approved claims contribute to `medical_balance().spent` regardless of payroll status.
- A claim paid in payroll must reference the exact `payroll_run_id`. Claims not yet swept must remain null.
- Approval is normally bounded by accrued balance in the application. For imported historical approvals, reconcile source approvals against the historically intended allowance; do not reject, cap, or re-date them merely to satisfy today's derived balance.
- A live submission requires one-to-five proofs, but the database permits a claim with zero proofs and the current multi-step upload can leave one after partial failure. Require at least one proof for imported claims when source evidence says proofs should exist, and document approved exceptions.

The current balance is derived, not stored. Per-employee overrides take precedence over the singleton `payroll_settings`, whose baselines are 5,000 PKR monthly accrual and a 50,000 PKR cap. Accrual counts completed calendar-month components from `age(now(), start_at)`, so it is zero before the first full month and is capped. Changing activation dates or allowance settings retroactively changes the displayed historical balance; it does not rewrite locked payslips.

### Overtime history

`overtime_logs` references the employee, project, optional reviewer, and optional payroll run.

- `hours` must be positive and fit `numeric(5,2)`; the live form caps one entry at 16 hours.
- `work_date` cannot be future-dated for live submissions. Preserve legitimate historical dates during import.
- `project_id` must reference a real `projects` row. Create/match projects before logs; do not use an arbitrary fallback project without approval.
- Keep retired historical projects with `is_active = false`; do not delete them.
- `task` is required and the application expects at least 10 characters.
- Apply the same pending/approved/rejected review-field consistency as leave.
- Approved paid logs must reference the exact payroll run. Unswept logs remain null.
- Do not store a historical hourly rate on the log; rates and pay are snapshots on the payslip.

### Payroll history

Payroll is the highest-risk part of the backfill. Choose and document one mode:

1. **Source-event reconstruction:** import employment configuration, leave, medical, and overtime, create runs, call `calculate_payroll()`, review drafts, then call `lock_payroll()`. Use this only when today's settings, cohort, configuration, and logic are intended to reproduce history.
2. **Historical snapshot preservation:** insert exact source runs and payslips, including every derived amount and override, then link paid medical/overtime items to the run. Use this when historical payroll must remain exactly as paid.

Do not mix modes within a payroll run.

For each `payroll_runs` row:

- `period_month` is the first day of the month and unique.
- `days_in_month` matches the calendar month.
- `open` means `locked_by`, `locked_at`, and `total_payroll` are null.
- `locked` means the lock fields are present and `total_payroll` equals the sum of its payslips.

For each historical `payslips` snapshot:

- Exactly one row exists per `(payroll_run_id, employee_id)`.
- `period_month` equals its run; the insert trigger fills it only when null.
- Preserve `base_salary`, `designation`, `days_in_month`, effective `days_worked`, unpaid days, medical reimbursement, overtime hours/rate/multiplier/pay, tax, custom fields, and total pay as paid.
- `custom_fields` is a JSON array of `{ "label": string, "amount": number }`; positive is earning and negative is deduction.
- Sidecars `days_worked_override`, `overtime_hours_override`, and `overtime_multiplier_override` are null unless there was an explicit run-specific override. Zero is an explicit override, not missing data.
- `total_base`, `overtime_pay`, `tax_deduction`, and `total_pay` must reconcile to the source. Do not call `calculate_payroll()` on a locked snapshot import unless recalculation is explicitly intended.
- Set notification tracking to the known delivery fact: `sent` requires `notification_sent_at`; `failed` should retain attempts/error when available; use `pending` when no send occurred. Do not label old mail as sent without evidence.
- Every medical claim or overtime log paid by the run must point to it, and no item may be swept into two runs.

The current calculator includes only employees whose status is `active`, who have an `employment_details` row, and whose `base_salary` is non-null. It does not check `activated_at` against the run month, has no employment end date, and uses the current salary, hours, designation, allowance overrides, tax rate, and overtime multiplier for backdated runs. Consequently, it can include people hired later, exclude people who are disabled now but were paid then, and apply the wrong historical configuration. It uses approved unpaid leave, approved unswept medical claims, and approved unswept overtime in the run month. Locking recalculates first and then sweep-stamps medical/overtime; reopening clears those links and recalculates. Exact historical payroll should therefore normally use snapshot preservation, not the current RPC.

For reconstruction under the current engine, validate these exact formulas (all final money values are rounded to integers):

- `days_worked = coalesce(days_worked_override, days_in_month - approved_unpaid_days)`;
- `total_base = round(base_salary * days_worked / days_in_month)`;
- `overtime_rate = base_salary * effective_multiplier / working_hours`;
- `overtime_pay = round(overtime_rate * effective_overtime_hours)`;
- `medical = sum(approved, unswept claims in the run month)`; the calculator reimburses those claims in full;
- tax base is full `base_salary + medical + overtime_pay + positive custom fields`, not prorated `total_base`;
- `total_pay = round(total_base + medical + overtime_pay + sum(all custom fields) - tax_deduction)`.

These are current rules, not guaranteed historical rules. A negative derived `days_worked` is possible if approved unpaid days exceed the calendar days because the schema/RPC has no lower-bound guard on the effective value; reject or explicitly resolve that source condition before reconstruction.

### Policies, acknowledgments, notifications, and other employee references

- `policy_acknowledgments` is legal/evidence data. Insert only when a source proves that the employee acknowledged that exact `policy_version_id` at the recorded time. It is unique per employee/version and append-only through normal RLS. Never infer acknowledgment from employment or onboarding consent.
- Ordinary employee RLS permits acknowledgment only for the currently active version and only as the caller. Historical acknowledgments for superseded versions therefore require the controlled privileged import path; never temporarily mark an old version active just to insert its evidence.
- Onboarding `consent_at` is not a substitute for per-version policy acknowledgment.
- `notifications` are an event feed, not the source of truth for requests or policy compliance. Normally do not backfill them. If required, deduplicate using the import manifest because the table has no natural event uniqueness constraint.
- Backfilled pending leave, medical, or overtime rows fire in-app admin-notification triggers on insert. Direct SQL/service-role inserts do not execute the Next.js email helpers, so they do not themselves send the corresponding submission emails. To avoid historical in-app alert spam, insert final non-pending history directly and handle genuine pending rows explicitly. If named notification triggers must be disabled, do it only in a maintenance window, in the same reviewed transaction, with concurrent application writes stopped; never disable all triggers globally.
- Publishing/inserting an active policy version fans notifications to every active employee. Load the policy library before activating employee accounts, or deliberately control the notification trigger during migration.
- `contracts.uploaded_by`, request `reviewed_by`, payroll `locked_by`, employee `disabled_by`, payroll export `exported_by`, and policy reconciliation `reconciled_by` must point to valid employee/admin rows or be null where their FK allows it.

## RPCs and triggers relevant to the import

| Object                                                              | Import relevance                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accept_onboarding()`                                               | Caller-only `invited → onboarding`; stamps acceptance and Auth metadata. Not a bulk historical import RPC.                                                                                                                                                                                                           |
| `submit_onboarding()`                                               | Caller-only `onboarding → active`; stamps consent/activation and Auth metadata. Do not call on behalf of an employee to fabricate consent.                                                                                                                                                                           |
| `set_employee_access()`                                             | Admin disable/enable transition; database half of the operation. Auth ban/unban is still required.                                                                                                                                                                                                                   |
| `upload_contract()`                                                 | Preferred atomic contract version allocator and active-version flip.                                                                                                                                                                                                                                                 |
| `leave_balance()` / `medical_balance()`                             | Post-import derived-balance validation. They do not store balances.                                                                                                                                                                                                                                                  |
| `is_admin()`                                                        | Reads JWT `app_metadata.role`; it is the basis of admin RLS and privileged RPC checks. A service-role import bypassing RLS does not remove the need to verify mirrored metadata for real admin sessions.                                                                                                             |
| `calculate_payroll()`                                               | Rebuilds open draft payslips from current rules and configuration; removes stale members.                                                                                                                                                                                                                            |
| `lock_payroll()` / `unlock_payroll()`                               | Recalculate/sweep/finalize and release/recalculate respectively. Never use casually on preserved historical snapshots.                                                                                                                                                                                               |
| `ensure_current_run()`                                              | Creates only the current month; not for historical months.                                                                                                                                                                                                                                                           |
| `create_policy()` / `publish_policy_version()`                      | Atomically manage policy versions and can fan out employee notifications through the active-version trigger. Use instead of ad hoc policy writes unless controlled notification suppression is intentional.                                                                                                          |
| `policy_compliance()`                                               | Admin-only derived validation of active employees against each active policy version. Useful for acknowledgment reconciliation; it does not write.                                                                                                                                                                   |
| Dashboard/reporting RPCs                                            | `dashboard_summary()`, `employees_by_status()`, `employees_near_medical_cap()`, `leave_balances_all()`, `payroll_cycle_cost()`, `pending_approvals()`, and `run_is_locked()` are derived/read helpers. Use them for post-load spot checks, not as insertion paths.                                                   |
| `mirror_role_to_jwt` trigger                                        | Despite firing on role/status, its current body mirrors only `role`. It does not make status metadata safe. Fix it or explicitly update/verify Auth metadata.                                                                                                                                                        |
| `guard_employee_columns` trigger                                    | Blocks non-admin changes to role/status. Use a controlled privileged path rather than disabling it globally.                                                                                                                                                                                                         |
| `set_updated_at` triggers                                           | Replace `updated_at` on updates. Preserve source update times on initial insert or store them in the manifest if later upserts will restamp them.                                                                                                                                                                    |
| `notify_active_admins()` and request notification trigger functions | `trg_notify_admins_leave()`, `trg_notify_admins_medical()`, and `trg_notify_admins_overtime()` create admin notifications for newly inserted pending rows. The former `trg_notify_admins_onboarding()` function/trigger was dropped by direct activation. Control the three live producers during historical import. |
| `trg_notify_policy_update()`                                        | Fans an in-app notification to every active account when an active policy version is inserted.                                                                                                                                                                                                                       |
| `set_payslip_period_month` trigger                                  | Copies the run month onto a newly inserted payslip if not supplied.                                                                                                                                                                                                                                                  |
| `enforce_max_medical_files` trigger                                 | Enforces at most five file rows per claim.                                                                                                                                                                                                                                                                           |

Service-role JWTs bypass RLS but normally do not contain `app_metadata.role = 'admin'`. Consequently, they fail the explicit `public.is_admin()` guard inside admin RPCs such as `upload_contract()`, `calculate_payroll()`, `lock_payroll()`, `unlock_payroll()`, `set_employee_access()`, policy mutation RPCs, and admin reporting RPCs. Use an authenticated admin session for those calls or a purpose-built, temporary import function with its own narrowly scoped authorization. Do not weaken `is_admin()` or grant an import client a permanent bypass.

Multiple Supabase REST calls are not one database transaction. If a phase requires atomicity across several table writes, put it in a reviewed SQL migration or single RPC. Auth Admin and Storage calls still remain outside that transaction and require manifest-driven compensation.

## Recommended insertion sequence

1. Freeze and checksum the source extracts; create a row-level import manifest with source ID, target UUID, action, checksum, and result.
2. Back up the database and list all four buckets and object checksums.
3. Apply/verify all migrations and resolve the blockers above.
4. Normalize emails and identify duplicate people, shared bank accounts, duplicate CNICs, unknown project names, and missing reviewers before writing.
5. Create/match global configuration and shared lookup data: payroll settings, system configuration, projects, policies, and policy versions. Load active policy versions before active employees, or deliberately suppress their notification trigger under the controlled procedure above.
6. Create/map Auth users without sending email. Create/map all admins first.
7. Insert `employees` rows with final historical lifecycle timestamps; explicitly align and verify Auth role/status metadata and Auth ban state.
8. Insert one-to-one satellites: `bank_details`, `socials`, `employment_details`.
9. Upload identity objects, verify checksums, then insert/upsert `employee_documents`.
10. Upload contract objects and insert contract history in employee/version order.
11. Insert leave requests, medical claims, medical proof objects/rows, and overtime logs with status/reviewer consistency.
12. Insert policy acknowledgments only from evidence.
13. Import payroll in exactly one selected mode per run; reconcile linked claims/logs and exports.
14. Import notifications only if explicitly in scope.
15. Validate counts, relationships, balances, payroll totals, Storage references, RLS behavior, and Auth metadata.
16. Save the signed validation report and manifest; only then enable login or send recovery/invitation communication.

## Required post-import validation

Run these checks as a privileged database role. Every query should return zero rows; any approved historical exception must be enumerated by source ID and approval in the signed validation report rather than silently ignored.

```sql
-- Auth/public identity mismatches.
select e.id, e.email, u.email as auth_email
from public.employees e
full join auth.users u on u.id = e.id
where e.id is null
   or u.id is null
   or lower(trim(e.email)) is distinct from lower(trim(u.email));

-- Duplicate normalized emails.
select lower(trim(email)) as email, count(*)
from public.employees
group by lower(trim(email))
having count(*) > 1;

-- Auth metadata mismatches. The current DB trigger will not prevent status rows.
select e.id, e.role, e.account_status,
       u.raw_app_meta_data ->> 'role' as auth_role,
       u.raw_app_meta_data ->> 'account_status' as auth_status
from public.employees e
join auth.users u on u.id = e.id
where u.raw_app_meta_data ->> 'role' is distinct from e.role::text
   or u.raw_app_meta_data ->> 'account_status' is distinct from e.account_status::text;

-- Employee-table disable state versus Auth ban state.
select e.id, e.email, e.account_status, u.banned_until
from public.employees e
join auth.users u on u.id = e.id
where (e.account_status = 'disabled' and
       (u.banned_until is null or u.banned_until <= now()))
   or (e.account_status <> 'disabled' and
       u.banned_until is not null and u.banned_until > now());

-- Admin JWTs bypass the employee disabled check; imported admins must be active.
select id, email, account_status
from public.employees
where role = 'admin' and account_status <> 'active';

-- Lifecycle and disabled-state consistency.
select id, account_status, invited_at, accepted_at, activated_at, consent_at,
       disabled_at, disabled_by, disabled_from_status
from public.employees
where (account_status = 'disabled' and
       (disabled_at is null or disabled_from_status is null or disabled_from_status = 'disabled'))
   or (account_status <> 'disabled' and
       (disabled_at is not null or disabled_by is not null or disabled_from_status is not null))
   or (account_status = 'active' and activated_at is null);

-- Active employees omitted by payroll configuration.
select e.id, e.email
from public.employees e
left join public.employment_details d on d.employee_id = e.id
where e.account_status = 'active'
  and e.role = 'employee'
  and (d.employee_id is null or d.base_salary is null or d.working_hours is null);

-- Active employee profiles incomplete for the current onboarding contract.
select e.id, e.email
from public.employees e
left join public.bank_details b on b.employee_id = e.id
left join public.socials s on s.employee_id = e.id
where e.role = 'employee'
  and e.account_status = 'active'
  and (
    nullif(trim(e.full_name), '') is null or e.date_of_birth is null or
    nullif(trim(e.phone), '') is null or nullif(trim(e.emergency_contact), '') is null or
    nullif(trim(e.address), '') is null or nullif(trim(e.city), '') is null or
    nullif(trim(e.postal_code), '') is null or nullif(trim(e.cnic), '') is null or
    b.employee_id is null or nullif(trim(b.bank_name), '') is null or
    nullif(trim(b.account_holder), '') is null or nullif(trim(b.account_number), '') is null or
    nullif(trim(b.iban), '') is null or s.employee_id is null or
    nullif(trim(s.github_url), '') is null or nullif(trim(s.linkedin_url), '') is null
  );

-- Active employees missing any of the three required identity document rows.
select e.id, e.email, count(d.id) as document_count
from public.employees e
left join public.employee_documents d
  on d.employee_id = e.id
 and d.doc_type in ('cnic_front', 'cnic_back', 'photo')
where e.role = 'employee' and e.account_status = 'active'
group by e.id
having count(d.id) <> 3;

-- Completed-profile format rules from the application schemas.
select e.id, e.email
from public.employees e
join public.bank_details b on b.employee_id = e.id
where e.role = 'employee'
  and e.account_status = 'active'
  and (
    e.cnic !~ '^[0-9]{5}-[0-9]{7}-[0-9]$' or
    e.phone !~ '^[0-9]{10,15}$' or
    (e.phone like '0%' and e.phone !~ '^03[0-9]{9}$') or
    e.emergency_contact !~ '^[0-9]{10,15}$' or
    (e.emergency_contact like '0%' and e.emergency_contact !~ '^03[0-9]{9}$') or
    e.phone = e.emergency_contact or
    e.postal_code !~ '^[0-9]{4,6}$' or
    b.account_number !~ '^[0-9]{6,20}$' or
    b.iban !~* '^PK[0-9]{2}[A-Z]{4}[0-9]{16}$'
  );

-- Invalid employment/payroll configuration that SQL does not fully prevent.
select employee_id, base_salary, working_hours, ot_multiplier_override,
       leave_pool_days_override, medical_accrual_monthly_override, medical_cap_override
from public.employment_details
where base_salary is not null and base_salary <= 0
   or working_hours is not null and (working_hours <= 0 or working_hours > 400)
   or ot_multiplier_override is not null and
      (ot_multiplier_override <= 0 or ot_multiplier_override > 9.99)
   or leave_pool_days_override is not null and
      (leave_pool_days_override < 0 or leave_pool_days_override > 60)
   or medical_accrual_monthly_override < 0
   or medical_cap_override < 0;

-- Missing/invalid global singleton configuration.
select 'payroll_settings' as singleton
where (select count(*) from public.payroll_settings where id = true) <> 1
   or exists (
     select 1 from public.payroll_settings
     where id = true and (
       ot_multiplier_default <= 0 or ot_multiplier_default > 9.99 or
       tax_rate_percent < 0 or tax_rate_percent > 100 or
       leave_pool_days < 0 or medical_accrual_monthly < 0 or medical_cap < 0
     )
   )
union all
select 'system_config'
where (select count(*) from public.system_config where id = true) <> 1;

-- Derived balances that need an explicit business exception/remediation.
select 'leave' as kind, e.id as employee_id, lb.remaining::numeric as balance
from public.employees e
cross join lateral public.leave_balance(e.id, extract(year from now())::int) lb
where e.role = 'employee' and e.account_status = 'active' and lb.remaining < 0
union all
select 'medical', e.id, (mb.accrued - mb.spent)::numeric
from public.employees e
cross join lateral public.medical_balance(e.id) mb
where e.role = 'employee' and e.account_status = 'active' and mb.spent > mb.accrued;

-- Request review-state inconsistencies across all three modules.
select 'leave' as kind, id, status from public.leave_requests
where (status = 'pending' and (reviewed_by is not null or reviewed_at is not null or rejection_reason is not null))
   or (status = 'approved' and (reviewed_by is null or reviewed_at is null or rejection_reason is not null))
   or (status = 'rejected' and (reviewed_by is null or reviewed_at is null or coalesce(length(trim(rejection_reason)), 0) < 5))
union all
select 'medical', id, status from public.medical_claims
where (status = 'pending' and (reviewed_by is not null or reviewed_at is not null or rejection_reason is not null))
   or (status = 'approved' and (reviewed_by is null or reviewed_at is null or rejection_reason is not null))
   or (status = 'rejected' and (reviewed_by is null or reviewed_at is null or coalesce(length(trim(rejection_reason)), 0) < 5))
union all
select 'overtime', id, status from public.overtime_logs
where (status = 'pending' and (reviewed_by is not null or reviewed_at is not null or rejection_reason is not null))
   or (status = 'approved' and (reviewed_by is null or reviewed_at is null or rejection_reason is not null))
   or (status = 'rejected' and (reviewed_by is null or reviewed_at is null or coalesce(length(trim(rejection_reason)), 0) < 5));

-- Leave value invariants enforced by the app but not fully by SQL.
select id, leave_type, num_days, reason
from public.leave_requests
where num_days <= 0
   or mod(num_days, 0.5) <> 0
   or (leave_type = 'half_day' and num_days <> 0.5)
   or length(trim(reason)) < 10;

-- Medical proof overflow.
select claim_id, count(*)
from public.medical_claim_files
group by claim_id
having count(*) > 5;

-- Submitted/decided claims without any proof (must be an approved exception).
select c.id, c.status
from public.medical_claims c
where not exists (
  select 1 from public.medical_claim_files f where f.claim_id = c.id
);

-- Claims/logs linked to payroll must be approved.
select 'medical' as kind, id, status, payroll_run_id
from public.medical_claims
where payroll_run_id is not null and status <> 'approved'
union all
select 'overtime', id, status, payroll_run_id
from public.overtime_logs
where payroll_run_id is not null and status <> 'approved';

-- Medical/overtime values enforced by application flows but only partly by SQL.
select 'medical' as kind, id
from public.medical_claims
where amount <= 0 or length(trim(description)) < 10
union all
select 'overtime', id
from public.overtime_logs
where hours <= 0 or hours > 16 or length(trim(task)) < 10;

-- Identity metadata uniqueness (also enforced by the DB constraint).
select employee_id, doc_type, count(*)
from public.employee_documents
group by employee_id, doc_type
having count(*) > 1;

-- Metadata paths must obey the ownership convention used by Storage RLS.
select 'identity' as kind, d.id, d.storage_path
from public.employee_documents d
where d.storage_path <> d.employee_id::text || '/' || d.doc_type
union all
select 'medical', f.id, f.storage_path
from public.medical_claim_files f
join public.medical_claims c on c.id = f.claim_id
where f.storage_path not like c.employee_id::text || '/' || c.id::text || '/%'
union all
select 'contract', c.id, c.storage_path
from public.contracts c
where c.storage_path not like c.employee_id::text || '/%';

-- Contract version and active-row anomalies.
select employee_id,
       count(*) filter (where is_active) as active_count,
       count(*) as version_count,
       count(distinct version) as distinct_versions
from public.contracts
group by employee_id
having count(*) filter (where is_active) <> 1
    or count(*) <> count(distinct version);

-- Payroll header/snapshot reconciliation.
select r.id, r.period_month, r.status, r.total_payroll,
       coalesce(sum(p.total_pay), 0) as payslip_total
from public.payroll_runs r
left join public.payslips p on p.payroll_run_id = r.id
group by r.id
having (r.status = 'locked' and r.total_payroll is distinct from coalesce(sum(p.total_pay), 0))
    or (r.status = 'open' and (r.total_payroll is not null or r.locked_at is not null or r.locked_by is not null));

-- Run period and calendar-day invariants.
select id, period_month, days_in_month
from public.payroll_runs
where period_month <> date_trunc('month', period_month)::date
   or days_in_month <> extract(
        day from (date_trunc('month', period_month) + interval '1 month - 1 day')
      )::int;

-- Payslip/run month mismatch.
select p.id, p.period_month, r.period_month as run_month
from public.payslips p
join public.payroll_runs r on r.id = p.payroll_run_id
where p.period_month <> r.period_month
   or p.days_in_month <> r.days_in_month;

-- Impossible/current-engine payslip values and malformed custom-field container.
select id, employee_id, payroll_run_id
from public.payslips
where days_worked < 0 or days_worked > days_in_month
   or unpaid_leave_days < 0
   or overtime_hours < 0
   or overtime_rate < 0
   or overtime_pay < 0
   or overtime_multiplier < 0
   or jsonb_typeof(custom_fields) <> 'array';

-- Malformed custom-field elements.
select distinct p.id, p.employee_id, p.payroll_run_id
from public.payslips p
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(p.custom_fields) = 'array' then p.custom_fields else '[]'::jsonb end
) item
where jsonb_typeof(item) <> 'object'
   or jsonb_typeof(item -> 'label') <> 'string'
   or jsonb_typeof(item -> 'amount') <> 'number';

-- Swept items linked to a run from a different month.
select 'medical' as kind, m.id, m.expense_date, r.period_month
from public.medical_claims m
join public.payroll_runs r on r.id = m.payroll_run_id
where date_trunc('month', m.expense_date) <> date_trunc('month', r.period_month)
union all
select 'overtime', o.id, o.work_date, r.period_month
from public.overtime_logs o
join public.payroll_runs r on r.id = o.payroll_run_id
where date_trunc('month', o.work_date) <> date_trunc('month', r.period_month);

-- Paid item must belong to an employee who has a payslip in that run.
select 'medical' as kind, m.id, m.employee_id, m.payroll_run_id
from public.medical_claims m
where m.payroll_run_id is not null
  and not exists (
    select 1 from public.payslips p
    where p.payroll_run_id = m.payroll_run_id and p.employee_id = m.employee_id
  )
union all
select 'overtime', o.id, o.employee_id, o.payroll_run_id
from public.overtime_logs o
where o.payroll_run_id is not null
  and not exists (
    select 1 from public.payslips p
    where p.payroll_run_id = o.payroll_run_id and p.employee_id = o.employee_id
  );

-- Payslip notification-state consistency.
select id, notification_status, notification_sent_at,
       notification_attempts, notification_last_error
from public.payslips
where notification_attempts < 0
   or (notification_status = 'sent' and notification_sent_at is null)
   or (notification_status = 'pending' and notification_sent_at is not null)
   or (notification_status = 'failed' and notification_attempts = 0);
```

Database SQL cannot prove that a Storage object exists for every metadata path. The import validator must also list objects through the Storage API and report:

- metadata row with no object;
- object with no metadata row;
- owner UUID/path mismatch;
- checksum, MIME, or size mismatch;
- more than one identity object per employee/type;
- contract object outside the employee prefix;
- inability of the intended owner/admin to create a signed read URL.

Run an RLS test matrix with separate anon, ordinary employee, admin, and service-role clients. At minimum verify:

- anon cannot read any `employees` row or private bucket object;
- an ordinary employee cannot select another employee's CNIC, DOB, address, phone, bank, employment/payroll configuration, identity documents, superseded contracts, requests, acknowledgments, notifications, or payslips;
- the safe team-directory path exposes only its approved directory columns and authenticated profile photos;
- an employee sees only their active contract and only locked personal payslips;
- an admin can perform intended HR operations but cannot create a policy acknowledgment on an employee's behalf through the normal client;
- a disabled employee cannot create or continue an authenticated application session;
- the service role is confined to the offline import process and is never shipped to the browser.

Finally, compare per-table and per-employee counts and monetary totals against the signed source extract. A zero-error SQL report is necessary but not sufficient: the source-to-target reconciliation is the acceptance criterion.

## Rollback and audit requirements

- Tag every created target UUID and object path in the manifest.
- Keep Auth user IDs, public row IDs, and Storage paths in the same manifest so a partial non-transactional failure can be compensated safely.
- Roll back only objects/rows created by the manifest. Never delete by broad date range, email domain, bucket prefix, or guessed UUID set.
- Deleting an Auth user attempts to cascade to the employee and employee-owned rows, but deletion can be blocked when that employee is referenced as `reviewed_by`, `locked_by`, `exported_by`, or `reconciled_by`; those foreign keys do not use `ON DELETE SET NULL`. Resolve only the manifest-owned actor references deliberately before retrying. Storage cleanup is never automatic; delete manifest-listed objects separately.
- Do not place secrets, raw bank details, CNIC values, or document contents in logs, validation reports, diffs, or the manifest. Store only identifiers, redacted diagnostics, hashes, and counts unless the audit store is explicitly approved for that data class.
- Preserve the source extract, transformation code version, operator, execution timestamps, row counts, validation output, exceptions, and business approvals with the completed run.
