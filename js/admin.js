/* BiteBox 2.0 — Admin dashboard.
   LIVE MODE: when logged in with an ADMIN-role JWT (BB_API), data is fetched
   from the Spring Boot backend and mutations go through the REST API.
   DEMO MODE (fallback): localStorage only — biteboxTickets, biteboxUsers,
   biteboxMenuItems. No server, no real auth, no multi-device sync. */
(function () {
  "use strict";

  var MENU_KEY = "biteboxMenuItems";
  var ADMIN_KEY = "biteboxAdmin";
  var TITLES = {
    overview: ["Overview", "Restaurant at a glance"],
    orders: ["Orders", "Manage order status"],
    menu: ["Menu Management", "Add, edit and remove dishes"],
    customers: ["Customers", "Accounts on this device"],
    analytics: ["Analytics", "Sales overview from local orders"],
    settings: ["Settings", "Demo admin preferences"]
  };
  var STATUSES = ["Pending", "Confirmed", "Preparing", "Out for Delivery", "Delivered", "Cancelled"];

  function read(key, fb) { try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fb : v; } catch (e) { return fb; } }
  function write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function money(n) { return "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN"); }
  function esc(s) { return String(s == null ? "" : s); }

  function toast(msg) {
    var t = document.getElementById("adm-toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  function tickets() { var t = read("biteboxTickets", []); return Array.isArray(t) ? t : []; }
  function saveTickets(t) { write("biteboxTickets", t); }
  function menuItems() { var m = read(MENU_KEY, []); return Array.isArray(m) ? m : []; }
  function saveMenu(m) { write(MENU_KEY, m); }
  function users() { var u = read("biteboxUsers", []); return Array.isArray(u) ? u : []; }

  /* ---------- Gate ---------- */
  var gate = document.getElementById("admin-gate");
  var shell = document.getElementById("admin-shell");
  var apiMode = !!(window.BB_API && BB_API.apiUser() &&
      String(BB_API.apiUser().role).toUpperCase() === "ADMIN");
  function isAdmin() { return apiMode || localStorage.getItem(ADMIN_KEY) === "1"; }
  function showGate() { gate.hidden = false; shell.hidden = true; }
  function showShell() { gate.hidden = true; shell.hidden = false; route(); }

  /* Pull backend data into the same shapes the renderers already use.
     Renderers stay synchronous; we refresh the store, then route. */
  function loadApiData() {
    if (!apiMode) return Promise.resolve();
    var api = window.BB_API;
    return Promise.allSettled([
      api.admin.orders(),
      api.admin.customers(),
      api.menu.list()
    ]).then(function (res) {
      if (res[0].status === "fulfilled" && Array.isArray(res[0].value)) {
        saveTickets(res[0].value.map(api.orders.toTicket));
      }
      if (res[1].status === "fulfilled" && Array.isArray(res[1].value)) {
        write("biteboxUsers", res[1].value.map(function (c) {
          return { id: "api-" + c.id, name: c.name, email: c.email, phone: c.phone || "", createdAt: "" };
        }));
      }
      if (res[2].status === "fulfilled" && Array.isArray(res[2].value)) {
        saveMenu(res[2].value.map(function (m) {
          return {
            id: "api-" + m.id, backendId: m.id, name: m.name,
            description: m.description || "", price: Number(m.price) || 0,
            category: m.category || "", image: m.imageUrl || "",
            rating: m.rating || 0, reviews: m.reviews || 0,
            available: m.available !== false
          };
        }));
      }
    });
  }

  function refreshAndRender(section) {
    loadApiData().then(function () { render(section || "overview"); });
  }

  document.getElementById("gate-enable").addEventListener("click", function () {
    try { localStorage.setItem(ADMIN_KEY, "1"); } catch (e) {}
    showShell();
    toast("Demo admin enabled on this browser.");
  });
  document.getElementById("admin-logout").addEventListener("click", function (e) {
    e.preventDefault();
    try { localStorage.removeItem(ADMIN_KEY); } catch (err) {}
    if (window.BB_API) BB_API.clearSession();
    try { localStorage.removeItem("biteboxUser"); } catch (err2) {}
    location.reload();
  });

  /* ---------- Router ---------- */
  function route() {
    var hash = (location.hash || "#overview").slice(1);
    if (!TITLES[hash]) hash = "overview";
    document.querySelectorAll(".adm-section").forEach(function (s) { s.hidden = true; });
    var sec = document.getElementById("sec-" + hash);
    if (sec) sec.hidden = false;
    document.getElementById("section-title").textContent = TITLES[hash][0];
    document.getElementById("section-sub").textContent = TITLES[hash][1];
    document.querySelectorAll("#admin-nav a").forEach(function (a) {
      a.classList.toggle("active", a.dataset.section === hash);
    });
    document.getElementById("admin-sidebar").parentElement.classList.remove("nav-open");
    render(hash);
  }
  window.addEventListener("hashchange", route);

  /* Mobile nav */
  document.getElementById("admin-burger").addEventListener("click", function () {
    document.querySelector(".admin-shell").classList.toggle("nav-open");
  });
  document.getElementById("admin-scrim").addEventListener("click", function () {
    document.querySelector(".admin-shell").classList.remove("nav-open");
  });

  /* ---------- Shared bits ---------- */
  function statCard(label, value, delta) {
    var c = el("div", "stat-card");
    c.appendChild(el("div", "stat-label", label));
    c.appendChild(el("div", "stat-value", value));
    c.appendChild(el("div", "stat-delta", delta || ""));
    return c;
  }
  function card(title, extra) {
    var c = el("div", "adm-card");
    var head = el("div", "adm-card-head");
    head.appendChild(el("h3", null, title));
    if (extra) head.appendChild(extra);
    c.appendChild(head);
    return c;
  }
  function statusPill(status) {
    var s = String(status || "Pending");
    var cls = "status-" + s.toLowerCase().replace(/\s+/g, "-");
    return el("span", "status-pill " + cls, s);
  }
  function empty(msg) { var d = el("div", "empty-state", msg); return d; }

  /* ---------- Renderers ---------- */
  function renderOverview() {
    var sec = document.getElementById("sec-overview");
    sec.innerHTML = "";
    var t = tickets();
    var revenue = t.reduce(function (s, o) { return s + (Number(o.total) || 0); }, 0);
    var pending = t.filter(function (o) { return !o.status || o.status === "Pending"; }).length;

    var grid = el("div", "adm-grid cols-4");
    grid.appendChild(statCard("Total Orders", t.length, "all time (local)"));
    grid.appendChild(statCard("Total Revenue", money(revenue), "demo totals"));
    grid.appendChild(statCard("Pending Orders", pending, "awaiting action"));
    grid.appendChild(statCard("Menu Items", menuItems().length, "admin-managed"));
    sec.appendChild(grid);

    var row = el("div", "adm-grid cols-2");
    row.style.marginTop = "var(--space-5)";

    /* Recent orders */
    var recent = card("Recent Orders");
    var wrap = el("div", "adm-table-wrap");
    var table = el("table", "adm-table");
    table.innerHTML = "<thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>";
    var tb = document.createElement("tbody");
    t.slice(0, 6).forEach(function (o) {
      var tr = document.createElement("tr");
      [o.id || "—", (o.customer && o.customer.name) || "Guest", o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN") : "—", money(o.total)].forEach(function (v) {
        tr.appendChild(el("td", null, v));
      });
      var td = el("td"); td.appendChild(statusPill(o.status)); tr.appendChild(td);
      tb.appendChild(tr);
    });
    if (!t.length) tb.appendChild((function () { var tr = document.createElement("tr"); var td = el("td", null, "No orders yet."); td.colSpan = 5; tr.appendChild(td); return tr; })());
    table.appendChild(tb); wrap.appendChild(table); recent.appendChild(wrap);
    row.appendChild(recent);

    /* Popular items */
    var pop = card("Popular Items");
    var counts = {};
    t.forEach(function (o) { (o.items || []).forEach(function (i) { counts[i.name] = (counts[i.name] || 0) + (Number(i.quantity) || 1); }); });
    var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 6);
    if (!top.length) pop.appendChild(empty("No order data yet."));
    top.forEach(function (name) {
      var line = el("div");
      line.style.cssText = "display:flex;justify-content:space-between;padding:var(--space-2) 0;font-size:var(--text-sm);border-bottom:1px solid var(--adm-line)";
      line.appendChild(el("span", null, name));
      line.appendChild(el("strong", null, counts[name] + " sold"));
      pop.appendChild(line);
    });
    row.appendChild(pop);
    sec.appendChild(row);
  }

  function renderOrders() {
    var sec = document.getElementById("sec-orders");
    sec.innerHTML = "";
    var t = tickets();

    /* Filters */
    var toolbar = el("div", "adm-toolbar");
    var search = el("input"); search.type = "search"; search.placeholder = "Search orders…";
    var statusSel = el("select");
    ["All statuses"].concat(STATUSES).forEach(function (s) {
      var o = el("option", null, s); o.value = s === "All statuses" ? "" : s; statusSel.appendChild(o);
    });
    toolbar.append(search, statusSel);
    sec.appendChild(toolbar);

    var cardEl = card("All Orders", el("span", "muted", t.length + " total"));
    var wrap = el("div", "adm-table-wrap");
    var table = el("table", "adm-table");
    table.innerHTML = "<thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Update</th></tr></thead>";
    var tb = document.createElement("tbody");

    function draw() {
      tb.innerHTML = "";
      var q = search.value.trim().toLowerCase();
      var st = statusSel.value;
      var shown = 0;
      t.forEach(function (o) {
        var hay = ((o.id || "") + " " + ((o.customer && o.customer.name) || "") + " " + ((o.customer && o.customer.email) || "")).toLowerCase();
        var oStatus = o.status || "Pending";
        if (q && hay.indexOf(q) === -1) return;
        if (st && oStatus !== st) return;
        shown++;
        var tr = document.createElement("tr");
        tr.appendChild(el("td", null, o.id || "—"));
        tr.appendChild(el("td", null, (o.customer && o.customer.name) || "Guest"));
        tr.appendChild(el("td", null, String((o.items || []).length)));
        tr.appendChild(el("td", null, money(o.total)));
        var sTd = el("td"); sTd.appendChild(statusPill(oStatus)); tr.appendChild(sTd);
        var uTd = el("td");
        var sel = el("select");
        sel.style.cssText = "padding:6px 10px;border-radius:8px;border:1px solid var(--adm-line);font-size:12px;background:#fff";
        STATUSES.forEach(function (s) { var op = el("option", null, s); op.value = s; if (s === oStatus) op.selected = true; sel.appendChild(op); });
        sel.addEventListener("change", function () {
          o.status = sel.value;
          saveTickets(tickets().map(function (x) { return x.id === o.id ? o : x; }));
          toast("Order " + o.id + " → " + sel.value);
          var pill = sTd.querySelector(".status-pill");
          pill.className = "status-pill status-" + sel.value.toLowerCase().replace(/\s+/g, "-");
          pill.textContent = sel.value;
          if (apiMode && o.id) {
            window.BB_API.admin.updateStatus(o.id, sel.value)
              .catch(function (err) { toast("Server update failed: " + ((err && err.message) || "error")); });
          }
        });
        uTd.appendChild(sel); tr.appendChild(uTd);
        tb.appendChild(tr);
      });
      if (!shown) {
        var tr = document.createElement("tr"); var td = el("td", null, "No orders match."); td.colSpan = 6; tr.appendChild(td); tb.appendChild(tr);
      }
    }
    search.addEventListener("input", draw);
    statusSel.addEventListener("change", draw);
    draw();
    table.appendChild(tb); wrap.appendChild(table); cardEl.appendChild(wrap); sec.appendChild(cardEl);
  }

  /* ---------- Menu management ---------- */
  var editingId = null;
  var modal = document.getElementById("item-modal");
  var form = document.getElementById("item-form");

  function openModal(item) {
    editingId = item ? item.id : null;
    document.getElementById("item-modal-title").textContent = item ? "Edit item" : "Add menu item";
    document.getElementById("f-id").value = item ? item.id : "";
    document.getElementById("f-name").value = item ? item.name : "";
    document.getElementById("f-desc").value = item ? (item.description || "") : "";
    document.getElementById("f-price").value = item ? item.price : "";
    document.getElementById("f-category").value = item ? (item.category || "") : "";
    document.getElementById("f-image").value = item ? (item.image || "") : "";
    document.getElementById("f-rating").value = item && item.rating != null ? item.rating : 4.5;
    document.getElementById("f-reviews").value = item && item.reviews != null ? item.reviews : 0;
    document.getElementById("f-available").checked = item ? item.available !== false : true;
    var prev = document.getElementById("f-preview");
    if (item && item.image) { prev.src = item.image; prev.hidden = false; } else prev.hidden = true;
    document.getElementById("item-form-msg").textContent = "";
    modal.hidden = false;
    requestAnimationFrame(function () { modal.classList.add("open"); });
  }
  function closeModal() { modal.classList.remove("open"); setTimeout(function () { modal.hidden = true; }, 200); }
  document.getElementById("item-modal-close").addEventListener("click", closeModal);
  document.getElementById("item-cancel").addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
  document.getElementById("f-image").addEventListener("input", function () {
    var p = document.getElementById("f-preview");
    if (this.value.trim()) { p.src = this.value.trim(); p.hidden = false; } else p.hidden = true;
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var msg = document.getElementById("item-form-msg");
    var name = document.getElementById("f-name").value.trim();
    var price = Number(document.getElementById("f-price").value);
    var category = document.getElementById("f-category").value.trim();
    if (!name) { msg.textContent = "Name is required."; msg.className = "form-msg err"; return; }
    if (!isFinite(price) || price <= 0) { msg.textContent = "Enter a valid price."; msg.className = "form-msg err"; return; }
    if (!category) { msg.textContent = "Category is required."; msg.className = "form-msg err"; return; }

    var payload = {
      name: name,
      description: document.getElementById("f-desc").value.trim(),
      price: price,
      category: category,
      imageUrl: document.getElementById("f-image").value.trim(),
      rating: Number(document.getElementById("f-rating").value) || 0,
      reviews: Number(document.getElementById("f-reviews").value) || 0,
      available: document.getElementById("f-available").checked
    };

    if (apiMode) {
      var editingBackendId = editingId && String(editingId).indexOf("api-") === 0
        ? Number(String(editingId).slice(4)) : null;
      var call = editingBackendId
        ? window.BB_API.menu.update(editingBackendId, payload)
        : window.BB_API.menu.create(payload);
      call.then(function () {
        closeModal();
        toast(editingBackendId ? "Item updated." : "Item added.");
        refreshAndRender("menu");
      }).catch(function (err) {
        msg.textContent = (err && err.message) || "Server rejected the item.";
        msg.className = "form-msg err";
      });
      return;
    }

    var list = menuItems();
    var item = {
      id: editingId || "m" + Date.now().toString(36),
      name: payload.name,
      description: payload.description,
      price: payload.price,
      category: payload.category,
      image: payload.imageUrl,
      rating: payload.rating,
      reviews: payload.reviews,
      available: payload.available
    };
    if (editingId) {
      var idx = list.findIndex(function (x) { return x.id === editingId; });
      if (idx > -1) list[idx] = item; else list.push(item);
    } else list.push(item);
    saveMenu(list);
    closeModal();
    toast(editingId ? "Item updated." : "Item added.");
    render("menu");
  });

  function renderMenu() {
    var sec = document.getElementById("sec-menu");
    sec.innerHTML = "";
    var items = menuItems();

    var toolbar = el("div", "adm-toolbar");
    var search = el("input"); search.type = "search"; search.placeholder = "Search items…";
    var catSel = el("select");
    var cats = ["All categories"].concat(Array.from(new Set(items.map(function (i) { return i.category; }).filter(Boolean))).sort());
    cats.forEach(function (c) { var o = el("option", null, c); o.value = c === "All categories" ? "" : c; catSel.appendChild(o); });
    var sortSel = el("select");
    [["Name", "name"], ["Price ↑", "price-asc"], ["Price ↓", "price-desc"], ["Category", "category"]].forEach(function (p) {
      var o = el("option", null, "Sort: " + p[0]); o.value = p[1]; sortSel.appendChild(o);
    });
    var addBtn = el("button", "btn-primary-sm", "+ Add item");
    addBtn.type = "button";
    addBtn.addEventListener("click", function () { openModal(null); });
    toolbar.append(search, catSel, sortSel, addBtn);
    sec.appendChild(toolbar);

    var cardEl = card("Menu Items", el("span", "muted", items.length + " items"));
    var wrap = el("div", "adm-table-wrap");
    var table = el("table", "adm-table");
    table.innerHTML = "<thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Rating</th><th>Available</th><th>Actions</th></tr></thead>";
    var tb = document.createElement("tbody");

    function draw() {
      tb.innerHTML = "";
      var q = search.value.trim().toLowerCase();
      var cat = catSel.value, sort = sortSel.value;
      var list = items.slice().filter(function (i) {
        if (q && String(i.name).toLowerCase().indexOf(q) === -1 && String(i.category || "").toLowerCase().indexOf(q) === -1) return false;
        if (cat && i.category !== cat) return false;
        return true;
      });
      list.sort(function (a, b) {
        if (sort === "price-asc") return a.price - b.price;
        if (sort === "price-desc") return b.price - a.price;
        if (sort === "name") return String(a.name).localeCompare(String(b.name));
        if (sort === "category") return String(a.category).localeCompare(String(b.category));
        return 0;
      });
      if (!list.length) {
        var tr = document.createElement("tr"); var td = el("td", null, "No items match."); td.colSpan = 6; tr.appendChild(td); tb.appendChild(tr);
        return;
      }
      list.forEach(function (i) {
        var tr = document.createElement("tr");
        var nameTd = el("td");
        nameTd.style.cssText = "display:flex;align-items:center;gap:10px";
        if (i.image) { var im = el("img"); im.src = i.image; im.style.cssText = "width:36px;height:36px;border-radius:8px;object-fit:cover"; nameTd.appendChild(im); }
        nameTd.appendChild(el("span", null, i.name));
        tr.appendChild(nameTd);
        tr.appendChild(el("td", null, i.category || "—"));
        tr.appendChild(el("td", null, money(i.price)));
        tr.appendChild(el("td", null, i.rating ? "★ " + i.rating : "—"));
        tr.appendChild(el("td", null, i.available === false ? "No" : "Yes"));
        var aTd = el("td");
        var eb = el("button", "btn-ghost-sm", "Edit"); eb.type = "button";
        eb.style.marginRight = "6px";
        eb.addEventListener("click", function () { openModal(i); });
        var db = el("button", "btn-danger-sm", "Delete"); db.type = "button";
        db.addEventListener("click", function () {
          if (!confirm("Delete '" + i.name + "'?")) return;
          if (apiMode && i.backendId != null) {
            window.BB_API.menu.remove(i.backendId)
              .then(function () { toast("Item deleted."); refreshAndRender("menu"); })
              .catch(function (err) { toast("Delete failed: " + ((err && err.message) || "error")); });
            return;
          }
          saveMenu(menuItems().filter(function (x) { return x.id !== i.id; }));
          toast("Item deleted."); render("menu");
        });
        aTd.append(eb, db); tr.appendChild(aTd);
        tb.appendChild(tr);
      });
    }
    search.addEventListener("input", draw);
    catSel.addEventListener("change", draw);
    sortSel.addEventListener("change", draw);
    draw();
    table.appendChild(tb); wrap.appendChild(table); cardEl.appendChild(wrap); sec.appendChild(cardEl);

    /* Category datalist */
    document.getElementById("cat-list").innerHTML = "";
    cats.slice(1).forEach(function (c) { var o = el("option"); o.value = c; document.getElementById("cat-list").appendChild(o); });
  }

  /* ---------- Customers ---------- */
  function renderCustomers() {
    var sec = document.getElementById("sec-customers");
    sec.innerHTML = "";
    var t = tickets();
    var map = {};
    users().forEach(function (u) {
      map[String(u.email).toLowerCase()] = { name: u.name, email: u.email, phone: u.phone || "", orders: 0, spent: 0, last: "" };
    });
    t.forEach(function (o) {
      var email = String((o.customer && o.customer.email) || "").toLowerCase();
      if (!email) return;
      if (!map[email]) map[email] = { name: (o.customer && o.customer.name) || "Guest", email: email, phone: "", orders: 0, spent: 0, last: "" };
      map[email].orders++;
      map[email].spent += Number(o.total) || 0;
      var d = o.createdAt || "";
      if (d > map[email].last) map[email].last = d;
    });
    var list = Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.orders - a.orders; });

    var cardEl = card("Customers", el("span", "muted", list.length + " accounts"));
    var wrap = el("div", "adm-table-wrap");
    var table = el("table", "adm-table");
    table.innerHTML = "<thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Orders</th><th>Spent</th><th>Last order</th></tr></thead>";
    var tb = document.createElement("tbody");
    if (!list.length) {
      var tr = document.createElement("tr"); var td = el("td", null, "No customers yet."); td.colSpan = 6; tr.appendChild(td); tb.appendChild(tr);
    }
    list.forEach(function (c) {
      var tr = document.createElement("tr");
      [c.name, c.email, c.phone || "—", String(c.orders), money(c.spent),
       c.last ? new Date(c.last).toLocaleDateString("en-IN") : "—"].forEach(function (v) { tr.appendChild(el("td", null, v)); });
      tb.appendChild(tr);
    });
    table.appendChild(tb); wrap.appendChild(table); cardEl.appendChild(wrap); sec.appendChild(cardEl);
  }

  /* ---------- Analytics ---------- */
  function renderAnalytics() {
    var sec = document.getElementById("sec-analytics");
    sec.innerHTML = "";
    var t = tickets();
    if (!t.length) {
      var c = card("Analytics");
      c.appendChild(empty("Not enough order data yet — analytics will appear after orders are placed."));
      sec.appendChild(c);
      return;
    }

    /* Revenue by day (last 14 days) */
    var days = {};
    t.forEach(function (o) {
      var d = o.createdAt ? new Date(o.createdAt) : null;
      if (!d) return;
      var key = d.toISOString().slice(0, 10);
      days[key] = (days[key] || 0) + (Number(o.total) || 0);
    });
    var keys = Object.keys(days).sort().slice(-14);
    var max = Math.max.apply(null, keys.map(function (k) { return days[k]; }).concat([1]));

    var revCard = card("Revenue — last 14 days");
    var bars = el("div", "mini-bars");
    keys.forEach(function (k) {
      var bar = el("div", "bar");
      bar.style.height = Math.max(4, (days[k] / max) * 110) + "px";
      var tip = el("span", null, k.slice(5));
      bar.appendChild(tip);
      bar.title = k + " — " + money(days[k]);
      bars.appendChild(bar);
    });
    revCard.appendChild(bars);
    sec.appendChild(revCard);

    var row = el("div", "adm-grid cols-2"); row.style.marginTop = "var(--space-5)";

    /* Orders by status */
    var statusCard = card("Orders by status");
    var counts = {};
    t.forEach(function (o) { var s = o.status || "Pending"; counts[s] = (counts[s] || 0) + 1; });
    var total = t.length;
    var donutRow = el("div", "donut-row");
    var palette = ["#ff7138", "#ffb15c", "#e0645a", "#6fbf73", "#7a3b9e", "#8a7f6d"];
    var stops = [], idx = 0;
    STATUSES.forEach(function (s) {
      if (!counts[s]) return;
      stops.push(palette[idx % palette.length] + " " + (stops.length ? stops[stops.length - 1].split(" ")[1] : "0%"));
      idx++;
    });
    /* simpler legend-based display */
    donutRow.innerHTML = "";
    var legend = el("div", "legend");
    STATUSES.forEach(function (s, i) {
      if (!counts[s]) return;
      var line = el("div");
      line.innerHTML = '<i style="background:' + palette[i % palette.length] + '"></i>' + esc(s) + " — " + counts[s] + " (" + Math.round(counts[s] / total * 100) + "%)";
      legend.appendChild(line);
    });
    donutRow.appendChild(legend);
    statusCard.appendChild(donutRow);
    row.appendChild(statusCard);

    /* Category distribution */
    var catCard = card("Category distribution");
    var catCounts = {};
    t.forEach(function (o) { (o.items || []).forEach(function (i) { var c = i.category || "Other"; catCounts[c] = (catCounts[c] || 0) + (Number(i.quantity) || 1); }); });
    var catLegend = el("div", "legend");
    var ci = 0;
    Object.keys(catCounts).sort(function (a, b) { return catCounts[b] - catCounts[a]; }).forEach(function (c) {
      var line = el("div");
      line.innerHTML = '<i style="background:' + palette[ci++ % palette.length] + '"></i>' + esc(c) + " — " + catCounts[c] + " items";
      catLegend.appendChild(line);
    });
    if (!Object.keys(catCounts).length) catLegend.appendChild(el("p", "muted", "No item data."));
    catCard.appendChild(catLegend);
    row.appendChild(catCard);
    sec.appendChild(row);
  }

  function renderSettings() {
    var sec = document.getElementById("sec-settings");
    sec.innerHTML = "";
    var cardEl = card("Admin settings");
    cardEl.innerHTML = "";
    var p = el("p", "muted", apiMode
      ? "LIVE MODE — connected to the BiteBox backend. Orders, customers, menu and analytics come from the server; changes persist across devices. Sign in as an ADMIN-role account to use this panel."
      : "DEMO MODE — this admin panel is a frontend demo. Data is stored in this browser's localStorage only — there is no server, no real authentication, and no multi-device sync. Sign in with an admin account (admin@bitebox.demo / admin123 on the backend) for live mode.");
    p.style.marginBottom = "var(--space-4)";
    cardEl.appendChild(p);
    var p2 = el("p", "muted", "Stored keys: biteboxTickets (orders), biteboxUsers (customers), biteboxMenuItems (menu). Clearing site data resets everything.");
    cardEl.appendChild(p2);
    var danger = el("button", "btn-danger-sm", "Reset demo admin flag");
    danger.type = "button";
    danger.style.marginTop = "var(--space-6)";
    danger.addEventListener("click", function () {
      try { localStorage.removeItem(ADMIN_KEY); } catch (e) {}
      location.reload();
    });
    cardEl.appendChild(danger);
    sec.appendChild(cardEl);
  }

  function render(name) {
    ({ overview: renderOverview, orders: renderOrders, menu: renderMenu,
       customers: renderCustomers, analytics: renderAnalytics, settings: renderSettings })[name]();
  }

  /* ---------- Boot ---------- */
  if (isAdmin()) {
    loadApiData().then(showShell);
  } else {
    showGate();
  }
})();
