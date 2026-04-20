// ── FORGE API WRAPPER ─────────────────────────────────────────────────────────
// All Anthropic calls go through here with retry + rate limit handling
import { supabaseInsert, supabaseSelectOne, supabaseReady } from './supabase.js';

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

// Parts search runs as a Netlify Background Function (up to 15 min) so it can
// use Sonnet + web_search without hitting sync timeouts. The flow:
//   1. Insert a row into parts_search_jobs (status=pending)
//   2. Fire-and-forget POST to parts-search-background with the job_id
//   3. Poll the row every 2s until status=done or error
export async function forgeParts(requirements, category, { onProgress } = {}) {
  if(!supabaseReady()) throw new Error('Supabase not configured — set SUPABASE_URL and SUPABASE_ANON_KEY env vars');

  const job = await supabaseInsert('parts_search_jobs', { requirements, category: category || null, status: 'pending' });
  if(onProgress) onProgress('queued');

  fetch('/.netlify/functions/parts-search-background', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: job.id })
  }).catch(e => console.warn('background kick-off fetch failed (function may still run)', e));

  const MAX_WAIT_MS = 180_000;
  const POLL_MS = 2000;
  const startedAt = Date.now();
  let lastStatus = 'pending';

  while(Date.now() - startedAt < MAX_WAIT_MS) {
    await sleep(POLL_MS);
    const row = await supabaseSelectOne('parts_search_jobs', job.id);
    if(!row) continue;
    if(row.status !== lastStatus) {
      lastStatus = row.status;
      if(onProgress) onProgress(row.status);
    }
    if(row.status === 'done') return row.result || [];
    if(row.status === 'error') throw new Error(row.error || 'Parts search failed');
  }
  throw new Error('Parts search timed out after 3 minutes');
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
