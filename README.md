# H&L Seafood Catalog

A plain static site — no server, no build step. Customers search/filter the
price list and build a quote. Prices live in a Google Sheet, so updating them
is just editing a spreadsheet.

**Live data:** [Three Brothers Seafood — Price List (live)](https://docs.google.com/spreadsheets/d/16FrglTqX1rhFjZyDKOXoMxBLbvKKI4Eya6p_phMseQA/edit)

## One-time setup (already done for this sheet)

The site fetches the sheet as CSV with no login, which needs **Publish to the
web**, not just link-sharing (plain "anyone with the link" sharing plus the
`/export` URL looks like it should work but silently fails for anonymous
visitors — Publish to the web is the endpoint actually built for this):

1. In the sheet: **File → Share → Publish to web.**
2. Under "Link", choose the sheet/tab and **CSV** as the format, then **Publish**.
3. Copy the URL it gives you (looks like
   `https://docs.google.com/spreadsheets/d/e/<LONG_ID>/pub?output=csv`) and
   put it in `assets/catalog.js` as `SHEET_CSV_URL`.
4. Note: republishing after big structural changes (e.g. adding a column) can
   sometimes require re-publishing to pick up the new shape — if the site
   stops updating, revisit this step.

If the site ever shows "could not load current prices," this is the first
thing to check — confirm the publish is still active and the URL still matches.

## Editing prices day-to-day

Open the sheet and edit cells directly:

- **Change a price** — edit the `price` column, e.g. `4.25`.
- **Add an item** — add a new row. Give it a unique `id` (anything unused,
  e.g. `i222`), fill in the other columns, pick an existing `category` value
  so it groups correctly (see the list in `assets/catalog.js` under
  `CAT_COLORS` — using a new category name still works, it'll just render
  with a default gray swatch).
- **Remove an item** — delete its row.
- **Reorder categories or styling** — not spreadsheet-controlled; that lives
  in the site code (`assets/catalog.js` / `assets/style.css`).

Changes usually show up on the site within a few seconds to a couple minutes
(Google's CSV export is lightly cached). No redeploy needed.

## Editing business info (name, phone, footer note)

These change rarely, so they're hardcoded at the top of `assets/catalog.js`
in the `BUSINESS` object, not in the sheet. Edit that, commit, and push (or
edit directly on github.com) to change them.

## Order tracking

When a customer clicks **Submit order** in the quote drawer, the order is
appended as a new row to a separate sheet:
[Three Brothers Seafood — Orders](https://docs.google.com/spreadsheets/d/1JEjOll-vI-zzvJ0MB8JgpU52t2DxdNLpHYrX8b3w4qQ/edit)
(columns: timestamp, customer_name, customer_phone, items, total, notes, status).
Open that sheet to see incoming orders, and hand-edit the `status` column
(e.g. `New` → `Fulfilled` → `Paid`) as you work through them.

**This needs a one-time setup step you have to do yourself** (writing to a
sheet requires a small script with your Google authorization — there's no
way to automate the deploy click):

1. Open the Orders sheet (link above) → **Extensions → Apps Script**.
2. Delete any starter code, then paste in the contents of
   [`apps-script/Code.gs`](apps-script/Code.gs) from this repo.
3. Click **Deploy → New deployment**. For "Select type," choose **Web app**.
4. Set **Execute as: Me**, **Who has access: Anyone**. Click **Deploy**.
5. Google will ask you to authorize the script (it's yours, so this is safe)
   — approve it.
6. Copy the **Web app URL** it gives you (ends in `/exec`).
7. Paste that URL into `assets/catalog.js` as `ORDERS_WEBHOOK_URL`, commit, push.

Until `ORDERS_WEBHOOK_URL` is filled in, the "Submit order" button simply
doesn't appear — email/copy-quote keep working regardless.

If you ever change the script's code, you need to create a **new** deployment
(or use "Manage deployments" → edit → new version) for the change to take effect;
just saving the script file does not update a live `/exec` URL.

## Hosting on GitHub Pages

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. On GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: `main` / `(root)`.**
3. GitHub gives you a URL like `https://<username>.github.io/<repo>/`. That's
   the live site — share it with customers.
4. Every `git push` to `main` updates the site automatically within a minute
   or two. Price changes in the Sheet don't need a push at all.

## Project layout

```
index.html            the whole page shell
assets/
  style.css            all styling
  catalog.js           fetches the sheet, renders the catalog, cart/quote logic
                        (also where BUSINESS info, SHEET_CSV_URL and
                        ORDERS_WEBHOOK_URL live)
apps-script/
  Code.gs               paste into the Orders sheet's Apps Script editor
legacy/
  Price List- Three Brothers Seafood .xlsx   original spreadsheet, kept for reference
  seafood-price-list.html                     original single-file static version
```

## Notes on the data

Several data-entry errors inherited from the original spreadsheet were fixed
when this was built (worth a quick sanity check against current supplier
pricing):

- `POLLOCK FILLET SKINLESS 2/4` was priced at $260.00/lb — corrected to $2.60/lb.
- Five shrimp items had a date where their packaging field should have been —
  reset to `CS`.
- `CRAWFISH MEAT 150UP` and `WHELK 20/30 PCS IN SHELL COOKED` had values
  shifted into the wrong spreadsheet columns; unit/case were fixed, and the
  now-unrecoverable quantity was cleared rather than guessed.
- A duplicate `LOBSTER TAIL MEAT` line was removed.

## Limits of this approach

- The published sheet is world-readable (that's the point — it's what lets
  the static page fetch it with no backend and no login). The published CSV
  URL is a long random token, not indexed anywhere, but treat it as public:
  don't put anything sensitive in that sheet.
- No login-gated admin page — anyone you share edit access to the sheet with
  can change prices. Manage that the same way you'd manage who can edit a
  shared spreadsheet.
- If you ever outgrow this (need instant updates, a real login, order
  history, etc.), the earlier Node/Express + SQLite version of this project
  is a drop-in upgrade path — ask to bring that back.
