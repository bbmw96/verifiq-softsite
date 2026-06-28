// VERIFIQ - Main Application
// Copyright 2026 BBMW0 Technologies. All rights reserved.

'use strict';

const App = (() => {
  const container = () => document.getElementById('page-container');

  // Page registry - every sidebar nav button must have an entry here
  const pages = {
    dashboard:      () => DashboardPage.render(),
    files:          () => FilesPage.render(),
    validation:     () => renderValidationPage(),
    results:        () => ResultsPage.render(),
    attributes:     () => (window.AttributesPage ? AttributesPage.render() : '<div><h1 style="padding:40px">Loading attributes...</h1></div>'),
    critical:       () => ResultsPage.renderCritical(),
    design:         () => ResultsPage.renderDesignCode(),
    '3d':           () => Viewer3DPage.render(),
    'ai':           () => AiAssistantPage.render(),
    export:         () => renderExportPage(),
    settings:       () => renderSettingsPage(),
    licence:        () => renderLicencePage(),
    rules:          () => renderRulesPage(),
    about:          () => renderAboutPage(),
    help:           () => renderHelpPage(),
    userguide:      () => renderUserGuidePage(),
    propertyeditor: () => renderPropertyEditorPage(),
    'import':       () => renderImportMappingPage(),
    'ids':          () => renderIdsCheckerPage(),
    'merge':        () => renderIfcMergePage(),
    'cobie':        () => renderCobiePage(),
    'search':       () => renderSearchPage(),
    manual:         () => (window._renderUserManualPage ? window._renderUserManualPage() : '<div><h1 style="padding:40px">Loading manual...</h1></div>'),
    parameters:     () => (window.ParametersPage ? ParametersPage.render() : '<div><h1 style="padding:40px">Loading parameters...</h1></div>'),
  };

  // Rules page tab switcher
  const VRules = {
    showTab(idx) {
      for (let i=0; i<4; i++) {
        const tab = document.getElementById(`rtab-${i}`);
        const content = document.getElementById(`rtab-content-${i}`);
        if (tab) tab.style.cssText += `;color:${i===idx?'var(--teal)':'var(--mid-grey)'};border-bottom:2px solid ${i===idx?'var(--teal)':'transparent'}`;
        if (content) content.style.display = i===idx?'block':'none';
      }
      // Activate first tab styling on load
    }
  };
  window.VRules = VRules;

  function navigate(page) {
    VState.set({ currentPage: page });
    render(page);

    // Notify C# shell to update the sidebar highlight
    VBridge.send('navigateTo', { page });
  }

  function render(page) {
    const fn = pages[page] || pages.dashboard;
    const el = container();
    if (!el) return;
    try {
      const html = fn();
      if (html) {
        el.innerHTML = html;
      } else {
        el.innerHTML = `<div style="padding:40px;color:#64748B;text-align:center">
          <div style="font-size:40px;margin-bottom:12px">📄</div>
          <div style="font-size:16px">Page content unavailable</div></div>`;
      }
      // Post-render hooks for pages that need DOM initialisation
      if (page === '3d' && window.Viewer3DPage) {
        Viewer3DPage.onNavigate();
      }
      if (page === 'ai' && window.AiAssistantPage) {
        AiAssistantPage.onNavigate();
      }
      if ((page === 'results' || page === 'critical') && window.ResultsPage && ResultsPage.afterRender) {
        ResultsPage.afterRender();
      }
    } catch (err) {
      console.error('[VERIFIQ] render error on page "' + page + '":', err);
      el.innerHTML = `<div style="padding:32px">
        <div style="background:#1a0a0a;border:1px solid #5c1a1a;border-radius:8px;padding:10px">
          <div style="font-weight:700;color:#f87171;margin-bottom:8px">⚠ Page render error - ${page}</div>
          <div style="font-family:monospace;font-size:12px;color:#fca5a5">${err && err.message ? err.message : String(err)}</div>
          <button class="btn btn-outline" style="margin-top:12px" onclick="App.navigate('dashboard')">← Back to Dashboard</button>
        </div></div>`;
    }
  }

  function refresh() {
    render(VState.get('currentPage') || 'dashboard');
  }

  function init() {
    // Parse ?page= from URL
    const params = new URLSearchParams(window.location.search);
    const page   = params.get('page') || 'dashboard';

    // Initialise the bridge (sets up WebView2 message listener)
    VBridge.init();
    // Render the initial page immediately
    render(page);
    // Re-render after 300ms once the bridge sends stateUpdate 
    // This ensures dashboard shows populated content on first open
    setTimeout(() => { try { render(VState.get().currentPage || page); } catch(e){} }, 350);

    // Show welcome tour on first launch (after a short delay so UI renders)
    setTimeout(() => { if(window.WelcomeTour) WelcomeTour.prompt(); }, 1200);

    // Update banner: shown at the top of the page when C# finds a newer version.
    window._showUpdateBanner = (info) => {
      const el = document.getElementById('update-banner');
      if (!el) return;

      const isMandate = info.mandatory;
      const bg    = isMandate ? '#3b0000' : '#0f2035';
      const bdr   = isMandate ? '#ef4444' : '#F59E0B';
      const txt   = isMandate ? '#fca5a5' : '#fde68a';

      el.innerHTML = `
        <div id="vq-update-inner" style="background:${bg};border-bottom:2px solid ${bdr};
          padding:8px 20px;display:flex;align-items:center;gap:10px;font-size:12px;flex-wrap:wrap">
          <span style="font-size:16px">⬆</span>
          <span>
            <strong style="color:${txt}">VERIFIQ ${VUtils.esc(info.latest)} is available</strong>
            ${isMandate ? '<span style="color:#ef4444;font-weight:700"> · Required update</span>' : ''}
            &nbsp; You have v${VUtils.esc(info.current)}.
            ${info.releaseDate ? `Released ${VUtils.esc(info.releaseDate)}.` : ''}
            ${info.sizeMb ? `&nbsp;${VUtils.esc(info.sizeMb)}.` : ''}
          </span>
          ${info.notes ? `<span style="color:var(--mid-grey)">  -  ${VUtils.esc((info.notes||"").length>100?(info.notes||"").substring(0,100)+"...":info.notes||"")}</span>` : ''}
          <div style="display:flex;gap:6px;margin-left:auto">
            <button id="vq-dl-btn" onclick="(function(btn){
                btn.textContent='⬇ Downloading...';btn.disabled=true;
                document.getElementById('vq-update-inner').insertAdjacentHTML('beforeend',
                  '<div id=\"vq-update-progress\" style=\"width:100%;padding:4px 0\"></div>');
                VBridge.send('downloadAndInstallUpdate',{url:'${VUtils.esc(info.directUrl||info.url)}'});
              })(this)"
              style="background:#F59E0B;color:#000;border:none;border-radius:4px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer">
              ⬇ Auto Install Update
            </button>
            <button onclick="VBridge.send('openUrl',{url:'${VUtils.esc(info.url)}'})"
              style="background:transparent;color:var(--mid-grey);border:1px solid var(--border);border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer">
              Release Notes
            </button>
            ${!isMandate ? `
            <button onclick="VBridge.send('skipUpdateVersion',{version:'${VUtils.esc(info.latest)}'});document.getElementById('update-banner').innerHTML=''"
              style="background:transparent;color:var(--mid-grey);border:1px solid var(--border);border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer"
              title="Skip v${VUtils.esc(info.latest)}  -  you won't be notified again for this version">
              Skip v${VUtils.esc(info.latest)}
            </button>
            <button onclick="VBridge.send('deferUpdateToClose',{version:'${VUtils.esc(info.latest)}'});document.getElementById('update-banner').innerHTML='<div style=\"padding:6px 20px;background:#0f2035;border-bottom:1px solid #1e3a5f;font-size:11px;color:#94a3b8\">⏰ Update will install when you close VERIFIQ</div>'"
              style="background:transparent;color:var(--mid-grey);border:1px solid var(--border);border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer"
              title="Install when VERIFIQ next closes">
              ⏰ Defer
            </button>
            <button onclick="document.getElementById('update-banner').innerHTML=''"
              style="background:transparent;color:var(--mid-grey);border:none;padding:4px 8px;font-size:14px;cursor:pointer" title="Remind me later">
              ✕
            </button>` : ''}
          </div>
        </div>`;
    }
  }

  // ── LICENCE PAGE ─────────────────────────────────────────────────────────
  function renderLicencePage() {
    const state   = VState.get();
    const tier    = state.licence || 'Trial';
    const isTrial = tier === 'Trial';

    window._licenceErrorCallback = (msg) => {
      const el = document.getElementById('licence-error');
      if (el) { el.textContent = msg; el.style.display = 'block'; }
    };

    return `
      <div>
        <h1>Licence Management</h1>

        <div class="card">
          <div class="card-header"><span class="card-title">Current Licence</span></div>
          <div class="detail-panel">
            <div class="detail-row">
              <span class="detail-label">Tier</span>
              <span class="detail-value" style="font-weight:700;color:var(--teal)">${VUtils.esc(tier)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Country Coverage</span>
              <span class="detail-value">Singapore and Malaysia - all tiers include both countries</span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">🔑 ${isTrial ? 'Activate Full Licence' : 'Change Licence Key'}</span></div>
          <p style="font-size:13px;margin-bottom:14px">
            ${isTrial
              ? 'You are on Trial mode (10 elements per run). Enter your licence key to unlock all features.'
              : 'Enter a new licence key to upgrade or change your licence tier.'}
          </p>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <input id="licence-key-input" type="text"
              placeholder="VRFQ-XXXX-XXXX-XXXX-XXXX"
              style="font-family:Courier New,monospace;font-size:14px;padding:10px 14px;
                     border:2px solid var(--border);border-radius:6px;width:310px;
                     background:var(--card-2);color:var(--white)"
              oninput="document.getElementById('licence-error').style.display='none'"
              maxlength="29"/>
            <button class="btn btn-teal" style="padding:10px 22px;font-size:14px"
              onclick="(function(){
                var k=document.getElementById('licence-key-input').value.trim();
                if(!k)return;
                VBridge.send('activateLicence',{key:k});
              })()">Activate &rarr;</button>
          </div>
          <div id="licence-error" style="display:none;margin-top:10px;color:#f87171;
            font-size:13px;background:#1a0a0a;padding:8px 12px;border-radius:5px;
            border:1px solid #5c1a1a"></div>
          <p style="margin-top:12px;font-size:12px;color:var(--mid-grey)">
            To purchase a licence, contact: <strong>bbmw0@hotmail.com</strong> | <strong>bbmw0.com</strong>
          </p>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">Licence Tiers</span></div>
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Tier</th><th>Devices</th><th>Elements per run</th><th>Countries</th><th>Notes</th>
              </tr></thead>
              <tbody>
                <tr>
                  <td><span class="badge badge-info">Trial</span></td>
                  <td>1</td><td>10</td><td>SG + MY</td>
                  <td>All 20 checks, all export formats</td></tr>
                <tr>
                  <td><span class="badge badge-pass">Individual</span></td>
                  <td>1</td><td>Unlimited</td><td>SG + MY</td>
                  <td>Full features, perpetual</td></tr>
                <tr>
                  <td><span class="badge badge-pass">Practice</span></td>
                  <td>5</td><td>Unlimited</td><td>SG + MY</td>
                  <td>Full features, perpetual</td></tr>
                <tr>
                  <td><span class="badge badge-pass">Enterprise</span></td>
                  <td>25</td><td>Unlimited</td><td>SG + MY</td>
                  <td>IT deployment to 25 workstations, perpetual</td></tr>
                <tr>
                  <td><span class="badge badge-pass">Unlimited</span></td>
                  <td>Site (all)</td><td>Unlimited</td><td>SG + MY</td>
                  <td>Site licence - deploy to entire organisation, perpetual</td></tr>
              </tbody>
            </table>
          </div>
          <p style="margin-top:10px;font-size:12px;color:var(--mid-grey)">
            All paid tiers are perpetual (they never expire).
            Format: <code>VRFQ-XXXX-XXXX-XXXX-XXXX</code>
          </p>
        </div>
      </div>`;
 
  }

  // ── RULES PAGE ────────────────────────────────────────────────────────────

  function renderRulesPage() {
    const state = VState.get();
    const mode  = state.countryMode || 'Singapore';
    const isSG  = mode !== 'Malaysia';
    const isMY  = mode !== 'Singapore';

    return `<div>
      <h1>Rules Database</h1>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
        <button class="btn btn-ghost" style="font-size:11px"
          onclick="VBridge.send('openUrl',{url:'https://info.corenet.gov.sg/ifc-sg/templates--apps-and-more/ifc-sg-excel-mapping-file'})">
          📥 IFC+SG Excel Mapping (CORENET-X Portal)
        </button>
        <button class="btn btn-ghost" style="font-size:11px"
          onclick="VBridge.send('openUrl',{url:'https://go.gov.sg/ifcsg'})">
          🌐 go.gov.sg/ifcsg
        </button>
        <button class="btn btn-ghost" style="font-size:11px"
          onclick="VBridge.send('openUrl',{url:'https://go.gov.sg/cxcop'})">
          📘 COP 3.1 Docs
        </button>
      </div>
      <p style="color:var(--mid-grey);font-size:13px;margin-bottom:12px">
        <strong>128 IFC+SG classification codes</strong> embedded - 64 Architectural, 28 Structural,
        18 M&amp;E, 10 Plumbing, 4 Civil, 4 Landscape, plus full Malaysia NBeS codes.
        Each code is mapped to its exact required SGPset_ property sets and properties.
        Import the official BCA Industry Mapping Excel below to add or update codes.
      </p>

      <div class="card" style="margin-bottom:16px;border-left:4px solid var(--teal)">
        <div class="card-header">
          <span class="card-title">📥 Import BCA Industry Mapping Excel</span>
        </div>
        <p style="font-size:12px;color:var(--mid-grey);margin-bottom:10px">
          Download the official <strong>IFC+SG Industry Mapping December 2025 (COP3.1) (COP3.1, BCA/GovTech, Dec 2025)</strong> Excel from
          <a href="#" onclick="VBridge.send('openUrl',{url:'https://go.gov.sg/ifcsg'})" style="color:var(--teal)">
            go.gov.sg/ifcsg (IFC+SG Resource Kit)
          </a>
          and import it here to ensure VERIFIQ uses the latest official code-to-property mappings.
        </p>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-teal" onclick="RulesDbPage.browseAndImport()" style="font-size:13px">
            📂 Browse &amp; Import Excel
          </button>
          <div style="font-size:11px;color:var(--mid-grey)">
            Accepted: IFC+SG Industry Mapping December 2025 (COP3.1) (COP3.1, BCA/GovTech, Dec 2025), COP2, or NBeS Industry Mapping Excel
          </div>
        </div>
        <div id="industry-mapping-result" style="margin-top:8px"></div>
      </div>

      <!-- Tab bar -->
      <div style="display:flex;gap:6px;margin-bottom:16px;border-bottom:2px solid var(--border);padding-bottom:0">
        ${['Singapore','Malaysia','Design Code','Check Levels'].map((tab,i) =>
          `<button onclick="VRules.showTab(${i})" id="rtab-${i}"
            style="padding:8px 16px;border:none;background:none;cursor:pointer;font-family:inherit;
                   font-size:13px;font-weight:600;color:var(--mid-grey);border-bottom:2px solid transparent;
                   margin-bottom:-2px;transition:all .15s" class="rules-tab">
            ${tab}
          </button>`).join('')}
      </div>

      <!-- Singapore tab -->
      <div id="rtab-content-0">
        <div class="two-col">
          <div class="card">
            <div class="card-header"><span class="card-title">🇸🇬 CORENET-X IFC+SG 2025</span></div>
            <div style="font-size:12px;line-height:1.8">
              <b>Standard:</b> IFC+SG Industry Mapping December 2025 (COP3.1) (COP3.1 Edition (Dec 2025)  -  81 identified components, 833 property mappings, December 2025)<br>
              <b>Schema:</b> IFC4 Reference View ADD2 TC1 (IFCXML/IFC/IFCZIP)<br>
              <b>Coordinate:</b> SVY21 (EPSG:3414) - mandatory IfcMapConversion<br>
              <b>Agencies:</b> BCA · SCDF · URA · PUB · LTA · HDB · SLA · NEA · NParks<br>
              <b>Gateways:</b> Design · Piling · Construction · Completion · DSP
            </div>
          </div>
          <div class="card">
            <div class="card-header"><span class="card-title">📋 Legislation</span></div>
            <div style="font-size:12px;line-height:1.8">
              Building Control Act (Cap 29) · Planning Act<br>
              Fire Safety Act · Environmental Public Health Act<br>
              Code on Accessibility 2025 (BCA)<br>
              BCA Green Mark 2021<br>
              BC 2:2021 · SS EN 1992/1993 · SS 553:2016<br>
              Land Surveyors Act · PUB SDWA
            </div>
          </div>
        </div>
        ${renderAgencyRules()}
      </div>

      <!-- Malaysia tab -->
      <div id="rtab-content-1" style="display:none">
        <div class="two-col">
          <div class="card">
            <div class="card-header"><span class="card-title">🇲🇾 NBeS / UBBL 1984</span></div>
            <div style="font-size:12px;line-height:1.8">
              <b>Standard:</b> NBeS IFC Mapping 2024 (CIDB, 2nd Edition)<br>
              <b>Schema:</b> IFC4 Reference View ADD2 TC1<br>
              <b>Coordinate:</b> GDM2000 (per-state projection) - recommended<br>
              <b>Purpose Groups:</b> PG I-IX per UBBL 1984 Third Schedule<br>
              <b>Agencies:</b> JBPM · CIDB · JKR · Local Authority (PBT)
            </div>
          </div>
          <div class="card">
            <div class="card-header"><span class="card-title">📋 Legislation</span></div>
            <div style="font-size:12px;line-height:1.8">
              Street, Drainage and Building Act 1974 (Act 133)<br>
              Uniform Building By-Laws 1984 (Parts I-IX)<br>
              MS 1184:2014 - Access for Disabled People<br>
              MS 1183:2007 · MS 1525:2019<br>
              JBPM Fire Safety Requirements 2020<br>
              Fire Services Act 1988 · Registration of Engineers Act 1967
            </div>
          </div>
        </div>
        ${renderUbblTable()}
      </div>

      <!-- Design Code tab -->
      <div id="rtab-content-2" style="display:none">
        ${renderDesignCodeRules()}
      </div>

      <!-- Check Levels tab -->
      <div id="rtab-content-3" style="display:none">
        ${renderCheckLevels()}
      </div>
    </div>`;
  }

  function renderAgencyRules() {
    const agencies = [
      {id:'BCA',  name:'Building and Construction Authority',
       rules:['Structural adequacy (BC 2:2021 / SS EN 1992)', 'Code on Accessibility 2025 - accessible routes', 'BCA Green Mark 2021 - ETTV/RETV/LPD/WWR', 'Building Control Act - structural submission', 'Foundation - piling gateway requirements']},
      {id:'URA',  name:'Urban Redevelopment Authority',
       rules:['GFA computation from IfcSpace.GrossPlannedArea', 'Plot ratio compliance (Master Plan 2019)', 'Balcony ≤ 10% of unit GFA', 'Setback distances (road reserve categories)', 'Space category enumeration (50+ permitted values)']},
      {id:'SCDF', name:'Singapore Civil Defence Force',
       rules:['Fire compartment size (7,000m² sprinklered / 3,500m² non-sprinklered)', 'Travel distance (60m / 30m)', 'Exit widths - ≥750mm / 1,050mm (60+ occupants)', 'Escape stair widths - 1,100mm / 1,200mm (high-rise)', 'Fire resistance ratings (FRR) per SCDF Table 4.2']},
      {id:'LTA',  name:'Land Transport Authority',
       rules:['Parking quantum per use type', 'Standard bay 2.5m × 5.0m', 'Accessible bay 3.6m × 5.0m', 'Loading/unloading bay 3.5m × 12m × 4.2m clear height']},
      {id:'NEA',  name:'National Environment Agency',
       rules:['Natural ventilation ≥ 5% of floor area', 'Mechanical ventilation - SS 553:2016 fresh air rates', 'Office: 10 L/s/person · Carpark: 7.5 ACH']},
      {id:'PUB',  name:'Public Utilities Board',
       rules:['Minimum platform level (flood prevention)', 'Sanitary fitting provision per PUB Code 2019', 'Surface drainage adequacy']},
    ];
    return `<div class="card" style="margin-top:16px">
      <div class="card-header"><span class="card-title">🏛 Agency Requirements</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${agencies.map(a => `
          <div style="padding:12px;background:var(--light-bg);border-radius:6px">
            <div style="font-weight:700;font-size:12px;color:var(--white);margin-bottom:6px">
              <span class="badge agency-${a.id}" style="margin-right:6px">${a.id}</span>${VUtils.esc(a.name)}
            </div>
            ${a.rules.map(r => `<div style="font-size:11px;color:var(--mid-grey);padding:1px 0">• ${VUtils.esc(r)}</div>`).join('')}
          </div>`).join('')}
      </div>
    </div>`;
  }

  function renderUbblTable() {
    const parts = [
      {part:'Part III',name:'Space, Light and Ventilation',
       bylaws:['By-Law 47 - Ceiling heights (habitable 2.6m, bathroom 2.3m)', 'By-Law 48 - Room sizes (bedroom ≥6.5m², habitable ≥11m²)', 'By-Law 38 - Natural lighting (window ≥10% floor area)', 'By-Law 39 - Natural ventilation (openable ≥5% floor area)', 'By-Law 55 - Corridor width ≥1.5m']},
      {part:'Part V', name:'Structural Requirements',
       bylaws:['By-Law 95 - Design by registered Professional Engineer', 'By-Law 96 - Loading per MS 1553 / Eurocode 1', 'By-Law 101 - Foundation approval for piling']},
      {part:'Part VI',name:'Constructional Requirements',
       bylaws:['By-Law 112 - Stair: riser ≤175mm, tread ≥255mm', 'By-Law 113 - Stair width ≥900mm private / ≥1,100mm shared', 'By-Law 117 - Weatherproof roof with drainage', 'By-Law 120 - Party walls for fire separation']},
      {part:'Part VII',name:'Fire Requirements (JBPM)',
       bylaws:['By-Law 121 - FRR per Third Schedule (30-240 min by PG)', 'By-Law 122 - Compartmentation', 'By-Law 125 - ≥2 separate exits per floor', 'By-Law 126 - Exit doors ≥900mm clear, outward opening', 'By-Law 127 - Travel distance ≤30m (non-sprinklered)', 'By-Law 133 - Fire doors FD30 minimum', 'By-Law 137 - Smoke-stop lobbies for high-rise']},
      {part:'Part IX',name:'Special Requirements',
       bylaws:['By-Law 180 - Disabled access per MS 1184:2014', 'MS 1184:2014 §5.3 - Accessible door ≥800mm clear', 'MS 1184:2014 §5.2 - Ramp ≤1:12 gradient']},
    ];
    return `<div class="card" style="margin-top:16px">
      <div class="card-header"><span class="card-title">📖 UBBL 1984 - Key By-Laws Covered</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${parts.map(p => `
          <div style="padding:12px;background:var(--light-bg);border-radius:6px">
            <div style="font-weight:700;font-size:12px;color:var(--my-red);margin-bottom:6px">${p.part} - ${p.name}</div>
            ${p.bylaws.map(b => `<div style="font-size:11px;color:var(--mid-grey);padding:1px 0">• ${VUtils.esc(b)}</div>`).join('')}
          </div>`).join('')}
      </div>
    </div>`;
  }

  function renderDesignCodeRules() {
    const rules = [
      {cat:'URA Room Sizes',
       items:['Living room ≥13m² (private) / ≥16m² (HDB)','Bedroom ≥9m²','Master bedroom ≥12.5m²','Kitchen ≥4.5m²','Study ≥5m²','Bathroom ≥2.5m²','Accessible toilet ≥4.0m²']},
      {cat:'BCA Accessibility 2025',
       items:['Door clear width ≥850mm (all accessible routes)','Door clear width ≥900mm (preferred)','Corridor width ≥1,200mm','Ramp gradient ≤1:12','Ramp width ≥1,200mm','Stair riser ≤175mm, tread ≥280mm','Handrail height 850-950mm']},
      {cat:'SCDF Fire Code',
       items:['Exit door ≥750mm (small occupancy) / ≥1,050mm (≥60 occ)','Escape stair ≥1,100mm / ≥1,200mm (high-rise)','Travel distance ≤30m non-sprinklered / ≤60m sprinklered','Compartment ≤3,500m² non-sprinklered / ≤7,000m² sprinklered']},
      {cat:'BCA Green Mark 2021',
       items:['ETTV ≤25 W/m² (residential) / ≤50 W/m² (commercial)','Roof U-value ≤0.35 W/m²K','Wall U-value ≤0.5 W/m²K','Window SHGC ≤0.3','LPD office ≤12 W/m² / retail ≤20 W/m²']},
      {cat:'UBBL Room Dimensions (MY)',
       items:['Ceiling height ≥2.6m habitable / ≥2.3m bathroom','Bedroom ≥6.5m² / habitable room ≥11m²','Stair riser ≤175mm / tread ≥255mm','Travel distance ≤30m non-sprinklered']},
    ];
    return `<div class="card">
      <div class="card-header"><span class="card-title">📐 Design Code Dimensions Reference</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${rules.map(r => `
          <div style="padding:12px;background:var(--light-bg);border-radius:6px">
            <div style="font-weight:700;font-size:12px;color:var(--white);margin-bottom:6px">${VUtils.esc(r.cat)}</div>
            ${r.items.map(i => `<div style="font-size:11px;color:var(--mid-grey);padding:1px 0">• ${VUtils.esc(i)}</div>`).join('')}
          </div>`).join('')}
      </div>
    </div>`;
  }

  function renderCheckLevels() {
    const levels = [
      [1,'IFC Entity Class','Validates element class against IFC4 schema. Flags IfcBuildingElementProxy with auto-suggested replacement.'],
      [2,'Predefined Type','Validates PredefinedType against permitted IFC4 enumeration for the element class.'],
      [3,'ObjectType (UserDefined)','When PredefinedType=USERDEFINED, checks ObjectType is populated.'],
      [4,'Classification Reference','Mandatory IfcClassificationReference for all physical elements (IFC+SG / NBeS).'],
      [5,'Classification Edition','Checks classification references the current edition (2025 / 2024).'],
      [6,'Mandatory Pset_','Validates all standard IFC4 property sets are present per element type.'],
      [7,'SGPset_ / Classification Chain','Validates all SGPset_ property sets. When a classification code is present, checks ALL code-specific required property sets from the embedded 128-code library (e.g. A-WAL-EXW triggers SGPset_WallThermal checks; A-DOR-FRD triggers SGPset_DoorFireDoor checks).'],
      [8,'Property Values & Classification Chain','Checks each required property is populated (not empty or NOTDEFINED). For classification-coded elements, verifies every code-specific property value meets the requirement (e.g. ThermalTransmittance ≤0.50 for external walls, FireResistancePeriod ≥60 for fire-rated elements).'],
      [9,'Property Data Types','Validates BOOLEAN/REAL/INTEGER/STRING types per IFC schema.'],
      [10,'Enumeration Values','Validates values against permitted lists (space categories, fire ratings etc.).'],
      [11,'Spatial Containment','Every element must be assigned to an IfcBuildingStorey.'],
      [12,'Storey Elevations','Checks for duplicate elevations within and across discipline files.'],
      [13,'Georeferencing','Singapore: SVY21/EPSG:3414 mandatory. Malaysia: GDM2000 recommended.'],
      [14,'Site & Building Hierarchy','Validates IfcProject→IfcSite→IfcBuilding→IfcBuildingStorey chain.'],
      [15,'GUID Uniqueness','Every element must have a unique GlobalId across all discipline files.'],
      [16,'Material Assignment','Structural and fire-rated elements must have material specifications.'],
      [17,'Space Boundary Integrity','IfcSpace must have Category set in Pset_SpaceCommon.'],
      [18,'Geometry Validity','Checks for degenerate, NaN, or infinite bounding boxes.'],
      [19,'IFC Schema Version','CORENET-X requires IFC4 Reference View ADD2 TC1.'],
      [20,'File Header Completeness','Validates authoring system, schema identifier and timestamp.'],
    ];
    return `<div class="card">
      <div class="card-header"><span class="card-title">✅ All 20 Validation Check Levels</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th style="width:40px">L</th><th>Check</th><th>Description</th></tr></thead>
          <tbody>
            ${levels.map(([n,name,desc]) => `
              <tr>
                <td style="font-weight:700;color:var(--teal);font-size:12px">${n}</td>
                <td style="font-weight:600;font-size:12px;white-space:nowrap">${VUtils.esc(name)}</td>
                <td style="font-size:11px;color:var(--mid-grey)">${VUtils.esc(desc)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }


  // ── HELP PAGE ─────────────────────────────────────────────────────────────

  function renderHelpPage() {
    return `
      <div style="padding:24px;max-width:1100px;margin:0 auto">
        <h1 style="font-size:28px;font-weight:800;color:var(--white);margin-bottom:4px">Help &amp; Documentation</h1>
        <p style="color:var(--mid-grey);margin-bottom:24px;font-size:12px">VERIFIQ v2.2.0  -  CORENET-X COP 3.1 December 2025 &amp; Malaysia NBeS 2024  -  192 SG rules  -  52 MY rules  -  7 AI Engines</p>

        <div class="card" style="padding:18px;margin-bottom:16px;border:1px solid var(--teal)">
          <div style="font-weight:700;font-size:13px;color:var(--teal);margin-bottom:6px">&#129504; Code of Practice Guidance  -  offline, no AI</div>
          <p style="font-size:11px;color:var(--mid-grey);margin-bottom:10px">Ask a question and VERIFIQ answers from the full text of the CORENET-X Code of Practice (COP 3.1, 442 pages) and cites the exact pages. Powered by VERIFIQ's own embedded offline engine (BM25 retrieval over the indexed COP), no external AI. Downloaded and indexed once from info.corenet.gov.sg, then works offline.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <input id="cop-q" type="text" autocomplete="off" onkeydown="if(event.key==='Enter')CopReference.search()"
              placeholder="e.g. what fire rating is required for compartment walls? gross floor area; SVY21 georeferencing"
              style="flex:1;min-width:240px;height:36px;padding:0 12px;font-size:12px;border:1px solid #2d4a6e;border-radius:6px;background:#0a1628;color:#e2e8f0">
            <button class="btn btn-primary" style="height:36px;flex-shrink:0" onclick="CopReference.search()">Ask the COP</button>
          </div>
          <div id="cop-results" style="margin-top:6px"></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div class="card" style="padding:20px">
            <div style="font-weight:700;font-size:12px;color:var(--teal);margin-bottom:10px">&#128640; Getting Started</div>
            <ol style="font-size:12px;line-height:2;padding-left:18px;color:var(--mid-grey)">
              <li>Select <strong style="color:var(--teal)">Country Mode</strong>  -  Singapore (CORENET-X) or Malaysia (NBeS)</li>
              <li>Select <strong style="color:var(--teal)">Submission Gateway</strong>  -  G1, G1.5 Piling, G2 Construction, or G3/G4 Completion</li>
              <li>Click <strong style="color:var(--teal)">Add Files</strong> and load your .ifc / .ifczip / .ifcxml file</li>
              <li>Click <strong style="color:var(--teal)">Run Validation</strong>  -  all 20 check levels run automatically</li>
              <li><strong style="color:#ef4444">Critical</strong> findings block CORENET-X submission  -  fix these first</li>
              <li>Click <strong style="color:var(--teal)">Fix</strong> on property findings to open the Property Editor</li>
              <li>Re-run validation on the corrected IFC file, then export your report</li>
            </ol>
          </div>
          <div class="card" style="padding:20px">
            <div style="font-weight:700;font-size:12px;color:var(--teal);margin-bottom:10px">&#128196; Two Questions VERIFIQ Answers</div>
            <div style="font-size:12px;color:var(--mid-grey);line-height:1.8;margin-bottom:12px">
              <strong style="color:var(--white)">Q1 - Is the IFC model complete?</strong><br>
              Every element has the entity class, classification code, all Pset_ and SGPset_ properties, and correct values all 10 Singapore agencies require simultaneously.
            </div>
            <div style="font-size:12px;color:var(--mid-grey);line-height:1.8">
              <strong style="color:var(--white)">Q2 - Is the classification chain complete?</strong><br>
              When a classification code is present (e.g. A-WAL-FRW), all linked SGPset_ property sets and required values are also present. 206 COP 3.1 codes, per agency, per gateway.
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">
          <div class="card" style="padding:18px">
            <div style="font-weight:700;font-size:12px;color:var(--teal);margin-bottom:10px">&#127981; ArchiCAD Export</div>
            <ol style="font-size:11px;line-height:1.9;padding-left:16px;color:var(--mid-grey)">
              <li>Download IFC+SG Translator from <strong>go.gov.sg/ifcsg</strong></li>
              <li>Options &gt; Import Scheme  -  import the translator</li>
              <li>Assign IFC+SG classification codes to all elements</li>
              <li>File &gt; Save as IFC &gt; select IFC+SG translator</li>
              <li>Verify IFC4 Reference View is selected</li>
            </ol>
          </div>
          <div class="card" style="padding:18px">
            <div style="font-weight:700;font-size:12px;color:var(--teal);margin-bottom:10px">&#127963; Revit Export</div>
            <ol style="font-size:11px;line-height:1.9;padding-left:16px;color:var(--mid-grey)">
              <li>Download IFC+SG Shared Parameters from <strong>go.gov.sg/ifcsg</strong></li>
              <li>Manage &gt; Shared Parameters  -  load the file</li>
              <li>Add parameters to all families needing SGPset_ data</li>
              <li>File &gt; Export &gt; IFC &gt; IFC+SG 2025 configuration &gt; IFC4</li>
            </ol>
          </div>
          <div class="card" style="padding:18px">
            <div style="font-weight:700;font-size:12px;color:var(--teal);margin-bottom:10px">&#128209; Key Links</div>
            <div style="font-size:11px;color:var(--mid-grey);line-height:2.1">
              <div><a href="#" onclick="VBridge.send('openUrl',{url:'https://go.gov.sg/ifcsg'})" style="color:var(--teal)">go.gov.sg/ifcsg</a>  -  IFC+SG Resource Kit</div>
              <div><a href="#" onclick="VBridge.send('openUrl',{url:'https://go.gov.sg/cxcop'})" style="color:var(--teal)">go.gov.sg/cxcop</a>  -  COP 3.1 Document</div>
              <div><a href="#" onclick="VBridge.send('openUrl',{url:'https://info.corenet.gov.sg'})" style="color:var(--teal)">info.corenet.gov.sg</a>  -  CORENET-X Portal</div>
              <div><a href="#" onclick="VBridge.send('openUrl',{url:'https://verifiq.bbmw0.com'})" style="color:var(--teal)">verifiq.bbmw0.com</a>  -  Product Website</div>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div class="card" style="padding:18px">
            <div style="font-weight:700;font-size:12px;color:var(--teal);margin-bottom:10px">&#127480;&#127468; Singapore  -  10 Agencies, 4 Gateways</div>
            <div style="font-size:11px;color:var(--mid-grey);line-height:1.9">
              <div><strong style="color:var(--teal)">G1</strong>  -  BCA, URA: GFA categories (25 approved), room sizes</div>
              <div><strong style="color:var(--teal)">G1.5 Piling</strong>  -  Every pile: 37+ properties, CutOffLevel_SHD, DA1-1_CompressionCapacity</div>
              <div><strong style="color:var(--teal)">G2 Construction</strong>  -  All 10 agencies: full SGPset_, SCDF fire, NEA ventilation, PUB WELS, LTA parking, SLA SVY21</div>
              <div><strong style="color:var(--teal)">G3/G4 Completion</strong>  -  As-built Mark on structural elements, agency clearances</div>
              <div><strong style="color:var(--teal)">JTC</strong>  -  Industrial floor loading &ge;10 kN/m&sup2;, factory ceiling height &ge;5m</div>
              <div style="margin-top:8px;padding:7px;background:rgba(0,196,160,.08);border-left:3px solid var(--teal);border-radius:4px;font-size:11px">
                <strong style="color:var(--teal)">GFA Critical:</strong> AGF_DevelopmentUse + AVF_IncludeAsGFA mandatory on every IfcSpace/AREA_GFA. Missing = automatic URA rejection.
              </div>
            </div>
          </div>
          <div class="card" style="padding:18px">
            <div style="font-weight:700;font-size:12px;color:var(--teal);margin-bottom:10px">&#127474;&#127486; Malaysia  -  NBeS 2024</div>
            <div style="font-size:11px;color:var(--mid-grey);line-height:1.9">
              <div><strong style="color:var(--teal)">UBBL 1984</strong>  -  Room sizes, ceiling heights, fire escape, structural</div>
              <div><strong style="color:var(--teal)">MS 1184:2014</strong>  -  OKU: ramp 1:12, door 800mm, lift 1100&times;1400mm</div>
              <div><strong style="color:var(--teal)">JBPM 2020</strong>  -  FRR 1hr min, Bomba access 4500mm, hydrant 90m</div>
              <div><strong style="color:var(--teal)">CIDB NBeS</strong>  -  Mark, MaterialGrade, ConstructionMethod (incl. IBS)</div>
              <div><strong style="color:var(--teal)">GDM2000</strong>  -  Malaysia coordinate system (not SVY21)</div>
            </div>
          </div>
        </div>

        <div class="card" style="padding:18px;margin-bottom:16px;border-left:3px solid #00d4ff">
  <div style="font-weight:700;font-size:12px;color:#00d4ff;margin-bottom:10px">🤖 AI Assistant - OmniOrg Engine Router</div>
  <div style="font-size:11px;color:var(--mid-grey);line-height:1.9">
    <div><strong style="color:var(--white)">What it does:</strong> Routes compliance questions to the best available AI engine - Groq, DeepSeek, GLM, Gemini, GPT-4o, or Claude. Add a free API key to get started (Groq and DeepSeek both have free tiers).</div>
    <div style="margin-top:6px"><strong style="color:var(--white)">Quick Actions:</strong> Analyze Compliance - Executive Summary - Suggest Fixes - Explain Score - Building Code Help</div>
    <div style="margin-top:6px"><strong style="color:#00ff88">Free providers:</strong> Groq (console.groq.com/keys) and DeepSeek (platform.deepseek.com) both offer free API tiers with no credit card required.</div>
    <div style="margin-top:6px"><strong style="color:var(--white)">API Keys:</strong> Click API Keys in the AI Assistant page to save your keys (stored locally on your machine, never sent to VERIFIQ servers).</div>
    <div style="margin-top:6px"><strong style="color:var(--white)">Routing order:</strong> CHAT - Claude then GPT-4o then Gemini then DeepSeek then Groq - CODE - DeepSeek first - FAST - Groq first - REASONING - DeepSeek then Claude</div>
  </div>
</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:14px 18px;background:var(--card-bg);border-radius:8px;border:1px solid var(--border)">
          <button class="btn btn-teal" style="font-size:11px" onclick="App.navigate('manual')">&#128218; Full User Manual</button>
          <button class="btn btn-ghost" style="font-size:11px" onclick="VBridge.send('openUrl',{url:'https://verifiq.bbmw0.com'})">&#127760; Website</button>
          <button class="btn btn-ghost" style="font-size:11px" onclick="VBridge.send('openUrl',{url:'https://github.com/bbmw96/verifiq/releases'})">&#128196; Release Notes</button>
          <button class="btn btn-ghost" style="font-size:11px" onclick="VBridge.send('openUrl',{url:'https://go.gov.sg/ifcsg'})">&#127970; IFC+SG Resource Kit</button>
          <span style="flex:1"></span>
          <span style="font-size:11px;color:var(--mid-grey)"><strong style="color:var(--teal)">bbmw0@hotmail.com</strong> &nbsp;|&nbsp; +44 7920 212 969</span>
        </div>
      </div>
    `;
  }
  function renderValidationPage() {
    const state   = VState.get();
    const files   = state.filesLoaded  || [];
    const session = state.session;
    const mode    = state.countryMode;
    const modeInfo = VUtils.countryDisplay(mode);
    const hasFiles  = files.length > 0;
    const hasResults = !!session;

    return `<div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div>
          <h1>Validation</h1>
          <p class="${modeInfo.cls}" style="font-size:13px;font-weight:600;margin-top:2px">${modeInfo.label}</p>
          <p style="font-size:12px;color:var(--mid-grey);margin-top:4px">
            20 IFC data levels, 987 IFC+SG property rules (962 Singapore, 25 Malaysia), 286 entity property requirements, 192 Singapore and 52 Malaysia design rules, and 206 classification codes across 10 CORENET-X agencies, with AI-powered explanations, applied to every element
          </p>
        </div>
        ${hasFiles ? `<div style="display:flex;gap:10px">
          <button class="btn btn-primary" onclick="VBridge.openFile()">📂 Open More Files</button>
          <button class="btn btn-outline" onclick="App.navigate('attributes')">🗂 Attributes</button>
          <button class="btn btn-teal" onclick="VBridge.runValidation()">▶ Run Validation</button>
        </div>` : ''}
      </div>

      ${!hasFiles ? `
      <div class="card">
        ${VUtils.emptyState('📂', 'No IFC files loaded',
          'Open an IFC file from ArchiCAD, Revit, Tekla, or any IFC-capable BIM authoring tool to begin.',
          '<button class="btn btn-primary" style="margin-top:16px" onclick="VBridge.openFile()">📂 Open IFC File</button>')}
      </div>` : `

      <!-- Live validation progress (shown only during validation) -->
      ${state.loading ? `
      <div class="card" style="margin-bottom:16px;border-left:4px solid var(--teal)">
        <div style="font-size:14px;font-weight:600;color:var(--white);margin-bottom:10px">
          ⏳ Running validation...
        </div>
        <div style="background:var(--border);border-radius:4px;height:8px;overflow:hidden;margin-bottom:8px">
          <div id="val-progress-bar" style="background:var(--teal);height:100%;width:0%;border-radius:4px;transition:width .3s ease"></div>
        </div>
        <div id="val-progress-label" style="font-size:12px;color:var(--mid-grey)">Initialising...</div>
      </div>` : ''}

      <!-- Loaded files -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header">
          <span class="card-title">📁 Files Ready for Validation (${files.length})</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>File Name</th><th>Schema</th><th>Elements</th><th>Types</th><th>Proxy Elements</th></tr></thead>
            <tbody>
              ${files.map(f => `<tr>
                <td><strong>${VUtils.esc(f.name)}</strong></td>
                <td>${VUtils.esc(f.schema)}</td>
                <td>${VUtils.fmt(f.elements)}</td>
                <td>${VUtils.fmt(f.types||0)}</td>
                <td>${f.proxies > 0 ? `<span class="badge badge-warning">⚠ ${VUtils.fmt(f.proxies)}</span>` : '<span class="badge badge-pass">None</span>'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Model inventory: every IFC entity type recognised -->
      ${(()=>{ const inv = state.inventory || [];
        if (!inv.length) return '';
        const total = inv.reduce((a,b)=>a+(b.count||0),0) || 1;
        const rows = inv.map(it => {
          const pct = Math.round((it.count/total)*1000)/10;
          return `<tr>
            <td><code style="color:#9ab8d4">${VUtils.esc(it.cls)}</code></td>
            <td>${VUtils.fmt(it.count)}</td>
            <td><div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;max-width:200px;height:8px;background:#0f1e30;border-radius:4px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:#0e7c86;border-radius:4px"></div>
              </div>
              <span style="font-size:11px;color:var(--mid-grey);min-width:38px">${pct}%</span>
            </div></td>
          </tr>`;
        }).join('');
        return `<div class="card" style="margin-bottom:16px">
          <div class="card-header"><span class="card-title">🧱 Model Inventory  -  ${VUtils.fmt(inv.length)} IFC entity type(s), ${VUtils.fmt(total)} element(s)</span></div>
          <div style="font-size:12px;color:var(--mid-grey);padding:2px 4px 12px">
            Every distinct IFC entity type VERIFIQ recognised across the loaded model(s). Each type is parsed and checked independently, whatever BIM authoring tool produced it, so nothing is silently dropped.
          </div>
          <div class="table-wrap" style="max-height:360px;overflow-y:auto">
            <table>
              <thead><tr><th>IFC Entity Type</th><th>Count</th><th>Share of model</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
      })()}

      <!-- 20 Check Levels overview -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><span class="card-title">✅ What VERIFIQ Will Check</span></div>
        <div class="two-col">
          <div>
            <h3>Data Compliance: 20 Levels</h3>
            <div style="font-size:12px;line-height:1.8;color:var(--mid-grey)">
              L1: IFC Entity Class &nbsp; L2: Predefined Type &nbsp; L3: ObjectType<br>
              L4: Classification Reference &nbsp; L5: Classification Edition<br>
              L6: Mandatory Pset_ &nbsp; L7: SGPset_ (Singapore) &nbsp; L8: Property Values<br>
              L9: Data Types &nbsp; L10: Enumeration Values &nbsp; L11: Spatial Containment<br>
              L12: Storey Elevations &nbsp; L13: Georeferencing &nbsp; L14: Site Hierarchy<br>
              L15: GUID Uniqueness &nbsp; L16: Materials &nbsp; L17: Space Boundaries<br>
              L18: Geometry Validity &nbsp; L19: IFC Schema Version &nbsp; L20: File Header
            </div>
          </div>
          <div>
            <h3>Design Code: 50+ Rules</h3>
            <div style="font-size:12px;line-height:1.8;color:var(--mid-grey)">
              ${mode === 'Malaysia' ? `
              UBBL room dimensions and heights<br>
              MS 1184:2014 accessible door widths (850mm min)<br>
              Corridor widths for disabled access<br>
              JBPM 2020 fire door ratings<br>
              Ramp slopes (1:12 max for accessible)<br>
              Stair riser and tread dimensions<br>
              GBI Malaysia U-value and thermal checks` : `
              URA: Bedroom ≥ 9m², Living ≥ 13m², Kitchen ≥ 4.5m²<br>
              BCA Accessibility 2025: Door width ≥ 850mm<br>
              BCA: Corridor width ≥ 1,200mm, Ramp 1:12 max<br>
              SCDF Fire Code: Door and wall fire ratings<br>
              BCA Green Mark 2021: U-values, WWR, RETV<br>
              URA GFA: Balcony area ≤ 10% of unit GFA<br>
              LTA: Parking dimensions and turning radii`}
            </div>
          </div>
        </div>
        <div style="margin-top:16px;text-align:center">
          <button class="btn btn-teal" onclick="VBridge.runValidation()" style="padding:12px 32px;font-size:14px">
            ▶ Run Full Validation Now
          </button>
        </div>
      </div>`}

      ${hasResults ? `
      <!-- Previous results summary -->
      <div class="card" style="background:var(--green-bg);border-color:var(--green)">
        <div class="card-header">
          <span class="card-title" style="color:var(--green)">✓ Last Validation Results Available</span>
          <button class="btn btn-outline" onclick="App.navigate('results')">View Full Results →</button>
        </div>
        <div class="stat-grid" style="margin-top:8px">
          ${VUtils.statCard(VUtils.pct(session.score),    'Data Score',    VUtils.scoreColour(session.score))}
          ${session.designStats ? VUtils.statCard(VUtils.pct(session.designStats.score), 'Design Score', VUtils.scoreColour(session.designStats.score)) : ''}
          ${VUtils.statCard(VUtils.fmt(session.total),    'Elements')}
          ${VUtils.statCard(VUtils.fmt(session.critical), 'Critical',      session.critical > 0 ? 'red' : 'green')}
          ${VUtils.statCard(VUtils.fmt(session.errors),   'Errors',        session.errors   > 0 ? 'amber' : 'green')}
        </div>
        <div style="margin-top:12px;display:flex;gap:10px">
          <button class="btn btn-primary"  onclick="App.navigate('results')">📋 All Findings</button>
          <button class="btn btn-teal"     onclick="App.navigate('critical')">🚨 Critical Issues</button>
          ${session.designStats ? `<button class="btn btn-outline" onclick="App.navigate('design')">📐 Design Code</button>` : ''}
          <button class="btn btn-outline"  onclick="VBridge.send('export',{})">📤 Export Reports</button>
        </div>
      </div>` : ''}
    </div>`;
  }


  // -- USER GUIDE PAGE ----------------------------------------------------------

  function renderUserGuidePage() {
    return `<div>
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">
        <div>
          <h1 style="margin:0">User Guide</h1>
          <p style="font-size:13px;color:var(--mid-grey);margin-top:3px">
            VERIFIQ v2.2.0 - IFC Compliance Checker for Singapore CORENET-X and Malaysia NBeS
          </p>
        </div>
        <button class="btn btn-ghost" onclick="App.navigate('help')">← Back to Help</button>
      </div>

      <!-- Quick nav -->
      <div class="card" style="margin-bottom:16px;background:var(--navy-dark);color:white;border:none">
        <div style="font-weight:700;font-size:13px;margin-bottom:10px;color:#93C5FD">Jump to section</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px">
          ${['Overview','System Requirements','Getting Started','The Interface','Loading IFC Files',
             'Running Validation','Understanding Results','3D Viewer',
             'IFC Property Editor','Director\'s Report','Classification Library',
             'Exporting Reports','Singapore CORENET-X','Malaysia NBeS',
             'Troubleshooting','Glossary','FAQ'].map((s,i) =>
            `<button onclick="document.getElementById('ug-${i}').scrollIntoView({behavior:'smooth'})"
              style="background:rgba(255,255,255,.12);color:white;border:1px solid rgba(255,255,255,.2);
                     border-radius:4px;padding:4px 10px;cursor:pointer;font-size:11px">${s}</button>`
          ).join('')}
        </div>
      </div>

      <!-- 1. Overview -->
      <div class="card" id="ug-0">
        <div class="card-header"><span class="card-title">1. What is VERIFIQ?</span></div>
        <p style="font-size:13px;line-height:1.8">
          VERIFIQ is a desktop application that reads IFC (Industry Foundation Classes) building model files
          and checks every element against Singapore CORENET-X (IFC+SG 2025) and Malaysia NBeS (UBBL 1984)
          regulatory requirements. It runs entirely offline on your computer - no internet connection, no cloud
          upload, no subscription.
        </p>
        <div style="margin-top:14px;padding:12px;background:var(--navy-dark);color:white;border-radius:8px;margin-bottom:12px">
          <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:#93C5FD">
            The two core questions VERIFIQ answers:
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div style="background:rgba(255,255,255,.08);border-radius:6px;padding:10px">
              <div style="font-weight:700;font-size:12px;color:#6EE7B7;margin-bottom:6px">Question 1 - Cross-check with CORENET-X</div>
              <div style="font-size:11px;color:#CBD5E1;line-height:1.7">
                Is every element in the IFC model populated with all the data that Singapore CORENET-X
                (IFC+SG 2025) and/or Malaysia NBeS (UBBL 1984) require? This covers entity classes,
                classifications, all required Pset_ and SGPset_ property sets, property values,
                data types, and enumeration constraints - checked against all 8 Singapore agencies
                and all Malaysian regulatory requirements simultaneously.
              </div>
            </div>
            <div style="background:rgba(255,255,255,.08);border-radius:6px;padding:10px">
              <div style="font-weight:700;font-size:12px;color:#FCD34D;margin-bottom:6px">Question 2 - Classification to Property Set chain</div>
              <div style="font-size:11px;color:#CBD5E1;line-height:1.7">
                For every element: (a) is the IFC+SG classification code present? (b) given that
                classification code, are ALL the related SGPset_ property sets and their required
                property values also present? For example: a wall classified as an external wall
                must also have SGPset_WallThermal with ThermalTransmittance, and a wall classified
                as fire-rated must have SGPset_WallFireRating with FireResistancePeriod and
                FireTestStandard. VERIFIQ checks both parts of this chain for every element type.
              </div>
            </div>
          </div>
        </div>
        <div class="two-col" style="margin-top:14px">
          <div style="padding:12px;background:rgba(14,124,134,0.08);border-radius:8px;border:1px solid rgba(14,124,134,0.2)">
            <div style="font-weight:700;color:var(--teal);margin-bottom:6px">What VERIFIQ checks</div>
            <div style="font-size:12px;line-height:1.8;color:var(--mid-grey)">
              20 IFC data levels, 987 IFC+SG property rules (962 Singapore across 8 checking
              agencies, 25 Malaysia), 286 entity-level property requirements, plus 192 Singapore
              and 52 Malaysia design rules (UBBL 1984 all parts), applied to every element per run.
              Covers entity classes, classifications, all Pset_ and SGPset_ property sets, property
              values, design code dimensions, fire ratings, accessibility, georeferencing, and
              geometry validity.
            </div>
          </div>
          <div style="padding:12px;background:rgba(180,83,9,0.08);border-radius:8px;border:1px solid rgba(180,83,9,0.2)">
            <div style="font-weight:700;color:var(--amber);margin-bottom:6px">What VERIFIQ does NOT do</div>
            <div style="font-size:12px;line-height:1.8;color:var(--mid-grey)">
              VERIFIQ does not modify your IFC model. It does not submit to CORENET-X or NBeS portals.
              A passing result is not regulatory approval - your Qualified Person (QP) remains
              fully responsible for all regulatory compliance determinations.
            </div>
          </div>
        </div>
      </div>

      <!-- 2. System Requirements -->
      <div class="card" id="ug-1" style="margin-top:12px">
        <div class="card-header"><span class="card-title">2. System Requirements</span></div>
        <div class="two-col">
          <div>
            <div class="detail-panel">
              <div class="detail-row"><span class="detail-label">Operating System</span><span class="detail-value">Windows 10 (build 18362 or later) or Windows 11</span></div>
              <div class="detail-row"><span class="detail-label">Architecture</span><span class="detail-value">64-bit (x64) only</span></div>
              <div class="detail-row"><span class="detail-label">.NET Runtime</span><span class="detail-value">.NET 8.0 (included in installer)</span></div>
              <div class="detail-row"><span class="detail-label">RAM</span><span class="detail-value">4 GB minimum; 8 GB recommended for large models</span></div>
              <div class="detail-row"><span class="detail-label">Disk Space</span><span class="detail-value">500 MB for installation; additional space for reports</span></div>
              <div class="detail-row"><span class="detail-label">Display</span><span class="detail-value">1280 x 720 minimum; 1920 x 1080 recommended</span></div>
              <div class="detail-row"><span class="detail-label">Internet</span><span class="detail-value">Not required. Validation and export are 100% offline.</span></div>
            </div>
          </div>
          <div>
            <div style="padding:12px;background:var(--light-bg);border-radius:8px">
              <div style="font-weight:700;font-size:12px;color:var(--white);margin-bottom:8px">Compatible BIM Authoring Tools</div>
              <div style="font-size:12px;line-height:1.9;color:var(--mid-grey)">
                <strong>ArchiCAD 25+</strong> - use IFC+SG Export Translator<br>
                <strong>Revit 2022+</strong> - use IFC+SG shared parameters<br>
                <strong>Tekla Structures 2020+</strong> - use IFC+SG UDA mapping<br>
                <strong>OpenBuildings Designer</strong> - native IFC4 export<br>
                <strong>Any IFC-capable tool</strong> - IFC4 Reference View ADD2 TC1
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Getting Started -->
      <div class="card" id="ug-2" style="margin-top:12px">
        <div class="card-header"><span class="card-title">3. Getting Started</span></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
          ${[
            ['1','Install VERIFIQ','Download VERIFIQ-v2.2.0-Setup.exe from verifiq.bbmw0.com or GitHub. Run the installer as Administrator. VERIFIQ installs to C:\\Program Files\\VERIFIQ.'],
            ['2','Activate your licence','Launch VERIFIQ. Go to Licence in the sidebar. Enter your licence key (format: VRFQ-XXXX-XXXX-XXXX-XXXX). Trial mode is active by default and checks up to 10 elements per run.'],
            ['3','Select country mode','Choose Singapore (CORENET-X), Malaysia (NBeS), or SG + MY (Combined) using the mode buttons in the toolbar. Singapore mode uses IFC+SG 2025 rules. Malaysia mode uses UBBL 1984 / NBeS 2024 rules.'],
            ['4','Select gateway or purpose group','For Singapore: select the CORENET-X gateway (Design, Construction, Completion, Piling). For Malaysia: select the UBBL Purpose Group (I-IX). This controls which rules apply.'],
            ['5','Open an IFC file','Click Open IFC File. Select your .ifc, .ifczip, or .ifcxml file. VERIFIQ will parse it and show element counts and schema version. You can load multiple files for federated model checking.'],
            ['6','Run validation','Click Run Validation. VERIFIQ runs all 20 data levels and all applicable design code rules. Progress is shown in real time. Typical models validate in 5-30 seconds.'],
            ['7','Review results','Go to Dashboard for the summary. All Results for every finding. Critical Issues for submission blockers only. Design Code for dimensional checks.'],
            ['8','Export your report','Go to Export Reports. Choose your format: Word report for submission, Excel for detailed data, BCF for import back into ArchiCAD/Revit, PDF for sharing.'],
          ].map(([n,title,body]) => `
            <div style="padding:12px;background:var(--light-bg);border-radius:8px">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <div style="width:24px;height:24px;border-radius:50%;background:var(--navy-dark);color:white;
                  font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${n}</div>
                <div style="font-weight:700;font-size:12px;color:var(--white)">${title}</div>
              </div>
              <div style="font-size:11px;color:var(--mid-grey);line-height:1.7">${body}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- 4. Interface -->
      <div class="card" id="ug-3" style="margin-top:12px">
        <div class="card-header"><span class="card-title">4. The Interface</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Section</th><th>Location</th><th>What it does</th></tr></thead>
            <tbody>
              ${[
                ['Toolbar','Top bar','Mode buttons (Singapore/Malaysia/SG+MY), Open IFC File, Run Validation, Export Report. The active mode is always shown.'],
                ['Dashboard','Sidebar > Dashboard','Overall health score (A-F), KPI counts, agency risk chart, top 5 quick fixes. The main starting point after validation.'],
                ['Loaded Files','Sidebar > Loaded Files','Lists all open IFC files with element counts, schema version, and proxy element warnings. Add or remove files here.'],
                ['Validation','Sidebar > Validation','Shows files ready for checking, 20 check level overview, design code scope, and previous results summary. Run validation from here.'],
                ['All Results','Sidebar > All Results','Full filterable table of every validation finding across all 20 levels. Filter by severity, agency, or check level.'],
                ['Critical Issues','Sidebar > Critical Issues','Filtered view showing only Critical and Error findings - the ones that will prevent CORENET-X/NBeS submission.'],
                ['Design Code','Sidebar > Design Code','Findings from dimensional checks: room sizes, door widths, travel distances, fire ratings, U-values.'],
                ['3D Viewer','Sidebar > 3D Viewer','WebGL viewer showing the IFC model with elements colour-coded by compliance status. Click any element to see its properties and findings.'],
                ['Attributes','Sidebar > Attributes','Browse every element grouped by IFC entity and predefined type, read live from the file. Two search bars filter across the whole model however many thousands of properties it holds: the first finds elements by property name, property set, or inherited (type) property set; the second finds them by category and classification reference (IFC entity, predefined type, classification code, or material). Click any element to expand its full attributes, the OwnerHistory chain, and every property set.'],
                ['Export Reports','Sidebar > Export Reports','Generate compliance reports in Word, PDF, Excel, CSV, JSON, HTML, XML, Markdown, or BCF format.'],
                ['Rules Database','Settings > Rules Database','Browse all rules embedded in VERIFIQ: Singapore agencies, Malaysia UBBL by-laws, design code dimensions, all 20 check levels.'],
                ['Licence','Settings > Licence','View your current licence tier, activate a new key, see tier comparison table.'],
                ['Settings','Settings > Settings','Network settings, update check, proxy configuration.'],
                ['About','Settings > About VERIFIQ','Version information, technology stack, regulatory codes covered, version history.'],
              ].map(([s,l,d]) => `<tr>
                <td style="font-weight:600;font-size:12px">${s}</td>
                <td style="font-size:11px;color:var(--mid-grey);white-space:nowrap">${l}</td>
                <td style="font-size:11px;color:var(--mid-grey)">${d}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 5. Loading IFC Files -->
      <div class="card" id="ug-4" style="margin-top:12px">
        <div class="card-header"><span class="card-title">5. Loading IFC Files</span></div>
        <div class="two-col">
          <div>
            <h3>Supported File Formats</h3>
            <div style="font-size:12px;color:var(--mid-grey)">
              <div style="padding:8px;background:rgba(14,124,134,0.08);border-radius:6px;margin-bottom:6px">
                <strong style="color:var(--teal)">Fully validated (IFC compliance checking)</strong><br>
                <span style="line-height:1.9">
                  <strong>.ifc</strong> - Standard IFC STEP format (recommended for CORENET-X)<br>
                  <strong>.ifczip</strong> - Compressed IFC (smaller file size, same validation)<br>
                  <strong>.ifcxml</strong> - IFC in XML format (same validation as .ifc)
                </span>
              </div>
              <div style="padding:8px;background:rgba(180,83,9,0.08);border-radius:6px;margin-bottom:6px">
                <strong style="color:var(--amber)">Opens with export instructions (cannot validate directly)</strong><br>
                <span style="line-height:1.9">
                  <strong>.rvt</strong> - Revit: VERIFIQ shows IFC+SG export instructions<br>
                  <strong>.pln</strong> - ArchiCAD: VERIFIQ shows IFC+SG translator download link<br>
                  <strong>.dwg / .dxf</strong> - AutoCAD: export to IFC from your BIM software<br>
                  <strong>.nwd / .nwf</strong> - Navisworks: extract discipline IFCs first<br>
                  <strong>.skp</strong> - SketchUp: export via IFC-Manager plugin
                </span>
              </div>
              <div style="padding:8px;background:var(--border);border-radius:6px">
                <strong style="color:var(--mid-grey)">Reference / visual only (loaded but not validated)</strong><br>
                <span style="line-height:1.9">
                  <strong>.bcf</strong> - BIM Collaboration Format: issue tracking import<br>
                  <strong>.obj / .fbx / .stl</strong> - Mesh geometry: 3D visual reference only<br>
                  <strong>.e57 / .las</strong> - Point cloud: scan data visual reference<br>
                  <strong>.pdf</strong> - Drawing reference alongside IFC model<br>
                  <strong>.xlsx</strong> - IFC+SG Industry Mapping Excel: rules import
                </span>
              </div>
            </div>
            <h3 style="margin-top:14px">Preparing your IFC from ArchiCAD</h3>
            <ol style="font-size:12px;line-height:1.9;color:var(--mid-grey);padding-left:18px">
              <li>Download the IFC+SG Export Translator from the IFC+SG Resource Kit at go.gov.sg/ifcsg</li>
              <li>In ArchiCAD: File > Save as IFC</li>
              <li>Select the IFC+SG Export Translator scheme</li>
              <li>Schema: IFC4 Reference View</li>
              <li>Load the .ifc file into VERIFIQ</li>
            </ol>
          </div>
          <div>
            <h3>Preparing your IFC from Revit</h3>
            <ol style="font-size:12px;line-height:1.9;color:var(--mid-grey);padding-left:18px">
              <li>Download IFC+SG shared parameter files from the IFC+SG Resource Kit at go.gov.sg/ifcsg</li>
              <li>Load via Manage > Shared Parameters</li>
              <li>File > Export > IFC > IFC4 Reference View</li>
              <li>Apply the IFC+SG export settings (.json)</li>
              <li>Load the .ifc file into VERIFIQ</li>
            </ol>
            <h3 style="margin-top:14px">Federated Models</h3>
            <div style="font-size:12px;line-height:1.7;color:var(--mid-grey)">
              VERIFIQ supports federated BIM - load multiple IFC files
              (Architecture, Civil & Structural, M&E) at once. It checks GUID
              uniqueness across all files and cross-discipline rules. Use the
              Loaded Files page to add or remove discipline files.
            </div>
          </div>
        </div>
      </div>

      <!-- 6. Running Validation -->
      <div class="card" id="ug-5" style="margin-top:12px">
        <div class="card-header"><span class="card-title">6. Running Validation</span></div>
        <div class="two-col">
          <div>
            <h3>Country Modes</h3>
            <div class="detail-panel">
              <div class="detail-row"><span class="detail-label" style="width:120px">SG Singapore</span><span class="detail-value" style="font-size:11px">CORENET-X IFC+SG 2025. All 10 agencies (BCA/SCDF/URA/PUB/LTA/HDB/SLA/NEA/NParks/JTC). SVY21 georeferencing mandatory. 89 agency rules + 50+ design code rules.</span></div>
              <div class="detail-row"><span class="detail-label" style="width:120px">MY Malaysia</span><span class="detail-value" style="font-size:11px">NBeS 2024 / UBBL 1984. JBPM, CIDB, JKR. GDM2000 georeferencing. Purpose Group-specific rules.</span></div>
              <div class="detail-row"><span class="detail-label" style="width:120px">SG + MY</span><span class="detail-value" style="font-size:11px">Runs both rulesets simultaneously. Useful for firms with projects in both countries.</span></div>
            </div>
            <h3 style="margin-top:14px">Singapore Gateways</h3>
            <div style="font-size:12px;line-height:1.8;color:var(--mid-grey)">
              Select the target CORENET-X gateway to control which rules apply:<br>
              <strong>Design Gateway (G1)</strong> - Classification, space data, GFA<br>
              <strong>Piling Gateway</strong> - Pile classification and foundation data<br>
              <strong>Construction Gateway (G2)</strong> - Full data + fire ratings + structural<br>
              <strong>Completion Gateway (G3)</strong> - As-built data + CSC/TOP requirements<br>
              <strong>DSP</strong> - Direct Submission (simplified, smaller projects)
            </div>
          </div>
          <div>
            <h3>Malaysia Purpose Groups</h3>
            <div style="font-size:12px;line-height:1.8;color:var(--mid-grey)">
              Select the UBBL 1984 Purpose Group to apply occupancy-specific rules:<br>
              <strong>PG I</strong> - Residential (houses, flats)<br>
              <strong>PG II</strong> - Residential (flats, hotels)<br>
              <strong>PG III</strong> - Offices<br>
              <strong>PG IV</strong> - Shops and commercial<br>
              <strong>PG V</strong> - Assembly (cinemas, stadiums)<br>
              <strong>PG VI</strong> - Industrial (factories, warehouses)<br>
              <strong>PG VII</strong> - Storage<br>
              <strong>PG VIII</strong> - Healthcare and institutional<br>
              <strong>PG IX</strong> - Mixed use
            </div>
            <h3 style="margin-top:14px">How long does validation take?</h3>
            <div style="font-size:12px;color:var(--mid-grey)">
              Small model (under 500 elements): 2-5 seconds<br>
              Typical model (500-5,000 elements): 5-20 seconds<br>
              Large model (5,000-50,000 elements): 20-120 seconds<br>
              Very large federated model: up to 5 minutes
            </div>
          </div>
        </div>
      </div>

      <!-- 7. Understanding Results -->
      <div class="card" id="ug-6" style="margin-top:12px">
        <div class="card-header"><span class="card-title">7. Understanding Validation Results</span></div>
        <div class="two-col">
          <div>
            <h3>Severity Levels</h3>
            <div class="detail-panel">
              <div class="detail-row">
                <span><span class="badge badge-critical" style="margin-right:8px">Critical</span></span>
                <span class="detail-value" style="font-size:11px">Submission will definitely be rejected. Must fix before uploading to CORENET-X or NBeS.</span>
              </div>
              <div class="detail-row">
                <span><span class="badge badge-error" style="margin-right:8px">Error</span></span>
                <span class="detail-value" style="font-size:11px">Submission will likely be rejected or cause agency review comments. Strongly recommended to fix.</span>
              </div>
              <div class="detail-row">
                <span><span class="badge badge-warning" style="margin-right:8px">Warning</span></span>
                <span class="detail-value" style="font-size:11px">May cause agency queries. Review and fix where applicable before submission.</span>
              </div>
              <div class="detail-row">
                <span><span class="badge badge-pass" style="margin-right:8px">Pass</span></span>
                <span class="detail-value" style="font-size:11px">Element meets all requirements for this check level.</span>
              </div>
            </div>
          </div>
          <div>
            <h3>The Compliance Score</h3>
            <div style="font-size:12px;line-height:1.8;color:var(--mid-grey)">
              The compliance score (0-100) and grade (A-F) measure overall model quality:<br>
              <strong>A (90-100)</strong> - Excellent. Ready to submit.<br>
              <strong>B (75-89)</strong> - Good. Minor issues only.<br>
              <strong>C (60-74)</strong> - Fair. Notable issues to resolve.<br>
              <strong>D (40-59)</strong> - Poor. Significant rework needed.<br>
              <strong>F (0-39)</strong> - Critical. Major compliance gaps.<br><br>
              The score is computed from two components: Data Compliance (20 levels)
              and Design Code (dimensional rules). Both are shown as separate bars.
            </div>
          </div>
        </div>
        <h3 style="margin-top:14px">What each result column means</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Column</th><th>Meaning</th></tr></thead>
            <tbody>
              ${[
                ['Severity','Critical / Error / Warning / Pass'],
                ['Check Level','Which of the 20 data levels or design code rule triggered this finding'],
                ['Element Name','The name or identifier of the IFC element with the issue'],
                ['GUID','The GlobalId of the element - use this to locate it in your BIM tool'],
                ['Storey','Which building storey the element is on'],
                ['Agency','Which regulatory agency (BCA, URA, SCDF etc.) requires the missing data'],
                ['Property Set / Property','The specific IFC property set and property that is missing or incorrect'],
                ['Message','Plain-language description of what is wrong'],
                ['Fix','Specific guidance on what to change in your BIM model to resolve the issue'],
              ].map(([col,meaning]) => `<tr>
                <td style="font-weight:600;font-size:12px;white-space:nowrap">${col}</td>
                <td style="font-size:11px;color:var(--mid-grey)">${meaning}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 8. 3D Viewer -->
      <div class="card" id="ug-7" style="margin-top:12px">
        <div class="card-header"><span class="card-title">8. The 3D Viewer</span></div>
        <div class="two-col">
          <div>
            <h3>Navigation</h3>
            <div style="font-size:12px;line-height:1.9;color:var(--mid-grey)">
              <strong>Orbit</strong> - Left mouse button drag<br>
              <strong>Pan</strong> - Right mouse button drag, or Shift + left drag<br>
              <strong>Zoom</strong> - Mouse scroll wheel<br>
              <strong>Reset view</strong> - Click the reset button in the viewer toolbar<br>
              <strong>Select element</strong> - Left click on any element<br>
              <strong>Deselect</strong> - Click empty space
            </div>
            <h3 style="margin-top:14px">Compliance colour coding</h3>
            <div class="detail-panel">
              <div class="detail-row"><span style="display:inline-block;width:12px;height:12px;background:#EF4444;border-radius:2px;margin-right:6px"></span><span class="detail-value" style="font-size:11px">Red - element has Critical or Error findings</span></div>
              <div class="detail-row"><span style="display:inline-block;width:12px;height:12px;background:#F59E0B;border-radius:2px;margin-right:6px"></span><span class="detail-value" style="font-size:11px">Amber - element has Warning findings only</span></div>
              <div class="detail-row"><span style="display:inline-block;width:12px;height:12px;background:#10B981;border-radius:2px;margin-right:6px"></span><span class="detail-value" style="font-size:11px">Green - element passes all checks</span></div>
              <div class="detail-row"><span style="display:inline-block;width:12px;height:12px;background:#6B7280;border-radius:2px;margin-right:6px"></span><span class="detail-value" style="font-size:11px">Grey - element not yet validated</span></div>
            </div>
          </div>
          <div>
            <div style="padding:8px;background:rgba(180,83,9,0.08);border-radius:6px;border:1px solid rgba(180,83,9,0.2);margin-bottom:10px">
              <div style="font-weight:700;font-size:11px;color:var(--amber);margin-bottom:4px">
                About "web-ifc: Cannot read properties of undefined"
              </div>
              <div style="font-size:11px;color:var(--mid-grey);line-height:1.7">
                This message in the status bar is <strong>normal</strong> - it means the web-ifc WASM
                engine was not used and the 3D viewer automatically switched to the C# geometry engine instead.
                The model will still display correctly. This happens when no IFC file has been loaded yet,
                or when the WASM engine encounters a geometry format it cannot process directly.
                It is a fallback notification, not an error.
              </div>
            </div>
            <h3>Element Inspector</h3>
            <div style="font-size:12px;line-height:1.8;color:var(--mid-grey)">
              Click any element in the 3D view to open the Element Inspector panel.
              It shows:<br>
              - IFC class and predefined type<br>
              - Element name and GUID<br>
              - Storey and spatial container<br>
              - All property sets and their values<br>
              - All validation findings for this element<br>
              - Specific fix guidance per finding<br><br>
              Use the GUID shown in the inspector to locate the element in ArchiCAD
              (Edit > Find and Select > by GlobalId) or Revit (Manage > Inquiry > IFC GUID).
            </div>
          </div>
        </div>
      </div>

      <!-- IFC Property Editor (new ug-8) -->
      <div class="card" id="ug-8" style="margin-top:12px">
        <div class="card-header"><span class="card-title">9. IFC Property Editor - Fix Without Going Back to ArchiCAD</span></div>
        <div style="font-size:12px;line-height:1.8;color:var(--mid-grey)">
          <p>Fix missing or incorrect property values directly in VERIFIQ. Your original IFC is never modified.</p>
          <ol style="padding-left:20px;line-height:1.9;margin-top:6px">
            <li>Run validation, open Critical Issues or All Results</li>
            <li>Click <strong>✏️ Fix</strong> on any Pset_ or SGPset_ error row</li>
            <li>In the Property Editor page: enter the correct value for each queued property</li>
            <li>Click <strong>Apply Fixes and Save Corrected IFC</strong></li>
            <li>VERIFIQ saves <code>filename_VERIFIQ_FIXED_timestamp.ifc</code> next to your original</li>
            <li>Open the corrected file in VERIFIQ, re-validate, then submit to CORENET-X</li>
          </ol>
          <div style="padding:8px;background:rgba(180,83,9,0.08);border-radius:6px;margin-top:8px;font-size:11px">
            <strong>Fixable here:</strong> ThermalTransmittance, FireResistancePeriod, IsExternal, LoadBearing, GFACategory, WELSRating, ClearWidth, and all other IfcPropertySingleValue properties.<br>
            <strong>Must fix in ArchiCAD/Revit:</strong> IFC entity class, classification codes, spatial containment.
          </div>
        </div>
      </div>

      <!-- Director's Report (new ug-9) -->
      <div class="card" id="ug-9" style="margin-top:12px">
        <div class="card-header"><span class="card-title">10. Director's Report - One-Click Executive Submission Brief</span></div>
        <div style="font-size:12px;line-height:1.8;color:var(--mid-grey)">
          <p>Click <strong>✅ Check All - Singapore</strong> on the Dashboard. The Director's Report appears below the KPI cards.</p>
          <ul style="padding-left:20px;line-height:1.9;margin-top:6px">
            <li><strong>Readiness Verdict</strong> - Ready / Conditionally Ready / Not Ready with 0-100 score</li>
            <li><strong>Agency Risk Table</strong> - all 8 SG agencies rated HIGH/MEDIUM/LOW/CLEAR</li>
            <li><strong>Top 5 Blockers</strong> - ranked by count, with fix guidance per agency</li>
            <li><strong>Action Plan</strong> - prioritised steps with rework time estimates</li>
            <li><strong>Effort Estimate</strong> - total hours broken down by Critical/Error/Warning</li>
            <li><strong>Gateway Readiness</strong> - which CORENET-X gateway the model qualifies for</li>
            <li><strong>Model Quality Grade</strong> - A/B/C/D/F from classification + pset + geometry coverage</li>
          </ul>
        </div>
      </div>

      <!-- Classification Library (new ug-10) -->
      <div class="card" id="ug-10" style="margin-top:12px">
        <div class="card-header"><span class="card-title">11. Classification Library - 128 IFC+SG Codes with Exact Property Rules</span></div>
        <div style="font-size:12px;line-height:1.8;color:var(--mid-grey)">
          <p>VERIFIQ embeds 128 IFC+SG classification codes (COP3, 2025). For every code, VERIFIQ knows exactly
          which SGPset_ property sets and properties are required, by which agency, at which gateway.</p>
          <p style="margin-top:8px"><strong>Coverage:</strong> All architectural elements (walls, slabs, doors, windows, 17 space types, stairs, ramps, roofs, lifts),
          all structural elements (columns, beams, slabs, walls, foundations, 5 pile types),
          M&amp;E (HVAC, fire systems, electrical), plumbing (with PUB WELS ratings),
          civil, landscape, and full Malaysia NBeS codes (UBBL 1984 / MS 1184 / JBPM).</p>
          <p style="margin-top:8px"><strong>Import updates from BCA:</strong> Rules Database → Import BCA Industry Mapping Excel
          - Browse to the official Industry Mapping Excel from go.gov.sg/ifcsg (BCA, Dec 2025, COP3.1 aligned, 833 property mappings). VERIFIQ auto-detects columns and
          merges codes into the runtime library immediately. Re-run validation to use the updated rules.</p>
        </div>
      </div>

      <!-- 9. Exporting Reports -->
      <div class="card" id="ug-11" style="margin-top:12px">
        <div class="card-header"><span class="card-title">9. Exporting Reports</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Format</th><th>Best used for</th><th>Contents</th></tr></thead>
            <tbody>
              ${[
                ['Word (.docx)','Formal submission documentation, client reports','Executive summary, all findings with remediation guidance, agency summary, element tables'],
                ['PDF','Sharing, printing, archiving','Same as Word but in fixed-layout PDF format'],
                ['Excel (.xlsx)','Data analysis, tracking fixes, QA management','9 worksheets: summary, all findings, by agency, by element type, design code, passing elements, statistics, charts'],
                ['CSV','Database import, custom analysis tools','Raw findings data in comma-separated format'],
                ['BCF 2.1','Importing issues back into ArchiCAD, Revit, Tekla','Building Collaboration Format - each finding becomes a viewpoint that opens directly in your BIM tool'],
                ['JSON','API integration, custom reporting tools','Structured findings data in JSON format'],
                ['HTML','Web sharing, email attachments','Self-contained HTML report viewable in any browser'],
                ['XML','Enterprise data systems, BIM server integration','Structured XML with full element and finding data'],
                ['Markdown','Documentation systems, GitHub, Confluence','Plain text with formatting for technical documentation'],
                ['Text','Simple logging, archiving','Plain text summary for record-keeping'],
              ].map(([f,use,contents]) => `<tr>
                <td style="font-weight:600;font-size:12px;white-space:nowrap">${f}</td>
                <td style="font-size:11px;color:var(--mid-grey)">${use}</td>
                <td style="font-size:11px;color:var(--mid-grey)">${contents}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 10. Singapore CORENET-X -->
      <div class="card" id="ug-12" style="margin-top:12px">
        <div class="card-header"><span class="card-title">10. Singapore CORENET-X Guide</span></div>
        <div class="two-col">
          <div>
            <h3>What CORENET-X expects</h3>
            <div style="font-size:12px;line-height:1.8;color:var(--mid-grey)">
              Every physical element in your IFC model must have:<br>
              <strong>1. Correct IFC entity class</strong> - e.g. IfcWall, IfcSlab, IfcDoor<br>
              <strong>2. Valid PredefinedType</strong> - e.g. SOLIDWALL, FLOOR, EXTERNAL<br>
              <strong>3. IFC+SG classification</strong> - the ItemReference from the Industry Mapping Excel<br>
              <strong>4. Standard property sets</strong> - Pset_WallCommon, Pset_SlabCommon etc.<br>
              <strong>5. SGPset_ property sets</strong> - Singapore-specific: SGPset_WallFireRating, SGPset_SpaceGFA etc.<br>
              <strong>6. All required property values</strong> - FireRating, IsExternal, GrossPlannedArea etc.<br>
              <strong>7. SVY21 georeferencing</strong> - EPSG:3414 via IfcMapConversion
            </div>
          </div>
          <div>
            <h3>Common CORENET-X issues and fixes</h3>
            <div style="font-size:12px;line-height:1.8;color:var(--mid-grey)">
              <strong>Missing classification</strong> - Open IFC Manager in ArchiCAD, assign the correct IFC+SG classification code from the Industry Mapping Excel to each element type.<br>
              <strong>Missing SGPset_ fire rating</strong> - In ArchiCAD IFC Manager, add SGPset_WallFireRating to fire-rated walls. Set FireResistancePeriod to the REI value (e.g. 60).<br>
              <strong>Missing space GFA category</strong> - For each IfcSpace, add SGPset_SpaceGFA and set GFACategory (e.g. RESIDENTIAL, CARPARK, VOID).<br>
              <strong>Missing georeferencing</strong> - Configure IfcMapConversion in ArchiCAD Project Preferences > IFC tab. Set the SVY21 coordinates.
            </div>
          </div>
        </div>
        <div style="margin-top:14px;padding:12px;background:rgba(14,124,134,0.06);border-radius:8px;border:1px solid rgba(14,124,134,0.15)">
          <div style="font-weight:700;font-size:12px;color:var(--teal);margin-bottom:6px">Official Resources</div>
          <div style="font-size:12px;line-height:1.9;color:var(--mid-grey)">
            IFC+SG Resource Kit (Export Translators, Mapping): <strong>go.gov.sg/ifcsg</strong><br>
            CORENET-X Code of Practice (COP3.1): <strong>go.gov.sg/cxcop</strong><br>
            Official IFC+SG Validator (free): <strong>code.builtsearch.com/ifcsg-validator</strong><br>
            Industry Mapping Excel (master rules reference): downloadable from the IFC+SG Resource Kit<br>
            CORENET-X COP3.1.1 Edition (December 2025) (December 2025): the definitive submission standard<br>
            Good Practices Guidebook (December 2025): practical workflow guidance
          </div>
        </div>
      </div>

      <!-- 11. Malaysia NBeS -->
      <div class="card" id="ug-13" style="margin-top:12px">
        <div class="card-header"><span class="card-title">11. Malaysia NBeS Guide</span></div>
        <div class="two-col">
          <div>
            <h3>What NBeS expects</h3>
            <div style="font-size:12px;line-height:1.8;color:var(--mid-grey)">
              Every element must have correct IFC entity class, NBeS classification, standard IFC4
              property sets, and all required values per UBBL 1984 and JBPM requirements.<br><br>
              Key requirements per element:<br>
              <strong>Walls</strong> - IsExternal, LoadBearing, FireRating<br>
              <strong>Slabs</strong> - IsExternal, LoadBearing, FireRating<br>
              <strong>Doors</strong> - IsExternal, HandicapAccessible, FireRating<br>
              <strong>Spaces</strong> - Category, GrossPlannedArea, Height<br>
              <strong>Stairs</strong> - RiserHeight, TreadLength<br>
              <strong>Columns and Beams</strong> - LoadBearing, FireRating
            </div>
          </div>
          <div>
            <h3>UBBL Purpose Group selection</h3>
            <div style="font-size:12px;line-height:1.8;color:var(--mid-grey)">
              Select the correct Purpose Group before running validation - different PGs have different
              minimum fire resistance periods per the UBBL Third Schedule.<br><br>
              <strong>Fire resistance requirements by PG:</strong><br>
              PG I-II (Residential): FRR 30-60 min<br>
              PG III-IV (Office/Shop): FRR 60-90 min<br>
              PG V (Assembly): FRR 90-120 min<br>
              PG VI (Industrial): FRR 120-180 min
            </div>
          </div>
        </div>
      </div>

      <!-- 12. Troubleshooting -->
      <div class="card" id="ug-14" style="margin-top:12px">
        <div class="card-header"><span class="card-title">12. Troubleshooting</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Problem</th><th>Cause</th><th>Solution</th></tr></thead>
            <tbody>
              ${[
                ['"Integrity Error" on launch','Previous installation left a stale integrity manifest','Delete C:\\Users\\[username]\\AppData\\Local\\VERIFIQ\\integrity.manifest and relaunch'],
                ['Licence key not accepted','Key format wrong or key not matching the embedded store','Keys must be in format VRFQ-XXXX-XXXX-XXXX-XXXX (29 characters). Check for extra spaces.'],
                ['IFC file fails to open','File is corrupt, not IFC4, or schema is IFC2X3','Export a fresh IFC4 file from your BIM tool. VERIFIQ requires IFC4 Reference View.'],
                ['0 elements found after opening','IFC file may be IFC2X3 or empty','Check schema version in Loaded Files. Re-export as IFC4 from ArchiCAD/Revit.'],
                ['3D Viewer shows blank/black','WebView2 runtime issue or very large model','Click the Reset View button. For very large models, use the All Results table instead.'],
                ['Validation takes very long','Very large model (50,000+ elements)','Split the model by discipline and validate each file separately. Or upgrade RAM.'],
                ['Export fails or is empty','No validation has been run yet','Run validation first, then export. The export uses the current session results.'],
                ['Missing SGPset_ findings','Singapore mode not selected','Switch to Singapore or SG+MY mode before running validation.'],
              ].map(([p,c,s]) => `<tr>
                <td style="font-size:11px;font-weight:600;color:var(--white)">${p}</td>
                <td style="font-size:11px;color:var(--mid-grey)">${c}</td>
                <td style="font-size:11px;color:var(--teal)">${s}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 13. Glossary -->
      <div class="card" id="ug-15" style="margin-top:12px">
        <div class="card-header"><span class="card-title">13. Glossary</span></div>
        <div class="two-col">
          <div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Term</th><th>Meaning</th></tr></thead>
                <tbody>
                  ${[
                    ['IFC','Industry Foundation Classes - open standard for BIM data exchange (ISO 16739)'],
                    ['IFC+SG','Singapore extension of IFC4 with CORENET-X specific property sets'],
                    ['SGPset_','Singapore-specific IFC property sets required by CORENET-X agencies'],
                    ['MVD','Model View Definition - a subset of IFC4 defining which entities are required'],
                    ['Reference View','The IFC4 MVD used by CORENET-X (IFC4 Reference View ADD2 TC1)'],
                    ['GlobalId / GUID','Unique identifier for every IFC element - used to locate elements in BIM tools'],
                    ['Pset_','Standard IFC property set (e.g. Pset_WallCommon)'],
                    ['PredefinedType','The specific sub-type of an IFC element (e.g. SOLIDWALL, FLOOR)'],
                    ['SVY21','Singapore coordinate reference system (EPSG:3414) - mandatory for CORENET-X'],
                    ['GDM2000','Malaysia coordinate reference system - recommended for NBeS'],
                    ['IfcMapConversion','IFC entity that stores the coordinate reference system offset for a model'],
                  ].map(([t,m]) => `<tr>
                    <td style="font-weight:600;font-size:11px;white-space:nowrap">${t}</td>
                    <td style="font-size:11px;color:var(--mid-grey)">${m}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Term</th><th>Meaning</th></tr></thead>
                <tbody>
                  ${[
                    ['CORENET-X','Singapore multi-agency building regulatory approval platform (BCA/URA/GovTech)'],
                    ['NBeS','National BIM e-Submission system for Malaysia (CIDB)'],
                    ['UBBL','Uniform Building By-Laws 1984 - primary building regulation in Malaysia'],
                    ['COP','Code of Practice - the CORENET-X submission guide (COP3.1 Edition (Dec 2025)  -  81 identified components, 833 property mappings, Dec 2025)'],
                    ['BCA','Building and Construction Authority (Singapore)'],
                    ['URA','Urban Redevelopment Authority (Singapore)'],
                    ['SCDF','Singapore Civil Defence Force (fire safety)'],
                    ['GFA','Gross Floor Area - computed by URA from IfcSpace.GrossPlannedArea'],
                    ['QP','Qualified Person - the registered architect/engineer responsible for submissions'],
                    ['BCF','BIM Collaboration Format - used to import issues into ArchiCAD, Revit, Tekla'],
                    ['REI','Fire resistance rating notation: R=load bearing, E=integrity, I=insulation (minutes)'],
                  ].map(([t,m]) => `<tr>
                    <td style="font-weight:600;font-size:11px;white-space:nowrap">${t}</td>
                    <td style="font-size:11px;color:var(--mid-grey)">${m}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- 14. FAQ -->
      <div class="card" id="ug-16" style="margin-top:12px">
        <div class="card-header"><span class="card-title">14. Frequently Asked Questions</span></div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${[
            ['Does VERIFIQ submit my model to CORENET-X for me?',
             'No. VERIFIQ is a pre-submission checker only. You still upload your validated IFC file to the CORENET-X submission portal yourself. VERIFIQ helps you identify and fix all issues before submission, so your model passes the automated checker first time.'],
            ['If VERIFIQ gives a passing result, does that mean my submission will be approved?',
             'No. A VERIFIQ pass means your IFC data meets the technical requirements checked by VERIFIQ. Regulatory approval is determined by BCA, URA, SCDF and other agencies reviewing the full submission. Your Qualified Person remains responsible for all compliance determinations.'],
            ['Can I use VERIFIQ without an internet connection?',
             'Yes. All validation, 3D viewing, and report export functions work 100% offline. The only feature that requires internet is the optional software update check, which runs silently in the background and can be disabled.'],
            ['My IFC file was exported from ArchiCAD but VERIFIQ shows many errors. What do I do?',
             'Ensure you are using the IFC+SG Export Translator from go.gov.sg/ifcsg (not the default ArchiCAD IFC export). The default export does not include SGPset_ property sets. Download and import the IFC+SG translator (IFC4 Reference View), then re-export. Note: In ArchiCAD, the IFC entity is defined by the classification code you assign in the Classification Manager, not by the native element type. A slab with classification A-WAL-EXW-01 exports as IfcWall. VERIFIQ validates based on the exported IFC entity and its classification code combination.'],
            ['What is the difference between a Critical and an Error finding?',
             'Critical means the submission will definitely be rejected - the element is fundamentally non-compliant. Error means it will likely cause rejection or significant review comments. Both should be fixed before submission. Warnings are advisory.'],
            ['Can VERIFIQ check models from Tekla Structures?',
             'Yes. Export from Tekla using the IFC+SG property set definitions for Objects.inp. The IFC4 export must use IFC4 Reference View schema. Load the .ifc file into VERIFIQ as normal.'],
            ['How do I find an element in ArchiCAD from its GUID shown in VERIFIQ?',
             'In ArchiCAD: Edit > Find and Select > search by IFC Global ID (paste the GUID from VERIFIQ). The element will be selected and highlighted in the model.'],
            ['Can I validate multiple discipline files (Architecture, Structure, MEP) together?',
             'Yes. Use the Loaded Files page to open multiple IFC files. VERIFIQ checks GUID uniqueness across all files and runs all applicable rules on each file. This is the recommended workflow for CORENET-X federated submissions.'],
          ].map(([q,a]) => `
            <div style="padding:12px;background:var(--light-bg);border-radius:8px">
              <div style="font-weight:700;font-size:12px;color:var(--white);margin-bottom:5px">Q: ${q}</div>
              <div style="font-size:12px;color:var(--mid-grey);line-height:1.7">A: ${a}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Footer -->
      <div class="card" style="margin-top:12px;background:var(--navy-dark);color:white;border:none">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-weight:700;font-size:14px;margin-bottom:4px">Need more help?</div>
            <div style="font-size:12px;color:#93C5FD">Contact BBMW0 Technologies for support and licencing</div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <a href="https://verifiq.bbmw0.com" target="_blank" style="text-decoration:none">
              <button style="background:rgba(255,255,255,.15);color:white;border:1px solid rgba(255,255,255,.3);
                border-radius:6px;padding:8px 16px;cursor:pointer;font-size:12px">🌐 verifiq.bbmw0.com</button>
            </a>
            <a href="mailto:bbmw0@hotmail.com" style="text-decoration:none">
              <button style="background:rgba(255,255,255,.15);color:white;border:1px solid rgba(255,255,255,.3);
                border-radius:6px;padding:8px 16px;cursor:pointer;font-size:12px">✉ bbmw0@hotmail.com</button>
            </a>
            <a href="https://github.com/bbmw96/verifiq" target="_blank" style="text-decoration:none">
              <button style="background:rgba(255,255,255,.15);color:white;border:1px solid rgba(255,255,255,.3);
                border-radius:6px;padding:8px 16px;cursor:pointer;font-size:12px">⭐ GitHub</button>
            </a>
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderPropertyEditorPage() {
    // Render the page HTML
    const html = `<div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
          <h1 style="margin:0">IFC Property Editor</h1>
          <p style="font-size:13px;color:var(--mid-grey);margin-top:3px">
            Fix missing or incorrect IFC property values directly - no return to ArchiCAD or Revit needed
          </p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" onclick="App.navigate('critical')">← Critical Issues</button>
          <button class="btn btn-ghost" onclick="App.navigate('results')">← All Results</button>
        </div>
      </div>

      <div style="padding:12px 16px;background:var(--navy-dark);color:white;border-radius:8px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div style="font-size:12px">
          <strong style="color:#93C5FD">To add fixes:</strong>
          go to Critical Issues or All Results - find a property error - click <strong style="color:#FCD34D">✏️ Fix</strong> on that row.
          Each fix is added to the queue below.
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn" style="background:var(--teal);color:white;font-size:12px;padding:6px 14px"
            onclick="App.navigate('critical')">🔴 Go to Critical Issues</button>
          <button class="btn" style="background:rgba(255,255,255,.15);color:white;border:1px solid rgba(255,255,255,.2);font-size:12px;padding:6px 14px"
            onclick="App.navigate('results')">📋 Go to All Results</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
        <div class="card" style="padding:14px">
          <div style="font-weight:700;font-size:12px;color:var(--teal);margin-bottom:6px">How it works</div>
          <div style="font-size:11px;color:var(--mid-grey);line-height:1.8">
            1. Go to <strong>Critical Issues</strong> or <strong>All Results</strong><br>
            2. Find a <span style="color:var(--red)">Critical</span> or Error finding with a property<br>
            3. Click <strong>✏️ Fix</strong> on that row<br>
            4. Enter the correct value below<br>
            5. Click <strong>Apply Fixes</strong><br>
            6. VERIFIQ saves a corrected IFC file<br>
            7. Re-validate the corrected file
          </div>
        </div>
        <div class="card" style="padding:14px">
          <div style="font-weight:700;font-size:12px;color:var(--amber);margin-bottom:6px">What can be fixed here</div>
          <div style="font-size:11px;color:var(--mid-grey);line-height:1.8">
            <strong>Yes</strong> - any IfcPropertySingleValue in Pset_ or SGPset_:<br>
            ThermalTransmittance, FireResistancePeriod, IsExternal, LoadBearing, GFACategory, WELSRating, ClearWidth, and all others<br><br>
            <strong>No</strong> - must fix in ArchiCAD/Revit:<br>
            IFC entity class, classification codes, spatial containment
          </div>
        </div>
        <div class="card" style="padding:14px">
          <div style="font-weight:700;font-size:12px;color:var(--green);margin-bottom:6px">Your original is always safe</div>
          <div style="font-size:11px;color:var(--mid-grey);line-height:1.8">
            VERIFIQ <strong>never</strong> modifies your original IFC file.<br><br>
            The corrected version is always saved as a new file:<br>
            <code style="font-size:10px;background:#F1F5F9;padding:2px 6px;border-radius:3px">filename_VERIFIQ_FIXED_timestamp.ifc</code><br><br>
            An edit log is saved alongside it listing every change made.
          </div>
        </div>
      </div>

      <div id="prop-editor-panel">
        <!-- Queue renders here -->
      </div>
    </div>`;

    // Schedule panel render after DOM is updated
    setTimeout(() => {
      if (window.PropertyEditor) PropertyEditor.renderPanel();
    }, 60);

    return html;
  }


  // ─── IMPORT MAPPING PAGE ──────────────────────────────────────────────────
  function renderImportMappingPage() {
    return `<div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
          <h1 style="margin:0">📥 Import BCA Industry Mapping</h1>
          <p style="font-size:13px;color:var(--mid-grey);margin-top:3px">
            Import the official BCA IFC+SG Industry Mapping Excel to update classification codes and property requirements
          </p>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div class="card" style="padding:20px">
          <div style="font-weight:700;font-size:13px;color:var(--teal);margin-bottom:12px">📥 Import Excel File</div>
          <p style="font-size:12px;color:var(--mid-grey);margin-bottom:16px;line-height:1.7">
            Download the latest <strong>IFC+SG Industry Mapping Excel</strong> from the BCA/GovTech portal,
            then import it here to update your local rules database.
          </p>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="btn btn-teal" onclick="VBridge.send('openUrl',{url:'https://go.gov.sg/ifcsg'})"
              style="font-size:12px">🌐 Download from go.gov.sg/ifcsg</button>
            <button class="btn btn-primary" onclick="VBridge.send('openFileForImport',{purpose:'industryMapping'})"
              style="font-size:12px">📂 Browse for Excel file (.xlsx)</button>
          </div>
        </div>

        <div class="card" style="padding:20px">
          <div style="font-weight:700;font-size:13px;color:var(--amber);margin-bottom:12px">ℹ️ What gets imported</div>
          <div style="font-size:11px;color:var(--mid-grey);line-height:1.9">
            ✓ Classification codes (all 206 COP3.1 entries)<br>
            ✓ Mandatory property sets per IFC entity<br>
            ✓ Required property values and accepted enumerations<br>
            ✓ Agency assignments (BCA / SCDF / URA / NEA / PUB / SLA / LTA / JTC)<br>
            ✓ Gateway requirements (G1 / G1.5 / G2 / G3)<br>
            ✓ Singapore-specific SGPset_ property sets
          </div>
        </div>
      </div>

      <div class="card" style="padding:20px;margin-bottom:16px">
        <div style="font-weight:700;font-size:13px;color:var(--white);margin-bottom:10px">📋 What is the IFC+SG Industry Mapping?</div>
        <p style="font-size:12px;color:var(--mid-grey);line-height:1.8;margin-bottom:10px">
          The IFC+SG Industry Mapping is the official BCA/GovTech Excel spreadsheet that defines how every
          building component in Singapore must be described in IFC format for CORENET-X submission.
          It maps each IFC entity class to its required classification code (from the IFC+SG Classification System),
          mandatory property sets (Pset_ and SGPset_), required properties, and accepted values.
        </p>
        <p style="font-size:12px;color:var(--mid-grey);line-height:1.8">
          The current edition is <strong style="color:var(--teal)">COP 3.1 (December 2025)</strong> which covers
          833 rows and 81 identified building components. VERIFIQ ships with this edition embedded,
          but you can import a newer version at any time.
        </p>
      </div>

      <div class="card" style="padding:20px">
        <div style="font-weight:700;font-size:13px;color:var(--white);margin-bottom:10px">🔗 Key Links</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${[
            ['CORENET-X Portal', 'https://portal.corenet.gov.sg'],
            ['IFC+SG Downloads', 'https://go.gov.sg/ifcsg'],
            ['COP 3.1 Documentation', 'https://go.gov.sg/cxcop'],
            ['CORENET-X Info', 'https://go.gov.sg/cx'],
            ['IFC+SG Validator', 'https://code.builtsearch.com/ifcsg-validator'],
          ].map(function(item) { var label=item[0], url=item[1]; return '<button class="btn btn-ghost" style="font-size:11px" onclick="VBridge.send(\'openUrl\',{url:\''+url+'\'})">🔗 '+label+'</button>'; }).join('')}
        </div>
      </div>

      <div id="import-result-panel"></div>
    </div>`;
  }


  // ─── SEARCH AND SELECT PAGE ──────────────────────────────────────────────
  function renderSearchPage() {
    const state   = VState.get();
    const session = state.session;
    const elements= (session?.findings || []);
    return `<div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
          <h1 style="margin:0">Search and Select</h1>
          <p style="font-size:12px;color:var(--mid-grey);margin-top:3px">Search elements by name, GUID, IFC class, classification code, or storey</p>
        </div>
      </div>
      <div class="card" style="padding:16px;margin-bottom:12px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input id="search-query" type="text" placeholder="Search by name, GUID, IFC class, classification code..."
            style="flex:1;min-width:200px;height:34px;padding:0 12px;font-size:13px;border:1px solid var(--border);border-radius:6px;background:var(--card-2);color:var(--white)"
            oninput="SearchPage.run(this.value)" autofocus/>
          <select id="search-field" onchange="SearchPage.run(document.getElementById('search-query').value)"
            style="height:34px;padding:0 8px;font-size:12px;border:1px solid var(--border);border-radius:5px;background:var(--card-2);color:var(--white)">
            <option value="all">All fields</option>
            <option value="name">Element Name</option>
            <option value="guid">GUID</option>
            <option value="cls">IFC Class</option>
            <option value="code">Classification Code</option>
            <option value="storey">Storey</option>
          </select>
          <button class="btn btn-ghost" style="font-size:12px" onclick="document.getElementById('search-query').value='';SearchPage.run('')">Clear</button>
        </div>
      </div>
      <div id="search-results" class="card" style="padding:12px">
        ${!session ? '<div style="color:var(--mid-grey);font-size:13px;padding:20px;text-align:center">Run validation first to enable element search.</div>'
          : '<div style="color:var(--mid-grey);font-size:13px;padding:20px;text-align:center">Type in the search box above to find elements.</div>'}
      </div>
    </div>`;
  }

  window.SearchPage = {
    run(query) {
      const el = document.getElementById('search-results');
      if (!el) return;
      const field = document.getElementById('search-field')?.value || 'all';
      const q = (query || '').toLowerCase().trim();
      const session = VState.get().session;
      if (!session) return;

      const findings = session.findings || [];
      // Deduplicate by guid
      const seen = new Set();
      const elements = findings.filter(f => {
        if (seen.has(f.guid)) return false;
        seen.add(f.guid); return true;
      });

      const matched = q ? elements.filter(f => {
        if (field === 'name'   || field === 'all') if ((f.name||'').toLowerCase().includes(q)) return true;
        if (field === 'guid'   || field === 'all') if ((f.guid||'').toLowerCase().includes(q)) return true;
        if (field === 'cls'    || field === 'all') if ((f.cls||'').toLowerCase().includes(q))  return true;
        if (field === 'code'   || field === 'all') if ((f.cls||'').split('|')[1]?.toLowerCase().includes(q)) return true;
        if (field === 'storey' || field === 'all') if ((f.storey||'').toLowerCase().includes(q)) return true;
        return false;
      }) : elements.slice(0, 50);

      if (!q) { el.innerHTML = '<div style="color:var(--mid-grey);font-size:13px;padding:20px;text-align:center">Type to search. Showing first 50 elements.</div>'; }

      const rows = matched.slice(0, 200).map(f => {
        const [cls,,sub] = (f.cls||'').split('|');
        const sev = f.severity || '';
        const col = {Critical:'#ef4444',Error:'#f97316',Warning:'#eab308',Pass:'#22c55e'}[sev]||'#6b7280';
        return `<tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="App.navigate('3d')">
          <td style="padding:6px 10px"><span style="background:${col}22;color:${col};border:1px solid ${col}44;border-radius:3px;padding:1px 6px;font-size:10px">${VUtils.esc(sev||'-')}</span></td>
          <td style="padding:6px 10px;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${VUtils.esc(f.name||'-')}</td>
          <td style="padding:6px 10px"><span style="background:#0e2a4a;color:#60a5fa;border-radius:3px;padding:1px 6px;font-size:10px;font-family:monospace">${VUtils.esc(cls||'-')}</span></td>
          <td style="padding:6px 10px;font-size:11px;color:var(--mid-grey)">${VUtils.esc(sub||'-')}</td>
          <td style="padding:6px 10px;font-size:11px;color:var(--mid-grey)">${VUtils.esc(f.storey||'-')}</td>
          <td style="padding:6px 10px;font-size:10px;color:#475569;font-family:monospace">${VUtils.esc((f.guid||'').slice(0,12)+'...')}</td>
          <td style="padding:6px 10px">
            <button class="btn btn-ghost" style="font-size:10px;padding:2px 7px"
              onclick="event.stopPropagation();App.navigate('results');setTimeout(()=>{const i=document.getElementById('filter-search');if(i){i.value='${VUtils.esc(f.guid||'')}';i.dispatchEvent(new Event('input'))}},400)">
              Findings
            </button>
          </td>
        </tr>`;
      }).join('');

      el.innerHTML = `
        <div style="font-size:11px;color:var(--mid-grey);margin-bottom:8px">${matched.length} element${matched.length!==1?'s':''} found${matched.length>200?' (showing first 200)':''}</div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:var(--navy-dark)">
              <th style="padding:6px 10px;text-align:left;font-size:10px;color:var(--mid-grey)">Sev</th>
              <th style="padding:6px 10px;text-align:left;font-size:10px;color:var(--mid-grey)">Element Name</th>
              <th style="padding:6px 10px;text-align:left;font-size:10px;color:var(--mid-grey)">IFC Class</th>
              <th style="padding:6px 10px;text-align:left;font-size:10px;color:var(--mid-grey)">SubType</th>
              <th style="padding:6px 10px;text-align:left;font-size:10px;color:var(--mid-grey)">Storey</th>
              <th style="padding:6px 10px;text-align:left;font-size:10px;color:var(--mid-grey)">GUID</th>
              <th style="padding:6px 10px"></th>
            </tr></thead>
            <tbody>${rows || '<tr><td colspan="7" style="padding:20px;text-align:center;color:var(--mid-grey)">No elements matched</td></tr>'}</tbody>
          </table>
        </div>`;
    }
  };

  // ─── IDS CHECKER PAGE ─────────────────────────────────────────────────────
  function renderIdsCheckerPage() {
    return `<div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
          <h1 style="margin:0">IDS Checker</h1>
          <p style="font-size:12px;color:var(--mid-grey);margin-top:3px">Information Delivery Specification (IDS) validation - check your IFC model against a custom IDS XML requirements file</p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div class="card" style="padding:20px">
          <div style="font-weight:700;font-size:13px;color:var(--teal);margin-bottom:10px">1. Load IDS File (.ids or .xml)</div>
          <p style="font-size:12px;color:var(--mid-grey);margin-bottom:12px;line-height:1.7">IDS (Information Delivery Specification) is an ISO 21597 standard format for specifying exactly what IFC data a building model must contain. Import an IDS file to validate your model against custom requirements beyond CORENET-X.</p>
          <button class="btn btn-primary" style="font-size:12px" onclick="VBridge.send('openFileForImport',{purpose:'idsFile',filter:'IDS Files|*.ids;*.xml;*.IDS|All Files|*.*'})">
            📂 Browse for IDS File (.ids / .xml)
          </button>
        </div>
        <div class="card" style="padding:20px">
          <div style="font-weight:700;font-size:13px;color:var(--amber);margin-bottom:10px">What IDS checks</div>
          <div style="font-size:11px;color:var(--mid-grey);line-height:1.9">
            An IDS file can specify:<br>
            - Required entity types and their properties<br>
            - Mandatory classification codes<br>
            - Specific property values and ranges<br>
            - Material requirements<br>
            - Custom project-specific rules beyond CORENET-X
          </div>
          <p style="font-size:11px;color:var(--mid-grey);margin-top:10px">Create IDS files using the <a href="#" onclick="VBridge.send('openUrl',{url:'https://github.com/buildingSMART/IDS'})" style="color:var(--teal)">buildingSMART IDS repository</a></p>
        </div>
      </div>
      <div id="ids-result" class="card" style="padding:16px">
        <div style="color:var(--mid-grey);font-size:13px;text-align:center;padding:20px">Load an IDS file to begin validation</div>
      </div>
    </div>`;
  }

  // ─── IFC MERGE PAGE ──────────────────────────────────────────────────────
  function renderIfcMergePage() {
    return `<div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
          <h1 style="margin:0">IFC Merge</h1>
          <p style="font-size:12px;color:var(--mid-grey);margin-top:3px">Merge multiple IFC files into a single federated model for combined compliance checking</p>
        </div>
      </div>
      <div class="card" style="padding:20px;margin-bottom:12px">
        <div style="font-weight:700;font-size:13px;color:var(--teal);margin-bottom:10px">How to merge IFC files</div>
        <ol style="font-size:12px;color:var(--mid-grey);line-height:2;margin-left:18px">
          <li>Load your first IFC file via Open IFC File in the toolbar</li>
          <li>Click Add Files to load additional discipline models (architectural, structural, MEP)</li>
          <li>VERIFIQ validates all files together - findings reference the source file for each element</li>
          <li>Export reports cover the entire federated model</li>
          <li>Use the Loaded Files page to remove any file from the session</li>
        </ol>
      </div>
      <div class="card" style="padding:20px">
        <div style="font-weight:700;font-size:13px;color:var(--white);margin-bottom:10px">Currently loaded files</div>
        ${(()=>{ const files = VState.get().filesLoaded || [];
          if (!files.length) return '<div style="color:var(--mid-grey);font-size:12px">No files loaded. Use Open IFC File to load models.</div>';
          return files.map(f=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
            <span style="background:#0e2a4a;color:#60a5fa;border-radius:3px;padding:1px 8px;font-size:10px">IFC</span>
            <span style="font-size:13px;flex:1">${VUtils.esc(f.name)}</span>
            <span style="font-size:11px;color:var(--mid-grey)">${VUtils.fmt(f.elements)} elements</span>
          </div>`).join('');
        })()}
        <button class="btn btn-primary" style="margin-top:14px;font-size:12px" onclick="VBridge.openFile()">+ Add Another IFC File</button>
      </div>
    </div>`;
  }

  // ─── COBIE EXPORTER PAGE ─────────────────────────────────────────────────
  function renderCobiePage() {
    return `<div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
          <h1 style="margin:0">COBie Exporter</h1>
          <p style="font-size:12px;color:var(--mid-grey);margin-top:3px">Export Construction Operations Building Information Exchange (COBie) data for asset management handover</p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div class="card" style="padding:20px">
          <div style="font-weight:700;font-size:13px;color:var(--teal);margin-bottom:10px">COBie Export</div>
          <p style="font-size:12px;color:var(--mid-grey);margin-bottom:14px;line-height:1.7">COBie captures asset data from your IFC model for building operations and facility management. VERIFIQ extracts space, equipment, and component data from loaded IFC files.</p>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="btn btn-teal" style="font-size:12px"
              onclick="App.navigate('export')">
              📊 Export Reports (includes COBie formats)
            </button>
            <p style="font-size:11px;color:var(--mid-grey);margin:4px 0">
              COBie Excel and XML export is available in the Export Reports page.
              Select the COBie template and choose your output format there.
            </p>
          </div>
        </div>
        <div class="card" style="padding:20px">
          <div style="font-weight:700;font-size:13px;color:var(--amber);margin-bottom:10px">COBie data extracted</div>
          <div style="font-size:11px;color:var(--mid-grey);line-height:1.9">
            Facility - Project, site, and building info<br>
            Floor - Each IfcBuildingStorey<br>
            Space - Each IfcSpace with area and category<br>
            Component - Mechanical and equipment elements<br>
            Type - Element type classifications<br>
            Attribute - Property set values<br>
            Document - Linked document references
          </div>
        </div>
      </div>
      <div class="card" style="padding:16px">
        <div style="font-weight:700;font-size:12px;color:var(--mid-grey);margin-bottom:8px">COBie readiness check</div>
        ${(()=>{ const s=VState.get(); const f=s.filesLoaded||[];
          if (!f.length) return '<div style="color:var(--mid-grey);font-size:12px">Load an IFC file to check COBie readiness.</div>';
          const spaces = f.reduce((a,b)=>a+(b.spaces||0),0);
          const elems  = f.reduce((a,b)=>a+(b.elements||0),0);
          return `<div style="font-size:12px;color:var(--mid-grey)">
            Loaded: ${VUtils.fmt(elems)} elements, ${VUtils.fmt(spaces)} spaces across ${f.length} file(s).
            Run validation first to check COBie property completeness.
          </div>`;
        })()}
      </div>
    </div>`;
  }



  
  // ─── EXPORT PAGE ─────────────────────────────────────────────────────────
  function _exportScoreChart(session) {
    const score  = session.complianceScore || session.score || 0;
    const col    = score >= 95 ? '#22c55e' : score >= 80 ? '#eab308' : '#ef4444';
    const R      = 52, CX = 64, CY = 64;
    const circ   = 2 * Math.PI * R;
    const filled = circ * score / 100;
    const grade  = score >= 95 ? 'A' : score >= 80 ? 'B' : score >= 60 ? 'C' : 'F';

    const findings = session.findings || [];
    const crit = findings.filter(f => f.severity === 'Critical').length;
    const err  = findings.filter(f => f.severity === 'Error').length;
    const warn = findings.filter(f => f.severity === 'Warning').length;
    const pass = findings.filter(f => f.severity === 'Pass').length;
    const total = findings.length || 1;

    const blocking  = crit + err;
    const advisory  = warn;
    const readyLabel = blocking === 0 ? '✅ Ready for Submission' : `⛔ ${blocking} issue${blocking!==1?'s':''} blocking submission`;
    const readyCol   = blocking === 0 ? '#22c55e' : '#ef4444';

    const agencyCounts = {};
    findings.forEach(f => { if (f.agency && f.agency !== 'None') agencyCounts[f.agency] = (agencyCounts[f.agency]||0) + 1; });
    const agencyRows = Object.entries(agencyCounts).sort((a,b)=>b[1]-a[1]).slice(0,9).map(([ag, n]) => {
      const pct = Math.round(n / total * 100);
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <div style="width:44px;font-size:10px;font-weight:700;color:#e2e8f0;flex-shrink:0">${VUtils.esc(ag)}</div>
        <div style="flex:1;height:10px;background:#0f1e30;border-radius:5px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:#0e7c86;border-radius:5px"></div>
        </div>
        <div style="width:24px;font-size:10px;color:#9ab8d4;text-align:right;flex-shrink:0">${n}</div>
      </div>`;
    }).join('');

    return `<div class="card" style="padding:20px;margin-bottom:16px">
      <div style="font-weight:700;font-size:13px;color:var(--teal);margin-bottom:14px">Compliance Summary</div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start">
        <!-- Donut chart -->
        <div style="flex-shrink:0;text-align:center">
          <svg width="128" height="128" style="overflow:visible">
            <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#0f1e30" stroke-width="14"/>
            <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${col}" stroke-width="14"
              stroke-dasharray="${filled.toFixed(2)} ${circ.toFixed(2)}"
              stroke-dashoffset="${(circ * 0.25).toFixed(2)}"
              stroke-linecap="round" transform="rotate(-90 ${CX} ${CY})"/>
            <text x="${CX}" y="${CY - 6}" text-anchor="middle" font-size="20" font-weight="900" fill="${col}" font-family="Segoe UI,sans-serif">${score.toFixed(0)}%</text>
            <text x="${CX}" y="${CY + 12}" text-anchor="middle" font-size="14" font-weight="800" fill="${col}" font-family="Segoe UI,sans-serif">${grade}</text>
          </svg>
          <div style="font-size:11px;font-weight:700;color:${readyCol};margin-top:4px">${readyLabel}</div>
        </div>
        <!-- Severity breakdown bars -->
        <div style="flex:1;min-width:160px">
          <div style="font-size:10px;font-weight:700;color:#9ab8d4;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">Findings Breakdown</div>
          ${[['Critical',crit,'#ef4444'],['Error',err,'#fb923c'],['Warning',warn,'#eab308'],['Pass',pass,'#22c55e']].map(([label,n,c])=>`
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
            <div style="width:56px;font-size:11px;color:${c};font-weight:600">${label}</div>
            <div style="flex:1;height:12px;background:#0f1e30;border-radius:6px;overflow:hidden">
              <div style="width:${Math.round(n/total*100)}%;height:100%;background:${c};border-radius:6px"></div>
            </div>
            <div style="width:28px;font-size:11px;font-weight:700;color:${c};text-align:right">${n}</div>
          </div>`).join('')}
        </div>
        <!-- Agency breakdown -->
        ${agencyRows ? `<div style="flex:1;min-width:160px">
          <div style="font-size:10px;font-weight:700;color:#9ab8d4;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">By Agency</div>
          ${agencyRows}
        </div>` : ''}
      </div>
    </div>`;
  }

  function renderExportPage() {
    const state   = VState.get();
    const session = state.session;
    const mode    = state.countryMode || 'Singapore';
    if (!session) return `<div>
      <h1>Export Reports</h1>
      ${VUtils.emptyState('📤','No results to export','Run validation first to generate compliance results.',
        '<button class="btn btn-teal" style="margin-top:14px" onclick="VBridge.runValidation()">▶ Run Validation</button>')}
    </div>`;

    const score = session.complianceScore || session.score || 0;
    const col   = score>=95?'#22c55e':score>=80?'#eab308':'#ef4444';

    return `<div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
          <h1 style="margin:0">Export Compliance Reports</h1>
          <p style="font-size:12px;color:var(--mid-grey);margin-top:3px">
            Score: <strong style="color:${col}">${score.toFixed(1)}%</strong>
            &nbsp;|&nbsp; ${VUtils.fmt(session.findings?.length||0)} findings
            &nbsp;|&nbsp; ${VUtils.esc(mode)} mode
          </p>
        </div>
      </div>

      ${_exportScoreChart(session)}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div class="card" style="padding:20px">
          <div style="font-weight:700;font-size:13px;color:var(--teal);margin-bottom:12px">Report Template</div>
          <div id="export-template-sel" style="display:flex;flex-direction:column;gap:6px">
            ${[['Professional','Full branded report with cover page, TOC, executive summary, all findings','professional'],
               ['Executive Summary','High-level overview for project managers and clients','executive'],
               ['BCA Submission','Formatted for BCA CORENET-X submission review','bca'],
               ['SCDF Submission','Fire safety elements formatted for SCDF review','scdf'],
               ['NBeS Submission','Formatted for Malaysia NBeS submission','nbes'],
               ['Technical','Detailed technical findings for BIM coordinators','technical'],
               ['Audit','Complete audit trail with element-level detail','audit'],
               ['Minimal','Compact single-page summary only','minimal']
            ].map(([label,desc,val],i) => `
              <label style="display:flex;align-items:flex-start;gap:10px;padding:8px;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:${i===0?'rgba(14,124,134,.1)':'transparent'}">
                <input type="radio" name="tmpl" value="${val}" ${i===0?'checked':''} style="margin-top:2px;flex-shrink:0">
                <div>
                  <div style="font-size:12px;font-weight:600;color:var(--white)">${label}</div>
                  <div style="font-size:10px;color:var(--mid-grey);margin-top:2px">${desc}</div>
                </div>
              </label>`).join('')}
          </div>
        </div>

        <div class="card" style="padding:20px">
          <div style="font-weight:700;font-size:13px;color:var(--teal);margin-bottom:12px">Export Formats</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:16px">
            ${[['Word (.docx)','word','📝'],['Excel (.xlsx)','excel','📊'],
               ['PDF','pdf','📄'],['CSV (.csv)','csv','📋'],
               ['JSON','json','{}'],['HTML (.html)','html','🌐'],
               ['BCF (.bcf)','bcf','🏗'],['Markdown','markdown','#']
              ].map(([label,val,icon]) => `
              <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--border);border-radius:5px;cursor:pointer">
                <input type="checkbox" name="fmt" value="${val}" checked style="flex-shrink:0">
                <span style="font-size:12px">${icon} ${label}</span>
              </label>`).join('')}
          </div>
          <button class="btn btn-teal" style="width:100%;font-size:13px;padding:10px"
            onclick="(function(){
              const tmpl = document.querySelector('input[name=tmpl]:checked')?.value || 'professional';
              const fmts = [...document.querySelectorAll('input[name=fmt]:checked')].map(i=>i.value);
              if(!fmts.length){alert('Select at least one format');return;}
              VBridge.send('export',{template:tmpl,formats:fmts});
            })()">
            📤 Export Reports
          </button>
          <p style="font-size:11px;color:var(--mid-grey);margin-top:8px;text-align:center">
            Reports are saved to a folder you choose
          </p>
        </div>
      </div>
    </div>`;
  }

  // ─── SETTINGS PAGE ────────────────────────────────────────────────────────
  function renderSettingsPage() {
    const state = VState.get();
    const proxy = state.proxySettings || {};
    const mode  = state.countryMode || 'Singapore';
    const gw    = state.sgGateway || 'Design';

    return `<div>
      <h1 style="margin-bottom:16px">Settings</h1>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">

        <div class="card" style="padding:20px">
          <div style="font-weight:700;font-size:13px;color:var(--teal);margin-bottom:12px">Validation Settings</div>

          <div style="margin-bottom:14px">
            <div style="font-size:12px;font-weight:600;margin-bottom:6px">Default Country Mode</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${['Singapore','Malaysia','Combined'].map(m =>
                `<button class="btn ${mode===m?'btn-teal':'btn-ghost'}" style="font-size:11px;padding:5px 12px"
                  onclick="VBridge.send('setCountryMode',{mode:'${m}'})">${m}</button>`
              ).join('')}
            </div>
          </div>

          <div style="margin-bottom:14px">
            <div style="font-size:12px;font-weight:600;margin-bottom:6px">Singapore Gateway</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${['Design','Piling','Construction','Completion'].map(g =>
                `<button class="btn ${gw===g?'btn-teal':'btn-ghost'}" style="font-size:11px;padding:5px 12px"
                  onclick="VBridge.send('setGateway',{gateway:'${g}'})">${g}</button>`
              ).join('')}
            </div>
          </div>

          <div>
            <div style="font-size:12px;font-weight:600;margin-bottom:6px">Updates</div>
            <button id="update-check-btn" class="btn btn-ghost" style="font-size:11px"
              onclick="(function(btn){btn.disabled=true;btn.textContent='Checking...';VBridge.send('checkForUpdates',{});})(this)">
              🔄 Check for Updates
            </button>
            <button class="btn btn-ghost" style="font-size:11px;margin-left:6px"
              onclick="(function(){localStorage.removeItem('verifiq_tour_v2');if(window.WelcomeTour){WelcomeTour.prompt();}else{var b=event.target;b.textContent='Tour will show on next open';setTimeout(()=>b.textContent='🚀 Reset Welcome Tour',3000);}})()">
              🚀 Reset Welcome Tour
            </button>
          </div>
        </div>

        <!-- ── RULES UPDATE ─────────────────────────────────────────────── -->
        <div class="card" style="padding:20px" id="rules-update-card">
          <div style="font-weight:700;font-size:13px;color:var(--teal);margin-bottom:12px">
            IFC+SG Rules Database
          </div>
          <div id="rules-version-info" style="font-size:11px;color:var(--mid-grey);background:var(--card-2);border-radius:6px;padding:8px 10px;margin-bottom:12px;line-height:1.8">
            Loading rules version...
          </div>
          <div id="rules-update-banner" style="display:none;background:rgba(0,196,160,.12);border:1px solid var(--teal);border-radius:6px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:var(--teal)">
            <span style="font-weight:700">Update available: </span>
            <span class="rules-update-msg"></span>
          </div>
          <div id="rules-update-status" style="font-size:11px;margin-bottom:10px;color:var(--mid-grey)"></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button class="btn btn-teal" style="font-size:11px" id="rules-check-btn"
              onclick="VBridge.send('checkRulesUpdate',{})">
              &#x1F504; Check for Rules Update
            </button>
            <button class="btn btn-ghost" style="font-size:11px"
              onclick="VBridge.send('getRulesVersion',{})">
              &#x2139; Show Version
            </button>
            <a href="#" style="font-size:11px;color:var(--teal);margin-left:4px"
              onclick="VBridge.send('openUrl',{url:'https://go.gov.sg/ifcsg'});return false;">
              &#x1F4E5; Manual Import from go.gov.sg/ifcsg
            </a>
          </div>
          <div style="font-size:10px;color:var(--mid-grey);margin-top:10px;line-height:1.6">
            VERIFIQ checks info.corenet.gov.sg daily for new IFC+SG Industry Mapping editions.
            Updates are applied automatically. Currently embedded: COP 3.1 (December 2025),
            206 classification codes, 962 property rules across all 8 Singapore agencies.
          </div>
        </div>

        <div class="card" style="padding:20px">
          <div style="font-weight:700;font-size:13px;color:var(--teal);margin-bottom:12px">Network and Proxy</div>
          <div style="font-size:12px;color:var(--mid-grey);margin-bottom:10px">
            Status: <span style="color:${state.online?'#22c55e':'#ef4444'}">${state.online?'Online':'Offline'}</span>
          </div>
          <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer">
            <input type="checkbox" id="use-proxy" ${proxy.useProxy?'checked':''}>
            <span style="font-size:12px">Use proxy server</span>
          </label>
          <input id="proxy-url" type="text" value="${VUtils.esc(proxy.proxyUrl||'')}"
            placeholder="http://proxy.example.com:8080"
            style="width:100%;height:32px;padding:0 10px;font-size:12px;border:1px solid var(--border);border-radius:5px;background:var(--card-2);color:var(--white);margin-bottom:8px">
          <button class="btn btn-teal" style="font-size:11px;width:100%"
            onclick="(function(){
              var useProxy = document.getElementById('use-proxy') ? document.getElementById('use-proxy').checked : false;
              var proxyUrl = document.getElementById('proxy-url') ? document.getElementById('proxy-url').value : '';
              VBridge.send('saveProxySettings',{useProxy:useProxy,proxyUrl:proxyUrl,username:'',password:'',bypassList:'',ignoreSslErrors:false,customUpdateServerUrl:''});
              var btn=event.target; btn.textContent='Saved!'; btn.style.background='#22c55e'; setTimeout(()=>{btn.textContent='Save Network Settings';btn.style.background='';},2000);
            })()">
            Save Network Settings
          </button>
        </div>
      </div>
    </div>`;
  }

  // ─── ABOUT PAGE ───────────────────────────────────────────────────────────
  function renderAboutPage() {
    return `<div>
      <div style="text-align:center;padding:40px 0 24px">
        <div style="width:72px;height:72px;background:#0E7C86;border-radius:14px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center">
          <span style="font-size:28px;font-weight:900;color:white">VQ</span>
        </div>
        <h1 style="font-size:28px;margin:0">VERIFIQ</h1>
        <p style="font-size:15px;color:var(--mid-grey);margin:6px 0">IFC Compliance Checker</p>
        <span style="background:#0E7C86;color:white;border-radius:20px;padding:3px 14px;font-size:12px;font-weight:700">v2.2.0</span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
        ${[
          ['Publisher','BBMW0 Technologies'],
          ['Developer','Jia Wen Gan and Mohamed Zaki Mohamed Mohamed'],
          ['Contact','bbmw0@hotmail.com'],
          ['Website','bbmw0.com'],
          ['Singapore','CORENET-X IFC+SG COP 3.1 (December 2025)'],
          ['Malaysia','NBeS IFC Mapping 2024 (CIDB 2nd Edition)'],
          ['IFC Standard','IFC4 Reference View ADD2 TC1'],
          ['AI Engine','OmniOrg VEngine · Ollama (local, offline) + Groq + DeepSeek + GLM + Gemini + GPT-4o + Claude'],
          ['Licence','Commercial - All Rights Reserved'],
          ['Built with','WPF, WebView2, Three.js, web-ifc, OmniOrg VEngine · 7 AI Providers (Ollama/Groq/DeepSeek/GLM/Gemini/GPT-4o/Claude), ClosedXML, Open XML SDK'],
        ].map(([k,v]) => `
          <div class="card" style="padding:12px">
            <div style="font-size:10px;color:var(--mid-grey);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">${k}</div>
            <div style="font-size:12px;color:var(--white);font-weight:600">${v}</div>
          </div>`).join('')}
      </div>

      <div class="card" style="padding:20px;text-align:center">
        <div style="font-size:12px;color:var(--mid-grey);line-height:1.8">
          VERIFIQ checks IFC models against Singapore CORENET-X (IFC+SG COP 3.1) and Malaysia NBeS regulations.<br>
          <strong style="color:var(--white)">Copyright 2026 BBMW0 Technologies. All rights reserved.</strong><br>
          <a href="#" onclick="VBridge.send('openUrl',{url:'https://bbmw0.com'})" style="color:var(--teal)">bbmw0.com</a>
          &nbsp;|&nbsp;
          <a href="#" onclick="VBridge.send('openUrl',{url:'https://github.com/bbmw96/verifiq'})" style="color:var(--teal)">GitHub</a>
          &nbsp;|&nbsp;
          <a href="#" onclick="VBridge.send('openUrl',{url:'mailto:bbmw0@hotmail.com'})" style="color:var(--teal)">bbmw0@hotmail.com</a>
        </div>
      </div>
    </div>`;
  }


    return { init, navigate, refresh, render };
})();


// ─── RULES DATABASE PAGE MODULE ──────────────────────────────────────────────
const RulesDbPage = (() => {

  function browseAndImport() {
    // Trigger file open dialog via bridge, then import
    VBridge.send('openFileForImport', { filter: 'xlsx', purpose: 'industryMapping' });
  }

  function importFile(filePath) {
    const panel = document.getElementById('industry-mapping-result');
    if (panel) panel.innerHTML = `
      <div style="font-size:12px;color:var(--mid-grey);padding:8px">
        ⏳ Importing ${VUtils.esc(filePath.split('\\\\').pop())}...
      </div>`;
    VBridge.send('importIndustryMapping', { path: filePath });
  }

  function onImportResult(data) {
    const panel = document.getElementById('industry-mapping-result');
    if (!panel) return;
    if (data.success) {
      panel.innerHTML = `
        <div style="padding:12px;background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px">
          <div style="font-weight:700;color:#15803D;margin-bottom:6px">
            ✅ Import successful - ${data.codesImported} new codes, ${data.codesUpdated} updated, ${data.rulesImported} rules total
          </div>
          <div style="font-size:11px;color:#166534;margin-bottom:6px">
            Source: ${VUtils.esc(data.version)}
          </div>
          <div style="font-size:11px;color:var(--mid-grey);max-height:120px;overflow-y:auto">
            ${(data.importedCodes||[]).map(l => `<div>${VUtils.esc(l)}</div>`).join('')}
            ${(data.importedCodes||[]).length === 50 ? '<div>... and more</div>' : ''}
          </div>
          ${(data.warnings||[]).length > 0 ? `
            <div style="margin-top:6px;font-size:11px;color:var(--amber)">
              ${(data.warnings||[]).map(w => `<div>⚠ ${VUtils.esc(w)}</div>`).join('')}
            </div>` : ''}
          <div style="margin-top:8px;font-size:11px;color:#166534">
            Re-run validation on any loaded IFC file to use the updated rules.
          </div>
        </div>`;
    } else {
      panel.innerHTML = `
        <div style="padding:10px;background:#1a0a0a;border:1px solid #5c1a1a;border-radius:8px">
          <div style="font-weight:700;color:#f87171">Import failed: ${VUtils.esc(data.error||'Unknown error')}</div>
          ${(data.errors||[]).map(e => `<div style="font-size:11px">${VUtils.esc(e)}</div>`).join('')}
        </div>`;
    }
  }

  return { browseAndImport, importFile, onImportResult };
})();
window.RulesDbPage = RulesDbPage;

window.App = App;

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', App.init);

// ─── PROPERTY EDITOR MODULE ──────────────────────────────────────────────────
// Manages a queue of IFC property fixes. Each fix is applied to the IFC STEP
// file by the C# IfcPropertyWriter and saved as a new _VERIFIQ_FIXED.ifc file.
const PropertyEditor = (() => {
  let _queue = [];  // Array of fix objects

  // Add a fix to the queue (called from the ✏️ Fix button in results rows)
  function addToQueue(fix) {
    if (!fix || !fix.guid) return;
    // Avoid duplicates
    const exists = _queue.some(f => f.guid === fix.guid && f.pset === fix.pset && f.prop === fix.prop);
    if (!exists) {
      _queue.push({ ...fix, newValue: fix.fix || '', status: 'pending' });
    }
    _renderQueueInPanel();
  }

  function showPanel() {
    // Navigate to property editor and render
    App.navigate('propertyeditor');
  }

  function clearQueue() {
    _queue = [];
    _renderQueueInPanel();
  }

  function removeFromQueue(idx) {
    _queue.splice(idx, 1);
    _renderQueueInPanel();
  }

  function setNewValue(idx, val) {
    if (_queue[idx]) _queue[idx].newValue = val;
  }

  // Render the fix queue inside the property editor panel
  function renderPanel() {
    const el = document.getElementById('prop-editor-panel');
    if (!el) return;

    const pending = _queue.filter(f => f.status === 'pending');
    const applied = _queue.filter(f => f.status === 'applied');

    if (_queue.length === 0) {
      el.innerHTML = `
        <div style="padding:32px;text-align:center;color:var(--mid-grey);border:2px dashed var(--border);border-radius:8px">
          <div style="font-size:28px;margin-bottom:10px">✏️</div>
          <div style="font-size:14px;font-weight:600;margin-bottom:6px;color:var(--white)">Fix Queue is Empty</div>
          <div style="font-size:12px;line-height:1.7">
            Go to <button class="btn btn-ghost" style="font-size:12px;padding:2px 10px" onclick="App.navigate('critical')">Critical Issues</button>
            or <button class="btn btn-ghost" style="font-size:12px;padding:2px 10px" onclick="App.navigate('results')">All Results</button>
            and click <strong style="color:var(--teal)">✏️ Fix</strong> on any property finding to add it here.
          </div>
        </div>`;
      return;
    }

    const rows = _queue.map((f, i) => {
      const sev = f.severity || 'Error';
      const sevCol = { Critical:'#ef4444', Error:'#f97316', Warning:'#eab308', Pass:'#22c55e' }[sev] || '#6b7280';
      return `
        <tr style="border-bottom:1px solid var(--border);background:${f.status==='applied'?'rgba(34,197,94,.06)':''}">
          <td style="padding:8px 10px">
            <span style="background:${sevCol}22;color:${sevCol};border:1px solid ${sevCol}44;border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700">${VUtils.esc(sev)}</span>
          </td>
          <td style="padding:8px 10px;font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${VUtils.esc(f.name||'')}">
            ${VUtils.esc((f.name||'').substring(0,30))}
          </td>
          <td style="padding:8px 10px;font-family:monospace;font-size:10px;color:var(--teal)">
            ${VUtils.esc(f.pset||'-')}<br>
            <span style="color:var(--mid-grey)">↳ ${VUtils.esc(f.prop||'-')}</span>
          </td>
          <td style="padding:8px 10px;font-size:11px;color:var(--mid-grey);max-width:120px">${VUtils.esc((f.message||'').substring(0,40))}…</td>
          <td style="padding:8px 10px">
            ${f.status === 'applied'
              ? `<span style="color:#22c55e;font-size:11px">✓ Applied</span>`
              : `<input type="text" value="${VUtils.esc(f.newValue||'')}"
                  oninput="PropertyEditor.setNewValue(${i},this.value)"
                  placeholder="Enter correct value…"
                  style="width:140px;height:28px;padding:0 8px;font-size:12px;border:1px solid var(--border);border-radius:4px;background:var(--card-2);color:var(--white)">`
            }
          </td>
          <td style="padding:8px 10px">
            ${f.status === 'applied'
              ? ''
              : `<button onclick="PropertyEditor.removeFromQueue(${i})" style="background:transparent;border:1px solid var(--border);border-radius:4px;color:var(--mid-grey);padding:2px 8px;font-size:11px;cursor:pointer">✕</button>`
            }
          </td>
        </tr>`;
    }).join('');

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div>
          <span style="font-size:13px;font-weight:700">${pending.length} fix${pending.length!==1?'es':''} queued</span>
          ${applied.length ? `<span style="font-size:11px;color:#22c55e;margin-left:8px">✓ ${applied.length} already applied</span>` : ''}
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" style="font-size:12px" onclick="PropertyEditor.clearQueue()">🗑 Clear All</button>
          <button class="btn btn-teal" style="font-size:12px;padding:6px 18px"
            onclick="PropertyEditor.applyFixes()"
            ${pending.length===0?'disabled':''}>
            ⚡ Apply ${pending.length} Fix${pending.length!==1?'es':''}
          </button>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="background:var(--navy-dark)">
              <th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--mid-grey);text-transform:uppercase">Severity</th>
              <th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--mid-grey);text-transform:uppercase">Element</th>
              <th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--mid-grey);text-transform:uppercase">Property Set → Property</th>
              <th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--mid-grey);text-transform:uppercase">Issue</th>
              <th style="padding:8px 10px;text-align:left;font-size:10px;color:var(--mid-grey);text-transform:uppercase">New Value</th>
              <th style="padding:8px 10px"></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function applyFixes() {
    const pending = _queue.filter(f => f.status === 'pending');
    if (!pending.length) return;

    // Validate all have values
    const noVal = pending.filter(f => !f.newValue || !f.newValue.trim());
    if (noVal.length) {
      alert(`${noVal.length} fix${noVal.length!==1?'es':''} still need a value. Please fill in all "New Value" fields before applying.`);
      return;
    }

    const edits = pending.map(f => ({
      stepId:   f.stepId || 0,
      psetName: f.pset   || '',
      propName: f.prop   || '',
      newValue: (f.newValue || '').trim(),
      guid:     f.guid   || '',
    }));

    // Send to C# IfcPropertyWriter
    VBridge.send('applyPropertyEdits', { edits });

    // Mark as applied optimistically
    pending.forEach(f => f.status = 'applied');
    renderPanel();
  }

  function onEditsApplied(result) {
    const el = document.getElementById('prop-editor-panel');
    if (!el) return;
    const banner = document.createElement('div');
    banner.style.cssText = `background:${result.success?'rgba(34,197,94,.12)':'rgba(239,68,68,.12)'};border:1px solid ${result.success?'#22c55e':'#ef4444'};border-radius:6px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:${result.success?'#86efac':'#fca5a5'}`;
    banner.innerHTML = result.success
      ? `✓ <strong>${result.editsApplied || pending.length} fixes applied.</strong> Corrected file saved as <code style="font-size:11px">${VUtils.esc(result.outputFile||'*_VERIFIQ_FIXED.ifc')}</code>.
         <button class="btn btn-teal" style="margin-left:12px;font-size:11px;padding:3px 10px" onclick="VBridge.openFile()">📂 Open Fixed File</button>`
      : `✗ <strong>Apply failed:</strong> ${VUtils.esc(result.error||'Unknown error')}`;
    el.prepend(banner);
  }

  return {
    addToQueue, showPanel, clearQueue, removeFromQueue, setNewValue,
    renderPanel, applyFixes, onEditsApplied,
  };
})();
window.PropertyEditor = PropertyEditor;

// ─── WELCOME TOUR ─────────────────────────────────────────────────────────────
const WelcomeTour = (() => {
  const TOUR_KEY = 'verifiq_tour_v2';

  const STEPS = [
    // Step 0 - Welcome
    { icon:'VQ', title:'Welcome to VERIFIQ v2.2.0',
      body:'VERIFIQ checks your IFC models against Singapore CORENET-X (IFC+SG COP 3.1, December 2025) and Malaysia NBeS/UBBL 1984 regulations. It runs 20 compliance checks on every single element. This tour covers every section of the software. Takes about 2 minutes.',
      nav: null },
    // Step 1 - Loaded Files
    { icon:'F', title:'Step 1: Load Your IFC File',
      body:'Go to Loaded Files in the sidebar. Click Open IFC File in the toolbar or use File in the menu. VERIFIQ accepts .ifc, .ifczip, .ifcxml and .ifc+sg files. The file list shows element count, storeys, spaces, classification coverage percentage, proxy count, and georeferencing status. Everything processes offline.',
      nav:'files' },
    // Step 2 - Validation
    { icon:'V', title:'Step 2: Run Validation',
      body:'Choose your country mode first: Singapore (CORENET-X), Malaysia (NBeS), or Combined. Then click Run Validation. VERIFIQ checks every element across 20 levels: IFC entity class, PredefinedType, classification reference, classification edition, mandatory Pset_, SGPset_, property values, data types, enumerations, spatial containment, materials, and georeferencing.',
      nav:'validation' },
    // Step 3 - All Results
    { icon:'R', title:'Step 3: All Compliance Results',
      body:'Every finding appears here with a compliance score at the top. Use the 7 filter dropdowns: Severity, Discipline (ARC/STR/MEP/EXT/CIV), IFC Entity, Agency (BCA/SCDF/URA etc.), Storey, Gateway (G1/G1.5/G2/G3), and Check Type. Each row shows IFC Entity badge, SubType badge, Classification Code badge, the property that failed, the expected value, the actual value, and the full finding detail.',
      nav:'results' },
    // Step 4 - Critical Issues
    { icon:'!', title:'Step 4: Critical Issues',
      body:'Critical findings will cause automatic rejection by the CORENET-X or NBeS checker. The same 7 filters work here. Click the Guide button on any row to see exactly how to fix it in Revit, ArchiCAD, Tekla, or Bentley. Click the Fix button on property errors to add them to the Property Editor queue.',
      nav:'critical' },
    // Step 5 - Property Editor
    { icon:'E', title:'Step 5: Property Editor',
      body:'Property fixes queued from Critical Issues or All Results appear here as a table. Enter the correct value in the New Value column for each fix, then click Apply Fixes. VERIFIQ writes a corrected IFC file alongside your original. Your original file is never modified. The corrected copy is saved as filename_VERIFIQ_FIXED.ifc.',
      nav:'propertyeditor' },
    // Step 6 - 3D Viewer
    { icon:'3', title:'Step 6: 3D Viewer',
      body:'Your model displays colour-coded by compliance: red for Critical, orange for Error, yellow for Warning, green for Pass, grey for unchecked. Left drag to orbit, right drag to pan, scroll to zoom, click to select an element and inspect its findings. Press F for fullscreen, R to reset the view. Use the Walk button for first-person navigation with WASD keys.',
      nav:'3d' },
    // Step 7 - Design Code
    { icon:'D', title:'Step 7: Design Code Compliance',
      body:'After validation the Design Code tab shows dimension and parameter checks: URA room sizes, BCA accessibility door widths and ramp gradients, SCDF travel distances and exit widths, NEA ventilation rates, PUB sanitary fitting ratios, and BCA Green Mark thermal values. Every rule references the published regulation with a section number.',
      nav:'design' },
    // Step 8 - Import BCA Mapping
    { icon:'I', title:'Step 8: Import BCA Industry Mapping',
      body:'Download the latest BCA IFC+SG Industry Mapping Excel from go.gov.sg/ifcsg and import it here. This updates your local rules database with the newest classification codes, property set requirements, accepted enumeration values, and agency assignments. VERIFIQ ships with COP 3.1 December 2025 embedded so import is only needed when a new edition is released.',
      nav:'import' },
    // Step 9 - Export Reports
    { icon:'X', title:'Step 9: Export Compliance Reports',
      body:'Export your results in Word (.docx), PDF, Excel (.xlsx), CSV, JSON, HTML, Markdown, or BCF format. Choose from 8 report templates: Professional (cover page, TOC, full findings), Executive Summary, BCA Submission, SCDF Submission, NBeS Submission, Technical, Audit, and Minimal. Multiple formats can be exported at once.',
      nav:'export' },
    // Step 10 - Rules Database
    { icon:'B', title:'Step 10: Rules Database',
      body:'Browse all embedded rules: IFC+SG property set requirements for every COP 3.1 entity type, all 206 classification codes (81 identified components), Singapore agency requirements by entity (BCA/SCDF/URA/NEA/PUB/SLA/LTA/JTC), UBBL 1984 Malaysia rules, all 20 check level descriptions, and the complete design code parameter list.',
      nav:'rules' },
    // Step 11 - Settings
    { icon:'S', title:'Step 11: Settings and Network',
      body:'Configure proxy settings for corporate network environments, set a custom update server URL, choose your default country mode, and adjust validation options. The network status indicator in the status bar shows your connection state. VERIFIQ works fully offline.',
      nav:'settings' },
    // Step 12 - User Guide
    { icon:'G', title:'Step 12: User Guide and Manual',
      body:'The User Guide contains the complete reference manual: all 20 check levels explained, how to export from Revit and ArchiCAD correctly, understanding findings and severity levels, how to use the Property Editor, Design Code interpretation, FAQ, and a glossary of IFC+SG terms. Always accessible from the sidebar.',
      nav:'userguide' },
    // Step 13 - Licence
    { icon:'K', title:'Step 13: Licence Management',
      body:'Trial mode validates the first 10 elements per run. Activate a full licence (format VRFQ-XXXX-XXXX-XXXX-XXXX) to unlock unlimited validation. Tiers available: Individual (1 device), Practice (5 devices), Enterprise (25 devices), and Site (unlimited). All paid tiers are perpetual and include both Singapore and Malaysia modes.',
      nav:'licence' },
    // Step 14 - Done
    { icon:'OK', title:"You're Ready to Use VERIFIQ",
      body:'Open an IFC file and click Run Validation to begin. The sidebar gives you access to every section covered in this tour. For support contact bbmw0@hotmail.com or visit bbmw0.com. You can restart this tour at any time from the User Guide page.',
      nav: null },
  ];

  let _step = 0;

  function shouldShow() {
    try { return !localStorage.getItem(TOUR_KEY); } catch { return true; }
  }
  function markSeen() { try { localStorage.setItem(TOUR_KEY, '1'); } catch {} }

  function prompt() {
    if (!shouldShow()) return;
    const d = document.createElement('div');
    d.id = 'tour-prompt';
    d.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    d.innerHTML = `
      <div style="background:#0a1628;border:1px solid #00c4a0;border-radius:14px;padding:36px 44px;max-width:500px;width:92vw;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.9)">
        <div style="font-size:52px;margin-bottom:14px">🎉</div>
        <h2 style="color:#00c4a0;font-size:22px;margin:0 0 10px;font-family:Arial">Welcome to VERIFIQ v2.2.0</h2>
        <p style="color:#94a3b8;font-size:13px;line-height:1.8;margin-bottom:8px">
          <strong style="color:#e2e8f0">IFC Compliance Checker</strong> for Singapore CORENET-X (COP 3.1) and Malaysia NBeS.
        </p>
        <p style="color:#64748b;font-size:12px;line-height:1.7;margin-bottom:24px">
          Would you like a guided tour of all features? Takes about 90 seconds.<br>
          You can also open the <strong style="color:#00c4a0">User Guide</strong> from the sidebar at any time.
        </p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button onclick="WelcomeTour.start()" style="background:#00c4a0;color:#000;border:none;border-radius:7px;padding:11px 26px;font-size:13px;font-weight:700;cursor:pointer">
            🚀 Yes, show me around
          </button>
          <button onclick="App.navigate('userguide');WelcomeTour.skip();" style="background:#0e2a4a;color:#93c5fd;border:1px solid #1e3a5f;border-radius:7px;padding:11px 20px;font-size:13px;cursor:pointer">
            📖 Open User Guide
          </button>
          <button onclick="WelcomeTour.skip()" style="background:transparent;color:#64748b;border:1px solid #1e3a5f;border-radius:7px;padding:11px 16px;font-size:12px;cursor:pointer">
            Skip
          </button>
        </div>
        <div style="margin-top:14px">
          <label style="font-size:11px;color:#475569;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
            <input type="checkbox" id="tour-dont-show" style="cursor:pointer">
            Don't show this again
          </label>
        </div>
      </div>`;
    document.body.appendChild(d);
  }

  function skip() {
    const cb = document.getElementById('tour-dont-show');
    if (cb && cb.checked) markSeen();
    document.getElementById('tour-prompt')?.remove();
  }

  function start() {
    // Remove all prompt/overlay elements
    const prompt = document.getElementById('tour-prompt');
    if (prompt) prompt.remove();
    // Remove any lingering overlays
    document.querySelectorAll('[id^="tour-"]').forEach(e => e.remove());
    _step = 0;
    // Small delay so the prompt fully unmounts before rendering first step
    setTimeout(_showStep, 100);
  }

  function _showStep() {
    document.getElementById('tour-tooltip')?.remove();
    if (_step >= STEPS.length) { _finish(); return; }
    const s = STEPS[_step];

    // Navigate to the relevant page first, then show the tooltip after render
    const _render = () => {
      document.getElementById('tour-tooltip')?.remove();
      const d = document.createElement('div');
      d.id = 'tour-tooltip';
      d.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;max-width:500px;width:92vw;font-family:Arial';
      d.innerHTML = `
        <div style="background:#061221;border:1.5px solid #00c4a0;border-radius:10px;padding:18px 22px;box-shadow:0 12px 40px rgba(0,0,0,.8)">
          <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">
            <span style="font-size:22px;flex-shrink:0;margin-top:1px">${s.icon}</span>
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:13px;color:#e2e8f0;margin-bottom:5px">${s.title}</div>
              <div style="font-size:11.5px;color:#94a3b8;line-height:1.65">${s.body}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <div style="display:flex;gap:3px;align-items:center">
              ${STEPS.map((_,i) => `<span style="width:${i===_step?'16px':'6px'};height:6px;border-radius:3px;background:${i===_step?'#00c4a0':'#1e3a5f'};transition:width .2s"></span>`).join('')}
              <span style="font-size:10px;color:#475569;margin-left:6px">${_step+1}/${STEPS.length}</span>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              ${_step > 0 ? `<button onclick="WelcomeTour.prev()" style="background:transparent;color:#94a3b8;border:1px solid #1e3a5f;border-radius:5px;padding:5px 12px;font-size:11px;cursor:pointer">← Back</button>` : ''}
              <button onclick="WelcomeTour.next()" style="background:#00c4a0;color:#000;border:none;border-radius:5px;padding:5px 18px;font-size:11px;font-weight:700;cursor:pointer">
                ${_step < STEPS.length-1 ? 'Next →' : '✓ Done'}
              </button>
              <button onclick="WelcomeTour._finish()" style="background:transparent;color:#475569;border:none;font-size:11px;cursor:pointer;padding:5px 8px" title="Exit tour">✕</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(d);
    };

    if (s.nav) {
      App.navigate(s.nav);
      setTimeout(_render, 350);  // Wait for page to render
    } else {
      _render();
    }
  }

  function next() { _step++; _showStep(); }
  function prev() { if (_step > 0) { _step--; _showStep(); } }

  function _finish() {
    document.getElementById('tour-tooltip')?.remove();
    markSeen();
    App.navigate('dashboard');
    const msg = document.createElement('div');
    msg.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;background:#052e16;border:1px solid #22c55e;border-radius:8px;padding:12px 18px;font-size:12px;color:#86efac;box-shadow:0 8px 24px rgba(0,0,0,.5);font-family:Arial';
    msg.innerHTML = '✓ Tour complete! Open an IFC file to begin. <button onclick="this.parentElement.remove()" style="background:transparent;border:none;color:#86efac;cursor:pointer;margin-left:8px">✕</button>';
    document.body.appendChild(msg);
    setTimeout(() => msg?.remove(), 6000);
  }

  // Allow restarting the tour from Settings or Help page
  function restart() { markSeen(); localStorage.removeItem(TOUR_KEY); _step=0; _showStep(); }

  return { prompt, start, skip, next, prev, _finish, restart, shouldShow };
})();
window.WelcomeTour = WelcomeTour;


// ─── USER GUIDE (Interactive, in-context walkthrough helper) ─────────────────
// Replaces the existing renderUserGuidePage with a richer interactive version
// NOTE: renderUserGuidePage() already exists in the App IIFE above and is used
// by the pages router. This window.UserGuideHelper augments it.

window.UserGuideHelper = {
  // Quick-access interactive card shown in every section
  contextCard(section) {
    const tips = {
      files:    { icon:'📁', title:'Loaded Files Tips', tips:['Open multiple IFC files at once to validate them together as a federated model.','Check the Classification % column - anything under 80% means many elements are missing classification codes.','Red georef status means the model is not positioned in SVY21 (Singapore) or GDM2000 (Malaysia).'] },
      results:  { icon:'📋', title:'Reading Results Tips', tips:['Use the Severity filter to focus on Critical first - these cause automatic rejection.','Click the Guide button on any row to see Revit/ArchiCAD/Tekla/Bentley fix instructions.','Use the Gateway filter to see only findings relevant to your current submission stage.'] },
      critical: { icon:'🚨', title:'Critical Issues Tips', tips:["Every Critical finding must be resolved before submitting to CORENET-X or NBeS.",'Click Fix on property errors to send them to the Property Editor.','Proxy elements (IfcBuildingElementProxy) must be changed to the correct IFC class in your BIM software.'] },
      '3d':     { icon:'🧊', title:'3D Viewer Tips', tips:['Left drag to orbit, right drag to pan, scroll to zoom.','Click an element to inspect its compliance status and findings.','Use Colour Mode to switch between compliance colours, IFC type colours, storey colours, or discipline colours.'] },
      validation:{ icon:'✅', title:'Validation Tips', tips:['Choose your country mode before running validation - Singapore for CORENET-X, Malaysia for NBeS.','Select the correct gateway for Singapore submissions (G1 Outline, G1.5 Piling, G2 Structural, G3 Construction).','Trial mode validates the first 10 elements. Activate a licence for unlimited validation.'] },
    };
    const t = tips[section];
    if (!t) return '';
    return `<div class="card" style="padding:14px;margin-bottom:12px;background:rgba(14,124,134,.08);border:1px solid rgba(14,124,134,.3)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:16px">${t.icon}</span>
        <span style="font-size:12px;font-weight:700;color:var(--teal)">${t.title}</span>
        <button onclick="this.closest('.card').remove()" style="margin-left:auto;background:transparent;border:none;color:var(--mid-grey);cursor:pointer;font-size:14px">✕</button>
      </div>
      ${t.tips.map(tip=>`<div style="font-size:11px;color:var(--mid-grey);padding:3px 0 3px 12px;border-left:2px solid rgba(14,124,134,.4)">${tip}</div>`).join('')}
    </div>`;
  }
};

// ─── USER MANUAL PAGE (Comprehensive reference documentation) ────────────────
// This is separate from renderUserGuidePage() which is the step-by-step guide.
// The manual is a full searchable reference document.

(function() {
  // Inject into App module by attaching to window for access from pages router
  // renderUserManualPage is called by pages['manual']
  window._renderUserManualPage = function renderUserManualPage() {
    const SECTIONS = [
      {
        id:'overview', icon:'🏗', title:'Software Overview',
        content:`
          <h3>What is VERIFIQ?</h3>
          <p>VERIFIQ is an IFC compliance checker for Singapore CORENET-X (IFC+SG COP 3.1, December 2025) and Malaysia NBeS/UBBL 1984. It validates every element in your IFC model across 20 compliance check levels and produces actionable findings with specific remediation guidance.</p>

          <h3>System Requirements</h3>
          <table class="manual-table">
            <tr><td>Operating System</td><td>Windows 10 (version 1903) or later, 64-bit</td></tr>
            <tr><td>Microsoft WebView2 Runtime</td><td>Required (automatically installed with VERIFIQ)</td></tr>
            <tr><td>RAM</td><td>4 GB minimum, 8 GB recommended for large models</td></tr>
            <tr><td>Storage</td><td>200 MB for installation, additional space for reports</td></tr>
            <tr><td>Internet</td><td>Not required. VERIFIQ is 100% offline. Internet needed only for update checks.</td></tr>
          </table>

          <h3>Supported File Formats</h3>
          <table class="manual-table">
            <tr><td>.ifc</td><td>IFC STEP Physical File (IFC2x3 and IFC4)</td></tr>
            <tr><td>.ifczip</td><td>Compressed IFC file</td></tr>
            <tr><td>.ifcxml</td><td>IFC XML encoding</td></tr>
            <tr><td>.ifc+sg</td><td>IFC+SG extended format</td></tr>
          </table>`
      },
      {
        id:'workflow', icon:'▶', title:'Step-by-Step Workflow',
        content:`
          <h3>Complete Workflow</h3>
          <ol class="manual-list">
            <li><strong>Configure export in your BIM software</strong> - Install the IFC+SG Translator (ArchiCAD) or Shared Parameters (Revit) from go.gov.sg/ifcsg. Assign classification codes to all elements.</li>
            <li><strong>Export IFC</strong> - Export from your BIM software using IFC4 Reference View with the IFC+SG configuration. Ensure PredefinedType values are mapped and SGPset_ properties are included.</li>
            <li><strong>Open VERIFIQ</strong> - Click Open IFC File or use File menu. Multiple files can be opened together for federated validation.</li>
            <li><strong>Set Country Mode</strong> - Choose Singapore (CORENET-X), Malaysia (NBeS), or Combined in the toolbar.</li>
            <li><strong>Select Gateway (Singapore)</strong> - Choose G1 Outline, G1.5 Piling, G2 Structural, or G3 Construction depending on your submission stage.</li>
            <li><strong>Run Validation</strong> - Click Run Validation. VERIFIQ runs 20 check levels on every element. Progress is shown in the toolbar.</li>
            <li><strong>Review Critical Issues</strong> - Go to Critical Issues. Every Critical finding causes CORENET-X automated rejection. Address these first.</li>
            <li><strong>Fix Property Errors</strong> - Click Fix on property findings to queue them in the Property Editor. Enter correct values and click Apply Fixes.</li>
            <li><strong>Review All Results</strong> - Use the 7 filters (Severity, Discipline, IFC Entity, Agency, Storey, Gateway, Check Type) to work through all findings systematically.</li>
            <li><strong>Re-validate</strong> - Open the corrected IFC file (saved as filename_VERIFIQ_FIXED.ifc) and run validation again to confirm fixes.</li>
            <li><strong>Export Report</strong> - Go to Export Reports and export a compliance report in your required format.</li>
          </ol>`
      },
      {
        id:'checks', icon:'✅', title:'All 20 Compliance Checks',
        content:`
          <h3>Check Level Reference</h3>
          <table class="manual-table">
            <tr><th>Level</th><th>Name</th><th>Description</th><th>Countries</th></tr>
            ${[
              ['L1','IFC Entity Class','Checks that every element uses a specific IFC class, not IfcBuildingElementProxy','SG + MY'],
              ['L2','PredefinedType','Checks that PredefinedType is set to a specific permitted value, not NOTDEFINED','SG + MY'],
              ['L3','ObjectType (UserDefined)','When PredefinedType=USERDEFINED, verifies ObjectType is populated','SG + MY'],
              ['L4','Classification Reference','Checks that an IfcClassificationReference is attached to the element','SG + MY'],
              ['L5','Classification Edition','Checks that the classification references the current COP3.1 edition, not a deprecated one','SG + MY'],
              ['L6','Mandatory Pset_','Checks that all required IFC standard property sets (Pset_) are present','SG + MY'],
              ['L7','SGPset_ (Singapore)','Checks that all required Singapore-specific property sets (SGPset_) are present','SG only'],
              ['L8','Property Values Populated','Checks that required property values are not empty or NOTDEFINED','SG + MY'],
              ['L9','Data Type Validation','Checks that property values match their required data type (string, boolean, number, measure)','SG + MY'],
              ['L10','Enumeration Values','Checks that enum properties use a value from the permitted list for that property','SG + MY'],
              ['L11','Spatial Containment','Checks that every element is contained within a valid IfcBuildingStorey','SG + MY'],
              ['L12','Storey Elevations','Checks that IfcBuildingStorey elements have correct elevation values','SG + MY'],
              ['L13','Georeferencing (SG)','Checks for IfcMapConversion to SVY21 (EPSG:3414)','SG only'],
              ['L13','Georeferencing (MY)','Checks for IfcMapConversion to GDM2000','MY only'],
              ['L14','Site and Building Hierarchy','Checks that IfcProject, IfcSite, IfcBuilding hierarchy is complete and correct','SG + MY'],
              ['L16','Material Assignment','Checks that structural elements have an IfcMaterial or IfcMaterialLayerSetUsage','SG + MY'],
              ['L17','Space Boundary','Checks that IfcSpace elements have space boundary relationships','SG + MY'],
              ['L18','Geometry Validity','Checks that element bounding boxes are non-degenerate','SG + MY'],
            ].map(r=>`<tr><td style="color:var(--teal);font-weight:700">${r[0]}</td><td style="font-weight:600">${r[1]}</td><td>${r[2]}</td><td style="font-size:11px">${r[3]}</td></tr>`).join('')}
          </table>`
      },
      {
        id:'severity', icon:'🔴', title:'Severity Levels Explained',
        content:`
          <h3>Understanding Finding Severity</h3>
          <table class="manual-table">
            <tr><th>Severity</th><th>Meaning</th><th>Action Required</th></tr>
            <tr><td><span style="background:#ef444422;color:#ef4444;border:1px solid #ef444444;border-radius:3px;padding:1px 8px;font-size:11px;font-weight:700">Critical</span></td>
                <td>The CORENET-X or NBeS automated checker will reject the model outright without human review. No exceptions.</td>
                <td>Must fix before submission. No workarounds accepted.</td></tr>
            <tr><td><span style="background:#f9731622;color:#f97316;border:1px solid #f9731644;border-radius:3px;padding:1px 8px;font-size:11px;font-weight:700">Error</span></td>
                <td>Significant non-compliance. May pass the automated check but will be flagged at agency review stage.</td>
                <td>Should fix before submission. May cause delay or rejection at agency review.</td></tr>
            <tr><td><span style="background:#eab30822;color:#eab308;border:1px solid #eab30844;border-radius:3px;padding:1px 8px;font-size:11px;font-weight:700">Warning</span></td>
                <td>Best-practice violation. Unlikely to cause rejection but indicates missing or incomplete data.</td>
                <td>Review and fix where possible. Document reasons if not fixing.</td></tr>
            <tr><td><span style="background:#22c55e22;color:#22c55e;border:1px solid #22c55e44;border-radius:3px;padding:1px 8px;font-size:11px;font-weight:700">Pass</span></td>
                <td>Compliant. The check passed for this element.</td>
                <td>No action required.</td></tr>
          </table>

          <h3>Compliance Score Formula</h3>
          <p>The compliance score is calculated as:</p>
          <div style="background:#0a1628;border:1px solid var(--border);border-radius:6px;padding:12px;font-family:monospace;font-size:12px;margin:8px 0">
            Score = (PassChecks / TotalChecks) × 100%<br>
            where Critical counts as 3× weight, Error as 2× weight, Warning as 1× weight
          </div>
          <p>A score of 95% or above is shown in green. 80-95% in amber. Below 80% in red.</p>`
      },
      {
        id:'bim', icon:'💻', title:'Exporting from BIM Software',
        content:`
          <h3>Autodesk Revit</h3>
          <ol class="manual-list">
            <li>Download the IFC+SG Shared Parameters file from <strong>go.gov.sg/ifcsg</strong></li>
            <li>In Revit: Manage tab → Shared Parameters → Browse to the downloaded file</li>
            <li>Add the IFC+SG parameters to your project categories</li>
            <li>Assign classification codes to elements using the shared parameter fields</li>
            <li>File → Export → IFC. Select IFC4 Reference View.</li>
            <li>In IFC Export Settings: enable "Export IFC+SG shared parameters"</li>
            <li>Verify SGPset_ properties appear in the export preview</li>
          </ol>

          <h3>Graphisoft ArchiCAD</h3>
          <ol class="manual-list">
            <li>Download the IFC+SG Translator from <strong>go.gov.sg/ifcsg</strong></li>
            <li>In ArchiCAD: File → Interoperability → IFC → IFC Translators → Import the downloaded translator</li>
            <li>Open the Classification Manager (Options menu) and import the IFC+SG classification system</li>
            <li>Assign codes to elements via the Classification panel in element settings</li>
            <li>File → Save as → IFC 2x3 or IFC 4 with the IFC+SG translator selected</li>
          </ol>

          <h3>Tekla Structures</h3>
          <ol class="manual-list">
            <li>Download IFC+SG property set definitions from go.gov.sg/ifcsg</li>
            <li>Import property set definitions: File → Catalogs → User-defined Attributes</li>
            <li>Add classification codes via the User Properties panel</li>
            <li>Export: File → Export → IFC → select IFC4 format</li>
          </ol>

          <h3>Bentley OpenBuildings</h3>
          <ol class="manual-list">
            <li>Configure IFC export settings for IFC4 Reference View</li>
            <li>Add IFC+SG property mappings in the export configuration</li>
            <li>Assign classification codes via element properties</li>
            <li>Export via File → Export → IFC</li>
          </ol>`
      },
      {
        id:'agencies', icon:'🇸🇬', title:'Singapore Regulatory Agencies',
        content:`
          <h3>CORENET-X Agencies and Their Requirements</h3>
          <p>Singapore CORENET-X submissions are reviewed by up to 8 regulatory agencies simultaneously. Each agency checks specific elements and properties:</p>
          <table class="manual-table">
            <tr><th>Agency</th><th>Full Name</th><th>Key Elements</th><th>Key Properties</th></tr>
            <tr><td><strong>BCA</strong></td><td>Building and Construction Authority</td><td>All structural elements, IfcBuilding, IfcSite</td><td>LoadBearing, IsExternal, FireRating, structural Pset_</td></tr>
            <tr><td><strong>SCDF</strong></td><td>Singapore Civil Defence Force</td><td>IfcWall (fire-rated), IfcDoor (fire-rated), IfcStair, IfcSpace</td><td>SGPset_WallFireRating, SGPset_DoorFireRating, FireResistancePeriod</td></tr>
            <tr><td><strong>URA</strong></td><td>Urban Redevelopment Authority</td><td>IfcSpace, IfcSite, IfcBuilding</td><td>SGPset_SpaceGFA, GFACategory, GrossPlannedArea, PlotRatio</td></tr>
            <tr><td><strong>NEA</strong></td><td>National Environment Agency</td><td>IfcSpace (ventilation), IfcDuctSegment</td><td>SGPset_SpaceVentilation, AirChangeRate, NaturalVentilationArea</td></tr>
            <tr><td><strong>PUB</strong></td><td>Public Utilities Board</td><td>IfcSanitaryTerminal, IfcPipeSegment</td><td>SGPset_SanitaryFittingWELS, WELSRating, SanitaryFittingCount</td></tr>
            <tr><td><strong>SLA</strong></td><td>Singapore Land Authority</td><td>IfcSite</td><td>SVY21 coordinates, IfcMapConversion, EPSG:3414</td></tr>
            <tr><td><strong>LTA</strong></td><td>Land Transport Authority</td><td>IfcSpace (carpark)</td><td>SGPset_ParkingLot, ParkingLotType, Dimensions</td></tr>
            <tr><td><strong>JTC</strong></td><td>JTC Corporation</td><td>Industrial development elements</td><td>SGPset_JTCFloor, IndustrialUse, FloorLoadCapacity</td></tr>
          </table>`
      },
      {
        id:'malaysia', icon:'🇲🇾', title:'Malaysia NBeS Requirements',
        content:`
          <h3>Malaysia NBeS (National BIM e-Submission)</h3>
          <p>Malaysia mode checks against <strong>NBeS IFC Mapping 2024 (CIDB Malaysia, 2nd Edition)</strong> and <strong>UBBL 1984</strong>.</p>

          <h3>UBBL 1984 Purpose Groups</h3>
          <table class="manual-table">
            <tr><th>Code</th><th>Use</th><th>Key Requirements</th></tr>
            <tr><td>PG1</td><td>Residential</td><td>Bedroom min 9m², living room min 12m², ceiling height min 2.4m</td></tr>
            <tr><td>PG2</td><td>Assembly</td><td>Exit widths, travel distances, means of escape per UBBL Part VII</td></tr>
            <tr><td>PG3</td><td>Institutional</td><td>Accessibility per MS 1184:2014, fire compartmentation</td></tr>
            <tr><td>PG4</td><td>Office</td><td>Natural lighting min 10% of floor area, ventilation</td></tr>
            <tr><td>PG5</td><td>Shop / Retail</td><td>Means of escape, fire compartment max 2000m2</td></tr>
            <tr><td>PG6</td><td>Factory / Industrial</td><td>Structural requirements, fire safety per JBPM</td></tr>
            <tr><td>PG7</td><td>Storage</td><td>Fire rating, compartmentation, sprinkler requirements</td></tr>
            <tr><td>PG8</td><td>Carpark</td><td>Ramp gradients, bay dimensions, ventilation</td></tr>
          </table>

          <h3>Key Malaysia Standards Referenced</h3>
          <ul class="manual-list">
            <li><strong>UBBL 1984</strong> - Uniform Building By-Laws, Third Schedule fire resistance</li>
            <li><strong>MS 1184:2014</strong> - Code of Practice on Access for Disabled Persons</li>
            <li><strong>MS 1525:2019</strong> - Code of Practice on Energy Efficiency and Use of Renewable Energy for Non-Residential Buildings</li>
            <li><strong>JBPM Fire Safety Requirements 2020</strong> - Garis Panduan Persyaratan Keselamatan Kebakaran</li>
            <li><strong>GBI Malaysia</strong> - Green Building Index (Non-Residential NC V1.0)</li>
          </ul>`
      },
      {
        id:'troubleshoot', icon:'🔧', title:'Troubleshooting',
        content:`
          <h3>Common Issues and Fixes</h3>
          <table class="manual-table">
            <tr><th>Issue</th><th>Cause</th><th>Fix</th></tr>
            <tr><td>0% classification on all elements</td><td>No IfcClassificationReference attached. Export configuration not set up.</td><td>Install IFC+SG Translator or Shared Parameters. Assign codes before export.</td></tr>
            <tr><td>68 or more proxy elements</td><td>Elements exported as IfcBuildingElementProxy. IFC mapping not configured.</td><td>In your BIM software, set the correct IFC type for each element category. Do not use Generic Models without IFC mapping.</td></tr>
            <tr><td>No georeferencing</td><td>IfcMapConversion missing. SVY21 not configured in export.</td><td>In Revit: IFC Export → Advanced → set Project Base Point to SVY21. In ArchiCAD: set origin to SVY21 in Coordinates dialog.</td></tr>
            <tr><td>SGPset_ sets missing</td><td>IFC+SG translator not applied or wrong translator version.</td><td>Re-export with the latest IFC+SG Translator from go.gov.sg/ifcsg.</td></tr>
            <tr><td>PredefinedType is NOTDEFINED</td><td>Element type not mapped to IFC PredefinedType in BIM software.</td><td>In element settings, set the specific PredefinedType (e.g. PARAPET for a parapet wall, HOLLOWCORE for a hollow-core slab).</td></tr>
            <tr><td>3D viewer shows nothing</td><td>Model data not received from C# or bounding boxes are null.</td><td>Run validation first - model geometry is sent with the validation results.</td></tr>
            <tr><td>Property Editor shows empty queue</td><td>No fixes have been added.</td><td>Go to Critical Issues or All Results, find a property error (Level 8, 9, or 10), click Fix.</td></tr>
            <tr><td>Software crashes on startup</td><td>WebView2 Runtime missing or outdated.</td><td>Download and install Microsoft WebView2 Runtime from microsoft.com/en-us/edge/webview2</td></tr>
          </table>`
      },
      {
        id:'glossary', icon:'📚', title:'Glossary of Terms',
        content:`
          <h3>Key Terms</h3>
          <table class="manual-table">
            <tr><th>Term</th><th>Definition</th></tr>
            <tr><td><strong>IFC</strong></td><td>Industry Foundation Classes - open BIM standard (ISO 16739) for exchanging building data between software applications.</td></tr>
            <tr><td><strong>IFC+SG</strong></td><td>Singapore's national IFC extension - adds SGPset_ property sets, classification system, and submission requirements on top of IFC4.</td></tr>
            <tr><td><strong>COP 3.1</strong></td><td>Code of Practice for BIM e-Submission, 3rd Edition December 2025. The current Singapore CORENET-X standard.</td></tr>
            <tr><td><strong>CORENET-X</strong></td><td>Construction and Real Estate Network - X. Singapore's online building plan submission system.</td></tr>
            <tr><td><strong>NBeS</strong></td><td>National BIM e-Submission. Malaysia's IFC-based building submission system administered by CIDB.</td></tr>
            <tr><td><strong>Pset_</strong></td><td>IFC standard property set. Defined in the IFC4 schema. Required for all compliant models.</td></tr>
            <tr><td><strong>SGPset_</strong></td><td>Singapore-specific property set. Defined in the IFC+SG Industry Mapping. Required only for Singapore submissions.</td></tr>
            <tr><td><strong>PredefinedType</strong></td><td>A specific sub-type within an IFC entity class. E.g. IfcWall.PARAPET, IfcBeam.JOIST. NOTDEFINED is not acceptable for CORENET-X.</td></tr>
            <tr><td><strong>IfcBuildingElementProxy</strong></td><td>Generic IFC fallback class. Should never be used in a compliant model - every element must have a specific class.</td></tr>
            <tr><td><strong>Classification Code</strong></td><td>An alphanumeric code from the IFC+SG or NBeS classification system identifying the building component type. E.g. A-WAL-EXW-01 (external wall).</td></tr>
            <tr><td><strong>SVY21</strong></td><td>Singapore Coordinate Reference System (EPSG:3414). All Singapore IFC models must be georeferenced in SVY21.</td></tr>
            <tr><td><strong>GDM2000</strong></td><td>Geodetic Datum Malaysia 2000. Malaysia's coordinate reference system for IFC georeferencing.</td></tr>
            <tr><td><strong>Gateway</strong></td><td>Submission stage in CORENET-X. G1=Outline/Planning, G1.5=Piling, G2=Structural, G3=Construction.</td></tr>
            <tr><td><strong>BCF</strong></td><td>BIM Collaboration Format. Open standard for communicating model issues between BIM tools.</td></tr>
            <tr><td><strong>COBie</strong></td><td>Construction Operations Building Information Exchange. Standard for handover of asset data to facilities management.</td></tr>
            <tr><td><strong>IDS</strong></td><td>Information Delivery Specification. ISO 21597 standard for defining what data a model must contain.</td></tr>
          </table>`
      },
    ];

    const searchId = 'manual-search-' + Date.now();

    return `<div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div>
          <h1 style="margin:0">User Manual</h1>
          <p style="font-size:12px;color:var(--mid-grey);margin-top:3px">
            Complete authoritative reference for VERIFIQ v2.2.0
          </p>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="${searchId}" type="text" placeholder="Search manual..."
            style="height:30px;padding:0 10px;font-size:12px;border:1px solid var(--border);border-radius:5px;background:var(--card-2);color:var(--white);width:200px"
            oninput="ManualSearch.run(this.value,'manual-content')"/>
          <button class="btn btn-ghost" style="font-size:11px"
            onclick="App.navigate('userguide')">
            Interactive Guide
          </button>
        </div>
      </div>

      <!-- Jump links -->
      <div class="card" style="padding:12px 16px;margin-bottom:16px;background:var(--navy-dark)">
        <div style="font-size:10px;color:var(--mid-grey);text-transform:uppercase;margin-bottom:8px">Jump to section</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${SECTIONS.map(s=>`<a href="#manual-${s.id}" style="font-size:11px;color:var(--teal);text-decoration:none;padding:3px 8px;border:1px solid rgba(14,124,134,.3);border-radius:4px;background:rgba(14,124,134,.08)">${s.icon} ${s.title}</a>`).join('')}
        </div>
      </div>

      <div id="manual-content" style="display:flex;flex-direction:column;gap:16px">
        ${SECTIONS.map(s=>`
          <div id="manual-${s.id}" class="card" style="padding:20px;scroll-margin-top:20px">
            <h2 style="font-size:15px;margin:0 0 14px;color:var(--white);display:flex;align-items:center;gap:8px;padding-bottom:10px;border-bottom:1px solid var(--border)">
              <span>${s.icon}</span> ${s.title}
            </h2>
            <div class="manual-body" style="font-size:12px;color:var(--mid-grey);line-height:1.8">
              ${s.content}
            </div>
          </div>`).join('')}
      </div>

      <style>
        .manual-table { width:100%;border-collapse:collapse;margin:8px 0 }
        .manual-table th { background:#0a1628;padding:7px 10px;text-align:left;font-size:11px;color:var(--teal);font-weight:700;border-bottom:2px solid var(--border) }
        .manual-table td { padding:7px 10px;font-size:11px;border-bottom:1px solid var(--border);vertical-align:top }
        .manual-table tr:hover td { background:rgba(255,255,255,.02) }
        .manual-body h3 { font-size:13px;color:var(--white);margin:14px 0 8px;font-weight:700 }
        .manual-body p { margin:6px 0 }
        .manual-list { margin:6px 0 6px 18px;padding:0 }
        .manual-list li { margin-bottom:5px }
        .manual-highlight { background:#F59E0B44;border-radius:2px }
      </style>
    </div>`;
  };

  window.ManualSearch = {
    run(query, containerId) {
      const el = document.getElementById(containerId);
      if (!el) return;
      if (!query || query.length < 2) {
        el.querySelectorAll('.manual-highlight').forEach(e => {
          e.outerHTML = e.textContent;
        });
        return;
      }
      // Highlight matching text in manual body sections
      el.querySelectorAll('.manual-body').forEach(section => {
        const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
          if (!node.textContent.toLowerCase().includes(query.toLowerCase())) return;
          const span = document.createElement('span');
          span.innerHTML = node.textContent.replace(
            new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi'),
            m => `<mark class="manual-highlight">${m}</mark>`
          );
          node.parentNode.replaceChild(span, node);
        });
      });
    }
  };
})();    window._renderUserManualPage = function renderUserManualPage() {
      var SECTIONS = [
        { id:'overview',    icon:'&#128269;', title:'Software Overview' },
        { id:'workflow',    icon:'&#9654;',   title:'Step-by-Step Workflow' },
        { id:'checks',      icon:'&#10003;',  title:'All 20 Check Levels' },
        { id:'severity',    icon:'&#9888;',   title:'Findings &amp; Severity' },
        { id:'bimexport',   icon:'&#128194;', title:'BIM Export Guides' },
        { id:'singapore',   icon:'&#127480;&#127468;', title:'Singapore  -  COP 3.1' },
        { id:'malaysia',    icon:'&#127474;&#127486;', title:'Malaysia  -  NBeS 2024' },
        { id:'designcode',  icon:'&#128200;', title:'Design Code Engine' },
        { id:'rulesdb',     icon:'&#128257;', title:'Rules Database &amp; Auto-Update' },
        { id:'troubleshoot',icon:'&#128295;', title:'Troubleshooting' },
        { id:'glossary',    icon:'&#128218;', title:'Glossary' },
      ];

      var CONTENT = {
        overview: '<h3>What is VERIFIQ?</h3><p>VERIFIQ v2.2.0 is a Windows desktop IFC compliance checker for Singapore CORENET-X (COP 3.1, December 2025) and Malaysia NBeS 2024 (CIDB 2nd Edition). It runs 20 sequential check levels on every element in your IFC model and produces actionable findings with specific regulation clause references and remediation guidance.</p><h3>System Requirements</h3><table class="manual-table"><tr><td>OS</td><td>Windows 10 (v1903+) or Windows 11, 64-bit</td></tr><tr><td>.NET 8 Desktop Runtime</td><td>Installed automatically</td></tr><tr><td>WebView2 Runtime</td><td>Installed automatically</td></tr><tr><td>RAM</td><td>4 GB minimum; 8 GB recommended for models over 200 MB</td></tr><tr><td>Internet</td><td>Not required for validation. Optional for rules auto-update.</td></tr></table><h3>File Formats</h3><table class="manual-table"><tr><td>.ifc / .ifczip / .ifcxml</td><td>IFC STEP, compressed IFC, IFC XML  -  IFC2x3 and IFC4.x</td></tr><tr><td>.ids</td><td>buildingSMART IDS for custom requirements (Check Level 16)</td></tr><tr><td>.bcf</td><td>BCF 2.1 for issue import and export</td></tr><tr><td>.xlsx</td><td>IFC+SG Industry Mapping Excel (import via Settings)</td></tr></table><h3>Embedded Data (v2.2.0)</h3><table class="manual-table"><tr><td>COP Version</td><td>CORENET-X COP 3.1 (December 2025)</td></tr><tr><td>Classification codes</td><td>206  -  SG 117, CX 68, MY 21</td></tr><tr><td>IFC+SG property rules</td><td>987 keyed to the 206 codes: 962 Singapore across 8 checking agencies (BCA, URA, SCDF, LTA, PUB, NEA, NParks, SLA), plus 25 Malaysia</td></tr><tr><td>Entity property requirements</td><td>286 mandatory property definitions across 29 IFC entity types (122 COP 3.1 subtypes)</td></tr><tr><td>Gateway property requirements</td><td>77 agency and gateway requirements, plus 51 per-class property-set sets</td></tr><tr><td>Singapore design rules</td><td>192  -  SCDF, URA, BCA, NEA, PUB, SLA, LTA, NParks, JTC</td></tr><tr><td>Malaysia design rules</td><td>52  -  UBBL, MS 1184, JBPM, GBI, MSMA, CIDB NBeS</td></tr><tr><td>GFA categories</td><td>25 AGF_DevelopmentUse values + full AGF_Name lists per development use</td></tr></table>',

        workflow: '<h3>Complete Workflow</h3><ol class="manual-list"><li><strong>Set Country Mode</strong>  -  Singapore (CORENET-X) or Malaysia (NBeS) in the toolbar</li><li><strong>Set Gateway</strong>  -  G1 Design, G1.5 Piling, G2 Construction, or G3/G4 Completion</li><li><strong>Load IFC files</strong>  -  Add Files or drag and drop (.ifc / .ifczip / .ifcxml). Multiple files for multi-discipline validation.</li><li><strong>Run Validation</strong>  -  All 20 check levels run. Cancel anytime for partial results.</li><li><strong>Fix Critical findings first</strong>  -  Every Critical finding causes automatic CORENET-X or NBeS rejection.</li><li><strong>Use Property Editor</strong>  -  Click Fix on any property finding. Enter correct value, click Apply Edit, then Apply All Edits. Output: [filename]-fixed.ifc in the same folder.</li><li><strong>Review all findings</strong>  -  Use the 7 filters: Severity, Discipline, IFC Entity, Agency, Storey, Gateway, Check Type.</li><li><strong>Re-validate</strong>  -  Load the corrected file and confirm findings are resolved.</li><li><strong>Export report</strong>  -  PDF, Excel, or BCF from the Export panel.</li></ol><h3>Gateway-Specific Notes</h3><table class="manual-table"><tr><td><strong>G1.5 Piling</strong></td><td>Every pile individually modelled with 37+ properties: Mark, PileType (BORED/DRIVEN/JETGROUTING/MICROPILE), PileShape, Diameter, CutOffLevel_SHD, ToeLevel_SHD, DA1-1_CompressionCapacity, DA1-1_CompressionDesignLoad, BoreholeRef. Ground investigation boreholes must be co-submitted per BCA Circular APPBCA-2016-08.</td></tr><tr><td><strong>G2 Construction</strong></td><td>All 10 Singapore agencies active. AGF_DevelopmentUse on every IfcSpace/AREA_GFA. AVF_IncludeAsGFA = Yes. WELS ratings on all sanitary fittings. FireExit on exit doors. FireAccessOpening on all windows.</td></tr><tr><td><strong>G3/G4 Completion</strong></td><td>As-built Mark on all structural elements. BCA: Notice of Completion and test records. LTA: as-built topographic survey. NEA: ventilation compliance evidence.</td></tr></table>',

        checks: '<h3>All 20 Check Levels</h3><table class="manual-table"><tr><th>Level</th><th>Name</th><th>Severity</th><th>What it checks</th></tr><tr><td><strong>L1</strong></td><td>IFC Entity Class</td><td>Critical</td><td>IFC class of every element against COP 3.1 approved class for its classification code. IfcBuildingElementProxy is valid for 14 types including Borehole, Tactile Tile, and all parking lot types.</td></tr><tr><td><strong>L2</strong></td><td>GUID Uniqueness</td><td>Critical</td><td>Every element GlobalId unique within and across all loaded files. Duplicates cause automatic CORENET-X rejection.</td></tr><tr><td><strong>L3</strong></td><td>Spatial Containment</td><td>Critical</td><td>Every physical element contained within an IfcBuildingStorey.</td></tr><tr><td><strong>L4</strong></td><td>Classification Reference</td><td>Critical/Error</td><td>Classification code present and references the correct system (CORENET-X for SG, NBeS for MY).</td></tr><tr><td><strong>L5</strong></td><td>Classification Edition</td><td>Error</td><td>Classification edition matches current approved mapping. Outdated COP 2.x codes flagged.</td></tr><tr><td><strong>L6</strong></td><td>Mandatory Pset_</td><td>Critical/Error</td><td>All standard IFC4 property sets required for the element type are present (Pset_WallCommon, Pset_DoorCommon, etc.).</td></tr><tr><td><strong>L7</strong></td><td>SGPset_ / NBeS Pset_</td><td>Critical</td><td>All Singapore SGPset_ or Malaysia NBeS property sets required by COP 3.1 are present.</td></tr><tr><td><strong>L8</strong></td><td>Classification-to-Property Chain</td><td>Critical/Error</td><td>When a classification code is present, all SGPset_ property sets linked to that code are also present. 206 COP 3.1 codes.</td></tr><tr><td><strong>L9</strong></td><td>Property Values</td><td>Error</td><td>Required property values are populated (not blank or null).</td></tr><tr><td><strong>L10</strong></td><td>Enumeration Values</td><td>Error</td><td>Text properties contain only approved values from COP 3.1 enumeration lists (e.g. ConstructionMethod: CIS/PC/PT/PPVC/PF/Spun).</td></tr><tr><td><strong>L11</strong></td><td>Data Types</td><td>Error</td><td>Property values match declared data type.</td></tr><tr><td><strong>L12</strong></td><td>Georeferencing</td><td>Critical</td><td>IfcMapConversion present with SVY21 (SG) or GDM2000 (MY) coordinates within national spatial bounds.</td></tr><tr><td><strong>L13</strong></td><td>Coordinate Reference System</td><td>Warning</td><td>Declared CRS matches SVY21 (SG) or GDM2000/RSO (MY).</td></tr><tr><td><strong>L14</strong></td><td>Geometry Validity</td><td>Warning</td><td>Bounding box checked for zero-extent, NaN, or infinite values.</td></tr><tr><td><strong>L15</strong></td><td>Storey Elevations</td><td>Warning</td><td>IfcBuildingStorey elevations non-zero and ascending.</td></tr><tr><td><strong>L16</strong></td><td>IDS Compliance</td><td>Variable</td><td>Elements checked against loaded IDS specification. Severity follows the IDS file.</td></tr><tr><td><strong>L17</strong></td><td>BCF Cross-Reference</td><td>Info</td><td>Loaded BCF issues linked to the elements they reference.</td></tr><tr><td><strong>L18</strong></td><td>Design Code</td><td>Variable</td><td>192 SG + 52 MY rules: dimensions, areas, fire ratings, WELS, parking, accessibility, georeferencing bounds, structural grades.</td></tr><tr><td><strong>L19</strong></td><td>IFC Schema Version</td><td>Error</td><td>Schema version verified. CORENET-X requires IFC4 ADD2 TC1 or later. IFC2x3 raises a submission-blocking Error.</td></tr><tr><td><strong>L20</strong></td><td>Model Quality</td><td>Warning</td><td>COP 3.1 Model Quality Checklist: storey GFA consistency, space adjacency to walls, cadastral lot boundaries, SVY21 export, IFC+SG parameter units.</td></tr></table>',

        severity: '<h3>Severity Levels</h3><table class="manual-table"><tr><td style="color:#ef4444"><strong>Critical</strong></td><td>Automatic CORENET-X or NBeS rejection. Must resolve before submission.</td></tr><tr><td style="color:#f59e0b"><strong>Error</strong></td><td>Missing or incorrect data. Likely to cause agency delays or resubmission. Should resolve.</td></tr><tr><td style="color:#eab308"><strong>Warning</strong></td><td>Incomplete or non-recommended data. Review and resolve where possible.</td></tr><tr><td style="color:#22c55e"><strong>Info</strong></td><td>Informational. No action required.</td></tr></table><h3>Finding Columns</h3><table class="manual-table"><tr><td>Element GUID</td><td>GlobalId for cross-reference in BIM authoring tool</td></tr><tr><td>IFC Class / Storey</td><td>Entity class and containing building storey</td></tr><tr><td>Property Set</td><td>Pset_ or SGPset_ where the issue was found</td></tr><tr><td>Property Name</td><td>The specific failing property</td></tr><tr><td>Expected / Actual</td><td>Correct value per COP 3.1 vs what the file contains</td></tr><tr><td>Agency</td><td>Regulatory agency the finding relates to</td></tr><tr><td>Code Reference</td><td>Specific regulation clause (e.g. SCDF Fire Code 2023 &sect;5.4.2)</td></tr><tr><td>Remediation</td><td>Guidance on how to fix the issue</td></tr></table><h3>7 Result Filters</h3><p>Severity  -  Discipline (A/S/M/C/L)  -  IFC Entity  -  Agency (BCA/URA/SCDF/NEA/PUB/SLA/LTA/NParks/JTC)  -  Storey  -  Gateway  -  Check Type</p>',

        bimexport: '<h3>ArchiCAD  -  IFC+SG Export</h3><ol class="manual-list"><li>Download IFC+SG Export Translator (2025 edition) from <strong>go.gov.sg/ifcsg</strong> &gt; IFC+SG Resource Kit</li><li>In ArchiCAD: Options &gt; Import Scheme  -  import the translator file</li><li>Assign IFC+SG classification codes to all elements. In ArchiCAD, the classification drives the IFC entity class.</li><li>File &gt; Save as IFC &gt; select the IFC+SG translator &gt; IFC4 Reference View</li><li>After export, verify SGPset_ properties appear on elements in an IFC viewer</li></ol><h3>Revit  -  IFC+SG Export</h3><ol class="manual-list"><li>Download IFC+SG Shared Parameters from <strong>go.gov.sg/ifcsg</strong></li><li>In Revit: Manage &gt; Shared Parameters &gt; load the file</li><li>Add shared parameters to all families needing SGPset_ data</li><li>Set classification codes via the Uniformat Classification field</li><li>File &gt; Export &gt; IFC &gt; Modify Setup &gt; select IFC+SG 2025 &gt; IFC4 schema &gt; export</li></ol><h3>Tekla Structures</h3><ol class="manual-list"><li>Download the Tekla IFC+SG profile from <strong>go.gov.sg/ifcsg</strong></li><li>Apply in File &gt; Export &gt; IFC &gt; settings</li><li>Verify Mark, MaterialGrade, ConstructionMethod are mapped to SGPset_ attributes</li></ol><h3>OpenBuildings Designer</h3><ol class="manual-list"><li>Download the OpenBuildings IFC+SG configuration from <strong>go.gov.sg/ifcsg</strong></li><li>Apply in the IFC export settings</li><li>Verify all SGPset_ structural parameters are mapped</li></ol>',

        singapore: '<h3>9 Regulatory Agencies</h3><table class="manual-table"><tr><th>Agency</th><th>VERIFIQ checks</th></tr><tr><td><strong>BCA</strong></td><td>Mark, MaterialGrade, ConstructionMethod on all structural elements; Code on Accessibility 2025 dimensions; Green Mark U-values (wall &le;0.5, roof &le;0.4, window &le;3.5 W/m&sup2;K); IFC+SG COP 3.1 data completeness</td></tr><tr><td><strong>URA</strong></td><td>AGF_DevelopmentUse (25 approved categories mandatory), AVF_IncludeAsGFA (Yes/No), GrossArea, AGF_BonusGFAType, room size minimums, balcony depth max 1.5m</td></tr><tr><td><strong>SCDF</strong></td><td>FireExit on exit doors, FireAccessOpening on windows, SpaceName + OccupancyType on spaces, fire engine accessway width &ge;4000mm, compartment areas, travel distances, exit staircase widths, fire door and wall FRR</td></tr><tr><td><strong>NEA</strong></td><td>AirChangeRate (offices/car parks min 6 ACH, kitchens min 20 ACH), bin centre min area, grease interceptor capacity</td></tr><tr><td><strong>PUB</strong></td><td>WELSRating (WC min 3 ticks, basins/showers/urinals min 2 ticks), drain Gradient (foul 1:100, stormwater 1:200), pipe InvertLevel, SystemType</td></tr><tr><td><strong>SLA</strong></td><td>SVY21 Easting 2,667&ndash;49,001m; Northing 12,727&ndash;55,796m; RefElevation (SHD -10 to 200m); LandLotNumber format</td></tr><tr><td><strong>LTA</strong></td><td>Car bay 2400&times;4800mm, PWD bay min 3600mm, lorry lot min 3500&times;9000mm, motorcycle lot min 1000&times;2200mm, coach lot min 3500&times;12000mm</td></tr><tr><td><strong>NParks</strong></td><td>Botanical PlantSpecies names (NParks Flora &amp; Fauna Web), transplanted tree GirthSize min 150mm, planted area soil depth min 600mm, LUSH 3.0 ALS_GreeneryFeatures</td></tr><tr><td><strong>JTC</strong></td><td>Industrial slab ImposedLoad min 10 kN/m&sup2; (B2), factory clear height min 5m, loading bay provision</td></tr></table><h3>GFA Categories (URA  -  Critical)</h3><p>Every <strong>IfcSpace / AREA_GFA</strong> must have <strong>AGF_DevelopmentUse</strong> set from the 25 approved URA categories: Agriculture, Beach Area, Business Park, Business 1, Business 2, Cemetery, Civic &amp; Community Institution, Commercial, Educational Institution, Health &amp; Medical Care, Hotel, Open Space, Park, Place of Worship, Port/Airport, Rapid Transit, Reserve Site, Residential (Landed), Residential (Non-landed), Road, Special Use, Sports &amp; Recreation, Transport Facilities, Utility, Waterbody. Missing = automatic URA rejection. <strong>AVF_IncludeAsGFA</strong> must be Yes/True for all areas proposed as GFA.</p>',

        malaysia: '<h3>Malaysia NBeS 2024  -  Codes Checked</h3><table class="manual-table"><tr><th>Code</th><th>VERIFIQ checks</th></tr><tr><td><strong>UBBL 1984</strong></td><td>Room areas (bedroom min 9m&sup2;, kitchen min 4.5m&sup2;), ceiling heights (habitable min 2.6m), window/ventilation ratios, fire escape widths and travel distances, structural minimums (slab min 125mm, wall min 150mm)</td></tr><tr><td><strong>MS 1184:2014</strong></td><td>OKU ramp gradient max 1:12, door clear width min 800mm, corridor min 1500mm, lift car 1100&times;1400mm, accessible toilet 1600&times;2000mm, OKU parking bay min 3700mm</td></tr><tr><td><strong>JBPM Fire Safety 2020</strong></td><td>Compartment wall FRR min 1hr, fire door FRR min 1hr, exit door min 850mm, hydrant coverage within 90m, Bomba access road min 4500mm width and headroom</td></tr><tr><td><strong>CIDB NBeS 2024</strong></td><td>Mark on all structural elements, MaterialGrade (C30/C35/Grade 43/Grade 50/S275/S355), ConstructionMethod including IBS declaration, GDM2000 georeferencing</td></tr><tr><td><strong>GBI</strong></td><td>External wall U-value &le;2.0, roof U-value &le;0.4, window U-value &le;4.0 W/m&sup2;K</td></tr><tr><td><strong>MSMA 2nd Ed. 2012</strong></td><td>Stormwater drain gradient min 1:333 (0.3%), on-site detention tank for sites over 1 hectare</td></tr></table><h3>Georeferencing  -  GDM2000</h3><p>Malaysian models must use <strong>GDM2000</strong> (Geocentric Datum of Malaysia 2000), not SVY21. Peninsular Malaysia: RSO (Rectified Skew Orthomorphic) projection. Sabah and Sarawak: Timbalai 1948 RSO. VERIFIQ checks IfcMapConversion contains GDM2000 coordinates and flags if SVY21 is mistakenly used.</p>',

        designcode: '<h3>Design Code Engine (Check Level 18)</h3><p>Checks that actual dimensional values, areas, fire ratings, and counts in the IFC model meet the minimum or maximum required by the applicable regulation. Runs after all data completeness checks.</p><h3>Singapore  -  192 Rules</h3><table class="manual-table"><tr><th>Category</th><th>Rules</th><th>Key requirements</th></tr><tr><td>SCDF Fire Code 2023</td><td>40+</td><td>Compartment area &le;500m&sup2; (non-sprinklered); travel distance &le;30m; exit stair width &ge;1100mm (&le;24m) / &ge;1200mm (&gt;24m); wall/floor/door FRR; fire engine accessway &ge;4000mm</td></tr><tr><td>URA / GFA</td><td>7</td><td>AGF_DevelopmentUse from 25 categories; AVF_IncludeAsGFA mandatory; GrossArea &gt;0; balcony depth &le;1.5m</td></tr><tr><td>URA Room Sizes</td><td>8</td><td>Living room &ge;16m&sup2; HDB / &ge;13m&sup2; private; bedroom &ge;9m&sup2;; master bedroom &ge;12.5m&sup2;; kitchen &ge;4.5m&sup2;; bathroom &ge;2.5m&sup2;</td></tr><tr><td>BCA Accessibility</td><td>12</td><td>Accessible toilet &ge;2.7m&sup2;; ramp gradient max 1:12; door clear width &ge;850mm; lift car &ge;1100&times;1400mm</td></tr><tr><td>BCA Green Mark</td><td>6</td><td>External wall U-value &le;0.5; roof U-value &le;0.4; window U-value &le;3.5 W/m&sup2;K</td></tr><tr><td>BCA Structural</td><td>6</td><td>Concrete min C25/30; steel min S275; stair riser max 175mm; tread min 250mm; ceiling height &ge;2.4m habitable</td></tr><tr><td>NEA Ventilation</td><td>3</td><td>Car park AirChangeRate &ge;6 ACH; kitchen &ge;20 ACH; office &ge;6 ACH</td></tr><tr><td>PUB WELS / Drainage</td><td>8</td><td>WC &ge;3 ticks; basin/shower &ge;2 ticks; urinal &ge;2 ticks; foul drain gradient &ge;1:100; stormwater &ge;1:200</td></tr><tr><td>LTA Parking</td><td>7</td><td>Car bay 2400&times;4800mm; PWD bay &ge;3600mm; lorry &ge;9000mm; motorcycle &ge;1000&times;2200mm</td></tr><tr><td>NParks LUSH 3.0</td><td>6</td><td>Botanical names required; transplanted tree girth &ge;150mm; soil depth &ge;600mm</td></tr><tr><td>JTC Industrial</td><td>5</td><td>Floor loading &ge;10 kN/m&sup2; (B2); factory height &ge;5m; loading bay required</td></tr><tr><td>SLA Georeferencing</td><td>3</td><td>SVY21 Easting 2,667&ndash;49,001m; Northing 12,727&ndash;55,796m; SHD elevation -10 to 200m</td></tr><tr><td>G4 Completion</td><td>5</td><td>As-built Mark on structural elements; LTA as-built survey; NEA clearances</td></tr></table><h3>Malaysia  -  52 Rules</h3><p>UBBL room/ceiling/structural (14 rules), MS 1184 accessibility (8), JBPM fire (7), CIDB NBeS completeness (4), GBI thermal (4), MSMA drainage (2), Bomba access (2), UBBL fire escape (6), UBBL sanitary (3), GBI tank (2).</p>',

        rulesdb: '<h3>IFC+SG Rules Database</h3><p>VERIFIQ ships with the complete CORENET-X COP 3.1 (December 2025) rules database embedded. The auto-update engine checks for new versions 8 seconds after each application startup.</p><h3>Auto-Update Process</h3><ol class="manual-list"><li>Checks the VERIFIQ version manifest at <strong>bbmw0.com/verifiq/rules-version.json</strong></li><li>Falls back to scraping <strong>info.corenet.gov.sg</strong> for a new Excel download link</li><li>If a newer version is available, a notification banner appears in the application</li><li>Click the banner to download and import the new mapping  -  no restart required</li></ol><h3>Manual Update</h3><ol class="manual-list"><li>Settings (gear icon) &gt; IFC+SG Rules Database panel</li><li>Panel shows: COP Version, Edition Date, Total Codes, Total Properties, Source</li><li>Click <strong>Check for Rules Update</strong> to force an immediate check</li><li>Or click <strong>Manual Import</strong> to import an Excel downloaded from <strong>go.gov.sg/ifcsg</strong></li></ol><p style="margin-top:12px"><em>Downloaded rules are cached at <strong>%LOCALAPPDATA%\\VERIFIQ\\RulesCache\\</strong>. Updates apply to the current session immediately.</em></p>',

        troubleshoot: '<table class="manual-table"><tr><th>Issue</th><th>Solution</th></tr><tr><td><strong>Licence not recognised</strong></td><td>Exactly 29 characters: VRFQ-XXXX-XXXX-0000-XXXXXXXX. No extra spaces. Trial key: VRFQ-TRIAL-DEMO0-0000-00000001. Contact bbmw0@hotmail.com.</td></tr><tr><td><strong>IFC file will not load</strong></td><td>Extension must be .ifc, .ifczip, or .ifcxml. Rename .zip files to .ifczip. Files over 500 MB may take 2+ minutes.</td></tr><tr><td><strong>3D viewer blank</strong></td><td>Settings &gt; Download 3D Viewer. One-time internet download required. Restart VERIFIQ after.</td></tr><tr><td><strong>Zero findings</strong></td><td>Verify Country Mode matches the model. Ensure at least one element has a classification code assigned.</td></tr><tr><td><strong>Integrity error on launch</strong></td><td>Delete %LOCALAPPDATA%\\VERIFIQ\\integrity.manifest and relaunch. Reinstall if persists.</td></tr><tr><td><strong>Rules update fails</strong></td><td>Configure proxy: Settings &gt; Network. Or manually import from go.gov.sg/ifcsg via Settings &gt; IFC+SG Rules Database &gt; Manual Import.</td></tr><tr><td><strong>Property Editor no output</strong></td><td>Click <strong>Apply All Edits</strong> (not just Apply Edit). Output: [filename]-fixed.ifc in same folder as original.</td></tr><tr><td><strong>All elements Critical (L1)</strong></td><td>BIM software is not mapping classification codes to correct IFC entity classes. Re-export using the correct IFC+SG translator settings.</td></tr><tr><td><strong>URA Critical  -  GFA</strong></td><td>Set AGF_DevelopmentUse on every IfcSpace/AREA_GFA from the 25 approved categories. Most common Singapore Critical finding.</td></tr><tr><td><strong>BCF import fails</strong></td><td>VERIFIQ supports BCF 2.1. Downgrade BCF 3.0 files in your BCF tool before import.</td></tr></table><p>Support: <strong>bbmw0@hotmail.com</strong> &nbsp;|&nbsp; +44 7920 212 969 &nbsp;|&nbsp; verifiq.bbmw0.com</p>',

        glossary: '<table class="manual-table"><tr><th>Term</th><th>Definition</th></tr><tr><td><strong>IFC</strong></td><td>Industry Foundation Classes  -  open BIM data exchange standard. CORENET-X uses IFC4 ADD2 TC1 or later.</td></tr><tr><td><strong>IFC+SG</strong></td><td>Singapore extension of IFC4. Adds SGPset_ property sets and the IFC+SG classification code system.</td></tr><tr><td><strong>SGPset_</strong></td><td>Singapore-specific IFC4 property sets (e.g. SGPset_WallFireRating, SGPset_Beam, SGPset_SpaceGFA). Defined in COP 3.1 Section 4.</td></tr><tr><td><strong>Pset_</strong></td><td>Standard IFC4 property sets (Pset_WallCommon, Pset_DoorCommon, etc.). Required in addition to SGPset_.</td></tr><tr><td><strong>AREA_GFA</strong></td><td>IfcSpace PredefinedType for GFA spaces. Must have AGF_DevelopmentUse + AVF_IncludeAsGFA.</td></tr><tr><td><strong>AGF_DevelopmentUse</strong></td><td>URA development use category. One of 25 approved values. Mandatory on all IfcSpace/AREA_GFA.</td></tr><tr><td><strong>AVF_IncludeAsGFA</strong></td><td>Boolean (Yes/No). Must be Yes for all spaces proposed to count as GFA.</td></tr><tr><td><strong>SVY21</strong></td><td>Singapore Geodetic Reference System 1995. Coordinate system for all Singapore IFC submissions.</td></tr><tr><td><strong>GDM2000</strong></td><td>Geocentric Datum of Malaysia 2000. Coordinate system for Malaysian IFC submissions.</td></tr><tr><td><strong>SHD</strong></td><td>Singapore Height Datum. Vertical datum for elevation values in Singapore IFC models.</td></tr><tr><td><strong>CORENET-X</strong></td><td>Singapore one-stop digital regulatory approval platform. Led by BCA and URA, supported by GovTech.</td></tr><tr><td><strong>NBeS</strong></td><td>National BIM e-Submission (Malaysia). Managed by CIDB.</td></tr><tr><td><strong>COP 3.1</strong></td><td>CORENET-X Code of Practice 3.1, December 2025. Primary source for all Singapore requirements in VERIFIQ.</td></tr><tr><td><strong>FRR</strong></td><td>Fire Resistance Rating in hours (0.5, 1, 1.5, 2, 3, 4).</td></tr><tr><td><strong>WELS</strong></td><td>Water Efficiency Labelling Scheme (PUB). WCs min 3 ticks; basins/showers min 2 ticks.</td></tr><tr><td><strong>IBS</strong></td><td>Industrialised Building System (Malaysia). Declared via ConstructionMethod=IBS for CIDB IBS Score.</td></tr><tr><td><strong>LUSH 3.0</strong></td><td>Landscaping for Urban Spaces and High-Rises. NParks Singapore programme, version 3.0.</td></tr><tr><td><strong>RABW</strong></td><td>Regulatory Approval of Building Works  -  the overall CORENET-X approval process.</td></tr><tr><td><strong>QP</strong></td><td>Qualified Person  -  Registered Architect or Professional Engineer who is the statutory submitter.</td></tr></table>',
      };

      var activeSection = 'overview';

      function renderSection(id) {
        activeSection = id;
        var html = CONTENT[id] || '';
        document.getElementById('manual-content').innerHTML = html;
        document.querySelectorAll('.manual-nav-item').forEach(function(el) {
          var active = el.dataset.id === id;
          el.style.background = active ? 'rgba(0,196,160,.15)' : 'transparent';
          el.style.color = active ? 'var(--teal)' : 'var(--mid-grey)';
          el.style.borderLeft = active ? '3px solid var(--teal)' : '3px solid transparent';
        });
      }
      window.renderSection = renderSection;

      var navItems = SECTIONS.map(function(s) {
        return '<div class="manual-nav-item" data-id="' + s.id + '"'
             + ' onclick="renderSection(\'' + s.id + '\')"'
             + ' style="padding:10px 14px;cursor:pointer;font-size:12px;display:flex;align-items:center;gap:8px;'
             + 'border-left:3px solid transparent;transition:all .15s;border-radius:0 6px 6px 0">'
             + '<span>' + s.icon + '</span><span>' + s.title + '</span></div>';
      }).join('');

      setTimeout(function() { renderSection('overview'); }, 50);

      return `
        <div style="display:flex;height:calc(100vh - 56px);overflow:hidden">
          <div style="width:228px;flex-shrink:0;background:var(--card-bg);border-right:1px solid var(--border);overflow-y:auto;padding:14px 0">
            <div style="padding:10px 16px 6px;font-size:10px;font-weight:700;color:var(--mid-grey);text-transform:uppercase;letter-spacing:.08em">User Manual  -  v2.2.0</div>
            ${navItems}
            <div style="padding:14px 14px 6px;border-top:1px solid var(--border);margin-top:10px">
              <button class="btn btn-ghost" style="font-size:11px;width:100%" onclick="App.navigate('help')">&#8592; Back to Help</button>
            </div>
          </div>
          <div style="flex:1;overflow-y:auto;padding:24px 32px" id="manual-content"></div>
        </div>
        <style>
          .manual-table{width:100%;border-collapse:collapse;font-size:12px;margin:12px 0 18px}
          .manual-table th{background:rgba(0,196,160,.12);color:var(--teal);font-weight:700;padding:8px 10px;text-align:left;border:1px solid var(--border)}
          .manual-table td{padding:7px 10px;border:1px solid var(--border);color:var(--mid-grey);vertical-align:top;line-height:1.7}
          .manual-table tr:nth-child(even) td{background:rgba(255,255,255,.025)}
          .manual-list{padding-left:18px;color:var(--mid-grey);font-size:12px;line-height:2}
          #manual-content h3{color:var(--white);font-size:14px;font-weight:700;margin:18px 0 8px}
          #manual-content p{color:var(--mid-grey);font-size:12px;line-height:1.8;margin:0 0 10px}
          #manual-content strong{color:var(--white)}
          #manual-content ol,#manual-content ul{color:var(--mid-grey);font-size:12px;line-height:1.9}
        </style>
      `;
    };;
