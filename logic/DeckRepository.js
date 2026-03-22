// logic/DeckRepository.js
//
// Business-logic layer for DeckDefinition CRUD.
//
// Responsibilities:
//   - ID generation
//   - Validation (name required, cards must be a valid entry array)
//   - Partial update (updateDeck)
//
// Rules:
//   - Reads/writes through CardStorage only — never touches localStorage directly
//   - All functions return plain objects; no DOM access, no side effects beyond storage
//   - UI must call this module, not CardStorage, for deck operations
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
    return 'deck_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validateDeck(deck) {
    var errors = [];
    if (!deck || typeof deck !== 'object') {
      errors.push('デッキデータが不正です');
      return errors;
    }
    if (!deck.name || typeof deck.name !== 'string' || !deck.name.trim()) {
      errors.push('name は必須です');
    }
    if (!Array.isArray(deck.cards)) {
      errors.push('cards は配列である必要があります');
    } else {
      deck.cards.forEach(function (entry, i) {
        if (!entry || !entry.cardId) {
          errors.push('cards[' + i + '].cardId が不正です');
        }
        if (!Number.isInteger(entry.count) || entry.count < 1) {
          errors.push('cards[' + i + '].count は1以上の整数である必要があります');
        }
      });
    }
    return errors;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  // Returns all stored DeckDefinitions.
  function getAllDecks() {
    return CardStorage.loadDecks();
  }

  // Returns the DeckDefinition with the given id, or null.
  function getDeckById(id) {
    var decks = CardStorage.loadDecks();
    for (var i = 0; i < decks.length; i++) {
      if (decks[i].id === id) return decks[i];
    }
    return null;
  }

  // Persists a new deck. A fresh id is always generated (no dedup by name).
  // Returns { ok: true, id: string } or { ok: false, error: string }.
  function addDeck(deck) {
    var errors = validateDeck(deck);
    if (errors.length) return { ok: false, error: errors.join('; ') };

    var decks  = CardStorage.loadDecks();
    var id     = generateId();
    var stored = Object.assign({}, deck, { id: id });

    decks.push(stored);
    CardStorage.saveDecks(decks);
    return { ok: true, id: id };
  }

  // Partially updates a deck: only the fields present in patch are changed.
  // The deck's id is immutable and cannot be overwritten via patch.
  //
  // Returns { ok: true } or { ok: false, error: string }.
  function updateDeck(id, patch) {
    if (!id) return { ok: false, error: 'id は必須です' };

    var decks = CardStorage.loadDecks();
    var idx   = -1;
    for (var i = 0; i < decks.length; i++) {
      if (decks[i].id === id) { idx = i; break; }
    }
    if (idx === -1) return { ok: false, error: 'デッキが見つかりません: ' + id };

    var safePatch = Object.assign({}, patch);
    delete safePatch.id;  // id is immutable

    var updated = Object.assign({}, decks[idx], safePatch);

    var errors = validateDeck(updated);
    if (errors.length) return { ok: false, error: errors.join('; ') };

    decks[idx] = updated;
    CardStorage.saveDecks(decks);
    return { ok: true };
  }

  // Removes the deck with the given id.
  // Returns { ok: true } or { ok: false, error: string }.
  function deleteDeck(id) {
    if (!id) return { ok: false, error: 'id は必須です' };

    var decks = CardStorage.loadDecks();
    var next  = decks.filter(function (d) { return d.id !== id; });

    if (next.length === decks.length) {
      return { ok: false, error: 'デッキが見つかりません: ' + id };
    }

    CardStorage.saveDecks(next);
    return { ok: true };
  }

  // ── Export ────────────────────────────────────────────────────────────────

  window.DeckRepository = {
    getAllDecks:  getAllDecks,
    getDeckById: getDeckById,
    addDeck:     addDeck,
    updateDeck:  updateDeck,
    deleteDeck:  deleteDeck,
  };

})();
