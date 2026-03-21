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
  viewModel.js  — Pure transformation layer: GameState → UI-ready display data
                  (civilization colors, gradients, name/cost/power formatting)
  uiState.js    — UI-only state (modal, selection)
  ui.js         — Rendering only; consumes viewModel output