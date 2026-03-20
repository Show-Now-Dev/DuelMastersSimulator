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
