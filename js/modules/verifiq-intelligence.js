// VERIFIQ Intelligence Config
// Embedded startup knowledge for the AI assistant - activates all engines and domain expertise
// on first load. Equivalent to the master configuration files that define VERIFIQ's AI behaviour.
'use strict';

window._verifiqIntelligence = (() => {

  // ── Core system prompt (injected into every AI call) ──────────────────────
  const SYSTEM_PROMPT = `You are VERIFIQ AI, the embedded intelligence for VERIFIQ v2.2.0 by BBMW0 Technologies.
You are an expert BIM compliance engineer and Singapore/Malaysia building code specialist.

EXPERTISE:
- IFC 2x3 and IFC 4 file format, schema, property sets, classification systems
- Singapore CORENET-X: IFC+SG COP 3.1 (December 2025), all 10 agencies (BCA, SCDF, URA, PUB, LTA, HDB, SLA, NEA, NParks, JTC)
- Malaysia NBeS 2024.1: property rules, spatial checks, submission workflow
- BCA Building Control Act, SCDF Fire Safety Act, URA Planning Act, PUB drainage code
- IFC property sets: Pset_WallCommon, Pset_SlabCommon, Pset_DoorCommon, Pset_SpaceCommon
- CORENET-X gateway stages: Design, Piling, Construction, Completion
- BCF issue format, IDS validation, COBie data exchange
- Revit, ArchiCAD, Vectorworks IFC export settings and common export errors

RESPONSE STYLE:
- Concise and actionable. Use markdown: **bold** for key terms, ## for headings, tables for structured data.
- Structure: Summary -> Key Issues -> Recommendations (with numbered steps).
- Reference specific Pset names, property names, and classification codes.
- When giving fix instructions, specify exact steps for Revit, ArchiCAD, or generic BIM tools.

VERIFIQ CAPABILITIES:
- Loads IFC files up to 600 GB using streaming parser (no memory limit for reading)
- Runs 206+ IFC+SG classification checks and 962 property rule checks
- 10 Singapore agencies: BCA(1) SCDF(2) URA(3) PUB(4) LTA(5) HDB(6) SLA(7) NEA(8) NParks(9) JTC(10)
- Generates PDF, Excel, Word, BCF reports
- Built-in Property Editor for fixing missing properties without leaving the app
- OmniOrg engine router: 7 built-in AI providers + unlimited custom API engines
- GPU/CPU-accelerated IFC geometry processing via web-ifc`;

  // ── Agency reference (the 9 SG agencies) ─────────────────────────────────
  const SG_AGENCIES = [
    { code:'BCA',    name:'Building and Construction Authority',  domain:'Structure, architectural, materials' },
    { code:'SCDF',   name:'Singapore Civil Defence Force',        domain:'Fire safety, means of escape, suppression' },
    { code:'URA',    name:'Urban Redevelopment Authority',        domain:'Planning, GFA, use, setbacks' },
    { code:'PUB',    name:'Public Utilities Board',              domain:'Drainage, sewage, water supply' },
    { code:'LTA',    name:'Land Transport Authority',            domain:'Transport access, loads, tunnels' },
    { code:'HDB',    name:'Housing & Development Board',         domain:'Public housing estates, precinct rules' },
    { code:'SLA',    name:'Singapore Land Authority',            domain:'Survey, land title, boundaries' },
    { code:'NEA',    name:'National Environment Agency',         domain:'Waste, noise, air quality, hawker' },
    { code:'NParks', name:'National Parks Board',               domain:'Landscape, greenery, heritage trees' },
  ];

  // ── Engine capability matrix ──────────────────────────────────────────────
  const ENGINE_MATRIX = {
    'Chat & general Q&A':      'Claude (Anthropic) → GPT-4o → Gemini → DeepSeek → Groq → Custom',
    'Code & property analysis':'DeepSeek → Claude → GPT-4o → Groq → Custom',
    'Multi-step reasoning':    'DeepSeek → Claude → GPT-4o → Gemini → Custom',
    'Fast responses':          'Groq → DeepSeek → Custom → Ollama',
    'Batch processing':        'Groq → DeepSeek → Ollama → Claude → Custom',
    'BIM compliance analysis': 'Claude → GPT-4o → Gemini → DeepSeek → Custom',
    'Custom/corporate AI':     'Always first in chain when configured',
    'Built-in offline mode':   'Always available, no API key, 950+ knowledge patterns',
  };

  // ── Startup initialisation ────────────────────────────────────────────────
  function init() {
    // Inject the richer system prompt into VEngine's IFC_SYS if accessible
    if (window.VEngine && typeof VEngine === 'object') {
      // We cannot directly overwrite IFC_SYS (it's closed over) but we can
      // set a global that askAboutModel will pick up via _buildCtx injection.
      window._verifiqSystemPrompt = SYSTEM_PROMPT;
    }
    // Mark as ready so embedded-ai.js knows full intelligence is loaded
    window._verifiqIntelligenceReady = true;
    // Expose agency reference for other modules
    window._sgAgencies = SG_AGENCIES;
    window._engineMatrix = ENGINE_MATRIX;
  }

  // Run on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { SYSTEM_PROMPT, SG_AGENCIES, ENGINE_MATRIX, init };
})();
