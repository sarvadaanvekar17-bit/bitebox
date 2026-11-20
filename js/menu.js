/* BiteBox 2.0 — Menu page: filters, live search, sort, quick-view, API merge.
   Cart logic stays in file.js — this module only drives the menu UI. */
(function () {
  "use strict";

  var API_URL = "https://6ae1efa7bbb5412922996528.mockapi.io/menu";
  var grid = document.getElementById("menu-grid");
  var searchInput = document.getElementById("menu-search");
  var clearBtn = document.getElementById("menu-clear");
  var searchBtn = document.getElementById("search-button");
  var sortSelect = document.getElementById("menu-sort");
  var catsWrap = document.getElementById("menu-cats");
  var emptyMsg = document.getElementById("menu-no-results");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!grid) return;

  var state = { query: "", category: "All", sort: "default" };
  var cards = [];

  function money(amount) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
  }

  function cardData(card) {
    return {
      name: card.dataset.name || "",
      price: parseFloat(card.dataset.price) || 0,
      category: card.dataset.category || "",
      img: card.dataset.img || "",
      id: card.dataset.id || "",
      rating: card.dataset.rating || "",
      el: card
    };
  }

  function refreshCards() {
    cards = Array.prototype.slice.call(grid.querySelectorAll(".dish-card"));
    cards.forEach(function (c, i) { c.dataset.order = String(i); });
    buildChips();
    applyFilters();
  }

  function buildChips() {
    if (!catsWrap) return;
    var seen = {}, cats = ["All"];
    cards.forEach(function (c) {
      var cat = c.dataset.category || "";
      if (cat && !seen[cat]) { seen[cat] = true; cats.push(cat); }
    });
    if (state.category !== "All" && cats.indexOf(state.category) === -1) state.category = "All";
    catsWrap.replaceChildren();
    cats.forEach(function (cat) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "menu-chip" + (cat === state.category ? " active" : "");
      btn.textContent = cat;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(cat === state.category));
      btn.addEventListener("click", function () {
        state.category = cat;
        Array.prototype.forEach.call(catsWrap.children, function (el) {
          el.classList.toggle("active", el.textContent === cat);
          el.setAttribute("aria-selected", String(el.textContent === cat));
        });
        applyFilters();
      });
      catsWrap.appendChild(btn);
    });
  }

  function applyFilters() {
    var q = state.query.trim().toLowerCase();
    var visible = 0;
    cards.forEach(function (card) {
      var d = cardData(card);
      var matchQ = !q || card.textContent.toLowerCase().indexOf(q) !== -1;
      var matchC = state.category === "All" || d.category === state.category;
      var show = matchQ && matchC;
      card.hidden = !show;
      if (show) visible++;
    });
    if (emptyMsg) emptyMsg.hidden = visible > 0;
    applySort();
  }

  function applySort() {
    var mode = state.sort;
    var ordered = cards.slice().sort(function (a, b) {
      var da = cardData(a), db = cardData(b);
      if (mode === "price-asc") return da.price - db.price;
      if (mode === "price-desc") return db.price - da.price;
      if (mode === "name") return da.name.localeCompare(db.name);
      return Number(a.dataset.order) - Number(b.dataset.order);
    });
    ordered.forEach(function (card) { grid.appendChild(card); });
  }

  /* ---------- Live search ---------- */
  function onQuery() {
    state.query = searchInput ? searchInput.value : "";
    if (clearBtn) clearBtn.hidden = !state.query;
    applyFilters();
  }
  if (searchInput) {
    searchInput.addEventListener("input", onQuery);
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); onQuery(); }
    });
  }
  if (clearBtn) clearBtn.addEventListener("click", function () {
    if (searchInput) { searchInput.value = ""; searchInput.focus(); }
    onQuery();
  });
  if (searchBtn) searchBtn.addEventListener("click", onQuery);
  if (sortSelect) sortSelect.addEventListener("change", function () {
    state.sort = sortSelect.value;
    applySort();
  });

  /* ---------- Quick-view modal ---------- */
  var overlay = document.getElementById("quickview");
  var qvImg = document.getElementById("qv-img");
  var qvName = document.getElementById("qv-name");
  var qvCat = document.getElementById("qv-cat");
  var qvRating = document.getElementById("qv-rating");
  var qvPrice = document.getElementById("qv-price");
  var qvQty = document.getElementById("qv-qty");
  var qvAdd = document.getElementById("qv-add");
  var qvClose = document.getElementById("qv-close");
  var qvMinus = document.getElementById("qv-minus");
  var qvPlus = document.getElementById("qv-plus");
  var currentQty = 1;
  var currentItem = null;

  function openQuickView(card) {
    var d = cardData(card);
    if (!d.name) return;
    currentItem = d;
    currentQty = 1;
    qvImg.src = d.img;
    qvImg.alt = d.name;
    qvName.textContent = d.name;
    qvCat.textContent = d.category || "Menu";
    qvCat.hidden = !d.category;
    qvRating.textContent = d.rating || "";
    qvRating.hidden = !d.rating;
    qvPrice.textContent = money(d.price);
    qvQty.textContent = "1";
    qvAdd.dataset.name = d.name;
    qvAdd.dataset.price = String(d.price);
    qvAdd.dataset.img = d.img;
    qvAdd.dataset.category = d.category;
    qvAdd.dataset.id = d.id || "";
    qvAdd.dataset.qty = "1";
    overlay.hidden = false;
    requestAnimationFrame(function () { overlay.classList.add("open"); });
    document.body.style.overflow = "hidden";
  }

  function closeQuickView() {
    overlay.classList.remove("open");
    setTimeout(function () { overlay.hidden = true; }, reduceMotion.matches ? 0 : 300);
    document.body.style.overflow = "";
    currentItem = null;
  }

  function setQty(n) {
    currentQty = Math.max(1, Math.min(20, n));
    qvQty.textContent = String(currentQty);
    qvAdd.dataset.qty = String(currentQty);
  }

  grid.addEventListener("click", function (event) {
    var opener = event.target.closest(".qv-open");
    if (!opener) return;
    var card = opener.closest(".dish-card");
    if (card) openQuickView(card);
  });
  if (qvClose) qvClose.addEventListener("click", closeQuickView);
  if (overlay) overlay.addEventListener("click", function (e) { if (e.target === overlay) closeQuickView(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay && !overlay.hidden) closeQuickView();
  });
  if (qvMinus) qvMinus.addEventListener("click", function () { setQty(currentQty - 1); });
  if (qvPlus) qvPlus.addEventListener("click", function () { setQty(currentQty + 1); });
  if (qvAdd) qvAdd.addEventListener("click", function () {
    var label = qvAdd.textContent;
    qvAdd.textContent = "Added ✓";
    setTimeout(function () { qvAdd.textContent = label; }, 1000);
  });

  /* ---------- MockAPI merge (optional, graceful) ---------- */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function buildCard(item) {
    var card = el("article", "dish-card is-new");
    card.dataset.category = item.category || "";
    card.dataset.name = item.name || "";
    card.dataset.price = String(item.price || 0);
    card.dataset.img = item.image || "";
    if (item.id != null) card.dataset.id = String(item.id);
    card.dataset.rating = item.rating ? "★ " + Number(item.rating).toFixed(1) + (item.reviews ? " (" + item.reviews + ")" : "") : "";

    var media = el("button", "dish-media qv-open");
    media.type = "button";
    media.setAttribute("aria-label", "Quick view " + (item.name || "dish"));
    if (item.image) {
      var img = el("img");
      img.src = item.image; img.alt = item.name || "Menu item"; img.loading = "lazy";
      media.appendChild(img);
    }
    card.appendChild(media);

    var body = el("div", "dish-body");
    body.appendChild(el("h3", null, item.name || "Dish"));
    if (item.rating) body.appendChild(el("p", "rating", "★ " + Number(item.rating).toFixed(1) + (item.reviews ? " (" + item.reviews + " reviews)" : "")));
    body.appendChild(el("p", "price", money(Number(item.price) || 0)));
    var actions = el("div", "dish-actions");
    var add = el("button", "add-to-cart btn btn-primary btn-sm", "Add to Cart");
    add.type = "button";
    add.dataset.name = item.name || "";
    add.dataset.price = String(item.price || "");
    add.dataset.category = item.category || "";
    add.dataset.img = item.image || "";
    if (item.id != null) add.dataset.id = String(item.id);
    var qv = el("button", "qv-open btn btn-ghost btn-sm", "Quick view");
    qv.type = "button";
    actions.append(add, qv);
    body.appendChild(actions);
    card.appendChild(body);
    return card;
  }

  /* If an API item matches an existing card by name, stamp the backend id
     onto the card + its add button so orders carry menuItemId. */
  function stampIds(apiItems) {
    var byName = {};
    apiItems.forEach(function (it) {
      if (it && it.id != null && it.name) byName[String(it.name).toLowerCase()] = it.id;
    });
    cards.forEach(function (card) {
      var id = byName[(card.dataset.name || "").toLowerCase()];
      if (!id) return;
      card.dataset.id = String(id);
      var btn = card.querySelector(".add-to-cart");
      if (btn) btn.dataset.id = String(id);
    });
  }

  function mergeItems(items, source) {
    if (!Array.isArray(items)) return;
    var existing = {};
    cards.forEach(function (c) { existing[(c.dataset.name || "").toLowerCase()] = true; });
    var added = 0;
    items.forEach(function (item) {
      var name = String(item.name || "").trim();
      var price = Number(item.price);
      if (!name || !isFinite(price) || price <= 0 || item.available === false || existing[name.toLowerCase()]) return;
      existing[name.toLowerCase()] = true;
      grid.appendChild(buildCard({
        id: item.id, name: name, price: price,
        category: item.category || "",
        image: item.image || item.imageUrl || "",
        rating: item.rating || 0, reviews: item.reviews || 0
      }));
      added++;
    });
    if (added) refreshCards();
  }

  /* Backend API first (real data + ids); MockAPI as fallback; local cards always present. */
  function mergeRemoteMenu() {
    if (window.BB_API) {
      BB_API.menu.list()
        .then(function (items) {
          stampIds(items);
          mergeItems(items, "api");
        })
        .catch(function () { mergeMockApi(); });
    } else {
      mergeMockApi();
    }
  }

  function mergeMockApi() {
    fetch(API_URL)
      .then(function (res) { if (!res.ok) throw new Error("Menu request failed (" + res.status + ")"); return res.json(); })
      .then(function (items) { mergeItems(items, "mockapi"); })
      .catch(function (err) { console.warn("BiteBox: online menu unavailable, showing local dishes.", err); });
  }

  /* Admin-managed items (biteboxMenuItems) merge into the customer menu */
  function mergeAdminItems() {
    var admin = [];
    try { admin = JSON.parse(localStorage.getItem("biteboxMenuItems") || "[]"); } catch (e) { admin = []; }
    if (!Array.isArray(admin)) return;
    var existing = {};
    cards.forEach(function (c) { existing[(c.dataset.name || "").toLowerCase()] = true; });
    var added = 0;
    admin.forEach(function (item) {
      var name = String(item.name || "").trim();
      var price = Number(item.price);
      if (!name || !isFinite(price) || price <= 0 || item.available === false || existing[name.toLowerCase()]) return;
      existing[name.toLowerCase()] = true;
      grid.appendChild(buildCard({
        name: name, price: price, category: item.category || "",
        image: item.image || "", rating: item.rating || 0, reviews: item.reviews || 0
      }));
      added++;
    });
    if (added) refreshCards();
  }

  refreshCards();
  mergeAdminItems();
  mergeRemoteMenu();
})();
