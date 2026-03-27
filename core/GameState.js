// GameState represents the entire game for a single-player solitaire setup.
//
// Shape:
//   cards:           { [cardId]: CardInstance }
//   stacks:          { [stackId]: CardStack }   ← cardIds ordered bottom→top
//   zones:           { [zoneId]: Zone }          ← stackIds ordered left→right
//   selectedCardIds: string[]
//   nextStackId:     number                      ← monotone counter for new stack IDs
//   turn:            number
//   status:          string
//   players:         { id }[]
//
// UI-only state (selectedTargetZone, modal) lives in uiState.js — never here.

const PLAYER_ID = "player1";

// Populated at startup by ui.js (via startGameSimulation) before createStore is called.
// Each entry: { id, definitionId, isFaceDown }
let INITIAL_DECK_INSTANCES = [];

function createInitialGameState() {
  const cards  = {};
  const stacks = {};
  var stackCounter = 1;

  // Build zones from ZONE_DEFINITIONS.
  // The zone whose initial.placement === "deck" receives all initial deck cards;
  // all other zones start empty.
  var zones = {};
  ZONE_DEFINITIONS.forEach(function (def) {
    var stackIds = [];

    if (def.initial.placement === "deck") {
      stackIds = INITIAL_DECK_INSTANCES.map(function (raw) {
        const inst    = createCardInstance(raw);
        cards[inst.id] = inst;
        const stackId  = "stack_" + (stackCounter++);
        stacks[stackId] = createCardStack(stackId, [inst.id]);
        return stackId;
      });
    }

    zones[def.id] = { id: def.id, name: def.name, stackIds: stackIds };
  });

  return {
    cards:           cards,
    stacks:          stacks,
    zones:           zones,
    selectedCardIds: [],
    nextStackId:     stackCounter,
    turn:            1,
    status:          "Game initialized",
    players:         [{ id: PLAYER_ID }],
  };
}

function shuffleArray(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
}
