// Root reducer for the card game simulator.
//
// State invariants enforced here:
//   - Every card belongs to exactly one stack.
//   - Every stack belongs to exactly one zone.
//   - Empty stacks are removed automatically after any mutation.
//   - State is never mutated directly (all updates are immutable copies).
//   - No UI logic lives inside this file.
//
// context (third argument, injected by GameEngine.createStore):
//   {
//     cardDefinitions:    CardDefinition[]              — full card registry
//     cardDefinitionsMap: { [id]: CardDefinition }      — pre-built map for O(1) lookup
//   }
//   All functions accept context so it can be threaded through without future
//   callers needing to change their signatures.

// ── Context helper ────────────────────────────────────────────────────────────

// Look up a CardDefinition by id via the injected context.
// Falls back to undefined when context is absent (e.g. during @@INIT).
function _lookupCardDef(context, defId) {
  if (!context) return undefined;
  if (context.cardDefinitionsMap) return context.cardDefinitionsMap[defId];
  // Fallback: linear search when map is not pre-built.
  var defs = context.cardDefinitions || [];
  for (var i = 0; i < defs.length; i++) {
    if (defs[i].id === defId) return defs[i];
  }
  return undefined;
}

// ── Game Setup ────────────────────────────────────────────────────────────────
//
// Applies the standard game setup on top of a freshly created initial state:
//   1. Shuffle the deck
//   2. Move top 5 cards to Shield (face-down via zone default)
//   3. Move next 5 cards to Hand  (face-up via zone default)
//
// All movements go through applyMoveCards so no invariants are bypassed.
function applyGameSetup(state, context) {
  // Step 1: Shuffle
  var s1 = handleShuffleDeck(state, {}, context);

  // Helper: get the top card ID from a stack (bottom→top order → last element).
  function topCardOf(stacks, stackId) {
    var stack = stacks[stackId];
    return stack ? stack.cardIds[stack.cardIds.length - 1] : null;
  }

  // Step 2: Move top 5 stacks' cards → Shield (face-down by zone default)
  var deckAfterShuffle = s1.zones[ZONE_IDS.DECK];
  var shieldCardIds = deckAfterShuffle.stackIds.slice(0, 5).map(function (sid) {
    return topCardOf(s1.stacks, sid);
  }).filter(Boolean);
  var s2 = applyMoveCards(s1, shieldCardIds, { type: "zone", zoneId: ZONE_IDS.SHIELD }, "bottom", context);

  // Step 3: Move next 5 stacks' cards → Hand (face-up by zone default)
  var deckAfterShield = s2.zones[ZONE_IDS.DECK];
  var handCardIds = deckAfterShield.stackIds.slice(0, 5).map(function (sid) {
    return topCardOf(s2.stacks, sid);
  }).filter(Boolean);
  var s3 = applyMoveCards(s2, handCardIds, { type: "zone", zoneId: ZONE_IDS.HAND }, "bottom", context);

  return Object.assign({}, s3, { status: "Game ready." });
}

function rootReducer(state, action, context) {
  if (!state) return applyGameSetup(createInitialGameState(), context);

  switch (action.type) {
    // ── Core game actions ────────────────────────────────────────────────────
    case DRAW_CARD:              return handleDrawCard(state, action.payload, context);
    case SHUFFLE_DECK:           return handleShuffleDeck(state, action.payload, context);
    case SHUFFLE_ZONE:           return handleShuffleZone(state, action.payload, context);
    case RESET_GAME:             return applyGameSetup(createInitialGameState(), context);
    case MOVE_CARDS:             return handleMoveCards(state, action.payload, context);
    case MOVE_SELECTED_CARDS:    return handleMoveSelectedCards(state, action.payload, context);
    case TOGGLE_TAP_STACK:       return handleToggleTapStack(state, action.payload, context);
    case TOGGLE_FACE_CARDS:      return handleToggleFaceCards(state, action.payload, context);
    case SELECT_CARDS:           return handleSelectCards(state, action.payload, context);
    case CLEAR_SELECTION:        return handleClearSelection(state, context);
    case PLACE_FROM_DECK:          return handlePlaceFromDeck(state, action.payload, context);
    case PLACE_FROM_DECK_TO_STACK: return handlePlaceFromDeckToStack(state, action.payload, context);
    // ── Convenience actions (derive from the primitives above) ───────────────
    case TOGGLE_TAP_SELECTED_CARDS:  return handleToggleTapSelectedCards(state, context);
    case TOGGLE_FACE_SELECTED_CARDS: return handleToggleFaceSelectedCards(state, context);
    case TOGGLE_CARD_SELECTION:      return handleToggleCardSelection(state, action.payload, context);
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
function applyMoveCards(state, cardIds, target, position, context) {
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

    // "top"    = prepend (front of zone, e.g. top of deck or graveyard).
    // "bottom" = append (back of zone).
    // number   = insert at 0-based index in zone.stackIds (e.g. deck insertion at position N).
    var updatedStackIds;
    if (typeof effectivePosition === "number") {
      var insertIdx = Math.max(0, Math.min(effectivePosition, targetZone.stackIds.length));
      updatedStackIds = targetZone.stackIds.slice(0, insertIdx)
        .concat(newStackIds)
        .concat(targetZone.stackIds.slice(insertIdx));
    } else if (effectivePosition === "top") {
      updatedStackIds = newStackIds.concat(targetZone.stackIds);
    } else {
      updatedStackIds = targetZone.stackIds.concat(newStackIds);
    }

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
function handleMoveCards(state, payload, context) {
  var cardIds  = payload.cardIds;
  var target   = payload.target;
  var position = payload.position || "bottom";
  if (!cardIds || !cardIds.length || !target) return state;
  return applyMoveCards(state, cardIds, target, position, context);
}

// ── Handler: MOVE_SELECTED_CARDS ─────────────────────────────────────────────
function handleMoveSelectedCards(state, payload, context) {
  var target   = payload.target;
  var position = payload.position || "bottom";
  var cardIds  = state.selectedCardIds || [];
  if (!cardIds.length || !target) return state;

  var next = applyMoveCards(state, cardIds, target, position, context);
  return Object.assign({}, next, { selectedCardIds: [] });
}

// ── Handler: TOGGLE_TAP_STACK ────────────────────────────────────────────────
function handleToggleTapStack(state, payload, context) {
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
function handleToggleFaceCards(state, payload, context) {
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
function handleSelectCards(state, payload, context) {
  return Object.assign({}, state, { selectedCardIds: payload.cardIds || [] });
}

// ── Handler: CLEAR_SELECTION ─────────────────────────────────────────────────
function handleClearSelection(state, context) {
  return Object.assign({}, state, { selectedCardIds: [] });
}

// ── Handler: DRAW_CARD ────────────────────────────────────────────────────────
// Takes the top card of the top deck stack and moves it to hand.
function handleDrawCard(state, payload, context) {
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
  var topCard   = state.cards[topCardId];
  var topDef    = topCard ? _lookupCardDef(context, topCard.definitionId) : null;
  var cardName  = topDef ? topDef.name : topCardId;

  var next = applyMoveCards(
    state,
    [topCardId],
    { type: "zone", zoneId: ZONE_IDS.HAND },
    "bottom",
    context
  );
  return Object.assign({}, next, { status: "Drew card: " + cardName });
}

// ── Handler: PLACE_FROM_DECK ──────────────────────────────────────────────────
// Takes the top card of the deck, moves it to the target zone, then applies
// explicit face and tap states (overriding zone defaults).
// Used for Deck → Mana / Shield drag-and-drop.
function handlePlaceFromDeck(state, payload, context) {
  var zoneId     = payload.zoneId;
  var isFaceDown = payload.isFaceDown;
  var isTapped   = payload.isTapped;

  var deckZone = state.zones[ZONE_IDS.DECK];
  if (!deckZone || !deckZone.stackIds.length) {
    return Object.assign({}, state, { status: "Deck is empty." });
  }

  var topStackId = deckZone.stackIds[0];
  var topStack   = state.stacks[topStackId];
  if (!topStack || !topStack.cardIds.length) {
    return Object.assign({}, state, { status: "Deck is empty." });
  }

  var topCardId = topStack.cardIds[topStack.cardIds.length - 1];

  // Move card to the target zone (zone default face state will be applied by applyMoveCards,
  // then we override it below).
  var next = applyMoveCards(
    state,
    [topCardId],
    { type: "zone", zoneId: zoneId },
    "bottom",
    context
  );

  // Override face state with the explicit caller value.
  var newCards = Object.assign({}, next.cards);
  if (newCards[topCardId]) {
    newCards[topCardId] = Object.assign({}, newCards[topCardId], { isFaceDown: isFaceDown });
  }
  next = Object.assign({}, next, { cards: newCards });

  // Apply tap state to the newly created stack.
  // The card was appended ("bottom"), so its stack is the last entry in the target zone.
  var targetZone = next.zones[zoneId];
  if (targetZone && targetZone.stackIds.length && isTapped) {
    var newStackId = targetZone.stackIds[targetZone.stackIds.length - 1];
    var newStacks  = Object.assign({}, next.stacks, {
      [newStackId]: Object.assign({}, next.stacks[newStackId], { isTapped: true }),
    });
    next = Object.assign({}, next, { stacks: newStacks });
  }

  return Object.assign({}, next, { status: "Placed card from deck to " + zoneId + "." });
}

// ── Handler: PLACE_FROM_DECK_TO_STACK ────────────────────────────────────────
// Takes the top card of the deck, places it onto an existing stack, then
// applies explicit face and tap states.
// Used for Deck → Battlefield / Shield card-stacking drag-and-drop.
function handlePlaceFromDeckToStack(state, payload, context) {
  var stackId    = payload.stackId;
  var isFaceDown = payload.isFaceDown;
  var isTapped   = payload.isTapped;

  var deckZone = state.zones[ZONE_IDS.DECK];
  if (!deckZone || !deckZone.stackIds.length) {
    return Object.assign({}, state, { status: "Deck is empty." });
  }
  var topStack = state.stacks[deckZone.stackIds[0]];
  if (!topStack || !topStack.cardIds.length) {
    return Object.assign({}, state, { status: "Deck is empty." });
  }
  var topCardId = topStack.cardIds[topStack.cardIds.length - 1];

  // Move top deck card onto the target stack (top of pile).
  var next = applyMoveCards(
    state,
    [topCardId],
    { type: "stack", stackId: stackId },
    "top",
    context
  );

  // Override face state.
  var newCards = Object.assign({}, next.cards);
  if (newCards[topCardId]) {
    newCards[topCardId] = Object.assign({}, newCards[topCardId], { isFaceDown: isFaceDown });
  }
  next = Object.assign({}, next, { cards: newCards });

  // Apply tap state to the target stack.
  if (isTapped && next.stacks[stackId]) {
    var newStacks = Object.assign({}, next.stacks, {
      [stackId]: Object.assign({}, next.stacks[stackId], { isTapped: true }),
    });
    next = Object.assign({}, next, { stacks: newStacks });
  }

  return Object.assign({}, next, { status: "Placed card from deck onto stack." });
}

// ── Handler: SHUFFLE_DECK ─────────────────────────────────────────────────────
// Shuffles the order of stacks in the deck zone (not card order within stacks).
function handleShuffleDeck(state, payload, context) {
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

// ── Handler: SHUFFLE_ZONE ─────────────────────────────────────────────────────
// Shuffles the stack order within any zone (not restricted to the deck).
function handleShuffleZone(state, payload, context) {
  var zone = state.zones[payload.zoneId];
  if (!zone) return state;
  var newStackIds = zone.stackIds.slice();
  shuffleArray(newStackIds);
  return Object.assign({}, state, {
    zones: Object.assign({}, state.zones, {
      [payload.zoneId]: Object.assign({}, zone, { stackIds: newStackIds }),
    }),
    status: "Shuffled " + payload.zoneId + ".",
  });
}

// ── Convenience handlers (delegate to primitives) ────────────────────────────

// Toggle tap on all stacks that contain a selected card.
function handleToggleTapSelectedCards(state, context) {
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
function handleToggleFaceSelectedCards(state, context) {
  var selected = state.selectedCardIds || [];
  return handleToggleFaceCards(state, { cardIds: selected }, context);
}

// Toggle one card in/out of the selection.
function handleToggleCardSelection(state, payload, context) {
  var cardId  = payload.cardId;
  if (!cardId) return state;
  var current  = state.selectedCardIds || [];
  var already  = current.indexOf(cardId) !== -1;
  var nextSelected = already
    ? current.filter(function (id) { return id !== cardId; })
    : current.concat([cardId]);
  return Object.assign({}, state, { selectedCardIds: nextSelected });
}
