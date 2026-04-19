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

  // ── Card type migration (English → Japanese) ──────────────────────────────
  //
  // Older saves stored card types as English keys (creature, spell, etc.).
  // This map converts them to the Japanese strings now used as the canonical form.
  // 'twin' is intentionally absent — it stays as 'twin'.

  var _TYPE_MIGRATION = {
    'creature':  'クリーチャー',
    'spell':     '呪文',
    'tamaseed':  'タマシード',
    'crossgear': 'クロスギア',
    'fortress':  'フォートレス',
    'd2field':   'D2フィールド',
    'aura':      'オーラ',
  };

  function _needsTypeMigration(cards) {
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (_TYPE_MIGRATION[c.type]) return true;
      if (c.type === 'twin' && Array.isArray(c.sides)) {
        for (var j = 0; j < c.sides.length; j++) {
          if (_TYPE_MIGRATION[c.sides[j].type]) return true;
        }
      }
    }
    return false;
  }

  function _migrateCardTypes(cards) {
    return cards.map(function (card) {
      var m = Object.assign({}, card);
      if (_TYPE_MIGRATION[m.type]) m.type = _TYPE_MIGRATION[m.type];
      if (m.type === 'twin' && Array.isArray(m.sides)) {
        m.sides = m.sides.map(function (side) {
          var s = Object.assign({}, side);
          if (_TYPE_MIGRATION[s.type]) s.type = _TYPE_MIGRATION[s.type];
          return s;
        });
      }
      return m;
    });
  }

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
  // Runs a one-time migration of English type strings to Japanese on first load
  // after the update; subsequent loads skip it (no English types remain).
  function loadCards() {
    var stored = readRaw(CARDS_KEY);
    if (!stored) return [];

    var cards;

    // Versioned format: { version, cards }
    if (stored && typeof stored === 'object' && Array.isArray(stored.cards)) {
      cards = stored.cards;
    } else if (Array.isArray(stored)) {
      // Legacy format: plain array
      cards = stored;
    } else {
      return [];
    }

    // One-time migration: convert English type keys to Japanese.
    if (_needsTypeMigration(cards)) {
      cards = _migrateCardTypes(cards);
      saveCards(cards);
    }

    return cards;
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
