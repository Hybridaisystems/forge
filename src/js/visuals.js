// ── VISUALS — Concept Renders + Canvas Annotations ────────────────────────────
import { state } from './state.js';
import { forgeImage, forgeAI, extractText } from './api.js';

let _activeTool = 'point'; // point | box | circle | arrow
let _isDrawing  = false;
let _startX = 0, _startY = 0;
let _canvas = null, _ctx = null;
let _annotations = [];

export function render(project) {
  const el = document.getElementById('tab-visuals');
  if(!el) return;

  const renders = project.renders || [];

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 340px;gap:16px;max-width:1200px">

      <!-- Left: Render viewer + annotation -->
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="section-title" style="margin:0">Concept Renders</div>
          <button class="btn-primary btn-sm" onclick="forge.visuals.generateRender()" id="gen-render-btn">
            ${renders.length ? '🔄 Regenerate' : '✨ Generate Render'}
          </button>
        </div>

        ${renders.length ? `
          <!-- Render + canvas overlay -->
          <div class="render-container" id="render-container">
            <div class="render-toolbar">
              <button class="render-tool active" data-tool="point" onclick="forge.visuals.setTool('point')">📍 Point</button>
              <button class="render-tool" data-tool="box"   onclick="forge.visuals.setTool('box')">⬜ Box</button>
              <button class="render-tool" data-tool="arrow" onclick="forge.visuals.setTool('arrow')">↗ Arrow</button>
              <div style="flex:1"></div>
              <button class="render-tool" onclick="forge.visuals.clearAnnotations()">🗑 Clear</button>
            </div>
            <div style="position:relative">
              <img src="${renders[renders.length-1].url}" class="render-img" id="render-img" alt="Concept render"/>
              <canvas id="annotation-canvas" class="render-canvas"></canvas>
            </div>
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:6px;text-align:center">Click or draw on the render to annotate a change request</div>

          <!-- Annotation request form -->
          <div id="annotation-form" style="display:none;margin-top:12px">
            <div class="card">
              <div class="card-title">📝 Change request</div>
              <textarea class="f-input f-textarea" id="annotation-text" rows="2" placeholder="Describe the change you want to make to the highlighted area..."></textarea>
              <div style="display:flex;gap:8px;margin-top:10px">
                <button class="btn-primary btn-sm" onclick="forge.visuals.submitAnnotation()">Apply Change →</button>
                <button class="btn-ghost btn-sm"   onclick="forge.visuals.cancelAnnotation()">Cancel</button>
              </div>
            </div>
          </div>
        ` : `
          <div class="empty-state">
            <div class="empty-icon">🎨</div>
            <div class="empty-title">No renders yet</div>
            <div class="empty-desc">Click Generate Render to create your first concept image based on your design brief.</div>
          </div>
        `}

        <!-- Progress -->
        <div id="render-progress" style="display:none;margin-top:12px">
          <div class="progress-bar"><div class="progress-fill" id="render-bar" style="width:0%"></div></div>
          <div class="progress-msg" id="render-msg">Generating...</div>
        </div>
      </div>

      <!-- Right: Render history + annotations log -->
      <div>
        <div class="section-title">Version history</div>
        ${renders.length ? renders.map((r, i) => `
          <div class="card" style="margin-bottom:8px;cursor:pointer;border:${i===renders.length-1?'1px solid var(--blue)':'1px solid var(--border)'}">
            <img src="${r.url}" style="width:100%;border-radius:6px;margin-bottom:8px"/>
            <div style="font-size:11px;color:var(--muted)">v${i+1} · ${new Date(r.created_at).toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'})}</div>
            ${r.change_request ? `<div style="font-size:11px;color:var(--blue-light);margin-top:4px">"${r.change_request.slice(0,60)}..."</div>` : ''}
          </div>
        `).join('') : '<div style="font-size:12px;color:var(--muted)">No renders yet</div>'}

        <div class="section-title" style="margin-top:16px">Annotations</div>
        <div id="annotations-log">
          ${(project.renders?.[project.renders.length-1]?.annotations || []).map((a, i) => `
            <div class="card" style="margin-bottom:6px">
              <div style="font-size:11px;color:var(--blue-light);margin-bottom:4px">#${i+1} · ${a.tool}</div>
              <div style="font-size:12px">${a.note}</div>
              <div style="font-size:10px;color:var(--muted);margin-top:4px">${a.resolved ? '✓ Applied' : 'Pending'}</div>
            </div>
          `).join('') || '<div style="font-size:12px;color:var(--muted)">No annotations yet</div>'}
        </div>
      </div>
    </div>
  `;

  // Wire up canvas if render exists
  if(renders.length) {
    setTimeout(initCanvas, 100);
  }
}

function initCanvas() {
  const img = document.getElementById('render-img');
  const canvas = document.getElementById('annotation-canvas');
  if(!img || !canvas) return;

  _canvas = canvas;
  _ctx = canvas.getContext('2d');
  _annotations = [];

  const resizeCanvas = () => {
    canvas.width  = img.offsetWidth;
    canvas.height = img.offsetHeight;
    redrawAnnotations();
  };

  img.onload = resizeCanvas;
  if(img.complete) resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup',   onMouseUp);
}

let _pending = null;

function onMouseDown(e) {
  const rect = _canvas.getBoundingClientRect();
  _startX = e.clientX - rect.left;
  _startY = e.clientY - rect.top;
  _isDrawing = true;
  _pending = { tool: _activeTool, x: _startX, y: _startY, w: 0, h: 0 };
}

function onMouseMove(e) {
  if(!_isDrawing || !_pending) return;
  const rect = _canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  _pending.w = mx - _startX;
  _pending.h = my - _startY;
  redrawAnnotations();
  drawShape(_pending, 'rgba(37,99,235,0.8)', true);
}

function onMouseUp(e) {
  if(!_isDrawing) return;
  _isDrawing = false;
  if(!_pending) return;

  // For point tool, just record the click
  if(_activeTool === 'point') {
    _pending.w = 0; _pending.h = 0;
  }

  _annotations.push({ ..._pending, note: '', resolved: false });
  redrawAnnotations();
  _pending = null;

  // Show annotation form
  document.getElementById('annotation-form').style.display = 'block';
  document.getElementById('annotation-text').focus();
}

function drawShape(ann, color, preview = false) {
  if(!_ctx) return;
  _ctx.strokeStyle = color;
  _ctx.lineWidth = 2;
  _ctx.fillStyle = color.replace('0.8', '0.1');

  if(ann.tool === 'point' || (ann.w === 0 && ann.h === 0)) {
    _ctx.beginPath();
    _ctx.arc(ann.x, ann.y, 8, 0, Math.PI * 2);
    _ctx.fill();
    _ctx.stroke();
    // Number bubble
    if(!preview) {
      _ctx.fillStyle = color;
      _ctx.beginPath();
      _ctx.arc(ann.x + 10, ann.y - 10, 8, 0, Math.PI * 2);
      _ctx.fill();
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 10px Inter, sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(_annotations.indexOf(ann) + 1, ann.x + 10, ann.y - 6);
    }
  } else if(ann.tool === 'box') {
    _ctx.beginPath();
    _ctx.rect(ann.x, ann.y, ann.w, ann.h);
    _ctx.fill();
    _ctx.stroke();
  } else if(ann.tool === 'arrow') {
    const ex = ann.x + ann.w;
    const ey = ann.y + ann.h;
    _ctx.beginPath();
    _ctx.moveTo(ann.x, ann.y);
    _ctx.lineTo(ex, ey);
    _ctx.stroke();
    // Arrowhead
    const angle = Math.atan2(ann.h, ann.w);
    _ctx.beginPath();
    _ctx.moveTo(ex, ey);
    _ctx.lineTo(ex - 12*Math.cos(angle-0.4), ey - 12*Math.sin(angle-0.4));
    _ctx.lineTo(ex - 12*Math.cos(angle+0.4), ey - 12*Math.sin(angle+0.4));
    _ctx.closePath();
    _ctx.fill();
  }
}

function redrawAnnotations() {
  if(!_ctx || !_canvas) return;
  _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
  _annotations.forEach((a, i) => {
    const col = a.resolved ? 'rgba(16,185,129,0.8)' : 'rgba(37,99,235,0.8)';
    drawShape(a, col);
  });
}

export function setTool(tool) {
  _activeTool = tool;
  document.querySelectorAll('.render-tool').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });
}

export function clearAnnotations() {
  _annotations = [];
  redrawAnnotations();
  document.getElementById('annotation-form').style.display = 'none';
}

export function cancelAnnotation() {
  _annotations.pop();
  redrawAnnotations();
  document.getElementById('annotation-form').style.display = 'none';
}

export async function submitAnnotation() {
  const note = document.getElementById('annotation-text')?.value.trim();
  if(!note) { forgeToast('Describe the change first', 'error'); return; }

  const last = _annotations[_annotations.length - 1];
  if(last) last.note = note;

  document.getElementById('annotation-form').style.display = 'none';
  document.getElementById('annotation-text').value = '';

  // Generate new render incorporating the change
  await generateRenderWithChange(note);
}

export async function generateRender() {
  const project = state.currentProject;
  if(!project) return;

  const prog = document.getElementById('render-progress');
  const bar  = document.getElementById('render-bar');
  const msg  = document.getElementById('render-msg');
  const btn  = document.getElementById('gen-render-btn');

  if(prog) prog.style.display = 'block';
  if(btn)  { btn.disabled = true; btn.textContent = '⏳ Generating...'; }

  try {
    const setP = (p, m) => { if(bar) bar.style.width=p+'%'; if(msg) msg.textContent=m; };

    setP(20, '🎨 Generating concept render (~20 seconds)...');
    const brief = project.brief || {};
    const desc  = brief.render_description || project.description;
    const env   = project.constraints?.environment || 'clean studio background';
    const prompt = `Professional product concept render: ${desc}. Photorealistic, high detail, ${env}, dramatic lighting, 3/4 view, product design presentation style, ultra high quality`;

    const url = await forgeImage(prompt, '1792x1024');
    if(!url) throw new Error('No image returned');

    setP(90, '💾 Saving render...');
    project.renders = project.renders || [];
    project.renders.push({ url, prompt, created_at: new Date().toISOString(), annotations: [] });

    setP(100, '✓ Done!');
    setTimeout(() => {
      if(prog) prog.style.display = 'none';
      render(project);
    }, 500);

  } catch(e) {
    forgeToast('Render failed: ' + e.message, 'error');
    if(prog) prog.style.display = 'none';
    if(btn)  { btn.disabled = false; btn.textContent = project.renders?.length ? '🔄 Regenerate' : '✨ Generate Render'; }
  }
}

async function generateRenderWithChange(changeRequest) {
  const project = state.currentProject;
  if(!project || !project.renders?.length) return;

  const prog = document.getElementById('render-progress');
  if(prog) prog.style.display = 'block';

  try {
    const setP = (p, m) => {
      const bar = document.getElementById('render-bar');
      const msg = document.getElementById('render-msg');
      if(bar) bar.style.width=p+'%';
      if(msg) msg.textContent=m;
    };

    setP(15, '🧠 Refining prompt based on your change request...');
    const prev = project.renders[project.renders.length - 1];

    // Build refined prompt
    const refineData = await forgeAI({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Original render prompt: "${prev.prompt}"\n\nUser change request: "${changeRequest}"\n\nWrite a refined render prompt that incorporates the change. Keep it a single paragraph, photorealistic product render style. Return ONLY the prompt text.`
      }]
    });
    const newPrompt = extractText(refineData).trim();

    setP(40, '🎨 Generating updated render...');
    const url = await forgeImage(newPrompt, '1792x1024');
    if(!url) throw new Error('No image returned');

    project.renders.push({ url, prompt: newPrompt, change_request: changeRequest, created_at: new Date().toISOString(), annotations: [] });
    setP(100, '✓ Updated render ready');

    setTimeout(() => {
      if(prog) prog.style.display = 'none';
      render(project);
    }, 400);

  } catch(e) {
    forgeToast('Render update failed: ' + e.message, 'error');
    if(prog) prog.style.display = 'none';
  }
}

export const visuals = { render, setTool, clearAnnotations, cancelAnnotation, submitAnnotation, generateRender };
window.forge = window.forge || {};
window.forge.visuals = visuals;
