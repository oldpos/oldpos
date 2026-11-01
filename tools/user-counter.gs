/* Old POS user counter — Google Apps Script (bound to a Google Sheet).
   One row per device id. A new id is added once; the total is the number of rows. */
const SHEET = 'devices';

function sheet_() {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(SHEET);
  if (!s) {
    s = ss.insertSheet(SHEET);
    s.getRange('A:A').setNumberFormat('@');          // ids stay text (never turned into numbers)
    s.appendRow(['device', 'time']);
  }
  return s;
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function total_() {
  const c = CacheService.getScriptCache(), v = c.get('t');
  if (v !== null) return Number(v);
  const n = Math.max(0, sheet_().getLastRow() - 1);
  c.put('t', String(n), 30);                          // reads are served from cache for 30 s
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
      if (!found) { s.appendRow([id, new Date()]); CacheService.getScriptCache().remove('t'); }
      return out_({ ok: true, total: total_() });
    } finally { lock.releaseLock(); }
  }
  return out_({ ok: true, total: total_() });
}
