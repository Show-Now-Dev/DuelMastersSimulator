// Action type constants

const DRAW_CARD = "DRAW_CARD";
const MOVE_CARD = "MOVE_CARD";
const SHUFFLE_DECK = "SHUFFLE_DECK";
const RESET_GAME = "RESET_GAME";

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