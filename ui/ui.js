(function () {
  const store = GameEngine.createStore(rootReducer);

  const statusTextEl = document.getElementById("status-text");
  const moveTargetEl = document.getElementById("move-target");
  const moveButtonEl = document.getElementById("move-button");
  const toggleTapButtonEl = document.getElementById("toggle-tap-button");
  const toggleFaceButtonEl = document.getElementById("toggle-face-button");

  const CARD_BACK = "./src/assets/images/card-back.png";

  const zoneEls = {
    battlefield: document.getElementById("zone-battlefield"),
    stack: document.getElementById("zone-stack"),
    shield: document.getElementById("zone-shield"),
    deck: document.getElementById("zone-deck"),
    graveyard: document.getElementById("zone-graveyard"),
    ex: document.getElementById("zone-ex"),
    gr: document.getElementById("zone-gr"),
    mana: document.getElementById("zone-mana"),
    hand: document.getElementById("zone-hand"),
  };

  document.getElementById("draw-button").addEventListener("click", function () {
    store.dispatch(drawCard(PLAYER_ID));
  });

  document.getElementById("shuffle-button").addEventListener("click", function () {
    store.dispatch(shuffleDeck(PLAYER_ID));
  });

  document.getElementById("reset-button").addEventListener("click", function () {
    store.dispatch(resetGame());
  });

  toggleTapButtonEl.addEventListener("click", function () {
    const state = store.getState();
    const selected = state.ui && state.ui.selectedCardIds ? state.ui.selectedCardIds : [];
    if (!selected.length) return;
    store.dispatch(toggleTapSelectedCards());
  });

  toggleFaceButtonEl.addEventListener("click", function () {
    const state = store.getState();
    const selected = state.ui && state.ui.selectedCardIds ? state.ui.selectedCardIds : [];
    if (!selected.length) return;
    store.dispatch(toggleFaceSelectedCards());
  });

  moveTargetEl.addEventListener("change", function () {
    const toZone = moveTargetEl.value;
    store.dispatch(setSelectedTargetZone(toZone));
  });

  moveButtonEl.addEventListener("click", function () {
    const state = store.getState();
    const ui = state.ui || {};
    const selected = ui.selectedCardIds || [];
    const toZone = ui.selectedTargetZone || moveTargetEl.value;
    if (!selected.length || !toZone) return;
    store.dispatch(moveSelectedCards(toZone));
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

    // Keep dropdown in sync with UI state, but don't overwrite
    // if no target has been chosen yet.
    if (state.ui && state.ui.selectedTargetZone) {
      moveTargetEl.value = state.ui.selectedTargetZone;
    }

    renderZone(zoneEls.battlefield, state, state.zones.battlefield);
    // UI-only zones (not in game state) use empty cardIds.
    renderZone(zoneEls.stack, state, {
      id: "stack",
      name: "Stack",
      cardIds: [],
    });
    renderZone(zoneEls.shield, state, state.zones.shield);
    renderZone(zoneEls.deck, state, state.zones.deck);
    renderZone(zoneEls.graveyard, state, state.zones.graveyard);
    renderZone(zoneEls.ex, state, {
      id: "ex",
      name: "EX",
      cardIds: [],
    });
    renderZone(zoneEls.gr, state, {
      id: "gr",
      name: "GR",
      cardIds: [],
    });
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

    const selectedIds = state.ui && state.ui.selectedCardIds ? state.ui.selectedCardIds : [];

    // Unified layout algorithm for ALL zones:
    // Cards are positioned absolutely, and spacing shrinks to overlap when needed.
    container.appendChild(headerEl);
    container.appendChild(listEl);

    const cardCount = zone.cardIds.length;
    const containerWidth = listEl.clientWidth || container.clientWidth || 0;
    const cardWidth = 80;
    const cardHeight = 120;
    const effectiveWidth = cardHeight; // account for tapped (rotated) cards

    let safeSpacing = 0;
    if (cardCount > 0 && containerWidth > 0) {
      const spacing = Math.min(
        effectiveWidth,
        (containerWidth - effectiveWidth) / Math.max(1, cardCount - 1)
      );
      safeSpacing = Number.isFinite(spacing) ? Math.max(0, spacing) : 0;
    }

    // Compact zones: force full overlap regardless of spacing.
    if (container.classList.contains("compact-zone")) {
      safeSpacing = 0;
    }

    zone.cardIds.forEach((cardId, idx) => {
      const card = state.cards[cardId];
      const cardEl = document.createElement("button");
      cardEl.type = "button";
      let className = "card";
      if (selectedIds.includes(cardId)) {
        className += " is-selected";
      }
      if (card.isTapped) {
        className += " is-tapped";
      }
      cardEl.className = className;
      cardEl.style.zIndex = String(idx + 1);
      cardEl.style.left = safeSpacing * idx + "px";
      cardEl.style.top = "0px";

      if (card.isFaceDown) {
        const img = document.createElement("img");
        img.className = "card__back";
        img.alt = "Card Back";
        img.src = CARD_BACK;
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
        store.dispatch(toggleCardSelection(cardId));
      });

      listEl.appendChild(cardEl);
    });
  }

  store.subscribe(render);
  render();
})();