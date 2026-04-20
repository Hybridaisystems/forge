// ── ENGINEERING DRAWINGS ──────────────────────────────────────────────────────
import { state } from './state.js';
import { forgeAI, extractText, extractJSON } from './api.js';

export function render(project) {
  const el = document.getElementById('tab-drawings');
  if(!el) return;
  const drawings = project.drawings || [];

  el.innerHTML = `
    <div style="max-width:1000px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div class="section-title" style="margin:0">Engineering Drawings</div>
        <div style="display:flex;gap:8px">
          <button class="btn-primary btn-sm" onclick="forge.drawings.generate()" id="gen-drawing-btn">📐 Generate Drawings</button>
          ${drawings.length ? `<button class="btn-ghost btn-sm" onclick="forge.drawings.exportPDF()">⬇ Export PDF</button>` : ''}
        </div>
      </div>

      <div id="drawings-progress" style="display:none;margin-bottom:12px">
        <div class="progress-bar"><div class="progress-fill" id="drawings-bar" style="width:0%"></div></div>
        <div class="progress-msg" id="drawings-msg">Generating drawings...</div>
      </div>

      ${drawings.length ? `
        <!-- Drawing tabs -->
        <div style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:16px">
          ${drawings.map((d, i) => `<button class="render-tool ${i===0?'active':''}" onclick="forge.drawings.showDrawing(${i})" id="dtab-${i}">${d.name}</button>`).join('')}
        </div>
        <div id="drawing-viewer">${renderSVGDrawing(drawings[0])}</div>
      ` : `
        <div class="empty-state">
          <div class="empty-icon">📐</div>
          <div class="empty-title">No drawings yet</div>
          <div class="empty-desc">Click Generate Drawings to create dimensioned engineering drawings from your design brief and parts list.</div>
        </div>
      `}
    </div>
  `;
}

export async function generate() {
  const project = state.currentProject;
  if(!project) return;

  const btn  = document.getElementById('gen-drawing-btn');
  const prog = document.getElementById('drawings-progress');
  const bar  = document.getElementById('drawings-bar');
  const msg  = document.getElementById('drawings-msg');

  if(btn) { btn.disabled = true; btn.textContent = '⏳ Generating...'; }
  if(prog) prog.style.display = 'block';

  const setP = (p, m) => { if(bar) bar.style.width=p+'%'; if(msg) msg.textContent=m; };

  try {
    setP(20, '🧠 Analysing design for drawing generation...');

    const brief = project.brief || {};
    const parts = project.parts || [];
    const c = project.constraints || {};

    const data = await forgeAI({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are an engineering drafter. Generate dimensioned drawing specifications for this product.\n\n` +
          `Product: ${project.description}\n` +
          `Brief: ${JSON.stringify(brief)}\n` +
          `Size constraints: ${c.size || 'Not specified'}\n` +
          `Weight: ${c.weight || 'Not specified'}\n` +
          `Parts: ${parts.map(p=>p.name).join(', ') || 'Not yet determined'}\n\n` +
          `Generate drawing data for: Front view, Side view, Top view, and one Section view.\n\n` +
          `Return ONLY JSON:\n` +
          `{"drawings":[\n` +
          `  {"name":"Front View","view":"front","width_mm":200,"height_mm":150,"features":["list of geometric features with dimensions"],"notes":["manufacturing notes"]},\n` +
          `  {"name":"Side View","view":"side","width_mm":100,"height_mm":150,"features":["list"],"notes":[]},\n` +
          `  {"name":"Top View","view":"top","width_mm":200,"height_mm":100,"features":["list"],"notes":[]},\n` +
          `  {"name":"Section A-A","view":"section","width_mm":200,"height_mm":150,"features":["list"],"notes":["material callouts"]}\n` +
          `],"title_block":{"part_name":"","part_number":"","material":"","finish":"","scale":"1:2","drawn_by":"Forge AI","date":"${new Date().toLocaleDateString('en-AU')}","tolerance_general":"±0.5mm"}}`
      }]
    });

    setP(65, '📐 Rendering SVG drawings...');
    const parsed = extractJSON(extractText(data));
    if(!parsed?.drawings?.length) throw new Error('No drawing data generated');

    // Generate SVG for each view
    project.drawings = parsed.drawings.map(d => ({
      ...d,
      svg: generateSVG(d, parsed.title_block)
    }));

    setP(100, '✓ Drawings generated');
    setTimeout(() => {
      if(prog) prog.style.display = 'none';
      render(project);
    }, 400);

  } catch(e) {
    forgeToast('Drawing generation failed: ' + e.message, 'error');
    if(prog) prog.style.display = 'none';
    if(btn) { btn.disabled = false; btn.textContent = '📐 Generate Drawings'; }
  }
}

function generateSVG(drawing, titleBlock) {
  const tb = titleBlock || {};
  const scale = 2; // pixels per mm
  const W = Math.max(drawing.width_mm * scale, 200);
  const H = Math.max(drawing.height_mm * scale, 150);
  const margin = 40;
  const tbH = 80; // title block height
  const totalH = H + tbH + margin * 2;
  const totalW = W + margin * 2;

  // Generate feature lines — simple rectangular representation
  const cx = margin + W/2;
  const cy = margin + H/2;
  const bw = W * 0.6;
  const bh = H * 0.6;

  // Build dimension lines and feature representations
  const features = drawing.features || [];
  const featureText = features.slice(0,6).map((f, i) =>
    `<text x="${margin + 8}" y="${margin + 20 + i*16}" font-size="7" fill="#444">${(i+1)}. ${f.slice(0,50)}</text>`
  ).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
  <!-- Border -->
  <rect x="4" y="4" width="${totalW-8}" height="${totalH-8}" fill="white" stroke="#333" stroke-width="1.5"/>
  <rect x="10" y="10" width="${totalW-20}" height="${totalH-20}" fill="none" stroke="#333" stroke-width="0.5"/>

  <!-- Drawing area -->
  <!-- Main body outline -->
  <rect x="${cx - bw/2}" y="${cy - bh/2}" width="${bw}" height="${bh}" fill="none" stroke="#222" stroke-width="1.5"/>

  <!-- Center lines -->
  <line x1="${margin}" y1="${cy}" x2="${margin+W}" y2="${cy}" stroke="#aaa" stroke-width="0.5" stroke-dasharray="8,4"/>
  <line x1="${cx}" y1="${margin}" x2="${cx}" y2="${margin+H}" stroke="#aaa" stroke-width="0.5" stroke-dasharray="8,4"/>

  <!-- Dimension lines - width -->
  <line x1="${cx-bw/2}" y1="${margin+H+12}" x2="${cx+bw/2}" y2="${margin+H+12}" stroke="#555" stroke-width="0.7" marker-end="url(#arr)" marker-start="url(#arr)"/>
  <text x="${cx}" y="${margin+H+22}" font-size="8" text-anchor="middle" fill="#333">${drawing.width_mm}mm</text>

  <!-- Dimension lines - height -->
  <line x1="${margin+W+12}" y1="${cy-bh/2}" x2="${margin+W+12}" y2="${cy+bh/2}" stroke="#555" stroke-width="0.7" marker-end="url(#arr)" marker-start="url(#arr)"/>
  <text x="${margin+W+24}" y="${cy+3}" font-size="8" text-anchor="start" fill="#333">${drawing.height_mm}mm</text>

  <!-- View label -->
  <text x="${cx}" y="${margin - 8}" font-size="10" font-weight="bold" text-anchor="middle" fill="#111">${drawing.name}</text>

  <!-- Feature annotations (simplified) -->
  ${featureText}

  <!-- Title block -->
  <rect x="4" y="${totalH - tbH - 4}" width="${totalW-8}" height="${tbH}" fill="#f9f9f9" stroke="#333" stroke-width="1"/>
  <line x1="4" y1="${totalH - tbH - 4}" x2="${totalW-4}" y2="${totalH - tbH - 4}" stroke="#333" stroke-width="1"/>

  <text x="12" y="${totalH - tbH + 14}" font-size="11" font-weight="bold" fill="#111">${tb.part_name || 'Untitled Part'}</text>
  <text x="12" y="${totalH - tbH + 28}" font-size="8" fill="#555">Part No: ${tb.part_number || 'TBD'}</text>
  <text x="12" y="${totalH - tbH + 40}" font-size="8" fill="#555">Material: ${tb.material || 'TBD'}</text>
  <text x="12" y="${totalH - tbH + 52}" font-size="8" fill="#555">Finish: ${tb.finish || 'TBD'}</text>

  <text x="${totalW - 160}" y="${totalH - tbH + 14}" font-size="8" fill="#555">Scale: ${tb.scale || '1:1'}</text>
  <text x="${totalW - 160}" y="${totalH - tbH + 26}" font-size="8" fill="#555">Drawn by: ${tb.drawn_by || 'Forge AI'}</text>
  <text x="${totalW - 160}" y="${totalH - tbH + 38}" font-size="8" fill="#555">Date: ${tb.date || ''}</text>
  <text x="${totalW - 160}" y="${totalH - tbH + 50}" font-size="8" fill="#555">General tol: ${tb.tolerance_general || '±0.5mm'}</text>

  <!-- Forge watermark -->
  <text x="${totalW/2}" y="${totalH - 8}" font-size="7" text-anchor="middle" fill="#bbb">Generated by Forge AI Design Studio</text>

  <defs>
    <marker id="arr" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
      <path d="M0 0L6 3L0 6z" fill="#555"/>
    </marker>
  </defs>
</svg>`;
}

function renderSVGDrawing(drawing) {
  if(!drawing?.svg) return '<div class="empty-state"><div class="empty-icon">📐</div><div class="empty-title">No drawing data</div></div>';
  return `<div class="drawing-viewer" style="overflow:auto;border:1px solid var(--border);border-radius:var(--r-lg)">${drawing.svg}</div>`;
}

export function showDrawing(idx) {
  const project = state.currentProject;
  if(!project?.drawings) return;
  document.querySelectorAll('[id^="dtab-"]').forEach((b, i) => b.classList.toggle('active', i===idx));
  const viewer = document.getElementById('drawing-viewer');
  if(viewer) viewer.innerHTML = renderSVGDrawing(project.drawings[idx]);
}

export function exportPDF() {
  forgeToast('PDF export — download as SVG for now, PDF coming soon', 'info');
}

export const drawings = { render, generate, showDrawing, exportPDF };
window.forge = window.forge || {};
window.forge.drawings = drawings;
