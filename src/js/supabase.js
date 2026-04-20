// ── FORGE — Supabase REST client ──────────────────────────────────────────────
// Tiny fetch wrapper. No SDK dependency — we only need insert/select/patch.

const URL = __SUPABASE_URL__;
const KEY = __SUPABASE_ANON_KEY__;

function headers(extra = {}) {
  return {
    'apikey': KEY,
    'Authorization': `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

export function supabaseReady() { return !!URL && !!KEY; }

export async function supabaseInsert(table, row) {
  if(!supabaseReady()) throw new Error('Supabase not configured — check SUPABASE_URL / SUPABASE_ANON_KEY env vars');
  const resp = await fetch(`${URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(row)
  });
  if(!resp.ok) throw new Error(`Supabase insert ${table}: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return data[0];
}

export async function supabaseSelectOne(table, id) {
  if(!supabaseReady()) throw new Error('Supabase not configured');
  const resp = await fetch(`${URL}/rest/v1/${table}?id=eq.${id}&select=*`, { headers: headers() });
  if(!resp.ok) throw new Error(`Supabase select ${table}: ${resp.status}`);
  const data = await resp.json();
  return data[0] || null;
}

export const supabase = { insert: supabaseInsert, selectOne: supabaseSelectOne, ready: supabaseReady };
window.forgeSupabase = supabase;
