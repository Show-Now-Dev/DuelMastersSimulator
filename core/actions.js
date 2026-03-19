// Action type constants

const DRAW_CARD = "DRAW_CARD";
const MOVE_CARD = "MOVE_CARD";
const SHUFFLE_DECK = "SHUFFLE_DECK";
const RESET_GAME = "RESET_GAME";
const MOVE_SELECTED_CARDS = "MOVE_SELECTED_CARDS";
const TOGGLE_TAP_SELECTED_CARDS = "TOGGLE_TAP_SELECTED_CARDS";
const TOGGLE_FACE_SELECTED_CARDS = "TOGGLE_FACE_SELECTED_CARDS";
const TOGGLE_CARD_SELECTION = "TOGGLE_CARD_SELECTION";
const SET_SELECTED_TARGET_ZONE = "SET_SELECTED_TARGET_ZONE";

// Action creators

function drawCard(playerId) {
  return {
    type: DRAW_CARD,
    payload: { playerId },
  };
}

function moveCard(cardId, fromZone, toZone) {
  return {
    type: MOVE_CARD,
    payload: { cardId, fromZone, toZone },
  };
}

function shuffleDeck(playerId) {
  return {
    type: SHUFFLE_DECK,
    payload: { playerId },
  };
}

function resetGame() {
  return {
    type: RESET_GAME,
    payload: null,
  };
}

function moveSelectedCards(toZone) {
  return {
    type: MOVE_SELECTED_CARDS,
    payload: { toZone },
  };
}

function toggleTapSelectedCards() {
  return {
    type: TOGGLE_TAP_SELECTED_CARDS,
    payload: null,
  };
}

function toggleFaceSelectedCards() {
  return {
    type: TOGGLE_FACE_SELECTED_CARDS,
    payload: null,
  };
}

function toggleCardSelection(cardId) {
  return {
    type: TOGGLE_CARD_SELECTION,
    payload: { cardId },
  };
}

function setSelectedTargetZone(zoneId) {
  return {
    type: SET_SELECTED_TARGET_ZONE,
    payload: { zoneId },
  };
}