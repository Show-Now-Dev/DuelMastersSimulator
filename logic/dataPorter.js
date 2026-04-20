// logic/dataPorter.js
//
// Data export / import layer.
// Routes all I/O through CardRepository and DeckRepository — never calls Storage directly.
//
// ── Formats ────────────────────────────────────────────────────────────────────
//
//   deck-share  { format:"deck-share", version:1, deck:{name, cards:[{cardName,count}]}, cards:[CardDef] }
//               One deck + all referenced card definitions. Card names are the portable key.
//
//   cards       { format:"cards", version:1, cards:[CardDef] }
//               Card definitions only. Used for card-pool sharing.
//
//   legacy      { cards:[CardDef], decks:[DeckDef] }  (old exportData output — still importable)
//
// ── Public API ──────────────────────────────────────────────────────────────────
//
//   exportData()                          → { ok, cards, decks }          full backup download
//   importData(jsonText)                  → { ok, stats, errors }          full backup import
//
//   exportDeck(deckId)                    → { ok, warnings? }              deck-share download
//   exportCards()                         → { ok, count }                  cards-only download
//
//   checkConflicts(jsonText)              → { ok, format, newCards,        pure — no side effects
//                                            identicalCards, conflictCards,
//                                            deck? }
//   confirmImport(jsonText, overwrite)    → { ok, stats, deckName, errors } actually writes

(function () {

  // ── Card equality ─────────────────────────────────────────────────────────

  var _COMPARE_FIELDS = ['cost', 'type', 'power', 'jokers'];

  function _arraysEqualAsSet(a, b) {
    a = a || []; b = b || [];
    if (a.length !== b.length) return false;
    return a.every(function (x) { return b.indexOf(x) !== -1; });
  }

  function _cardsEqual(a, b) {
    for (var i = 0; i < _COMPARE_FIELDS.length; i++) {
      if (a[_COMPARE_FIELDS[i]] !== b[_COMPARE_FIELDS[i]]) return false;
    }
    if (!_arraysEqualAsSet(a.civilization, b.civilization)) return false;
    if (!_arraysEqualAsSet(a.races, b.races)) return false;
    var aAb = (a.abilities || []).map(function (x) { return x.trim(); });
    var bAb = (b.abilities || []).map(function (x) { return x.trim(); });
    if (aAb.length !== bAb.length) return false;
    for (var j = 0; j < aAb.length; j++) {
      if (aAb[j] !== bAb[j]) return false;
    }
    if (a.type === 'twin' || b.type === 'twin') {
      var aSides = a.sides || []; var bSides = b.sides || [];
      if (aSides.length !== bSides.length) return false;
      for (var k = 0; k < aSides.length; k++) {
        if (!_cardsEqual(aSides[k], bSides[k])) return false;
      }
    }
    return true;
  }

  // ── File download ─────────────────────────────────────────────────────────

  function _download(payload, filename) {
    var blob = new Blob([payload], { type: 'application/json' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function _dateStamp() {
    var d = new Date();
    return d.getFullYear()
      + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ── Export: full backup ───────────────────────────────────────────────────

  function exportData() {
    try {
      var cards = CardRepository.getAllCards();
      var decks = DeckRepository.getAllDecks();
      var payload = JSON.stringify({ cards: cards, decks: decks }, null, 2);
      _download(payload, 'cardgame-data-' + _dateStamp() + '.json');
      return { ok: true, cards: cards.length, decks: decks.length };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── Payload builders (pure — no download side effects) ────────────────────

  // Returns { ok, json, safeName, warnings? } or { ok:false, error }
  function _buildDeckPayload(deckId) {
    var deck = DeckRepository.getDeckById(deckId);
    if (!deck) return { ok: false, error: 'デッキが見つかりません: ' + deckId };

    var cardDefs     = [];
    var missingCount = 0;

    // Convert a { cardId, count }[] entry list into portable { cardName, count }[] list,
    // accumulating card definitions into cardDefs.
    function _portableList(entries) {
      var list = [];
      (entries || []).forEach(function (entry) {
        var card = CardRepository.getCardById(entry.cardId);
        if (!card) { missingCount++; return; }
        list.push({ cardName: card.name, count: entry.count });
        var def = Object.assign({}, card);
        delete def.id;
        cardDefs.push(def);
      });
      return list;
    }

    var portableMain = _portableList(deck.cards);
    var portableHS   = _portableList(deck.hyperspatialCards);
    var portableGR   = _portableList(deck.superGRCards);

    var deckPayload = { name: deck.name, cards: portableMain };
    if (portableHS.length) deckPayload.hyperspatialCards = portableHS;
    if (portableGR.length) deckPayload.superGRCards      = portableGR;

    var json = JSON.stringify({
      format:  'deck-share',
      version: 1,
      deck:    deckPayload,
      cards:   cardDefs,
    }, null, 2);

    var result = {
      ok:       true,
      json:     json,
      safeName: deck.name.replace(/[\\/:*?"<>|]/g, '_'),
    };
    if (missingCount) result.warnings = ['カード定義が見つからず ' + missingCount + ' 枚をスキップしました'];
    return result;
  }

  // Returns { ok, json, count } or { ok:false, error }
  function _buildCardsPayload() {
    var cards = CardRepository.getAllCards().map(function (card) {
      var def = Object.assign({}, card);
      delete def.id;
      return def;
    });
    var json = JSON.stringify({
      format:  'cards',
      version: 1,
      cards:   cards,
    }, null, 2);
    return { ok: true, json: json, count: cards.length };
  }

  // ── Export: single deck (deck-share format) ───────────────────────────────

  function exportDeck(deckId) {
    var r = _buildDeckPayload(deckId);
    if (!r.ok) return r;
    _download(r.json, 'deck-' + r.safeName + '-' + _dateStamp() + '.json');
    return { ok: true, warnings: r.warnings };
  }

  // Returns deck-share JSON string without downloading — for text export.
  function getDeckJSON(deckId) {
    return _buildDeckPayload(deckId);  // { ok, json, warnings? } or { ok:false, error }
  }

  // ── Export: cards only ────────────────────────────────────────────────────

  function exportCards() {
    try {
      var r = _buildCardsPayload();
      _download(r.json, 'cards-' + _dateStamp() + '.json');
      return { ok: true, count: r.count };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // Returns cards JSON string without downloading — for text export.
  function getCardsJSON() {
    try {
      return _buildCardsPayload();  // { ok, json, count }
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── Import: full backup (legacy) ──────────────────────────────────────────

  function importData(jsonText) {
    var parsed;
    try { parsed = JSON.parse(jsonText); } catch (e) {
      return { ok: false, error: 'JSONの解析に失敗しました: ' + e.message };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'JSONのフォーマットが不正です' };
    }

    var errors = []; var cardCount = 0; var deckCount = 0;

    (Array.isArray(parsed.cards) ? parsed.cards : []).forEach(function (card, i) {
      var result = CardRepository.addCard(card);
      if (result.ok) cardCount++;
      else errors.push('カード[' + i + ']: ' + result.error);
    });

    (Array.isArray(parsed.decks) ? parsed.decks : []).forEach(function (deck, i) {
      var stripped = Object.assign({}, deck);
      delete stripped.id;
      var result = DeckRepository.addDeck(stripped);
      if (result.ok) deckCount++;
      else errors.push('デッキ[' + i + ']: ' + result.error);
    });

    return { ok: true, stats: { cards: cardCount, decks: deckCount }, errors: errors };
  }

  // ── Conflict check (pure — no side effects) ───────────────────────────────
  //
  // Classifies each incoming card as:
  //   newCards        — name not in local storage
  //   identicalCards  — same name + all comparison fields match
  //   conflictCards   — same name + at least one field differs
  //
  // Returns:
  //   { ok: true, format, newCards, identicalCards, conflictCards, deck? }
  // or
  //   { ok: false, error }

  function checkConflicts(jsonText) {
    var parsed;
    try { parsed = JSON.parse(jsonText); } catch (e) {
      return { ok: false, error: 'JSONの解析に失敗しました: ' + e.message };
    }

    var fmt = parsed.format;
    var incomingCards;

    if (fmt === 'deck-share' || fmt === 'cards') {
      incomingCards = parsed.cards || [];
    } else if (!fmt && Array.isArray(parsed.cards)) {
      incomingCards = parsed.cards;
      fmt = 'legacy';
    } else {
      return { ok: false, error: '未対応のフォーマットです。デッキ共有ファイルまたはカード情報ファイルを選択してください。' };
    }

    var newCards = [], identicalCards = [], conflictCards = [];

    incomingCards.forEach(function (card) {
      var local = CardRepository.getCardByName(card.name);
      if (!local) {
        newCards.push(card);
      } else if (_cardsEqual(local, card)) {
        identicalCards.push(card);
      } else {
        conflictCards.push({ incoming: card, local: local });
      }
    });

    var result = {
      ok: true, format: fmt,
      newCards: newCards, identicalCards: identicalCards, conflictCards: conflictCards,
    };
    if (fmt === 'deck-share') result.deck = parsed.deck;
    return result;
  }

  // ── Schema migration ──────────────────────────────────────────────────────
  //
  // Each _migrateVN function takes a parsed payload at version N and returns
  // the same payload normalised to the next version.  Add new functions here
  // as the format evolves; _migrate() applies them in order automatically.
  //
  // Current format: version 1 (no transformation needed yet).

  function _migrate(parsed) {
    // Future: var v = parsed.version || 0;
    // if (v < 2) parsed = _migrateV1toV2(parsed);
    // if (v < 3) parsed = _migrateV2toV3(parsed);
    return parsed;
  }

  // ── Confirm import (actually writes to storage) ───────────────────────────
  //
  // overwriteConflicts: true  → conflicting cards are overwritten
  //                    false → conflicting cards are kept as-is
  //
  // Returns:
  //   { ok: true, stats: { added, updated, skipped }, deckName, errors }
  // or
  //   { ok: false, error }

  function confirmImport(jsonText, overwriteConflicts) {
    var parsed;
    try { parsed = JSON.parse(jsonText); } catch (e) {
      return { ok: false, error: 'JSONの解析に失敗しました: ' + e.message };
    }

    parsed = _migrate(parsed);
    var incomingCards = parsed.cards || [];
    var errors = [];
    var added = 0, updated = 0, skipped = 0;

    incomingCards.forEach(function (card) {
      var local = CardRepository.getCardByName(card.name);
      if (local && _cardsEqual(local, card)) { skipped++; return; }
      if (local && !overwriteConflicts)       { skipped++; return; }

      var result = CardRepository.addCard(card);
      if (result.ok) {
        if (local) updated++; else added++;
      } else {
        errors.push(card.name + ': ' + result.error);
      }
    });

    var deckName = null;

    if (parsed.format === 'deck-share' && parsed.deck) {
      var missingNames = [];

      // Resolve portable { cardName, count } entries to { cardId, count } using local storage.
      function _resolveEntries(src) {
        var out = [];
        (src || []).forEach(function (entry) {
          var local = CardRepository.getCardByName(entry.cardName);
          if (local) {
            out.push({ cardId: local.id, count: entry.count });
          } else {
            missingNames.push(entry.cardName);
          }
        });
        return out;
      }

      var entries   = _resolveEntries(parsed.deck.cards);
      var hsEntries = _resolveEntries(parsed.deck.hyperspatialCards);
      var grEntries = _resolveEntries(parsed.deck.superGRCards);

      if (missingNames.length) {
        errors.push('以下のカードが見つかりませんでした: ' + missingNames.join(', '));
      }

      if (entries.length) {
        var deckData = { name: parsed.deck.name, cards: entries };
        if (hsEntries.length) deckData.hyperspatialCards = hsEntries;
        if (grEntries.length) deckData.superGRCards      = grEntries;
        var deckResult = DeckRepository.addDeck(deckData);
        if (deckResult.ok) {
          deckName = parsed.deck.name;
        } else {
          errors.push('デッキ保存失敗: ' + deckResult.error);
        }
      }
    }

    return { ok: true, stats: { added: added, updated: updated, skipped: skipped }, deckName: deckName, errors: errors };
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.DataPorter = {
    exportData:     exportData,
    importData:     importData,
    exportDeck:     exportDeck,
    getDeckJSON:    getDeckJSON,
    exportCards:    exportCards,
    getCardsJSON:   getCardsJSON,
    checkConflicts: checkConflicts,
    confirmImport:  confirmImport,
  };

})();
