/* Old POS user counter v3 — Google Apps Script (bound to a Google Sheet).
   One row per Google ACCOUNT (an anonymous 32-char fingerprint of the e-mail — the e-mail itself is never stored).
   A new account is added once; the total is the number of rows. Counting starts from ZERO: it uses a fresh
   sheet tab named "users", so everything that was counted before (tab "devices") is ignored. */
const SHEET = 'users';

function sheet_() {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(SHEET);
  if (!s) {
    s = ss.insertSheet(SHEET);
    s.getRange('A:A').setNumberFormat('@');          // ids stay text
    s.appendRow(['account', 'time']);
  }
  return s;
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function total_() {
  const c = CacheService.getScriptCache(), v = c.get('t3');
  if (v !== null) return Number(v);
  const n = Math.max(0, sheet_().getLastRow() - 1);
  c.put('t3', String(n), 30);
  return n;
}
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.a === 'hit') {
    const id = String(p.id || '');
    if (!/^[a-f0-9]{32}$/.test(id)) return out_({ ok: false });
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const s = sheet_(), last = s.getLastRow();
      const found = last > 1 && s.getRange(2, 1, last - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
      if (!found) { s.appendRow([id, new Date()]); CacheService.getScriptCache().remove('t3'); }
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
