// logic/CardRepository.js
//
// Business-logic layer for CardDefinition CRUD and search.
//
// Responsibilities:
//   - ID generation
//   - Validation (name, type required)
//   - Deduplication (by name on add)
//   - Search / filtering
//
// Rules:
//   - Reads/writes through CardStorage only — never touches localStorage directly
//   - All functions return plain objects; no DOM access, no side effects beyond storage
//   - UI must call this module, not CardStorage, for card operations
//
// Return shape for mutations:
//   Success: { ok: true,  id?: string }
//   Failure: { ok: false, error: string }

(function () {

  // ── ID generation ─────────────────────────────────────────────────────────

  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'card_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validateCard(card) {
    var errors = [];
    if (!card || typeof card !== 'object') {
      errors.push('カードデータが不正です');
      return errors;
    }
    if (!card.name || typeof card.name !== 'string' || !card.name.trim()) {
      errors.push('name は必須です');
    }
    if (!card.type || typeof card.type !== 'string' || !card.type.trim()) {
      errors.push('type は必須です');
    }
    return errors;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  // Returns all stored CardDefinitions.
  function getAllCards() {
    return CardStorage.loadCards();
  }

  // Returns the CardDefinition with the given id, or null.
  function getCardById(id) {
    var cards = CardStorage.loadCards();
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].id === id) return cards[i];
    }
    return null;
  }

  // Persists a parsed card.
  // Generates a stable id. If a card with the same name already exists,
  // the existing entry is replaced (keeping the original id).
  //
  // Returns { ok: true, id: string } or { ok: false, error: string }.
  function addCard(card) {
    var errors = validateCard(card);
    if (errors.length) return { ok: false, error: errors.join('; ') };

    var cards = CardStorage.loadCards();

    var idx = -1;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].name === card.name) { idx = i; break; }
    }

    var id     = (idx !== -1 && cards[idx].id) ? cards[idx].id : generateId();
    var stored = Object.assign({}, card, { id: id });

    if (idx !== -1) {
      cards[idx] = stored;
    } else {
      cards.push(stored);
    }

    CardStorage.saveCards(cards);
    return { ok: true, id: id };
  }

  // Partially updates a card: only the fields present in patch are changed.
  // The card's id is immutable and cannot be overwritten via patch.
  //
  // Returns { ok: true } or { ok: false, error: string }.
  function updateCard(id, patch) {
    if (!id) return { ok: false, error: 'id は必須です' };

    var cards = CardStorage.loadCards();
    var idx   = -1;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].id === id) { idx = i; break; }
    }
    if (idx === -1) return { ok: false, error: 'カードが見つかりません: ' + id };

    var safePatch = Object.assign({}, patch);
    delete safePatch.id;  // id is immutable

    var updated = Object.assign({}, cards[idx], safePatch);

    var errors = validateCard(updated);
    if (errors.length) return { ok: false, error: errors.join('; ') };

    cards[idx] = updated;
    CardStorage.saveCards(cards);
    return { ok: true };
  }

  // Removes the card with the given id.
  // Returns { ok: true } or { ok: false, error: string }.
  function deleteCard(id) {
    if (!id) return { ok: false, error: 'id は必須です' };

    var cards = CardStorage.loadCards();
    var next  = cards.filter(function (c) { return c.id !== id; });

    if (next.length === cards.length) {
      return { ok: false, error: 'カードが見つかりません: ' + id };
    }

    CardStorage.saveCards(next);
    return { ok: true };
  }

  // ── Search ────────────────────────────────────────────────────────────────
  //
  // searchCards(filters) → CardDefinition[]
  //
  // filters: {
  //   freeword?:            string    — space-separated words; OR/AND matched against name, abilities, races
  //   freewordMode?:        'or'|'and' — default 'or'
  //   colorMode?:           { mono: bool, multi: bool } — default both true (no filter)
  //   civilization?:        string[]  — OR: card must contain AT LEAST ONE; 'none' = colorless
  //   excludeCivilization?: string[]  — card must NOT contain any of these
  //   costMin?:             number    — card.cost >= costMin
  //   costMax?:             number    — card.cost <= costMax
  //   includeTwin?:         boolean   — default true; false = exclude twin-pact cards
  //   powerMin?:            number    — effective power >= powerMin  (twin: top side)
  //   powerMax?:            number    — effective power <= powerMax  (twin: top side)
  //
  //   // Legacy (still accepted):
  //   name?:  string — case-insensitive substring match against card name
  //   text?:  string — case-insensitive substring in abilities or legacy text field
  // }
  //
  // Omitting a filter field means "no constraint" for that field.
  // Passing an empty filters object (or null) returns all cards.

  function searchCards(filters) {
    var cards = CardStorage.loadCards();
    if (!filters || typeof filters !== 'object') return cards;

    return cards.filter(function (card) {
      return _matchesAll(card, filters);
    });
  }

  // ── Search helpers ────────────────────────────────────────────────────────

  function _matchesAll(card, f) {
    // 1. Twin pact filter
    if (f.includeTwin === false && card.type === 'twin') return false;

    // 2. Free-word filter (name + abilities/text + races; OR or AND across words)
    if (f.freeword != null && f.freeword.trim() !== '') {
      var words = f.freeword.trim().split(/\s+/).filter(Boolean);
      if (words.length) {
        if (f.freewordMode === 'and') {
          for (var wi = 0; wi < words.length; wi++) {
            if (!_cardMatchesFreeword(card, words[wi])) return false;
          }
        } else {
          var anyMatch = false;
          for (var wi2 = 0; wi2 < words.length; wi2++) {
            if (_cardMatchesFreeword(card, words[wi2])) { anyMatch = true; break; }
          }
          if (!anyMatch) return false;
        }
      }
    }

    // Legacy: name filter
    if (f.name != null && f.name !== '') {
      if ((card.name || '').toLowerCase().indexOf(f.name.toLowerCase()) === -1) return false;
    }

    // Legacy: text filter
    if (f.text != null && f.text !== '') {
      if (!_cardContainsText(card, f.text)) return false;
    }

    var cardCivs = _getCardCivs(card);

    // 3. Color mode filter (colorless cards fail when either mode is exclusively selected)
    if (f.colorMode) {
      var wantMono  = f.colorMode.mono  !== false;
      var wantMulti = f.colorMode.multi !== false;
      if (!wantMono || !wantMulti) {
        var civCount = cardCivs.length;
        if (civCount === 0) return false;            // colorless: neither mono nor multi
        if (civCount === 1 && !wantMono)  return false;
        if (civCount >= 2 && !wantMulti) return false;
      }
    }

    // 4. Civilization filter (OR: card must contain at least one; 'none' = colorless)
    if (f.civilization && f.civilization.length) {
      var wantNone   = f.civilization.indexOf('none') !== -1;
      var wantedCivs = f.civilization.filter(function (c) { return c !== 'none'; });
      var isColorless = cardCivs.length === 0;
      var civMatch = false;
      if (wantNone && isColorless) civMatch = true;
      if (!civMatch && wantedCivs.length) {
        civMatch = wantedCivs.some(function (c) { return cardCivs.indexOf(c) !== -1; });
      }
      if (!civMatch) return false;
    }

    // 5. Exclude civilization (card must NOT contain any excluded civ)
    if (f.excludeCivilization && f.excludeCivilization.length) {
      for (var ei = 0; ei < f.excludeCivilization.length; ei++) {
        if (cardCivs.indexOf(f.excludeCivilization[ei]) !== -1) return false;
      }
    }

    // 6. Cost range
    if (f.costMin != null && (card.cost == null || card.cost < f.costMin)) return false;
    if (f.costMax != null && (card.cost == null || card.cost > f.costMax)) return false;

    // 7. Power range — effective power: twin uses first side with power, others use card.power
    if (f.powerMin != null || f.powerMax != null) {
      var power = _getEffectivePower(card);
      if (f.powerMin != null && (power == null || power < f.powerMin)) return false;
      if (f.powerMax != null && (power == null || power > f.powerMax)) return false;
    }

    return true;
  }

  // Returns true if the card contains the given word in its name, abilities, text, or races.
  // Recurses into twin card sides (top-level name checked first, then each side).
  function _cardMatchesFreeword(card, word) {
    var q = word.toLowerCase();
    if (card.type === 'twin') {
      if ((card.name || '').toLowerCase().indexOf(q) !== -1) return true;
      return (card.sides || []).some(function (side) { return _cardMatchesFreeword(side, word); });
    }
    if ((card.name || '').toLowerCase().indexOf(q) !== -1) return true;
    var abilities = Array.isArray(card.abilities) ? card.abilities : [];
    if (abilities.some(function (a) { return a.toLowerCase().indexOf(q) !== -1; })) return true;
    if (card.text && card.text.toLowerCase().indexOf(q) !== -1) return true;
    var races = Array.isArray(card.races) ? card.races : [];
    if (races.some(function (r) { return r.toLowerCase().indexOf(q) !== -1; })) return true;
    return false;
  }

  // Returns a flat, deduplicated civilization array for any card type.
  // Twin cards: union of all side civilizations.
  function _getCardCivs(card) {
    if (card.type === 'twin') {
      var merged = [];
      (card.sides || []).forEach(function (side) {
        _getCardCivs(side).forEach(function (c) {
          if (merged.indexOf(c) === -1) merged.push(c);
        });
      });
      return merged;
    }
    if (!card.civilization) return [];
    return Array.isArray(card.civilization) ? card.civilization : [card.civilization];
  }

  // Returns the numeric power to use for range filtering.
  // Twin: first side with a non-null power (usually the creature side).
  function _getEffectivePower(card) {
    if (card.type === 'twin') {
      for (var i = 0; i < (card.sides || []).length; i++) {
        if (card.sides[i].power != null) return card.sides[i].power;
      }
      return null;
    }
    return card.power != null ? card.power : null;
  }

  // Returns true if any ability line (or legacy text) contains the query string.
  // Recurses into twin card sides.
  function _cardContainsText(card, query) {
    var q = query.toLowerCase();

    if (card.type === 'twin') {
      return (card.sides || []).some(function (side) {
        return _cardContainsText(side, query);
      });
    }

    // New format: abilities[]
    var abilities = Array.isArray(card.abilities) ? card.abilities : [];
    if (abilities.some(function (a) { return a.toLowerCase().indexOf(q) !== -1; })) return true;

    // Legacy format: text string
    if (card.text && card.text.toLowerCase().indexOf(q) !== -1) return true;

    return false;
  }

  // ── Export ────────────────────────────────────────────────────────────────

  window.CardRepository = {
    getAllCards:  getAllCards,
    getCardById: getCardById,
    addCard:     addCard,
    updateCard:  updateCard,
    deleteCard:  deleteCard,
    searchCards: searchCards,
  };

})();
