/* Old POS user counter v4 — Google Apps Script (bound to a Google Sheet).
   One row per Google ACCOUNT. A new account is added once; the total is the number of rows.
   v4 (Old POS v12.5.0): every row also keeps the user's NAME, E-MAIL and DEVICE details, plus first / last seen time:

     A account   B first seen   C name   D e-mail   E device   F system   G browser   H screen   I time zone   J last seen   K active days (days the app was opened)

   Old rows (only A + B) are filled in automatically the next time that user opens the app.
   The tab is "users" (same as v3), so the count does NOT restart. */
const SHEET = 'users';
const HEAD = ['account', 'first seen', 'name', 'e-mail', 'device', 'system', 'browser', 'screen', 'time zone', 'last seen', 'active days'];

function sheet_() {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(SHEET);
  if (!s) {
    s = ss.insertSheet(SHEET);
    s.getRange('A:A').setNumberFormat('@');          // ids stay text
  }
  const h = s.getRange(1, 1, 1, HEAD.length).getValues()[0];
  if (h.join('|') !== HEAD.join('|')) {
    s.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold').setBackground('#e8f0fe');
    s.setFrozenRows(1);
  }
  return s;
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function total_() {
  const c = CacheService.getScriptCache(), v = c.get('t3');
  if (v !== null) return Number(v);
  const n = Math.max(0, sheet_().getLastRow() - 1);
  c.put('t3', String(n), 5);   // short cache: every phone sees (almost) the same number
  return n;
}
/* text from the app: trimmed, cut short, and made safe so a cell can never be run as a formula */
function clean_(v, max) {
  v = String(v || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 100);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.a === 'hit') {
    const id = String(p.id || '');
    if (!/^[a-f0-9]{32}$/.test(id)) return out_({ ok: false });
    const email = /^[^\s@]{1,64}@[^\s@]{1,255}$/.test(String(p.e || '')) ? clean_(p.e, 120) : '';
    const info = [clean_(p.n, 100), email, clean_(p.d, 80), clean_(p.o, 40), clean_(p.b, 60), clean_(p.s, 20), clean_(p.z, 40)];   // C..I
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const s = sheet_(), last = s.getLastRow(), now = new Date();
      const found = last > 1 && s.getRange(2, 1, last - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
      if (!found) {
        s.appendRow([id, now].concat(info).concat([now, 1]));
        CacheService.getScriptCache().remove('t3');
      } else {
        const r = found.getRow(), cur = s.getRange(r, 3, 1, 9).getValues()[0];   // C..K
        const next = info.map(function (v, i) { return v || cur[i]; });           // never blank out something we already know
        const days = (Number(cur[8]) || 0) + 1;
        s.getRange(r, 3, 1, 9).setValues([next.concat([now, days])]);
      }
      return out_({ ok: true, total: total_() });
    } finally { lock.releaseLock(); }
  }
  return out_({ ok: true, total: total_() });
}

/* Optional: run this by hand (▶ Run) to reset the count to 0 again. */
function resetToZero() {
  const s = sheet_();
  if (s.getLastRow() > 1) s.deleteRows(2, s.getLastRow() - 1);
  CacheService.getScriptCache().remove('t3');
}
