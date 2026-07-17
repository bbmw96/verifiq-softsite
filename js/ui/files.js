// VERIFIQ - Files Page
// Copyright 2026 BBMW0 Technologies. All rights reserved.

'use strict';

const FilesPage = (() => {
  function render() {
    const state = VState.get();
    const files = state.filesLoaded;

    if (!files || files.length === 0) {
      return `
        <div>
          <h1>Loaded Files</h1>
          ${VUtils.emptyState('📁', 'No files loaded',
              'Open one or more IFC files to begin compliance validation.',
              '<button class="btn btn-primary" style="margin-top:16px" onclick="VBridge.openFile()">📂 Open IFC File</button>')}
        </div>`;
    }

    const rows = files.map(f => {
      const clsPct = f.elements > 0 ? Math.round((f.classified||0)/f.elements*100) : 0;
      const sizeStr = f.sizeKb > 1024 ? (f.sizeKb/1024).toFixed(1)+'MB' : (f.sizeKb||0)+'KB';
      const georef = f.hasGeoreference;
      return `
      <tr>
        <td style="padding:10px;min-width:180px">
          <div style="font-weight:700;font-size:13px;color:var(--white)">${VUtils.esc(f.name)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
            <span style="font-size:10px;background:#0a1628;border:1px solid var(--border);border-radius:3px;padding:1px 6px;color:#60A5FA">${VUtils.esc(f.schema)}</span>
            <span style="font-size:10px;color:var(--mid-grey)">${sizeStr}</span>
            ${f.parsedAt ? `<span style="font-size:10px;color:var(--mid-grey)">Loaded ${VUtils.esc(f.parsedAt)}</span>` : ''}
          </div>
        </td>
        <td style="padding:10px;text-align:right">
          <div style="font-size:16px;font-weight:700">${VUtils.fmt(f.elements)}</div>
          <div style="font-size:10px;color:var(--mid-grey)">elements</div>
        </td>
        <td style="padding:10px;text-align:right">
          <div style="font-size:13px;font-weight:600">${f.storeys||0}</div>
          <div style="font-size:10px;color:var(--mid-grey)">storeys</div>
        </td>
        <td style="padding:10px;text-align:right">
          <div style="font-size:13px;font-weight:600">${f.spaces||0}</div>
          <div style="font-size:10px;color:var(--mid-grey)">spaces</div>
        </td>
        <td style="padding:10px">
          <div style="display:flex;align-items:center;gap:6px">
            <div style="flex:1;height:6px;background:#1a2840;border-radius:3px;overflow:hidden">
              <div style="height:100%;background:${clsPct>=90?'#22c55e':clsPct>=50?'#eab308':'#ef4444'};width:${clsPct}%;transition:width .3s"></div>
            </div>
            <span style="font-size:11px;font-weight:700;color:${clsPct>=90?'#22c55e':clsPct>=50?'#eab308':'#ef4444'}">${clsPct}%</span>
          </div>
          <div style="font-size:10px;color:var(--mid-grey);margin-top:2px">${f.classified||0} classified / ${f.unclassified||0} missing</div>
        </td>
        <td style="padding:10px">
          ${f.proxies > 0
            ? `<span style="background:#451a03;color:#fed7aa;border:1px solid #7c2d12;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:600">⚠ ${VUtils.fmt(f.proxies)} proxy</span>`
            : '<span style="background:#052e1622;color:#86efac;border:1px solid #052e1644;border-radius:4px;padding:2px 7px;font-size:11px">✓ None</span>'}
        </td>
        <td style="padding:10px">
          <span style="font-size:11px;${georef ? 'color:#22c55e' : 'color:#ef4444'}">${georef ? '✓ SVY21/GDM2000' : '✗ Not georeferenced'}</span>
        </td>
        <td style="padding:10px">
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-ghost" style="padding:3px 8px;font-size:11px" title="View in 3D Viewer"
              onclick="App.navigate('3d')">
              🧊 3D
            </button>
            <button class="btn btn-ghost" style="padding:3px 8px;font-size:11px" title="AI Analysis - analyze this file"
              onclick="FilesPage.openAiAnalysis('${VUtils.esc(f.name)}')">
              🤖 AI
            </button>
            <button class="btn btn-teal" style="padding:3px 8px;font-size:11px" title="Run Validation"
              onclick="VBridge.runValidation()">
              ▶ Validate
            </button>
            <button class="btn btn-ghost" style="padding:3px 8px;font-size:11px;color:#f87171;border-color:#f8717155"
              onclick="VBridge.send('removeFile',{name:'${VUtils.esc(f.name)}'})">
              ✕
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');

    return `
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h1>Loaded Files</h1>
          <div style="display:flex;gap:8px;align-items:center">
            <span style="font-size:12px;color:var(--mid-grey)">${files.length} file(s) loaded</span>
            <button class="btn btn-outline" onclick="VBridge.openFile()">📂 Add Files</button>
            <button class="btn btn-teal" onclick="VBridge.runValidation()">▶ Run Validation</button>
          </div>
        </div>

        <div class="card">
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>File</th><th>Elements</th><th>Storeys</th><th>Spaces</th><th>Classification</th><th>Proxies</th><th>Georef</th><th>Actions</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">Supported File Formats</span></div>
          <div class="two-col" style="margin-top:8px">
            ${formatGroup('IFC / OpenBIM (Full Validation)',
              ['.ifc', '.ifcxml', '.ifczip', '.ifc+sg'],
              'badge-pass')}
            ${formatGroup('CAD Files (Reference Read)',
              ['.dwg', '.dxf', '.dwf', '.dgn'],
              'badge-info')}
            ${formatGroup('Native BIM (Metadata / Export Guidance)',
              ['.rvt (Revit)', '.pln (ArchiCAD)', '.skp (SketchUp)', '.vwx (Vectorworks)'],
              'badge-info')}
            ${formatGroup('Coordination (Cross-Reference)',
              ['.nwd', '.nwf', '.nwc', '.bcf', '.smc'],
              'badge-info')}
            ${formatGroup('Point Cloud (Visual Reference)',
              ['.e57', '.las', '.laz', '.pts', '.xyz', '.rcp'],
              'badge-info')}
            ${formatGroup('Exchange & Emerging Formats',
              ['.step/.stp', '.obj', '.fbx', '.gltf/.glb', '.usd/.usdz'],
              'badge-info')}
            ${formatGroup('COBie & Asset Data',
              ['.cobie (xlsx)', '.cobie (xml)'],
              'badge-info')}
            ${formatGroup('Document & Data',
              ['.pdf', '.xlsx', '.csv', '.json', '.xml'],
              'badge-info')}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">Authoring Tool Export Guides</span>
            <span class="badge badge-info">IFC Export Settings for CORENET-X &amp; NBeS Compliance</span>
          </div>
          <p style="font-size:12px;color:var(--mid-grey);margin-bottom:12px">
            Configure your BIM authoring tool to export IFC files that pass VERIFIQ validation.
            Use IFC4 Reference View or IFC2x3 Coordination View 2.0. Always include property sets, classification codes, and spatial structure.
          </p>
          <div class="two-col">
            ${authoringGuide('Autodesk Revit', '#60A5FA', [
              'File → Export → IFC (or use IFC Exporter add-in)',
              'IFC Version: IFC4 Reference View (preferred) or IFC2x3 CV2',
              'Export: All levels, linked files, rooms as IfcSpace',
              'Property Sets: Export IFC Common Property Sets + user-defined PSets',
              'Classification: Map Revit categories to Uniclass/SfB via shared parameters',
              'Coordinate System: Enable Shared Site coordinates (SVY21 for SG / GDM2000 for MY)',
              'File name: ProjectName_Discipline_Date.ifc (e.g. PROJ_ARC_20260101.ifc)',
              'Recommended add-in: IFC for Revit (github.com/Autodesk/revit-ifc)',
            ])}
            ${authoringGuide('Graphisoft ArchiCAD', '#22D3EE', [
              'File → Save As → IFC 2x3 or IFC 4',
              'Translator: Use "CORENET-X" translator or create custom',
              'IFC Version: IFC4 Reference View (ArchiCAD 26+) or IFC2x3',
              'Export scope: Entire project, all stories, all elements',
              'Classification: Assign Uniclass 2015 codes via Element Classification panel',
              'Properties: Enable "Export IFC Properties" in Translator settings',
              'Geometry: Solid geometry preferred over mesh for wall/slab/roof',
              'Georeferencing: Set Project Location to SVY21 (SG) or GDM2000 (MY)',
            ])}
            ${authoringGuide('Autodesk AutoCAD / Civil 3D', '#F59E0B', [
              'Use Autodesk BIM 360 or Navisworks for IFC export from AutoCAD',
              'AutoCAD Architecture: File → Export → IFC',
              'ACA IFC Version: IFC2x3 (most stable), IFC4 requires ACA 2024+',
              'Map ACA object types to IFC entity classes manually',
              'Recommended: Export to DWG first, then use Revit IFC workflow',
              'For Civil 3D: Export terrain as IfcGeographicElement or IfcSite',
              'Classification: Assign OmniClass / Uniclass codes via extended data',
              'Validation tip: Run audit in AutoCAD before IFC export to clean geometry',
            ])}
            ${authoringGuide('Bentley AECOsim / OpenBuildings', '#A78BFA', [
              'File → Export → IFC (via IFC import/export driver)',
              'IFC Version: IFC4 Reference View (recommended)',
              'Configuration: Use SG CORENET or MY NBeS configuration file if available',
              'Discipline filter: Export per discipline for multi-discipline coordination',
              'Property Sets: Map Bentley property definitions to IFC PSets',
              'Georef: Set project geographic location in DGN settings',
              'For Microstation: Use the Bentley IFC add-on (separately licensed)',
            ])}
            ${authoringGuide('Tekla Structures', '#34D399', [
              'File → Export → IFC (Tekla IFC Exporter)',
              'IFC Version: IFC4 Reference View or IFC2x3',
              'Export set: Create export set for structural elements (IfcColumn, IfcBeam, IfcMember)',
              'Property Sets: Map Tekla attributes to IFC PSets via IFC export template',
              'Base point: Set to project origin (SVY21 or GDM2000)',
              'Classification: Assign Uniclass 2015 Ss codes to assemblies',
              'Recommended: Use Tekla Warehouse IFC templates for SG/MY projects',
            ])}
            ${authoringGuide('Trimble SketchUp', '#FB923C', [
              'SketchUp does not natively export IFC - use a plugin',
              'Recommended plugin: Simlab IFC Exporter (paid) or IFC++ plugin',
              'Alternative: Export to DWG, then import to Revit/ArchiCAD for IFC',
              'If using Simlab: Map SketchUp layers to IFC types in export settings',
              'Property sets will be minimal - supplement with manual COBie data',
              'For compliance: SketchUp IFC is suitable for early design review only',
            ])}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">openBIM Ecosystem Integration</span>
            <span class="badge badge-info">Sortdesk Pro · BIMcollab · Solibri · Navisworks · IFC.js</span>
          </div>
          <p style="font-size:12px;color:var(--mid-grey);margin-bottom:12px">
            VERIFIQ integrates with the openBIM ecosystem via IFC and BCF. Use these tools in your BIM compliance workflow.
          </p>
          <div class="two-col">
            ${ecosystemCard('Sortdesk Pro', '#00c8a8', 'openBIM collaboration and BIM management platform', [
              'Export IFC from Sortdesk Pro using the IFC4 Reference View export option',
              'Enable all SGPset_ property sets before export for CORENET-X compliance',
              'Use Sortdesk openBIM Checker to pre-validate before running VERIFIQ',
              'Import VERIFIQ BCF findings back into Sortdesk for issue tracking',
              'Sortdesk classification codes: map to Uniclass 2015 or OmniClass in export settings',
              'For coordination: export Coordination View IFC and run clash detection before submission',
            ])}
            ${ecosystemCard('BIMcollab / BIMcollab ZOOM', '#60A5FA', 'BCF-based BIM issue management', [
              'Load VERIFIQ BCF export directly into BIMcollab ZOOM or BIMcollab Nexus',
              'BCF 2.1 format exported by VERIFIQ includes: GUID, severity, element type, description',
              'Assign VERIFIQ findings to discipline leads for resolution tracking',
              'Use BIMcollab ZOOM (free) as standalone BCF viewer - no server required',
              'Resolved BCF topics: re-export corrected IFC and re-validate in VERIFIQ',
            ])}
            ${ecosystemCard('Trimble Navisworks', '#F59E0B', 'Model coordination and clash detection', [
              'Open IFC files in Navisworks Manage or Simulate (File → Append → IFC)',
              'Run clash detection before exporting to VERIFIQ for structural/MEP coordination',
              'Export clash results as BCF for issue tracking alongside VERIFIQ findings',
              'Use TimeLiner + IFC spatial structure for phasing compliance checks',
              'NWC/NWD files: use Navisworks to convert to IFC4 for VERIFIQ validation',
            ])}
            ${ecosystemCard('Solibri Model Checker', '#A78BFA', 'Rule-based IFC model quality checker', [
              'Open IFC file in Solibri and run Singapore BCA / CORENET ruleset if available',
              'Complement VERIFIQ validation with Solibri geometric clash and space analysis',
              'Export Solibri results as BCF and cross-reference with VERIFIQ findings',
              'Solibri Space Checker: validates room dimensions against URA standards',
              'Use Solibri IFC Optimizer to reduce file size before submitting to CORENET-X',
            ])}
            ${ecosystemCard('IFC.js / web-ifc-viewer', '#34D399', 'Open-source IFC viewer (embedded in VERIFIQ)', [
              'VERIFIQ uses web-ifc (IFC.js) for 3D model viewing - no additional install required',
              'web-ifc supports IFC2x3 and IFC4 geometry: BREP, swept solids, CSG',
              'Open source: github.com/IFCjs/web-ifc',
              'For large IFC files (>100MB): web-ifc streaming mode loads geometry progressively',
              'VERIFIQ 3D Viewer uses Three.js for rendering - full GLSL shader support',
              'Keyboard shortcuts: I=Fit to view, F=Fullscreen, R=Reset camera',
            ])}
            ${ecosystemCard('Autodesk BIM 360 / ACC', '#F87171', 'Cloud BIM platform and CDE', [
              'Export IFC from BIM 360 Design (Revit cloud workshared model → IFC export)',
              'BIM 360 Coordinate: run clash detection, then export IFC + BCF',
              'ACC (Autodesk Construction Cloud): use Model Coordination for pre-submission check',
              'Download the IFC from BIM 360 Document Management and open in VERIFIQ',
              'For CORENET-X: export from ACC using the Revit IFC Exporter, not the native BIM 360 IFC',
            ])}
          </div>
        </div>
      </div>`;
  }

  function formatGroup(title, formats, badgeClass) {
    const tags = formats.map(f =>
      `<span class="badge ${badgeClass}" style="margin:2px 4px 2px 0">${VUtils.esc(f)}</span>`
    ).join('');
    return `
      <div>
        <h3 style="font-size:12px;margin-bottom:6px">${VUtils.esc(title)}</h3>
        <div>${tags}</div>
      </div>`;
  }

  function ecosystemCard(toolName, accentColor, subtitle, steps) {
    const id = 'ec-' + toolName.replace(/[\s/.]/g,'').toLowerCase();
    const items = steps.map(s => `<li style="margin-bottom:3px">${VUtils.esc(s)}</li>`).join('');
    return `
      <div class="card" style="margin-bottom:0;border-left:3px solid ${accentColor}">
        <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none"
          onclick="var b=document.getElementById('${id}');b.style.display=b.style.display==='none'?'block':'none'">
          <div>
            <span style="font-size:13px;font-weight:700;color:${accentColor}">${VUtils.esc(toolName)}</span>
            <span style="font-size:10px;color:var(--mid-grey);margin-left:8px">${VUtils.esc(subtitle)}</span>
          </div>
          <span style="font-size:11px;color:var(--mid-grey)">Workflow ▾</span>
        </div>
        <div id="${id}" style="display:none;margin-top:8px">
          <ul style="font-size:11px;color:var(--text-muted,#9ab8d4);padding-left:16px;margin:0;line-height:1.7">${items}</ul>
        </div>
      </div>`;
  }

  function authoringGuide(toolName, accentColor, steps) {
    const id = 'ag-' + toolName.replace(/\s/g,'').toLowerCase();
    const items = steps.map(s => `<li style="margin-bottom:3px">${VUtils.esc(s)}</li>`).join('');
    return `
      <div class="card" style="margin-bottom:0;border-left:3px solid ${accentColor}">
        <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none"
          onclick="var b=document.getElementById('${id}');b.style.display=b.style.display==='none'?'block':'none'">
          <span style="font-size:13px;font-weight:700;color:${accentColor}">${VUtils.esc(toolName)}</span>
          <span style="font-size:11px;color:var(--mid-grey)">IFC Export ▾</span>
        </div>
        <div id="${id}" style="display:none;margin-top:8px">
          <ol style="font-size:11px;color:var(--text-muted,#9ab8d4);padding-left:16px;margin:0;line-height:1.7">${items}</ol>
        </div>
      </div>`;
  }

  function openAiAnalysis(fileName) {
    // Navigate to AI assistant, then auto-send a file analysis prompt
    App.navigate('ai');
    setTimeout(() => {
      if (window.AiAssistantPage && AiAssistantPage.analyzeFile) {
        AiAssistantPage.analyzeFile(fileName);
      }
    }, 300);
  }

  return { render, openAiAnalysis };
})();

window.FilesPage = FilesPage;


// ─── EXPORT PAGE ──────────────────────────────────────────────────────────────

const ExportPage = (() => {
  function render() {
    const state = VState.get();

    return `
      <div>
        <h1>Export Compliance Reports</h1>
        <p style="margin-bottom:20px">
          ${state.hasResults
            ? 'Validation results are available. Choose your export formats below.'
            : 'Run validation first to generate reports.'}
        </p>

        <div class="two-col">
          ${formatCard('📝', 'Word', '.docx', 'Full branded report with summary, agency breakdown and findings table. Ideal for submission to QPs or for client delivery.', state.hasResults)}
          ${formatCard('📄', 'PDF', '.pdf', 'Printable compliance report. Opens automatically in browser for print-to-PDF in version 1.0. Native PDF in version 1.1.', state.hasResults)}
          ${formatCard('📊', 'Excel', '.xlsx', '6 worksheets: Summary, All Findings, Critical, Errors, By Agency, Elements. Full autofilter and colour-coding.', state.hasResults)}
          ${formatCard('📋', 'CSV', '.csv', 'Machine-readable findings export. All 16 fields per finding. Compatible with any spreadsheet, database or BI tool.', state.hasResults)}
          ${formatCard('🌐', 'HTML', '.html', 'Interactive self-contained HTML report. Includes live filter bar , with live filters for severity, agency and GUID.', state.hasResults)}
          ${formatCard('{ }', 'JSON', '.json', 'Full structured report object. Ideal for integration with project management tools, dashboards or APIs.', state.hasResults)}
          ${formatCard('</', 'XML', '.xml', 'VERIFIQReport XML schema. Compatible with enterprise BIM data management systems.', state.hasResults)}
          ${formatCard('📃', 'Markdown', '.md', 'Clean Markdown report. Works in GitHub, Confluence, Notion and any Markdown-compatible platform.', state.hasResults)}
          ${formatCard('📃', 'Text', '.txt', 'Plain text report. 80-character ruled layout. Compatible with any system or terminal.', state.hasResults)}
          ${formatCard('🏗', 'BCF', '.bcf', 'BIM Collaboration Format 2.1. Exports every error as a BCF topic. Directly importable in ArchiCAD, Revit, Tekla and BIMcollab.', state.hasResults)}
        </div>

        ${state.hasResults ? `
          <div style="margin-top:8px">
            <button class="btn btn-teal" onclick="VBridge.send('export',{})">
              📤 Open Export Window
            </button>
          </div>` : `
          <div style="margin-top:8px">
            <button class="btn btn-primary" onclick="VBridge.openFile()">📂 Open IFC File</button>
          </div>`}
      </div>`;
  }

  function formatCard(icon, name, ext, description, enabled) {
    return `
      <div class="card" style="opacity:${enabled ? 1 : .5}">
        <div class="card-header">
          <span class="card-title">${icon} ${VUtils.esc(name)}</span>
          <span class="badge badge-info" style="font-family:monospace">${VUtils.esc(ext)}</span>
        </div>
        <p style="font-size:12px">${VUtils.esc(description)}</p>
      </div>`;
  }

  return { render };
})();

window.ExportPage = ExportPage;


// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────

const SettingsPage = (() => {
  function render() {
    const state = VState.get();
    const mode  = state.countryMode;

    return `<div>
      <h1>Settings</h1>

      <!-- Country Mode -->
      <div class="card">
        <div class="card-header"><span class="card-title">🌏 Country Mode</span></div>
        <p style="margin-bottom:14px">Select the regulatory framework to validate against. Switching mode clears current results.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${modeBtn('Singapore', '🇸🇬 Singapore', 'CORENET-X / IFC+SG', mode)}
          ${modeBtn('Malaysia',  '🇲🇾 Malaysia',  'NBeS / UBBL 1984',   mode)}
          ${modeBtn('Combined',  '🌏 SG + MY',    'Both simultaneously', mode)}
        </div>
      </div>

      <!-- Singapore settings -->
      ${(mode === 'Singapore' || mode === 'Combined') ? `
      <div class="card">
        <div class="card-header"><span class="card-title">🇸🇬 Singapore: CORENET-X Submission Gateway</span></div>
        <p style="margin-bottom:14px;font-size:12px">Select the submission gateway. Different gateways require different sets of properties.
          CORENET-X has 5 gateways; most projects submit through Design and Construction gateways.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${gatewayBtn('Design',             'Design Gateway',        'Pre-construction design submission',       state.sgGateway)}
          ${gatewayBtn('Construction',       'Construction Gateway',  'During-construction submission (default)', state.sgGateway)}
          ${gatewayBtn('Completion',         'Completion Gateway',    'Post-completion submission',               state.sgGateway)}
          ${gatewayBtn('Piling',             'Piling Gateway',        'Piling works approval (piling-specific)',   state.sgGateway)}
          ${gatewayBtn('DirectSubmission',   'DSP Gateway',           'Direct Structural Plans - smaller projects',state.sgGateway)}
        </div>
      </div>` : ''}

      <!-- Malaysia settings -->
      ${(mode === 'Malaysia' || mode === 'Combined') ? `
      <div class="card">
        <div class="card-header"><span class="card-title">🇲🇾 Malaysia: UBBL Purpose Group</span></div>
        <p style="margin-bottom:14px;font-size:12px">Select the building Purpose Group per UBBL 1984. This determines which
          constructional and fire requirements apply to the project.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${pgBtn('All',              'All Purpose Groups',         'Check against all applicable groups',           state.myPurposeGroup)}
          ${pgBtn('PurposeGroupI',    'PG I: Small Residential',    'Houses, terrace, semi-D, ≤ 3 storeys',         state.myPurposeGroup)}
          ${pgBtn('PurposeGroupII',   'PG II: Small Flat',          'Apartments < 280 m², flats per floor',          state.myPurposeGroup)}
          ${pgBtn('PurposeGroupIII',  'PG III: Other Residential',  'Flats, apartments, hostels, hotels',            state.myPurposeGroup)}
          ${pgBtn('PurposeGroupIV',   'PG IV: Office',              'Offices, banks, government buildings',          state.myPurposeGroup)}
          ${pgBtn('PurposeGroupV',    'PG V: Shop',                 'Retail, restaurants, food courts',              state.myPurposeGroup)}
          ${pgBtn('PurposeGroupVI',   'PG VI: Factory',             'Factories, warehouses, industrial',             state.myPurposeGroup)}
          ${pgBtn('PurposeGroupVII',  'PG VII: Place of Resort',    'Cinemas, theatres, stadiums, places of worship',state.myPurposeGroup)}
          ${pgBtn('PurposeGroupVIII', 'PG VIII: Institution',       'Hospitals, schools, clinics, universities',     state.myPurposeGroup)}
          ${pgBtn('PurposeGroupIX',   'PG IX: Hazardous',           'Special risk and hazardous occupancies',        state.myPurposeGroup)}
        </div>
      </div>` : ''}

      <!-- Licence -->
      <div class="card">
        <div class="card-header"><span class="card-title">🔑 Licence</span></div>
        <div class="detail-panel">
          <div class="detail-row">
            <span class="detail-label">Licence Tier</span>
            <span class="detail-value">${VUtils.esc(state.licence || 'Trial')}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Country Coverage</span>
            <span class="detail-value">Singapore and Malaysia - both countries included in all tiers</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Design Code Checking</span>
            <span class="detail-value">50+ design rules (URA, BCA, SCDF, UBBL, MS 1184, JBPM) - all tiers</span>
          </div>
        </div>
        <div style="margin-top:12px">
          <button class="btn btn-outline" onclick="App.navigate('licence')">Manage Licence →</button>
        </div>
      </div>

      <!-- Network & Connectivity -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">🌐 Network & Connectivity</span>
          <span id="net-status-badge" style="font-size:11px;font-weight:700;padding:3px 10px;
            border-radius:10px;background:${state.online?'#D1FAE5':'#FEE2E2'};
            color:${state.online?'#065F46':'#991B1B'}">
            ${state.online ? '● Online' : '○ Offline'}
          </span>
        </div>
        <p style="font-size:12px;margin-bottom:14px;color:var(--mid-grey)">
          VERIFIQ validates IFC files <strong>100% offline</strong> - no internet is needed for
          compliance checking, 3D viewing, or exporting. Internet is only used for the
          optional software update check (runs silently in the background).
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
          <span style="font-size:12px;color:var(--mid-grey)">✓ 3D Viewer uses built-in WebGL renderer - works offline with no download needed.</span>
          <button class="btn btn-ghost" onclick="VBridge.send('requestNetworkStatus',{})">
            ↻ Refresh Status
          </button>
        </div>

        <!-- Proxy / VPN configuration -->
        <div style="border-top:1px solid var(--border);padding-top:14px;margin-top:4px">
          <div style="font-size:13px;font-weight:600;margin-bottom:10px;color:var(--white)">
            🔒 Proxy / VPN Configuration
          </div>
          <p style="font-size:12px;color:var(--mid-grey);margin-bottom:12px">
            Configure if your organisation routes traffic through a corporate proxy or VPN.
            IT administrators can also set a custom update server URL for air-gapped deployments.
          </p>
          <div id="proxy-form" style="display:grid;gap:10px;max-width:560px">
            <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer">
              <input type="checkbox" id="px-enabled"
                ${(state.proxySettings && state.proxySettings.useProxy) ? 'checked' : ''}
                style="width:16px;height:16px;cursor:pointer"
                onchange="document.getElementById('px-fields').style.display=this.checked?'grid':'none'"/>
              Enable proxy server
            </label>
            <div id="px-fields"
              style="display:${(state.proxySettings && state.proxySettings.useProxy)?'grid':'none'};
                     gap:8px;padding:12px;background:var(--bg);border-radius:6px;
                     border:1px solid var(--border)">
              ${proxyField('px-url',  'Proxy URL',  'http://proxy.company.com:8080',
                  state.proxySettings ? state.proxySettings.proxyUrl : '')}
              ${proxyField('px-user', 'Username (optional)', '',
                  state.proxySettings ? state.proxySettings.username : '')}
              ${proxyField('px-pass', 'Password (optional)', '', '', 'password')}
              ${proxyField('px-bypass', 'Bypass list (comma-separated)',
                  '*.internal.company.com, 192.168.0.0/16',
                  state.proxySettings ? state.proxySettings.bypassList : '')}
              ${proxyField('px-update', 'Custom update server URL (leave empty for bbmw0.com)',
                  'https://updates.company.com/verifiq/version.json',
                  state.proxySettings ? state.proxySettings.customUpdateUrl : '')}
              <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
                <input type="checkbox" id="px-ssl"
                  ${(state.proxySettings && state.proxySettings.ignoreSslErrors) ? 'checked' : ''}
                  style="width:14px;height:14px"/>
                Ignore SSL certificate errors (for proxies with internal CA)
              </label>
            </div>
            <div>
              <button class="btn btn-teal" style="padding:8px 20px" onclick="(function(){
                var cfg = {
                  useProxy:         document.getElementById('px-enabled').checked,
                  proxyUrl:         document.getElementById('px-url').value,
                  username:         document.getElementById('px-user').value,
                  password:         document.getElementById('px-pass').value,
                  bypassList:       document.getElementById('px-bypass').value,
                  customUpdateUrl:  document.getElementById('px-update').value,
                  ignoreSslErrors:  document.getElementById('px-ssl').checked,
                };
                VBridge.saveProxy(cfg);
              })()">Save Network Settings</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Rules database -->
      <div class="card">
        <div class="card-header"><span class="card-title">📏 Rules Database</span></div>
        <div class="detail-panel">
          <div class="detail-row">
            <span class="detail-label">Singapore Rules</span>
            <span class="detail-value">IFC+SG Industry Mapping 2025 (COP 3.1 Edition, December 2025)</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">SG Agencies</span>
            <span class="detail-value">BCA, SCDF, URA, PUB, LTA, HDB, SLA, NEA, NParks, JTC</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Malaysia Rules</span>
            <span class="detail-value">NBeS IFC Mapping 2024 (CIDB)</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">MY Codes</span>
            <span class="detail-value">UBBL 1984 Parts I to IX, MS 1184:2014, JBPM 2020, GBI Malaysia</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Design Code Rules</span>
            <span class="detail-value">50+ rules: URA room sizes, BCA accessibility 2025, SCDF fire code, UBBL dimensions</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Data Check Levels</span>
            <span class="detail-value">20 check levels per element (entity class → geometry validity)</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Operation Mode</span>
            <span class="detail-value" style="color:var(--green);font-weight:600">100% offline. No internet connection is used during validation.</span>
          </div>
        </div>
      </div>
    </div>`;
  }

  function modeBtn(mode, label, sub, current) {
    const active = current === mode;
    const style  = active
      ? 'background:var(--navy-dark);color:white;border:2px solid var(--navy-dark)'
      : 'background:var(--card-2);color:var(--muted-2);border:2px solid var(--border)';
    return `<button onclick="VBridge.setMode('${mode}')"
      style="padding:14px 20px;border-radius:8px;cursor:pointer;text-align:left;font-family:Arial;${style};min-width:180px">
      <div style="font-size:15px;font-weight:700">${VUtils.esc(label)}</div>
      <div style="font-size:11px;opacity:.7;margin-top:4px">${VUtils.esc(sub)}</div>
    </button>`;
  }

  function gatewayBtn(gateway, label, desc, current) {
    // current is C# CorenetGateway.ToString() e.g. 'Construction', 'DirectSubmission'
    const active = (current || 'Construction') === gateway;
    const style  = active
      ? 'background:var(--teal);color:white;border:2px solid var(--teal)'
      : 'background:var(--card-2);color:var(--muted-2);border:2px solid var(--border)';
    return `<button onclick="VBridge.setGateway('${gateway}')"
      style="padding:10px 14px;border-radius:8px;cursor:pointer;text-align:left;font-family:Arial;${style};min-width:160px">
      <div style="font-size:13px;font-weight:700">${VUtils.esc(label)}</div>
      <div style="font-size:10px;opacity:.7;margin-top:3px">${VUtils.esc(desc)}</div>
    </button>`;
  }

  function pgBtn(pg, label, desc, current) {
    // current is C# MalaysiaPurposeGroup.ToString() e.g. 'PurposeGroupI', 'All'
    const active = (current || 'All') === pg;
    const style  = active
      ? 'background:var(--navy-dark);color:white;border:2px solid var(--navy-dark)'
      : 'background:var(--card-2);color:var(--muted-2);border:2px solid var(--border)';
    return `<button onclick="VBridge.setPG('${pg}')"
      style="padding:10px 14px;border-radius:8px;cursor:pointer;text-align:left;font-family:Arial;${style};min-width:160px">
      <div style="font-size:13px;font-weight:700">${VUtils.esc(label)}</div>
      <div style="font-size:10px;opacity:.7;margin-top:3px">${VUtils.esc(desc)}</div>
    </button>`;
  }

  function proxyField(id, label, placeholder, value='', type='text') {
    return `<div style="display:flex;flex-direction:column;gap:4px">
      <label style="font-size:11px;font-weight:600;color:var(--mid-grey)">${VUtils.esc(label)}</label>
      <input id="${id}" type="${type}" placeholder="${VUtils.esc(placeholder)}"
        value="${VUtils.esc(value)}"
        style="padding:8px 10px;border:1px solid var(--border);border-radius:5px;
               font-family:Arial;font-size:12px;background:var(--card-2);color:var(--white)"/>
    </div>`;
  }

  return { render };
})();

window.SettingsPage = SettingsPage;


// ─── ABOUT PAGE ───────────────────────────────────────────────────────────────

const AboutPage = (() => {
  function render() {
    return `
      <div>
        <h1>About VERIFIQ</h1>

        <div class="card">
          <div style="display:flex;align-items:center;gap:20px;margin-bottom:20px">
            <div style="width:64px;height:64px;background:var(--navy-dark);border-radius:12px;
                        display:flex;align-items:center;justify-content:center;
                        font-size:24px;font-weight:900;color:white">VQ</div>
            <div>
              <div style="font-size:26px;font-weight:900;color:var(--white);line-height:1">VERIFIQ</div>
              <div style="color:var(--teal);font-weight:600;font-size:14px;margin:4px 0">IFC Compliance Checker: Singapore and Malaysia</div>
              <div style="font-size:12px;color:var(--light-grey)">Version 2.2.0 &nbsp;|&nbsp; BBMW0 Technologies</div>
            </div>
          </div>

          <div class="detail-panel">
            <div class="detail-row">
              <span class="detail-label">Version</span>
              <span class="detail-value"><strong>2.2.0</strong> - Released May 2026</span>
            </div>

            <div class="detail-row">
              <span class="detail-label">Developer</span>
              <span class="detail-value">BBMW0 Technologies</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Website</span>
              <span class="detail-value">bbmw0.com</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Contact</span>
              <span class="detail-value">bbmw0@hotmail.com</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Copyright</span>
              <span class="detail-value">&copy; 2026 BBMW0 Technologies. All rights reserved.</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Disclaimer</span>
              <span class="detail-value">VERIFIQ is a data and design compliance auditing tool.
                A passing result does not constitute regulatory approval. The Qualified Person (QP)
                remains responsible for all code compliance determinations.</span>
            </div>
          </div>
        </div>

        <div class="two-col">
          <div class="card">
            <div class="card-header"><span class="card-title">What VERIFIQ Does</span></div>
            <p style="font-size:12px;line-height:1.8">
              VERIFIQ reads IFC building model files and checks every element against
              Singapore CORENET-X (IFC+SG Industry Mapping 2025) and/or Malaysia NBeS (UBBL 1984)
              regulatory requirements across all <strong>20 data validation levels</strong>.<br><br>
              It also checks actual design values including room areas, door widths, travel distances,
              ceiling heights, fire ratings, and U-values, all checked against published code requirements
              from URA, BCA, SCDF, UBBL, MS 1184, JBPM and Green Mark.<br><br>
              VERIFIQ is a read-only compliance auditor. It never modifies your model.
            </p>
          </div>
          <div class="card">
            <div class="card-header"><span class="card-title">Technology Stack</span></div>
            <p style="font-size:12px;line-height:1.8">
              Built on <strong>C# .NET 8 WPF</strong> with a WebView2 embedded browser for the
              interactive front-end interface. An embedded SQLite rules database holds all
              IFC+SG and NBeS property requirements.<br><br>
              <strong>Offline-first design</strong>: no internet connection is required at any
              time during validation or export. All 20 check levels and all design code rules
              run entirely on your local machine.<br><br>
              Export formats: Word, PDF (print), Excel, CSV, JSON, HTML, XML, Markdown, Text, BCF 2.1.
            </p>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">Supported Regulatory Codes</span></div>
          <div class="two-col">
            <div>
              <h3 style="margin-bottom:8px">🇸🇬 Singapore</h3>
              <div class="detail-panel" style="margin-top:0">
                <div class="detail-row"><span class="detail-label">CORENET-X</span><span class="detail-value">COP 3.1 Edition, December 2025</span></div>
                <div class="detail-row"><span class="detail-label">IFC+SG Mapping</span><span class="detail-value">Industry Mapping 2025 (all 10 agencies)</span></div>
                <div class="detail-row"><span class="detail-label">BCA Accessibility</span><span class="detail-value">Code on Accessibility 2025</span></div>
                <div class="detail-row"><span class="detail-label">SCDF Fire Code</span><span class="detail-value">Fire Code 2018 (2023 Amendment)</span></div>
                <div class="detail-row"><span class="detail-label">URA Planning</span><span class="detail-value">Handbook on Planning Parameters 2023</span></div>
                <div class="detail-row"><span class="detail-label">BCA Green Mark</span><span class="detail-value">Green Mark 2021 (WWR, U-values, RETV)</span></div>
                <div class="detail-row"><span class="detail-label">Agencies Covered</span><span class="detail-value">BCA, URA, SCDF, LTA, NEA, NParks, PUB, SLA</span></div>
              </div>
            </div>
            <div>
              <h3 style="margin-bottom:8px">🇲🇾 Malaysia</h3>
              <div class="detail-panel" style="margin-top:0">
                <div class="detail-row"><span class="detail-label">NBeS</span><span class="detail-value">IFC Mapping 2024 (CIDB Malaysia)</span></div>
                <div class="detail-row"><span class="detail-label">UBBL 1984</span><span class="detail-value">All 9 Parts: space, structure, fire</span></div>
                <div class="detail-row"><span class="detail-label">MS 1184:2014</span><span class="detail-value">Access for Disabled Persons</span></div>
                <div class="detail-row"><span class="detail-label">JBPM 2020</span><span class="detail-value">Fire Safety Requirements</span></div>
                <div class="detail-row"><span class="detail-label">GBI Malaysia</span><span class="detail-value">Green Building Index - U-values, thermal</span></div>
                <div class="detail-row"><span class="detail-label">Purpose Groups</span><span class="detail-value">I, III, IV, V (All supported)</span></div>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">Version 1.2: Current Capabilities</span></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Capability</th><th>Details</th><th>Status</th></tr></thead>
              <tbody>
                <tr><td><strong>20-Level Data Validation</strong></td><td>Entity class, property sets, SGPset_, classifications, georeferencing, geometry, GUID uniqueness</td><td><span class="badge badge-pass">✓ Available</span></td></tr>
                <tr><td><strong>Design Code Checking</strong></td><td>50+ rules covering URA room sizes, BCA accessibility, SCDF fire distances, UBBL dimensions, Green Mark U-values</td><td><span class="badge badge-pass">✓ Available</span></td></tr>
                <tr><td><strong>Singapore CORENET-X</strong></td><td>IFC+SG Industry Mapping 2025, all 10 agencies, SVY21 georeferencing</td><td><span class="badge badge-pass">✓ Available</span></td></tr>
                <tr><td><strong>Malaysia NBeS / UBBL</strong></td><td>NBeS 2024 mapping, UBBL Parts I to IX, GDM2000 georeferencing</td><td><span class="badge badge-pass">✓ Available</span></td></tr>
                <tr><td><strong>10 Export Formats</strong></td><td>Word, PDF, Excel (9 sheets + live formulas), CSV, JSON, HTML, XML, Markdown, Text, BCF 2.1</td><td><span class="badge badge-pass">✓ Available</span></td></tr>
                <tr><td><strong>50+ File Formats Accepted</strong></td><td>IFC, DWG, RVT, PLN, NWD, BCF, E57, OBJ, FBX, GLTF and more</td><td><span class="badge badge-pass">✓ Available</span></td></tr>
                <tr><td><strong>3D Model Viewer</strong></td><td>WebGL compliance colour-coding via xeokit SDK; element inspector panel</td><td><span class="badge badge-pass">✓ Available</span></td></tr>
                <tr><td>IFC Property Editing</td><td>Fix missing or incorrect properties directly in VERIFIQ without returning to the BIM authoring tool</td><td><span class="badge badge-info">Available: v1.3.0</span></td></tr>
                <tr><td>Native PDF Generation</td><td>Full PdfSharpCore-generated PDF without browser print step</td><td><span class="badge badge-info">Available: v1.3.0</span></td></tr>
                <tr><td>Direct CORENET-X Portal Submission</td><td>Submit validated models directly to the Singapore CORENET-X e-submission portal</td><td><span class="badge badge-info">v1.2 partial</span></td></tr>
                <tr><td>Direct NBeS Portal Submission</td><td>Submit validated models directly to the Malaysia NBeS portal</td><td><span class="badge badge-info">v1.2 partial</span></td></tr>
                <tr><td>Automated Clash Detection</td><td>Geometric clash detection across architectural, structural and MEP federated models</td><td><span class="badge badge-info">v1.2 partial</span></td></tr>
                <tr><td>AI-Assisted Remediation</td><td>AI suggests the most likely correct property value for each failing parameter</td><td><span class="badge badge-info">v1.2 partial</span></td></tr>
                <tr><td>Digital Twin Export</td><td>Export to Virtual Singapore and Malaysia national digital twin platforms</td><td><span class="badge badge-info">Future</span></td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">📋 Version History</span></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Version</th><th>Date</th><th>Key Changes</th></tr></thead>
              <tbody>
                <tr>
                  <td><span class="badge badge-pass">v2.2.0</span></td>
                  <td style="white-space:nowrap;font-size:11px">May 2026</td>
                  <td style="font-size:11px">VERIFIQ brand mark (navy and teal VQ), multi-resolution ICO icon (16 to 256px),
                    Windows installer (Inno Setup 6) with a licence-key-preserving upgrade path,
                    macOS desktop build (Photino.NET and WKWebView), embedded offline AI Assistant
                    with engine router and 950 Super Agents, and the COP rules auto-update engine</td>
                </tr>
                <tr>
                  <td><span class="badge badge-pass">v1.3.0</span></td>
                  <td style="white-space:nowrap;font-size:11px">Apr 2026</td>
                  <td style="font-size:11px">IFC Property Editor (fix missing property values directly in VERIFIQ, saves corrected IFC file),
                    Director's Report (Check All Singapore button, agency risk table, top blockers, action plan, effort estimate, gateway readiness),
                    Comprehensive User Guide (14 sections in-app), em dash fixes throughout, updated capabilities to show 89 SG + 60 MY rules,
                    new ICO icon (navy/teal VQ, all sizes), OBJ/FBX/STL/STEP format handlers added,
                    expanded IFC+SG classification pattern matching for real Industry Mapping codes</td>
                </tr>
                <tr>
                  <td><span class="badge badge-pass">v1.3.0</span></td>
                  <td style="white-space:nowrap;font-size:11px">Apr 2026</td>
                  <td style="font-size:11px">3D Viewer (Three.js + C# geometry, dual-engine with web-ifc + C# fallback),
                    89 Singapore rules across all 10 agencies (BCA/URA/SCDF/LTA/NEA/PUB/NParks/SLA/HDB/JTC),
                    health score A-F grade, live validation progress bar,
                    agency bar chart, Top 5 Quick Fixes, file add/remove/view,
                    Rules Database 4-tab browser, 20 check levels reference</td>
                </tr>
                <tr>
                  <td><span class="badge badge-info">v1.1.0</span></td>
                  <td style="white-space:nowrap;font-size:11px">Mar 2026</td>
                  <td style="font-size:11px">KnowledgeLibrary (BCA/URA/SCDF/Green Mark 2021/UBBL 1984/MS 1184:2014),
                    120+ keyword auto-classifier for proxy elements,
                    element-specific remediation guidance, 8 export templates,
                    distinct All Results / Critical Issues pages, file management</td>
                </tr>
                <tr>
                  <td><span class="badge" style="background:#1a3354;color:#9ab8d4">v1.0.0</span></td>
                  <td style="white-space:nowrap;font-size:11px">Jan 2026</td>
                  <td style="font-size:11px">Initial release - Singapore IFC+SG 2025 (COP3),
                    Malaysia NBeS/UBBL 1984 (CIDB 2024), 20 data check levels,
                    50+ design code rules, 1,001 licence keys, all export formats</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card" style="background:var(--light-bg)">
          <p style="font-size:11px;color:var(--light-grey);text-align:center;line-height:1.8">
            VERIFIQ is developed and published by BBMW0 Technologies for the Singapore and Malaysia AEC industry.<br>
            The software is provided under a commercial licence agreement. Unauthorised reproduction, redistribution or reverse engineering is prohibited.<br>
            &copy; 2026 BBMW0 Technologies. All rights reserved. &nbsp;|&nbsp; bbmw0.com &nbsp;|&nbsp; bbmw0@hotmail.com
          </p>
        </div>
      </div>`;
  }

  return { render };
})();

window.AboutPage = AboutPage;


// Note: Viewer3DPage is implemented in js/ui/viewer3d.js
