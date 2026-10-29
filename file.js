"use strict";

/* =========================================================
   BITEBOX APP SCRIPT
   Works safely across Home, Menu, Cart, and Order pages.
   ========================================================= */
(function () {
  const DELIVERY_CHARGE = 40;
  const PACKAGING_CHARGE = 20;
  const CART_KEY = "biteboxCart";
  const THEME_KEY = "biteboxTheme";
  const API_URL = "https://6ae1efa7bbb5412922996528.mockapi.io/menu";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function readStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (error) { console.warn("BiteBox: browser storage is unavailable.", error); }
  }

  function loadCart() {
    const saved = readStorage(CART_KEY, []);
    if (!Array.isArray(saved)) return [];
    return saved.map(item => ({
      name: String(item?.name || "").trim(),
      category: String(item?.category || ""),
      price: Number(item?.price),
      img: String(item?.img || item?.image || ""),
      quantity: Math.floor(Number(item?.quantity))
    })).filter(item => item.name && Number.isFinite(item.price) && item.price > 0 && Number.isFinite(item.quantity) && item.quantity > 0);
  }

  let cart = loadCart();
  const money = amount => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);

  function saveCart() { writeStorage(CART_KEY, cart); }
  function subtotal() { return cart.reduce((sum, item) => sum + item.price * item.quantity, 0); }
  function discountFor(amount) {
    if (amount > 1000) return amount * 0.25;
    if (amount >= 800) return amount * 0.15;
    if (amount >= 699) return amount * 0.10;
    return 0;
  }

  function updateCartBadge() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    $$("[data-cart-count], #cart-count, .cart-count").forEach(el => { el.textContent = count; });
    $$("a[href*='cart.html']").forEach(link => {
      if (!link.querySelector(".cart-count-badge")) {
        const badge = document.createElement("span");
        badge.className = "cart-count-badge";
        badge.setAttribute("aria-label", "Items in cart");
        link.appendChild(badge);
      }
      const badge = link.querySelector(".cart-count-badge");
      if (badge) { badge.textContent = count; badge.hidden = count === 0; }
    });
  }

  function renderCart() {
    const cartBody = $("#cart-items");
    if (!cartBody) { updateCartBadge(); return; }
    cartBody.replaceChildren();

    if (cart.length === 0) {
      const row = document.createElement("tr");
      row.className = "empty-row";
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.textContent = "Your cart is empty. Browse the menu and add something delicious!";
      row.appendChild(cell);
      cartBody.appendChild(row);
    } else {
      cart.forEach((item, index) => {
        const row = document.createElement("tr");
        const itemCell = document.createElement("td");
        itemCell.dataset.label = "Item";
        const itemWrap = document.createElement("div");
        itemWrap.className = "cart-item";
        if (item.img) {
          const img = document.createElement("img");
          img.src = item.img;
          img.alt = item.name;
          img.width = 56; img.height = 56;
          img.loading = "lazy";
          itemWrap.appendChild(img);
        }
        const details = document.createElement("div");
        const name = document.createElement("h3"); name.textContent = item.name;
        const category = document.createElement("p"); category.textContent = item.category;
        details.append(name, category); itemWrap.appendChild(details); itemCell.appendChild(itemWrap);

        const priceCell = document.createElement("td"); priceCell.dataset.label = "Price"; priceCell.className = "item-price"; priceCell.textContent = money(item.price);
        const qtyCell = document.createElement("td"); qtyCell.dataset.label = "Quantity";
        const qty = document.createElement("div"); qty.className = "qty quantity-box";
        const minus = actionButton("−", "decrease", index, `Decrease ${item.name}`);
        const count = document.createElement("span"); count.className = "item-quantity"; count.textContent = item.quantity;
        const plus = actionButton("+", "increase", index, `Increase ${item.name}`);
        qty.append(minus, count, plus); qtyCell.appendChild(qty);
        const totalCell = document.createElement("td"); totalCell.dataset.label = "Total"; totalCell.className = "item-total"; totalCell.textContent = money(item.price * item.quantity);
        const actionCell = document.createElement("td"); actionCell.dataset.label = "Action";
        actionCell.appendChild(actionButton("Remove", "remove", index, `Remove ${item.name}`, "remove"));
        row.append(itemCell, priceCell, qtyCell, totalCell, actionCell); cartBody.appendChild(row);
      });
    }
    updateSummary();
    updateCartBadge();
  }

  function actionButton(text, action, index, label, extraClass = "") {
    const button = document.createElement("button");
    button.type = "button"; button.dataset.action = action; button.dataset.index = index;
    button.setAttribute("aria-label", label); button.textContent = text;
    if (extraClass) button.className = extraClass;
    return button;
  }

  function updateSummary() {
    const amount = subtotal();
    const delivery = amount > 0 ? DELIVERY_CHARGE : 0;
    const packaging = amount > 0 ? PACKAGING_CHARGE : 0;
    const discount = discountFor(amount);
    const total = Math.max(0, amount + delivery + packaging - discount);
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const set = (selector, value) => { const el = $(selector); if (el) el.textContent = value; };
    set("#item-count", `Subtotal (${itemCount} ${itemCount === 1 ? "Item" : "Items"})`);
    set("#subtotal-amount, #subtotal", money(amount));
    set("#delivery-amount, #delivery", money(delivery));
    set("#packaging-amount, #packaging", money(packaging));
    set("#discount-amount, #discount", discount ? `−${money(discount)}` : money(0));
    set("#total-amount, #total", money(total));
  }

  function addToCart(item, button) {
    const name = String(item.name || "").trim();
    const price = Number(item.price);
    if (!name || !Number.isFinite(price) || price <= 0) {
      announce("This item could not be added. Please check its name and price.");
      return;
    }
    const existing = cart.find(product => product.name.toLowerCase() === name.toLowerCase());
    if (existing) existing.quantity += 1;
    else cart.push({ name, category: String(item.category || ""), price, img: String(item.img || ""), quantity: 1 });
    saveCart(); renderCart();
    if (button) {
      const original = button.dataset.originalLabel || button.textContent.trim() || "Add to Cart";
      button.dataset.originalLabel = original;
      button.textContent = "Added ✓";
      button.classList.add("is-added");
      if (button._resetTimer) clearTimeout(button._resetTimer);
      button._resetTimer = setTimeout(() => { button.textContent = original; button.classList.remove("is-added"); }, 1000);
    }
    announce(`${name} added to your cart.`);
  }

  function announce(message) {
    let status = $("#bitebox-status");
    if (!status) {
      status = document.createElement("div"); status.id = "bitebox-status"; status.className = "bitebox-status";
      status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); document.body.appendChild(status);
    }
    status.textContent = message; status.classList.add("visible");
    clearTimeout(status._timer); status._timer = setTimeout(() => status.classList.remove("visible"), 2200);
  }

  /* Add-to-cart buttons on menu cards and optional menu table */
  document.addEventListener("click", event => {
    const button = event.target.closest(".add-to-cart, [data-add-to-cart]");
    if (!button || button.disabled) return;
    const card = button.closest("article, tr, .menu-card");
    const name = button.dataset.name || $("h3, h4, .item-name", card)?.textContent?.trim();
    const priceText = button.dataset.price || $(".price, .item-price", card)?.textContent || "";
    const price = Number(String(priceText).replace(/[^0-9.]/g, ""));
    const image = button.dataset.img || $("img", card)?.getAttribute("src") || "";
    const category = button.dataset.category || card?.dataset.category || "";
    addToCart({ name, price, img: image, category }, button);
  });

  /* Cart quantity and remove controls */
  const cartBody = $("#cart-items");
  if (cartBody) cartBody.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const index = Number(button.dataset.index);
    const item = cart[index]; if (!item) return;
    if (button.dataset.action === "increase") item.quantity += 1;
    else if (button.dataset.action === "decrease") {
      item.quantity -= 1;
      if (item.quantity <= 0) cart.splice(index, 1);
    } else if (button.dataset.action === "remove") cart.splice(index, 1);
    saveCart(); renderCart();
  });

  const checkoutBtn = $("#checkout-btn");
  if (checkoutBtn) checkoutBtn.addEventListener("click", () => {
    if (!cart.length) { announce("Your cart is empty. Add a dish before checkout."); return; }
    window.location.href = "./ordernow.html";
  });
  const clearBtn = $("#clear-cart-btn");
  if (clearBtn) clearBtn.addEventListener("click", () => {
    if (cart.length && window.confirm("Remove all items from your cart?")) { cart = []; saveCart(); renderCart(); }
  });

  /* Menu search: supports table rows and menu cards */
  const searchInput = $("#menu-search");
  const searchButton = $("#search-button");
  function searchMenu() {
    if (!searchInput) return;
    const query = searchInput.value.trim().toLowerCase();
    const items = $$("#menuBody tr, #menu-items article, #menu-container article, .menu-card");
    let visible = 0;
    items.forEach(item => {
      const match = item.textContent.toLowerCase().includes(query);
      item.hidden = !match; if (match) visible++;
    });
    const empty = $("#menu-no-results");
    if (empty) empty.hidden = visible > 0;
  }
  if (searchButton) searchButton.addEventListener("click", searchMenu);
  if (searchInput) {
    searchInput.addEventListener("input", searchMenu);
    searchInput.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); searchMenu(); } });
  }

  /* Theme toggle with persistent preference */
  const themeButton = $("#theme-toggle");
  function updateThemeButton() {
    if (!themeButton) return;
    const dark = document.body.classList.contains("dark-theme");
    const icon = $(".theme-icon", themeButton); const label = $(".theme-text", themeButton);
    if (icon) icon.textContent = dark ? "☾" : "☀";
    if (label) label.textContent = dark ? "NIGHT MODE" : "DAY MODE";
    themeButton.setAttribute("aria-pressed", String(dark));
  }
  const savedTheme = (() => { try { return localStorage.getItem(THEME_KEY); } catch { return null; } })();
  document.body.classList.toggle("dark-theme", savedTheme === "dark");
  updateThemeButton();
  if (themeButton) themeButton.addEventListener("click", () => {
    const dark = document.body.classList.toggle("dark-theme");
    try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch (error) { /* optional preference */ }
    updateThemeButton();
  });

  /* Optional Add Menu Item modal + MockAPI integration. It runs only if its markup exists. */
  const addMenuBtn = $("#add-menu-btn");
  const menuModal = $("#menu-modal");
  const cancelMenuForm = $("#cancel-menu-form");
  const menuForm = $("#menu-form");
  const menuContainer = $("#menu-container");
  function closeMenuModal() { if (menuModal) menuModal.classList.remove("show"); }
  if (addMenuBtn && menuModal) addMenuBtn.addEventListener("click", () => menuModal.classList.add("show"));
  if (cancelMenuForm) cancelMenuForm.addEventListener("click", closeMenuModal);
  if (menuModal) menuModal.addEventListener("click", event => { if (event.target === menuModal) closeMenuModal(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeMenuModal(); });

  function safeText(tag, text, className) {
    const el = document.createElement(tag); el.textContent = text == null ? "" : String(text);
    if (className) el.className = className; return el;
  }
  function displayRemoteMenu(items) {
    if (!menuContainer || !Array.isArray(items)) return;
    menuContainer.replaceChildren();
    items.forEach(item => {
      const card = document.createElement("article"); card.className = "menu-card";
      if (item.image) { const img = document.createElement("img"); img.src = item.image; img.alt = item.name || "Menu item"; img.loading = "lazy"; card.appendChild(img); }
      card.appendChild(safeText("h3", item.name));
      card.appendChild(safeText("p", `★ ${Number(item.rating || 0).toFixed(1)} (${Number(item.reviews || 0)} reviews)`, "rating"));
      card.appendChild(safeText("p", money(Number(item.price) || 0), "price"));
      const button = safeText("button", "Add to Cart +", "add-to-cart"); button.type = "button";
      button.dataset.name = item.name || ""; button.dataset.price = String(item.price || ""); button.dataset.category = item.category || ""; button.dataset.img = item.image || "";
      card.appendChild(button); menuContainer.appendChild(card);
    });
  }
  async function fetchRemoteMenu() {
    if (!menuContainer) return;
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error(`Menu request failed (${response.status})`);
      displayRemoteMenu(await response.json());
    } catch (error) { console.warn("BiteBox: optional online menu could not be loaded.", error); }
  }
  if (menuForm) menuForm.addEventListener("submit", async event => {
    event.preventDefault();
    const name = $("#menu-name")?.value.trim();
    const price = Number($("#menu-price")?.value);
    const category = $("#menu-category")?.value || "";
    const rating = Number($("#menu-rating")?.value || 0);
    const reviews = Number($("#menu-reviews")?.value || 0);
    const image = $("#menu-image")?.value.trim() || "";
    if (!name || !Number.isFinite(price) || price <= 0) { announce("Enter a valid dish name and price."); return; }
    const submit = $("button[type='submit']", menuForm); if (submit) { submit.disabled = true; submit.textContent = "Saving…"; }
    try {
      const response = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, price, category, rating, reviews, image }) });
      if (!response.ok) throw new Error(`Save failed (${response.status})`);
      menuForm.reset(); closeMenuModal(); await fetchRemoteMenu(); announce("Menu item saved successfully.");
    } catch (error) { console.error(error); announce("Could not save the item. Check your internet connection and API settings."); }
    finally { if (submit) { submit.disabled = false; submit.textContent = "Save Menu Item"; } }
  });
  if (menuContainer && menuForm) fetchRemoteMenu();

  /* Newsletter: front-end demo feedback (no email service connected) */
  $$(".newsletter-form").forEach(form => form.addEventListener("submit", event => {
    event.preventDefault();
    const input = $("input[type='email']", form);
    if (input && input.checkValidity()) { announce("Thanks for subscribing! This demo does not send emails yet."); form.reset(); }
    else if (input) input.reportValidity();
  }));

  renderCart();
})();
