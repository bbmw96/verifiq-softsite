// VERIFIQ - SoftSite BCF Issue Exchange page.
// Imports a BCF issue archive (.bcf/.bcfzip) written by VERIFIQ or any other BCF tool
// (Solibri, BIMcollab, Revizto, an agency reviewer), passes the bytes to the engine
// (LoadBcfBytes -> BcfImporter) and lists the topics, so review comments can be tracked
// against the model. VERIFIQ already exports BCF - this closes the round trip.
// Built with DOM APIs (no innerHTML) and wired through the same VBridge as the rest of the UI.
(function () {
  'use strict';

  var _name   = '';
  var _busy   = false;
  var _result = null;

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function css(e, s) { e.style.cssText = s; return e; }

  function show() {
    var pc = document.getElementById('page-container');
    if (!pc) return;
    pc.replaceChildren();

    var head = el('div');
    head.appendChild(el('h1', null, 'BCF Issue Exchange'));
    var sub = el('div', null, 'Import a BCF issue archive (.bcf or .bcfzip) from VERIFIQ or any other BCF tool - Solibri, BIMcollab, Revizto, or an agency reviewer - and track their comments against this model. Topics linked to an element open straight in the 3D viewer.');
    css(sub, 'color:var(--mid-grey);font-size:12.5px;margin-top:2px;max-width:820px');
    head.appendChild(sub);
    pc.appendChild(head);

    var card = css(el('div', 'card'), 'margin-top:14px');
    card.appendChild(css(el('div', null, 'Load a BCF archive'), 'font-weight:700;color:var(--teal);margin-bottom:8px'));
    var pick = el('button', 'btn btn-teal', '\u{1F4C2} Choose BCF file (.bcf / .bcfzip)');
    pick.disabled = _busy;
    pick.addEventListener('click', pickFile);
    card.appendChild(pick);
    if (_name) {
      card.appendChild(css(el('div', null, (_busy ? '⏳ ' : '✓ ') + _name + (_busy ? ' - reading...' : ' loaded')),
        'color:var(--teal);font-size:12.5px;margin-top:8px'));
    }
    pc.appendChild(card);

    var host = el('div');
    host.id = 'bcf-host';
    css(host, 'margin-top:14px');
    pc.appendChild(host);
    if (_result) render(_result);
  }

  function pickFile() {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.bcf,.bcfzip,.zip';
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      _name = f.name; _busy = true; _result = null; show();
      f.arrayBuffer().then(function (buf) {
        var bytes = new Uint8Array(buf);
        if (window.DotNet && DotNet.invokeMethodAsync) {
          DotNet.invokeMethodAsync('VERIFIQ.SoftSite', 'LoadBcfBytes', bytes)
            .catch(function (e) { render({ ok: false, error: 'Could not read the BCF file: ' + e }); });
        } else {
          render({ ok: false, error: 'The engine is still starting. Try again in a moment.' });
        }
      }).catch(function (e) { render({ ok: false, error: 'Could not open the file: ' + e }); });
    });
    inp.click();
  }

  function render(r) {
    _busy = false; _result = r;
    var host = document.getElementById('bcf-host');
    if (!host) return;
    host.replaceChildren();

    if (!r.ok) {
      var err = css(el('div', 'card'), 'border-left:3px solid var(--sev-error,#ef4444)');
      err.appendChild(css(el('div', null, r.error || 'The BCF archive could not be read.'),
        'color:var(--sev-error,#ef4444);font-size:13px'));
      host.appendChild(err);
      return;
    }

    var topics = r.topics || [];
    var open = topics.filter(function (t) { return (t.status || '').toLowerCase() !== 'closed'; }).length;

    var kpis = css(el('div'), 'display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px');
    kpis.appendChild(kpi(String(topics.length), 'Topics imported', 'var(--teal)'));
    kpis.appendChild(kpi(String(open), 'Open', open ? 'var(--amber)' : 'var(--green,#22c55e)'));
    kpis.appendChild(kpi(r.version || 'BCF', 'Format', 'var(--mid-grey)'));
    host.appendChild(kpis);

    var wrap = css(el('div'), 'overflow-x:auto');
    var tbl = css(el('table'), 'width:100%;border-collapse:collapse;font-size:12.5px');
    var thead = el('thead'), htr = el('tr');
    ['Status', 'Title', 'Priority', 'Author', 'Elements', ''].forEach(function (h) {
      var th = el('th', null, h);
      css(th, 'text-align:left;padding:8px 10px;border-bottom:2px solid var(--navy-3);color:var(--teal);position:sticky;top:0;background:var(--navy)');
      htr.appendChild(th);
    });
    thead.appendChild(htr); tbl.appendChild(thead);

    var tb = el('tbody');
    topics.forEach(function (t) {
      var tr = el('tr');
      var closed = (t.status || '').toLowerCase() === 'closed';
      var sc = cell(tr, t.status || 'Open');
      sc.style.color = closed ? 'var(--green,#22c55e)' : 'var(--amber)';
      sc.style.fontWeight = '700';
      var tc = cell(tr, t.title || '(untitled)');
      if (t.description) tc.title = t.description;
      cell(tr, t.priority || '');
      cell(tr, t.author || '');
      cell(tr, String((t.elements || []).length));
      var ac = cell(tr, '');
      var g = (t.elements || [])[0];
      if (g) {
        var b = el('button', 'btn btn-ghost', '\u{1F9CA} 3D');
        css(b, 'font-size:10px;padding:2px 8px;color:var(--teal);border-color:var(--teal);white-space:nowrap');
        b.addEventListener('click', function () {
          try { VState.set({ filterGuid: g }); App.navigate('3d'); } catch (e) { /* viewer unavailable */ }
        });
        ac.appendChild(b);
      }
      tb.appendChild(tr);
    });
    tbl.appendChild(tb); wrap.appendChild(tbl); host.appendChild(wrap);
  }

  function kpi(v, l, c) {
    var d = css(el('div', 'card'), 'padding:10px 16px;text-align:center;min-width:110px;margin:0');
    css(d.appendChild(el('div', null, v)), 'font-size:22px;font-weight:800;color:' + c);
    css(d.appendChild(el('div', null, l)), 'font-size:10.5px;color:var(--mid-grey);text-transform:uppercase;letter-spacing:.5px;margin-top:2px');
    return d;
  }
  function cell(tr, txt) {
    var td = el('td', null, txt);
    css(td, 'padding:8px 10px;border-bottom:1px solid var(--navy-3);vertical-align:top');
    tr.appendChild(td);
    return td;
  }

  // Intercept the engine's bcfImported push (bridge.js does not know this action).
  function init() {
    if (!window.VBridge || !VBridge.receive) { return setTimeout(init, 150); }
    if (VBridge.__bcfWrapped) return;
    var recv = VBridge.receive.bind(VBridge);
    VBridge.receive = function (m) {
      var r = recv(m);
      if (m && m.action === 'bcfImported') { try { render(m.data || {}); } catch (e) { /* keep UI alive */ } }
      return r;
    };
    VBridge.__bcfWrapped = true;
  }
  init();

  window.SoftSiteBcf = { show: show };
})();
