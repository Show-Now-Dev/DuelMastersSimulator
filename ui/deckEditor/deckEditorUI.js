// ui/deckEditor/deckEditorUI.js
//
// Deck management screen.
// Lists saved decks; lets the user rename, edit card counts, and delete them.
//
// Zone-aware editing:
//   メイン     — target 40, same-name 4 max
//   超次元     — 0–8, same-name 4 max
//   超GR       — 0 or 12, same-name 2 max

var DeckEditorUI = (function () {

  var TARGET_COUNT = 40;

  var ZONE_DEFS = [
    { id: 'main',         jpLabel: 'メイン', max: 40 },
    { id: 'hyperspatial', jpLabel: '超次元', max: 8  },
    { id: 'superGR',      jpLabel: '超GR',   max: 12 },
  ];

  var CIV_LABELS = { light:'光', water:'水', darkness:'闇', fire:'火', nature:'自然' };
  var CIV_COLORS = { light:'#eab308', water:'#2563eb', darkness:'#18181b', fire:'#dc2626', nature:'#16a34a' };
  var CIV_ORDER  = ['light','water','darkness','fire','nature'];

  var _container     = null;
  var _editingId     = null;
  var _editCounts    = { main: {}, hyperspatial: {}, superGR: {} };
  var _editZone      = 'main';
  var _editFilters   = CardSearchUI.defaultFilters();
  // DOM refs for reactive zone badge updates
  var _zoneBadgeEls  = {};
  var _zoneTabBtns   = {};

  // ── Public API ──────────────────────────────────────────────────────────────

  function init(container) { _container = container; }

  function show() {
    _editingId   = null;
    _editCounts  = { main: {}, hyperspatial: {}, superGR: {} };
    _editFilters = CardSearchUI.defaultFilters();
    _editZone    = 'main';
    _renderList();
  }

  // ── Deck list view ──────────────────────────────────────────────────────────

  function _renderList() {
    _container.innerHTML = '';
    _container.appendChild(_el('h2', { textContent: 'デッキ管理' }));

    var ioRow = _el('div', { className: 'de-io-row' });
    function _onDeckImport(result) {
      if (!result.ok) { alert('インポート失敗: ' + result.error); return; }
      alert(_importResultMsg(result));
      _renderList();
    }
    ioRow.appendChild(_btn('デッキ読込（ファイル）', 'btn btn--small', function () { ImportHelper.trigger(_onDeckImport); }));
    ioRow.appendChild(_btn('デッキ読込（テキスト）', 'btn btn--small', function () { ImportHelper.triggerText(_onDeckImport); }));
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
    decks.forEach(function (deck) { list.appendChild(_buildDeckRow(deck)); });
    _container.appendChild(list);
  }

  function _buildDeckRow(deck) {
    var row = _el('div', { className: 'de-deck-row' });

    var header = _el('div', { className: 'de-deck-header' });
    header.appendChild(_el('span', { className: 'de-deck-name', textContent: deck.name }));
    row.appendChild(header);

    var actions = _el('div', { className: 'de-deck-actions' });
    actions.appendChild(_el('span', {
      className:   'de-deck-count',
      textContent: DeckBuilder.deckCardCount(deck) + ' 枚',
    }));
    actions.appendChild(_btn('編集', 'btn btn--small', function () {
      _editingId = deck.id;
      _editZone  = 'main';
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

  // ── Deck edit view ──────────────────────────────────────────────────────────

  function _renderEdit(deck) {
    _container.innerHTML = '';
    _zoneBadgeEls = {};
    _zoneTabBtns  = {};

    _container.appendChild(_el('h2', { textContent: deck.name + ' を編集' }));

    // Deck name input
    var nameRow   = _el('div', { className: 'de-name-row' });
    var nameLabel = _el('label', { textContent: 'デッキ名:' });
    var nameInput = _el('input', { type: 'text', className: 'de-name-input', value: deck.name, placeholder: 'デッキ名' });
    nameRow.appendChild(nameLabel);
    nameRow.appendChild(nameInput);
    _container.appendChild(nameRow);

    // Build initial counts from deck entries (skip missing cards)
    var removedCount = { main: 0, hyperspatial: 0, superGR: 0 };
    _editCounts = { main: {}, hyperspatial: {}, superGR: {} };
    _editFilters = CardSearchUI.defaultFilters();

    function _loadEntries(entries, zone) {
      (entries || []).forEach(function (entry) {
        if (CardRepository.getCardById(entry.cardId)) {
          _editCounts[zone][entry.cardId] = entry.count || 0;
        } else {
          removedCount[zone] += entry.count || 0;
        }
      });
    }
    _loadEntries(deck.cards || [],             'main');
    _loadEntries(deck.hyperspatialCards || [], 'hyperspatial');
    _loadEntries(deck.superGRCards || [],      'superGR');

    // Zone tabs
    _container.appendChild(_buildEditZoneTabRow());

    // Total counter + export buttons row
    var totalRow = _el('div', { className: 'de-total-row' });
    var totalEl  = _el('div', { className: 'deck-builder__total' });
    totalRow.appendChild(totalEl);
    totalRow.appendChild(_btn('書出（ファイル）', 'btn btn--small', function () {
      var r = DataPorter.exportDeck(_editingId);
      if (!r.ok) { alert('エクスポート失敗: ' + r.error); return; }
      if (r.warnings && r.warnings.length) alert('警告: ' + r.warnings.join('\n'));
    }));
    totalRow.appendChild(_btn('書出（テキスト）', 'btn btn--small', function () {
      var r = DataPorter.getDeckJSON(_editingId);
      if (!r.ok) { alert('エクスポート失敗: ' + r.error); return; }
      ImportHelper.showTextExport(deck.name + ' テキスト書出', r.json);
    }));
    _container.appendChild(totalRow);

    // Search panel
    _container.appendChild(CardSearchUI.build({
      filters:  _editFilters,
      onChange: function (newFilters) {
        _editFilters = newFilters;
        var flushed = _collectCurrentCounts();
        Object.keys(flushed).forEach(function (id) { _editCounts[_editZone][id] = flushed[id]; });
        var cards = CardRepository.searchCards(Object.assign({}, _editFilters, { zone: _editZone }));
        var wrap = _container.querySelector('.de-card-list-wrap');
        if (wrap) _renderEditCardList(wrap, cards, _editCounts[_editZone], totalEl);
      },
    }));

    // Card list area
    var cardListWrap = _el('div', { className: 'de-card-list-wrap' });
    _container.appendChild(cardListWrap);
    _renderEditCardList(
      cardListWrap,
      CardRepository.searchCards({ zone: _editZone }),
      _editCounts[_editZone],
      totalEl
    );
    _updateEditTotal(totalEl);
    _updateEditZoneTabsUI();

    // Status message
    var msgEl = _el('p', { className: 'msg', textContent: '' });
    msgEl.style.display = 'none';
    _container.appendChild(msgEl);

    var totalRemoved = removedCount.main + removedCount.hyperspatial + removedCount.superGR;
    if (totalRemoved > 0) {
      _showMsg(msgEl, 'msg--error',
        '登録情報が削除されたカードが ' + totalRemoved + ' 枚ありました。該当カードをデッキから除外しました。');
    }

    // Save button
    var saveBtn = _btn('デッキを保存', 'btn btn--primary de-save-btn', function () {
      var newName = nameInput.value.trim();
      if (!newName) { _showMsg(msgEl, 'msg--error', 'デッキ名を入力してください'); return; }

      var flushed = _collectCurrentCounts();
      Object.keys(flushed).forEach(function (id) { _editCounts[_editZone][id] = flushed[id]; });

      function _toEntries(counts) {
        return Object.keys(counts)
          .filter(function (id) { return (counts[id] || 0) > 0; })
          .map(function (id)    { return { cardId: id, count: counts[id] }; });
      }

      var mainEntries = _toEntries(_editCounts.main);
      var hypEntries  = _toEntries(_editCounts.hyperspatial);
      var grEntries   = _toEntries(_editCounts.superGR);

      if (!mainEntries.length && !hypEntries.length && !grEntries.length) {
        _showMsg(msgEl, 'msg--error', 'カードが選択されていません');
        return;
      }

      var mainTotal = mainEntries.reduce(function (s, e) { return s + e.count; }, 0);
      if (mainTotal !== TARGET_COUNT) {
        var ok = confirm('メインデッキが ' + mainTotal + ' 枚（目標 ' + TARGET_COUNT + ' 枚）です。このまま保存しますか？');
        if (!ok) return;
      }

      var grTotal = grEntries.reduce(function (s, e) { return s + e.count; }, 0);
      if (grTotal !== 0 && grTotal !== 12) {
        var ok2 = confirm('超GRゾーンが ' + grTotal + ' 枚（0 or 12 が正規）です。このまま保存しますか？');
        if (!ok2) return;
      }

      var result = DeckRepository.updateDeck(_editingId, {
        name:              newName,
        cards:             mainEntries,
        hyperspatialCards: hypEntries,
        superGRCards:      grEntries,
      });
      if (!result.ok) { _showMsg(msgEl, 'msg--error', '保存失敗: ' + result.error); return; }

      _showMsg(msgEl, 'msg--success', '保存しました！');
      _container.querySelector('h2').textContent = newName + ' を編集';
    });
    _container.appendChild(saveBtn);
  }

  // ── Edit zone tab row ───────────────────────────────────────────────────────

  function _buildEditZoneTabRow() {
    var row = _el('div', { className: 'zone-tab-row' });
    ZONE_DEFS.forEach(function (zd) {
      var btn = _el('button', { className: 'zone-tab' + (_editZone === zd.id ? ' is-active' : '') });
      var labelSpan = document.createElement('span');
      labelSpan.textContent = zd.jpLabel;
      var badge = document.createElement('span');
      badge.className   = 'zone-tab__count';
      badge.textContent = _editBadgeText(zd);
      btn.appendChild(labelSpan);
      btn.appendChild(badge);
      _zoneBadgeEls[zd.id] = badge;
      _zoneTabBtns[zd.id]  = btn;

      btn.addEventListener('click', function () {
        if (_editZone === zd.id) return;
        // Flush current zone's DOM counts before switching
        var flushed = _collectCurrentCounts();
        Object.keys(flushed).forEach(function (id) { _editCounts[_editZone][id] = flushed[id]; });

        _editZone    = zd.id;
        _editFilters = CardSearchUI.defaultFilters();
        _updateEditZoneTabsUI();

        var totalEl = _container.querySelector('.deck-builder__total');
        _updateEditTotal(totalEl);

        var wrap  = _container.querySelector('.de-card-list-wrap');
        var cards = CardRepository.searchCards({ zone: _editZone });
        if (wrap) _renderEditCardList(wrap, cards, _editCounts[_editZone], totalEl);
      });

      row.appendChild(btn);
    });
    return row;
  }

  function _editBadgeText(zd) {
    var counts = _editCounts[zd.id] || {};
    var total  = Object.keys(counts).reduce(function (s, id) { return s + (counts[id] || 0); }, 0);
    if (zd.id === 'superGR') {
      return total === 0 ? ' ✕' : (total === 12 ? ' ✓' : ' ' + total + '/12');
    }
    return ' ' + total + '/' + zd.max;
  }

  function _updateEditZoneTabsUI() {
    ZONE_DEFS.forEach(function (zd) {
      var btn = _zoneTabBtns[zd.id];
      if (btn) btn.className = 'zone-tab' + (_editZone === zd.id ? ' is-active' : '');
      var badge = _zoneBadgeEls[zd.id];
      if (badge) badge.textContent = _editBadgeText(zd);
    });
  }

  function _updateEditTotal(el) {
    if (!el) return;
    var zd    = ZONE_DEFS.filter(function (z) { return z.id === _editZone; })[0];
    var total = Object.keys(_editCounts[_editZone] || {})
      .reduce(function (s, id) { return s + (_editCounts[_editZone][id] || 0); }, 0);
    var max   = zd ? zd.max : 40;
    var exact = (_editZone === 'superGR') ? (total === 0 || total === 12) : (total === max);
    el.textContent = '合計: ' + total + ' / ' + max + ' 枚';
    el.className   = 'deck-builder__total'
      + (exact && total > 0 ? ' is-valid' : '')
      + (total > max        ? ' is-over'  : '');
  }

  // ── Edit card list ──────────────────────────────────────────────────────────

  function _renderEditCardList(wrap, cards, countsMap, totalEl) {
    wrap.innerHTML = '';

    if (!cards.length) {
      wrap.appendChild(_el('p', { className: 'screen-desc', textContent: 'カードが登録されていません。' }));
      return;
    }

    var list = _el('div', { className: 'deck-builder__card-list' });

    cards.forEach(function (card) {
      var row = document.createElement('div');
      row.className      = 'deck-builder__row cm-card-row';
      row.dataset.cardId = card.id;

      var swatch = _el('div', { className: 'cm-card-swatch' });
      swatch.style.background = _civBackground(_getCardCivs(card));
      row.appendChild(swatch);

      var infoEl = _el('div', { className: 'deck-builder__card-info cm-card-info' });
      infoEl.appendChild(_elText('span', 'deck-builder__card-name cm-card-name', card.name));
      infoEl.appendChild(_elText('span', 'deck-builder__card-civ cm-card-meta', _cardMeta(card)));
      row.appendChild(infoEl);

      var ctrl     = _el('div', { className: 'deck-builder__count-ctrl' });
      var minusBtn = _btn('−', 'btn btn--small', null);
      var countNum = _elText('span', 'deck-builder__count-num', String(countsMap[card.id] || 0));
      var plusBtn  = _btn('＋', 'btn btn--small', null);

      minusBtn.addEventListener('click', function () {
        countsMap[card.id] = Math.max(0, (countsMap[card.id] || 0) - 1);
        countNum.textContent = String(countsMap[card.id]);
        _updateEditTotal(totalEl);
        _updateEditZoneTabsUI();
      });
      plusBtn.addEventListener('click', function () {
        countsMap[card.id] = (countsMap[card.id] || 0) + 1;
        countNum.textContent = String(countsMap[card.id]);
        _updateEditTotal(totalEl);
        _updateEditZoneTabsUI();
      });

      ctrl.appendChild(minusBtn);
      ctrl.appendChild(countNum);
      ctrl.appendChild(plusBtn);
      row.appendChild(ctrl);
      list.appendChild(row);
    });

    wrap.appendChild(list);
  }

  function _collectCurrentCounts() {
    var map  = {};
    var rows = _container.querySelectorAll('.deck-builder__row[data-card-id]');
    rows.forEach(function (row) {
      var numEl  = row.querySelector('.deck-builder__count-num');
      var cardId = row.dataset.cardId;
      if (numEl && cardId) {
        var n = parseInt(numEl.textContent, 10);
        if (n > 0) map[cardId] = n;
      }
    });
    return map;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

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
    if (Array.isArray(card.forms) && card.forms.length > 0) {
      var fMerged = [];
      card.forms.forEach(function (form) {
        [].concat(form.civilization || []).forEach(function (c) {
          if (fMerged.indexOf(c) === -1) fMerged.push(c);
        });
      });
      return fMerged;
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
    } else if (Array.isArray(card.forms) && card.forms.length > 0) {
      var fCosts = card.forms.map(function (f) { return f.cost; }).filter(function (c) { return c != null; });
      if (fCosts.length) parts.push('コスト ' + fCosts.join('/'));
    } else {
      if (card.cost != null) parts.push('コスト ' + card.cost);
    }
    parts.push(card.type || '');
    return parts.filter(Boolean).join(' ・ ');
  }

  function _importResultMsg(result) {
    var s   = result.stats;
    var msg = 'インポート完了: 新規 ' + s.added + ' 枚、更新 ' + s.updated + ' 枚、スキップ ' + s.skipped + ' 枚';
    if (result.deckName) msg += '\nデッキ追加: ' + result.deckName;
    if (result.errors && result.errors.length) msg += '\n警告:\n' + result.errors.join('\n');
    return msg;
  }

  function _showMsg(el, cls, text) {
    el.className     = 'msg ' + cls;
    el.textContent   = text;
    el.style.display = '';
  }

  function _el(tag, props) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) { el[k] = props[k]; });
    return el;
  }

  function _elText(tag, cls, text) {
    var el = _el(tag, cls ? { className: cls } : {});
    el.textContent = text;
    return el;
  }

  function _btn(text, cls, handler) {
    var b = document.createElement('button');
    b.textContent = text;
    b.className   = cls;
    if (handler) b.addEventListener('click', handler);
    return b;
  }

  function showEdit(deckId) {
    var deck = DeckRepository.getDeckById(deckId);
    if (!deck) { alert('デッキが見つかりません'); return; }
    _editingId   = deckId;
    _editZone    = 'main';
    _editCounts  = { main: {}, hyperspatial: {}, superGR: {} };
    _editFilters = CardSearchUI.defaultFilters();
    _renderEdit(deck);
  }

  return { init: init, show: show, showEdit: showEdit };

})();
