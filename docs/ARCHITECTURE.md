# Card Game Simulator Architecture

This project implements a card game simulator for solitaire testing.

Architecture style:
Redux-style state management.

Game flow:

UI
 ↓
Action
 ↓
Reducer
 ↓
GameState
 ↓
UI re-render

Main modules:

model/
  Domain objects

core/
  State and reducer

engine/
  Game engine

ui/
  Rendering