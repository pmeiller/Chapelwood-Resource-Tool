# Chapelwood UMC Resource Finder — Project Guide

## What This Is

A web app that helps Chapelwood UMC staff and volunteers find community resources for underprivileged people in the Houston area. Maintained by church staff; used by volunteers who may have limited computer skills.

**Live URL:** https://pmeiller.github.io/Chapelwood-Resource-Tool/  
**Dev URL:** https://pmeiller.github.io/Chapelwood-Resource-Tool-Dev/

---

## Users

| Type | Who | Skills |
|---|---|---|
| **End-users** | Church volunteers and staff helping clients find resources | Low — keep UI simple, forgiving, mobile-friendly |
| **Admin-users** | Staff tasked with keeping the resource database current and verified | Moderate — can follow a workflow, not developers |
| **God-user** | pmeiller (repo owner) | Full access to everything |

---

## Architecture

**Single source of truth:** `resources.json` — all resource data lives here on GitHub.

```
resources.json          ← the data (GitHub)
      ↑ publish              ↓ fetch on load
admin-tool.html   index.html
(password-protected      (public viewer,
 editor)                 GitHub Pages)
      ↑ pull / publish
Google Sheet + Code.gs
(spreadsheet editor)
```

The Google Sheet is an **editor**, not the source of truth. It pulls from `resources.json` on open and publishes back to it. The sheet no longer exposes a CSV feed.

---

## Repos

| Repo | Purpose | Remote alias |
|---|---|---|
| `pmeiller/Chapelwood-Resource-Tool` | Production | `origin` |
| `pmeiller/Chapelwood-Resource-Tool-Dev` | Dev/staging | `dev` |

Both remotes are configured in `~/Chapelwood-Resource-Tool/.git/config`. All work happens in the local `~/Chapelwood-Resource-Tool/` directory.

- Push to dev for testing: `git push dev main`
- Push to production: `git push` (or `git push origin main`)

---

## Files

| File | Purpose |
|---|---|
| `resources.json` | All resource data — 20-column JSON array |
| `index.html` | Public viewer — category tiles, keyword search, emergency mode, translation, PDF |
| `admin-tool.html` | Admin editor — add/edit/delete resources, column filters, publish to GitHub |
| `manifest.json` | PWA manifest — app identity, icons, display mode |
| `sw.js` | Service worker — offline caching (cache-first shell, network-first data) |
| `icons/icon-192.png` | PWA icon 192×192 — home screen, splash screen |
| `icons/icon-512.png` | PWA icon 512×512 — splash screen, high-res |
| `Code.gs` | Google Apps Script — powers the Sheet's pull/publish workflow |
| `CLAUDE.md` | This file |

---

## Versioning

`const VERSION` lives in `index.html`.

| Situation | Format | Example |
|---|---|---|
| Dev commits | `X.XX-devNN` | `0.24-dev05` |
| Production push | `X.XX` (bump by 0.01) | `0.25` |

**Rules:**
- Every dev commit increments the `NN` counter (`dev01`, `dev02`, …)
- When promoting to production, drop the `-devNN` suffix and bump the major version by 0.01
- Include the version bump in the same commit as the change — no separate version commits
- The version number in the footer opens the changelog modal when clicked

---

## Deployment

- **Hosting:** GitHub Pages (auto-deploys ~30s after push to `main`)
- **No build step** — plain HTML/JS, no npm, no bundler

### Pushing changes
```bash
cd ~/Chapelwood-Resource-Tool

# Dev (test first):
git add index.html          # or other changed files
git commit -m "v0.24-dev06 — description"
git push dev main

# Production (after dev testing passes):
# Bump VERSION from '0.24-devNN' to '0.25', update changelog
git commit -m "v0.25 — description"
git push
```

---

## Admin Tool (`admin-tool.html`)

**URL:** https://pmeiller.github.io/Chapelwood-Resource-Tool/admin-tool.html  
**Password:** `Amber`

Features:
- Browse, add, edit, and delete resources
- **📋 Duplicate button** on each row — opens Add modal pre-filled with copy's data; name prefixed with "Copy of"
- **Column filter dropdowns** in the table header for: Organization, Hot List, Type, SubType, Access, Verified status
- **✕ Clear Filters** button appears in the Actions column header when any filter is active
- **Verified column** shows formatted date (e.g. "May 6, 2026") color-coded green/yellow/red by age (<6mo / 6–12mo / >12mo)
- **Resource Type and SubType** are dropdown selects populated from existing data; each has a **＋ Add item** button to insert a new option
- **Public Access** is a fixed dropdown with a **＋ Add item** button for new access types
- **☁ Publish** — pushes all changes to `resources.json` on GitHub via the Contents API (requires PAT in `localStorage` as `cwGithubToken`)
- Dirty state tracked in `sessionStorage` (`cwDirty`) — red banner appears when there are unpublished changes; browser close warns if unsaved
- **Dev/prod auto-detection** — admin tool reads `window.location.pathname` to determine which GitHub repo to publish to; no hardcoded URLs

The Publish button uses the GitHub Contents API (`PUT /repos/.../contents/resources.json`). PAT needs **Contents: Read and write** scope (fine-grained) or **repo** scope (classic).

---

## Public Viewer (`index.html`)

### Category Browsing (Accordion)
- Categories are derived directly from `r['Resource Type']` — no keyword matching
- Displayed as **stacked accordion rectangles** (single column), each with emoji, name, resource count, and ▸ chevron
- Each tile has a **4px colored left border** in its category color
- **`TYPE_STYLES`** map: keyed on exact Resource Type strings, provides emoji + color; `DEFAULT_TYPE_STYLE` fallback for unknown types
- Clicking a category header **expands it in-place** (accordion); multiple categories can be open simultaneously
- Expanded panel shows:
  - **All [Type] (N)** button — shows all resources in that category
  - One button per unique **Resource SubType** with count
  - Inline translation for category label, "All" button, and each sub-type when a language is active
- `openCategories` Set tracks which types are expanded; rebuilt on each `buildCategoryTiles()` call
- Each card has a colored left border in the category color
- Each card has: name, org, access badge, description, eligibility, hours, walk-ins, languages, website/phone/map/PDF buttons

### Card Layout (detail rows)
Fields render in this order, each as a bold-label / value row:
1. 📍 Address
2. 🌐 Languages
3. **Apply:** (its own row — not inline with address/languages)
4. **Hours:** (bold label, consistent with Walk-ins)
5. **Walk-ins:**
6. ℹ️ Note: (Other Info)
7. Also listed as: (Duplicate note, italic/muted)

### Search
- Searches across: Resource Name, Description, Organization, Eligibility, Type, SubType, Address, Languages

### Emergency Mode
- Orange banner between search bar and category grid; text: *"Click here for emergency resources (life-sustaining in next 24 hours)"*
- Banner text shows inline translation when a language is active
- Yes/No toggle on the right
- **When Yes:**
  - Page background turns light orange
  - Category accordion updates counts to show only hot-list resources
  - Categories with zero hot-list resources are grayed out and non-clickable
  - Sub-type buttons with zero hot-list resources are hidden
  - Clicking "All [Type]" or a sub-type shows only hot-list resources in that scope
- Emergency mode does not persist across page loads

### Secondary Language Support (Translation)
- Language selector in the header (left of 211 Website button)
- Supported: **Español** (`es`), **한국어** (`ko`)
- Preference saved to `localStorage` (`cwLanguage`) and restored on load
- When a language is active, opening a category triggers translation for all cards in that view
- Translated fields (appear below their English counterparts with an amber left border, italic):
  - `Resource Name`, `Resource Description`, `Eligibility`, `Hours`, `Walk-ins?`, `Other Info`
- Non-translated fields: everything else (names, addresses, contact info, etc.)
- Translation uses **MyMemory API** (free, registered tier): `https://api.mymemory.translated.net/get?q={text}&langpair=en|{langCode}&de=pmeiller@chapelwood.org`
- **Rate limit:** ~50,000 words/day (registered email tier). A yellow warning banner appears at the top if the cap is hit. Silent English fallback for individual field failures.
- **Cache:** `translationCache[langCode][resourceIndex][fieldKey]` — session-scoped in-memory object; cleared when language changes; lost on page refresh (intentional)
- **Language chip** (`ES` / `KO`) shown on each card when translation is active

#### Translation block styling
- `margin-top: 3px` — translation hugs the English source text above it
- `margin-bottom: 10px` — breathing room before the next field
- `border-left: 3px solid #f59e0b` — amber left rule
- `font-style: italic`, `color: #4b3f2f`
- The eligibility translation appears **inside** the yellow eligibility box

### PDF Generation
- Triggered by the **📄 Generate PDF** button on each resource card
- Uses jsPDF 2.5.1 + qrcode-generator 1.4.4 (loaded on demand from cdnjs)
- PDF includes:
  - Category-colored header bar
  - Resource name, org, type/access
  - Description (no label — flows naturally after the header)
  - Eligibility in a yellow box (label + content, tightly padded)
  - Address, Hours, Walk-ins, Languages, How to Apply, Notes, Phone, Website (two-column table rows)
  - **QR code** and **Location map** centered as a balanced pair (~50mm each, 12mm gap), with captions
- **Map:** geocoded via Nominatim, rendered from OSM tiles; only shown if a physical address is present
- **Bilingual PDF:** when a language is active, translated text appears below each English field with an amber left rule (italic, warm dark color). Eligibility translation appears inside the yellow box.
- If a translation hasn't been fetched yet (card never opened), it's fetched at PDF generation time.

---

## Google Sheet

**Spreadsheet ID:** `1d7gDUulw6TvgbM4XozKZEdAKexXLws0Xv88CVwPDBgQ`

Workflow:
1. Open the sheet → auto-pulls current `resources.json` (warns first if there are unpublished edits)
2. Edit cells directly in the sheet
3. **📋 Resources → Publish to GitHub** pushes changes back to `resources.json`
4. If you close with unpublished edits, the header row stays **red** and you'll be warned on the next open

First-time setup on a new machine: **📋 Resources → 🔑 Set GitHub Token** (same PAT as the admin tool).

The Apps Script does **not** need to be deployed as a web app — it runs as a bound script inside the sheet.

---

## Data Structure

`resources.json` is a flat JSON array. Each record has these 20 fields:

```
Resource Name, Organization Name, Program Name (If Applicable),
Resource Type, Resource SubType, Hot List?, Public Access?,
Resource Description, Eligibility, Address, Public Phone Number,
Public Email, Public Website, Hours, Walk-ins?, Languages,
Application, Other Info, Duplicate?, Verified
```

**Resource Type** drives category assignment in the viewer: food, financial, housing, employment, mental health, medical, immigration, classes, childcare, disaster, services, transportation.

**Hot List?** — flag for emergency/high-priority resources. Used by emergency mode in the viewer and the Hot filter in the admin tool.

**Public Access?** values: `Public Access` / `Restricted - Outside (...)` / `Restricted - Serving Ministry`

**Verified** — stored as a full JS date string (e.g. `"Wed Apr 01 2026 00:00:00 GMT-0500 (Central Daylight Time)"`). Parse with `new Date(verified)` — do NOT use split-on-T ISO logic.

---

## Local Working Copies

Mirror copies kept in `~/Claude/` after every push:
- `~/Claude/index.html`
- `~/Claude/admin-tool.html`

---

## PWA (Progressive Web App)

The app installs as a PWA on Android and iOS via "Add to Home Screen."

**Files:** `manifest.json`, `sw.js`, `icons/icon-192.png`, `icons/icon-512.png`

**Caching strategy:**
- Shell files (`index.html`, `admin-tool.html`, `manifest.json`, icons) → **cache-first**
- `resources.json` → **network-first**, falls back to cache when offline
- External resources (fonts, CDN libs, APIs, map tiles) → **network only** (fail gracefully as they already do)

**Update notification:** When a new SW version is detected (`updatefound` event), an `#swUpdateBanner` div is shown above the search bar with a Refresh button.

**Dev vs. production paths:** `manifest.json` and `sw.js` use hardcoded path prefixes. When promoting to production:
1. Update `start_url` and `scope` in `manifest.json` to `/Chapelwood-Resource-Tool/`
2. Update all paths in `SHELL_FILES` and `DATA_FILES` in `sw.js` to `/Chapelwood-Resource-Tool/`
3. Bump `CACHE_NAME` in `sw.js` (e.g. `cw-resources-v2` → `cw-resources-v3`) to force cache refresh
4. Revert to `/Chapelwood-Resource-Tool-Dev/` in both files after pushing, for continued dev work

**What works offline:** Category browsing, search, emergency mode, admin shell (password screen). PDF without map, since jsPDF loads from cdnjs.

**What requires network:** Translation (MyMemory API), map tiles (OSM/Nominatim), QR code lib (cdnjs), Admin publish (GitHub API).

---

## Key Technical Notes

- **No external backend** — everything is static files + GitHub API
- **Offline cache** — `resources.json` cached in `localStorage` (`cwResources`); both HTML files fall back to this if GitHub is slow
- **GitHub PAT** — stored in `localStorage` (`cwGithubToken`) in the browser; never committed to the repo
- **Dirty state** — admin tool tracks unsaved changes in `sessionStorage` (`cwDirty`); persists through same-tab reloads, resets on fresh session
- **Translation cache** — session-scoped JS object `translationCache[langCode][ridx][field]`; not persisted to localStorage
- **Tile label cache** — `tileLabelCache[langCode][typeName]` for category accordion headers; `__emg__` key for emergency banner
- **Subtype label cache** — `subtypeLabelCache[langCode][subtypeOrPhrase]` for sub-type buttons and "All [Type]" buttons
- **MyMemory API** — registered-email tier (~50k words/day); `&de=pmeiller@chapelwood.org` param in every request; yellow cap warning banner on 429; silent English fallback on individual errors
- **Map tiles** — OSM tiles at `https://tile.openstreetmap.org/{z}/{x}/{y}.png` have `Access-Control-Allow-Origin: *`; used for in-browser canvas map generation for PDFs. Geocoding via Nominatim (no API key required).
- **PDF libraries** — jsPDF 2.5.1 + qrcode-generator 1.4.4, loaded on demand from cdnjs
- **QR codes** — qrcode-generator GIF → canvas → PNG pipeline (the npm `qrcode` package fails in browsers)
- **Emergency mode** — `body.emergency-mode` CSS class; `isHot(r)` helper checks `Hot List?` field; does not persist across page loads
- **Sticky headers** — admin tool table uses `.table-wrap { overflow: auto }` as the scroll container so `thead th { top: 0 }` always sticks to the table, not the viewport
- **buildCard()** — shared card builder used by both the results view and (formerly) hot-list view; `resourceIdx` must be declared before the `tslot` closure to avoid temporal dead zone errors
- **Category tile color borders** — set inline via `tile.style.borderLeftColor = cat.color`; CSS provides `border-left: 4px solid transparent` as the base
- **Card color borders** — set inline via `card.style.borderLeftColor = color`; same pattern as tiles
