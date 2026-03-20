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

function createInitialGameState() {
  const rawInstances = getInitialDeckCardInstances();
  const cards = {};
  rawInstances.forEach(function (raw) {
    const inst = createCardInstance(raw);
    cards[inst.id] = inst;
  });

  const allIds = Object.keys(cards);
  shuffleArray(allIds);

  const shieldCardIds    = allIds.slice(0, 5);
  const handCardIds      = allIds.slice(5, 10);
  const deckCardIds      = allIds.slice(10);

  // Apply zone visibility rules.
  shieldCardIds.forEach(function (id) { cards[id] = Object.assign({}, cards[id], { isFaceDown: true  }); });
  handCardIds  .forEach(function (id) { cards[id] = Object.assign({}, cards[id], { isFaceDown: false }); });
  deckCardIds  .forEach(function (id) { cards[id] = Object.assign({}, cards[id], { isFaceDown: true  }); });

  // Build stacks: one single-card stack per card.
  var stackCounter = 1;
  const stacks = {};

  function makeStacks(cardIds) {
    return cardIds.map(function (cardId) {
      const id = "stack_" + (stackCounter++);
      stacks[id] = createCardStack(id, [cardId]);
      return id;
    });
  }

  const shieldStackIds = makeStacks(shieldCardIds);
  const handStackIds   = makeStacks(handCardIds);
  const deckStackIds   = makeStacks(deckCardIds);

  return {
    cards:  cards,
    stacks: stacks,
    zones: {
      [ZONE_IDS.DECK]:            { id: ZONE_IDS.DECK,            name: "Deck",            stackIds: deckStackIds   },
      [ZONE_IDS.HAND]:            { id: ZONE_IDS.HAND,            name: "Hand",            stackIds: handStackIds   },
      [ZONE_IDS.BATTLEFIELD]:     { id: ZONE_IDS.BATTLEFIELD,     name: "Battlefield",     stackIds: []             },
      [ZONE_IDS.SHIELD]:          { id: ZONE_IDS.SHIELD,          name: "Shield",          stackIds: shieldStackIds },
      [ZONE_IDS.GRAVEYARD]:       { id: ZONE_IDS.GRAVEYARD,       name: "Graveyard",       stackIds: []             },
      [ZONE_IDS.MANA]:            { id: ZONE_IDS.MANA,            name: "Mana",            stackIds: []             },
      [ZONE_IDS.RESOLUTION_ZONE]: { id: ZONE_IDS.RESOLUTION_ZONE, name: "Resolution Zone", stackIds: []             },
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
