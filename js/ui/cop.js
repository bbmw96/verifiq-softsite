// VERIFIQ - CORENET-X Code of Practice guidance (embedded, offline, no external AI)
// Copyright 2026 BBMW0 Technologies. All rights reserved.
//
// Asks VERIFIQ's own offline COP knowledge engine (BM25 retrieval + extractive answer)
// and renders the composed answer plus the cited COP clauses. Pure safe DOM, no innerHTML.

'use strict';

const CopReference = (() => {

  function search() {
    const inp = document.getElementById('cop-q');
    const out = document.getElementById('cop-results');
    if (!out) return;
    const q = (inp ? inp.value : '').trim();
    _clear(out);
    if (!q) return;
    out.appendChild(_note('Consulting the Code of Practice...'));
    if (window.VBridge && VBridge.send) VBridge.send('copAsk', { query: q });
  }

  function onAnswer(data) {
    const out = document.getElementById('cop-results');
    if (!out) return;
    _clear(out);

    if (!data || !data.indexed) {
      out.appendChild(_note('The Code of Practice is still downloading and indexing in the background. Please try again in a moment.'));
      return;
    }

    // The composed answer: real COP sentences with page citations, no AI generation.
    if (data.summary) {
      const box = document.createElement('div');
      box.style.cssText = 'border:1px solid var(--teal,#00c4a0);border-radius:8px;padding:12px 14px;margin-top:8px;background:rgba(0,196,160,.06)';
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--teal,#00c4a0);margin-bottom:6px';
      lbl.textContent = 'COP Answer' + (data.edition ? '  -  COP ' + data.edition : '') + '  -  offline, no AI';
      const body = document.createElement('div');
      body.style.cssText = 'font-size:12.5px;color:#cdd9e5;line-height:1.6';
      body.textContent = data.summary;
      box.appendChild(lbl);
      box.appendChild(body);
      out.appendChild(box);
    }

    const results = (data && data.results) || [];
    out.appendChild(_note(
      (results.length || 'No') + ' supporting clause' + (results.length === 1 ? '' : 's') +
      (results.length ? '  -  page numbers refer to the COP 3.1 PDF' : '')
    ));
    results.forEach(r => out.appendChild(_card(r)));
  }

  function _card(r) {
    const card = document.createElement('div');
    card.style.cssText = 'border:1px solid #1c2e44;border-radius:8px;padding:10px 12px;margin-top:8px;background:#0a1628';

    const top = document.createElement('div');
    top.style.cssText = 'display:flex;justify-content:space-between;gap:10px;align-items:baseline;margin-bottom:2px';
    const title = document.createElement('span');
    title.style.cssText = 'font-weight:700;color:#00c4a0;font-size:12px';
    title.textContent = r.title || ('Page ' + r.page);
    const page = document.createElement('span');
    page.style.cssText = 'font-size:11px;color:#5b7fa6;flex-shrink:0;font-family:monospace';
    page.textContent = 'p.' + r.page;
    top.appendChild(title);
    top.appendChild(page);
    card.appendChild(top);

    if (r.context) {
      const ctx = document.createElement('div');
      ctx.style.cssText = 'font-size:10px;color:#5b7fa6;margin-bottom:4px';
      ctx.textContent = r.context;
      card.appendChild(ctx);
    }

    const body = document.createElement('div');
    body.style.cssText = 'font-size:12px;color:#9fb3c8;line-height:1.55';
    body.textContent = (r.snippet || '').trim() + '...';
    card.appendChild(body);
    return card;
  }

  function _note(text) {
    const d = document.createElement('div');
    d.style.cssText = 'font-size:12px;color:#5b7fa6;margin-top:8px';
    d.textContent = text;
    return d;
  }

  function _clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  // Open the Help page COP guidance box, prefill a query and run it. Used by the
  // per-finding COP button so a finding can pull its exact COP guidance.
  function askFor(query) {
    if (window.App && App.navigate) App.navigate('help');
    setTimeout(() => {
      const inp = document.getElementById('cop-q');
      if (inp) { inp.value = query || ''; search(); }
      const card = inp ? inp.closest('.card') : null;
      if (card && card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  return { search, onAnswer, askFor };
})();

window.CopReference = CopReference;
