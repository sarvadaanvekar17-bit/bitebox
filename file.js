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
      id: Number.isFinite(Number(item?.id)) ? Number(item.id) : undefined,
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
    const qty = Math.max(1, Math.min(20, parseInt(button && button.dataset ? button.dataset.qty : "", 10) || 1));
    const existing = cart.find(product => product.name.toLowerCase() === name.toLowerCase());
    const id = Number.isFinite(Number(item.id)) ? Number(item.id) : undefined;
    if (existing) existing.quantity += qty;
    else cart.push({ name, category: String(item.category || ""), price, img: String(item.img || ""), id, quantity: qty });
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
    playAddSound();
  }

  /* Short synthesized "added" chime (no audio file needed) */
  let addAudioCtx = null;
  function playAddSound() {
    if (window.BB_AUDIO_MUTED) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      addAudioCtx = addAudioCtx || new Ctx();
      if (addAudioCtx.state === "suspended") addAudioCtx.resume();
      const t = addAudioCtx.currentTime;

      const master = addAudioCtx.createGain();
      master.gain.setValueAtTime(0.0001, t);
      master.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      master.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      master.connect(addAudioCtx.destination);

      const pop = addAudioCtx.createOscillator();
      pop.type = "triangle";
      pop.frequency.setValueAtTime(520, t);
      pop.frequency.exponentialRampToValueAtTime(880, t + 0.12);
      pop.connect(master);
      pop.start(t);
      pop.stop(t + 0.34);

      const chime = addAudioCtx.createOscillator();
      const chimeGain = addAudioCtx.createGain();
      chime.type = "sine";
      chime.frequency.setValueAtTime(1040, t + 0.08);
      chime.frequency.exponentialRampToValueAtTime(1560, t + 0.2);
      chimeGain.gain.setValueAtTime(0.0001, t + 0.08);
      chimeGain.gain.exponentialRampToValueAtTime(0.1, t + 0.12);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      chime.connect(chimeGain);
      chimeGain.connect(addAudioCtx.destination);
      chime.start(t + 0.08);
      chime.stop(t + 0.42);
    } catch (error) { /* audio unavailable */ }
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
    const id = button.dataset.id;
    addToCart({ name, price, img: image, category, id }, button);
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
  document.body.classList.toggle("dark-theme", savedTheme !== "light");
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

  /* Contact page form: front-end demo feedback (connect an email/API service to send) */
  const contactForm = $("#contact-form");
  if (contactForm) contactForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!contactForm.checkValidity()) { contactForm.reportValidity(); return; }
    const submit = $("button[type='submit']", contactForm);
    const originalLabel = submit ? submit.textContent.trim() : "Send Message";
    if (submit) { submit.disabled = true; submit.textContent = "Sending…"; }
    setTimeout(() => {
      announce("Thanks! Your message has been noted. This demo does not send emails yet.");
      contactForm.reset();
      if (submit) { submit.disabled = false; submit.textContent = originalLabel; }
    }, 900);
  });

  /* Premium interactions: sticky header state, scroll reveal, card tilt */
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const siteHeader = $("header");

  function updateHeaderState() {
    siteHeader?.classList.toggle("scrolled", window.scrollY > 24);
  }
  window.addEventListener("scroll", updateHeaderState, { passive: true });
  updateHeaderState();

  const revealTargets = new Set();
  $$("main > section:not(.hero), .feature-card, .food-card, .review-card, .customer-notice, #offer, .newsletter, .featured-video, .contact-card, .visit-card, .map-card, .contact-form-card, .business-card, .event-card").forEach(el => revealTargets.add(el));
  const revealItems = Array.from(revealTargets);

  revealItems.forEach(el => {
    el.classList.add("reveal");
    if (el.matches(".feature-card, .food-card, .review-card, .contact-card")) {
      const siblings = el.parentElement
        ? Array.from(el.parentElement.children).filter(child => child.matches(".feature-card, .food-card, .review-card, .contact-card"))
        : [el];
      const index = Math.max(0, siblings.indexOf(el));
      el.style.setProperty("--reveal-delay", `${Math.min(index, 5) * 70}ms`);
    }
  });

  if ("IntersectionObserver" in window && !reduceMotion.matches) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    revealItems.forEach(el => revealObserver.observe(el));
  } else {
    revealItems.forEach(el => el.classList.add("is-visible"));
  }

  if (!reduceMotion.matches) {
    $$(".feature-card, .food-card, .review-card, .customer-notice, .contact-card, .visit-card, .map-card, .contact-form-card, .business-card, .event-card").forEach(el => {
      el.addEventListener("pointermove", event => {
        if (event.pointerType === "touch") return;
        const rect = el.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        el.style.transform = `translateY(-6px) perspective(900px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }

  /* Auth links in the header (injected once on every page that has a nav) */
  (function ensureAuthNav() {
    const nav = $("header nav");
    if (!nav) return;
    const cartLink = nav.querySelector("a[href*='cart.html']");
    if (!cartLink || nav.querySelector(".auth-nav")) return;

    const wrap = document.createElement("span");
    wrap.className = "auth-nav";

    let currentUser = null;
    try { currentUser = JSON.parse(localStorage.getItem("biteboxUser") || "null"); } catch (e) { currentUser = null; }

    function authLink(href, text, cls) {
      const a = document.createElement("a");
      a.href = href; a.textContent = text; a.className = cls || "auth-link";
      return a;
    }

    if (currentUser && currentUser.email) {
      wrap.append(
        authLink("account.html", "My Account", "auth-link auth-account"),
        authLink("orders.html", "My Orders", "auth-link")
      );
      const logout = authLink("#", "Logout", "auth-link auth-logout");
      logout.addEventListener("click", event => {
        event.preventDefault();
        try { localStorage.removeItem("biteboxUser"); } catch (e) {}
        window.location.href = "index.html";
      });
      wrap.appendChild(logout);
    } else {
      wrap.append(
        authLink("login.html", "Login"),
        authLink("signup.html", "Sign Up", "auth-link auth-signup")
      );
    }

    cartLink.before(wrap);
  })();

  /* Placeholder "#" links show feedback instead of jumping to top */
  $$('a[href="#"]').forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      announce("This link is a placeholder for now.");
    });
  });

  /* Sign up / login (demo auth stored in localStorage) */
  const hashPassword = value => {
    const text = String(value || "");
    let hash = 5381;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
    return "h" + (hash >>> 0).toString(36);
  };

  const signupForm = $("#signup-form");
  if (signupForm) signupForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!signupForm.checkValidity()) { signupForm.reportValidity(); return; }
    const data = Object.fromEntries(new FormData(signupForm));
    const password = String(data.password || "");
    if (password !== String(data.confirm || "")) { announce("Passwords do not match."); return; }
    const users = readStorage("biteboxUsers", []);
    const email = String(data.email || "").trim().toLowerCase();
    if (users.some(user => String(user.email || "").toLowerCase() === email)) {
      announce("An account with this email already exists. Try logging in.");
      return;
    }
    const user = {
      id: "u" + Date.now().toString(36),
      name: String(data.name || "").trim(),
      email,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString()
    };
    users.push(user);
    writeStorage("biteboxUsers", users);
    writeStorage("biteboxUser", user);
    announce("Account created! Welcome to BiteBox.");
    setTimeout(() => { window.location.href = "index.html"; }, 800);
  });

  const loginForm = $("#login-form");
  if (loginForm) loginForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!loginForm.checkValidity()) { loginForm.reportValidity(); return; }
    const data = Object.fromEntries(new FormData(loginForm));
    const email = String(data.email || "").trim().toLowerCase();
    const users = readStorage("biteboxUsers", []);
    const user = users.find(item => String(item.email || "").toLowerCase() === email);
    if (!user || user.passwordHash !== hashPassword(String(data.password || ""))) {
      announce("Invalid email or password.");
      return;
    }
    writeStorage("biteboxUser", user);
    announce(`Welcome back, ${user.name || "foodie"}!`);
    setTimeout(() => { window.location.href = "index.html"; }, 800);
  });

  /* Order ticket renderer for ordered.html */
  function renderOrderTicket(root) {
    const ticket = readStorage("biteboxLastTicket", null);
    if (!ticket || !Array.isArray(ticket.items)) {
      root.innerHTML = `
        <div class="ticket-empty">
          <h2>No ticket found</h2>
          <p>Your order ticket will appear here after checkout.</p>
          <a class="btn-primary" href="menu.html">Order now</a>
        </div>`;
      return;
    }

    const created = ticket.createdAt ? new Date(ticket.createdAt) : new Date();
    const dateText = created.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

    root.replaceChildren();

    const head = document.createElement("div");
    head.className = "ticket-head";
    const id = document.createElement("span"); id.className = "ticket-id"; id.textContent = ticket.id || "BB-ORDER";
    const status = document.createElement("span"); status.className = "ticket-status"; status.textContent = "Confirmed";
    const date = document.createElement("small"); date.textContent = dateText;
    head.append(id, status, date);
    root.appendChild(head);

    if (ticket.customer) {
      const customer = document.createElement("div");
      customer.className = "ticket-customer";
      const name = document.createElement("strong"); name.textContent = ticket.customer.name || "Customer";
      const meta = document.createElement("span");
      meta.textContent = [ticket.customer.email, ticket.customer.phone, ticket.customer.payment && `Paid via ${ticket.customer.payment}`].filter(Boolean).join(" • ");
      customer.append(name, meta);
      root.appendChild(customer);
    }

    const list = document.createElement("ul");
    list.className = "ticket-items";
    ticket.items.forEach(item => {
      const li = document.createElement("li");
      if (item.img) {
        const img = document.createElement("img");
        img.src = item.img; img.alt = ""; img.width = 44; img.height = 44; img.loading = "lazy";
        li.appendChild(img);
      }
      const info = document.createElement("div");
      const name = document.createElement("strong"); name.textContent = item.name;
      const qty = document.createElement("small"); qty.textContent = `Qty ${item.quantity}`;
      info.append(name, qty);
      const price = document.createElement("span"); price.textContent = money(Number(item.price) * Number(item.quantity));
      li.append(info, price);
      list.appendChild(li);
    });
    root.appendChild(list);

    const totals = document.createElement("div");
    totals.className = "ticket-totals";
    const rows = [
      ["Subtotal", ticket.subtotal],
      ["Delivery", ticket.delivery],
      ["Packaging", ticket.packaging],
      ["Discount", ticket.discount ? -Number(ticket.discount) : 0],
      ["Total", ticket.total]
    ];
    rows.forEach(([label, value], index) => {
      const row = document.createElement("p");
      if (index === rows.length - 1) row.className = "ticket-total";
      const left = document.createElement("span"); left.textContent = label;
      const right = document.createElement("span"); right.textContent = money(Number(value) || 0);
      row.append(left, right);
      totals.appendChild(row);
    });
    root.appendChild(totals);

    const actions = document.createElement("div");
    actions.className = "ticket-actions";
    const menu = document.createElement("a"); menu.className = "btn-primary"; menu.href = "menu.html"; menu.textContent = "Back to menu";
    const home = document.createElement("a"); home.className = "btn-ghost"; home.href = "index.html"; home.textContent = "Home";
    actions.append(menu, home);
    root.appendChild(actions);
  }

  const ticketRoot = $("#order-ticket");
  if (ticketRoot) renderOrderTicket(ticketRoot);

  /* ---------- Mobile navigation (all pages) ---------- */
  const navHeader = $("#site-header");
  const navToggle = $("#nav-toggle");
  const mainNav = $("#main-nav");
  function setNav(open) {
    if (!navHeader || !navToggle) return;
    navHeader.classList.toggle("nav-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  if (navToggle && mainNav) {
    navToggle.addEventListener("click", function () {
      setNav(!navHeader.classList.contains("nav-open"));
    });
    mainNav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setNav(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setNav(false);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 900) setNav(false);
    });
  }

  renderCart();
})();
