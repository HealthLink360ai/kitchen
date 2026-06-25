const crypto = require('crypto');

const ALLOWED_EVENTS = new Set([
  'hl360_page_view',
  'hl360_cta_click',
  'hl360_waitlist_click',
  'hl360_checkout_start',
  'hl360_checkout_redirect',
  'hl360_checkout_error',
  'hl360_checkout_success',
  'kitchen_login',
  'kitchen_page_view',
  'kitchen_vote',
  'kitchen_suggestion',
  'kitchen_recipe_tab',
  'kitchen_cta_click',
  'kitchen_logout'
]);

function getCorsHeaders(event) {
  const allowedOrigins = new Set([
    'https://healthlink360.ai',
    'https://www.healthlink360.ai',
    'https://kitchen.healthlink360.ai',
    'https://live.healthlink360.ai'
  ]);
  const origin = event.headers.origin || event.headers.Origin || '';
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://www.healthlink360.ai',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function corsJson(event, statusCode, body) {
  return {
    statusCode,
    headers: getCorsHeaders(event),
    body: JSON.stringify(body)
  };
}

function getSubscriberHash(email) {
  return crypto.createHash('md5').update(String(email).trim().toLowerCase()).digest('hex');
}

function cleanProperties(value, depth = 0) {
  if (depth > 3 || value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => cleanProperties(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => typeof key === 'string' && key.length <= 64)
        .slice(0, 40)
        .map(([key, val]) => [key, cleanProperties(val, depth + 1)])
    );
  }
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value).slice(0, 500);
}

async function capturePostHog({ distinctId, eventName, properties }) {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) return;

  const host = process.env.POSTHOG_HOST || 'https://app.posthog.com';
  const response = await fetch(`${host.replace(/\/$/, '')}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      distinct_id: distinctId,
      event: eventName,
      properties
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.log('PostHog capture error:', response.status, text.slice(0, 500));
  }
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: getCorsHeaders(event), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return corsJson(event, 405, { error: 'Method Not Allowed' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return corsJson(event, 400, { error: 'Invalid JSON body' });
  }

  const email = String(payload.email || '').trim().toLowerCase();
  const visitorId = String(payload.visitorId || payload.visitor_id || '').trim();
  const eventName = String(payload.eventName || '');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return corsJson(event, 400, { error: 'Email is invalid' });
  }
  if (!email && !visitorId) {
    return corsJson(event, 400, { error: 'A visitor ID or email is required' });
  }
  if (!ALLOWED_EVENTS.has(eventName)) {
    return corsJson(event, 400, { error: 'Unsupported event name' });
  }

  const properties = cleanProperties({
    ...(payload.properties || {}),
    visitor_id: visitorId || undefined,
    captured_at: new Date().toISOString()
  });
  await capturePostHog({
    distinctId: email || visitorId,
    eventName,
    properties
  });

  if (!email) {
    return corsJson(event, 200, { success: true });
  }

  const apiKey = process.env.MAILCHIMP_API_KEY;
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
  const dc = process.env.MAILCHIMP_DC;
  if (!apiKey || !audienceId || !dc) {
    return corsJson(event, 200, { success: true, contactEventSkipped: true });
  }

  const url = `https://${dc}.api.mailchimp.com/3.0/lists/${audienceId}/members/${getSubscriberHash(email)}/events`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `apikey ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: eventName,
      properties,
      is_syncing: false
    })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    console.log('Mailchimp track error:', response.status, JSON.stringify(data));
    return corsJson(event, 400, { error: data.detail || 'Tracking failed' });
  }

  return corsJson(event, 200, { success: true });
};
