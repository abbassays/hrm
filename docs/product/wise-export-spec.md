# Export for Wise — implementation spec

Add a second payout export to the payroll cycle page, producing the CSV that Wise's
batch-payment upload accepts. It shares one Export button with the existing Payoneer
export; Payoneer is not being removed.

Read `src/actions/payroll-export.ts` first. The Wise export is the same shape as the
Payoneer one — same admin gate, same locked-run precondition, same bucket, same audit
row, same signed download URL. Almost all of this spec is about what differs.

All example data below is invented. Real figures live only in the production database.

---

## 1. The file Wise expects

Header, verbatim and in this order:

```
name,recipientEmail,paymentReference,referenceNumber,receiverType,amountCurrency,amount,sourceCurrency,targetCurrency,IBAN
```

| Column             | Value                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `name`             | `bank_details.account_holder`, falling back to `employees.full_name`. Must match the name on the bank account or Wise rejects the row. |
| `recipientEmail`   | `employees.email`. Blank if the employee has none — do **not** block the export on it.                                                 |
| `paymentReference` | Admin-entered, one value for the whole file. Default `Salary <Mon YYYY>` derived from the run's `period_month`.                        |
| `referenceNumber`  | Always blank.                                                                                                                          |
| `receiverType`     | Always `PERSON`.                                                                                                                       |
| `amountCurrency`   | Always `target` — meaning `amount` is what the recipient receives, not what we're debited.                                             |
| `amount`           | `payslips.total_pay`, whole PKR, no separators.                                                                                        |
| `sourceCurrency`   | One choice for the whole file (see §4). Wise rejects a batch with more than one source currency.                                       |
| `targetCurrency`   | Always `PKR`.                                                                                                                          |
| `IBAN`             | `bank_details.iban`. Missing IBAN is a hard error.                                                                                     |

Example output with invented people and amounts:

```
name,recipientEmail,paymentReference,referenceNumber,receiverType,amountCurrency,amount,sourceCurrency,targetCurrency,IBAN
"Aisha Rahman","aisha@example.com","Salary Oct 2026","","PERSON","target","111111","EUR","PKR","PK00XXXX0000000000000001"
"Bilal Anwar","bilal@example.com","Salary Oct 2026","","PERSON","target","222222","USD","PKR","PK00YYYY0000000000000002"
```

When the source currency is USD, Wise also requires the recipient address, so five
columns are appended after `IBAN`:

```
addressCountryCode,addressCity,addressFirstLine,addressState,addressPostCode
```

| Column               | Value                    |
| -------------------- | ------------------------ |
| `addressCountryCode` | Always `PK`.             |
| `addressCity`        | `employees.city`.        |
| `addressFirstLine`   | `employees.address`.     |
| `addressState`       | Always blank.            |
| `addressPostCode`    | `employees.postal_code`. |

The address is compulsory for a USD file and always comes from the employee's profile:
a missing street address, city or postal code is a hard error. GBP and EUR files keep
the ten-column header.

> The five address header names are **not verified** against a downloaded USD → PKR
> template. They live in `WISE_ADDRESS_HEADER` in `src/lib/payroll/wise-csv.ts`.

Every field is quoted, because that is how the template Wise ships is formatted. This
differs from the Payoneer export, which quotes only when a field contains a comma,
quote or newline.

> The reference length cap is **not verified**. Cap it at 35 characters in the schema
> and confirm against Wise's own docs before shipping; loosen if they allow more.

---

## 2. Database changes

One migration, following the naming convention in `supabase/migrations/`.

**`payroll_exports.provider`** — text, `not null default 'payoneer'`, with a check
constraint allowing `'payoneer' | 'wise'`. The default backfills existing rows
correctly, since every export written so far was Payoneer.

**`payslips.wise_source_currency`** — nullable text.

Do **not** reuse `payslips.currency_balance` for Wise. That column records which
Payoneer balance an employee was paid from and is already populated for past runs;
overloading it would make a re-export of an old run rewrite Payoneer history. Two
columns is the cheap, honest option at this team size. If a third provider ever
appears, promote both into a `payslip_export_currencies` table then, not now.

The `payroll-exports` bucket already allows `text/csv` and needs no change.

---

## 3. Shared code to extract first

Land this as a separate commit before the Wise feature, so the diff stays reviewable
and the Payoneer path is provably untouched.

Create `src/lib/payroll/csv.ts` and move out of `payoneer-csv.ts` the parts that
aren't Payoneer-specific:

- `csvField`, and `toCsv(rows, options?)` — add a `quoteAll?: boolean` option, default
  `false` so Payoneer output is byte-identical to today's.
- `CSV_MIME` (currently `PAYONEER_CSV_MIME`).
- `exportFileName(prefix, periodMonth, copyNumber)` — the copy-suffix logic currently
  inside `payoneerFileName`. `payoneerFileName` then becomes a one-line call with
  prefix `salaries`.

Rename the two UI pieces that are about currency, not about Payoneer:

- `payoneer-export-row.tsx` → `export-currency-row.tsx` (`ExportCurrencyRow`)
- `payoneer-balance-breakdown.tsx` → `balance-breakdown.tsx` (`BalanceBreakdown`)
- `PayoneerExportRow` in `src/types/hrm.ts` → `PayrollExportRow`

`CurrencySelect` is already provider-neutral. Leave it.

---

## 4. Server action

Add `exportWise` to `src/actions/payroll-export.ts`, and `exportWiseSchema` to
`src/schema/payroll-export.ts`:

```ts
export const exportWiseSchema = z.object({
  run_id: z.string().uuid(),
  sourceCurrency: z.enum(BALANCE_CURRENCIES),
  excludedEmployeeIds: z.array(z.string().uuid()).default([]),
  paymentReference: z.string().trim().min(1).max(35),
});
```

The body mirrors `exportPayoneer` step for step:

1. Reject non-admins (`authUser.user?.app_metadata.role !== 'admin'`).
2. Load the run; reject unless `status === 'locked'`.
3. Load payslips via `supabaseAdmin` — the select now also needs `employees(email)`.
4. Drop `excludedEmployeeIds`; error if nothing is left.
5. Load `bank_details` for the surviving employees.
6. **Validate every row before writing anything**, so a bad row leaves no artifact
   behind. Missing IBAN throws, naming the person; so does a missing address when the
   source currency is USD.
7. Persist the file's source currency to `payslips.wise_source_currency` for every
   included employee.
8. Build the CSV with `quoteAll: true`.
9. Resolve the next free filename (`wise-salaries-oct-2026.csv`, then `(1)`, `(2)`…)
   and upload with `upsert: false`.
10. Insert the `payroll_exports` row with `provider: 'wise'`, through the RLS-scoped
    client, not the admin one — that insert is what proves an admin session.
11. Return `{ file_path, signed_url, count, excluded }`.

Steps 1–5 are identical to `exportPayoneer` in everything but the payslip select.
Extract them into a shared helper in the same commit rather than copying them.

---

## 5. UI

**`export-sheet.tsx`** — one Export button opens a provider chooser (Wise, then
Payoneer); picking one opens the shared sheet for that provider: per-row
in-file/out-of-file toggle, `BalanceBreakdown` summary, footer count.

What the Wise sheet has that the Payoneer one doesn't:

- A two-field form above the table (`wise-file-form.tsx`): one "Pay from" currency for
  the whole file, and a payment reference pre-filled with `Salary <Mon YYYY>`. React
  Hook Form + Zod + shadcn `Form` per `.claude/docs/ui/forms.md`.
- No per-employee currency picker or "apply to selected" — those are Payoneer only.
- Copy throughout says Wise, and the sheet explains that the recipient account is
  always PKR and the amount is the locked payslip total.

**`payroll-cycle-page-content.tsx`** — mounts `<ExportSheet>` inside the existing
`{locked && ...}` block.

**`export-artifacts.tsx`** — the list header is hardcoded to "Payoneer exports".
Change it to "Exports" and put a provider `Badge` on each row. `useRunExports` in
`src/hooks/queries/payroll-exports.ts` must select the new `provider` column. The
header carries All / Wise / Payoneer filter tabs with counts, a date-range picker and
a newest/oldest sort toggle. The list shows three rows until "Show all" expands it
into a scrolling area.

**`use-export-wise.ts`** in `src/hooks/actions/`, mirroring `use-export-payoneer.ts`.

Currency options stay `BALANCE_CURRENCIES` (`EUR`, `GBP`, `USD`, defaulting to `EUR`)
from `src/constants/payroll-export.ts`. Wise supports far more; extending that one array is
the only change needed if we ever fund from another balance.

---

## 6. Error cases

Every one of these must fail **before** anything is written to storage or the database:

| Case                                           | Message                                                                                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Caller isn't admin                             | `Forbidden`                                                                                                                                  |
| Run isn't locked                               | `Run must be locked before export.`                                                                                                          |
| Run has no payslips                            | `This run has no payslips to export.`                                                                                                        |
| Everyone excluded                              | `Every employee is excluded — include at least one to export.`                                                                               |
| No source currency for someone (Payoneer only) | `Choose a source currency for <name>.`                                                                                                       |
| USD file, incomplete address for anyone        | `Missing address for <names>. Wise needs a street address, city and postal code to pay from USD.` — names everyone affected, comma-separated |
| No IBAN for someone                            | `Missing IBAN for <name>. Add their bank details before exporting.`                                                                          |
| Employee has no email                          | _Not an error._ Leave `recipientEmail` blank.                                                                                                |

---

## 7. Testing

Use the dev database. Do not point anything at production.

Cover these on a locked dev run:

1. Happy path — every employee included, once from EUR and once from USD. Open the downloaded
   file and check the header is byte-identical to §1 and every field is quoted.
2. One employee excluded — they're absent from the file, and `excluded` comes back `1`.
3. An employee with no `bank_details` row — the action throws, names them, and **no**
   file appears in the bucket and **no** `payroll_exports` row is created. This is the
   one that catches a validate-while-writing mistake.
4. Export twice — second file gets the `(1)` suffix, both rows show in the artifacts
   list with a Wise badge.
5. Export Payoneer on the same run afterwards — it still produces its old
   unquoted-unless-necessary format, and `currency_balance` is what it was.
6. Sign in as a non-admin and confirm the button isn't reachable and the action
   rejects if called directly.

---

## 8. Done when

- [ ] `pnpm typecheck` and `pnpm lint` pass
- [ ] Migration applies cleanly and existing `payroll_exports` rows read `payoneer`
- [ ] Payoneer export output is unchanged, byte for byte, against the same run
- [ ] All six test cases in §7 pass on the dev database
- [ ] No `any`, no unexplained casts, comments follow `.claude/docs/rules/comments.md`
      (one short line, only for a _why_)
- [ ] Nothing from §3 is left behind under its old name
