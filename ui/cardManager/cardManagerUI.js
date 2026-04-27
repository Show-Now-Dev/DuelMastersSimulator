// ui/cardManager/cardManagerUI.js
//
// Card management screen.
// Provides search / filter, edit (modal), and delete for registered CardDefinitions.
//
// Rules:
//   - No game state access
//   - All card CRUD goes through CardRepository
//   - Edit modal is rendered into #modal-layer (shared, position:fixed overlay)
//   - Twin card editing is not supported — user is directed to re-parse in card editor

var CardManagerUI = (function () {

  var _container  = null;
  var _filters    = CardSearchUI.defaultFilters();
  var _activeZone = 'main';   // currently selected zone tab
  var _sortKey    = 'reg-asc'; // current sort order for the card list

  var CIVS = ['light', 'water', 'darkness', 'fire', 'nature'];
  var CIV_LABELS = {
    light:    '光',
    water:    '水',
    darkness: '闇',
    fire:     '火',
    nature:   '自然',
  };

  // ── Public API ─────────────────────────────────────────────────────────────

  function init(container) {
    _container = container;
  }

  function show() {
    _filters    = CardSearchUI.defaultFilters();
    _activeZone = 'main';
    _sortKey    = 'reg-asc';
    _render();
  }

  // ── Zone tab row ───────────────────────────────────────────────────────────

  function _buildZoneTabs() {
    var zones = [
      { id: 'main',         label: 'メイン' },
      { id: 'hyperspatial', label: '超次元' },
      { id: 'superGR',      label: '超GR'   },
    ];
    var row = _el('div', { className: 'zone-tab-row' });
    zones.forEach(function (z) {
      var btn = _el('button', {
        className:   'zone-tab' + (_activeZone === z.id ? ' is-active' : ''),
        textContent: z.label,
      });
      btn.addEventListener('click', function () {
        if (_activeZone === z.id) return;
        _activeZone = z.id;
        _filters = CardSearchUI.defaultFilters();
        _sortKey  = 'reg-asc';
        _render();
      });
      row.appendChild(btn);
    });
    return row;
  }

  // ── Main render ────────────────────────────────────────────────────────────

  function _render() {
    _container.innerHTML = '';

    var heading = _el('h2', { textContent: 'カード管理' });
    _container.appendChild(heading);

    // Import / Export buttons
    var ioRow = _el('div', { className: 'cm-io-row' });

    var importBtn = _btn('カード読込（ファイル）', 'btn btn--small', function () {
      ImportHelper.trigger(function (result) {
        if (!result.ok) { alert('インポート失敗: ' + result.error); return; }
        var s = result.stats;
        var msg = 'インポート完了: 新規 ' + s.added + ' 枚、更新 ' + s.updated + ' 枚、スキップ ' + s.skipped + ' 枚';
        if (result.errors && result.errors.length) msg += '\n警告:\n' + result.errors.join('\n');
        alert(msg);
        _render();
      });
    });

    var importTextBtn = _btn('カード読込（テキスト）', 'btn btn--small', function () {
      ImportHelper.triggerText(function (result) {
        if (!result.ok) { alert('インポート失敗: ' + result.error); return; }
        var s = result.stats;
        var msg = 'インポート完了: 新規 ' + s.added + ' 枚、更新 ' + s.updated + ' 枚、スキップ ' + s.skipped + ' 枚';
        if (result.errors && result.errors.length) msg += '\n警告:\n' + result.errors.join('\n');
        alert(msg);
        _render();
      });
    });

    var exportBtn = _btn('カード書出（ファイル）', 'btn btn--small', function () {
      var result = DataPorter.exportCards();
      if (!result.ok) { alert('エクスポート失敗: ' + result.error); return; }
    });

    var exportTextBtn = _btn('カード書出（テキスト）', 'btn btn--small', function () {
      var result = DataPorter.getCardsJSON();
      if (!result.ok) { alert('エクスポート失敗: ' + result.error); return; }
      ImportHelper.showTextExport('カード情報 テキスト書出', result.json);
    });

    ioRow.appendChild(importBtn);
    ioRow.appendChild(importTextBtn);
    ioRow.appendChild(exportBtn);
    ioRow.appendChild(exportTextBtn);
    _container.appendChild(ioRow);

    _container.appendChild(CardSearchUI.build({
      filters:  _filters,
      onChange: function (newFilters) {
        _filters = newFilters;
        _renderCardList(_container, CardRepository.searchCards(Object.assign({}, _filters, { zone: _activeZone })));
      },
    }));

    // Zone tabs (below search panel — closer to card list)
    _container.appendChild(_buildZoneTabs());

    _renderCardList(_container, CardRepository.searchCards({ zone: _activeZone }));
  }

  // ── Card list ──────────────────────────────────────────────────────────────

  function _renderCardList(parent, cards) {
    // Accept either _container or the .cm-card-list-wrap directly
    var wrap;
    if (parent.classList && parent.classList.contains('cm-card-list-wrap')) {
      wrap = parent;
    } else {
      wrap = parent.querySelector('.cm-card-list-wrap');
      if (!wrap) {
        wrap = _el('div', { className: 'cm-card-list-wrap' });
        parent.appendChild(wrap);
      }
    }
    wrap.innerHTML = '';

    // Sort bar: selecting a new order re-renders the list immediately
    wrap.appendChild(_buildSortBar(_sortKey, function (key) {
      _sortKey = key;
      _renderCardList(
        _container,
        CardRepository.searchCards(Object.assign({}, _filters, { zone: _activeZone }))
      );
    }));

    if (!cards.length) {
      wrap.appendChild(_el('p', { className: 'screen-desc', textContent: '該当するカードがありません。' }));
      return;
    }

    var sorted = _sortCards(cards, _sortKey);
    var list = _el('div', { className: 'cm-card-list' });
    sorted.forEach(function (card) { list.appendChild(_buildCardRow(card)); });
    wrap.appendChild(list);
  }

  function _buildCardRow(card) {
    var civs = _getCardCivs(card);

    var row = _el('div', { className: 'cm-card-row' });

    // Color swatch
    var swatch = _el('div', { className: 'cm-card-swatch' });
    swatch.style.background = _civBackground(civs);
    row.appendChild(swatch);

    // Info
    var info = _el('div', { className: 'cm-card-info' });
    var nameEl = _el('span', { className: 'cm-card-name', textContent: card.name });
    var metaEl = _el('span', {
      className: 'cm-card-meta',
      textContent: _cardMeta(card),
    });
    info.appendChild(nameEl);
    info.appendChild(metaEl);
    row.appendChild(info);

    // Actions
    var actions = _el('div', { className: 'cm-card-actions' });

    var editBtn = _btn('編集', 'btn btn--small', function () {
      _openEditModal(card);
    });
    var deleteBtn = _btn('削除', 'btn btn--small btn--danger', function () {
      if (!confirm('"' + card.name + '" を削除しますか？')) return;
      var result = CardRepository.deleteCard(card.id);
      if (!result.ok) { alert('削除失敗: ' + result.error); return; }
      _refreshList();
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    row.appendChild(actions);

    return row;
  }

  // ── Edit modal ─────────────────────────────────────────────────────────────

  function _openEditModal(card) {
    var layer = document.getElementById('modal-layer');
    if (!layer) return;

    layer.innerHTML = '';
    layer.classList.add('is-open');

    var panel = _el('div', { className: 'modal-panel cm-edit-modal' });

    // Header
    var header = _el('div', { className: 'modal-header' });
    header.appendChild(_el('span', { className: 'modal-title', textContent: 'カードを編集' }));
    var closeBtn = _btn('✕', 'modal-close-btn', _closeModal);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Body
    var body = _el('div', { className: 'cm-edit-body' });

    if (card.type === 'twin') {
      (card.sides || []).forEach(function (side, i) {
        var section = _el('div', { className: 'cm-edit-side-section' });
        section.dataset.twinSide = String(i);
        section.appendChild(_el('div', {
          className:   'cm-edit-side-label',
          textContent: i === 0 ? '▲ 上面' : '▼ 下面',
        }));
        _buildSideFields(section, side);
        body.appendChild(section);
      });
      panel.appendChild(body);

      var errEl = _el('p', { className: 'msg msg--error', textContent: '' });
      errEl.style.display = 'none';
      panel.appendChild(errEl);

      var footer = _el('div', { className: 'modal-footer' });
      footer.appendChild(_btn('保存', 'modal-confirm-btn', function () {
        var patch = _collectPatch(panel, card);
        var result = CardRepository.updateCard(card.id, patch);
        if (!result.ok) {
          errEl.textContent = result.error;
          errEl.style.display = '';
          return;
        }
        _closeModal();
        _refreshList();
      }));
      panel.appendChild(footer);
      layer.appendChild(panel);
      return;
    }

    if (Array.isArray(card.forms) && card.forms.length > 0) {
      // Multi-form card: one section per form with per-form reading field
      card.forms.forEach(function (form, i) {
        var section = _el('div', { className: 'cm-edit-side-section' });
        section.dataset.formIndex = String(i);
        section.appendChild(_el('div', {
          className:   'cm-edit-side-label',
          textContent: '面' + (i + 1),
        }));
        _buildSideFields(section, form);
        body.appendChild(section);
      });
    } else {
      // Simple card: all fields in the body directly
      _buildSideFields(body, card);
    }

    panel.appendChild(body);

    // Error area
    var errEl = _el('p', { className: 'msg msg--error', textContent: '' });
    errEl.style.display = 'none';
    panel.appendChild(errEl);

    // Footer
    var footer = _el('div', { className: 'modal-footer' });
    var saveBtn = _btn('保存', 'modal-confirm-btn', function () {
      var patch = _collectPatch(panel, card);
      var result = CardRepository.updateCard(card.id, patch);
      if (!result.ok) {
        errEl.textContent = result.error;
        errEl.style.display = '';
        return;
      }
      _closeModal();
      _refreshList();
    });
    footer.appendChild(saveBtn);
    panel.appendChild(footer);

    layer.appendChild(panel);
  }

  // Appends all editable fields for one card face (used for both simple cards and twin sides).
  // container: the DOM element to append rows into.
  // def: the card or side object to read initial values from.
  function _buildSideFields(container, def) {
    // Reading
    container.appendChild(_formRow('読み仮名', function () {
      var inp = _el('input', { type: 'text', className: 'cm-edit-input', value: def.reading || '' });
      inp.dataset.field = 'reading';
      return inp;
    }));

    // Name
    container.appendChild(_formRow('カード名', function () {
      var inp = _el('input', { type: 'text', className: 'cm-edit-input', value: def.name || '' });
      inp.dataset.field = 'name';
      return inp;
    }));

    // Type
    container.appendChild(_formRow('種類', function () {
      var inp = _el('input', { type: 'text', className: 'cm-edit-input', value: def.type || '' });
      inp.dataset.field = 'type';
      return inp;
    }));

    // Civilization
    container.appendChild(_formRow('文明', function () {
      var cardCivs = Array.isArray(def.civilization) ? def.civilization : (def.civilization ? [def.civilization] : []);
      var group = _el('div', { className: 'cm-civ-group', dataset: { field: 'civilization' } });
      CIVS.forEach(function (civ) {
        var lbl = document.createElement('label');
        lbl.className = 'cm-civ-label cm-civ--' + civ;
        var cb = document.createElement('input');
        cb.type    = 'checkbox';
        cb.value   = civ;
        cb.checked = cardCivs.indexOf(civ) !== -1;
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(CIV_LABELS[civ]));
        group.appendChild(lbl);
      });
      return group;
    }));

    // Cost
    container.appendChild(_formRow('コスト', function () {
      return _buildInfInput('cost', def.cost);
    }));

    // Power (creature only)
    if (def.type && def.type.indexOf('クリーチャー') !== -1) {
      container.appendChild(_formRow('パワー', function () {
        return _buildInfInput('power', def.power);
      }));
    }

    // Races
    container.appendChild(_formRow('種族（スラッシュ区切り）', function () {
      var races = Array.isArray(def.races) ? def.races.join(' / ') : (def.race || '');
      var inp = _el('input', { type: 'text', className: 'cm-edit-input', value: races });
      inp.dataset.field = 'races';
      return inp;
    }));

    // Abilities
    container.appendChild(_formRow('テキスト（1行1能力）', function () {
      var ta = document.createElement('textarea');
      ta.className     = 'cm-edit-input cm-edit-textarea';
      ta.rows          = 4;
      ta.dataset.field = 'abilities';
      ta.value = Array.isArray(def.abilities) ? def.abilities.join('\n') : (def.text || '');
      return ta;
    }));
  }

  // Extract all editable field values from a container element into a plain object.
  // Used for both simple cards and individual twin/multi-form side sections.
  function _collectFromContainer(container, base) {
    var result = Object.assign({}, base);

    var readingEl = container.querySelector('[data-field="reading"]');
    if (readingEl) result.reading = readingEl.value.trim() || undefined;

    var nameEl = container.querySelector('[data-field="name"]');
    if (nameEl) result.name = nameEl.value.trim();

    var typeEl = container.querySelector('[data-field="type"]');
    if (typeEl) result.type = typeEl.value.trim();

    var civGroup = container.querySelector('[data-field="civilization"]');
    if (civGroup) {
      result.civilization = Array.prototype.slice.call(civGroup.querySelectorAll('input[type="checkbox"]:checked'))
        .map(function (cb) { return cb.value; });
    }

    var costInfEl = container.querySelector('[data-field="cost-inf"]');
    var costEl    = container.querySelector('[data-field="cost"]');
    if (costInfEl && costInfEl.checked) {
      result.cost = '∞';
    } else if (costEl && costEl.value !== '') {
      result.cost = parseInt(costEl.value, 10);
    }

    var powerInfEl = container.querySelector('[data-field="power-inf"]');
    var powerEl    = container.querySelector('[data-field="power"]');
    if (powerInfEl && powerInfEl.checked) {
      result.power = '∞';
    } else if (powerEl && powerEl.value !== '') {
      result.power = parseInt(powerEl.value, 10);
    }

    var racesEl = container.querySelector('[data-field="races"]');
    if (racesEl) {
      result.races = racesEl.value.split('/').map(function (r) { return r.trim(); }).filter(Boolean);
    }

    var abilitiesEl = container.querySelector('[data-field="abilities"]');
    if (abilitiesEl) {
      result.abilities = abilitiesEl.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    }

    return result;
  }

  // Collect field values from the edit modal panel.
  // card: the original card object (needed to rebuild sides[] / forms[]).
  function _collectPatch(panel, card) {
    // ── Twin: collect per-side ───────────────────────────────────────────────
    if (card.type === 'twin') {
      var updatedSides = (card.sides || []).map(function (side, i) {
        var container = panel.querySelector('[data-twin-side="' + i + '"]');
        return container ? _collectFromContainer(container, side) : side;
      });
      return {
        sides: updatedSides,
        name:  updatedSides.map(function (s) { return s.name || ''; }).filter(Boolean).join(' / '),
      };
    }

    // ── Multi-form: collect per-form, rebuild forms[] ────────────────────────
    if (Array.isArray(card.forms) && card.forms.length > 0) {
      var updatedForms = card.forms.map(function (form, i) {
        var container = panel.querySelector('[data-form-index="' + i + '"]');
        return container ? _collectFromContainer(container, form) : form;
      });
      return {
        forms:   updatedForms,
        reading: updatedForms[0] ? updatedForms[0].reading : undefined,
      };
    }

    // ── Simple card: collect from body directly ──────────────────────────────
    return _collectFromContainer(panel, {});
  }

  function _closeModal() {
    var layer = document.getElementById('modal-layer');
    if (layer) {
      layer.classList.remove('is-open');
      layer.innerHTML = '';
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _refreshList() {
    _renderCardList(
      _container,
      CardRepository.searchCards(Object.assign({}, _filters, { zone: _activeZone }))
    );
  }

  // Builds a number input + ∞ checkbox pair for cost / power fields.
  // fieldName: e.g. 'cost' or 'power'.  currentValue: the stored value (number, '∞', or null).
  // Power can be negative, so no min restriction is applied.
  function _buildInfInput(fieldName, currentValue) {
    var isInf = currentValue === '∞';
    var wrap  = _el('div', { className: 'cm-edit-inf-wrap' });

    var inp = _el('input', { type: 'number', className: 'cm-edit-input cm-edit-input--short' });
    inp.dataset.field = fieldName;
    inp.value         = isInf || currentValue == null ? '' : currentValue;
    inp.disabled      = isInf;

    var infLabel = document.createElement('label');
    infLabel.className = 'cm-edit-inf-label';
    var infCb = document.createElement('input');
    infCb.type            = 'checkbox';
    infCb.dataset.field   = fieldName + '-inf';
    infCb.checked         = isInf;
    infCb.addEventListener('change', function () {
      inp.disabled = infCb.checked;
      if (infCb.checked) inp.value = '';
    });
    infLabel.appendChild(infCb);
    infLabel.appendChild(document.createTextNode(' ∞'));

    wrap.appendChild(inp);
    wrap.appendChild(infLabel);
    return wrap;
  }

  function _formRow(labelText, buildInput) {
    var row = _el('div', { className: 'cm-edit-row' });
    row.appendChild(_el('label', { className: 'cm-edit-label', textContent: labelText }));
    row.appendChild(buildInput());
    return row;
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

  var CIV_COLORS = {
    light: '#eab308', water: '#2563eb', darkness: '#18181b', fire: '#dc2626', nature: '#16a34a',
  };
  var CIV_ORDER = ['light', 'water', 'darkness', 'fire', 'nature'];

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

  // ── Sort helpers ───────────────────────────────────────────────────────────

  // Returns a sorted copy of cards[]. key: 'reg-asc' | 'reg-desc' | 'name-asc' | ... etc.
  function _sortCards(cards, key) {
    if (!key || key === 'reg-asc')  return cards.slice();
    if (key  === 'reg-desc')        return cards.slice().reverse();
    var sorted = cards.slice();
    var parts  = key.split('-');
    var field  = parts[0]; // 'name' | 'cost' | 'power'
    var dir    = parts[1]; // 'asc' | 'desc'
    sorted.sort(function (a, b) {
      if (field === 'name') {
        var an = (a.name || '').toLowerCase();
        var bn = (b.name || '').toLowerCase();
        return dir === 'asc' ? an.localeCompare(bn, 'ja') : bn.localeCompare(an, 'ja');
      }
      var av = _cardSortValue(a, field);
      var bv = _cardSortValue(b, field);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;   // null を末尾へ
      if (bv === null) return -1;
      return dir === 'asc' ? av - bv : bv - av;
    });
    return sorted;
  }

  // Extracts a numeric value for sorting (handles twin / multi-form cards).
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

  // Builds the sort dropdown bar element.
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

  function _el(tag, props) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === 'dataset') {
          Object.keys(props[k]).forEach(function (dk) { el.dataset[dk] = props[k][dk]; });
        } else {
          el[k] = props[k];
        }
      });
    }
    return el;
  }

  function _btn(text, cls, handler) {
    var b = document.createElement('button');
    b.textContent = text;
    b.className   = cls;
    b.addEventListener('click', handler);
    return b;
  }

  return { init: init, show: show };

})();
