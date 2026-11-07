/* Old POS: Settings, barcode scanner, PIN lock, Bluetooth printer */
(function () {
  'use strict';
  const C = Core, { DB, esc, num, fmt, toast } = C;
  const $ = id => document.getElementById(id);
  const Scanner = window.Scanner = {
    el: null, stream: null, timer: null, last: '', lastT: 0, busy: false, opening: false, tok: 0, msgT: null,
    isOpen() { return !!this.el || this.opening; },
    // Ask the browser for the camera. Tries a few constraint sets so devices that reject "environment" still work.
    async getStream() {
      const tries = [
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { facingMode: 'environment' }, audio: false },
        { video: true, audio: false }
      ];
      let err;
      for (const c of tries) {
        try { return await navigator.mediaDevices.getUserMedia(c); }
        catch (e) {
          err = e;
          // Permission and hardware problems will not change with other constraints: stop here.
          if (e && /NotAllowed|Security|NotFound|NotReadable|Abort/.test(e.name || '')) break;
        }
      }
      throw err;
    },
    // Friendly dialog that explains how to re-enable the camera (a browser "Block" cannot be overridden by the app).
    help(kind, retry) {
      const msgs = {
        denied: ['Camera access is blocked', 'Old POS needs the camera only to scan barcodes. Allow it once and scanning will work from then on.'],
        busy: ['Camera is in use', 'Another app or browser tab is using the camera. Close it and try again.'],
        none: ['No camera found', 'This device has no usable camera. You can type the barcode, or use a USB or Bluetooth scanner.'],
        insecure: ['Camera needs a secure page', 'Open Old POS over HTTPS to use the camera.'],
        error: ['Camera could not start', 'Something went wrong while starting the camera. Please try again.']
      };
      const m = msgs[kind] || msgs.error;
      const steps = kind === 'denied' ? `<ol class="perm-steps">
          <li><b>Chrome / browser:</b> tap the <i class="fas fa-sliders"></i> or <i class="fas fa-lock"></i> icon next to the address bar, then <b>Permissions → Camera → Allow</b>.</li>
          <li><b>Installed app:</b> press and hold the Old POS icon → <b>App info → Permissions → Camera → Allow</b>.</li>
          <li><b>iPhone:</b> Settings → Safari → Camera → <b>Ask</b> or <b>Allow</b>.</li>
          <li>Come back here and tap <b>Try again</b>.</li></ol>` : '';
      const el = Modal.open({
        title: m[0], size: '',
        body: `<div class="perm-ico ${kind === 'denied' ? 'bad' : ''}"><i class="fas ${kind === 'none' ? 'fa-video-slash' : 'fa-camera'}"></i></div><p class="perm-msg">${esc(m[1])}</p>${steps}`,
        foot: `<button class="btn" data-x2>Close</button>${kind === 'none' || kind === 'insecure' ? '' : '<button class="btn btn-primary" data-retry><i class="fas fa-rotate-right"></i> Try again</button>'}`
      });
      el.querySelector('[data-x2]').onclick = () => Modal.close(el);
      const r = el.querySelector('[data-retry]'); if (r) r.onclick = () => { Modal.close(el); setTimeout(() => { if (typeof retry === 'function') retry(); }, 150); };
    },
    async open(cb, o) {
      o = o || {};
      if (this.el || this.opening) return;
      const retry = () => this.open(cb, o);
      /* camera reader: native BarcodeDetector when the browser has it (Chrome/Android), else our offline reader (iPhone, Firefox, desktop) */
      if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { this.help('insecure'); return; }
      let det = null;
      if ('BarcodeDetector' in window) { try { det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'] }); } catch (_) { try { det = new BarcodeDetector(); } catch (e2) { det = null; } } }
      if (!det && window.Linear) det = Linear.createDetector();
      if (!det) { toast('⚠️ Camera scan is not available in this browser. Type the code or use a USB/Bluetooth scanner.'); return; }
      const fallback = !!det.fallback;
      const tok = ++this.tok; this.opening = true;
      let stream;
      try { stream = await this.getStream(); }
      catch (e) {
        this.opening = false;
        const n = (e && e.name) || '';
        this.help(/NotAllowed|Security/.test(n) ? 'denied' : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'none' : /NotReadable|Abort/.test(n) ? 'busy' : 'error', retry);
        return;
      }
      this.opening = false;
      if (tok !== this.tok) { stream.getTracks().forEach(t => t.stop()); return; }   // Back/Close was pressed while the camera was starting
      this.stream = stream;
      const el = document.createElement('div'); el.className = 'scan';
      el.innerHTML = `<video playsinline muted autoplay></video><div class="frame"><i></i><i></i><i></i><i></i><span class="beam"></span></div><div class="bar-top"><b>Barcode scan</b><button type="button" class="btn btn-sm" id="sc-x">Close</button></div><div class="sc-msg hidden" id="sc-msg"></div><div class="sc-tools"><button type="button" class="sc-btn hidden" id="sc-torch" title="Torch"><i class="fas fa-sun"></i></button><input type="range" id="sc-zoom" class="hidden" aria-label="Zoom"><button type="button" class="sc-btn" id="sc-keep" title="Keep scanning"><i class="fas fa-rotate-right"></i> Keep scanning</button><button type="button" class="sc-btn" id="sc-type" title="Type code"><i class="fas fa-pen"></i> Type code</button></div><div class="sc-typebox hidden" id="sc-typebox"><input id="sc-code" class="input" placeholder="Type barcode…" autocomplete="off" inputmode="text"><button type="button" class="btn btn-primary" id="sc-ok">OK</button></div><div class="bar-bot">${esc(o.hint || 'Hold barcode inside the frame')}${fallback ? '<br><span class="sc-sub">Reads EAN / UPC / Code 128 · for QR use Chrome</span>' : ''}</div>`;
      document.body.appendChild(el); this.el = el; this.last = ''; this.lastT = 0; this.busy = false; syncLock();
      const v = el.querySelector('video'); v.srcObject = stream; try { await v.play(); } catch (_) {}
      el.querySelector('#sc-x').onclick = () => this.close();
      const got = (code, typed) => {
        const now = Date.now();
        if (!typed && code === this.last && now - this.lastT < 1800) return;
        this.last = code; this.lastT = now; window.Sound && window.Sound.play && window.Sound.play('beep'); if (navigator.vibrate) navigator.vibrate(40);
        const keep = cb(code);
        const stay = !o.once && (o.continuous || this.keep);
        if (!stay && keep !== false) this.close();
      };
      // torch / zoom when the phone offers them
      try {
        const tr = stream.getVideoTracks()[0], cap = (tr && tr.getCapabilities && tr.getCapabilities()) || {};
        if (cap.torch) { const tb = el.querySelector('#sc-torch'); tb.classList.remove('hidden'); let on = false; tb.onclick = async () => { on = !on; try { await tr.applyConstraints({ advanced: [{ torch: on }] }); tb.classList.toggle('on', on); } catch (_) { on = !on; } }; }
        if (cap.zoom && cap.zoom.max > cap.zoom.min) { const z = el.querySelector('#sc-zoom'); z.min = cap.zoom.min; z.max = cap.zoom.max; z.step = cap.zoom.step || 0.1; z.value = (tr.getSettings && tr.getSettings().zoom) || cap.zoom.min; z.classList.remove('hidden'); z.oninput = () => { try { tr.applyConstraints({ advanced: [{ zoom: +z.value }] }); } catch (_) {} }; }
      } catch (_) {}
      const kb = el.querySelector('#sc-keep'); kb.classList.toggle('on', !!this.keep && !o.once);
      if (o.once || o.continuous) kb.classList.add('hidden');
      kb.onclick = () => { this.keep = !this.keep; kb.classList.toggle('on', this.keep); this.flash(this.keep ? 'Keep scanning: ON' : 'Keep scanning: OFF', 'ok'); };
      const tb2 = el.querySelector('#sc-typebox'), ti = el.querySelector('#sc-code');
      const submit = () => { const v = ti.value.trim(); if (!v) return; ti.value = ''; got(v, true); };
      el.querySelector('#sc-type').onclick = () => { tb2.classList.toggle('hidden'); if (!tb2.classList.contains('hidden')) setTimeout(() => ti.focus(), 30); };
      el.querySelector('#sc-ok').onclick = submit;
      ti.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
      this.timer = setInterval(async () => {
        if (!this.el || this.busy || v.readyState < 2) return;
        this.busy = true;
        try {
          const codes = await det.detect(v);
          if (!this.el || tok !== this.tok || !codes.length) return;
          const code = String(codes[0].rawValue || '').trim(); if (!code) return;
          got(code, false);
        } catch (_) {} finally { this.busy = false; }
      }, fallback ? 260 : 220);
    },
    /* unknown barcode → a bar with an "Add product" button (works over the camera and on normal screens) */
    unknown(code, msg) {
      document.querySelectorAll('.addbar').forEach(e => e.remove());
      const bar = document.createElement('div'); bar.className = 'addbar' + (this.el ? ' in-scan' : '');
      bar.innerHTML = `<span class="ab-t"><i class="fas fa-triangle-exclamation"></i> ${esc(msg || 'Barcode not found')}<b>${esc(code)}</b></span><button type="button" class="btn btn-primary btn-sm"><i class="fas fa-plus"></i> Add product</button><button type="button" class="ab-x" aria-label="Dismiss"><i class="fas fa-xmark"></i></button>`;
      (this.el || document.body).appendChild(bar);
      const gone = () => { clearTimeout(bar._t); bar.remove(); };
      bar.querySelector('.btn').onclick = () => { gone(); if (window.Products) Products.addWithBarcode(code); };
      bar.querySelector('.ab-x').onclick = gone; bar._t = setTimeout(gone, 9000);
    },
    flash(msg, kind) {
      const m = this.el && this.el.querySelector('#sc-msg'); if (!m) { toast(msg); return; }
      m.textContent = msg; m.className = 'sc-msg ' + (kind || '');
      clearTimeout(this.msgT); this.msgT = setTimeout(() => { if (m) m.classList.add('hidden'); }, 2200);
    },
    close() {
      document.querySelectorAll('.addbar.in-scan').forEach(e => e.remove());
      this.tok++; this.opening = false; clearInterval(this.timer); this.timer = null; clearTimeout(this.msgT);
      if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
      if (this.el) { const v = this.el.querySelector('video'); if (v) v.srcObject = null; this.el.remove(); this.el = null; }
      this.busy = false; syncLock();
    }
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && Scanner.isOpen()) Scanner.close(); });
  window.addEventListener('pagehide', () => { if (Scanner.isOpen()) Scanner.close(); });
  async function legacyHash(pin, salt) {
    const s = salt + ':' + pin;
    if (window.crypto && crypto.subtle) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''); }
    let h1 = 5381, h2 = 52711; for (let i = 0; i < s.length; i++) { h1 = (h1 * 33) ^ s.charCodeAt(i); h2 = (h2 * 33) ^ s.charCodeAt(s.length - 1 - i); } return 'x' + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
  }
  // v10.14: PIN is stored as PBKDF2-SHA256 (150,000 rounds) with a per-device salt; old SHA-256 PINs upgrade silently on the next correct entry.
  async function hashPin(pin, salt) {
    if (window.crypto && crypto.subtle) {
      try {
        const enc = new TextEncoder(), key = await crypto.subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('esypos:' + salt), iterations: 150000 }, key, 256);
        return 'p2$' + Array.from(new Uint8Array(bits)).map(x => x.toString(16).padStart(2, '0')).join('');
      } catch (_) {}
    }
    return legacyHash(pin, salt);
  }
  async function verifyPin(pin) {
    const st = DB.settings.pinHash, salt = DB.settings.pinSalt; if (!st) return false;
    if (st.indexOf('p2$') === 0) return (await hashPin(pin, salt)) === st;
    if ((await legacyHash(pin, salt)) === st) { try { DB.settings.pinHash = await hashPin(pin, salt); C.save('settings'); } catch (_) {} return true; }
    return false;
  }
  const Lock = window.Lock = {
    hiddenAt: 0, el: null, hashFor: hashPin, verify: verifyPin,
    isWeak(p) { return /^(\d)\1{3}$/.test(p) || ['0123','1234','2345','3456','4567','5678','6789','9876','8765','7654','6543','5432','4321','3210','1212','2580','1122','0852','1357','2468','0007','1004','1010','2000','2001','1990','1991','1992','1993','1994','1995','1996','1997','1998','1999','2002','2003','2004','2005','2006','2007','2008','2009','2010','2011','2012','2013','2014','2015','2016','2017','2018','2019','2020','2021','2022','2023','2024','2025','2026','2027','2028'].indexOf(p) >= 0; },
    toggleUI(el) {
      const on = el.checked; el.checked = this.has();      // reverts visually until the PIN flow succeeds
      if (on) this.setup(); else this.remove();
    },
    get fails() { try { return parseInt(localStorage.getItem('esypos_lk_f') || '0', 10) || 0; } catch (_) { return 0; } },
    set fails(v) { try { localStorage.setItem('esypos_lk_f', String(v)); } catch (_) {} },
    get until() { try { return parseInt(localStorage.getItem('esypos_lk_u') || '0', 10) || 0; } catch (_) { return 0; } },
    set until(v) { try { localStorage.setItem('esypos_lk_u', String(v)); } catch (_) {} },
    has() { return !!DB.settings.pinHash; },
    init(start) { if (this.has()) this.show(start); else start(); },
    lockNow() { if (!this.has()) { toast('Set a PIN first — then the app can be locked'); this.setup(); return; } if (window.Modal) Modal.closeAll(); if (window.App) App.closeDrawers(); this.show(() => {}); },
    onHide() { this.hiddenAt = Date.now(); },
    autoMs() { const v = parseInt(DB.settings.autoLockMin, 10); return v === 0 ? 1200 : Math.max(3, v || 3) * 60000; },   // 0 = "as soon as I leave the app" (a 1 s blink such as a permission pop-up does not count)
    onResume() { if (this.has() && !this.el && this.hiddenAt && Date.now() - this.hiddenAt > this.autoMs()) this.show(() => {}); },
    penalty() {                                   // 30s, 1m, 5m, 15m, 30m for repeated lock-outs
      let lv = 0; try { lv = parseInt(localStorage.getItem('esypos_lk_l') || '0', 10) || 0; localStorage.setItem('esypos_lk_l', String(lv + 1)); } catch (_) {}
      const secs = [30, 60, 300, 900, 1800][Math.min(4, lv)]; this.until = Date.now() + secs * 1000; this.fails = 0; return secs;
    },
    async check(pin) {                            // used by section locks: 'ok' | 'bad' | 'wait'
      if (Date.now() < this.until) return 'wait';
      if (await verifyPin(pin)) { this.fails = 0; try { localStorage.removeItem('esypos_lk_l'); } catch (_) {} return 'ok'; }
      this.fails = this.fails + 1; if (this.fails >= 5) { this.penalty(); return 'wait'; }
      return 'bad';
    },
    show(done) {
      if (this.el) return; let pin = '', busy = false, tick = null;
      const el = document.createElement('div'); el.className = 'lock'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Enter PIN to unlock');
      const order = (window.Keypad ? Keypad.digits() : [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);
      const keys = order.slice(0, 9).concat(['', order[9], '⌫']);
      el.innerHTML = `<div class="logo" style="width:72px;height:72px"><img class="logo-img" src="assets/icons/icon-192.png" alt="Old POS" draggable="false"></div><h2>${esc(DB.settings.shopName)}</h2><p>Unlock with PIN</p><div class="dots" id="lk-dots"><i></i><i></i><i></i><i></i></div><div class="lk-msg" id="lk-msg" role="alert"></div>
        <div class="keypad">${keys.map(k => k === '' ? '<span></span>' : `<button type="button" data-k="${k}"${k === '⌫' ? ' aria-label="Backspace"' : ''}>${k}</button>`).join('')}</div>
        <button type="button" id="lk-forgot" style="margin-top:26px;background:none;border:0;color:#fff;opacity:.7;font-size:13px;cursor:pointer;text-decoration:underline">Forgot PIN?</button>`;
      document.body.appendChild(el); this.el = el; syncLock();
      const dots = el.querySelectorAll('#lk-dots i'), msg = el.querySelector('#lk-msg');
      const paint = () => dots.forEach((d, i) => d.classList.toggle('f', i < pin.length));
      const leftS = () => Math.max(0, Math.ceil((this.until - Date.now()) / 1000));
      const fmtWait = n => n >= 60 ? Math.ceil(n / 60) + ' min' : n + ' s';
      const showWait = () => {
        const n = leftS();
        if (n > 0) { msg.textContent = '⚠️ Too many wrong attempts — try again in ' + fmtWait(n); if (!tick) tick = setInterval(showWait, 1000); }
        else { msg.textContent = ''; if (tick) { clearInterval(tick); tick = null; } }
      };
      const close = () => { if (tick) clearInterval(tick); window.removeEventListener('keydown', onKey, true); el.remove(); this.el = null; syncLock(); };
      const press = async k => {
        if (busy) return;
        if (leftS() > 0) { pin = ''; paint(); showWait(); return; }
        if (k === '⌫') pin = pin.slice(0, -1); else if (/^\d$/.test(k) && pin.length < 4) pin += k; else return;
        paint(); msg.textContent = '';
        if (pin.length === 4) {
          busy = true;
          const ok = await verifyPin(pin);
          if (ok) { this.fails = 0; try { localStorage.removeItem('esypos_lk_l'); } catch (_) {} close(); busy = false; done && done(); return; }
          this.fails = this.fails + 1;
          if (this.fails >= 5) { this.penalty(); showWait(); } else msg.textContent = '⚠️ Wrong PIN — ' + (5 - this.fails) + ' tr' + (5 - this.fails === 1 ? 'y' : 'ies') + ' left';
          const d = el.querySelector('#lk-dots'); d.classList.add('shake'); if (navigator.vibrate) navigator.vibrate(120);
          setTimeout(() => { d.classList.remove('shake'); pin = ''; paint(); busy = false; }, 450);
        }
      };
      const onKey = e => {                                          // hardware keyboard (desktop)
        if (e.ctrlKey || e.metaKey || e.altKey || Modal.stack.length) return;      // a dialog (e.g. the recovery question) owns the keyboard
        if (/^\d$/.test(e.key)) { e.preventDefault(); e.stopPropagation(); press(e.key); }
        else if (e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); press('⌫'); }
      };
      window.addEventListener('keydown', onKey, true);
      el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => press(b.dataset.k));
      showWait();
      el.querySelector('#lk-forgot').onclick = () => {
        const viaGoogle = (window.Cloud && Cloud.isOn()) ? () => Cloud.resetPin() : null;
        if (window.Recovery && Recovery.has('pin')) { Recovery.forgot('pin', () => { close(); done && done(); }, viaGoogle); return; }   // v12.7: secret question first
        if (window.Cloud && Cloud.isOn()) Cloud.resetPin();
        else askConfirm('Without a Google backup, the only way to remove a forgotten PIN is to wipe all data on this device. Continue?', () => { wipeAllData(); }, { danger: true, yes: 'Wipe & Reset Data', title: 'Reset PIN' });
      };
    },
    setup() {
      const has = this.has();
      const m = Modal.open({ title: has ? 'Change PIN' : 'Set PIN', body: `${window.Recovery ? Recovery.fieldsHTML('pin') : ''}
        ${has ? '<div class="field mt3"><label class="label">Current PIN</label><input id="pn-old" type="password" data-pin="1" readonly inputmode="none" maxlength="4" class="input"></div>' : ''}
        <div class="field${has ? '' : ' mt3'}"><label class="label">New PIN (4 digits)</label><input id="pn-new" type="password" data-pin="1" readonly inputmode="none" maxlength="4" class="input"></div>
        <div class="field"><label class="label">Re-enter</label><input id="pn-new2" type="password" data-pin="1" readonly inputmode="none" maxlength="4" class="input"></div>`, foot: `<button class="btn" onclick="Modal.closeFrom(this)">Cancel</button><button class="btn btn-primary" id="pn-ok">Save</button>` });
      m.querySelector('#pn-ok').onclick = async () => {
        if (has) { const r = await Lock.check($('pn-old').value); if (r !== 'ok') { toast(r === 'wait' ? '⚠️ Too many wrong attempts — try again later' : '⚠️ Current PIN is wrong'); $('pn-old').value = ''; return; } }
        const a = $('pn-new').value, b = $('pn-new2').value; if (!/^\d{4}$/.test(a)) { toast('⚠️ Enter exactly 4 digits'); return; } if (Lock.isWeak(a)) { toast('⚠️ That PIN is too easy to guess — choose another'); return; } if (a !== b) { toast('⚠️ PINs do not match'); return; }
        const rec = window.Recovery ? Recovery.read('pin', a) : null; if (window.Recovery && !rec) return;      // the recovery question is part of setting a PIN
        const salt = C.genId(); DB.settings.pinSalt = salt; DB.settings.pinHash = await hashPin(a, salt);
        if (rec) await Recovery.commit('pin', rec);
        ['esypos_lk_f', 'esypos_lk_u', 'esypos_lk_l'].forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
        C.save('settings'); Modal.close(m); toast('PIN set ✓'); App.refresh(); if (window.Cloud && Cloud.reconnect) setTimeout(() => Cloud.reconnect(), 450);
      };
    },
    remove() {
      const m = Modal.open({ title: 'Disable PIN', body: '<div class="field"><label class="label">Current PIN</label><input id="pn-old" type="password" data-pin="1" readonly inputmode="none" maxlength="4" class="input" autofocus></div>', foot: `<button class="btn" onclick="Modal.closeFrom(this)">Cancel</button><button class="btn btn-bad" id="pn-ok">Disable PIN</button>` });
      m.querySelector('#pn-ok').onclick = async () => { const r = await Lock.check($('pn-old').value); if (r !== 'ok') { toast(r === 'wait' ? '⚠️ Too many wrong attempts — try again later' : '⚠️ Wrong PIN'); $('pn-old').value = ''; return; } DB.settings.pinHash = ''; DB.settings.pinSalt = ''; if (window.Recovery) Recovery.clear('pin'); C.save('settings'); Modal.close(m); toast('PIN disabled'); App.refresh(); };
    }
  };
  const SERVICES = ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '0000ff00-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb', '0000ffb0-0000-1000-8000-00805f9b34fb'];
  const Printer = window.Printer = {
    dev: null, ch: null, name: '',
    isConnected() { return !!(this.ch && this.dev && this.dev.gatt && this.dev.gatt.connected); },
    ui() {
      const ok = this.isConnected(); const s = $('bt-status'); if (s) s.innerHTML = ok ? `<span class="badge b-ok">● Connected: ${esc(this.name)}</span>` : '<span class="badge">● Not connected</span>';
      const c = $('bt-conn'), d = $('bt-disc'); if (c) c.classList.toggle('hidden', ok); if (d) d.classList.toggle('hidden', !ok);
    },
    async connect() {
      if (!navigator.bluetooth) { toast('⚠️ Web Bluetooth not available. Use Android Chrome/Edge.'); return false; }
      try {
        toast('Searching for printer...');
        this.dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: SERVICES });
        this.dev.addEventListener('gattserverdisconnected', () => { this.ch = null; this.ui(); toast('Printer disconnected'); });
        const server = await this.dev.gatt.connect(); const services = await server.getPrimaryServices(); let found = null;
        for (const sv of services) { const cs = await sv.getCharacteristics(); for (const c of cs) { if (c.properties.write || c.properties.writeWithoutResponse) { found = c; break; } } if (found) break; }
        if (!found) throw new Error('Printer write channel not available');
        this.ch = found; this.name = this.dev.name || 'Printer'; this.ui(); toast('Printer connected ✓'); return true;
      } catch (e) { console.error(e); toast(e.name === 'NotFoundError' ? 'No device selected' : '⚠️ Connection failed: ' + (e.message || '')); this.ch = null; this.ui(); return false; }
    },
    disconnect() { try { if (this.dev && this.dev.gatt.connected) this.dev.gatt.disconnect(); } catch (_) {} this.ch = null; this.ui(); },
    async write(bytes) {
      const size = 100;
      for (let i = 0; i < bytes.length; i += size) {
        const chunk = bytes.slice(i, i + size);
        if (this.ch.properties.writeWithoutResponse) await this.ch.writeValueWithoutResponse(chunk); else await this.ch.writeValue(chunk);
        await new Promise(r => setTimeout(r, 18));
      }
    },
    async print(sale) {
      if (!sale) return;
      if (!this.isConnected()) { const ok = await this.connect(); if (!ok) return; }
      try { toast('Printing...'); const data = DB.settings.btMode === 'text' ? this.textJob(sale) : await this.imageJob(sale); await this.write(data); toast('Print done ✓'); }
      catch (e) { console.error(e); toast('⚠️ Print failed: ' + (e.message || 'Error')); }
    },
    lines(s) {
      const sh = DB.settings; const cust = C.findCustomer(s.customerId); const bal = cust ? C.customerBalance(cust.id) : 0; const L = [];
      const MN = { cash: 'Cash', card: 'Card', mobile: 'Mobile', due: 'Due' };
      L.push({ t: sh.shopName || 'Old POS', a: 'c', b: 1, s: 28 });
      if (sh.shopAddress) L.push({ t: sh.shopAddress, a: 'c', s: 20 }); if (sh.shopPhone) L.push({ t: 'Phone: ' + sh.shopPhone, a: 'c', s: 20 }); if (sh.taxId) L.push({ t: 'VAT/BIN: ' + sh.taxId, a: 'c', s: 20 });
      L.push({ hr: 1 }, { t: 'Receipt no.', t2: '#' + C.invLabel(s), s: 21 }, { t: 'Date', t2: C.fmtDT(s.date), s: 21 });
      if (cust) L.push({ t: 'Customer', t2: cust.name, s: 21 }); L.push({ t: 'Payment', t2: MN[s.paymentMethod] || '', s: 21 }, { hr: 1 });
      s.items.forEach(i => { L.push({ t: i.name, s: 22, b: 1 }); if (i.note) L.push({ t: '+ ' + i.note, s: 19 }); L.push({ t: i.qty + ' × ' + fmt(i.price), t2: fmt(i.price * i.qty), s: 21 }); });
      L.push({ hr: 1 }, { t: 'Subtotal', t2: fmt(s.subtotal), s: 21 });
      if (s.discount > 0) L.push({ t: 'Discount', t2: '-' + fmt(s.discount), s: 21 }); if (s.tax > 0) L.push({ t: 'Tax', t2: fmt(s.tax), s: 21 });
      L.push({ t: 'Total', t2: C.cur() + fmt(s.total), s: 28, b: 1 }, { t: 'Paid', t2: fmt(s.paid), s: 21 });
      if (s.change > 0) L.push({ t: 'Change given', t2: fmt(s.change), s: 21 }); if (s.due > 0) L.push({ t: 'Due on this bill', t2: fmt(s.due), s: 23, b: 1 });
      const retAmt = C.returnedAmount(s.id); if (retAmt > 0) L.push({ t: 'Returned', t2: '-' + fmt(retAmt), s: 21 });
      if (cust && bal > 0) L.push({ t: 'Total due', t2: fmt(bal), s: 23, b: 1 });
      if (s.note) L.push({ t: 'Note: ' + s.note, s: 19 });
      L.push({ hr: 1 }, { t: sh.footer || '', a: 'c', s: 20 }, { gap: 40 });
      return L;
    },
    async imageJob(sale) {
      const W = DB.settings.paper === '80' ? 576 : 384; const pad = 6;
      try { await document.fonts.load('20px Inter'); } catch (_) {}
      const cv = document.createElement('canvas'); cv.width = W; let ctx = cv.getContext('2d');
      const font = (s, b) => `${b ? '700 ' : ''}${s}px Inter, system-ui, sans-serif`;
      const wrap = (txt, maxW, f) => { ctx.font = f; const out = []; let line = ''; String(txt).split(' ').forEach(w => { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }); if (line) out.push(line); return out; };
      const layout = []; let y = 4;
      this.lines(sale).forEach(l => {
        if (l.hr) { layout.push({ hr: 1, y: y + 6 }); y += 14; return; } if (l.gap) { y += l.gap; return; }
        const f = font(l.s, l.b); const lh = Math.round(l.s * 1.45);
        if (l.t2 !== undefined) { ctx.font = f; const rw = ctx.measureText(l.t2).width; const lines = wrap(l.t, W - rw - pad * 3, f); lines.forEach((ln, k) => { layout.push({ f, x: pad, y: y + lh * (k + 1) - 6, t: ln }); }); layout.push({ f, right: 1, y: y + lh - 6, t: l.t2 }); y += lh * Math.max(1, lines.length); }
        else { wrap(l.t, W - pad * 2, f).forEach(ln => { layout.push({ f, c: l.a === 'c', y: y + lh - 6, t: ln, x: pad }); y += lh; }); }
      });
      cv.height = y + 10; ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, cv.height); ctx.fillStyle = '#000'; ctx.textBaseline = 'alphabetic';
      layout.forEach(it => { if (it.hr) { for (let x = 0; x < W; x += 8) ctx.fillRect(x, it.y, 4, 2); return; } ctx.font = it.f; const w = ctx.measureText(it.t).width; ctx.fillText(it.t, it.right ? W - pad - w : it.c ? (W - w) / 2 : it.x, it.y); });
      const img = ctx.getImageData(0, 0, W, cv.height).data; const bpr = W / 8; const out = [0x1B, 0x40, 0x1B, 0x61, 0x00];
      for (let y0 = 0; y0 < cv.height; y0 += 96) {
        const h = Math.min(96, cv.height - y0); out.push(0x1D, 0x76, 0x30, 0x00, bpr & 255, bpr >> 8, h & 255, h >> 8);
        for (let yy = 0; yy < h; yy++) for (let bx = 0; bx < bpr; bx++) { let byte = 0; for (let bit = 0; bit < 8; bit++) { const i = ((y0 + yy) * W + bx * 8 + bit) * 4; const lum = img[i] * .3 + img[i + 1] * .59 + img[i + 2] * .11; if (lum < 150 && img[i + 3] > 20) byte |= 0x80 >> bit; } out.push(byte); }
      }
      out.push(0x1B, 0x64, 0x04, 0x1D, 0x56, 0x01); return new Uint8Array(out);
    },
    textJob(s) {
      const sh = DB.settings; const w = sh.paper === '80' ? 48 : 32; const asc = t => String(t || '').replace(/[^\x20-\x7E]/g, '?');
      const lr = (a, b) => { a = asc(a); b = asc(b); return a.slice(0, Math.max(1, w - b.length - 1)).padEnd(w - b.length) + b + '\n'; };
      const e = new TextEncoder(); const o = []; const t = x => e.encode(x).forEach(c => o.push(c));
      o.push(0x1B, 0x40, 0x1B, 0x61, 0x01, 0x1B, 0x21, 0x30); t(asc(sh.shopName || 'Old POS') + '\n'); o.push(0x1B, 0x21, 0x00); if (sh.shopPhone) t('Tel: ' + asc(sh.shopPhone) + '\n'); if (sh.taxId) t('VAT/BIN: ' + asc(sh.taxId) + '\n'); t('-'.repeat(w) + '\n'); o.push(0x1B, 0x61, 0x00);
      t(lr('No', '#' + C.invLabel(s))); t(lr('Date', C.dkey(s.date))); t('-'.repeat(w) + '\n');
      s.items.forEach(i => { t(asc(i.name) + '\n'); if (i.note) t('  + ' + asc(i.note) + '\n'); t(lr('  ' + i.qty + ' x ' + i.price.toFixed(2), (i.price * i.qty).toFixed(2))); });
      t('-'.repeat(w) + '\n'); t(lr('Subtotal', s.subtotal.toFixed(2))); if (s.discount > 0) t(lr('Discount', '-' + s.discount.toFixed(2))); if (s.tax > 0) t(lr('Tax', s.tax.toFixed(2)));
      o.push(0x1B, 0x21, 0x08); t(lr('TOTAL', s.total.toFixed(2))); o.push(0x1B, 0x21, 0x00); t(lr('Paid', s.paid.toFixed(2))); if (s.due > 0) t(lr('DUE', s.due.toFixed(2)));
      o.push(0x1B, 0x61, 0x01); t('\nThank You!\n\n\n\n'); o.push(0x1D, 0x56, 0x01); return new Uint8Array(o);
    }
  };
  App.Views.settings = {
    sec: undefined,
    open(id, quiet) {
      const wide = window.matchMedia('(min-width:1024px)').matches;
      if (!id && wide) id = 'shop';
      this.sec = id || '';
      const st = $('st'); if (!st) return;
      st.classList.toggle('in-sec', !!this.sec);
      st.querySelectorAll('.st-sec').forEach(x => x.classList.toggle('on', x.dataset.s === this.sec));
      st.querySelectorAll('.st-item').forEach(x => x.classList.toggle('on', x.dataset.s === this.sec));
      if (!quiet) window.scrollTo(0, 0);
    },
    back() { this.open(''); },
    async sysStatus() {
      const P = window.PWA; if (!P) return;
      const set = (i, ok, t) => { const d = $('sy-d' + i), x = $('sy-s' + i); if (d) d.className = 'sys-dot ' + (ok === true ? 'ok' : ok === false ? 'warn' : ''); if (x) x.textContent = t; };
      const ctl = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
      set(1, ctl, ctl ? 'Opens and sells without internet' : 'Reload once while online to turn on offline mode');
      const inst = P.isInstalled(); set(2, inst, inst ? 'Running as an installed app' : 'Using the browser — install for a full-screen app');
      const b = $('sy-inst'); if (b) b.classList.toggle('hidden', inst || !P.canInstall());
      const per = await P.persisted(); set(3, per, per ? 'The browser will not delete your shop data' : 'The browser may clear data when storage is low — keep Google Drive backup on');
      const e = await P.estimate(), s4 = $('sy-s4');
      if (s4 && e && e.usage != null) s4.textContent = (e.usage / 1048576).toFixed(1) + ' MB used' + (e.quota ? ' of ' + (e.quota > 1073741824 ? (e.quota / 1073741824).toFixed(1) + ' GB' : Math.round(e.quota / 1048576) + ' MB') : '');
    },
    async checkUpdate(btn) { if (btn) btn.disabled = true; try { await (window.PWA && PWA.checkUpdate()); } catch (_) {} toast('Checked for updates ✓'); if (btn) btn.disabled = false; },
    render() {
      const s = DB.settings;
      const SEC = [
        ['shop', 'fa-store', 'Shop info', 'Name, address, phone, currency'],
        ['billing', 'fa-receipt', 'Billing & receipt', 'Tax, invoice, receipt text, paper'],
        ['barcode', 'fa-barcode', 'Barcode', 'Prefix, format, counter'],
        ['appearance', 'fa-palette', 'Appearance & sound', 'Themes, dark mode, sound'],
        ['security', 'fa-lock', 'Security', 'PIN lock'],
        ['printers', 'fa-print', 'Printers', 'Label and Bluetooth receipt printer'],
        ['backup', 'fa-cloud-arrow-up', 'Backup & data', 'Google Drive, backup file, reset'],
        ['system', 'fa-mobile-screen-button', 'App & device', 'Install, updates, offline, storage'],
        ['about', 'fa-scale-balanced', 'About & legal', 'Privacy, terms, license']
      ];
      const sec = (id, body) => { const m = SEC.find(x => x[0] === id); return `<section class="st-sec" data-s="${id}"><div class="st-sec-head"><button type="button" class="icon-btn st-back" onclick="Settings.back()" aria-label="Back to settings"><i class="fas fa-chevron-right fa-rotate-180"></i></button><div class="st-ico"><i class="fas ${m[1]}"></i></div><div><h3>${m[2]}</h3><p>${m[3]}</p></div></div>${body}</section>`; };
      const SAVE = `<button class="btn btn-primary btn-block" onclick="Settings.save()"><i class="fas fa-floppy-disk"></i> Save changes</button><div class="save-state js-save-state" role="status" aria-live="polite"></div>`;
      $('view').innerHTML = `<div class="st" id="st">
      <div class="page-head"><div><h2>Settings</h2><p>Shop, appearance, security, printer & data</p></div></div>
      <div class="st-wrap">
      <nav class="st-nav card" aria-label="Settings sections">${SEC.map(m => `<button type="button" class="st-item" data-s="${m[0]}" onclick="Settings.open('${m[0]}')"><span class="st-ico"><i class="fas ${m[1]}"></i></span><span class="st-txt"><b>${m[2]}</b><small>${m[3]}</small></span><i class="fas fa-chevron-right st-go"></i></button>`).join('')}</nav>
      <div class="st-panel">
      ${sec('shop', `<div class="card pad mb3">
        <div class="field"><label class="label">Shop name</label><input id="st-name" class="input" value="${esc(s.shopName)}"></div>
        <div class="field"><label class="label">Address</label><input id="st-addr" class="input" value="${esc(s.shopAddress)}"></div>
        <div class="grid2"><div class="field"><label class="label">Phone</label><input id="st-phone" class="input" value="${esc(s.shopPhone)}"></div><div class="field"><label class="label">Currency symbol</label><input id="st-cur" class="input" maxlength="4" value="${esc(s.currency)}" placeholder="$"></div></div>
        <div class="field"><label class="label">Business type</label><select id="st-biz" class="input">
          <option value="retail" ${(s.businessType||'retail')==='retail'?'selected':''}>Retail / General shop</option>
          <option value="restaurant" ${s.businessType==='restaurant'?'selected':''}>Restaurant / Cafe / Fast food</option>
          <option value="pharmacy" ${s.businessType==='pharmacy'?'selected':''}>Pharmacy / Medicine</option>
          <option value="grocery" ${s.businessType==='grocery'?'selected':''}>Grocery / Supermarket</option>
          <option value="electronics" ${s.businessType==='electronics'?'selected':''}>Electronics / Mobile</option>
          <option value="clothing" ${s.businessType==='clothing'?'selected':''}>Clothing / Fashion</option>
          <option value="wholesale" ${s.businessType==='wholesale'?'selected':''}>Wholesale / Distributor</option>
          <option value="hardware" ${s.businessType==='hardware'?'selected':''}>Hardware / Building materials</option>
          <option value="bakery" ${s.businessType==='bakery'?'selected':''}>Bakery / Sweets / Food shop</option>
          <option value="cosmetics" ${s.businessType==='cosmetics'?'selected':''}>Cosmetics / Beauty</option>
          <option value="service" ${s.businessType==='service'?'selected':''}>Service / Salon / Repair (no stock)</option>
          <option value="other" ${s.businessType==='other'?'selected':''}>Other business</option>
        </select>
        <p class="xs muted mt1">Adds matching fields to the product form. Example amount: <b>${esc(s.currency)}1,250.50</b></p></div>
        ${SAVE}</div>`)}
      ${sec('billing', `<div class="card pad mb3">
        <div class="grid2"><div class="field"><label class="label">Default tax (%)</label><input id="st-tax" type="number" step="any" min="0" class="input" value="${s.defaultTax || 0}"></div><div class="field"><label class="label">Invoice prefix</label><input id="st-pre" class="input" value="${esc(s.invPrefix)}" placeholder="INV-"></div></div>
        <div class="grid2"><div class="field"><label class="label">Paper</label><select id="st-paper" class="input"><option value="58" ${s.paper === '58' ? 'selected' : ''}>58 mm</option><option value="80" ${s.paper === '80' ? 'selected' : ''}>80 mm</option></select></div><div class="field"><label class="label">Low stock (default)</label><input id="st-low" type="number" min="0" class="input" value="${s.lowStockDefault == null ? 5 : s.lowStockDefault}"></div></div>
        <div class="field"><label class="label">Receipt footer text</label><input id="st-foot" class="input" value="${esc(s.footer)}"></div>
        <div class="field"><label class="label">VAT / BIN / Tax ID (printed on receipt, optional)</label><input id="st-taxid" class="input" maxlength="40" value="${esc(s.taxId || '')}"></div>
        ${SAVE}</div>`)}
      ${sec('barcode', `<div class="card pad mb3">
        <div class="grid2"><div class="field"><label class="label">Barcode prefix</label><input id="st-bcpre" class="input" maxlength="6" value="${esc(s.barcodePrefix||'ESY')}" placeholder="ESY"></div>
          <div class="field"><label class="label">Default barcode format</label><select id="st-bcfmt" class="input"><option value="code128" ${(s.barcodeFormat||'code128')==='code128'?'selected':''}>Code 128</option><option value="ean13" ${s.barcodeFormat==='ean13'?'selected':''}>EAN-13</option><option value="qr" ${s.barcodeFormat==='qr'?'selected':''}>QR Code</option></select></div></div>
        <div class="field"><label class="label">Next barcode number</label><input id="st-bcnext" type="number" min="1" step="1" class="input" value="${parseInt(s.nextBarcode, 10) || 1000001}"><p class="xs muted mt1">Next code: <b>${esc((window.BarcodeGen ? BarcodeGen.uniqueCode(s.barcodePrefix || 'ESY', s.nextBarcode) : ''))}</b> · each Generate uses this number, then adds 1</p></div>
        ${SAVE}</div>`)}
      ${sec('appearance', `<div class="card pad mb3">
        <div class="field"><div class="label">Theme</div>${window.Skin ? Skin.html() : ''}<p class="xs muted mt2">Pick a colour theme — it changes the whole software instantly. <b>Classic</b> is the default.</p></div>
        <div class="field"><div class="label">Mode</div><div class="mode-seg" role="group" aria-label="Mode">
          <button type="button" data-m="auto" class="${Theme.mode === 'auto' ? 'on' : ''}" onclick="Theme.set('auto')"><i class="fas fa-mobile-screen"></i> Auto</button>
          <button type="button" data-m="light" class="${Theme.mode === 'light' ? 'on' : ''}" onclick="Theme.set('light')"><i class="fas fa-sun"></i> Light</button>
          <button type="button" data-m="dark" class="${Theme.mode === 'dark' ? 'on' : ''}" onclick="Theme.set('dark')"><i class="fas fa-moon"></i> Dark</button></div></div>
        <label class="switch"><span class="sm fw6"><i class="fas fa-volume-high ptext"></i> Click sound</span><input type="checkbox" ${Sound.isEnabled() ? 'checked' : ''} onchange="Sound.setEnabled(this.checked)"></label>
        ${Haptic.supported() ? `<label class="switch mt2"><span class="sm fw6"><i class="fas fa-mobile-screen ptext"></i> Vibration feedback</span><input type="checkbox" ${Haptic.isEnabled() ? 'checked' : ''} onchange="Haptic.setEnabled(this.checked)"></label>` : ''}</div>`)}
      ${sec('security', `<div class="card pad mb3" id="screen-lock-card"><div class="sec-title"><i class="fas fa-mobile-screen-button ptext"></i> 1. Home screen lock</div>
        <p class="muted sm mb3">${Lock.has() ? 'ON — this PIN is asked every time the app opens and after idle.' : 'OFF — turn on to ask a PIN every time the app opens.'}</p>
        <label class="switch"><span class="sm fw6"><i class="fas fa-lock ptext"></i> Home screen lock</span><input type="checkbox" ${Lock.has() ? 'checked' : ''} onchange="Lock.toggleUI(this)"></label>
        ${Lock.has() ? '<div class="flex gap2"><button class="btn btn-ghost grow" onclick="Lock.setup()">Change PIN</button><button class="btn btn-primary grow" onclick="Lock.lockNow()"><i class="fas fa-lock"></i> Lock app now</button></div>' + (window.Recovery ? Recovery.rowHTML('pin') : '') : ''}
        <label class="switch mt3"><span class="sm fw6"><i class="fas fa-rotate ptext"></i> Scramble keypad digits</span><input type="checkbox" ${DB.settings.keypadShuffle ? 'checked' : ''} onchange="Keypad.setScramble(this.checked)"></label>
        <p class="xs muted mt2">PINs are always typed on the secure on-screen keypad, never on the phone keyboard. Scrambling moves the digits every time so nobody can copy the pattern of your taps.</p></div>`)}
      ${sec('printers', `${window.LP ? LP.cardHTML() : ''}
      <div class="card pad mb3"><div class="sec-title"><i class="fab fa-bluetooth-b ptext"></i> Bluetooth printer</div><div class="mb3" id="bt-status"></div>
        <div class="field"><label class="label">Print mode</label><select class="input" onchange="DB_.btMode(this.value)"><option value="image" ${s.btMode !== 'text' ? 'selected' : ''}>Image mode — supports all languages (recommended)</option><option value="text" ${s.btMode === 'text' ? 'selected' : ''}>Text mode — English only, faster</option></select></div>
        <div class="flex gap2"><button class="btn btn-primary grow" id="bt-conn" onclick="Printer.connect()"><i class="fab fa-bluetooth-b"></i> Connect printer</button><button class="btn btn-danger-soft grow hidden" id="bt-disc" onclick="Printer.disconnect()">Disconnect</button></div>
        <p class="xs muted mt2">Android Chrome/Edge. Pair in Bluetooth first.</p></div>`)}
      ${sec('backup', `<div class="card pad mb3"><div class="sec-title"><i class="fas fa-cloud-arrow-up ptext"></i> Google Drive Cloud Backup</div><div class="js-cloud-body"></div></div>
      <div class="card pad mb3"><div class="sec-title"><i class="fas fa-database ptext"></i> Data management</div>
        <p class="xs muted mt2">Sales save to <b>Google Drive</b> instantly; this device keeps a working copy for offline use.</p>
        <div class="grid2 mt3"><button class="btn btn-ghost" onclick="exportBackupFile()"><i class="fas fa-file-export"></i> Save backup file</button><label class="btn btn-ghost" style="cursor:pointer"><i class="fas fa-file-import"></i> Restore from file<input type="file" accept=".json,application/json" class="hidden" onchange="importData(this)"></label></div>
        <p class="xs muted mt2">Optional copy to keep outside Google Drive. Nothing is downloaded automatically, and the file does not contain your PIN.</p>
        <button class="btn btn-danger-soft btn-block mt2" onclick="wipeAllData()"><i class="fas fa-trash"></i> Delete all data</button></div>`)}
      ${sec('system', `<div class="card pad mb3" id="sys-card">
        <div class="sys-row"><span class="sys-dot" id="sy-d1"></span><div class="sys-k">Works offline<small id="sy-s1">Checking…</small></div></div>
        <div class="sys-row"><span class="sys-dot" id="sy-d2"></span><div class="sys-k">Installed as an app<small id="sy-s2">Checking…</small></div><button type="button" class="btn btn-primary hidden" id="sy-inst" onclick="PWA.install()">Install</button></div>
        <div class="sys-row"><span class="sys-dot" id="sy-d3"></span><div class="sys-k">Data protected from cleanup<small id="sy-s3">Checking…</small></div></div>
        <div class="sys-row"><span class="sys-dot ok"></span><div class="sys-k">Version<small>Old POS v12.9.1</small></div><button type="button" class="btn btn-ghost" onclick="Settings.checkUpdate(this)">Check update</button></div>
        <div class="sys-row"><div class="sys-k">Storage used<small id="sy-s4">—</small></div></div>
        <div class="sys-row"><div class="sys-k">Repair offline files<small>Re-downloads the app files if something looks broken. Your shop data is not touched.</small></div><button type="button" class="btn btn-ghost" onclick="PWA.reset()">Repair</button></div></div>`)}
      ${sec('about', `<div class="card pad mb3">
        <div class="grid2"><a class="btn btn-ghost" href="privacy.html" target="_blank" rel="noopener"><i class="fas fa-user-shield"></i> Privacy Policy</a><a class="btn btn-ghost" href="terms.html" target="_blank" rel="noopener"><i class="fas fa-file-contract"></i> Terms of Service</a></div></div>
      <div class="tc muted xs">Old POS · Simple POS for Every Business<br>© Old POS · <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a> · <a href="license.html" target="_blank" rel="noopener">MIT License</a> · <a href="terms.html" target="_blank" rel="noopener">Terms of Service</a></div>`)}
      </div></div></div>`;
      this.open(this.sec === undefined ? (window.matchMedia('(min-width:1024px)').matches ? 'shop' : '') : this.sec, true);
      this.mark(); Theme.apply(); if (window.Design) Design.apply(); Printer.ui(); if (window.Cloud) Cloud.renderUI(); this.sysStatus();
    },
    /* v12.9.1: only the fields the owner actually edited are written. A form drawn earlier (or on another device) can therefore never
       push its old values over newer shop details. Pressing Save always re-sends the settings to Google Drive. */
    FIELDS: {
      'st-name': ['shopName', v => v.trim() || 'My Shop'], 'st-addr': ['shopAddress', v => v.trim()], 'st-phone': ['shopPhone', v => v.trim()],
      'st-cur': ['currency', v => (v || '').trim().slice(0, 4) || C.DEFAULTS.currency], 'st-biz': ['businessType', v => v || 'retail'],
      'st-tax': ['defaultTax', v => Math.max(0, num(v))], 'st-pre': ['invPrefix', v => v.trim()], 'st-paper': ['paper', v => v],
      'st-low': ['lowStockDefault', v => { const lw = parseFloat(v); return isFinite(lw) && lw >= 0 ? lw : 5; }], 'st-foot': ['footer', v => v.trim()],
      'st-taxid': ['taxId', v => v.trim().slice(0, 40)],
      'st-bcpre': ['barcodePrefix', v => (v || 'ESY').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6) || 'ESY'],
      'st-bcfmt': ['barcodeFormat', v => v || 'code128'],
      'st-bcnext': ['nextBarcode', v => { const bn = parseInt(v, 10); return isFinite(bn) && bn >= 1 ? bn : undefined; }]
    },
    mark() { const st = $('st'); if (st) st.querySelectorAll('[id^="st-"]').forEach(e => { if ('value' in e) e.dataset.o = e.value; }); },
    save(silent) {
      const s = DB.settings, F = this.FIELDS;
      Object.keys(F).forEach(id => {
        const el = $(id); if (!el) return;
        if (el.dataset.o !== undefined && el.value === el.dataset.o) return;                // untouched since it was drawn / last saved
        const v = F[id][1](el.value); if (v === undefined) { el.value = el.dataset.o || ''; return; }
        s[F[id][0]] = v; el.value = String(v); el.dataset.o = el.value;
      });
      C.save('settings'); if (!DB.cart.length) POS.taxInit(); POS.renderCart();     // a bill in progress keeps the tax the cashier chose
      if (silent !== true) { toast('Settings saved ✓'); if (window.Cloud && Cloud.reconnect) setTimeout(() => Cloud.reconnect(), 450); }
    }
  };
  window.Settings = App.Views.settings;
  /* v12.7.2: shop details are saved the moment a field is changed (before, they were lost if you left the page without pressing Save) */
  document.addEventListener('change', e => { const t = e.target; if (t && t.id && /^st-/.test(t.id) && window.App && App.view === 'settings' && document.getElementById('st-name')) { try { Settings.save(true); } catch (err) { console.warn('[Settings] autosave', err); } } });
  window.DB_ = { btMode(v) { DB.settings.btMode = v; C.save('settings'); } };
})();
