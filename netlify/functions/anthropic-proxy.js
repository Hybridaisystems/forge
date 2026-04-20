// Anthropic API proxy — keeps API key server-side
const JSON_HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

export async function handler(event) {
  if(event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: { message: 'Method not allowed' } }) };
  }
  const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
  if(!ANTHROPIC_KEY) {
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: { message: 'API key not configured' } }) };
  }
  try {
    const body = JSON.parse(event.body);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });
    const raw = await resp.text();
    if(resp.status >= 400) console.error('Anthropic upstream error', resp.status, raw.slice(0, 500));
    return { statusCode: resp.status, headers: JSON_HEADERS, body: raw };
  } catch(e) {
    console.error('anthropic-proxy exception', e);
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: { message: e.message } }) };
  }
}
