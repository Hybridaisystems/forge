# Forge — AI Product Design Studio

## What this is
Forge is a standalone web app that takes a user from product idea to manufacturing-ready package using AI. Users describe what they want to build, get concept renders, find existing parts from real suppliers, generate engineering drawings, and download a complete manufacturing handoff package.

## Tech Stack
- **Frontend:** Vite + vanilla JS (ES modules) — NO frameworks, NO React
- **3D Preview:** Three.js (CDN)
- **Canvas annotations:** Fabric.js (CDN)
- **SVG drawings:** Generated programmatically with vanilla JS
- **AI:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) via /.netlify/functions/anthropic-proxy (POST). Haiku is the default because Netlify sync functions cap at 10s (free) / 26s (Pro) and Sonnet 4.6 reliably 504s on briefs/drawings. Use Sonnet only via a Background Function (see below).
- **Images:** DALL-E 3 via /.netlify/functions/image-proxy (POST)
- **Parts search:** /.netlify/functions/parts-search-background (POST) — Background Function (up to 15 min). Client inserts a row in `parts_search_jobs`, POSTs the job_id to the function, then polls the row. Uses Sonnet + `web_search`.
- **Storage:** Supabase (projects, versions, parts, uploads)
- **Deploy:** Netlify (GitHub → auto deploy)

## Key Architecture Rules
- ALL API keys live in Netlify env vars — NEVER in frontend code
- ALL Anthropic calls go through /.netlify/functions/anthropic-proxy
- ALL image generation goes through /.netlify/functions/image-proxy
- Use window.forgeAPI() wrapper for all API calls with retry on 429 (504/502 fail fast)
- Every module registers functions on window.forge namespace
- State lives in window._forgeState — single source of truth
- Default model: Haiku 4.5 with `max_tokens` ≤ 2000. Anything larger or slower (long briefs, Sonnet-quality work) must go through a Background Function (`*-background.js`, 15-min limit) with client-side polling — not the sync proxy.

## Project Structure
```
/src/js/
  main.js          — imports, init
  state.js         — global state management
  api.js           — API wrapper (retry, error handling)
  wizard.js        — new project wizard (5 steps)
  brief.js         — design brief module
  visuals.js       — concept render + canvas annotations
  parts.js         — parts search + BOM management
  supabase.js      — tiny fetch-based Supabase REST client (insert/select)
  drawings.js      — 2D engineering drawing generator
  electronics.js   — PCB/schematic module
  preview3d.js     — Three.js 3D preview
  package.js       — manufacturing package builder
  projects.js      — project CRUD + versioning
  ui.js            — nav, modals, toasts, routing
/src/css/
  main.css         — all styles
/netlify/functions/
  anthropic-proxy.js            — sync Claude calls (Haiku, ≤10s free / ≤26s Pro)
  image-proxy.js                — DALL-E image generation
  parts-search-background.js    — Sonnet + web_search via Background Function (15-min limit)
index.html
```

## Design Language
- Dark theme: bg #0a0a0f, surface #12121a, border rgba(255,255,255,0.08)
- Accent: Electric blue #2563eb, success #10b981, warning #f59e0b, danger #ef4444
- Font: Inter (Google Fonts)
- Rounded corners: 8px standard, 12px cards, 16px modals
- The UI should feel like a premium engineering tool — precise, clean, dark

## Supabase Tables
```sql
projects (id, user_id, name, description, status, created_at, updated_at)
project_versions (id, project_id, version, brief, renders, parts, drawings, notes)
parts_library (id, project_id, name, part_number, supplier, price_single, price_100, price_1000, specs, datasheet_url, status)
uploads (id, project_id, type, filename, url, parsed_content)
annotations (id, project_id, version_id, image_url, x, y, w, h, note, resolved)
parts_search_jobs (id, status, requirements, category, result, error, created_at, completed_at)
```

## Env Vars needed in Netlify
- ANTHROPIC_KEY — Claude API key
- OPENAI_KEY — DALL-E 3 image generation
- SUPABASE_URL
- SUPABASE_ANON_KEY

## Current Status
BUILDING FROM SCRATCH — Session 1

## The 5-Step New Project Wizard
1. What are you making? (free text + AI clarifying questions)
2. Upload references (images, PDFs, Word, URLs, hand sketches)
3. Constraints (size, weight, power, environment, cost, quantity)
4. Parts preference (search existing vs design custom, suppliers, certifications)
5. Generate (concept render + design brief)

## Key User Interactions
- Canvas annotation: click/box/circle/arrow on renders to request changes
- Parts search: requirement → AI searches Digikey/Mouser/McMaster/RS → ranked results
- Version history: every major change creates a new version
- Share link: read-only view for manufacturers/investors
- Export: ZIP containing all drawings, BOM, specs, renders

## Writing Style for Code
- Vanilla JS only — no TypeScript, no JSX
- Async/await throughout
- Functions named descriptively: forgeGenerateRender(), forgeSearchParts()
- Comments on every major section
- Error handling on every async call
- Mobile responsive where possible
