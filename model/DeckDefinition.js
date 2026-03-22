// model/DeckDefinition.js
//
// DeckDefinition is a plain-JSON object representing a saved deck.
//
// Shape:
//   id:    string                   — unique identifier
//   name:  string                   — display name
//   cards: [{ cardId, count }]      — card entries with copy counts
//
// DeckDefinition is static data; it is never mutated during gameplay.
// At game start, DeckBuilder.buildDeckInstances() converts it into CardInstances.

function createDeckDefinition(id, name, cards) {
  return {
    id:    id,
    name:  name,
    cards: cards || [],
  };
}
