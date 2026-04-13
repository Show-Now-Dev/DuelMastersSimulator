(function () {

  // ── Return-to-menu button ─────────────────────────────────────────────────
  // Wired once at load time so it survives game re-starts.
  (function () {
    var btn = document.getElementById("return-to-menu-button");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var preGame      = document.getElementById("pre-game");
      var layoutEl     = document.getElementById("layout");
      var headerCtrls  = document.getElementById("header-game-controls");
      if (layoutEl)    layoutEl.style.display    = "none";
      if (preGame)     preGame.style.display      = "";
      if (headerCtrls) headerCtrls.style.display  = "none";
      MenuUI.showMenu();
    });
  }());

  // ── Game simulation entry point ───────────────────────────────────────────
  // Called by MenuUI once the user selects a deck and clicks "Start".
  window.startGameSimulation = function (cardDefs, deckInstances) {
    CARD_DEFINITIONS       = cardDefs;
    INITIAL_DECK_INSTANCES = deckInstances;

    var preGame     = document.getElementById("pre-game");
    var layoutEl    = document.getElementById("layout");
    var headerCtrls = document.getElementById("header-game-controls");
    if (preGame)     preGame.style.display     = "none";
    if (layoutEl)    layoutEl.style.display    = "";
    if (headerCtrls) headerCtrls.style.display = "";

    init();
  };

  function init() {

    // ── Reducer context ───────────────────────────────────────────────────────
    // Bundles external dependencies that the game reducer needs but must not
    // read from global variables directly.  Passed to createStore so every
    // dispatch call forwards it automatically.
    const context = {
      cardDefinitions:    CARD_DEFINITIONS,
      cardDefinitionsMap: (function (defs) {
        var map = {};
        (defs || []).forEach(function (def) { map[def.id] = def; });
        return map;
      }(CARD_DEFINITIONS)),
    };

    // ── Two separate stores ──────────────────────────────────────────────────
    // gameStore: card/stack/zone data and selectedCardIds.
    // uiStore:   selectedTargetZone, modal, peekedCardIds.  Never mixed.
    const gameStore = GameEngine.createStore(rootReducer, context);
    const uiStore   = GameEngine.createStore(uiReducer);

    // ── DOM refs ─────────────────────────────────────────────────────────────
    const logPanelEl          = document.getElementById("log-panel");
    const moveTargetEl        = document.getElementById("move-target");
    const modalLayerEl        = document.getElementById("modal-layer");
    const cardDetailPanelEl   = document.getElementById("card-detail-panel");
    const boardEl             = document.getElementById("layout");
    const pickStackButtonEl   = document.getElementById("pick-stack-button");
    const stackTopButtonEl    = document.getElementById("stack-top-button");
    const stackBottomButtonEl = document.getElementById("stack-bottom-button");

    // All zone DOM elements, keyed by zone id — derived from ZONE_DEFINITIONS.
    const zoneEls = (function () {
      var els = {};
      ZONE_DEFINITIONS.forEach(function (def) {
        els[def.id] = document.getElementById(def.ui.domId);
      });
      return els;
    }());

    // Stacked zones: clicking opens the CARD_SELECTOR modal.
    // Cards are never selected individually from the board in these zones.
    const STACKED_ZONE_IDS = ZONE_DEFINITIONS
      .filter(function (def) { return def.ui.type === "stacked"; })
      .map(function (def) { return def.id; });

    // Selectable zones: clicking the zone background/header toggles select-all.
    const SELECTABLE_ZONE_IDS = ZONE_DEFINITIONS
      .filter(function (def) { return def.ui.selectable; })
      .map(function (def) { return def.id; });

    // ── Log panel ─────────────────────────────────────────────────────────────
    LogPanel.init(logPanelEl);

    // ── Ephemeral pick-mode state ─────────────────────────────────────────────
    // Not persisted in any store; lives only in this init() scope.
    let targetStackId        = null;
    let isPickingTargetStack = false;

    function enterPickMode() {
      isPickingTargetStack = true;
      pickStackButtonEl.classList.add("is-active");
      boardEl.classList.add("pick-target-mode");
      render();
    }

    function exitPickMode() {
      isPickingTargetStack = false;
      pickStackButtonEl.classList.remove("is-active");
      boardEl.classList.remove("pick-target-mode");
      render();
    }

    // pickMode object passed to modules that need to interact with pick-mode state.
    const pickMode = {
      enter:            enterPickMode,
      exit:             exitPickMode,
      isActive:         function () { return isPickingTargetStack; },
      getTargetStackId: function () { return targetStackId; },
      // Called after a stack merge: clears the target and re-renders.
      clearTargetStack: function () { targetStackId = null; render(); },
      // Called on reset or when exiting pick mode without confirming.
      reset:            function () { targetStackId = null; exitPickMode(); },
    };

    // ── Drag-and-drop state ───────────────────────────────────────────────────
    // Ephemeral — not persisted in any store. Cleared when drag ends or drops.
    let dragState = null;
    // null | {
    //   cardIds:       string[],   // cards being dragged ([] for deck drag)
    //   sourceZoneId:  string|null,
    //   sourceStackId: string|null,
    //   isDeckDrag:    boolean,    // source is the deck top card
    // }

    // Controls which UI sections appear in the PENDING_DROP modal.
    // Keys:  "zone:<zoneId>"  — dropping onto a zone background
    //        "stack"          — dropping onto an existing stack card
    //        "deck-drag:<zoneId>" — dragging from the deck
    // Adding a new zone or behavior: change only this table.
    // defaultIsFaceDown: pre-selects "裏向き" (true) or "表向き" (false) in the face section.
    const DROP_TARGET_OPTIONS = {
      "zone:hand":           { showPosition: false, showFace: false, showInsertIndex: false, showTap: false },
      "zone:resolutionZone": { showPosition: false, showFace: false, showInsertIndex: false, showTap: false },
      "zone:battlefield":    { showPosition: false, showFace: false, showInsertIndex: false, showTap: false },
      "zone:mana":           { showPosition: false, showFace: false, showInsertIndex: false, showTap: false },
      // Shield zone: always ask face/tap so cards are placed correctly (face-down by default).
      "zone:shield":         { showPosition: false, showFace: true,  showInsertIndex: false, showTap: true,  defaultIsFaceDown: true },
      "zone:graveyard":      { showPosition: false, showFace: false, showInsertIndex: false, showTap: false },
      "zone:deck":           { showPosition: true,  showFace: false, showInsertIndex: true,  showTap: false },
      "zone:ex":             { showPosition: true,  showFace: false, showInsertIndex: false, showTap: false },
      "zone:gr":             { showPosition: true,  showFace: false, showInsertIndex: false, showTap: false },
      "stack":               { showPosition: true,  showFace: true,  showInsertIndex: false, showTap: false },
      "deck-drag:hand":      { showPosition: false, showFace: false, showInsertIndex: false, showTap: false, isDeckDrag: true },
      "deck-drag:mana":      { showPosition: false, showFace: true,  showInsertIndex: false, showTap: true,  isDeckDrag: true, defaultIsFaceDown: false },
      "deck-drag:shield":    { showPosition: false, showFace: true,  showInsertIndex: false, showTap: true,  isDeckDrag: true, defaultIsFaceDown: true  },
      "deck-drag:graveyard": { showPosition: false, showFace: false, showInsertIndex: false, showTap: false, isDeckDrag: true },
      // Deck drag onto a card in these zones: stack the card, ask face/tap.
      "deck-drag-stack:battlefield": { showPosition: false, showFace: true, showInsertIndex: false, showTap: false, isDeckDrag: true, defaultIsFaceDown: false },
      "deck-drag-stack:shield":      { showPosition: false, showFace: true, showInsertIndex: false, showTap: true,  isDeckDrag: true, defaultIsFaceDown: true  },
    };

    // Zones that show a dedicated 1-card-wide drop panel on their right edge.
    const DROP_PANEL_ZONE_IDS = [
      ZONE_IDS.BATTLEFIELD,
      ZONE_IDS.MANA,
      ZONE_IDS.HAND,
      ZONE_IDS.SHIELD,
    ];

    // Zones that show only a centred "+" hint (no separate drop panel).
    // Drop still works via the zone-level dragover/drop handlers.
    const CENTER_PLUS_ZONE_IDS = [
      ZONE_IDS.RESOLUTION_ZONE,
      ZONE_IDS.GRAVEYARD,
      ZONE_IDS.EX,
      ZONE_IDS.GR,
    ];

    // Default face state per zone (true = 裏向き, false = 表向き).
    // Used to pre-select the face button when dropping a card onto a stack in that zone.
    const ZONE_DEFAULT_FACE_DOWN = {
      [ZONE_IDS.DECK]:   true,
      [ZONE_IDS.SHIELD]: true,
    };

    function _dropOptionsKey(isDeckDrag, target) {
      if (isDeckDrag && target.type === "stack") return "deck-drag-stack:" + target.zoneId;
      if (isDeckDrag)              return "deck-drag:" + target.zoneId;
      if (target.type === "stack") return "stack";
      return "zone:" + target.zoneId;
    }

    function _needsModal(options) {
      return options && (
        options.showPosition || options.showFace || options.showInsertIndex || options.showTap
      );
    }

    // Returns the top card ID of the deck, or null if the deck is empty.
    function _deckTopCardId() {
      var gs       = gameStore.getState();
      var deckZone = gs.zones[ZONE_IDS.DECK];
      if (!deckZone || !deckZone.stackIds.length) return null;
      var topStk   = gs.stacks[deckZone.stackIds[0]];
      return topStk ? topStk.cardIds[topStk.cardIds.length - 1] : null;
    }

    // Immediately execute a drop without showing a confirmation modal.
    function _executeImmediateDrop(cardIds, isDeckDrag, target) {
      if (isDeckDrag) {
        var zoneId = target.zoneId;
        if (zoneId === ZONE_IDS.HAND) {
          gameStore.dispatch(drawCard("player1"));
          LogPanel.log("ドロー");
        } else if (zoneId === ZONE_IDS.GRAVEYARD) {
          var topId = _deckTopCardId();
          if (!topId) return;
          gameStore.dispatch(moveCards([topId], { type: "zone", zoneId: ZONE_IDS.GRAVEYARD }, "top"));
          LogPanel.log("山札トップを墓地へ");
        }
        gameStore.dispatch(clearSelection());
        return;
      }
      var position = (target.type === "zone" && target.zoneId === ZONE_IDS.GRAVEYARD)
        ? "top" : "bottom";
      gameStore.dispatch(moveCards(cardIds, target, position));
      gameStore.dispatch(clearSelection());
      LogPanel.log(cardIds.length + "枚を移動");
    }

    // Route a drop: immediate execution or open the PENDING_DROP modal.
    // optsOverride (optional): extra fields merged into opts (e.g. defaultIsFaceDown).
    function _handleDrop(cardIds, isDeckDrag, target, optsOverride) {
      if (!target) return;
      var key      = _dropOptionsKey(isDeckDrag, target);
      var baseOpts = DROP_TARGET_OPTIONS[key];
      if (!baseOpts) return; // no matching rule → drop is not accepted
      var opts = optsOverride ? Object.assign({}, baseOpts, optsOverride) : baseOpts;
      if (!_needsModal(opts)) {
        _executeImmediateDrop(cardIds, isDeckDrag, target);
      } else {
        uiStore.dispatch(openPendingDropModal(cardIds, target, opts));
      }
    }

    // Confirm handler called by the PENDING_DROP modal's confirm button.
    // position:   "top" | "bottom" | number (deck insert index)
    // faceChoice: "keep" | "up" | "down"
    // tapChoice:  boolean
    function _handleDropConfirm(cardIds, target, position, faceChoice, tapChoice) {
      var opts = ((uiStore.getState().modal) || {}).options || {};

      if (opts.isDeckDrag) {
        if (target.type === "stack") {
          // Deck → existing stack (battlefield / shield stacking)
          gameStore.dispatch(placeFromDeckToStack(target.stackId, target.zoneId, faceChoice === "down", !!tapChoice));
          LogPanel.log("山札から " + target.zoneId + " のスタックへ");
        } else {
          // Deck → Mana / Shield: single atomic action preserving face and tap.
          gameStore.dispatch(placeFromDeck(target.zoneId, faceChoice === "down", !!tapChoice));
          LogPanel.log("山札から " + target.zoneId + " へ");
        }
      } else {
        gameStore.dispatch(moveCards(cardIds, target, position));

        // Apply explicit face override when faceChoice is not "keep".
        if (faceChoice && faceChoice !== "keep") {
          var gsAfter      = gameStore.getState();
          var wantFaceDown = (faceChoice === "down");
          var toToggle     = cardIds.filter(function (id) {
            var c = gsAfter.cards[id];
            return c && (c.isFaceDown !== wantFaceDown);
          });
          if (toToggle.length) gameStore.dispatch(toggleFaceCards(toToggle));
        }

        LogPanel.log(cardIds.length + "枚を移動");
      }

      gameStore.dispatch(clearSelection());
      uiStore.dispatch(closeModal());
    }

    // ── Module initialisation ─────────────────────────────────────────────────

    SelectionManager.init({
      gameDispatch: function (action) { gameStore.dispatch(action); },
      uiDispatch:   function (action) { uiStore.dispatch(action); },
    });

    ControlPanel.init({
      els: {
        drawButton:           document.getElementById("draw-button"),
        shuffleButton:        document.getElementById("shuffle-button"),
        resetButton:          document.getElementById("reset-button"),
        toggleTapButton:      document.getElementById("toggle-tap-button"),
        toggleFaceButton:     document.getElementById("toggle-face-button"),
        peekButton:           document.getElementById("peek-button"),
        clearSelectionButton: document.getElementById("clear-selection-button"),
        moveTarget:           moveTargetEl,
        moveButton:           document.getElementById("move-button"),
        pickStackButton:      pickStackButtonEl,
        stackTopButton:       stackTopButtonEl,
        stackBottomButton:    stackBottomButtonEl,
      },
      gameStore: gameStore,
      uiStore:   uiStore,
      pickMode:  pickMode,
      log:       LogPanel.log,
      clearLog:  LogPanel.clear,
    });

    // ── Zone click handlers ───────────────────────────────────────────────────

    // Stacked zones: clicking the zone background opens the modal.
    // modalVisibility comes from the zone definition (no hardcoded special cases).
    ZONE_DEFINITIONS
      .filter(function (def) { return def.ui.type === "stacked"; })
      .forEach(function (def) {
        var el         = zoneEls[def.id];
        if (!el) return;
        var visibility = def.ui.modalVisibility || "all";
        el.addEventListener("click", function () {
          uiStore.dispatch(openModal({ type: "zone", id: def.id }, "multiple", visibility));
        });
      });

    // Selectable zones: clicking the background/header toggles select-all.
    // Card-level clicks stop propagation so they do not trigger this handler.
    SELECTABLE_ZONE_IDS.forEach(function (zoneId) {
      var el = zoneEls[zoneId];
      if (!el) return;
      el.addEventListener("click", function () {
        var state = gameStore.getState();
        var zone  = state.zones[zoneId];
        if (!zone) return;
        SelectionManager.handleZoneClick({
          zone:            zone,
          stacks:          state.stacks,
          selectedCardIds: state.selectedCardIds,
        });
      });
    });

    // ── Zone drag-and-drop event listeners ───────────────────────────────────
    // Attached once per init(). Handles drops onto zone backgrounds.
    // Card-on-card drops are handled inside renderZone (onCardDrop callback)
    // and call e.stopPropagation(), so they never reach these zone handlers.

    Object.keys(zoneEls).forEach(function (zoneId) {
      var el = zoneEls[zoneId];
      if (!el) return;

      el.addEventListener("dragover", function (e) {
        if (!dragState) return;
        var key  = _dropOptionsKey(dragState.isDeckDrag, { type: "zone", zoneId: zoneId });
        var opts = DROP_TARGET_OPTIONS[key];
        if (!opts) return;
        // Deck drags are only valid when the key has isDeckDrag: true.
        if (dragState.isDeckDrag && !opts.isDeckDrag) return;
        e.preventDefault();
        el.classList.add("drop-target-active");
      });

      el.addEventListener("dragleave", function (e) {
        if (!el.contains(e.relatedTarget)) {
          el.classList.remove("drop-target-active");
        }
      });

      el.addEventListener("drop", function (e) {
        el.classList.remove("drop-target-active");
        if (!dragState) return;
        e.preventDefault();
        _handleDrop(dragState.cardIds, dragState.isDeckDrag, { type: "zone", zoneId: zoneId });
        dragState = null;
      });
    });

    // Clear drag state if the drag ends without a successful drop (e.g. Escape,
    // dropped outside any valid target). Also removes any leftover highlights.
    document.addEventListener("dragend", function () {
      dragState = null;
      var highlighted = document.querySelectorAll(".drop-target-active");
      for (var i = 0; i < highlighted.length; i++) {
        highlighted[i].classList.remove("drop-target-active");
      }
    });

    // ── Card detail panel click → open card detail modal ─────────────────────
    if (cardDetailPanelEl) {
      cardDetailPanelEl.addEventListener("click", function () {
        var gameState = gameStore.getState();
        var peeked    = uiStore.getState().peekedCardIds || [];
        var selIds    = gameState.selectedCardIds || [];
        for (var i = selIds.length - 1; i >= 0; i--) {
          var c = gameState.cards[selIds[i]];
          if (!c) continue;
          var isFaceDown = (peeked.indexOf(c.id) !== -1) ? false : c.isFaceDown;
          if (!isFaceDown) {
            uiStore.dispatch(openCardDetailModal(c.definitionId));
            return;
          }
        }
      });
    }

    // ── Modal close handlers ──────────────────────────────────────────────────

    // Click on the semi-transparent overlay (not the panel) closes the modal.
    modalLayerEl.addEventListener("click", function (e) {
      if (e.target === modalLayerEl) uiStore.dispatch(closeModal());
    });

    // Escape key closes the modal.
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && uiStore.getState().modal) {
        uiStore.dispatch(closeModal());
      }
    });

    // ── Render ────────────────────────────────────────────────────────────────
    // Called whenever either store changes state or the window is resized.
    // Reads state, builds viewModel data, delegates all DOM work to renderers.

    function render() {
      const gameState = gameStore.getState();
      const uiSt      = uiStore.getState();

      // Guard stale targetStackId (stack may have been destroyed by a game action).
      if (targetStackId && !gameState.stacks[targetStackId]) {
        targetStackId = null;
      }

      // Keep the move-target dropdown in sync with uiState.
      if (uiSt.selectedTargetZone) {
        moveTargetEl.value = uiSt.selectedTargetZone;
      }

      // Enable/disable stack-merge buttons based on selection + target availability.
      const hasSelected = (gameState.selectedCardIds || []).length > 0;
      const hasTarget   = !!targetStackId;
      stackTopButtonEl.disabled    = !hasSelected || !hasTarget;
      stackBottomButtonEl.disabled = !hasSelected || !hasTarget;

      // ── Board zones ────────────────────────────────────────────────────────
      Object.keys(zoneEls).forEach(function (zoneId) {
        const zone = gameState.zones[zoneId];
        if (!zone) return;
        ZoneRenderer.renderZone(zoneEls[zoneId], gameState, zone, uiSt.peekedCardIds, {
          stackedZoneIds:       STACKED_ZONE_IDS,
          targetStackId:        targetStackId,
          isPickingTargetStack: isPickingTargetStack,
          onCardClick: function (info) {
            SelectionManager.handleCardClick(Object.assign({}, info, {
              selectedCardIds: gameState.selectedCardIds,
              onPickStack: function (stackId) {
                targetStackId = stackId;
                exitPickMode(); // calls render()
              },
            }));
          },
          onDragStart: function (info) {
            // Ignore drag attempts while pick-mode is active.
            if (isPickingTargetStack) return;

            if (info.isStackedTopCard) {
              if (info.zone.id === ZONE_IDS.DECK) {
                // Deck drag: card ID resolved at drop time by the reducer.
                dragState = {
                  cardIds:       [],
                  sourceZoneId:  ZONE_IDS.DECK,
                  sourceStackId: info.stackId,
                  isDeckDrag:    true,
                };
              } else {
                // Top card of graveyard / ex / gr: regular drag with known card ID.
                dragState = {
                  cardIds:       [info.cardId],
                  sourceZoneId:  info.zone.id,
                  sourceStackId: info.stackId,
                  isDeckDrag:    false,
                };
              }
              return;
            }

            var selected = gameState.selectedCardIds || [];
            var cardIds;

            if (selected.indexOf(info.cardId) !== -1) {
              // Drag the entire current selection (may span multiple zones).
              cardIds = selected.slice();
            } else if (info.stack.cardIds.length > 1) {
              // Unselected card in a multi-card stack → drag the whole stack.
              cardIds = info.stack.cardIds.slice();
            } else {
              // Single-card stack → drag just that card.
              cardIds = [info.cardId];
            }

            // Do NOT dispatch selectCards during drag.
            // Dispatching (even deferred via setTimeout) triggers a zone re-render
            // that removes the card element from the DOM. The touch polyfill fires
            // "dragend" on that now-detached element, which does not bubble to
            // document — leaving ghost images and zone highlights on screen.
            // dragState.cardIds is sufficient to identify what to move on drop.
            dragState = {
              cardIds:       cardIds,
              sourceZoneId:  info.zone.id,
              sourceStackId: info.stackId,
              isDeckDrag:    false,
            };
          },
          onCardDragOver: function (info) {
            if (!dragState) return false;
            if (dragState.isDeckDrag) {
              // Allow deck drag onto cards only when the zone has a deck-drag-stack rule.
              var key = _dropOptionsKey(true, { type: "stack", stackId: info.stackId, zoneId: info.zone.id });
              return !!DROP_TARGET_OPTIONS[key];
            }
            // Don't drop a card onto itself.
            if (dragState.cardIds.length === 1 && dragState.cardIds[0] === info.cardId) return false;
            // Don't drop a stack onto its own source stack.
            var srcStack = info.stackId === dragState.sourceStackId;
            var allCards = dragState.cardIds.length === info.stack.cardIds.length;
            if (srcStack && allCards) return false;
            return true;
          },
          onCardDrop: function (info) {
            if (!dragState) return;
            // Card drops call e.stopPropagation(), so the zone's drop handler never fires.
            // Explicitly clear any zone-level highlight that was set during dragover.
            var highlights = document.querySelectorAll(".drop-target-active");
            for (var i = 0; i < highlights.length; i++) {
              highlights[i].classList.remove("drop-target-active");
            }
            if (dragState.isDeckDrag) {
              _handleDrop([], true, { type: "stack", stackId: info.stackId, zoneId: info.zone.id });
              dragState = null;
              return;
            }
            // Pre-select the face button based on the target zone's convention.
            var defaultFaceDown = ZONE_DEFAULT_FACE_DOWN[info.zone.id] !== undefined
              ? ZONE_DEFAULT_FACE_DOWN[info.zone.id] : false;
            _handleDrop(
              dragState.cardIds,
              false,
              { type: "stack", stackId: info.stackId, zoneId: info.zone.id },
              { defaultIsFaceDown: defaultFaceDown }
            );
            dragState = null;
          },
          hasCenterPlus: CENTER_PLUS_ZONE_IDS.indexOf(zoneId) !== -1,
          // Drop panel: dedicated 1-card-wide drop target at right edge of spread zones.
          hasDropPanel: DROP_PANEL_ZONE_IDS.indexOf(zoneId) !== -1,
          onDropPanelDragOver: function () {
            if (!dragState) return false;
            // Reject deck drags unless the zone explicitly allows them.
            if (dragState.isDeckDrag) {
              var opts = DROP_TARGET_OPTIONS["deck-drag:" + zoneId] || {};
              return !!opts.isDeckDrag;
            }
            return true;
          },
          onDropPanelDrop: function () {
            if (!dragState) return;
            _handleDrop(dragState.cardIds, dragState.isDeckDrag, { type: "zone", zoneId: zoneId });
          },
        });
      });

      // ── Modal ──────────────────────────────────────────────────────────────
      ZoneRenderer.renderModal(modalLayerEl, gameState, uiSt, {
        onClose: function () {
          uiStore.dispatch(closeModal());
        },
        onCardClick: function (cardId) {
          var currentSel = uiStore.getState().modal.selectedCardIds;
          var alreadySel = currentSel.indexOf(cardId) !== -1;
          var nextSel    = alreadySel
            ? currentSel.filter(function (id) { return id !== cardId; })
            : currentSel.concat([cardId]);
          uiStore.dispatch(selectModalCards(nextSel));
        },
        onToggleFace: function (sel) {
          if (!sel.length) return;
          gameStore.dispatch(selectCards(sel));
          gameStore.dispatch(toggleFaceSelectedCards());
          uiStore.dispatch(removePeekedCards(sel));
          LogPanel.log("表向き/裏向き切り替え（" + sel.length + "枚）");
        },
        onMove: function (sel, zoneId, position, label) {
          gameStore.dispatch(selectCards(sel));
          gameStore.dispatch(moveSelectedCards(zoneId, position));
          uiStore.dispatch(removePeekedCards(sel));
          uiStore.dispatch(selectModalCards([]));
          LogPanel.log(sel.length + "枚を " + label + " へ移動");
        },
        onPeek: function (sel) {
          uiStore.dispatch(peekCards(sel));
          LogPanel.log("カードを見る（" + sel.length + "枚）");
        },
        onConfirm: function (sel) {
          if (sel.length > 0) {
            gameStore.dispatch(selectCards(sel));
            LogPanel.log("モーダルで " + sel.length + "枚を選択確定");
          }
          uiStore.dispatch(closeModal());
        },
        onSelectAll:      function (cardIds) { uiStore.dispatch(selectModalCards(cardIds.slice())); },
        onClearSelection: function ()         { uiStore.dispatch(selectModalCards([])); },
        parseMoveTarget:  ControlPanel.parseMoveTarget,
        onConfirmDrop: function (cardIds, target, position, faceChoice, tapChoice) {
          _handleDropConfirm(cardIds, target, position, faceChoice, tapChoice);
        },
      });

      // ── Card detail panel ──────────────────────────────────────────────────
      if (cardDetailPanelEl) {
        ZoneRenderer.renderCardDetail(cardDetailPanelEl, gameState, uiSt.peekedCardIds);
      }
    }

    // ── Board scale ───────────────────────────────────────────────────────────
    // Scale the board to fill the viewport in both dimensions simultaneously.
    //
    // --card-w is always set explicitly by JS (overrides the CSS clamp).
    // All derived variables (--card-h, --gap, --zone-row-h, …) follow suit.
    //
    // Width formula (from CSS): card-w = (vw - board-pad*2) / 11.35
    //   → 40px at vw=502, 80px at vw=956, linear in between.
    //
    // Height formula: measured at card-w=40 and card-w=80 on first call,
    //   then linearly interpolated.  Uses the same [40, 80] range.
    //
    // The more constraining dimension wins.  If the result drops below 40px,
    // card-w is frozen at 40 and CSS zoom scales the whole board uniformly.

    var CARD_W_MIN = 40;
    var CARD_W_MAX = 80;
    var VW_AT_MIN  = 502;  // vw where CSS clamp → 40px
    var VW_AT_MAX  = 956;  // vw where CSS clamp → 80px  (80*11.35 + 48)
    var _vhAtMin   = 0;    // measured: total page height when card-w = 40px
    var _vhAtMax   = 0;    // measured: total page height when card-w = 80px

    function applyBoardScale() {
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var headerEl = document.querySelector('header');
      var headerH  = headerEl ? headerEl.offsetHeight : 0;

      // ── One-time measurement ────────────────────────────────────────────────
      // Measure the board's natural CONTENT height at both card-w extremes.
      //
      // IMPORTANT: boardEl (#layout) has flex:1 so boardEl.offsetHeight always
      // equals (vh - headerH), not the content height.  Instead, measure
      // #board-grid and #board-bottom directly and sum them up.
      if (!_vhAtMin) {
        boardEl.style.zoom = '';
        var boardGridEl   = document.getElementById('board-grid');
        var boardBottomEl = document.getElementById('board-bottom');

        function _measureContentH(cardW) {
          document.documentElement.style.setProperty('--card-w', cardW + 'px');
          var flexGap = parseFloat(getComputedStyle(boardEl).gap)           || 0;
          var padTB   = (parseFloat(getComputedStyle(boardEl).paddingTop)   || 0)
                      + (parseFloat(getComputedStyle(boardEl).paddingBottom) || 0);
          var gridH   = boardGridEl   ? boardGridEl.offsetHeight   : 0;
          var bottomH = boardBottomEl ? boardBottomEl.offsetHeight : 0;
          return headerH + padTB + gridH + flexGap + bottomH;
        }

        _vhAtMin = _measureContentH(CARD_W_MIN);
        _vhAtMax = _measureContentH(CARD_W_MAX);
        // Guard: board hidden or not yet laid out
        if (!_vhAtMin) { _vhAtMin = 1; }
        if (_vhAtMax <= _vhAtMin) { _vhAtMax = _vhAtMin + 1; }
      }

      // ── Card-w from width ───────────────────────────────────────────────────
      var cardWW = vw <= VW_AT_MIN ? CARD_W_MIN * (vw / VW_AT_MIN)
                 : vw >= VW_AT_MAX ? CARD_W_MAX
                 : CARD_W_MIN + (vw - VW_AT_MIN) / (VW_AT_MAX - VW_AT_MIN) * (CARD_W_MAX - CARD_W_MIN);

      // ── Card-w from height ──────────────────────────────────────────────────
      var cardWH = vh <= _vhAtMin ? CARD_W_MIN * (vh / _vhAtMin)
                 : vh >= _vhAtMax ? CARD_W_MAX
                 : CARD_W_MIN + (vh - _vhAtMin) / (_vhAtMax - _vhAtMin) * (CARD_W_MAX - CARD_W_MIN);

      // ── Apply ───────────────────────────────────────────────────────────────
      var cardW = Math.min(cardWW, cardWH);

      if (cardW >= CARD_W_MIN) {
        document.documentElement.style.setProperty('--card-w', cardW.toFixed(2) + 'px');
        boardEl.style.zoom = '';
      } else {
        // Both dimensions are too small — freeze at min and zoom the whole board.
        document.documentElement.style.setProperty('--card-w', CARD_W_MIN + 'px');
        boardEl.style.zoom = (cardW / CARD_W_MIN).toFixed(5);
      }
    }

    // ── Subscribe both stores to the same render function ────────────────────
    gameStore.subscribe(render);
    uiStore.subscribe(render);
    window.addEventListener("resize", function () { applyBoardScale(); render(); });
    applyBoardScale();
    render();

  } // end init()

}());
