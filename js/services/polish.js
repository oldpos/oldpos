/* Old POS polish (v12.9.0): small behaviours that remove everyday annoyances. No data is read or sent anywhere. */
(function () {
  'use strict';
  const doc = document;

  /* 1) Every <label class="label"> is tied to the field next to it: screen readers read it, and tapping the label focuses the field. */
  let n = 0;
  function tie(root) {
    (root || doc).querySelectorAll('label.label:not([for])').forEach(l => {
      if (l.querySelector('input,select,textarea')) return;
      let el = l.nextElementSibling, hop = 0;
      while (el && hop++ < 3 && !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el = el.querySelector ? el.querySelector('input,select,textarea') || el.nextElementSibling : null;
      if (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && el.type !== 'hidden' && el.type !== 'checkbox' && el.type !== 'radio') {
        if (!el.id) el.id = 'f-auto-' + (++n);
        l.setAttribute('for', el.id);
      }
    });
  }

  /* 2) Right on-screen keyboard + no browser autofill pop-up covering shop / product fields. */
  function hints(root) {
    (root || doc).querySelectorAll('input.input').forEach(i => {
      if (i.dataset.ph) return; i.dataset.ph = '1';
      const k = (i.id || '') + ' ' + (i.name || '') + ' ' + (i.getAttribute('placeholder') || '');
      if (!i.hasAttribute('autocomplete')) i.setAttribute('autocomplete', /e-?mail/i.test(k) ? 'email' : 'off');
      if (i.type === 'text' && /phone|mobile|\btel\b/i.test(k)) { i.setAttribute('inputmode', 'tel'); }
      if (i.type === 'number' && !i.hasAttribute('inputmode')) i.setAttribute('inputmode', i.step && i.step !== 'any' && +i.step >= 1 ? 'numeric' : 'decimal');
      if (i.type === 'text' || i.type === 'search') i.setAttribute('spellcheck', /name|addr|note|desc|foot/i.test(k) ? 'true' : 'false');
    });
  }

  /* 3) Scrolling the page with the mouse wheel while a number box is focused used to change its value (price, quantity, stock). */
  doc.addEventListener('wheel', e => { const t = doc.activeElement; if (t && t.type === 'number' && t === e.target) t.blur(); }, { passive: true, capture: true });

  /* 4) Settings → Shop: the example amount follows the currency symbol while typing. */
  doc.addEventListener('input', e => {
    const t = e.target; if (!t || t.id !== 'st-cur') return;
    const b = doc.querySelector('#st .field .xs.muted b'); if (b) b.textContent = (t.value || '').trim().slice(0, 4) + '1,250.50';
  });

  /* 5) A tap on the "saved to Google Drive" line reconnects when Google needs it. */
  doc.addEventListener('click', e => { const s = e.target.closest && e.target.closest('.save-state.off,.save-state.auth'); if (s && window.Cloud) Cloud.chip(); });

  /* 6) Tab key stays inside the open dialog (it used to wander to the page behind it). */
  doc.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const box = [].slice.call(doc.querySelectorAll('.ui-confirm-backdrop,.modal-back,.lock')).pop(); if (!box) return;
    const f = [].slice.call(box.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const a = doc.activeElement, first = f[0], last = f[f.length - 1];
    if (!box.contains(a)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && (a === first || a.getAttribute('tabindex') === '-1')) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  }, true);

  let t = null;
  function run() { tie(); hints(); }
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(run, 60); }).observe(doc.documentElement, { childList: true, subtree: true });
  if (doc.readyState !== 'loading') run(); else doc.addEventListener('DOMContentLoaded', run);
})();
