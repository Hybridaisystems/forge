// Anthropic API proxy — keeps API key server-side
export async function handler(event) {
  if(event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
  if(!ANTHROPIC_KEY) return { statusCode: 500, body: 'API key not configured' };
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
    const data = await resp.json();
    return {
      statusCode: resp.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data)
    };
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
}
