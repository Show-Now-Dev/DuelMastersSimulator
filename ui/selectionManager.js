// ui/selectionManager.js
//
// Handles card and zone selection logic.
// Receives dispatch functions via init — never reads from stores directly.
//
// Depends on (globals):
//   Action creators: clearSelection, selectCards, toggleCardSelection  — core/actions.js
//   UI actions:      openModal                                         — ui/uiState.js
//   ZONE_IDS                                                           — model/Zone.js
//
// Public API:
//
//   SelectionManager.init({ gameDispatch, uiDispatch })
//     Must be called once before use.
//
//   SelectionManager.handleCardClick(info)
//     info: {
//       cardId:               string
//       stackId:              string
//       zone:                 Zone
//       stack:                CardStack
//       isTopCard:            boolean
//       isStacked:            boolean     — true for Deck, Graveyard, EX, GR
//       stackSize:            number
//       selectedCardIds:      string[]   — current game-state selection
//       isPickingTargetStack: boolean
//       onPickStack:          function(stackId) — called in pick-target mode
//     }
//
//   SelectionManager.handleZoneClick(info)
//     info: { zone, stacks, selectedCardIds }
//     Selects all cards in the zone, or clears selection if all already selected.

var SelectionManager = (function () {

  var _gameDispatch = null;
  var _uiDispatch   = null;

  function init(deps) {
    _gameDispatch = deps.gameDispatch;
    _uiDispatch   = deps.uiDispatch;
  }

  // Collect all cardIds from every stack in a zone (flat array).
  function _getZoneCardIds(zone, stacks) {
    var ids = [];
    (zone.stackIds || []).forEach(function (stackId) {
      var stack = stacks[stackId];
      if (stack) ids = ids.concat(stack.cardIds);
    });
    return ids;
  }

  function handleCardClick(info) {
    var cardId               = info.cardId;
    var stackId              = info.stackId;
    var zone                 = info.zone;
    var stack                = info.stack;
    var isTopCard            = info.isTopCard;
    var isStacked            = info.isStacked;
    var stackSize            = info.stackSize;
    var selectedCardIds      = info.selectedCardIds || [];
    var isPickingTargetStack = info.isPickingTargetStack;
    var onPickStack          = info.onPickStack;

    // Pick-target mode: user is selecting which stack to merge cards onto.
    if (isPickingTargetStack) {
      if (onPickStack) onPickStack(stackId);
      return;
    }

    // Stacked zones (Deck, Graveyard, EX, GR): any card click opens the zone modal.
    // Individual card selection does not happen directly in these zones.
    // modalVisibility is read from ZONE_DEFS_MAP — no hardcoded special cases.
    if (isStacked) {
      var zoneDef = ZONE_DEFS_MAP[zone.id];
      var vis     = (zoneDef && zoneDef.ui.modalVisibility) || "all";
      _uiDispatch(openModal({ type: "zone", id: zone.id }, "multiple", vis));
      return;
    }

    // Multi-card stack:
    //   top card    → toggle entire stack in/out of selection (ADD, not replace)
    //   non-top card → open card selector modal for this stack
    if (stackSize > 1) {
      if (isTopCard) {
        var allSelected = stack.cardIds.every(function (id) {
          return selectedCardIds.indexOf(id) !== -1;
        });
        if (allSelected) {
          // Deselect only this stack's cards (keep any other zones' selections).
          var newSel = selectedCardIds.filter(function (id) {
            return stack.cardIds.indexOf(id) === -1;
          });
          _gameDispatch(selectCards(newSel));
        } else {
          // Add this stack's cards to the current selection.
          var added = selectedCardIds.slice();
          stack.cardIds.forEach(function (id) {
            if (added.indexOf(id) === -1) added.push(id);
          });
          _gameDispatch(selectCards(added));
        }
      } else {
        _uiDispatch(openModal({ type: "stack", id: stackId }, "multiple", "all"));
      }
      return;
    }

    // Single-card stack: toggle this card in/out of the selection.
    _gameDispatch(toggleCardSelection(cardId));
  }

  function handleZoneClick(info) {
    var zone            = info.zone;
    var stacks          = info.stacks;
    var selectedCardIds = info.selectedCardIds || [];

    var allCardIds = _getZoneCardIds(zone, stacks);
    if (!allCardIds.length) return;

    var allZoneSelected = allCardIds.every(function (id) {
      return selectedCardIds.indexOf(id) !== -1;
    });

    if (allZoneSelected) {
      // All zone cards already selected → deselect them (clear to empty).
      _gameDispatch(selectCards([]));
    } else {
      // Replace selection with only this zone's cards.
      _gameDispatch(selectCards(allCardIds));
    }
  }

  return {
    init:            init,
    handleCardClick: handleCardClick,
    handleZoneClick: handleZoneClick,
  };

}());
