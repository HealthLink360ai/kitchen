const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const ALLOWED_EVENTS = new Set([
  'hl360_page_view', 'hl360_cta_click', 'hl360_waitlist_click',
  'hl360_checkout_start', 'hl360_checkout_redirect', 'hl360_checkout_error',
  'hl360_checkout_success', 'kitchen_login', 'kitchen_page_view', 'kitchen_vote',
  'kitchen_suggestion', 'kitchen_recipe_tab', 'kitchen_cta_click', 'kitchen_logout',
  'kitchen_meal_reveal', 'kitchen_meal_open'
]);

function reply(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}
function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function clean(value, depth = 0) {
  if (depth > 3 || value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => clean(item, depth + 1));
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 40).map(([key, val]) => [String(key).slice(0, 64), clean(val, depth + 1)]));
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value).slice(0, 500);
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method Not Allowed' });
  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch (_) { return reply(400, { error: 'Invalid JSON body' }); }
  const eventName = String(payload.eventName || '');
  if (!ALLOWED_EVENTS.has(eventName)) return reply(400, { error: 'Unsupported event name' });
  const email = String(payload.email || '').trim().toLowerCase();
  const visitorId = String(payload.visitorId || payload.visitor_id || '').trim();
  if (!email && !visitorId) return reply(400, { error: 'A visitor ID or email is required' });

  const now = new Date();
  const subject = email ? `email:${digest(email)}` : `visitor:${digest(visitorId)}`;
  const key = `${now.toISOString().slice(0, 10)}/${eventName}/${now.getTime()}-${crypto.randomBytes(5).toString('hex')}`;
  await getStore('kitchen-engagement').setJSON(key, {
    event: eventName,
    subject,
    properties: clean(payload.properties || {}),
    captured_at: now.toISOString()
  });
  return reply(200, { success: true });
};
