// Parts search proxy — uses Claude + web_search to find real parts
const JSON_HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

export async function handler(event) {
  if(event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method not allowed', parts: [] }) };
  }
  const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
  if(!ANTHROPIC_KEY) {
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'API key not configured', parts: [] }) };
  }
  try {
    const { requirements, category } = JSON.parse(event.body);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
        messages: [{
          role: 'user',
          content: `Search Digikey, Mouser, McMaster-Carr, and RS Components for real parts matching these requirements: ${requirements}\nCategory: ${category}\n\nReturn ONLY a JSON array of up to 8 parts:\n[{"name":"","part_number":"","supplier":"","supplier_url":"","price_single":0,"price_100":0,"price_1000":0,"in_stock":true,"lead_time":"","description":"","datasheet_url":"","specs":{}}]`
        }]
      })
    });
    const raw = await resp.text();
    if(resp.status >= 400) {
      console.error('parts-search upstream error', resp.status, raw.slice(0, 500));
      return { statusCode: resp.status, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Upstream error', parts: [] }) };
    }
    const data = JSON.parse(raw);
    const text = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
    const start = text.indexOf('['), end = text.lastIndexOf(']');
    let parts = [];
    if(start > -1 && end > start) {
      try { parts = JSON.parse(text.slice(start, end + 1)); } catch { parts = []; }
    }
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ parts }) };
  } catch(e) {
    console.error('parts-search exception', e);
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: e.message, parts: [] }) };
  }
}
