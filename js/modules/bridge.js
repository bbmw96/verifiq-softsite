// VERIFIQ - WebView2 Bridge
// Copyright 2026 BBMW0 Technologies. All rights reserved.

'use strict';

const Bridge = (() => {
  function send(action, data = {}) {
    if (window.chrome && window.chrome.webview) {
      // Always send as a JSON string. This is supported by ALL WebView2 versions.
      // The C# handler unwraps the outer string encoding before deserialising.
      window.chrome.webview.postMessage(JSON.stringify({ action, data }));
    } else if (window.__vqSend) {
      // VERIFIQ - SoftSite (web): route to the Blazor WebAssembly engine instead.
      window.__vqSend(action, data);
    }
  }

  function init() {
    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.addEventListener('message', e => {
        try {
          const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          handleIncoming(msg);
        } catch (err) {
          console.warn('[Bridge] Failed to parse incoming message:', err);
        }
      });
    }
    send('requestState');
  }

  function handleIncoming(msg) {
    if (!msg || !msg.action) return;
    const { action, data } = msg;

    switch (action) {

      case 'stateUpdate':
        VState.set({
          countryMode:    data.countryMode    || 'Singapore',
          sgGateway:      data.sgGateway      || 'Construction',
          myPurposeGroup: data.myPG           || 'All',
          filesLoaded:    data.filesLoaded    || [],
          hasResults:     !!data.hasResults,
          score:          data.score          || 0,
          licence:        data.licence        || 'Trial',
        });
        break;

      case 'countryModeChanged':
        VState.set({ countryMode: data.mode, hasResults: false, session: null });
        App.refresh();
        break;

      case 'filesLoaded':
        VState.set({
          filesLoaded:  data.files || [],
          inventory:    data.inventory || [],
          elements:     data.elements || [],
          hasResults:   false,
          session:      null,
          score:        0,
        });
        // Stay on merge page when adding discipline files from there; otherwise go to files page
        if (VState.get().currentPage === 'merge') {
          App.refresh();
        } else {
          App.navigate('files');
        }
        break;

      case 'validationStarted':
        VState.set({ loading: true, hasResults: false, session: null });
        App.refresh();
        break;

      case 'elementSeverities':
        // Full element severity map (guid → severity string) for 3D viewer colouring.
        // Separate from validationComplete findings which are capped at 500.
        VState.set({ elementSeverities: data.map || {} });
        if (window.Viewer3DPage) Viewer3DPage.refreshColours();
        break;

      case 'modelData':
        // Element geometry from C# - bounding boxes for every IFC element.
        // Store in VState then feed to the 3D viewer immediately if it is open.
        VState.set({ elements3d: data.elements || [] });
        if (window.Viewer3DPage) Viewer3DPage.loadElements();
        break;

      case 'validationComplete':
        // Merge data and design findings into unified session object
        VState.set({
          hasResults:   true,
          loading:      false,
          session:      data,
          score:        data.score        || 0,
          designScore:  data.designScore  || null,
          overallScore: data.overallScore || data.score || 0,
        });
        // Recolour the 3D viewer with compliance results (if already open)
        if (window.Viewer3DPage) Viewer3DPage.refreshColours();
        App.navigate('results');
        break;

      case 'validationProgress':
        // Live update of validation progress bar in the JS Validation page
        VState.set({ validationProgress: data });
        (function() {
          const bar = document.getElementById('val-progress-bar');
          const lbl = document.getElementById('val-progress-label');
          if (bar) bar.style.width = (data.pct || 0) + '%';
          if (lbl) lbl.textContent = data.step || '';
        })();
        break;

      case 'validationCancelled':
        VState.set({ loading: false });
        App.refresh();
        break;

      case 'validationFailed':
        VState.set({ loading: false });
        App.refresh();
        break;

      case 'ifcFileUrl':
        // C# sent a virtual host URL for the IFC file - pass to viewer
        if (window.Viewer3DPage && Viewer3DPage.onIfcFileUrl)
          Viewer3DPage.onIfcFileUrl(data);
        break;

      case 'ifcFileData':
        // C# responds with base64 IFC file data for the 3D viewer
        if (window.Viewer3DPage) Viewer3DPage.onIfcData(data);
        break;

      case 'networkStatus':
        VState.set({ online: data.online, proxySettings: data });
        App.refresh();
        break;

      case 'settingsChanged':
        // C# confirmed a gateway or purpose-group change - update VState and
        // re-render the settings page so the new selection is highlighted.
        if (data.sgGateway) VState.set({ sgGateway: data.sgGateway });
        if (data.myPG)      VState.set({ myPurposeGroup: data.myPG });
        App.refresh();
        break;

      case 'licenceActivated':
        VState.set({ licence: data.tier || 'Unknown' });
        App.navigate('licence');
        break;

      case 'licenceError':
        // Show the error inline - no alert dialog needed since the Licence
        // page input form handles error display itself.
        if (window._licenceErrorCallback) window._licenceErrorCallback(data.message);
        break;

      case 'navigateToPage':
        // C# sidebar button pressed - navigate the JS router without WebView reload.
        if (data && data.page) App.navigate(data.page);
        break;

      case 'updateAvailable':
        // Non-intrusive update banner shown at the top of the page.
        if (window._showUpdateBanner) window._showUpdateBanner(data);
        break;

      case 'propertyEditsApplied':
        if (window.PropertyEditor) PropertyEditor.onEditsApplied(data);
        break;

      case 'updateDownloadProgress':
        // Show download progress in the update banner
        (function() {
          const el = document.getElementById('vq-update-progress');
          if (!el) return;
          if (data.pct < 0) {
            el.innerHTML = '<span style="color:#ef4444">Download failed. <button onclick="VBridge.send(\'openUrl\',{url:\'https://bbmw0.com/verifiq\'})" style="background:transparent;border:none;color:#60a5fa;cursor:pointer;text-decoration:underline">Download manually</button></span>';
            return;
          }
          el.innerHTML = '<div style="display:flex;align-items:center;gap:8px">' +
            '<div style="flex:1;height:4px;background:#1a2840;border-radius:2px">' +
            '<div style="height:100%;background:#F59E0B;width:' + data.pct + '%;transition:width .3s;border-radius:2px"></div></div>' +
            '<span style="font-size:11px;color:#fde68a">' + (data.status||'') + '</span></div>';
        })();
        break;

      case 'noUpdateFound':
        // Show brief "up to date" message in settings if open
        (function() {
          var btn = document.getElementById('update-check-btn');
          if (btn) {
            btn.textContent = '✓ Up to date (v' + (data.current||'') + ')';
            btn.style.background = '#22c55e';
            btn.style.color = '#000';
            btn.disabled = false;
            setTimeout(function(){
              btn.textContent = '🔄 Check for Updates';
              btn.style.background = '';
              btn.style.color = '';
            }, 4000);
          }
          // Also show a brief banner at bottom of screen
          var msg = document.createElement('div');
          msg.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;background:#052e16;border:1px solid #22c55e;border-radius:8px;padding:10px 16px;font-size:12px;color:#86efac;box-shadow:0 8px 24px rgba(0,0,0,.5)';
          msg.textContent = '✓ ' + (data.message || 'VERIFIQ is up to date.');
          document.body.appendChild(msg);
          setTimeout(function(){ if(msg.parentNode) msg.parentNode.removeChild(msg); }, 4000);
        })();
        break;

      case 'rulesUpdateAvailable':
        // COP rules update is available - show banner in Settings
        (function() {
          window._rulesUpdate = data;
          var banner = document.getElementById('rules-update-banner');
          if (banner) {
            banner.style.display = 'block';
            var msg = banner.querySelector('.rules-update-msg');
            if (msg) msg.textContent = data.message || ('COP ' + data.copVersion + ' (' + data.copDate + ') rules update available.');
          }
        })();
        break;

      case 'rulesUpToDate':
        (function() {
          var btn = document.getElementById('rules-check-btn');
          if (btn) {
            btn.textContent = 'Rules Up to Date';
            btn.disabled = true;
            setTimeout(function() { btn.textContent = 'Check for Rules Update'; btn.disabled = false; }, 3000);
          }
          var status = document.getElementById('rules-update-status');
          if (status) {
            status.textContent = data.message || 'Rules are up to date.';
            status.className = 'rules-status-ok';
          }
        })();
        break;

      case 'rulesUpdateProgress':
        (function() {
          var btn = document.getElementById('rules-check-btn');
          if (btn) { btn.textContent = data.message || 'Checking...'; btn.disabled = true; }
        })();
        break;

      case 'rulesUpdateComplete':
        (function() {
          var btn = document.getElementById('rules-check-btn');
          if (btn) { btn.textContent = 'Rules Updated'; btn.disabled = false; }
          var status = document.getElementById('rules-update-status');
          if (status) {
            status.textContent = data.message || ('Rules updated to COP ' + data.copVersion);
            status.className = 'rules-status-ok';
          }
          var banner = document.getElementById('rules-update-banner');
          if (banner) banner.style.display = 'none';
          // Refresh the rules version display
          VBridge.send('getRulesVersion', {});
        })();
        break;

      case 'rulesUpdateError':
        (function() {
          var btn = document.getElementById('rules-check-btn');
          if (btn) { btn.textContent = 'Check for Rules Update'; btn.disabled = false; }
          var status = document.getElementById('rules-update-status');
          if (status) {
            status.textContent = data.message || 'Update check failed.';
            status.className = 'rules-status-error';
          }
        })();
        break;

      case 'rulesVersion':
        (function() {
          var el = document.getElementById('rules-version-info');
          if (!el) return;
          el.innerHTML =
            '<span class="rv-label">COP Version:</span> <span class="rv-val">' + (data.copVersion||'3.1') + '</span>' +
            ' &nbsp;|&nbsp; ' +
            '<span class="rv-label">Edition:</span> <span class="rv-val">' + (data.copEditionDate||'2025-12') + '</span>' +
            ' &nbsp;|&nbsp; ' +
            '<span class="rv-label">Codes:</span> <span class="rv-val">' + (data.totalCodes||'196') + '</span>' +
            ' &nbsp;|&nbsp; ' +
            '<span class="rv-label">Properties:</span> <span class="rv-val">' + (data.totalProperties||'946') + '</span>' +
            ' &nbsp;|&nbsp; ' +
            '<span class="rv-label">Source:</span> <span class="rv-src">' + (data.installedFrom||'embedded') + '</span>';
        })();
        break;


      case 'updateDeferred':
        (function() {
          const el = document.getElementById('update-banner');
          if (el) {
            el.innerHTML = '<div style="background:#0f2035;border-bottom:1px solid #F59E0B;padding:6px 20px;font-size:11px;color:#fde68a">' +
              '⏰ ' + (data.message||'Update deferred to next close') + '</div>';
            setTimeout(() => { if(el) el.innerHTML=''; }, 5000);
          }
        })();
        break;

      case 'executiveSummary':
        if (window.DashboardPage && DashboardPage.onExecutiveSummary)
          DashboardPage.onExecutiveSummary(data);
        break;

      case 'fileSelectedForImport':
        if (data.purpose === 'industryMapping' && window.RulesDbPage)
          RulesDbPage.importFile(data.path);
        break;

      case 'industryMappingResult':
        if (window.RulesDbPage && RulesDbPage.onImportResult)
          RulesDbPage.onImportResult(data);
        break;

      case 'propertyEditResult':
        // IFC Property Editor result - show confirmation or error
        if (window.PropertyEditor && PropertyEditor.onResult)
          PropertyEditor.onResult(data);
        break;

      // macOS: no native ExportWindow - host sends this to trigger in-page picker.
      // Windows host never sends this; the case is a harmless no-op on Windows.
      case 'showExportPicker':
        showExportPickerModal();
        break;

      case 'exportComplete':
        closeExportPickerModal();
        break;

      case 'exportError':
        closeExportPickerModal();
        if (data && data.message) console.error('[VERIFIQ] Export failed:', data.message);
        break;

      case 'elementProperties':
        // Full property sets + actual values for a clicked element (property inspector).
        if (window.ResultsPage && ResultsPage.onElementProperties)
          ResultsPage.onElementProperties(data);
        if (window.AttributesPage && AttributesPage.onElementProperties)
          AttributesPage.onElementProperties(data);
        break;

      case 'copAnswer':
        // CORENET-X Code of Practice guidance: composed answer + cited clauses.
        if (window.CopReference && CopReference.onAnswer)
          CopReference.onAnswer(data);
        break;

      default:
        console.debug('[Bridge] unhandled action:', action);
    }
  }

  // -- macOS export format picker modal ---------------------------------------
  // Rendered entirely with safe DOM construction - no innerHTML with dynamic content.

  function showExportPickerModal() {
    if (document.getElementById('_vq-export-modal')) return;

    var formats = [
      { id: 'Excel', label: 'Excel (.xlsx)',     icon: 'XL' },
      { id: 'PDF',   label: 'PDF Report (.html)', icon: 'PD' },
      { id: 'Word',  label: 'Word (.docx)',        icon: 'WD' },
      { id: 'CSV',   label: 'CSV (.csv)',           icon: 'CS' },
      { id: 'HTML',  label: 'HTML Report',          icon: 'HT' },
      { id: 'JSON',  label: 'JSON (.json)',          icon: '{}' },
      { id: 'BCF',   label: 'BCF (.bcf)',           icon: 'BC' },
    ];

    var overlay = document.createElement('div');
    overlay.id = '_vq-export-modal';
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.75);' +
      'display:flex;align-items:center;justify-content:center;z-index:9999;';

    var card = document.createElement('div');
    card.style.cssText =
      'background:#0d1b35;border:1px solid rgba(255,255,255,.12);' +
      'border-radius:12px;padding:28px;width:340px;max-width:90vw;';

    var hdr = document.createElement('div');
    hdr.style.cssText =
      'display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;';

    var titleEl = document.createElement('span');
    titleEl.style.cssText = 'color:#fff;font-size:18px;font-weight:700;';
    titleEl.textContent = 'Export Report';

    var closeEl = document.createElement('button');
    closeEl.style.cssText =
      'background:none;border:none;color:#94a3b8;font-size:22px;cursor:pointer;' +
      'line-height:1;padding:0;';
    closeEl.textContent = '\xD7';
    closeEl.addEventListener('click', closeExportPickerModal);

    hdr.appendChild(titleEl);
    hdr.appendChild(closeEl);
    card.appendChild(hdr);

    formats.forEach(function(f) {
      var btn = document.createElement('button');
      btn.style.cssText =
        'display:flex;align-items:center;gap:12px;width:100%;padding:12px 16px;' +
        'margin-bottom:8px;background:#0b1f45;' +
        'border:1px solid rgba(255,255,255,.1);border-radius:8px;' +
        'color:#fff;font-size:14px;cursor:pointer;text-align:left;';

      var badge = document.createElement('span');
      badge.style.cssText =
        'font-size:11px;font-weight:700;background:#1e3a6e;color:#93c5fd;' +
        'border-radius:4px;padding:2px 5px;min-width:28px;text-align:center;';
      badge.textContent = f.icon;

      var lbl = document.createElement('span');
      lbl.textContent = f.label;

      btn.appendChild(badge);
      btn.appendChild(lbl);

      (function(formatId) {
        btn.addEventListener('click', function() {
          send('exportWithFormat', { format: formatId });
        });
      }(f.id));

      card.appendChild(btn);
    });

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  function closeExportPickerModal() {
    var el = document.getElementById('_vq-export-modal');
    if (el) el.parentNode.removeChild(el);
  }

  const openFile         = ()       => send('openFile');
  const removeFile       = name     => send('removeFile',        { name });
  const sendIfcForViewer = name     => send('sendIfcForViewer',  { name });
  const runValidate      = ()       => send('runValidation');
  const exportReport     = ()       => send('export');
  const exportWithFormat = format   => send('exportWithFormat',  { format });
  const setMode          = mode     => send('setCountryMode',    { mode });
  const setGateway       = gw       => send('setGateway',        { gateway: gw });
  const setPG            = pg       => send('setPurposeGroup',   { pg });
  const navigateTo       = page     => send('navigateTo',        { page });
  const saveProxy        = cfg      => send('saveProxySettings', cfg);
  const downloadXeokit   = ()       => send('downloadXeokit');
  const getElementProperties = guid => send('getElementProperties', { guid });

  const runValidation = runValidate;  // alias
  return {
    init, send, receive: handleIncoming,
    openFile, removeFile, sendIfcForViewer,
    runValidate, runValidation,
    exportReport, exportWithFormat,
    setMode, setGateway, setPG,
    navigateTo, saveProxy, downloadXeokit, getElementProperties,
    closeExportPickerModal,
  };
})();

window.VBridge = Bridge;
