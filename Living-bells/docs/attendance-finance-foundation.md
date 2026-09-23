# Living Bells — Attendance & Finance Data Foundation

## Purpose

Prepare the database layer without inventing the church owner's final attendance or finance parameters.

## Attendance

- `AttendanceRecord` represents one church service/Sunday.
- `AttendanceEntry` stores one configurable category and its count.
- Categories are stored as strings so the owner can define the final categories later.
- Weekly records remain the source data.
- Monthly and yearly totals should be calculated from the weekly records.
- The reporting layer can calculate total attendance, category totals, and highest-attendance Sunday/month/year.

## Finance

- `FinancialRecord` represents a single financial entry.
- `type` distinguishes `INCOME` from `EXPENSE`.
- `category` remains configurable until the owner supplies the official categories.
- `amount` uses a decimal database type for money.
- Monthly and yearly reports should aggregate raw records rather than storing duplicated totals.
- Net result can be calculated as total income minus total expenses; the final terminology (profit/loss, surplus/deficit, or another term) will be confirmed with the owner.

## Intentionally deferred

Do not hard-code:
- Attendance category names
- Finance category names
- Required finance fields
- Special Sunday/week rules
- Reporting labels
- Owner-specific approval/editing rules

Those are inputs for the owner meeting.

## Existing models

The existing `Attendance` and `Expense` models are left intact for now. The new generic models provide a safer foundation while the final workflow is confirmed, avoiding a destructive rewrite before the owner supplies the parameters.

## Next implementation step

After the owner confirms the parameters:
1. Finalize the category/configuration model.
2. Decide whether the legacy `Attendance`/`Expense` models should be migrated into the new foundation.
3. Add service/API validation.
4. Add monthly/yearly aggregation queries.
5. Connect staff forms and admin reporting.
6. Test with real church records.
