// VERIFIQ - About Page
// Copyright 2026 BBMW0 Technologies.
// Populates the About VERIFIQ page with publisher, standard, version history info.

const AboutPage = (() => {

  // ── Version history entries ──────────────────────────────────────────────
  const VERSION_HISTORY = [
    {
      ver: 'v2.2.0', date: 'May 2026',
      desc: 'VERIFIQ brand mark (navy + teal VQ), multi-resolution ICO (16-256px), ' +
            'Windows installer (Inno Setup 6), upgrade path with licence key persistence, ' +
            'macOS desktop build (Photino.NET + WKWebView), AI Assistant engine router.'
    },
    {
      ver: 'v1.3.0', date: 'April 2026',
      desc: 'IFC Property Editor (fix and save corrected IFC), Director\'s Report, ' +
            '128 IFC+SG classification codes embedded, Industry Mapping Excel importer, ' +
            '14-section User Guide via Help menu, all em dashes removed.'
    },
    {
      ver: 'v1.2.0', date: 'March 2026',
      desc: '3D Viewer rebuilt (Three.js WebGL + C# mesh fallback + bounding-box fallback), ' +
            'licence key MaxLength corrected to 35 chars, CS7064 ICO error fixed, ' +
            'classification cross-checking (Question 2) wired into ValidationEngine Level 8, ' +
            'BCF export, PDF/Excel/Word/CSV reports, 1,001 licence keys.'
    }
  ];

  // ── Card data ────────────────────────────────────────────────────────────
  const CARDS = [
    {
      label: 'PUBLISHER',
      html:  'BBMW0 Technologies'
    },
    {
      label: 'DEVELOPER',
      html:  'BBMW0 Technologies'
    },
    {
      label: 'CONTACT',
      html:  '<a href="mailto:bbmw0@hotmail.com" style="color:var(--teal,#00bfa5)">bbmw0@hotmail.com</a>'
    },
    {
      label: 'WEBSITE',
      html:  '<a href="https://verifiq.bbmw0.com" target="_blank" style="color:var(--teal,#00bfa5)">verifiq.bbmw0.com</a>' +
             ' &nbsp;|&nbsp; ' +
             '<a href="https://bbmw0.com" target="_blank" style="color:var(--teal,#00bfa5)">bbmw0.com</a>'
    },
    {
      label: 'SINGAPORE',
      html:  '<strong>IFC+SG 2025.1 (COP3.1, December 2025)</strong><br>' +
             'Agencies: BCA &middot; SCDF &middot; URA &middot; PUB &middot; LTA &middot; HDB &middot; SLA &middot; NEA &middot; NParks<br>' +
             'Gateways: Design &middot; Piling &middot; Construction &middot; Completion &middot; DSP'
    },
    {
      label: 'MALAYSIA',
      html:  '<strong>NBeS 2024.1 (CIDB, 2nd Edition)</strong><br>' +
             'Agencies: CIDB &middot; JMG &middot; DOE &middot; PLANMalaysia<br>' +
             'Purpose Groups: Residential &middot; Commercial &middot; Industrial &middot; Mixed &middot; All'
    },
    {
      label: 'IFC STANDARD',
      html:  'IFC4 Reference View ADD2 TC1<br>' +
             'Formats: IFCXML &middot; IFC (STEP) &middot; IFCZIP<br>' +
             'Coordinate: SVY21 (EPSG:3414)  -  mandatory IfcMapConversion<br>' +
             'Schema: ISO 16739-1:2018'
    },
    {
      label: 'LICENCE',
      html:  'Commercial licence required<br>' +
             'Tiers: Individual &middot; Team &middot; Enterprise<br>' +
             'Activation: 29-character key (format VRFQ-XXXX-XXXX-XXXX-XXXXXXXX)<br>' +
             '<a href="https://verifiq.bbmw0.com" target="_blank" style="color:var(--teal,#00bfa5)">Purchase at verifiq.bbmw0.com</a>'
    },
    {
      label: 'BUILT WITH',
      html:  '.NET 8 WPF &middot; WebView2 (Chromium) &middot; SQLite &middot; ' +
             'Three.js (3D viewer) &middot; web-ifc (IFC parsing) &middot; ' +
             'OpenXML SDK (Word/Excel) &middot; iTextSharp (PDF) &middot; C# &middot; JavaScript'
    }
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  function render() {
    const el = document.getElementById('page-about');
    if (!el) return;

    const verRows = VERSION_HISTORY.map(v => `
      <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #e8ecf0;align-items:flex-start">
        <span style="min-width:60px;font-weight:700;color:var(--teal,#00bfa5);font-size:13px">${v.ver}</span>
        <span style="min-width:90px;color:#888;font-size:12px;padding-top:1px">${v.date}</span>
        <span style="color:#444;font-size:13px;line-height:1.5">${v.desc}</span>
      </div>`).join('');

    const cardRows = CARDS.map(c => `
      <div style="background:#fff;border:1px solid #e8ecf0;border-radius:8px;padding:14px 16px;min-height:70px">
        <div style="font-size:10px;font-weight:700;letter-spacing:.08em;color:#aab;margin-bottom:6px">${c.label}</div>
        <div style="font-size:13px;color:#333;line-height:1.55">${c.html}</div>
      </div>`).join('');

    el.innerHTML = `
      <div style="max-width:900px;margin:0 auto;padding:24px 20px">

        <!-- Hero -->
        <div style="text-align:center;margin-bottom:28px">
          <div style="width:72px;height:72px;background:linear-gradient(135deg,#00bfa5,#0055cc);
                      border-radius:16px;display:inline-flex;align-items:center;justify-content:center;
                      font-weight:900;font-size:22px;color:#fff;letter-spacing:-1px;margin-bottom:12px">VQ</div>
          <div style="font-size:26px;font-weight:800;color:#0B2545;letter-spacing:-0.5px">VERIFIQ</div>
          <div style="color:#666;font-size:14px;margin:2px 0 8px">IFC Compliance Checker</div>
          <span style="background:#e6f7f5;color:#00897b;font-size:12px;font-weight:700;
                       padding:3px 12px;border-radius:20px;border:1px solid #b2dfdb">v2.2.0</span>
        </div>

        <!-- Info grid (3-col on wide, 1-col on narrow) -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-bottom:24px">
          ${cardRows}
        </div>

        <!-- Description bar -->
        <div style="background:#f0f7ff;border:1px solid #cce0ff;border-radius:8px;
                    padding:16px 20px;text-align:center;margin-bottom:24px;color:#444;font-size:13px;line-height:1.6">
          VERIFIQ checks IFC models against Singapore CORENET-X (IFC+SG COP 3.1) and Malaysia NBeS regulations.
          <br>
          <div style="margin-top:8px">
            <a href="https://bbmw0.com"           target="_blank" style="color:var(--teal,#00bfa5);margin:0 8px">bbmw0.com</a> |
            <a href="https://github.com/bbmw96/verifiq" target="_blank" style="color:var(--teal,#00bfa5);margin:0 8px">GitHub</a> |
            <a href="mailto:bbmw0@hotmail.com"    style="color:var(--teal,#00bfa5);margin:0 8px">bbmw0@hotmail.com</a>
          </div>
        </div>

        <!-- Version history -->
        <div style="background:#fff;border:1px solid #e8ecf0;border-radius:8px;padding:16px 20px">
          <h3 style="font-size:14px;font-weight:700;color:#0B2545;margin:0 0 4px">Version History</h3>
          ${verRows}
        </div>

      </div>`;
  }

  return { render };
})();
