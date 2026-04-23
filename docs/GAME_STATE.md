# Game State

GameState represents the entire game.

GameState

players
zones
cards
turn


Zones

deck
hand
battlefield
graveyard
mana
shield
ex
gr


Zone Ordering Conventions

deck:
  - cardIds[0] = top of deck (next card to draw)
  - cardIds[last] = bottom of deck
  - Order is strictly preserved; never implicitly shuffled
  - DRAW_CARD always removes cardIds[0]
  - MOVE_CARDS to deck with position "top" inserts at index 0
  - MOVE_CARDS to deck with position "bottom" appends at end

graveyard:
  - cardIds[0] = most recently added card (top of pile)
  - Newly added cards are always inserted at index 0

ex / gr:
  - cardIds[0] = top of pile
  - MOVE_CARDS position applies normally ("top" = index 0, "bottom" = end)

hand / battlefield / mana / shield:
  - No strict ordering convention
  - MOVE_CARDS position applies ("top" = index 0, "bottom" = end)


Stacked Zones

deck, graveyard, ex, and gr are stacked zones.
They are represented as ordered arrays of cardIds.
Their contents are accessed via the modal system only (not rendered directly in the zone).


Example structure

GameState

players:
  - id: player1

zones:

  deck:
    cardIds: []   // index 0 = top

  hand:
    cardIds: []

  battlefield:
    stacks: []    // array of Stack objects

  graveyard:
    cardIds: []   // index 0 = top (newest)

  mana:
    cardIds: []

  shield:
    cardIds: []

  ex:
    cardIds: []   // index 0 = top

  gr:
    cardIds: []   // index 0 = top


cards

cardInstanceId → card instance


---

## CardStack

Each stack object has the following shape:

  id:        string              // unique stack ID
  cardIds:   string[]            // card IDs in bottom→top order (index 0 = bottom)
  isTapped:  boolean
  isLinked:  boolean             // true when this stack is a linked group
  linkSlots: LinkSlot[] | null   // non-null only when isLinked is true

### LinkSlot

  col:   number     // 0-based column index (horizontal position in linked group)
  row:   number     // 0-based row index (reserved for future 2D layouts; always 0 initially)
  group: string[]   // card IDs in this slot, bottom→top order

### Linked stack invariants

- cardIds is always the flat concat of linkSlots groups sorted by (row, col).
  All existing code that reads cardIds continues to work without changes.
- isLinked: true iff linkSlots is non-null and has ≥2 slots.
- When a linked stack is moved to another zone, it is automatically unlinked first;
  each slot's cards are moved individually.
- Stacking cards onto a linked stack (MOVE_CARDS with target.type "stack") auto-unlinks
  the target before merging.
- Partial removal of cards from a linked stack (MOVE_CARDS removing some slots) updates
  linkSlots in place; if <2 slots remain, isLinked is set to false and linkSlots to null.
