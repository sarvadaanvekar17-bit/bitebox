let restaurantName = "BiteBox";

alert("Welcome to " + restaurantName + "!");

let customerName = prompt(
    "Welcome to " + restaurantName + "!\n\nWhat is your good name?"
);

alert(
    "Hello " + customerName + "!\n\nWelcome to BiteBox." );
    let exploreMenu = confirm(
    "Would you like to explore our Delicious menu?"
);
if (exploreMenu) {

    alert("Great! Let's explore the BiteBox menu.");

}

else {

    alert("No problem! You can explore the menu anytime later soon.");

}

//order summary//
function calculateItemTotal(price, quantity) {
    return price * quantity;
}
let cartRows=document.querySelectorAll("#cart-table tbody tr");

function calculateSubtotal() {
    let subtotal = 0;
    let cartRows = document.querySelectorAll("#cart-table tbody tr");
    cartRows.forEach(function (row) {
        let price = parseFloat(row.querySelector(".item-price").textContent.replace("₹", ""));
        let quantity = parseInt(row.querySelector(".item-quantity").textContent);
        subtotal += calculateItemTotal(price, quantity);
    });
    return subtotal;
}

function calculateDeliveryCharges(subtotal) {
    if (subtotal==0) {
        return 0;
    }
return 40;
}

function calculatePackagingCharges(subtotal) {
    if (subtotal==0) {
        return 0;
    }
return 20;
}

function calculateDiscount(subtotal) {
    if (subtotal >= 699 && subtotal <=799) {
        return subtotal * 0.10;
    }
    else if (subtotal >= 800 && subtotal <=1000) {
        return subtotal * 0.15;
    }
    else if (subtotal > 1000) {
        return subtotal * 0.25;
    }
    else {
        return 0;
    }
}

function calculateTotal(subtotal,deliverycharges,packagingcharges,discount) {
    return subtotal + deliverycharges + packagingcharges - discount;
}

function updateOrderSummary() {
    let subtotal = calculateSubtotal();
    let deliverycharges = calculateDeliveryCharges(subtotal);
    let packagingcharges = calculatePackagingCharges(subtotal);
    let discount = calculateDiscount(subtotal);
    let total = calculateTotal(subtotal,deliverycharges,packagingcharges,discount);

    document.getElementById("subtotal-amount").textContent = "₹" + subtotal.toFixed(2);
    document.getElementById("delivery-amount").textContent = "₹" + deliverycharges.toFixed(2);
    document.getElementById("packaging-amount").textContent = "₹" + packagingcharges.toFixed(2);
    document.getElementById("discount-amount").textContent = "₹" + discount.toFixed(2);
    document.getElementById("total-amount").textContent = "₹" + total.toFixed(2);
}
updateOrderSummary();