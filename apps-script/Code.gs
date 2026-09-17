// Paste this into Extensions > Apps Script on the "Three Brothers Seafood —
// Orders" sheet, then deploy as a Web App (see README.md for exact steps).
// It receives an order submitted from the public site and appends it as a
// new row: timestamp, customer_name, customer_phone, items, total, notes, status.

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var p = (e && e.parameter) || {};

  sheet.appendRow([
    new Date(),
    p.name || "",
    p.phone || "",
    p.items || "",
    p.total || "",
    p.notes || "",
    "New"
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
