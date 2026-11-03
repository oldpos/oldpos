# Changelog

All notable changes to Old POS. Latest first.

## v12.7.3 — Shop details, PIN & settings now really reach Google Drive · safer Log out
- **Fixed (root cause): shop name / phone / address / PIN were lost after Log out → Sign in.** Google's access token lasts only 1 hour. After that, every change stayed "pending" on the phone only; Log out then wiped the device and the cloud copy still held the old blank values. Now: (1) when you change something and the token has run out, Old POS renews it quietly while your tap is still fresh, and the **Save changes** / **Set PIN** buttons ask you to reconnect if needed; (2) anything typed but not yet synced when you log out is kept as a small "rescue" and put back automatically when you sign in again with the same Google account; (3) the unsynced-logout dialog now saves a backup file first.
- **Fixed: two phones overwriting each other's settings.** Settings are now merged key by key against the last agreed copy (a stale blank or old value can no longer replace what you typed on the other phone). The upload also takes a true snapshot, so edits made *while* a backup runs are never marked as synced.
- **Security: Log out now really clears the phone.** The rolling local safety copies (all shop data) used to survive Log out; they are now deleted. Local copies no longer contain PIN hashes. Nothing can be written back to the device after Log out (new `Core.halt()`).
- **Security:** page policy no longer allows images from any website (only Google profile photos); fixed broken screenshot links on the website pages.
- Cache `v12.7.3`.

## v12.7.2 — Shop details & lock now really saved · same user count everywhere · Reports tile
- **Fixed: shop name, phone, address, PIN and other Settings were not kept** after sign-out / sign-in or an update. Cause: a shop that had only Settings filled in (no product or sale yet) counted as "empty", so it was never backed up and the next sign-in replaced it with blanks; the sign-in merge also let the cloud's blank values win when this device had no sync base. Settings now count as data, are merged field by field (typed values survive, cloud values win when both exist), and shop fields **save the moment you change them** (no need to press Save).
- **Total users is the same on every phone.** The app no longer keeps the highest number it ever saw (that left some phones on an old, higher count); it shows the server number, with a cache-buster. `tools/user-counter.gs`: result cache 30 s → 5 s (re-deploy the script once).
- **Dashboard:** the *Reports* tile now looks like *This month* / *Customer due*: label with a 🔒 •••• mark underneath (tap → Admin PIN → Reports). No "Open" text.
- **Lighter:** screenshots compressed (about 70% smaller, faster first load), the lock watcher sleeps when nothing is unlocked.
- Cache `v12.7.2`.

## v12.7.1 — Page-by-page Admin lock · separate Home lock · full-screen PIN dialogs · full-screen PWA · fixes
- **Admin lock is per page.** A locked page asks the Admin PIN every time you open it and locks again the moment you leave it (no time window). Staying on the page does not ask again; it also re-locks after the idle time you choose.
- **Home-screen lock and Admin lock are separate.** Menu button is now *Lock app* (home PIN only; with no PIN set it opens *Set PIN* instead of doing nothing). The header 🔒 icon was removed. Security has its own *Lock admin sections now* button.
- **Dashboard:** the *Reports* tile shows no money, only an *Open* link to Reports. *This month* and *Customer due* still follow the Admin lock.
- **PIN dialogs fill the phone screen** and now show the recovery question first, then the PIN fields right above the keypad, so the dots never scroll out of sight.
- **Full screen:** manifest asks for `fullscreen` (falls back to standalone), plus a *Full screen* button in the menu for browser tabs. Re-install the app once to pick up the new manifest.
- **Fixed missing icons:** keypad backspace key (⌫) was blank; Scramble, Dashboard-tile and device icons were not in the icon font.
- Cache `v12.7.1`; all screenshots re-taken.

## v12.7.0 — Stronger lock · Forgot-PIN question · Lock now · slim dashboard tiles
- **Forgot PIN with a secret question.** Setting a Home PIN or Admin PIN now includes a recovery question + answer (answer stored only as a salted PBKDF2 hash). *Forgot PIN?* shows the question; the right answer lets you set a new PIN. 5 wrong answers lock it (1/5/15/30/60 min) and are logged. Existing PINs can add one in Settings → Security. New file `js/services/recovery.js`.
- **Lock again at once.** New 🔒 button in the header (phone + desktop) and a *Lock now* button in Security. It re-locks everything the Admin PIN opened and shows the home lock. Sections also re-lock by themselves after N minutes without a touch. New *Home screen auto-lock: As soon as I leave the app* option.
- **Drive login on another device** restores the PIN, Admin PIN and recovery question with the backup, so the lock is asked there too. Backup *files* and local copies still never carry or change any PIN/answer (`Core.stripSecrets` / `keepSecrets`).
- **Dashboard:** *This month*, *Customer due* and *Reports · profit* are now three slim, simple tiles and follow the Admin lock (lock icon, tap + PIN to view; new *Dashboard tiles* switch). Cards below (Recent sales, Needs attention, Top sellers) have an even 12px gap and stack on phones.
- **Hardening:** hardware-keyboard capture on the lock screen no longer blocks dialogs; lock-out counters reset on PIN change; PIN reset via Google also clears the recovery question.
- All screenshots (phone + desktop + slideshow) replaced with the current interface; `desktop-11-users.png` (page removed in v12.2) became `desktop-10-sales-counter.png`, new `11-security.png`.
- Cache `v12.7.0`.

## v12.6.0 — Secure keypad · three-tile dashboard · fixes
- **Secure on-screen keypad for every PIN.** Home-screen PIN, Admin PIN (set / change / remove / reset / unlock prompts) are typed on an in-app keypad. The phone keyboard never opens, fields are read-only (no paste, no autofill, no keyboard-app logging), a hardware keyboard still works on desktop. New optional **Scramble keypad digits** (Settings → Security). New file `js/services/keypad.js`.
- **Dashboard now has exactly three tiles:** *This month*, *Customer due*, *Reports* (profit this month). *Profit* and *Stock value* tiles removed. The Reports tile is hidden behind the Admin PIN when profit lock is on (previously the dashboard profit was never masked).
- **Security:** Change PIN / Disable PIN were not rate-limited (unlimited guesses) — now share the 5-try lock-out; lock screen shows tries left and a live lock-out countdown; Admin PIN must differ from the home PIN; shared, longer weak-PIN list; refunds / returns need the Admin PIN when one is set.
- **Fixes:** lock screen accepts a hardware keyboard; icon-only buttons got labels (accessibility); POS search placeholder no longer clipped on phones.
- Cache `v12.6.0`.

## v12.5.0 — Readable on every theme · mode button in the desktop header · richer dashboard · user list in the Sheet
- **Fixed: text hard to see on the other themes.** Bright theme colours (especially in dark mode — e.g. Graphite, Ocean, Emerald) had white text on them (*New sale*, primary buttons, selected chips, cart bar, avatars). Every filled surface now uses a deep brand fill (`--fill`) that always carries white text (contrast ≥ 4.5), and coloured text/icons use `--acc`. Checked on all 8 themes × light/dark × phone/desktop.
- **Dark / Light button added to the desktop header** (next to Backup and Telegram), like the phone header.
- **Dashboard:** new **Profit · this month** tile (opens Reports) next to Stock value, every tile has a small caption (bills, margin, customers with due, product count / low stock), and a **Top sellers · this month** card with bars. Four tiles in a row on wide screens, 2×2 on tablets, one list on phones.
- **Design:** one card / tile / button language, tabular numbers, visible focus rings, calmer shadows.
- **User list in the Google Sheet:** the row now also keeps the user's **name, e-mail, device (type / model), system, browser, screen, time zone, first seen, last seen and active days**. Old rows are filled in the next time that user opens the app. **You must update the Apps Script** — see `tools/SETUP-bn.md`. Privacy Policy updated.
- Cache `v12.5.0`.

## v12.4.0 — Design refinement · updates show immediately
- **Whole-app design pass** (`css/refine.css`): quiet flat background, frosted top/bottom bars, one card/control language, softer borders and shadows, clearer headings, better dark mode; desktop dashboard quick actions laid out in a row. Works with every theme.
- **Updates appear at once:** the service worker now loads pages, scripts and styles from the network first (cache only when offline), so a new release shows on the next open instead of the old cached copy.
- Cache `v12.4.0`.

## v12.3.1 — Quick actions · theme picker in menu · deploy fix
- Dashboard: greeting section removed; under *Today's sales* three buttons — New sale, Add expense, Add product.
- Menu **Theme** button now opens the theme picker (colour themes + Auto/Light/Dark). The Light/Dark moon button stays in the header.
- GitHub Pages: `.github/workflows/static.yml` with `concurrency` fixes "in progress deployment" failures.

## v12.3.0 — Fresh user count · account auto-detect · colour themes · modern dashboard
- **Counter starts from zero.** It now counts **Google accounts** (one account = one user, anonymous fingerprint — the e-mail is never stored) in a new sheet tab `users`. Old numbers and `userCountOffset` are ignored. Updated `tools/user-counter.gs` (+ `resetToZero()`), `tools/SETUP-bn.md`.
- Users who registered earlier keep all their data (it lives in their own Google Drive); they are counted once, anew, when they sign in.
- **Auto-detect:** a returning user who is still signed in to Google is recognised (Google One Tap) and the button reads *Continue as <name>*.
- **Themes:** Settings → Appearance now shows a theme gallery — Classic (default), Emerald, Ocean, Sunset, Royal, Rose, Graphite and Original (old v10.7). Light / Dark / Auto mode works on top of every theme. New `css/themes.css`.
- **Dashboard** a little more modern but still simple: avatar header, tinted sales card with 7-day sparkline, icon tiles, rounded bars.
- Counter URL set in `js/core/config.js`. Cache `v12.3.0`.

## v12.2.0 — Simple dashboard · plain live user counter
- **Dashboard redesigned:** one calm layout (today's sales, 3 numbers, 7-day bars, recent sales, things that need attention). Flat cards, light weights, no gradients, same on phone and desktop. New `css/simple.css`.
- **Total users is just a number:** the Users page and the tap-to-open link are gone (`users.js` removed). Only the total is shown.
- **Counts every visitor, once per device** (no sign-in needed; bots ignored). Login / logout never counts again. Total refreshes live (every 60 s while the app is open).
- **Counter is now Google Apps Script + Google Sheet only** (`tools/user-counter.gs`, `tools/SETUP-bn.md`). Firebase and the free public counters are removed. Devices already counted by older versions stay inside `userCountOffset`.

## v12.1.4 — Exact user counter
- **Exact counting with Firebase** (`userCounterUrl` + `firebase-rules.json`): one Google account = one user (SHA-256 fingerprint, e-mail never stored). Registration is a single atomic update accepted by the rules only when the user does not exist, so the total rises exactly once per user — parallel tabs, several phones, data wipes, re-installs and failed/retried requests cannot double-count. Total and daily history are plain counters (no scanning of all users).
- Previously counted devices are recorded but not added again (`userCountOffset` carries the old number).
- Users page shows which mode is active (Exact / Approximate).
- Privacy Policy updated.

## v12.1.3 — Second audit pass
- **Fixed:** Privacy, Terms, License and Features pages scrolled sideways on 320px phones (long links); text now wraps.
- **Security:** product images are accepted only as in-app data images; a tampered backup can no longer point the app at remote URLs.
- **Stability:** an unexpected error while completing a sale no longer leaves the POS stuck on "busy"; the cashier sees a message and can retry.
- Cache `v12.1.3` in `sw.js` and `pwa.js`.

## v12.1.2 — Total-users fix, security hardening, offline-cache fix
- **Total users counter fixed.** (1) Device id is now random: the old id was a hash of screen/CPU/GPU traits, so phones of the same model got the *same* id and were counted as one user. Existing devices keep their stored id. (2) If the device counter was created but the total could not be raised (offline / request failed) the device was never counted; it is now remembered and retried. (3) The old fallback service counted the same device a second time; registration now uses one service only. (4) The shown number can no longer drop because a fallback returned a smaller value. (5) Each request has its own timeout.
- **Security: stored-XSS via backup / cloud / local-copy restore.** Record ids were placed inside inline `onclick` handlers without validation. All id fields (`id`, `key`, `*Id`, item ids) are now forced to `A-Za-z0-9_.:@-` on every load and restore (references stay consistent).
- **Fixed: offline cache wiped on every start.** `pwa.js` had `CACHE_VERSION v12.1.0` while `sw.js` was `v12.1.1`, so `clearOldCaches()` deleted the live cache. Both are now `v12.1.2`.
- **UI:** tap targets ≥ 36px, captions wrap instead of being cut, media never wider than the screen, reduced-motion support.

## v12.1.1 — Users history, simpler design, fixes
- **Active now removed** from the menu, sidebar and Users page (no heartbeat any more → less network use and battery).
- **Users page rebuilt**: total users + a 30-day chart of **new users per day** and **visits per day** (tap a bar to see the day). The country / city section, the "not switched on" notice and the Countries card are gone; the network-address location lookup is removed.
- **Fixed: "Syncing" text spinning** around the Google account card and the Backup button. A global `.spin` loader class was being applied to the whole label; the status class is now `syncing` and only the icon turns.
- **Simpler design across the app**: flat cards with a thin border, no heavy shadows or gradients, calmer title bar and dashboard.
- Privacy Policy and README updated; service-worker cache bumped to v12.1.1.

## v12.1.0 — Professional dashboard, real-user counter, Active users & Users page
- **Desktop title bar** now shows only the page name (the shop name next to *Dashboard*, *Sales*… is gone).
- **Dashboard greeting strip redesigned** to match the software: time-of-day icon with *Good morning / afternoon / evening / night*, shop name, and three clear info blocks — today’s date, **last sale (time + “x min ago”)** and **bills today**. Same layout on phone.
- **Work cards tidied**: *Recent sales · Highest dues · Low stock · Expiring soon* are now equal-height cards in a clean 2×2 grid (1 column on phone) with icon, count, *View all* link, avatar rows and status chips (e.g. “Expired 2d ago”, “6 days”).
- **Total users counts only real users**: a device must be signed in, and bots / headless browsers / landing-page visitors are ignored. One device is still one user.
- **Active now** (live) sits under *Total users* in the sidebar and menu.
- **Users page** — tap *Total users*: total, active now, new today / 7 days, countries, then every country with its cities (expand a country), live users per city. Only country + city are stored (no names, e-mails or shop data) — see Privacy Policy.
- **Design refinement** across the app (`css/polish.css`): sidebar with accent marker, softer cards, clearer focus rings, cleaner table headers.
- **Screenshots replaced** (phone + desktop, demo shop with fake data): `assets/screenshots/*.png`, new `desktop-*.png`, README slideshow, landing page and feature pages.
- New files: `js/services/users.js`, `css/polish.css`. `CACHE_VERSION` v12.1.0 in `sw.js` and `pwa.js`.
- To switch on country / city details and exact live users, see **Live user counter** in the README.
- Note: the existing public-counter total still contains devices counted by older versions (which counted every visitor). Use `userCountOffset` in `js/core/config.js` (e.g. `-300`) to remove the extra number.

## v12.0.4 — Desktop app feel, work-focused dashboard, Reports lock reminders
- **Desktop looks like a native app**: fixed sidebar + main content as a window layout, tighter title bar, denser dashboard so empty space above the turnover card is gone.
- **Greeting header redesigned** (phone + desktop): card-style strip with greeting, shop name, date, last sale time and today’s bill count — no more sparse “Good afternoon · date” line.
- **Dashboard is for selling & work**: Est. Net Profit / Gross Profit / Net profit removed from the main dashboard. Hero metrics are Today’s Bills · Expenses · Inventory. Second row is Sales Turnover · Avg. Ticket · Customer Dues · Stock Value. “This month” shows Sales / Bills / Expenses plus a clear **Profit & P/L → Reports** link. Full profit & loss stays only in **Reports**.
- **Reports lock reminder**: if neither home PIN nor Admin PIN is set, opening Reports shows a persistent warning card and repeated toasts asking the user to lock the software so staff cannot see profit.
- Mobile layout kept and refined (greeting card + same work-focused metrics) so it still feels like an installed app.
- Screenshots in README / assets should be refreshed from this build (dashboard no longer shows profit boxes).
- `CACHE_VERSION` bump recommended in `sw.js` and `pwa.js`.

## v12.0.3 — Website-style home page, much slimmer dashboard boxes
- **Home page before sign-in is now a full website-style landing page**: sticky top bar (Features · How it works · Community · FAQ, Telegram button, Sign in), hero with *Continue with Google* and *Join on Telegram*, live app preview, Total users counter, feature cards, three-step guide, a Telegram community band, FAQ, closing call-to-action and footer. Telegram (https://t.me/old_pos) appears in the top bar, hero, community band, closing section and footer. Works on phone and desktop, light and dark.
- **Dashboard**: the Today's Turnover card and the four boxes (Sales Turnover, Gross Profit, Customer Dues, Stock Value) are now far slimmer on phone, tablet and desktop (icon on the left, text stacked on the right). Quick Actions are tighter too.
- Sales Turnover and Gross Profit boxes show *this month* as the main value (today's number was shown twice before). Gross Profit still hides behind the Admin PIN lock.
- Fixes: Telegram icon path, blue strip beside the sign-in page scrollbar, missing icon, Telegram card load order.
- Login and dashboard screenshots replaced (the old ones showed the previous EsyPOS design and a real shop's data).
- `CACHE_VERSION` v12.0.3 in `sw.js` and `pwa.js`.

## v12.0.0 — App-style redesign, one device = one user, stay signed in
- **New phone design** (same brand colours, light + dark): app-style header with shop name, big *Today's turnover* card with **New Sale**, four icon cards (Sales Turnover · Gross Profit · Customer Dues · Stock Value), **Quick Actions** (POS Sale · + Product · Purchase · + Expense), *Sales Trend (Last 7 Days)*, and a bottom bar **Home · Products · New sale · Reports · More**.
- **Calmer desktop**: refined sidebar, glass title bar, wide turnover card, 4-column cards and quick actions.
- **Total users now counts devices, not logins.** The id comes from the device itself, so Log out / Log in, clearing site data or re-installing on the same device is never counted again. Installs counted by older versions are not counted twice. Optional `userCountOffset` in `js/core/config.js` removes the old inflated numbers.
- **Stay signed in until you press Log out.** The sign-in marker is mirrored (cookie + IndexedDB) and storage is requested as persistent; if the browser drops local storage the session and cloud data come back automatically.
- **Backup**: automatic rolling **local safety copies** (last 10, restorable offline, Settings → Security → *This device & local copies*), on top of verified Google Drive backups, daily Drive snapshots and shrink protection.
- **Security**: easy PINs (0000, 1234, 1111…) are refused for both the home PIN and the Admin PIN. Existing protections stay: PBKDF2 PIN hashing, escalating lock-outs, strict Content-Security-Policy, anti-clickjacking.
- Telegram link now points to https://t.me/old_pos.
- New files: `css/modern.css`, `js/services/safety.js` (cached by the service worker; `CACHE_VERSION` v12.0.0).

## v11.9.1 — Dashboard first
- The app now **opens on a redesigned Dashboard**: greeting + shop name, big *Today's sales* with a comparison to yesterday, Profit / Bills / Expenses, quick actions, monthly overview and a 7-day chart. Profit stays hidden behind the Admin PIN lock if you enabled it.
- **Sales Counter removed from the menu.** Start a sale from **New sale** (Dashboard, desktop title bar, or the centre button of the phone bottom bar). Alt+2 and F2 still open it.
- **One way to do everything**: Cloud Backup is opened from the account card only, Sign out lives inside the Cloud panel, the desktop title bar no longer repeats the theme / lock / user-count / sync buttons that the sidebar already has, and unused code was removed.
- The camera **Scan** button is now visible on phones inside the Sales Counter (the old centre scan button became *New sale*).

## v11.4.1 — Sign-in page redesign, menu order
- **Sign-in page** redesigned for phone and laptop: removed the large empty gaps, compact feature chips, tidy About section, consistent spacing.
- **Telegram** invite now appears only in the menu and on the sign-in page (dashboard banner and pop-up removed) with the official round Telegram logo.
- **Menu**: Dashboard is now listed above Sales Counter.

## v11.4.0 — App-like design + Telegram community
- **Phone**: installed-app feel — no pull-to-refresh bounce, press feedback on every button, no accidental text selection on buttons, 16px inputs (no iOS zoom), 44px touch targets, safe-area aware spacing above the bottom bar.
- **Desktop**: desktop-app feel — a window-style title bar (page name, shop, total users, cloud status, theme, lock), thin scrollbars, tidier sidebar, and shortcuts: **Alt+1…5** (Sales / Dashboard / Products / Customers / Reports) and **Ctrl+L** (lock).
- **Telegram channel invite** ([t.me/esypos](https://t.me/esypos)) shown in five places: sign-in page, desktop sidebar, mobile menu, Dashboard banner, and a one-time welcome pop-up (repeats at most every 7 days until the user taps Join).
- New files: `css/appshell.css`, `js/services/appshell.js`, `js/services/community.js` (added to the service-worker shell; `CACHE_VERSION` bumped in `sw.js` and `pwa.js`).

## v11.3.0 — Easier for every business, safer data, bug fixes
**Easier to use**
- **Dashboard quick actions**: New sale, Add product, Add expense, Stock in and Collect due are one tap away. A short **Get started** guide helps a new shop (shop name → first product → first sale → PIN) and can be hidden.
- **More business types** in Settings → Shop info: Hardware / Building materials, Bakery / Sweets, Cosmetics / Beauty, **Service / Salon / Repair** and Other. Each adds matching product fields; service items start with stock tracking off, so a haircut or repair never shows "out of stock".
- **A4 invoice** (Receipt → *A4 invoice*) for wholesale and business customers, and **Print account statement** on every customer — full page with running balance.
- Forms no longer close when you tap outside them, so a half-filled product, expense or return is never lost by accident (press Cancel or ✕ to close).
- Number boxes select their old value when tapped, so typing replaces it; phones show the decimal keypad. **Enter** completes the sale in the checkout box.
- CSV import understands Bengali digits, thousands commas (1,200), currency signs and dates like 31/12/2026.

**Bugs fixed**
- **Admin PIN bypass**: opening a locked page through an app shortcut (`?go=expenses`, `?go=history` …) skipped the Admin PIN when no home-screen PIN was set. The lock is now applied before the first screen opens.
- **Stock with decimals**: a product with 2.5 Kg left could be added to the cart as 3 Kg and then fail at checkout. The cart now stops at exactly what is on the shelf (and adds the remaining 0.5 when less than 1 is left).
- **Invoice prefix**: changing the prefix in Settings used to rename every old receipt. Each bill now keeps the prefix it was created with.
- **CSV re-import** no longer wipes the category, unit, low-stock limit or expiry of an existing product when those cells are blank, matches names regardless of capital letters, and records stock changes in the Stock log.
- **Delete all data** now downloads a backup file first (previously the safety copy was never made). **Restore** skips damaged records instead of letting one bad entry break Reports.
- **Admin PIN lock-out** showed the wrong waiting time. **Re-lock after idle** offered 1 and 2 minutes but always used 3 — the choices are now 3 / 5 / 10 / 15 minutes and really apply.
- **WhatsApp**: international numbers (+1…, 0044…) are no longer rewritten with the Bangladesh code.
- Settings → Save no longer resets the tax of a bill in progress. Bluetooth receipts now show returns and the bill note, like the paper receipt.
- Supplier ledger order is stable for same-time entries; supplier-paid totals no longer show floating-point noise; invalid dates show blank instead of "Invalid Date".

**Faster and lighter**
- New purchase: the product list is built once instead of once per row (large catalogues stay smooth).
- Live sync slows down while nothing changes (8 s → 20 s → 45 s) and the user counter refreshes every 30 minutes instead of every minute — less battery and data, and it keeps Google Drive's free quota safe for all users.

## v11.2.0 — Smoother Google connection, layout fixes, App & device panel
- **No more sudden jumps to Google.** The app used to renew its Google access every hour in the background (on open, on returning to the tab, on reconnect and on a timer), and each renewal briefly opened Google's page. Now it renews only when there is something to back up, only after a tap, never during a sale or while a dialog is open, and at most once every 2 minutes. Opening the app with nothing to back up never touches Google. Signing in the first time still shows Google's account chooser (Google requires it).
- Layout: date fields in Expenses and the barcode option pills no longer run past the screen edge on small phones; long names wrap instead of stretching cards.
- Rounding: negative amounts now round the same way as positive ones (a 1.005 refund and a -1.005 adjustment no longer differ by a paisa).
- Settings → **App & device**: offline status, install button, storage protection, storage used, version, Check update, Repair offline files.
- Print: install bar, update bar and navigation are hidden when printing.

## v11.1.0 — Security, PWA and splash
- **Security**
  - Backup *files* no longer contain the Admin PIN hash (only the home-screen PIN hash was removed before), and restoring a file can never set, replace or remove either PIN.
  - Restore validates the file (size and structure) before touching your data.
  - Admin PIN lock-outs now escalate (30 s → 1 m → 5 m → 15 m → 30 m) like the home-screen PIN.
  - Idle auto-lock: the PIN screen comes back after inactivity (minimum 3 minutes; a sale in progress gets double time) and when the page returns from the browser's back/forward cache.
  - Clickjacking protection (frame-busting + `frame-ancestors 'none'` sent by the service worker), `nosniff`, strict referrer policy, Permissions-Policy (camera and Bluetooth only), plain-text-only paste/drop into inputs, `javascript:`/`data:` links blocked, self-XSS console warning.
- **PWA**
  - Atomic install (a broken release can never replace a working one), self-repair of missing offline files, offline fallback page, `updateViaCache: none` for instant update detection.
  - Install button remembers "not now" for 7 days, iPhone/iPad "Add to Home Screen" guide, "Back online" toast, persistent-storage request retried after engagement.
  - Manifest: launch handler (re-opens the running window), link handling, extra shortcuts (Sales history, Expenses), splash colour matched to the app.
  - `window.PWA` helper (install, update check, repair, reset cache, storage estimate) for support.
- **Splash screen**: animated logo ring, glow, progress bar and status text while the app starts; full animation on first open, quick on reload, respects "reduce motion", never blocks for more than 8 seconds.

## v11.0.0 — UI/UX overhaul
- **Sales Counter toolbar redesigned**: search box, Scan, Held bills, Quick sell and scanner status now share one height and radius and line up on phone, tablet and desktop. Labels appear automatically when there is room (container queries); otherwise clean icon buttons with a count badge. Search has a clear (×) button, Esc clears it.
- **Desktop shortcuts**: F2 Quick sell · F3 focus search · F9 checkout.
- One control size everywhere: buttons, inputs, selects, dates, icon buttons, chips and quantity steppers use the same height/radius, so side-by-side boxes always match.
- Product tiles: stock shown as a tidy pill (red when low); cart panel: scrollable item list with sticky Checkout on desktop; duplicate Quick sell removed from the desktop cart.
- "Install app" button no longer covers the cart bar on phones.
- Motion: page transitions, softer tile entrance, bottom-sheet slide on phones / pop-in on desktop, total tick animation, hover lift on cards (all switched off for "reduce motion").

## v10.21.0 — Design switch, more responsive, Quick sell everywhere
- **Settings → Appearance & sound → Design**: choose **Modern** (current flat look) or **Classic** (the original v10.7 look). Saved on the device and applied instantly on every screen.
- Extra responsive polish for small phones (≤330px), tablets, landscape phones and very wide screens: stat cards, product grid, checkout buttons, dialog footers and long names no longer overflow.
- **Quick sell** is also inside the cart panel (phone and desktop), so it is always one tap away.

## v10.20.0 — Quick sell
- **Quick sell** button on the Sales Counter: sell an item that is not in Products. Enter name (optional), price, qty and an optional cost. Stock is not changed.
- If the cost is left empty the bill is marked **Cost pending**. Open the bill in **Sales History** → **Add cost (quick-sell items)** to enter the real cost later (asks the Admin PIN if one is set). Profit in Reports and Dashboard updates automatically, and returns on that bill stay consistent.
- Sales History has a new **Cost pending** filter; Reports show a notice while any quick-sell cost is missing.

## v10.19.0 — Settings in sections
- **Settings** is now a short list: Shop info, Billing & receipt, Barcode, Appearance & sound, Security, Printers, Backup & data, About & legal. Tap one to open it. On phones the list opens a section with a back arrow (the phone Back button works too); on desktop the list stays on the left and the section opens on the right, with no empty gaps. All settings are still there.

## v10.19.0 — Two separate security systems
- **1. Home screen lock**: switch on/off in Settings → Security; its own PIN, asked when the app opens and after idle.
- **2. Admin lock**: a separate Admin PIN that hides sections and dashboard profit from staff. Choose exactly what to lock.
- Existing installs: the old PIN is copied to the Admin PIN once, so current locks keep working; change it anytime.

## v10.18.0 — Lock selection restored, profit lock, polish
- **Settings → Security** now shows the *Section lock* list again: tick exactly which sections need the owner PIN.
- **Dashboard profit lock**: Today's profit and This month's net profit show a lock chip; tap it, enter the PIN, and they reveal until the re-lock time.
- Touch targets, focus rings, small-phone and wide-screen spacing, reduced-motion support.

## v10.17.0 — Cleaner menu, simpler discount, tidier design
- **Menu order:** Sales Counter, Dashboard, Sales History, Products & Stock, Customers & Due, Purchases & Suppliers, Expenses, Reports, Barcode Labels, Settings (last). The phone bottom bar is now Sales, Dashboard, Scan, Products, Menu.
- **Discount:** the amount (৳) is the default. A small ৳ | % switch inside the field changes it to percent without losing the number. Tax is hidden until needed (*Add tax*), unless a default tax is set in Settings.
- **Design:** one calm look across screens. Fixed the shadow bleeding at the screen edge from closed side panels, a stray circle in the cart, the phone menu footer that wrapped, a duplicate camera button on phones, a crowded top bar (menu and theme now live in the bottom bar and menu), and a clipped search hint. Settings switches are real toggles. Barcode option chips stay on one line. Delete icons are quiet until hovered.

## v10.16.0 — Stock control, bill delete, cash drawer, bug fixes
- **Stock adjustments** (Products → *Adjust stock* / *Stock log*): record damaged, expired, lost or own-use stock and count corrections. Loss reasons are written off at cost and reduce net profit in Reports; every change (also a hand-edited stock number) is kept in a log.
- **Delete bill** (Receipt): puts the items back in stock and removes the bill's due. Needs the owner PIN when a PIN is set, is refused when the bill has returns, and is written to the Security log.
- **Cash drawer (estimate)** in Reports: cash sales + due collected − cash refunds − cash supplier payments − expenses. Also in CSV and print.
- **Edit expenses** (tap a row). **VAT / BIN / Tax ID** field (Settings) printed on receipts, WhatsApp text and Bluetooth prints.
- **Optional backup file** (Settings → Data management): *Save backup file* and *Restore from file*. Nothing downloads automatically; the file has no PIN hash, and a restore keeps this device's PIN.
- **Fixes:** discount selector and purchase form used a hard-coded currency sign instead of the Settings currency; five icons missing from the font subset showed blank (Security log, Backup health, Unlock, Preview, USB printer); unreachable code removed from cloud sync; Dashboard 7-day chart now reads the data once instead of building seven full reports.
- Sync: stock adjustments sync between devices like other records; older app versions still accept the new backups.

## v10.15.0 — Drive-first backup, cleaner wording
- Backup never downloads a file; everything goes straight to Google Drive about a second after each change. "Replace with latest backup" first sends any unsent changes, then loads the newest backup.
- Branding: Old POS everywhere. Shorter, cleaner on-screen text.

## v10.14.5 — Section lock, security, calmer UI
- **Section lock** (Settings → *Section lock*): pick which sections (Reports, Dashboard, Purchases, Expenses, Settings…) need the owner PIN. Salesmen can sell but cannot open locked sections. Locks re-engage after 1–15 minutes or when the app goes to the background.
- **Security:** PIN is stored as PBKDF2-SHA256 (old PINs upgrade automatically); wrong-PIN lock-out grows 30 s → 1 → 5 → 15 → 30 min; configurable idle auto-lock; Content-Security-Policy added.
- **Cloud backup:** every backup carries a checksum, is read back from Drive and verified; a restore of a damaged file is refused; automatic backups never replace a much larger cloud copy with an almost empty one.
- **UI:** fewer and shorter animations, larger touch targets, no iOS input zoom, better 320 px / landscape / tablet layouts.
- **Two devices, one Google Drive:** backups are now merged, never overwritten. Sales, payments, purchases and expenses from every device are combined; stock = the other device's stock + what this device sold since the last sync; edits and deletions are kept. No "cloud or device data?" question any more. New changes upload 1.5 s after a sale, other devices pick them up within 5 s.
- **Security log** (last 40 unlocks / wrong PINs / lock-outs) and **Backup health** card (verified status, last backup, one-tap local copy download) in Settings.
- **User counter:** set `userCounterUrl` in `js/core/config.js` to your Firebase Realtime Database URL. Each install registers one random anonymous ID; the total shows in the sidebar/menu. Database rules:
```json
{"rules":{"users":{".read":true,"$uid":{".write":"$uid.matches(/^[a-f0-9]{40}$/) && !data.exists()","t":{".validate":"newData.isNumber()"},"$other":{".validate":false}}}}}
```

## v10.13.0 — Accessibility labels, metadata refresh
- Icon-only delete/remove buttons now have accessible labels; images have empty alt text where decorative.
- Backup: single visible file `EsyPOS-Backup.json` in Google Drive, automatic retry, clearer errors.
- Blue professional palette, home page removed (app opens on the Sales Counter).

## v10.12.0 — UI/UX polish
- Cart bar, toast and install/update bars now sit clear of the bottom navigation (no more overlap with the Scan button); the cart icon keeps a fixed round shape.
- Home: one consistent outline icon set, tiles aligned on one icon line (labels may wrap to 2 lines without shifting icons), equal-size popular-product cards with the whole picture visible.
- Sales counter: product pictures are no longer cropped, names clamp to 2 lines, price and stock never collide, stock/low-stock tags stay inside the card.
- Layout tuned for small phones (320px), phones in landscape, tablets and desktop; bottom nav stays centred and compact on tablets.

## v10.9.0 — New Home screen
- **Home** (`js/modules/home.js`): greeting, Today's Sales card, 8 quick actions, auto-playing **banner slider** (swipe or tap the dots; edit `Home.SLIDES` to change slides), Popular Products, alert bell, and a mobile **bottom navigation** with a centre Scan button. The app now opens on Home.
- **Google Drive stays connected**: the connection remains on until you Sign out. When Google's short-lived access token expires, the first tap after that renews it silently (browsers only allow this inside a tap), so the "Reconnect" step is no longer needed in normal use.

## v10.8.0 — Barcode scanning upgrade
- **USB / Bluetooth scanners** (`js/core/wedge.js`): works on POS, product form, product list search, Barcode Labels and Purchase; reads the physical key so any keyboard language (e.g. Bangla) is fine. Safe matching: `]C1` prefix, leading zeros, never guesses when two products share a barcode.
- **Camera scanner**: native `BarcodeDetector` where available, otherwise an offline built-in reader (`js/core/linear.js`: EAN-13/UPC-A, Code 128) for iPhone, Firefox and desktop. Torch, zoom, *Type code*, *Keep scanning*. (QR needs Chrome.)
- Unknown barcode → **Add product** bar opens a new-product form with the code filled in. Duplicate warning while typing/scanning a barcode.
- **Purchase**: scan, camera or name search to add stock-in rows.
- CSV import: an empty barcode cell no longer erases the saved barcode; Excel-damaged codes (`8.9E+12`) are skipped with a warning.
