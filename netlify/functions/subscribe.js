exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { email, first, last } = JSON.parse(event.body);

  const API_KEY = process.env.MAILCHIMP_API_KEY;
  const AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID;
  const DC = process.env.MAILCHIMP_DC;

  console.log('DC:', DC, 'AUDIENCE_ID:', AUDIENCE_ID, 'API_KEY set:', !!API_KEY);

  const url = `https://${DC}.api.mailchimp.com/3.0/lists/${AUDIENCE_ID}/members`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `apikey ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email_address: email,
      status: 'subscribed',
      merge_fields: { FNAME: first, LNAME: last },
      tags: ['The Kitchen']
    })
  });

  const data = await response.json();
  console.log('Mailchimp response:', JSON.stringify(data));

  if (response.ok || data.title === 'Member Exists') {
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  return { statusCode: 400, body: JSON.stringify({ error: data.detail || 'Subscription failed' }) };
};
