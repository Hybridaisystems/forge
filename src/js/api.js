// ── FORGE API WRAPPER ─────────────────────────────────────────────────────────
// All Anthropic calls go through here with retry + rate limit handling

export async function forgeAI(body, maxRetries = 4) {
  let delay = 8000;
  for(let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const resp = await fetch('/.netlify/functions/anthropic-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if(resp.status === 429) {
        const retryAfter = parseInt(resp.headers.get('retry-after') || '0') * 1000;
        const wait = retryAfter || delay;
        console.warn(`Rate limited — waiting ${Math.round(wait/1000)}s`);
        await sleep(wait);
        delay = Math.min(delay * 1.5, 60000);
        continue;
      }
      if(resp.status === 504 || resp.status === 502) {
        throw new Error('Generation timed out — the model took too long to respond. Try a shorter description or simpler constraints.');
      }
      const raw = await resp.text();
      let data;
      try { data = JSON.parse(raw); }
      catch { throw new Error(raw || `Proxy returned ${resp.status}`); }
      if(data.error) throw new Error(data.error.message || data.error || 'API error');
      return data;
    } catch(e) {
      const msg = e && e.message ? e.message : String(e);
      if(msg.includes('timed out')) throw e;
      if(attempt === maxRetries - 1) throw e;
      await sleep(delay);
      delay = Math.min(delay * 1.5, 60000);
    }
  }
  throw new Error('API failed after ' + maxRetries + ' retries');
}

export async function forgeImage(prompt, size = '1024x1024') {
  const resp = await fetch('/.netlify/functions/image-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, size, quality: 'hd' })
  });
  const data = await resp.json();
  if(data.error) throw new Error(data.error.message);
  return data.data?.[0]?.url || null;
}

export async function forgeParts(requirements, category) {
  const resp = await fetch('/.netlify/functions/parts-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requirements, category })
  });
  if(resp.status === 504 || resp.status === 502) {
    throw new Error('Parts search timed out — the supplier search took too long. Try narrower requirements.');
  }
  const raw = await resp.text();
  let data;
  try { data = JSON.parse(raw); }
  catch { throw new Error(raw || `Parts search returned ${resp.status}`); }
  return data.parts || [];
}

export function extractText(data) {
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

export function extractJSON(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{') > -1 ? clean.indexOf('{') : clean.indexOf('[');
  const end   = clean.lastIndexOf('}') > clean.lastIndexOf(']') ? clean.lastIndexOf('}') : clean.lastIndexOf(']');
  if(start === -1 || end === -1) return null;
  try { return JSON.parse(clean.slice(start, end + 1)); } catch(e) { return null; }
}

export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

window.forgeAI    = forgeAI;
window.forgeImage = forgeImage;
window.forgeParts = forgeParts;
