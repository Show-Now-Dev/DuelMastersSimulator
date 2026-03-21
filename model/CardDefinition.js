// Card definitions — populated at startup from src/data/cards.json.
// Never mutate after initialization.
let CARD_DEFINITIONS = [];

// Lookup a definition by its id. Returns undefined if not found.
function getCardDefinition(definitionId) {
  for (var i = 0; i < CARD_DEFINITIONS.length; i++) {
    if (CARD_DEFINITIONS[i].id === definitionId) return CARD_DEFINITIONS[i];
  }
  return undefined;
}
