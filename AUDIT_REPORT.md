# Old POS v12.10.0 — Audit pass 4 (Business Support inside the app, clean-up, speed)

Checked with headless Chromium (phone 390 px and desktop 1280 px): every view opens with no JS error and no sideways scroll; the Business flow (service → details → payment → order) incl. validation, duplicate TrxID, direct ad links, Back button; signed-out visitors see only the sign-in screen.

| # | Area | Finding | Action |
|---|------|---------|--------|
| 1 | Product | Business Support opened as a separate page/tab, not part of the software | Now a built-in screen, URL `oldpos.com/business`, sign-in required |
| 2 | Access | Prices and payment numbers were visible to anyone | Hidden behind sign-in inside the app (see note below) |
| 3 | UI | Payment tiles were text badges, long "Personal · Send Money" wrapped | Logo images + name only; summary on top on phones |
| 4 | Speed | 8 render-blocking style sheets on first open | Merged into `css/app.css` (identical pixels) |
| 5 | Speed | 740 KB of oversized PNGs (og-image 347 KB, icon-512 116 KB) | Re-compressed, same size/look |
| 6 | Clean-up | 11 unused screenshots, `firebase-rules.json`, `smm/` redirect, unused logo | Deleted |
| 7 | UI | Desktop title bar read "Business SupportNew" | Badge text excluded from the title |
| 8 | SEO | `/business` listed in sitemap although it needs sign-in | Removed; `robots.txt` Disallow |

Note: the site is static (GitHub Pages). The sign-in gate is enforced by the app; `js/modules/business.js` itself is a public file and contains only the price list and payment numbers (no secrets). Real server-side protection would need a backend.

Still open (unchanged, needs a design decision): inline `onclick` handlers force `'unsafe-inline'` in the CSP; Google token is kept in localStorage.

---

# Old POS v12.9.0 — Audit pass 3 (shop details + UI/UX)

Verified with Node simulations of the settings merge (6 device scenarios), a full-app boot test (jsdom) of Settings → Shop, ESLint (no undefined variables / dead code), CSS syntax parse of all 9 style sheets, HTML id/alt/link checks, and an icon-font coverage check (80 icon classes, none missing).

| # | Area | Problem | Fix |
|---|------|---------|-----|
| 1 | Data | Blank/default settings from Drive, an old backup or a device without a sync base could win the merge and then be uploaded (shop name, address, phone vanished) | Per-setting edit time (`ts_*`); newest edit wins; blank never beats typed; deliberate clear sticks |
| 2 | Data | Settings form wrote every field on any change — a stale form overwrote newer values | Only edited fields are written (`data-o` original tracking); Save always re-syncs |
| 3 | Data | No second copy of shop details on the device | `esypos_profile` mirror, restored automatically if the main copy regresses; cleared on Log out / Delete all / explicit restore |
| 4 | UX | No sign that shop details reached Google Drive | Live "Saved to Google Drive · time" line under every Save button |
| 5 | UI | Every `<select>` lost its arrow (refine.css `background:` shorthand reset it) | Arrow restored, light + dark |
| 6 | UI | Input border contrast 1.2:1 | ~3:1, hover/focus/disabled/invalid states |
| 7 | A11y | Labels not linked to fields; theme/mode captions were fake labels | Auto-linked; captions are plain text |
| 8 | UX | Mouse wheel changed focused number fields | Field blurs on wheel |
| 9 | A11y | Dialogs: no focus move, Tab left the dialog, Enter could confirm a delete | Focus management, Tab trap, Cancel focused on danger dialogs |
| 10 | UX | Native browser `confirm()` for Forget printer | App dialog |
| 11 | UI | Currency example did not follow the symbol; tiny 11px labels; no focus ring on buttons | Live example, 12px+, focus-visible ring |
| 12 | PWA | `bn.html` not cached offline | Added |

# Old POS v12.8.0 — Audit pass 2

Reviewed every JS file, the service worker, CSP and the Drive script; tested with a mocked Google/Drive in headless Chromium.

| # | Area | Problem | Fix |
|---|------|---------|-----|
| 1 | Sync | Phone that signed in before a backup existed never found the file made later by another phone (fid empty -> poll returned) | poll looks the file up (throttled) |
| 2 | Sync | Edits to expenses / bills / purchases / returns reverted when another phone saved first (only adds/deletes merged) | all collections merged per record (`Bk[id] === 1` = old format, treated as unchanged) |
| 3 | Sync | Receive-only phone with expired token never updated | silent renewal also when live sync is on and token is stale |
| 4 | Sync | New data waited up to 45 s | immediate check on focus / return to app |
| 5 | UX | Live sync re-drew Settings while typing | skipped while a Settings field has focus |
| 6 | Security | Remote settings copied key-by-key without filtering (`__proto__`, objects, huge text) | `Core.cleanSettings()` on every entry point |
| 7 | Security | Staff could Log out / wipe data without Admin PIN | Admin PIN asked when set |
| 8 | Audit | PIN reset through Google left no trace | Security log entry |

Tested: owner sets company name + Admin PIN on device A -> device B receives name and PIN (right PIN accepted, wrong rejected); B changes PIN -> A follows; 103 control clicks across 10 views, 0 JS errors; 2 viewports no overflow; sale + sync; expired token + logout keeps edits.

Open (needs architecture change or is a product decision): inline `onclick` forces `unsafe-inline`; Google token in localStorage; 4-digit PIN hash is in the Drive file (needed for cross-device PIN) so anyone who can read that file can brute-force it offline - use a strong Google password / 2-step verification; "Forgot PIN via Google" works for anyone holding an unlocked phone that is already signed in to the owner's Google account.

---

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
