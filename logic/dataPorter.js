// logic/dataPorter.js
//
// Data export / import layer.
// Routes all I/O through CardRepository and DeckRepository — never calls Storage directly.
//
// Export: serialises all cards and decks to a JSON blob and triggers a browser file download.
// Import: reads a JSON string, validates its shape, then upserts each entry via repositories.
//
// Return shapes:
//   exportData()  → { ok: true, cards: n, decks: n }  |  { ok: false, error: string }
//   importData(s) → { ok: true, stats: { cards, decks }, errors: string[] }
//                 | { ok: false, error: string }

(function () {

  // ── Export ─────────────────────────────────────────────────────────────────

  // Serialises all cards and decks and triggers a JSON file download.
  function exportData() {
    try {
      var cards = CardRepository.getAllCards();
      var decks = DeckRepository.getAllDecks();

      var payload = JSON.stringify({ cards: cards, decks: decks }, null, 2);
      var blob    = new Blob([payload], { type: 'application/json' });
      var url     = URL.createObjectURL(blob);

      var a       = document.createElement('a');
      a.href      = url;
      a.download  = 'cardgame-data-' + _dateStamp() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { ok: true, cards: cards.length, decks: decks.length };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  // Parses a JSON string and upserts all cards and decks via repositories.
  //   - Cards:  addCard() semantics — same-name card is overwritten, id is kept stable.
  //   - Decks:  always added as NEW decks (fresh id generated each time).
  function importData(jsonText) {
    var parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      return { ok: false, error: 'JSONの解析に失敗しました: ' + e.message };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'JSONのフォーマットが不正です（ルートにオブジェクトが必要です）' };
    }

    var errors    = [];
    var cardCount = 0;
    var deckCount = 0;

    // Import cards ─────────────────────────────────────────────────────────
    var cards = Array.isArray(parsed.cards) ? parsed.cards : [];
    cards.forEach(function (card, i) {
      var result = CardRepository.addCard(card);
      if (result.ok) {
        cardCount++;
      } else {
        errors.push('カード[' + i + ']: ' + result.error);
      }
    });

    // Import decks — always create new (strip id so DeckRepository generates one) ─
    var decks = Array.isArray(parsed.decks) ? parsed.decks : [];
    decks.forEach(function (deck, i) {
      var stripped = Object.assign({}, deck);
      delete stripped.id;
      var result = DeckRepository.addDeck(stripped);
      if (result.ok) {
        deckCount++;
      } else {
        errors.push('デッキ[' + i + ']: ' + result.error);
      }
    });

    return {
      ok:     true,
      stats:  { cards: cardCount, decks: deckCount },
      errors: errors,
    };
  }

  // ── Helper ─────────────────────────────────────────────────────────────────

  function _dateStamp() {
    var d = new Date();
    return d.getFullYear()
      + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.DataPorter = {
    exportData: exportData,
    importData: importData,
  };

})();
