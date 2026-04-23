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
    // ── Link actions ─────────────────────────────────────────────────────────
    case LINK_CARDS:             return handleLinkCards(state, action.payload, context);
    case UNLINK_CARDS:           return handleUnlinkCards(state, action.payload, context);
    case LINK_FROM_PENDING_DROP: return handleLinkFromPendingDrop(state, action.payload, context);
    case REORDER_LINK_SLOTS:     return handleReorderLinkSlots(state, action.payload);
    // ── Convenience actions (derive from the primitives above) ───────────────
    case TOGGLE_TAP_SELECTED_CARDS:  return handleToggleTapSelectedCards(state, context);
    case TOGGLE_FACE_SELECTED_CARDS: return handleToggleFaceSelectedCards(state, context);
    case TOGGLE_CARD_SELECTION:      return handleToggleCardSelection(state, action.payload, context);
    case SET_CARD_FORM_INDEX:        return handleSetCardFormIndex(state, action.payload);
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
//
// options (optional):
//   keepStack: boolean  — when true and target is a zone, place all cardIds as
//                         one combined stack instead of N individual stacks.
//   linkSlots: [...]    — if provided alongside keepStack, recreate link structure
//                         on the new stack (cardIds derived from slots).
function applyMoveCards(state, cardIds, target, position, context, options) {
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

  // ── Step 1b: Update linkSlots on any linked stacks that lost cards ────────
  // When cards are partially removed from a linked stack, keep linkSlots in sync.
  // If fewer than 2 slots remain, the link is automatically dissolved.
  Object.keys(touchedStackIds).forEach(function (stackId) {
    var stack = stacks[stackId];
    if (!stack || !stack.isLinked || !stack.linkSlots) return;

    var updatedSlots = stack.linkSlots.map(function (slot) {
      return Object.assign({}, slot, {
        group: slot.group.filter(function (id) { return cardIds.indexOf(id) === -1; }),
      });
    }).filter(function (slot) { return slot.group.length > 0; });

    var stillLinked = updatedSlots.length >= 2;
    // Re-number col indices to be contiguous after any removal.
    var renumbered = stillLinked ? updatedSlots.map(function (slot, idx) {
      return Object.assign({}, slot, { col: idx });
    }) : null;

    stacks = Object.assign({}, stacks, {
      [stackId]: Object.assign({}, stack, {
        isLinked:  stillLinked,
        linkSlots: renumbered,
      }),
    });
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

    // Auto-unlink: stacking onto a linked object dissolves the link.
    // All previously linked cards become sub-cards below the new top card.
    if (targetStack.isLinked) {
      targetStack = Object.assign({}, targetStack, { isLinked: false, linkSlots: null });
      stacks = Object.assign({}, stacks, { [target.stackId]: targetStack });
    }

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

    // Graveyard always receives cards on top (newest first), ignoring caller position.
    var effectivePosition = (targetZoneId === ZONE_IDS.GRAVEYARD) ? "top" : position;

    var keepStack   = !!(options && options.keepStack) && cardIds.length > 1;
    var inLinkSlots = (options && options.linkSlots) || null;
    var arrivedStackIds; // stack IDs added to the zone

    if (keepStack) {
      // ── Place all cards as ONE combined stack ─────────────────────────────
      // When linkSlots is provided, recreate the linked structure; cardIds order
      // is derived from the slots (row-then-col) to stay consistent.
      var ksId      = "stack_" + nextStackId;
      nextStackId  += 1;
      var ksCardIds = inLinkSlots ? deriveCardIdsFromLinkSlots(inLinkSlots) : cardIds;
      var ksStack   = createCardStack(ksId, ksCardIds);
      if (inLinkSlots) {
        ksStack = Object.assign({}, ksStack, { isLinked: true, linkSlots: inLinkSlots });
        cardIds = ksCardIds; // align for face-state application in Step 4
      }
      stacks         = Object.assign({}, stacks, { [ksId]: ksStack });
      arrivedStackIds = [ksId];
    } else {
      // ── Each moved card becomes its own new single-card stack (default) ───
      arrivedStackIds = cardIds.map(function (cardId) {
        var sid = "stack_" + nextStackId;
        nextStackId += 1;
        stacks = Object.assign({}, stacks, { [sid]: createCardStack(sid, [cardId]) });
        return sid;
      });
    }

    // "top"    = prepend (front of zone, e.g. top of deck or graveyard).
    // "bottom" = append (back of zone).
    // number   = insert at 0-based index in zone.stackIds (e.g. deck insertion at position N).
    var updatedStackIds;
    if (typeof effectivePosition === "number") {
      var insertIdx = Math.max(0, Math.min(effectivePosition, targetZone.stackIds.length));
      updatedStackIds = targetZone.stackIds.slice(0, insertIdx)
        .concat(arrivedStackIds)
        .concat(targetZone.stackIds.slice(insertIdx));
    } else if (effectivePosition === "top") {
      updatedStackIds = arrivedStackIds.concat(targetZone.stackIds);
    } else {
      updatedStackIds = targetZone.stackIds.concat(arrivedStackIds);
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
  var options  = payload.options;
  if (!cardIds || !cardIds.length || !target) return state;
  return applyMoveCards(state, cardIds, target, position, context, options);
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
  var position   = payload.position || "top";

  var deckZone = state.zones[ZONE_IDS.DECK];
  if (!deckZone || !deckZone.stackIds.length) {
    return Object.assign({}, state, { status: "Deck is empty." });
  }
  var topStack = state.stacks[deckZone.stackIds[0]];
  if (!topStack || !topStack.cardIds.length) {
    return Object.assign({}, state, { status: "Deck is empty." });
  }
  var topCardId = topStack.cardIds[topStack.cardIds.length - 1];

  // Move top deck card onto the target stack at the specified position.
  var next = applyMoveCards(
    state,
    [topCardId],
    { type: "stack", stackId: stackId },
    position,
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

// Tap/untap all stacks that contain a selected card.
// If any stack is untapped → tap all. If all are tapped → untap all.
function handleToggleTapSelectedCards(state, context) {
  var selected = state.selectedCardIds || [];
  if (!selected.length) return state;

  var stackIds = {};
  selected.forEach(function (cardId) {
    var stackId = findStackForCard(state.stacks, cardId);
    if (stackId) stackIds[stackId] = true;
  });

  var targetIds  = Object.keys(stackIds);
  var allTapped  = targetIds.every(function (sid) { return state.stacks[sid].isTapped; });
  var nextTapped = !allTapped; // tap all if any untapped; untap all if all tapped

  var newStacks = Object.assign({}, state.stacks);
  targetIds.forEach(function (stackId) {
    newStacks[stackId] = Object.assign({}, newStacks[stackId], { isTapped: nextTapped });
  });
  return Object.assign({}, state, { stacks: newStacks });
}

// Flip face state of all selected cards.
// If any card is face-down → make all face-up. If all are face-up → make all face-down.
function handleToggleFaceSelectedCards(state, context) {
  var selected = state.selectedCardIds || [];
  if (!selected.length) return state;

  var anyFaceDown = selected.some(function (cardId) {
    var card = state.cards[cardId];
    return card && card.isFaceDown;
  });
  var nextFaceDown = !anyFaceDown; // face-up all if any down; face-down all if all up

  var newCards = Object.assign({}, state.cards);
  selected.forEach(function (cardId) {
    if (!newCards[cardId]) return;
    newCards[cardId] = Object.assign({}, newCards[cardId], { isFaceDown: nextFaceDown });
  });
  return Object.assign({}, state, { cards: newCards });
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

// Set which form face a multi-form card shows.
function handleSetCardFormIndex(state, payload) {
  var card = state.cards[payload.cardId];
  if (!card) return state;
  var updated = Object.assign({}, card, { currentFormIndex: payload.formIndex });
  return Object.assign({}, state, {
    cards: Object.assign({}, state.cards, { [payload.cardId]: updated }),
  });
}

// ── Handler: LINK_CARDS ───────────────────────────────────────────────────────
// Links selected cards into one linked object on the battlefield.
//
// Rules enforced:
//   - Already-linked stacks are silently skipped (must unlink first).
//   - At least one card must be (or become) in the battlefield (anchor).
//   - Top-of-stack cards link as-is.
//   - Non-top-of-stack cards are extracted from their current stack into a new
//     single-card battlefield stack first, then linked.
//   - Non-battlefield cards are made face-up when linked.
//   - isTapped = true if ANY of the original stacks was tapped.
//   - The first battlefield card's stack becomes the anchor (preserved stackId).
function handleLinkCards(state, payload, context) {
  var requestedIds = payload.cardIds || [];
  if (requestedIds.length < 2) return state;

  var stacks = state.stacks;
  var zones  = state.zones;
  var cards  = state.cards;

  // ── Pre-pass: extract non-top cards into new battlefield stacks ───────────
  var workStacks = stacks;
  var workZones  = zones;

  // Build a lookup so we can detect "top of this sub-stack is also requested".
  var requestedSet = {};
  requestedIds.forEach(function (id) { requestedSet[id] = true; });

  requestedIds.forEach(function (cardId) {
    var stackId = findStackForCard(workStacks, cardId);
    if (!stackId) return;
    var stack = workStacks[stackId];
    if (!stack || stack.isLinked) return;
    var topId = stack.cardIds[stack.cardIds.length - 1];
    if (topId === cardId) return;       // is top card — no extraction needed
    if (requestedSet[topId]) return;    // top also requested → whole sub-stack handled via top card; skip

    // Extract: remove card from its current stack.
    var remaining = stack.cardIds.filter(function (id) { return id !== cardId; });

    var nextWorkStacks = Object.assign({}, workStacks);
    var nextWorkZones  = workZones;

    if (remaining.length === 0) {
      // Stack is now empty — remove it from its zone too.
      var emptyZoneId = findZoneForStack(workZones, stackId);
      if (emptyZoneId) {
        nextWorkZones = Object.assign({}, workZones);
        nextWorkZones[emptyZoneId] = Object.assign({}, workZones[emptyZoneId], {
          stackIds: workZones[emptyZoneId].stackIds.filter(function (id) { return id !== stackId; }),
        });
      }
      delete nextWorkStacks[stackId];
    } else {
      nextWorkStacks[stackId] = Object.assign({}, stack, { cardIds: remaining });
    }

    // Create a new single-card stack in the battlefield for the extracted card.
    var newSid = "stk-ex-" + cardId;
    nextWorkStacks[newSid] = { id: newSid, cardIds: [cardId], isTapped: false, isLinked: false, linkSlots: null };
    nextWorkZones = Object.assign({}, nextWorkZones);
    var bfId = ZONE_IDS.BATTLEFIELD;
    nextWorkZones[bfId] = Object.assign({}, nextWorkZones[bfId] || { stackIds: [] }, {
      stackIds: (nextWorkZones[bfId] ? nextWorkZones[bfId].stackIds : []).concat([newSid]),
    });

    workStacks = nextWorkStacks;
    workZones  = nextWorkZones;
  });

  // ── Main pass: validate and link ──────────────────────────────────────────
  var bfZone = workZones[ZONE_IDS.BATTLEFIELD] || { stackIds: [] };

  var cardStackMap = {};
  requestedIds.forEach(function (cardId) {
    var stackId = findStackForCard(workStacks, cardId);
    if (!stackId) return;
    var stack = workStacks[stackId];
    if (!stack || stack.isLinked) return;
    if (stack.cardIds[stack.cardIds.length - 1] !== cardId) return; // should be top now
    cardStackMap[cardId] = stackId;
  });

  var validCards = requestedIds.filter(function (id) { return cardStackMap[id]; });
  if (validCards.length < 2) return state;

  // At least one must be in battlefield.
  var hasBf = validCards.some(function (id) {
    return bfZone.stackIds.indexOf(cardStackMap[id]) !== -1;
  });
  if (!hasBf) return state;

  // Anchor = first battlefield card's stack.
  var anchorCardId = null;
  for (var i = 0; i < validCards.length; i++) {
    if (bfZone.stackIds.indexOf(cardStackMap[validCards[i]]) !== -1) {
      anchorCardId = validCards[i];
      break;
    }
  }
  var anchorStackId = cardStackMap[anchorCardId];

  // Build linkSlots (one per valid card, col = order in validCards).
  var linkSlots = validCards.map(function (cardId, idx) {
    return {
      col:   idx,
      row:   0,
      group: workStacks[cardStackMap[cardId]].cardIds.slice(),
    };
  });

  // Tap state: any tapped → linked stack is tapped.
  var isTapped = validCards.some(function (id) {
    return workStacks[cardStackMap[id]].isTapped;
  });

  // Face state: apply face-up to all cards in non-battlefield slots.
  var newCards = Object.assign({}, cards);
  validCards.forEach(function (cardId) {
    var stackId = cardStackMap[cardId];
    if (bfZone.stackIds.indexOf(stackId) !== -1) return; // battlefield → keep
    workStacks[stackId].cardIds.forEach(function (id) {
      if (newCards[id] && newCards[id].isFaceDown) {
        newCards[id] = Object.assign({}, newCards[id], { isFaceDown: false });
      }
    });
  });

  // Remove all non-anchor stacks from their zones and the stacks map.
  var newStacks = Object.assign({}, workStacks);
  var newZones  = Object.assign({}, workZones);

  validCards.forEach(function (cardId) {
    var stackId = cardStackMap[cardId];
    if (stackId === anchorStackId) return;
    var zoneId = findZoneForStack(workZones, stackId);
    if (zoneId) {
      newZones[zoneId] = Object.assign({}, newZones[zoneId], {
        stackIds: newZones[zoneId].stackIds.filter(function (id) { return id !== stackId; }),
      });
    }
    delete newStacks[stackId];
  });

  // Update anchor stack → becomes the linked stack.
  var linkedCardIds = deriveCardIdsFromLinkSlots(linkSlots);
  newStacks[anchorStackId] = Object.assign({}, workStacks[anchorStackId], {
    cardIds:   linkedCardIds,
    isTapped:  isTapped,
    isLinked:  true,
    linkSlots: linkSlots,
  });

  return Object.assign({}, state, {
    cards:  newCards,
    stacks: newStacks,
    zones:  newZones,
    status: "リンク（" + validCards.length + "枚）",
  });
}

// ── Handler: UNLINK_CARDS ─────────────────────────────────────────────────────
// Splits a linked stack back into individual stacks on the battlefield.
// Each linkSlot becomes its own new stack, preserving sub-stack groups.
// The original anchor stack is removed; new stacks take its position in the zone.
function handleUnlinkCards(state, payload, context) {
  var stackId = payload.stackId;
  var stack   = state.stacks[stackId];
  if (!stack || !stack.isLinked || !stack.linkSlots) return state;

  var zoneId = findZoneForStack(state.zones, stackId);
  if (!zoneId) return state;

  // Sort slots by (row, col) to determine rendering order.
  var sortedSlots = stack.linkSlots.slice().sort(function (a, b) {
    return a.row !== b.row ? a.row - b.row : a.col - b.col;
  });

  // Reset all cards to form index 0 before splitting.
  var newCards = Object.assign({}, state.cards);
  stack.cardIds.forEach(function (cardId) {
    var card = newCards[cardId];
    if (card && card.currentFormIndex !== 0) {
      newCards[cardId] = Object.assign({}, card, { currentFormIndex: 0 });
    }
  });

  var newStacks  = Object.assign({}, state.stacks);
  var newZones   = Object.assign({}, state.zones);
  var nextId     = state.nextStackId;

  // Create individual stacks for each slot.
  var newStackIds = sortedSlots.map(function (slot) {
    var id    = "stack_" + nextId++;
    var s     = createCardStack(id, slot.group);
    newStacks[id] = Object.assign({}, s, { isTapped: stack.isTapped });
    return id;
  });

  // Replace anchor in zone with the new individual stacks.
  var zone    = newZones[zoneId];
  var oldIdx  = zone.stackIds.indexOf(stackId);
  newZones[zoneId] = Object.assign({}, zone, {
    stackIds: zone.stackIds.slice(0, oldIdx)
      .concat(newStackIds)
      .concat(zone.stackIds.slice(oldIdx + 1)),
  });

  // Delete anchor stack.
  delete newStacks[stackId];

  return Object.assign({}, state, {
    cards:       newCards,
    stacks:      newStacks,
    zones:       newZones,
    nextStackId: nextId,
    status:      "リンク解除",
  });
}

// ── Handler: LINK_FROM_PENDING_DROP ──────────────────────────────────────────
// Links dragged card(s) with a battlefield target stack.
// If target is already linked → add new slots to the existing linked group.
// If target is not yet linked → delegate to handleLinkCards.
function handleLinkFromPendingDrop(state, payload, context) {
  var draggedCardIds = payload.draggedCardIds || [];
  var targetStackId  = payload.targetStackId;
  if (!draggedCardIds.length || !targetStackId) return state;

  var targetStack = state.stacks[targetStackId];
  if (!targetStack) return state;

  // Target must be in battlefield.
  var bfZone = state.zones[ZONE_IDS.BATTLEFIELD] || { stackIds: [] };
  if (bfZone.stackIds.indexOf(targetStackId) === -1) return state;

  if (targetStack.isLinked) {
    // ── Already linked: append new slots ─────────────────────────────────
    var stacks = state.stacks;
    var zones  = state.zones;
    var cards  = state.cards;

    var nextCol = 0;
    targetStack.linkSlots.forEach(function (s) {
      if (s.col >= nextCol) nextCol = s.col + 1;
    });

    var newSlots      = [];
    var stacksToRemove = {};

    draggedCardIds.forEach(function (cardId) {
      var stackId = findStackForCard(stacks, cardId);
      if (!stackId) return;
      var stack = stacks[stackId];
      if (stack.cardIds[stack.cardIds.length - 1] !== cardId) return; // must be top
      newSlots.push({ col: nextCol++, row: 0, group: stack.cardIds.slice() });
      if (stackId !== targetStackId) stacksToRemove[stackId] = true;
    });

    if (!newSlots.length) return state;

    // Apply face-up to dragged cards.
    var newCards = Object.assign({}, cards);
    newSlots.forEach(function (slot) {
      slot.group.forEach(function (id) {
        if (newCards[id] && newCards[id].isFaceDown) {
          newCards[id] = Object.assign({}, newCards[id], { isFaceDown: false });
        }
      });
    });

    var updatedSlots   = targetStack.linkSlots.concat(newSlots);
    var updatedCardIds = deriveCardIdsFromLinkSlots(updatedSlots);

    var newStacks = Object.assign({}, stacks, {
      [targetStackId]: Object.assign({}, targetStack, {
        cardIds:   updatedCardIds,
        linkSlots: updatedSlots,
      }),
    });

    var newZones = Object.assign({}, zones);
    Object.keys(stacksToRemove).forEach(function (sid) {
      var zid = findZoneForStack(zones, sid);
      if (zid) {
        newZones[zid] = Object.assign({}, newZones[zid], {
          stackIds: newZones[zid].stackIds.filter(function (id) { return id !== sid; }),
        });
      }
      delete newStacks[sid];
    });

    return Object.assign({}, state, {
      cards:  newCards,
      stacks: newStacks,
      zones:  newZones,
      status: "リンクに追加（+" + newSlots.length + "枚）",
    });

  } else {
    // ── Not yet linked: use standard handleLinkCards ──────────────────────
    var topCardId = targetStack.cardIds[targetStack.cardIds.length - 1];
    return handleLinkCards(
      state,
      { cardIds: [topCardId].concat(draggedCardIds) },
      context
    );
  }
}

// ── Handler: REORDER_LINK_SLOTS ───────────────────────────────────────────────
// Reorders the slots of a linked stack using a permutation array.
// newOrder[i] = index of the old slot that should appear at position i.
// (UI not wired in initial release — handler defined for future use.)
function handleReorderLinkSlots(state, payload) {
  var stackId  = payload.stackId;
  var newOrder = payload.newOrder;
  var stack    = state.stacks[stackId];
  if (!stack || !stack.isLinked || !stack.linkSlots) return state;
  if (!newOrder || newOrder.length !== stack.linkSlots.length) return state;

  var reordered = newOrder.map(function (oldIdx, newIdx) {
    return Object.assign({}, stack.linkSlots[oldIdx], { col: newIdx, row: stack.linkSlots[oldIdx].row });
  });
  var newCardIds = deriveCardIdsFromLinkSlots(reordered);

  return Object.assign({}, state, {
    stacks: Object.assign({}, state.stacks, {
      [stackId]: Object.assign({}, stack, { linkSlots: reordered, cardIds: newCardIds }),
    }),
    status: "リンクスロット並び替え",
  });
}
