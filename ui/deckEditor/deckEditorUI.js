// ui/deckEditor/deckEditorUI.js
//
// Deck management screen.
// Lists saved decks; lets the user rename, edit card counts, and delete them.
//
// Rules:
//   - No game state access
//   - All deck CRUD goes through DeckRepository
//   - Card lookups go through CardRepository
//   - Target count is 40 (same as DeckBuilderUI); validation is advisory-only on edit

var DeckEditorUI = (function () {

  var TARGET_COUNT = 40;

  var _container     = null;
  var _editingId     = null;   // id of the deck currently being edited, or null
  var _editCountsMap = null;   // live counts map for the deck currently being edited
  var _editFilters   = CardSearchUI.defaultFilters();

  // ── Public API ─────────────────────────────────────────────────────────────

  function init(container) {
    _container = container;
  }

  function show() {
    _editingId     = null;
    _editCountsMap = null;
    _editFilters   = { name: '', civilization: [] };
    _renderList();
  }

  // ── Deck list view ─────────────────────────────────────────────────────────

  function _renderList() {
    _container.innerHTML = '';
    _container.appendChild(_el('h2', { textContent: 'デッキ管理' }));

    // Import buttons
    var ioRow = _el('div', { className: 'de-io-row' });

    function _onDeckImport(result) {
      if (!result.ok) { alert('インポート失敗: ' + result.error); return; }
      alert(_importResultMsg(result));
      _renderList();
    }

    ioRow.appendChild(_btn('デッキ読込（ファイル）', 'btn btn--small', function () {
      ImportHelper.trigger(_onDeckImport);
    }));
    ioRow.appendChild(_btn('デッキ読込（テキスト）', 'btn btn--small', function () {
      ImportHelper.triggerText(_onDeckImport);
    }));
    _container.appendChild(ioRow);

    var decks = DeckRepository.getAllDecks();
    if (!decks.length) {
      _container.appendChild(_el('p', {
        className:   'screen-desc',
        textContent: '保存されたデッキがありません。デッキビルダーでデッキを作成してください。',
      }));
      return;
    }

    var list = _el('div', { className: 'de-deck-list' });
    decks.forEach(function (deck) {
      list.appendChild(_buildDeckRow(deck));
    });
    _container.appendChild(list);
  }

  function _buildDeckRow(deck) {
    var row = _el('div', { className: 'de-deck-row' });

    var info = _el('div', { className: 'de-deck-info' });
    info.appendChild(_el('span', { className: 'de-deck-name', textContent: deck.name }));
    info.appendChild(_el('span', {
      className:   'de-deck-count',
      textContent: DeckBuilder.deckCardCount(deck) + ' 枚',
    }));
    row.appendChild(info);

    var actions = _el('div', { className: 'de-deck-actions' });
    actions.appendChild(_btn('編集', 'btn btn--small', function () {
      _editingId = deck.id;
      _renderEdit(deck);
    }));
    actions.appendChild(_btn('書出（ファイル）', 'btn btn--small', function () {
      var result = DataPorter.exportDeck(deck.id);
      if (!result.ok) { alert('エクスポート失敗: ' + result.error); return; }
      if (result.warnings) alert('警告: ' + result.warnings.join('\n'));
    }));
    actions.appendChild(_btn('書出（テキスト）', 'btn btn--small', function () {
      var result = DataPorter.getDeckJSON(deck.id);
      if (!result.ok) { alert('エクスポート失敗: ' + result.error); return; }
      if (result.warnings) alert('警告: ' + result.warnings.join('\n'));
      ImportHelper.showTextExport(deck.name + ' テキスト書出', result.json);
    }));
    actions.appendChild(_btn('削除', 'btn btn--small btn--danger', function () {
      if (!confirm('"' + deck.name + '" を削除しますか？')) return;
      var result = DeckRepository.deleteDeck(deck.id);
      if (!result.ok) { alert('削除失敗: ' + result.error); return; }
      _renderList();
    }));
    row.appendChild(actions);

    return row;
  }

  // ── Deck edit view ─────────────────────────────────────────────────────────

  function _renderEdit(deck) {
    _container.innerHTML = '';

    // Back button
    _container.appendChild(_btn('← 一覧に戻る', 'btn de-back-btn', function () {
      _editingId = null;
      _renderList();
    }));

    _container.appendChild(_el('h2', { textContent: deck.name + ' を編集' }));

    // Deck name input
    var nameRow   = _el('div', { className: 'de-name-row' });
    var nameLabel = _el('label', { textContent: 'デッキ名:' });
    var nameInput = _el('input', {
      type:        'text',
      className:   'de-name-input',
      value:       deck.name,
      placeholder: 'デッキ名',
    });
    nameRow.appendChild(nameLabel);
    nameRow.appendChild(nameInput);
    _container.appendChild(nameRow);

    // Total counter
    var totalEl = _el('div', { className: 'deck-builder__total' });
    _container.appendChild(totalEl);

    // Build initial counts from deck entries.
    // Skip entries whose card definition no longer exists — track how many
    // cards were silently dropped so the user can be informed.
    _editFilters   = CardSearchUI.defaultFilters();
    _editCountsMap = {};
    var _removedCount = 0;
    (deck.cards || []).forEach(function (entry) {
      if (CardRepository.getCardById(entry.cardId)) {
        _editCountsMap[entry.cardId] = entry.count || 0;
      } else {
        _removedCount += entry.count || 0;
      }
    });

    // Search panel (uses shared module; civilization filter included)
    _container.appendChild(CardSearchUI.build({
      filters:  _editFilters,
      onChange: function (newFilters) {
        _editFilters = newFilters;
        // Flush currently-visible counts before re-rendering
        var flushed = _collectCurrentCounts();
        Object.keys(flushed).forEach(function (id) { _editCountsMap[id] = flushed[id]; });

        var cards = CardRepository.searchCards(_editFilters);
        var wrap = _container.querySelector('.de-card-list-wrap');
        if (wrap) _renderEditCardList(wrap, cards, _editCountsMap, totalEl);
      },
    }));

    // Card list area
    var cardListWrap = _el('div', { className: 'de-card-list-wrap' });
    _container.appendChild(cardListWrap);

    // Render card list (all registered cards, with current deck counts)
    _renderEditCardList(cardListWrap, CardRepository.getAllCards(), _editCountsMap, totalEl);

    // Error / status message
    var msgEl = _el('p', { className: 'msg', textContent: '' });
    msgEl.style.display = 'none';
    _container.appendChild(msgEl);

    // Warn if cards were dropped because their definitions no longer exist.
    if (_removedCount > 0) {
      _showMsg(msgEl, 'msg--error',
        '登録情報が削除されたカードが ' + _removedCount + ' 枚ありました。該当カードをデッキから除外しました。新しいカードを追加してデッキを再構成してください。'
      );
    }

    // Save button
    var saveBtn = _btn('デッキを保存', 'btn btn--primary de-save-btn', function () {
      var newName = nameInput.value.trim();
      if (!newName) { _showMsg(msgEl, 'msg--error', 'デッキ名を入力してください'); return; }

      // Flush any counts still visible in the DOM before saving
      var flushed = _collectCurrentCounts();
      Object.keys(flushed).forEach(function (id) { _editCountsMap[id] = flushed[id]; });

      var entries = Object.keys(_editCountsMap)
        .filter(function (id) { return (_editCountsMap[id] || 0) > 0; })
        .map(function (id)    { return { cardId: id, count: _editCountsMap[id] }; });

      if (!entries.length) { _showMsg(msgEl, 'msg--error', 'カードが選択されていません'); return; }

      var total = entries.reduce(function (s, e) { return s + e.count; }, 0);
      if (total !== TARGET_COUNT) {
        var confirmed = confirm(
          '合計 ' + total + ' 枚（目標 ' + TARGET_COUNT + ' 枚）です。このまま保存しますか？'
        );
        if (!confirmed) return;
      }

      var result = DeckRepository.updateDeck(_editingId, { name: newName, cards: entries });
      if (!result.ok) { _showMsg(msgEl, 'msg--error', '保存失敗: ' + result.error); return; }

      _showMsg(msgEl, 'msg--success', '保存しました！');
      _container.querySelector('h2').textContent = newName + ' を編集';
    });
    _container.appendChild(saveBtn);

    _updateTotal(totalEl, _editCountsMap);
  }

  // ── Edit card list ─────────────────────────────────────────────────────────

  function _renderEditCardList(wrap, cards, countsMap, totalEl) {
    wrap.innerHTML = '';

    if (!cards.length) {
      wrap.appendChild(_el('p', { className: 'screen-desc', textContent: 'カードが登録されていません。' }));
      return;
    }

    var list = _el('div', { className: 'deck-builder__card-list' });

    cards.forEach(function (card) {
      var civs = _getCardCivs(card);

      var row = document.createElement('div');
      row.className       = 'deck-builder__row cm-card-row';
      row.dataset.cardId  = card.id;

      // Color swatch
      var swatch = _el('div', { className: 'cm-card-swatch' });
      swatch.style.background = _civBackground(civs);
      row.appendChild(swatch);

      // Info: name + meta
      var infoEl = _el('div', { className: 'deck-builder__card-info cm-card-info' });
      infoEl.appendChild(_el('span', { className: 'deck-builder__card-name cm-card-name', textContent: card.name }));
      infoEl.appendChild(_el('span', { className: 'deck-builder__card-civ cm-card-meta', textContent: _cardMeta(card) }));
      row.appendChild(infoEl);

      var ctrl     = _el('div', { className: 'deck-builder__count-ctrl' });
      var minusBtn = _btn('−', 'btn btn--small', null);
      var countNum = _el('span', {
        className:   'deck-builder__count-num',
        textContent: String(countsMap[card.id] || 0),
      });
      var plusBtn  = _btn('＋', 'btn btn--small', null);

      minusBtn.addEventListener('click', function () {
        countsMap[card.id] = Math.max(0, (countsMap[card.id] || 0) - 1);
        countNum.textContent = String(countsMap[card.id]);
        _updateTotal(totalEl, countsMap);
      });
      plusBtn.addEventListener('click', function () {
        countsMap[card.id] = (countsMap[card.id] || 0) + 1;
        countNum.textContent = String(countsMap[card.id]);
        _updateTotal(totalEl, countsMap);
      });

      ctrl.appendChild(minusBtn);
      ctrl.appendChild(countNum);
      ctrl.appendChild(plusBtn);
      row.appendChild(ctrl);
      list.appendChild(row);
    });

    wrap.appendChild(list);
  }

  // Reads current counts from the rendered count controls.
  // Each row carries a data-card-id attribute, so this is filter-safe.
  function _collectCurrentCounts() {
    var map  = {};
    var rows = _container.querySelectorAll('.deck-builder__row[data-card-id]');
    rows.forEach(function (row) {
      var numEl = row.querySelector('.deck-builder__count-num');
      var cardId = row.dataset.cardId;
      if (numEl && cardId) {
        var n = parseInt(numEl.textContent, 10);
        if (n > 0) map[cardId] = n;
      }
    });
    return map;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  var _CIV_LABELS = {
    light: '光', water: '水', darkness: '闇', fire: '火', nature: '自然',
  };

  var _CIV_COLORS = {
    light: '#eab308', water: '#2563eb', darkness: '#18181b', fire: '#dc2626', nature: '#16a34a',
  };

  var _CIV_ORDER = ['light', 'water', 'darkness', 'fire', 'nature'];

  function _civBackground(civs) {
    if (!civs || !civs.length) return '#ffffff';
    var ordered = _CIV_ORDER.filter(function (c) { return civs.indexOf(c) !== -1; });
    if (!ordered.length) return '#ffffff';
    if (ordered.length === 1) return _CIV_COLORS[ordered[0]];
    var stops = ordered.map(function (c, i) {
      return _CIV_COLORS[c] + ' ' + Math.round(i / (ordered.length - 1) * 100) + '%';
    });
    return 'linear-gradient(135deg, ' + stops.join(', ') + ')';
  }

  function _cardMeta(card) {
    var parts = [];
    var civs  = _getCardCivs(card);
    if (civs.length) parts.push(civs.map(function (c) { return _CIV_LABELS[c] || c; }).join('/'));
    if (card.type === 'twin') {
      var costs = (card.sides || []).map(function (s) { return s.cost; }).filter(function (c) { return c != null; });
      if (costs.length) parts.push('コスト ' + costs.join('/'));
    } else {
      if (card.cost != null) parts.push('コスト ' + card.cost);
    }
    parts.push(card.type || '');
    return parts.filter(Boolean).join(' ・ ');
  }

  function _getCardCivs(card) {
    if (card.type === 'twin') {
      var merged = [];
      (card.sides || []).forEach(function (side) {
        [].concat(side.civilization || []).forEach(function (c) {
          if (merged.indexOf(c) === -1) merged.push(c);
        });
      });
      return merged;
    }
    if (!card.civilization) return [];
    return Array.isArray(card.civilization) ? card.civilization : [card.civilization];
  }

  function _updateTotal(el, countsMap) {
    var total = Object.keys(countsMap).reduce(function (s, id) { return s + (countsMap[id] || 0); }, 0);
    el.textContent = '合計: ' + total + ' / ' + TARGET_COUNT + ' 枚';
    el.className   = 'deck-builder__total'
      + (total === TARGET_COUNT ? ' is-valid' : '')
      + (total  >  TARGET_COUNT ? ' is-over'  : '');
  }

  function _importResultMsg(result) {
    var s = result.stats;
    var msg = 'インポート完了: 新規 ' + s.added + ' 枚、更新 ' + s.updated + ' 枚、スキップ ' + s.skipped + ' 枚';
    if (result.deckName) msg += '\nデッキ追加: ' + result.deckName;
    if (result.errors && result.errors.length) msg += '\n警告:\n' + result.errors.join('\n');
    return msg;
  }

  function _showMsg(el, cls, text) {
    el.className    = 'msg ' + cls;
    el.textContent  = text;
    el.style.display = '';
  }

  function _el(tag, props) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) { el[k] = props[k]; });
    return el;
  }

  function _btn(text, cls, handler) {
    var b = document.createElement('button');
    b.textContent = text;
    b.className   = cls;
    if (handler) b.addEventListener('click', handler);
    return b;
  }

  return { init: init, show: show };

})();
