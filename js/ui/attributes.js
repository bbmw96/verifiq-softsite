// VERIFIQ - Attributes page
// Copyright 2026 BBMW0 Technologies. All rights reserved.
//
// Browses every element of the loaded IFC model grouped by IFC entity and
// PredefinedType. Expanding an element loads its complete data live from the
// file: the Attributes group (GlobalId, Tag, dimensions, classification,
// material), the OwnerHistory / Created-by chain, and every property set and
// quantity set with each property's IFC value type and value. Nothing is
// hard-coded; the content is whatever this specific IFC file carries.

'use strict';

const AttributesPage = (() => {

  const _loaded = {};   // guid -> last property payload (cache so re-expand is instant)
  let _byGuid = {};     // guid -> element (carries the pi/ci search indices)
  const CARET_CLOSED = '▸';   // right-pointing small triangle
  const CARET_OPEN   = '▾';   // down-pointing small triangle

  function cssId(guid) { return (guid || '').replace(/[^A-Za-z0-9]/g, '_'); }

  function _el(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  function render() {
    const els = (VState.get().elements) || [];
    _byGuid = {};
    els.forEach(e => { _byGuid[e.g] = e; });
    if (!els.length) {
      return `<div style="padding:20px">
        <h1>Attributes</h1>
        <div class="card" style="margin-top:14px">
          ${VUtils.emptyState('🗂', 'No IFC file loaded',
            'Open an IFC file to browse every element\'s attributes, the OwnerHistory chain, and every property set, read live from the file.',
            '<button class="btn btn-primary" style="margin-top:16px" onclick="VBridge.openFile()">📂 Open IFC File</button>')}
        </div>
      </div>`;
    }

    // Group by IFC entity + PredefinedType so each type is clear, with its
    // elements (and their attributes) underneath.
    const groups = {};
    els.forEach(e => {
      const sub = (e.p && e.p !== '' && e.p.toUpperCase() !== 'NOTDEFINED') ? ' · ' + e.p : '';
      const key = (e.c || '(unclassified)') + sub;
      (groups[key] = groups[key] || []).push(e);
    });
    const keys = Object.keys(groups).sort();

    const groupsHtml = keys.map(k => {
      const list = groups[k];
      const rows = list.map(e => {
        const id = cssId(e.g);
        return `<div class="vq-attr-el" data-g="${e.g}" style="border-top:1px solid #0f1e30">
          <div onclick="AttributesPage.toggle('${e.g}')" style="display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer">
            <span id="vq-attr-caret-${id}" style="color:#5b7fa6;font-size:11px;width:12px;flex-shrink:0">${CARET_CLOSED}</span>
            <span style="font-weight:600;color:#e2e8f0;font-size:12px;min-width:140px">${VUtils.esc(e.n || '(unnamed)')}</span>
            <span style="font-family:monospace;font-size:10px;color:#5b7fa6;word-break:break-all">${VUtils.esc(e.g)}</span>
            <span style="margin-left:auto;font-size:10px;color:#5b7fa6;flex-shrink:0">${VUtils.esc(e.s || '')}</span>
          </div>
          <div id="vq-attr-body-${id}" style="display:none;padding:2px 14px 12px 36px"></div>
        </div>`;
      }).join('');
      return `<div class="card vq-attr-group" style="margin-bottom:12px;padding:0;overflow:hidden">
        <div style="background:#0d1f35;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-family:monospace;font-weight:700;color:#00c4a0;font-size:12px">${VUtils.esc(k)}</span>
          <span class="vq-attr-gcount" data-total="${list.length}" style="font-size:11px;color:#5b7fa6">${list.length} element${list.length !== 1 ? 's' : ''}</span>
        </div>${rows}</div>`;
    }).join('');

    const inputCss = 'flex:1;min-width:220px;height:34px;padding:0 12px;font-size:12px;border:1px solid #2d4a6e;border-radius:6px;background:#0a1628;color:#e2e8f0';
    return `<div style="padding:18px 20px;height:100%;overflow-y:auto">
      <h1 style="margin-bottom:4px">Attributes</h1>
      <p style="font-size:12px;color:var(--mid-grey);margin-bottom:14px">
        Every element in the loaded model grouped by IFC entity and PredefinedType.
        Click an element to see all its attributes, the OwnerHistory / Created-by chain,
        and every property set and quantity with its value, read live from this IFC file.
      </p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:6px">
        <input id="vq-attr-q1" type="text" oninput="AttributesPage.applySearch()" autocomplete="off"
          placeholder="🔎 Property / property set / type, incl. inherited  (e.g. SGPset_Door, FireRating, IfcLabel)" style="${inputCss}">
        <input id="vq-attr-q2" type="text" oninput="AttributesPage.applySearch()" autocomplete="off"
          placeholder="🏷 Category / classification reference  (e.g. IfcDoor, DOOR, A-WAL-EXW, Wall)" style="${inputCss}">
        <button class="btn btn-ghost" style="height:34px;flex-shrink:0" onclick="AttributesPage.clearSearch()">Clear</button>
      </div>
      <div id="vq-attr-count" style="font-size:11px;color:#5b7fa6;margin:6px 0 14px">${els.length} element(s) across ${keys.length} type group(s)</div>
      <div id="vq-attr-list">${groupsHtml}</div>
    </div>`;
  }

  function toggle(guid) {
    const id = cssId(guid);
    const body  = document.getElementById('vq-attr-body-' + id);
    const caret = document.getElementById('vq-attr-caret-' + id);
    if (!body) return;
    const isOpen = body.style.display !== 'none';
    if (isOpen) {
      body.style.display = 'none';
      if (caret) caret.textContent = CARET_CLOSED;
      return;
    }
    body.style.display = 'block';
    if (caret) caret.textContent = CARET_OPEN;
    if (_loaded[guid]) { _renderInto(body, _loaded[guid]); return; }
    while (body.firstChild) body.removeChild(body.firstChild);
    body.appendChild(_el('div', 'color:#5b7fa6;font-size:12px;padding:8px 0', 'Loading properties...'));
    if (window.VBridge && VBridge.getElementProperties) VBridge.getElementProperties(guid);
  }

  // Called by bridge.js when the host returns an element's property sets.
  function onElementProperties(data) {
    if (!data || !data.guid) return;
    _loaded[data.guid] = data;
    const body = document.getElementById('vq-attr-body-' + cssId(data.guid));
    if (body && body.style.display !== 'none') _renderInto(body, data);
  }

  function _badge(text, colour) {
    return _el('span',
      'flex-shrink:0;font-size:9px;font-weight:700;background:rgba(255,255,255,.06);color:' + colour + ';border-radius:3px;padding:1px 6px',
      text);
  }

  function _renderInto(host, data) {
    while (host.firstChild) host.removeChild(host.firstChild);
    const psets = data.psets || [];
    if (!psets.length) {
      host.appendChild(_el('div', 'color:#5b7fa6;font-size:12px;padding:8px 0',
        'No property sets are attached to this element in the IFC file.'));
      return;
    }
    host.appendChild(_el('div', 'font-size:10px;color:#374151;margin:4px 0 8px',
      (data.psetCount || psets.length) + ' set(s), ' + (data.propCount || 0) + ' properties'));

    psets.forEach(ps => {
      const box  = _el('div', 'margin-bottom:8px;border:1px solid #14283f;border-radius:6px;overflow:hidden');
      const head = _el('div', 'background:#0d1f35;padding:6px 10px;display:flex;align-items:center;gap:8px;justify-content:space-between');
      head.appendChild(_el('span', 'font-family:monospace;font-size:11px;font-weight:700;color:#00c4a0;word-break:break-all', ps.name || ''));
      const nm = ps.name || '';
      let badge = null;
      if (/^SGPset/i.test(nm))      badge = _badge('SG',   '#00c4a0');
      else if (/^Pset/i.test(nm))   badge = _badge('IFC',  '#60A5FA');
      else if (/^Qto/i.test(nm))    badge = _badge('QTY',  '#A78BFA');
      else if (nm === 'Attributes') badge = _badge('INFO', '#f59e0b');
      else if (/^File/i.test(nm))   badge = _badge('FILE', '#8aaac8');
      if (badge) head.appendChild(badge);
      box.appendChild(head);

      (ps.props || []).forEach(pr => {
        const row  = _el('div', 'display:flex;justify-content:space-between;gap:10px;padding:5px 10px;border-bottom:1px solid #0f1e30;align-items:flex-start');
        const left = _el('div', 'display:flex;flex-direction:column;gap:1px;min-width:0;flex:1');
        left.appendChild(_el('span', 'font-size:11px;color:#8aaac8;word-break:break-word', pr.name || ''));
        if (pr.type && pr.type !== 'Attribute' && pr.type !== 'File')
          left.appendChild(_el('span', 'font-size:9px;color:#5b7fa6;letter-spacing:.3px', pr.type));
        row.appendChild(left);
        const hasVal = pr.value !== undefined && pr.value !== null && String(pr.value) !== '';
        row.appendChild(_el('span',
          'font-size:11px;font-weight:600;text-align:right;word-break:break-word;flex-shrink:0;max-width:55%;color:' + (hasVal ? '#e2e8f0' : '#374151'),
          hasVal ? String(pr.value) : '(empty)'));
        box.appendChild(row);
      });
      host.appendChild(box);
    });
  }

  // Filter the rendered list against both search bars. Bar 1 matches the property
  // search index (property sets, property names, value types, incl. inherited); bar 2
  // matches the category index (IFC entity, predefined type, classification reference,
  // material). Pure style toggling so it scales to thousands of elements with no
  // re-render and no innerHTML.
  function applySearch() {
    const e1 = document.getElementById('vq-attr-q1');
    const e2 = document.getElementById('vq-attr-q2');
    const q1 = (e1 ? e1.value : '').trim().toLowerCase();
    const q2 = (e2 ? e2.value : '').trim().toLowerCase();
    let shown = 0, groupsShown = 0;
    document.querySelectorAll('.vq-attr-group').forEach(grp => {
      let vis = 0;
      grp.querySelectorAll('.vq-attr-el').forEach(row => {
        const el = _byGuid[row.getAttribute('data-g')] || {};
        const ok = (!q1 || (el.pi || '').indexOf(q1) !== -1) &&
                   (!q2 || (el.ci || '').indexOf(q2) !== -1);
        row.style.display = ok ? '' : 'none';
        if (ok) vis++;
      });
      grp.style.display = vis ? '' : 'none';
      const gc = grp.querySelector('.vq-attr-gcount');
      if (gc) {
        const total = gc.getAttribute('data-total');
        gc.textContent = (q1 || q2) ? (vis + ' of ' + total)
                                    : (total + ' element' + (total !== '1' ? 's' : ''));
      }
      if (vis) { groupsShown++; shown += vis; }
    });
    const cnt = document.getElementById('vq-attr-count');
    if (cnt) cnt.textContent = (q1 || q2)
      ? (shown + ' match' + (shown !== 1 ? 'es' : '') + ' across ' + groupsShown + ' type group(s)')
      : (Object.keys(_byGuid).length + ' element(s)');
  }

  function clearSearch() {
    const a = document.getElementById('vq-attr-q1'); if (a) a.value = '';
    const b = document.getElementById('vq-attr-q2'); if (b) b.value = '';
    applySearch();
  }

  return { render, toggle, onElementProperties, applySearch, clearSearch };
})();

window.AttributesPage = AttributesPage;
