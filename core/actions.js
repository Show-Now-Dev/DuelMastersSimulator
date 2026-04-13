// Action type constants

// Game actions
const DRAW_CARD              = "DRAW_CARD";
const SHUFFLE_DECK           = "SHUFFLE_DECK";
const RESET_GAME             = "RESET_GAME";
const MOVE_CARDS             = "MOVE_CARDS";
const MOVE_SELECTED_CARDS    = "MOVE_SELECTED_CARDS";
const TOGGLE_TAP_STACK       = "TOGGLE_TAP_STACK";
const TOGGLE_FACE_CARDS      = "TOGGLE_FACE_CARDS";
const SELECT_CARDS           = "SELECT_CARDS";
const CLEAR_SELECTION        = "CLEAR_SELECTION";
const PLACE_FROM_DECK          = "PLACE_FROM_DECK";
const PLACE_FROM_DECK_TO_STACK = "PLACE_FROM_DECK_TO_STACK";
const SHUFFLE_ZONE             = "SHUFFLE_ZONE";

// Convenience / UI actions
const TOGGLE_TAP_SELECTED_CARDS  = "TOGGLE_TAP_SELECTED_CARDS";
const TOGGLE_FACE_SELECTED_CARDS = "TOGGLE_FACE_SELECTED_CARDS";
const TOGGLE_CARD_SELECTION      = "TOGGLE_CARD_SELECTION";
const SET_SELECTED_TARGET_ZONE   = "SET_SELECTED_TARGET_ZONE";

// ── Action creators ───────────────────────────────────────────────────────────

function drawCard(playerId) {
  return { type: DRAW_CARD, payload: { playerId } };
}

function shuffleDeck(playerId) {
  return { type: SHUFFLE_DECK, payload: { playerId } };
}

// Shuffle the stacks within a specific zone (not deck-wide).
function shuffleZone(zoneId) {
  return { type: SHUFFLE_ZONE, payload: { zoneId } };
}

function resetGame() {
  return { type: RESET_GAME, payload: null };
}

// Move explicit card IDs to a zone or onto an existing stack.
//
// target: { type: "zone", zoneId: string }
//       | { type: "stack", stackId: string }
// position: "top" | "bottom" | number
//   For zones:  "top"    = prepend (front of stackIds, e.g. top of deck)
//               "bottom" = append
//               number   = insert at 0-based index in zone.stackIds (deck insertion)
//   For stacks: "top"    = top of pile (end of cardIds in bottom→top order)
//               "bottom" = bottom of pile
function moveCards(cardIds, target, position) {
  return { type: MOVE_CARDS, payload: { cardIds, target, position: position !== undefined ? position : "bottom" } };
}

// Move the top card of the deck to a zone with explicit face and tap state.
// Used for Deck → Mana / Shield drag-and-drop where the user chooses face/tap.
//
// zoneId:     target zone ("mana" | "shield")
// isFaceDown: explicit face state (overrides zone default)
// isTapped:   tap state applied to the newly created stack
function placeFromDeck(zoneId, isFaceDown, isTapped) {
  return { type: PLACE_FROM_DECK, payload: { zoneId, isFaceDown, isTapped } };
}

// Move the top card of the deck onto an existing stack with explicit face and tap state.
// Used for Deck → Battlefield / Shield card-stacking drag-and-drop.
//
// stackId:    target stack to place the card on top of
// zoneId:     zone that owns the target stack (for logging / state lookup)
// isFaceDown: explicit face state
// isTapped:   tap state applied to the target stack after placement
function placeFromDeckToStack(stackId, zoneId, isFaceDown, isTapped) {
  return { type: PLACE_FROM_DECK_TO_STACK, payload: { stackId, zoneId, isFaceDown, isTapped } };
}

// Stack currently selected cards onto an existing stack.
// Reuses MOVE_SELECTED_CARDS; the reducer handles both zone and stack targets.
function stackSelectedCards(stackId, position) {
  return {
    type: MOVE_SELECTED_CARDS,
    payload: {
      target:   { type: "stack", stackId: stackId },
      position: position || "top",
    },
  };
}

// Move currently selected cards to a zone.
// toZone: zone ID string (convenience — wraps into the standard target shape)
function moveSelectedCards(toZone, position) {
  return {
    type: MOVE_SELECTED_CARDS,
    payload: {
      target:   { type: "zone", zoneId: toZone },
      position: position || "bottom",
    },
  };
}

// Toggle tap state of a specific stack.
function toggleTapStack(stackId) {
  return { type: TOGGLE_TAP_STACK, payload: { stackId } };
}

// Toggle face state (isFaceDown) of specific cards.
function toggleFaceCards(cardIds) {
  return { type: TOGGLE_FACE_CARDS, payload: { cardIds } };
}

// Replace the selection with a new list of card IDs.
function selectCards(cardIds) {
  return { type: SELECT_CARDS, payload: { cardIds } };
}

function clearSelection() {
  return { type: CLEAR_SELECTION, payload: null };
}

// ── Convenience action creators (used by UI buttons) ─────────────────────────

// Toggle tap on all stacks that contain a selected card.
function toggleTapSelectedCards() {
  return { type: TOGGLE_TAP_SELECTED_CARDS, payload: null };
}

// Toggle face on all selected cards.
function toggleFaceSelectedCards() {
  return { type: TOGGLE_FACE_SELECTED_CARDS, payload: null };
}

// Toggle one card in/out of the selection.
function toggleCardSelection(cardId) {
  return { type: TOGGLE_CARD_SELECTION, payload: { cardId } };
}

function setSelectedTargetZone(zoneId) {
  return { type: SET_SELECTED_TARGET_ZONE, payload: { zoneId } };
}
