(function () {
  "use strict";

  var CAT_ORDER = [
    "Shrimp", "Crab", "Lobster", "Salmon & Tuna", "Octopus & Squid",
    "Mussels, Clams, Oysters & Scallops", "Tilapia, Catfish & Swai",
    "Crawfish", "Sauces, Prepared & Other", "Frog Legs & Exotic",
    "Fish (Whole & Fillet)", "Other Seafood"
  ];

  var state = { items: [], business: {}, q: "", cat: "" };
  var app = document.getElementById("app");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function api(path, opts) {
    opts = opts || {};
    opts.credentials = "same-origin";
    opts.headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (!r.ok) throw new Error(body.error || ("Request failed (" + r.status + ")"));
        return body;
      });
    });
  }

  function boot() {
    api("/api/admin/session").then(function (res) {
      if (res.authed) loadDashboard();
      else renderLogin();
    }).catch(function () { renderLogin(); });
  }

  function renderLogin(errorMsg) {
    app.innerHTML =
      '<div class="login-wrap"><div class="login-card">' +
      '<h1>Admin login</h1>' +
      '<p>Enter the admin password to manage the catalog.</p>' +
      '<form id="loginForm">' +
      '<div class="field"><label>Password</label><input type="password" id="pw" autofocus autocomplete="current-password"></div>' +
      '<div class="login-error">' + (errorMsg ? esc(errorMsg) : "") + '</div>' +
      '<button type="submit" class="btn primary">Log in</button>' +
      '</form>' +
      '</div></div>';
    document.getElementById("loginForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var pw = document.getElementById("pw").value;
      api("/api/admin/login", { method: "POST", body: JSON.stringify({ password: pw }) })
        .then(function () { loadDashboard(); })
        .catch(function (err) { renderLogin(err.message || "Login failed"); });
    });
  }

  function loadDashboard() {
    Promise.all([
      api("/api/admin/items"),
      api("/api/catalog"),
    ]).then(function (results) {
      state.items = results[0].items;
      state.business = results[1].business || {};
      renderDashboard();
    }).catch(function () {
      renderLogin("Session expired — please log in again.");
    });
  }

  function status(msg, kind) {
    var el = document.getElementById("saveStatus");
    if (!el) return;
    el.textContent = msg;
    el.className = "save-status" + (kind ? " " + kind : "");
    if (msg) setTimeout(function () { if (el.textContent === msg) el.textContent = ""; }, 2500);
  }

  function renderDashboard() {
    var b = state.business;
    app.innerHTML =
      '<header class="hero"><div class="inner">' +
      '<div class="eyebrow"><span class="dot"></span>ADMIN</div>' +
      '<h1>Catalog manager</h1>' +
      '<p class="tagline">Add, edit, or remove items and update your business info. Changes save instantly and appear live on the public catalog.</p>' +
      '<div class="hero-row">' +
      '<a class="phone-pill" href="/" target="_blank" rel="noopener">&#8599; View public catalog</a>' +
      '<button type="button" class="admin-pill" id="logoutBtn">Log out</button>' +
      '</div>' +
      '</div></header>' +
      '<div class="wrap">' +
      '<div class="admin-topbar" style="margin-top:16px;"><h2 style="margin:0;font-size:18px;">Business info</h2><span class="save-status" id="saveStatus"></span></div>' +
      renderBusinessPanel(b) +
      '<div class="admin-topbar" style="margin-top:22px;">' +
      '<h2 style="margin:0;font-size:18px;">Items (' + state.items.length + ')</h2>' +
      '<button type="button" class="btn small primary" id="addItemBtn">+ Add item</button>' +
      '</div>' +
      renderItemControls() +
      '<div id="results">' + renderItemRows() + '</div>' +
      '</div>';

    wireDashboardEvents();
  }

  function renderBusinessPanel(b) {
    return '<div class="settings-panel">' +
      field("Business name", "biz_name", b.name, "text") +
      field("Order phone", "biz_phone", b.phone, "text") +
      field("Order email", "biz_email", b.email, "text", "name@example.com") +
      '<div></div>' +
      fieldTextarea("Footer note (shown to customers)", "biz_note", b.note) +
      '</div>';
  }
  function field(label, id, val, type, ph) {
    return '<div class="field"><label>' + esc(label) + '</label><input type="' + type + '" id="' + id + '" value="' + esc(val || "") + '" placeholder="' + esc(ph || "") + '"></div>';
  }
  function fieldTextarea(label, id, val) {
    return '<div class="field full"><label>' + esc(label) + '</label><textarea id="' + id + '">' + esc(val || "") + '</textarea></div>';
  }

  function renderItemControls() {
    return '<div class="controls" style="position:static;">' +
      '<div class="search-row">' +
      '<div class="search-box">' +
      '<input id="search" type="text" placeholder="Search items…" autocomplete="off" value="' + esc(state.q) + '">' +
      '</div>' +
      '<select id="catFilter">' +
      '<option value="">All categories</option>' +
      CAT_ORDER.map(function (c) { return '<option value="' + esc(c) + '"' + (state.cat === c ? " selected" : "") + '>' + esc(c) + '</option>'; }).join('') +
      '</select>' +
      '</div>' +
      '</div>';
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
    return '<div class="item editing" data-id="' + it.id + '">' +
      '<div class="edit-grid">' +
      '<div class="full"><label>Item name</label><input class="f-name" value="' + esc(it.name) + '"></div>' +
      '<div><label>Pack</label><input class="f-pack" value="' + esc(it.pack || "") + '"></div>' +
      '<div><label>Category</label><select class="f-cat">' + catOptions + '</select></div>' +
      '<div><label>Price ($)</label><input class="f-price" type="number" step="0.01" value="' + (it.price == null ? "" : it.price) + '"></div>' +
      '<div><label>Unit</label><input class="f-unit" value="' + esc(it.unit || "") + '"></div>' +
      '<div><label>Packaging</label><input class="f-case" value="' + esc(it.case || "") + '"></div>' +
      '<div><label>Qty per case</label><input class="f-qty" type="number" step="1" value="' + (it.qty == null ? "" : it.qty) + '"></div>' +
      '</div>' +
      '<div class="item-edit-actions"><span class="save-status row-status"></span><button type="button" class="btn small danger f-delete">Delete item</button></div>' +
      '</div>';
  }

  function wireDashboardEvents() {
    document.getElementById("logoutBtn").onclick = function () {
      api("/api/admin/logout", { method: "POST" }).finally(function () { renderLogin(); });
    };

    ["biz_name", "biz_phone", "biz_email", "biz_note"].forEach(function (id) {
      var el = document.getElementById(id);
      el.addEventListener("change", saveBusinessInfo);
    });

    document.getElementById("addItemBtn").onclick = function () {
      status("Adding…");
      api("/api/admin/items", {
        method: "POST",
        body: JSON.stringify({ name: "New item", category: CAT_ORDER[0], unit: "LB", case: "CS" }),
      }).then(function (res) {
        state.items.unshift(res.item);
        state.q = ""; state.cat = "";
        renderDashboard();
        status("Added", "ok");
      }).catch(function (err) { status(err.message, "err"); });
    };

    var searchEl = document.getElementById("search");
    searchEl.addEventListener("input", function (e) {
      state.q = e.target.value;
      document.getElementById("results").innerHTML = renderItemRows();
      wireRowEvents();
    });
    var catEl = document.getElementById("catFilter");
    catEl.addEventListener("change", function (e) {
      state.cat = e.target.value;
      document.getElementById("results").innerHTML = renderItemRows();
      wireRowEvents();
    });

    wireRowEvents();
  }

  function saveBusinessInfo() {
    var payload = {
      name: document.getElementById("biz_name").value,
      phone: document.getElementById("biz_phone").value,
      email: document.getElementById("biz_email").value,
      note: document.getElementById("biz_note").value,
    };
    status("Saving…");
    api("/api/admin/business", { method: "PUT", body: JSON.stringify(payload) })
      .then(function (res) { state.business = res.business; status("Saved", "ok"); })
      .catch(function (err) { status(err.message, "err"); });
  }

  function wireRowEvents() {
    var results = document.getElementById("results");
    if (!results) return;
    results.querySelectorAll(".item.editing").forEach(function (row) {
      var id = row.getAttribute("data-id");
      var it = state.items.find(function (x) { return x.id === id; });
      if (!it) return;

      var rowStatus = row.querySelector(".row-status");
      var saveTimer = null;
      function scheduleSave() {
        it.name = row.querySelector(".f-name").value;
        it.pack = row.querySelector(".f-pack").value;
        it.category = row.querySelector(".f-cat").value;
        it.price = row.querySelector(".f-price").value === "" ? null : Number(row.querySelector(".f-price").value);
        it.unit = row.querySelector(".f-unit").value;
        it.case = row.querySelector(".f-case").value;
        it.qty = row.querySelector(".f-qty").value === "" ? null : Number(row.querySelector(".f-qty").value);

        if (rowStatus) { rowStatus.textContent = "Saving…"; rowStatus.className = "save-status row-status"; }
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
          api("/api/admin/items/" + id, { method: "PUT", body: JSON.stringify(it) })
            .then(function (res) {
              Object.assign(it, res.item);
              if (rowStatus) { rowStatus.textContent = "Saved"; rowStatus.className = "save-status row-status ok"; }
            })
            .catch(function (err) {
              if (rowStatus) { rowStatus.textContent = err.message; rowStatus.className = "save-status row-status err"; }
            });
        }, 500);
      }

      row.querySelectorAll(".f-name,.f-pack,.f-price,.f-unit,.f-case,.f-qty").forEach(function (input) {
        input.addEventListener("input", scheduleSave);
      });
      row.querySelector(".f-cat").addEventListener("change", scheduleSave);

      row.querySelector(".f-delete").onclick = function () {
        if (!confirm('Delete "' + it.name + '"? This cannot be undone.')) return;
        api("/api/admin/items/" + id, { method: "DELETE" }).then(function () {
          state.items = state.items.filter(function (x) { return x.id !== id; });
          document.getElementById("results").innerHTML = renderItemRows();
          wireRowEvents();
          document.getElementById("results").previousElementSibling
            && (document.querySelector('.admin-topbar h2').textContent = "Items (" + state.items.length + ")");
        }).catch(function (err) { alert(err.message); });
      };
    });
  }

  boot();
})();
