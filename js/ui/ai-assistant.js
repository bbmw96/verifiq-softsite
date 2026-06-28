// VERIFIQ AI Assistant Page
// Powered by VEngine - 7-provider engine router (Ollama, Groq, DeepSeek, GLM, Gemini, GPT-4o, Claude)
'use strict';

const AiAssistantPage = (() => {

  let _status   = {};
  let _messages = [];

  // ── Tiny safe DOM helpers ──────────────────────────────────────────────────
  function _el(tag, css, txt) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  function _app(parent) {
    for (let i = 1; i < arguments.length; i++) {
      const c = arguments[i];
      if (c == null) continue;
      if (c instanceof Node) parent.appendChild(c);
      else parent.appendChild(document.createTextNode(String(c)));
    }
    return parent;
  }
  function _attr(el, attrs) {
    for (const [k,v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }
  function _cls(el, c) { el.className = c; return el; }

  // ── Engine bar (DOM-built) ─────────────────────────────────────────────────
  function _buildEngineBar(container) {
    container.textContent = '';
    const map = (Object.keys(_status).length > 0) ? _status
      : Object.fromEntries(Object.entries(VEngine.ENGINES).map(([id,e])=>[id,{...e,id,online:false,configured:false}]));

    for (const [id,s] of Object.entries(map)) {
      const online = s.online === true;
      const configured = s.configured === true;
      const color = online ? (s.color||'#00d4ff') : (configured ? '#4a6890' : '#1a2840');
      const chip = _el('div', 'display:flex;align-items:center;gap:4px;background:#0a1520;border-radius:12px;padding:3px 8px;border:1px solid '+(online?color+'44':'#0a1520'));
      const dot = _el('span', 'font-size:8px;color:'+color, online ? '●' : (configured ? '○' : '·'));
      const lbl = _el('span', 'font-size:10px;color:'+(online?'#c0d8f0':'#4a6890'), s.name||id);
      _attr(chip, { title: (s.name||id) + ': ' + (online ? 'Online' : (configured ? 'Key configured' : 'Not configured')) });
      _app(chip, dot, lbl);
      if (s.models && s.models.length) {
        _app(chip, _el('span','font-size:8px;color:#4a6890', '('+s.models.length+')'));
      }
      container.appendChild(chip);
    }
  }

  // ── Routing legend (DOM-built) ─────────────────────────────────────────────
  function _buildRoutingLegend(container) {
    container.textContent = '';
    const caps = [
      {c:'CHAT',      col:'#00d4ff', first:'Claude'},
      {c:'CODE',      col:'#1a6ef7', first:'DeepSeek'},
      {c:'REASONING', col:'#a855f7', first:'DeepSeek'},
      {c:'FAST',      col:'#f55036', first:'Groq'},
      {c:'ANALYSIS',  col:'#00ff88', first:'Claude'},
    ];
    for (const r of caps) {
      const chip = _el('div', 'display:flex;align-items:center;gap:3px;background:#0a1520;border-radius:3px;padding:2px 6px;border-left:2px solid '+r.col);
      _app(chip,
        _el('span','font-size:8px;font-weight:700;color:'+r.col, r.c),
        _el('span','font-size:8px;color:#2a4060', ' '+r.first+'→…')
      );
      container.appendChild(chip);
    }
  }

  // ── Model context (DOM-built) ──────────────────────────────────────────────
  function _buildModelContext(container) {
    container.textContent = '';
    const st  = VState.get();
    const files = st.filesLoaded || [];
    if (!files.length) {
      container.appendChild(_el('span','color:#2a4060', 'No IFC file loaded.'));
      return;
    }
    const lines = [
      ['File',    (files[0] && files[0].name) ? files[0].name : (files[0]||'IFC File')],
      ['Mode',    st.countryMode || 'Singapore'],
    ];
    if (st.session) {
      const s = st.session;
      lines.push(['Score',    typeof s.score==='number' ? s.score.toFixed(1)+'%' : 'N/A']);
      lines.push(['Elements', String(s.totalElements||0)]);
      lines.push(['Critical', String(s.criticalElements||0) + ' | Err: '+(s.errorElements||0)]);
    } else {
      lines.push(['Status', 'Not validated']);
    }
    for (const [k,v] of lines) {
      const row = _el('div', 'margin-bottom:3px');
      _app(row,
        _el('span','color:#4a6890;margin-right:4px', k+':'),
        _el('span','color:#c0d8f0', v)
      );
      container.appendChild(row);
    }
  }

  // ── Chat message builder ───────────────────────────────────────────────────
  function _appendMsg(role, text, engineName) {
    const log = document.getElementById('ai-chat-log');
    if (!log) return;
    const isUser = role === 'user';

    const wrap = _el('div', 'display:flex;flex-direction:column;align-items:'+(isUser?'flex-end':'flex-start')+';gap:3px');
    const bubble = _el('div', 'max-width:82%;padding:10px 14px;border-radius:8px;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-word;'+(
      isUser ? 'background:#0e2a4a;color:#c0d8f0;border:1px solid #1a3354'
             : 'background:#0a1520;color:#c0d8f0;border:1px solid #0f2040'
    ));
    bubble.textContent = text;
    _app(wrap, bubble);
    if (!isUser && engineName) {
      _app(wrap, _el('div','font-size:9px;color:#2a4060;padding:0 4px', '▲ '+engineName));
    }
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
    _messages.push({ role, content: text });
  }

  // ── Render (returns static HTML - no user data) ────────────────────────────
  function render() {
    const B = 'background:#0e2035;border:1px solid #1a3354;border-radius:4px;padding:4px 10px;color:#8aaac8;cursor:pointer;font-size:11px';
    const QB = (label, onclick, bg, col) =>
      `<button onclick="${onclick}" style="display:block;width:100%;text-align:left;background:${bg||'#0a1a2e'};border:1px solid #1a3354;border-radius:4px;padding:7px 10px;color:${col||'#9ab8d4'};cursor:pointer;font-size:12px;margin-bottom:5px;font-weight:500">${label}</button>`;

    return `<div style="display:flex;flex-direction:column;height:calc(100vh - 110px);background:#080f1d;overflow:hidden">
  <div style="padding:12px 20px;background:#060d1b;border-bottom:1px solid #0f2040;display:flex;align-items:center;gap:12px;flex-shrink:0">
    <div style="font-size:18px;font-weight:800;color:#00d4ff;letter-spacing:.04em">AI ASSISTANT</div>
    <div style="font-size:11px;color:#4a6890">OmniOrg Engine Router · 7 Providers + Custom APIs · Capability-Based Routing</div>
    <div style="margin-left:auto;display:flex;gap:6px">
      <button onclick="AiAssistantPage.probeEngines()" style="${B}">🔍 Probe Engines</button>
      <button onclick="AiAssistantPage.showSettings()" style="${B}">⚙️ API Keys</button>
    </div>
  </div>
  <div id="ai-engine-bar" style="display:flex;gap:4px;padding:8px 16px;background:#04080f;border-bottom:1px solid #0a1520;flex-shrink:0;flex-wrap:wrap"></div>
  <div id="ai-route-legend" style="display:flex;gap:6px;padding:4px 16px 6px;background:#04080f;border-bottom:1px solid #0a1520;flex-shrink:0;flex-wrap:wrap"></div>
  <div style="flex:1;display:flex;min-height:0">
    <div style="flex:1;display:flex;flex-direction:column;min-width:0">
      <div id="ai-chat-log" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px">
        <div style="background:#0a1a2e;border:1px solid #1a3354;border-radius:8px;padding:16px;max-width:560px">
          <div style="font-size:14px;font-weight:700;color:#00d4ff;margin-bottom:8px">VERIFIQ AI Assistant</div>
          <div style="font-size:12px;color:#8aabca;line-height:1.6;margin-bottom:10px">Powered by OmniOrg engine router - routes questions to the best available AI engine. Add your API key for Groq, DeepSeek, GLM, Gemini, GPT-4o, or Claude in API Keys. No key? Click API Keys and configure one free provider (Groq or DeepSeek both offer free tiers).</div>
          <div style="font-size:11px;color:#4a6890">Try: "What are my biggest compliance risks?" - "How do I fix Critical L1 findings?" - "Explain Singapore GFA rules"</div>
        </div>
      </div>
      <div style="padding:10px 16px;background:#06101e;border-top:1px solid #0f2040;display:flex;gap:8px;flex-shrink:0">
        <textarea id="ai-input" placeholder="Ask about your IFC model, compliance issues, building codes…"
          style="flex:1;background:#0a1a2e;border:1px solid #1a3354;border-radius:6px;padding:8px 12px;color:#c0d8f0;font-size:13px;font-family:inherit;resize:none;height:44px;line-height:1.4"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();AiAssistantPage.send();}"></textarea>
        <button onclick="AiAssistantPage.send()" id="ai-send-btn"
          style="background:#00d4ff;color:#000;border:none;border-radius:6px;padding:0 18px;font-weight:700;font-size:13px;cursor:pointer;flex-shrink:0">Send</button>
      </div>
    </div>
    <div style="width:240px;flex-shrink:0;background:#060d1b;border-left:1px solid #0f2040;overflow-y:auto;display:flex;flex-direction:column">
      <div style="padding:12px">
        <div style="font-size:10px;font-weight:700;color:#4a6890;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px">Quick Actions</div>
        ${QB('🏗️ Analyze Compliance','AiAssistantPage.analyzeCompliance()')}
        ${QB('📋 Executive Summary','AiAssistantPage.execSummary()')}
        ${QB('🔧 Suggest Fixes','AiAssistantPage.suggestFixes()')}
        ${QB('📊 Explain Score','AiAssistantPage.explainScore()')}
        ${QB('🏛️ Building Code Help','AiAssistantPage.buildingCodeHelp()')}
        ${QB('🗑️ Clear Chat','AiAssistantPage.clearChat()','#1a0a0a','#f87171')}
      </div>
      <div style="padding:12px;border-top:1px solid #0a1520">
        <div style="font-size:10px;font-weight:700;color:#4a6890;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px">Model Context</div>
        <div id="ai-model-ctx" style="font-size:11px;color:#8aabca;line-height:1.6"></div>
      </div>
      <div style="padding:12px;border-top:1px solid #0a1520;margin-top:auto">
        <div style="font-size:10px;font-weight:700;color:#4a6890;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px">Active Route</div>
        <div id="ai-routing-status" style="font-size:11px;color:#5b7fa6">Ready - will auto-route to first available engine.</div>
      </div>
    </div>
  </div>
</div>`;
  }

  // ── Post-render init ───────────────────────────────────────────────────────
  function _initDom() {
    const bar = document.getElementById('ai-engine-bar');
    const leg = document.getElementById('ai-route-legend');
    const ctx = document.getElementById('ai-model-ctx');
    if (bar) _buildEngineBar(bar);
    if (leg) _buildRoutingLegend(leg);
    if (ctx) _buildModelContext(ctx);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function _setThinking(on) {
    const btn = document.getElementById('ai-send-btn');
    if (btn) { btn.disabled = on; btn.textContent = on ? '…' : 'Send'; }
    const rs = document.getElementById('ai-routing-status');
    if (rs) rs.textContent = on ? 'Routing to AI engine…' : 'Ready';
  }

  function _updateRouteStatus(result) {
    const rs = document.getElementById('ai-routing-status');
    if (!rs || !result) return;
    const e = VEngine.ENGINES[result.engine];
    rs.textContent = 'Used: ' + (e ? e.name : result.engine) + (result.fallback ? ' (fallback)' : '');
  }

  function _buildCtx() {
    const st   = VState.get();
    const sess = st.session;
    const files = st.filesLoaded || [];
    const lines = [
      'IFC File: ' + ((files[0] && files[0].name) || files[0] || 'Unknown'),
      'Country Mode: ' + (st.countryMode || 'Singapore'),
      'Gateway: ' + (st.sgGateway || 'N/A'),
    ];
    if (sess) {
      lines.push('Score: ' + (typeof sess.score==='number' ? sess.score.toFixed(1)+'%' : '?'));
      lines.push('Total Elements: ' + (sess.totalElements||0));
      lines.push('Critical: '+(sess.criticalElements||0)+' | Errors: '+(sess.errorElements||0)+' | Warnings: '+(sess.warningElements||0)+' | Pass: '+(sess.passedElements||0));
    } else {
      lines.push('Validation: not run yet');
    }
    return lines.join('\n');
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function send() {
    const inp = document.getElementById('ai-input');
    if (!inp) return;
    const q = inp.value.trim();
    if (!q) return;
    inp.value = '';
    _appendMsg('user', q);
    _setThinking(true);
    try {
      const result = await VEngine.askAboutModel(q, _buildCtx());
      _appendMsg('ai', result.text, result.engineName);
      _updateRouteStatus(result);
    } catch(err) {
      _appendMsg('ai', 'Engine error: ' + err.message + '\n\nConfigure at least one AI engine in API Keys. Groq and DeepSeek both have free tiers.');
    } finally { _setThinking(false); }
  }

  async function analyzeCompliance() {
    const sess = VState.get().session;
    if (!sess) { _appendMsg('ai', 'Please run validation first to generate compliance data.'); return; }
    _appendMsg('user', 'Analyze my compliance results and identify the priority risks.');
    _setThinking(true);
    try {
      const result = await VEngine.analyzeCompliance(sess);
      _appendMsg('ai', result.text, result.engineName);
      _updateRouteStatus(result);
    } catch(err) { _appendMsg('ai', 'Error: '+err.message); }
    finally { _setThinking(false); }
  }

  async function execSummary() {
    const sess = VState.get().session;
    if (!sess) { _appendMsg('ai', 'Please run validation first.'); return; }
    _appendMsg('user', 'Generate an executive summary of the compliance report.');
    _setThinking(true);
    try {
      const result = await VEngine.generateExecutiveSummary(sess);
      _appendMsg('ai', result.text, result.engineName);
      _updateRouteStatus(result);
    } catch(err) { _appendMsg('ai', 'Error: '+err.message); }
    finally { _setThinking(false); }
  }

  async function suggestFixes() {
    const sess = VState.get().session;
    if (!sess) { _appendMsg('ai', 'Please run validation first.'); return; }
    _appendMsg('user', 'What are the specific steps to fix the top compliance findings?');
    _setThinking(true);
    try {
      const findings = sess.findings || [];
      const result = await VEngine.suggestFixes(findings);
      _appendMsg('ai', result.text, result.engineName);
      _updateRouteStatus(result);
    } catch(err) { _appendMsg('ai', 'Error: '+err.message); }
    finally { _setThinking(false); }
  }

  async function explainScore() {
    const sess = VState.get().session;
    if (!sess) { _appendMsg('ai', 'Please run validation first.'); return; }
    const score = typeof sess.score==='number' ? sess.score.toFixed(1) : '?';
    _appendMsg('user', 'My compliance score is '+score+'%. What does this mean and how do I improve it?');
    _setThinking(true);
    try {
      const result = await VEngine.analyzeCompliance(sess);
      _appendMsg('ai', result.text, result.engineName);
      _updateRouteStatus(result);
    } catch(err) { _appendMsg('ai', 'Error: '+err.message); }
    finally { _setThinking(false); }
  }

  async function buildingCodeHelp() {
    _appendMsg('user', 'Give me an overview of the key Singapore building code requirements checked by VERIFIQ.');
    _setThinking(true);
    try {
      const result = await VEngine.route('chat',
        'Give a structured overview of Singapore BIM/IFC compliance: BCA Building Control Act, SCDF fire safety, URA GFA rules, BFA accessibility, SS 530 energy. What are the most common Critical and Error findings in IFC models submitted to CORENET X?',
        'You are an expert in Singapore building codes and BIM compliance. Be specific, practical, and well-structured.');
      _appendMsg('ai', result.text, result.engineName);
      _updateRouteStatus(result);
    } catch(err) { _appendMsg('ai', 'Error: '+err.message); }
    finally { _setThinking(false); }
  }

  function clearChat() {
    _messages = [];
    const log = document.getElementById('ai-chat-log');
    if (!log) return;
    log.textContent = '';
    const welcome = _el('div','background:#0a1a2e;border:1px solid #1a3354;border-radius:8px;padding:16px;max-width:560px');
    _app(welcome,
      _el('div','font-size:14px;font-weight:700;color:#00d4ff;margin-bottom:8px','VERIFIQ AI Assistant'),
      _el('div','font-size:12px;color:#8aabca;line-height:1.6','Chat cleared. Ask a new question about your IFC model.')
    );
    log.appendChild(welcome);
  }

  async function probeEngines() {
    const bar = document.getElementById('ai-engine-bar');
    if (bar) { bar.textContent = ''; bar.appendChild(_el('span','font-size:10px;color:#4a6890','Probing engines…')); }
    _status = await VEngine.getStatus();
    if (bar) _buildEngineBar(bar);
  }

  function showSettings() {
    const overlay = document.createElement('div');
    overlay.id = 'ai-settings-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9000;display:flex;align-items:center;justify-content:center';

    const dlg = _el('div','background:#071220;border:1px solid #1a3354;border-radius:10px;padding:24px;width:560px;max-width:92vw;max-height:85vh;overflow-y:auto');

    const hdr = _el('div','display:flex;justify-content:space-between;align-items:center;margin-bottom:16px');
    const title = _el('div','font-size:14px;font-weight:700;color:#00d4ff','AI Engine Configuration');
    const close = _el('button','background:none;border:none;color:#4a6890;cursor:pointer;font-size:18px','×');
    close.onclick = () => overlay.remove();
    _app(hdr, title, close);

    const hint = _el('div','font-size:11px;color:#5b7fa6;margin-bottom:16px','API keys stored in browser localStorage. Sent only to the respective provider - never logged. Add any OpenAI-compatible API, corporate AI gateway, or proprietary AI service.');

    const freeBox = _el('div','background:#0a1520;border:1px solid #1a3354;border-radius:6px;padding:10px;margin-bottom:16px');
    _app(freeBox,
      _el('div','font-size:11px;font-weight:700;color:#00ff88;margin-bottom:4px','Free providers - no credit card required'),
      _el('div','font-size:11px;color:#5b7fa6','Groq: console.groq.com/keys (free tier, fast)   DeepSeek: platform.deepseek.com (free tier, strong reasoning)')
    );

    _app(dlg, hdr, hint, freeBox);

    // Standard engine rows
    const stdHdr = _el('div','font-size:11px;font-weight:700;color:#4a6890;letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px','Built-in Providers');
    dlg.appendChild(stdHdr);

    for (const [id, e] of Object.entries(VEngine.ENGINES)) {
      if (e.local) continue;
      const row = _el('div','margin-bottom:12px');
      _app(row, _el('div','font-size:11px;font-weight:700;color:'+e.color+';margin-bottom:4px', e.name));
      const inp = _el('input','flex:1;background:#0a1a2e;border:1px solid #1a3354;border-radius:4px;padding:6px 10px;color:#c0d8f0;font-size:12px');
      inp.type = 'password';
      inp.id   = 'key-'+id;
      inp.placeholder = id==='groq'?'gsk_…':id==='gemini'?'AIza…':'sk-…';
      inp.value = VEngine.getKey(id) || '';
      const saveBtn = _el('button','background:#00c4a0;color:#000;border:none;border-radius:4px;padding:6px 12px;font-weight:700;font-size:12px;cursor:pointer','Save');
      const engId = id;
      saveBtn.onclick = () => _saveKey(engId);
      const flex = _el('div','display:flex;gap:6px');
      _app(flex, inp, saveBtn);
      _app(row, flex);
      dlg.appendChild(row);
    }

    // ── Custom engine section ──────────────────────────────────────────────
    const cxSep = _el('div','border-top:1px solid #1a3354;margin:18px 0 12px');
    dlg.appendChild(cxSep);
    const cxHdr = _el('div','display:flex;align-items:center;gap:8px;margin-bottom:4px');
    _app(cxHdr,
      _el('div','font-size:11px;font-weight:700;color:#9b59b6;letter-spacing:.1em;text-transform:uppercase','Custom API Engines'),
      _el('div','font-size:10px;color:#4a6890','(your company APIs, private models, or any OpenAI-compatible endpoint)')
    );
    dlg.appendChild(cxHdr);
    const cxHint = _el('div','font-size:11px;color:#5b7fa6;margin-bottom:10px','Custom engines are tried first, before all built-in providers. Supports Bearer, x-api-key, Basic, and no-auth styles.');
    dlg.appendChild(cxHint);

    // List of existing custom engines (rebuilt on add/remove)
    const cxList = _el('div','margin-bottom:12px');
    dlg.appendChild(cxList);

    function _buildCxList() {
      cxList.textContent = '';
      const customs = VEngine.getCustomEngines();
      if (!customs.length) {
        cxList.appendChild(_el('div','font-size:11px;color:#3a5070;padding:6px 0','No custom engines yet.'));
        return;
      }
      for (const cx of customs) {
        const row = _el('div','display:flex;align-items:center;gap:8px;margin-bottom:6px;background:#0a1520;border:1px solid #1a3354;border-radius:4px;padding:8px 10px');
        const dot = _el('span','font-size:9px;color:#9b59b6','●');
        const info = _el('div','flex:1');
        _app(info,
          _el('div','font-size:12px;font-weight:700;color:#c0d8f0', cx.name),
          _el('div','font-size:10px;color:#4a6890', cx.url + ' · model: ' + cx.model + ' · auth: ' + (cx.authStyle||'bearer'))
        );
        const del = _el('button','background:#7f1d1d;border:none;border-radius:3px;padding:4px 10px;color:#fca5a5;cursor:pointer;font-size:11px;flex-shrink:0','Remove');
        const cxId = cx.id;
        del.onclick = () => { VEngine.removeCustomEngine(cxId); _buildCxList(); };
        _app(row, dot, info, del);
        cxList.appendChild(row);
      }
    }
    _buildCxList();

    // Add new custom engine form
    const addBox = _el('div','background:#0a1520;border:1px solid #1a3354;border-radius:6px;padding:12px');
    _app(addBox, _el('div','font-size:11px;font-weight:700;color:#4a6890;margin-bottom:10px','Add Custom Engine'));
    function _fi(id, ph, type) {
      const inp = _el('input','width:100%;box-sizing:border-box;background:#071220;border:1px solid #1a3354;border-radius:4px;padding:6px 10px;color:#c0d8f0;font-size:12px;margin-bottom:7px');
      inp.id = id; inp.placeholder = ph; inp.type = type || 'text'; return inp;
    }
    const nInp = _fi('cx-name','Engine name (e.g. Company AI, Llama 3 Private)');
    const uInp = _fi('cx-url','API URL (e.g. https://api.myco.com/v1/chat/completions)');
    const mInp = _fi('cx-model','Model name (e.g. gpt-4o, llama-3.3-70b, my-company-model)');
    const kInp = _fi('cx-key','API Key (leave blank if not required)','password');
    const authRow = _el('div','display:flex;align-items:center;gap:8px;margin-bottom:10px');
    const authLbl = _el('span','font-size:11px;color:#4a6890','Auth style:');
    const authSel = _el('select','background:#071220;border:1px solid #1a3354;border-radius:4px;padding:5px 8px;color:#c0d8f0;font-size:11px;cursor:pointer');
    for (const [v,l] of [['bearer','Bearer token (OpenAI-compatible)'],['x-api-key','x-api-key header (Anthropic-style)'],['basic','Basic auth'],['none','No auth (internal API)']]) {
      const o = document.createElement('option'); o.value=v; o.textContent=l; authSel.appendChild(o);
    }
    _app(authRow, authLbl, authSel);
    const addBtn = _el('button','background:#9b59b6;color:#fff;border:none;border-radius:4px;padding:7px 16px;font-weight:700;font-size:12px;cursor:pointer','+ Add Engine');
    addBtn.onclick = () => {
      const name = (document.getElementById('cx-name')||{}).value || '';
      const url  = (document.getElementById('cx-url')||{}).value  || '';
      const model= (document.getElementById('cx-model')||{}).value|| 'gpt-4o';
      const key  = (document.getElementById('cx-key')||{}).value  || '';
      if (!name.trim() || !url.trim()) { alert('Name and API URL are required.'); return; }
      VEngine.addCustomEngine({ name:name.trim(), url:url.trim(), model:model.trim()||'gpt-4o', key:key.trim(), authStyle:authSel.value });
      nInp.value=''; uInp.value=''; mInp.value=''; kInp.value='';
      _buildCxList();
    };
    _app(addBox, nInp, uInp, mInp, kInp, authRow, addBtn);
    dlg.appendChild(addBox);

    const footer = _el('div','margin-top:16px;text-align:right');
    const probeBtn = _el('button','background:#00d4ff;color:#000;border:none;border-radius:6px;padding:8px 20px;font-weight:700;cursor:pointer','Save All & Probe');
    probeBtn.onclick = () => { probeEngines(); overlay.remove(); };
    _app(footer, probeBtn);
    _app(dlg, footer);

    overlay.appendChild(dlg);
    document.body.appendChild(overlay);
  }

  function _saveKey(id) {
    const inp = document.getElementById('key-'+id);
    if (inp) VEngine.setKey(id, inp.value);
  }

  // ── File analysis (triggered from Loaded Files AI button) ───────────────────
  async function analyzeFile(fileName) {
    _initDom();
    const st    = VState.get();
    const files = st.filesLoaded || [];
    const file  = files.find(f => f.name === fileName) || files[0];
    if (!file) {
      _appendMsg('ai', 'File not found in loaded session. Please reload the file and try again.');
      return;
    }
    const details = [
      'File: ' + file.name,
      'Schema: ' + (file.schema || 'Unknown'),
      'Elements: ' + (file.elements || 0),
      'Storeys: ' + (file.storeys || 0),
      'Spaces: ' + (file.spaces || 0),
      'Classification coverage: ' + (file.classified || 0) + ' classified, ' + (file.unclassified || 0) + ' unclassified',
      'Proxy elements: ' + (file.proxies || 0),
      'Georeferenced: ' + (file.hasGeoreference ? 'Yes' : 'No'),
    ].join('\n');

    const prompt = 'I have just loaded this IFC file into VERIFIQ. Please analyse it and tell me:\n'
      + '1. What type of building/project this appears to be based on the file details\n'
      + '2. Any immediate concerns based on the metadata (missing georef, proxy elements, classification gaps)\n'
      + '3. What I should check or fix before running the CORENET X compliance validation\n\n'
      + 'File details:\n' + details;

    _appendMsg('user', 'Analyse this IFC file for me: ' + file.name);
    _setThinking(true);
    try {
      const result = await VEngine.askAboutModel(prompt, _buildCtx());
      _appendMsg('ai', result.text, result.engineName);
      _updateRouteStatus(result);
    } catch (err) {
      _appendMsg('ai', 'Engine error: ' + err.message + '\n\nConfigure at least one AI engine in API Keys.');
    } finally {
      _setThinking(false);
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  function onNavigate() {
    setTimeout(() => {
      _initDom();
      if (!_status || Object.keys(_status).length === 0) probeEngines();
    }, 50);
  }

  return {
    render, onNavigate, send, analyzeFile,
    analyzeCompliance, execSummary, suggestFixes, explainScore,
    buildingCodeHelp, clearChat, probeEngines, showSettings, _saveKey
  };
})();

window.AiAssistantPage = AiAssistantPage;
