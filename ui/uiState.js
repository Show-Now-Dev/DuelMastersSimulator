// ui/uiState.js
//
// Manages purely presentational state that must never enter the game reducer.
// Handled by a separate store from the game store.
//
// Shape:
//   selectedTargetZone: string | null    ← raw dropdown value (e.g. "deck-top", "graveyard")
//   peekedCardIds: string[]              ← cards the viewer is peeking at (displayed face-up
//                                           without changing game state isFaceDown).
//                                           Future: key this by playerId for multi-player.
//   modal: null | {                       ← active modal, or null when closed
//     type: "CARD_SELECTOR"               ← browse cards in a stack / zone
//       source: { type: "stack"|"zone", id: string }
//       selectionMode:   "single" | "multiple"
//       visibility:      "all" | "top-n" | "hidden"
//       topN:            number
//       selectedCardIds: string[]
//   } | {
//     type: "CARD_DETAIL"                 ← full card info view
//       definitionId: string
//   } | {
//     type: "PENDING_DROP"                ← drop confirmation (drag-and-drop)
//       cardIds: string[]                 (cards being dropped)
//       target:  { type: "zone"|"stack", zoneId?, stackId? }
//       options: {                        (controls which UI sections are shown)
//         showPosition:    boolean        top / bottom choice
//         showFace:        boolean        face up / down / keep choice
//         showInsertIndex: boolean        "insert at N" dropdown (deck only)
//         showTap:         boolean        tap / untap choice (deck→mana/shield)
//         isDeckDrag:      boolean        source is the deck
//       }
//   }

// ── UI action type constants ──────────────────────────────────────────────────
// SET_SELECTED_TARGET_ZONE is declared in actions.js.
// The uiReducer handles it here so it never touches the game reducer.

const OPEN_MODAL                = "OPEN_MODAL";
const OPEN_CARD_DETAIL_MODAL    = "OPEN_CARD_DETAIL_MODAL";
const OPEN_LINKED_DETAIL_MODAL  = "OPEN_LINKED_DETAIL_MODAL";
const OPEN_PENDING_DROP_MODAL   = "OPEN_PENDING_DROP_MODAL";
const CLOSE_MODAL               = "CLOSE_MODAL";
const SELECT_MODAL_CARDS        = "SELECT_MODAL_CARDS";
const PEEK_CARDS                = "PEEK_CARDS";
const REMOVE_PEEKED_CARDS       = "REMOVE_PEEKED_CARDS";
const CLEAR_PEEKED_CARDS        = "CLEAR_PEEKED_CARDS";

// ── Action creators ───────────────────────────────────────────────────────────

// Open a CARD_SELECTOR modal.
//
// source:        { type: "stack" | "zone", id: string }
// selectionMode: "single" | "multiple"  (default "multiple")
// visibility:    "all" | "top-n" | "hidden"  (default "all")
// topN:          number  (only relevant when visibility is "top-n", default 3)
function openModal(source, selectionMode, visibility, topN) {
  return {
    type: OPEN_MODAL,
    payload: {
      source:        source,
      selectionMode: selectionMode || "multiple",
      visibility:    visibility    || "all",
      topN:          topN          || 3,
    },
  };
}

// Open a CARD_DETAIL modal for the given card definition id.
// formIndex: current displayed form index (for multi-form cards; default 0).
function openCardDetailModal(definitionId, formIndex) {
  return {
    type: OPEN_CARD_DETAIL_MODAL,
    payload: { definitionId: definitionId, formIndex: formIndex != null ? formIndex : 0 },
  };
}

// Open a LINKED_DETAIL modal showing merged linked-group info with cost/power breakdown.
// linkedInfo: return value of buildLinkedStackInfo().
function openLinkedDetailModal(linkedInfo) {
  return {
    type: OPEN_LINKED_DETAIL_MODAL,
    payload: { linkedInfo: linkedInfo },
  };
}

// Open a PENDING_DROP modal.
// Shown when a drag-and-drop requires user confirmation (position, face, tap, insert index).
//
// cardIds:    cards being dropped
// target:     { type: "zone"|"stack", zoneId?, stackId? }
// options:    { showPosition, showFace, showInsertIndex, showTap, isDeckDrag }
//             Controls which UI sections are shown in the modal.
//             Adding a new option only requires adding it here and in the renderer —
//             no other files need to change.
function openPendingDropModal(cardIds, target, options) {
  return {
    type: OPEN_PENDING_DROP_MODAL,
    payload: { cardIds: cardIds, target: target, options: options },
  };
}

function closeModal() {
  return { type: CLOSE_MODAL, payload: null };
}

// Replace the modal's internal card selection.
function selectModalCards(cardIds) {
  return { type: SELECT_MODAL_CARDS, payload: { cardIds: cardIds } };
}

// Add cards to the peeked set (union — no duplicates).
function peekCards(cardIds) {
  return { type: PEEK_CARDS, payload: { cardIds: cardIds } };
}

// Remove specific cards from the peeked set (call after moving cards).
function removePeekedCards(cardIds) {
  return { type: REMOVE_PEEKED_CARDS, payload: { cardIds: cardIds } };
}

// Clear all peeked cards (call on reset).
function clearPeekedCards() {
  return { type: CLEAR_PEEKED_CARDS, payload: null };
}

// ── Reducer ───────────────────────────────────────────────────────────────────

function createInitialUiState() {
  return {
    selectedTargetZone: null,
    peekedCardIds:      [],
    modal:              null,
  };
}

function uiReducer(state, action) {
  if (!state) return createInitialUiState();

  switch (action.type) {

    // Moved here from the game reducer — this is UI-only state.
    case SET_SELECTED_TARGET_ZONE:
      return Object.assign({}, state, {
        selectedTargetZone: (action.payload && action.payload.zoneId) || null,
      });

    case OPEN_MODAL:
      return Object.assign({}, state, {
        modal: {
          type:            "CARD_SELECTOR",
          source:          action.payload.source,
          selectionMode:   action.payload.selectionMode,
          visibility:      action.payload.visibility,
          topN:            action.payload.topN,
          selectedCardIds: [],
        },
      });

    case OPEN_CARD_DETAIL_MODAL:
      return Object.assign({}, state, {
        modal: {
          type:         "CARD_DETAIL",
          definitionId: action.payload.definitionId,
          formIndex:    action.payload.formIndex || 0,
        },
      });

    case OPEN_LINKED_DETAIL_MODAL:
      return Object.assign({}, state, {
        modal: {
          type:       "LINKED_DETAIL",
          linkedInfo: action.payload.linkedInfo,
        },
      });

    case OPEN_PENDING_DROP_MODAL:
      return Object.assign({}, state, {
        modal: {
          type:    "PENDING_DROP",
          cardIds: action.payload.cardIds,
          target:  action.payload.target,
          options: action.payload.options,
        },
      });

    case CLOSE_MODAL:
      return Object.assign({}, state, { modal: null });

    case SELECT_MODAL_CARDS:
      if (!state.modal) return state;
      return Object.assign({}, state, {
        modal: Object.assign({}, state.modal, {
          selectedCardIds: action.payload.cardIds || [],
        }),
      });

    case PEEK_CARDS: {
      var incoming = action.payload.cardIds || [];
      var current  = state.peekedCardIds;
      var merged   = current.concat(incoming.filter(function (id) {
        return current.indexOf(id) === -1;
      }));
      return Object.assign({}, state, { peekedCardIds: merged });
    }

    case REMOVE_PEEKED_CARDS: {
      var toRemove = action.payload.cardIds || [];
      return Object.assign({}, state, {
        peekedCardIds: state.peekedCardIds.filter(function (id) {
          return toRemove.indexOf(id) === -1;
        }),
      });
    }

    case CLEAR_PEEKED_CARDS:
      return Object.assign({}, state, { peekedCardIds: [] });

    default:
      return state;
  }
}
