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

  var _container  = null;
  var _editingId  = null;  // id of the deck currently being edited, or null

  // ── Public API ─────────────────────────────────────────────────────────────

  function init(container) {
    _container = container;
  }

  function show() {
    _editingId = null;
    _renderList();
  }

  // ── Deck list view ─────────────────────────────────────────────────────────

  function _renderList() {
    _container.innerHTML = '';
    _container.appendChild(_el('h2', { textContent: 'デッキ管理' }));

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

    // Search filter for the card list
    _container.appendChild(_buildSearchPanel());

    // Build initial counts from deck entries
    var countsMap = {};
    (deck.cards || []).forEach(function (entry) {
      countsMap[entry.cardId] = entry.count || 0;
    });

    // Card list area
    var cardListWrap = _el('div', { className: 'de-card-list-wrap' });
    _container.appendChild(cardListWrap);

    // Render card list (all registered cards, with current deck counts)
    _renderEditCardList(cardListWrap, CardRepository.getAllCards(), countsMap, totalEl);

    // Error / status message
    var msgEl = _el('p', { className: 'msg', textContent: '' });
    msgEl.style.display = 'none';
    _container.appendChild(msgEl);

    // Save button
    var saveBtn = _btn('デッキを保存', 'btn btn--primary de-save-btn', function () {
      var newName = nameInput.value.trim();
      if (!newName) { _showMsg(msgEl, 'msg--error', 'デッキ名を入力してください'); return; }

      var entries = Object.keys(countsMap)
        .filter(function (id) { return (countsMap[id] || 0) > 0; })
        .map(function (id)    { return { cardId: id, count: countsMap[id] }; });

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
      // Refresh the heading
      _container.querySelector('h2').textContent = newName + ' を編集';
    });
    _container.appendChild(saveBtn);

    _updateTotal(totalEl, countsMap);
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
      row.className       = 'deck-builder__row';
      row.dataset.cardId  = card.id;

      var infoEl = _el('div', { className: 'deck-builder__card-info' });
      infoEl.appendChild(_el('span', { className: 'deck-builder__card-name', textContent: card.name }));
      infoEl.appendChild(_el('span', {
        className:   'deck-builder__card-civ',
        textContent: civs.map(function (c) { return _CIV_LABELS[c] || c; }).join('/') || '—',
      }));
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

  // ── Search panel (inline filter for edit view) ─────────────────────────────

  function _buildSearchPanel() {
    var panel = _el('div', { className: 'cm-search-panel' });

    var nameRow = _el('div', { className: 'cm-search-row' });
    nameRow.appendChild(_el('label', { className: 'cm-search-label', textContent: 'カード名:' }));
    var nameInput = _el('input', {
      type:        'text',
      className:   'cm-search-input',
      placeholder: '名前で絞り込み',
    });
    nameRow.appendChild(nameInput);
    panel.appendChild(nameRow);

    var searchBtn = _btn('絞り込み', 'btn', function () {
      var name = nameInput.value.trim();
      var cards = name
        ? CardRepository.searchCards({ name: name })
        : CardRepository.getAllCards();

      // Flush currently-visible counts into the shared countsMap before re-rendering,
      // so counts for cards scrolled off-screen are not lost.
      var wrap    = _container.querySelector('.de-card-list-wrap');
      var totalEl = _container.querySelector('.deck-builder__total');
      var flushed = _collectCurrentCounts();
      Object.keys(flushed).forEach(function (id) { countsMap[id] = flushed[id]; });
      if (wrap) _renderEditCardList(wrap, cards, countsMap, totalEl);
    });
    panel.appendChild(searchBtn);

    return panel;
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
