// VERIFIQ Table Kit - VERIFIQ-original resizable, auto-fitting tables. No third-party library.
// Every data table in VERIFIQ becomes:
//   1. Smart auto-fit - text always wraps to fit its column, never truncated or lost, and never
//      shrunk below a readable size. Wide tables scroll horizontally only as a last resort.
//   2. Resizable columns - drag a column border to resize it live.
//   3. Auto-fit to contents - double-click a column border to size it to its content, exactly like
//      double-clicking a column border in Microsoft Word or Excel.
//   4. Remembered widths - the widths you set are saved per table (localStorage) and restored on
//      the next render and the next session.
// Pure DOM plus CSS. Works identically in the desktop WebView2 shell and the browser build. It is
// a progressive enhancement: if it is disabled the tables still render and still wrap correctly,
// because the base wrapping is handled in app.css.
(function () {
  'use strict';

  var MIN_COL     = 48;    // a column can never be dragged narrower than this (px)
  var MAX_AUTOFIT = 640;   // double-click auto-fit never grows a column past this (px)
  var MAX_DRAG    = 1600;  // a manual drag can go wider than auto-fit, up to this (px)
  var STORE_PREFIX = 'vq_colw_';

  function enhanceable(table) {
    if (!table || table.__vqEnhanced) return false;
    if (table.closest && table.closest('.no-resize, #v-wrap')) return false; // skip 3D mini-tables + opt-outs
    var head = table.tHead;
    if (!head || !head.rows.length) return false;
    return head.rows[0].cells.length >= 2;                                   // need at least two columns
  }

  // A stable per-table key from the header text, so a table's widths survive re-renders and
  // sessions without any change to the code that builds the table.
  function headerKey(table) {
    var cells = table.tHead.rows[0].cells, sig = '';
    for (var i = 0; i < cells.length; i++) sig += '|' + (cells[i].textContent || '').trim().toLowerCase();
    var h = 5381;                                                            // djb2 hash
    for (var j = 0; j < sig.length; j++) h = ((h << 5) + h + sig.charCodeAt(j)) | 0;
    return STORE_PREFIX + cells.length + '_' + (h >>> 0).toString(36);
  }

  function loadWidths(key, n) {
    try {
      var a = JSON.parse(localStorage.getItem(key) || 'null');
      if (Array.isArray(a) && a.length === n) return a.map(Number);
    } catch (e) {}
    return null;
  }
  function saveWidths(key, widths) {
    try { localStorage.setItem(key, JSON.stringify(widths.map(function (w) { return Math.round(w); }))); } catch (e) {}
  }

  function ensureColgroup(table, n) {
    var cg = table.querySelector(':scope > colgroup.vq-cg');
    if (cg && cg.children.length === n) return cg;
    if (cg) cg.parentNode.removeChild(cg);
    cg = document.createElement('colgroup');
    cg.className = 'vq-cg';
    for (var i = 0; i < n; i++) cg.appendChild(document.createElement('col'));
    table.insertBefore(cg, table.firstChild);
    return cg;
  }

  // Offscreen measurer for the double-click auto-fit, using each cell's own computed font.
  var _meas = null;
  function measurer() {
    if (_meas) return _meas;
    _meas = document.createElement('span');
    _meas.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;white-space:pre;pointer-events:none';
    document.body.appendChild(_meas);
    return _meas;
  }
  function contentWidth(table, colIndex) {
    var m = measurer(), max = 0, rows = table.rows;
    for (var r = 0; r < rows.length; r++) {
      var cell = rows[r].cells[colIndex];
      if (!cell) continue;
      var cs = window.getComputedStyle(cell);
      m.style.fontFamily    = cs.fontFamily;
      m.style.fontSize      = cs.fontSize;
      m.style.fontWeight    = cs.fontWeight;
      m.style.fontStyle     = cs.fontStyle;
      m.style.letterSpacing = cs.letterSpacing;
      m.textContent = cell.textContent || '';
      var pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      max = Math.max(max, m.offsetWidth + pad + 2);
    }
    return Math.max(MIN_COL, Math.min(MAX_AUTOFIT, Math.ceil(max)));
  }

  function retotal(table, cg) {
    var total = 0;
    for (var i = 0; i < cg.children.length; i++) total += parseFloat(cg.children[i].style.width) || 0;
    table.style.width = total + 'px';
  }
  function persist(table, cg, key) {
    var widths = [];
    for (var i = 0; i < cg.children.length; i++) widths.push(parseFloat(cg.children[i].style.width) || MIN_COL);
    saveWidths(key, widths);
  }

  function attachGrip(table, cg, key, grip, colIndex) {
    var startX = 0, startW = 0, dragging = false;
    grip.addEventListener('pointerdown', function (e) {
      dragging = true;
      startX = e.clientX;
      startW = parseFloat(cg.children[colIndex].style.width) || cg.children[colIndex].getBoundingClientRect().width;
      try { grip.setPointerCapture(e.pointerId); } catch (er) {}
      document.body.classList.add('vq-col-resizing');
      e.preventDefault(); e.stopPropagation();
    });
    grip.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var w = Math.max(MIN_COL, Math.min(MAX_DRAG, startW + (e.clientX - startX)));
      cg.children[colIndex].style.width = w + 'px';
      retotal(table, cg);
    });
    function end(e) {
      if (!dragging) return;
      dragging = false;
      try { grip.releasePointerCapture(e.pointerId); } catch (er) {}
      document.body.classList.remove('vq-col-resizing');
      persist(table, cg, key);
    }
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    grip.addEventListener('dblclick', function (e) {
      cg.children[colIndex].style.width = contentWidth(table, colIndex) + 'px';
      retotal(table, cg);
      persist(table, cg, key);
      e.preventDefault(); e.stopPropagation();
    });
    grip.addEventListener('click', function (e) { e.stopPropagation(); }); // never trigger header handlers
  }

  function enhance(table) {
    if (!enhanceable(table)) return;
    table.__vqEnhanced = true;
    table.classList.add('vq-table');

    var headCells = table.tHead.rows[0].cells, n = headCells.length;
    var cg  = ensureColgroup(table, n);
    var key = headerKey(table);

    // Initial widths: restore saved widths if we have them; otherwise measure the natural (auto)
    // layout so the table looks identical on first paint, then lock those widths in as resizable.
    var widths = loadWidths(key, n);
    if (!widths) {
      widths = [];
      for (var i = 0; i < n; i++) widths.push(Math.max(MIN_COL, Math.round(headCells[i].getBoundingClientRect().width)));
    }
    var total = 0;
    for (var c = 0; c < n; c++) { cg.children[c].style.width = widths[c] + 'px'; total += widths[c]; }
    table.style.tableLayout = 'fixed';
    table.style.width = total + 'px';

    // Add a resize grip to the right edge of each header cell.
    for (var h = 0; h < n; h++) {
      var th = headCells[h];
      if (window.getComputedStyle(th).position === 'static') th.style.position = 'relative';
      if (th.querySelector('.vq-col-grip')) continue;
      var grip = document.createElement('span');
      grip.className = 'vq-col-grip';
      grip.setAttribute('role', 'separator');
      grip.setAttribute('aria-orientation', 'vertical');
      grip.title = 'Drag to resize. Double-click to auto-fit to contents.';
      th.appendChild(grip);
      attachGrip(table, cg, key, grip, h);
    }
  }

  function enhanceAll(root) {
    var tables = (root || document).querySelectorAll('table');
    for (var i = 0; i < tables.length; i++) { try { enhance(tables[i]); } catch (e) {} }
  }

  // Enhance tables as any renderer adds them (class pages via innerHTML, feature modules via
  // replaceChildren), and re-enhance after a re-render so saved widths are restored.
  function start() {
    var target = document.getElementById('page-container') || document.getElementById('app') || document.body;
    try {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var added = muts[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            var node = added[j];
            if (!node || node.nodeType !== 1) continue;
            if (node.tagName === 'TABLE') { try { enhance(node); } catch (e) {} }
            else if (node.querySelectorAll) enhanceAll(node);
          }
        }
      }).observe(target, { childList: true, subtree: true });
    } catch (e) {}
    enhanceAll(document);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.VQTable = { enhance: enhance, enhanceAll: enhanceAll };
})();
