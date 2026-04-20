// ── FORGE — Main Entry Point ──────────────────────────────────────────────────
import './ui.js'
import './supabase.js'
import { wizard }    from './wizard.js'
import { projects }  from './projects.js'
import { visuals }   from './visuals.js'
import { parts }     from './parts.js'
import { drawings }  from './drawings.js'
import { preview3d } from './preview3d.js'

// Expose forge namespace
window.forge = { wizard, projects, visuals, parts, drawings, preview3d };

// Boot sequence
async function boot() {
  const fill = document.getElementById('loading-fill');
  const msg  = document.getElementById('loading-msg');
  const setP = (p, m) => { if(fill) fill.style.width=p+'%'; if(msg) msg.textContent=m; };

  setP(20, 'Loading Forge...');
  await sleep(200);

  setP(60, 'Ready');
  await sleep(200);

  setP(100, 'Welcome to Forge');
  await sleep(300);

  // Hide loading, show app
  document.getElementById('forge-loading').style.display = 'none';
  document.getElementById('forge-app').style.display = 'flex';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

boot();
