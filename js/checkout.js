/* BiteBox 2.0 — Checkout: validation, recap, ticket creation.
   Uses pricing.js (single source) + biteboxCart/biteboxTickets keys. */
(function () {
  "use strict";

  var P = window.BiteBoxPricing;
  var form = document.getElementById("order-form");
  var submitBtn = document.getElementById("order-submit");
  var itemsList = document.getElementById("recap-items");
  var couponRow = document.getElementById("recap-coupon-row");
  var couponEl = document.getElementById("recap-coupon");
  if (!P || !form || !itemsList) return;

  var money = function (n) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  };
  var setText = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };

  var couponCode = "";
  try { couponCode = localStorage.getItem(P.COUPON_KEY) || ""; } catch (e) {}
  var result = P.compute(P.loadCart(), couponCode);

  /* ---------- Recap ---------- */
  if (!result.items) {
    var empty = document.createElement("li");
    empty.className = "recap-empty";
    empty.innerHTML = 'Your cart is empty. <a href="menu.html">Pick a dish</a> or <a href="cart.html">review your cart</a>.';
    itemsList.appendChild(empty);
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Cart is empty"; }
  } else {
    P.loadCart().forEach(function (item) {
      var li = document.createElement("li");
      if (item.img) {
        var img = document.createElement("img");
        img.src = item.img; img.alt = ""; img.width = 48; img.height = 48;
        li.appendChild(img);
      } else {
        var thumb = document.createElement("div");
        thumb.className = "recap-thumb";
        thumb.textContent = String(item.name).charAt(0);
        li.appendChild(thumb);
      }
      var info = document.createElement("div");
      info.className = "info";
      var name = document.createElement("span");
      name.className = "recap-name"; name.textContent = item.name;
      var qty = document.createElement("span");
      qty.className = "recap-qty"; qty.textContent = "Qty " + item.quantity;
      info.append(name, qty);
      var price = document.createElement("span");
      price.className = "recap-price"; price.textContent = money(item.price * item.quantity);
      li.append(info, price);
      itemsList.appendChild(li);
    });
    if (submitBtn) submitBtn.textContent = "Place Order – " + money(result.total);
  }

  setText("recap-subtotal", money(result.subtotal));
  setText("recap-delivery", money(result.delivery));
  setText("recap-packaging", money(result.packaging));
  setText("recap-discount", result.discount ? "−" + money(result.discount) : money(0));
  setText("recap-total", money(result.total));
  if (couponRow) {
    couponRow.hidden = !result.coupon;
    if (result.coupon) couponEl.textContent = result.coupon.code + " (−" + money(result.couponDiscount) + ")";
  }

  /* ---------- Validation ---------- */
  function field(name) { return form.querySelector("[name='" + name + "']"); }
  function errorFor(name) { return form.querySelector(".field-error[data-for='" + name + "']"); }
  function setError(name, msgText) {
    var err = errorFor(name);
    var input = field(name);
    if (err) err.textContent = msgText || "";
    if (input) {
      var wrap = input.closest(".field");
      if (wrap) wrap.classList.toggle("has-error", !!msgText);
    }
  }

  var rules = {
    name: function (v) { return v.trim().length >= 2 ? "" : "Please enter your full name."; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "" : "Enter a valid email address."; },
    phone: function (v) { return /^[6-9]\d{9}$/.test(v.replace(/\D/g, "")) ? "" : "Enter a valid 10-digit Indian mobile number."; },
    house: function (v) { return v.trim().length >= 3 ? "" : "Please enter your house / building."; },
    street: function (v) { return v.trim().length >= 3 ? "" : "Please enter street / area."; },
    city: function (v) { return v.trim().length >= 2 ? "" : "Please enter your city."; },
    state: function (v) { return v.trim().length >= 2 ? "" : "Please enter your state."; },
    pin: function (v) { return /^\d{6}$/.test(v.trim()) ? "" : "PIN code must be 6 digits."; }
  };

  Object.keys(rules).forEach(function (name) {
    var input = field(name);
    if (!input) return;
    input.addEventListener("input", function () { setError(name, rules[name](input.value)); });
    input.addEventListener("blur", function () { setError(name, rules[name](input.value)); });
  });

  var paymentErr = errorFor("payment");
  form.addEventListener("change", function (e) {
    if (e.target.name === "payment" && paymentErr) paymentErr.textContent = "";
  });

  /* ---------- Autofill: logged-in profile + last delivery address ---------- */
  var ADDR_KEY = "biteboxLastAddress";
  function readJSON(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
  function fillIfEmpty(name, value) {
    var input = field(name);
    if (input && value && !String(input.value || "").trim()) input.value = value;
  }
  (function autofill() {
    var user = null;
    if (window.BiteBoxAuth && BiteBoxAuth.currentUser()) user = BiteBoxAuth.currentUser();
    if (!user && window.BB_API && BB_API.apiUser()) {
      var au = BB_API.apiUser();
      user = { name: au.name, email: au.email, phone: au.phone };
    }
    if (user) {
      fillIfEmpty("name", user.name);
      fillIfEmpty("email", user.email);
      fillIfEmpty("phone", user.phone);
    }
    var addr = readJSON(ADDR_KEY);
    if (addr) {
      ["house", "street", "city", "state", "pin", "instructions"].forEach(function (k) {
        fillIfEmpty(k, addr[k]);
      });
    }
  })();

  function saveAddress() {
    var addr = {};
    ["house", "street", "city", "state", "pin", "instructions"].forEach(function (k) {
      var input = field(k);
      addr[k] = input ? input.value.trim() : "";
    });
    try { localStorage.setItem(ADDR_KEY, JSON.stringify(addr)); } catch (e) {}
  }

  /* ---------- PIN ↔ City/State validation (India Post pincode API) ----------
     Government-referred source: api.postalpincode.in (India Post).
     Graceful: if the service is unreachable, checkout is not blocked. */
  var postal = { data: null, checking: false };
  var norm = function (s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); };

  function postalNames() {
    if (!postal.data) return null;
    var offices = postal.data[0] && postal.data[0].PostOffice ? postal.data[0].PostOffice : [];
    var names = [];
    offices.forEach(function (o) {
      [o.Name, o.Block, o.District, o.Division, o.Region, o.State].forEach(function (v) {
        if (v) names.push(String(v));
      });
    });
    return names;
  }

  function cityMatches(city) {
    var c = norm(city);
    if (!c) return true;
    return postalNames().some(function (n) {
      var d = norm(n);
      return d && (d.indexOf(c) !== -1 || c.indexOf(d) !== -1);
    });
  }
  function stateMatches(state) {
    var s = norm(state);
    if (!s) return true;
    return (postal.data[0] && postal.data[0].PostOffice || []).some(function (o) {
      var st = norm(o.State);
      return st && (st.indexOf(s) !== -1 || s.indexOf(st) !== -1);
    });
  }

  function checkPostal() {
    if (postal.checking) return;
    var pinInput = field("pin");
    var pin = pinInput ? pinInput.value.trim() : "";
    if (!/^\d{6}$/.test(pin)) { postal.data = null; return; }
    if (postal.data && postal.data._pin === pin) { applyPostalErrors(); return; }
    postal.checking = true;
    fetch("https://api.postalpincode.in/pincode/" + pin)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        postal.checking = false;
        if (Array.isArray(data) && data[0] && data[0].Status === "Success") {
          data._pin = pin;
          postal.data = data;
        } else {
          postal.data = null;
          setError("pin", "PIN code not found. Please check it.");
          return;
        }
        applyPostalErrors();
      })
      .catch(function () { postal.checking = false; /* service down → skip */ });
  }

  function applyPostalErrors() {
    if (!postal.data) return;
    var cityInput = field("city"), stateInput = field("state");
    var cityErr = rules.city(cityInput ? cityInput.value : "");
    var stateErr = rules.state(stateInput ? stateInput.value : "");
    if (!cityErr && !cityMatches(cityInput.value)) {
      setError("city", "City doesn't match this PIN code. Please verify.");
    } else if (!cityErr) setError("city", "");
    if (!stateErr && !stateMatches(stateInput.value)) {
      setError("state", "State doesn't match this PIN code. Please verify.");
    } else if (!stateErr) setError("state", "");
  }

  var pinInput = field("pin");
  if (pinInput) {
    var postalTimer = null;
    pinInput.addEventListener("input", function () {
      clearTimeout(postalTimer);
      postalTimer = setTimeout(checkPostal, 400);
    });
    pinInput.addEventListener("blur", checkPostal);
  }
  ["city", "state"].forEach(function (name) {
    var input = field(name);
    if (input) input.addEventListener("input", function () {
      if (postal.data) applyPostalErrors();
    });
  });

  /* ---------- Submit: validate → ticket → ordered.html ---------- */
  var submitting = false;
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (submitting) return;

    var cart = P.loadCart();
    if (!cart.length) {
      if (window.BiteBoxAudio) BiteBoxAudio.play("error");
      return;
    }

    var valid = true;
    Object.keys(rules).forEach(function (name) {
      var input = field(name);
      if (!input) return;
      var err = rules[name](input.value);
      setError(name, err);
      if (err) valid = false;
    });
    var payment = form.querySelector("input[name='payment']:checked");
    if (!payment) {
      valid = false;
      if (paymentErr) paymentErr.textContent = "Please choose a payment method.";
    } else if (paymentErr) paymentErr.textContent = "";

    /* Block submit if PIN↔city/state mismatch was detected */
    if (valid && postal.data) {
      var cOk = cityMatches(field("city") ? field("city").value : "");
      var sOk = stateMatches(field("state") ? field("state").value : "");
      if (!cOk) { setError("city", "City doesn't match this PIN code. Please verify."); valid = false; }
      if (!sOk) { setError("state", "State doesn't match this PIN code. Please verify."); valid = false; }
    }

    if (!valid) {
      if (window.BiteBoxAudio) BiteBoxAudio.play("error");
      var firstBad = form.querySelector(".has-error input, .has-error textarea");
      if (firstBad) firstBad.focus();
      return;
    }

    submitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Placing order…";

    function finishWithTicket(ticket) {
      ticket.demo = false;
      saveAddress();
      var tickets = [];
      try { tickets = JSON.parse(localStorage.getItem("biteboxTickets") || "[]"); } catch (e) { tickets = []; }
      if (!Array.isArray(tickets)) tickets = [];
      tickets.unshift(ticket);
      localStorage.setItem("biteboxTickets", JSON.stringify(tickets.slice(0, 20)));
      localStorage.setItem("biteboxLastOrder", JSON.stringify(ticket));
      localStorage.setItem("biteboxLastTicket", JSON.stringify(ticket));
      localStorage.removeItem(P.CART_KEY);
      try { localStorage.removeItem(P.COUPON_KEY); } catch (e2) {}
      if (window.BiteBoxAudio) BiteBoxAudio.play("success");
      window.location.href = "ordered.html";
    }

    function resetSubmit() {
      submitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Place Order";
    }

    /* Backend order: requires login + every cart item carrying a menuItemId.
       Server recomputes prices — client totals are display-only. */
    var api = window.BB_API;
    var canApiOrder = api && api.token() && cart.every(function (i) {
      return Number.isFinite(Number(i.id));
    });

    if (canApiOrder) {
      var payload = {
        items: cart.map(function (i) {
          return { menuItemId: Number(i.id), quantity: Math.max(1, Number(i.quantity) || 1) };
        }),
        delivery: {
          house: field("house").value.trim(),
          street: field("street").value.trim(),
          city: field("city").value.trim(),
          state: field("state").value.trim(),
          pin: field("pin").value.trim(),
          instructions: field("instructions") ? field("instructions").value.trim() : "",
          paymentMethod: payment.value
        },
        couponCode: couponCode || null
      };
      api.orders.create(payload).then(function (order) {
        finishWithTicket(api.orders.toTicket(order));
      }).catch(function (err) {
        resetSubmit();
        var msg = (err && err.message) || "Order could not be placed. Please try again.";
        if (paymentErr) paymentErr.textContent = msg;
        if (window.BiteBoxAudio) BiteBoxAudio.play("error");
      });
      return;
    }

    try {
      var ticket = {
        id: "BB-" + Date.now().toString(36).toUpperCase(),
        createdAt: new Date().toISOString(),
        demo: true,
        guest: !api || !api.token(),
        status: "Pending",
        customer: {
          name: field("name").value.trim(),
          email: field("email").value.trim(),
          phone: field("phone").value.trim(),
          house: field("house").value.trim(),
          street: field("street").value.trim(),
          city: field("city").value.trim(),
          state: field("state").value.trim(),
          pin: field("pin").value.trim(),
          instructions: field("instructions") ? field("instructions").value.trim() : "",
          address: [field("house").value, field("street").value, field("city").value, field("state").value, field("pin").value].map(function (s) { return s.trim(); }).filter(Boolean).join(", "),
          payment: payment.value
        },
        items: cart.map(function (item) {
          return { name: item.name, category: item.category || "", price: Number(item.price) || 0, quantity: Math.max(1, Number(item.quantity) || 1), img: item.img || "" };
        }),
        subtotal: result.subtotal,
        delivery: result.delivery,
        packaging: result.packaging,
        discount: result.discount + result.couponDiscount,
        coupon: result.coupon ? result.coupon.code : "",
        total: result.total
      };

      var tickets = [];
      try { tickets = JSON.parse(localStorage.getItem("biteboxTickets") || "[]"); } catch (e) { tickets = []; }
      if (!Array.isArray(tickets)) tickets = [];
      tickets.unshift(ticket);
      localStorage.setItem("biteboxTickets", JSON.stringify(tickets.slice(0, 20)));
      localStorage.setItem("biteboxLastOrder", JSON.stringify(ticket));
      localStorage.setItem("biteboxLastTicket", JSON.stringify(ticket));
      localStorage.removeItem(P.CART_KEY);
      try { localStorage.removeItem(P.COUPON_KEY); } catch (e2) {}
      saveAddress();
      if (window.BiteBoxAudio) BiteBoxAudio.play("success");
      window.location.href = "ordered.html";
    } catch (error) {
      submitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Place Order";
      console.error(error);
    }
  });
})();
