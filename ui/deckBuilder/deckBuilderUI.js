// ui/deckBuilder/deckBuilderUI.js
//
// Deck builder UI module.
// Lets the user select registered cards and quantities, then save a DeckDefinition.
//
// Zones:
//   メイン     — target 40 cards, same-name 4 max
//   超次元     — 0–8 cards, same-name 4 max
//   超GR       — 0 or 12 cards, same-name 2 max

var DeckBuilderUI = (function () {

  var CIV_LABELS = { light:'光', water:'水', darkness:'闇', fire:'火', nature:'自然' };
  var CIV_COLORS = { light:'#eab308', water:'#2563eb', darkness:'#18181b', fire:'#dc2626', nature:'#16a34a' };
  var CIV_ORDER  = ['light','water','darkness','fire','nature'];

  var ZONE_DEFS = [
    { id: 'main',         label: '메인',   jpLabel: 'メイン', max: 40, sameMax: 4, grToggle: false },
    { id: 'hyperspatial', label: '超次元', jpLabel: '超次元', max: 8,  sameMax: 4, grToggle: false },
    { id: 'superGR',      label: '超GR',   jpLabel: '超GR',   max: 12, sameMax: 2, grToggle: true  },
  ];

  var _container      = null;
  var _onSave         = null;
  var _allCards       = [];
  var _countsByZone   = { main: {}, hyperspatial: {}, superGR: {} };
  var _filters        = CardSearchUI.defaultFilters();
  var _activeZone     = 'main';
  var _sortKey        = 'reg-asc'; // current sort order for the card list
  // DOM refs updated each render so zone badge counts can be updated reactively
  var _zoneBadgeEls   = {};
  var _zoneTabBtns    = {};
  var _totalEl        = null;
  var _visualPanel    = null;  // deck visual panel instance

  function init(container, onSave) {
    _container = container;
    _onSave    = onSave;
  }

  function show() {
    _allCards     = CardRepository.getAllCards();
    _countsByZone = { main: {}, hyperspatial: {}, superGR: {} };
    _filters      = CardSearchUI.defaultFilters();
    _activeZone   = 'main';
    _sortKey      = 'reg-asc';
    _render();
  }

  // ── Rendering ────────────────────────────────────────────────────────────────

  function _render() {
    _container.innerHTML = '';
    _zoneBadgeEls = {};
    _zoneTabBtns  = {};

    _container.appendChild(_el('h2', { textContent: 'デッキビルダー' }));

    // Import buttons
    var ioRow = _el('div', { className: 'deck-builder__io-row' });
    function _onDeckImport(result) {
      if (!result.ok) { alert('インポート失敗: ' + result.error); return; }
      var s = result.stats;
      var msg = 'インポート完了: 新規 ' + s.added + ' 枚、更新 ' + s.updated + ' 枚、スキップ ' + s.skipped + ' 枚';
      if (result.deckName) msg += '\nデッキ追加: ' + result.deckName;
      if (result.errors && result.errors.length) msg += '\n警告:\n' + result.errors.join('\n');
      alert(msg);
      show();
    }
    var impFileBtn = _el('button', { className: 'btn btn--small', textContent: 'デッキ読込（ファイル）' });
    impFileBtn.addEventListener('click', function () { ImportHelper.trigger(_onDeckImport); });
    var impTextBtn = _el('button', { className: 'btn btn--small', textContent: 'デッキ読込（テキスト）' });
    impTextBtn.addEventListener('click', function () { ImportHelper.triggerText(_onDeckImport); });
    ioRow.appendChild(impFileBtn);
    ioRow.appendChild(impTextBtn);
    _container.appendChild(ioRow);

    if (!_allCards.length) {
      _container.appendChild(_el('p', {
        className: 'screen-desc',
        textContent: 'カードが登録されていません。先にカード登録画面でカードを追加してください。',
      }));
      return;
    }

    // Deck name
    var nameRow   = _el('div', { className: 'deck-builder__name-row' });
    var nameLabel = _el('label', { textContent: 'デッキ名:' });
    var nameInput = _el('input', { type: 'text', className: 'deck-builder__name-input', placeholder: '新しいデッキ' });
    nameRow.appendChild(nameLabel);
    nameRow.appendChild(nameInput);
    _container.appendChild(nameRow);

    // Deck visual panel
    _visualPanel = DeckVisualPanel.build({
      startOpen:     true,
      getZone:       function () { return _activeZone; },
      getCounts:     function () { return _countsByZone[_activeZone]; },
      getCards:      function () { return _allCards; },
      onDecrement:   function (cardId) {
        var counts = _countsByZone[_activeZone];
        counts[cardId] = Math.max(0, (counts[cardId] || 0) - 1);
        _updateTotal();
        _updateZoneTabsUI();
        _refreshCardList();
      },
      onIncrement:   function (cardId) {
        var counts = _countsByZone[_activeZone];
        counts[cardId] = (counts[cardId] || 0) + 1;
        _updateTotal();
        _updateZoneTabsUI();
        _refreshCardList();
      },
      getMaxForCard: function () {
        var zd = ZONE_DEFS.filter(function (z) { return z.id === _activeZone; })[0];
        return zd ? zd.sameMax : 4;
      },
    });
    _container.appendChild(_visualPanel.el);

    // Search panel
    _container.appendChild(CardSearchUI.build({
      filters:  _filters,
      onChange: function (newFilters) {
        _filters = newFilters;
        _refreshCardList();
      },
    }));

    // Zone tabs (below search panel — closer to card list)
    _container.appendChild(_buildZoneTabRow());

    // Zone total counter
    _totalEl = _el('div', { className: 'deck-builder__total' });
    _container.appendChild(_totalEl);
    _updateTotal();

    // Card list wrapper
    var listWrap = _el('div', { className: 'deck-builder__list-wrap' });
    _container.appendChild(listWrap);
    _renderCardList(listWrap);

    // Save button
    var saveBtn = _el('button', { className: 'btn btn--primary deck-builder__save-btn', textContent: 'デッキを保存' });
    saveBtn.addEventListener('click', function () {
      if (!_validateBeforeSave()) return;

      var deckName = nameInput.value.trim() || '新しいデッキ';

      function _toEntries(counts) {
        return Object.keys(counts)
          .filter(function (id) { return counts[id] > 0; })
          .map(function (id)    { return { cardId: id, count: counts[id] }; });
      }

      var def = createDeckDefinition(
        '',
        deckName,
        _toEntries(_countsByZone.main),
        _toEntries(_countsByZone.hyperspatial),
        _toEntries(_countsByZone.superGR)
      );

      var result = DeckRepository.addDeck(def);
      if (!result.ok) { alert('保存失敗: ' + result.error); return; }

      var deck = DeckRepository.getDeckById(result.id);
      if (_onSave) _onSave(deck);
      alert('デッキを保存しました: ' + deckName);
      _countsByZone = { main: {}, hyperspatial: {}, superGR: {} };
      show();
    });
    _container.appendChild(saveBtn);
  }

  // ── Zone tab row ──────────────────────────────────────────────────────────────

  function _buildZoneTabRow() {
    var row = _el('div', { className: 'zone-tab-row' });
    ZONE_DEFS.forEach(function (zd) {
      var btn = _el('button', { className: 'zone-tab' + (_activeZone === zd.id ? ' is-active' : '') });
      var labelSpan = _elText('span', '', zd.jpLabel);
      var badge     = _elText('span', 'zone-tab__count', _badgeText(zd.id));
      btn.appendChild(labelSpan);
      btn.appendChild(badge);
      _zoneBadgeEls[zd.id] = badge;
      _zoneTabBtns[zd.id]  = btn;
      btn.addEventListener('click', function () {
        if (_activeZone === zd.id) return;
        _activeZone = zd.id;
        _filters    = CardSearchUI.defaultFilters();
        _sortKey    = 'reg-asc';
        _updateZoneTabsUI();
        _updateTotal();
        _refreshCardList();
      });
      row.appendChild(btn);
    });
    return row;
  }

  function _updateZoneTabsUI() {
    ZONE_DEFS.forEach(function (zd) {
      var btn = _zoneTabBtns[zd.id];
      if (btn) btn.className = 'zone-tab' + (_activeZone === zd.id ? ' is-active' : '');
      var badge = _zoneBadgeEls[zd.id];
      if (badge) badge.textContent = _badgeText(zd.id);
    });
  }

  function _badgeText(zoneId) {
    var zd     = ZONE_DEFS.filter(function (z) { return z.id === zoneId; })[0];
    var counts = _countsByZone[zoneId] || {};
    var total  = Object.keys(counts).reduce(function (s, id) { return s + (counts[id] || 0); }, 0);
    if (zoneId === 'superGR') {
      return total === 0 ? ' ✕' : (total === 12 ? ' ✓' : ' ' + total + '/12');
    }
    return ' ' + total + '/' + zd.max;
  }

  // ── Card list ─────────────────────────────────────────────────────────────────

  function _renderCardList(wrap) {
    wrap.innerHTML = '';
    var cards = CardRepository.searchCards(Object.assign({}, _filters, { zone: _activeZone }));

    // Sort bar: selecting a new order re-renders the list immediately
    wrap.appendChild(_buildSortBar(_sortKey, function (key) {
      _sortKey = key;
      _renderCardList(wrap);
    }));

    if (!cards.length) {
      wrap.appendChild(_el('p', { className: 'screen-desc', textContent: '該当するカードがありません。' }));
      return;
    }

    var sorted = _sortCards(cards, _sortKey);
    var list   = _el('div', { className: 'deck-builder__card-list' });
    var counts = _countsByZone[_activeZone];

    sorted.forEach(function (card) {
      var row     = _el('div', { className: 'deck-builder__row cm-card-row' });
      var swatch  = _el('div', { className: 'cm-card-swatch' });
      swatch.style.background = _civBackground(_getCardCivs(card));
      row.appendChild(swatch);

      var infoEl = _el('div', { className: 'deck-builder__card-info cm-card-info' });
      infoEl.appendChild(_elText('span', 'deck-builder__card-name cm-card-name', card.name));
      infoEl.appendChild(_elText('span', 'deck-builder__card-civ cm-card-meta', _cardMeta(card)));
      row.appendChild(infoEl);

      var ctrl     = _el('div', { className: 'deck-builder__count-ctrl' });
      var minusBtn = _elBtn('−', 'btn btn--small');
      var countNum = _elText('span', 'deck-builder__count-num', String(counts[card.id] || 0));
      var plusBtn  = _elBtn('＋', 'btn btn--small');

      minusBtn.addEventListener('click', function () {
        counts[card.id] = Math.max(0, (counts[card.id] || 0) - 1);
        countNum.textContent = String(counts[card.id]);
        _updateTotal();
        _updateZoneTabsUI();
      });
      plusBtn.addEventListener('click', function () {
        counts[card.id] = (counts[card.id] || 0) + 1;
        countNum.textContent = String(counts[card.id]);
        _updateTotal();
        _updateZoneTabsUI();
      });

      ctrl.appendChild(minusBtn);
      ctrl.appendChild(countNum);
      ctrl.appendChild(plusBtn);
      row.appendChild(ctrl);
      list.appendChild(row);
    });

    wrap.appendChild(list);
  }

  function _refreshCardList() {
    var wrap = _container.querySelector('.deck-builder__list-wrap');
    if (wrap) _renderCardList(wrap);
  }

  // ── Validation ────────────────────────────────────────────────────────────────

  function _zoneTotal(zoneId) {
    var counts = _countsByZone[zoneId] || {};
    return Object.keys(counts).reduce(function (s, id) { return s + (counts[id] || 0); }, 0);
  }

  function _validateBeforeSave() {
    var mainTotal = _zoneTotal('main');
    if (mainTotal === 0) {
      alert('メインデッキにカードが入っていません。');
      return false;
    }
    if (mainTotal < 40) {
      if (!confirm('メインデッキが ' + mainTotal + ' 枚（目標 40 枚）です。このまま保存しますか？')) return false;
    } else if (mainTotal > 40) {
      if (!confirm('メインデッキが 40 枚を超えています（現在: ' + mainTotal + ' 枚）。\n特殊ルールカードによる枚数増加として保存しますか？')) return false;
    }
    var hypTotal = _zoneTotal('hyperspatial');
    if (hypTotal > 8) {
      alert('超次元ゾーンは最大8枚です（現在: ' + hypTotal + ' 枚）');
      return false;
    }
    var grTotal = _zoneTotal('superGR');
    if (grTotal !== 0 && grTotal !== 12) {
      if (!confirm('超GRゾーンが ' + grTotal + ' 枚（0 または 12 枚が正規）です。このまま保存しますか？')) return false;
    }
    return true;
  }

  // ── Total display ─────────────────────────────────────────────────────────────

  function _updateTotal() {
    if (!_totalEl) return;
    var zd    = ZONE_DEFS.filter(function (z) { return z.id === _activeZone; })[0];
    var total = _zoneTotal(_activeZone);
    var max   = zd ? zd.max : 40;
    var over  = total > max;
    var exact = (_activeZone === 'superGR') ? (total === 0 || total === 12) : (total === max);

    _totalEl.textContent = '合計: ' + total + ' / ' + max + ' 枚';
    _totalEl.className   = 'deck-builder__total'
      + (exact && total > 0 ? ' is-valid' : '')
      + (over              ? ' is-over'  : '');

    if (_visualPanel) _visualPanel.refresh();
  }

  // ── Sort helpers ──────────────────────────────────────────────────────────────

  function _sortCards(cards, key) {
    if (!key || key === 'reg-asc')  return cards.slice();
    if (key  === 'reg-desc')        return cards.slice().reverse();
    var sorted = cards.slice();
    var parts  = key.split('-');
    var field  = parts[0];
    var dir    = parts[1];
    sorted.sort(function (a, b) {
      if (field === 'name') {
        var an = (a.name || '').toLowerCase();
        var bn = (b.name || '').toLowerCase();
        return dir === 'asc' ? an.localeCompare(bn, 'ja') : bn.localeCompare(an, 'ja');
      }
      var av = _cardSortValue(a, field);
      var bv = _cardSortValue(b, field);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return dir === 'asc' ? av - bv : bv - av;
    });
    return sorted;
  }

  function _cardSortValue(card, field) {
    var raw;
    if (card.type === 'twin' && card.sides && card.sides[0]) {
      raw = card.sides[0][field];
    } else if (Array.isArray(card.forms) && card.forms.length > 0) {
      raw = card.forms[0][field];
    } else {
      raw = card[field];
    }
    if (raw == null || raw === '∞') return null;
    var n = parseInt(raw, 10);
    return isNaN(n) ? null : n;
  }

  function _buildSortBar(currentKey, onChange) {
    var bar = _el('div', { className: 'cm-sort-bar' });
    bar.appendChild(_el('label', { className: 'cm-sort-label', textContent: '並び替え:' }));
    var sel = document.createElement('select');
    sel.className = 'cm-sort-select';
    [
      { value: 'reg-asc',    label: '登録順（昇順）'   },
      { value: 'reg-desc',   label: '登録順（降順）'   },
      { value: 'name-asc',   label: 'カード名（昇順）' },
      { value: 'name-desc',  label: 'カード名（降順）' },
      { value: 'cost-asc',   label: 'コスト（昇順）'   },
      { value: 'cost-desc',  label: 'コスト（降順）'   },
      { value: 'power-asc',  label: 'パワー（昇順）'   },
      { value: 'power-desc', label: 'パワー（降順）'   },
    ].forEach(function (opt) {
      var o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === currentKey) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () { onChange(sel.value); });
    bar.appendChild(sel);
    return bar;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

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

  function _elBtn(text, cls) {
    var b = document.createElement('button');
    b.textContent = text;
    b.className   = cls;
    return b;
  }

  return { init: init, show: show };

})();
