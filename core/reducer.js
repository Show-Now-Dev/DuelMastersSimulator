// Root reducer for the card game simulator.

function rootReducer(state, action) {
  if (!state) {
    return createInitialGameState();
  }

  switch (action.type) {
    case DRAW_CARD:
      return handleDrawCard(state, action.payload);
    case MOVE_CARD:
      return handleMoveCard(state, action.payload);
    case SHUFFLE_DECK:
      return handleShuffleDeck(state, action.payload);
    case RESET_GAME:
      return createInitialGameState();
    default:
      return state;
  }
}

function handleDrawCard(state, payload) {
  const deck = state.zones.deck;
  if (!deck.cardIds.length) {
    return {
      ...state,
      status: "Deck is empty – cannot draw.",
    };
  }

  const [topCardId, ...rest] = deck.cardIds;
  return {
    ...state,
    zones: {
      ...state.zones,
      deck: {
        ...deck,
        cardIds: rest,
      },
      hand: addCardIdOnTop(state.zones.hand, topCardId),
    },
    status: `Drew card: ${state.cards[topCardId].name}`,
    selectedCardId: topCardId,
  };
}

function handleMoveCard(state, payload) {
  const { cardId, fromZone, toZone } = payload;
  if (!cardId || fromZone === toZone) {
    return state;
  }

  const currentZones = state.zones;
  const from = currentZones[fromZone];
  const to = currentZones[toZone];
  if (!from || !to || !from.cardIds.includes(cardId)) {
    return state;
  }

  const withoutCard = removeCardId(from, cardId);
  const withCard =
    toZone === ZONE_IDS.DECK
      ? addCardIdOnTop(to, cardId)
      : addCardIdToBottom(to, cardId);

  return {
    ...state,
    zones: {
      ...currentZones,
      [fromZone]: withoutCard,
      [toZone]: withCard,
    },
    status: `Moved ${state.cards[cardId].name} from ${from.name} to ${to.name}`,
    selectedCardId: cardId,
  };
}

function handleShuffleDeck(state, payload) {
  const deck = state.zones.deck;
  const newOrder = [...deck.cardIds];
  shuffleArray(newOrder);

  return {
    ...state,
    zones: {
      ...state.zones,
      deck: {
        ...deck,
        cardIds: newOrder,
      },
    },
    status: "Shuffled deck.",
  };
}