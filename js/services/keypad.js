/* Old POS Secure Keypad (v12.6.0)
   Every PIN / password field in the app (home-screen PIN, Admin PIN, set / change / remove / reset) is typed on an
   on-screen keypad instead of the phone's keyboard:
   - the system keyboard never opens, so no keyboard app, autofill, clipboard history or predictive text can see a PIN;
   - the fields are read-only, so a PIN cannot be pasted in or dragged in;
   - a hardware keyboard still works (0-9, Backspace, Enter) for desktop use;
   - optional "Scramble keypad" (Settings -> Security) shuffles the digit positions every time, defeating shoulder-surfing and smudge guessing.
   Nothing here stores or sends any PIN. */
(function () {
  'use strict';
  const SEL = 'input[data-pin],input[type="password"]';
  const isPin = el => !!el && el.tagName === 'INPUT' && el.matches && el.matches(SEL);
  const scramble = () => { try { return !!(window.Core && Core.DB.settings.keypadShuffle); } catch (_) { return false; } };

  function shuffled() {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
    if (!scramble()) return a;
    const r = new Uint32Array(a.length); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(r) : r.forEach((_, i) => r[i] = Math.random() * 4294967296);
    for (let i = a.length - 1; i > 0; i--) { const j = r[i] % (i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function harden(el) {
    if (el.__pk) return; el.__pk = true;
    el.readOnly = true;                                   // no paste, no drop, no system keyboard
    el.setAttribute('inputmode', 'none');
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('autocorrect', 'off'); el.setAttribute('autocapitalize', 'off'); el.setAttribute('spellcheck', 'false');
    el.setAttribute('data-pin', '1'); el.setAttribute('aria-haspopup', 'true');
    if (!el.getAttribute('maxlength')) el.setAttribute('maxlength', '4');
    el.classList.add('pk-field');
    if (!el.getAttribute('placeholder')) el.setAttribute('placeholder', '••••');
    el.addEventListener('contextmenu', e => e.preventDefault());
  }

  const hostOf = el => el.closest('.modal-body') || el.closest('.modal-sheet') || el.parentElement;
  const fieldsIn = host => Array.prototype.filter.call(host.querySelectorAll(SEL), f => !f.disabled && f.offsetParent !== null);

  function build(host) {
    const p = document.createElement('div'); p.className = 'pk'; p.setAttribute('role', 'group'); p.setAttribute('aria-label', 'Secure PIN keypad');
    p.innerHTML = '<div class="pk-bar"><i class="fas fa-shield-halved" aria-hidden="true"></i><span>Secure keypad</span></div><div class="pk-grid"></div>';
    host.appendChild(p); layout(p); return p;
  }
  function layout(p) {
    const d = shuffled(), g = p.querySelector('.pk-grid');
    const key = (v, label, cls, aria) => '<button type="button" class="pk-key ' + (cls || '') + '" data-k="' + v + '"' + (aria ? ' aria-label="' + aria + '"' : '') + '>' + label + '</button>';
    g.innerHTML = d.slice(0, 9).map(n => key(n, n)).join('') +
      key('clear', 'Clear', 'pk-fn', 'Clear') + key(d[9], d[9]) + key('back', '\u232B', 'pk-fn', 'Backspace');
  }

  function activate(inp) {
    if (!isPin(inp) || inp.disabled) return;
    harden(inp);
    const host = hostOf(inp); if (!host) return;
    let p = host.querySelector(':scope > .pk'); if (!p) p = build(host);
    host.querySelectorAll('.pk-active').forEach(x => x.classList.remove('pk-active'));
    inp.classList.add('pk-active'); p.__t = inp;
    if (!p.__bound) {
      p.__bound = true;
      p.addEventListener('pointerdown', e => { if (e.target.closest('.pk-key')) e.preventDefault(); });   // keep focus where it is
      p.addEventListener('click', e => { const b = e.target.closest('.pk-key'); if (b) press(p, b.dataset.k); });
    }
  }

  function press(p, k) {
    const inp = p.__t; if (!inp || !inp.isConnected) return;
    const max = parseInt(inp.getAttribute('maxlength'), 10) || 4;
    if (k === 'back') inp.value = inp.value.slice(0, -1);
    else if (k === 'clear') inp.value = '';
    else if (/^\d$/.test(k) && inp.value.length < max) inp.value += k;
    else return;
    try { inp.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    if (k !== 'back' && k !== 'clear' && inp.value.length >= max) {            // field complete: jump to the next empty PIN field
      const host = hostOf(inp), all = fieldsIn(host), i = all.indexOf(inp), nxt = all.slice(i + 1).find(f => !f.value);
      if (nxt) { activate(nxt); try { nxt.focus({ preventScroll: true }); } catch (_) {} }
    }
  }

  /* Taps / focus on a PIN field open the keypad (and never the system keyboard) */
  document.addEventListener('focusin', e => { if (isPin(e.target)) { activate(e.target); if (e.target.__pk) e.target.setAttribute('inputmode', 'none'); } }, true);
  document.addEventListener('pointerdown', e => { const t = e.target; if (isPin(t)) activate(t); }, true);

  /* Hardware keyboard: digits, Backspace, Enter (click the dialog's main button). Handled before the barcode-scanner listener. */
  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const ae = document.activeElement; if (!isPin(ae)) return;
    const host = hostOf(ae), p = host && host.querySelector(':scope > .pk'); if (!p) return;
    if (p.__t !== ae) activate(ae);
    if (/^\d$/.test(e.key)) { e.preventDefault(); e.stopPropagation(); press(p, e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); press(p, 'back'); }
    else if (e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); press(p, 'clear'); }
    else if (e.key === 'Enter') {
      const sheet = ae.closest('.modal-sheet'), b = sheet && sheet.querySelector('.modal-foot .btn-primary,.modal-foot .btn-bad');
      if (b) { e.preventDefault(); e.stopPropagation(); b.click(); }
    }
  }, true);

  /* Fields created later (dialogs are built on demand): harden them as soon as they appear */
  function sweep(root) { if (root.querySelectorAll) root.querySelectorAll(SEL).forEach(harden); }
  function openFirst(n) {                                     // a dialog with PIN fields shows its keypad straight away
    const first = n.querySelector && n.querySelector(SEL); if (!first) return;
    const host = hostOf(first); if (host && !host.querySelector(':scope > .pk')) { activate(first); try { first.focus({ preventScroll: true }); } catch (_) {} }
  }
  new MutationObserver(ms => { ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) { if (isPin(n)) harden(n); sweep(n); if (n.classList && n.classList.contains('modal-back')) openFirst(n); } })); })
    .observe(document.documentElement, { childList: true, subtree: true });
  sweep(document);

  window.Keypad = {
    /* Re-scramble the digits of every open keypad (called after a wrong PIN) */
    refresh() { document.querySelectorAll('.pk').forEach(layout); },
    shuffled, scramble,
    setScramble(on) { try { Core.DB.settings.keypadShuffle = !!on; Core.save('settings'); Core.toast(on ? 'Keypad digits will be scrambled' : 'Keypad digits in normal order'); } catch (_) {} },
    /* Shared by the full-screen lock: returns the digit order to draw */
    digits: shuffled
  };
})();
