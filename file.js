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
