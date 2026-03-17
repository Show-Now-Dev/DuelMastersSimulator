(function () {
  const store = GameEngine.createStore(rootReducer);

  const statusTextEl = document.getElementById("status-text");
  const moveTargetEl = document.getElementById("move-target");

  const zoneEls = {
    battlefield: document.getElementById("zone-battlefield"),
    shield: document.getElementById("zone-shield"),
    deck: document.getElementById("zone-deck"),
    graveyard: document.getElementById("zone-graveyard"),
    mana: document.getElementById("zone-mana"),
    hand: document.getElementById("zone-hand"),
  };

  let selectedCardId = null;

  document.getElementById("draw-button").addEventListener("click", function () {
    store.dispatch(drawCard(PLAYER_ID));
    const s = store.getState();
    selectedCardId = s.selectedCardId || selectedCardId;
  });

  document.getElementById("shuffle-button").addEventListener("click", function () {
    store.dispatch(shuffleDeck(PLAYER_ID));
  });

  document.getElementById("reset-button").addEventListener("click", function () {
    store.dispatch(resetGame());
    selectedCardId = null;
  });

  moveTargetEl.addEventListener("change", function () {
    const state = store.getState();
    if (!selectedCardId) return;

    const toZone = moveTargetEl.value;
    const fromZone = findZoneContainingCard(state, selectedCardId);

    if (!fromZone || fromZone === toZone) return;

    store.dispatch(moveCard(selectedCardId, fromZone, toZone));
    const s = store.getState();
    selectedCardId = s.selectedCardId || selectedCardId;
  });

  function findZoneContainingCard(state, cardId) {
    const zones = state.zones;
    for (const key in zones) {
      if (Object.prototype.hasOwnProperty.call(zones, key)) {
        if (zones[key].cardIds.includes(cardId)) return key;
      }
    }
    return null;
  }

  function render() {
    const state = store.getState();

    renderZone(zoneEls.battlefield, state, state.zones.battlefield);
    renderZone(zoneEls.shield, state, state.zones.shield);
    renderZone(zoneEls.deck, state, state.zones.deck);
    renderZone(zoneEls.graveyard, state, state.zones.graveyard);
    renderZone(zoneEls.mana, state, state.zones.mana);
    renderZone(zoneEls.hand, state, state.zones.hand);

    statusTextEl.textContent = state.status || "Ready.";
  }

  function renderZone(container, state, zone) {
    container.innerHTML = "";

    const headerEl = document.createElement("div");
    headerEl.className = "zone-header";

    const titleEl = document.createElement("div");
    titleEl.className = "zone-title";
    titleEl.textContent = zone.name;

    const countEl = document.createElement("div");
    countEl.className = "zone-count";
    countEl.textContent = zone.cardIds.length + " cards";

    headerEl.appendChild(titleEl);
    headerEl.appendChild(countEl);

    const listEl = document.createElement("div");
    listEl.className = "card-list";
    listEl.dataset.zoneId = zone.id;

    if (zone.id === "shield") {
      if (zone.cardIds.length <= 5) {
        listEl.classList.add("card-list--shield-spread");
      } else {
        listEl.classList.add("card-list--shield-stack");
      }
    }

    // Deck contents are hidden; show count only.
    if (zone.id === "deck") {
      container.appendChild(headerEl);
      return;
    }

    zone.cardIds.forEach((cardId, idx) => {
      const card = state.cards[cardId];
      const cardEl = document.createElement("button");
      cardEl.type = "button";
      cardEl.className = "card" + (selectedCardId === cardId ? " is-selected" : "");
      cardEl.style.zIndex = String(idx + 1);

      if (card.isFaceDown) {
        const img = document.createElement("img");
        img.className = "card__back";
        img.alt = "Card Back";
        img.src = "./assets/images/card-back.png";
        img.addEventListener("error", function () {
          // Fallback: if the image is missing, show text instead of breaking layout.
          cardEl.textContent = "Card Back";
        });
        cardEl.appendChild(img);
      } else {
        const front = document.createElement("div");
        front.className = "card__front";

        const nameEl = document.createElement("div");
        nameEl.className = "card__name";
        nameEl.textContent = card.name;

        front.appendChild(nameEl);
        cardEl.appendChild(front);
      }

      cardEl.addEventListener("click", function () {
        selectedCardId = cardId;
        const s = store.getState();
        statusTextEl.textContent =
          "Selected " + (s.cards[cardId].isFaceDown ? "Card Back" : s.cards[cardId].name);
        render();
      });

      listEl.appendChild(cardEl);
    });

    container.appendChild(headerEl);
    container.appendChild(listEl);
  }

  store.subscribe(render);
  render();
})();