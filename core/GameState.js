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
        cardIds: deckOrder,
      },
      hand: createZone(ZONE_IDS.HAND, "Hand"),
      battlefield: createZone(ZONE_IDS.BATTLEFIELD, "Battlefield"),
      graveyard: createZone(ZONE_IDS.GRAVEYARD, "Graveyard"),
      mana: createZone(ZONE_IDS.MANA, "Mana"),
    },
    cards: instances,
    turn: 1,
    selectedCardId: null,
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