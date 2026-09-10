function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch (_) { return json(400, { error: 'Invalid JSON body' }); }
  const email = String(payload.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'A valid email is required' });
  if (payload.waitlist !== true) return json(400, { error: 'A Kitchen subscription is required for recipe access' });

  const apiKey = process.env.BREVO_API_KEY;
  const listId = Number(process.env.BREVO_KITCHEN_LIST_ID);
  if (!apiKey || !Number.isInteger(listId)) return json(500, { error: 'Brevo is not configured' });
  const response = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'api-key': apiKey, accept: 'application/json' },
    body: JSON.stringify({ email, updateEnabled: true, listIds: [listId], attributes: {
      FIRSTNAME: String(payload.first || '').trim().slice(0, 80),
      LASTNAME: String(payload.last || '').trim().slice(0, 80),
      SOURCE: 'HealthLink360 Kitchen', LAST_RECIPE: 'Marinated Tomatoes and Charred Okra Over Polenta'
    } })
  });
  if (!response.ok) return json(400, { error: 'Subscription could not be completed' });
  return json(200, { success: true });
};
