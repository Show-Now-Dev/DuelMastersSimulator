(function () {
  const store = GameEngine.createStore(rootReducer);
  const appEl = document.getElementById("app");
  const statusTextEl = document.getElementById("status-text");
  const moveTargetEl = document.getElementById("move-target");

  document
    .getElementById("draw-button")
    .addEventListener("click", function () {
      store.dispatch(drawCard(PLAYER_ID));
    });

  document
    .getElementById("shuffle-button")
    .addEventListener("click", function () {
      store.dispatch(shuffleDeck(PLAYER_ID));
    });

  document
    .getElementById("reset-button")
    .addEventListener("click", function () {
      store.dispatch(resetGame());
    });

  moveTargetEl.addEventListener("change", function () {
    const state = store.getState();
    const selectedCardId = state.selectedCardId;
    if (!selectedCardId) {
      return;
    }

    const toZone = moveTargetEl.value;
    const fromZone = findZoneContainingCard(state, selectedCardId);
    if (!fromZone || fromZone === toZone) {
      return;
    }

    store.dispatch(moveCard(selectedCardId, fromZone, toZone));
  });

  function findZoneContainingCard(state, cardId) {
    const zones = state.zones;
    for (const key in zones) {
      if (Object.prototype.hasOwnProperty.call(zones, key)) {
        if (zones[key].cardIds.includes(cardId)) {
          return key;
        }
      }
    }
    return null;
  }

  function render() {
    const state = store.getState();

    appEl.innerHTML = "";

    renderZone(appEl, state, state.zones.deck);
    renderZone(appEl, state, state.zones.hand);
    renderZone(appEl, state, state.zones.battlefield);
    renderZone(appEl, state, state.zones.graveyard);
    renderZone(appEl, state, state.zones.mana);

    statusTextEl.textContent = state.status || "Ready.";
  }

  function renderZone(container, state, zone) {
    const zoneEl = document.createElement("section");
    zoneEl.className = "zone";

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

    zone.cardIds.forEach((cardId) => {
      const card = state.cards[cardId];
      const cardEl = document.createElement("button");
      cardEl.type = "button";
      cardEl.className = "card";
      cardEl.textContent = card.name;
      if (state.selectedCardId === cardId) {
        cardEl.style.borderColor = "#f97316";
      }
      cardEl.addEventListener("click", function () {
        const newState = store.getState();
        store.dispatch({
          type: "@@SELECT_CARD",
          payload: { cardId },
        });
        newState.selectedCardId = cardId;
      });
      listEl.appendChild(cardEl);
    });

    zoneEl.appendChild(headerEl);
    zoneEl.appendChild(listEl);
    container.appendChild(zoneEl);
  }

  // Simple internal action handler for selection without modifying reducer shape.
  const originalDispatch = store.dispatch;
  store.dispatch = function (action) {
    if (action.type === "@@SELECT_CARD") {
      const state = store.getState();
      state.selectedCardId = action.payload.cardId;
      state.status = "Selected " + state.cards[action.payload.cardId].name;
      originalDispatch({ type: "@@NO_OP" });
      return;
    }
    originalDispatch(action);
  };

  store.subscribe(render);
  render();
})();