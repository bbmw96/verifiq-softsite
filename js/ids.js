// VERIFIQ - IDS Checker Page
// Copyright 2026 BBMW0 Technologies.
// Validates the loaded IFC model against a custom IDS (Information Delivery Specification) XML file.

const IdsPage = (() => {

  let _idsPath   = '';
  let _idsName   = '';
  let _results   = null;
  let _running   = false;

  // ── Bridge listeners ─────────────────────────────────────────────────────
  function initListeners() {
    if (!window.Bridge || !Bridge.on) return;

    // C# returns the selected IDS file path via 'idsFileSelected'
    Bridge.on('idsFileSelected', (data) => {
      if (data && data.path) {
        _idsPath = data.path;
        _idsName = data.path.split(/[/\\]/).pop();
        _results = null;
        render();
      }
    });

    // C# returns IDS validation results via 'idsCheckResult'
    Bridge.on('idsCheckResult', (data) => {
      _running = false;
      _results = data;
      render();
    });
  }

  // ── Browse for IDS file ──────────────────────────────────────────────────
  // IMPORTANT: sends 'openIdsFile' action (NOT 'openFileForImport' which opens Excel filter)
  function browseIds() {
    if (window.Bridge && Bridge.send) {
      Bridge.send('openIdsFile', {});
    } else if (window.chrome && chrome.webview) {
      chrome.webview.postMessage(JSON.stringify({ action: 'openIdsFile', data: {} }));
    }
  }

  // ── Run IDS check ────────────────────────────────────────────────────────
  function runCheck() {
    if (!_idsPath) return;
    const state = (window.VState && VState.get) ? VState.get() : {};
    if (!state.filesLoaded || !state.filesLoaded.length) {
      alert('Load an IFC file first before running the IDS check.');
      return;
    }
    _running = true;
    render();
    if (window.Bridge && Bridge.send) {
      Bridge.send('runIdsCheck', { idsPath: _idsPath });
    } else if (window.chrome && chrome.webview) {
      chrome.webview.postMessage(JSON.stringify({ action: 'runIdsCheck', data: { idsPath: _idsPath } }));
    }
  }

  // ── Render results table ─────────────────────────────────────────────────
  function renderResults() {
    if (!_results) return '';
    const r = _results;
    const pass   = r.passed  || 0;
    const fail   = r.failed  || 0;
    const total  = pass + fail;
    const pct    = total > 0 ? Math.round((pass / total) * 100) : 0;

    const rows = (r.findings || []).map(f => `
      <tr style="border-bottom:1px solid #eee">
        <td style="padding:7px 10px;font-size:12px;color:${f.passed ? '#00897b' : '#c62828'}">
          ${f.passed ? '&#10003; PASS' : '&#10007; FAIL'}
        </td>
        <td style="padding:7px 10px;font-size:12px;color:#333">${f.specName || ''}</td>
        <td style="padding:7px 10px;font-size:12px;color:#666">${f.elementGuid || ''}</td>
        <td style="padding:7px 10px;font-size:12px;color:#555">${f.message || ''}</td>
      </tr>`).join('');

    return `
      <div style="background:#fff;border:1px solid #dde3ed;border-radius:10px;padding:18px 20px;margin-top:16px">
        <div style="display:flex;gap:16px;margin-bottom:14px">
          <div style="background:#e8f5e9;border-radius:6px;padding:10px 16px;text-align:center;min-width:80px">
            <div style="font-size:20px;font-weight:700;color:#2e7d32">${pass}</div>
            <div style="font-size:11px;color:#555">PASSED</div>
          </div>
          <div style="background:#ffebee;border-radius:6px;padding:10px 16px;text-align:center;min-width:80px">
            <div style="font-size:20px;font-weight:700;color:#c62828">${fail}</div>
            <div style="font-size:11px;color:#555">FAILED</div>
          </div>
          <div style="background:#f5f7fa;border-radius:6px;padding:10px 16px;text-align:center;min-width:80px">
            <div style="font-size:20px;font-weight:700;color:#0B2545">${pct}%</div>
            <div style="font-size:11px;color:#555">COMPLIANCE</div>
          </div>
        </div>
        ${rows.length > 0 ? `
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#f5f7fa">
                  <th style="text-align:left;padding:7px 10px;font-size:11px;color:#888;font-weight:600">STATUS</th>
                  <th style="text-align:left;padding:7px 10px;font-size:11px;color:#888;font-weight:600">SPECIFICATION</th>
                  <th style="text-align:left;padding:7px 10px;font-size:11px;color:#888;font-weight:600">ELEMENT GUID</th>
                  <th style="text-align:left;padding:7px 10px;font-size:11px;color:#888;font-weight:600">MESSAGE</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>` : '<div style="color:#888;font-size:13px">No detailed findings returned.</div>'}
      </div>`;
  }

  // ── Main render ──────────────────────────────────────────────────────────
  function render() {
    const el = document.getElementById('page-ids');
    if (!el) return;

    const state  = (window.VState && VState.get) ? VState.get() : {};
    const loaded = state.filesLoaded && state.filesLoaded.length > 0;

    el.innerHTML = `
      <div style="padding:24px 28px;max-width:860px">
        <h2 style="font-size:20px;font-weight:700;color:#0B2545;margin:0 0 4px">IDS Checker</h2>
        <p style="color:#666;font-size:13px;margin:0 0 24px">
          Information Delivery Specification (IDS) validation - check your IFC model against a custom IDS XML requirements file
        </p>

        <!-- Step 1: Load IDS file -->
        <div style="background:#fff;border:1px solid #dde3ed;border-radius:10px;
                    padding:18px 20px;margin-bottom:14px">
          <div style="font-size:14px;font-weight:700;color:#0B2545;margin-bottom:6px">
            1. Load IDS File (.ids or .xml)
          </div>
          <p style="font-size:13px;color:#555;margin:0 0 14px;line-height:1.6">
            IDS (Information Delivery Specification) is an ISO 21597 standard format for specifying
            exactly what IFC data a building model must contain. Import an IDS file to validate your
            model against custom requirements beyond CORENET-X.
          </p>
          <button onclick="IdsPage.browseIds()"
                  style="background:#0B2545;color:#fff;border:none;border-radius:8px;
                         padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer;
                         display:inline-flex;align-items:center;gap:8px;transition:opacity .15s"
                  onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            <span>&#128193;</span> Browse for IDS File (.ids / .xml)
          </button>
          ${_idsName ? `
            <div style="margin-top:10px;font-size:13px;color:#00897b;display:flex;align-items:center;gap:6px">
              <span>&#10003;</span> <strong>${_idsName}</strong> loaded
            </div>` : ''}
        </div>

        <!-- Step 2: Run check -->
        <div style="background:#fff;border:1px solid #dde3ed;border-radius:10px;
                    padding:18px 20px;margin-bottom:14px">
          <div style="font-size:14px;font-weight:700;color:#0B2545;margin-bottom:6px">
            2. Run IDS Validation
          </div>
          ${!loaded ? `
            <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:6px;
                        padding:8px 12px;font-size:12px;color:#795548;margin-bottom:10px">
              Load an IFC file first.
            </div>` : ''}
          ${!_idsPath ? `
            <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:6px;
                        padding:8px 12px;font-size:12px;color:#795548;margin-bottom:10px">
              Select an IDS file above first.
            </div>` : ''}
          <button onclick="IdsPage.runCheck()"
                  ${(!_idsPath || !loaded || _running) ? 'disabled' : ''}
                  style="background:${(_idsPath && loaded && !_running) ? 'var(--teal,#00bfa5)' : '#b2dfdb'};
                         color:#fff;border:none;border-radius:8px;padding:10px 20px;
                         font-size:14px;font-weight:600;cursor:${(_idsPath && loaded && !_running) ? 'pointer' : 'not-allowed'};
                         display:inline-flex;align-items:center;gap:8px;transition:opacity .15s"
                  onmouseover="if(!this.disabled)this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
            ${_running ? '<span>Running...</span>' : '<span>&#9654;</span> Run IDS Check'}
          </button>
        </div>

        <!-- Results -->
        ${renderResults()}

        <!-- What is IDS -->
        <div style="background:#f0f7ff;border:1px solid #cce0ff;border-radius:10px;
                    padding:14px 18px;margin-top:14px;font-size:12px;color:#444;line-height:1.6">
          <strong>IDS format notes:</strong> IDS files are XML documents following the buildingSMART
          ISO 21597 schema. They define facets (entity, attribute, property, material, classification,
          part-of) that IFC elements must satisfy. Create IDS files with tools such as the
          buildingSMART IDS authoring tool or Xbim Toolkit.
          Learn more: <a href="https://github.com/buildingSMART/IDS" target="_blank"
                         style="color:var(--teal,#00bfa5)">github.com/buildingSMART/IDS</a>
        </div>
      </div>`;

    initListeners();
  }

  return { render, browseIds, runCheck };
})();
