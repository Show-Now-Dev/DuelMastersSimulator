// storage/cardStorage.js
//
// Persistence layer for CardDefinition[] and DeckDefinition[].
// Only this module accesses localStorage — no other module should do so.
//
// Internal storage format:
//   cardgame_cards → { version: 1, cards: CardDefinition[] }
//   cardgame_decks → { version: 1, decks: DeckDefinition[] }
//
// Public API:
//   CardStorage.loadCards()          → CardDefinition[]  (always an array)
//   CardStorage.saveCards(cards)     → void
//   CardStorage.addCard(card)        → { ok: boolean, error?: string }
//   CardStorage.loadDecks()          → DeckDefinition[]  (always an array)
//   CardStorage.saveDecks(decks)     → void

(function () {

  var CARDS_KEY = 'cardgame_cards';
  var DECKS_KEY = 'cardgame_decks';
  var VERSION   = 1;

  // ── ID generation ─────────────────────────────────────────────────────────
  //
  // Uses crypto.randomUUID() when available; falls back to a timestamp+random
  // string for environments that don't support it.

  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Fallback: timestamp + random hex
    return 'card_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  // ── Validation ────────────────────────────────────────────────────────────
  //
  // Minimum requirements per CARD_FORMAT.md spec: name and type must be present.

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

  // ── Raw read / write ──────────────────────────────────────────────────────

  function readRaw(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('CardStorage read error (' + key + '):', e);
      return null;
    }
  }

  function writeRaw(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('CardStorage write error (' + key + '):', e);
      return false;
    }
  }

  // ── Card CRUD ─────────────────────────────────────────────────────────────

  // Always returns a CardDefinition[]. Handles missing or corrupted data
  // gracefully (returns [] rather than throwing).
  function loadCards() {
    var stored = readRaw(CARDS_KEY);
    if (!stored) return [];

    // Versioned format: { version, cards }
    if (stored && typeof stored === 'object' && Array.isArray(stored.cards)) {
      return stored.cards;
    }

    // Legacy format: plain array (auto-migrate on next save)
    if (Array.isArray(stored)) {
      return stored;
    }

    return [];
  }

  // Saves the full card list.
  function saveCards(cards) {
    var payload = { version: VERSION, cards: Array.isArray(cards) ? cards : [] };
    writeRaw(CARDS_KEY, payload);
  }

  // Adds a single parsed card.
  // Assigns a generated id, validates, and deduplicates by name.
  //
  // Returns { ok: true } on success, { ok: false, error: string } on failure.
  function addCard(card) {
    var errors = validateCard(card);
    if (errors.length) {
      return { ok: false, error: errors.join('; ') };
    }

    var existing = loadCards();

    // Deduplicate: if a card with the same name exists, replace it (keep its id).
    var idx = -1;
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].name === card.name) { idx = i; break; }
    }

    var withId = Object.assign({}, card, {
      id: (idx !== -1 && existing[idx].id) ? existing[idx].id : generateId(),
    });

    if (idx !== -1) {
      existing[idx] = withId;
    } else {
      existing.push(withId);
    }

    saveCards(existing);
    return { ok: true };
  }

  // ── Deck CRUD ─────────────────────────────────────────────────────────────

  // Always returns a DeckDefinition[].
  function loadDecks() {
    var stored = readRaw(DECKS_KEY);
    if (!stored) return [];

    if (stored && typeof stored === 'object' && Array.isArray(stored.decks)) {
      return stored.decks;
    }

    // Legacy plain array
    if (Array.isArray(stored)) {
      return stored;
    }

    return [];
  }

  // Saves the full deck list.
  function saveDecks(decks) {
    var payload = { version: VERSION, decks: Array.isArray(decks) ? decks : [] };
    writeRaw(DECKS_KEY, payload);
  }

  // ── Export ────────────────────────────────────────────────────────────────
  window.CardStorage = {
    loadCards:  loadCards,
    saveCards:  saveCards,
    addCard:    addCard,
    loadDecks:  loadDecks,
    saveDecks:  saveDecks,
  };

})();
