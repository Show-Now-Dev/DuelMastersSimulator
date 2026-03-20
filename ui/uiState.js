// ui/uiState.js
//
// Manages purely presentational state that must never enter the game reducer.
// Handled by a separate store from the game store.
//
// Shape:
//   selectedTargetZone: string | null    ← zone ID chosen in "move to" dropdown
//   modal: null | {                       ← active overlay modal, or null when closed
//     type:            string             (e.g. "STACK_CARD_SELECTOR")
//     targetId:        string             (e.g. stackId)
//     selectedCardIds: string[]           (cards selected inside the modal)
//   }

// ── UI action type constants ──────────────────────────────────────────────────
// SET_SELECTED_TARGET_ZONE is declared in actions.js.
// The uiReducer handles it here so it never touches the game reducer.

const OPEN_MODAL         = "OPEN_MODAL";
const CLOSE_MODAL        = "CLOSE_MODAL";
const SELECT_MODAL_CARDS = "SELECT_MODAL_CARDS";

// ── Action creators ───────────────────────────────────────────────────────────

// Open a modal.
// modalType: string identifying the modal to render (e.g. "STACK_CARD_SELECTOR")
// targetId:  context-dependent ID (e.g. stackId for STACK_CARD_SELECTOR)
function openModal(modalType, targetId) {
  return { type: OPEN_MODAL, payload: { modalType: modalType, targetId: targetId } };
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
          type:            action.payload.modalType,
          targetId:        action.payload.targetId,
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
