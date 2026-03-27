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
      });

      // ── Card detail panel ──────────────────────────────────────────────────
      if (cardDetailPanelEl) {
        ZoneRenderer.renderCardDetail(cardDetailPanelEl, gameState, uiSt.peekedCardIds);
      }
    }

    // ── Board scale ───────────────────────────────────────────────────────────
    // When the viewport is narrower than the board's natural minimum width,
    // scale the entire board down so it fits without horizontal overflow.
    //
    // Technique: CSS zoom (not transform: scale) — zoom affects layout flow,
    // so the scaled board takes up exactly the right amount of space in the
    // document without any overflow or margin tricks.
    //
    // --card-w is overridden on :root so all derived variables (--card-h,
    // --gap, --zone-row-h, …) resolve to the reference-layout values, and
    // the JS card-spacing calculation (_getCardWidth) also returns the correct
    // reference value.

    var BOARD_MIN_VW = 728; // viewport width at which --card-w hits its clamp min (40px)

    function applyBoardScale() {
      var vw = window.innerWidth;
      if (vw >= BOARD_MIN_VW) {
        document.documentElement.style.removeProperty('--card-w');
        boardEl.style.zoom = '';
      } else {
        // Freeze --card-w at minimum so the grid is at its natural reference size.
        document.documentElement.style.setProperty('--card-w', '40px');
        boardEl.style.zoom = (vw / BOARD_MIN_VW).toFixed(5);
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
