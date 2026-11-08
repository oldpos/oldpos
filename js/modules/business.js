/* Old POS Business Support (v12.9.3) — replaces the old "SMM Panel" menu link.
   An in-app page (oldpos.com/business) with every service a shop needs to grow:
   Facebook Ads · World followers · Bangladeshi followers · Business Page setup · Faceless promo video.
   Flow: service -> details -> payment (bKash / Nagad / Rocket) -> order sent to WhatsApp. */
(function () {
  'use strict';
  const C = window.Core, esc = C.esc;
  const $ = id => document.getElementById(id);

  /* ====== Config (change prices / numbers here) ====== */
  const WA = '8801350323319';
  const USD_RATE = 155;          // ৳ per 1 USD of Facebook Ads budget
  const USD_MIN = 10;            // minimum ad budget in USD
  const USD_MAX = 10000;
  const PM = {
    bKash:  { n: '01350-323319', c: '#e2136e', bn: 'বিকাশ', mark: 'bK', cls: 'bk' },
    Nagad:  { n: '01627-647776', c: '#f6921e', bn: 'নগদ',  mark: 'N',  cls: 'ng' },
    Rocket: { n: '01350-323319', c: '#8c3494', bn: 'রকেট', mark: 'R',  cls: 'rk' }
  };
  const PKG = {
    world: [[5000, '৫ হাজার', 395], [10000, '১০ হাজার', 790], [25000, '২৫ হাজার', 1975], [50000, '৫০ হাজার', 3950], [100000, '১ লক্ষ', 7900]],
    bd:    [[5000, '৫ হাজার', 900], [10000, '১০ হাজার', 1700], [30000, '৩০ হাজার', 5100], [50000, '৫০ হাজার', 8500]]
  };
  const SETUP_PRICE = 1500, VIDEO_PRICE = 2000;
  const ADS_CHIPS = [10, 20, 50, 100, 250];

  /* ====== Icons (24px outline, currentColor) ====== */
  const IC = {
    ads: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
    world: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    bd: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    setup: '<path d="M3 9 4.5 4h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v8h14v-8"/><path d="M10 20v-5h4v5"/>',
    video: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 6 3.5-6 3.5z"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    wa: '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.2 7.7 8 9 4.8-1.3 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    arrow: '<path d="M9 18l6-6-6-6"/>'
  };
  const svg = (n, s) => `<svg class="bz-i" viewBox="0 0 24 24" width="${s || 22}" height="${s || 22}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;

  /* ====== Helpers ====== */
  const BNd = '০১২৩৪৫৬৭৮৯';
  const bn = n => String(n).replace(/\d/g, d => BNd[d]);
  const tk = n => bn(Number(n).toLocaleString('en-US')) + '৳';
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (_) { return null; } };
  const jget = k => { try { return JSON.parse(ls(k) || '[]') || []; } catch (_) { return []; } };
  function cleanLink(v) {
    v = (v || '').trim();
    if (v && !/^[a-z][a-z0-9+.-]*:/i.test(v) && /^[\w-]+(\.[\w-]+)+/i.test(v)) v = 'https://' + v;
    try { const u = new URL(v); if (u.protocol !== 'https:' && u.protocol !== 'http:') return null; if (u.hostname.indexOf('.') < 1 || /\s/.test(v)) return null; return u.href.slice(0, 300); } catch (_) { return null; }
  }
  function isFb(l) { try { const h = new URL(l).hostname.toLowerCase(); return h === 'facebook.com' || h.endsWith('.facebook.com') || h === 'fb.com' || h.endsWith('.fb.com') || h === 'fb.me'; } catch (_) { return false; } }
  function copyText(t, done) {
    const ok = () => done && done();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, ok);
    else { const i = document.createElement('input'); i.value = t; i.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(i); i.select(); try { document.execCommand('copy'); } catch (_) {} i.remove(); ok(); }
  }

  /* ====== Services — the order here is the order shown on the page ====== */
  const SERVICES = [
    { key: 'ads', icon: 'ads', title: 'Facebook অ্যাড রান', sub: 'আপনার পেইজ বুস্ট করুন',
      desc: 'আপনার Facebook পেইজের লিংক দিন, বাজেট বেছে নিন — আমরা আপনার পেইজের জন্য বিজ্ঞাপন চালানোর কাজ করে দেব।',
      pts: ['সর্বনিম্ন $১০ থেকে শুরু', 'বাজেটের কোনো সর্বোচ্চ সীমা নেই', 'প্রতি ডলার ' + tk(USD_RATE)],
      price: 'শুরু ' + tk(USD_MIN * USD_RATE), tag: 'জনপ্রিয়' },
    { key: 'world', icon: 'world', title: 'ওয়ার্ল্ড ফলোয়ার', sub: 'Worldwide Facebook Followers',
      desc: 'Facebook Page / Profile-এর জন্য ওয়ার্ল্ডওয়াইড ফলোয়ার প্যাকেজ। প্যাকেজ বেছে লিংক দিন।',
      pts: ['৫ হাজার থেকে ১ লক্ষ প্যাকেজ', 'পাসওয়ার্ড লাগবে না'],
      price: 'শুরু ' + tk(PKG.world[0][2]) },
    { key: 'bd', icon: 'bd', title: 'বাংলাদেশি ফলোয়ার', sub: 'Bangladeshi Facebook Followers',
      desc: 'বাংলাদেশি অডিয়েন্সের জন্য ফলোয়ার প্যাকেজ। সম্পন্ন হতে তুলনামূলক বেশি সময় লাগতে পারে।',
      pts: ['৫ হাজার থেকে ৫০ হাজার প্যাকেজ', 'পাসওয়ার্ড লাগবে না'],
      price: 'শুরু ' + tk(PKG.bd[0][2]) },
    { key: 'setup', icon: 'setup', title: 'বিজনেস পেইজ সেটআপ', sub: 'প্রফেশনাল পেইজ তৈরি',
      desc: 'ব্যবসার জন্য প্রয়োজনীয় সবকিছু সাজিয়ে দেওয়া হবে — লোগো, প্রোফাইল ও আনুষঙ্গিক সবকিছু।',
      pts: ['লোগো ও প্রোফাইল ছবি', 'কভার ও ব্যবসার তথ্য', 'প্রয়োজনীয় সব সেটআপ'],
      price: tk(SETUP_PRICE) },
    { key: 'video', icon: 'video', title: 'প্রমোশনাল ভিডিও', sub: 'ফেইসলেস (মুখ দেখানো ছাড়া)',
      desc: 'আপনার ব্যবসার জন্য ফেইসলেস প্রমোশনাল ভিডিও — যেখানে কাউকে ক্যামেরার সামনে আসতে হবে না।',
      pts: ['ভিডিও ১ মিনিটের বেশি হবে', 'ব্যবসার প্রচারের জন্য উপযোগী'],
      price: tk(VIDEO_PRICE) }
  ];
  const byKey = k => SERVICES.find(s => s.key === k);

  /* ====== State ====== */
  const S = { step: 1, svc: null, pkg: null, usd: '', link: '', name: '', note: '', m: 'bKash', sn: '', tx: '', done: null, err: '' };
  function reset(keepForm) {
    S.step = 1; S.svc = null; S.pkg = null; S.usd = ''; S.tx = ''; S.done = null; S.err = '';
    if (!keepForm) { S.name = ''; S.note = ''; }
  }

  function total() {
    const s = S.svc;
    if (s === 'ads') { const u = Math.floor(Number(S.usd)); return u >= USD_MIN ? u * USD_RATE : 0; }
    if (s === 'world' || s === 'bd') return S.pkg ? S.pkg[2] : 0;
    if (s === 'setup') return SETUP_PRICE;
    if (s === 'video') return VIDEO_PRICE;
    return 0;
  }
  function summaryTitle() {
    const sv = byKey(S.svc); if (!sv) return '';
    if (S.svc === 'ads') { const u = Math.floor(Number(S.usd)); return sv.title + (u >= USD_MIN ? ' · $' + bn(u) : ''); }
    if (S.svc === 'world' || S.svc === 'bd') return sv.title + (S.pkg ? ' · ' + S.pkg[1] : '');
    return sv.title;
  }
  function detailLines() {
    const L = [];
    if (S.svc === 'ads') { const u = Math.floor(Number(S.usd)); L.push('বাজেট: $' + u + ' (রেট ' + USD_RATE + '৳/ডলার)'); if (S.link) L.push('পেইজ লিংক: ' + S.link); }
    else if (S.svc === 'world' || S.svc === 'bd') { L.push('প্যাকেজ: ' + S.pkg[1] + ' ফলোয়ার (' + S.pkg[0] + ')'); L.push('লিংক: ' + S.link); }
    else { L.push('ব্যবসার নাম: ' + S.name); if (S.link) L.push('বর্তমান পেইজ লিংক: ' + S.link); if (S.note) L.push('নোট: ' + S.note); }
    return L;
  }

  /* ====== Views ====== */
  function head(title, sub, withBack) {
    return `<div class="page-head bz-head"><div class="bz-headl">${withBack ? `<button type="button" class="bz-back" onclick="Business.back()" aria-label="পেছনে">${svg('back', 20)}</button>` : ''}<div><h2>${title}</h2><p>${sub}</p></div></div></div>`;
  }
  function stepper() {
    const labels = ['সার্ভিস', 'তথ্য', 'পেমেন্ট'];
    return `<ol class="bz-steps" aria-label="ধাপ">${labels.map((l, i) => { const n = i + 1, cls = S.step > n ? 'done' : (S.step === n ? 'on' : ''); return `<li class="${cls}"><span>${S.step > n ? svg('check', 14) : bn(n)}</span>${l}</li>`; }).join('')}</ol>`;
  }

  function viewList() {
    const hs = jget('biz_orders');
    const cards = SERVICES.map((s, i) => `
      <button type="button" class="bz-svc${i === 0 ? ' bz-feat' : ''}" onclick="Business.pick('${s.key}')" aria-label="${esc(s.title)} — ${esc(s.price)}">
        <span class="bz-no">${bn(i + 1)}</span>
        <span class="bz-ic">${svg(s.icon, 26)}</span>
        <span class="bz-body">
          <span class="bz-t">${s.title}${s.tag ? `<em class="bz-tag">${s.tag}</em>` : ''}</span>
          <span class="bz-s">${s.sub}</span>
          <span class="bz-d">${s.desc}</span>
          <span class="bz-pts">${s.pts.map(p => `<span>${svg('check', 13)}${p}</span>`).join('')}</span>
        </span>
        <span class="bz-cta"><b>${s.price}</b><span class="bz-go">অর্ডার করুন ${svg('arrow', 15)}</span></span>
      </button>`).join('');
    const his = hs.length ? `<h3 class="bz-h3">আপনার আগের অর্ডার</h3><div class="bz-his">${hs.slice(0, 3).map(o => `<div class="bz-hi"><div><b>${esc(o.id)}</b><span>${esc(o.title)} · ${bn(new Date(o.t).getDate())}/${bn(new Date(o.t).getMonth() + 1)}</span></div><em>${tk(Number(o.tk) || 0)}</em><a href="${waUrl(o)}" target="_blank" rel="noopener">আবার পাঠান</a></div>`).join('')}</div>` : '';
    return `
      <section class="bz-hero">
        <div class="bz-hero-t"><span class="bz-pill">${svg('shield', 14)} Old POS Business Support</span>
          <h1>ব্যবসা বড় করার সব সার্ভিস, এক জায়গায়</h1>
          <p>সার্ভিস বেছে নিন, তথ্য দিন, বিকাশ / নগদ / রকেটে পেমেন্ট করুন — অর্ডার সরাসরি WhatsApp-এ কনফার্ম হবে।</p></div>
        <div class="bz-hero-s"><div><b>${bn(SERVICES.length)}টি</b><span>সার্ভিস</span></div><div><b>${bn(USD_RATE)}৳</b><span>প্রতি ডলার</span></div><div><b>${bn(3)}টি</b><span>পেমেন্ট মাধ্যম</span></div></div>
      </section>
      <h3 class="bz-h3">সার্ভিস বেছে নিন</h3>
      <div class="bz-grid">${cards}</div>
      <div class="bz-trust"><div>${svg('shield', 18)}<span><b>পাসওয়ার্ড লাগবে না</b>শুধু পাবলিক পেইজ লিংক দিন</span></div><div>${svg('check', 18)}<span><b>ম্যানুয়াল পেমেন্ট যাচাই</b>TrxID মিলিয়ে অর্ডার প্রসেস</span></div></div>
      ${his}
      <p class="bz-note">মনে রাখবেন: ফলোয়ার সংখ্যা বা বিজ্ঞাপনের বাজেট রিচ, বিক্রি বা গ্রাহকের আস্থার নিশ্চয়তা দেয় না। ভালো কনটেন্ট ও নিয়মিত পেইজ পরিচালনাও জরুরি।</p>
      <a class="bz-help" href="https://wa.me/${WA}?text=${encodeURIComponent('আসসালামু আলাইকুম, Business Support নিয়ে সাহায্য দরকার।')}" target="_blank" rel="noopener">${svg('wa', 18)} কোনো প্রশ্ন আছে? WhatsApp-এ জিজ্ঞেস করুন</a>`;
  }

  function viewDetails() {
    const sv = byKey(S.svc);
    let f = '';
    if (S.svc === 'ads') {
      f = `<div class="field"><label class="label" for="bz-link">Facebook পেইজের লিংক *</label>
          <input id="bz-link" class="input" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://facebook.com/yourpage" value="${esc(S.link)}" oninput="Business.set('link',this.value)">
          <div class="xs muted bz-hint">যে পেইজ বুস্ট করতে চান তার লিংক দিন। পেইজ পাবলিক থাকতে হবে।</div></div>
        <div class="field"><label class="label" for="bz-usd">বাজেট (ডলার) * — সর্বনিম্ন $${bn(USD_MIN)}</label>
          <div class="bz-usdwrap"><span>$</span><input id="bz-usd" class="input" type="number" inputmode="numeric" min="${USD_MIN}" max="${USD_MAX}" step="1" placeholder="${USD_MIN}" value="${esc(S.usd)}" oninput="Business.set('usd',this.value)"></div>
          <div class="bz-chips">${ADS_CHIPS.map(v => `<button type="button" class="chip${Number(S.usd) === v ? ' on' : ''}" data-v="${v}" onclick="Business.usd(${v})">$${bn(v)}</button>`).join('')}</div>
          <div class="bz-calc" id="bz-calc"></div></div>`;
    } else if (S.svc === 'world' || S.svc === 'bd') {
      const list = PKG[S.svc];
      f = `<div class="field"><label class="label">প্যাকেজ বেছে নিন *</label><div class="bz-pk">${list.map((p, i) => `<button type="button" class="bz-p${S.pkg && S.pkg[0] === p[0] ? ' sel' : ''}" data-i="${i}" onclick="Business.pkg(${i})"><b>${p[1]}</b><span>ফলোয়ার</span><em>${tk(p[2])}</em></button>`).join('')}</div>
          ${S.svc === 'bd' ? '<div class="bz-warn">বাংলাদেশি সার্ভিস সম্পন্ন হতে তুলনামূলক বেশি সময় লাগতে পারে। অপেক্ষা করতে পারলে অর্ডার করুন।</div>' : ''}</div>
        <div class="field"><label class="label" for="bz-link">Facebook Page / Profile-এর লিংক *</label>
          <input id="bz-link" class="input" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://facebook.com/yourpage" value="${esc(S.link)}" oninput="Business.set('link',this.value)">
          <div class="xs muted bz-hint">অ্যাকাউন্ট পাবলিক থাকতে হবে। পাসওয়ার্ড বা OTP কখনো শেয়ার করবেন না।</div></div>`;
    } else {
      const isV = S.svc === 'video';
      f = `<div class="bz-incl"><b>${isV ? 'ভিডিওতে যা থাকবে' : 'সেটআপে যা যা করে দেওয়া হবে'}</b><ul>${(isV
        ? ['ফেইসলেস (মুখ দেখানো ছাড়া) প্রমোশনাল ভিডিও', 'ভিডিওর দৈর্ঘ্য ১ মিনিটের বেশি', 'আপনার ব্যবসার নাম ও তথ্য অনুযায়ী তৈরি']
        : ['পেইজ সাজানো ও প্রয়োজনীয় সব সেটআপ', 'প্রোফাইলে লোগো', 'কভার ও ব্যবসার তথ্য', 'আনুষঙ্গিক যা যা প্রয়োজন সবকিছু']).map(x => `<li>${svg('check', 14)}${x}</li>`).join('')}</ul></div>
        <div class="field"><label class="label" for="bz-name">ব্যবসার নাম *</label><input id="bz-name" class="input" type="text" maxlength="80" autocomplete="off" placeholder="যেমন: রহমান ইলেকট্রনিক্স" value="${esc(S.name)}" oninput="Business.set('name',this.value)"></div>
        <div class="field"><label class="label" for="bz-link">বর্তমান Facebook পেইজ লিংক (থাকলে)</label><input id="bz-link" class="input" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://facebook.com/yourpage" value="${esc(S.link)}" oninput="Business.set('link',this.value)"></div>
        <div class="field"><label class="label" for="bz-note">${isV ? 'ভিডিওতে কী কী দেখাতে চান?' : 'ব্যবসার ধরন ও বিশেষ চাহিদা'} (ঐচ্ছিক)</label><textarea id="bz-note" class="input bz-ta" rows="3" maxlength="400" placeholder="${isV ? 'যেমন: পণ্যের তালিকা, অফার, ঠিকানা…' : 'যেমন: কাপড়ের দোকান, লোগোর রঙ…'}" oninput="Business.set('note',this.value)">${esc(S.note)}</textarea></div>`;
    }
    return `${head(sv.title, sv.sub, true)}${stepper()}
      <div class="card bz-card">
        <div class="bz-sum"><span id="bz-st">${esc(summaryTitle())}</span><em id="bz-sa">${total() ? tk(total()) : '—'}</em></div>
        ${f}
        <p class="bz-err" id="bz-e" role="alert">${esc(S.err)}</p>
        <button type="button" class="btn btn-primary btn-block bz-btn" onclick="Business.toPay()">পেমেন্টে যান ${svg('arrow', 16)}</button>
      </div>`;
  }

  function viewPay() {
    const p = PM[S.m];
    return `${head('পেমেন্ট', 'টাকা পাঠিয়ে TrxID দিন', true)}${stepper()}
      <div class="card bz-card">
        <div class="bz-sum"><span>${esc(summaryTitle())}</span><em>${tk(total())}</em></div>
        <label class="label">পেমেন্ট মাধ্যম</label>
        <div class="bz-m" id="bz-m">${Object.keys(PM).map(k => `<button type="button" data-m="${k}" aria-pressed="${k === S.m}" onclick="Business.method('${k}')"><span class="bz-mark ${PM[k].cls}" aria-hidden="true">${PM[k].mark}</span><b>${PM[k].bn}</b><small>Personal · Send Money</small></button>`).join('')}</div>
        <div class="bz-num"><div><small>সেন্ড মানি নম্বর (পার্সোনাল)</small><b id="bz-pn" style="color:${p.c}">${p.n}</b></div><button type="button" id="bz-cp" onclick="Business.copyNum()">কপি</button></div>
        <div class="bz-amt"><span>পাঠাতে হবে ঠিক</span><b>${tk(total())}</b></div>
        <ol class="bz-how"><li>উপরের নম্বরে <b>সেন্ড মানি</b> (পার্সোনাল) করুন, রেফারেন্সে কিছু লিখতে হবে না।</li><li>যে নম্বর থেকে পাঠিয়েছেন সেটি ও ট্রানজেকশন আইডি নিচে দিন।</li></ol>
        <div class="field"><label class="label" for="bz-sn">আপনার পেমেন্ট নম্বর</label><input id="bz-sn" class="input" type="tel" inputmode="numeric" autocomplete="tel" maxlength="14" placeholder="01XXXXXXXXX" value="${esc(S.sn)}" oninput="Business.set('sn',this.value)"></div>
        <div class="field"><label class="label" for="bz-tx">ট্রানজেকশন আইডি (TrxID)</label><input id="bz-tx" class="input" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="20" placeholder="যেমন: 9AB3CD45EF" value="${esc(S.tx)}" oninput="Business.set('tx',this.value)"></div>
        <p class="bz-err" id="bz-e" role="alert">${esc(S.err)}</p>
        <button type="button" class="btn btn-primary btn-block bz-btn" onclick="Business.submit()">অর্ডার সাবমিট করুন</button>
      </div>`;
  }

  function viewDone() {
    const o = S.done;
    return `${head('অর্ডার প্রস্তুত', 'WhatsApp-এ Send করলেই কনফার্ম', false)}
      <div class="card bz-card bz-ok">
        <div class="bz-tick">${svg('check', 34)}</div>
        <div class="bz-oid">${esc(o.id)}</div>
        <button type="button" class="bz-link" id="bz-cpid" onclick="Business.copyId()">অর্ডার আইডি কপি করুন</button>
        <div class="bz-osum"><b>${esc(o.title)}</b><span>${tk(o.tk)}</span></div>
        <ul class="bz-tl"><li class="d"><b>অর্ডারের তথ্য তৈরি হয়েছে</b>অর্ডার আইডি আপনার ডিভাইসে সংরক্ষিত</li><li class="n"><b>WhatsApp-এ মেসেজ Send করুন</b>Send না চাপলে অর্ডার আমাদের কাছে পৌঁছাবে না</li><li><b>পেমেন্ট যাচাই</b>ট্রানজেকশন আইডি ও নম্বর ম্যানুয়ালি মিলিয়ে দেখা হবে</li><li><b>অর্ডার প্রসেস</b>যাচাই সম্পন্ন হলে কাজ শুরু হবে</li></ul>
        <a class="btn bz-wa" href="${waUrl(o)}" target="_blank" rel="noopener">${svg('wa', 18)} WhatsApp খুলুন ও অর্ডার Send করুন</a>
        <button type="button" class="btn btn-ghost btn-block" onclick="Business.again()">নতুন অর্ডার</button>
      </div>`;
  }

  function draw() {
    const v = $('view'); if (!v) return;
    let html;
    if (S.step === 1) html = `<div class="bz">${head('Business Support', 'ব্যবসা পরিচালনা ও প্রচারের সব সার্ভিস', false)}${viewList()}</div>`;
    else if (S.step === 2) html = `<div class="bz">${viewDetails()}</div>`;
    else if (S.step === 3) html = `<div class="bz">${viewPay()}</div>`;
    else html = `<div class="bz">${viewDone()}</div>`;
    v.innerHTML = html;
    window.scrollTo(0, 0);
    if (S.step === 2) calc();
  }

  function calc() {
    const el = $('bz-calc'); if (!el) return;
    const u = Math.floor(Number(S.usd));
    if (!S.usd) { el.className = 'bz-calc'; el.innerHTML = `<span>রেট: প্রতি $১ = <b>${tk(USD_RATE)}</b></span>`; return; }
    if (!(u >= USD_MIN)) { el.className = 'bz-calc bad'; el.innerHTML = `<span>সর্বনিম্ন বাজেট $${bn(USD_MIN)}</span>`; return; }
    el.className = 'bz-calc ok'; el.innerHTML = `<span>$${bn(u)} × ${bn(USD_RATE)} =</span><b>${tk(u * USD_RATE)}</b>`;
  }
  function refreshSum() { const a = $('bz-sa'), t = $('bz-st'); if (a) a.textContent = total() ? tk(total()) : '—'; if (t) t.textContent = summaryTitle(); }

  function waUrl(o) {
    const m = '*নতুন Business Support অর্ডার* (' + o.id + ')\nসার্ভিস: ' + o.title + '\n' + o.lines.join('\n') + '\nটাকা: ' + o.tk + '৳\nপেমেন্ট মাধ্যম: ' + o.m + '\nযে নম্বর থেকে পেমেন্ট: ' + o.sn + '\nTrxID: ' + o.tx;
    return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(m);
  }
  function fail(msg, id) { S.err = msg; const e = $('bz-e'); if (e) e.textContent = msg; const i = id && $(id); if (i) { i.classList.add('bad'); i.focus(); } return false; }

  /* ====== Public API ====== */
  const Business = window.Business = {
    render() { if (S.step === 4) reset(true); draw(); },
    pick(k) {
      reset(true); S.svc = k; S.link = ls('biz_link') || S.link || '';
      S.sn = ls('biz_sn') || S.sn || ''; S.step = 2; draw();
    },
    set(k, v) { S[k] = v; S.err = ''; const e = $('bz-e'); if (e) e.textContent = ''; document.querySelectorAll('.input.bad').forEach(x => x.classList.remove('bad'));
      if (k === 'usd') { calc(); refreshSum(); document.querySelectorAll('.bz-chips .chip').forEach(c => c.classList.toggle('on', Number(c.dataset.v) === Number(v))); } },
    usd(v) { S.usd = String(v); const i = $('bz-usd'); if (i) i.value = v; Business.set('usd', String(v)); },
    pkg(i) { S.pkg = PKG[S.svc][i]; S.err = ''; const e = $('bz-e'); if (e) e.textContent = ''; document.querySelectorAll('.bz-p').forEach(b => b.classList.toggle('sel', +b.dataset.i === i)); refreshSum(); },
    toPay() {
      S.err = '';
      if (S.svc === 'ads') {
        const l = cleanLink(S.link); if (!l || !isFb(l)) return fail('সঠিক Facebook পেইজের লিংক দিন (যেমন: https://facebook.com/yourpage)', 'bz-link');
        const u = Number(S.usd); if (!(u >= USD_MIN) || u > USD_MAX) return fail('বাজেট সর্বনিম্ন $' + bn(USD_MIN) + ' হতে হবে', 'bz-usd');
        if (u !== Math.floor(u)) return fail('বাজেট পূর্ণ সংখ্যায় দিন (যেমন: ১০, ২৫, ৫০)', 'bz-usd');
        S.link = l;
      } else if (S.svc === 'world' || S.svc === 'bd') {
        if (!S.pkg) return fail('একটি প্যাকেজ বেছে নিন');
        const l = cleanLink(S.link); if (!l || !isFb(l)) return fail('সঠিক Facebook Page / Profile লিংক দিন (যেমন: https://facebook.com/yourpage)', 'bz-link');
        S.link = l;
      } else {
        if (S.name.trim().length < 2) return fail('ব্যবসার নাম লিখুন', 'bz-name');
        if (S.link.trim()) { const l = cleanLink(S.link); if (!l) return fail('লিংকটি সঠিক নয়। ফাঁকা রাখতে পারেন বা সঠিক লিংক দিন', 'bz-link'); S.link = l; }
      }
      if (S.link) ls('biz_link', S.link);
      S.step = 3; draw();
      setTimeout(() => { const i = $('bz-sn'); if (i && !i.value) i.focus({ preventScroll: true }); }, 60);
    },
    method(k) { S.m = k; document.querySelectorAll('#bz-m button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === k)); const n = $('bz-pn'); if (n) { n.textContent = PM[k].n; n.style.color = PM[k].c; } },
    copyNum() { const b = $('bz-cp'); copyText(PM[S.m].n.replace(/-/g, ''), () => { if (b) { b.textContent = 'কপি হয়েছে ✓'; setTimeout(() => { b.textContent = 'কপি'; }, 1600); } }); },
    copyId() { const b = $('bz-cpid'); copyText(S.done.id, () => { if (b) { b.textContent = 'কপি হয়েছে ✓'; setTimeout(() => { b.textContent = 'অর্ডার আইডি কপি করুন'; }, 1600); } }); },
    submit() {
      const sn = String(S.sn).replace(/[\s-]/g, '').replace(/^(\+?88)/, ''), tx = String(S.tx).trim().toUpperCase().replace(/\s/g, '');
      if (!/^01[3-9]\d{8}$/.test(sn)) return fail('সঠিক মোবাইল নম্বর দিন (যে নম্বর থেকে টাকা পাঠিয়েছেন)', 'bz-sn');
      if (!/^[A-Z0-9]{6,20}$/.test(tx)) return fail('সঠিক ট্রানজেকশন আইডি দিন (শুধু ইংরেজি অক্ষর ও সংখ্যা)', 'bz-tx');
      const hs = jget('biz_orders');
      if (hs.some(o => o.tx === tx) || jget('smm_orders').some(o => o.tx === tx)) return fail('এই ট্রানজেকশন আইডি দিয়ে আগেই অর্ডার করা হয়েছে', 'bz-tx');
      if (S.busy) return; S.busy = 1;
      const o = { id: 'BIZ' + Date.now().toString(36).toUpperCase().slice(-6), svc: S.svc, title: summaryTitle(), lines: detailLines(), tk: total(), m: S.m, sn, tx, t: Date.now() };
      ls('biz_sn', sn); hs.unshift(o); ls('biz_orders', JSON.stringify(hs.slice(0, 10)));
      S.done = o; S.step = 4; S.busy = 0; draw();
      try { const w = window.open(waUrl(o), '_blank', 'noopener'); if (!w) { /* popup blocked: the WhatsApp button on screen does the same */ } } catch (_) {}
    },
    again() { reset(false); draw(); },
    /* Back button (browser / phone / arrow): returns true when it handled the press */
    back() {
      if (S.step === 4) { reset(true); draw(); return true; }
      if (S.step > 1) { S.step -= 1; S.err = ''; if (S.step === 1) { S.svc = null; S.pkg = null; } draw(); return true; }
      return false;
    }
  };
  if (window.App && App.Views) App.Views.business = Business;

  /* Old links: the old /smm page stays public for ads; inside the app everything lives here. */
})();
