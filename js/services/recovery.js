/* Old POS Recovery (v12.7.0): "Forgot PIN" with a secret question.
   When a PIN is set, the owner also picks a recovery question and types the answer once. Later, "Forgot PIN?" shows
   that question; the right answer lets the owner set a NEW PIN (the old PIN is never shown or recovered).
   - The answer is never stored: only a salted PBKDF2 hash of it (same strength as the PIN), trimmed + lower-cased
     first, so capital letters and extra spaces do not matter.
   - Wrong answers are rate-limited (5 tries, then 1 / 5 / 15 / 30 / 60 minute lock-outs) and written to the Security log.
   - The question + hash live in the settings, so they are backed up to the owner's Google Drive together with the PIN:
     a second device that signs in through Google Drive asks for the same PIN and offers the same recovery question.
   - Two independent recoveries: the home-screen PIN ("pin") and the Admin PIN ("admin").
   Nothing here sends anything anywhere. */
(function () {
  'use strict';
  const C = Core, DB = C.DB, esc = C.esc, toast = C.toast;
  const $ = id => document.getElementById(id);
  const KINDS = {
    pin: { q: 'pinQ', s: 'pinAS', h: 'pinAH', name: 'PIN', who: 'home-screen PIN', lk: ['esypos_lk_f', 'esypos_lk_u', 'esypos_lk_l'] },
    admin: { q: 'admQ', s: 'admAS', h: 'admAH', name: 'Admin PIN', who: 'Admin PIN', lk: ['esypos_ad_f', 'esypos_ad_u', 'esypos_ad_l'] }
  };
  const PRESETS = [
    'What is the name of your first school?',
    'What is your best childhood friend’s name?',
    'In which village or town were you born?',
    'What was the name of your favourite teacher?',
    'What was your first mobile phone model?',
    'What is the name of the first shop or job you worked in?',
    'What is your favourite childhood game?'
  ];
  const CUSTOM = '__custom';
  const NS = 'esypos_rq_';
  const lsg = k => { try { return parseInt(localStorage.getItem(k) || '0', 10) || 0; } catch (_) { return 0; } };
  const lss = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (_) {} };
  const lsd = k => { try { localStorage.removeItem(k); } catch (_) {} };
  const log = m => { try { window.Guard && Guard.log && Guard.log(m); } catch (_) {} };
  const norm = a => String(a == null ? '' : a).normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
  const hashAns = (a, salt) => Lock.hashFor(norm(a), 'rq:' + salt);
  const S = () => DB.settings;
  const has = kind => { const k = KINDS[kind]; return !!(S()[k.q] && S()[k.s] && S()[k.h]); };

  /* ---- rate limit for wrong answers ---- */
  const LV = [60, 300, 900, 1800, 3600];
  const left = kind => Math.max(0, Math.ceil((lsg(NS + 'u_' + kind) - Date.now()) / 1000));
  const fmtWait = n => n >= 60 ? Math.ceil(n / 60) + ' min' : n + ' s';
  function failed(kind) {                                   // returns tries left, or 0 when a lock-out just started
    const f = lsg(NS + 'f_' + kind) + 1;
    if (f >= 5) { const lv = lsg(NS + 'l_' + kind); lss(NS + 'u_' + kind, Date.now() + LV[Math.min(4, lv)] * 1000); lss(NS + 'l_' + kind, lv + 1); lss(NS + 'f_' + kind, 0); return 0; }
    lss(NS + 'f_' + kind, f); return 5 - f;
  }
  function cleared(kind) { lsd(NS + 'f_' + kind); lsd(NS + 'u_' + kind); lsd(NS + 'l_' + kind); }

  /* ---- the form fields (used when setting a PIN and when editing the question) ---- */
  function fieldsHTML(kind) {
    const k = KINDS[kind], cur = S()[k.q] || '', custom = !!cur && PRESETS.indexOf(cur) < 0, hasNow = has(kind);
    const opts = PRESETS.map(q => '<option value="' + esc(q) + '"' + (q === cur ? ' selected' : '') + '>' + esc(q) + '</option>').join('') +
      '<option value="' + CUSTOM + '"' + (custom ? ' selected' : '') + '>Write my own question…</option>';
    return '<div class="rec-box"><div class="label"><i class="fas fa-circle-question"></i> Recovery question <small class="muted">(for “Forgot PIN”)</small></div>' +
      '<select id="rq-sel" class="input" onchange="Recovery.sel(this)" aria-label="Recovery question">' + opts + '</select>' +
      '<input id="rq-cu" class="input mt2' + (custom ? '' : ' hidden') + '" type="text" maxlength="80" autocomplete="off" spellcheck="false" placeholder="Type your own question" value="' + (custom ? esc(cur) : '') + '">' +
      '<input id="rq-an" class="input mt2" type="text" maxlength="60" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="' + (hasNow ? 'Answer (leave empty to keep the current one)' : 'Your answer') + '" aria-label="Answer">' +
      '<p class="xs muted mt1">If you forget the ' + k.who + ', this question is asked and the right answer lets you set a new one. Pick an answer your staff cannot guess. Capital letters and extra spaces do not matter.</p></div>';
  }
  function sel(el) { const c = $('rq-cu'); if (c) { c.classList.toggle('hidden', el.value !== CUSTOM); if (el.value === CUSTOM) c.focus(); } }
  /* Reads + checks the fields. Returns { q, a } (new), { keep: true } (nothing changed) or null (a message was shown). */
  function read(kind, pin) {
    const s = $('rq-sel'); if (!s) return { keep: true };
    const q = (s.value === CUSTOM ? ($('rq-cu').value || '') : s.value).trim().replace(/\s+/g, ' ');
    const a = $('rq-an').value, na = norm(a), cur = S()[KINDS[kind].q] || '';
    if (q.length < 8) { toast('⚠️ Write a recovery question (at least 8 letters)'); return null; }
    if (has(kind) && q === cur && !na) return { keep: true };
    if (na.length < 3) { toast('⚠️ Type the answer (at least 3 letters or digits)'); return null; }
    if (pin && na.replace(/\s/g, '') === String(pin)) { toast('⚠️ The answer must not be the same as the PIN'); return null; }
    return { q, a };
  }
  async function commit(kind, r) {                            // caller saves the settings afterwards
    if (!r || r.keep) return;
    const k = KINDS[kind], salt = C.genId();
    S()[k.q] = r.q; S()[k.s] = salt; S()[k.h] = await hashAns(r.a, salt);
    cleared(kind);
  }
  function clear(kind) { const k = KINDS[kind]; S()[k.q] = ''; S()[k.s] = ''; S()[k.h] = ''; cleared(kind); }

  const top = m => { if (m) m.classList.add('rec-top'); return m; };       // dialogs here may open over the full-screen lock

  /* ---- "Forgot PIN?": question -> answer -> new PIN ---- */
  function forgot(kind, onDone, other) {
    if (!has(kind)) return false;
    const k = KINDS[kind];
    const m = top(Modal.open({
      title: 'Forgot ' + k.name + '?',
      body: '<p class="muted sm mb3">Answer your recovery question. If it is right you can set a new ' + k.name + '.</p>' +
        '<div class="rec-q" id="rf-q"></div>' +
        '<input id="rf-an" type="text" class="input mt2" maxlength="60" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Your answer" aria-label="Your answer" autofocus>' +
        '<div class="xs sl-msg rec-msg" id="rf-msg" role="alert"></div>',
      foot: '<button class="btn" onclick="Modal.closeFrom(this)">Cancel</button>' + (other ? '<button class="btn btn-ghost" id="rf-oth">Use Google instead</button>' : '') + '<button class="btn btn-primary" id="rf-ok">Continue</button>'
    }));
    m.querySelector('#rf-q').textContent = S()[k.q];            // textContent: the question is shown exactly as typed
    const inp = m.querySelector('#rf-an'), msg = m.querySelector('#rf-msg'), ok = m.querySelector('#rf-ok'); let busy = false, tick = null;
    const wait = () => {
      const n = left(kind);
      if (n > 0) { msg.textContent = '⚠️ Too many wrong answers. Try again in ' + fmtWait(n); if (!tick) tick = setInterval(wait, 1000); }
      else { if (tick) { clearInterval(tick); tick = null; } if (/Too many/.test(msg.textContent)) msg.textContent = ''; }
    };
    const go = async () => {
      if (busy) return;
      if (left(kind) > 0) { wait(); return; }
      if (!norm(inp.value)) { msg.textContent = 'Type your answer.'; return; }
      busy = true; ok.disabled = true;
      let good = false; try { good = (await hashAns(inp.value, S()[k.s])) === S()[k.h]; } catch (_) {}
      busy = false; ok.disabled = false;
      if (good) { cleared(kind); log('Recovery answer correct — new ' + k.name + ' being set'); if (tick) clearInterval(tick); Modal.close(m); newPin(kind, onDone); return; }
      const t = failed(kind); log('Wrong recovery answer (' + k.name + ')');
      msg.textContent = t > 0 ? '⚠️ Wrong answer — ' + t + ' tr' + (t === 1 ? 'y' : 'ies') + ' left' : '';
      if (t === 0) wait();
      inp.value = ''; if (navigator.vibrate) navigator.vibrate(100); inp.focus();
    };
    ok.onclick = go; inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    if (other) m.querySelector('#rf-oth').onclick = () => { if (tick) clearInterval(tick); Modal.close(m); other(); };
    m._onClose = () => { if (tick) clearInterval(tick); };
    wait(); setTimeout(() => inp.focus(), 80);
    return true;
  }
  function newPin(kind, onDone) {
    const k = KINDS[kind];
    const m = top(Modal.open({
      title: 'Set a new ' + k.name,
      body: '<p class="muted sm mb3">Answer accepted ✓ — choose a new 4-digit ' + k.name + '.</p>' +
        '<div class="field"><label class="label">New ' + k.name + ' (4 digits)</label><input id="rn-a" type="password" data-pin="1" readonly inputmode="none" maxlength="4" class="input" autofocus></div>' +
        '<div class="field"><label class="label">Re-enter</label><input id="rn-b" type="password" data-pin="1" readonly inputmode="none" maxlength="4" class="input"></div>',
      foot: '<button class="btn" onclick="Modal.closeFrom(this)">Cancel</button><button class="btn btn-primary" id="rn-ok">Save new ' + k.name + '</button>'
    }));
    let busy = false;
    m.querySelector('#rn-ok').onclick = async () => {
      if (busy) return;
      const a = $('rn-a').value, b = $('rn-b').value;
      if (!/^\d{4}$/.test(a)) { toast('⚠️ Enter exactly 4 digits'); return; }
      if (Lock.isWeak(a)) { toast('⚠️ That PIN is too easy to guess — choose another'); return; }
      if (a !== b) { toast('⚠️ PINs do not match'); return; }
      busy = true;
      try {
        if (kind === 'admin' && Lock.has() && await Lock.verify(a)) { toast('⚠️ Admin PIN must be different from the home-screen PIN'); busy = false; return; }
        const salt = C.genId(), hash = await Lock.hashFor(a, salt);
        if (kind === 'pin') { S().pinSalt = salt; S().pinHash = hash; } else { S().adminSalt = salt; S().adminHash = hash; }
        KINDS[kind].lk.forEach(lsd);                          // the lock-out of the old PIN no longer applies
        C.save('settings'); log(k.name + ' reset with the recovery question');
        Modal.close(m); toast('New ' + k.name + ' saved ✓');
        if (onDone) onDone(); else if (window.App) App.refresh();
      } catch (_) { toast('⚠️ Could not save the PIN'); }
      busy = false;
    };
  }

  /* ---- add / change the question later (Settings -> Security); needs the current PIN ---- */
  function edit(kind) {
    const k = KINDS[kind], L = kind === 'pin' ? window.Lock : window.AdminLock;
    if (!L || !L.has()) { toast('Set a ' + k.name + ' first'); return; }
    const m = Modal.open({
      title: (has(kind) ? 'Change' : 'Set') + ' recovery question',
      body: fieldsHTML(kind) + '<div class="field mt3"><label class="label">Current ' + k.name + '</label><input id="re-pin" type="password" data-pin="1" readonly inputmode="none" maxlength="4" class="input"></div>',
      foot: '<button class="btn" onclick="Modal.closeFrom(this)">Cancel</button>' + (has(kind) ? '<button class="btn btn-danger-soft" id="re-del">Remove</button>' : '') + '<button class="btn btn-primary" id="re-ok">Save</button>'
    });
    const verify = async () => {
      const pin = $('re-pin').value, r = await L.check(pin);
      if (r === 'ok') return pin;
      toast(r === 'wait' ? '⚠️ Too many wrong attempts — try again later' : '⚠️ Wrong ' + k.name); $('re-pin').value = ''; if (window.Keypad) Keypad.refresh(); return null;
    };
    m.querySelector('#re-ok').onclick = async () => {
      const r = read(kind); if (!r) return; if (r.keep) { Modal.close(m); return; }
      const pin = await verify(); if (pin === null) return;
      if (norm(r.a).replace(/\s/g, '') === pin) { toast('⚠️ The answer must not be the same as the PIN'); return; }
      await commit(kind, r); C.save('settings'); log('Recovery question ' + (r.q ? 'saved' : 'changed') + ' (' + k.name + ')');
      Modal.close(m); toast('Recovery question saved ✓'); if (window.App) App.refresh();
    };
    const d = m.querySelector('#re-del');
    if (d) d.onclick = async () => { if (await verify() === null) return; clear(kind); C.save('settings'); log('Recovery question removed (' + k.name + ')'); Modal.close(m); toast('Recovery question removed'); if (window.App) App.refresh(); };
  }
  /* small status row for the Security cards */
  function rowHTML(kind) {
    return '<div class="kv mt3"><span><i class="fas fa-circle-question ptext"></i> Recovery question</span><b>' + (has(kind) ? 'Set ✓' : 'Not set') + '</b></div>' +
      '<button class="btn btn-ghost btn-block mt2" onclick="Recovery.edit(\'' + kind + '\')">' + (has(kind) ? 'Change recovery question' : 'Set recovery question') + '</button>' +
      (has(kind) ? '' : '<p class="xs muted mt1">Without it, a forgotten PIN can only be reset through your Google backup.</p>');
  }

  window.Recovery = { has, fieldsHTML, sel, read, commit, clear, forgot, edit, rowHTML, PRESETS };
})();
