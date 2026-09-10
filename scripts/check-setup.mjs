// Reports configuration readiness without printing any secret values.
import { existsSync } from 'node:fs';
for (const file of ['.env', '.env.local']) {
  if (existsSync(file)) process.loadEnvFile(file);
}
const groups = {
  'Core CRM': ['DATABASE_URL', 'DIRECT_URL', 'NEXTAUTH_URL', 'NEXTAUTH_SECRET'],
  'Claude AI': ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'AI_INPUT_USD_PER_MILLION', 'AI_OUTPUT_USD_PER_MILLION'],
  'Google sign-in (optional)': ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  'Stripe billing': ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_STARTER', 'STRIPE_PRICE_PRO', 'STRIPE_PRICE_ENTERPRISE'],
  'Email delivery (optional)': ['SMTP_HOST', 'SMTP_FROM'],
  'Scheduled tasks': ['CRON_SECRET'],
};
let incomplete = false;
for (const [name, keys] of Object.entries(groups)) {
  const missing = keys.filter(key => !process.env[key]?.trim() || /replace-with|YOUR-|postgres:password/.test(process.env[key]));
  console.log(`${name}: ${missing.length ? 'NEEDS ' + missing.join(', ') : 'CONFIGURED (not yet connection-tested)'}`);
  if (missing.length && !name.includes('optional')) incomplete = true;
}
if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'false') {
  console.log('Live deployment needs NEXT_PUBLIC_DEMO_MODE=false followed by a rebuild.');
  incomplete = true;
}
console.log('No account, provider, or payment requests were made. No secret values were displayed.');
process.exitCode = incomplete ? 1 : 0;
