// VERIFIQ AI Engine Router
// Mirrors OmniOrg engine-router.ts - capability-based routing across 7 AI providers.
// API keys stored in localStorage. Ollama runs locally with no key.
'use strict';

const VEngine = (() => {

  // ── Engine registry ────────────────────────────────────────────────────────
  const ENGINES = {
    ollama:    { name:'Ollama (Local)',       color:'#888888', local:true,  lsKey:null },
    groq:      { name:'Groq',                color:'#f55036', local:false, lsKey:'vq_groq_key' },
    deepseek:  { name:'DeepSeek',            color:'#1a6ef7', local:false, lsKey:'vq_deepseek_key' },
    glm:       { name:'GLM / ChatGLM',       color:'#3b5998', local:false, lsKey:'vq_glm_key' },
    gemini:    { name:'Gemini',              color:'#4285f4', local:false, lsKey:'vq_gemini_key' },
    openai:    { name:'GPT-4o',              color:'#10a37f', local:false, lsKey:'vq_openai_key' },
    anthropic: { name:'Claude',              color:'#cc785c', local:false, lsKey:'vq_claude_key' },
    builtin:   { name:'VERIFIQ Built-in AI', color:'#00b4d8', local:true,  lsKey:null },
  };

  // ── Capability chains (matches engine-router.ts) ───────────────────────────
  // 'builtin' is always last - offline fallback that never fails
  const CHAINS = {
    chat:      ['anthropic','openai','gemini','deepseek','groq','glm','ollama','builtin'],
    code:      ['deepseek','anthropic','openai','gemini','groq','glm','ollama','builtin'],
    reasoning: ['deepseek','anthropic','openai','gemini','glm','builtin'],
    fast:      ['groq','deepseek','glm','ollama','builtin'],
    batch:     ['groq','deepseek','glm','ollama','anthropic','builtin'],
    analysis:  ['anthropic','openai','gemini','deepseek','groq','glm','ollama','builtin'],
    chinese:   ['glm','deepseek','anthropic','openai','builtin'],
  };

  // ── Key management ─────────────────────────────────────────────────────────
  function getKey(id) {
    const e = ENGINES[id];
    if (!e || !e.lsKey) return null;
    return localStorage.getItem(e.lsKey) || null;
  }

  function setKey(id, val) {
    const e = ENGINES[id];
    if (!e || !e.lsKey) return;
    if (val && val.trim()) localStorage.setItem(e.lsKey, val.trim());
    else localStorage.removeItem(e.lsKey);
  }

  // ── Custom engine storage ──────────────────────────────────────────────────
  const _CUSTOM_LS_KEY = 'vq_custom_engines';

  function getCustomEngines() {
    try { return JSON.parse(localStorage.getItem(_CUSTOM_LS_KEY) || '[]'); }
    catch { return []; }
  }

  function addCustomEngine(cfg) {
    const engines = getCustomEngines();
    const id = 'cx_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
    engines.push({
      id,
      name: (cfg.name || 'Custom Engine').slice(0,50),
      url:  cfg.url   || '',
      model:cfg.model || 'gpt-4o',
      key:  cfg.key   || '',
      authStyle: cfg.authStyle || 'bearer'
    });
    localStorage.setItem(_CUSTOM_LS_KEY, JSON.stringify(engines));
    return id;
  }

  function removeCustomEngine(id) {
    localStorage.setItem(_CUSTOM_LS_KEY,
      JSON.stringify(getCustomEngines().filter(e => e.id !== id)));
  }

  function isConfigured(id) {
    if (id.startsWith('cx_')) {
      const cx = getCustomEngines().find(e => e.id === id);
      return cx ? !!cx.url : false;
    }
    const e = ENGINES[id];
    if (!e) return false;
    return e.local || !!getKey(id);
  }

  // ── Engine callers ─────────────────────────────────────────────────────────
  function _msgs(prompt, sys) {
    return [
      ...(sys ? [{ role:'system', content:sys }] : []),
      { role:'user', content:prompt }
    ];
  }

  async function _openaiCompat(url, model, prompt, sys, key, timeoutMs) {
    const r = await fetch(url, {
      method:'POST',
      headers:{ 'Authorization':'Bearer '+key, 'Content-Type':'application/json' },
      body: JSON.stringify({ model, messages:_msgs(prompt,sys), max_tokens:2048 }),
      signal: AbortSignal.timeout(timeoutMs || 30000)
    });
    if (!r.ok) throw new Error('HTTP '+r.status);
    const d = await r.json();
    return d.choices?.[0]?.message?.content || '';
  }

  async function _callOllama(prompt, sys) {
    const r = await fetch('http://localhost:11434/api/chat', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ model:'llama3', messages:_msgs(prompt,sys), stream:false }),
      signal: AbortSignal.timeout(60000)
    });
    if (!r.ok) throw new Error('Ollama HTTP '+r.status);
    const d = await r.json();
    return d.message?.content || d.response || '';
  }

  async function _callGroq(prompt, sys, key) {
    return _openaiCompat('https://api.groq.com/openai/v1/chat/completions',
      'llama-3.3-70b-versatile', prompt, sys, key, 20000);
  }

  async function _callDeepSeek(prompt, sys, key) {
    return _openaiCompat('https://api.deepseek.com/chat/completions',
      'deepseek-chat', prompt, sys, key, 60000);
  }

  async function _callGLM(prompt, sys, key) {
    return _openaiCompat('https://open.bigmodel.cn/api/paas/v4/chat/completions',
      'glm-4-plus', prompt, sys, key, 60000);
  }

  async function _callGemini(prompt, sys, key) {
    const body = {
      contents:[{ parts:[{ text: prompt }] }],
      ...(sys ? { systemInstruction:{ parts:[{ text:sys }] } } : {})
    };
    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key='+key,
      { method:'POST', headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify(body), signal:AbortSignal.timeout(30000) }
    );
    if (!r.ok) throw new Error('Gemini HTTP '+r.status);
    const d = await r.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async function _callOpenAI(prompt, sys, key) {
    return _openaiCompat('https://api.openai.com/v1/chat/completions',
      'gpt-4o', prompt, sys, key, 30000);
  }

  async function _callAnthropic(prompt, sys, key) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{ 'x-api-key':key, 'anthropic-version':'2023-06-01', 'Content-Type':'application/json' },
      body: JSON.stringify({
        model:'claude-sonnet-4-6',
        messages:[{ role:'user', content:prompt }],
        ...(sys ? { system:sys } : {}),
        max_tokens:2048
      }),
      signal: AbortSignal.timeout(30000)
    });
    if (!r.ok) throw new Error('Anthropic HTTP '+r.status);
    const d = await r.json();
    return d.content?.[0]?.text || '';
  }

  // ── Custom engine caller ──────────────────────────────────────────────────
  async function _callCustom(cx, prompt, sys) {
    const headers = { 'Content-Type': 'application/json' };
    const style = cx.authStyle || 'bearer';
    if (style === 'x-api-key' && cx.key) {
      headers['x-api-key'] = cx.key;
      headers['anthropic-version'] = '2023-06-01';
    } else if (style === 'basic' && cx.key) {
      headers['Authorization'] = 'Basic ' + btoa(cx.key);
    } else if (style !== 'none' && cx.key) {
      headers['Authorization'] = 'Bearer ' + cx.key;
    }
    const r = await fetch(cx.url, {
      method: 'POST', headers,
      body: JSON.stringify({ model: cx.model, messages: _msgs(prompt, sys), max_tokens: 2048 }),
      signal: AbortSignal.timeout(60000)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    return d.choices?.[0]?.message?.content || d.content?.[0]?.text || d.result || '';
  }

  // ── Built-in offline IFC/BIM knowledge base ───────────────────────────────
  // Delegates to EmbeddedAI (950+ super agents) when loaded; falls back to
  // a minimal keyword handler so the builtin engine never fails cold.
  function _callBuiltIn(prompt) {
    if (window._embeddedAIReady && typeof window._embeddedAIQuery === 'function') {
      return window._embeddedAIQuery(prompt);
    }
    const q = (prompt || '').toLowerCase();

    // Compliance score
    if (/score|rating|percentage|how (well|good)/i.test(q)) {
      return Promise.resolve(`## Compliance Score

**Summary:** Your compliance score measures what percentage of IFC elements pass all applicable code rules.

**Key Issues to watch:**
- **Critical (L1):** Elements that directly violate mandatory CORENET-X or NBeS rules. These block submission.
- **Error (L2):** Missing required properties (e.g. \`Pset_WallCommon.LoadBearing\`). Must be fixed before export.
- **Warning (L3):** Informational gaps - recommended but not blocking.

**Recommendations:**
1. Fix all Critical findings first - use the **Critical Issues** panel in the sidebar.
2. Use the **Property Editor** to add missing properties directly without leaving VERIFIQ.
3. Re-run validation after each fix to see your score improve.
4. Target 95%+ before submitting to CORENET-X.`);
    }

    // IFC+SG / Singapore standards
    if (/corenet|ifc.?sg|singapore|bca|scdf|ura|pud|lta|hdb|spa|nea|sla/i.test(q)) {
      return Promise.resolve(`## Singapore IFC+SG Standards (CORENET-X)

**Standard:** IFC+SG Industry Mapping COP 3.1 (December 2025)
**Agencies covered:** BCA, SCDF, URA, PUB, LTA, HDB, SLA, NEA, NParks, JTC (10 agencies)
**Classification codes:** 196 | **Property rules:** 946

**CORENET-X Gateways:**
| Gateway | Purpose |
|---------|---------|
| Design | Concept approval - structural, fire zones, accessibility |
| Piling | Foundation approval before ground break |
| Construction | Building permit - full compliance check |
| Completion | TOP/CSC - final as-built verification |

**Key IFC+SG requirements:**
- All elements must have \`IFC+SG_Code\` classification from the BCA Industry Mapping
- Fire compartments: \`Pset_SpaceFireSafetyRequirements.FireHazardFactor\`
- Accessibility: \`Pset_DoorCommon.HandicapAccessible\` on all public doors
- Structural: \`Pset_WallCommon.LoadBearing\` and \`Pset_SlabCommon.LoadBearing\`

To check which gateway applies to your submission, set it in **Settings > Singapore Gateway**.`);
    }

    // Malaysia NBeS
    if (/nbes|malaysia|my|jabatan|jkr|bomba|dpw/i.test(q)) {
      return Promise.resolve(`## Malaysia NBeS Standards

**Standard:** NBeS (National BIM e-Submission) 2024.1
**Compliance rules:** 52 property rules across structural, fire, and spatial checks

**Key NBeS requirements:**
- \`Pset_WallCommon.FireRating\` on all fire-rated walls
- \`Pset_SpaceCommon.GrossPlannedArea\` on all spaces
- \`Pset_BuildingCommon.OccupancyType\` at building level
- \`Pset_DoorCommon.FireRating\` on all fire doors

**Submission portal:** e-Submission JKR Malaysia
Set **Mode > Malaysia** in the top bar to activate NBeS rule checks.`);
    }

    // IFC properties / property sets
    if (/pset|property|ifc property|ifcpropertyset|attribute/i.test(q)) {
      return Promise.resolve(`## IFC Property Sets (Psets)

**What they are:** Psets are named groups of properties attached to IFC elements. CORENET-X and NBeS require specific Psets on specific element types.

**Commonly missing Psets:**
| Element | Required Pset | Key Property |
|---------|--------------|--------------|
| IfcWall | Pset_WallCommon | LoadBearing, FireRating |
| IfcSlab | Pset_SlabCommon | LoadBearing |
| IfcDoor | Pset_DoorCommon | FireRating, HandicapAccessible |
| IfcSpace | Pset_SpaceCommon | GrossPlannedArea |
| IfcBuildingStorey | Pset_BuildingStoreyCommon | AboveGround |

**How to fix missing properties:**
1. Go to **Property Editor** in the sidebar
2. Select the element type
3. Add the missing Pset and property value
4. Save - VERIFIQ writes the corrected IFC file

Or fix in your BIM authoring tool (Revit, ArchiCAD, Vectorworks) and re-export.`);
    }

    // How to fix / fix findings
    if (/fix|repair|how to|correct|resolve|remediat/i.test(q)) {
      return Promise.resolve(`## How to Fix VERIFIQ Findings

**Step-by-step fix workflow:**

**1. Prioritise by severity**
- Start with **Critical** findings (sidebar > Critical Issues)
- Then **Error** findings (sidebar > All Results, filter by Error)

**2. Use the built-in Property Editor**
- Sidebar > **Property Editor**
- Filter by element type (e.g. IfcWall)
- Add/edit property values directly
- Click **Apply Changes** - VERIFIQ saves a corrected IFC

**3. Fix classification codes**
- Every element needs an IFC+SG classification code (\`IFC+SG_Code\`)
- Use the BCA Industry Mapping Excel importer: Settings > Manual Import from go.gov.sg/ifcsg
- Re-run validation after importing

**4. Fix in your BIM tool**
- For structural changes (geometry, level associations): fix in Revit/ArchiCAD, re-export IFC
- Use IFC 2x3 Coordination View 2.0 or IFC 4 Reference View export settings

**5. Validate again**
- Run Validation to see your updated score
- Repeat until Critical and Error counts are 0`);
    }

    // What is VERIFIQ / general questions
    if (/what is verifiq|what does verifiq|about verifiq|verifiq/i.test(q)) {
      return Promise.resolve(`## About VERIFIQ v2.2.0

VERIFIQ is an IFC compliance checker for Singapore CORENET-X and Malaysia NBeS developed by BBMW0 Technologies.

**What it does:**
- Loads IFC 2x3 and IFC 4 model files
- Runs 206+ Singapore IFC+SG classification checks and 962 property rules
- Runs 52 Malaysia NBeS property checks
- Generates compliance scores and reports (PDF, Excel, Word, BCF)
- Exports corrected IFC files via the built-in Property Editor

**Licence tiers:**
- **Trial:** 1 file, basic checks
- **Individual:** Full checks, single user
- **Team:** Multi-file batch, shared project space

**Version:** 2.2.0 | **Rules:** IFC+SG COP 3.1 (December 2025) + NBeS 2024.1
**Developer:** Jia Wen Gan and Mohamed Zaki Mohamed Mohamed, BBMW0 Technologies | bbmw0.com`);
    }

    // Generic IFC question
    return Promise.resolve(`## VERIFIQ AI Assistant

I can answer questions about:
- **IFC compliance** - CORENET-X, NBeS rules, property requirements
- **Fixing findings** - how to resolve Critical, Error, and Warning issues
- **IFC+SG standards** - Singapore BCA, SCDF, URA, PUB, LTA, HDB, SLA, NEA requirements
- **Malaysia NBeS** - property and spatial requirements
- **Workflow** - loading files, running validation, exporting reports

**To unlock AI analysis of your loaded IFC model**, configure an API key via the **API Keys** button at the top right:
- **Claude (Anthropic):** Best quality - get key at console.anthropic.com
- **Groq:** Free tier - get key at console.groq.com
- **DeepSeek:** Free tier - get key at platform.deepseek.com

Try asking: *"What are the most common Critical findings?"* or *"How do I fix missing IFC+SG classification codes?"*`);
  }

  async function _callOne(id, prompt, sys) {
    const key = getKey(id);
    switch(id) {
      case 'ollama':    return _callOllama(prompt, sys);
      case 'groq':      return _callGroq(prompt, sys, key);
      case 'deepseek':  return _callDeepSeek(prompt, sys, key);
      case 'glm':       return _callGLM(prompt, sys, key);
      case 'gemini':    return _callGemini(prompt, sys, key);
      case 'openai':    return _callOpenAI(prompt, sys, key);
      case 'anthropic': return _callAnthropic(prompt, sys, key);
      case 'builtin':   return _callBuiltIn(prompt);
      default: {
        const cx = getCustomEngines().find(e => e.id === id);
        if (cx) return _callCustom(cx, prompt, sys);
        throw new Error('Unknown engine: '+id);
      }
    }
  }

  // ── Core router ────────────────────────────────────────────────────────────
  async function route(capability, prompt, systemPrompt) {
    const chain = CHAINS[capability] || CHAINS.chat;
    // Prepend configured custom engines (user's own APIs take priority)
    const customIds = getCustomEngines().filter(cx => !!cx.url).map(cx => cx.id);
    const fullChain = customIds.length ? [...customIds, ...chain] : chain;
    const errs = [];
    for (const id of fullChain) {
      if (!isConfigured(id)) continue;
      try {
        const text = await _callOne(id, prompt, systemPrompt);
        if (text && text.trim()) return { text:text.trim(), engine:id, engineName:ENGINES[id].name, fallback:errs.length>0 };
      } catch(err) {
        errs.push(id+': '+err.message);
      }
    }
    throw new Error('All engines failed: ' + (errs.join(' | ') || 'no engines configured'));
  }

  // ── Availability probe ─────────────────────────────────────────────────────
  async function getStatus() {
    const out = {};
    for (const [id, e] of Object.entries(ENGINES)) {
      out[id] = { ...e, id, configured: isConfigured(id), online: false, models:[] };
    }
    // Probe Ollama (local)
    try {
      const r = await fetch('http://localhost:11434/api/tags', { signal:AbortSignal.timeout(2000) });
      if (r.ok) {
        const d = await r.json();
        out.ollama.online = true;
        out.ollama.models = (d.models||[]).map(m=>m.name);
      }
    } catch {}
    // Mark API-key engines as online if key is set (we can't probe without spending tokens)
    for (const id of ['groq','deepseek','glm','gemini','openai','anthropic']) {
      if (getKey(id)) out[id].online = true;
    }
    // Include custom engines
    for (const cx of getCustomEngines()) {
      out[cx.id] = {
        id: cx.id, name: cx.name, color: '#9b59b6', local: false,
        lsKey: null, configured: !!cx.url, online: !!cx.url, models: [],
        custom: true, url: cx.url, model: cx.model
      };
    }
    return out;
  }

  // ── BIM-specific helpers ────────────────────────────────────────────────────
  // Uses the richer startup system prompt from verifiq-intelligence.js when loaded
  function _getIFCSys() {
    return (window._verifiqSystemPrompt) || IFC_SYS_FALLBACK;
  }
  const IFC_SYS_FALLBACK = `You are VERIFIQ AI, an expert BIM compliance engineer specialising in IFC models and Singapore CORENET-X / Malaysia NBeS building code compliance. 10 Singapore agencies: BCA, SCDF, URA, PUB, LTA, HDB, SLA, NEA, NParks, JTC.
You give concise, actionable answers structured as: **Summary**, **Key Issues**, **Recommendations**. Use markdown.`;

  async function analyzeCompliance(session) {
    const prompt = `Analyze this IFC compliance report and give priority recommendations:

**Country Mode:** ${session.countryMode || 'Singapore'}
**Score:** ${typeof session.score==='number' ? session.score.toFixed(1)+'%' : 'N/A'}
**Total Elements:** ${session.totalElements || 0}
**Critical:** ${session.criticalElements||0} | **Error:** ${session.errorElements||0} | **Warning:** ${session.warningElements||0} | **Pass:** ${session.passedElements||0}
**Gateway:** ${session.sgGateway || 'N/A'}

Identify the top 3 compliance risks and the fastest path to improving the score.`;
    return route('analysis', prompt, _getIFCSys());
  }

  async function explainFinding(finding) {
    const prompt = `Explain this BIM compliance finding and how to fix it:

**Element:** ${finding.name||'?'} (${finding.cls||''})
**Severity:** ${finding.severity||'?'}
**Check:** ${finding.check||''}
**Message:** ${finding.message||''}
**Property:** ${finding.prop||''} = "${finding.value||''}"

Explain: 1) What it means, 2) Why it matters for ${finding.country||'Singapore'} code, 3) Exact fix steps in BIM software.`;
    return route('reasoning', prompt, _getIFCSys());
  }

  async function askAboutModel(question, context) {
    const sys = _getIFCSys() + '\n\nCurrently loaded IFC model context:\n' + (context||'No model loaded yet.');
    return route('chat', question, sys);
  }

  async function generateExecutiveSummary(session) {
    const sys = _getIFCSys() + '\n\nWrite as a senior consultant preparing a director-level executive summary. Professional tone, business impact focus.';
    const prompt = `Write a 3-paragraph executive summary for this IFC compliance report:

Score: ${typeof session.score==='number' ? session.score.toFixed(1)+'%' : 'N/A'} | Mode: ${session.countryMode||'Singapore'}
Critical: ${session.criticalElements||0} | Errors: ${session.errorElements||0} | Warnings: ${session.warningElements||0} | Pass: ${session.passedElements||0}
Total: ${session.totalElements||0} elements | Gateway: ${session.sgGateway||'N/A'}

Para 1: Overall status. Para 2: Key risks and business impacts. Para 3: Recommended next steps and timeline.`;
    return route('analysis', prompt, sys);
  }

  async function suggestFixes(findings) {
    const top = findings.slice(0,10).map((f,i)=>`${i+1}. [${f.severity}] ${f.check}: ${f.message}`).join('\n');
    const prompt = `Provide specific BIM software steps to fix these compliance findings. For each, give the exact property name, required value, and steps in Revit and ArchiCAD:\n\n${top}`;
    return route('code', prompt, _getIFCSys());
  }

  return {
    route, getStatus, getKey, setKey, isConfigured,
    analyzeCompliance, explainFinding, askAboutModel,
    generateExecutiveSummary, suggestFixes,
    getCustomEngines, addCustomEngine, removeCustomEngine,
    ENGINES, CHAINS
  };
})();

window.VEngine = VEngine;
