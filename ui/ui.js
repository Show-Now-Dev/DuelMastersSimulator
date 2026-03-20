(function () {
  const store = GameEngine.createStore(rootReducer);

  // ── UI-local state ─────────────────────────────────────────────────────────
  // These are purely presentational — they never enter the game reducer.
  let targetStackId        = null;  // stackId the user has chosen to stack onto
  let isPickingTargetStack = false; // whether the next card click sets targetStackId

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const statusTextEl       = document.getElementById("status-text");
  const moveTargetEl       = document.getElementById("move-target");
  const moveButtonEl       = document.getElementById("move-button");
  const toggleTapButtonEl  = document.getElementById("toggle-tap-button");
  const toggleFaceButtonEl = document.getElementById("toggle-face-button");
  const pickStackButtonEl  = document.getElementById("pick-stack-button");
  const stackTopButtonEl   = document.getElementById("stack-top-button");
  const stackBottomButtonEl = document.getElementById("stack-bottom-button");
  const boardEl            = document.getElementById("layout");

  const CARD_BACK = "./src/assets/images/card-back.png";

  // Zone DOM elements keyed by game-state zone ID.
  // The resolution zone reuses the "zone-stack" element (layout/CSS name unchanged).
  const zoneEls = {
    [ZONE_IDS.BATTLEFIELD]:     document.getElementById("zone-battlefield"),
    [ZONE_IDS.RESOLUTION_ZONE]: document.getElementById("zone-stack"),
    [ZONE_IDS.SHIELD]:          document.getElementById("zone-shield"),
    [ZONE_IDS.DECK]:            document.getElementById("zone-deck"),
    [ZONE_IDS.GRAVEYARD]:       document.getElementById("zone-graveyard"),
    [ZONE_IDS.MANA]:            document.getElementById("zone-mana"),
    [ZONE_IDS.HAND]:            document.getElementById("zone-hand"),
  };

  const exEl = document.getElementById("zone-ex");
  const grEl = document.getElementById("zone-gr");

  // ── Event listeners ────────────────────────────────────────────────────────

  document.getElementById("draw-button").addEventListener("click", function () {
    store.dispatch(drawCard(PLAYER_ID));
  });

  document.getElementById("shuffle-button").addEventListener("click", function () {
    store.dispatch(shuffleDeck(PLAYER_ID));
  });

  document.getElementById("reset-button").addEventListener("click", function () {
    targetStackId = null;
    exitPickMode();
    store.dispatch(resetGame());
  });

  toggleTapButtonEl.addEventListener("click", function () {
    if (!(store.getState().selectedCardIds || []).length) return;
    store.dispatch(toggleTapSelectedCards());
  });

  toggleFaceButtonEl.addEventListener("click", function () {
    if (!(store.getState().selectedCardIds || []).length) return;
    store.dispatch(toggleFaceSelectedCards());
  });

  moveTargetEl.addEventListener("change", function () {
    store.dispatch(setSelectedTargetZone(moveTargetEl.value));
  });

  moveButtonEl.addEventListener("click", function () {
    const state  = store.getState();
    const toZone = (state.ui && state.ui.selectedTargetZone) || moveTargetEl.value;
    if (!(state.selectedCardIds || []).length || !toZone) return;
    store.dispatch(moveSelectedCards(toZone));
  });

  // "Pick target stack" toggles the picking mode on/off.
  pickStackButtonEl.addEventListener("click", function () {
    if (isPickingTargetStack) {
      exitPickMode();
    } else {
      enterPickMode();
    }
  });

  stackTopButtonEl.addEventListener("click", function () {
    if (!targetStackId || !(store.getState().selectedCardIds || []).length) return;
    store.dispatch(stackSelectedCards(targetStackId, "top"));
    targetStackId = null;
    render();
  });

  stackBottomButtonEl.addEventListener("click", function () {
    if (!targetStackId || !(store.getState().selectedCardIds || []).length) return;
    store.dispatch(stackSelectedCards(targetStackId, "bottom"));
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

  // ── Render ─────────────────────────────────────────────────────────────────

  function render() {
    const state = store.getState();

    // Clear stale targetStackId if the stack was destroyed by a game action.
    if (targetStackId && !state.stacks[targetStackId]) {
      targetStackId = null;
    }

    if (state.ui && state.ui.selectedTargetZone) {
      moveTargetEl.value = state.ui.selectedTargetZone;
    }

    // Enable/disable stack buttons.
    const hasSelected = (state.selectedCardIds || []).length > 0;
    const hasTarget   = !!targetStackId;
    stackTopButtonEl.disabled    = !hasSelected || !hasTarget;
    stackBottomButtonEl.disabled = !hasSelected || !hasTarget;

    Object.keys(zoneEls).forEach(function (zoneId) {
      const zone = state.zones[zoneId];
      if (zone) renderZone(zoneEls[zoneId], state, zone);
    });

    renderZone(exEl, state, { id: "ex", name: "EX", stackIds: [] });
    renderZone(grEl, state, { id: "gr", name: "GR", stackIds: [] });

    statusTextEl.textContent = state.status || "Ready.";
  }

  // ── Zone rendering ─────────────────────────────────────────────────────────
  //
  // Each zone iterates its stacks left-to-right (horizontal spacing).
  // Within each stack, cards are offset downward (bottom→top = highest z-index on top).
  // The top card of each stack is always fully visible at offset 0.

  function getCardWidth() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--card-w").trim();
    return parseFloat(raw) || 80;
  }

  function renderZone(container, state, zone) {
    container.innerHTML = "";

    const stacks      = state.stacks || {};
    const stackIds    = zone.stackIds || [];
    const selectedIds = state.selectedCardIds || [];

    // Header ──────────────────────────────────────────────────────────────────
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

    // Layout constants ────────────────────────────────────────────────────────
    const cardWidth      = getCardWidth();
    const stackCount     = stackIds.length;
    const containerWidth = listEl.clientWidth || container.clientWidth || 0;

    // Horizontal spacing between stack positions (left edge of each stack).
    let stackSpacing = 0;
    if (stackCount > 1 && containerWidth > 0) {
      const maxFit = (containerWidth - cardWidth) / (stackCount - 1);
      stackSpacing = Math.max(0, Math.min(cardWidth + 4, maxFit));
    }
    if (container.classList.contains("compact-zone")) {
      stackSpacing = 0;
    }

    // Vertical pixel offset per depth level within a stack.
    // Gives a "peeking" effect: lower cards are visible below the top card.
    // Value scales with card size so it looks consistent across viewport widths.
    const DEPTH_OFFSET = Math.max(2, Math.round(cardWidth * 0.04)); // ~3px at 80px

    // Render each stack ───────────────────────────────────────────────────────
    stackIds.forEach(function (stackId, stackIdx) {
      const stack = stacks[stackId];
      if (!stack) return;

      const stackLeft  = stackSpacing * stackIdx;
      const stackSize  = stack.cardIds.length;
      const isTarget   = stackId === targetStackId;

      // z-index base ensures stacks with lower index (e.g. top of deck) render
      // on top of stacks with higher index when compact zones fully overlap them.
      const stackBaseZ = (stackCount - stackIdx) * 100;

      stack.cardIds.forEach(function (cardId, cardIdx) {
        const card = state.cards[cardId];
        if (!card) return;

        // depth 0 = top card (last cardId in bottom→top order)
        const depth = stackSize - 1 - cardIdx;

        const cardEl = document.createElement("button");
        cardEl.type  = "button";

        let cls = "card";
        if (selectedIds.indexOf(cardId) !== -1) cls += " is-selected";
        if (stack.isTapped)                     cls += " is-tapped";
        if (isTarget)                           cls += " is-target-stack";
        cardEl.className = cls;

        // Top card sits at the stack's assigned horizontal position.
        // Lower cards shift one pixel right and DEPTH_OFFSET pixels down per level,
        // creating a physical "pile" look without colliding with adjacent stacks.
        cardEl.style.zIndex = String(stackBaseZ + cardIdx);
        cardEl.style.left   = (stackLeft + depth) + "px";
        cardEl.style.top    = (depth * DEPTH_OFFSET) + "px";

        // Card face / back ─────────────────────────────────────────────────
        if (card.isFaceDown) {
          const img     = document.createElement("img");
          img.className = "card__back";
          img.alt       = "Card Back";
          img.src       = CARD_BACK;
          img.addEventListener("error", function () { cardEl.textContent = "Card Back"; });
          cardEl.appendChild(img);
        } else {
          const front     = document.createElement("div");
          front.className = "card__front";
          const nameEl    = document.createElement("div");
          nameEl.className  = "card__name";
          nameEl.textContent = card.name;
          front.appendChild(nameEl);
          cardEl.appendChild(front);
        }

        // Click: either pick this stack as target, or toggle card selection.
        cardEl.addEventListener("click", function (e) {
          e.stopPropagation();
          if (isPickingTargetStack) {
            targetStackId = stackId;
            exitPickMode();
            render();
          } else {
            store.dispatch(toggleCardSelection(cardId));
          }
        });

        listEl.appendChild(cardEl);
      });

      // Depth badge: shown on multi-card stacks, positioned over the top card.
      if (stackSize > 1) {
        const badge       = document.createElement("div");
        badge.className   = "stack-badge";
        badge.textContent = stackSize;
        // Align to top-right corner of the top card (depth=0 → left=stackLeft, top=0).
        badge.style.left   = (stackLeft + cardWidth - 26) + "px";
        badge.style.top    = "4px";
        badge.style.zIndex = String(stackBaseZ + stackSize + 1); // above all cards in stack
        listEl.appendChild(badge);
      }
    });
  }

  store.subscribe(render);
  window.addEventListener("resize", render);
  render();
})();
