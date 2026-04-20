// Parts search proxy — searches supplier APIs and web
export async function handler(event) {
  if(event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
  try {
    const { requirements, category } = JSON.parse(event.body);
    // Use Claude with web search to find real parts
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Search Digikey, Mouser, McMaster-Carr, and RS Components for real parts matching these requirements: ${requirements}\nCategory: ${category}\n\nReturn ONLY a JSON array of parts:\n[{"name":"","part_number":"","supplier":"","supplier_url":"","price_single":0,"price_100":0,"price_1000":0,"in_stock":true,"lead_time":"","description":"","datasheet_url":"","specs":{}}]`
        }]
      })
    });
    const data = await resp.json();
    const text = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
    const start = text.indexOf('['), end = text.lastIndexOf(']');
    const parts = start > -1 ? JSON.parse(text.slice(start, end+1)) : [];
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ parts })
    };
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message, parts: [] }) };
  }
}
