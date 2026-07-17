// VERIFIQ - COBie Exporter Page
// Copyright 2026 BBMW0 Technologies.
// Exports COBie data (spaces, equipment, components) from the loaded IFC model.

const CobiePage = (() => {

  let _status = '';

  // ── Bridge listeners ─────────────────────────────────────────────────────
  function initListeners() {
    if (window.Bridge && Bridge.on) {
      Bridge.on('cobieExportResult', (data) => {
        if (data.success) {
          _status = `<span style="color:#00897b">Exported: ${data.outputFile || 'COBie file saved.'}</span>`;
        } else {
          _status = `<span style="color:#c62828">Export failed: ${data.error || 'Unknown error'}</span>`;
        }
        // Re-render status area only
        const statusEl = document.getElementById('cobie-status');
        if (statusEl) statusEl.innerHTML = _status;
      });
    }
  }

  // ── Export button handlers ───────────────────────────────────────────────
  function exportExcel() {
    _status = '<span style="color:#888">Exporting COBie Excel...</span>';
    const statusEl = document.getElementById('cobie-status');
    if (statusEl) statusEl.innerHTML = _status;

    if (window.Bridge && Bridge.send) {
      Bridge.send('exportCobie', { format: 'xlsx' });
    } else if (window.chrome && chrome.webview) {
      chrome.webview.postMessage(JSON.stringify({ action: 'exportCobie', data: { format: 'xlsx' } }));
    }
  }

  function exportXml() {
    _status = '<span style="color:#888">Exporting COBie XML...</span>';
    const statusEl = document.getElementById('cobie-status');
    if (statusEl) statusEl.innerHTML = _status;

    if (window.Bridge && Bridge.send) {
      Bridge.send('exportCobie', { format: 'xml' });
    } else if (window.chrome && chrome.webview) {
      chrome.webview.postMessage(JSON.stringify({ action: 'exportCobie', data: { format: 'xml' } }));
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function render() {
    const el = document.getElementById('page-cobie');
    if (!el) return;

    // Check if a file is loaded
    const state  = (window.VState && VState.get) ? VState.get() : {};
    const loaded = state.filesLoaded && state.filesLoaded.length > 0;

    el.innerHTML = `
      <div style="padding:24px 28px;max-width:860px">
        <h2 style="font-size:20px;font-weight:700;color:#0B2545;margin:0 0 4px">COBie Exporter</h2>
        <p style="color:#666;font-size:13px;margin:0 0 24px">
          Export Construction Operations Building Information Exchange (COBie) data for asset management handover
        </p>

        <!-- Export card -->
        <div style="background:#fff;border:1px solid #dde3ed;border-radius:10px;padding:20px 22px;margin-bottom:16px">
          <div style="font-size:14px;font-weight:700;color:var(--teal,#00bfa5);margin-bottom:10px">COBie Export</div>
          <p style="font-size:13px;color:#555;margin:0 0 16px;line-height:1.6">
            COBie captures asset data from your IFC model for building operations and facility management.
            VERIFIQ extracts space, equipment, and component data from loaded IFC files.
          </p>

          ${!loaded ? `
            <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:6px;
                        padding:10px 14px;font-size:13px;color:#795548;margin-bottom:16px">
              Load an IFC file first before exporting COBie data.
            </div>` : ''}

          <!-- Export buttons -->
          <button onclick="CobiePage.exportExcel()"
                  style="width:100%;padding:12px 16px;background:${loaded ? 'var(--teal,#00bfa5)' : '#b2dfdb'};
                         color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;
                         cursor:${loaded ? 'pointer' : 'not-allowed'};display:flex;align-items:center;
                         gap:10px;margin-bottom:10px;text-align:left;transition:opacity .15s"
                  ${!loaded ? 'disabled' : ''}
                  onmouseover="if(!this.disabled)this.style.opacity='.88'"
                  onmouseout="this.style.opacity='1'">
            <span style="font-size:18px">&#127785;</span>
            Export COBie Excel (.xlsx)
          </button>

          <button onclick="CobiePage.exportXml()"
                  style="width:100%;padding:12px 16px;background:#fff;
                         color:${loaded ? '#0B2545' : '#aaa'};border:1px solid ${loaded ? '#dde3ed' : '#eee'};
                         border-radius:8px;font-size:14px;font-weight:600;
                         cursor:${loaded ? 'pointer' : 'not-allowed'};display:flex;align-items:center;
                         gap:10px;text-align:left;transition:opacity .15s"
                  ${!loaded ? 'disabled' : ''}
                  onmouseover="if(!this.disabled)this.style.background='#f5f7fa'"
                  onmouseout="this.style.background='#fff'">
            <span style="font-size:16px">&#128196;</span>
            Export COBie XML
          </button>

          <!-- Status feedback -->
          <div id="cobie-status" style="font-size:12px;margin-top:10px;min-height:18px">${_status}</div>
        </div>

        <!-- COBie info card -->
        <div style="background:#f0f7ff;border:1px solid #cce0ff;border-radius:10px;padding:16px 20px">
          <div style="font-size:13px;font-weight:700;color:#0B2545;margin-bottom:8px">What is COBie?</div>
          <div style="font-size:12px;color:#555;line-height:1.6">
            COBie (Construction Operations Building Information Exchange) is a data format for
            handing over building information from construction to facilities management.
            It captures spaces, equipment, components, and systems in a structured spreadsheet
            format accepted by facility management systems such as Maximo, Archibus, and Planon.
          </div>
          <div style="margin-top:10px;font-size:12px;color:#555">
            <strong>Extracted from IFC:</strong> IfcSpace &middot; IfcEquipment &middot;
            IfcFurnishingElement &middot; IfcDistributionElement &middot; IfcZone &middot; IfcSystem
          </div>
        </div>
      </div>`;

    initListeners();
  }

  return { render, exportExcel, exportXml };
})();
