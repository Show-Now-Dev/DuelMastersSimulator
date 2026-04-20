// model/DeckDefinition.js
//
// DeckDefinition is a plain-JSON object representing a saved deck.
//
// Shape:
//   id:               string                — unique identifier
//   name:             string                — display name
//   cards:            [{ cardId, count }]   — main deck (40 cards); alias for mainCards
//   hyperspatialCards:[{ cardId, count }]   — 超次元ゾーン (0–8 cards)
//   superGRCards:     [{ cardId, count }]   — 超GRゾーン (0 or 12 cards)
//
// Backward compatibility: legacy decks only have `cards`; treat it as the main deck.
// DeckDefinition is static data; it is never mutated during gameplay.
// At game start, DeckBuilder.buildDeckInstances() converts it into CardInstances.

function createDeckDefinition(id, name, cards, hyperspatialCards, superGRCards) {
  return {
    id:               id,
    name:             name,
    cards:            cards             || [],
    hyperspatialCards: hyperspatialCards || [],
    superGRCards:     superGRCards      || [],
  };
}
