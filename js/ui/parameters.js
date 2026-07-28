// VERIFIQ - Parameter Lookup Tool
// Searchable database of IFC+SG parameters, SGPsets, disciplines, agencies, and gateways.
// No em dashes in any text. All separators use hyphens (-) or colons (:).

'use strict';

const ParametersPage = (() => {

  // ---- State -----------------------------------------------------------------
  const _s = {
    search:      '',
    disciplines: new Set(),   // empty = all
    agencies:    new Set(),   // empty = all
    gateways:    new Set(),   // empty = all
    mandatory:   'all',       // 'all' | 'mandatory' | 'optional'
    calcTab:     'gfa',       // 'gfa' | 'count' | 'compliance' | 'export'
    gfaInput:    '',
    page:        0,
    pageSize:    50,
  };

  // ---- Static discipline definitions ----------------------------------------
  const DISCIPLINES = [
    { id: 'ARC',      label: 'Architecture',               short: 'ARC',  color: '#f5a623' },
    { id: 'CS',       label: 'Civil and Structural',       short: 'C&S',  color: '#22c55e' },
    { id: 'MEP-ACMV', label: 'MEP - ACMV',                short: 'ACMV', color: '#3b82f6' },
    { id: 'MEP-PS',   label: 'MEP - Plumbing / Sanitary',  short: 'P&S',  color: '#06b6d4' },
    { id: 'MEP-FIRE', label: 'MEP - Fire Protection',      short: 'Fire', color: '#ef4444' },
    { id: 'CIVIL',    label: 'Civil / Site / Landscape',   short: 'Civil', color: '#a78bfa' },
  ];

  // ---- Component-to-discipline mapping ---------------------------------------
  const COMP_DISC = {
    'Wall':                      ['ARC', 'CS'],
    'Beam':                      ['CS'],
    'Column':                    ['CS'],
    'Slab':                      ['ARC', 'CS'],
    'Pile':                      ['CS'],
    'Footing':                   ['CS'],
    'Door':                      ['ARC'],
    'Window':                    ['ARC'],
    'Staircase':                 ['ARC', 'CS'],
    'Ramp':                      ['ARC'],
    'Railing':                   ['ARC'],
    'Roof':                      ['ARC'],
    'Covering':                  ['ARC'],
    'Precast Concrete':          ['CS'],
    'Opening Element':           ['ARC'],
    'Shading Device':            ['ARC'],
    'Furniture':                 ['ARC'],
    'Discrete Accessory':        ['ARC', 'CS'],
    'Space (Usage)':             ['ARC'],
    'Space (GFA)':               ['ARC'],
    'Space (Strata)':            ['ARC'],
    'Space (Connectivity)':      ['ARC'],
    'Space (Landscape)':         ['ARC'],
    'Lift':                      ['MEP-ACMV', 'ARC'],
    'Escalator':                 ['MEP-ACMV', 'ARC'],
    'Moving Walkway':            ['MEP-ACMV', 'ARC'],
    'Sanitary Terminal (WC)':    ['MEP-PS'],
    'Sanitary Terminal (Tap)':   ['MEP-PS'],
    'Sanitary Terminal (Shower)': ['MEP-PS'],
    'Sanitary Terminal (Urinal)': ['MEP-PS'],
    'Waste Terminal':            ['MEP-PS'],
    'Pipe Segment':              ['MEP-PS'],
    'Pipe Fitting':              ['MEP-PS'],
    'Tank':                      ['MEP-PS'],
    'Pump':                      ['MEP-PS'],
    'Flow Meter':                ['MEP-PS'],
    'Valve':                     ['MEP-PS'],
    'Distribution Chamber':      ['MEP-PS'],
    'Interceptor':               ['MEP-PS'],
    'Fire Suppression Terminal': ['MEP-FIRE'],
    'Damper':                    ['MEP-ACMV', 'MEP-FIRE'],
    'Air Terminal':              ['MEP-ACMV'],
    'Unitary Equipment':         ['MEP-ACMV'],
    'Duct Segment':              ['MEP-ACMV'],
    'Duct Fitting':              ['MEP-ACMV'],
    'Civil Element':             ['CIVIL'],
    'Site Boundary':             ['CIVIL'],
    'Landscape Plant (Tree)':    ['CIVIL'],
    'Landscape Plant (Hedge)':   ['CIVIL'],
    'Green Verge':               ['CIVIL'],
    'Building':                  ['ARC'],
    'Site':                      ['CIVIL'],
  };

  // ---- Agency-to-gateway mapping ---------------------------------------------
  const AGENCY_GATEWAYS = {
    BCA:    ['G1', 'G1.5', 'G2', 'G3'],
    URA:    ['G1', 'G2', 'G3'],
    SCDF:   ['G2', 'G3'],
    NEA:    ['G2'],
    PUB:    ['G2', 'G3'],
    LTA:    ['G2'],
    NParks: ['G2', 'G3'],
    JTC:    ['G2'],
    SLA:    ['G2', 'G3'],
  };

  const ALL_AGENCIES = ['BCA', 'URA', 'SCDF', 'NEA', 'PUB', 'LTA', 'NParks', 'JTC', 'SLA'];
  const ALL_GATEWAYS = ['G1', 'G1.5', 'G2', 'G3'];

  // ---- GFA thresholds --------------------------------------------------------
  const GFA_THRESHOLDS = [
    { sqm: 30000, date: 'Oct 2025', label: 'Large developments' },
    { sqm:  5000, date: 'Oct 2026', label: 'Medium developments' },
    { sqm:     0, date: 'Voluntary', label: 'All other developments' },
  ];

  // ---- Enrichment from the authoritative Industry Mapping (COP 3.1, Dec 2025) --
  // Adds per-parameter Sample value, human-readable description, and the four BIM
  // software mappings (Revit / ArchiCAD / Tekla / Bentley OpenBuildings) that the
  // official CORENET-X Excel carries. Loaded once from a static asset and joined
  // onto each row by PropertySet + Parameter.
  let _enrich = null;          // { spec:{...}, loose:{...} } software/sample/description
  let _spaceValues = null;     // { OccupancyType:[...], SpaceName:[...], AGF_*:[...] }
  let _enrichLoading = false;
  const _expanded = new Set(); // keys of rows whose software/detail panel is open
  let _view = 'params';        // 'params' | 'space'  (Parameters vs Space Values browser)

  function _loadEnrich() {
    if (_enrich || _enrichLoading) return;
    _enrichLoading = true;
    fetch('data/corenetx-lookup.json')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(db => {
        // The BIM-software mapping is per-COMPONENT, so a bare pset+param key can be
        // ambiguous (the same parameter maps differently under different components).
        // spec = component-qualified keys (always correct); loose = pset|param but only
        // kept when the software is identical across every component that uses it.
        const spec = {}, loose = {}, sig = {};
        const det = p => ({ software: p.software || {}, example: p.example || '',
                            description: p.description || '', materialSet: p.materialSet || '' });
        Object.entries(db.categories || {}).forEach(([comp, arr]) => (arr || []).forEach(p => {
          const c = (comp || '').toLowerCase(), ps = (p.propertySet || '').toLowerCase(), pr = (p.parameter || '').toLowerCase();
          const d = det(p);
          spec[c + '|' + ps + '|' + pr] = d;
          if (!spec[c + '|' + pr]) spec[c + '|' + pr] = d;
          const k = ps + '|' + pr, s = JSON.stringify(d.software);
          if (!(k in sig)) { sig[k] = s; loose[k] = d; }
          else if (sig[k] !== s) { delete loose[k]; sig[k] = '__ambiguous__'; }
        }));
        _enrich = { spec, loose };
        _spaceValues = db.spaceValues || {};
        try { if (window.VState && VState.get().currentPage === 'parameters') App.navigate('parameters'); } catch (e) {}
      })
      .catch(() => { _enrich = { spec: {}, loose: {} }; });
  }

  function _rowKey(r) { return (r.component + '|' + r.pset + '|' + r.param + '|' + r.agency).toLowerCase(); }

  function _toggleRow(enc) {
    const key = decodeURIComponent(enc);
    if (_expanded.has(key)) _expanded.delete(key); else _expanded.add(key);
    App.navigate('parameters');
  }

  // ---- Flatten all parameters from EmbeddedAI.COMPONENTS --------------------
  function _buildRows() {
    const comps = (window.EmbeddedAI && window.EmbeddedAI.COMPONENTS) ? window.EmbeddedAI.COMPONENTS : {};
    const rows = [];

    Object.entries(comps).forEach(([compName, compDef]) => {
      const entity = compDef.entity || '';
      const discs  = COMP_DISC[compName] || [];

      Object.entries(compDef.agencies || {}).forEach(([agency, agencyDef]) => {
        const psets  = agencyDef.psets  || [];
        const params = agencyDef.params || [];
        const gws    = AGENCY_GATEWAYS[agency] || [];

        params.forEach(p => {
          const values = Array.isArray(p.values) ? p.values.join(' | ') : (p.values || '');
          rows.push({
            component:   compName,
            entity,
            pset:        p.pset || (psets[0] || ''),
            param:       p.name || '',
            type:        p.type || '',
            values,
            agency,
            gateways:    gws,
            disciplines: discs,
            mandatory:   p.mandatory !== false,
          });
        });

        if (params.length === 0 && psets.length > 0) {
          psets.forEach(pset => {
            rows.push({
              component:   compName,
              entity,
              pset,
              param:       '(see pset)',
              type:        '',
              values:      '',
              agency,
              gateways:    gws,
              disciplines: discs,
              mandatory:   true,
            });
          });
        }
      });
    });

    // Join the authoritative sample value, description and BIM-software mappings.
    // Prefer a component-qualified match; only use the bare pset|param when unambiguous.
    if (_enrich) {
      rows.forEach(r => {
        const c = (r.component || '').toLowerCase(), ps = (r.pset || '').toLowerCase(), pr = (r.param || '').toLowerCase();
        const e = _enrich.spec[c + '|' + ps + '|' + pr] || _enrich.spec[c + '|' + pr] || _enrich.loose[ps + '|' + pr];
        if (e) { r.software = e.software; r.example = e.example; r.description = e.description; r.materialSet = e.materialSet; }
      });
    }
    return rows;
  }

  // ---- Smart search: normalisation, BIM synonyms, typo tolerance -------------
  // Matches the way engineers actually type: ignores spaces/underscores/hyphens
  // ("u value" == "UValue" == "u-value"), understands BIM shorthand, and tolerates
  // a one-character typo. Also searches the enriched description, sample and
  // software-mapping fields.
  function _norm(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  const SEARCH_SYN = {
    uvalue: 'thermaltransmittance', ettv: 'thermaltransmittance', ottv: 'thermaltransmittance', retv: 'thermaltransmittance',
    firerating: 'fireresistance', frr: 'fireresistance', fireresistanceperiod: 'fireresistance',
    handicap: 'accessible', wheelchair: 'accessible', barrierfree: 'accessible', disabled: 'accessible', oku: 'accessible',
    aircon: 'acmv', hvac: 'acmv', airconditioning: 'acmv',
    rebar: 'reinforcement', reo: 'reinforcement',
    wc: 'watercloset', gfa: 'grossfloorarea', ettvvalue: 'thermaltransmittance',
    stair: 'staircase', precast: 'precastconcrete'
  };
  function _editDist1(a, b) {
    if (a === b) return true;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < la && j < lb) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
    }
    return (edits + (la - i) + (lb - j)) <= 1;
  }
  function _smartMatch(r, rawQ) {
    if (!rawQ) return true;
    const swVals = r.software ? Object.values(r.software).join(' ') : '';
    const hayRaw = [r.component, r.param, r.pset, r.entity, r.agency, r.values, r.description, r.example, swVals].join(' ');
    const hay = _norm(hayRaw);
    const q = _norm(rawQ);
    if (!q) return true;
    if (hay.indexOf(q) >= 0) return true;
    for (const k in SEARCH_SYN) { if (q.indexOf(k) >= 0 && hay.indexOf(SEARCH_SYN[k]) >= 0) return true; }
    if (SEARCH_SYN[q] && hay.indexOf(SEARCH_SYN[q]) >= 0) return true;
    if (q.length >= 4) {
      const toks = hayRaw.toLowerCase().split(/[^a-z0-9]+/);
      for (const t of toks) { if (t.length >= 3 && _editDist1(q, t)) return true; }
    }
    return false;
  }

  // ---- Filter ----------------------------------------------------------------
  function _filter(rows) {
    const dsc = _s.disciplines;
    const agc = _s.agencies;
    const gws = _s.gateways;
    const man = _s.mandatory;

    return rows.filter(r => {
      if (_s.search && !_smartMatch(r, _s.search)) return false;

      if (dsc.size > 0 && !r.disciplines.some(d => dsc.has(d))) return false;
      if (agc.size > 0 && !agc.has(r.agency)) return false;
      if (gws.size > 0 && !r.gateways.some(g => gws.has(g))) return false;
      if (man === 'mandatory' && !r.mandatory) return false;
      if (man === 'optional'  &&  r.mandatory) return false;
      return true;
    });
  }

  // ---- HTML helpers ----------------------------------------------------------
  function _esc(s) {
    return typeof VUtils !== 'undefined' ? VUtils.esc(String(s)) : String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _chip(label, color, active, onclick) {
    const bg  = active ? color : 'transparent';
    const col = active ? '#000' : color;
    return '<button onclick="' + onclick + '" style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;background:' + bg + ';color:' + col + ';border:1.5px solid ' + color + ';transition:all .15s;white-space:nowrap">' + _esc(label) + '</button>';
  }

  function _agencyBadge(a) {
    return '<span class="badge agency-' + a + '" style="font-size:10px">' + _esc(a) + '</span>';
  }

  function _gwBadge(g) {
    const colors = { G1:'#3b82f6', 'G1.5':'#8b5cf6', G2:'#22c55e', G3:'#f5a623' };
    const c = colors[g] || '#94a3b8';
    return '<span style="background:' + c + '22;color:' + c + ';border:1px solid ' + c + '44;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:700">' + _esc(g) + '</span>';
  }

  // ---- Results table ---------------------------------------------------------
  function _renderTable(filtered) {
    const start = _s.page * _s.pageSize;
    const slice = filtered.slice(start, start + _s.pageSize);
    const total = filtered.length;

    if (total === 0) {
      return '<div style="padding:40px;text-align:center;color:var(--mid-grey);font-size:13px">No parameters match the current filters. Try clearing some filters or broadening your search.</div>';
    }

    const pages = Math.ceil(total / _s.pageSize);
    const cur   = _s.page;

    const pager = pages > 1
      ? '<div style="display:flex;align-items:center;gap:8px;padding:10px 16px;background:var(--navy);border-top:1px solid var(--border)">'
        + '<button class="btn btn-ghost" style="font-size:11px;padding:3px 10px" onclick="ParametersPage._pg(' + (cur-1) + ')" ' + (cur===0?'disabled':'') + '>Prev</button>'
        + '<span style="font-size:11px;color:var(--mid-grey)">Page ' + (cur+1) + ' of ' + pages + ' (' + total.toLocaleString() + ' rows)</span>'
        + '<button class="btn btn-ghost" style="font-size:11px;padding:3px 10px" onclick="ParametersPage._pg(' + (cur+1) + ')" ' + (cur===pages-1?'disabled':'') + '>Next</button>'
        + '<span style="flex:1"></span>'
        + '<span style="font-size:10px;color:var(--mid-grey)">Showing ' + (start+1) + '-' + Math.min(start+_s.pageSize,total) + ' of ' + total.toLocaleString() + '</span>'
        + '</div>'
      : '<div style="padding:6px 16px;font-size:10px;color:var(--mid-grey);background:var(--navy);border-top:1px solid var(--border)">' + total.toLocaleString() + ' parameter' + (total !== 1 ? 's' : '') + ' found</div>';

    const rows_html = slice.map(r => {
      const valTxt = r.values ? (r.values.length > 120 ? r.values.slice(0,120) + '...' : r.values) : '-';
      const reqHtml = r.mandatory
        ? '<span style="color:#22c55e;font-weight:700;font-size:10px">M</span>'
        : '<span style="color:#94a3b8;font-size:10px">O</span>';
      const sw = r.software || {};
      const hasDetail = (r.description && r.description !== r.param) || r.example
        || sw.revit || sw.archicad || sw.tekla || sw.bentley;
      const key  = _rowKey(r);
      const open = _expanded.has(key);
      const chev = hasDetail ? '<span style="color:#5b7fa6;font-size:9px;margin-right:4px">' + (open ? '▾' : '▸') + '</span>' : '';
      const exHint = r.example ? '<div style="font-size:9px;color:#d97706;margin-top:2px">e.g. ' + _esc(r.example) + '</div>' : '';
      let html = '<tr' + (hasDetail ? ' style="cursor:pointer" onclick="ParametersPage._toggleRow(\'' + encodeURIComponent(key) + '\')"' : '') + '>'
        + '<td style="font-weight:600;white-space:nowrap">' + chev + _esc(r.component) + '</td>'
        + '<td style="font-family:monospace;color:var(--teal);font-size:10px;white-space:nowrap">' + _esc(r.entity) + '</td>'
        + '<td style="font-family:monospace;color:#a78bfa;font-size:10px;white-space:nowrap">' + _esc(r.pset) + '</td>'
        + '<td style="font-weight:600;color:var(--white);white-space:nowrap">' + _esc(r.param) + '</td>'
        + '<td style="color:var(--mid-grey);white-space:nowrap">' + _esc(r.type) + '</td>'
        + '<td style="max-width:220px;color:var(--mid-grey);font-size:10px;word-break:break-word">' + _esc(valTxt) + exHint + '</td>'
        + '<td>' + _agencyBadge(r.agency) + '</td>'
        + '<td>' + r.gateways.map(_gwBadge).join(' ') + '</td>'
        + '<td>' + reqHtml + '</td>'
        + '</tr>';
      if (open) {
        const swRow = [['Revit', sw.revit], ['ArchiCAD', sw.archicad], ['Tekla', sw.tekla], ['Bentley OpenBuildings', sw.bentley]]
          .filter(x => x[1])
          .map(x => '<span style="display:inline-block;margin:2px 10px 2px 0"><span style="color:#5b7fa6;font-size:9px">' + x[0]
            + ':</span> <span style="color:#cbd5e1;font-size:10px;font-family:monospace">' + _esc(x[1]) + '</span></span>')
          .join('');
        html += '<tr><td colspan="9" style="background:#06111f;padding:9px 14px;border-bottom:2px solid #162843">'
          + (r.description && r.description !== r.param ? '<div style="font-size:11px;color:#cbd5e1;margin-bottom:5px"><b style="color:#8aaac8">Description:</b> ' + _esc(r.description) + '</div>' : '')
          + (r.example ? '<div style="font-size:11px;color:#cbd5e1;margin-bottom:5px"><b style="color:#8aaac8">Sample value:</b> <span style="color:#d97706;font-family:monospace">' + _esc(r.example) + '</span></div>' : '')
          + (swRow ? '<div style="font-size:11px"><b style="color:#8aaac8">Where to set it (BIM software):</b><br>' + swRow + '</div>' : '')
          + (r.materialSet && r.materialSet !== 'N.A' ? '<div style="font-size:10px;color:#64748b;margin-top:4px">Material set: ' + _esc(r.materialSet) + '</div>' : '')
          + '</td></tr>';
      }
      return html;
    }).join('');

    return '<div class="table-wrap" style="overflow-x:auto">'
      + '<table style="font-size:11px">'
      + '<thead><tr><th>Component</th><th>IFC Entity</th><th>SGPset</th><th>Parameter</th><th>Type</th><th>Accepted Values</th><th>Agency</th><th>Gateway</th><th>Req.</th></tr></thead>'
      + '<tbody>' + rows_html + '</tbody>'
      + '</table></div>' + pager;
  }

  // ---- Calculation panel -----------------------------------------------------
  function _renderCalcPanel(rows, filtered) {
    const tab  = _s.calcTab;
    const tabs = [
      { id: 'gfa',        label: 'GFA Threshold' },
      { id: 'count',      label: 'Parameter Count' },
      { id: 'compliance', label: 'Compliance Estimate' },
      { id: 'export',     label: 'Export CSV' },
    ];

    const tabBar = '<div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:14px">'
      + tabs.map(t =>
          '<button onclick="ParametersPage._calcTab(\'' + t.id + '\')" style="padding:7px 14px;border:none;background:none;cursor:pointer;font-size:11px;font-weight:600;color:' + (tab===t.id?'var(--teal)':'var(--mid-grey)') + ';border-bottom:2px solid ' + (tab===t.id?'var(--teal)':'transparent') + ';margin-bottom:-2px;font-family:inherit;transition:all .15s">' + _esc(t.label) + '</button>'
        ).join('')
      + '</div>';

    let body = '';

    if (tab === 'gfa') {
      const gfa = parseFloat(_s.gfaInput) || 0;
      let indicator = '';
      if (_s.gfaInput) {
        const color  = gfa >= 30000 ? '#ef4444' : gfa >= 5000 ? '#f5a623' : '#22c55e';
        const bdrClr = color;
        const msg    = gfa >= 30000
          ? 'MANDATORY - Oct 2025 (>=30,000 sqm)'
          : gfa >= 5000
          ? 'MANDATORY - Oct 2026 (>=5,000 sqm)'
          : 'VOLUNTARY - CORENET X not yet mandatory at this GFA';
        const sub    = gfa >= 5000
          ? 'GFA: ' + gfa.toLocaleString() + ' sqm - This project must submit via CORENET X IFC+SG format'
          : 'GFA: ' + gfa.toLocaleString() + ' sqm - CORENET X IFC+SG submission is voluntary but recommended';
        indicator = '<div style="margin-top:12px;padding:10px 14px;border-radius:6px;background:' + color + '1a;border-left:3px solid ' + bdrClr + '"><div style="font-size:12px;font-weight:700;color:' + color + ';margin-bottom:4px">' + _esc(msg) + '</div><div style="font-size:11px;color:var(--mid-grey)">' + _esc(sub) + '</div></div>';
      }

      const thresholdRows = GFA_THRESHOLDS.map(t =>
        '<tr><td>' + (t.sqm > 0 ? '>=' + t.sqm.toLocaleString() + ' sqm' : 'Below 5,000 sqm') + '</td><td>' + _esc(t.date) + '</td><td>' + _esc(t.label) + '</td></tr>'
      ).join('');

      body = '<div>'
        + '<div style="font-size:12px;color:var(--mid-grey);margin-bottom:10px;line-height:1.7">Enter project Gross Floor Area (GFA) to check which CORENET X mandate tier applies. Thresholds are from BCA circulars, effective for new building plan applications.</div>'
        + '<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">'
        + '<div><label style="font-size:11px;color:var(--mid-grey);display:block;margin-bottom:4px">Project GFA (sqm)</label>'
        + '<input type="number" id="param-gfa" min="0" step="100" placeholder="e.g. 12500" value="' + _esc(_s.gfaInput) + '" oninput="ParametersPage._gfaInput(this.value)" style="background:var(--navy);border:1px solid var(--border);color:var(--white);padding:6px 10px;border-radius:5px;font-size:13px;width:160px;font-family:inherit"></div>'
        + '</div>'
        + indicator
        + '<div style="margin-top:12px"><div style="font-size:11px;font-weight:700;color:var(--mid-grey);margin-bottom:6px">Mandate schedule:</div>'
        + '<table style="font-size:11px;width:100%"><thead><tr><th>GFA Threshold</th><th>Effective Date</th><th>Tier</th></tr></thead><tbody>' + thresholdRows + '</tbody></table></div>'
        + '</div>';
    }

    if (tab === 'count') {
      const byDisc = {}; const byAgency = {}; const byGw = {};
      rows.forEach(r => {
        r.disciplines.forEach(d => { byDisc[d]   = (byDisc[d]   || 0) + 1; });
        byAgency[r.agency] = (byAgency[r.agency] || 0) + 1;
        r.gateways.forEach(g  => { byGw[g]     = (byGw[g]     || 0) + 1; });
      });

      const discRows = DISCIPLINES.map(d =>
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">'
        + '<div style="width:10px;height:10px;border-radius:2px;background:' + d.color + ';flex-shrink:0"></div>'
        + '<span style="font-size:11px;color:var(--white);flex:1">' + _esc(d.short) + '</span>'
        + '<span style="font-size:11px;font-weight:700;color:var(--teal)">' + ((byDisc[d.id]||0)).toLocaleString() + '</span>'
        + '</div>'
      ).join('');

      const agRows = ALL_AGENCIES.filter(a => byAgency[a] > 0).sort((a,b) => byAgency[b]-byAgency[a]).map(a =>
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">'
        + _agencyBadge(a)
        + '<span style="font-size:11px;color:var(--white);flex:1"></span>'
        + '<span style="font-size:11px;font-weight:700;color:var(--teal)">' + byAgency[a].toLocaleString() + '</span>'
        + '</div>'
      ).join('');

      const gwRows = ALL_GATEWAYS.map(g =>
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">'
        + _gwBadge(g)
        + '<span style="font-size:11px;color:var(--white);flex:1"></span>'
        + '<span style="font-size:11px;font-weight:700;color:var(--teal)">' + (byGw[g]||0).toLocaleString() + '</span>'
        + '</div>'
      ).join('');

      body = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">'
        + '<div><div style="font-size:11px;font-weight:700;color:var(--mid-grey);margin-bottom:8px">By Discipline</div>' + discRows + '</div>'
        + '<div><div style="font-size:11px;font-weight:700;color:var(--mid-grey);margin-bottom:8px">By Agency</div>' + agRows + '</div>'
        + '<div><div style="font-size:11px;font-weight:700;color:var(--mid-grey);margin-bottom:8px">By Gateway</div>' + gwRows
        + '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)"><div style="font-size:11px;color:var(--mid-grey)">Total (all):</div><div style="font-size:18px;font-weight:800;color:var(--teal)">' + rows.length.toLocaleString() + '</div><div style="font-size:10px;color:var(--mid-grey)">parameter mappings in database</div></div>'
        + '</div></div>'
        + '<div style="margin-top:10px;font-size:11px;color:var(--mid-grey)">Note: parameters appear multiple times when shared across agencies or gateways. The filtered view shows ' + filtered.length.toLocaleString() + ' rows.</div>';
    }

    if (tab === 'compliance') {
      const session = (window.VState) ? VState.get().session : null;
      if (!session) {
        body = '<div style="padding:20px;text-align:center;color:var(--mid-grey);font-size:12px">No validation session loaded. Run a validation from the Validation page first, then return here to see your compliance estimate per discipline.</div>';
      } else {
        const score    = session.score    || 0;
        const critical = session.critical || 0;
        const errors   = session.errors   || 0;
        const warnings = session.warnings || 0;
        const passes   = session.passes   || 0;
        const barColor = score >= 90 ? '#22c55e' : score >= 70 ? '#f5a623' : '#ef4444';

        const stats = [['Critical', critical, '#ef4444'], ['Errors', errors, '#f97316'], ['Warnings', warnings, '#eab308'], ['Passes', passes, '#22c55e']];
        const statsHtml = stats.map(([l,v,c]) =>
          '<div style="padding:8px;background:var(--navy);border-radius:6px;border-left:3px solid ' + c + '"><div style="font-size:10px;color:var(--mid-grey)">' + l + '</div><div style="font-size:18px;font-weight:800;color:' + c + '">' + (v||0).toLocaleString() + '</div></div>'
        ).join('');

        const checks = [
          { label: 'CORENET X G2 ready', pass: critical === 0 && score >= 80 },
          { label: 'No critical findings', pass: critical === 0 },
          { label: 'Score above 80%', pass: score >= 80 },
          { label: 'No data errors', pass: errors === 0 },
        ];
        const checksHtml = checks.map(c =>
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:14px">' + (c.pass ? 'OK' : 'XX') + '</span><span style="font-size:12px;color:' + (c.pass ? 'var(--white)' : 'var(--mid-grey)') + '">' + _esc(c.label) + '</span></div>'
        ).join('');

        body = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
          + '<div><div style="font-size:11px;color:var(--mid-grey);margin-bottom:8px">Overall Data Compliance Score</div>'
          + '<div style="font-size:36px;font-weight:800;color:' + barColor + '">' + score + '%</div>'
          + '<div style="background:var(--border);border-radius:4px;height:8px;margin-top:6px;overflow:hidden"><div style="background:' + barColor + ';width:' + score + '%;height:100%;border-radius:4px;transition:width .6s"></div></div>'
          + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">' + statsHtml + '</div></div>'
          + '<div><div style="font-size:11px;color:var(--mid-grey);margin-bottom:8px">Submission Readiness</div>' + checksHtml
          + '<div style="margin-top:10px"><button class="btn btn-outline" style="font-size:11px" onclick="App.navigate(\'results\')">View Full Results</button></div></div>'
          + '</div>';
      }
    }

    if (tab === 'export') {
      body = '<div>'
        + '<div style="font-size:12px;color:var(--mid-grey);margin-bottom:12px;line-height:1.7">Export the currently filtered parameter list as a CSV file for use in Excel or other tools. Columns: Component, IFC Entity, SGPset, Parameter, Type, Accepted Values, Agency, Gateways, Required.</div>'
        + '<div style="display:flex;gap:10px;flex-wrap:wrap">'
        + '<button class="btn btn-teal" style="font-size:12px" onclick="ParametersPage._exportCsv()">Download Filtered CSV (' + filtered.length.toLocaleString() + ' rows)</button>'
        + '<button class="btn btn-outline" style="font-size:12px" onclick="ParametersPage._exportCsvAll()">Download Full Database CSV</button>'
        + '</div>'
        + '<div style="margin-top:12px;font-size:11px;color:var(--mid-grey)">Tip: use the discipline, agency, gateway, and search filters above to narrow the export to exactly the parameters relevant to your project and gateway submission.</div>'
        + '</div>';
    }

    return '<div class="card" style="margin-bottom:16px"><div class="card-header"><span class="card-title">Calculation Tools</span></div>' + tabBar + body + '</div>';
  }

  function _setView(v) { _view = v; _s.page = 0; App.navigate('parameters'); }

  // ---- Space Values browser (CORENET-X space-level enumerations) -------------
  function _renderSpaceValues() {
    const searchBox = '<div class="card" style="margin-bottom:12px;padding:10px 12px">'
      + '<input type="text" id="param-search" placeholder="Search space values - e.g. hospital, office, sky terrace, residential..." value="' + _esc(_s.search) + '" oninput="ParametersPage._search(this.value)" style="width:100%;background:var(--navy);border:1px solid var(--border);color:var(--white);padding:8px 12px;border-radius:6px;font-size:13px;font-family:inherit;box-sizing:border-box">'
      + '<div style="font-size:11px;color:var(--mid-grey);line-height:1.6;margin-top:8px"><b style="color:#8aaac8">Space Values</b> are the enumerated values CORENET-X accepts for the space-level properties (occupancy type, space name, GFA development use, landscape type, area type, and more), set on IfcSpace property sets. Source: authoritative Industry Mapping (CORENET-X COP 3.1, December 2025).</div></div>';

    if (!_spaceValues) return searchBox + '<div class="card" style="padding:24px;text-align:center;color:var(--mid-grey)">Loading space-values database...</div>';

    const q = _norm(_s.search);
    const cards = Object.keys(_spaceValues).map(function (prop) {
      const vals = _spaceValues[prop] || [];
      const propMatch = !q || _norm(prop).indexOf(q) >= 0;
      const shown = (!q || propMatch) ? vals : vals.filter(function (v) { return _norm(v).indexOf(q) >= 0; });
      if (q && !propMatch && shown.length === 0) return '';
      const chips = shown.map(function (v) {
        return '<span style="display:inline-block;background:#0e1f33;border:1px solid #1d3354;border-radius:5px;padding:3px 9px;margin:3px 3px 0 0;font-size:11px;color:#cbd5e1">' + _esc(v) + '</span>';
      }).join('');
      return '<div class="card" style="margin-bottom:12px"><div class="card-header">'
        + '<span class="card-title" style="font-family:monospace;color:#a78bfa;font-size:13px">' + _esc(prop) + '</span>'
        + '<span style="font-size:10px;color:var(--mid-grey)">' + shown.length + (q && shown.length !== vals.length ? ' / ' + vals.length : '') + ' value' + (vals.length !== 1 ? 's' : '') + '</span></div>'
        + '<div style="padding:2px 12px 10px">' + (chips || '<span style="color:var(--mid-grey);font-size:11px">no matching values</span>') + '</div></div>';
    }).filter(Boolean).join('');

    return searchBox + (cards || '<div class="card" style="padding:24px;text-align:center;color:var(--mid-grey)">No space values match "' + _esc(_s.search) + '"</div>');
  }

  // ---- Main render -----------------------------------------------------------
  function render() {
    _loadEnrich();                 // fetch authoritative sample/software data once
    const rows     = _buildRows();
    const filtered = _filter(rows);

    const discChips = DISCIPLINES.map(d =>
      _chip(d.label, d.color, _s.disciplines.has(d.id), "ParametersPage._toggleDisc('" + d.id + "')")
    ).join('');

    const agencyChips = ALL_AGENCIES.map(a =>
      _chip(a, '#64748b', _s.agencies.has(a), "ParametersPage._toggleAgency('" + a + "')")
    ).join('');

    const gwColors = { G1:'#3b82f6', 'G1.5':'#8b5cf6', G2:'#22c55e', G3:'#f5a623' };
    const gatewayChips = ALL_GATEWAYS.map(g =>
      _chip(g, gwColors[g] || '#64748b', _s.gateways.has(g), "ParametersPage._toggleGateway('" + g + "')")
    ).join('');

    const mandatoryChips = [
      { id:'all',       label:'All',           color:'#64748b' },
      { id:'mandatory', label:'Mandatory only', color:'#22c55e' },
      { id:'optional',  label:'Optional only',  color:'#94a3b8' },
    ].map(m => _chip(m.label, m.color, _s.mandatory === m.id, "ParametersPage._setMandatory('" + m.id + "')")).join('');

    const header = '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:10px">'
      + '<div><h1 style="margin:0">Parameter Lookup</h1>'
      + '<p style="font-size:12px;color:var(--mid-grey);margin-top:3px">IFC+SG parameter database - 833+ property mappings across 81 components, 10 agencies, and 4 submission gateways, from the authoritative Industry Mapping (CORENET-X COP 3.1, December 2025). Filter by discipline, agency, or gateway. <b style="color:#8aaac8">Click any parameter</b> to see its sample value and exactly where to set it in Revit, ArchiCAD, Tekla and Bentley OpenBuildings. Use the calculation tools to check GFA mandate thresholds, count parameters per agency, estimate compliance, or export a filtered CSV.</p></div>'
      + '<button class="btn btn-ghost" style="font-size:11px" onclick="App.navigate(\'rules\')">Rules Database</button>'
      + '</div>';
    const viewToggle = '<div style="display:inline-flex;gap:4px;background:#0a1628;border:1px solid var(--border);border-radius:7px;padding:3px;margin-bottom:14px">'
      + ['params', 'space'].map(function (v) {
          var on = _view === v;
          var label = v === 'params' ? 'Parameters (' + rows.length.toLocaleString() + ')'
                    : 'Space Values' + (_spaceValues ? ' (' + Object.values(_spaceValues).reduce(function (a, x) { return a + x.length; }, 0).toLocaleString() + ')' : '');
          return '<button onclick="ParametersPage._setView(\'' + v + '\')" style="border:none;border-radius:5px;padding:6px 16px;font-size:12px;font-weight:600;cursor:pointer;background:'
            + (on ? 'var(--teal)' : 'transparent') + ';color:' + (on ? 'var(--navy)' : 'var(--mid-grey)') + '">' + label + '</button>';
        }).join('')
      + '</div>';

    if (_view === 'space') return '<div>' + header + viewToggle + _renderSpaceValues() + '</div>';

    return '<div>'
      + header
      + viewToggle

      // Filters card
      + '<div class="card" style="margin-bottom:14px">'
      + '<div class="card-header" style="margin-bottom:10px"><span class="card-title">Filters</span>'
      + '<button class="btn btn-ghost" style="font-size:10px;padding:3px 8px" onclick="ParametersPage._clearFilters()">Clear All</button></div>'
      + '<div style="margin-bottom:10px"><input type="text" id="param-search" placeholder="Search component, parameter, SGPset, IFC entity, agency..." value="' + _esc(_s.search) + '" oninput="ParametersPage._search(this.value)" style="width:100%;background:var(--navy);border:1px solid var(--border);color:var(--white);padding:7px 12px;border-radius:5px;font-size:13px;font-family:inherit;box-sizing:border-box"></div>'
      + '<div style="margin-bottom:8px"><div style="font-size:10px;font-weight:700;color:var(--mid-grey);margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px">Discipline</div><div style="display:flex;flex-wrap:wrap;gap:6px">' + discChips + '</div></div>'
      + '<div style="margin-bottom:8px"><div style="font-size:10px;font-weight:700;color:var(--mid-grey);margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px">Agency</div><div style="display:flex;flex-wrap:wrap;gap:6px">' + agencyChips + '</div></div>'
      + '<div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">'
      + '<div><div style="font-size:10px;font-weight:700;color:var(--mid-grey);margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px">Gateway</div><div style="display:flex;gap:6px">' + gatewayChips + '</div></div>'
      + '<div><div style="font-size:10px;font-weight:700;color:var(--mid-grey);margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px">Required</div><div style="display:flex;gap:6px">' + mandatoryChips + '</div></div>'
      + '</div></div>'

      // Calc panel
      + _renderCalcPanel(rows, filtered)

      // Results
      + '<div class="card" style="overflow:hidden">'
      + '<div class="card-header" style="border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:0">'
      + '<span class="card-title">Parameters <span style="font-size:11px;font-weight:400;color:var(--mid-grey);margin-left:6px">' + filtered.length.toLocaleString() + ' of ' + rows.length.toLocaleString() + '</span></span>'
      + '</div>'
      + _renderTable(filtered)
      + '</div>'
      + '</div>';
  }

  // ---- Public interaction methods --------------------------------------------
  function _pg(n) {
    const filt = _filter(_buildRows());
    _s.page = Math.max(0, Math.min(n, Math.ceil(filt.length / _s.pageSize) - 1));
    _rerender();
  }

  function _search(val) {
    _s.search = val; _s.page = 0; _rerenderKeepFocus();
  }

  function _toggleDisc(id) {
    if (_s.disciplines.has(id)) _s.disciplines.delete(id); else _s.disciplines.add(id);
    _s.page = 0; _rerender();
  }

  function _toggleAgency(id) {
    if (_s.agencies.has(id)) _s.agencies.delete(id); else _s.agencies.add(id);
    _s.page = 0; _rerender();
  }

  function _toggleGateway(id) {
    if (_s.gateways.has(id)) _s.gateways.delete(id); else _s.gateways.add(id);
    _s.page = 0; _rerender();
  }

  function _setMandatory(val) {
    _s.mandatory = val; _s.page = 0; _rerender();
  }

  function _calcTab(id) {
    _s.calcTab = id; _rerender();
  }

  function _gfaInput(val) {
    _s.gfaInput = val; _rerenderKeepFocus();
  }

  function _clearFilters() {
    _s.search = ''; _s.disciplines = new Set(); _s.agencies = new Set();
    _s.gateways = new Set(); _s.mandatory = 'all'; _s.page = 0;
    _rerender();
  }

  // Re-render while keeping the focused filter input focused with its caret intact
  // (the page rebuild would otherwise drop focus on every keystroke).
  function _rerenderKeepFocus() {
    const active = document.activeElement;
    const focusId = active && active.id ? active.id : null;
    const selStart = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;
    const selEnd = active && typeof active.selectionEnd === 'number' ? active.selectionEnd : null;
    _rerender();
    if (focusId) {
      const restored = document.getElementById(focusId);
      if (restored) {
        restored.focus();
        if (selStart !== null && typeof restored.setSelectionRange === 'function') {
          try { restored.setSelectionRange(selStart, selEnd); } catch (e) { /* non-text input */ }
        }
      }
    }
  }

  function _rerender() {
    const el = document.getElementById('page-container');
    if (!el) return;
    try { el.innerHTML = render(); } catch (e) { console.error('[ParametersPage] rerender error:', e); }
  }

  // ---- CSV export ------------------------------------------------------------
  function _toCsv(rows) {
    const hdr = ['Component','IFC Entity','SGPset','Parameter','Type','Accepted Values','Agency','Gateways','Required'];
    const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
    return [hdr.join(',')]
      .concat(rows.map(r => [
        esc(r.component), esc(r.entity), esc(r.pset), esc(r.param),
        esc(r.type), esc(r.values), esc(r.agency),
        esc(r.gateways.join(';')), esc(r.mandatory ? 'Mandatory' : 'Optional'),
      ].join(',')))
      .join('\r\n');
  }

  function _download(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  }

  function _exportCsv()    { _download(_toCsv(_filter(_buildRows())), 'verifiq-parameters-filtered.csv'); }
  function _exportCsvAll() { _download(_toCsv(_buildRows()),          'verifiq-parameters-all.csv');      }

  return {
    render,
    _pg, _search, _toggleDisc, _toggleAgency, _toggleGateway,
    _setMandatory, _calcTab, _gfaInput, _clearFilters,
    _exportCsv, _exportCsvAll, _toggleRow, _setView,
  };
})();

window.ParametersPage = ParametersPage;