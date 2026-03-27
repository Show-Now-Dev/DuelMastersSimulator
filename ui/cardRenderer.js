// ui/cardRenderer.js
//
// Builds the visual content of a single card element.
// Pure output: given a card object, mutates only the provided DOM element.
// No store access, no side effects beyond DOM mutation.
//
// Depends on (globals):
//   buildCardViewModel  — ui/viewModel.js
//
// Public API:
//   CardRenderer.appendFace(cardEl, card)
//     Appends face-up or face-down content to an existing card button element.
//     card: CardInstance shape ({ id, definitionId, isFaceDown })

var CardRenderer = (function () {

  var CARD_BACK = "./src/assets/images/card-back.png";

  // Append face-up or face-down content to a card element.
  // Shared between the board renderer and the modal renderer.
  function appendFace(cardEl, card) {
    if (card.isFaceDown) {
      var img     = document.createElement("img");
      img.className = "card__back";
      img.alt       = "Card Back";
      img.src       = CARD_BACK;
      img.addEventListener("error", function () { cardEl.textContent = "?"; });
      cardEl.appendChild(img);
    } else {
      var vm    = buildCardViewModel(card);
      var front = document.createElement("div");
      front.className        = "card__front";
      front.style.background = vm.backgroundStyle;

      // Top row: cost → name (left-aligned, top of card).
      var topRow = document.createElement("div");
      topRow.className = "card__top-row";

      if (vm.cost != null) {
        var costEl = document.createElement("span");
        costEl.className   = "card__cost";
        costEl.textContent = vm.cost;
        topRow.appendChild(costEl);
      }

      var nameEl = document.createElement("span");
      nameEl.className   = "card__name";
      nameEl.textContent = vm.name;
      topRow.appendChild(nameEl);

      front.appendChild(topRow);

      // Power at bottom-left.
      if (vm.power != null) {
        var powerEl = document.createElement("div");
        powerEl.className   = "card__power";
        powerEl.textContent = vm.power;
        front.appendChild(powerEl);
      }

      cardEl.appendChild(front);
    }
  }

  return { appendFace: appendFace };

}());
