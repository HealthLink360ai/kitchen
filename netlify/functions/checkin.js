const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const EVENTS = {
  'dhs-2026-09-18': { agency: 'DHS', name: 'Chat & Chew: Food', date: '2026-09-18' },
  'mpd-2026-09-19': { agency: 'MPD', name: 'Chat & Chew', date: '2026-09-19' },
  'osse-2026-09-29': { agency: 'OSSE', name: 'Chat, Chew & Sip', date: '2026-09-29' },
  'dhs-2026-10-02': { agency: 'DHS', name: 'Chat & Chew', date: '2026-10-02' },
  'osse-2026-11-03': { agency: 'OSSE', name: 'Cooking Demo · Diabetic Friendly', date: '2026-11-03' },
  'dhs-2026-12-08': { agency: 'DHS', name: 'Chat & Chew: Food', date: '2026-12-08' }
};

function reply(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

async function capturePostHog(email, properties) {
  if (!process.env.POSTHOG_API_KEY) return;
  const host = (process.env.POSTHOG_HOST || 'https://app.posthog.com').replace(/\/$/, '');
  await fetch(`${host}/capture/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    api_key: process.env.POSTHOG_API_KEY, distinct_id: email, event: 'kitchen_event_checkin', properties
  }) }).catch(() => {});
}

async function subscribeBrevo({ email, first, last, eventId, eventInfo }) {
  const apiKey = process.env.BREVO_API_KEY;
  const listId = Number(process.env.BREVO_KITCHEN_LIST_ID);
  if (!apiKey || !Number.isInteger(listId)) throw new Error('Brevo is not configured');
  const response = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey, accept: 'application/json' },
    body: JSON.stringify({ email, updateEnabled: true, listIds: [listId], attributes: {
      FIRSTNAME: first, LASTNAME: last, SOURCE: 'Chat & Chew QR', AGENCY: eventInfo.agency,
      EVENT_ID: eventId, EVENT_DATE: eventInfo.date, LAST_RECIPE: 'Marinated Tomatoes and Charred Okra Over Polenta'
    } })
  });
  if (!response.ok) throw new Error('Subscription could not be completed');
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method Not Allowed' });
  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch (_) { return reply(400, { error: 'Invalid request' }); }
  const eventInfo = EVENTS[String(payload.eventId || '')];
  const email = String(payload.email || '').trim().toLowerCase();
  const first = String(payload.first || '').trim().slice(0, 80);
  const last = String(payload.last || '').trim().slice(0, 80);
  if (!eventInfo) return reply(400, { error: 'This event code is not valid.' });
  if (!first || !last || !validEmail(email)) return reply(400, { error: 'Name and a valid email are required.' });
  if (payload.updates !== true) return reply(400, { error: 'A Kitchen subscription is required to unlock the recipes.' });

  const key = `${payload.eventId}/${hash(email)}`;
  const store = getStore('chat-chew-checkins');
  const existing = await store.get(key, { type: 'json' });
  if (existing) return reply(200, { success: true, duplicate: true });

  try { await subscribeBrevo({ email, first, last, eventId: payload.eventId, eventInfo }); }
  catch (_) { return reply(502, { error: 'We could not complete your Kitchen subscription. Please try again.' }); }

  const record = { event_id: payload.eventId, event_name: eventInfo.name, agency: eventInfo.agency, event_date: eventInfo.date,
    first, last, email, marketing_opt_in: Boolean(payload.updates), source: 'event_qr', checked_in_at: new Date().toISOString() };
  await store.setJSON(key, record);
  await capturePostHog(email, { event_id: payload.eventId, agency: eventInfo.agency, event_date: eventInfo.date, source: 'event_qr' });
  return reply(200, { success: true, duplicate: false });
};
