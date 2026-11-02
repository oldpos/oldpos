/* Old POS Guard: section lock for staff + anonymous user counter (total only, one Google account = one user, Google Sheet).
   - Section lock: owner picks which sections need the PIN (Settings -> Section lock). Salesmen stay on the Sales Counter.
   - User counter: each device registers one random anonymous ID (no name, phone, shop data) in YOUR Google Sheet through
     an Apps Script; the app shows the total. Set userCounterApi in js/core/config.js (see tools/SETUP-bn.md). */
(function () {
  'use strict';
  const C = Core, DB = C.DB, esc = C.esc, toast = C.toast;
  const $ = id => document.getElementById(id);
  const ITEMS = [
    ['reports', 'Reports (sales & profit analysis)', 'fa-chart-column'],
    ['tiles', 'Dashboard tiles (this month, customer due)', 'fa-chart-column'],
    ['dashboard', 'Dashboard (whole page)', 'fa-gauge-high'],
    ['purchases', 'Purchases & Suppliers (cost prices)', 'fa-truck'],
    ['expenses', 'Expenses', 'fa-money-bill-wave'],
    ['history', 'Sales History (view / delete bills)', 'fa-file-invoice'],
    ['products', 'Products & Stock (cost price, edit)', 'fa-box-open'],
    ['customers', 'Customers & Due', 'fa-user-group'],
    ['barcodes', 'Barcode Labels', 'fa-barcode'],
    ['settings', 'Settings, backup & data', 'fa-sliders']
  ];
  const DEFAULT_LOCKED = ['reports', 'tiles', 'purchases', 'expenses', 'settings'];

  /* ---- Admin PIN: separate from the home-screen PIN; protects sections/profit from staff ---- */
  const AK = { f: 'esypos_ad_f', u: 'esypos_ad_u' };
  const lsn = k => { try { return parseInt(localStorage.getItem(k) || '0', 10) || 0; } catch (_) { return 0; } };
  const lss = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (_) {} };
  const Admin = window.AdminLock = {
    has() { return !!DB.settings.adminHash; },
    async verify(pin) { return !!DB.settings.adminHash && (await Lock.hashFor(pin, DB.settings.adminSalt)) === DB.settings.adminHash; },
    async check(pin) {                              // 'ok' | 'bad' | 'wait'
      if (Date.now() < lsn(AK.u)) return 'wait';
      if (await this.verify(pin)) { lss(AK.f, 0); return 'ok'; }
      const n = lsn(AK.f) + 1; lss(AK.f, n);
      if (n >= 5) { lss(AK.f, 0); lss(AK.u, Date.now() + 30000); return 'wait'; }
      return 'bad';
    },
    wait() { return Math.max(1, Math.ceil((lsn(AK.u) - Date.now()) / 1000)); },
    setup() {
      const has = this.has();
      const m = Modal.open({ title: has ? 'Change Admin PIN' : 'Set Admin PIN', body:
        (window.Recovery ? Recovery.fieldsHTML('admin') : '') +
        '<p class="xs muted mt3 mb3">Keep this PIN to yourself — it is different from the home-screen PIN your staff may know.</p>' +
        (has ? '<div class="field"><label class="label">Current Admin PIN</label><input id="ad-old" type="password" data-pin="1" readonly inputmode="none" maxlength="4" class="input"></div>' : '') +
        '<div class="field"><label class="label">New Admin PIN (4 digits)</label><input id="ad-new" type="password" data-pin="1" readonly inputmode="none" maxlength="4" class="input"></div>' +
        '<div class="field"><label class="label">Re-enter</label><input id="ad-new2" type="password" data-pin="1" readonly inputmode="none" maxlength="4" class="input"></div>',
        foot: '<button class="btn" onclick="Modal.closeFrom(this)">Cancel</button><button class="btn btn-primary" id="ad-ok">Save</button>' });
      m.querySelector('#ad-ok').onclick = async () => {
        if (has && (await Admin.check($('ad-old').value)) !== 'ok') { toast('⚠️ Current Admin PIN is wrong'); return; }
        const a = $('ad-new').value, b = $('ad-new2').value;
        if (!/^\d{4}$/.test(a)) { toast('⚠️ Enter exactly 4 digits'); return; } if (Lock.isWeak(a)) { toast('⚠️ That PIN is too easy to guess — choose another'); return; } if (a !== b) { toast('⚠️ PINs do not match'); return; }
        if (Lock.has() && await Lock.verify(a)) { toast('⚠️ Admin PIN must be different from the home-screen PIN'); return; }
        const rec = window.Recovery ? Recovery.read('admin', a) : null; if (window.Recovery && !rec) return;
        const salt = C.genId(); DB.settings.adminSalt = salt; DB.settings.adminHash = await Lock.hashFor(a, salt); if (rec) await Recovery.commit('admin', rec);
        ['esypos_ad_f', 'esypos_ad_u', 'esypos_ad_l'].forEach(k => { try { localStorage.removeItem(k); } catch (_) {} }); openUntil = 0; profitOpen = 0;
        C.save('settings');
        log('Admin PIN ' + (has ? 'changed' : 'set')); Modal.close(m); toast('Admin PIN saved ✓'); App.refresh();
      };
    },
    remove() {
      const m = Modal.open({ title: 'Remove Admin PIN', body: '<p class="muted sm mb3">All section locks stop working until you set a new Admin PIN.</p><div class="field"><label class="label">Current Admin PIN</label><input id="ad-old" type="password" data-pin="1" readonly inputmode="none" maxlength="4" class="input" autofocus></div>',
        foot: '<button class="btn" onclick="Modal.closeFrom(this)">Cancel</button><button class="btn btn-bad" id="ad-ok">Remove</button>' });
      m.querySelector('#ad-ok').onclick = async () => { if ((await Admin.check($('ad-old').value)) !== 'ok') { toast('⚠️ Wrong Admin PIN'); return; } DB.settings.adminHash = ''; DB.settings.adminSalt = ''; if (window.Recovery) Recovery.clear('admin'); C.save('settings'); log('Admin PIN removed'); Modal.close(m); toast('Admin PIN removed'); App.refresh(); };
    },
    forgot() {                                       // owner recovery: secret question, Google backup, or the home-screen PIN
      const viaGoogle = (window.Cloud && Cloud.isOn()) ? () => Cloud.resetPin() : null;
      if (window.Recovery && Recovery.has('admin')) { Recovery.forgot('admin', () => { openUntil = 0; profitOpen = 0; if (window.App) App.refresh(); }, viaGoogle); return; }
      if (window.Cloud && Cloud.isOn()) { Cloud.resetPin(); return; }
      if (Lock.has()) {
        const m = Modal.open({ title: 'Reset Admin PIN', body: '<p class="muted sm mb3">Enter the home-screen PIN to remove the Admin PIN, then set a new one.</p><input id="ad-sp" type="password" data-pin="1" readonly inputmode="none" maxlength="4" class="input sl-input">',
          foot: '<button class="btn" onclick="Modal.closeFrom(this)">Cancel</button><button class="btn btn-primary" id="ad-ok">Reset</button>' });
        m.querySelector('#ad-ok').onclick = async () => { if ((await Lock.check($('ad-sp').value)) !== 'ok') { toast('⚠️ Wrong PIN'); return; } DB.settings.adminHash = ''; DB.settings.adminSalt = ''; C.save('settings'); log('Admin PIN reset'); Modal.close(m); toast('Admin PIN removed — set a new one'); App.refresh(); };
        return;
      }
      toast('Connect Google backup or set a home-screen PIN to enable recovery');
    }
  };

  let openUntil = 0, openView = '';        // v12.7.1: an unlocked page stays open only while you are ON it; leaving it locks it again
  const LOGK = 'esypos_audit';
  function log(msg) { try { const a = JSON.parse(localStorage.getItem(LOGK) || '[]'); a.unshift({ t: Date.now(), m: msg }); localStorage.setItem(LOGK, JSON.stringify(a.slice(0, 40))); } catch (_) {} }
  const logs = () => { try { return JSON.parse(localStorage.getItem(LOGK) || '[]'); } catch (_) { return []; } };
  const minutes = () => Math.max(1, parseInt(DB.settings.sectionLockMin, 10) || 2);
  const lockedList = () => Array.isArray(DB.settings.lockedViews) ? DB.settings.lockedViews : DEFAULT_LOCKED;
  const needs = v => !!(Admin.has() && lockedList().indexOf(v) >= 0 && !(openView === v && Date.now() < openUntil));
  const extend = () => { if (Date.now() <= openUntil) openUntil = Date.now() + minutes() * 60000; };

  function ask(done, name, noOpen) {
    const m = Modal.open({
      title: 'Admin PIN required',
      body: '<p class="muted sm mb3">Enter the Admin PIN to continue.</p>' +
        '<input id="sl-pin" type="password" data-pin="1" readonly inputmode="none" maxlength="4" autocomplete="off" class="input sl-input" placeholder="••••" autofocus>' +
        '<div class="xs sl-msg" id="sl-msg" role="alert"></div>',
      foot: '<button class="btn" onclick="Modal.closeFrom(this)">Cancel</button><button class="btn btn-ghost" id="sl-fg">Forgot?</button><button class="btn btn-primary" id="sl-ok"><i class="fas fa-lock"></i> Unlock</button>'
    });
    const inp = m.querySelector('#sl-pin'), msg = m.querySelector('#sl-msg'); let busy = false;
    const go = async () => {
      if (busy || inp.value.length < 4) return; busy = true;
      const r = await Admin.check(inp.value);
      if (r === 'ok') { log('Unlocked: ' + (name || 'section')); if (!noOpen) openUntil = Date.now() + minutes() * 60000; Modal.close(m); done(); }
      else {
        log(r === 'wait' ? 'PIN lock-out (too many wrong attempts)' : 'Wrong PIN for ' + (name || 'section'));
        msg.textContent = r === 'wait' ? '⚠️ Too many wrong attempts. Wait ' + Admin.wait() + ' seconds.' : '⚠️ Wrong PIN';
        inp.value = ''; if (navigator.vibrate) navigator.vibrate(100); if (window.Keypad) Keypad.refresh(); inp.focus();
      }
      busy = false;
    };
    inp.addEventListener('input', go);
    m.querySelector('#sl-ok').onclick = go; m.querySelector('#sl-fg').onclick = () => { Modal.close(m); Admin.forgot(); };
    setTimeout(() => inp.focus(), 60);
  }

  /* ---- v12.7: lock again at once, and automatic re-lock after inactivity ---- */
  const isOpen = () => (!!openView && Date.now() < openUntil) || Date.now() < profitOpen;
  function relock() {                                  // everything the Admin PIN opened closes again
    openUntil = 0; openView = ''; profitOpen = 0;
    try {
      if (Admin.has() && App.view !== 'pos' && lockedList().indexOf(App.view) >= 0) App.go('pos');
      else if (App.view === 'dashboard') App.refresh();
    } catch (e) { console.warn('[Guard]', e); }
  }
  let wasOpen = false;
  setInterval(() => {
    try {
      const o = isOpen();
      if (wasOpen && !o) { if (window.Modal && Modal.stack.length) { openUntil = profitOpen = Date.now() + 15000; return; } relock(); }   // inactivity ended it (a dialog in use gets a little longer)
      wasOpen = isOpen();
    } catch (_) {}
  }, 1000);
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => {         // "re-lock after N minutes" counts from the LAST touch, not from the unlock
    const n = Date.now(), t = n + minutes() * 60000;
    if (n < openUntil) openUntil = t; if (n < profitOpen) profitOpen = t;
  }, { capture: true, passive: true }));

  function hookGo() {
    if (!window.App || App.__goGuard) return; App.__goGuard = true;
    const go0 = App.go.bind(App);
    App.go = function (v) {
      if (needs(v)) { ask(() => { openView = v; go0(v); }, v); return; }
      if (v !== App.view) { if (v !== openView) { openView = ''; openUntil = 0; } profitOpen = 0; }      // leaving a page locks it (and the dashboard figures) again
      extend(); go0(v);
    };
  }
  function hook() {
    if (!window.App || App.__guarded) return; App.__guarded = true; hookDash(); migrate();
    hookGo();
    if (window.Cloud && Cloud.panel) {
      const p0 = Cloud.panel;
      Cloud.panel = function () { if (needs('settings')) { ask(() => p0.apply(Cloud, arguments), 'settings'); return; } return p0.apply(Cloud, arguments); };
    }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { openUntil = 0; openView = ''; profitOpen = 0; } });
    const s = App.Views.settings, r0 = s.render.bind(s);
    s.render = function () { r0(); try { card(); } catch (e) { console.warn('[Guard]', e); } };
  }


  /* ---- dashboard profit mask: lock icon, tap + PIN to reveal ---- */
  let profitOpen = 0;
  const tilesLocked = () => !!(Admin.has() && lockedList().indexOf('tiles') >= 0 && Date.now() > profitOpen);
  function maskProfit() {
    const view = $('view'); if (!view) return;
    if (!tilesLocked()) return;
    view.querySelectorAll('.sd-tile[data-tile]').forEach(el => {
      const v = el.querySelector('.v'); if (!v || el.classList.contains('stat-locked')) return;
      const tile = el.classList.contains('sd-tile');
      el.classList.add('stat-locked'); el.setAttribute('role', 'button'); el.tabIndex = 0;
      el.setAttribute('aria-label', (tile ? 'Hidden' : 'Profit hidden') + '. Tap to enter PIN');
      v.dataset.real = v.innerHTML; v.innerHTML = '<span class="lock-mask"><i class="fas fa-lock"></i>' + (tile ? '<span class="lm-d">\u2022\u2022\u2022\u2022</span>' : '') + '<em>Tap to view</em></span>';
      const open = () => ask(() => { profitOpen = Date.now() + minutes() * 60000; log(tile ? 'Dashboard figures revealed' : 'Profit revealed'); if (App.view === 'dashboard') App.refresh() }, 'tiles', true);
      el.onclick = open; el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
    });
  }
  function migrate() {
    if (!DB.settings.adminMigrated) { DB.settings.adminMigrated = 1; if (DB.settings.pinHash && !DB.settings.adminHash) { DB.settings.adminHash = DB.settings.pinHash; DB.settings.adminSalt = DB.settings.pinSalt; } C.save('settings'); }
    if (!DB.settings.tilesLockInit) { DB.settings.tilesLockInit = 1; if (Array.isArray(DB.settings.lockedViews) && DB.settings.lockedViews.indexOf('tiles') < 0) DB.settings.lockedViews.push('tiles'); C.save('settings'); }   // v12.7: the three dashboard tiles follow the Admin lock
    if (DB.settings.profitLockInit) return; DB.settings.profitLockInit = 1;
    if (Array.isArray(DB.settings.lockedViews) && DB.settings.lockedViews.indexOf('profit') < 0) DB.settings.lockedViews.push('profit');
    C.save('settings');
  }
  function hookDash() {
    const d = App.Views && App.Views.dashboard; if (!d || d.__masked) return; d.__masked = true;
    const r0 = d.render.bind(d); d.render = function () { r0(); try { maskProfit(); } catch (e) { console.warn('[Guard]', e); } };
  }

  function card() {
    const host = document.querySelector('#view .st-sec[data-s="security"]'); if (!host) return;
    const has = Admin.has(), L = lockedList(), mins = minutes(), auto = parseInt(DB.settings.autoLockMin, 10) === 0 ? 0 : Math.max(3, parseInt(DB.settings.autoLockMin, 10) || 3);
    const opt = (v, cur, txt) => '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + txt + '</option>';
    const html = '<div class="card pad mb3" id="guard-card"><div class="sec-title"><i class="fas fa-user-shield ptext"></i> 2. Admin lock (hide info from staff)</div>' +
      (has ? '<p class="muted sm mb3">ON — each ticked page asks for the <b>Admin PIN</b> every time you open it, and locks again as soon as you leave it. Staff can still sell.</p><div class="flex gap2 mb3"><button class="btn btn-ghost grow" onclick="AdminLock.setup()">Change Admin PIN</button><button class="btn btn-danger-soft grow" onclick="AdminLock.remove()">Remove</button></div><button class="btn btn-primary btn-block mb3" onclick="Guard.relock()"><i class="fas fa-lock"></i> Lock admin sections now</button>' + (window.Recovery ? Recovery.rowHTML('admin') + '<div class="mb3"></div>' : '') :
        '<p class="muted sm mb3">OFF — set a separate Admin PIN to choose what staff cannot see.</p><button class="btn btn-primary btn-block mb3" onclick="AdminLock.setup()"><i class="fas fa-lock"></i> Set Admin PIN</button>') +
      '<div class="muted xs mb2">Choose what to lock:</div>' +
      ITEMS.map(i => '<label class="switch"><span class="sm fw6"><i class="fas ' + i[2] + ' ptext"></i> ' + esc(i[1]) + '</span><input type="checkbox" ' + (L.indexOf(i[0]) >= 0 ? 'checked' : '') + ' onchange="Guard.toggle(\'' + i[0] + '\',this.checked)"></label>').join('') +
      '<div class="grid2 mt3"><div class="field"><label class="label">Also re-lock an open page after no activity</label><select class="input" onchange="Guard.set(\'sectionLockMin\',this.value)">' +
      opt(1, mins, '1 minute') + opt(2, mins, '2 minutes') + opt(5, mins, '5 minutes') + opt(15, mins, '15 minutes') + '</select></div>' +
      '<div class="field"><label class="label">Home screen auto-lock</label><select class="input" onchange="Guard.set(\'autoLockMin\',this.value)">' +
      opt(0, auto, 'As soon as I leave the app') + opt(3, auto, '3 minutes idle') + opt(5, auto, '5 minutes idle') + opt(10, auto, '10 minutes idle') + opt(15, auto, '15 minutes idle') + '</select></div></div>' +
      '<p class="xs muted mt2">5 wrong PINs lock the keypad (30 s, then 1 / 5 / 15 / 30 min if it keeps happening).</p></div>';
    const L2 = logs().slice(0, 10), last = parseInt(localStorage.getItem('esypos_g_last') || '0', 10), cnt = parseInt(localStorage.getItem('esypos_g_cnt') || '0', 10);
    const on = localStorage.getItem('esypos_g_on') === '1', dirty = localStorage.getItem('esypos_g_dirty') === '1';
    const health = '<div class="card pad mb3" id="health-card"><div class="sec-title"><i class="fas fa-shield-halved ptext"></i> Backup health</div>' +
      '<div class="kv"><span>Cloud backup</span><b>' + (on ? (dirty ? 'Waiting to sync' : 'Verified ✓') : 'Not connected') + '</b></div>' +
      '<div class="kv"><span>Last verified backup</span><b>' + (last ? C.fmtDT(new Date(last).toISOString()) : '—') + '</b></div>' +
      '<div class="kv"><span>Records in last backup</span><b>' + (cnt || '—') + '</b></div>' +
      '</div>' +
      '<div class="card pad mb3" id="audit-card"><div class="sec-title"><i class="fas fa-file-lines ptext"></i> Security log</div>' +
      (L2.length ? L2.map(x => '<div class="kv"><span>' + esc(x.m) + '</span><b class="xs">' + esc(C.fmtDT(new Date(x.t).toISOString())) + '</b></div>').join('') + '<button class="btn btn-ghost btn-block mt3" onclick="Guard.clearLog()">Clear log</button>' : '<p class="xs muted">No unlock or wrong-PIN events yet.</p>') + '</div>';
    if (!$('guard-card')) { host.insertAdjacentHTML('beforeend', html + health + '<div class="card pad mb3" id="local-card"></div>'); localCard(); }
  }
  /* v12: this device + local safety copies (work without internet) */
  async function localCard() {
    const el = document.getElementById('local-card'); if (!el || !window.Safety) return;
    const [list, id, persisted] = await Promise.all([Safety.listCopies(), Safety.deviceId(), (navigator.storage && navigator.storage.persisted) ? navigator.storage.persisted().catch(() => false) : false]);
    if (!document.getElementById('local-card')) return;
    el.innerHTML = '<div class="sec-title"><i class="fas fa-database ptext"></i> This device &amp; local copies</div>' +
      '<div class="kv"><span>Device ID</span><b class="xs" style="font-family:ui-monospace,monospace">' + esc(id.slice(0, 8) + '…' + id.slice(-4)) + '</b></div>' +
      '<div class="kv"><span>Counted as</span><b>1 user (this device)</b></div>' +
      '<div class="kv"><span>Protected storage</span><b>' + (persisted ? 'On ✓' : 'Requested') + '</b></div>' +
      '<div class="kv"><span>Stay signed in</span><b>Until you press Log out</b></div>' +
      '<div class="muted xs mt3 mb2">Automatic copies kept on this device (latest ' + 10 + '). If something goes wrong you can bring a copy back, even offline.</div>' +
      (list.length ? list.slice(0, 5).map(c => '<div class="kv"><span>' + esc(C.fmtDT(new Date(c.t).toISOString())) + ' <small class="muted">· ' + c.n + ' records</small></span><span class="flex gap2"><button class="btn btn-ghost btn-sm" onclick="Guard.localRestore(' + c.t + ')">Restore</button><button class="btn btn-ghost btn-sm" onclick="Safety.downloadCopy(' + c.t + ')" aria-label="Download"><i class="fas fa-download"></i></button></span></div>').join('') : '<p class="xs muted">No copies yet — the first one is saved automatically a few seconds after you add data.</p>') +
      '<button class="btn btn-ghost btn-block mt3" onclick="Guard.localSave()"><i class="fas fa-floppy-disk"></i> Save a copy now</button>';
  }

  const Guard = window.Guard = {
    toggle(id, on) { const L = lockedList().slice(), i = L.indexOf(id); if (on && i < 0) L.push(id); if (!on && i >= 0) L.splice(i, 1); DB.settings.lockedViews = L; C.save('settings'); },
    set(k, v) { const n = parseInt(v, 10); DB.settings[k] = (k === 'autoLockMin' && n === 0) ? 0 : (n || 1); C.save('settings'); toast('Saved ✓'); },
    needs, log, relock, isOpen,
    confirmPin(cb, name) { if (Admin.has()) ask(cb, name, true); else cb(); },   // always asks for the PIN (used before deleting a bill)
    clearLog() { try { localStorage.removeItem(LOGK); } catch (_) {} App.refresh(); },
    async localSave() { const ok = await Safety.saveCopy(true); toast(ok ? 'Copy saved ✓' : 'Could not save a copy'); localCard(); },
    localRestore(t) {
      askConfirm('Your current data will be replaced by this copy. A copy of the current data is saved first.', async () => {
        try { await Safety.restoreCopy(t); toast('Restored ✓'); setTimeout(() => location.reload(), 700); } catch (e) { toast('⚠️ ' + (e && e.message || 'Restore failed')); }
      }, { title: 'Restore this copy?', yes: 'Yes, restore', danger: true });
    }
  };

  /* ---- user counter v3 (Google Apps Script + Google Sheet) ----
     Counts Google ACCOUNTS, once each, starting from zero. The id is an anonymous fingerprint of the signed-in e-mail
     (SHA-256, cut to 32 characters) used to count each account once. From v12.5.0 the Sheet row also holds the Google name, e-mail and a short device description (see Privacy Policy). Signing in, out or re-installing never counts twice.
     Visitors who are not signed in only READ the total. It refreshes live (one light request a minute while the app is open).
     The Sheet keeps one row per account — see tools/user-counter.gs and tools/SETUP-bn.md. */
  const LS = { get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };
  const cfg = () => window.PROPOS_CONFIG || {};
  const api = () => ((cfg().userCounterApi) || '').trim();
  const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|phantom|puppeteer|playwright/i;
  const human = () => { try { return !navigator.webdriver && !BOT.test(navigator.userAgent || ''); } catch (_) { return true; } };
  const K_TOTAL = 'esypos_uc3', K_ID = 'esypos_uc4_id';                  // new keys: the old cached number is simply ignored
  function pill() {
    const raw = LS.get(K_TOTAL), n = raw === null ? null : (parseInt(raw, 10) || 0);
    document.querySelectorAll('.js-ucount').forEach(e => { e.textContent = n === null ? '—' : n.toLocaleString('en-US'); });
  }
  async function accountId() {
    const em = (LS.get('esypos_g_email') || '').trim().toLowerCase();
    if (!em || LS.get('esypos_g_on') !== '1' || !(window.crypto && crypto.subtle)) return null;
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('oldpos-user-v3|' + em));
    return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  }
  /* Who + what device (v12.5.0): the Sheet row also gets the Google name, e-mail and a short device description,
     so the owner can see who the users are. Sent only when the user is signed in; re-sent once if any of it changes. */
  function deviceInfo() {
    const ua = navigator.userAgent || '', n = navigator;
    const m = (re) => { const x = ua.match(re); return x ? x[1] : ''; };
    let os = 'Other';
    if (/Android/i.test(ua)) os = 'Android ' + m(/Android\s([\d.]+)/i);
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS ' + m(/OS\s([\d_]+)/i).replace(/_/g, '.');
    else if (/Windows NT/i.test(ua)) os = 'Windows ' + ({ '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' }[m(/Windows NT\s([\d.]+)/i)] || '');
    else if (/Mac OS X/i.test(ua)) os = 'macOS ' + m(/Mac OS X\s([\d_.]+)/i).replace(/_/g, '.');
    else if (/CrOS/i.test(ua)) os = 'ChromeOS';
    else if (/Linux/i.test(ua)) os = 'Linux';
    let br = 'Browser';
    if (/Edg\//.test(ua)) br = 'Edge ' + m(/Edg\/(\d+)/);
    else if (/OPR\/|Opera/.test(ua)) br = 'Opera ' + m(/OPR\/(\d+)/);
    else if (/SamsungBrowser/.test(ua)) br = 'Samsung Internet ' + m(/SamsungBrowser\/(\d+)/);
    else if (/Firefox\//.test(ua)) br = 'Firefox ' + m(/Firefox\/(\d+)/);
    else if (/Chrome\/|CriOS/.test(ua)) br = 'Chrome ' + m(/(?:Chrome|CriOS)\/(\d+)/);
    else if (/Safari\//.test(ua)) br = 'Safari ' + m(/Version\/(\d+)/);
    const touch = (n.maxTouchPoints || 0) > 1, sw = Math.min(screen.width || 0, screen.height || 0);
    const kind = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || (/Macintosh/i.test(ua) && touch) ? 'Tablet' : (/Mobi|iPhone|iPod|Android/i.test(ua) ? 'Phone' : 'Computer');
    const app = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || n.standalone === true ? 'Installed app' : 'Browser';
    return { kind, os: os.trim(), br: br.trim(), scr: (screen.width || 0) + 'x' + (screen.height || 0), app, lang: (n.language || '').slice(0, 12), tz: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) { return ''; } })(), sw };
  }
  async function deviceModel() {          // Android phones report the model (e.g. "SM-A546E") through Client Hints
    try {
      const u = navigator.userAgentData; if (!u || !u.getHighEntropyValues) return '';
      const h = await Promise.race([u.getHighEntropyValues(['model']), new Promise(r => setTimeout(() => r({}), 1500))]);
      return String((h && h.model) || '').slice(0, 40);
    } catch (_) { return ''; }
  }
  async function profile() {
    const d = deviceInfo(), model = await deviceModel();
    return {
      n: (LS.get('esypos_g_name') || '').trim().slice(0, 100),
      e: (LS.get('esypos_g_email') || '').trim().toLowerCase().slice(0, 120),
      d: (d.kind + (model ? ' · ' + model : '')).slice(0, 80),
      o: d.os.slice(0, 40), b: (d.br + ' · ' + d.app).slice(0, 60), s: d.scr, z: d.tz.slice(0, 40)
    };
  }
  async function viaScript(a, id, signal) {
    let pr = null, sig = '';
    if (id) { pr = await profile(); sig = id + '|' + pr.n + '|' + pr.e + '|' + pr.d + '|' + pr.o + '|' + pr.b + '|' + new Date().toISOString().slice(0, 10); }   // + today: one light update a day keeps “last seen” right
    const done = !id || LS.get(K_ID) === sig;
    let q = 'a=count';
    if (!done) q = 'a=hit&id=' + encodeURIComponent(id) + Object.keys(pr).map(k => '&' + k + '=' + encodeURIComponent(pr[k])).join('');
    const r = await fetch(a + (a.indexOf('?') < 0 ? '?' : '&') + q, { signal, cache: 'no-store' });
    const j = r.ok ? await r.json() : null;
    if (!j || !j.ok) return;
    if (!done) LS.set(K_ID, sig);                                         // remembered only after the server confirmed
    if (typeof j.total === 'number') {
      const old = parseInt(LS.get(K_TOTAL) || '0', 10) || 0;
      LS.set(K_TOTAL, String(Math.max(old, j.total)));                   // never goes down on screen
    }
  }
  let busy = false, lastAt = 0;
  async function count(force) {
    pill();
    if (!api() || !navigator.onLine) return;
    if (busy || (!force && Date.now() - lastAt < 15000)) return;         // never two requests at once, never more than one every 15 s
    busy = true; lastAt = Date.now();
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 12000);
    try {
      const id = human() ? await accountId() : null;
      await viaScript(api(), id, ctl.signal);
    } catch (_) { /* offline or blocked: keep the last known number */ }
    clearTimeout(to); busy = false; pill();
  }

  Guard.refreshCount = () => { count(true); };
  function start() {
    hook(); pill(); setTimeout(count, 1200);
    window.addEventListener('online', count);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') count(); });
    setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) count(); }, 60000);   // live: one light refresh a minute, only while the app is open
  }
  hookGo();                                          // immediately — before the app opens its first screen (see ?go= shortcuts)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 0)); else setTimeout(start, 0);
})();
