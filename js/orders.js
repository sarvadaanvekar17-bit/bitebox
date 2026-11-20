/* BiteBox 2.0 — Order history: renders biteboxTickets for the current user. */
(function () {
  "use strict";

  var Auth = window.BiteBoxAuth;
  if (!Auth) return;

  var user = Auth.currentUser();
  if (!user) { window.location.href = "login.html"; return; }

  var money = function (n) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n) || 0);
  };

  var list = document.getElementById("orders-list");
  var empty = document.getElementById("orders-empty");
  var guestNote = document.getElementById("guest-note");

  /* Load orders: backend first (when logged in via API), local tickets as fallback. */
  function localTickets() {
    var tickets = [];
    try { tickets = JSON.parse(localStorage.getItem("biteboxTickets") || "[]"); } catch (e) { tickets = []; }
    if (!Array.isArray(tickets)) tickets = [];
    return tickets;
  }

  function render(tickets) {
    var mine = tickets.filter(function (t) {
      return t && t.customer && String(t.customer.email || "").toLowerCase() === user.email.toLowerCase();
    });
    var guests = tickets.filter(function (t) {
      return t && (!t.customer || !t.customer.email);
    });
    var all = mine.concat(guests);
    if (!all.length) {
      empty.hidden = false;
    } else {
      all.forEach(function (t) { list.appendChild(renderTicket(t)); });
      if (guests.length) guestNote.hidden = false;
    }
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function renderTicket(t) {
    var card = el("article", "order-card");

    var head = el("div", "order-head");
    head.setAttribute("role", "button");
    head.setAttribute("tabindex", "0");
    head.setAttribute("aria-expanded", "false");

    var left = el("div");
    left.style.display = "flex"; left.style.flexDirection = "column"; left.style.gap = "2px";
    left.appendChild(el("span", "order-id", t.id || "Order"));
    left.appendChild(el("span", "order-date", t.createdAt
      ? new Date(t.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
      : ""));
    head.appendChild(left);

    head.appendChild(el("span", "order-status", String(t.status || "Pending").replace(/_/g, " ")));
    head.appendChild(el("span", "order-total", money(t.total)));
    card.appendChild(head);

    var body = el("div", "order-body");

    var ul = el("ul", "order-items");
    (t.items || []).forEach(function (i) {
      var li = el("li");
      li.appendChild(el("span", null, (i.name || "Item") + "  ×" + (i.quantity || 1)));
      li.appendChild(el("span", null, money(i.price * i.quantity)));
      ul.appendChild(li);
    });
    body.appendChild(ul);

    var totals = el("div", "order-totals");
    [["Subtotal", t.subtotal], ["Delivery", t.delivery], ["Packaging", t.packaging],
     ["Discount", t.discount ? -(Number(t.discount) || 0) : 0]]
      .forEach(function (row) {
        if (row[1] == null) return;
        var line = el("div");
        line.appendChild(el("span", null, row[0]));
        line.appendChild(el("span", null, typeof row[1] === "number" ? money(row[1]) : row[1]));
        totals.appendChild(line);
      });
    if (t.coupon) {
      var cl = el("div");
      cl.appendChild(el("span", null, "Coupon " + t.coupon));
      cl.appendChild(el("span", null, "applied"));
      totals.appendChild(cl);
    }
    var grand = el("div", "grand");
    grand.appendChild(el("span", null, "Total paid"));
    grand.appendChild(el("span", null, money(t.total)));
    totals.appendChild(grand);
    body.appendChild(totals);

    if (t.customer && (t.customer.address || t.customer.house)) {
      var addr = el("div", "order-address");
      addr.textContent = "Deliver to: " + (t.customer.address || [t.customer.house, t.customer.street, t.customer.city, t.customer.state, t.customer.pin].filter(Boolean).join(", "));
      body.appendChild(addr);
    }

    card.appendChild(body);

    function toggle() {
      var open = card.classList.toggle("open");
      head.setAttribute("aria-expanded", String(open));
    }
    head.addEventListener("click", toggle);
    head.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });

    return card;
  }

  var api = window.BB_API;
  if (api && api.token()) {
    api.orders.mine()
      .then(function (orders) { render(orders.map(api.orders.toTicket)); })
      .catch(function () { render(localTickets()); });
  } else {
    render(localTickets());
  }
})();
