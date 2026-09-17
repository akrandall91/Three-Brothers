# H&L Seafood Catalog

A plain static site — no server, no build step. Customers search/filter the
price list and build a quote. Prices live in a Google Sheet, so updating them
is just editing a spreadsheet.

**Live data:** [Three Brothers Seafood — Price List (live)](https://docs.google.com/spreadsheets/d/16FrglTqX1rhFjZyDKOXoMxBLbvKKI4Eya6p_phMseQA/edit)

## One-time setup (do this before the site will show prices)

The sheet needs to be link-viewable so the page can fetch it as CSV:

1. Open the sheet (link above).
2. **Share → General access → change "Restricted" to "Anyone with the link" → Viewer.**
3. That's it — no password, no login needed to view the sheet's data this way,
   but only people with **edit** access (still just you, unless you share it)
   can change it.

Until you do this, the site will show a "could not load current prices" message.

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
                        (also where BUSINESS info and the sheet URL live)
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

- The Google Sheet is viewable (read-only) by anyone with its link, since
  that's what lets the static page fetch it without a backend. It's not
  indexed or discoverable, but the link itself isn't a secret. Fine for a
  price list; don't put anything sensitive in that sheet.
- No login-gated admin page — anyone you share edit access to the sheet with
  can change prices. Manage that the same way you'd manage who can edit a
  shared spreadsheet.
- If you ever outgrow this (need instant updates, a real login, order
  history, etc.), the earlier Node/Express + SQLite version of this project
  is a drop-in upgrade path — ask to bring that back.
