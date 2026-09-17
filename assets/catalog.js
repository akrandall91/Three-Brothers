(function () {
  "use strict";

  // ---- Business info: edit these directly and commit to update the site. ----
  var BUSINESS = {
    name: "H&L Wholesale Seafood",
    phone: "305-842-0535",
    email: "",
    note: "We offer a wide variety of fresh and live seafood, including Dungeness crab, blue crab, lobster, fresh yellowfin tuna, clams (any size), and oysters (all kinds). Emergency weekend deliveries available. Prices are updated weekly and vary by product."
  };

  // ---- Item prices/pack/etc. live in a Google Sheet, published as CSV. ----
  // To point this at a different sheet: File > Share > Publish to web > select
  // the sheet > CSV > Publish, then paste the URL it gives you here. It looks
  // like: https://docs.google.com/spreadsheets/d/e/<LONG_ID>/pub?output=csv
  // (Plain "anyone with the link" sharing + the /export URL does NOT work for
  // anonymous visitors — only "Publish to the web" does.)
  var SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTAlMorq-Qm00CunOdRydhqFnABThudytc-OkFPD4SmXsEi-_BYiCbNIWpPj0ENNCK0KD5BgrMkxyKo/pub?output=csv";

  // ---- Submitted orders get appended as rows to a separate "Orders" Google
  // Sheet via a Google Apps Script Web App (see apps-script/Code.gs and the
  // README's "Order tracking" section for how to set this up). Leave blank
  // to disable the "Submit order" button (email/copy quote still work).
  var ORDERS_WEBHOOK_URL = "";

  var CAT_COLORS = {
    "Shrimp": "#e2632f",
    "Crab": "#c1442e",
    "Lobster": "#1c8a5a",
    "Salmon & Tuna": "#d94f6b",
    "Octopus & Squid": "#6a4fb6",
    "Mussels, Clams, Oysters & Scallops": "#2f7fb0",
    "Tilapia, Catfish & Swai": "#3f9142",
    "Crawfish": "#b8862f",
    "Sauces, Prepared & Other": "#8a8f3f",
    "Frog Legs & Exotic": "#4f9e8f",
    "Fish (Whole & Fillet)": "#1c7788",
    "Other Seafood": "#7a7a7a"
  };
  var CAT_ORDER = Object.keys(CAT_COLORS);
  function catColor(c) { return CAT_COLORS[c] || "#7a7a7a"; }

  var CART_KEY = "hlseafood_cart_v1";
  var CUSTOMER_KEY = "hlseafood_customer_v1";

  var liveData = { business: BUSINESS, items: [] };
  var cart = loadJSON(CART_KEY, {});
  var customer = loadJSON(CUSTOMER_KEY, { name: "", phone: "", notes: "" });
  var ui = { q: "", cats: new Set(), sort: "cat", drawerOpen: false };

  function loadJSON(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function saveJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtPrice(p) {
    if (p == null || isNaN(p)) return "call";
    return "$" + Number(p).toFixed(2);
  }

  // ---- Minimal RFC4180-ish CSV parser (handles quoted fields, "" escapes, commas/newlines in quotes) ----
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += c;
        }
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ""; }
        else if (c === '\r') { /* skip */ }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
        else field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.length > 1 || (r.length === 1 && r[0] !== ""); });
  }

  function rowsToItems(rows) {
    if (!rows.length) return [];
    var header = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var idx = {};
    header.forEach(function (h, i) { idx[h] = i; });
    var items = [];
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      var get = function (key) { return idx[key] != null ? (row[idx[key]] || "").trim() : ""; };
      var name = get("name");
      if (!name) continue;
      var priceRaw = get("price");
      var qtyRaw = get("qty");
      items.push({
        id: get("id") || ("row" + r),
        name: name,
        pack: get("pack"),
        price: priceRaw === "" ? null : Number(priceRaw),
        unit: get("unit"),
        case: get("case"),
        qty: qtyRaw === "" ? null : Number(qtyRaw),
        category: get("category") || "Other Seafood"
      });
    }
    return items;
  }

  fetch(SHEET_CSV_URL + (SHEET_CSV_URL.indexOf("?") === -1 ? "?" : "&") + "cachebust=" + Date.now())
    .then(function (r) { if (!r.ok) throw new Error("bad response " + r.status); return r.text(); })
    .then(function (text) {
      liveData.items = rowsToItems(parseCSV(text));
      render();
    })
    .catch(function (err) {
      document.getElementById("app").innerHTML =
        '<div class="empty"><div class="big">⚠️</div>Could not load current prices right now. Please refresh, or call ' +
        esc(BUSINESS.phone) + ' for pricing.</div>';
      console.error("Catalog load failed:", err);
    });

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById("toast");
    if (el) el.remove();
    el = document.createElement("div");
    el.id = "toast"; el.className = "toast"; el.textContent = msg;
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.remove(); }, 3200);
  }

  function cartCount() { var n = 0; for (var k in cart) n += cart[k]; return n; }
  function cartTotal(data) {
    var t = 0;
    for (var id in cart) { var it = findItem(data, id); if (it && it.price != null) t += it.price * cart[id]; }
    return t;
  }
  function findItem(data, id) {
    for (var i = 0; i < data.items.length; i++) if (data.items[i].id === id) return data.items[i];
    return null;
  }
  function setCartQty(id, n) {
    n = Math.max(0, Math.round(n));
    if (n <= 0) delete cart[id]; else cart[id] = n;
    saveJSON(CART_KEY, cart);
  }

  function render() {
    var data = liveData;
    var app = document.getElementById("app");
    var html = "";
    html += renderHero(data);
    html += '<div class="wrap">';
    html += renderControls(data);
    html += '<div id="results">' + renderResults(data) + '</div>';
    html += renderFooter(data);
    html += '</div>';
    if (cartCount() > 0) html += renderQuoteBar(data);
    app.innerHTML = html;
    wireEvents(data);
    if (ui.drawerOpen) openDrawerDOM(data);
  }

  function renderHero(data) {
    var b = data.business || {};
    return '<header class="hero"><div class="inner">' +
      '<div class="eyebrow"><span class="dot"></span>WHOLESALE PRICE LIST &middot; UPDATED WEEKLY</div>' +
      '<h1>' + esc(b.name || "Seafood Catalog") + '</h1>' +
      '<p class="tagline">' + data.items.length + ' items, priced by the pound &mdash; shrimp, crab, whole fish, fillets, shellfish and more. Search or filter, then build a quote.</p>' +
      '<div class="hero-row">' +
      (b.phone ? '<a class="phone-pill" href="tel:' + esc(b.phone.replace(/[^0-9+]/g, '')) + '">&#9742;&nbsp; ' + esc(b.phone) + '</a>' : '') +
      '</div>' +
      '</div></header>';
  }

  function renderControls(data) {
    var counts = {};
    data.items.forEach(function (it) { counts[it.category] = (counts[it.category] || 0) + 1; });
    var chips = '<button type="button" class="chip" data-cat="__all__" aria-pressed="' + (ui.cats.size === 0) + '">All <span style="opacity:.6">(' + data.items.length + ')</span></button>';
    CAT_ORDER.forEach(function (cat) {
      if (!counts[cat]) return;
      chips += '<button type="button" class="chip" data-cat="' + esc(cat) + '" aria-pressed="' + ui.cats.has(cat) + '">' +
        '<span class="swatch" style="background:' + catColor(cat) + '"></span>' + esc(cat) + ' <span style="opacity:.6">(' + counts[cat] + ')</span></button>';
    });
    return '<div class="controls">' +
      '<div class="search-row">' +
      '<div class="search-box">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
      '<input id="search" type="text" placeholder="Search item, pack size, category…" autocomplete="off" value="' + esc(ui.q) + '">' +
      '</div>' +
      '<select id="sort">' +
      '<option value="cat"' + (ui.sort === "cat" ? " selected" : "") + '>Category</option>' +
      '<option value="name"' + (ui.sort === "name" ? " selected" : "") + '>Name A–Z</option>' +
      '<option value="price-asc"' + (ui.sort === "price-asc" ? " selected" : "") + '>Price: Low–High</option>' +
      '<option value="price-desc"' + (ui.sort === "price-desc" ? " selected" : "") + '>Price: High–Low</option>' +
      '</select>' +
      '</div>' +
      '<div class="chip-row" id="chips">' + chips + '</div>' +
      '<div class="meta-row"><span><b id="count">0</b> items shown</span>' +
      '<span id="clearWrap" style="display:none;"><a href="#" id="clearBtn" style="color:var(--coral);text-decoration:none;font-weight:600;">Clear filters ✕</a></span></div>' +
      '</div>';
  }

  function filterSort(data) {
    var q = ui.q.trim().toLowerCase();
    var list = data.items.filter(function (it) {
      if (ui.cats.size && !ui.cats.has(it.category)) return false;
      if (q) {
        var hay = (it.name + " " + it.pack + " " + it.category).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    if (ui.sort === "name") { list.sort(function (a, b) { return a.name.localeCompare(b.name); }); }
    else if (ui.sort === "price-asc") { list.sort(function (a, b) { return (a.price == null ? 1e9 : a.price) - (b.price == null ? 1e9 : b.price); }); }
    else if (ui.sort === "price-desc") { list.sort(function (a, b) { return (b.price == null ? -1 : b.price) - (a.price == null ? -1 : a.price); }); }
    return list;
  }

  function renderResults(data) {
    var list = filterSort(data);
    if (!list.length) {
      return '<div class="empty"><div class="big">🦐</div>No items match — try a different search or clear filters.</div>';
    }
    if (ui.sort !== "cat") {
      return '<div class="group"><div class="card">' + list.map(viewRowHtml).join('') + '</div></div>';
    }
    var byCat = {};
    list.forEach(function (it) { (byCat[it.category] = byCat[it.category] || []).push(it); });
    var order = CAT_ORDER.filter(function (c) { return byCat[c]; });
    Object.keys(byCat).forEach(function (c) { if (order.indexOf(c) === -1) order.push(c); });
    return order.map(function (cat) {
      var arr = byCat[cat];
      return '<div class="group"><div class="group-title"><span class="swatch" style="background:' + catColor(cat) + '"></span>' + esc(cat) + ' <span class="count">(' + arr.length + ')</span></div>' +
        '<div class="card">' + arr.map(viewRowHtml).join('') + '</div></div>';
    }).join('');
  }

  function viewRowHtml(it) {
    var subs = [];
    if (it.pack) subs.push('<span>Pack ' + esc(it.pack) + '</span>');
    if (it.case) subs.push('<span>' + esc(it.case) + '</span>');
    if (it.qty != null && !isNaN(it.qty)) subs.push('<span>Qty ' + (it.qty % 1 === 0 ? it.qty.toFixed(0) : it.qty) + '</span>');
    var inCart = cart[it.id] || 0;
    var qtyControl = inCart > 0
      ? '<div class="stepper" data-id="' + it.id + '"><button type="button" class="dec">&minus;</button><span class="n">' + inCart + '</span><button type="button" class="inc">+</button></div>'
      : '<button type="button" class="add-btn" data-id="' + it.id + '">+ Add</button>';
    return '<div class="item">' +
      '<div class="name">' + esc(it.name) + '</div>' +
      '<div class="sub">' + subs.join('') + '</div>' +
      '<div class="price"><span class="amt">' + fmtPrice(it.price) + '</span><span class="per">per ' + esc(it.unit || 'unit') + '</span>' + qtyControl + '</div>' +
      '</div>';
  }

  function renderFooter(data) {
    var b = data.business || {};
    return '<footer class="note">' +
      (b.note ? esc(b.note) + ' ' : '') +
      (b.phone ? 'Call <a href="tel:' + esc(b.phone.replace(/[^0-9+]/g, '')) + '" style="color:var(--coral);font-weight:700;text-decoration:none;">' + esc(b.phone) + '</a> to confirm current pricing and place an order.' : '') +
      '</footer>';
  }

  function renderQuoteBar(data) {
    return '<div class="quote-bar"><button type="button" id="openDrawer">🧺 View quote (' + cartCount() + ') <span class="total">' + fmtPrice(cartTotal(data)) + '</span></button></div>';
  }

  function openDrawerDOM(data) {
    var wrap = document.createElement("div");
    wrap.className = "drawer-overlay";
    wrap.id = "drawerOverlay";
    var ids = Object.keys(cart);
    var rows = ids.map(function (id) {
      var it = findItem(data, id);
      if (!it) return "";
      var lt = it.price != null ? it.price * cart[id] : null;
      return '<div class="cart-row" data-id="' + id + '">' +
        '<div class="info"><div class="n">' + esc(it.name) + '</div><div class="p">' + fmtPrice(it.price) + ' / ' + esc(it.unit) + '</div></div>' +
        '<div class="stepper"><button type="button" class="dec">&minus;</button><span class="n">' + cart[id] + '</span><button type="button" class="inc">+</button></div>' +
        '<div class="line-total">' + (lt == null ? "call" : fmtPrice(lt)) + '</div>' +
        '</div>';
    }).join('');
    wrap.innerHTML = '<div class="drawer">' +
      '<button type="button" class="close" id="closeDrawer">&times;</button>' +
      '<h2>Your quote</h2>' +
      '<div id="cartRows">' + (rows || '<p style="color:var(--ink-soft);font-size:13.5px;">Your quote is empty.</p>') + '</div>' +
      '<div class="cart-total-row"><span>Estimated total</span><span>' + fmtPrice(cartTotal(data)) + '</span></div>' +
      '<div class="cart-fields">' +
      '<div class="field"><label>Your name</label><input id="custName" value="' + esc(customer.name) + '"></div>' +
      '<div class="field"><label>Phone or callback number</label><input id="custPhone" value="' + esc(customer.phone) + '"></div>' +
      '<div class="field"><label>Notes (delivery date, substitutions, etc.)</label><textarea id="custNotes">' + esc(customer.notes) + '</textarea></div>' +
      '</div>' +
      '<div class="preview-box" id="preview"></div>' +
      '<div class="cart-actions">' +
      (ORDERS_WEBHOOK_URL ? '<button type="button" class="btn coral" id="submitOrder">Submit order</button>' : '') +
      '<a class="btn' + (ORDERS_WEBHOOK_URL ? '' : ' coral') + '" id="emailQuote" href="#">Email this quote</a>' +
      '<button type="button" class="btn" id="copyQuote">Copy to clipboard</button>' +
      '<button type="button" class="btn ghost" id="clearCart">Clear quote</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(wrap);
    updatePreview(data);
    wrap.addEventListener("click", function (e) { if (e.target === wrap) closeDrawer(); });
    document.getElementById("closeDrawer").onclick = closeDrawer;
    wrap.querySelectorAll(".cart-row").forEach(function (row) {
      var id = row.getAttribute("data-id");
      row.querySelector(".inc").onclick = function () { setCartQty(id, (cart[id] || 0) + 1); refreshDrawer(data); };
      row.querySelector(".dec").onclick = function () { setCartQty(id, (cart[id] || 0) - 1); refreshDrawer(data); };
    });
    ["custName", "custPhone", "custNotes"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", function () {
        customer.name = document.getElementById("custName").value;
        customer.phone = document.getElementById("custPhone").value;
        customer.notes = document.getElementById("custNotes").value;
        saveJSON(CUSTOMER_KEY, customer);
        updatePreview(data);
      });
    });
    document.getElementById("copyQuote").onclick = function () {
      var text = buildOrderText(data);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast("Quote copied — paste it into a text or email."); });
      } else { window.prompt("Copy this quote:", text); }
    };
    document.getElementById("clearCart").onclick = function () {
      cart = {}; saveJSON(CART_KEY, cart); closeDrawer(); render();
    };
    var submitBtn = document.getElementById("submitOrder");
    if (submitBtn) {
      submitBtn.onclick = function () {
        if (!cartCount()) { toast("Add at least one item first."); return; }
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting…";
        submitOrder(data, function () {
          toast("Order submitted — we'll be in touch.");
          cart = {}; saveJSON(CART_KEY, cart); closeDrawer(); render();
        });
      };
    }
    updateEmailLink(data);
  }

  // Posts the order to the Apps Script Web App via a hidden form + iframe,
  // rather than fetch(), because Apps Script Web Apps don't send CORS
  // headers a browser fetch() can read — a real form submission sidesteps
  // that entirely. We can't inspect the response, so we assume success.
  function submitOrder(data, done) {
    var itemsText = Object.keys(cart).map(function (id) {
      var it = findItem(data, id);
      if (!it) return "";
      var lt = it.price != null ? (it.price * cart[id]).toFixed(2) : "call";
      return cart[id] + " x " + it.name + " (" + it.pack + ") @ " + fmtPrice(it.price) + "/" + it.unit + " = $" + lt;
    }).join("\n");

    var frameName = "orderFrame" + Date.now();
    var iframe = document.createElement("iframe");
    iframe.name = frameName;
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    var form = document.createElement("form");
    form.method = "POST";
    form.action = ORDERS_WEBHOOK_URL;
    form.target = frameName;
    form.style.display = "none";

    var fields = {
      name: customer.name,
      phone: customer.phone,
      notes: customer.notes,
      items: itemsText,
      total: fmtPrice(cartTotal(data))
    };
    Object.keys(fields).forEach(function (key) {
      var input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = fields[key] || "";
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();

    setTimeout(function () {
      form.remove();
      iframe.remove();
      done();
    }, 800);
  }

  function refreshDrawer(data) { closeDrawer(); ui.drawerOpen = true; render(); }

  function updatePreview(data) {
    var el = document.getElementById("preview");
    if (el) el.textContent = buildOrderText(data);
    updateEmailLink(data);
    var barTotal = document.querySelector(".cart-total-row span:last-child");
    if (barTotal) barTotal.textContent = fmtPrice(cartTotal(data));
  }
  function updateEmailLink(data) {
    var a = document.getElementById("emailQuote");
    if (!a) return;
    var b = data.business || {};
    var subject = "Order request — " + (b.name || "Seafood order");
    var body = buildOrderText(data);
    a.href = "mailto:" + (b.email || "") + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }
  function buildOrderText(data) {
    var b = data.business || {};
    var lines = [];
    lines.push("Order request — " + (b.name || ""));
    if (customer.name) lines.push("From: " + customer.name);
    if (customer.phone) lines.push("Phone: " + customer.phone);
    lines.push("");
    var ids = Object.keys(cart);
    if (!ids.length) { lines.push("(no items selected yet)"); }
    ids.forEach(function (id) {
      var it = findItem(data, id);
      if (!it) return;
      var lt = it.price != null ? (it.price * cart[id]).toFixed(2) : "call";
      lines.push(cart[id] + " x " + it.name + " (" + it.pack + ") @ " + fmtPrice(it.price) + "/" + it.unit + " = $" + lt);
    });
    lines.push("");
    lines.push("Estimated total: " + fmtPrice(cartTotal(data)));
    if (customer.notes) { lines.push(""); lines.push("Notes: " + customer.notes); }
    return lines.join("\n");
  }
  function closeDrawer() {
    ui.drawerOpen = false;
    var el = document.getElementById("drawerOverlay");
    if (el) el.remove();
  }

  function wireEvents(data) {
    var searchEl = document.getElementById("search");
    if (searchEl) {
      searchEl.addEventListener("input", function (e) {
        ui.q = e.target.value;
        document.getElementById("results").innerHTML = renderResults(liveData);
        wireResultEvents(liveData);
        updateMeta(liveData);
      });
    }
    var sortEl = document.getElementById("sort");
    if (sortEl) {
      sortEl.addEventListener("change", function (e) {
        ui.sort = e.target.value;
        document.getElementById("results").innerHTML = renderResults(liveData);
        wireResultEvents(liveData);
      });
    }
    var chips = document.getElementById("chips");
    if (chips) {
      chips.addEventListener("click", function (e) {
        var btn = e.target.closest(".chip");
        if (!btn) return;
        var cat = btn.getAttribute("data-cat");
        if (cat === "__all__") ui.cats.clear();
        else { if (ui.cats.has(cat)) ui.cats.delete(cat); else ui.cats.add(cat); }
        render();
      });
    }
    var clearBtn = document.getElementById("clearBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", function (e) {
        e.preventDefault(); ui.q = ""; ui.cats.clear(); ui.sort = "cat"; render();
      });
    }
    updateMeta(data);
    wireResultEvents(data);

    var openDrawerBtn = document.getElementById("openDrawer");
    if (openDrawerBtn) openDrawerBtn.onclick = function () { ui.drawerOpen = true; openDrawerDOM(data); };
  }

  function updateMeta(data) {
    var countEl = document.getElementById("count");
    if (countEl) countEl.textContent = filterSort(data).length;
    var clearWrap = document.getElementById("clearWrap");
    if (clearWrap) clearWrap.style.display = (ui.q || ui.cats.size) ? "" : "none";
  }

  function wireResultEvents(data) {
    var results = document.getElementById("results");
    if (!results) return;
    results.querySelectorAll(".add-btn").forEach(function (btn) {
      btn.onclick = function () { setCartQty(btn.getAttribute("data-id"), 1); render(); };
    });
    results.querySelectorAll(".stepper").forEach(function (st) {
      var id = st.getAttribute("data-id");
      st.querySelector(".inc").onclick = function () { setCartQty(id, (cart[id] || 0) + 1); render(); };
      st.querySelector(".dec").onclick = function () { setCartQty(id, (cart[id] || 0) - 1); render(); };
    });
  }

})();
