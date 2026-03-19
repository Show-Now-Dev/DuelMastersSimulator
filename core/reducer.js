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
    case MOVE_SELECTED_CARDS:
      return handleMoveSelectedCards(state, action.payload);
    case TOGGLE_TAP_SELECTED_CARDS:
      return handleToggleTapSelectedCards(state);
    case TOGGLE_FACE_SELECTED_CARDS:
      return handleToggleFaceSelectedCards(state);
    case TOGGLE_CARD_SELECTION:
      return handleToggleCardSelection(state, action.payload);
    case SET_SELECTED_TARGET_ZONE:
      return handleSetSelectedTargetZone(state, action.payload);
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
    cards: {
      ...state.cards,
      [topCardId]: {
        ...state.cards[topCardId],
        isFaceDown: false,
        isTapped: false,
      },
    },
    status: `Drew card: ${state.cards[topCardId].name}`,
    selectedCardId: topCardId,
  };
}

function getZoneDefaultIsFaceDown(zoneId) {
  return zoneId === ZONE_IDS.DECK || zoneId === ZONE_IDS.SHIELD;
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
    cards: {
      ...state.cards,
      [cardId]: {
        ...state.cards[cardId],
        isFaceDown: getZoneDefaultIsFaceDown(toZone),
        // Tapped状態はゾーンに依存させずそのまま維持する。
        isTapped: state.cards[cardId].isTapped ?? false,
      },
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

function handleMoveSelectedCards(state, payload) {
  const { toZone } = payload;
  const selected = state.ui?.selectedCardIds || [];
  if (!selected.length || !toZone) {
    return state;
  }

  let nextState = state;
  selected.forEach((cardId) => {
    const zones = nextState.zones;
    let fromZone = null;
    for (const key in zones) {
      if (Object.prototype.hasOwnProperty.call(zones, key)) {
        if (zones[key].cardIds.includes(cardId)) {
          fromZone = key;
          break;
        }
      }
    }
    if (!fromZone || fromZone === toZone) {
      return;
    }
    nextState = handleMoveCard(nextState, { cardId, fromZone, toZone });
  });

  return {
    ...nextState,
    ui: {
      ...nextState.ui,
      selectedCardIds: [],
    },
  };
}

function handleToggleTapSelectedCards(state) {
  const selected = state.ui?.selectedCardIds || [];
  if (!selected.length) {
    return state;
  }

  const newCards = { ...state.cards };
  selected.forEach((cardId) => {
    const card = newCards[cardId];
    if (!card) return;
    newCards[cardId] = {
      ...card,
      isTapped: !card.isTapped,
    };
  });

  return {
    ...state,
    cards: newCards,
  };
}

function handleToggleFaceSelectedCards(state) {
  const selected = state.ui?.selectedCardIds || [];
  if (!selected.length) {
    return state;
  }

  const newCards = { ...state.cards };
  selected.forEach((cardId) => {
    const card = newCards[cardId];
    if (!card) return;
    newCards[cardId] = {
      ...card,
      isFaceDown: !card.isFaceDown,
    };
  });

  return {
    ...state,
    cards: newCards,
  };
}

function handleToggleCardSelection(state, payload) {
  const { cardId } = payload;
  if (!cardId) {
    return state;
  }
  const current = state.ui?.selectedCardIds || [];
  const already = current.includes(cardId);
  const nextSelected = already
    ? current.filter((id) => id !== cardId)
    : [...current, cardId];

  return {
    ...state,
    ui: {
      ...state.ui,
      selectedCardIds: nextSelected,
    },
  };
}

function handleSetSelectedTargetZone(state, payload) {
  const { zoneId } = payload || {};
  return {
    ...state,
    ui: {
      ...state.ui,
      selectedTargetZone: zoneId || null,
    },
  };
}