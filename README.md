# Relay CRM

An AI-native, multi-organization CRM with contacts, deal pipelines, activities, Claude tools, and subscription/AI allowance management.

The application uses **Next.js 15.5.25**, App Router, TypeScript, Tailwind CSS, shadcn/ui, NextAuth.js, PostgreSQL/Prisma, Anthropic and Stripe. Next.js 15 was explicitly approved in place of the original Next.js 14 requirement after the dependency audit found that 14 is unsupported.

## Two ways to run

- **Hosted demo:** private Sites deployment; realistic sample data stored in the current browser. CRUD, CSV import, pipeline stages, task completion, organization switching, simulated AI, and simulated plan/allowance changes work immediately. No external credentials, email delivery, shared database, or payments are involved.
- **Production integration build:** the same screens call authenticated Next.js API routes backed by PostgreSQL. Real Claude, Google, Stripe and SMTP behavior requires your test-service credentials. This build is prepared for Vercel; it has not been deployed to your Vercel account.

Start with [USER_TEST_GUIDE.md](USER_TEST_GUIDE.md) to try the app and [DEPLOYMENT.md](DEPLOYMENT.md) to connect services. The complete pre-implementation schema proposal is in the accompanying `ARCHITECTURE.md`; the implemented schema is `prisma/schema.prisma`.

## Local setup

Use Node.js 22 LTS or newer and npm. Configure `.env` from `.env.example` before using the production backend.

```sh
npm ci
cp .env.example .env
# Fill in DATABASE_URL, DIRECT_URL, NEXTAUTH_URL and NEXTAUTH_SECRET.
npm run db:migrate
# Only on a disposable development/test database:
# Set ALLOW_DEMO_SEED=true and a unique SEED_PASSWORD in .env.
npm run db:seed
npm run dev
```

Prisma reads `.env` for its commands. `tsx` does not automatically load `.env` for the seed script; use the provided seed command, which loads it explicitly.

The three seeded accounts are `alex@northstar.example` (admin), `sarah@northstar.example` (manager) and `james@northstar.example` (sales rep). Their password is the unique `SEED_PASSWORD` you supplied. These `.example` addresses cannot receive real mail. The two seeded organizations each contain 12 contacts, 12 deals, and 11 activities. Seeding preserves existing organizations.

For a local sample-data demo:

```sh
NEXT_PUBLIC_DEMO_MODE=true npm run dev
```

For a deployable static demo:

```sh
npm run build:demo
```

The exporter builds in an isolated temporary directory and preserves all production API source. It copies only public static assets to `out/`; no `.env` files, API handlers, secrets, database records, or production server bundles are published to Sites.

## Included backend behavior

- Password hashing, Google OAuth, signed JWT sessions, per-request organization membership checks and role-scoped record access.
- Organization creation/switching, admin role management, hashed expiring invitations with single-use acceptance and available-seat checks.
- Contact/deal/activity CRUD, server validation, CSV import with atomic duplicate rejection, and audited changes.
- Composite organization foreign keys enforce tenant isolation even for direct database writes.
- Claude tool loop with scoped contact/deal search, inactive-deal filters, bounded context and confirmation-required task/stage proposals.
- Editable email drafts; approved sends enter a durable queue. Transcript summaries return task suggestions. Scoring runs manually or through debounced background jobs.
- Every model request goes through `trackAIUsage()`. PostgreSQL locks reserve allowance before the provider call; actual input/output tokens and cost settle against the original billing period.
- Stripe Checkout and portal, signed/deduplicated subscription webhooks, seat quantities, and subscription-period usage totals.
- Admin organization/per-user usage dashboard; other members see their own user breakdown. Organization allowance totals are visible to everyone so the shared cap is understandable.
- Authenticated scheduled jobs for reminders and scoring. Unknown SMTP outcomes are held for review to avoid duplicate deliveries.

## Pricing defaults

| Plan | USD per seat / month | Calls per organization / period | Total input + output tokens | Seat ceiling |
|---|---:|---:|---:|---:|
| Starter | 29 | 500 | 1,000,000 | 5 |
| Pro | 79 | 3,000 | 6,000,000 | 50 |
| Enterprise | 149 | 15,000 | 30,000,000 | 500 |

Every model request is one call, including each assistant tool-use round. Both caps apply. Accepted suggestions and editing drafts do not call the model. Token reservations may stop a request slightly before the displayed raw token balance reaches zero. No automatic overage charges exist. Reaching the cap pauses AI; CRM access continues. Prices are configurable launch defaults, not activated subscriptions.

## Checks

```sh
npm run typecheck
npm test
npm run build
npm run build:demo
```

`npm test` runs unit tests. Database tests additionally run when `TEST_DATABASE_URL` is set to a dedicated database containing `relay_test` in its connection URL and equal to `DATABASE_URL`. Never point tests at a production database. See `VALIDATION.md` for the actual checks performed and their limits.

## Practical limits and operations

This is a complete initial product implementation and demo, with integration setup still required. It is not a claim of production certification or Salesforce feature parity.

- The workspace initially loads up to 1,000 recent records of each kind. The dashboard uses database aggregates across all visible records. The CRM list API supports cursor pagination/search for larger datasets. Add virtualized board lists and paginated relation pickers before operating a very large tenant; do not mistake the board's loaded-card count for a total organization count.
- PostgreSQL tenant isolation is implemented in scoped services and composite foreign keys. There is no database row-level-security policy for arbitrary external SQL clients; keep database credentials server-only and do not expose these tables through an unauthenticated Supabase API.
- Trial accounts last 14 days. Each organization gets its own allowance. Add email verification, anti-abuse controls and trial-creation controls appropriate to your signup volume before a public commercial launch.
- Google does not silently link an existing password account by email. Account recovery, self-service account linking, SSO, audit-log viewing, membership removal and custom sales stages are outside this release.
- Stripe portal configuration must control plan and quantity changes. Do not allow purchased seats to be reduced below active memberships. The server enforces seat availability when inviting/accepting; a portal-induced seat deficit needs admin reconciliation.
- Provider rates are explicit environment configuration; update them when changing the model. Costs are provider costs, not invoices to the user. Prompt caching is not enabled.
- Unknown provider responses keep conservative reservations. An operator should reconcile `AIRequest` rows with provider records before releasing them. Never blindly expire held reservations: an interrupted call may still have been billed.
- Background work runs in batches of three. For significant volume, move the same durable jobs to a dedicated worker/queue, add alerts, retry tooling, dead-letter review and provider reconciliation. Configure provider spend caps independently of application limits.
- Before public release, run the credential-dependent test guide, restore a database backup, verify mail deliverability and measure concurrency/load against your actual hosting plan.
