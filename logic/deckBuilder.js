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

  // Count cards in a specific zone of a DeckDefinition.
  // zone: 'main' | 'hyperspatial' | 'superGR'
  function deckCardCount(deckDefinition, zone) {
    var entries;
    if (!zone || zone === 'main') {
      entries = deckDefinition.cards || [];
    } else if (zone === 'hyperspatial') {
      entries = deckDefinition.hyperspatialCards || [];
    } else if (zone === 'superGR') {
      entries = deckDefinition.superGRCards || [];
    } else {
      entries = [];
    }
    return entries.reduce(function (sum, e) { return sum + (e.count || 0); }, 0);
  }

  // ── Sub-deck instance builders ───────────────────────────────────────────────

  // Fisher-Yates shuffle (in-place).
  function _shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
  }

  // Get the cost for sorting purposes — first form's cost for forms[] cards, else top-level.
  function _firstCost(def) {
    if (Array.isArray(def.forms) && def.forms.length > 0) {
      return def.forms[0].cost != null ? def.forms[0].cost : null;
    }
    return def.cost != null ? def.cost : null;
  }

  // Build instances for the 超次元ゾーン (EX zone).
  // Sorted by first-form cost ascending (nulls last). All face-up.
  // Returns: { instances: object[], errors: string[] }
  function buildHyperspatialInstances(deckDefinition, cardDefinitions) {
    var defMap = {};
    cardDefinitions.forEach(function (def) { defMap[def.id] = def; });

    var entries = [];
    var errors  = [];
    (deckDefinition.hyperspatialCards || []).forEach(function (entry) {
      var def = defMap[entry.cardId];
      if (!def) { errors.push('カードが見つかりません: ' + entry.cardId); return; }
      for (var i = 0; i < (entry.count || 0); i++) entries.push(def);
    });

    entries.sort(function (a, b) {
      var ca = _firstCost(a), cb = _firstCost(b);
      if (ca == null && cb == null) return 0;
      if (ca == null) return 1;
      if (cb == null) return -1;
      return ca - cb;
    });

    var counter   = 1;
    var instances = entries.map(function (def) {
      return { id: 'ex_' + (counter++), definitionId: def.id, isFaceDown: false, currentFormIndex: 0, isGRCard: false };
    });
    return { instances: instances, errors: errors };
  }

  // Build instances for the 超GRゾーン (GR zone).
  // Shuffled. All face-down.
  // Returns: { instances: object[], errors: string[] }
  function buildSuperGRInstances(deckDefinition, cardDefinitions) {
    var defMap = {};
    cardDefinitions.forEach(function (def) { defMap[def.id] = def; });

    var instances = [];
    var errors    = [];
    var counter   = 1;
    (deckDefinition.superGRCards || []).forEach(function (entry) {
      if (!defMap[entry.cardId]) { errors.push('カードが見つかりません: ' + entry.cardId); return; }
      for (var i = 0; i < (entry.count || 0); i++) {
        instances.push({ id: 'gr_' + (counter++), definitionId: entry.cardId, isFaceDown: true, currentFormIndex: 0, isGRCard: true });
      }
    });
    _shuffle(instances);
    return { instances: instances, errors: errors };
  }

  window.DeckBuilder = {
    buildDeckInstances:        buildDeckInstances,
    buildHyperspatialInstances: buildHyperspatialInstances,
    buildSuperGRInstances:     buildSuperGRInstances,
    deckCardCount:             deckCardCount,
  };

})();
