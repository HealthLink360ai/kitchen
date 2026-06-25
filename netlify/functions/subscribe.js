const crypto = require('crypto');

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function getSubscriberHash(email) {
  return crypto.createHash('md5').update(String(email).trim().toLowerCase()).digest('hex');
}

function getConfig() {
  return {
    apiKey: process.env.MAILCHIMP_API_KEY,
    audienceId: process.env.MAILCHIMP_AUDIENCE_ID,
    dc: process.env.MAILCHIMP_DC
  };
}

async function postMailchimpEvent({ email, name, properties }) {
  const { apiKey, audienceId, dc } = getConfig();
  const subscriberHash = getSubscriberHash(email);
  const url = `https://${dc}.api.mailchimp.com/3.0/lists/${audienceId}/members/${subscriberHash}/events`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `apikey ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      properties,
      is_syncing: false
    })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    console.log('Mailchimp event error:', response.status, JSON.stringify(data));
  }
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { email, first, last, waitlist, attribution, visitor } = payload;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { error: 'A valid email is required' });
  }

  const { apiKey, audienceId, dc } = getConfig();

  if (!apiKey || !audienceId || !dc) {
    return json(500, { error: 'Mailchimp is not configured' });
  }

  const subscriberHash = getSubscriberHash(email);
  const url = `https://${dc}.api.mailchimp.com/3.0/lists/${audienceId}/members/${subscriberHash}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `apikey ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email_address: email,
      status: 'subscribed',
      merge_fields: { FNAME: first || '', LNAME: last || '' },
      tags: ['The Kitchen', waitlist ? 'Kitchen Waitlist' : 'Kitchen Access']
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.log('Mailchimp subscribe error:', response.status, JSON.stringify(data));
    return json(400, { error: data.detail || 'Subscription failed' });
  }

  await postMailchimpEvent({
    email,
    name: 'kitchen_signup',
    properties: {
      first_name: first || '',
      last_name: last || '',
      waitlist: Boolean(waitlist),
      attribution: attribution || {},
      visitor: visitor || {},
      captured_at: new Date().toISOString()
    }
  });

  return json(200, { success: true });
};
