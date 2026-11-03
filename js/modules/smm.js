/* Old POS · Facebook Ads (Dhaka SMM) — a separate page inside the app, opened from a promo card on the Dashboard
   (and from the menu). The user fills a short form; the order is sent to Dhaka SMM on Telegram / WhatsApp with the
   details already typed. Nothing is sent automatically and no server is used. Settings: PROPOS_CONFIG.smm in js/core/config.js */
(function () {
  'use strict';
  const C = window.Core, esc = C.esc, $ = id => document.getElementById(id);
  const cfg = () => Object.assign({ brand: 'Dhaka SMM', site: 'https://dhakasmm.com', telegram: '', whatsapp: '', packages: [], pay: {}, currency: '\u09f3' }, (window.PROPOS_CONFIG || {}).smm || {});
  const GOALS = [
    ['messages', 'More messages (Inbox)'], ['likes', 'Page likes & followers'], ['engage', 'Post reach & engagement'],
    ['visit', 'Visits to my shop / website'], ['video', 'Video views']
  ];
  const HIDE_KEY = 'esypos_smm_hide';
  const SPEAKER = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a9 9 0 0 1 0 12"/></svg>';
  const FB = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#1877F2"/><path fill="#fff" d="M13.4 19v-6.2h2.1l.4-2.5h-2.5V8.7c0-.7.3-1.2 1.3-1.2h1.3V5.3c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.200-3.200 3.300v1.800H8.800v2.500h2.100V19z"/></svg>';

  const moneyFmt = n => cfg().currency + Math.round(+n || 0).toLocaleString('en-US');
  const validFb = v => /^(https?:\/\/)?([a-z0-9-]+\.)?(facebook\.com|fb\.com|fb\.me|fb\.watch)\/\S+/i.test(String(v || '').trim());

  /* ---------- Dashboard promo card (can be hidden for 7 days) ---------- */
  function hidden() { try { const t = +localStorage.getItem(HIDE_KEY) || 0; return t && Date.now() - t < 7 * 864e5; } catch (_) { return false; } }
  function promo() {
    const c = cfg(), p = c.packages[0];
    return `<section class="sd-card smm-promo" aria-label="Sponsored"><button type="button" class="smm-p-main" onclick="Smm.open()">
      <span class="smm-p-ic">${SPEAKER}</span>
      <span class="smm-p-tx"><small>Sponsored \u00b7 ${esc(c.brand)}</small><b>Get more customers from Facebook</b><span>Run a Facebook ad for your shop${p ? ' \u2014 from ' + moneyFmt(p.price) : ''}</span></span>
      <span class="smm-p-go">Start</span></button>
      <button type="button" class="smm-p-x" aria-label="Hide this for 7 days" title="Hide for 7 days" onclick="Smm.hide()">\u00d7</button></section>`;
  }
  function inject() {
    const v = $('view'); if (!v || App.view !== 'dashboard' || v.querySelector('.smm-promo') || hidden()) return;
    const host = v.querySelector('.sd-tiles') || v.querySelector('.sd-acts'); if (!host) return;
    host.insertAdjacentHTML('afterend', promo());
  }

  /* ---------- The page ---------- */
  const S = { pkg: 0, goal: 'messages' };
  function pageHtml() {
    const c = cfg(), pk = c.packages;
    const pkgs = pk.map((p, i) => `<button type="button" class="smm-pkg${S.pkg === i ? ' on' : ''}" onclick="Smm.pick(${i})"><b>${esc(p.name)}</b><span class="smm-pr">${moneyFmt(p.price)}</span><small>${esc(String(p.days))} days${p.note ? ' \u00b7 ' + esc(p.note) : ''}</small></button>`).join('');
    const ch = [c.telegram ? 'Telegram' : '', c.whatsapp ? 'WhatsApp' : ''].filter(Boolean).join(' / ');
    return `<div class="sd smm-page">
      <section class="sd-card smm-hero"><div class="smm-h-ic">${SPEAKER}</div><div><small>${esc(c.brand)} \u00b7 an Old POS product</small><h2>Advertise on Facebook</h2><p>Tell us what you want to promote. We set up and run the ad for you, and you only pay for the package you pick.</p></div></section>
      <section class="sd-card"><div class="sd-h"><h3>1 \u00b7 Choose a package</h3></div><div class="smm-pkgs">${pkgs}<button type="button" class="smm-pkg${S.pkg === -1 ? ' on' : ''}" onclick="Smm.pick(-1)"><b>Custom</b><span class="smm-pr">Your budget</span><small>Set amount &amp; days</small></button></div></section>
      <section class="sd-card"><div class="sd-h"><h3>2 \u00b7 Your ad details</h3></div>
        <div class="field mb3"><label class="label" for="smm-link">Facebook Page or Post link *</label><input id="smm-link" class="input" type="url" inputmode="url" autocomplete="off" placeholder="https://facebook.com/yourshop" oninput="Smm.calc()"></div>
        <div class="field mb3"><label class="label" for="smm-goal">What do you want?</label><select id="smm-goal" class="input" onchange="Smm.calc()">${GOALS.map(g => `<option value="${g[0]}"${S.goal === g[0] ? ' selected' : ''}>${esc(g[1])}</option>`).join('')}</select></div>
        <div class="smm-row"><div class="field mb3"><label class="label" for="smm-budget">Budget (${esc(c.currency)}) *</label><input id="smm-budget" class="input" type="number" inputmode="numeric" min="100" step="50" oninput="Smm.calc()"></div>
        <div class="field mb3"><label class="label" for="smm-days">Days *</label><input id="smm-days" class="input" type="number" inputmode="numeric" min="1" max="60" oninput="Smm.calc()"></div></div>
        <div class="smm-row"><div class="field mb3"><label class="label" for="smm-area">Target area</label><input id="smm-area" class="input" type="text" placeholder="e.g. Dhaka, Mirpur" value="Bangladesh" oninput="Smm.calc()"></div>
        <div class="field mb3"><label class="label" for="smm-age">Age</label><input id="smm-age" class="input" type="text" placeholder="e.g. 18-45" value="18-55" oninput="Smm.calc()"></div></div>
        <div class="field mb3"><label class="label" for="smm-phone">Your phone / WhatsApp *</label><input id="smm-phone" class="input" type="tel" inputmode="tel" placeholder="01XXXXXXXXX" oninput="Smm.calc()"></div>
        <div class="field mb3"><label class="label" for="smm-note">Note (optional)</label><textarea id="smm-note" class="input" rows="2" placeholder="Offer, product or anything we should know" oninput="Smm.calc()"></textarea></div>
      </section>
      <section class="sd-card smm-sum"><div class="sd-h"><h3>3 \u00b7 Order</h3></div>
        <div class="smm-tot"><span>Total to pay</span><b id="smm-total">${moneyFmt(0)}</b></div><div id="smm-per" class="xs muted mb3"></div>
        <div id="smm-err" class="smm-err" role="alert"></div>
        <div class="smm-acts"><button type="button" class="btn btn-primary btn-block" onclick="Smm.send()"><i class="fas fa-paper-plane"></i> Send order${ch ? ' on ' + esc(ch) : ''}</button>
        <button type="button" class="btn btn-soft btn-block" onclick="Smm.copy()"><i class="fas fa-file-lines"></i> Copy order text</button>
        <a class="btn btn-ghost btn-block" href="${esc(c.site)}" target="_blank" rel="noopener noreferrer">Visit ${esc(c.brand)} website</a></div>
        <p class="xs muted mt3">${FB} Payment is arranged with ${esc(c.brand)} after you send the order${(c.pay && (c.pay.bkash || c.pay.nagad)) ? ' (bKash ' + esc(c.pay.bkash || '-') + ' \u00b7 Nagad ' + esc(c.pay.nagad || '-') + ')' : ''}. Nothing is sent until you tap Send. Old POS does not share any of your shop data.</p>
      </section></div>`;
  }

  function vals() {
    const g = id => { const e = $(id); return e ? String(e.value || '').trim() : ''; };
    const c = cfg(), p = S.pkg >= 0 ? c.packages[S.pkg] : null;
    const budget = p ? +p.price : Math.max(0, +g('smm-budget') || 0), days = p ? +p.days : Math.max(0, Math.round(+g('smm-days') || 0));
    return { link: g('smm-link'), goal: g('smm-goal'), area: g('smm-area'), age: g('smm-age'), phone: g('smm-phone'), note: g('smm-note'), budget, days, pkg: p ? p.name : 'Custom' };
  }
  function problem(v) {
    if (!validFb(v.link)) return 'Please paste your Facebook Page or Post link.';
    if (!(v.budget >= 100)) return 'Budget must be at least ' + moneyFmt(100) + '.';
    if (!(v.days >= 1 && v.days <= 60)) return 'Days must be between 1 and 60.';
    if (String(v.phone).replace(/\D/g, '').length < 10) return 'Please enter a valid phone number.';
    return '';
  }
  function text(v) {
    const goal = (GOALS.find(g => g[0] === v.goal) || [, v.goal])[1], shop = (C.DB.settings && C.DB.settings.shopName) || '';
    return ['Facebook Ads order (from Old POS)', 'Package: ' + v.pkg, 'Goal: ' + goal, 'Budget: ' + moneyFmt(v.budget) + ' for ' + v.days + ' day(s)', 'Link: ' + v.link, 'Area: ' + (v.area || 'Bangladesh') + ' \u00b7 Age: ' + (v.age || 'any'),
      shop ? 'Shop: ' + shop : '', 'Phone: ' + v.phone, v.note ? 'Note: ' + v.note : ''].filter(Boolean).join('\n');
  }

  window.Smm = {
    open() { App.go('ads'); },
    hide() { try { localStorage.setItem(HIDE_KEY, String(Date.now())); } catch (_) {} const e = document.querySelector('.smm-promo'); if (e) e.remove(); C.toast('Hidden for 7 days. You can still find it in the menu.'); },
    pick(i) {
      const keep = ['smm-link', 'smm-phone', 'smm-note', 'smm-area', 'smm-age'].reduce((o, k) => { o[k] = $(k) ? $(k).value : ''; return o; }, {}); S.goal = $('smm-goal') ? $('smm-goal').value : S.goal;
      S.pkg = i; Views.ads.render(); Object.keys(keep).forEach(k => { if ($(k) && keep[k]) $(k).value = keep[k]; }); Smm.calc();
    },
    calc() {
      const v = vals(), c = cfg(), custom = S.pkg < 0;
      ['smm-budget', 'smm-days'].forEach(id => { const e = $(id); if (e) { const f = e.closest('.field'); if (f) f.style.display = custom ? '' : 'none'; } });
      const t = $('smm-total'); if (t) t.textContent = moneyFmt(v.budget);
      const pr = $('smm-per'); if (pr) pr.textContent = v.budget && v.days ? '\u2248 ' + moneyFmt(v.budget / v.days) + ' per day for ' + v.days + ' day' + (v.days === 1 ? '' : 's') + '. Results depend on your page, offer and area; we cannot promise exact numbers.' : '';
      const er = $('smm-err'); if (er) er.textContent = '';
      return v;
    },
    copy() { const v = Smm.calc(), e = problem(v); if (e) { $('smm-err').textContent = e; return; } C.copyText ? C.copyText(text(v)) : navigator.clipboard && navigator.clipboard.writeText(text(v)); C.toast('Order text copied'); },
    send() {
      const v = Smm.calc(), e = problem(v); if (e) { $('smm-err').textContent = e; return; }
      const c = cfg(), msg = text(v), tg = String(c.telegram || '').replace(/^@/, '').replace(/^https?:\/\/t\.me\//i, ''), wa = String(c.whatsapp || '').replace(/\D/g, '');
      let url;
      if (wa) url = 'https://wa.me/' + wa + '?text=' + encodeURIComponent(msg);
      else if (tg) { try { navigator.clipboard && navigator.clipboard.writeText(msg); } catch (_) {} url = 'https://t.me/' + tg + '?text=' + encodeURIComponent(msg); }
      else { try { navigator.clipboard && navigator.clipboard.writeText(msg); } catch (_) {} url = c.site; C.toast('Order text copied. Paste it on the website chat.'); }
      window.open(url, '_blank', 'noopener');
    }
  };

  const Views = App.Views;
  Views.ads = {
    render() {
      const c = cfg(); if (S.pkg >= c.packages.length) S.pkg = 0; if (!c.packages.length) S.pkg = -1;
      $('view').innerHTML = pageHtml(); Smm.calc();
    }
  };

  /* Dashboard: add the promo card after every render */
  const d = Views.dashboard;
  if (d && d.render && !d._smm) {
    d._smm = 1; const r0 = d.render; d.render = function () { const out = r0.apply(this, arguments); try { inject(); } catch (e) { console.error('Old POS promo', e); } return out; };
  }
})();
