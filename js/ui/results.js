// VERIFIQ v2.0 - Professional Results Page
// Copyright 2026 BBMW0 Technologies. All rights reserved.
'use strict';

const ResultsPage = (() => {

  const PLATFORM_CONTEXT = {
    'IfcWall':     { revit:'Walls category',      archicad:'Wall tool → Classification Manager assigns IFC entity. Slab/Column with Wall classification exports as IfcWall.',  tekla:'Concrete Panel / Panel', bentley:'Wall' },
    'IfcBeam':     { revit:'Structural Framing',   archicad:'Beam tool → BeamSpanType mandatory. RC: reinforcement. Steel: MemberSection.',  tekla:'Beam / Concrete Beam', bentley:'Beam' },
    'IfcColumn':   { revit:'Structural Columns',   archicad:'Column tool → StartingStorey + EndStorey required.',  tekla:'Concrete Column', bentley:'Column' },
    'IfcSlab':     { revit:'Floors',               archicad:'Slab tool → SlabType mandatory (One way / Two way / Flat slab etc.).',  tekla:'Concrete Slab', bentley:'Slab' },
    'IfcPile':     { revit:'Structural Foundations', archicad:'Object → DA1-1 and DA1-2 capacity/load mandatory. SHD levels required.',  tekla:'Concrete Column (as pile)', bentley:'Base Plate' },
    'IfcFooting':  { revit:'Structural Foundations', archicad:'Footing tool → ConstructionMethod + MaterialGrade.',  tekla:'Concrete Footing', bentley:'Footing' },
    'IfcDoor':     { revit:'Doors',                archicad:'Door tool → ClearWidth ≥850mm for BCA main entrance. FireRating for SCDF.',  tekla:'N/A', bentley:'Door' },
    'IfcWindow':   { revit:'Windows',              archicad:'Window tool → PercentageOfOpening for NEA ventilation.',  tekla:'N/A', bentley:'Window' },
    'IfcSpace':    { revit:'Rooms / Areas',        archicad:'Zone tool → SpaceName from 420-value list. OccupancyType from 95-value list.',  tekla:'N/A', bentley:'Space' },
    'IfcStair':    { revit:'Stairs',               archicad:'Stair tool → FireExit for SCDF. ConstructionMethod + MaterialGrade.',  tekla:'Component', bentley:'Stair' },
    'IfcRoof':     { revit:'Roofs',                archicad:'Roof tool or Slab with roof classification.',  tekla:'Slab', bentley:'Roof' },
    'IfcCovering': { revit:'Ceilings (CEILING) / Roofs (SOFFIT)', archicad:'Ceiling tool → FireRating in hours (0.5-4).',  tekla:'N/A', bentley:'Slab' },
    'IfcCurtainWall': { revit:'Curtain Systems',  archicad:'Curtain Wall tool → No IFC+SG properties required (COP3.1).',  tekla:'N/A', bentley:'Curtain Wall' },
    'IfcRailing':  { revit:'Railings',             archicad:'Railing tool.',  tekla:'Component', bentley:'Railing' },
    'IfcTransportElement': { revit:'Specialty Equipment / Parking', archicad:'Object / Transport Element → LIFT: BarrierFreeAccessibility + clear dimensions.',  tekla:'N/A', bentley:'Equipment' },
    'IfcPipeSegment': { revit:'Pipes',             archicad:'Pipe from MEP Modeler → InnerDiameter + Gradient + SystemType.',  tekla:'N/A', bentley:'Pipe Accessory' },
    'IfcDuctSegment': { revit:'Ducts',             archicad:'Duct from MEP Modeler → SystemType required.',  tekla:'N/A', bentley:'Duct Accessory' },
    'IfcValve':    { revit:'Pipe Accessories',     archicad:'Pipe In-line Flow Device → SystemType + SystemName.',  tekla:'N/A', bentley:'Valve' },
    'IfcSanitaryTerminal': { revit:'Plumbing Fixtures', archicad:'Pipe Flow Terminal → WaterUsagePerMonth in m3/month.',  tekla:'N/A', bentley:'Fixture' },
    'IfcFireSuppressionTerminal': { revit:'Plumbing Fixtures', archicad:'Pipe Flow Terminal → Part of fire suppression system.',  tekla:'N/A', bentley:'Fire Protection' },
    'IfcAlarm':    { revit:'Fire Alarm Devices',   archicad:'Object → Fire system component.',  tekla:'N/A', bentley:'Solid' },
    'IfcDistributionChamberElement': { revit:'Plumbing Fixtures / Generic Models', archicad:'Flow Equipment → InvertLevel and TopLevel in SHD.',  tekla:'N/A', bentley:'Equipment' },
    'IfcGeographicElement': { revit:'Planting',    archicad:'Object → Species, Girth, Height, Status for NParks.',  tekla:'N/A', bentley:'Object' },
    'IfcBuildingElementProxy': {
      revit:    'Generic Models or Specialty Equipment category. For parking: Parking category.',
      archicad: 'Object tool. Classification code sets IfcObjectType (e.g. CARLOT, SITECOVERAGE). Assign correct IFC+SG classification in Classification Manager.',
      tekla:    'N/A - not applicable for structural modelling in Tekla.',
      bentley:  'Object. Assign correct element type through Properties.'
    },
    'IfcCivilElement': { revit:'Generic Models',   archicad:'Object → SystemType: Rainwater, Drainage.',  tekla:'Slab/Panel', bentley:'Drains & Basins' },
    'IfcTank':     { revit:'Mechanical Equipment', archicad:'Object → IsPotable mandatory for domestic water tanks.',  tekla:'N/A', bentley:'Object' },
    'IfcInterceptor': { revit:'Plumbing Fixtures', archicad:'Flow Equipment → SystemType required.',  tekla:'N/A', bentley:'Equipment' },
    'IfcFlowMeter': { revit:'Pipe Accessories',    archicad:'Pipe In-line Flow Device → WaterUsagePerMonth in m3/month.',  tekla:'N/A', bentley:'Pipe Accessory' },
    'IfcWasteTerminal': { revit:'Pipe Accessories', archicad:'Pipe Flow Terminal → TradeEffluent for NEA.',  tekla:'N/A', bentley:'Fixture' },
    'IfcPump':     { revit:'Mechanical Equipment', archicad:'Flow Equipment → Capacity in L/s.',  tekla:'N/A', bentley:'Pump' },
    'IfcDamper':   { revit:'Duct Accessories',     archicad:'Object → FireRating in hours.',  tekla:'N/A', bentley:'Object' },
    'IfcSensor':   { revit:'Mechanical Equipment', archicad:'Object → SystemType.',  tekla:'N/A', bentley:'Object' },
    'IfcLightFixture': { revit:'Lighting Fixtures', archicad:'Object / Lighting.',  tekla:'N/A', bentley:'Object' },
    'IfcBuildingStorey': { revit:'Levels',         archicad:'Storey → SVY21 z-value for georeferencing.',  tekla:'N/A', bentley:'Floor' },
    'IfcSite':     { revit:'Project Information',  archicad:'IFC Project Manager → Block name, SVY21 coordinates.',  tekla:'N/A', bentley:'Floor Manager' },
    'IfcBuilding': { revit:'Project Information',  archicad:'IFC Project Manager → Building properties.',  tekla:'N/A', bentley:'Floor Manager' },
  };

  const DISC_MAP = {
    MEP: ['IfcPipeSegment','IfcPipeFitting','IfcDuctSegment','IfcDuctFitting','IfcValve','IfcPump','IfcTank','IfcSanitaryTerminal','IfcWasteTerminal','IfcFlowMeter','IfcFireSuppressionTerminal','IfcAlarm','IfcSensor','IfcDamper','IfcAirTerminal','IfcLightFixture','IfcSwitchingDevice','IfcOutlet','IfcUnitaryEquipment','IfcUnitaryControlElement','IfcInterceptor','IfcDistributionChamberElement'],
    STR: ['IfcColumn','IfcBeam','IfcSlab','IfcFooting','IfcPile','IfcStairFlight','IfcRailing'],
    EXT: ['IfcGeographicElement'],
    CIV: ['IfcCivilElement'],
  };

  function disc(ifcType) {
    if (!ifcType) return 'ARC';
    for (const [d, arr] of Object.entries(DISC_MAP))
      if (arr.some(e => ifcType.toUpperCase().includes(e.toUpperCase()))) return d;
    return 'ARC';
  }

  const DISC_STYLE = {
    ARC: 'background:#1e3a5f;color:#60A5FA;',
    STR: 'background:#2d1a00;color:#fb923c;',
    MEP: 'background:#0a2e1a;color:#22C55E;',
    EXT: 'background:#1e1040;color:#A78BFA;',
    CIV: 'background:#2d2000;color:#FBBF24;',
  };

  function getIfcEntity(f)  { return (f.cls||'').split('|')[0]||''; }
  function getSubType(f)    { return (f.cls||'').split('|')[2]||''; }
  function getClsCode(f)    { return (f.cls||'').split('|')[1]||''; }

  let _filters = { sev:'', disc:'', ifc:'', agency:'', storey:'', gw:'', check:'', search:'' };

  function _filtered(all) {
    return all.filter(f => {
      const e = getIfcEntity(f), d = disc(e);
      if (_filters._blockerOnly && submissionImpact(f) !== 'blocks') return false;
      if (_filters.sev    && f.severity !== _filters.sev)    return false;
      if (_filters.disc   && d          !== _filters.disc)   return false;
      if (_filters.ifc    && e          !== _filters.ifc)    return false;
      if (_filters.agency && f.agency   !== _filters.agency) return false;
      if (_filters.storey && f.storey   !== _filters.storey) return false;
      if (_filters.gw     && f.gateway  !== _filters.gw)     return false;
      if (_filters.check  && f.check    !== _filters.check)  return false;
      if (_filters.search) {
        const q = _filters.search.toLowerCase();
        if (![f.guid,f.name,f.cls,f.check,f.message,f.pset,f.prop,f.fix,f.agency,f.storey]
              .join(' ').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  // ── SUBMISSION IMPACT ────────────────────────────────────────────────────────
  // Determines whether a finding will block CORENET-X / NBeS submission
  function submissionImpact(f) {
    const sev = f.severity;
    if (sev === 'Pass' || sev === 'NoCheck') return 'pass';
    if (sev === 'Warning') return 'advisory';
    return 'blocks'; // Critical or Error
  }

  const IMPACT_CFG = {
    blocks:   { label:'⛔ Blocks', bg:'rgba(239,68,68,0.15)',   border:'#ef4444', color:'#f87171', title:'This finding will cause CORENET-X / NBeS to reject the submission' },
    advisory: { label:'⚠ Advisory', bg:'rgba(234,179,8,0.12)', border:'#d97706', color:'#fbbf24', title:'Fix recommended - submission may still proceed but QP must accept risk' },
    pass:     { label:'✅ Pass',     bg:'rgba(34,197,94,0.08)',  border:'#22c55e', color:'#4ade80', title:'Compliant - no action required' },
  };

  function _submissionBanner(raw) {
    const blocking  = raw.filter(f => submissionImpact(f) === 'blocks').length;
    const advisory  = raw.filter(f => submissionImpact(f) === 'advisory').length;
    if (!blocking && !advisory) return '';
    const bg    = blocking ? 'rgba(239,68,68,0.10)' : 'rgba(234,179,8,0.08)';
    const border = blocking ? '#ef4444' : '#d97706';
    const icon  = blocking ? '⛔' : '⚠';
    const msg   = blocking
      ? `<strong style="color:#f87171">${blocking} finding${blocking!==1?'s':''} will block CORENET-X submission</strong>${advisory?` · ${advisory} advisory`:''} - fix Critical and Error items first`
      : `<strong style="color:#fbbf24">${advisory} advisory finding${advisory!==1?'s':''}</strong> - submission may proceed but QP review recommended`;
    return `<div style="padding:8px 16px;background:${bg};border-left:4px solid ${border};font-size:12px;flex-shrink:0;display:flex;align-items:center;gap:10px">
      <span style="font-size:16px">${icon}</span>
      <span style="color:#e2e8f0">${msg}</span>
      ${blocking ? `<button onclick="ResultsPage.filterBlockers()" style="margin-left:auto;padding:2px 10px;font-size:11px;border:1px solid #ef4444;border-radius:4px;background:rgba(239,68,68,.15);color:#f87171;cursor:pointer;white-space:nowrap">Show blockers only</button>` : ''}
    </div>`;
  }

  // ── SEVERITY CONFIG ──────────────────────────────────────────────────────────
  // Softer row tints with good contrast ratios
  const SEV = {
    Critical:{ bg:'rgba(239,68,68,0.08)',  border:'#ef4444', text:'#f87171', badge:'#ef4444', badgeTxt:'#fff' },
    Error:   { bg:'rgba(249,115,22,0.07)', border:'#fb923c', text:'#fb923c', badge:'#fb923c', badgeTxt:'#fff' },
    Warning: { bg:'rgba(234,179,8,0.07)',  border:'#d97706', text:'#fbbf24', badge:'#d97706', badgeTxt:'#000' },
    Pass:    { bg:'rgba(34,197,94,0.06)',  border:'#22c55e', text:'#4ade80', badge:'#22c55e', badgeTxt:'#fff' },
    NoCheck: { bg:'rgba(107,114,128,0.05)',border:'#374151', text:'#9ca3af', badge:'#4b5563', badgeTxt:'#fff' },
  };
  function sevCfg(s) { return SEV[s] || SEV.NoCheck; }

  // ── MAIN RENDER ──────────────────────────────────────────────────────────────
  function render(filterFn) {
    const state = VState.get();
    const sess  = state.session;
    const isCrit = filterFn !== undefined;

    if (!sess?.findings) return _renderEmpty(isCrit);

    const raw  = filterFn ? sess.findings.filter(filterFn) : sess.findings;
    const shown = _filtered(raw);

    // Build unique option sets
    const opts = {
      ifc:    [...new Set(raw.map(getIfcEntity).filter(Boolean))].sort(),
      agency: [...new Set(raw.map(f=>f.agency).filter(a=>a&&a!=='None'))].sort(),
      storey: [...new Set(raw.map(f=>f.storey).filter(Boolean))].sort(),
      check:  [...new Set(raw.map(f=>f.check).filter(Boolean))].sort(),
    };

    // Summary counts
    const counts = raw.reduce((a,f)=>{ a[f.severity]=(a[f.severity]||0)+1; return a; },{});

    return `
<div style="height:100%;display:flex;flex-direction:column;overflow:hidden">

  <!-- ── SUBMISSION READINESS BANNER ── -->
  ${_submissionBanner(raw)}

  <!-- ── PAGE HEADER ── -->
  <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px 8px;border-bottom:1px solid var(--border);flex-shrink:0">
    <div style="display:flex;align-items:center;gap:12px">
      <h1 style="margin:0;font-size:15px;font-weight:700">${isCrit?'Critical Issues':'All Compliance Findings'}</h1>
      <span style="background:#1a2840;border:1px solid var(--border);border-radius:100px;padding:2px 10px;font-size:12px;font-weight:600;color:var(--teal)">${shown.length} <span style="color:var(--mid-grey);font-weight:400">/ ${raw.length}</span></span>
      <!-- Severity pill summary -->
      ${Object.entries(counts).map(([s,n])=>{
        const c=sevCfg(s);
        return `<span style="background:${c.bg};border:1px solid ${c.border};border-radius:100px;padding:2px 8px;font-size:11px;font-weight:700;color:${c.badge}">${s[0]} ${n}</span>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:6px">
      <button class="btn btn-ghost" style="height:28px;padding:0 10px;font-size:12px" onclick="ResultsPage.togglePlatform()" id="plat-toggle">🔧 Platform</button>
      <button class="btn btn-ghost" style="height:28px;padding:0 10px;font-size:12px" onclick="ResultsPage.toggleGrouped()" id="group-toggle">⊞ Group</button>
      <button class="btn btn-outline" style="height:28px;padding:0 10px;font-size:12px" onclick="VBridge.send('export',{})">📤 Export</button>
    </div>
  </div>

  <!-- ── COMPACT FILTER ROW ── -->
  <div style="display:flex;align-items:center;gap:6px;padding:7px 16px;background:#06111f;border-bottom:1px solid #162843;flex-shrink:0;flex-wrap:wrap">
    ${_sel('sev-f','Severity',['Critical','Error','Warning','Pass'],'ResultsPage.af()')}
    ${_sel('disc-f','Discipline',['ARC','STR','MEP','EXT','CIV'],'ResultsPage.af()')}
    ${_sel('ifc-f','IFC Entity',opts.ifc,'ResultsPage.af()')}
    ${_sel('agency-f','Agency',opts.agency,'ResultsPage.af()')}
    ${_sel('storey-f','Storey',opts.storey,'ResultsPage.af()')}
    ${_sel('gw-f','Gateway',['G1 Design','G1.5 Piling','G2 Construction','G3 Completion'],'ResultsPage.af()')}
    ${_sel('check-f','Check Type',opts.check.slice(0,30),'ResultsPage.af()')}
    <input id="srch-f" type="text" placeholder="🔍 Search…" oninput="ResultsPage.as()"
      style="height:26px;padding:0 8px;font-size:12px;border:1px solid #162843;border-radius:5px;background:#0a1628;color:#e2e8f0;min-width:160px;flex:1">
    <button onclick="ResultsPage.cf()" style="height:26px;padding:0 8px;font-size:11px;border:1px solid var(--border);border-radius:5px;background:transparent;color:var(--mid-grey);cursor:pointer;white-space:nowrap">✕ Clear</button>
  </div>

  <!-- ── PLATFORM PANEL (hidden by default) ── -->
  <div id="plat-panel" style="display:none;padding:10px 16px;background:#071525;border-bottom:1px solid var(--border);font-size:12px;flex-shrink:0">
    <div id="plat-content" style="color:var(--mid-grey)">
      Click the 🔧 button on any row to see how to fix that element in Revit, ArchiCAD, Tekla, and Bentley.
    </div>
  </div>

  <!-- ── RESULTS TABLE ── -->
  <div style="flex:1;overflow-y:auto;overflow-x:auto">
    <table id="results-table" style="width:100%;border-collapse:collapse;font-size:12px;min-width:2080px">
      <thead style="position:sticky;top:0;z-index:10;background:#0a1628">
        <tr style="border-bottom:2px solid var(--border)">
          <th style="${TH}width:80px">Severity</th>
          <th style="${TH}width:96px">Impact</th>
          <th style="${TH}width:160px">Check</th>
          <th style="${TH}width:80px">Disc.</th>
          <th style="${TH}min-width:140px">IFC Entity</th>
          <th style="${TH}min-width:100px">IFC SubType</th>
          <th style="${TH}min-width:140px">Classification</th>
          <th style="${TH}min-width:210px">Element Name</th>
          <th style="${TH}width:90px">GUID</th>
          <th style="${TH}width:80px">Storey</th>
          <th style="${TH}width:60px">Agency</th>
          <th style="${TH}min-width:210px">Property Set → Property</th>
          <th style="${TH}min-width:300px">Finding Detail</th>
          <th style="${TH}min-width:180px">How to Fix</th>
          <th style="${TH}width:70px">Actions</th>
        </tr>
      </thead>
      <tbody id="rtbody">
        ${_rows(shown)}
      </tbody>
    </table>
    ${shown.length===0?`<div style="text-align:center;padding:48px;color:var(--mid-grey)"><div style="font-size:28px;margin-bottom:10px">🔍</div><div style="font-weight:600">No findings match filters</div><button class="btn btn-ghost" style="margin-top:12px" onclick="ResultsPage.cf()">Clear all filters</button></div>`:''}
  </div>
</div>`;
  }

  const TH = 'padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#5b7fa6;white-space:nowrap;border-right:1px solid #0f1e30;';

  function _sel(id, label, opts, onchange) {
    return `<select id="${id}" onchange="${onchange}"
      style="height:26px;padding:0 6px;font-size:11px;border:1px solid #2d4a6e;border-radius:5px;background:#0a1628;color:#e2e8f0;max-width:130px">
      <option value="">All ${label}s</option>
      ${opts.map(o=>`<option>${VUtils.esc(o)}</option>`).join('')}
    </select>`;
  }

  function _rows(findings) {
    _shownFindings = findings;
    return findings.map((f, i) => {
      const e   = getIfcEntity(f);
      const sub = getSubType(f);
      const cls = getClsCode(f);
      const d   = disc(e);
      const s   = sevCfg(f.severity);
      const ds  = DISC_STYLE[d]||DISC_STYLE.ARC;
      const hasFix = f.pset && f.prop && f.severity !== 'Pass';
      const fp = hasFix ? JSON.stringify({stepId:f.stepId||0,pset:f.pset,prop:f.prop,guid:f.guid,message:f.message,fix:f.fix,severity:f.severity}).replace(/"/g,'&quot;') : '';

      const imp = submissionImpact(f);
      const ic  = IMPACT_CFG[imp];
      return `<tr style="background:${s.bg};border-bottom:1px solid #0f1e30;transition:background .15s;cursor:pointer" onclick="ResultsPage.rowClick(event,${i})" title="Click for full detail and actual property values" onmouseenter="this.style.filter='brightness(1.15)'" onmouseleave="this.style.filter=''">
        <td style="padding:8px 10px;border-right:1px solid #0f1e30;vertical-align:top;white-space:nowrap">
          <span style="display:inline-block;padding:2px 8px;border-radius:100px;font-size:10px;font-weight:700;background:${s.badge};color:${s.badgeTxt}">${VUtils.esc(f.severity)}</span>
        </td>
        <td style="padding:6px 8px;border-right:1px solid #0f1e30;vertical-align:top;white-space:nowrap" title="${ic.title}">
          <span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;background:${ic.bg};border:1px solid ${ic.border};color:${ic.color}">${ic.label}</span>
        </td>
        <td style="padding:8px 10px;border-right:1px solid #0f1e30;vertical-align:top;font-size:11px;color:#8aaac8;line-height:1.4">${VUtils.esc(f.check)}</td>
        <td style="padding:8px 10px;border-right:1px solid #0f1e30;vertical-align:top">
          <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;${ds}">${d}</span>
        </td>
        <td style="padding:8px 10px;border-right:1px solid #0f1e30;vertical-align:top">
          ${e?`<code style="font-size:11px;background:rgba(0,196,160,.12);color:#00c4a0;padding:2px 6px;border-radius:4px;display:inline-block">${VUtils.esc(e)}</code>`:'<span style="color:#374151">-</span>'}
        </td>
        <td style="padding:8px 10px;border-right:1px solid #0f1e30;vertical-align:top">
          ${sub?`<code style="font-size:10px;background:rgba(96,165,250,.1);color:#60A5FA;padding:2px 6px;border-radius:4px;display:inline-block">${VUtils.esc(sub)}</code>`:'<span style="color:#374151;font-size:10px">N.A.</span>'}
        </td>
        <td style="padding:8px 10px;border-right:1px solid #0f1e30;vertical-align:top">
          ${cls?`<code style="font-size:10px;background:rgba(167,139,250,.1);color:#A78BFA;padding:2px 6px;border-radius:4px;display:inline-block">${VUtils.esc(cls)}</code>`:'<span style="color:#374151;font-size:10px"> - </span>'}
        </td>
        <td style="padding:8px 10px;border-right:1px solid #0f1e30;vertical-align:top;max-width:180px">
          <div style="font-weight:600;color:#e2e8f0;font-size:12px;word-break:break-word;line-height:1.4">${VUtils.esc(f.name||'')}</div>
        </td>
        <td style="padding:8px 10px;border-right:1px solid #0f1e30;vertical-align:top" title="IFC Global Id: ${VUtils.esc(f.guid||'(none)')}. Click the row for the full value and a copy button.">
          <code style="font-size:10px;color:#6b8bb0">${VUtils.shortGuid(f.guid)}</code>
        </td>
        <td style="padding:8px 10px;border-right:1px solid #0f1e30;vertical-align:top;font-size:11px;color:#5b7fa6;white-space:nowrap">${VUtils.esc(f.storey||' - ')}</td>
        <td style="padding:8px 10px;border-right:1px solid #0f1e30;vertical-align:top">${VUtils.agencyBadge(f.agency)}</td>
        <td style="padding:8px 10px;border-right:1px solid #0f1e30;vertical-align:top;min-width:160px">
          ${f.pset?`
            <div style="font-family:monospace;font-size:10px;color:#00c4a0;font-weight:600;word-break:break-all">${VUtils.esc(f.pset)}</div>
            <div style="font-family:monospace;font-size:10px;color:#8aaac8;margin-top:2px">\u21B3 ${VUtils.esc(f.prop||'')}</div>
            ${f.expected?`<div style="font-size:9px;color:#374151;margin-top:3px">Expected: <span style="color:#d97706">${VUtils.esc(f.expected)}</span></div>`:''}
            ${f.actual&&f.actual!==f.expected?`<div style="font-size:9px;color:#374151">Actual: <span style="color:#f87171">${VUtils.esc(String(f.actual||''))}</span></div>`:''}
          `:'<span style="color:#374151;font-size:11px">-</span>'}
        </td>
        <td style="padding:8px 10px;border-right:1px solid #0f1e30;vertical-align:top;min-width:240px">
          <div style="color:${s.text};font-size:12px;line-height:1.5">${VUtils.esc(f.message||'')}</div>
          ${f.ruleRef?`<div style="font-size:10px;color:#374151;margin-top:3px;font-family:monospace">${VUtils.esc(f.ruleRef)}</div>`:''}
        </td>
        <td style="padding:8px 10px;border-right:1px solid #0f1e30;vertical-align:top;min-width:180px">
          <div style="color:#22c55e;font-size:11px;line-height:1.5">${VUtils.esc(f.fix||'')}</div>
        </td>
        <td style="padding:8px 10px;vertical-align:top">
          <div style="display:flex;flex-direction:column;gap:4px">
            ${hasFix?`<button class="btn btn-ghost" style="font-size:10px;padding:2px 6px;color:var(--teal);border-color:var(--teal);white-space:nowrap"
              onclick="event.stopPropagation();ResultsPage.fixFinding(${i})">✏️ Fix</button>`:''}
            ${e?`<button style="font-size:10px;padding:2px 6px;border:1px solid #1d3354;border-radius:4px;background:transparent;color:#5b7fa6;cursor:pointer;white-space:nowrap"
              onclick="event.stopPropagation();ResultsPage.showPlatform('${VUtils.esc(e)}')">🔧 Guide</button>`:''}
            <button style="font-size:10px;padding:2px 6px;border:1px solid #1d3354;border-radius:4px;background:transparent;color:#5b7fa6;cursor:pointer;white-space:nowrap"
              onclick="event.stopPropagation();ResultsPage.goto3D('${VUtils.esc(f.guid||'')}')">🧊 3D</button>
            <button style="font-size:10px;padding:2px 6px;border:1px solid #1d3354;border-radius:4px;background:transparent;color:#5b7fa6;cursor:pointer;white-space:nowrap"
              onclick="event.stopPropagation();ResultsPage.copFinding(${i})">📖 COP</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  function _renderEmpty(isCrit) {
    return `<div style="padding:16px">
      <h1>${isCrit?'Critical Issues':'All Compliance Findings'}</h1>
      <p style="color:var(--mid-grey);font-size:13px;margin-bottom:16px">
        ${isCrit?'Critical and Error findings causing CORENET-X or NBeS submission rejection.':'All findings across 20 IFC data levels, 206 classification codes (COP3.1), 192 SG rules, 52 MY rules.'}
      </p>
      ${VUtils.emptyState('📋','No results yet','Run validation on a loaded IFC file.',
        '<button class="btn btn-primary" style="margin-top:16px" onclick="VBridge.openFile()">📂 Open IFC File</button>')}
    </div>`;
  }

  // ── PLATFORM PANEL ───────────────────────────────────────────────────────────
  let _platVisible = false;
  function togglePlatform() {
    _platVisible = !_platVisible;
    const p = document.getElementById('plat-panel');
    const b = document.getElementById('plat-toggle');
    if (p) p.style.display = _platVisible ? 'block' : 'none';
    if (b) b.style.background = _platVisible ? 'var(--teal)' : '';
    if (b) b.style.color = _platVisible ? 'var(--navy)' : '';
  }

  function showPlatform(ifcEntity) {
    const ctx = PLATFORM_CONTEXT[ifcEntity];
    const panel = document.getElementById('plat-panel');
    const content = document.getElementById('plat-content');
    if (!panel || !content) return;

    if (!ctx) {
      content.innerHTML = `<b>${VUtils.esc(ifcEntity)}</b>: No platform guidance available. Check <a href="#" style="color:var(--teal)" onclick="VBridge.send('openUrl',{url:'https://go.gov.sg/ifcsg'})">go.gov.sg/ifcsg</a> for IFC+SG configuration files.`;
    } else {
      content.innerHTML = `
        <div style="font-weight:700;color:var(--white);margin-bottom:8px;font-size:13px">${VUtils.esc(ifcEntity)}  -  Fix Guidance per BIM Platform</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:8px">
          ${[['Revit','#3b82f6',ctx.revit],['ArchiCAD','#00c4a0',ctx.archicad],['Tekla','#fb923c',ctx.tekla],['Bentley','#a78bfa',ctx.bentley]].map(([name,col,val])=>`
          <div style="background:rgba(0,0,0,.3);border:1px solid ${col}44;border-radius:6px;padding:8px">
            <div style="font-size:10px;font-weight:700;color:${col};margin-bottom:4px;text-transform:uppercase">${name}</div>
            <div style="font-size:11px;color:#cbd5e1;line-height:1.5">${VUtils.esc(val)}</div>
          </div>`).join('')}
        </div>
        <div style="font-size:11px;color:#9ab8d4">
          📖 Resource Kit: <a href="#" style="color:var(--teal)" onclick="VBridge.send('openUrl',{url:'https://go.gov.sg/ifcsg'})">go.gov.sg/ifcsg</a> &nbsp;|&nbsp;
          COP3.1: <a href="#" style="color:var(--teal)" onclick="VBridge.send('openUrl',{url:'https://go.gov.sg/cxcop'})">go.gov.sg/cxcop</a>
        </div>`;
    }
    if (!_platVisible) togglePlatform();
  }

  // ── GROUPED VIEW ─────────────────────────────────────────────────────────────
  let _grouped = false;
  function toggleGrouped() {
    _grouped = !_grouped;
    const b = document.getElementById('group-toggle');
    if (b) { b.style.background = _grouped ? 'var(--teal)' : ''; b.style.color = _grouped ? 'var(--navy)' : ''; }
    _rerender();
  }

  // ── FILTER CONTROLS ──────────────────────────────────────────────────────────
  function af() {
    _filters.sev    = document.getElementById('sev-f')?.value||'';
    _filters.disc   = document.getElementById('disc-f')?.value||'';
    _filters.ifc    = document.getElementById('ifc-f')?.value||'';
    _filters.agency = document.getElementById('agency-f')?.value||'';
    _filters.storey = document.getElementById('storey-f')?.value||'';
    _filters.gw     = document.getElementById('gw-f')?.value||'';
    _filters.check  = document.getElementById('check-f')?.value||'';
    _rerender();
  }

  function as() {
    _filters.search = document.getElementById('srch-f')?.value||'';
    _rerender();
  }

  function cf() {
    _filters = { sev:'', disc:'', ifc:'', agency:'', storey:'', gw:'', check:'', search:'' };
    ['sev-f','disc-f','ifc-f','agency-f','storey-f','gw-f','check-f','srch-f']
      .forEach(id => { const e=document.getElementById(id); if(e) e.value=''; });
    _rerender();
  }

  function _rerender() {
    const tbody = document.getElementById('rtbody');
    if (!tbody) return;
    const state = VState.get();
    const sess  = state.session;
    if (!sess?.findings) return;
    const shown = _filtered(sess.findings);
    tbody.innerHTML = _rows(shown);
    // update count badge
    const badge = document.querySelector('#results-table')?.closest('[style*="flex-direction:column"]')?.querySelector('[style*="border-radius:100px"]');
  }

  function filterBlockers() {
    _filters.sev = '';
    const sevEl = document.getElementById('sev-f');
    if (sevEl) sevEl.value = '';
    // Override filter to show Critical + Error only via custom impact filter
    _filters._blockerOnly = true;
    _rerender();
    _filters._blockerOnly = false;
  }

  function goto3D(guid) {
    VState.set({ filterGuid: guid });
    App.navigate('3d');
  }

  function applyFilters()       { af(); }
  function applySearch()        { as(); }
  function clearFilters()       { cf(); }
  function applyDesignFilters() { af(); }
  function clearDesignFilters() { cf(); }

  function renderCritical() {
    return render(f => f.severity === 'Critical' || f.severity === 'Error');
  }

  function renderDesignCode() {
    const state   = VState.get();
    const session = state.session;
    const ds      = session?.designStats;

    if (!session) return `<div>
      <h1>Design Code Compliance</h1>
      ${VUtils.emptyState('📐','No results yet','Run validation to check design code compliance.',
        '<button class="btn btn-teal" style="margin-top:14px" onclick="VBridge.runValidation()">▶ Run Validation</button>')}
    </div>`;

    if (!ds) return `<div>
      <h1>Design Code Compliance</h1>
      <div class="card" style="padding:20px">
        <div style="font-size:13px;color:var(--mid-grey);text-align:center;padding:20px">
          <div style="font-size:28px;margin-bottom:10px">📐</div>
          <div style="font-weight:700;color:var(--white);margin-bottom:6px">No Design Code Results</div>
          <p style="margin-bottom:16px">Design Code checks require a loaded IFC model with space and element geometry.<br>
          Ensure your model has IfcSpace elements with GrossPlannedArea properties populated.</p>
          <button class="btn btn-teal" onclick="VBridge.runValidation()">▶ Re-run Validation</button>
        </div>
      </div>
    </div>`;

    const mode   = state.countryMode || 'Singapore';
    const score  = ds.score || 0;
    const col    = score>=95?'#22c55e':score>=80?'#d97706':'#ef4444';
    const findings = session.designFindings || [];

    const catGroups = {};
    findings.forEach(f => {
      const cat = f.category || (f.ruleRef ? f.ruleRef.split('-').slice(0,3).join(' ') : 'Other');
      if (!catGroups[cat]) catGroups[cat] = [];
      catGroups[cat].push(f);
    });

    const findingRows = findings.slice(0,200).map(f => {
      const sev = f.severity || 'Pass';
      const sevCol = {Critical:'#ef4444',Error:'#fb923c',Warning:'#d97706',Pass:'#22c55e'}[sev]||'#6b7280';
      return `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:7px 10px">
          <span style="background:${sevCol}22;color:${sevCol};border:1px solid ${sevCol}44;border-radius:3px;padding:1px 7px;font-size:10px;font-weight:700">${VUtils.esc(sev)}</span>
        </td>
        <td style="padding:7px 10px;font-size:11px;font-weight:600;color:var(--teal)">${VUtils.esc(f.ruleRef||f.rule||'-')}</td>
        <td style="padding:7px 10px;font-size:11px">${VUtils.esc(f.category||'-')}</td>
        <td style="padding:7px 10px;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${VUtils.esc(f.name||'')}">
          ${VUtils.esc((f.name||'-').substring(0,40))}
        </td>
        <td style="padding:7px 10px;font-size:11px;color:var(--mid-grey)">${VUtils.esc(f.actual||'-')}</td>
        <td style="padding:7px 10px;font-size:11px;color:var(--teal)">${VUtils.esc(f.required||f.expected||'-')}</td>
        <td style="padding:7px 10px;font-size:11px;color:var(--mid-grey);max-width:250px">${VUtils.esc((f.message||'-').substring(0,80))}</td>
        <td style="padding:7px 10px;font-size:10px;color:#9ab8d4">${VUtils.esc(f.ruleRef||'-')}</td>
      </tr>`;
    }).join('');

    return `<div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <h1 style="margin:0">Design Code Compliance</h1>
        <div style="display:flex;gap:8px;align-items:center">
          <span style="font-size:22px;font-weight:900;color:${col}">${score.toFixed(1)}%</span>
          <span style="font-size:12px;color:var(--mid-grey)">design score</span>
          <button class="btn btn-ghost" style="font-size:11px" onclick="App.navigate('export')">📤 Export</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
        ${[
          ['Total Checks', ds.total||0, '#60a5fa'],
          ['Passed', ds.passed||0, '#22c55e'],
          ['Failed', ds.failed||0, '#fb923c'],
          ['Critical', ds.critical||0, '#ef4444'],
        ].map(([label,val,col2])=>`
          <div class="card" style="padding:14px;text-align:center">
            <div style="font-size:22px;font-weight:900;color:${col2}">${VUtils.fmt(val)}</div>
            <div style="font-size:11px;color:var(--mid-grey);margin-top:3px">${label}</div>
          </div>`).join('')}
      </div>

      ${Object.entries(catGroups).map(([cat, items]) => `
        <div class="card" style="margin-bottom:12px;overflow:hidden">
          <div style="padding:10px 16px;background:var(--navy-dark);display:flex;align-items:center;justify-content:space-between">
            <span style="font-weight:700;font-size:12px">${VUtils.esc(cat)}</span>
            <span style="font-size:11px;color:var(--mid-grey)">${items.length} check${items.length!==1?'s':''}</span>
          </div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse">
              <thead><tr style="background:#060d1b">
                <th style="padding:6px 10px;font-size:10px;color:var(--mid-grey);text-align:left">Sev</th>
                <th style="padding:6px 10px;font-size:10px;color:var(--mid-grey);text-align:left">Rule ID</th>
                <th style="padding:6px 10px;font-size:10px;color:var(--mid-grey);text-align:left">Category</th>
                <th style="padding:6px 10px;font-size:10px;color:var(--mid-grey);text-align:left">Element</th>
                <th style="padding:6px 10px;font-size:10px;color:var(--mid-grey);text-align:left">Actual</th>
                <th style="padding:6px 10px;font-size:10px;color:var(--mid-grey);text-align:left">Required</th>
                <th style="padding:6px 10px;font-size:10px;color:var(--mid-grey);text-align:left">Issue</th>
                <th style="padding:6px 10px;font-size:10px;color:var(--mid-grey);text-align:left">Regulation</th>
              </tr></thead>
              <tbody>
                ${items.slice(0,50).map(f => {
                  const sev2 = f.severity || 'Pass';
                  const sc2 = {Critical:'#ef4444',Error:'#fb923c',Warning:'#d97706',Pass:'#22c55e'}[sev2]||'#6b7280';
                  return `<tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:6px 10px"><span style="background:${sc2}22;color:${sc2};border:1px solid ${sc2}44;border-radius:3px;padding:1px 6px;font-size:10px;font-weight:700">${VUtils.esc(sev2)}</span></td>
                    <td style="padding:6px 10px;font-size:10px;color:var(--teal)">${VUtils.esc(f.ruleRef||'-')}</td>
                    <td style="padding:6px 10px;font-size:10px">${VUtils.esc(f.category||'-')}</td>
                    <td style="padding:6px 10px;font-size:11px">${VUtils.esc((f.name||'-').substring(0,30))}</td>
                    <td style="padding:6px 10px;font-size:11px;color:#fb923c">${VUtils.esc(f.actual||'-')}</td>
                    <td style="padding:6px 10px;font-size:11px;color:#22c55e">${VUtils.esc(f.required||f.expected||'-')}</td>
                    <td style="padding:6px 10px;font-size:11px;color:var(--mid-grey);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${VUtils.esc((f.message||'-').substring(0,60))}</td>
                    <td style="padding:6px 10px;font-size:10px;color:#9ab8d4">${VUtils.esc(f.ruleRef||'-')}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>`).join('')}

      ${findings.length===0 ? `<div class="card" style="padding:20px;text-align:center;color:var(--mid-grey)">
        <div style="font-size:28px;margin-bottom:8px">✓</div>
        <div style="font-weight:700;color:var(--white);margin-bottom:4px">All design code checks passed!</div>
        <p>No violations found against ${VUtils.esc(mode)} design code requirements.</p>
      </div>` : ''}
    </div>`;
  }

  // ── DETAIL DRAWER + PROPERTY INSPECTOR ───────────────────────────────────────
  // Clicking a row opens a right-side drawer with the full finding (untruncated)
  // and the element's ACTUAL property sets and values fetched from the host.
  // Built entirely with safe DOM construction (textContent), no innerHTML.
  let _shownFindings = [];
  let _detailGuid    = '';
  let _drawerOpen    = false;

  function _el(tag, css, text) {
    const n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  }

  // Open the Property Editor for a finding by row index. Index-based (not an inline
  // JSON blob) so apostrophes or quotes in the message/fix text cannot break the call.
  function fixFinding(idx) {
    const f = _shownFindings[idx];
    if (!f) return;
    if (window.PropertyEditor && PropertyEditor.addToQueue)
      PropertyEditor.addToQueue({ stepId: f.stepId || 0, pset: f.pset, prop: f.prop, guid: f.guid, message: f.message, fix: f.fix, severity: f.severity });
    App.navigate('propertyeditor');
  }

  function rowClick(ev, idx) {
    if (ev.target.closest('button') || ev.target.closest('a')) return;
    openDetail(idx);
  }

  function _drawerEl() {
    let d = document.getElementById('vq-detail-drawer');
    if (!d) {
      d = document.createElement('div');
      d.id = 'vq-detail-drawer';
      d.style.cssText = 'position:fixed;top:0;right:0;width:430px;max-width:92vw;height:100%;'
        + 'background:#0a1628;border-left:1px solid #1e3a5f;box-shadow:-8px 0 32px rgba(0,0,0,.55);'
        + 'z-index:9998;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .2s ease';
      document.body.appendChild(d);
      // Close on Escape, or on a click outside the drawer (but not on a results
      // row, which opens or switches the detail itself).
      document.addEventListener('keydown', function(ev) {
        if (ev.key === 'Escape' && _drawerOpen) closeDetail();
      });
      document.addEventListener('mousedown', function(ev) {
        if (!_drawerOpen || d.contains(ev.target)) return;
        if (ev.target.closest && ev.target.closest('#results-table')) return;
        closeDetail();
      });
    }
    return d;
  }

  function openDetail(idx) {
    const f = _shownFindings[idx];
    if (!f) return;
    _detailGuid = f.guid || '';
    _drawerOpen = true;
    const d = _drawerEl();
    while (d.firstChild) d.removeChild(d.firstChild);
    _buildDetail(d, f);
    requestAnimationFrame(() => { d.style.transform = 'translateX(0)'; });
    if (_detailGuid && window.VBridge && VBridge.getElementProperties) VBridge.getElementProperties(_detailGuid);
  }

  function closeDetail() {
    _drawerOpen = false;
    const d = document.getElementById('vq-detail-drawer');
    if (d) d.style.transform = 'translateX(100%)';
  }

  function _kv(label, value, mono) {
    if (value === undefined || value === null || value === '') return null;
    const row = _el('div', 'display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid #0f1e30');
    row.appendChild(_el('span', 'font-size:11px;color:#5b7fa6;flex-shrink:0', label));
    row.appendChild(_el('span', 'font-size:12px;color:#e2e8f0;text-align:right;word-break:break-word;' + (mono ? 'font-family:monospace' : ''), String(value)));
    return row;
  }

  function _label(text, note) {
    const w = _el('div', 'font-size:10px;font-weight:700;color:#5b7fa6;text-transform:uppercase;letter-spacing:.5px;margin:18px 0 6px', text);
    if (note) w.appendChild(_el('span', 'font-weight:400;color:#374151;text-transform:none', '  ' + note));
    return w;
  }

  function _actionBtn(label, onClick) {
    const b = _el('button', 'font-size:11px;padding:5px 10px;border:1px solid #1d3354;border-radius:5px;background:transparent;color:#5b7fa6;cursor:pointer', label);
    b.addEventListener('click', onClick);
    return b;
  }

  function _buildDetail(d, f) {
    const s = sevCfg(f.severity);
    const e = getIfcEntity(f), sub = getSubType(f), cls = getClsCode(f);

    // Header
    const hdr = _el('div', 'display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #1e3a5f;flex-shrink:0');
    const hleft = _el('div', 'display:flex;align-items:center;gap:8px;min-width:0');
    hleft.appendChild(_el('span', 'display:inline-block;padding:2px 9px;border-radius:100px;font-size:11px;font-weight:700;flex-shrink:0;background:' + s.badge + ';color:' + s.badgeTxt, f.severity));
    hleft.appendChild(_el('span', 'font-size:13px;font-weight:700;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', f.check || ''));
    hdr.appendChild(hleft);
    const x = _el('button', 'background:none;border:none;color:#5b7fa6;font-size:22px;cursor:pointer;line-height:1;flex-shrink:0;padding:0 0 0 10px', '×');
    x.addEventListener('click', closeDetail);
    hdr.appendChild(x);
    d.appendChild(hdr);

    // Scroll body
    const body = _el('div', 'flex:1;overflow-y:auto;padding:14px 16px');
    body.appendChild(_el('div', 'font-weight:700;color:#e2e8f0;font-size:14px;margin-bottom:2px;word-break:break-word', f.name || '(unnamed element)'));
    body.appendChild(_el('div', 'font-size:11px;color:#5b7fa6;margin-bottom:14px', (e || '') + (sub ? ' · ' + sub : '')));

    // GUID block
    const gb = _el('div', 'background:#0d1f35;border:1px solid #14283f;border-radius:6px;padding:10px;margin-bottom:14px');
    const gh = _el('div', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px');
    gh.appendChild(_el('span', 'font-size:10px;font-weight:700;color:#5b7fa6;text-transform:uppercase;letter-spacing:.5px', 'IFC Global Id (GUID)'));
    const cp = _el('button', 'font-size:10px;padding:2px 8px;border:1px solid #1d3354;border-radius:4px;background:transparent;color:#00c4a0;cursor:pointer', 'Copy');
    cp.addEventListener('click', () => copyText(f.guid || '', cp));
    gh.appendChild(cp);
    gb.appendChild(gh);
    gb.appendChild(_el('div', 'font-family:monospace;font-size:12px;color:#e2e8f0;word-break:break-all', f.guid || '(none)'));
    gb.appendChild(_el('div', 'font-size:10px;color:#374151;margin-top:5px;line-height:1.5', 'The unique identifier IFC assigns to every element (a 22-character Global Id). Use it to locate the exact element in your BIM tool or another IFC viewer.'));
    body.appendChild(gb);

    // Compliance finding
    body.appendChild(_el('div', 'font-size:10px;font-weight:700;color:#5b7fa6;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px', 'Compliance Finding'));
    const impact = IMPACT_CFG[submissionImpact(f)];
    [ _kv('Impact', impact ? impact.title : ''), _kv('Agency', (f.agency && f.agency !== 'None') ? f.agency : ''),
      _kv('Gateway', f.gateway), _kv('Storey', f.storey), _kv('Classification', cls),
      _kv('Property set', f.pset, true), _kv('Property', f.prop, true),
      _kv('Expected', f.expected), _kv('Actual', f.actual)
    ].forEach(r => { if (r) body.appendChild(r); });

    if (f.message) {
      body.appendChild(_el('div', 'font-size:10px;font-weight:700;color:#5b7fa6;text-transform:uppercase;letter-spacing:.5px;margin:10px 0 4px', 'Detail'));
      body.appendChild(_el('div', 'font-size:12px;line-height:1.6;word-break:break-word;color:' + s.text, f.message));
    }
    if (f.fix) {
      body.appendChild(_el('div', 'font-size:10px;font-weight:700;color:#5b7fa6;text-transform:uppercase;letter-spacing:.5px;margin:10px 0 4px', 'How to fix'));
      body.appendChild(_el('div', 'font-size:12px;line-height:1.6;word-break:break-word;color:#22c55e', f.fix));
    }
    if (f.ruleRef) body.appendChild(_el('div', 'font-size:10px;color:#374151;margin-top:8px;font-family:monospace;word-break:break-all', f.ruleRef));

    // Property inspector
    body.appendChild(_label('Actual Property Values', '(read from the IFC file)'));
    const pb = _el('div', '');
    pb.id = 'vq-prop-body';
    pb.appendChild(_el('div', 'color:#5b7fa6;font-size:12px;padding:10px 0', 'Loading properties...'));
    body.appendChild(pb);

    // Actions
    const acts = _el('div', 'margin-top:16px;display:flex;gap:8px;flex-wrap:wrap');
    if (e) acts.appendChild(_actionBtn('Fix guide', () => showPlatform(e)));
    acts.appendChild(_actionBtn('Show in 3D', () => goto3D(f.guid || '')));
    body.appendChild(acts);

    d.appendChild(body);
  }

  // Called by bridge.js when the host returns the element's property sets.
  function onElementProperties(data) {
    if (!data || data.guid !== _detailGuid) return;   // ignore stale responses
    const host = document.getElementById('vq-prop-body');
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    const psets = data.psets || [];
    if (psets.length === 0) {
      host.appendChild(_el('div', 'color:#5b7fa6;font-size:12px;padding:10px 0', 'No property sets are attached to this element in the IFC file.'));
      return;
    }
    host.appendChild(_el('div', 'font-size:10px;color:#374151;margin-bottom:8px', (data.psetCount || psets.length) + ' property set(s), ' + (data.propCount || 0) + ' properties'));
    psets.forEach(ps => {
      const box = _el('div', 'margin-bottom:10px;border:1px solid #14283f;border-radius:6px;overflow:hidden');
      // Header: pset name + a badge marking SGPset (Singapore), Pset (standard IFC)
      // or Qto (quantity set), reflecting the CORENET-X reading order (IFC > SubType
      // > SGPset/Pset > Property > Value).
      const psHead = _el('div', 'background:#0d1f35;padding:7px 10px;display:flex;align-items:center;gap:8px;justify-content:space-between');
      psHead.appendChild(_el('span', 'font-family:monospace;font-size:11px;font-weight:700;color:#00c4a0;word-break:break-all', ps.name || ''));
      const nm = ps.name || '';
      let badge = null;
      if (/^SGPset/i.test(nm))      badge = _el('span', 'flex-shrink:0;font-size:9px;font-weight:700;background:rgba(0,196,160,.15);color:#00c4a0;border-radius:3px;padding:1px 6px', 'SG');
      else if (/^Pset/i.test(nm))   badge = _el('span', 'flex-shrink:0;font-size:9px;font-weight:700;background:rgba(96,165,250,.12);color:#60A5FA;border-radius:3px;padding:1px 6px', 'IFC');
      else if (/^Qto/i.test(nm))    badge = _el('span', 'flex-shrink:0;font-size:9px;font-weight:700;background:rgba(167,139,250,.12);color:#A78BFA;border-radius:3px;padding:1px 6px', 'QTY');
      else if (nm === 'Attributes') badge = _el('span', 'flex-shrink:0;font-size:9px;font-weight:700;background:rgba(245,158,11,.15);color:#f59e0b;border-radius:3px;padding:1px 6px', 'INFO');
      else if (/^File/i.test(nm))   badge = _el('span', 'flex-shrink:0;font-size:9px;font-weight:700;background:rgba(120,140,170,.15);color:#8aaac8;border-radius:3px;padding:1px 6px', 'FILE');
      if (badge) psHead.appendChild(badge);
      box.appendChild(psHead);
      (ps.props || []).forEach(pr => {
        const row = _el('div', 'display:flex;justify-content:space-between;gap:10px;padding:6px 10px;border-bottom:1px solid #0f1e30;align-items:flex-start');
        // Left: property name with its IFC value type underneath (e.g. SingleValue).
        const left = _el('div', 'display:flex;flex-direction:column;gap:1px;min-width:0;flex:1');
        left.appendChild(_el('span', 'font-size:11px;color:#8aaac8;word-break:break-word', pr.name || ''));
        if (pr.type && pr.type !== 'Attribute' && pr.type !== 'File') left.appendChild(_el('span', 'font-size:9px;color:#5b7fa6;letter-spacing:.3px', pr.type));
        row.appendChild(left);
        const hasVal = pr.value !== undefined && pr.value !== null && String(pr.value) !== '';
        row.appendChild(_el('span', 'font-size:11px;font-weight:600;text-align:right;word-break:break-word;flex-shrink:0;max-width:55%;color:' + (hasVal ? '#e2e8f0' : '#374151'), hasVal ? String(pr.value) : '(empty)'));
        box.appendChild(row);
      });
      host.appendChild(box);
    });
  }

  function copyText(txt, btn) {
    const done = () => { if (btn) { const o = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = o; }, 1200); } };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done).catch(() => {});
    } else {
      const ta = _el('textarea', 'position:fixed;opacity:0');
      ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  // ── COLUMN RESIZE ────────────────────────────────────────────────────────────
  // Runs after the results table mounts (App.render post-render hook). Adds a
  // drag grip to each header so the user can widen any column when content is long.
  function afterRender() { _initColumnResize(); }

  function _initColumnResize() {
    const table = document.getElementById('results-table');
    if (!table) return;
    table.style.tableLayout = 'fixed';
    table.querySelectorAll('thead th').forEach(th => {
      if (th.querySelector('.vq-grip')) return;
      th.style.position = 'relative';
      const grip = _el('div', 'position:absolute;top:0;right:0;width:7px;height:100%;cursor:col-resize;z-index:6');
      grip.className = 'vq-grip';
      grip.addEventListener('mousedown', ev => {
        ev.preventDefault(); ev.stopPropagation();
        const startX = ev.pageX, startW = th.offsetWidth;
        function mv(e2) {
          const w = Math.max(40, startW + (e2.pageX - startX));
          th.style.width = w + 'px'; th.style.minWidth = w + 'px'; th.style.maxWidth = w + 'px';
        }
        function up() {
          document.removeEventListener('mousemove', mv);
          document.removeEventListener('mouseup', up);
          document.body.style.cursor = '';
        }
        document.addEventListener('mousemove', mv);
        document.addEventListener('mouseup', up);
        document.body.style.cursor = 'col-resize';
      });
      th.appendChild(grip);
    });
  }

  // Ask the embedded COP engine for guidance on a specific finding (agency + property
  // set + property + check level), shown in the Help page Code of Practice box.
  function copFinding(idx) {
    const f = _shownFindings[idx];
    if (!f) return;
    const q = [f.agency, f.pset, f.prop, f.check].filter(x => x && x !== 'None').join(' ');
    if (window.CopReference && CopReference.askFor) CopReference.askFor(q || (f.message || ''));
  }

  return {
    render, renderCritical, renderDesignCode,
    applyFilters, applySearch, clearFilters,
    applyDesignFilters, clearDesignFilters,
    af, as, cf,
    showPlatform, togglePlatform, toggleGrouped, goto3D,
    filterBlockers,
    rowClick, openDetail, closeDetail, onElementProperties, copyText, afterRender,
    fixFinding, copFinding,
  };
})();

window.ResultsPage = ResultsPage;
