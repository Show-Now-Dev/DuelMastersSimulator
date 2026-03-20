// Root reducer for the card game simulator.
//
// State invariants enforced here:
//   - Every card belongs to exactly one stack.
//   - Every stack belongs to exactly one zone.
//   - Empty stacks are removed automatically after any mutation.
//   - State is never mutated directly (all updates are immutable copies).
//   - No UI logic lives inside this file.

function rootReducer(state, action) {
  if (!state) return createInitialGameState();

  switch (action.type) {
    // ── Core game actions ────────────────────────────────────────────────────
    case DRAW_CARD:              return handleDrawCard(state, action.payload);
    case SHUFFLE_DECK:           return handleShuffleDeck(state, action.payload);
    case RESET_GAME:             return createInitialGameState();
    case MOVE_CARDS:             return handleMoveCards(state, action.payload);
    case MOVE_SELECTED_CARDS:    return handleMoveSelectedCards(state, action.payload);
    case TOGGLE_TAP_STACK:       return handleToggleTapStack(state, action.payload);
    case TOGGLE_FACE_CARDS:      return handleToggleFaceCards(state, action.payload);
    case SELECT_CARDS:           return handleSelectCards(state, action.payload);
    case CLEAR_SELECTION:        return handleClearSelection(state);
    // ── Convenience actions (derive from the primitives above) ───────────────
    case TOGGLE_TAP_SELECTED_CARDS:  return handleToggleTapSelectedCards(state);
    case TOGGLE_FACE_SELECTED_CARDS: return handleToggleFaceSelectedCards(state);
    case TOGGLE_CARD_SELECTION:      return handleToggleCardSelection(state, action.payload);
    // SET_SELECTED_TARGET_ZONE is now handled by uiReducer — ignore here.
    default:                         return state;
  }
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

// Returns the stackId that contains cardId, or null.
function findStackForCard(stacks, cardId) {
  for (var stackId in stacks) {
    if (Object.prototype.hasOwnProperty.call(stacks, stackId)) {
      if (stacks[stackId].cardIds.indexOf(cardId) !== -1) return stackId;
    }
  }
  return null;
}

// Returns the zoneId that contains stackId, or null.
function findZoneForStack(zones, stackId) {
  for (var zoneId in zones) {
    if (Object.prototype.hasOwnProperty.call(zones, zoneId)) {
      if (zones[zoneId].stackIds.indexOf(stackId) !== -1) return zoneId;
    }
  }
  return null;
}

// Cards in deck/shield zones are face-down by default when moved there.
function getZoneDefaultIsFaceDown(zoneId) {
  return zoneId === ZONE_IDS.DECK || zoneId === ZONE_IDS.SHIELD;
}

// ── Core move logic ───────────────────────────────────────────────────────────
//
// applyMoveCards is the single place where cards move between stacks/zones.
// It is called by both MOVE_CARDS and MOVE_SELECTED_CARDS.
//
// Rules enforced:
//   - Cards not found in any stack are silently skipped.
//   - Stacks that become empty after removal are deleted and unlinked from zones.
//   - isFaceDown on moved cards is updated to match the target zone's default.
function applyMoveCards(state, cardIds, target, position) {
  var stacks      = state.stacks;
  var zones       = state.zones;
  var cards       = state.cards;
  var nextStackId = state.nextStackId;

  // ── Step 1: Remove each card from its current stack ──────────────────────
  var touchedStackIds = {};

  cardIds.forEach(function (cardId) {
    var stackId = findStackForCard(stacks, cardId);
    if (!stackId) return; // card not in any stack — skip
    touchedStackIds[stackId] = true;
    var stack    = stacks[stackId];
    var newCardIds = stack.cardIds.filter(function (id) { return id !== cardId; });
    stacks = Object.assign({}, stacks, { [stackId]: Object.assign({}, stack, { cardIds: newCardIds }) });
  });

  // ── Step 2: Purge empty stacks and unlink them from zones ─────────────────
  Object.keys(touchedStackIds).forEach(function (stackId) {
    if (!stacks[stackId] || stacks[stackId].cardIds.length > 0) return;

    var zoneId = findZoneForStack(zones, stackId);
    if (zoneId) {
      var zone = zones[zoneId];
      zones = Object.assign({}, zones, {
        [zoneId]: Object.assign({}, zone, {
          stackIds: zone.stackIds.filter(function (id) { return id !== stackId; }),
        }),
      });
    }
    var rest = Object.assign({}, stacks);
    delete rest[stackId];
    stacks = rest;
  });

  // ── Step 3: Place cards in the target ────────────────────────────────────
  var targetZoneId = null;

  if (target.type === "stack") {
    var targetStack = stacks[target.stackId];
    if (!targetStack) return state; // invalid target — bail without mutation

    // bottom→top order: "top" = end of array, "bottom" = start of array
    var mergedCardIds = (position === "top")
      ? targetStack.cardIds.concat(cardIds)
      : cardIds.concat(targetStack.cardIds);

    stacks = Object.assign({}, stacks, {
      [target.stackId]: Object.assign({}, targetStack, { cardIds: mergedCardIds }),
    });

    targetZoneId = findZoneForStack(zones, target.stackId);

  } else if (target.type === "zone") {
    var targetZone = zones[target.zoneId];
    if (!targetZone) return state; // invalid target — bail without mutation

    targetZoneId = target.zoneId;

    // Each moved card becomes its own new single-card stack in the zone.
    var newStackIds = cardIds.map(function (cardId) {
      var id = "stack_" + nextStackId;
      nextStackId += 1;
      stacks = Object.assign({}, stacks, { [id]: createCardStack(id, [cardId]) });
      return id;
    });

    // Graveyard always receives cards on top (newest first), ignoring caller position.
    var effectivePosition = (targetZoneId === ZONE_IDS.GRAVEYARD) ? "top" : position;

    // "top" = prepend (front of zone, e.g. top of deck or graveyard).
    // "bottom" = append (back of zone).
    var updatedStackIds = (effectivePosition === "top")
      ? newStackIds.concat(targetZone.stackIds)
      : targetZone.stackIds.concat(newStackIds);

    zones = Object.assign({}, zones, {
      [targetZoneId]: Object.assign({}, targetZone, { stackIds: updatedStackIds }),
    });
  }

  // ── Step 4: Apply zone-default face state to moved cards ──────────────────
  if (targetZoneId !== null) {
    var faceDown  = getZoneDefaultIsFaceDown(targetZoneId);
    var newCards  = Object.assign({}, cards);
    cardIds.forEach(function (cardId) {
      if (!newCards[cardId]) return;
      newCards[cardId] = Object.assign({}, newCards[cardId], { isFaceDown: faceDown });
    });
    cards = newCards;
  }

  return Object.assign({}, state, { cards: cards, stacks: stacks, zones: zones, nextStackId: nextStackId });
}

// ── Handler: MOVE_CARDS ───────────────────────────────────────────────────────
function handleMoveCards(state, payload) {
  var cardIds  = payload.cardIds;
  var target   = payload.target;
  var position = payload.position || "bottom";
  if (!cardIds || !cardIds.length || !target) return state;
  return applyMoveCards(state, cardIds, target, position);
}

// ── Handler: MOVE_SELECTED_CARDS ─────────────────────────────────────────────
function handleMoveSelectedCards(state, payload) {
  var target   = payload.target;
  var position = payload.position || "bottom";
  var cardIds  = state.selectedCardIds || [];
  if (!cardIds.length || !target) return state;

  var next = applyMoveCards(state, cardIds, target, position);
  return Object.assign({}, next, { selectedCardIds: [] });
}

// ── Handler: TOGGLE_TAP_STACK ────────────────────────────────────────────────
function handleToggleTapStack(state, payload) {
  var stackId = payload.stackId;
  var stack   = state.stacks[stackId];
  if (!stack) return state;
  return Object.assign({}, state, {
    stacks: Object.assign({}, state.stacks, {
      [stackId]: Object.assign({}, stack, { isTapped: !stack.isTapped }),
    }),
  });
}

// ── Handler: TOGGLE_FACE_CARDS ───────────────────────────────────────────────
function handleToggleFaceCards(state, payload) {
  var cardIds = payload.cardIds;
  if (!cardIds || !cardIds.length) return state;
  var newCards = Object.assign({}, state.cards);
  cardIds.forEach(function (cardId) {
    var card = newCards[cardId];
    if (!card) return;
    newCards[cardId] = Object.assign({}, card, { isFaceDown: !card.isFaceDown });
  });
  return Object.assign({}, state, { cards: newCards });
}

// ── Handler: SELECT_CARDS ─────────────────────────────────────────────────────
function handleSelectCards(state, payload) {
  return Object.assign({}, state, { selectedCardIds: payload.cardIds || [] });
}

// ── Handler: CLEAR_SELECTION ─────────────────────────────────────────────────
function handleClearSelection(state) {
  return Object.assign({}, state, { selectedCardIds: [] });
}

// ── Handler: DRAW_CARD ────────────────────────────────────────────────────────
// Takes the top card of the top deck stack and moves it to hand.
function handleDrawCard(state, payload) {
  var deckZone = state.zones[ZONE_IDS.DECK];
  if (!deckZone.stackIds.length) {
    return Object.assign({}, state, { status: "Deck is empty – cannot draw." });
  }

  // Top of deck = first stackId; top card = last cardId in bottom→top order.
  var topStackId = deckZone.stackIds[0];
  var topStack   = state.stacks[topStackId];
  if (!topStack || !topStack.cardIds.length) {
    return Object.assign({}, state, { status: "Deck is empty – cannot draw." });
  }

  var topCardId = topStack.cardIds[topStack.cardIds.length - 1];
  var cardName  = state.cards[topCardId].name;

  var next = applyMoveCards(
    state,
    [topCardId],
    { type: "zone", zoneId: ZONE_IDS.HAND },
    "bottom"
  );
  return Object.assign({}, next, { status: "Drew card: " + cardName });
}

// ── Handler: SHUFFLE_DECK ─────────────────────────────────────────────────────
// Shuffles the order of stacks in the deck zone (not card order within stacks).
function handleShuffleDeck(state, payload) {
  var deckZone    = state.zones[ZONE_IDS.DECK];
  var newStackIds = deckZone.stackIds.slice();
  shuffleArray(newStackIds);
  return Object.assign({}, state, {
    zones: Object.assign({}, state.zones, {
      [ZONE_IDS.DECK]: Object.assign({}, deckZone, { stackIds: newStackIds }),
    }),
    status: "Shuffled deck.",
  });
}

// ── Convenience handlers (delegate to primitives) ────────────────────────────

// Toggle tap on all stacks that contain a selected card.
function handleToggleTapSelectedCards(state) {
  var selected = state.selectedCardIds || [];
  if (!selected.length) return state;

  var stacksToToggle = {};
  selected.forEach(function (cardId) {
    var stackId = findStackForCard(state.stacks, cardId);
    if (stackId) stacksToToggle[stackId] = true;
  });

  var newStacks = Object.assign({}, state.stacks);
  Object.keys(stacksToToggle).forEach(function (stackId) {
    newStacks[stackId] = Object.assign({}, newStacks[stackId], {
      isTapped: !newStacks[stackId].isTapped,
    });
  });
  return Object.assign({}, state, { stacks: newStacks });
}

// Toggle face on all selected cards.
function handleToggleFaceSelectedCards(state) {
  var selected = state.selectedCardIds || [];
  return handleToggleFaceCards(state, { cardIds: selected });
}

// Toggle one card in/out of the selection.
function handleToggleCardSelection(state, payload) {
  var cardId  = payload.cardId;
  if (!cardId) return state;
  var current  = state.selectedCardIds || [];
  var already  = current.indexOf(cardId) !== -1;
  var nextSelected = already
    ? current.filter(function (id) { return id !== cardId; })
    : current.concat([cardId]);
  return Object.assign({}, state, { selectedCardIds: nextSelected });
}

