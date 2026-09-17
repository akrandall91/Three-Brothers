# Customer experience update

This revision implements pricing/quantity clarity, the quote-request journey,
delivery and pickup information, and a responsive storefront design.

## Business information

Edit `assets/business.js` for branding, contact information, location details,
delivery policies, response expectations, and actual price-update dates.

Public sources checked September 17, 2026:

- https://www.threebrotherseafood.com/ — Three Brothers Seafood branding;
  Greensboro and Roanoke have different prices, specials, and inventory.
- https://www.threebrotherseafood.com/home — wholesale contact email:
  gilbertolopez0535@gmail.com.
- https://www.threebrotherseafood.com/contact — both store addresses and
  Greensboro phone 336-617-3380. The contact page contains inconsistent hours
  (9am–8am in its location section, 9am–8pm in its footer). Wholesale pickup
  hours are not confirmed, so this release directs customers to call.
- The original catalog supplies wholesale phone 305-842-0535 and the statement
  that emergency weekend deliveries are available; both are retained.

Delivery area, fees, minimum order, cutoff, confirmed pickup hours, Roanoke
store phone, and response-time promises were not available. Do not invent
these; fill in the configuration when the owner confirms them.

## Prices and units

The live sheet remains the source of product names, prices, and listed units.
No product prices or sheet records were changed. Legacy `qty` is not used as
weight or shown to shoppers: its meaning is not sufficiently clear.

LB/LBS prices are displayed per pound. In this wholesale preview, those
products are requested by case, with final case weight and total to confirm.
Products priced by CS/CASE, BOX, BAG, or EACH use that ordering unit. Unknown
units remain package requests with unconfirmed pricing. Case ordering is a
configurable request convention, not a claim that every listed product must
be sold only by the case.

For verified case calculations, add a product override keyed by sheet ID:

```js
PRODUCT_OVERRIDES: {
  // Example only; do not use this until that product's weight is confirmed.
  i123: { orderUnit: 'case', caseWeightLb: 24 }
}
```

At $3.20/lb and a confirmed 24-lb case, one case is estimated at $76.80.
Optional sheet columns `order_unit` and `case_weight_lb` are also supported.
Prefer overrides until the legacy admin editor supports those new columns;
its existing save flow may clear columns it does not know about.

Unknown line totals are excluded from a clearly labeled priced-items subtotal.
An all-unconfirmed quote displays “To confirm,” not a misleading $0 total.
The old cart key is intentionally not migrated because old quantities had
ambiguous units; the original saved data is left untouched.

## Quote requests and existing order sheet

The workflow is Products → Your details → Review & send. It requires name,
callback number, location, fulfillment preference, and a delivery address
when requesting delivery. Business name, desired date, and notes are optional.

The existing endpoint and order-sheet schema remain unchanged. Location,
fulfillment, address, requested date, substitutions, business name, and a
request reference are included in `notes`; explicit ordering units are in
`items`; the `total` field describes whether pricing is complete or partial.

The site uses a form-encoded POST and shows success only after a readable
`{ "ok": true }` acknowledgment from the existing Apps Script endpoint.
There is no timed fake success or automatic retry. On a timeout, invalid
response, or network/CORS failure, the list and reference are preserved, and
the shopper is told to check with the team before sending again. The
reference is included in the saved notes; it is not a server deduplication key.

Email uses the verified wholesale recipient and opens an unsent draft.
No email notification service, payment processing, or guaranteed response
time is added. Contact fields stay in memory; saved products and an unresolved
request reference are stored locally on the customer's device.

## Validation and rollout

Run `node --test tests/quote.test.cjs` for pricing, CSV, and mocked submission
success/failure tests. Serve the folder with any static server for preview.

The live price sheet loaded all 220 products during browser testing. The
private Orders sheet required Google sign-in. No staff-facing test request
was sent. Before rollout, verify one authorized request in the private Orders
sheet, including a readable browser acknowledgment. If the deployed endpoint
does not permit readable responses, resolve that deployment issue first;
email and copy-request options remain available.

The public site is deployed from main by GitHub Pages. A draft pull request
allows review before merging. Keep the existing `legacy/` archive when
applying the changed files. The admin page, backend script, and shared
endpoint configuration have not been changed.
