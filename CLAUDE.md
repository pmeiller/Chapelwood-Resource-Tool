# Chapelwood UMC Resource Finder — Project Guide

## What This Is

A two-screen web app that helps Chapelwood UMC staff and volunteers find community resources for underprivileged people in the Houston area. Maintained by church staff; used by volunteers who may have limited computer skills.

**Live URL:** https://pmeiller.github.io/Chapelwood-Resource-Tool/

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

The Google Sheet is an **editor**, not the source of truth. It pulls from `resources.json` on open and publishes back to it. The sheet no longer exposes a CSV feed — that's been removed.

---

## Files

| File | Purpose |
|---|---|
| `resources.json` | All resource data — 20-column JSON array |
| `index.html` | Public viewer — category tiles, keyword search, PDF export, QR codes |
| `admin-tool.html` | Admin editor — add/edit/delete resources, publish to GitHub |
| `Code.gs` | Google Apps Script — powers the Sheet's pull/publish workflow |

---

## Deployment

- **Hosting:** GitHub Pages (auto-deploys on push to `main`)
- **Repo:** `pmeiller/Chapelwood-Resource-Tool`
- **No build step** — plain HTML/JS files, no npm, no bundler

### Pushing changes
```bash
cd ~/Chapelwood-Resource-Tool
git add -p          # stage what you want
git commit -m "..."
git push
```

**Version rule:** Before every `git push`, increment `const VERSION` in `index.html` by 0.01. Include the version bump in the same commit.

---

## Admin Tool

**URL:** https://pmeiller.github.io/Chapelwood-Resource-Tool/admin-tool.html  
**Password:** `Amber`

The admin tool lets authorized staff:
- Browse, add, edit, and delete resources
- Click **☁ Publish** to push all changes to `resources.json` on GitHub (requires GitHub PAT stored in browser localStorage as `cwGithubToken`)

The Publish button uses the GitHub Contents API (`PUT /repos/.../contents/resources.json`). If it asks for a token, the PAT needs **Contents: Read and write** scope (fine-grained) or **repo** scope (classic).

---

## Google Sheet

**Spreadsheet ID:** `1d7gDUulw6TvgbM4XozKZEdAKexXLws0Xv88CVwPDBgQ`

Workflow:
1. Open the sheet → auto-pulls current `resources.json` (warns first if there are unpublished edits)
2. Edit cells directly in the sheet
3. **📋 Resources → Publish to GitHub** pushes changes back to `resources.json`
4. If you close with unpublished edits, the header row stays **red** and you'll be warned on the next open

First-time setup on a new machine: **📋 Resources → 🔑 Set GitHub Token** (same PAT as above).

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

**Resource Type** drives category assignment in the viewer (food, financial, housing, employment, mental health, medical, immigration, classes, childcare, disaster, services, transportation).

**Hot List?** — flag for emergency/high-priority resources shown prominently.

**Public Access?** values: `Public Access` / `Restricted - Outside (...)` / `Restricted - Serving Ministry`

---

## Local Working Copies

Mirror copies are kept in `~/Claude/` in sync with the repo after every push:
- `~/Claude/index.html`
- `~/Claude/admin-tool.html`

---

## Key Technical Notes

- **No external backend** — everything is static files + GitHub API
- **Offline cache** — both HTML files cache `resources.json` in `localStorage` (`cwResources`) so the viewer works if GitHub is slow
- **PDF export** — uses jsPDF 2.5.1 + qrcode-generator 1.4.4 (both from cdnjs), loaded on demand
- **QR codes** — generated with `qrcode-generator` (not the npm `qrcode` package, which fails in browsers); uses GIF→canvas→PNG pipeline
- **GitHub PAT** — stored in `localStorage` (`cwGithubToken`) in the browser; never committed to the repo
- **Version** — `const VERSION` in `index.html`; increment by 0.01 on every push; clicking the version number in the footer opens the changelog modal
