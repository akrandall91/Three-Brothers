(function () {
  "use strict";

  var API_URL = window.SITE_CONFIG.API_URL;
  var SESSION_KEY = "hlseafood_admin_pw";

  var CAT_ORDER = [
    "Shrimp", "Crab", "Lobster", "Salmon & Tuna", "Octopus & Squid",
    "Mussels, Clams, Oysters & Scallops", "Tilapia, Catfish & Swai",
    "Crawfish", "Sauces, Prepared & Other", "Frog Legs & Exotic",
    "Fish (Whole & Fillet)", "Other Seafood"
  ];

  var state = { password: "", tab: "products", items: [], orders: [], q: "", cat: "" };
  var app = document.getElementById("app");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtPrice(p) {
    if (p === "" || p == null || isNaN(p)) return "";
    return "$" + Number(p).toFixed(2);
  }

  function call(action, params) {
    var body = new URLSearchParams(Object.assign({ action: action, password: state.password }, params || {}));
    return fetch(API_URL, { method: "POST", body: body })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (json.error) throw new Error(json.error);
        return json;
      });
  }

  function boot() {
    var saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      state.password = saved;
      loadDashboard(true);
    } else {
      renderLogin();
    }
  }

  function renderLogin(errorMsg) {
    app.innerHTML =
      '<div class="login-wrap"><div class="login-card">' +
      '<h1>Admin login</h1>' +
      '<p>Enter the admin password to manage products and orders.</p>' +
      '<form id="loginForm">' +
      '<div class="field"><label>Password</label><input type="password" id="pw" autofocus autocomplete="current-password"></div>' +
      '<div class="login-error">' + (errorMsg ? esc(errorMsg) : "") + '</div>' +
      '<button type="submit" class="btn primary">Log in</button>' +
      '</form>' +
      '</div></div>';
    document.getElementById("loginForm").addEventListener("submit", function (e) {
      e.preventDefault();
      state.password = document.getElementById("pw").value;
      loadDashboard(false);
    });
  }

  function loadDashboard(silent) {
    Promise.all([call("listItems"), call("listOrders")])
      .then(function (results) {
        state.items = results[0].items || [];
        state.orders = (results[1].orders || []).sort(function (a, b) {
          return new Date(b.timestamp) - new Date(a.timestamp);
        });
        sessionStorage.setItem(SESSION_KEY, state.password);
        renderDashboard();
      })
      .catch(function (err) {
        sessionStorage.removeItem(SESSION_KEY);
        renderLogin(silent ? "" : (err.message || "Login failed"));
      });
  }

  function status(msg, kind, scopeSelector) {
    var el = document.querySelector(scopeSelector || "#saveStatus");
    if (!el) return;
    el.textContent = msg;
    el.className = "save-status" + (kind ? " " + kind : "");
    if (msg) setTimeout(function () { if (el.textContent === msg) el.textContent = ""; }, 2500);
  }

  function renderDashboard() {
    app.innerHTML =
      '<header class="hero"><div class="inner">' +
      '<div class="eyebrow"><span class="dot"></span>ADMIN</div>' +
      '<h1>Catalog manager</h1>' +
      '<p class="tagline">Manage products and track incoming orders.</p>' +
      '<div class="hero-row">' +
      '<a class="phone-pill" href="index.html" target="_blank" rel="noopener">&#8599; View public catalog</a>' +
      '<button type="button" class="admin-pill" id="logoutBtn">Log out</button>' +
      '</div>' +
      '</div></header>' +
      '<div class="wrap">' +
      '<div class="chip-row" style="margin-top:16px;">' +
      '<button type="button" class="chip" data-tab="products" aria-pressed="' + (state.tab === "products") + '">Products (' + state.items.length + ')</button>' +
      '<button type="button" class="chip" data-tab="orders" aria-pressed="' + (state.tab === "orders") + '">Orders (' + state.orders.length + ')</button>' +
      '</div>' +
      '<div id="tabBody">' + (state.tab === "products" ? renderProductsTab() : renderOrdersTab()) + '</div>' +
      '</div>';

    wireTopEvents();
    if (state.tab === "products") wireProductsTab();
    else wireOrdersTab();
  }

  // ---------------- Products tab ----------------

  function renderProductsTab() {
    return '<div class="admin-topbar" style="margin-top:14px;"><h2 style="margin:0;font-size:18px;">Products</h2>' +
      '<span class="save-status" id="saveStatus"></span></div>' +
      '<div class="controls" style="position:static;">' +
      '<div class="search-row">' +
      '<div class="search-box"><input id="search" type="text" placeholder="Search items…" autocomplete="off" value="' + esc(state.q) + '"></div>' +
      '<select id="catFilter"><option value="">All categories</option>' +
      CAT_ORDER.map(function (c) { return '<option value="' + esc(c) + '"' + (state.cat === c ? " selected" : "") + '>' + esc(c) + '</option>'; }).join('') +
      '</select>' +
      '</div>' +
      '</div>' +
      '<div style="margin:10px 0;"><button type="button" class="btn small primary" id="addItemBtn">+ Add item</button></div>' +
      '<div id="results">' + renderItemRows() + '</div>';
  }

  function filteredItems() {
    var q = state.q.trim().toLowerCase();
    return state.items.filter(function (it) {
      if (state.cat && it.category !== state.cat) return false;
      if (q && (it.name + " " + it.pack).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  function renderItemRows() {
    var list = filteredItems();
    if (!list.length) return '<div class="empty">No items match.</div>';
    return '<div class="card">' + list.map(editRowHtml).join('') + '</div>';
  }

  function editRowHtml(it) {
    var catOptions = CAT_ORDER.map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === it.category ? " selected" : "") + '>' + esc(c) + '</option>';
    }).join('');
    return '<div class="item editing" data-id="' + esc(it.id) + '">' +
      '<div class="edit-grid">' +
      '<div class="full"><label>Item name</label><input class="f-name" value="' + esc(it.name) + '"></div>' +
      '<div><label>Pack</label><input class="f-pack" value="' + esc(it.pack || "") + '"></div>' +
      '<div><label>Category</label><select class="f-cat">' + catOptions + '</select></div>' +
      '<div><label>Price ($)</label><input class="f-price" type="number" step="0.01" value="' + (it.price === "" || it.price == null ? "" : it.price) + '"></div>' +
      '<div><label>Unit</label><input class="f-unit" value="' + esc(it.unit || "") + '"></div>' +
      '<div><label>Packaging</label><input class="f-case" value="' + esc(it.case || "") + '"></div>' +
      '<div><label>Qty per case</label><input class="f-qty" type="number" step="1" value="' + (it.qty === "" || it.qty == null ? "" : it.qty) + '"></div>' +
      '<div><label>Order unit (blank = auto)</label><select class="f-order-unit">' +
      ['', 'lb', 'case', 'box', 'bag', 'each'].map(function (u) {
        return '<option value="' + u + '"' + ((it.order_unit || "") === u ? " selected" : "") + '>' + (u || "Auto (retail/wholesale toggle)") + '</option>';
      }).join('') + '</select></div>' +
      '<div><label>Case weight (lb)</label><input class="f-case-weight" type="number" step="0.1" value="' + (it.case_weight_lb === "" || it.case_weight_lb == null ? "" : it.case_weight_lb) + '"></div>' +
      '<div><label>Min order qty</label><input class="f-min-qty" type="number" step="1" min="1" value="' + (it.min_qty === "" || it.min_qty == null ? "" : it.min_qty) + '"></div>' +
      '</div>' +
      '<div class="item-edit-actions"><span class="save-status row-status"></span><button type="button" class="btn small danger f-delete">Delete item</button></div>' +
      '</div>';
  }

  function wireProductsTab() {
    document.getElementById("addItemBtn").onclick = function () {
      status("Adding…");
      call("addItem", { name: "New item", category: CAT_ORDER[0], unit: "LB", case: "CS" })
        .then(function (res) {
          state.items.unshift(res.item);
          state.q = ""; state.cat = "";
          renderDashboard();
          status("Added", "ok");
        })
        .catch(function (err) { status(err.message, "err"); });
    };
    var searchEl = document.getElementById("search");
    searchEl.addEventListener("input", function (e) {
      state.q = e.target.value;
      document.getElementById("results").innerHTML = renderItemRows();
      wireRowEvents();
    });
    document.getElementById("catFilter").addEventListener("change", function (e) {
      state.cat = e.target.value;
      document.getElementById("results").innerHTML = renderItemRows();
      wireRowEvents();
    });
    wireRowEvents();
  }

  function wireRowEvents() {
    var results = document.getElementById("results");
    if (!results) return;
    results.querySelectorAll(".item.editing").forEach(function (row) {
      var id = row.getAttribute("data-id");
      var it = state.items.find(function (x) { return String(x.id) === id; });
      if (!it) return;

      var rowStatus = row.querySelector(".row-status");
      var saveTimer = null;
      function scheduleSave() {
        it.name = row.querySelector(".f-name").value;
        it.pack = row.querySelector(".f-pack").value;
        it.category = row.querySelector(".f-cat").value;
        it.price = row.querySelector(".f-price").value;
        it.unit = row.querySelector(".f-unit").value;
        it.case = row.querySelector(".f-case").value;
        it.qty = row.querySelector(".f-qty").value;
        it.order_unit = row.querySelector(".f-order-unit").value;
        it.case_weight_lb = row.querySelector(".f-case-weight").value;
        it.min_qty = row.querySelector(".f-min-qty").value;

        if (rowStatus) { rowStatus.textContent = "Saving…"; rowStatus.className = "save-status row-status"; }
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
          call("updateItem", it).then(function (res) {
            Object.assign(it, res.item);
            if (rowStatus) { rowStatus.textContent = "Saved"; rowStatus.className = "save-status row-status ok"; }
          }).catch(function (err) {
            if (rowStatus) { rowStatus.textContent = err.message; rowStatus.className = "save-status row-status err"; }
          });
        }, 500);
      }

      row.querySelectorAll(".f-name,.f-pack,.f-price,.f-unit,.f-case,.f-qty,.f-case-weight,.f-min-qty").forEach(function (input) {
        input.addEventListener("input", scheduleSave);
      });
      row.querySelector(".f-cat").addEventListener("change", scheduleSave);
      row.querySelector(".f-order-unit").addEventListener("change", scheduleSave);

      row.querySelector(".f-delete").onclick = function () {
        if (!confirm('Delete "' + it.name + '"? This cannot be undone.')) return;
        call("deleteItem", { id: id }).then(function () {
          state.items = state.items.filter(function (x) { return String(x.id) !== id; });
          document.getElementById("results").innerHTML = renderItemRows();
          wireRowEvents();
          var h2 = document.querySelector(".chip[data-tab='products']");
          if (h2) h2.textContent = "Products (" + state.items.length + ")";
        }).catch(function (err) { alert(err.message); });
      };
    });
  }

  // ---------------- Orders tab ----------------

  var STATUS_OPTIONS = ["New", "Fulfilled", "Paid", "Cancelled"];

  function renderOrdersTab() {
    if (!state.orders.length) {
      return '<div class="empty" style="margin-top:14px;">No orders yet.</div>';
    }
    return '<div class="card" style="margin-top:14px;">' + state.orders.map(orderRowHtml).join('') + '</div>';
  }

  function orderRowHtml(o) {
    var when = "";
    try { when = new Date(o.timestamp).toLocaleString(); } catch (e) { when = o.timestamp || ""; }
    var statusOptions = STATUS_OPTIONS.map(function (s) {
      return '<option value="' + s + '"' + (s === o.status ? " selected" : "") + '>' + s + '</option>';
    }).join('');
    return '<div class="item editing" data-row="' + o.row + '">' +
      '<div class="edit-grid">' +
      '<div class="full"><label>' + esc(when) + '</label>' +
      '<div style="font-weight:700;font-size:14.5px;">' + esc(o.customer_name || "(no name)") + (o.customer_phone ? " — " + esc(o.customer_phone) : "") + '</div></div>' +
      '<div class="full"><label>Items</label><div class="preview-box" style="white-space:pre-wrap;">' + esc(o.items) + '</div></div>' +
      '<div><label>Total</label><div style="font-family:\'JetBrains Mono\',monospace;font-weight:700;">' + esc(o.total) + '</div></div>' +
      '<div><label>Status</label><select class="f-status">' + statusOptions + '</select></div>' +
      (o.notes ? '<div class="full"><label>Notes</label><div>' + esc(o.notes) + '</div></div>' : '') +
      '</div>' +
      '<div class="item-edit-actions"><span class="save-status row-status"></span></div>' +
      '</div>';
  }

  function wireOrdersTab() {
    document.querySelectorAll("#tabBody .item.editing").forEach(function (row) {
      var rowNum = row.getAttribute("data-row");
      var sel = row.querySelector(".f-status");
      var rowStatus = row.querySelector(".row-status");
      sel.addEventListener("change", function () {
        if (rowStatus) { rowStatus.textContent = "Saving…"; rowStatus.className = "save-status row-status"; }
        call("updateOrderStatus", { row: rowNum, status: sel.value }).then(function () {
          var o = state.orders.find(function (x) { return String(x.row) === rowNum; });
          if (o) o.status = sel.value;
          if (rowStatus) { rowStatus.textContent = "Saved"; rowStatus.className = "save-status row-status ok"; }
        }).catch(function (err) {
          if (rowStatus) { rowStatus.textContent = err.message; rowStatus.className = "save-status row-status err"; }
        });
      });
    });
  }

  // ---------------- Top-level (tabs, logout) ----------------

  function wireTopEvents() {
    document.getElementById("logoutBtn").onclick = function () {
      sessionStorage.removeItem(SESSION_KEY);
      state.password = "";
      renderLogin();
    };
    document.querySelectorAll(".chip[data-tab]").forEach(function (btn) {
      btn.onclick = function () {
        state.tab = btn.getAttribute("data-tab");
        renderDashboard();
      };
    });
  }

  boot();
})();
