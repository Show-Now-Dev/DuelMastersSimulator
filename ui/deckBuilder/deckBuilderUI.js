// ui/deckBuilder/deckBuilderUI.js
//
// Deck builder UI module.
// Lets the user select registered cards and quantities, then save a DeckDefinition.
//
// Rules:
//   - No game state access
//   - No DOM manipulation outside the provided container
//   - Reads cards via CardRepository; saves decks via DeckRepository
//   - Delegates count logic to logic/deckBuilder.js

var DeckBuilderUI = (function () {

  var TARGET_COUNT = 40;

  var CIVS = ['light', 'water', 'darkness', 'fire', 'nature'];
  var CIV_LABELS = {
    light:    '光',
    water:    '水',
    darkness: '闇',
    fire:     '火',
    nature:   '自然',
  };
  var CIV_COLORS = {
    light: '#eab308', water: '#2563eb', darkness: '#18181b', fire: '#dc2626', nature: '#16a34a',
  };
  var CIV_ORDER = ['light', 'water', 'darkness', 'fire', 'nature'];

  var _container   = null;
  var _onSave      = null;  // callback(deckDef) — called after a deck is saved
  var _allCards    = [];    // CardDefinition[] currently loaded from storage
  var _counts      = {};    // cardId → count (the deck being built)
  var _filters     = { name: '', civilization: [] };

  // Mount the builder into a container element.
  function init(container, onSave) {
    _container = container;
    _onSave    = onSave;
  }

  // Reload cards from repository and re-render.
  // Call this each time the screen becomes visible.
  function show() {
    _allCards = CardRepository.getAllCards();
    _counts   = {};
    _filters  = { name: '', civilization: [] };
    _render();
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  function _render() {
    _container.innerHTML = '';

    var heading = _el('h2', { textContent: 'デッキビルダー' });
    _container.appendChild(heading);

    if (!_allCards.length) {
      var notice = _el('p', {
        className:   'screen-desc',
        textContent: 'カードが登録されていません。先にカード登録画面でカードを追加してください。',
      });
      _container.appendChild(notice);
      return;
    }

    // Deck name input
    var nameRow   = _el('div', { className: 'deck-builder__name-row' });
    var nameLabel = _el('label', { textContent: 'デッキ名:' });
    var nameInput = _el('input', {
      type:        'text',
      className:   'deck-builder__name-input',
      placeholder: '新しいデッキ',
    });
    nameRow.appendChild(nameLabel);
    nameRow.appendChild(nameInput);
    _container.appendChild(nameRow);

    // Total counter (updated reactively)
    var totalEl = _el('div', { className: 'deck-builder__total' });
    _container.appendChild(totalEl);

    // Search panel
    _container.appendChild(_buildSearchPanel());

    // Card list wrapper — re-rendered on filter changes
    var listWrap = _el('div', { className: 'deck-builder__list-wrap' });
    _container.appendChild(listWrap);
    _renderCardList(listWrap, _filteredCards(), totalEl);

    // Save button
    var saveBtn = _el('button', {
      className:   'btn btn--primary deck-builder__save-btn',
      textContent: 'デッキを保存',
    });

    saveBtn.addEventListener('click', function () {
      var total = _totalCount();
      if (total !== TARGET_COUNT) {
        alert('デッキは ' + TARGET_COUNT + ' 枚にしてください（現在: ' + total + ' 枚）');
        return;
      }

      var deckName = nameInput.value.trim() || '新しいデッキ';
      var entries = Object.keys(_counts)
        .filter(function (id) { return _counts[id] > 0; })
        .map(function (id) { return { cardId: id, count: _counts[id] }; });

      var result = DeckRepository.addDeck(createDeckDefinition('', deckName, entries));
      if (!result.ok) {
        alert('保存失敗: ' + result.error);
        return;
      }

      var deck = DeckRepository.getDeckById(result.id);
      if (_onSave) _onSave(deck);
      alert('デッキを保存しました: ' + deckName);

      _counts = {};
      show();
    });

    _container.appendChild(saveBtn);
    _updateTotal(totalEl);
  }

  // ── Search panel ──────────────────────────────────────────────────────────

  function _buildSearchPanel() {
    var panel = _el('div', { className: 'cm-search-panel' });

    // Name filter
    var nameRow = _el('div', { className: 'cm-search-row' });
    nameRow.appendChild(_el('label', { textContent: 'カード名:', className: 'cm-search-label' }));
    var nameInput = _el('input', {
      type:        'text',
      className:   'cm-search-input',
      placeholder: '名前で絞り込み',
      value:       _filters.name,
    });
    nameRow.appendChild(nameInput);
    panel.appendChild(nameRow);

    // Civilization filter
    var civRow = _el('div', { className: 'cm-search-row' });
    civRow.appendChild(_el('label', { textContent: '文明:', className: 'cm-search-label' }));
    var civGroup = _el('div', { className: 'cm-civ-group' });
    var civChecks = {};
    CIVS.forEach(function (civ) {
      var label = document.createElement('label');
      label.className = 'cm-civ-label cm-civ--' + civ;
      var cb = document.createElement('input');
      cb.type    = 'checkbox';
      cb.value   = civ;
      cb.checked = _filters.civilization.indexOf(civ) !== -1;
      civChecks[civ] = cb;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(CIV_LABELS[civ]));
      civGroup.appendChild(label);
    });
    civRow.appendChild(civGroup);
    panel.appendChild(civRow);

    // Buttons
    var searchBtn = document.createElement('button');
    searchBtn.textContent = '検索';
    searchBtn.className   = 'btn';
    searchBtn.addEventListener('click', function () {
      _filters.name         = nameInput.value.trim();
      _filters.civilization = CIVS.filter(function (c) { return civChecks[c].checked; });
      _refreshCardList();
    });
    panel.appendChild(searchBtn);

    var clearBtn = document.createElement('button');
    clearBtn.textContent = 'クリア';
    clearBtn.className   = 'btn';
    clearBtn.addEventListener('click', function () {
      _filters = { name: '', civilization: [] };
      nameInput.value = '';
      CIVS.forEach(function (c) { civChecks[c].checked = false; });
      _refreshCardList();
    });
    panel.appendChild(clearBtn);

    return panel;
  }

  // ── Card list ──────────────────────────────────────────────────────────────

  function _renderCardList(wrap, cards, totalEl) {
    wrap.innerHTML = '';

    if (!cards.length) {
      wrap.appendChild(_el('p', { className: 'screen-desc', textContent: '該当するカードがありません。' }));
      return;
    }

    var list = _el('div', { className: 'deck-builder__card-list' });

    cards.forEach(function (card) {
      var civs = _getCardCivs(card);

      var row = _el('div', { className: 'deck-builder__row cm-card-row' });

      // Color swatch
      var swatch = _el('div', { className: 'cm-card-swatch' });
      swatch.style.background = _civBackground(civs);
      row.appendChild(swatch);

      // Info
      var infoEl   = _el('div', { className: 'deck-builder__card-info cm-card-info' });
      var nameEl   = _el('span', { className: 'deck-builder__card-name cm-card-name', textContent: card.name });
      var metaEl   = _el('span', { className: 'deck-builder__card-civ cm-card-meta', textContent: _cardMeta(card) });
      infoEl.appendChild(nameEl);
      infoEl.appendChild(metaEl);
      row.appendChild(infoEl);

      // Count control
      var countCtrl = _el('div', { className: 'deck-builder__count-ctrl' });

      var minusBtn = document.createElement('button');
      minusBtn.textContent = '−';
      minusBtn.className   = 'btn btn--small';

      var countNum = _el('span', {
        className:   'deck-builder__count-num',
        textContent: String(_counts[card.id] || 0),
      });

      var plusBtn = document.createElement('button');
      plusBtn.textContent = '＋';
      plusBtn.className   = 'btn btn--small';

      minusBtn.addEventListener('click', function () {
        _counts[card.id] = Math.max(0, (_counts[card.id] || 0) - 1);
        countNum.textContent = String(_counts[card.id]);
        _updateTotal(totalEl);
      });

      plusBtn.addEventListener('click', function () {
        _counts[card.id] = (_counts[card.id] || 0) + 1;
        countNum.textContent = String(_counts[card.id]);
        _updateTotal(totalEl);
      });

      countCtrl.appendChild(minusBtn);
      countCtrl.appendChild(countNum);
      countCtrl.appendChild(plusBtn);
      row.appendChild(countCtrl);

      list.appendChild(row);
    });

    wrap.appendChild(list);
  }

  function _refreshCardList() {
    var wrap = _container.querySelector('.deck-builder__list-wrap');
    var totalEl = _container.querySelector('.deck-builder__total');
    if (wrap) _renderCardList(wrap, _filteredCards(), totalEl);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _filteredCards() {
    return _allCards.filter(function (card) {
      if (_filters.name) {
        if (card.name.toLowerCase().indexOf(_filters.name.toLowerCase()) === -1) return false;
      }
      if (_filters.civilization.length) {
        var civs = _getCardCivs(card);
        var match = _filters.civilization.some(function (fc) { return civs.indexOf(fc) !== -1; });
        if (!match) return false;
      }
      return true;
    });
  }

  function _totalCount() {
    return Object.keys(_counts).reduce(function (sum, id) {
      return sum + (_counts[id] || 0);
    }, 0);
  }

  function _updateTotal(el) {
    var total = _totalCount();
    var over  = total > TARGET_COUNT;
    var exact = total === TARGET_COUNT;
    el.textContent = '合計: ' + total + ' / ' + TARGET_COUNT + ' 枚';
    el.className = 'deck-builder__total'
      + (exact ? ' is-valid' : '')
      + (over  ? ' is-over'  : '');
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

  function _civBackground(civs) {
    if (!civs || !civs.length) return '#ffffff';
    var ordered = CIV_ORDER.filter(function (c) { return civs.indexOf(c) !== -1; });
    if (!ordered.length) return '#ffffff';
    if (ordered.length === 1) return CIV_COLORS[ordered[0]];
    var stops = ordered.map(function (c, i) {
      return CIV_COLORS[c] + ' ' + Math.round(i / (ordered.length - 1) * 100) + '%';
    });
    return 'linear-gradient(135deg, ' + stops.join(', ') + ')';
  }

  function _cardMeta(card) {
    var parts = [];
    var civs  = _getCardCivs(card);
    if (civs.length) parts.push(civs.map(function (c) { return CIV_LABELS[c] || c; }).join('/'));
    if (card.type === 'twin') {
      var costs = (card.sides || []).map(function (s) { return s.cost; }).filter(function (c) { return c != null; });
      if (costs.length) parts.push('コスト ' + costs.join('/'));
    } else {
      if (card.cost != null) parts.push('コスト ' + card.cost);
    }
    parts.push(card.type || '');
    return parts.filter(Boolean).join(' ・ ');
  }

  function _el(tag, props) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) { el[k] = props[k]; });
    }
    return el;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  return { init: init, show: show };

})();
