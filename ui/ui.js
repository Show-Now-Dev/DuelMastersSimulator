(function () {

  // ── Startup: load card/deck definitions, then initialize ───────────────────
  Promise.all([
    fetch("./src/data/cards.json").then(function (r) { return r.json(); }),
    fetch("./src/data/decks.json").then(function (r) { return r.json(); }),
  ]).then(function (results) {
    CARD_DEFINITIONS = results[0];

    var deck = results[1][0]; // deck_sample (first deck)
    var nextInstanceId = 1;
    INITIAL_DECK_INSTANCES = [];
    deck.cards.forEach(function (entry) {
      for (var i = 0; i < entry.count; i++) {
        INITIAL_DECK_INSTANCES.push({
          id:           "ci_" + nextInstanceId++,
          definitionId: entry.cardId,
          isFaceDown:   true,
        });
      }
    });

    init();
  });

  function init() {

  // ── Two separate stores ────────────────────────────────────────────────────
  // gameStore: card/stack/zone data and selectedCardIds.
  // uiStore:   selectedTargetZone and modal.  Never mixed.
  const gameStore = GameEngine.createStore(rootReducer);
  const uiStore   = GameEngine.createStore(uiReducer);

  // ── Ephemeral pick-mode state (not persisted in any store) ─────────────────
  let targetStackId        = null;
  let isPickingTargetStack = false;

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const statusTextEl        = document.getElementById("status-text");
  const moveTargetEl        = document.getElementById("move-target");
  const moveButtonEl        = document.getElementById("move-button");
  const toggleTapButtonEl   = document.getElementById("toggle-tap-button");
  const toggleFaceButtonEl  = document.getElementById("toggle-face-button");
  const pickStackButtonEl   = document.getElementById("pick-stack-button");
  const stackTopButtonEl    = document.getElementById("stack-top-button");
  const stackBottomButtonEl = document.getElementById("stack-bottom-button");
  const boardEl             = document.getElementById("layout");
  const modalLayerEl        = document.getElementById("modal-layer");

  const CARD_BACK = "./src/assets/images/card-back.png";

  // All zones rendered from GameState — EX and GR are now full GameState zones.
  const zoneEls = {
    [ZONE_IDS.BATTLEFIELD]:     document.getElementById("zone-battlefield"),
    [ZONE_IDS.RESOLUTION_ZONE]: document.getElementById("zone-stack"),
    [ZONE_IDS.SHIELD]:          document.getElementById("zone-shield"),
    [ZONE_IDS.DECK]:            document.getElementById("zone-deck"),
    [ZONE_IDS.GRAVEYARD]:       document.getElementById("zone-graveyard"),
    [ZONE_IDS.MANA]:            document.getElementById("zone-mana"),
    [ZONE_IDS.HAND]:            document.getElementById("zone-hand"),
    [ZONE_IDS.EX]:              document.getElementById("zone-ex"),
    [ZONE_IDS.GR]:              document.getElementById("zone-gr"),
  };

  // Stacked zones: clicking them opens the CARD_SELECTOR modal for the whole zone.
  // Cards are never selected individually in these zones from the board.
  const STACKED_ZONE_IDS = [
    ZONE_IDS.DECK,
    ZONE_IDS.GRAVEYARD,
    ZONE_IDS.EX,
    ZONE_IDS.GR,
  ];

  // ── Parse the "move to" dropdown value into { zoneId, position } ───────────
  //
  // Dropdown values encode both zone and position for zones with ordering:
  //   "deck-top"    → DECK zone, position "top"   (insert as new top card)
  //   "deck-bottom" → DECK zone, position "bottom" (insert as new bottom card)
  //   anything else → that zone, position "bottom"  (graveyard top enforced by reducer)
  function parseMoveTarget(value) {
    if (value === "deck-top")    return { zoneId: ZONE_IDS.DECK, position: "top" };
    if (value === "deck-bottom") return { zoneId: ZONE_IDS.DECK, position: "bottom" };
    return { zoneId: value, position: "bottom" };
  }

  // ── Game-store event listeners ─────────────────────────────────────────────

  document.getElementById("draw-button").addEventListener("click", function () {
    gameStore.dispatch(drawCard(PLAYER_ID));
  });

  document.getElementById("shuffle-button").addEventListener("click", function () {
    gameStore.dispatch(shuffleDeck(PLAYER_ID));
  });

  document.getElementById("reset-button").addEventListener("click", function () {
    targetStackId = null;
    exitPickMode();
    uiStore.dispatch(closeModal());
    gameStore.dispatch(resetGame());
  });

  toggleTapButtonEl.addEventListener("click", function () {
    if (!(gameStore.getState().selectedCardIds || []).length) return;
    gameStore.dispatch(toggleTapSelectedCards());
  });

  toggleFaceButtonEl.addEventListener("click", function () {
    if (!(gameStore.getState().selectedCardIds || []).length) return;
    gameStore.dispatch(toggleFaceSelectedCards());
  });

  // ── UI-store event listeners ───────────────────────────────────────────────

  // Dropdown change updates uiStore only — game state is unaffected.
  moveTargetEl.addEventListener("change", function () {
    uiStore.dispatch(setSelectedTargetZone(moveTargetEl.value));
  });

  // Move reads selectedCardIds from game state; target zone+position from dropdown.
  moveButtonEl.addEventListener("click", function () {
    const gameState = gameStore.getState();
    const uiSt      = uiStore.getState();
    const raw       = uiSt.selectedTargetZone || moveTargetEl.value;
    const parsed    = parseMoveTarget(raw);
    if (!(gameState.selectedCardIds || []).length || !parsed.zoneId) return;
    gameStore.dispatch(moveSelectedCards(parsed.zoneId, parsed.position));
  });

  // ── Pick-mode & stack buttons ──────────────────────────────────────────────

  pickStackButtonEl.addEventListener("click", function () {
    isPickingTargetStack ? exitPickMode() : enterPickMode();
  });

  stackTopButtonEl.addEventListener("click", function () {
    if (!targetStackId || !(gameStore.getState().selectedCardIds || []).length) return;
    gameStore.dispatch(stackSelectedCards(targetStackId, "top"));
    targetStackId = null;
    render();
  });

  stackBottomButtonEl.addEventListener("click", function () {
    if (!targetStackId || !(gameStore.getState().selectedCardIds || []).length) return;
    gameStore.dispatch(stackSelectedCards(targetStackId, "bottom"));
    targetStackId = null;
    render();
  });

  function enterPickMode() {
    isPickingTargetStack = true;
    pickStackButtonEl.classList.add("is-active");
    boardEl.classList.add("pick-target-mode");
  }

  function exitPickMode() {
    isPickingTargetStack = false;
    pickStackButtonEl.classList.remove("is-active");
    boardEl.classList.remove("pick-target-mode");
  }

  // ── Stacked zone click handlers (attached once at startup) ─────────────────
  // Clicking anywhere in the zone padding/background opens the card-selector modal.
  // Card clicks within these zones also open the modal (handled in renderZone).

  STACKED_ZONE_IDS.forEach(function (zoneId) {
    var el = zoneEls[zoneId];
    if (!el) return;
    var visibility = (zoneId === ZONE_IDS.DECK) ? "hidden" : "all";
    el.addEventListener("click", function () {
      uiStore.dispatch(openModal({ type: "zone", id: zoneId }, "multiple", visibility));
    });
  });

  // ── Modal: close on overlay click or Escape ────────────────────────────────

  modalLayerEl.addEventListener("click", function (e) {
    if (e.target === modalLayerEl) uiStore.dispatch(closeModal());
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && uiStore.getState().modal) {
      uiStore.dispatch(closeModal());
    }
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  // Called whenever either store changes state.

  function render() {
    const gameState = gameStore.getState();
    const uiSt      = uiStore.getState();

    // Stale targetStackId guard (stack may have been destroyed by a game action).
    if (targetStackId && !gameState.stacks[targetStackId]) {
      targetStackId = null;
    }

    // Keep the dropdown value in sync with uiState.
    if (uiSt.selectedTargetZone) {
      moveTargetEl.value = uiSt.selectedTargetZone;
    }

    // Button enable/disable.
    const hasSelected = (gameState.selectedCardIds || []).length > 0;
    const hasTarget   = !!targetStackId;
    stackTopButtonEl.disabled    = !hasSelected || !hasTarget;
    stackBottomButtonEl.disabled = !hasSelected || !hasTarget;

    // Board zones — all zones including EX and GR are in zoneEls.
    Object.keys(zoneEls).forEach(function (zoneId) {
      const zone = gameState.zones[zoneId];
      if (zone) renderZone(zoneEls[zoneId], gameState, zone);
    });

    // Modal layer (rendered above the board).
    renderModal(gameState, uiSt);

    statusTextEl.textContent = gameState.status || "Ready.";
  }

  // ── Zone rendering ─────────────────────────────────────────────────────────

  function getCardWidth() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--card-w").trim();
    return parseFloat(raw) || 80;
  }

  function renderZone(container, gameState, zone) {
    container.innerHTML = "";

    const stacks      = gameState.stacks || {};
    const stackIds    = zone.stackIds || [];
    const selectedIds = gameState.selectedCardIds || [];
    const isStacked   = STACKED_ZONE_IDS.indexOf(zone.id) !== -1;

    // Header
    const headerEl = document.createElement("div");
    headerEl.className = "zone-header";

    const titleEl = document.createElement("div");
    titleEl.className = "zone-title";
    titleEl.textContent = zone.name;

    const countEl = document.createElement("div");
    countEl.className = "zone-count";
    const totalCards = stackIds.reduce(function (sum, sid) {
      const s = stacks[sid];
      return sum + (s ? s.cardIds.length : 0);
    }, 0);
    countEl.textContent = totalCards + " cards";

    headerEl.appendChild(titleEl);
    headerEl.appendChild(countEl);

    const listEl = document.createElement("div");
    listEl.className = "card-list";
    listEl.dataset.zoneId = zone.id;

    container.appendChild(headerEl);
    container.appendChild(listEl);

    const cardWidth      = getCardWidth();
    const stackCount     = stackIds.length;
    const containerWidth = listEl.clientWidth || container.clientWidth || 0;

    let stackSpacing = 0;
    if (stackCount > 1 && containerWidth > 0) {
      const maxFit = (containerWidth - cardWidth) / (stackCount - 1);
      stackSpacing = Math.max(0, Math.min(cardWidth + 4, maxFit));
    }
    if (container.classList.contains("compact-zone")) {
      stackSpacing = 0;
    }

    const DEPTH_OFFSET = Math.max(2, Math.round(cardWidth * 0.04));

    stackIds.forEach(function (stackId, stackIdx) {
      const stack = stacks[stackId];
      if (!stack) return;

      const stackLeft  = stackSpacing * stackIdx;
      const stackSize  = stack.cardIds.length;
      const isTarget   = stackId === targetStackId;
      const stackBaseZ = (stackCount - stackIdx) * 100;

      stack.cardIds.forEach(function (cardId, cardIdx) {
        const card = gameState.cards[cardId];
        if (!card) return;

        const depth     = stackSize - 1 - cardIdx; // 0 = top card
        const isTopCard = (depth === 0);

        const cardEl = document.createElement("button");
        cardEl.type  = "button";

        let cls = "card";
        if (!isStacked && selectedIds.indexOf(cardId) !== -1) cls += " is-selected";
        if (stack.isTapped)                                   cls += " is-tapped";
        if (isTarget)                                         cls += " is-target-stack";
        cardEl.className = cls;

        cardEl.style.zIndex = String(stackBaseZ + cardIdx);
        cardEl.style.left   = (stackLeft + depth) + "px";
        cardEl.style.top    = (depth * DEPTH_OFFSET) + "px";

        appendCardFace(cardEl, card);

        // ── Click behavior ─────────────────────────────────────────────────
        cardEl.addEventListener("click", function (e) {
          e.stopPropagation();

          if (isPickingTargetStack) {
            targetStackId = stackId;
            exitPickMode();
            render();
            return;
          }

          // Stacked zones (Deck, Graveyard, EX, GR): any card click opens the
          // zone modal.  Individual card selection does not happen here.
          if (isStacked) {
            var vis = (zone.id === ZONE_IDS.DECK) ? "hidden" : "all";
            uiStore.dispatch(openModal({ type: "zone", id: zone.id }, "multiple", vis));
            return;
          }

          // Normal zones: top card of multi-card stack selects all; non-top opens modal.
          if (stackSize > 1) {
            if (isTopCard) {
              // Clicking the top card selects all cards in the stack at once.
              // If all are already selected, clear instead (toggle-all behaviour).
              const allSelected = stack.cardIds.every(function (id) {
                return selectedIds.indexOf(id) !== -1;
              });
              gameStore.dispatch(allSelected
                ? clearSelection()
                : selectCards(stack.cardIds.slice()));
            } else {
              // Non-top card: open the card selector modal for this stack.
              uiStore.dispatch(openModal({ type: "stack", id: stackId }, "multiple", "all"));
            }
          } else {
            // Single-card stack: toggle selection.
            gameStore.dispatch(toggleCardSelection(cardId));
          }
        });

        listEl.appendChild(cardEl);
      });

      // Depth badge on multi-card stacks (not shown in stacked zones — count is in header).
      if (stackSize > 1 && !isStacked) {
        const badge       = document.createElement("div");
        badge.className   = "stack-badge";
        badge.textContent = stackSize;
        badge.style.left   = (stackLeft + cardWidth - 26) + "px";
        badge.style.top    = "4px";
        badge.style.zIndex = String(stackBaseZ + stackSize + 1);
        listEl.appendChild(badge);
      }
    });
  }

  // Append face-up or face-down content to a card element.
  // Shared between the board renderer and the modal renderer.
  function appendCardFace(cardEl, card) {
    if (card.isFaceDown) {
      const img     = document.createElement("img");
      img.className = "card__back";
      img.alt       = "Card Back";
      img.src       = CARD_BACK;
      img.addEventListener("error", function () { cardEl.textContent = "?"; });
      cardEl.appendChild(img);
    } else {
      const vm    = buildCardViewModel(card);
      const front = document.createElement("div");
      front.className = "card__front";

      front.style.background = vm.backgroundStyle;

      // Top row: cost → name (left to right, top-aligned).
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

  // ── Modal rendering ────────────────────────────────────────────────────────
  // The modal layer is always rebuilt from scratch on every render call.

  function renderModal(gameState, uiSt) {
    const modal = uiSt.modal;

    if (!modal) {
      modalLayerEl.classList.remove("is-open");
      modalLayerEl.innerHTML = "";
      return;
    }

    if (modal.type === "CARD_SELECTOR") {
      renderCardSelectorModal(gameState, modal);
    }

    modalLayerEl.classList.add("is-open");
  }

  // ── CARD_SELECTOR modal ────────────────────────────────────────────────────
  // Reusable for both stack sources and zone sources (Deck, Graveyard, EX, GR).

  // Returns an ordered array of cardIds to display in the modal (top-first).
  // Returns null if the source no longer exists (e.g. stack was destroyed).
  function getModalCardIds(gameState, modal) {
    var source = modal.source;

    if (source.type === "stack") {
      var stack = gameState.stacks[source.id];
      if (!stack) return null; // source destroyed
      // cardIds stored bottom→top; reverse so top card is at index 0.
      return stack.cardIds.slice().reverse();
    }

    if (source.type === "zone") {
      var zone = gameState.zones[source.id];
      if (!zone) return [];
      // Collect cards in zone order: stackIds[0] is top, each stack's cards top-first.
      var ordered = [];
      zone.stackIds.forEach(function (stackId) {
        var s = gameState.stacks[stackId];
        if (!s) return;
        s.cardIds.slice().reverse().forEach(function (cardId) { ordered.push(cardId); });
      });
      return ordered;
    }

    return [];
  }

  // Returns a (possibly synthetic) card object with visibility applied.
  //   "all"   → card as-is (respects card.isFaceDown)
  //   "hidden"→ force isFaceDown = true (show back regardless of actual state)
  //   "top-n" → first modal.topN cards as-is, rest forced face-down
  function applyVisibility(card, displayIdx, modal) {
    if (modal.visibility === "hidden") {
      return Object.assign({}, card, { isFaceDown: true });
    }
    if (modal.visibility === "top-n") {
      var topN = modal.topN || 3;
      if (displayIdx >= topN) {
        return Object.assign({}, card, { isFaceDown: true });
      }
    }
    return card;
  }

  function getModalTitle(gameState, modal) {
    var source = modal.source;
    var count  = 0;

    if (source.type === "stack") {
      var stack = gameState.stacks[source.id];
      count = stack ? stack.cardIds.length : 0;
      return "Select cards in stack (" + count + ")";
    }

    if (source.type === "zone") {
      var zone = gameState.zones[source.id];
      if (zone) {
        zone.stackIds.forEach(function (sid) {
          var s = gameState.stacks[sid];
          if (s) count += s.cardIds.length;
        });
        return zone.name + " — select cards (" + count + ")";
      }
    }

    return "Select cards";
  }

  function renderCardSelectorModal(gameState, modal) {
    var cardIds = getModalCardIds(gameState, modal);

    if (cardIds === null) {
      // Source stack was destroyed while modal was open — close it next tick.
      modalLayerEl.classList.remove("is-open");
      modalLayerEl.innerHTML = "";
      setTimeout(function () { uiStore.dispatch(closeModal()); }, 0);
      return;
    }

    modalLayerEl.innerHTML = "";

    const panel = document.createElement("div");
    panel.className = "modal-panel";

    // ── Header ──────────────────────────────────────────────────────────────
    const header = document.createElement("div");
    header.className = "modal-header";

    const title = document.createElement("span");
    title.className   = "modal-title";
    title.textContent = getModalTitle(gameState, modal);

    const closeBtn = document.createElement("button");
    closeBtn.className   = "modal-close-btn";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", function () {
      uiStore.dispatch(closeModal());
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // ── Card list (displayed top-first) ─────────────────────────────────────
    const cardListEl = document.createElement("div");
    cardListEl.className = "modal-card-list";

    cardIds.forEach(function (cardId, displayIdx) {
      const card = gameState.cards[cardId];
      if (!card) return;

      const isModalSelected = modal.selectedCardIds.indexOf(cardId) !== -1;
      const displayCard     = applyVisibility(card, displayIdx, modal);

      const cardEl     = document.createElement("button");
      cardEl.type      = "button";
      cardEl.className = "modal-card" + (isModalSelected ? " is-selected" : "");

      appendCardFace(cardEl, displayCard);

      // Position label.
      const posLabel       = document.createElement("div");
      posLabel.className   = "modal-card-position";
      posLabel.textContent = displayIdx === 0 ? "Top" : "#" + (displayIdx + 1);
      cardEl.appendChild(posLabel);

      // Toggle this card within the modal's internal selection.
      cardEl.addEventListener("click", function () {
        const currentSel = uiStore.getState().modal.selectedCardIds;
        const alreadySel = currentSel.indexOf(cardId) !== -1;
        const nextSel    = alreadySel
          ? currentSel.filter(function (id) { return id !== cardId; })
          : currentSel.concat([cardId]);
        uiStore.dispatch(selectModalCards(nextSel));
      });

      cardListEl.appendChild(cardEl);
    });

    panel.appendChild(cardListEl);

    // ── Footer: bulk actions + confirm ──────────────────────────────────────
    const footer = document.createElement("div");
    footer.className = "modal-footer";

    const selectAllBtn       = document.createElement("button");
    selectAllBtn.textContent = "Select all";
    selectAllBtn.addEventListener("click", function () {
      uiStore.dispatch(selectModalCards(cardIds.slice()));
    });

    const clearBtn       = document.createElement("button");
    clearBtn.textContent = "Clear";
    clearBtn.addEventListener("click", function () {
      uiStore.dispatch(selectModalCards([]));
    });

    // Confirm: push the modal selection into the game's selectedCardIds,
    // then close the modal.  The user can then act on them (move, tap, etc.).
    const confirmBtn       = document.createElement("button");
    confirmBtn.className   = "modal-confirm-btn";
    confirmBtn.textContent = "Confirm selection";
    confirmBtn.addEventListener("click", function () {
      const sel = uiStore.getState().modal.selectedCardIds;
      if (sel.length > 0) {
        gameStore.dispatch(selectCards(sel));
      }
      uiStore.dispatch(closeModal());
    });

    footer.appendChild(selectAllBtn);
    footer.appendChild(clearBtn);
    footer.appendChild(confirmBtn);
    panel.appendChild(footer);

    modalLayerEl.appendChild(panel);
  }

  // ── Subscribe both stores to the same render function ─────────────────────
  gameStore.subscribe(render);
  uiStore.subscribe(render);
  window.addEventListener("resize", render);
  render();

  } // end init()

})();
