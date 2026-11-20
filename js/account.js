/* BiteBox 2.0 — Account dashboard: profile render/edit, stats, recent orders. */
(function () {
  "use strict";

  var Auth = window.BiteBoxAuth;
  if (!Auth) return;

  var user = Auth.currentUser();
  if (!user) { window.location.href = "login.html"; return; }

  var money = function (n) {
    return "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
  };
  var tickets = [];
  try { tickets = JSON.parse(localStorage.getItem("biteboxTickets") || "[]"); } catch (e) { tickets = []; }
  if (!Array.isArray(tickets)) tickets = [];

  /* Orders belonging to this user (stamped via customer.email at checkout) */
  var myOrders = tickets.filter(function (t) {
    return t && t.customer && String(t.customer.email || "").toLowerCase() === user.email.toLowerCase();
  });
  /* Guest orders placed on this device before login */
  var guestOrders = tickets.filter(function (t) {
    return t && (!t.customer || !t.customer.email || String(t.customer.email).toLowerCase() !== user.email.toLowerCase());
  });

  /* ---------- Profile ---------- */
  var initial = (user.name || "?").trim().charAt(0).toUpperCase();
  document.getElementById("avatar").textContent = initial;
  document.getElementById("profile-name").textContent = user.name || "Foodie";
  document.getElementById("profile-email").textContent = user.email;
  document.getElementById("profile-phone").textContent = user.phone || "Not added";
  document.getElementById("profile-since").textContent = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  document.getElementById("pf-name").value = user.name || "";
  document.getElementById("pf-email").value = user.email;
  document.getElementById("pf-phone").value = user.phone || "";

  /* ---------- Stats ---------- */
  var spent = myOrders.reduce(function (s, t) { return s + (Number(t.total) || 0); }, 0);
  var items = myOrders.reduce(function (s, t) {
    return s + (Array.isArray(t.items) ? t.items.reduce(function (a, i) { return a + (Number(i.quantity) || 1); }, 0) : 0);
  }, 0);
  document.getElementById("stat-orders").textContent = myOrders.length;
  document.getElementById("stat-spent").textContent = money(spent);
  document.getElementById("stat-items").textContent = items;

  /* ---------- Recent orders ---------- */
  var recent = document.getElementById("recent-orders");
  var shown = myOrders.slice(0, 3);
  if (!shown.length) {
    recent.innerHTML = '<p class="muted" style="font-size:var(--text-sm)">No orders yet — your recent orders will appear here.</p>';
  } else {
    shown.forEach(function (t) {
      var row = document.createElement("div");
      row.className = "order-mini";
      var left = document.createElement("div");
      var id = document.createElement("div"); id.className = "om-id"; id.textContent = t.id || "Order";
      var meta = document.createElement("div"); meta.className = "om-meta";
      meta.textContent = t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-IN") : "";
      left.append(id, meta);
      var total = document.createElement("div"); total.className = "om-total"; total.textContent = money(t.total);
      row.append(left, total);
      recent.appendChild(row);
    });
  }

  /* ---------- Edit profile ---------- */
  var form = document.getElementById("profile-form");
  var msg = document.getElementById("profile-msg");
  var cancelBtn = document.getElementById("profile-cancel");

  function snapshot() { return { name: user.name, phone: user.phone || "" }; }
  var original = snapshot();

  cancelBtn.addEventListener("click", function () {
    document.getElementById("pf-name").value = original.name;
    document.getElementById("pf-phone").value = original.phone;
    msg.textContent = ""; msg.className = "form-msg";
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var res = Auth.updateProfile({
      name: document.getElementById("pf-name").value,
      phone: document.getElementById("pf-phone").value
    });
    if (!res.ok) { msg.textContent = res.error; msg.className = "form-msg err"; return; }
    user = res.user;
    original = snapshot();
    document.getElementById("profile-name").textContent = user.name;
    document.getElementById("profile-phone").textContent = user.phone || "Not added";
    document.getElementById("avatar").textContent = (user.name || "?").charAt(0).toUpperCase();
    msg.textContent = "Profile updated.";
    msg.className = "form-msg ok";
  });

  /* ---------- Logout ---------- */
  document.getElementById("logout-btn").addEventListener("click", function () {
    Auth.logout();
    window.location.href = "index.html";
  });
})();
