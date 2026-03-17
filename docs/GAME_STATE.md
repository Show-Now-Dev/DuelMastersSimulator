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


Example structure

GameState

players:
  - id: player1

zones:

  deck:
    cardIds: []

  hand:
    cardIds: []

  battlefield:
    cardIds: []

  graveyard:
    cardIds: []

  mana:
    cardIds: []


cards

cardInstanceId → card instance