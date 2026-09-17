# Three Brothers Seafood Catalog

A plain static site — no server, no build step. Customers search/filter the
price list and build a quote. Prices live in a Google Sheet, so updating them
is just editing a spreadsheet.

**Live data:** [Three Brothers Seafood — Price List (live)](https://docs.google.com/spreadsheets/d/16FrglTqX1rhFjZyDKOXoMxBLbvKKI4Eya6p_phMseQA/edit)

## Customer experience release

See [CUSTOMER-EXPERIENCE.md](CUSTOMER-EXPERIENCE.md) for the current quote flow,
verified business sources, explicit ordering units, pricing configuration,
validation results, and rollout requirements. Unknown case weights and totals
require confirmation; quantity is never treated as case weight.

## One-time setup (already done for this sheet)

The site fetches the sheet as CSV with no login, which needs **Publish to the
web**, not just link-sharing (plain "anyone with the link" sharing plus the
`/export` URL looks like it should work but silently fails for anonymous
visitors — Publish to the web is the endpoint actually built for this):

1. In the sheet: **File → Share → Publish to web.**
2. Under "Link", choose the sheet/tab and **CSV** as the format, then **Publish**.
3. Copy the URL it gives you (looks like
   `https://docs.google.com/spreadsheets/d/e/<LONG_ID>/pub?output=csv`) and
   put it in `assets/config.js` as `SHEET_CSV_URL`.
4. Note: republishing after big structural changes (e.g. adding a column) can
   sometimes require re-publishing to pick up the new shape — if the site
   stops updating, revisit this step.

If the site ever shows "could not load current prices," this is the first
thing to check — confirm the publish is still active and the URL still matches.

## Editing products

Two ways to do this — same underlying sheet either way:

- **The admin page** (`/admin.html`, see below) — search, inline-edit price/
  pack/category/etc., add or delete items, no spreadsheet needed. This is
  the easier way day-to-day.
- **Directly in the sheet** — edit cells by hand. Give new rows a unique `id`
  (e.g. `i222`) and an existing `category` value (see `CAT_ORDER` in
  `assets/catalog.js`) so they group correctly; a new category name still
  works, it just renders with a default gray swatch.

Either way, changes usually show up on the public site within a few seconds
to a couple minutes (Google's published-CSV cache). No redeploy needed.

## Editing business info (name, phone, footer note)

Business details are configured in `assets/business.js`, separate from the
product sheet. Edit confirmed values there, commit, and push to update them.

## Retail vs. wholesale

A **Retail / Wholesale** toggle sits above the product search. It's a
whole-visit setting (not per item), remembered in the browser between visits,
and affects only pound-priced products that don't have an explicit
`order_unit` override:

- **Wholesale** (default) — request by the case. Total stays "to confirm"
  until a verified case weight exists (see `PRODUCT_OVERRIDES` /
  `case_weight_lb` below).
- **Retail** — request by the lb. Always has a real, known price, since it's
  just the sheet's per-lb price.

Products already priced by case/box/bag/each, or with an explicit per-item
`order_unit` override, ignore the toggle — there's no retail/wholesale
distinction to make for those; the override always wins.

Switching modes with items already in the quote clears it first (with a
confirmation), since a quantity entered as "2" means something completely
different in each unit (2 lb vs. 2 cases).

## Minimum order quantities

Set a per-item minimum via the admin page's **Min order qty** field (or the
`min_qty` sheet column, or `minQty` in a `business.js` override). Below the
minimum, the quantity stepper won't leave you at an in-between amount — going
under it removes the item from the quote entirely rather than clamping to
the minimum; the first "Add" jumps straight to it. The product card shows
"Min order N {unit}" when set.

## Verified case weights and order units (admin page)

Three optional columns make case-based (wholesale) pricing and per-item
overrides possible, all editable from the admin page's Products tab, or
directly in the Price sheet:

- `order_unit` — force a specific ordering unit (`lb`, `case`, `box`, `bag`,
  `each`) regardless of the retail/wholesale toggle. Leave blank for "auto."
- `case_weight_lb` — the verified weight of one case, in lb. Required for a
  pound-priced item to show a real case total in Wholesale mode.
- `min_qty` — minimum order quantity, see above.

`assets/business.js`'s `PRODUCT_OVERRIDES` object does the same thing and
takes precedence over the sheet columns — use it only for values you want
guaranteed to ship with the code; prefer the sheet/admin page for anything
that might change.

## Order tracking

When a customer clicks **Send quote request** in the quote drawer, the order is
appended as a new row to a separate sheet. The revised site confirms receipt
only after an explicit server acknowledgment. Location, fulfillment, delivery
address, and request reference are saved in the existing notes field:

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
3. **Project Settings** (gear icon, left sidebar) → **Script Properties** →
   **Add script property**. Key: `ADMIN_PASSWORD`, value: a password you choose.
   (This is what gates both the admin page and this script's write actions —
   keep it out of the committed code, which is why it's a Script Property and
   not hardcoded in `Code.gs`.)
4. Click **Deploy → New deployment**. For "Select type," choose **Web app**.
5. Set **Execute as: Me**, **Who has access: Anyone**. Click **Deploy**.
6. Google will ask you to authorize the script (it's yours, so this is safe)
   — approve it.
7. Copy the **Web app URL** it gives you (ends in `/exec`).
8. Paste that URL into `assets/config.js` as `API_URL`, commit, push.

Until `API_URL` is filled in, the "Send quote request" button simply doesn't
appear on the public site, and the admin page can't load — email/copy-quote
keep working regardless.

**If you ever change `Code.gs`**, saving it is not enough — you must also go
to **Deploy → Manage deployments**, click the pencil/edit icon on the
existing deployment, set **Version: New version**, and **Deploy**. This
keeps the same `/exec` URL (so you don't have to update `config.js` again)
while picking up the new code.

## Admin page

`/admin.html` is a password-protected page (same password as
`ADMIN_PASSWORD` above) with two tabs:

- **Products** — search, inline-edit any field, add or delete items. Saves
  automatically ~0.5s after you stop typing.
- **Orders** — every submitted order, newest first, with a status dropdown
  (`New` / `Fulfilled` / `Paid` / `Cancelled`) that saves on change.

It's a second static HTML file, not a separate app — it talks to the same
Apps Script Web App as order submission, just with additional password-gated
actions. The password is kept in `sessionStorage` (cleared when the tab/
browser closes), not `localStorage`, so it doesn't persist indefinitely on a
shared computer.

## Hosting on GitHub Pages

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. On GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: `main` / `(root)`.**
3. GitHub gives you a URL like `https://<username>.github.io/<repo>/`. That's
   the live site — share it with customers.
4. Every `git push` to `main` updates the site automatically within a minute
   or two. Price changes in the Sheet don't need a push at all.

## Project layout

```
index.html            public catalog page
admin.html             password-protected admin page (products + orders)
assets/
  config.js             SHEET_CSV_URL and API_URL — edit these, shared by both pages
  business.js            branding, locations, delivery info, PRODUCT_OVERRIDES
  quote-model.js          pure pricing/unit/quantity logic (offer, totals) — has its own tests
  style.css               base styling (controls, cards, admin UI)
  storefront.css           customer-facing storefront-specific styling
  catalog.js              public catalog: fetches the sheet, cart/quote, order submission
  admin.js                admin page: login, products CRUD, order status
apps-script/
  Code.gs               paste into the Orders sheet's Apps Script editor
tests/
  quote.test.cjs         run with `node --test tests/quote.test.cjs`
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
- The admin page's auth is a single shared password checked by the Apps
  Script on every write — no per-user accounts, no session expiry beyond
  closing the browser tab. Fine for a solo owner; anyone who has the
  password can edit everything.
- The password travels as a POST field to Google's servers over HTTPS (so
  it's encrypted in transit) but is visible in browser dev tools on
  whatever device you use to log in — don't use a password you reuse
  elsewhere.
- Order status updates target a specific spreadsheet row number captured
  when the admin page loaded the order list. If you manually add/delete
  rows in the Orders sheet while the admin page is open in another tab,
  refresh the admin page before changing statuses to avoid editing the
  wrong row.
- If you ever outgrow this (need instant updates, real per-user accounts,
  etc.), the earlier Node/Express + SQLite version of this project is a
  drop-in upgrade path — ask to bring that back.

