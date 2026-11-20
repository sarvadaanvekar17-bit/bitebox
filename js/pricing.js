/* BiteBox 2.0 — Shared pricing (single source of truth).
   Preserves existing business rules exactly:
   delivery ₹40, packaging ₹20 (only when cart non-empty),
   discount: >₹1000 → 25%, ≥₹800 → 15%, ≥₹699 → 10%. */
(function () {
  "use strict";

  var DELIVERY_CHARGE = 40;
  var PACKAGING_CHARGE = 20;
  var CART_KEY = "biteboxCart";
  var COUPON_KEY = "biteboxCoupon";

  /* Demo coupons — client-side only, no backend. */
  var COUPONS = {
    BITE10:   { type: "percent", value: 10, max: 100, min: 0,    label: "10% off (max ₹100)" },
    BITE20:   { type: "percent", value: 20, min: 699,  label: "20% off orders ₹699+" },
    FREESHIP: { type: "freight", value: 0,   min: 0,    label: "Free delivery" }
  };

  function loadCart() {
    try {
      var saved = JSON.parse(localStorage.getItem(CART_KEY));
      if (Array.isArray(saved)) {
        return saved.filter(function (i) {
          return i && i.name && Number(i.price) > 0 && Number(i.quantity) > 0;
        });
      }
    } catch (e) { /* ignore */ }
    return [];
  }

  function compute(cart, couponCode) {
    var items = Array.isArray(cart) ? cart : [];
    var subtotal = items.reduce(function (s, i) { return s + Number(i.price) * Number(i.quantity); }, 0);
    var hasItems = items.length > 0;
    var delivery = hasItems ? DELIVERY_CHARGE : 0;
    var packaging = hasItems ? PACKAGING_CHARGE : 0;

    var discount = 0;
    if (subtotal > 1000) discount = subtotal * 0.25;
    else if (subtotal >= 800) discount = subtotal * 0.15;
    else if (subtotal >= 699) discount = subtotal * 0.10;

    var coupon = null, couponDiscount = 0, couponError = "";
    var code = String(couponCode || "").trim().toUpperCase();
    if (code) {
      coupon = COUPONS[code] || null;
      if (!coupon) couponError = "Invalid coupon code.";
      else if (subtotal < (coupon.min || 0)) couponError = "This coupon needs a higher order value.";
      else {
        if (coupon.type === "percent") couponDiscount = Math.min(subtotal * coupon.value / 100, coupon.max || Infinity);
        if (coupon.type === "freight") couponDiscount = delivery;
      }
    }

    var total = Math.max(0, subtotal + delivery + packaging - discount - couponDiscount);
    return {
      items: items.length,
      subtotal: subtotal,
      delivery: delivery,
      packaging: packaging,
      discount: discount,
      coupon: coupon && !couponError ? { code: code, label: coupon.label, discount: couponDiscount } : null,
      couponError: couponError,
      couponDiscount: couponDiscount,
      total: total
    };
  }

  window.BiteBoxPricing = {
    DELIVERY_CHARGE: DELIVERY_CHARGE,
    PACKAGING_CHARGE: PACKAGING_CHARGE,
    CART_KEY: CART_KEY,
    COUPON_KEY: COUPON_KEY,
    COUPONS: COUPONS,
    loadCart: loadCart,
    compute: compute
  };
})();
