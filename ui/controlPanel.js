// ui/controlPanel.js
//
// Registers all control panel button event listeners.
// Each handler reads the minimum required state and dispatches a single action.
//
// Depends on (globals):
//   Action creators: drawCard, shuffleDeck, resetGame, moveSelectedCards,
//                    toggleTapSelectedCards, toggleFaceSelectedCards,
//                    stackSelectedCards, clearSelection, clearPeekedCards,
//                    removePeekedCards, peekCards, setSelectedTargetZone  — core/actions.js + ui/uiState.js
//   ZONE_IDS, PLAYER_ID                                                   — model/Zone.js, core/GameState.js
//
// Public API:
//
//   ControlPanel.init(config)
//     config: {
//       els: {
//         drawButton, shuffleButton, resetButton,
//         toggleTapButton, toggleFaceButton, peekButton, clearSelectionButton,
//         moveTarget, moveButton,
//         pickStackButton, stackTopButton, stackBottomButton,
//       },
//       gameStore:  { getState, dispatch },
//       uiStore:    { getState, dispatch },
//       pickMode: {
//         enter:            function()
//         exit:             function()
//         isActive:         function() → boolean
//         getTargetStackId: function() → string|null
//         clearTargetStack: function()  — clears targetStackId and triggers re-render
//         reset:            function()  — clears targetStackId + exits pick mode (no re-render)
//       },
//       log:      function(msg),
//       clearLog: function(),
//     }
//
//   ControlPanel.parseMoveTarget(value) → { zoneId, position }
//     Pure function: converts a dropdown value to zone + position.
//     Exposed so other modules (e.g. modal callbacks in ui.js) can reuse it.

var ControlPanel = (function () {

  // ── parseMoveTarget ─────────────────────────────────────────────────────────
  // Converts a move-option value into { zoneId, position }.
  // The lookup table is built once from ZONE_DEFINITIONS — no hardcoded special cases.
  var _moveOptionMap = (function () {
    var map = {};
    ZONE_DEFINITIONS.forEach(function (def) {
      def.ui.moveOptions.forEach(function (opt) {
        map[opt.value] = { zoneId: def.id, position: opt.position };
      });
    });
    return map;
  }());

  function parseMoveTarget(value) {
    return _moveOptionMap[value] || { zoneId: value, position: "bottom" };
  }

  // ── init ────────────────────────────────────────────────────────────────────
  function init(config) {
    var els      = config.els;
    var game     = config.gameStore;
    var ui       = config.uiStore;
    var pickMode = config.pickMode;
    var log      = config.log;
    var clearLog = config.clearLog;

    // ── Draw ──────────────────────────────────────────────────────────────────
    els.drawButton.addEventListener("click", function () {
      game.dispatch(drawCard(PLAYER_ID));
      log("ドロー");
    });

    // ── Shuffle ───────────────────────────────────────────────────────────────
    if (els.shuffleButton) {
      els.shuffleButton.addEventListener("click", function () {
        game.dispatch(shuffleDeck(PLAYER_ID));
        ui.dispatch(clearPeekedCards());
        log("山札をシャッフル");
      });
    }

    // ── Reset ─────────────────────────────────────────────────────────────────
    els.resetButton.addEventListener("click", function () {
      pickMode.reset();
      ui.dispatch(closeModal());
      ui.dispatch(clearPeekedCards());
      game.dispatch(resetGame());
      clearLog();
      log("ゲームをリセット");
    });

    // ── Toggle tap ────────────────────────────────────────────────────────────
    els.toggleTapButton.addEventListener("click", function () {
      var sel = game.getState().selectedCardIds || [];
      if (!sel.length) return;
      game.dispatch(toggleTapSelectedCards());
      log("タップ切り替え（" + sel.length + "枚）");
    });

    // ── Toggle face ───────────────────────────────────────────────────────────
    els.toggleFaceButton.addEventListener("click", function () {
      var sel = game.getState().selectedCardIds || [];
      if (!sel.length) return;
      game.dispatch(toggleFaceSelectedCards());
      log("表向き/裏向き切り替え（" + sel.length + "枚）");
    });

    // ── Peek (view face-down cards without changing game state) ───────────────
    els.peekButton.addEventListener("click", function () {
      var state            = game.getState();
      var faceDownSelected = (state.selectedCardIds || []).filter(function (id) {
        var card = state.cards[id];
        return card && card.isFaceDown;
      });
      if (!faceDownSelected.length) return;

      var peeked          = ui.getState().peekedCardIds;
      var allAlreadyPeeked = faceDownSelected.every(function (id) {
        return peeked.indexOf(id) !== -1;
      });
      ui.dispatch(
        allAlreadyPeeked ? removePeekedCards(faceDownSelected) : peekCards(faceDownSelected)
      );
      log(allAlreadyPeeked
        ? "確認解除（" + faceDownSelected.length + "枚）"
        : "カードを見る（" + faceDownSelected.length + "枚）");
    });

    // ── Clear selection ───────────────────────────────────────────────────────
    els.clearSelectionButton.addEventListener("click", function () {
      game.dispatch(clearSelection());
      log("選択解除");
    });

    // ── Move target dropdown ──────────────────────────────────────────────────
    // Updates uiStore only; game state is unaffected.
    els.moveTarget.addEventListener("change", function () {
      ui.dispatch(setSelectedTargetZone(els.moveTarget.value));
    });

    // ── Move button ───────────────────────────────────────────────────────────
    els.moveButton.addEventListener("click", function () {
      var gameState = game.getState();
      var uiSt      = ui.getState();
      var raw       = uiSt.selectedTargetZone || els.moveTarget.value;
      var parsed    = parseMoveTarget(raw);
      var toMove    = gameState.selectedCardIds || [];
      if (!toMove.length || !parsed.zoneId) return;
      game.dispatch(moveSelectedCards(parsed.zoneId, parsed.position));
      ui.dispatch(removePeekedCards(toMove));
      log(toMove.length + "枚を " + els.moveTarget.options[els.moveTarget.selectedIndex].text + " へ移動");
    });

    // ── Pick-stack button ─────────────────────────────────────────────────────
    els.pickStackButton.addEventListener("click", function () {
      pickMode.isActive() ? pickMode.exit() : pickMode.enter();
    });

    // ── Stack top button ──────────────────────────────────────────────────────
    els.stackTopButton.addEventListener("click", function () {
      var toMove = game.getState().selectedCardIds || [];
      var tid    = pickMode.getTargetStackId();
      if (!tid || !toMove.length) return;
      game.dispatch(stackSelectedCards(tid, "top"));
      ui.dispatch(removePeekedCards(toMove));
      log(toMove.length + "枚を上に重ねた");
      pickMode.clearTargetStack();
    });

    // ── Stack bottom button ───────────────────────────────────────────────────
    els.stackBottomButton.addEventListener("click", function () {
      var toMove = game.getState().selectedCardIds || [];
      var tid    = pickMode.getTargetStackId();
      if (!tid || !toMove.length) return;
      game.dispatch(stackSelectedCards(tid, "bottom"));
      ui.dispatch(removePeekedCards(toMove));
      log(toMove.length + "枚を下に重ねた");
      pickMode.clearTargetStack();
    });
  }

  return { init: init, parseMoveTarget: parseMoveTarget };

}());
