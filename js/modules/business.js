/* Old POS — Business Support (v12.10.0). Opens INSIDE the software (menu → Business Support, URL oldpos.com/business).
   Loaded on demand (css/business.css + this file) so the first open of the app stays small and fast.
   Only signed-in (registered) users can see it. Flow: service -> details -> payment (bKash / Nagad / Rocket) -> order message in WhatsApp. */
(function () {
  'use strict';
  const esc = v => (window.Core && Core.esc) ? Core.esc(v) : String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);
  const BASE = (window.App && App.base) || './';

  /* ====== Config (change prices / numbers here) ====== */
  const WA = '8801350323319';
  const USD_RATE = 155, USD_MIN = 10, USD_MAX = 10000;
  const PM = {
    bKash:  { n: '01350-323319', c: '#e2136e', bn: 'বিকাশ', img: 'assets/pay/bkash.svg' },
    Nagad:  { n: '01627-647776', c: '#f6921e', bn: 'নগদ',  img: 'assets/pay/nagad.svg' },
    Rocket: { n: '01350-323319', c: '#8c3494', bn: 'রকেট', img: 'assets/pay/rocket.svg' }
  };
  const PKG = {
    world: [[5000, '৫ হাজার', 395], [10000, '১০ হাজার', 790], [25000, '২৫ হাজার', 1975], [50000, '৫০ হাজার', 3950], [100000, '১ লক্ষ', 7900]],
    bd:    [[5000, '৫ হাজার', 900], [10000, '১০ হাজার', 1700], [30000, '৩০ হাজার', 5100], [50000, '৫০ হাজার', 8500]]
  };
  const SETUP_PRICE = 1500, VIDEO_PRICE = 2000, ADS_CHIPS = [10, 20, 50, 100, 250];

  /* ====== Helpers ====== */
  const BNd = '০১২৩৪৫৬৭৮৯';
  const bn = n => String(n).replace(/\d/g, d => BNd[d]);
  const tk = n => bn(Number(n).toLocaleString('en-US')) + '৳';
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (_) {} return null; };
  const orders = () => { try { const a = JSON.parse(ls('biz_orders') || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } };
  const signedIn = () => !!(window.Cloud && Cloud.isOn && Cloud.isOn());
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
  const waLink = text => 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text);

  /* ====== Icons (24px outline) ====== */
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
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
  };
  const svg = (n, s) => `<svg viewBox="0 0 24 24" width="${s || 22}" height="${s || 22}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;

  /* ====== Services (order = order shown) ====== */
  const SERVICES = [
    { key: 'ads', icon: 'ads', title: 'Facebook অ্যাড রান', sub: 'পেইজ বুস্ট · সর্বনিম্ন $১০', price: tk(USD_MIN * USD_RATE), from: true, pop: 'জনপ্রিয়' },
    { key: 'world', icon: 'world', title: 'ওয়ার্ল্ড ফলোয়ার', sub: 'Facebook Followers · ওয়ার্ল্ডওয়াইড', price: tk(PKG.world[0][2]), from: true },
    { key: 'bd', icon: 'bd', title: 'বাংলাদেশি ফলোয়ার', sub: 'Facebook Followers · বাংলাদেশ', price: tk(PKG.bd[0][2]), from: true },
    { key: 'setup', icon: 'setup', title: 'বিজনেস পেইজ সেটআপ', sub: 'লোগো, কভার ও সব তথ্য সহ', price: tk(SETUP_PRICE) },
    { key: 'video', icon: 'video', title: 'প্রমোশনাল ভিডিও', sub: 'ফেইসলেস · ১ মিনিটের বেশি', price: tk(VIDEO_PRICE) }
  ];
  const svcOf = k => SERVICES.find(s => s.key === k);

  const FAQ = [
    ['ফলোয়ার নিতে কি পাসওয়ার্ড দিতে হবে?', 'না। শুধু আপনার পাবলিক Facebook Page বা Profile-এর লিংক দিন। পাসওয়ার্ড, OTP বা লগইন কোড কখনো কাউকে দেবেন না।'],
    ['বাংলাদেশি ও ওয়ার্ল্ড ফলোয়ারের পার্থক্য কী?', 'দুই ধরনের প্যাকেজের মূল্য আলাদা। বাংলাদেশি ফলোয়ার সম্পন্ন হতে তুলনামূলক বেশি সময় লাগতে পারে।'],
    ['অ্যাডের বাজেট কীভাবে হিসাব হয়?', 'সর্বনিম্ন $১০ থেকে শুরু, এরপর যত ইচ্ছা বাড়াতে পারবেন। প্রতি ডলার ' + tk(USD_RATE) + ' — যেমন $২৫ হলে ' + tk(25 * USD_RATE) + '।'],
    ['পেমেন্ট কীভাবে যাচাই হয়?', 'বিকাশ, নগদ বা রকেটে Send Money করে আপনার নম্বর ও TrxID দিন। WhatsApp-এ আসা তথ্য ম্যানুয়ালি মিলিয়ে দেখার পর কাজ শুরু হয়।'],
    ['ফলাফলের নিশ্চয়তা আছে কি?', 'ফলোয়ার সংখ্যা বা অ্যাডের বাজেট রিচ, বিক্রি বা গ্রাহকের আস্থার নিশ্চয়তা দেয় না। ভালো কনটেন্ট ও নিয়মিত পেইজ পরিচালনাও জরুরি।']
  ];

  /* ====== State ====== */
  const S = { step: 1, svc: null, pkg: null, usd: '', link: '', name: '', note: '', m: 'bKash', sn: '', tx: '', done: null, err: '', busy: 0, init: 0 };
  function reset(keepForm) {
    S.step = 1; S.svc = null; S.pkg = null; S.usd = ''; S.tx = ''; S.done = null; S.err = ''; S.busy = 0;
    if (!keepForm) { S.name = ''; S.note = ''; }
  }
  function total() {
    if (S.svc === 'ads') { const u = Math.floor(Number(S.usd)); return u >= USD_MIN && u <= USD_MAX ? u * USD_RATE : 0; }
    if (S.svc === 'world' || S.svc === 'bd') return S.pkg ? S.pkg[2] : 0;
    if (S.svc === 'setup') return SETUP_PRICE;
    if (S.svc === 'video') return VIDEO_PRICE;
    return 0;
  }
  function sumTitle() {
    const sv = svcOf(S.svc); if (!sv) return '';
    if (S.svc === 'ads') { const u = Math.floor(Number(S.usd)); return sv.title + (u >= USD_MIN ? ' · $' + bn(u) : ''); }
    if (S.svc === 'world' || S.svc === 'bd') return sv.title + (S.pkg ? ' · ' + S.pkg[1] : '');
    return sv.title;
  }
  function lines() {
    const L = [];
    if (S.svc === 'ads') { L.push('বাজেট: $' + Math.floor(Number(S.usd)) + ' (রেট ' + USD_RATE + '৳/ডলার)'); L.push('পেইজ লিংক: ' + S.link); }
    else if (S.svc === 'world' || S.svc === 'bd') { L.push('প্যাকেজ: ' + S.pkg[1] + ' ফলোয়ার (' + S.pkg[0] + ')'); L.push('লিংক: ' + S.link); }
    else { L.push('ব্যবসার নাম: ' + S.name.trim()); if (S.link) L.push('বর্তমান পেইজ লিংক: ' + S.link); if (S.note.trim()) L.push('নোট: ' + S.note.trim()); }
    return L;
  }
  function orderText(o) {
    return '*নতুন Business Support অর্ডার* (' + o.id + ')\nসার্ভিস: ' + o.title + '\n' + o.lines.join('\n') + '\nটাকা: ' + o.tk + '৳\nপেমেন্ট মাধ্যম: ' + o.m + '\nযে নম্বর থেকে পেমেন্ট: ' + o.sn + '\nTrxID: ' + o.tx;
  }

  /* ====== Views ====== */
  const draw = (top) => { const v = $('view'); if (!v) return; v.innerHTML = '<div class="bz">' + page() + '</div>'; if (top !== false) window.scrollTo(0, 0); if (S.step === 1) paintCalc(); };
  function head(title, sub) {
    return `<div class="bz-head"><button type="button" class="bz-back" onclick="Business.back(true)" aria-label="পেছনে">${svg('back', 20)}</button><div><h2>${title}</h2><p>${sub}</p></div></div>`;
  }
  function steps() {
    const L = ['সার্ভিস', 'তথ্য', 'পেমেন্ট'], cur = Math.min(S.step, 3) + (S.step === 4 ? 1 : 0);
    return `<ol class="bz-steps" aria-label="ধাপ">${L.map((l, i) => { const n = i + 1, c = cur > n ? 'done' : (cur === n ? 'on' : ''); return `<li class="${c}"><span>${cur > n ? svg('check', 13) : bn(n)}</span>${l}</li>`; }).join('')}</ol>`;
  }
  function summaryCard() {
    const sv = svcOf(S.svc); if (!sv) return '';
    return `<div class="bz-card"><div class="bz-sum"><span class="bz-ic">${svg(sv.icon, 22)}</span><div><b id="bz-st">${esc(sumTitle())}</b><small>${esc(sv.sub)}</small></div><span class="bz-tot" id="bz-tot">${total() ? tk(total()) : '—'}</span></div>
      <ul class="bz-trust"><li>${svg('shield', 16)}<span>পাসওয়ার্ড বা OTP কখনো চাওয়া হয় না</span></li><li>${svg('check', 16)}<span>পেমেন্ট ম্যানুয়ালি যাচাই করা হয়</span></li></ul></div>`;
  }
  function page() {
    if (!signedIn()) return lockedView();
    if (S.step === 1) return viewHome();
    if (S.step === 2) return viewDetails();
    if (S.step === 3) return viewPay();
    return viewDone();
  }
  function lockedView() {
    return `<div class="bz-card bz-lock"><span class="bz-ic">${svg('lock', 26)}</span><h3>সাইন ইন করুন</h3><p class="bz-mut">Business Support শুধু Old POS-এ রেজিস্ট্রেশন (Google সাইন-ইন) করা ইউজারদের জন্য। সাইন ইন করলেই পেজটি খুলে যাবে।</p><button type="button" class="bz-btn pri" style="margin-top:14px" onclick="Business.signIn()">Google দিয়ে সাইন ইন</button></div>`;
  }

  function viewHome() {
    const recent = orders().slice(0, 3);
    return `${head('Business Support', 'ফলোয়ার · Facebook অ্যাড · পেইজ সেটআপ · ভিডিও')}
      <div class="bz-hero"><b>আপনার ব্যবসা অনলাইনে বড় করুন</b><span>সার্ভিস বাছুন, তথ্য দিন, বিকাশ / নগদ / রকেটে পেমেন্ট করুন — অর্ডার সরাসরি WhatsApp-এ চলে যাবে।</span></div>
      <div class="bz-list">${SERVICES.map(s => `<button type="button" class="bz-svc${s.pop ? ' pop' : ''}" onclick="Business.pick('${s.key}')">${s.pop ? `<i class="bz-tag" style="font-style:normal">${s.pop}</i>` : ''}<span class="bz-ic">${svg(s.icon, 24)}</span><span class="bz-st"><b>${s.title}</b><small>${s.sub}</small></span><span class="bz-pr">${s.price}${s.from ? '<small>থেকে শুরু</small>' : ''}</span></button>`).join('')}</div>
      ${recent.length ? `<section class="bz-sec"><h3 class="bz-h">আপনার সাম্প্রতিক অর্ডার</h3><div class="bz-rec">${recent.map(o => `<div class="bz-r"><div><b>${esc(o.title)}</b><small>${esc(o.id)} · ${tk(o.tk)} · ${esc(o.m)}</small></div><button type="button" onclick="Business.resend('${esc(o.id)}')">আবার পাঠান</button></div>`).join('')}</div></section>` : ''}
      <section class="bz-sec"><h3 class="bz-h">সাধারণ প্রশ্ন</h3><div class="bz-card bz-faq" style="padding:6px 16px">${FAQ.map(q => `<details><summary>${q[0]}</summary><p>${q[1]}</p></details>`).join('')}</div></section>
      <div class="bz-sec"><a class="bz-btn wa" href="${waLink('আসসালামু আলাইকুম, Business Support নিয়ে সাহায্য দরকার।')}" target="_blank" rel="noopener">${svg('wa', 18)} সাহায্য দরকার? WhatsApp করুন</a></div>
      <p class="bz-note">ফলোয়ার সংখ্যা বা বিজ্ঞাপনের বাজেট রিচ, বিক্রি বা গ্রাহকের আস্থার নিশ্চয়তা দেয় না।</p>`;
  }

  function viewDetails() {
    const sv = svcOf(S.svc); let f = '';
    const linkF = (label, req, ph) => `<div class="bz-fld"><label class="bz-lbl" for="bz-link">${label}${req ? ' *' : ''}</label><input id="bz-link" class="bz-in" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${ph}" value="${esc(S.link)}" oninput="Business.set('link',this.value)"></div>`;
    if (S.svc === 'ads') {
      f = linkF('Facebook পেইজের লিংক', 1, 'https://facebook.com/yourpage') +
        `<div class="bz-fld"><label class="bz-lbl" for="bz-usd">বাজেট (ডলার) — সর্বনিম্ন $${bn(USD_MIN)}</label><div class="bz-usd"><i>$</i><input id="bz-usd" class="bz-in" type="number" inputmode="numeric" min="${USD_MIN}" max="${USD_MAX}" step="1" placeholder="${USD_MIN}" value="${esc(S.usd)}" oninput="Business.set('usd',this.value)"></div>
        <div class="bz-chips">${ADS_CHIPS.map(v => `<button type="button" class="bz-chip${Number(S.usd) === v ? ' on' : ''}" data-v="${v}" onclick="Business.usd(${v})">$${bn(v)}</button>`).join('')}</div><div class="bz-calc" id="bz-calc"></div></div>`;
    } else if (S.svc === 'world' || S.svc === 'bd') {
      f = `<div class="bz-fld"><span class="bz-lbl">প্যাকেজ বেছে নিন</span><div class="bz-pk">${PKG[S.svc].map((p, i) => `<button type="button" class="bz-p${S.pkg && S.pkg[0] === p[0] ? ' sel' : ''}" data-i="${i}" onclick="Business.pkg(${i})"><b>${p[1]}</b><span>${tk(p[2])}</span><small>${tk(Math.round(p[2] / p[0] * 1000))} / ১০০০</small></button>`).join('')}</div></div>` +
        linkF('Facebook Page / Profile লিংক', 1, 'https://facebook.com/yourpage') +
        (S.svc === 'bd' ? '<p class="bz-mut" style="margin:0">বাংলাদেশি ফলোয়ার সম্পন্ন হতে তুলনামূলক বেশি সময় লাগতে পারে।</p>' : '');
    } else {
      f = `<div class="bz-fld"><label class="bz-lbl" for="bz-name">ব্যবসার নাম *</label><input id="bz-name" class="bz-in" type="text" autocomplete="organization" maxlength="80" placeholder="যেমন: রহমান স্টোর" value="${esc(S.name)}" oninput="Business.set('name',this.value)"></div>` +
        linkF('বর্তমান পেইজ লিংক (থাকলে)', 0, 'https://facebook.com/yourpage') +
        `<div class="bz-fld"><label class="bz-lbl" for="bz-note">নোট (ঐচ্ছিক)</label><textarea id="bz-note" class="bz-in" maxlength="400" placeholder="আপনার ব্যবসা সম্পর্কে সংক্ষেপে লিখুন" oninput="Business.set('note',this.value)">${esc(S.note)}</textarea></div>`;
    }
    return `${head(sv.title, sv.sub)}${steps()}
      <div class="bz-cols two"><div><div class="bz-card">${f}<div class="bz-err" id="bz-e" role="alert">${esc(S.err)}</div><button type="button" class="bz-btn pri" style="margin-top:14px" onclick="Business.toPay()">পেমেন্টে যান</button></div></div><aside class="bz-side">${summaryCard()}</aside></div>`;
  }

  function viewPay() {
    const m = PM[S.m];
    return `${head('পেমেন্ট', 'টাকা পাঠিয়ে TrxID দিন')}${steps()}
      <div class="bz-cols two"><div><div class="bz-card" style="--mc:${m.c}" id="bz-pc">
        <h3 class="bz-h">পেমেন্ট মাধ্যম</h3>
        <div class="bz-pm" id="bz-m" role="group" aria-label="পেমেন্ট মাধ্যম">${Object.keys(PM).map(k => `<button type="button" class="bz-m" style="--mc:${PM[k].c}" data-m="${k}" aria-pressed="${k === S.m}" onclick="Business.method('${k}')"><img src="${BASE}${PM[k].img}" alt="" width="52" height="52" loading="eager" decoding="async"><span>${PM[k].bn}</span></button>`).join('')}</div>
        <div class="bz-num"><div><small id="bz-pl">${esc(m.bn)} Send Money (Personal) নম্বর</small><b id="bz-pn">${m.n}</b></div><button type="button" class="bz-cp" id="bz-cp" onclick="Business.copyNum()">কপি</button></div>
        <div class="bz-amt"><span>ঠিক এই টাকা পাঠাবেন</span><b>${tk(total())}</b></div>
        <ol class="bz-ol"><li><span>উপরের নম্বরে <b>Send Money</b> (Personal) করুন, রেফারেন্সে কিছু লিখতে হবে না।</span></li><li><span>যে নম্বর থেকে পাঠিয়েছেন সেটি ও TrxID নিচে দিন।</span></li></ol>
        <div class="bz-fld"><label class="bz-lbl" for="bz-sn">আপনার পেমেন্ট নম্বর</label><input id="bz-sn" class="bz-in" type="tel" inputmode="numeric" autocomplete="tel" maxlength="16" placeholder="01XXXXXXXXX" value="${esc(S.sn)}" oninput="Business.set('sn',this.value)"></div>
        <div class="bz-fld"><label class="bz-lbl" for="bz-tx">ট্রানজেকশন আইডি (TrxID)</label><input id="bz-tx" class="bz-in" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="24" placeholder="যেমন: 9AB1C2D3EF" value="${esc(S.tx)}" oninput="Business.set('tx',this.value)"></div>
        <div class="bz-err" id="bz-e" role="alert">${esc(S.err)}</div>
        <button type="button" class="bz-btn wa" style="margin-top:12px" onclick="Business.submit()">${svg('wa', 18)} WhatsApp-এ অর্ডার পাঠান</button>
        <p class="bz-mut" style="margin:10px 2px 0;text-align:center">WhatsApp খুললে মেসেজটি <b>Send</b> চাপতে ভুলবেন না।</p>
      </div></div><aside class="bz-side">${summaryCard()}</aside></div>`;
  }

  function viewDone() {
    const o = S.done; if (!o) return viewHome();
    return `${head('অর্ডার তৈরি হয়েছে', 'শেষ ধাপ: WhatsApp-এ Send চাপুন')}${steps()}
      <div class="bz-card bz-ok"><div class="bz-tick">${svg('check', 32)}</div><h3>প্রায় শেষ!</h3><p class="bz-mut">WhatsApp-এ মেসেজটি <b>Send</b> করলেই আমরা অর্ডারটি পাব। পেমেন্ট মিলিয়ে দেখে কাজ শুরু করা হবে।</p><span class="bz-oid">${esc(o.id)}</span>
        <div class="bz-acts"><a class="bz-btn wa" href="${waLink(orderText(o))}" target="_blank" rel="noopener">${svg('wa', 18)} WhatsApp খুলুন</a><button type="button" class="bz-btn" id="bz-cpid" onclick="Business.copyId()">অর্ডার আইডি কপি করুন</button><button type="button" class="bz-btn" onclick="Business.again()">নতুন অর্ডার</button></div></div>`;
  }

  /* ====== Behaviour ====== */
  function fail(msg, id) { S.err = msg; const e = $('bz-e'); if (e) e.textContent = msg; const i = id && $(id); if (i) { i.classList.add('bad'); try { i.focus(); } catch (_) {} } return false; }
  function clearErr() { S.err = ''; const e = $('bz-e'); if (e) e.textContent = ''; document.querySelectorAll('.bz-in.bad').forEach(x => x.classList.remove('bad')); }
  function paintCalc() { /* ads budget line on step 2 is painted by calc() */ }
  function calc() {
    const c = $('bz-calc'); if (!c) return; const u = Number(S.usd);
    if (S.usd === '' || !(u >= USD_MIN)) { c.className = 'bz-calc bad'; c.innerHTML = '<span>সর্বনিম্ন বাজেট $' + bn(USD_MIN) + '</span>'; }
    else if (u > USD_MAX || u !== Math.floor(u)) { c.className = 'bz-calc bad'; c.innerHTML = '<span>পূর্ণ সংখ্যা দিন (সর্বোচ্চ $' + bn(USD_MAX) + ')</span>'; }
    else { c.className = 'bz-calc'; c.innerHTML = '<span>$' + bn(u) + ' × ' + bn(USD_RATE) + '৳</span><b>' + tk(u * USD_RATE) + '</b>'; }
  }
  function refreshSum() {
    const t = $('bz-tot'), s = $('bz-st'); if (t) t.textContent = total() ? tk(total()) : '—'; if (s) s.textContent = sumTitle();
  }
  function go(n, top) { S.step = n; clearErr(); draw(top); if (S.step === 2) calc(); }

  const Business = {
    ready: true,
    render() {
      if (!S.init) {
        S.init = 1;
        try {   // direct links from ads: /business?pkg=10000&market=bd  ·  ?service=ads|setup|video
          const q = new URLSearchParams(window.__bizQ || ''), mk = q.get('market') === 'bd' ? 'bd' : 'world', pk = q.get('pkg') || q.get('p'), sv = q.get('service');
          if (signedIn()) {
            if (sv && ['ads', 'setup', 'video'].indexOf(sv) > -1) { S.link = ls('biz_link') || ''; S.sn = ls('biz_sn') || ''; S.svc = sv; S.step = 2; }
            else if (pk) { const i = PKG[mk].findIndex(p => String(p[0]) === pk); if (i > -1) { S.svc = mk; S.pkg = PKG[mk][i]; S.link = ls('biz_link') || ''; S.sn = ls('biz_sn') || ''; S.step = 2; } }
          }
        } catch (_) {}
      }
      draw(true); if (S.step === 2) calc();
    },
    signIn() { try { if (window.Cloud && Cloud.signIn) Cloud.signIn(); } catch (_) {} },
    pick(k) { reset(true); S.svc = k; S.link = ls('biz_link') || S.link || ''; S.sn = ls('biz_sn') || S.sn || ''; go(2); },
    set(k, v) { S[k] = v; clearErr(); if (k === 'usd') { calc(); refreshSum(); document.querySelectorAll('.bz-chip').forEach(c => c.classList.toggle('on', Number(c.dataset.v) === Number(v))); } },
    usd(v) { S.usd = String(v); const i = $('bz-usd'); if (i) i.value = v; Business.set('usd', String(v)); },
    pkg(i) { S.pkg = PKG[S.svc][i]; clearErr(); document.querySelectorAll('.bz-p').forEach(b => b.classList.toggle('sel', +b.dataset.i === i)); refreshSum(); },
    toPay() {
      clearErr();
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
      go(3);
    },
    method(k) {
      S.m = k; const m = PM[k];
      document.querySelectorAll('#bz-m button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === k));
      const c = $('bz-pc'), n = $('bz-pn'), l = $('bz-pl'); if (c) c.style.setProperty('--mc', m.c); if (n) n.textContent = m.n; if (l) l.textContent = m.bn + ' Send Money (Personal) নম্বর';
    },
    copyNum() { const b = $('bz-cp'); copyText(PM[S.m].n.replace(/-/g, ''), () => { if (b) { b.textContent = 'কপি হয়েছে ✓'; setTimeout(() => { if (b) b.textContent = 'কপি'; }, 1600); } }); },
    copyId() { const b = $('bz-cpid'); if (!S.done) return; copyText(S.done.id, () => { if (b) { b.textContent = 'কপি হয়েছে ✓'; setTimeout(() => { if (b) b.textContent = 'অর্ডার আইডি কপি করুন'; }, 1600); } }); },
    submit() {
      if (!signedIn()) return fail('অর্ডার দিতে আগে সাইন ইন করুন');
      const sn = String(S.sn).replace(/[\s-]/g, '').replace(/^(\+?88)/, ''), tx = String(S.tx).trim().toUpperCase().replace(/\s/g, '');
      if (!/^01[3-9]\d{8}$/.test(sn)) return fail('সঠিক মোবাইল নম্বর দিন (যে নম্বর থেকে টাকা পাঠিয়েছেন)', 'bz-sn');
      if (!/^[A-Z0-9]{6,20}$/.test(tx)) return fail('সঠিক ট্রানজেকশন আইডি দিন (শুধু ইংরেজি অক্ষর ও সংখ্যা)', 'bz-tx');
      const hs = orders();
      if (hs.some(o => o.tx === tx)) return fail('এই ট্রানজেকশন আইডি দিয়ে আগেই অর্ডার করা হয়েছে', 'bz-tx');
      if (S.busy || !total()) return; S.busy = 1;
      const o = { id: 'BIZ' + Date.now().toString(36).toUpperCase().slice(-6), svc: S.svc, title: sumTitle(), lines: lines(), tk: total(), m: S.m, sn, tx, t: Date.now() };
      ls('biz_sn', sn); hs.unshift(o); ls('biz_orders', JSON.stringify(hs.slice(0, 10)));
      S.done = o; S.busy = 0; go(4);
      try { const w = window.open(waLink(orderText(o)), '_blank', 'noopener'); if (!w) window.Core && Core.toast && Core.toast('WhatsApp খুলতে নিচের বাটনে চাপুন'); } catch (_) {}
    },
    resend(id) { const o = orders().find(x => x.id === id); if (!o) return; try { const w = window.open(waLink(orderText(o)), '_blank', 'noopener'); if (!w) location.href = waLink(orderText(o)); } catch (_) {} },
    again() { reset(false); go(1); },
    /* Back: returns true when it moved a step back inside this page (used by the app's Back button) */
    back(fromArrow) {
      if (S.step > 1) { go(S.step === 4 ? 1 : S.step - 1); if (S.step === 1) S.svc = null; return true; }
      if (fromArrow && window.App) App.go('dashboard');
      return false;
    },
    refresh() { if (window.App && App.view === 'business') Business.render(); }
  };
  window.Business = Business;
  if (window.App && App.Views) App.Views.business = Business;
})();
