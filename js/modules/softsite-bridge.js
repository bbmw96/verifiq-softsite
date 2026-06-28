// VERIFIQ - SoftSite web transport
// Copyright 2026 BBMW0 Technologies. All rights reserved.
//
// Bridges the (unchanged) desktop VERIFIQ UI to the Blazor WebAssembly engine. On the
// desktop the UI talks to a C# host over WebView2 postMessage; here, bridge.js routes
// VBridge.send -> window.__vqSend (below) -> the Blazor [JSInvokable] Send, and the
// engine pushes host->UI messages back through window.__vqReceive -> VBridge.receive.
(function () {
  'use strict';
  if (window.chrome && window.chrome.webview) return; // running in the desktop host; nothing to do

  var ready = false;
  var queue = [];

  function toBlazor(action, data) {
    DotNet.invokeMethodAsync('VERIFIQ.SoftSite', 'Send', action, JSON.stringify(data || {}))
      .catch(function (e) { console.error('[SoftSite] send failed:', action, e); });
  }

  // bridge.js send() calls this when there is no WebView2 host.
  window.__vqSend = function (action, data) {
    // Host-only concerns handled directly in the browser transport:
    if (action === 'openUrl' || action === 'openLink') {
      var u = data && (data.url || data.href); if (u) window.open(u, '_blank', 'noopener'); return;
    }
    if (action === 'openFile') { pickFiles(action); return; }
    if (action === 'openFileForImport') { pickImport((data && data.purpose) || 'industryMapping'); return; }
    if (action === 'openIdsFile') { pickImport('idsFile'); return; }
    if (!ready) { queue.push([action, data]); return; }
    toBlazor(action, data);
  };

  // Blazor flushes any queued messages once the .NET runtime has started.
  window.__vqBlazorReady = function () {
    ready = true;
    var q = queue; queue = [];
    q.forEach(function (m) { toBlazor(m[0], m[1]); });
    // Ship the pre-built COP knowledge index to the engine (the browser can't download or
    // PDF-ingest the CORENET-X COP the way the desktop does), so COP guidance works offline.
    fetch('data/cop-index.json').then(function (r) { return r.ok ? r.arrayBuffer() : null; })
      .then(function (buf) { if (buf) DotNet.invokeMethodAsync('VERIFIQ.SoftSite', 'LoadCopIndex', new Uint8Array(buf)); })
      .catch(function () {});
  };

  // Blazor delivers host->UI messages here; hand them to the UI's existing router.
  window.__vqReceive = function (json) {
    try { window.VBridge.receive(typeof json === 'string' ? JSON.parse(json) : json); }
    catch (e) { console.error('[SoftSite] receive failed:', e); }
  };

  // Browser file picker replaces the desktop's native Open dialog. Bytes are handed to
  // C# as a typed array (no base64), so even large IFC files stay efficient.
  function pickFiles(action) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ifc,.ifczip,.ifcxml,.ifcsg';
    input.multiple = (action !== 'openFileForImport');
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      var files = Array.prototype.slice.call(input.files || []);
      if (input.parentNode) input.parentNode.removeChild(input);
      files.forEach(function (f) { readFile(f, action === 'openFileForImport'); });
    });
    input.click();
  }

  function readFile(file, forImport) {
    var reader = new FileReader();
    reader.onload = function () {
      var bytes = new Uint8Array(reader.result);
      if (!forImport) {
        // Keep the raw IFC bytes so the 3D viewer's web-ifc engine can render the real
        // tessellated model client-side (the desktop fetched them from a virtual host URL).
        window.__vqIfcFiles = window.__vqIfcFiles || {};
        window.__vqIfcFiles[file.name] = bytes;
        window.__vqLastIfc = file.name;
      }
      DotNet.invokeMethodAsync('VERIFIQ.SoftSite', 'LoadFileBytes', file.name, bytes, !!forImport)
        .catch(function (e) { console.error('[SoftSite] file load failed:', e); });
    };
    reader.onerror = function () { console.error('[SoftSite] could not read file', file.name); };
    reader.readAsArrayBuffer(file);
  }

  // Import picker (industry-mapping Excel or IDS file). Unlike the IFC picker, the bytes
  // go to ImportFileBytes, which stages the file and emits fileSelectedForImport{path,purpose}.
  function pickImport(purpose) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = purpose === 'idsFile' ? '.ids,.xml' : '.xlsx,.xls';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      var f = (input.files || [])[0];
      if (input.parentNode) input.parentNode.removeChild(input);
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        DotNet.invokeMethodAsync('VERIFIQ.SoftSite', 'ImportFileBytes', f.name, new Uint8Array(reader.result), purpose)
          .catch(function (e) { console.error('[SoftSite] import failed:', e); });
      };
      reader.readAsArrayBuffer(f);
    });
    input.click();
  }

  // Blazor calls this to save a generated report as a browser download.
  window.__vqSaveFile = function (name, base64, mime) {
    var bin = atob(base64), len = bin.length, arr = new Uint8Array(len);
    for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    var blob = new Blob([arr], { type: mime || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name || 'verifiq-report';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 1500);
  };
})();
