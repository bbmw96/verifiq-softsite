// VERIFIQ - SoftSite IDS Checker page.
// Picks a buildingSMART IDS (.ids/.xml) file in the browser, sends its content to the
// engine (runIdsCheck -> IdsEngine), and renders the pass/fail findings. Built with DOM
// APIs (no innerHTML) and wired through the same VBridge as the rest of the UI.
(function () {
  'use strict';

  var _idsName = '';
  var _idsXml  = '';
  var _running = false;
  var _result  = null;

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function css(e, s) { e.style.cssText = s; return e; }

  function modelLoaded() {
    if (window.__vqIfcFiles && Object.keys(window.__vqIfcFiles).length) return true;
    try { var s = window.State && State.get && State.get(); return !!(s && s.filesLoaded && s.filesLoaded.length); }
    catch (e) { return false; }
  }

  function show() {
    var pc = document.getElementById('page-container');
    if (!pc) return;
    pc.replaceChildren();

    var head = el('div');
    head.appendChild(el('h1', null, 'IDS Checker'));
    var sub = el('div', null, 'Validate the loaded IFC model against a buildingSMART IDS (Information Delivery Specification) file. IDS is the ISO open standard for stating exactly what data a model must carry - entity, property, classification, material and attribute requirements - beyond the built-in CORENET-X rules.');
    css(sub, 'color:var(--mid-grey);font-size:12.5px;margin-top:2px;max-width:820px');
    head.appendChild(sub);
    pc.appendChild(head);

    var card1 = css(el('div', 'card'), 'margin-top:14px');
    card1.appendChild(css(el('div', null, '1. Load an IDS file (.ids or .xml)'), 'font-weight:700;color:var(--teal);margin-bottom:8px'));
    var pick = el('button', 'btn btn-primary', '\u{1F4C1} Choose IDS file');
    pick.addEventListener('click', chooseFile);
    card1.appendChild(pick);
    var picked = css(el('span'), 'margin-left:12px;font-size:12.5px;color:var(--teal)');
    if (_idsName) picked.textContent = '✓ ' + _idsName + ' loaded';
    card1.appendChild(picked);
    pc.appendChild(card1);

    var card2 = css(el('div', 'card'), 'margin-top:12px');
    card2.appendChild(css(el('div', null, '2. Run IDS validation'), 'font-weight:700;color:var(--teal);margin-bottom:8px'));
    var run = el('button', 'btn btn-teal', '▶ Run IDS Check');
    run.disabled = !(_idsXml && modelLoaded()) || _running;
    run.addEventListener('click', runCheck);
    card2.appendChild(run);
    var hint = css(el('div'), 'font-size:12px;color:var(--mid-grey);margin-top:8px');
    if (!modelLoaded()) hint.textContent = 'Load an IFC file first.';
    else if (!_idsXml) hint.textContent = 'Choose an IDS file above first.';
    else if (_running) hint.textContent = 'Validating the model against the IDS specifications...';
    card2.appendChild(hint);
    pc.appendChild(card2);

    var host = css(el('div'), 'margin-top:14px');
    host.id = 'ids-results';
    pc.appendChild(host);
    if (_result) renderResult(_result);
  }

  function chooseFile() {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.ids,.xml';
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        _idsXml  = String(reader.result || '');
        _idsName = f.name;
        _result  = null;
        show();
      };
      reader.readAsText(f);
    });
    inp.click();
  }

  function runCheck() {
    if (!_idsXml || !modelLoaded()) return;
    _running = true; _result = null; show();
    if (window.VBridge) VBridge.send('runIdsCheck', { idsXml: _idsXml });
  }

  function renderResult(r) {
    _running = false;
    var host = document.getElementById('ids-results');
    if (!host) return;
    host.replaceChildren();

    if (r.ok === false) {
      host.appendChild(css(el('div', 'card', r.error || 'The IDS file could not be validated.'), 'color:var(--sev-error,#ef4444)'));
      return;
    }

    var pass = r.passed || 0, fail = r.failed || 0, total = pass + fail;
    var pct = total > 0 ? Math.round(pass / total * 100) : 100;

    var kpis = css(el('div'), 'display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px');
    kpis.appendChild(kpi(String(pass), 'Passed', 'var(--green,#22c55e)'));
    kpis.appendChild(kpi(String(fail), 'Failed', 'var(--sev-error,#ef4444)'));
    kpis.appendChild(kpi(pct + '%', 'Compliance', 'var(--teal)'));
    kpis.appendChild(kpi(String(r.specifications || 0), 'Specifications', 'var(--mid-grey)'));
    host.appendChild(kpis);

    if (r.title) host.appendChild(css(el('div', null, 'IDS: ' + r.title), 'font-size:12.5px;color:var(--mid-grey);margin-bottom:10px'));

    var findings = r.findings || [];
    if (!findings.length) { host.appendChild(el('div', null, 'No findings returned.')); return; }

    var wrap = css(el('div'), 'overflow-x:auto');
    var tbl = css(el('table'), 'width:100%;border-collapse:collapse;font-size:12.5px');
    var thead = el('thead'), htr = el('tr');
    ['Status', 'Specification', 'Element', 'Detail'].forEach(function (h) {
      var th = el('th', null, h);
      css(th, 'text-align:left;padding:8px 10px;border-bottom:2px solid var(--navy-3);color:var(--teal);position:sticky;top:0;background:var(--navy)');
      htr.appendChild(th);
    });
    thead.appendChild(htr); tbl.appendChild(thead);

    var tb = el('tbody');
    findings.forEach(function (f) {
      var tr = el('tr');
      var st = cell(tr, f.passed ? '✓ PASS' : '✗ FAIL');
      st.style.color = f.passed ? 'var(--green,#22c55e)' : 'var(--sev-error,#ef4444)';
      st.style.fontWeight = '700';
      cell(tr, f.specName || '');
      cell(tr, f.elementName || f.elementGuid || '');
      cell(tr, f.message || '');
      tb.appendChild(tr);
    });
    tbl.appendChild(tb); wrap.appendChild(tbl); host.appendChild(wrap);
  }

  function kpi(v, l, col) {
    var d = css(el('div', 'card'), 'text-align:center;min-width:96px;padding:12px 16px');
    d.appendChild(css(el('div', null, v), 'font-size:22px;font-weight:800;color:' + col));
    d.appendChild(css(el('div', null, l), 'font-size:11px;color:var(--mid-grey);margin-top:2px'));
    return d;
  }
  function cell(tr, txt) {
    var td = el('td', null, txt);
    css(td, 'padding:8px 10px;border-bottom:1px solid var(--navy-3);vertical-align:top');
    tr.appendChild(td);
    return td;
  }

  // Intercept the engine's idsCheckResult push (bridge.js does not know this action).
  function init() {
    if (!window.VBridge || !VBridge.receive) { return setTimeout(init, 150); }
    if (VBridge.__idsWrapped) return;
    var recv = VBridge.receive.bind(VBridge);
    VBridge.receive = function (m) {
      var r = recv(m);
      if (m && m.action === 'idsCheckResult') { try { _result = m.data || {}; renderResult(_result); } catch (e) { /* keep UI alive */ } }
      return r;
    };
    VBridge.__idsWrapped = true;
  }
  init();

  window.SoftSiteIds = { show: show };
})();
