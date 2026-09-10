import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:3001';
const password = process.env.HTTP_TEST_PASSWORD;
if (!password)
  throw Error('Set HTTP_TEST_PASSWORD to the isolated seed password.');
function client() {
  const jar = new Map();
  return async (path, method = 'GET', body, extra = {}) => {
    const r = await fetch(base + path, {
      method,
      redirect: 'manual',
      headers: {
        Origin: base,
        Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...extra,
      },
      body: body
        ? typeof body === 'string'
          ? body
          : JSON.stringify(body)
        : undefined,
    });
    for (const c of r.headers.getSetCookie()) {
      const pair = c.split(';')[0],
        i = pair.indexOf('=');
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    let json;
    try {
      json = await r.json();
    } catch {}
    return { status: r.status, json };
  };
}
const request = client();
let checks = 0;
function check(ok, label) {
  assert.ok(ok, label);
  console.log('PASS ' + label);
  checks++;
}
async function login(req, email) {
  const csrf = await req('/api/auth/csrf');
  const data = new URLSearchParams({
    email,
    password,
    csrfToken: csrf.json.csrfToken,
    callbackUrl: base,
    json: 'true',
  });
  const r = await req(
    '/api/auth/callback/credentials',
    'POST',
    data.toString(),
    { 'Content-Type': 'application/x-www-form-urlencoded' },
  );
  assert.equal(r.status, 200);
  const session = await req('/api/auth/session');
  assert.equal(session.json.user.email, email);
}
check(
  (await request('/api/crm/bootstrap')).status === 401,
  'Unauthenticated CRM denied',
);
await login(request, 'alex@northstar.example');
check(true, 'Real NextAuth credential sign-in');
await request('/api/organizations/switch', 'POST', {
  organizationId: 'demo-northstar',
});
const boot = await request('/api/crm/bootstrap');
check(
  boot.status === 200 &&
    boot.json.contacts.length >= 12 &&
    boot.json.dashboard.pipeline > 0,
  'Authenticated seeded dashboard and CRM',
);
check(
  (
    await request(
      '/api/crm/contacts',
      'POST',
      { name: 'Invalid origin', email: 'origin@example.test', company: 'Test' },
      { Origin: 'https://untrusted.example' },
    )
  ).status === 403,
  'Cross-origin mutation denied',
);
const email = `smoke-${Date.now()}@example.test`;
const contact = await request('/api/crm/contacts', 'POST', {
  name: 'HTTP Test Contact',
  email,
  company: 'Smoke Test',
});
check(contact.status === 200 && contact.json.id, 'Contact created through API');
check(
  (
    await request('/api/crm/contacts', 'POST', {
      name: 'Duplicate',
      email,
      company: 'Smoke Test',
    })
  ).status === 409,
  'Duplicate email rejected',
);
const deal = await request('/api/crm/deals', 'POST', {
  title: 'HTTP test opportunity',
  value: 12000,
  contactId: contact.json.id,
});
check(deal.status === 200, 'Linked deal created');
const won = await request('/api/crm/deals/' + deal.json.id, 'PATCH', {
  stage: 'won',
});
check(
  won.status === 200 && won.json.probability === 100,
  'Won stage enforces 100% probability',
);
const activity = await request('/api/crm/activities', 'POST', {
  title: 'HTTP follow-up',
  contactId: contact.json.id,
  dealId: deal.json.id,
});
const completed = await request(
  '/api/crm/activities/' + activity.json.id,
  'PATCH',
  { status: 'completed' },
);
check(
  completed.status === 200 && completed.json.completedAt,
  'Activity completion timestamp',
);
const rep = client();
await login(rep, 'james@northstar.example');
await rep('/api/organizations/switch', 'POST', {
  organizationId: 'demo-northstar',
});
check(
  (await rep('/api/crm/contacts/' + contact.json.id)).status === 404,
  'Sales rep cannot read admin-owned contact',
);
check(
  (await rep('/api/billing/checkout', 'POST', { tier: 'pro', seats: 3 }))
    .status === 403,
  'Non-admin billing denied',
);
await request('/api/organizations/switch', 'POST', {
  organizationId: 'demo-ventures',
});
check(
  (await request('/api/crm/contacts/' + contact.json.id)).status === 404,
  'Organization switching enforces tenant isolation',
);
await request('/api/organizations/switch', 'POST', {
  organizationId: 'demo-northstar',
});
const csv = `name,email,company\nNew import,new-${Date.now()}@example.test,Test\nExisting,${email},Test`;
const countBefore = (await request('/api/crm/bootstrap')).json.contacts.length;
check(
  (await request('/api/contacts/import', 'POST', { csv })).status === 409,
  'CSV duplicate import rejected atomically',
);
check(
  (await request('/api/crm/bootstrap')).json.contacts.length === countBefore,
  'No partial CSV rows written',
);
check(
  (
    await request('/api/ai', 'POST', {
      action: 'assistant',
      prompt: 'Show my deals',
    })
  ).status === 503,
  'Missing Claude configuration fails clearly',
);
check(
  (await request('/api/jobs')).status === 401,
  'Unauthenticated scheduled job denied',
);
await request('/api/crm/contacts/' + contact.json.id, 'DELETE');
check(
  (await request('/api/crm/deals/' + deal.json.id)).json.contactId === null,
  'Deleting contact unlinks preserved deals',
);
await request('/api/crm/activities/' + activity.json.id, 'DELETE');
await request('/api/crm/deals/' + deal.json.id, 'DELETE');
console.log(`${checks} HTTP checks passed.`);
