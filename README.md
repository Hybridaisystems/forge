# Forge — AI Product Design Studio

From idea to manufacturing package using AI.

## Features
- AI concept render generation (DALL-E 3)
- Canvas annotation system for iterative design
- Real parts search (Digikey, Mouser, McMaster-Carr, RS Components)
- Automated BOM with pricing
- Engineering drawings (dimensioned SVG)
- Interactive 3D preview (Three.js)
- Manufacturing package export

## Setup

1. Clone the repo
2. `npm install`
3. Create a Netlify site and add env vars:
   - `ANTHROPIC_KEY` — Claude API key
   - `OPENAI_KEY` — DALL-E 3 image generation
4. `npm run dev` for local development (Note: Netlify functions need `netlify dev`)

## Tech Stack
- Vite + Vanilla JS
- Claude Sonnet (AI reasoning, parts search, drawing specs)
- DALL-E 3 (concept renders)
- Three.js (3D preview)
- Netlify Functions (API proxies)
- Supabase (coming soon — project persistence)

## Deployment
Push to GitHub → Netlify auto-deploys on every push.
