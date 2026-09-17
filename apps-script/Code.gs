// Paste this into Extensions > Apps Script on the "Three Brothers Seafood —
// Orders" sheet, then deploy as a Web App (see README.md for exact steps).
//
// Handles two things:
//  1. Public order submission (no password) — appends a row to this
//     (Orders) sheet.
//  2. Password-gated admin actions for the admin.html page — reading and
//     editing the Price List sheet, and reading/updating order status here.
//
// Before deploying, set the admin password as a Script Property (do NOT
// hardcode it here — this file is committed to a public repo):
//   Project Settings (gear icon) > Script Properties > Add script property
//   Key: ADMIN_PASSWORD   Value: <choose a password>

var PRICE_SHEET_ID = "16FrglTqX1rhFjZyDKOXoMxBLbvKKI4Eya6p_phMseQA";

function doPost(e) {
  var p = (e && e.parameter) || {};
  var action = p.action || "submitOrder";

  try {
    switch (action) {
      case "submitOrder":
        return respond(submitOrder(p));
      case "listItems":
        requireAuth(p);
        return respond({ items: listItems() });
      case "addItem":
        requireAuth(p);
        return respond({ item: addItem(p) });
      case "updateItem":
        requireAuth(p);
        return respond({ item: updateItem(p) });
      case "deleteItem":
        requireAuth(p);
        return respond(deleteItem(p));
      case "listOrders":
        requireAuth(p);
        return respond({ orders: listOrders() });
      case "updateOrderStatus":
        requireAuth(p);
        return respond(updateOrderStatus(p));
      default:
        return respond({ error: "Unknown action" });
    }
  } catch (err) {
    return respond({ error: (err && err.message) || String(err) });
  }
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function requireAuth(p) {
  var expected = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD");
  if (!expected || p.password !== expected) {
    throw new Error("Unauthorized");
  }
}

// ---- Orders (this sheet) ----

function ordersSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
}

function submitOrder(p) {
  ordersSheet().appendRow([
    new Date(),
    p.name || "",
    p.phone || "",
    p.items || "",
    p.total || "",
    p.notes || "",
    "New"
  ]);
  return { ok: true };
}

function listOrders() {
  var sheet = ordersSheet();
  var values = sheet.getDataRange().getValues();
  var header = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var o = { row: r + 1 };
    header.forEach(function (h, i) {
      var v = row[i];
      o[h] = (v instanceof Date) ? v.toISOString() : v;
    });
    if (o.customer_name || o.items) out.push(o);
  }
  return out;
}

function updateOrderStatus(p) {
  var sheet = ordersSheet();
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var statusCol = header.indexOf("status") + 1;
  var row = parseInt(p.row, 10);
  if (!row || row < 2 || !statusCol) throw new Error("Invalid row");
  sheet.getRange(row, statusCol).setValue(p.status || "");
  return { ok: true };
}

// ---- Price list (separate sheet, opened by ID) ----

function priceSheet() {
  return SpreadsheetApp.openById(PRICE_SHEET_ID).getSheets()[0];
}

function listItems() {
  var sheet = priceSheet();
  var values = sheet.getDataRange().getValues();
  var header = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var o = {};
    header.forEach(function (h, i) { o[h] = row[i]; });
    if (o.name) out.push(o);
  }
  return out;
}

function findItemRow(sheet, id) {
  var values = sheet.getDataRange().getValues();
  var header = values[0];
  var idCol = header.indexOf("id");
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(id)) {
      return { rowIndex: r + 1, header: header };
    }
  }
  return null;
}

function coerceRow(header, p, id) {
  return header.map(function (h) {
    if (h === "id") return id;
    if (h === "price" || h === "qty" || h === "min_qty" || h === "case_weight_lb") {
      if (p[h] === "" || p[h] == null) return "";
      var n = Number(p[h]);
      return isNaN(n) ? "" : n;
    }
    return p[h] != null ? p[h] : "";
  });
}

function addItem(p) {
  if (!p.name) throw new Error("Name is required");
  var sheet = priceSheet();
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var id = "i" + new Date().getTime();
  var row = coerceRow(header, p, id);
  sheet.appendRow(row);
  var obj = {};
  header.forEach(function (h, i) { obj[h] = row[i]; });
  return obj;
}

function updateItem(p) {
  if (!p.name) throw new Error("Name is required");
  var sheet = priceSheet();
  var found = findItemRow(sheet, p.id);
  if (!found) throw new Error("Item not found");
  var row = coerceRow(found.header, p, p.id);
  sheet.getRange(found.rowIndex, 1, 1, found.header.length).setValues([row]);
  var obj = {};
  found.header.forEach(function (h, i) { obj[h] = row[i]; });
  return obj;
}

function deleteItem(p) {
  var sheet = priceSheet();
  var found = findItemRow(sheet, p.id);
  if (!found) throw new Error("Item not found");
  sheet.deleteRow(found.rowIndex);
  return { ok: true };
}
