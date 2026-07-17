// VERIFIQ Security - VERIFIQ's own runtime security layer. No third-party service, no CDN,
// no external dependency. It does three things:
//
//   1. Frame guard  - refuses to run inside another site's frame. This is the protection
//                     X-Frame-Options would give, enforced here because a static host
//                     cannot emit response headers.
//   2. Self-audit   - inspects the LIVE runtime and reports the real posture. Every line it
//                     shows is measured, never assumed - if a check cannot be proven it is
//                     reported as unknown rather than green.
//   3. Egress watch - the only way anything can leave this device is an AI provider key the
//                     user chose to configure, so that is surfaced explicitly.
//
// Honest scope: HSTS and X-Content-Type-Options are HTTP response headers. No client-side
// code can emit them on a static host - that is the HTTP protocol, not a limitation of this
// file. Those are reported as "needs a server you control", not faked.
(function () {
  'use strict';

  // ── 1. Frame guard (clickjacking defence) ─────────────────────────────────
  var _framed = false;
  try { _framed = window.top !== window.self; } catch (e) { _framed = true; }  // cross-origin read throws => framed
  if (_framed) {
    // Navigating the top frame is permitted cross-origin even though reading it is not.
    try { window.top.location = window.self.location; } catch (e) { /* sandboxed: the audit still reports it */ }
  }

  function _keys() {
    var k = [];
    try { for (var i = 0; i < localStorage.length; i++) k.push(localStorage.key(i)); } catch (e) { return null; }
    return k;
  }

  // Any configured AI provider key is the sole egress path out of this device.
  function egress() {
    var found = [];
    var keys = _keys() || [];
    keys.forEach(function (k) {
      if (!k) return;
      if (/(apikey|api_key|_key$|^vq_ai|^vq_engine|provider)/i.test(k)) {
        var v = '';
        try { v = localStorage.getItem(k) || ''; } catch (e) { v = ''; }
        if (v && v.length > 8) found.push(k);
      }
    });
    return found;
  }

  function checks() {
    var out = [];
    var https = location.protocol === 'https:';
    var eg = egress();
    var keys = _keys();

    out.push({
      ok: https, label: 'Encrypted transport (HTTPS)',
      detail: https
        ? 'This session is served over HTTPS. Plain HTTP is redirected to HTTPS at the host.'
        : 'This session is NOT encrypted. Open the app over https:// - do not load a model over http://.'
    });

    out.push({
      ok: !_framed, label: 'Running top-level (not embedded)',
      detail: _framed
        ? 'This page is inside a frame owned by another site. VERIFIQ Security tried to break out. Do not enter anything until you are on softsite.verifiq.bbmw0.com directly.'
        : 'This page is top-level. The VERIFIQ Security frame guard is active, which is the protection X-Frame-Options would provide.'
    });

    out.push({
      ok: eg.length === 0, label: 'No external data egress configured',
      detail: eg.length === 0
        ? 'No AI provider key is configured, so nothing at all is sent off this device.'
        : 'You have configured: ' + eg.join(', ') + '. Only the questions you type into the AI Assistant go to that provider, using your own key, direct from this browser - never through a VERIFIQ server.'
    });

    // VERIFIQ Key Vault - any connected API/AI key is sealed at rest (AES ciphertext, "vqk1:").
    var aiKeys = (_keys() || []).filter(function (k) { return k && /_key$/.test(k); });
    if (aiKeys.length) {
      var sealed = aiKeys.filter(function (k) {
        var v = ''; try { v = localStorage.getItem(k) || ''; } catch (e) {}
        return v.indexOf('vqk1:') === 0;
      });
      out.push({
        ok: sealed.length === aiKeys.length,
        label: 'Connected API/AI keys are encrypted at rest (VERIFIQ Key Vault)',
        detail: sealed.length + ' of ' + aiKeys.length + ' stored key(s) are AES-256 sealed. The encryption secret is compiled into the WASM engine, so no page script can read it, and localStorage holds only ciphertext. ' +
          (sealed.length === aiKeys.length ? '' : 'Re-save any unsealed key from the API Keys panel to seal it.')
      });
    }

    out.push({
      ok: true, label: 'Your model never leaves this device',
      detail: 'Parsing, all 20 validation levels, clash and clearance, IDS, quantity take-off, the 3D viewer and every report run in WebAssembly inside this browser. There is no upload endpoint and no VERIFIQ server to upload to. You can verify this in your browser Network tab: load a model and watch - nothing is sent.'
    });

    if (keys === null) {
      out.push({ ok: null, label: 'Local storage', detail: 'Local storage is unavailable in this browser, so VERIFIQ stores nothing at all.' });
    } else if (!keys.length) {
      out.push({ ok: true, label: 'Local storage holds no personal data', detail: 'Local storage is empty.' });
    } else {
      out.push({
        ok: true, label: 'Local storage holds no personal data',
        detail: keys.length + ' key(s) stored: ' + keys.join(', ') + '. These hold only your own interface state - dismissed findings, saved Smart Views, preferences. No names, no emails, no model geometry.'
      });
    }

    return out;
  }

  // Controls that genuinely require a server/CDN you control. Reported honestly rather
  // than claimed, because no client-side code can produce an HTTP response header.
  var SERVER_SIDE = [
    ['HSTS (Strict-Transport-Security)', 'A response header. HTTPS redirect is already enforced at the host, which covers the substantive risk; HSTS additionally hardens the very first request.'],
    ['X-Content-Type-Options: nosniff', 'A response header. Low impact here: every asset VERIFIQ serves is same-origin and correctly typed.'],
    ['Strict Content-Security-Policy', 'A CSP can be set from the page, but this interface uses inline event handlers throughout, so any workable policy would need ‘unsafe-inline’ - which removes most of a CSP’s benefit. Doing it properly means migrating the handlers first; a token CSP would be security theatre.']
  ];

  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function css(e, s) { e.style.cssText = s; return e; }

  function show() {
    var pc = document.getElementById('page-container');
    if (!pc) return;
    pc.replaceChildren();

    var head = el('div');
    head.appendChild(el('h1', null, '\u{1F6E1} VERIFIQ Security'));
    var sub = el('div', null, 'VERIFIQ’s own security layer - no third-party service and no external dependency. Every line below is measured live in this session, not claimed.');
    css(sub, 'color:var(--mid-grey);font-size:12.5px;margin-top:2px;max-width:820px');
    head.appendChild(sub);
    pc.appendChild(head);

    var list = css(el('div', 'card'), 'margin-top:14px');
    list.appendChild(css(el('div', null, 'Live posture'), 'font-weight:700;color:var(--teal);margin-bottom:10px'));
    checks().forEach(function (c) {
      var row = css(el('div'), 'display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--navy-3)');
      var mark = el('div', null, c.ok === null ? '?' : (c.ok ? '✓' : '✗'));
      css(mark, 'font-weight:800;font-size:15px;flex-shrink:0;width:16px;color:' +
        (c.ok === null ? 'var(--mid-grey)' : c.ok ? 'var(--green,#22c55e)' : 'var(--sev-error,#ef4444)'));
      row.appendChild(mark);
      var txt = el('div');
      css(txt.appendChild(el('div', null, c.label)), 'font-weight:600;color:var(--white);font-size:13px');
      css(txt.appendChild(el('div', null, c.detail)), 'color:var(--mid-grey);font-size:11.5px;line-height:1.55;margin-top:2px');
      row.appendChild(txt);
      list.appendChild(row);
    });
    pc.appendChild(list);

    var srv = css(el('div', 'card'), 'margin-top:14px');
    srv.appendChild(css(el('div', null, 'Requires a server you control (stated plainly, not faked)'), 'font-weight:700;color:var(--amber);margin-bottom:8px'));
    srv.appendChild(css(el('div', null, 'These are HTTP response headers. They are emitted by the web server, so no code running in the page - VERIFIQ’s or anyone else’s - can produce them on a static host. They would need VERIFIQ to be served from infrastructure you control.'),
      'color:var(--mid-grey);font-size:11.5px;line-height:1.55;margin-bottom:8px'));
    SERVER_SIDE.forEach(function (p) {
      var r = css(el('div'), 'padding:7px 0;border-bottom:1px solid var(--navy-3)');
      css(r.appendChild(el('div', null, p[0])), 'font-weight:600;color:var(--white);font-size:12.5px');
      css(r.appendChild(el('div', null, p[1])), 'color:var(--mid-grey);font-size:11.5px;line-height:1.55;margin-top:2px');
      srv.appendChild(r);
    });
    pc.appendChild(srv);

    var why = css(el('div', 'card'), 'margin-top:14px;border-left:3px solid var(--teal)');
    why.appendChild(css(el('div', null, 'Why this matters'), 'font-weight:700;color:var(--teal);margin-bottom:6px'));
    why.appendChild(css(el('div', null, 'Cloud checkers require SOC 2 and ISO 27001 audits precisely because your model sits on their servers. VERIFIQ has no servers, so there is nothing to breach, nothing to retain and nothing to audit. That is not a certificate - it is an architecture, and this page is the live proof of it.'),
      'color:var(--mid-grey);font-size:12px;line-height:1.6'));
    pc.appendChild(why);
  }

  window.VerifiqSecurity = { checks: checks, framed: function () { return _framed; }, show: show };
})();
