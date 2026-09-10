# Relay CRM validation

## Verified in this workspace

- Production Next.js application builds successfully with demo mode disabled.
- Prisma migration succeeds against a fresh isolated PostgreSQL database.
- Seed creates two organizations, three users, 24 contacts, 24 deals, and 22 activities.
- All 22 policy and database integration tests pass. Claude provider responses are mocked in database tests; these are not live provider checks.
- All 17 authenticated HTTP checks pass against the production server: sign-in, bootstrap, contact/deal creation, stage probability, completion timestamps, duplicate rejection, tenant and owner isolation, billing authorization, atomic CSV imports, missing-AI configuration, protected jobs, and preserved deal links after contact deletion.
- The isolated verification process generates temporary credentials, makes no paid provider requests, and shuts down its app server and database afterward.

Run `npm run verify:backend` to repeat these checks. It needs local process/listening permissions and available ports 55433 and 3001. It uses a separate test database under the ignored work directory; it does not use a customer database.

Run `npm run check:setup` to list missing environment variable names without revealing values. It is a configuration inventory, not a provider connectivity or security audit.

## Still requires external accounts

Real Claude requests and model pricing verification; hosted PostgreSQL; Vercel deployment; Google OAuth; Stripe checkout and webhook delivery; SMTP delivery and scheduled jobs. No external integration is marked verified merely because its source code builds.

The published Sites demo remains a static, browser-local application with simulated AI and billing. Its current access is owner-only. External sharing access has not been enabled.

Browser interaction tests, load tests, backup restoration, email deliverability, and production operational security review remain unperformed.
