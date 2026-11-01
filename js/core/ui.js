/* Old POS UI: sound, dialogs, modals, theme, share/print helpers */
(function () {
  'use strict';
  const { DB, esc, toast, saveAll, K } = Core;
  const Sound = (function () {
    let ctx = null, last = 0;
    let enabled = true; try { enabled = localStorage.getItem('esypos_sound') !== '0'; } catch (_) {}
    function ensure() {
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(f, at, dur, vol) {
      const t0 = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + dur + 0.03);
    }
    function play(kind) {
      if (!enabled || !kind) return;
      const now = Date.now(); if (kind === 'click' && now - last < 40) return; last = now;
      if (!ensure()) return;
      try {
        if (kind === 'click') { tone(1568, 0, 0.14, 0.045); tone(2349, 0.03, 0.12, 0.022); }
        else if (kind === 'success') [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, i * 0.08, 0.28, 0.05));
        else if (kind === 'warn') { tone(659, 0, 0.18, 0.05); tone(523, 0.12, 0.22, 0.05); }
        else if (kind === 'beep' || kind === 'ok') tone(1800, 0, 0.12, 0.08);
        else if (kind === 'err') { tone(400, 0, 0.15, 0.06); tone(320, 0.1, 0.18, 0.06); }
      } catch (e) {}
    }
    return { play, isEnabled: () => enabled, setEnabled(v) { enabled = !!v; try { localStorage.setItem('esypos_sound', enabled ? '1' : '0'); } catch (_) {} if (enabled) play('click'); } };
  })();
  window.Sound = Sound;
  // Haptics: short vibration on taps, success and warnings (Android). Respects reduced-motion and a Settings switch.
  const Haptic = (function () {
    let on = true; try { on = localStorage.getItem('esypos_haptic') !== '0'; } catch (_) {}
    const can = () => on && typeof navigator.vibrate === 'function' && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    return {
      tap() { if (can()) navigator.vibrate(8); }, ok() { if (can()) navigator.vibrate([14, 50, 14]); }, warn() { if (can()) navigator.vibrate([32, 40, 32]); },
      isEnabled: () => on, supported: () => typeof navigator.vibrate === 'function',
      setEnabled(v) { on = !!v; try { localStorage.setItem('esypos_haptic', on ? '1' : '0'); } catch (_) {} if (on && navigator.vibrate) navigator.vibrate(12); }
    };
  })();
  window.Haptic = Haptic;
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('button, a, label, select, summary, [onclick], .pcard, .nav-link, .row, input[type=checkbox], input[type=radio]');
    if (t && !t.disabled) { Sound.play('click'); Haptic.tap(); }
  }, true);
  let confirmEl = null;
  function closeConfirm() { if (confirmEl) { confirmEl.remove(); confirmEl = null; } }
  window.askConfirm = function (message, onYes, o) {
    o = o || {}; closeConfirm();
    const el = document.createElement('div'); el.className = 'ui-confirm-backdrop';
    el.innerHTML = '<div class="ui-confirm" role="dialog" aria-modal="true"><div class="ui-confirm-icon ' + (o.danger ? 'danger' : '') + '"><i class="fas ' + (o.icon || (o.danger ? 'fa-triangle-exclamation' : 'fa-circle-question')) + '"></i></div><h3></h3><p></p><div class="ui-confirm-actions"><button type="button" class="btn n"></button><button type="button" class="btn y ' + (o.danger ? 'btn-bad' : 'btn-primary') + '"></button></div></div>';
    el.querySelector('h3').textContent = o.title || 'Confirm';
    el.querySelector('p').textContent = message;
    el.querySelector('.n').textContent = o.no || 'Cancel'; el.querySelector('.y').textContent = o.yes || 'Yes';
    el.querySelector('.n').onclick = () => { closeConfirm(); o.onCancel && o.onCancel(); };
    el.querySelector('.y').onclick = () => { closeConfirm(); onYes && onYes(); };
    el.addEventListener('click', e => { if (e.target === el) closeConfirm(); });
    document.body.appendChild(el); confirmEl = el;
  };
  window.hasConfirm = () => !!confirmEl; window.closeConfirm = closeConfirm;
  const Modal = {
    stack: [],
    open(o) {
      const el = document.createElement('div'); el.className = 'modal-back';
      el.innerHTML = '<div class="modal-sheet ' + (o.size || '') + '" role="dialog" aria-modal="true"><div class="modal-head"><h3>' + esc(o.title || '') + '</h3><button type="button" class="icon-btn" data-x aria-label="Close"><i class="fas fa-xmark"></i></button></div><div class="modal-body">' + (o.body || '') + '</div>' + (o.foot ? '<div class="modal-foot">' + o.foot + '</div>' : '') + '</div>';
      el.querySelector('[data-x]').onclick = () => Modal.close(el);
      const keepOpen = o.static !== undefined ? !!o.static : /<(input|select|textarea)\b/i.test(o.body || '');   // a form never closes on an accidental tap outside it
      if (!keepOpen) el.addEventListener('mousedown', e => { if (e.target === el) Modal.close(el); });
      el._onClose = o.onClose;
      document.body.appendChild(el); Modal.stack.push(el); syncLock();
      const f = el.querySelector('[autofocus]'); if (f) setTimeout(() => f.focus(), 60);
      return el;
    },
    close(el) {
      el = el || Modal.stack[Modal.stack.length - 1]; if (!el) return;
      const i = Modal.stack.indexOf(el); if (i >= 0) Modal.stack.splice(i, 1);
      el.remove(); syncLock(); el._onClose && el._onClose();
    },
    closeFrom(node) { const el = node.closest('.modal-back'); if (el) Modal.close(el); },
    closeAll() { while (Modal.stack.length) Modal.close(); },
    top() { return Modal.stack[Modal.stack.length - 1]; }
  };
  window.Modal = Modal;
  function syncLock() {
    const drawerOpen = !!document.querySelector('.drawer.open');
    document.body.classList.toggle('no-scroll', Modal.stack.length > 0 || drawerOpen || !!document.querySelector('.scan,.lock'));
  }
  window.syncLock = syncLock;
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const Theme = {
    mode: (function () { try { return localStorage.getItem('esypos_theme') || 'auto'; } catch (_) { return 'auto'; } })(),
    isDark() { return this.mode === 'dark' || (this.mode === 'auto' && mq && mq.matches); },
    apply() {
      document.documentElement.classList.toggle('dark', this.isDark());
      document.querySelectorAll('meta[name=theme-color]').forEach(m => { m.removeAttribute('media'); m.content = this.isDark() ? '#0d1628' : '#edf2fd'; });
      document.querySelectorAll('.theme-ico').forEach(i => { i.className = 'theme-ico fas ' + (this.isDark() ? 'fa-sun' : 'fa-moon'); });
      const s = document.getElementById('theme-select'); if (s) s.value = this.mode;
      document.querySelectorAll('.mode-seg button').forEach(b => b.classList.toggle('on', b.dataset.m === this.mode));
      if (window.Skin) { const cs = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(); if (cs) document.querySelectorAll('meta[name=theme-color]').forEach(m => { m.content = cs; }); }
    },
    set(mode) { this.mode = mode; try { localStorage.setItem('esypos_theme', mode); } catch (_) {} this.apply(); },
    toggle() { this.set(this.isDark() ? 'light' : 'dark'); }
  };
  window.Theme = Theme;
  /* Design: "modern" (current look) or "classic" (the original v10.7 look). Stored on this device, applied before first paint by a tiny script in index.html. */
  const Design = {
    mode: (function () { try { return localStorage.getItem('esypos_design') === 'classic' ? 'classic' : 'modern'; } catch (_) { return 'modern'; } })(),
    apply() {
      document.documentElement.classList.toggle('classic', this.mode === 'classic');
      document.querySelectorAll('.design-pick button').forEach(b => b.classList.toggle('on', b.dataset.d === this.mode));
    },
    set(mode) { this.mode = mode === 'classic' ? 'classic' : 'modern'; try { localStorage.setItem('esypos_design', this.mode); } catch (_) {} this.apply(); }
  };
  window.Design = Design;
  /* Skin: colour themes. "classic" = the default blue look. "original" = the old v10.7 layout (Design 'classic'). Others set <html data-skin>. */
  const SKINS = [
    { id: 'classic', name: 'Classic', note: 'Default blue', c: '#2563eb', bg: '#f3f6fb' },
    { id: 'emerald', name: 'Emerald', note: 'Fresh green', c: '#059669', bg: '#f1f8f5' },
    { id: 'ocean', name: 'Ocean', note: 'Calm teal', c: '#0891b2', bg: '#f0f7fa' },
    { id: 'sunset', name: 'Sunset', note: 'Warm orange', c: '#ea580c', bg: '#fbf6f2' },
    { id: 'royal', name: 'Royal', note: 'Deep violet', c: '#7c3aed', bg: '#f6f4fb' },
    { id: 'rose', name: 'Rose', note: 'Bold crimson', c: '#e11d48', bg: '#fbf4f5' },
    { id: 'graphite', name: 'Graphite', note: 'Quiet grey', c: '#334155', bg: '#f4f5f7' },
    { id: 'original', name: 'Original', note: 'Old v10.7 look', c: '#1e40af', bg: '#f3f6fb' }
  ];
  const Skin = {
    list: SKINS,
    mode: (function () { try { const v = localStorage.getItem('esypos_skin') || 'classic'; return SKINS.some(x => x.id === v) ? v : 'classic'; } catch (_) { return 'classic'; } })(),
    apply() {
      const el = document.documentElement, orig = this.mode === 'original';
      if (this.mode === 'classic' || orig) el.removeAttribute('data-skin'); else el.setAttribute('data-skin', this.mode);
      Design.mode = orig ? 'classic' : 'modern'; el.classList.toggle('classic', orig);
      try { localStorage.setItem('esypos_design', Design.mode); } catch (_) {}
      document.querySelectorAll('.skin-card').forEach(b => { const on = b.dataset.skin === this.mode; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      const cs = getComputedStyle(el).getPropertyValue('--bg').trim();
      document.querySelectorAll('meta[name=theme-color]').forEach(m => { m.removeAttribute('media'); m.content = Theme.isDark() ? (cs || '#0d1628') : (cs || '#edf2fd'); });
    },
    set(id) { if (!SKINS.some(x => x.id === id)) id = 'classic'; this.mode = id; try { localStorage.setItem('esypos_skin', id); } catch (_) {} this.apply(); { try { Core.toast('Theme: ' + SKINS.find(x => x.id === id).name); } catch (_) {} } },
    picker() {
      const seg = '<div class="mode-seg mt3" role="group" aria-label="Mode">' + [['auto', 'fa-mobile-screen', 'Auto'], ['light', 'fa-sun', 'Light'], ['dark', 'fa-moon', 'Dark']].map(m => `<button type="button" data-m="${m[0]}" class="${Theme.mode === m[0] ? 'on' : ''}" onclick="Theme.set('${m[0]}')"><i class="fas ${m[1]}"></i> ${m[2]}</button>`).join('') + '</div>';
      Modal.open({ title: 'Theme', body: this.html() + seg, foot: '<button class="btn btn-primary" onclick="Modal.closeFrom(this)">Done</button>' });
    },
    html() {
      return '<div class="skin-grid" role="group" aria-label="Colour theme">' + SKINS.map(k =>
        `<button type="button" class="skin-card ${k.id === this.mode ? 'on' : ''}" data-skin="${k.id}" aria-pressed="${k.id === this.mode}" onclick="Skin.set('${k.id}')" style="--sk-c:${k.c};--sk-bg:${k.bg}"><span class="sk-prev"><i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i><i class="e"></i></span><span class="sk-tick"><i class="fas fa-check"></i></span><b>${k.name}</b><small>${k.note}</small></button>`).join('') + '</div>';
    }
  };
  window.Skin = Skin;
  if (Design.mode === 'classic' && !localStorage.getItem('esypos_skin')) Skin.mode = 'original';   // people who already chose the old look keep it
  document.addEventListener('DOMContentLoaded', () => Design.apply());
  Design.apply();
  if (mq && mq.addEventListener) mq.addEventListener('change', () => Theme.mode === 'auto' && Theme.apply());
  document.addEventListener('DOMContentLoaded', () => { Theme.apply(); Skin.apply(); });
  Theme.apply(); Skin.apply();
  window.exportData = function (silent, force) {
    if (silent && !force) return;
    if (!force) return;
    try { localStorage.setItem('esypos_last_backup', String(Date.now())); localStorage.removeItem('esypos_dirty'); } catch (_) {}
  };
  // Manual, optional backup file (never automatic). The PIN hash is left out so the file cannot be used to guess the PIN.
  window.exportBackupFile = function () {
    const out = { app: 'Old POS', version: 4, exportDate: new Date().toISOString() };
    Object.keys(K).forEach(k => { if (k === 'cart') return; out[k] = k === 'settings' ? Core.stripSecrets(DB.settings) : DB[k]; });
    Core.download('oldpos-backup-' + Core.todayKey() + '.json', JSON.stringify(out), 'application/json');
    try { localStorage.setItem('esypos_last_backup', String(Date.now())); } catch (_) {}
    toast('✓ Backup file saved');
  };
  // Keep only well-formed records from a backup file, so one damaged entry can never break Reports or History.
  function cleanColl(k, arr) {
    if (!Array.isArray(arr)) return [];
    const needItems = { sales: 1, returns: 1, purchases: 1, hold: 1 };
    return arr.filter(x => x && typeof x === 'object' && !Array.isArray(x) && (!needItems[k] || Array.isArray(x.items))).map(x => { if (!x.id) x.id = Core.genId(); return x; });
  }
  window.importData = function (input) {
    const file = input.files && input.files[0]; input.value = ''; if (!file) return;
    const rd = new FileReader();
    rd.onload = e => {
      try {
        const raw = String(e.target.result || '');
        if (raw.length > 60 * 1024 * 1024) throw new Error('big');
        const d = JSON.parse(raw);
        if (!d || typeof d !== 'object' || !Array.isArray(d.products)) throw new Error('bad');
        if (d.settings && (typeof d.settings !== 'object' || Array.isArray(d.settings))) throw new Error('bad');
        const clean = {}; let dropped = 0;
        Object.keys(K).forEach(k => { if (k === 'settings' || k === 'cart') return; clean[k] = cleanColl(k, d[k]); dropped += (Array.isArray(d[k]) ? d[k].length : 0) - clean[k].length; });
        askConfirm(`Backup has ${clean.products.length} products, ${clean.sales.length} sales, ${clean.customers.length} customers. Current data will be replaced.` + (dropped > 0 ? ` (${dropped} damaged record${dropped > 1 ? 's' : ''} will be skipped.)` : '') + ' Tip: save a backup file of the current data first.', () => {
          Object.keys(K).forEach(k => { if (k === 'settings') { const keep = Core.keepSecrets(); DB.settings = Object.assign({}, Core.DEFAULTS, d.settings || {}, keep);   /* a backup file can never set or remove the PINs */ } else if (k === 'cart') DB.cart = []; else DB[k] = clean[k]; });
          Core.migrate(); saveAll(); toast('Restore successful ✓'); setTimeout(() => location.reload(), 700);
        }, { title: 'Restore backup?', yes: 'Yes, restore', danger: true });
      } catch (err) { toast('⚠️ Not a valid Old POS backup file'); }
    };
    rd.onerror = () => toast('Could not read file'); rd.readAsText(file);
  };
  window.wipeAllData = function () {
    const cloudNote = window.Cloud && Cloud.isOn() ? ' Your Google Drive backup is NOT deleted — signing in again will restore it.' : '';
    askConfirm('All data on this device (products, sales, customers, expenses...) will be deleted. A backup file is saved to your Downloads first.' + cloudNote, () => {
      askConfirm('Really delete all data? This cannot be undone!', () => {
        try { window.exportBackupFile(); } catch (_) {}          // the safety copy is downloaded BEFORE anything is removed
        setTimeout(() => { Object.values(K).forEach(k => localStorage.removeItem(k)); ['esypos_last_backup', 'esypos_dirty'].forEach(k => localStorage.removeItem(k)); location.reload(); }, 1500);
      }, { title: 'Final confirmation', yes: 'Yes, delete all', danger: true });
    }, { title: 'Delete all data?', yes: 'Continue', danger: true });
  };
  window.checkPendingBackup = function () {};
  window.phoneIntl = function (p) {
    const raw = String(p || '').trim(); let d = raw.replace(/\D/g, ''); if (!d) return '';
    if (raw.charAt(0) === '+' || d.startsWith('00')) return d.replace(/^00/, '');   // already international (+1…, 0044…): keep the country code
    if (d.startsWith('880')) return d; if (d.startsWith('0')) return '88' + d; return '880' + d;
  };
  window.shareWA = function (phone, text) { const n = phoneIntl(phone); window.open('https://wa.me/' + (n || '') + '?text=' + encodeURIComponent(text), '_blank', 'noopener'); };
  window.shareSMS = function (phone, text) { location.href = 'sms:' + (phone || '') + '?body=' + encodeURIComponent(text); };
  window.printHTML = function (html) {
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    const d = f.contentWindow.document; d.open(); d.write(html); d.close();
    setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('Could not print'); } setTimeout(() => f.remove(), 2000); }, 400);
  };
  document.addEventListener('focusin', e => {
    const t = e.target;
    if (t && t.tagName === 'INPUT' && t.type === 'number') { if (!t.getAttribute('inputmode')) t.setAttribute('inputmode', 'decimal'); setTimeout(() => { try { t.select(); } catch (_) {} }, 0); }
  }, true);
})();
