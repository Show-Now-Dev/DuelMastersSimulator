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

  var CARD_BACK    = "./src/assets/images/card-back.png";
  var GR_CARD_BACK = "./src/assets/images/GR-card-back.png";

  // Build a top-row (cost + name) element for one card face.
  function _buildTopRow(name, cost) {
    var topRow = document.createElement("div");
    topRow.className = "card__top-row";
    if (cost != null) {
      var costEl = document.createElement("span");
      costEl.className   = "card__cost";
      costEl.textContent = cost;
      topRow.appendChild(costEl);
    }
    var nameEl = document.createElement("span");
    nameEl.className   = "card__name";
    nameEl.textContent = name;
    topRow.appendChild(nameEl);
    return topRow;
  }

  // Append face-up or face-down content to a card element.
  // Shared between the board renderer and the modal renderer.
  function appendFace(cardEl, card) {
    if (card.isFaceDown) {
      var backSrc = card.isGRCard ? GR_CARD_BACK : CARD_BACK;
      var img     = document.createElement("img");
      img.className = "card__back";
      img.alt       = "Card Back";
      img.src       = backSrc;
      img.addEventListener("error", function () { cardEl.textContent = "?"; });
      cardEl.appendChild(img);
      return;
    }

    var vm    = buildCardViewModel(card);
    var front = document.createElement("div");

    // ── Twin card: split into top half (creature) + bottom half (spell) ──────
    if (vm.isTwin && vm.sides && vm.sides.length >= 2) {
      front.className = "card__front card__front--twin";

      vm.sides.forEach(function (side, i) {
        var half = document.createElement("div");
        half.className        = "card__half card__half--" + (i === 0 ? "top" : "bottom");
        half.style.background = side.backgroundStyle;

        half.appendChild(_buildTopRow(side.name, side.cost));

        if (side.power != null) {
          var powerEl = document.createElement("div");
          powerEl.className   = "card__power";
          powerEl.textContent = side.power;
          half.appendChild(powerEl);
        }

        front.appendChild(half);
      });

    // ── Normal card ───────────────────────────────────────────────────────────
    } else {
      front.className        = "card__front";
      front.style.background = vm.backgroundStyle;

      front.appendChild(_buildTopRow(vm.name, vm.cost));

      if (vm.power != null) {
        var powerEl2 = document.createElement("div");
        powerEl2.className   = "card__power";
        powerEl2.textContent = vm.power;
        front.appendChild(powerEl2);
      }
    }

    // Jokers badge — displayed in the bottom-right corner when vm.jokers is true.
    if (vm.jokers) {
      var badge = document.createElement('span');
      badge.className   = 'card__jokers-badge';
      badge.textContent = 'J';
      front.appendChild(badge);
    }

    cardEl.appendChild(front);
  }

  return { appendFace: appendFace };

}());
