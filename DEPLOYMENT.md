# Connect Relay to Vercel and your services

The delivered Sites URL is a private, static sample-data demo. It is ready for product testing. The server application is prepared for deployment to your own Vercel project after the services below are configured. No live Stripe charge, Google login, Claude request, or external email has been performed during the build.

## 1. PostgreSQL

Before connecting external accounts, the entire local backend can be verified with `npm run verify:backend`. This provisions an isolated temporary PostgreSQL database, runs migrations and tests, seeds samples, builds the production app, and checks authenticated HTTP workflows. It does not need Claude, Stripe, Google, or a cloud database account. See `VALIDATION.md` for verified coverage and outstanding external checks.

After entering service settings, run `npm run check:setup` to list missing configuration names without displaying secrets. A configured value still needs a real connection test.

Create a dedicated PostgreSQL database on Supabase or Railway. Use a pooled TLS connection for `DATABASE_URL` and a direct or session connection for `DIRECT_URL`, following your provider's Prisma guidance. Prisma's migrations use the direct URL. Give the application only the privileges it needs and keep the credentials on the server.

From the project folder:

```sh
npm ci
cp .env.example .env
# Configure DB URLs and authentication values.
npm run db:migrate
```

The initial migration includes composite tenant foreign keys, indexes, and numeric check constraints. On a development database only, set `ALLOW_DEMO_SEED=true`, set a unique `SEED_PASSWORD` (12+ characters), then run `npm run db:seed`. Do not seed a live customer database. Remove both seed variables from the live environment.

## 2. Exact environment variables

Copy `.env.example` locally; add the same settings as Vercel environment variables. Values marked optional can remain empty until the corresponding integration is connected. Secrets must never have a `NEXT_PUBLIC_` prefix.

| Variable | Value to supply |
|---|---|
| `NEXT_PUBLIC_DEMO_MODE` | `false` for the server application. `true` only for browser-local demo mode. It is fixed into the client at build time. |
| `NEXTAUTH_URL` | The exact app origin, e.g. `https://your-crm.vercel.app`; locally `http://localhost:3000`. No trailing slash. |
| `NEXTAUTH_SECRET` | A unique random secret; generate with `openssl rand -base64 32`. |
| `DATABASE_URL` | Pooled PostgreSQL URL, including provider-recommended TLS/pooling parameters. |
| `DIRECT_URL` | Direct/session PostgreSQL URL for migrations. |
| `GOOGLE_CLIENT_ID` | Optional Google OAuth web client ID. |
| `GOOGLE_CLIENT_SECRET` | Optional Google OAuth client secret. |
| `ANTHROPIC_API_KEY` | Your Anthropic API key for the test/production environment. |
| `ANTHROPIC_MODEL` | An available model ID; example `claude-sonnet-4-6`. |
| `AI_INPUT_USD_PER_MILLION` | Current uncached input-token USD rate for that model; example `3`. |
| `AI_OUTPUT_USD_PER_MILLION` | Current output-token USD rate; example `15`. |
| `STRIPE_SECRET_KEY` | Stripe test secret (`sk_test_…`) initially; use live only after acceptance testing. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for this environment's webhook endpoint (`whsec_…`). |
| `STRIPE_PRICE_STARTER` | Monthly, per-seat USD recurring Stripe Price ID for Starter. |
| `STRIPE_PRICE_PRO` | Monthly, per-seat USD recurring Stripe Price ID for Pro. |
| `STRIPE_PRICE_ENTERPRISE` | Monthly, per-seat USD recurring Stripe Price ID for Enterprise. |
| `CRON_SECRET` | A second unique random secret protecting `/api/jobs`. |
| `SMTP_HOST` | Optional SMTP provider hostname. Required for actual email/reminders. |
| `SMTP_PORT` | Usually `587` for STARTTLS or `465` for implicit TLS. |
| `SMTP_SECURE` | `true` for port 465; otherwise `false`. |
| `SMTP_USER` | SMTP username, if required. |
| `SMTP_PASSWORD` | SMTP password or application password, if required. |
| `SMTP_FROM` | A verified sender, such as `Relay <sales@your-domain.example>`. Replace with your domain. |
| `ALLOW_DEMO_SEED` | `true` only when intentionally seeding a development/test DB; otherwise `false` or omitted. |
| `SEED_PASSWORD` | A unique 12+ character development seed password; omit in production. |

No browser-exposed Anthropic, Stripe, Google or database secrets are needed. Checkout redirects are created server-side, so this implementation does not require a Stripe publishable key.

Confirm current model availability and rates in [Anthropic's pricing documentation](https://platform.claude.com/docs/en/about-claude/pricing). The model and rate settings must change together.

## 3. Authentication

Password signup creates a user, organization, admin membership and 14-day Starter trial in one transaction. Organization membership is checked on each request.

Create a Google OAuth web application with these authorized redirect URIs:

```text
http://localhost:3000/api/auth/callback/google
https://YOUR-APP-ORIGIN/api/auth/callback/google
```

Add the appropriate authorized origins and Google test users while the consent screen is in testing mode. Only verified Google email identities are accepted. Existing password accounts are not silently linked by matching email; users must continue with their password in this release.

Invitation links are generated in Settings, expire after seven days, and are accepted once by the invited email. Share the generated link with that person. The app does not automatically email the invitation. New users can sign up first and reopen the invitation link to join the additional organization.

## 4. Stripe in test mode

1. Create three Products and monthly USD recurring Prices: Starter $29, Pro $79, Enterprise $149 per seat. Copy the Price IDs to the environment variables.
2. Enable Stripe's customer portal. Allow the three supported plans. If you permit quantity changes, operationally prevent reductions below the current member count; the app has no membership-removal flow in this release.
3. Configure a webhook endpoint at `https://YOUR-APP-ORIGIN/api/webhooks/stripe` for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Use an API version compatible with the pinned Stripe SDK (2025-02-24.acacia). The handler retrieves the current subscription for supported events; invoice events use the classic `subscription` reference. Subscription events are the primary entitlement path.
5. Locally, forward Stripe test webhooks to `/api/webhooks/stripe` using Stripe CLI. Use the signing secret printed by that local listener only in local configuration.
6. Buy a test plan from Usage & billing. The redirect does not grant entitlements; only verified webhook synchronization does. Existing subscribers are routed to the portal to avoid duplicate subscriptions.
7. Verify seat quantity, price, status and billing period in both the app and Stripe. Replay a webhook to confirm idempotence.

[Stripe's subscription webhook guide](https://docs.stripe.com/billing/subscriptions/webhooks) explains the asynchronous lifecycle. Configure tax, invoice details and cancellation behavior in your account before commercial use; the sample UI prices are USD amounts before any configured taxes.

The selected pricing approach has **no metered overages**. Both model-call and token caps stop new AI requests. This makes bills predictable but interrupts AI at the cap. The schema keeps an overage-rate field for a later metered implementation; it is not currently charged.

## 5. Email and scheduled work

Connect an SMTP test mailbox first. Verify your sending domain (SPF/DKIM and applicable DMARC policy), sender address and TLS settings. Approved email drafts are queued, and the jobs runner performs delivery. Confirm the draft, recipient and subject before clicking Send email.

`vercel.json` schedules `/api/jobs` every five minutes. Use a Vercel plan that supports the required schedule and up to 300-second function duration. If your plan does not, run an external scheduler against the endpoint using:

```text
Authorization: Bearer YOUR_CRON_SECRET
```

Do not put the cron secret in a URL. Jobs process reminders and debounced scoring. A call with an unknown SMTP outcome is marked `uncertain` for operator review rather than retried blindly. Review the provider delivery log before retrying. Scoring retries three times with delays, and failures retain a reason. An absent AI or mail service will result in pending/failed/uncertain jobs until configured and reconciled.

## 6. Deploy to Vercel

1. Push the supplied source into your own repository and import that project into Vercel.
2. Select the project root containing `package.json`, use Node.js 22 LTS or newer, and configure all environment variables.
3. Run `npm run db:migrate` as a controlled release step against the intended database. Do not run development seed scripts during deploy.
4. Use `npm run build` as the build command (already configured in `vercel.json`). Do not use `build:demo` for the live backend.
5. Set `NEXTAUTH_URL` to the final stable origin; register the same origin with Google and Stripe. Keep preview-deployment secrets and databases separate from production.
6. Redeploy after changing any public build variable. Test every flow in `USER_TEST_GUIDE.md` before inviting real customers.

## Operational follow-up

- Enable database backups and test restoration.
- Monitor webhook failures, pending jobs, uncertain AI requests and cron invocation failures.
- Inspect `AIRequest.status = 'uncertain'` alongside provider request records before adjusting held allowance. Reservations prevent overspend but need manual reconciliation after ambiguous network failures.
- Add a dedicated worker and virtualized/paginated UI loading before large-scale use. The initial workspace loads 1,000 records per type, while overview metrics aggregate all visible data.
- Keep the lockfile and security overrides; rerun build/tests when updating providers or framework versions.
- Configure account recovery, signup verification/abuse defenses, retention rules and operational alerting to suit your commercial launch.
