/* BiteBox 2.0 — Cart page: coupon handling + empty state.
   Cart items/qty/summary are rendered by file.js; pricing via pricing.js. */
(function () {
  "use strict";

  var P = window.BiteBoxPricing;
  if (!P) return;

  var form = document.getElementById("coupon-form");
  var input = document.getElementById("coupon-input");
  var msg = document.getElementById("coupon-msg");
  var couponRow = document.getElementById("coupon-row");
  var couponCodeEl = document.getElementById("coupon-code");
  var couponDiscEl = document.getElementById("coupon-discount");
  var totalEl = document.getElementById("total-amount");
  var emptyBox = document.getElementById("cart-empty");
  var tbody = document.getElementById("cart-items");

  var money = function (n) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  };

  function getCoupon() {
    try { return localStorage.getItem(P.COUPON_KEY) || ""; } catch (e) { return ""; }
  }
  function setCoupon(code) {
    try {
      if (code) localStorage.setItem(P.COUPON_KEY, code);
      else localStorage.removeItem(P.COUPON_KEY);
    } catch (e) {}
  }

  /* Re-apply coupon-adjusted figures after file.js renders the summary. */
  function refreshCouponView() {
    var cart = P.loadCart();
    var result = P.compute(cart, getCoupon());
    var hasCoupon = !!result.coupon;

    if (couponRow) {
      couponRow.hidden = !hasCoupon;
      if (hasCoupon) {
        couponCodeEl.textContent = result.coupon.code + " (" + result.coupon.label + ")";
        couponDiscEl.textContent = "−" + money(result.couponDiscount);
      }
    }
    /* Show coupon-adjusted payable total (file.js shows pre-coupon total). */
    if (totalEl && hasCoupon) totalEl.textContent = money(result.total);

    /* Empty state visibility mirrors file.js's empty row. */
    if (emptyBox && tbody) {
      emptyBox.hidden = cart.length > 0;
      var tableWrap = tbody.closest(".cart-table-wrap");
      if (tableWrap) tableWrap.style.display = cart.length ? "" : "none";
      var continueLink = document.querySelector(".continue-link");
      if (continueLink) continueLink.style.display = cart.length ? "" : "none";
    }
  }

  /* file.js re-renders on every cart action; re-apply coupon view right after. */
  document.addEventListener("click", function () {
    setTimeout(refreshCouponView, 0);
  });
  window.addEventListener("storage", refreshCouponView);

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var code = (input.value || "").trim().toUpperCase();
      if (!code) { msg.textContent = "Enter a coupon code first."; msg.className = "coupon-msg err"; return; }
      var result = P.compute(P.loadCart(), code);
      if (result.couponError) {
        msg.textContent = result.couponError;
        msg.className = "coupon-msg err";
        setCoupon("");
      } else {
        setCoupon(code);
        msg.textContent = "Coupon applied — " + result.coupon.label + "!";
        msg.className = "coupon-msg ok";
        if (input) input.value = "";
      }
      refreshCouponView();
    });
  }

  /* Pre-fill a previously applied coupon quietly. */
  var saved = getCoupon();
  if (saved) {
    var r = P.compute(P.loadCart(), saved);
    if (r.coupon) {
      msg.textContent = "Coupon " + saved + " applied.";
      msg.className = "coupon-msg ok";
    } else setCoupon("");
  }
  refreshCouponView();
})();
