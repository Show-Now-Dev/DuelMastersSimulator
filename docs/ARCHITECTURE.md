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
  CardDefinition.js  — Static card data shape (populated from parser output or JSON)
  CardInstance.js    — Runtime card object (id, definitionId, isFaceDown)
  CardStack.js       — Ordered group of cards (bottom→top); holds isTapped
  Zone.js            — Ordered list of stack IDs; defines ZONE_IDS constants
  DeckDefinition.js  — Saved deck shape: { id, name, cards: [{ cardId, count }] }

parser/
  cardParser.js      — parseCardText(text) → { card, errors }; pure, no side effects

storage/              ← pure I/O only; never contains business logic
  cardStorage.js     — loadCards/saveCards/loadDecks/saveDecks via localStorage
                       Internal format: { version: 1, cards: [] }

logic/                ← business logic; depends on storage, never on UI
  deckBuilder.js     — buildDeckInstances(deckDef, cardDefs) → { instances, errors }
                       deckCardCount(deckDef) → number
  CardRepository.js  — Card CRUD + search; only layer that calls CardStorage for cards
                         getAllCards() getCardById(id)
                         addCard(card) → { ok, id? }     (validates, deduplicates by name)
                         updateCard(id, patch) → { ok }  (partial update; id immutable)
                         deleteCard(id) → { ok }
                         searchCards(filters) → CardDefinition[]
  DeckRepository.js  — Deck CRUD; only layer that calls CardStorage for decks
                         getAllDecks() getDeckById(id)
                         addDeck(deck) → { ok, id? }     (validates, generates id)
                         updateDeck(id, patch) → { ok }  (partial update; id immutable)
                         deleteDeck(id) → { ok }

core/
  GameState.js       — createInitialGameState(); reads CARD_DEFINITIONS + INITIAL_DECK_INSTANCES
  actions.js         — Action type constants + action creators
  reducer.js         — rootReducer; pure; no UI logic

engine/
  GameEngine.js      — Minimal Redux-style store (createStore)

ui/                   ← calls Repositories only; never CardStorage directly
  viewModel.js         — Pure: GameState → UI display objects (colors, gradients, names)
  uiState.js           — UI-only state (modal, selection, peeked cards); separate store
  ui.js                — Game board rendering; exposes window.startGameSimulation()
  cardEditor/
    cardEditor.js      — Card registration screen → CardRepository.addCard()
  deckBuilder/
    deckBuilderUI.js   — Deck builder screen → CardRepository.getAllCards(), DeckRepository.addDeck()
  menu/
    menuUI.js          — Menu screen → DeckRepository.getAllDecks/deleteDeck, CardRepository.getAllCards
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

## Layer rules (enforced by convention)

| Layer       | May call            | Must NOT call     |
|-------------|---------------------|-------------------|
| UI          | Repository, Parser  | Storage directly  |
| Repository  | Storage             | UI, Parser        |
| Storage     | (none)              | Repository, UI    |
| Parser      | (none — pure fn)    | Everything        |

## Invariants

- CardDefinition = static data; never mutated during gameplay
- CardInstance   = runtime object; lives in GameState.cards
- DeckDefinition = static data; stored in localStorage; never in GameState
- GameState structure must not be modified (add no new top-level keys)
- Parsing logic must never appear in UI or Repository modules
- Search / validation logic lives only in Repository modules
- UI logic must never appear in model, logic, or storage modules