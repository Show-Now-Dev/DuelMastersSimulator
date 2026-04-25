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
        var results = CardRepository.searchCards(Object.assign({}, _filters, { zone: _activeZone }));
        var wrap = _container.querySelector('.cm-card-list-wrap');
        if (wrap) { wrap.innerHTML = ''; _renderCardList(wrap, results); }
      },
    }));

    // Zone tabs (below search panel — closer to card list)
    _container.appendChild(_buildZoneTabs());

    _renderCardList(_container, CardRepository.searchCards({ zone: _activeZone }));
  }

  // ── Card list ──────────────────────────────────────────────────────────────

  function _renderCardList(parent, cards) {
    var wrap = parent.querySelector('.cm-card-list-wrap');
    if (!wrap) {
      wrap = _el('div', { className: 'cm-card-list-wrap' });
      parent.appendChild(wrap);
    }
    wrap.innerHTML = '';

    if (!cards.length) {
      wrap.appendChild(_el('p', { className: 'screen-desc', textContent: '該当するカードがありません。' }));
      return;
    }

    var list = _el('div', { className: 'cm-card-list' });
    cards.forEach(function (card) {
      list.appendChild(_buildCardRow(card));
    });
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
      body.appendChild(_el('p', {
        className: 'screen-desc',
        textContent: 'ツインパクトカードの編集は直接対応していません。カード登録画面でテキストを貼り付けて再パースしてください（同名カードは上書き保存されます）。',
      }));
      body.appendChild(_el('p', {
        className: 'screen-desc',
        textContent: '読み仮名を設定する場合は、カード登録テキストの1行目に《上面読み仮名／下面読み仮名》の形式で入力してください。',
      }));
      panel.appendChild(body);
      layer.appendChild(panel);
      return;
    }

    // Name
    body.appendChild(_formRow('カード名', function () {
      var inp = _el('input', { type: 'text', className: 'cm-edit-input', value: card.name || '' });
      inp.dataset.field = 'name';
      return inp;
    }));

    // Reading (読み仮名) — single field for simple cards; per-form for multi-form cards
    if (Array.isArray(card.forms) && card.forms.length > 0) {
      card.forms.forEach(function (form, i) {
        body.appendChild(_formRow('面' + (i + 1) + ' 読み仮名', function () {
          var inp = _el('input', { type: 'text', className: 'cm-edit-input', value: form.reading || '' });
          inp.dataset.field = 'form-reading-' + i;
          return inp;
        }));
      });
    } else {
      body.appendChild(_formRow('読み仮名', function () {
        var inp = _el('input', { type: 'text', className: 'cm-edit-input', value: card.reading || '' });
        inp.dataset.field = 'reading';
        return inp;
      }));
    }

    // Type
    body.appendChild(_formRow('種類', function () {
      var inp = _el('input', { type: 'text', className: 'cm-edit-input', value: card.type || '' });
      inp.dataset.field = 'type';
      return inp;
    }));

    // Civilization (checkboxes)
    body.appendChild(_formRow('文明', function () {
      var cardCivs = Array.isArray(card.civilization) ? card.civilization : (card.civilization ? [card.civilization] : []);
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
    body.appendChild(_formRow('コスト', function () {
      return _buildInfInput('cost', card.cost);
    }));

    // Power (creature only — matches any subtype containing "クリーチャー")
    if (card.type && card.type.indexOf('クリーチャー') !== -1) {
      body.appendChild(_formRow('パワー', function () {
        return _buildInfInput('power', card.power);
      }));
    }

    // Races
    body.appendChild(_formRow('種族（スラッシュ区切り）', function () {
      var races = Array.isArray(card.races) ? card.races.join(' / ') : (card.race || '');
      var inp = _el('input', { type: 'text', className: 'cm-edit-input', value: races });
      inp.dataset.field = 'races';
      return inp;
    }));

    // Abilities
    body.appendChild(_formRow('テキスト（1行1能力）', function () {
      var ta = document.createElement('textarea');
      ta.className   = 'cm-edit-input cm-edit-textarea';
      ta.rows        = 5;
      ta.dataset.field = 'abilities';
      ta.value = Array.isArray(card.abilities) ? card.abilities.join('\n') : (card.text || '');
      return ta;
    }));

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

  // Collect field values from the edit modal panel.
  // card: the original card object (needed to rebuild forms[] for multi-form cards).
  function _collectPatch(panel, card) {
    var patch = {};

    var nameEl = panel.querySelector('[data-field="name"]');
    if (nameEl) patch.name = nameEl.value.trim();

    var typeEl = panel.querySelector('[data-field="type"]');
    if (typeEl) patch.type = typeEl.value;

    var civGroup = panel.querySelector('[data-field="civilization"]');
    if (civGroup) {
      patch.civilization = Array.prototype.slice.call(civGroup.querySelectorAll('input[type="checkbox"]:checked'))
        .map(function (cb) { return cb.value; });
    }

    var costInfEl = panel.querySelector('[data-field="cost-inf"]');
    var costEl    = panel.querySelector('[data-field="cost"]');
    if (costInfEl && costInfEl.checked) {
      patch.cost = '∞';
    } else if (costEl && costEl.value !== '') {
      patch.cost = parseInt(costEl.value, 10);
    }

    var powerInfEl = panel.querySelector('[data-field="power-inf"]');
    var powerEl    = panel.querySelector('[data-field="power"]');
    if (powerInfEl && powerInfEl.checked) {
      patch.power = '∞';
    } else if (powerEl && powerEl.value !== '') {
      patch.power = parseInt(powerEl.value, 10);
    }

    var racesEl = panel.querySelector('[data-field="races"]');
    if (racesEl) {
      patch.races = racesEl.value.split('/').map(function (r) { return r.trim(); }).filter(Boolean);
    }

    var abilitiesEl = panel.querySelector('[data-field="abilities"]');
    if (abilitiesEl) {
      patch.abilities = abilitiesEl.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    }

    // Reading — simple card: single field; multi-form card: per-form fields rebuild forms[]
    if (Array.isArray(card.forms) && card.forms.length > 0) {
      var updatedForms = card.forms.map(function (form, i) {
        var el = panel.querySelector('[data-field="form-reading-' + i + '"]');
        if (!el) return form;
        var val = el.value.trim();
        return Object.assign({}, form, val ? { reading: val } : { reading: undefined });
      });
      patch.forms   = updatedForms;
      // Also sync top-level reading to form[0]'s reading (mirrors addCard behavior)
      patch.reading = updatedForms[0].reading || undefined;
    } else {
      var readingEl = panel.querySelector('[data-field="reading"]');
      if (readingEl) {
        var rVal = readingEl.value.trim();
        patch.reading = rVal || undefined;
      }
    }

    return patch;
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
    var q = {};
    if (_filters.name)               q.name         = _filters.name;
    if (_filters.civilization.length) q.civilization = _filters.civilization;
    var results = Object.keys(q).length ? CardRepository.searchCards(q) : CardRepository.getAllCards();
    var listContainer = _container.querySelector('.cm-card-list-wrap');
    if (listContainer) {
      listContainer.innerHTML = '';
      _renderCardList(listContainer, results);
    }
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
