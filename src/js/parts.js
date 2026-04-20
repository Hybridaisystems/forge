// ── PARTS SEARCH & BOM ────────────────────────────────────────────────────────
import { state } from './state.js';
import { forgeParts, forgeAI, extractText, extractJSON } from './api.js';

export function render(project) {
  const el = document.getElementById('tab-parts');
  if(!el) return;
  const parts = project.parts || [];

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 300px;gap:16px;max-width:1100px">

      <!-- Left: Search + results -->
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="section-title" style="margin:0">Parts Search</div>
          <button class="btn-primary btn-sm" onclick="forge.parts.autoSearch()" id="auto-search-btn">🔍 Auto-Search All Parts</button>
        </div>

        <!-- Manual search -->
        <div class="card" style="margin-bottom:14px">
          <div class="card-title">Search for a specific part</div>
          <div style="display:flex;gap:8px;margin-bottom:10px">
            <input class="f-input" id="parts-query" placeholder="e.g. 12V DC motor 50Nm, M3 stainless hex bolt, ESP32 microcontroller" style="flex:1"/>
            <select class="f-input f-select" id="parts-category" style="width:160px">
              <option>Electronic components</option>
              <option>Motors & actuators</option>
              <option>Mechanical fasteners</option>
              <option>Enclosures & housings</option>
              <option>Sensors</option>
              <option>Power supplies</option>
              <option>Structural / raw material</option>
              <option>Cables & connectors</option>
              <option>Other</option>
            </select>
            <button class="btn-primary btn-sm" onclick="forge.parts.search()">Search →</button>
          </div>
        </div>

        <!-- Progress -->
        <div id="parts-progress" style="display:none;margin-bottom:12px">
          <div class="progress-bar"><div class="progress-fill" id="parts-bar" style="width:0%"></div></div>
          <div class="progress-msg" id="parts-msg">Searching suppliers...</div>
        </div>

        <!-- Results -->
        <div id="parts-results"></div>
      </div>

      <!-- Right: BOM -->
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="section-title" style="margin:0">Bill of Materials</div>
          ${parts.length ? `<button class="btn-ghost btn-sm" onclick="forge.parts.exportBOM()">📄 Export</button>` : ''}
        </div>

        ${parts.length ? `
          ${parts.map((p, i) => `
            <div class="card" style="margin-bottom:6px;padding:10px">
              <div style="display:flex;align-items:flex-start;justify-content:space-between">
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:700;margin-bottom:2px">${p.name}</div>
                  <div style="font-size:10px;color:var(--muted)">${p.part_number || ''} · ${p.supplier || ''}</div>
                  <div style="font-size:12px;color:var(--green);font-weight:700;margin-top:3px">$${p.price_single || '?'}</div>
                </div>
                <button onclick="forge.parts.removePart(${i})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px">✕</button>
              </div>
              ${p.supplier_url ? `<a href="${p.supplier_url}" target="_blank" style="font-size:10px;color:var(--blue-light);text-decoration:none">View on supplier →</a>` : ''}
            </div>
          `).join('')}
          <div class="card" style="background:var(--blue-dim);border-color:rgba(37,99,235,0.3)">
            <div style="font-size:12px;font-weight:700">Estimated total (1 unit)</div>
            <div style="font-size:20px;font-weight:800;color:var(--blue-light)">
              $${parts.reduce((s, p) => s + (parseFloat(p.price_single) || 0), 0).toFixed(2)}
            </div>
          </div>
        ` : `
          <div class="empty-state" style="padding:24px">
            <div class="empty-icon" style="font-size:28px">📦</div>
            <div class="empty-title" style="font-size:13px">BOM is empty</div>
            <div class="empty-desc" style="font-size:11px">Search for parts and add them here</div>
          </div>
        `}
      </div>
    </div>
  `;
}

export async function search() {
  const query    = document.getElementById('parts-query')?.value.trim();
  const category = document.getElementById('parts-category')?.value || '';
  if(!query) { forgeToast('Describe the part you need', 'error'); return; }

  const prog = document.getElementById('parts-progress');
  const bar  = document.getElementById('parts-bar');
  const msg  = document.getElementById('parts-msg');
  if(prog) prog.style.display = 'block';

  const setP = (p, m) => { if(bar) bar.style.width=p+'%'; if(msg) msg.textContent=m; };
  setP(20, '🔍 Searching Digikey, Mouser, McMaster-Carr...');

  try {
    const parts = await forgeParts(query, category);
    setP(100, `✓ Found ${parts.length} parts`);
    setTimeout(() => { if(prog) prog.style.display='none'; }, 500);
    renderResults(parts);
  } catch(e) {
    forgeToast('Parts search failed: ' + e.message, 'error');
    if(prog) prog.style.display = 'none';
  }
}

function renderResults(parts) {
  const el = document.getElementById('parts-results');
  if(!el) return;

  if(!parts.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">No parts found</div><div class="empty-desc">Try a different search term or category</div></div>';
    return;
  }

  el.innerHTML = `
    <div class="section-title">${parts.length} parts found</div>
    ${parts.map((p, i) => `
      <div class="part-card" id="part-result-${i}">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <div style="font-size:13px;font-weight:700">${p.name}</div>
            <span class="part-badge ${p.in_stock?'stock':'lead'}">${p.in_stock?'In Stock':p.lead_time||'Lead time'}</span>
          </div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:6px">${p.part_number || ''} · ${p.supplier || ''}</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:8px">${p.description || ''}</div>
          <div style="display:flex;gap:16px;margin-bottom:8px">
            <div><div style="font-size:10px;color:var(--muted)">1 unit</div><div style="font-size:14px;font-weight:700;color:var(--text)">$${p.price_single || '?'}</div></div>
            ${p.price_100 ? `<div><div style="font-size:10px;color:var(--muted)">×100</div><div style="font-size:13px;font-weight:600;color:var(--green)">$${p.price_100}</div></div>` : ''}
            ${p.price_1000 ? `<div><div style="font-size:10px;color:var(--muted)">×1000</div><div style="font-size:13px;font-weight:600;color:var(--green)">$${p.price_1000}</div></div>` : ''}
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn-primary btn-sm" onclick="forge.parts.addToBOM(${i})">+ Add to BOM</button>
            ${p.supplier_url ? `<a href="${p.supplier_url}" target="_blank" class="btn-ghost btn-sm" style="text-decoration:none;display:inline-flex;align-items:center">View →</a>` : ''}
            ${p.datasheet_url ? `<a href="${p.datasheet_url}" target="_blank" class="btn-ghost btn-sm" style="text-decoration:none;display:inline-flex;align-items:center">Datasheet</a>` : ''}
          </div>
        </div>
      </div>
    `).join('')}
  `;

  // Store results for addToBOM
  window._partsSearchResults = parts;
}

export function addToBOM(resultIdx) {
  const part = window._partsSearchResults?.[resultIdx];
  if(!part || !state.currentProject) return;
  state.currentProject.parts = state.currentProject.parts || [];
  state.currentProject.parts.push(part);
  render(state.currentProject);
  forgeToast(part.name + ' added to BOM ✓', 'success');
}

export function removePart(idx) {
  if(!state.currentProject) return;
  state.currentProject.parts.splice(idx, 1);
  render(state.currentProject);
}

export async function autoSearch() {
  const project = state.currentProject;
  if(!project) return;

  const btn = document.getElementById('auto-search-btn');
  if(btn) { btn.disabled = true; btn.textContent = '⏳ Searching...'; }

  try {
    // Ask Claude to identify required parts categories from the brief
    const data = await forgeAI({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `For this product: "${project.description}"\nBrief: ${JSON.stringify(project.brief)}\nConstraints: ${JSON.stringify(project.constraints)}\n\nList the 4-5 most critical parts categories to search for. Return ONLY JSON:\n{"searches":[{"query":"specific search term for this part","category":"category name"}]}`
      }]
    });
    const parsed = extractJSON(extractText(data));
    const searches = parsed?.searches || [];

    forgeToast(`Running ${searches.length} automated parts searches...`, 'info');

    // Run searches sequentially
    const allParts = [];
    for(let i = 0; i < searches.length; i++) {
      const s = searches[i];
      const parts = await forgeParts(s.query, s.category);
      allParts.push(...parts.slice(0, 2)); // top 2 from each search
    }

    renderResults(allParts);
    if(btn) { btn.disabled = false; btn.textContent = '🔍 Auto-Search All Parts'; }

  } catch(e) {
    forgeToast('Auto-search failed: ' + e.message, 'error');
    if(btn) { btn.disabled = false; btn.textContent = '🔍 Auto-Search All Parts'; }
  }
}

export function exportBOM() {
  const project = state.currentProject;
  if(!project?.parts?.length) return;
  const rows = [['Name','Part Number','Supplier','Price (1)','Price (100)','Price (1000)','In Stock','Datasheet']];
  project.parts.forEach(p => rows.push([p.name, p.part_number||'', p.supplier||'', p.price_single||'', p.price_100||'', p.price_1000||'', p.in_stock?'Yes':'No', p.datasheet_url||'']));
  const csv = rows.map(r => r.map(v => '"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (project.name||'project').replace(/\s+/g,'-').toLowerCase() + '-bom.csv';
  a.click();
}

export const parts = { render, search, addToBOM, removePart, autoSearch, exportBOM };
window.forge = window.forge || {};
window.forge.parts = parts;
