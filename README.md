# H&L Seafood Catalog

A small full-stack app: a public product catalog (search, filter, build a quote) plus a
password-protected `/admin` panel for editing prices and items. Replaces the old
single-file `seafood-price-list.html`, which had no real persistence and no login.

## What changed from the old file

- Data now lives in a SQLite database (`data/catalog.sqlite`), not baked into the HTML.
- Editing requires an admin password instead of anyone being able to click "Edit catalog."
- Several data-entry errors inherited from the original spreadsheet were fixed on import:
  - `POLLOCK FILLET SKINLESS 2/4` was priced at **$260.00/lb** — corrected to **$2.60/lb**
    (a decimal-shift typo; verify against the current market price).
  - Five items (`FRESH WATER SHRIMP 'HOSO' 1/2, 2/4, 4/6`, `Tiger Shrimp 8/12 Hlso`,
    `SHRIMP 8/12 WH P&D CKD T-ON CENSEA`) had a date where their packaging field
    ("CASE") should have been — reset to `CS`.
  - `CRAWFISH MEAT 150UP (16X12OZ)` and `WHELK 20/30 PCS IN SHELL COOKED` had values
    shifted into the wrong columns in the source sheet — unit/case fixed, the
    now-unrecoverable quantity was cleared rather than guessed.
  - `WHELK MEAT 15/25 GRAM COOKED` had "38.0" where its unit should read "LB" — fixed.
  - `PROCESSED SCALLOP REQUEST` had a stray date in its pack-size field — cleared.
  - A duplicate `LOBSTER TAIL MEAT` line (identical name/pack/price to another row)
    was removed.
  - All of these are worth a quick manual sanity check against your current supplier
    pricing in the admin panel.

## Running it locally

```bash
npm install
cp .env.example .env
```

Edit `.env` and set `ADMIN_PASSWORD` to something only you know, then:

```bash
npm start
```

- Public catalog: http://localhost:3000
- Admin panel: http://localhost:3000/admin

The database is created automatically on first run and seeded from `data/seed.json`
(the cleaned-up price list). After that, `data/seed.json` is only a fallback — all
edits live in `data/catalog.sqlite`.

## Deploying

This is a plain Node.js app with a local SQLite file, so it needs a host with a
persistent disk (not a serverless/edge platform like Vercel or Netlify functions,
which reset their filesystem on every request). Good fits: **Render**, **Railway**,
**Fly.io**, or any VPS.

General steps (Render/Railway are similar):

1. This repo is already on GitHub — connect it from the host's dashboard.
2. Create a new "Web Service" from the repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables in the host's dashboard:
   - `ADMIN_PASSWORD` — your admin password
   - `SESSION_SECRET` — any long random string (so admin logins survive restarts/redeploys)
   - `NODE_ENV=production`
6. Attach a **persistent disk/volume** mounted at `data/` so it survives redeploys
   (otherwise your edits are lost every time you redeploy). On Render this is a
   "Disk" mounted at, e.g., `/opt/render/project/src/data`; on Railway it's a
   "Volume."

Once deployed, share the site URL with customers and keep `/admin` (with your
password) for yourself.

## Project layout

```
server/
  index.js       express app entry
  db.js           sqlite schema + one-time seeding
  auth.js         password check + signed session cookie
  routes/
    catalog.js    GET /api/catalog (public)
    admin.js      /api/admin/* (login, items CRUD, business info)
public/
  index.html      customer-facing catalog
  admin.html       admin login + dashboard
  assets/
    style.css
    catalog.js     customer page logic (fetches /api/catalog)
    admin.js        admin page logic (fetches/writes /api/admin/*)
data/
  seed.json         cleaned starting data (only used on first run)
  catalog.sqlite     created automatically — the live database (gitignored)
legacy/
  Price List- Three Brothers Seafood .xlsx   original spreadsheet, kept for reference
  seafood-price-list.html                     original static single-file version
```

## Security notes

- Admin auth is a single shared password (`ADMIN_PASSWORD`) plus a signed,
  httpOnly session cookie — appropriate for a single small-business owner, not
  built for multiple separate admin accounts.
- Login attempts are rate-limited (10 per 15 minutes) to slow down guessing.
- Set `NODE_ENV=production` in deployment so session cookies require HTTPS.
