// VERIFIQ - Utility Helpers
// Copyright 2026 BBMW0 Technologies. All rights reserved.

'use strict';

const Utils = (() => {

  // ── HTML ESCAPING ──────────────────────────────────────────────────────────
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── SEVERITY BADGE ─────────────────────────────────────────────────────────
  function severityBadge(severity) {
    const cls = `badge badge-${(severity || 'info').toLowerCase()}`;
    return `<span class="${cls}">${esc(severity)}</span>`;
  }

  // ── AGENCY BADGE ───────────────────────────────────────────────────────────
  function agencyBadge(agency) {
    if (!agency || agency === 'None') return '';
    return `<span class="badge agency-${esc(agency)}">${esc(agency)}</span>`;
  }

  // ── ROW CLASS BY SEVERITY ──────────────────────────────────────────────────
  function rowClass(severity) {
    if (severity === 'Critical') return 'row-critical';
    if (severity === 'Error')    return 'row-error';
    return '';
  }

  // ── COUNTRY MODE DISPLAY ───────────────────────────────────────────────────
  function countryDisplay(mode) {
    const map = {
      Singapore: { label: '🇸🇬 Singapore: CORENET-X / IFC+SG', cls: 'mode-sg' },
      Malaysia:  { label: '🇲🇾 Malaysia: NBeS / UBBL 1984',    cls: 'mode-my' },
      Combined:  { label: '🌏 Singapore + Malaysia',             cls: 'mode-combined' },
    };
    return map[mode] || map['Singapore'];  // Always safe fallback
  }

  // ── SCORE COLOUR ───────────────────────────────────────────────────────────
  function scoreColour(score) {
    if (score >= 95) return 'green';
    if (score >= 80) return 'amber';
    return 'red';
  }

  // ── COMPACT GUID ──────────────────────────────────────────────────────────
  function shortGuid(guid) {
    if (!guid) return '-';
    return guid.length > 14 ? guid.slice(0, 8) + '…' + guid.slice(-4) : guid;
  }

  // ── NUMBER FORMAT ─────────────────────────────────────────────────────────
  function fmt(n) {
    return Number(n || 0).toLocaleString();
  }

  function pct(n) {
    return `${Number(n || 0).toFixed(1)}%`;
  }

  // ── SET INNER HTML SAFELY (replaces container) ────────────────────────────
  function render(containerId, html) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = html;
  }

  // ── EMPTY STATE BLOCK ──────────────────────────────────────────────────────
  function emptyState(icon, title, text, actionHtml = '') {
    return `
      <div class="empty-state">
        <div class="icon">${icon}</div>
        <h3>${esc(title)}</h3>
        <p>${esc(text)}</p>
        ${actionHtml}
      </div>`;
  }

  // ── FILTER TABLE ──────────────────────────────────────────────────────────
  function filterTable(tableId, filters) {
    const rows = document.querySelectorAll(`#${tableId} tbody tr`);
    rows.forEach(row => {
      let show = true;
      for (const [attr, val] of Object.entries(filters)) {
        if (val && (row.dataset[attr] || '').toLowerCase() !== val.toLowerCase()) {
          show = false; break;
        }
      }
      row.style.display = show ? '' : 'none';
    });
  }

  // ── SEARCH TABLE ──────────────────────────────────────────────────────────
  function searchTable(tableId, query) {
    const q = (query || '').toLowerCase();
    const rows = document.querySelectorAll(`#${tableId} tbody tr`);
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = !q || text.includes(q) ? '' : 'none';
    });
  }

  // ── PROGRESS BAR ──────────────────────────────────────────────────────────
  function progressBar(value, max = 100) {
    const pctVal = Math.min(100, (value / max) * 100);
    const col = pctVal >= 95 ? '#15803D' : pctVal >= 80 ? '#B45309' : '#B91C1C';
    return `
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" style="width:${pctVal.toFixed(1)}%;background:${col}"></div>
      </div>`;
  }

  // ── STAT CARD ─────────────────────────────────────────────────────────────
  function statCard(value, label, colourClass = '') {
    return `
      <div class="stat-card">
        <div class="stat-val ${colourClass}">${value}</div>
        <div class="stat-lbl">${esc(label)}</div>
      </div>`;
  }

  return {
    esc, severityBadge, agencyBadge, rowClass, countryDisplay,
    scoreColour, shortGuid, fmt, pct, render, emptyState,
    filterTable, searchTable, progressBar, statCard
  };
})();

window.VUtils = Utils;
