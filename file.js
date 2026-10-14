(function () {
    "use strict";

    /* ---------- Settings (change here) ---------- */
    const DELIVERY_CHARGE  = 40;
    const PACKAGING_CHARGE = 20;
    const STORAGE_KEY      = "biteboxCart";

    /* ---------- Page elements ---------- */
    const menuBody  = document.getElementById("menu-body");   // menu table <tbody>
    const cartBody  = document.getElementById("cart-items");  // shopping cart <tbody>

    const itemCountEl = document.getElementById("item-count");
    const subtotalEl  = document.getElementById("subtotal-amount");
    const deliveryEl  = document.getElementById("delivery-amount");
    const packagingEl = document.getElementById("packaging-amount");
    const discountEl  = document.getElementById("discount-amount");
    const totalEl     = document.getElementById("total-amount");

    /* ---------- Cart data: [{name, category, price, img, quantity}] ---------- */
    let cart = loadCart();

    /* =====================================================
       CALCULATIONS
       ===================================================== */
    function calculateItemTotal(price, quantity) {
        return price * quantity;
    }

    function calculateSubtotal() {
        return cart.reduce(function (sum, item) {
            return sum + calculateItemTotal(item.price, item.quantity);
        }, 0);
    }

    function calculateDeliveryCharges(subtotal) {
        return subtotal > 0 ? DELIVERY_CHARGE : 0;
    }

    function calculatePackagingCharges(subtotal) {
        return subtotal > 0 ? PACKAGING_CHARGE : 0;
    }

    // 699-799 = 10%, 800-1000 = 15%, above 1000 = 25%
    function calculateDiscount(subtotal) {
        if (subtotal > 1000)  return subtotal * 0.25;
        if (subtotal >= 800)  return subtotal * 0.15;
        if (subtotal >= 699)  return subtotal * 0.10;
        return 0;
    }

    function calculateTotal(subtotal, delivery, packaging, discount) {
        return subtotal + delivery + packaging - discount;
    }

    function formatPrice(amount) {
        return "₹" + amount.toFixed(2);
    }

    /* =====================================================
       DISPLAY
       ===================================================== */
    function escapeHTML(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    const REMOVE_ICON =
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
        'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6" /></svg>';

    function renderCart() {
        cartBody.innerHTML = "";

        if (cart.length === 0) {
            const emptyRow = document.createElement("tr");
            emptyRow.className = "empty-row";
            emptyRow.innerHTML =
                '<td colspan="5">Your cart is empty. Use "Add to Cart" in the menu above to add a dish.</td>';
            cartBody.appendChild(emptyRow);
            updateOrderSummary();
            return;
        }

        cart.forEach(function (item, index) {
            const name = escapeHTML(item.name);
            const imageHTML = item.img
                ? '<img src="' + escapeHTML(item.img) + '" alt="' + name + '" width="56" height="56">'
                : "";

            const row = document.createElement("tr");
            row.innerHTML =
                '<td data-label="Item">' +
                    '<div class="cart-item">' + imageHTML +
                        "<div><h3>" + name + "</h3><p>" + escapeHTML(item.category) + "</p></div>" +
                    "</div>" +
                "</td>" +
                '<td data-label="Price" class="item-price">' + formatPrice(item.price) + "</td>" +
                '<td data-label="Quantity">' +
                    '<div class="qty">' +
                        '<button type="button" data-action="decrease" data-index="' + index + '" aria-label="Decrease quantity of ' + name + '">-</button>' +
                        '<span class="item-quantity">' + item.quantity + "</span>" +
                        '<button type="button" data-action="increase" data-index="' + index + '" aria-label="Increase quantity of ' + name + '">+</button>' +
                    "</div>" +
                "</td>" +
                '<td data-label="Total" class="item-total">' +
                    formatPrice(calculateItemTotal(item.price, item.quantity)) + "</td>" +
                '<td data-label="Action">' +
                    '<button type="button" class="remove" data-action="remove" data-index="' + index + '" aria-label="Remove ' + name + '">' +
                        REMOVE_ICON +
                    "</button>" +
                "</td>";

            cartBody.appendChild(row);
        });

        updateOrderSummary();
    }

    function updateOrderSummary() {
        const subtotal  = calculateSubtotal();
        const delivery  = calculateDeliveryCharges(subtotal);
        const packaging = calculatePackagingCharges(subtotal);
        const discount  = calculateDiscount(subtotal);
        const total     = calculateTotal(subtotal, delivery, packaging, discount);

        const itemCount = cart.reduce(function (count, item) {
            return count + item.quantity;
        }, 0);

        itemCountEl.textContent = "Subtotal (" + itemCount + (itemCount === 1 ? " Item)" : " Items)");
        subtotalEl.textContent  = formatPrice(subtotal);
        deliveryEl.textContent  = formatPrice(delivery);
        packagingEl.textContent = formatPrice(packaging);
        discountEl.textContent  = discount > 0 ? "-" + formatPrice(discount) : formatPrice(0);
        totalEl.textContent     = formatPrice(total);
    }

    /* =====================================================
       SAVE / LOAD (browser storage)
       ===================================================== */
    function saveCart() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
        } catch (error) {
            /* storage blocked: the cart still works, it just won't survive a refresh */
        }
    }

    function loadCart() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (Array.isArray(saved)) {
                return saved.filter(function (item) {
                    return item && item.name && Number(item.price) > 0 && Number(item.quantity) > 0;
                });
            }
        } catch (error) {
            /* ignore and start with an empty cart */
        }
        return [];
    }

    function refresh() {
        saveCart();
        renderCart();
    }

    /* =====================================================
       ADD TO CART (menu table)
       ===================================================== */
    menuBody.addEventListener("click", function (event) {
        const button = event.target.closest(".add-to-cart");
        if (!button || button.disabled) return;

        const name  = button.dataset.name;
        const price = Number(button.dataset.price);
        if (!name || !(price > 0)) return;

        const existing = cart.find(function (item) {
            return item.name === name;
        });

        if (existing) {
            existing.quantity++;
        } else {
            cart.push({
                name: name,
                category: button.dataset.category || "",
                price: price,
                img: button.dataset.img || "",
                quantity: 1
            });
        }

        refresh();

        // Small confirmation on the button
        const originalText = button.dataset.label || button.textContent;
        button.dataset.label = originalText;
        button.textContent = "Added ✓";
        clearTimeout(button._resetTimer);
        button._resetTimer = setTimeout(function () {
            button.textContent = originalText;
        }, 900);
    });

    /* =====================================================
       + / - / REMOVE (shopping cart table)
       ===================================================== */
    cartBody.addEventListener("click", function (event) {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        const index  = Number(button.dataset.index);
        const action = button.dataset.action;
        const item   = cart[index];
        if (!item) return;

        if (action === "increase") {
            item.quantity++;
        } else if (action === "decrease") {
            item.quantity--;
            if (item.quantity <= 0) cart.splice(index, 1);
        } else if (action === "remove") {
            cart.splice(index, 1);
        }

        refresh();
    });
    /* =====================================================
       PROCEED TO CHECKOUT
       ===================================================== */
    const checkoutBtn = document.getElementById("checkout-btn");

    checkoutBtn.addEventListener("click", function () {
        if (cart.length === 0) {
            alert("Your cart is empty. Add a dish from the menu first.");
            return;
        }
        window.location.href = "./ordernow.html";
    });
        /* =====================================================
       CLEAR CART
       ===================================================== */
    document.getElementById("clear-cart-btn").addEventListener("click", function () {
        if (cart.length === 0) return;

        if (confirm("Remove all items from your cart?")) {
            cart = [];
            refresh();
        }
    });
    /* ---------- First load ---------- */
    renderCart();
})();
/* =========================================================
   BITEBOX - ORDER NOW PAGE
   Reads the cart saved by file.js, shows the order recap and
   total, and clears the cart once the order is placed.
   Keep these charges/discount rules the same as in file.js.
   ========================================================= */
(function () {
    "use strict";

    const DELIVERY_CHARGE  = 40;
    const PACKAGING_CHARGE = 20;
    const CART_KEY         = "biteboxCart";
    const LAST_ORDER_KEY   = "biteboxLastOrder";

    const form        = document.getElementById("order-form");
    const submitBtn   = document.getElementById("order-submit");
    const itemsList   = document.getElementById("recap-items");
    const totalField  = document.getElementById("order-total-field");

    /* ---------- Load cart ---------- */
    function loadCart() {
        try {
            const saved = JSON.parse(localStorage.getItem(CART_KEY));
            if (Array.isArray(saved)) {
                return saved.filter(function (item) {
                    return item && item.name && Number(item.price) > 0 && Number(item.quantity) > 0;
                });
            }
        } catch (error) { /* start empty */ }
        return [];
    }

    const cart = loadCart();

    /* ---------- Calculations (same rules as the cart page) ---------- */
    function calculateDiscount(subtotal) {
        if (subtotal > 1000) return subtotal * 0.25;
        if (subtotal >= 800) return subtotal * 0.15;
        if (subtotal >= 699) return subtotal * 0.10;
        return 0;
    }

    function formatPrice(amount) {
        return "₹" + amount.toFixed(2);
    }

    const subtotal  = cart.reduce(function (sum, item) { return sum + item.price * item.quantity; }, 0);
    const delivery  = subtotal > 0 ? DELIVERY_CHARGE : 0;
    const packaging = subtotal > 0 ? PACKAGING_CHARGE : 0;
    const discount  = calculateDiscount(subtotal);
    const total     = subtotal + delivery + packaging - discount;

    /* ---------- Show recap ---------- */
    if (cart.length === 0) {
        const empty = document.createElement("li");
        empty.className = "recap-empty";
        empty.innerHTML = 'Your cart is empty. <a href="menu.html">Pick a dish</a> or <a href="cart.html">go to your cart</a>.';
        itemsList.appendChild(empty);

        submitBtn.disabled = true;
    } else {
        cart.forEach(function (item) {
            const li = document.createElement("li");

            const label = document.createElement("span");
            label.textContent = item.name + " × " + item.quantity;

            const amount = document.createElement("span");
            amount.textContent = formatPrice(item.price * item.quantity);

            li.appendChild(label);
            li.appendChild(amount);
            itemsList.appendChild(li);
        });
    }

    document.getElementById("recap-subtotal").textContent  = formatPrice(subtotal);
    document.getElementById("recap-delivery").textContent  = formatPrice(delivery);
    document.getElementById("recap-packaging").textContent = formatPrice(packaging);
    document.getElementById("recap-discount").textContent  = discount > 0 ? "-" + formatPrice(discount) : formatPrice(0);
    document.getElementById("recap-total").textContent     = formatPrice(total);

    totalField.value = total.toFixed(2);

    /* ---------- Place order ---------- */
    // The submit event only fires when every required field is valid.
    form.addEventListener("submit", function (event) {
        if (cart.length === 0) {
            event.preventDefault();
            return;
        }

        try {
            // Saved so ordered.html can show a confirmation if you want it to
            localStorage.setItem(LAST_ORDER_KEY, JSON.stringify({
                items: cart,
                subtotal: subtotal,
                delivery: delivery,
                packaging: packaging,
                discount: discount,
                total: total
            }));
            localStorage.removeItem(CART_KEY); // order placed: empty the cart
        } catch (error) { /* storage blocked: order still goes through */ }
    });
})();