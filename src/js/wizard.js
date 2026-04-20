// ── NEW PROJECT WIZARD ────────────────────────────────────────────────────────
import { state } from './state.js';
import { forgeAI, extractText, extractJSON } from './api.js';

const STEPS = ['Describe', 'References', 'Constraints', 'Parts', 'Generate'];
let _uploads = [];
let _aiQuestions = [];

export function wizardOpen() {
  // Reset wizard state
  state.wizard.step = 1;
  state.wizard.data = { description:'', uploads:[], constraints:{}, partsPrefs:{} };
  _uploads = [];
  _aiQuestions = [];

  document.getElementById('wizard-overlay').style.display = 'flex';
  renderStep(1);
  updateStepIndicator(1);
}

export function wizardClose() {
  document.getElementById('wizard-overlay').style.display = 'none';
}

export async function wizardNext() {
  const step = state.wizard.step;

  if(step === 1) {
    const desc = document.getElementById('wz-description')?.value.trim();
    if(!desc) { forgeToast('Describe what you want to build first', 'error'); return; }
    state.wizard.data.description = desc;
    // Generate clarifying questions with AI
    await generateClarifyingQuestions(desc);
    advanceTo(2);

  } else if(step === 2) {
    state.wizard.data.uploads = _uploads;
    advanceTo(3);

  } else if(step === 3) {
    state.wizard.data.constraints = gatherConstraints();
    advanceTo(4);

  } else if(step === 4) {
    state.wizard.data.partsPrefs = gatherPartsPrefs();
    advanceTo(5);

  } else if(step === 5) {
    await launchGeneration();
  }
}

export function wizardBack() {
  if(state.wizard.step > 1) advanceTo(state.wizard.step - 1);
}

function advanceTo(step) {
  state.wizard.step = step;
  renderStep(step);
  updateStepIndicator(step);
  const backBtn = document.getElementById('wizard-back');
  if(backBtn) backBtn.style.display = step > 1 ? 'block' : 'none';
  const nextBtn = document.getElementById('wizard-next');
  if(nextBtn) nextBtn.textContent = step === 5 ? '🚀 Generate Project' : 'Continue →';
}

function updateStepIndicator(current) {
  document.querySelectorAll('.wstep').forEach(el => {
    const n = parseInt(el.dataset.step);
    el.classList.remove('active', 'done');
    if(n === current) el.classList.add('active');
    if(n < current)   el.classList.add('done');
  });
}

function renderStep(step) {
  const el = document.getElementById('wizard-content');
  if(!el) return;
  if(step === 1) el.innerHTML = renderStep1();
  if(step === 2) el.innerHTML = renderStep2();
  if(step === 3) el.innerHTML = renderStep3();
  if(step === 4) el.innerHTML = renderStep4();
  if(step === 5) el.innerHTML = renderStep5();

  if(step === 2) wireUploadZone();
}

// ── STEP 1: DESCRIBE ──────────────────────────────────────────────────────────
function renderStep1() {
  return `
    <div class="f-group">
      <label class="f-label">What do you want to build?</label>
      <textarea class="f-input f-textarea" id="wz-description" rows="5"
        placeholder="Describe your product idea in plain language. Be as specific or as vague as you like — Forge will ask the right questions.

Examples:
• A wireless dog lure machine for lure coursing competitions that can be controlled via smartphone
• A compact water filtration device for camping that removes 99.9% of bacteria
• An automatic chicken coop door that opens at sunrise and closes at sunset">${state.wizard.data.description || ''}</textarea>
    </div>
    <div class="ai-question">
      <div class="ai-icon">💡</div>
      <div class="ai-text">Tip: Include what the product <strong>does</strong>, who <strong>uses it</strong>, and any key requirements like power source, size, or environment. Forge will fill in the gaps.</div>
    </div>
    ${_aiQuestions.length ? `
      <div class="section-title" style="margin-top:16px">Forge has some questions</div>
      ${_aiQuestions.map((q, i) => `
        <div class="f-group">
          <label class="f-label">${q.question}</label>
          <input class="f-input" id="wz-q-${i}" placeholder="${q.placeholder || ''}" value="${state.wizard.answers?.[i] || ''}"/>
        </div>
      `).join('')}
    ` : ''}
  `;
}

async function generateClarifyingQuestions(desc) {
  const nextBtn = document.getElementById('wizard-next');
  if(nextBtn) { nextBtn.disabled = true; nextBtn.textContent = '🤔 Analysing...'; }

  try {
    const data = await forgeAI({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `A user wants to build: "${desc}"\n\nGenerate 3-4 specific clarifying questions to better understand their requirements. Return ONLY JSON:\n{"questions":[{"question":"string","placeholder":"example answer"}]}`
      }]
    });
    const parsed = extractJSON(extractText(data));
    if(parsed?.questions) {
      _aiQuestions = parsed.questions;
      renderStep(1); // re-render with questions
    }
  } catch(e) { console.warn('Questions generation failed:', e.message); }

  if(nextBtn) { nextBtn.disabled = false; nextBtn.textContent = 'Continue →'; }
}

// ── STEP 2: REFERENCES ────────────────────────────────────────────────────────
function renderStep2() {
  return `
    <div class="ai-question" style="margin-bottom:16px">
      <div class="ai-icon">📎</div>
      <div class="ai-text">Upload anything that helps describe your vision — sketches, reference images, competitor products, PDFs, Word docs, or paste a URL. Forge will extract the relevant information.</div>
    </div>
    <div class="upload-zone" id="upload-zone">
      <div class="upload-zone-icon">📁</div>
      <div class="upload-zone-text">Drop files here or click to browse</div>
      <div class="upload-zone-sub">Images, PDFs, Word docs, hand sketches · Max 20MB each</div>
      <input type="file" id="upload-input" style="display:none" multiple accept="image/*,.pdf,.doc,.docx"/>
    </div>
    <div class="f-group" style="margin-top:12px">
      <label class="f-label">Or paste a URL</label>
      <div style="display:flex;gap:8px">
        <input class="f-input" id="wz-url" placeholder="https://example.com/product-you-like" style="flex:1"/>
        <button class="btn-ghost btn-sm" onclick="forgeWizardAddUrl()">Add →</button>
      </div>
    </div>
    <div id="uploaded-files-list" class="uploaded-files">
      ${_uploads.map((u, i) => `
        <div class="uploaded-file">
          <span>${u.type === 'url' ? '🔗' : '📄'}</span>
          <span class="uploaded-file-name">${u.name}</span>
          <span class="uploaded-file-remove" onclick="forgeWizardRemoveUpload(${i})">✕</span>
        </div>
      `).join('')}
    </div>
    <div class="ai-question" style="margin-top:12px">
      <div class="ai-icon">ℹ️</div>
      <div class="ai-text">This step is optional — you can skip it and come back later. But the more context you provide, the better your initial concept render will be.</div>
    </div>
  `;
}

function wireUploadZone() {
  const zone  = document.getElementById('upload-zone');
  const input = document.getElementById('upload-input');
  if(!zone || !input) return;

  zone.onclick = () => input.click();
  input.onchange = e => handleFileUpload(e.target.files);
  zone.ondragover = e => { e.preventDefault(); zone.classList.add('dragover'); };
  zone.ondragleave = () => zone.classList.remove('dragover');
  zone.ondrop = e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    handleFileUpload(e.dataTransfer.files);
  };
}

function handleFileUpload(files) {
  Array.from(files).forEach(file => {
    _uploads.push({ name: file.name, type: 'file', file, size: file.size });
  });
  renderUploadedList();
}

window.forgeWizardAddUrl = function() {
  const val = document.getElementById('wz-url')?.value.trim();
  if(!val) return;
  if(!val.startsWith('http')) { forgeToast('Enter a valid URL starting with http', 'error'); return; }
  _uploads.push({ name: val, type: 'url', url: val });
  document.getElementById('wz-url').value = '';
  renderUploadedList();
};

window.forgeWizardRemoveUpload = function(i) {
  _uploads.splice(i, 1);
  renderUploadedList();
};

function renderUploadedList() {
  const el = document.getElementById('uploaded-files-list');
  if(!el) return;
  el.innerHTML = _uploads.map((u, i) => `
    <div class="uploaded-file">
      <span>${u.type === 'url' ? '🔗' : '📄'}</span>
      <span class="uploaded-file-name">${u.name}</span>
      <span class="uploaded-file-remove" onclick="forgeWizardRemoveUpload(${i})">✕</span>
    </div>
  `).join('');
}

// ── STEP 3: CONSTRAINTS ───────────────────────────────────────────────────────
function renderStep3() {
  return `
    <div class="f-row">
      <div class="f-group">
        <label class="f-label">Target size</label>
        <input class="f-input" id="wz-size" placeholder="e.g. Fits in a backpack, 200mm × 150mm"/>
      </div>
      <div class="f-group">
        <label class="f-label">Target weight</label>
        <input class="f-input" id="wz-weight" placeholder="e.g. Under 2kg, as light as possible"/>
      </div>
    </div>
    <div class="f-row">
      <div class="f-group">
        <label class="f-label">Power source</label>
        <select class="f-input f-select" id="wz-power">
          <option value="">— Select —</option>
          <option>Battery (rechargeable)</option>
          <option>Battery (replaceable)</option>
          <option>Mains power (240V)</option>
          <option>Mains power (110V)</option>
          <option>Solar</option>
          <option>No power required</option>
          <option>Other / TBD</option>
        </select>
      </div>
      <div class="f-group">
        <label class="f-label">Operating environment</label>
        <select class="f-input f-select" id="wz-environment">
          <option value="">— Select —</option>
          <option>Indoor only</option>
          <option>Outdoor (dry)</option>
          <option>Outdoor (weatherproof)</option>
          <option>Waterproof / submersible</option>
          <option>Dustproof / industrial</option>
          <option>Extreme temperature</option>
        </select>
      </div>
    </div>
    <div class="f-row">
      <div class="f-group">
        <label class="f-label">Target unit cost (AUD)</label>
        <input class="f-input" id="wz-cost" placeholder="e.g. Under $200, $50–$100"/>
      </div>
      <div class="f-group">
        <label class="f-label">Production quantity goal</label>
        <select class="f-input f-select" id="wz-quantity">
          <option value="">— Select —</option>
          <option>Prototype only (1–5 units)</option>
          <option>Small batch (10–100 units)</option>
          <option>Medium run (100–1,000 units)</option>
          <option>Mass production (1,000+ units)</option>
        </select>
      </div>
    </div>
    <div class="f-group">
      <label class="f-label">Required certifications / standards</label>
      <input class="f-input" id="wz-certs" placeholder="e.g. CE, RoHS, FCC, IP67, AS/NZS 4268 — or leave blank if unsure"/>
    </div>
    <div class="f-group">
      <label class="f-label">Any other constraints or must-haves</label>
      <textarea class="f-input f-textarea" id="wz-other" rows="3" placeholder="e.g. Must be assembled in Australia, No proprietary connectors, Colour: safety yellow"></textarea>
    </div>
  `;
}

function gatherConstraints() {
  return {
    size:        document.getElementById('wz-size')?.value || '',
    weight:      document.getElementById('wz-weight')?.value || '',
    power:       document.getElementById('wz-power')?.value || '',
    environment: document.getElementById('wz-environment')?.value || '',
    cost:        document.getElementById('wz-cost')?.value || '',
    quantity:    document.getElementById('wz-quantity')?.value || '',
    certs:       document.getElementById('wz-certs')?.value || '',
    other:       document.getElementById('wz-other')?.value || ''
  };
}

// ── STEP 4: PARTS PREFERENCE ──────────────────────────────────────────────────
function renderStep4() {
  return `
    <div class="ai-question" style="margin-bottom:20px">
      <div class="ai-icon">🔍</div>
      <div class="ai-text">Forge can search global suppliers for <strong>existing parts</strong> that match your requirements — motors, sensors, enclosures, fasteners, PCB components and more. Using off-the-shelf parts dramatically reduces cost and time to market.</div>
    </div>
    <div class="f-group">
      <label class="f-label">Parts sourcing strategy</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px">
        <div class="parts-pref-card" id="pref-search" onclick="forgeSelectPartsPref('search')" style="border:2px solid var(--blue);background:var(--blue-dim);padding:14px;border-radius:var(--r);cursor:pointer">
          <div style="font-size:20px;margin-bottom:6px">🔍</div>
          <div style="font-size:13px;font-weight:700;margin-bottom:4px">Search first</div>
          <div style="font-size:11px;color:var(--muted)">Find existing parts from Digikey, Mouser, McMaster-Carr, RS Components</div>
        </div>
        <div class="parts-pref-card" id="pref-custom" onclick="forgeSelectPartsPref('custom')" style="border:2px solid var(--border2);padding:14px;border-radius:var(--r);cursor:pointer">
          <div style="font-size:20px;margin-bottom:6px">✏️</div>
          <div style="font-size:13px;font-weight:700;margin-bottom:4px">Design custom</div>
          <div style="font-size:11px;color:var(--muted)">Design everything from scratch, source parts later</div>
        </div>
      </div>
    </div>
    <div id="supplier-prefs" style="">
      <div class="f-group">
        <label class="f-label">Preferred supplier regions</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${['Australia/NZ','United States','Europe','Asia (Alibaba/LCSC)','Any'].map(r =>
            `<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
              <input type="checkbox" value="${r}" class="supplier-region" ${r==='Any'?'checked':''}/> ${r}
             </label>`
          ).join('')}
        </div>
      </div>
      <div class="f-row">
        <div class="f-group">
          <label class="f-label">Max lead time acceptable</label>
          <select class="f-input f-select" id="wz-leadtime">
            <option>In stock (immediate)</option>
            <option>1–2 weeks</option>
            <option>1 month</option>
            <option>3 months</option>
            <option>Lead time not critical</option>
          </select>
        </div>
        <div class="f-group">
          <label class="f-label">Has electronics / PCB?</label>
          <select class="f-input f-select" id="wz-has-pcb">
            <option value="yes">Yes — include PCB/schematic design</option>
            <option value="no">No — mechanical/structural only</option>
            <option value="maybe">Not sure yet</option>
          </select>
        </div>
      </div>
    </div>
  `;
}

window.forgeSelectPartsPref = function(pref) {
  document.getElementById('pref-search').style.borderColor = pref==='search' ? 'var(--blue)' : 'var(--border2)';
  document.getElementById('pref-search').style.background  = pref==='search' ? 'var(--blue-dim)' : 'transparent';
  document.getElementById('pref-custom').style.borderColor = pref==='custom' ? 'var(--blue)' : 'var(--border2)';
  document.getElementById('pref-custom').style.background  = pref==='custom' ? 'var(--blue-dim)' : 'transparent';
  window._partsPref = pref;
};

function gatherPartsPrefs() {
  const regions = [...document.querySelectorAll('.supplier-region:checked')].map(el => el.value);
  return {
    strategy: window._partsPref || 'search',
    regions,
    leadTime: document.getElementById('wz-leadtime')?.value || '',
    hasPCB:   document.getElementById('wz-has-pcb')?.value || 'maybe'
  };
}

// ── STEP 5: GENERATE ──────────────────────────────────────────────────────────
function renderStep5() {
  const d = state.wizard.data;
  const c = d.constraints;
  return `
    <div class="ai-question" style="margin-bottom:20px">
      <div class="ai-icon">🚀</div>
      <div class="ai-text">Forge will now generate your initial concept render and design brief. This takes about 30–60 seconds. Once done, you'll enter the full design workspace.</div>
    </div>
    <div class="card" style="margin-bottom:12px">
      <div class="card-title">📋 Brief summary</div>
      <div style="font-size:13px;color:var(--muted);line-height:1.6">${d.description || 'No description'}</div>
    </div>
    ${c.size||c.weight||c.power||c.quantity ? `
      <div class="card" style="margin-bottom:12px">
        <div class="card-title">⚙️ Constraints</div>
        ${c.size ? `<div style="font-size:12px;color:var(--muted);margin-bottom:4px">Size: ${c.size}</div>` : ''}
        ${c.weight ? `<div style="font-size:12px;color:var(--muted);margin-bottom:4px">Weight: ${c.weight}</div>` : ''}
        ${c.power ? `<div style="font-size:12px;color:var(--muted);margin-bottom:4px">Power: ${c.power}</div>` : ''}
        ${c.quantity ? `<div style="font-size:12px;color:var(--muted)">Quantity: ${c.quantity}</div>` : ''}
      </div>
    ` : ''}
    ${d.uploads.length ? `
      <div class="card">
        <div class="card-title">📎 References (${d.uploads.length})</div>
        ${d.uploads.map(u => `<div style="font-size:12px;color:var(--muted);margin-bottom:3px">${u.type==='url'?'🔗':'📄'} ${u.name}</div>`).join('')}
      </div>
    ` : ''}
    <div id="generate-progress" style="display:none">
      <div class="progress-bar"><div class="progress-fill" id="gen-bar" style="width:0%"></div></div>
      <div class="progress-msg" id="gen-msg">Starting...</div>
    </div>
  `;
}

async function launchGeneration() {
  const nextBtn = document.getElementById('wizard-next');
  const backBtn = document.getElementById('wizard-back');
  if(nextBtn) { nextBtn.disabled = true; nextBtn.textContent = '⏳ Generating...'; }
  if(backBtn) backBtn.style.display = 'none';

  const progress = document.getElementById('generate-progress');
  if(progress) progress.style.display = 'block';

  function setProgress(pct, msg) {
    const bar = document.getElementById('gen-bar');
    const txt = document.getElementById('gen-msg');
    if(bar) bar.style.width = pct + '%';
    if(txt) txt.textContent = msg;
  }

  try {
    const d = state.wizard.data;

    // Step 1: Generate design brief
    setProgress(15, '📋 Generating design brief...');
    const brief = await generateDesignBrief(d);

    // Step 2: Generate concept render
    setProgress(40, '🎨 Generating concept render (this takes ~20s)...');
    const renderPrompt = buildRenderPrompt(d, brief);
    let renderUrl = null;
    try {
      renderUrl = await forgeImage(renderPrompt, '1792x1024');
    } catch(e) {
      console.warn('Render generation failed:', e.message);
    }

    setProgress(75, '💾 Saving project...');

    // Create project in state
    const project = {
      id:        Date.now().toString(),
      name:      brief.product_name || d.description.slice(0, 40),
      icon:      brief.icon || '⚙️',
      description: d.description,
      brief,
      renders:   renderUrl ? [{ url: renderUrl, prompt: renderPrompt, created_at: new Date().toISOString(), annotations: [] }] : [],
      parts:     [],
      drawings:  [],
      uploads:   d.uploads,
      constraints: d.constraints,
      partsPrefs: d.partsPrefs,
      created_at: new Date().toISOString(),
      version:   1
    };

    state.projects.push(project);
    state.currentProject = project;

    setProgress(100, '✓ Project created!');

    setTimeout(() => {
      wizardClose();
      window.forge.projects.renderSidebar();
      window.forge.projects.openProject(project.id);
    }, 600);

  } catch(e) {
    forgeToast('Generation failed: ' + e.message, 'error');
    if(nextBtn) { nextBtn.disabled = false; nextBtn.textContent = '🚀 Generate Project'; }
    if(backBtn) backBtn.style.display = 'block';
  }
}

async function generateDesignBrief(data) {
  const prompt = `You are an expert product design engineer. Based on this brief, generate a comprehensive product design document.\n\n` +
    `DESCRIPTION: ${data.description}\n` +
    `CONSTRAINTS: ${JSON.stringify(data.constraints)}\n` +
    `PARTS PREFERENCE: ${JSON.stringify(data.partsPrefs)}\n\n` +
    `Return ONLY JSON:\n` +
    `{"product_name":"string","icon":"emoji","tagline":"one line","product_type":"mechanical|electronic|electromechanical|software|other","overview":"paragraph","key_features":["list"],"technical_requirements":["list"],"materials_suggested":["list"],"challenges":["potential design challenges"],"render_description":"detailed visual description for image generation (materials, form, environment, lighting)"}`;

  const data2 = await forgeAI({ model: 'claude-haiku-4-5-20251001', max_tokens: 900, messages: [{ role:'user', content: prompt }] });
  return extractJSON(extractText(data2)) || { product_name: data.description.slice(0, 40), icon: '⚙️' };
}

function buildRenderPrompt(data, brief) {
  const desc = brief.render_description || data.description;
  const env  = data.constraints.environment || 'clean studio background';
  return `Professional product concept render: ${desc}. Photorealistic, high detail, ${env}, dramatic lighting, 3/4 view angle, white background or appropriate environment, product design presentation style, ultra high quality, 8K render`;
}

export const wizard = { open: wizardOpen, close: wizardClose, next: wizardNext, back: wizardBack };
window.forge = window.forge || {};
window.forge.wizard = wizard;
