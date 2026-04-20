// Background function: can run up to 15 minutes, returns 202 immediately.
// Reads job_id from body, runs the parts search (Sonnet + web_search), writes
// the result/error back to the parts_search_jobs row. Client polls that row.

export async function handler(event) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, ANTHROPIC_KEY } = process.env;

  if(!SUPABASE_URL || !SUPABASE_ANON_KEY || !ANTHROPIC_KEY) {
    console.error('parts-search-background: missing env vars', {
      hasSupabaseUrl: !!SUPABASE_URL,
      hasSupabaseKey: !!SUPABASE_ANON_KEY,
      hasAnthropicKey: !!ANTHROPIC_KEY
    });
    return;
  }

  let jobId;
  try {
    jobId = JSON.parse(event.body || '{}').job_id;
  } catch(e) {
    console.error('parts-search-background: bad body', e);
    return;
  }
  if(!jobId) { console.error('parts-search-background: missing job_id'); return; }

  const sbHeaders = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  };
  const jobsUrl = `${SUPABASE_URL}/rest/v1/parts_search_jobs`;

  const updateJob = (fields) => fetch(`${jobsUrl}?id=eq.${jobId}`, {
    method: 'PATCH',
    headers: sbHeaders,
    body: JSON.stringify(fields)
  });

  try {
    const jobResp = await fetch(`${jobsUrl}?id=eq.${jobId}&select=requirements,category`, { headers: sbHeaders });
    if(!jobResp.ok) throw new Error(`Supabase fetch job ${jobResp.status}`);
    const [job] = await jobResp.json();
    if(!job) { console.error('parts-search-background: job not found', jobId); return; }

    await updateJob({ status: 'running' });

    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        messages: [{
          role: 'user',
          content: `Search Digikey, Mouser, McMaster-Carr, and RS Components for real parts matching these requirements: ${job.requirements}\nCategory: ${job.category || 'any'}\n\nReturn ONLY a JSON array of up to 8 real parts with actual part numbers and prices:\n[{"name":"","part_number":"","supplier":"","supplier_url":"","price_single":0,"price_100":0,"price_1000":0,"in_stock":true,"lead_time":"","description":"","datasheet_url":"","specs":{}}]`
        }]
      })
    });

    if(!anthropicResp.ok) {
      const body = await anthropicResp.text();
      console.error('parts-search-background upstream', anthropicResp.status, body.slice(0, 500));
      await updateJob({
        status: 'error',
        error: `Anthropic ${anthropicResp.status}: ${body.slice(0, 300)}`,
        completed_at: new Date().toISOString()
      });
      return;
    }

    const data = await anthropicResp.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const start = text.indexOf('['), end = text.lastIndexOf(']');
    let parts = [];
    if(start > -1 && end > start) {
      try { parts = JSON.parse(text.slice(start, end + 1)); } catch(e) { console.warn('JSON parse failed, returning empty', e.message); }
    }

    await updateJob({ status: 'done', result: parts, completed_at: new Date().toISOString() });

  } catch(e) {
    console.error('parts-search-background exception', e);
    try {
      await updateJob({ status: 'error', error: e.message, completed_at: new Date().toISOString() });
    } catch(ignored) {}
  }
}
