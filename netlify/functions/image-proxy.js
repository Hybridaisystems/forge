// Image generation proxy (supports multiple providers)
export async function handler(event) {
  if(event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  const OPENAI_KEY = process.env.OPENAI_KEY;
  if(!OPENAI_KEY) return { statusCode: 500, body: 'Image API key not configured' };
  try {
    const { prompt, size = '1024x1024', quality = 'standard' } = JSON.parse(event.body);
    const resp = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENAI_KEY },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size, quality, response_format: 'url' })
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
