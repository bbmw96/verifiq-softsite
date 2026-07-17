// VERIFIQ Sentinel - SoftSite clash detection page.
// Runs bounding-box clash / interference detection on the loaded model (runClashCheck ->
// ClashEngine) and renders the clashing element pairs. Built with DOM APIs (no innerHTML)
// and wired through the same VBridge as the rest of the UI.
(function () {
  'use strict';

  var _running = false;
  var _result  = null;
  var _clearance = '0';

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function css(e, s) { e.style.cssText = s; return e; }
  function modelLoaded() {
    if (window.__vqIfcFiles && Object.keys(window.__vqIfcFiles).length) return true;
    try { var s = window.State && State.get && State.get(); return !!(s && s.filesLoaded && s.filesLoaded.length); }
    catch (e) { return false; }
  }
  function fmt(n) { var v = Math.round((+n || 0) * 1000) / 1000; return v.toLocaleString(); }

  function show() {
    var pc = document.getElementById('page-container');
    if (!pc) return;
    pc.replaceChildren();

    var head = el('div');
    head.appendChild(el('h1', null, 'Clash Detection - VERIFIQ Sentinel'));
    var sub = el('div', null, 'Detect interferences between elements in the loaded model. Sentinel runs bounding-box (AABB) interference checking fully offline - flagging element pairs that interpenetrate, while filtering face-adjacency and hosted door/window-in-wall relationships. Review the candidates, then resolve them in your BIM tool.');
    css(sub, 'color:var(--mid-grey);font-size:12.5px;margin-top:2px;max-width:820px');
    head.appendChild(sub);
    pc.appendChild(head);

    var card = css(el('div', 'card'), 'margin-top:14px');
    var row = css(el('div'), 'display:flex;align-items:center;gap:10px;flex-wrap:wrap');
    var run = el('button', 'btn btn-teal', '▶ Run Clash Detection');
    run.disabled = !modelLoaded() || _running;
    run.addEventListener('click', runCheck);
    row.appendChild(run);
    row.appendChild(css(el('label', null, 'Clearance'), 'font-size:12.5px;color:var(--mid-grey)'));
    var cin = el('input'); cin.type = 'number'; cin.min = '0'; cin.step = '0.05'; cin.value = _clearance;
    css(cin, 'width:88px;background:var(--navy);border:1px solid var(--border);color:var(--white);padding:6px 10px;border-radius:5px;font-size:13px');
    cin.addEventListener('input', function () { _clearance = cin.value; });
    row.appendChild(cin);
    row.appendChild(css(el('span', null, 'model units (0 = hard clashes only)'), 'font-size:11.5px;color:var(--mid-grey)'));
    card.appendChild(row);
    var hint = css(el('div'), 'font-size:12px;color:var(--mid-grey);margin-top:8px');
    if (!modelLoaded()) hint.textContent = 'Load an IFC file first.';
    else if (_running) hint.textContent = 'Scanning the model for interferences...';
    card.appendChild(hint);
    pc.appendChild(card);

    var host = css(el('div'), 'margin-top:14px'); host.id = 'clash-results';
    pc.appendChild(host);
    if (_result) renderResult(_result);
  }

  function runCheck() {
    if (!modelLoaded()) return;
    _running = true; _result = null; show();
    if (window.VBridge) VBridge.send('runClashCheck', { clearance: parseFloat(_clearance) || 0 });
  }

  function renderResult(r) {
    _running = false;
    var host = document.getElementById('clash-results');
    if (!host) return;
    host.replaceChildren();

    if (r.ok === false) { host.appendChild(css(el('div', 'card', r.error || 'Clash detection could not run.'), 'color:var(--sev-error,#ef4444)')); return; }

    var kpis = css(el('div'), 'display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px');
    kpis.appendChild(kpi(String(r.clashCount || 0), 'Hard clashes', r.clashCount ? 'var(--sev-error,#ef4444)' : 'var(--green,#22c55e)'));
    kpis.appendChild(kpi(String(r.clearanceCount || 0), 'Clearance issues', r.clearanceCount ? 'var(--amber)' : 'var(--green,#22c55e)'));
    kpis.appendChild(kpi(String(r.elementsChecked || 0), 'Elements checked', 'var(--teal)'));
    host.appendChild(kpis);

    var clashes = r.clashes || [];
    if (!clashes.length) { host.appendChild(css(el('div', 'card', '✓ No interferences detected in the bounding-box scan.'), 'color:var(--green,#22c55e)')); return; }

    var wrap = css(el('div'), 'overflow-x:auto');
    var tbl = css(el('table'), 'width:100%;border-collapse:collapse;font-size:12.5px');
    var thead = el('thead'), htr = el('tr');
    ['Type', 'Element A', 'Element B', 'Storey', 'Overlap / Gap'].forEach(function (h, i) {
      var th = el('th', null, h);
      css(th, 'text-align:' + (i === 4 ? 'right' : 'left') + ';padding:8px 10px;border-bottom:2px solid var(--navy-3);color:var(--teal);position:sticky;top:0;background:var(--navy)');
      htr.appendChild(th);
    });
    thead.appendChild(htr); tbl.appendChild(thead);

    var tb = el('tbody');
    clashes.forEach(function (c) {
      var tr = el('tr');
      var isClash = (c.type || 'Clash') === 'Clash';
      var tc = cell(tr, isClash ? 'Clash' : 'Clearance');
      tc.style.color = isClash ? 'var(--sev-error,#ef4444)' : 'var(--amber)';
      tc.style.fontWeight = '700';
      cell(tr, (c.classA || '') + ': ' + (c.nameA || c.guidA || ''));
      cell(tr, (c.classB || '') + ': ' + (c.nameB || c.guidB || ''));
      cell(tr, c.storey || '');
      cell(tr, isClash ? fmt(c.overlapVolume) : fmt(c.gap), true);
      tb.appendChild(tr);
    });
    tbl.appendChild(tb); wrap.appendChild(tbl); host.appendChild(wrap);
  }

  function kpi(v, l, col) {
    var d = css(el('div', 'card'), 'text-align:center;min-width:120px;padding:12px 16px');
    d.appendChild(css(el('div', null, v), 'font-size:22px;font-weight:800;color:' + col));
    d.appendChild(css(el('div', null, l), 'font-size:11px;color:var(--mid-grey);margin-top:2px'));
    return d;
  }
  function cell(tr, txt, right) {
    var td = el('td', null, txt);
    css(td, 'padding:8px 10px;border-bottom:1px solid var(--navy-3);vertical-align:top' + (right ? ';text-align:right;font-variant-numeric:tabular-nums' : ''));
    tr.appendChild(td);
  }

  // Intercept the engine's clashResult push (bridge.js does not know this action).
  function init() {
    if (!window.VBridge || !VBridge.receive) { return setTimeout(init, 150); }
    if (VBridge.__clashWrapped) return;
    var recv = VBridge.receive.bind(VBridge);
    VBridge.receive = function (m) {
      var r = recv(m);
      if (m && m.action === 'clashResult') { try { _result = m.data || {}; renderResult(_result); } catch (e) { /* keep UI alive */ } }
      return r;
    };
    VBridge.__clashWrapped = true;
  }
  init();

  window.SoftSiteClash = { show: show };
})();
