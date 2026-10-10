# Multi-church rollout notes

## What this branch adds

- A church application intake flow. Applications start as PENDING; no church administrator account is created at submission time.
- A developer-only application queue with Approve, Reject, and Request information actions.
- A one-time activation token stored only as a hash, expiring after 72 hours. The applicant sets the administrator password during activation; the account's email verification timestamp is set only after the activation link is used.
- A Church record and church ownership fields on existing operational records. Existing rows are backfilled to the Foursquare Gospel Church, The Bells record created by the migration.
- Prisma query-extension scoping for authenticated non-developer users, including user directories, operational records, reporting periods, invitations, and support tickets.
- Church administrator support tickets and a developer support desk. New applications and tickets create persistent developer notifications. Email delivery is available through Resend when configured.
- A disposable PostgreSQL migration smoke test and a two-church isolation smoke test in CI.

## Required backend environment for production approvals

Configure these values in the backend hosting environment; do not commit secrets:

- `RESEND_API_KEY`: Resend API key.
- `RESEND_FROM_EMAIL`: sender address on a domain verified in Resend, for example `Living Bells <support@your-verified-domain.example>`.
- `APP_BASE_URL`: public frontend origin, normally `https://living-bells.vercel.app`.

In production, approval is blocked if the email provider credentials are missing. If delivery fails after approval, the developer queue offers a resend action. In local/non-production environments without email configured, the developer console can show the one-time activation link for manual testing.

## Database migration safety

The migration is expand-and-backfill:
1. Creates the Church table and one initial The Bells church.
2. Adds church ownership columns.
3. Backfills existing users and operational records to The Bells, leaving developer accounts unassigned to a church.
4. Adds ownership constraints and church-scoped uniqueness for dates, reporting months, config options, and offline request IDs.
5. Creates application and support tables.

It does not truncate or delete application data. It does replace the old globally unique report-date and reporting-month/config uniqueness indexes with church-scoped indexes. Existing duplicate rows, if any, must be checked against a backup before rollout.

## Release checklist

- Review the draft pull request and the passing CI checks.
- Set the email environment variables on a staging backend.
- Restore a recent production backup into staging and apply the migration there first.
- Test two churches with separate admins and staff: dashboard, attendance, activities, finance, reports, reporting calendar, staff invitations, notifications, and support tickets.
- Verify a cross-church identifier cannot be fetched, edited, or deleted from the other church.
- Confirm activation email delivery and expiry, duplicate application handling, and the retry-email path.
- Only after staging sign-off, take a fresh backup and approve a production migration/deployment explicitly.

No production database migration or deployment is performed by this branch or its CI.
