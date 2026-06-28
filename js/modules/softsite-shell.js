// VERIFIQ - SoftSite navigation shell.
// Recreates the desktop's native WPF chrome (sidebar, mode tabs, top bar, status bar,
// compliance score) as HTML around the ported page content, wired to the same
// App.navigate(page) router and VBridge actions the desktop drives via NavToJs.
// The markup is fully static (no user input); it is parsed with DOMParser, not innerHTML.
(function () {
  'use strict';

  // Sections and items mirror MainWindow.xaml exactly (page ids match app.js navigate()).
  const NAV = [
    ['WORKFLOW', [
      ['dashboard', '\u{1F4CA}', 'Dashboard'], ['files', '\u{1F4C1}', 'Loaded Files'],
      ['validation', '✅', 'Run Validation'], ['3d', '\u{1F9CA}', '3D Viewer'],
      ['ai', '\u{1F916}', 'AI Assistant']]],
    ['RESULTS', [
      ['results', '\u{1F4CB}', 'All Results'], ['attributes', '\u{1F5C2}', 'Attributes'],
      ['critical', '\u{1F6A8}', 'Critical Issues'], ['design', '\u{1F4D0}', 'Design Code'],
      ['search', '\u{1F50D}', 'Search Elements']]],
    ['FIX & EXPORT', [
      ['propertyeditor', '✏', 'Property Editor'], ['export', '\u{1F4E4}', 'Export Reports'],
      ['cobie', '\u{1F4CB}', 'COBie Export']]],
    ['TOOLS', [
      ['ids', '✓', 'IDS Checker'], ['merge', '⊕', 'IFC Merge'],
      ['rules', '\u{1F4CF}', 'Rules Database'], ['import', '\u{1F4E5}', 'Import Mapping']]],
    ['HELP', [
      ['licence', '\u{1F511}', 'Licence'], ['settings', '⚙', 'Settings'],
      ['about', 'ℹ', 'About VERIFIQ']]]
  ];

  const MODES = [['Singapore', '\u{1F1F8}\u{1F1EC} Singapore', 'Singapore: CORENET-X / IFC+SG'],
                 ['Malaysia', '\u{1F1F2}\u{1F1FE} Malaysia', 'Malaysia: NBeS / UBBL'],
                 ['Both', 'SG + MY', 'Singapore + Malaysia']];

  function el(id) { return document.getElementById(id); }
  function setStatus(t) { const s = el('vq-status'); if (s) s.textContent = t; }

  function markup() {
    return '<div class="vq-shell">' +
      '<aside class="vq-sidebar">' +
        '<div class="vq-brand"><span class="vq-logo">VQ</span>' +
          '<span class="vq-brandtext">VERIFIQ<small>IFC Compliance Checker</small></span></div>' +
        '<div class="vq-mode">' + MODES.map(function (m) {
          return '<button class="vq-modebtn' + (m[0] === 'Singapore' ? ' active' : '') +
                 '" data-mode="' + m[0] + '">' + m[1] + '</button>';
        }).join('') + '</div>' +
        '<nav class="vq-nav">' + NAV.map(function (sec) {
          return '<div class="vq-section">' + sec[0] + '</div>' + sec[1].map(function (it) {
            return '<button class="vq-navbtn" data-page="' + it[0] + '">' +
                   '<span class="vq-ic">' + it[1] + '</span><span>' + it[2] + '</span></button>';
          }).join('');
        }).join('') + '</nav>' +
        '<div class="vq-score"><div class="vq-score-label">Compliance Score</div>' +
          '<div class="vq-score-val" id="vq-score">—</div>' +
          '<div class="vq-score-sub" id="vq-score-sub">Load a file to begin</div></div>' +
      '</aside>' +
      '<div class="vq-mainwrap">' +
        '<header class="vq-topbar"><div class="vq-ctx" id="vq-ctx">Singapore: CORENET-X / IFC+SG</div>' +
          '<div class="vq-actions">' +
            '<button class="vq-act" data-act="open">\u{1F4C2} Open IFC File</button>' +
            '<button class="vq-act vq-act-teal" data-act="validate">▶ Run Validation</button>' +
            '<button class="vq-act" data-act="export">\u{1F4E4} Export Report</button>' +
          '</div></header>' +
        '<div class="vq-content" id="vq-content"></div>' +
        '<footer class="vq-status"><span id="vq-status">Ready — load an IFC file to begin</span>' +
          '<span class="vq-status-right">Rules: IFC+SG 2025.1 (COP3.1) · BBMW0 Technologies</span></footer>' +
      '</div></div>';
  }

  function build() {
    const app = el('app'), page = el('page-container');
    if (!app || !page || document.querySelector('.vq-shell')) return;

    const shell = new DOMParser().parseFromString(markup(), 'text/html').body.firstElementChild;
    shell.querySelector('#vq-content').appendChild(page);   // move the ported content in
    app.appendChild(shell);

    function highlight(p) {
      shell.querySelectorAll('.vq-navbtn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.page === p);
      });
    }

    // Nav -> the same router the desktop drives (App.navigate swaps #page-container).
    shell.querySelectorAll('.vq-navbtn').forEach(function (b) {
      b.addEventListener('click', function () {
        if (window.App && App.navigate) App.navigate(b.dataset.page);
        highlight(b.dataset.page);
      });
    });

    // Mode tabs -> setCountryMode (re-runs the engine's rule set).
    shell.querySelectorAll('.vq-modebtn').forEach(function (b) {
      b.addEventListener('click', function () {
        shell.querySelectorAll('.vq-modebtn').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        const m = MODES.find(function (x) { return x[0] === b.dataset.mode; });
        const ctx = el('vq-ctx'); if (ctx && m) ctx.textContent = m[2];
        if (window.VBridge) VBridge.send('setCountryMode', { mode: b.dataset.mode });
      });
    });

    // Top-bar actions reuse existing wiring.
    const acts = {
      open: function () { if (window.VBridge) VBridge.send('openFile', {}); },
      validate: function () { if (window.VBridge) VBridge.send('runValidation', {}); },
      export: function () { if (window.App && App.navigate) { App.navigate('export'); highlight('export'); } }
    };
    shell.querySelectorAll('.vq-act').forEach(function (b) {
      b.addEventListener('click', function () { const f = acts[b.dataset.act]; if (f) f(); });
    });

    // Keep the sidebar highlight in sync when pages change from inside the content too.
    if (window.App && App.navigate && !App.__shellPatched) {
      const orig = App.navigate.bind(window.App);
      App.navigate = function (p) { const r = orig(p); highlight(p); return r; };
      App.__shellPatched = true;
    }
    highlight((window.VState && VState.get && VState.get('currentPage')) || 'dashboard');

    // Live score + status from the engine's own messages (same payloads the dashboard uses).
    if (window.VBridge && VBridge.receive && !VBridge.__shellWrapped) {
      const recv = VBridge.receive.bind(VBridge);
      VBridge.receive = function (msg) {
        const out = recv(msg);
        try {
          if (msg && msg.action === 'validationComplete' && msg.data) {
            const s = msg.data.score;
            const sv = el('vq-score'); if (sv) sv.textContent = (s == null ? '—' : Math.round(s));
            const sub = el('vq-score-sub'); if (sub) sub.textContent = msg.data.gateway || 'Validation complete';
            const n = (msg.data.findings || []).length;
            setStatus('Validation complete · ' + n + ' finding' + (n === 1 ? '' : 's'));
          } else if (msg && msg.action === 'filesLoaded' && msg.data) {
            const n = (msg.data.files || []).length;
            setStatus(n ? (n + ' file' + (n === 1 ? '' : 's') + ' loaded — ready to validate')
                        : 'Ready — load an IFC file to begin');
          }
        } catch (e) { /* never let UI sync break the bridge */ }
        return out;
      };
      VBridge.__shellWrapped = true;
    }
  }

  function init() {
    if (!window.App || !window.VState || !document.getElementById('page-container')) {
      return setTimeout(init, 120);
    }
    build();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
