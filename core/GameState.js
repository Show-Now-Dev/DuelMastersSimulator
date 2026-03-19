// GameState represents the entire game for a single-player solitaire setup.

const PLAYER_ID = "player1";

function createInitialGameState() {
  const rawInstances = getInitialDeckCardInstances();
  const instances = {};
  rawInstances.forEach((raw) => {
    const inst = createCardInstance(raw);
    instances[inst.id] = inst;
  });

  // Shuffle starting deck
  const deckOrder = Object.keys(instances);
  shuffleArray(deckOrder);

  // Initial placement:
  // - Top 5 cards -> shield (face-down)
  // - Next 5 cards -> hand (face-up)
  const shieldCardIds = deckOrder.slice(0, 5);
  const handCardIds = deckOrder.slice(5, 10);
  const remainingDeckIds = deckOrder.slice(10);

  // Apply zone visibility rules at initialization time.
  shieldCardIds.forEach((id) => {
    instances[id] = { ...instances[id], isFaceDown: true };
  });
  handCardIds.forEach((id) => {
    instances[id] = { ...instances[id], isFaceDown: false };
  });
  remainingDeckIds.forEach((id) => {
    instances[id] = { ...instances[id], isFaceDown: true };
  });

  return {
    players: [
      {
        id: PLAYER_ID,
      },
    ],
    zones: {
      deck: {
        id: ZONE_IDS.DECK,
        name: "Deck",
        cardIds: remainingDeckIds,
      },
      hand: {
        id: ZONE_IDS.HAND,
        name: "Hand",
        cardIds: handCardIds,
      },
      battlefield: createZone(ZONE_IDS.BATTLEFIELD, "Battlefield"),
      shield: {
        id: ZONE_IDS.SHIELD,
        name: "Shield",
        cardIds: shieldCardIds,
      },
      graveyard: createZone(ZONE_IDS.GRAVEYARD, "Graveyard"),
      mana: createZone(ZONE_IDS.MANA, "Mana"),
    },
    cards: instances,
    turn: 1,
    ui: {
      selectedCardIds: [],
      selectedTargetZone: null,
    },
    status: "Game initialized",
  };
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}