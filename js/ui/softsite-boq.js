// VERIFIQ - SoftSite Quantity Take-off / BOQ page.
// Sends generateBoq to the engine, renders the returned line items into #page-container,
// and exports a CSV client-side. Built with DOM APIs (no innerHTML) and wired via the same
// VBridge the rest of the UI uses. This is the SoftSite-side of the BOQ feature.
(function () {
  'use strict';

  var _items = null;

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function fmt(n) {
    var v = Math.round((+n || 0) * 100) / 100;
    return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function show() {
    var pc = document.getElementById('page-container');
    if (!pc) return;
    pc.replaceChildren();

    var head = el('div');
    head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap';
    var title = el('div');
    title.appendChild(el('h1', null, 'Quantity Take-off (BOQ)'));
    var sub = el('div', null, 'Automated quantities from the loaded model, grouped by element class and type. Volumes use embedded Qto_ quantities where present (exact, matching Revit and ArchiCAD exports); otherwise a bounding-box estimate. Instance counts are exact.');
    sub.style.cssText = 'color:var(--mid-grey);font-size:12.5px;margin-top:2px;max-width:760px';
    title.appendChild(sub);
    head.appendChild(title);
    var exp = el('button', 'btn btn-outline', '\u{1F4E4} Export CSV');
    exp.id = 'boq-export'; exp.disabled = true; exp.addEventListener('click', exportCsv);
    head.appendChild(exp);
    pc.appendChild(head);

    var status = el('div', null, 'Generating quantities…');
    status.id = 'boq-status';
    status.style.cssText = 'color:var(--mid-grey);padding:14px 0';
    pc.appendChild(status);

    var host = el('div');
    host.id = 'boq-table-host';
    host.style.cssText = 'overflow-x:auto';
    pc.appendChild(host);

    if (window.VBridge) VBridge.send('generateBoq', {});
  }

  function render(items) {
    _items = items || [];
    var host = document.getElementById('boq-table-host');
    var status = document.getElementById('boq-status');
    var exp = document.getElementById('boq-export');
    if (!host) return;
    host.replaceChildren();

    if (!_items.length) {
      if (status) status.textContent = 'No elements to measure. Open an IFC file first, then reopen this page.';
      if (exp) exp.disabled = true;
      return;
    }
    var totalEls = _items.reduce(function (s, i) { return s + (i.instances || 0); }, 0);
    if (status) status.textContent = _items.length + ' BOQ line items across ' + totalEls + ' elements.';
    if (exp) exp.disabled = false;

    var tbl = el('table');
    tbl.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px';
    var thead = el('thead'), htr = el('tr');
    ['Code', 'Category', 'Description', 'Unit', 'Instances', 'Quantity'].forEach(function (h, i) {
      var th = el('th', null, h);
      th.style.cssText = 'text-align:' + (i >= 4 ? 'right' : 'left') + ';padding:9px 12px;border-bottom:2px solid var(--navy-3);color:var(--teal);position:sticky;top:0;background:var(--navy)';
      htr.appendChild(th);
    });
    thead.appendChild(htr); tbl.appendChild(thead);

    var tb = el('tbody');
    _items.forEach(function (it) {
      var tr = el('tr');
      cell(tr, it.code); cell(tr, it.category); cell(tr, it.description); cell(tr, it.unit);
      cell(tr, String(it.instances), true);
      cell(tr, fmt(it.quantity) + ' ' + it.unit, true);
      tb.appendChild(tr);
    });
    tbl.appendChild(tb); host.appendChild(tbl);
  }

  function cell(tr, txt, right) {
    var td = el('td', null, txt);
    td.style.cssText = 'padding:8px 12px;border-bottom:1px solid var(--navy-3)' +
      (right ? ';text-align:right;font-variant-numeric:tabular-nums' : '');
    tr.appendChild(td);
  }

  function exportCsv() {
    if (!_items || !_items.length) return;
    var rows = [['Code', 'Category', 'Description', 'Unit', 'Instances', 'Quantity']];
    _items.forEach(function (i) { rows.push([i.code, i.category, i.description, i.unit, i.instances, i.quantity]); });
    var csv = rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c == null ? '' : c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'VERIFIQ_BOQ.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 1200);
  }

  // Intercept the engine's boqData push (bridge.js does not know this action).
  function init() {
    if (!window.VBridge || !VBridge.receive) { return setTimeout(init, 150); }
    if (VBridge.__boqWrapped) return;
    var recv = VBridge.receive.bind(VBridge);
    VBridge.receive = function (m) {
      var r = recv(m);
      if (m && m.action === 'boqData') { try { render((m.data || {}).items || []); } catch (e) { /* keep UI alive */ } }
      return r;
    };
    VBridge.__boqWrapped = true;
  }
  init();

  window.SoftSiteBoq = { show: show };
})();
