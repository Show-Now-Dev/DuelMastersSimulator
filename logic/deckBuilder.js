// logic/deckBuilder.js
//
// Pure logic for building deck instances from a DeckDefinition.
// No DOM access. No side effects.

(function () {

  // Expand a DeckDefinition into an array of raw CardInstance objects.
  //
  // deckDefinition:  { id, name, cards: [{ cardId, count }] }
  // cardDefinitions: CardDefinition[]
  //
  // Returns: { instances: object[], errors: string[] }
  //   instances — flat array of { id, definitionId, isFaceDown }, one per copy
  //   errors    — messages for any cardId not found in cardDefinitions
  function buildDeckInstances(deckDefinition, cardDefinitions) {
    var instances = [];
    var errors    = [];
    var counter   = 1;

    // Build a fast lookup map from definitionId → CardDefinition.
    var defMap = {};
    cardDefinitions.forEach(function (def) { defMap[def.id] = def; });

    (deckDefinition.cards || []).forEach(function (entry) {
      if (!defMap[entry.cardId]) {
        errors.push('カードが見つかりません: ' + entry.cardId);
        return;
      }
      for (var i = 0; i < (entry.count || 0); i++) {
        instances.push({
          id:           'ci_' + (counter++),
          definitionId: entry.cardId,
          isFaceDown:   true,
        });
      }
    });

    return { instances: instances, errors: errors };
  }

  // Count the total number of cards in a DeckDefinition.
  function deckCardCount(deckDefinition) {
    return (deckDefinition.cards || []).reduce(function (sum, e) {
      return sum + (e.count || 0);
    }, 0);
  }

  window.DeckBuilder = {
    buildDeckInstances: buildDeckInstances,
    deckCardCount:      deckCardCount,
  };

})();
