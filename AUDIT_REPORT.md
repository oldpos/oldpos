# Old POS v12.7.3 — Audit (backup of shop details / PIN, logout safety)

## Root cause found and reproduced (mock Google Drive, headless Chromium)
Google's access token lives 1 hour. After it ran out, shop details / PIN edits stayed "pending" on the phone only; **Log out → "Sign out anyway"** wiped the device while Drive still held the old values, so the next sign-in showed blank settings. (Test: edit with expired token → log out → sign in = old value. After fix = edited value.)

## Fixed
| # | Area | Problem | Fix |
|---|------|---------|-----|
| 1 | Backup | Edits made after token expiry never reached Drive | `softRenew()` renews the token while the tap is fresh; Save / Set PIN call `Cloud.reconnect()` |
| 2 | Backup | Unsynced settings lost at Log out | "Rescue" of changed keys, re-applied on next sign-in with the same account (14 days, then discarded); backup file saved first |
| 3 | Backup | Whole-object settings merge: stale values of one phone could overwrite another phone's edit | Key-by-key 3-way merge against last agreed copy (`esypos_g_setbase`) |
| 4 | Backup | Upload snapshot hashed live objects (edits during upload counted as synced) | Snapshot taken before upload; settings copied |
| 5 | Security | Log out left all shop data in IndexedDB safety copies | `Safety.wipeCopies()` on Log out; copies no longer hold PIN hashes |
| 6 | Security | Pending saves could write data back after Log out wipe | `Core.halt()` |
| 7 | Security | CSP allowed images from any https site | only `*.googleusercontent.com` (profile photo) |
| 8 | Design | Broken screenshot link (`desktop-11-users.png`) on index JSON-LD, features.html, bn.html | points to `desktop-10-sales-counter.png` |

## Tested
Settings sync with valid and expired token; logout/login; two devices editing different fields; copies wiped on logout; 10 views x 2 viewports (360 / 1280 px) no overflow, no JS errors; one POS sale (stock -1, synced to Drive).

## Not verified / still open
Real Google sign-in and Drive (mocked in tests); real phones, printers, camera. Needs a larger refactor: CSP still has 'unsafe-inline' (inline onclick handlers); the 1-hour Google token is kept in localStorage; a 4-digit PIN is client-side only and its hash is in the Drive backup (as requested, so it can be restored) — anyone with access to the Drive file could brute-force it offline. The user counter sends the Google name, e-mail and device description to the owner's Google Sheet (disclosed in the Privacy Policy).

---

# Old POS v12.1.3 — Audit Report (pass 1: v12.1.2, pass 2: v12.1.3)

## Fixed
| # | Area | Problem (root cause) | Fix |
|---|------|----------------------|-----|
| 1 | Total users (undercount) | Device id was a hash of screen/CPU/GPU traits → identical phone models shared one id | Random 128-bit id (existing stored ids kept) — guard.js / safety.js |
| 2 | Total users (undercount) | Device counter created, total increment failed → device never counted | Pending flag `esypos_uc_pend`, retried until the total goes up |
| 3 | Total users (overcount) | Fallback service (counterapi) counted a device again | Single registration source (Abacus); fallback is read-only |
| 4 | Total users (display) | Number could drop when a fallback returned a smaller value | Number only grows |
| 5 | Security | Stored XSS: record ids went unvalidated into inline onclick (backup file / Drive / local copy restore) | `sanitizeIds()` in `Core.migrate()` for all collections and restore paths |
| 6 | Offline / performance | pwa.js CACHE_VERSION v12.1.0 ≠ sw.js v12.1.1 → live cache deleted on each start | Both v12.1.2 |
| 7 | UI/UX | Tap targets 27–30px, clipped captions, no reduced-motion | polish.css additions |

## Tested (headless Chromium)
11 views × 9 viewports (320–1920px): no horizontal overflow, no JS errors. Tampered-id test: payload not executed, references intact. Counter test (mocked service): exactly +1, no double count, retry works. 3 identical devices → 3 distinct ids.

## Not verified
Real Google sign-in/Drive backup, live Abacus service, camera/barcode scanner, label printers, Safari/Firefox, real phones. Old inflated total: use `userCountOffset` in js/core/config.js. Free public counters can be reset or removed by their owner; a Firebase `userCounterUrl` is the reliable option. Devices that cleared all site data before this version may still be counted twice.

## Pass 2 (v12.1.3)
Fixed: privacy/terms/license/features pages overflowed sideways at 320px; product image field accepted any URL from a tampered backup (now data:image only); an error inside sale completion could leave the POS stuck on "busy" (now recovers with a message).
Tested: 8 pages × 4 widths; ~160 controls clicked across 10 views at 360px and 1280px with seeded data (no errors, no modal overflow); sale test (totals, stock deduction, overselling blocked); load 289 ms locally, 29 requests, ~711 KB.
Open risks (not changed, need a larger refactor): CSP still allows 'unsafe-inline' scripts because the UI uses inline onclick handlers; the Google access token (1 hour) is kept in localStorage; PIN lock is client-side only, so anyone with browser access to the device data can bypass it.
