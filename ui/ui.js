(function () {

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

  // Move reads selectedCardIds from game state; target zone from uiState.
  moveButtonEl.addEventListener("click", function () {
    const gameState = gameStore.getState();
    const uiSt      = uiStore.getState();
    const toZone    = uiSt.selectedTargetZone || moveTargetEl.value;
    if (!(gameState.selectedCardIds || []).length || !toZone) return;
    gameStore.dispatch(moveSelectedCards(toZone));
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

    // Board zones.
    Object.keys(zoneEls).forEach(function (zoneId) {
      const zone = gameState.zones[zoneId];
      if (zone) renderZone(zoneEls[zoneId], gameState, zone);
    });

    renderZone(exEl, gameState, { id: "ex", name: "EX", stackIds: [] });
    renderZone(grEl, gameState, { id: "gr", name: "GR", stackIds: [] });

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

        const depth  = stackSize - 1 - cardIdx; // 0 = top card
        const isTopCard = (depth === 0);

        const cardEl = document.createElement("button");
        cardEl.type  = "button";

        let cls = "card";
        if (selectedIds.indexOf(cardId) !== -1) cls += " is-selected";
        if (stack.isTapped)                     cls += " is-tapped";
        if (isTarget)                           cls += " is-target-stack";
        cardEl.className = cls;

        cardEl.style.zIndex = String(stackBaseZ + cardIdx);
        cardEl.style.left   = (stackLeft + depth) + "px";
        cardEl.style.top    = (depth * DEPTH_OFFSET) + "px";

        // Card face rendering (reused in modal via separate function).
        appendCardFace(cardEl, card);

        // ── Click behavior ─────────────────────────────────────────────────
        // Priority 1: pick-mode — any card click sets the target stack.
        // Priority 2 (multi-card stack):
        //   Top card    → select all cards in the stack.
        //   Non-top card → open STACK_CARD_SELECTOR modal.
        // Priority 3 (single-card stack): toggle individual selection.
        cardEl.addEventListener("click", function (e) {
          e.stopPropagation();

          if (isPickingTargetStack) {
            targetStackId = stackId;
            exitPickMode();
            render();
            return;
          }

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
              uiStore.dispatch(openModal("STACK_CARD_SELECTOR", stackId));
            }
          } else {
            // Single-card stack: toggle selection as before.
            gameStore.dispatch(toggleCardSelection(cardId));
          }
        });

        listEl.appendChild(cardEl);
      });

      // Depth badge on multi-card stacks.
      if (stackSize > 1) {
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
      const front     = document.createElement("div");
      front.className = "card__front";
      const nameEl    = document.createElement("div");
      nameEl.className  = "card__name";
      nameEl.textContent = card.name;
      front.appendChild(nameEl);
      cardEl.appendChild(front);
    }
  }

  // ── Modal rendering ────────────────────────────────────────────────────────
  // The modal layer is always rebuilt from scratch on every render call.
  // This is safe because the layer is small (one stack's cards at most).

  function renderModal(gameState, uiSt) {
    const modal = uiSt.modal;

    if (!modal) {
      modalLayerEl.classList.remove("is-open");
      modalLayerEl.innerHTML = "";
      return;
    }

    if (modal.type === "STACK_CARD_SELECTOR") {
      const stack = gameState.stacks[modal.targetId];
      if (!stack) {
        // Stack was destroyed while modal was open — close it next tick to
        // avoid dispatching inside a subscribe callback.
        modalLayerEl.classList.remove("is-open");
        modalLayerEl.innerHTML = "";
        setTimeout(function () { uiStore.dispatch(closeModal()); }, 0);
        return;
      }
      renderStackSelectorModal(gameState, modal, stack);
    }

    // Future modal types are added here (zone selector, effect resolution, …).

    modalLayerEl.classList.add("is-open");
  }

  // ── STACK_CARD_SELECTOR modal ──────────────────────────────────────────────

  function renderStackSelectorModal(gameState, modal, stack) {
    modalLayerEl.innerHTML = "";

    const panel = document.createElement("div");
    panel.className = "modal-panel";

    // ── Header ──────────────────────────────────────────────────────────────
    const header = document.createElement("div");
    header.className = "modal-header";

    const title = document.createElement("span");
    title.className   = "modal-title";
    title.textContent = "Select cards in stack (" + stack.cardIds.length + ")";

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
    // cardIds are stored bottom→top; reverse to show top card first in the modal.
    const cardListEl  = document.createElement("div");
    cardListEl.className = "modal-card-list";

    const cardsTopFirst = stack.cardIds.slice().reverse();

    cardsTopFirst.forEach(function (cardId, displayIdx) {
      const card = gameState.cards[cardId];
      if (!card) return;

      const isModalSelected = modal.selectedCardIds.indexOf(cardId) !== -1;
      const isTopCard       = displayIdx === 0;

      const cardEl      = document.createElement("button");
      cardEl.type       = "button";
      cardEl.className  = "modal-card" + (isModalSelected ? " is-selected" : "");

      appendCardFace(cardEl, card);

      // Position label (Top / index).
      const posLabel       = document.createElement("div");
      posLabel.className   = "modal-card-position";
      posLabel.textContent = isTopCard ? "Top" : "#" + (displayIdx + 1);
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
      uiStore.dispatch(selectModalCards(stack.cardIds.slice()));
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

})();
