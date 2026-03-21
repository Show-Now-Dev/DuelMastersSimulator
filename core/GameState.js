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

// Populated at startup from decks.json by ui.js before createStore is called.
// Each entry: { id, definitionId, isFaceDown }
let INITIAL_DECK_INSTANCES = [];

function createInitialGameState() {
  const cards  = {};
  const stacks = {};
  var stackCounter = 1;

  // Build one stack per card, all placed in the Deck zone.
  const deckStackIds = INITIAL_DECK_INSTANCES.map(function (raw) {
    const inst = createCardInstance(raw);
    cards[inst.id] = inst;
    const stackId = "stack_" + (stackCounter++);
    stacks[stackId] = createCardStack(stackId, [inst.id]);
    return stackId;
  });

  return {
    cards:  cards,
    stacks: stacks,
    zones: {
      [ZONE_IDS.DECK]:            { id: ZONE_IDS.DECK,            name: "Deck",            stackIds: deckStackIds },
      [ZONE_IDS.HAND]:            { id: ZONE_IDS.HAND,            name: "Hand",            stackIds: [] },
      [ZONE_IDS.BATTLEFIELD]:     { id: ZONE_IDS.BATTLEFIELD,     name: "Battlefield",     stackIds: [] },
      [ZONE_IDS.SHIELD]:          { id: ZONE_IDS.SHIELD,          name: "Shield",          stackIds: [] },
      [ZONE_IDS.GRAVEYARD]:       { id: ZONE_IDS.GRAVEYARD,       name: "Graveyard",       stackIds: [] },
      [ZONE_IDS.MANA]:            { id: ZONE_IDS.MANA,            name: "Mana",            stackIds: [] },
      [ZONE_IDS.RESOLUTION_ZONE]: { id: ZONE_IDS.RESOLUTION_ZONE, name: "Resolution Zone", stackIds: [] },
      [ZONE_IDS.EX]:              { id: ZONE_IDS.EX,              name: "EX",              stackIds: [] },
      [ZONE_IDS.GR]:              { id: ZONE_IDS.GR,              name: "GR",              stackIds: [] },
    },
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
