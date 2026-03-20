// ui/uiState.js
//
// Manages purely presentational state that must never enter the game reducer.
// Handled by a separate store from the game store.
//
// Shape:
//   selectedTargetZone: string | null    ← raw dropdown value (e.g. "deck-top", "graveyard")
//   modal: null | {                       ← active CARD_SELECTOR modal, or null when closed
//     type:            "CARD_SELECTOR"
//     source: {                           ← what the modal is browsing
//       type: "stack" | "zone"
//       id:   string                      (stackId or ZoneType)
//     }
//     selectionMode:   "single" | "multiple"
//     visibility:      "all" | "top-n" | "hidden"
//     topN:            number             (used when visibility is "top-n", default 3)
//     selectedCardIds: string[]           (cards selected inside the modal)
//   }

// ── UI action type constants ──────────────────────────────────────────────────
// SET_SELECTED_TARGET_ZONE is declared in actions.js.
// The uiReducer handles it here so it never touches the game reducer.

const OPEN_MODAL         = "OPEN_MODAL";
const CLOSE_MODAL        = "CLOSE_MODAL";
const SELECT_MODAL_CARDS = "SELECT_MODAL_CARDS";

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

function closeModal() {
  return { type: CLOSE_MODAL, payload: null };
}

// Replace the modal's internal card selection.
function selectModalCards(cardIds) {
  return { type: SELECT_MODAL_CARDS, payload: { cardIds: cardIds } };
}

// ── Reducer ───────────────────────────────────────────────────────────────────

function createInitialUiState() {
  return {
    selectedTargetZone: null,
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

    case CLOSE_MODAL:
      return Object.assign({}, state, { modal: null });

    case SELECT_MODAL_CARDS:
      if (!state.modal) return state;
      return Object.assign({}, state, {
        modal: Object.assign({}, state.modal, {
          selectedCardIds: action.payload.cardIds || [],
        }),
      });

    default:
      return state;
  }
}
