# Card Game Simulator Architecture

This project implements a card game simulator for solitaire testing.

Architecture style:
Redux-style state management.

---

## Full application flow

```
[Pre-game screens]
   Menu (deck selection)
   Card Editor (register cards)
   Deck Builder (build decks)
        ↓
   startGameSimulation(cardDefs, deckInstances)
        ↓
[Game simulation]
   UI → Action → Reducer → GameState → UI re-render
```

---

## Module map

```
model/
  CardDefinition.js  — Static card data; populated at startup from cards.json or localStorage
  CardInstance.js    — Runtime card object (id, definitionId, isFaceDown)
  CardStack.js       — Ordered group of cards (bottom→top); holds isTapped
  Zone.js            — Ordered list of stack IDs; defines ZONE_IDS constants
  DeckDefinition.js  — Saved deck: { id, name, cards: [{ cardId, count }] }

parser/
  cardParser.js      — parseCardText(text) → CardDefinition; pure, no side effects

storage/
  cardStorage.js     — saveCards/loadCards/saveDecks/loadDecks via localStorage

logic/
  deckBuilder.js     — buildDeckInstances(deckDef, cardDefs) → { instances, errors }
                       deckCardCount(deckDef) → number

core/
  GameState.js       — createInitialGameState(); reads CARD_DEFINITIONS + INITIAL_DECK_INSTANCES
  actions.js         — Action type constants + action creators
  reducer.js         — rootReducer; pure; no UI logic

engine/
  GameEngine.js      — Minimal Redux-style store (createStore)

ui/
  viewModel.js         — Pure: GameState → UI display objects (colors, gradients, names)
  uiState.js           — UI-only state (modal, selection, peeked cards); separate store
  ui.js                — Game board rendering; exposes window.startGameSimulation()
  cardEditor/
    cardEditor.js      — Card registration screen (paste → parse → save)
  deckBuilder/
    deckBuilderUI.js   — Deck builder screen (select cards → set counts → save deck)
  menu/
    menuUI.js          — Menu screen (deck list, navigation, game launch)
```

---

## Data flow (pre-game)

```
User pastes text
  → parseCardText()         parser/cardParser.js
  → CardDefinition
  → CardStorage.saveCards() storage/cardStorage.js
  → localStorage

User builds deck
  → DeckBuilderUI           ui/deckBuilder/deckBuilderUI.js
  → DeckDefinition
  → CardStorage.saveDecks()
  → localStorage

User selects deck → Start
  → DeckBuilder.buildDeckInstances()  logic/deckBuilder.js
  → CardInstance[]
  → startGameSimulation(cardDefs, instances)
  → CARD_DEFINITIONS = cardDefs
  → INITIAL_DECK_INSTANCES = instances
  → createInitialGameState()
```

---

## Invariants

- CardDefinition = static data; never mutated during gameplay
- CardInstance   = runtime object; lives in GameState.cards
- DeckDefinition = static data; stored in localStorage; never in GameState
- GameState structure must not be modified (add no new top-level keys)
- Parsing logic must never appear in UI modules
- UI logic must never appear in model or logic modules