// ── PROJECTS ──────────────────────────────────────────────────────────────────
import { state } from './state.js';

export function renderSidebar() {
  const el = document.getElementById('projects-list');
  if(!el) return;
  if(!state.projects.length) {
    el.innerHTML = '<div class="projects-empty">No projects yet</div>';
    return;
  }
  el.innerHTML = state.projects.map(p => `
    <div class="project-item ${state.currentProject?.id === p.id ? 'active' : ''}" onclick="forge.projects.openProject('${p.id}')">
      <div class="project-item-icon">${p.icon || '⚙️'}</div>
      <div>
        <div class="project-item-name">${p.name}</div>
        <div class="project-item-date">${new Date(p.created_at).toLocaleDateString('en-AU')}</div>
      </div>
    </div>
  `).join('');
}

export function openProject(id) {
  const project = state.projects.find(p => p.id === id);
  if(!project) return;
  state.currentProject = project;

  // Hide home, show project
  document.getElementById('page-home').style.display = 'none';
  const projPage = document.getElementById('page-project');
  projPage.style.display = 'flex';

  // Update topbar
  document.getElementById('topbar-title').textContent = `${project.icon || '⚙️'} ${project.name}`;
  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn-ghost btn-sm" onclick="forge.projects.exportPackage()">📦 Export Package</button>
    <button class="btn-ghost btn-sm" style="margin-left:6px" onclick="navigator.clipboard.writeText(location.href).then(()=>forgeToast('Link copied','info'))">🔗 Share</button>
  `;

  // Wire tabs
  document.querySelectorAll('.proj-tab').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });

  // Load brief tab by default
  switchTab('brief');
  renderSidebar();
}

function switchTab(tab) {
  document.querySelectorAll('.proj-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(el => el.classList.toggle('active', el.id === 'tab-' + tab));

  const p = state.currentProject;
  if(!p) return;

  if(tab === 'brief')       renderBriefTab(p);
  if(tab === 'visuals')     window.forge.visuals?.render(p);
  if(tab === 'parts')       window.forge.parts?.render(p);
  if(tab === 'drawings')    window.forge.drawings?.render(p);
  if(tab === 'electronics') renderElectronicsTab(p);
  if(tab === 'preview')     window.forge.preview3d?.render(p);
  if(tab === 'package')     renderPackageTab(p);
}

function renderBriefTab(project) {
  const el = document.getElementById('tab-brief');
  if(!el) return;
  const b = project.brief || {};
  el.innerHTML = `
    <div style="max-width:800px">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px">
        <div style="font-size:48px">${project.icon || '⚙️'}</div>
        <div>
          <h2 style="font-size:24px;font-weight:800;margin-bottom:4px">${b.product_name || project.name}</h2>
          <div style="font-size:14px;color:var(--muted)">${b.tagline || ''}</div>
        </div>
      </div>

      ${b.overview ? `
        <div class="card">
          <div class="card-title">📋 Overview</div>
          <div style="font-size:13px;color:var(--muted);line-height:1.7">${b.overview}</div>
        </div>
      ` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${b.key_features?.length ? `
          <div class="card">
            <div class="card-title">⭐ Key features</div>
            ${b.key_features.map(f => `<div style="font-size:12px;color:var(--muted);padding:3px 0;border-bottom:1px solid var(--border)">· ${f}</div>`).join('')}
          </div>
        ` : ''}
        ${b.technical_requirements?.length ? `
          <div class="card">
            <div class="card-title">⚙️ Technical requirements</div>
            ${b.technical_requirements.map(r => `<div style="font-size:12px;color:var(--muted);padding:3px 0;border-bottom:1px solid var(--border)">· ${r}</div>`).join('')}
          </div>
        ` : ''}
        ${b.materials_suggested?.length ? `
          <div class="card">
            <div class="card-title">🏗️ Suggested materials</div>
            ${b.materials_suggested.map(m => `<div style="font-size:12px;color:var(--muted);padding:3px 0;border-bottom:1px solid var(--border)">· ${m}</div>`).join('')}
          </div>
        ` : ''}
        ${b.challenges?.length ? `
          <div class="card">
            <div class="card-title">⚠️ Design challenges</div>
            ${b.challenges.map(c => `<div style="font-size:12px;color:var(--amber);padding:3px 0;border-bottom:1px solid var(--border)">· ${c}</div>`).join('')}
          </div>
        ` : ''}
      </div>

      ${project.constraints && Object.values(project.constraints).some(v => v) ? `
        <div class="card" style="margin-top:12px">
          <div class="card-title">📏 Constraints</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
            ${Object.entries(project.constraints).filter(([,v])=>v).map(([k,v]) =>
              `<div><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px">${k}</div><div style="font-size:12px">${v}</div></div>`
            ).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderElectronicsTab(project) {
  const el = document.getElementById('tab-electronics');
  if(!el) return;
  const hasPCB = project.partsPrefs?.hasPCB;
  if(hasPCB === 'no') {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚡</div><div class="empty-title">No electronics in this project</div><div class="empty-desc">You indicated this is a mechanical-only design. If that changes, update your project settings.</div></div>`;
    return;
  }
  el.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⚡</div>
      <div class="empty-title">Electronics & PCB Design</div>
      <div class="empty-desc">Once your parts list is confirmed in the Parts tab, Forge will generate a schematic and PCB layout suggestion here.</div>
      <button class="btn-primary" style="margin-top:16px" onclick="forge.projects.openProject('${project.id}')">Go to Parts tab first →</button>
    </div>
  `;
}

function renderPackageTab(project) {
  const el = document.getElementById('tab-package');
  if(!el) return;
  const hasRender   = project.renders?.length > 0;
  const hasParts    = project.parts?.length > 0;
  const hasDrawings = project.drawings?.length > 0;
  const readiness   = [hasRender, hasParts, hasDrawings].filter(Boolean).length;

  el.innerHTML = `
    <div style="max-width:640px">
      <div class="card" style="margin-bottom:16px">
        <div class="card-title">📦 Manufacturing Package</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:16px;line-height:1.6">
          When your design is complete, Forge will bundle everything a manufacturer needs into a single ZIP — renders, drawings, BOM, specs, assembly notes, and cost estimates.
        </div>
        <div style="margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div style="width:16px;height:16px;border-radius:50%;background:${hasRender?'var(--green)':'var(--border)'}"></div>
            <div style="font-size:13px;color:${hasRender?'var(--text)':'var(--muted)'}">Concept renders ${hasRender ? '✓' : '— not yet generated'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div style="width:16px;height:16px;border-radius:50%;background:${hasParts?'var(--green)':'var(--border)'}"></div>
            <div style="font-size:13px;color:${hasParts?'var(--text)':'var(--muted)'}">Parts list / BOM ${hasParts ? '✓' : '— complete Parts tab first'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:16px;height:16px;border-radius:50%;background:${hasDrawings?'var(--green)':'var(--border)'}"></div>
            <div style="font-size:13px;color:${hasDrawings?'var(--text)':'var(--muted)'}">Engineering drawings ${hasDrawings ? '✓' : '— generate in Drawings tab'}</div>
          </div>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(readiness/3*100)}%"></div></div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">${readiness}/3 sections complete</div>
      </div>
      ${readiness >= 2 ? `
        <button class="btn-primary" onclick="forge.projects.exportPackage()" style="width:100%;padding:12px">📦 Download Manufacturing Package</button>
      ` : `
        <button class="btn-ghost" style="width:100%;padding:12px;cursor:not-allowed;opacity:0.5" disabled>Complete at least 2 sections to export</button>
      `}
    </div>
  `;
}

export function exportPackage() {
  forgeToast('Package export coming soon — finish Parts and Drawings tabs first', 'info');
}

export const projects = { renderSidebar, openProject, exportPackage };
window.forge = window.forge || {};
window.forge.projects = projects;
