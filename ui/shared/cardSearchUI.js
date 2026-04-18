// ui/shared/cardSearchUI.js
//
// Shared card search / filter panel builder.
// Returns a DOM element — has no side effects and no module-level state.
//
// Usage:
//   var panel = CardSearchUI.build({
//     filters:  _defaultFilters(),   // initial state (mutated in place on search/clear)
//     onChange: function (filters) { … }  // called when user clicks 検索 or クリア
//   });
//   container.appendChild(panel);
//
// Filter shape:
//   freeword:            string    — space-separated words; matched in name / abilities / races
//   freewordMode:        'or'|'and'
//   colorMode:           { mono: bool, multi: bool }  — both true = no filter
//   civilization:        string[]  — OR match; 'none' = colorless; empty = no constraint
//   excludeCivilization: string[]  — civs whose presence disqualifies a card
//   costMin:             number|null
//   costMax:             number|null
//   includeTwin:         boolean   — false = exclude twin-pact cards
//   powerMin:            number|null
//   powerMax:            number|null
//
// Helper: CardSearchUI.defaultFilters() → fresh default filter object

var CardSearchUI = (function () {

  var CIVS = ['light', 'water', 'darkness', 'fire', 'nature'];
  var CIV_LABELS = {
    light: '光', water: '水', darkness: '闇', fire: '火', nature: '自然',
  };

  function defaultFilters() {
    return {
      freeword:            '',
      freewordMode:        'or',
      colorMode:           { mono: true, multi: true },
      civilization:        [],
      excludeCivilization: [],
      costMin:             null,
      costMax:             null,
      includeTwin:         true,
      powerMin:            null,
      powerMax:            null,
    };
  }

  // Build and return a search panel element.
  function build(options) {
    var filters  = options.filters  || defaultFilters();
    var onChange = options.onChange || function () {};

    // Back-fill any missing keys so the panel always has a complete state
    if (filters.freeword             == null) filters.freeword            = '';
    if (filters.freewordMode         == null) filters.freewordMode        = 'or';
    if (!filters.colorMode)                   filters.colorMode           = { mono: true, multi: true };
    if (!filters.civilization)                filters.civilization        = [];
    if (!filters.excludeCivilization)         filters.excludeCivilization = [];
    if (filters.includeTwin          == null) filters.includeTwin         = true;

    var panel = _el('div', { className: 'cm-search-panel' });

    // ── Row 1: Free-word ─────────────────────────────────────────────────────
    var freewordRow = _el('div', { className: 'cm-search-row' });
    freewordRow.appendChild(_el('label', { className: 'cm-search-label', textContent: 'フリーワード:' }));

    var wordInput = _el('input', {
      type:        'text',
      className:   'cm-search-input cm-search-input--wide',
      placeholder: 'カード名・テキスト・種族（スペース区切り）',
      value:       filters.freeword || '',
    });
    freewordRow.appendChild(wordInput);

    var orBtn = _el('button', {
      className:   'btn btn--small' + (filters.freewordMode !== 'and' ? ' is-active' : ''),
      textContent: 'OR',
      type:        'button',
    });
    var andBtn = _el('button', {
      className:   'btn btn--small' + (filters.freewordMode === 'and' ? ' is-active' : ''),
      textContent: 'AND',
      type:        'button',
    });
    orBtn.addEventListener('click', function () {
      filters.freewordMode = 'or';
      orBtn.classList.add('is-active');
      andBtn.classList.remove('is-active');
    });
    andBtn.addEventListener('click', function () {
      filters.freewordMode = 'and';
      andBtn.classList.add('is-active');
      orBtn.classList.remove('is-active');
    });
    freewordRow.appendChild(orBtn);
    freewordRow.appendChild(andBtn);
    panel.appendChild(freewordRow);

    // ── Row 2: Color mode ────────────────────────────────────────────────────
    var colorModeRow = _el('div', { className: 'cm-search-row' });
    colorModeRow.appendChild(_el('label', { className: 'cm-search-label', textContent: 'カラー:' }));

    var monoLbl = document.createElement('label');
    monoLbl.className = 'cm-civ-label cm-color--mono';
    var monoCb = document.createElement('input');
    monoCb.type    = 'checkbox';
    monoCb.checked = filters.colorMode.mono !== false;
    monoLbl.appendChild(monoCb);
    monoLbl.appendChild(document.createTextNode('単色'));

    var multiLbl = document.createElement('label');
    multiLbl.className = 'cm-civ-label cm-color--multi';
    var multiCb = document.createElement('input');
    multiCb.type    = 'checkbox';
    multiCb.checked = filters.colorMode.multi !== false;
    multiLbl.appendChild(multiCb);
    multiLbl.appendChild(document.createTextNode('多色'));

    colorModeRow.appendChild(monoLbl);
    colorModeRow.appendChild(multiLbl);
    panel.appendChild(colorModeRow);

    // ── Row 3: Civilization include ──────────────────────────────────────────
    var civRow = _el('div', { className: 'cm-search-row' });
    civRow.appendChild(_el('label', { className: 'cm-search-label', textContent: '文明:' }));
    var civGroup = _el('div', { className: 'cm-civ-group' });
    var civChecks = {};
    var activeCivs = filters.civilization || [];

    CIVS.forEach(function (civ) {
      var lbl = document.createElement('label');
      lbl.className = 'cm-civ-label cm-civ--' + civ;
      var cb = document.createElement('input');
      cb.type    = 'checkbox';
      cb.value   = civ;
      cb.checked = activeCivs.indexOf(civ) !== -1;
      civChecks[civ] = cb;
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(CIV_LABELS[civ]));
      civGroup.appendChild(lbl);
    });

    // 無色
    var noneLbl = document.createElement('label');
    noneLbl.className = 'cm-civ-label cm-civ--none';
    var noneCb = document.createElement('input');
    noneCb.type    = 'checkbox';
    noneCb.value   = 'none';
    noneCb.checked = activeCivs.indexOf('none') !== -1;
    civChecks['none'] = noneCb;
    noneLbl.appendChild(noneCb);
    noneLbl.appendChild(document.createTextNode('無色'));
    civGroup.appendChild(noneLbl);

    civRow.appendChild(civGroup);
    panel.appendChild(civRow);

    // ── Row 4: Exclude civilization (shown when multi is checked) ────────────
    var excludeRow = _el('div', { className: 'cm-search-row cm-exclude-row' });
    excludeRow.appendChild(_el('label', { className: 'cm-search-label', textContent: '除外文明:' }));
    var excludeGroup = _el('div', { className: 'cm-civ-group' });
    var excludeChecks = {};
    var excludedCivs = filters.excludeCivilization || [];

    CIVS.forEach(function (civ) {
      var lbl = document.createElement('label');
      lbl.className = 'cm-civ-label cm-civ--' + civ;
      var cb = document.createElement('input');
      cb.type     = 'checkbox';
      cb.value    = civ;
      cb.checked  = excludedCivs.indexOf(civ) !== -1;
      cb.disabled = activeCivs.indexOf(civ) !== -1;
      excludeChecks[civ] = cb;
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(CIV_LABELS[civ]));
      excludeGroup.appendChild(lbl);
    });

    excludeRow.appendChild(excludeGroup);
    excludeRow.style.display = filters.colorMode.multi ? '' : 'none';
    panel.appendChild(excludeRow);

    // ── Row 5: Cost range ────────────────────────────────────────────────────
    var costRow = _el('div', { className: 'cm-search-row' });
    costRow.appendChild(_el('label', { className: 'cm-search-label', textContent: 'コスト:' }));
    var costMinIn = _el('input', {
      type:        'number',
      className:   'cm-range-input',
      placeholder: '0',
      min:         '0',
      value:       filters.costMin != null ? String(filters.costMin) : '',
    });
    costRow.appendChild(costMinIn);
    costRow.appendChild(_el('span', { className: 'cm-range-sep', textContent: '〜' }));
    var costMaxIn = _el('input', {
      type:        'number',
      className:   'cm-range-input',
      placeholder: '∞',
      min:         '0',
      value:       filters.costMax != null ? String(filters.costMax) : '',
    });
    costRow.appendChild(costMaxIn);
    panel.appendChild(costRow);

    // ── Row 6: Twin pact ─────────────────────────────────────────────────────
    var twinRow = _el('div', { className: 'cm-search-row' });
    var twinLbl = document.createElement('label');
    twinLbl.className = 'cm-civ-label cm-twin-label';
    var twinCb = document.createElement('input');
    twinCb.type    = 'checkbox';
    twinCb.checked = filters.includeTwin !== false;
    twinLbl.appendChild(twinCb);
    twinLbl.appendChild(document.createTextNode('ツインパクトを含む'));
    twinRow.appendChild(twinLbl);
    panel.appendChild(twinRow);

    // ── Row 7: Power range ───────────────────────────────────────────────────
    var powerRow = _el('div', { className: 'cm-search-row' });
    powerRow.appendChild(_el('label', { className: 'cm-search-label', textContent: 'パワー:' }));
    var powerMinIn = _el('input', {
      type:        'number',
      className:   'cm-range-input',
      placeholder: '0',
      min:         '0',
      value:       filters.powerMin != null ? String(filters.powerMin) : '',
    });
    powerRow.appendChild(powerMinIn);
    powerRow.appendChild(_el('span', { className: 'cm-range-sep', textContent: '〜' }));
    var powerMaxIn = _el('input', {
      type:        'number',
      className:   'cm-range-input',
      placeholder: '∞',
      min:         '0',
      value:       filters.powerMax != null ? String(filters.powerMax) : '',
    });
    powerRow.appendChild(powerMaxIn);
    panel.appendChild(powerRow);

    // ── Buttons ───────────────────────────────────────────────────────────────
    var btnRow = _el('div', { className: 'cm-search-row' });

    var searchBtn = document.createElement('button');
    searchBtn.textContent = '検索';
    searchBtn.className   = 'btn';
    searchBtn.addEventListener('click', function () {
      _commit();
      onChange(_snapshot());
    });

    var clearBtn = document.createElement('button');
    clearBtn.textContent = 'クリア';
    clearBtn.className   = 'btn';
    clearBtn.addEventListener('click', function () {
      _reset();
      onChange(_snapshot());
    });

    btnRow.appendChild(searchBtn);
    btnRow.appendChild(clearBtn);
    panel.appendChild(btnRow);

    // ── Reactive bindings ─────────────────────────────────────────────────────

    // Show/hide exclude row based on multi checkbox
    multiCb.addEventListener('change', function () {
      excludeRow.style.display = multiCb.checked ? '' : 'none';
      _syncExcludeDisabled();
    });

    // When include-civ changes, sync which exclude checkboxes are disabled
    Object.keys(civChecks).forEach(function (civ) {
      civChecks[civ].addEventListener('change', function () {
        if (civ !== 'none') _syncExcludeDisabled();
      });
    });

    // ── Internal helpers ──────────────────────────────────────────────────────

    // Disable exclude checkboxes that overlap with include checkboxes
    function _syncExcludeDisabled() {
      CIVS.forEach(function (civ) {
        if (!excludeChecks[civ]) return;
        var inInclude = civChecks[civ] && civChecks[civ].checked;
        excludeChecks[civ].disabled = inInclude;
        if (inInclude) excludeChecks[civ].checked = false;
      });
    }

    // Read all DOM inputs into the filters object
    function _commit() {
      filters.freeword        = wordInput.value.trim();
      filters.colorMode.mono  = monoCb.checked;
      filters.colorMode.multi = multiCb.checked;
      filters.civilization    = Object.keys(civChecks).filter(function (c) { return civChecks[c].checked; });
      filters.excludeCivilization = multiCb.checked
        ? CIVS.filter(function (c) { return excludeChecks[c] && excludeChecks[c].checked; })
        : [];
      var cmin = costMinIn.value.trim();
      var cmax = costMaxIn.value.trim();
      filters.costMin     = cmin !== '' ? parseInt(cmin, 10) : null;
      filters.costMax     = cmax !== '' ? parseInt(cmax, 10) : null;
      filters.includeTwin = twinCb.checked;
      var pmin = powerMinIn.value.trim();
      var pmax = powerMaxIn.value.trim();
      filters.powerMin = pmin !== '' ? parseInt(pmin, 10) : null;
      filters.powerMax = pmax !== '' ? parseInt(pmax, 10) : null;
    }

    // Reset all DOM inputs and filter state to defaults
    function _reset() {
      wordInput.value      = '';
      filters.freewordMode = 'or';
      orBtn.classList.add('is-active');
      andBtn.classList.remove('is-active');

      monoCb.checked  = true;
      multiCb.checked = true;

      Object.keys(civChecks).forEach(function (c) { civChecks[c].checked = false; });
      CIVS.forEach(function (c) { if (excludeChecks[c]) excludeChecks[c].checked = false; });

      costMinIn.value  = '';
      costMaxIn.value  = '';
      twinCb.checked   = true;
      powerMinIn.value = '';
      powerMaxIn.value = '';

      excludeRow.style.display = '';
      _syncExcludeDisabled();

      filters.freeword            = '';
      filters.colorMode           = { mono: true, multi: true };
      filters.civilization        = [];
      filters.excludeCivilization = [];
      filters.costMin             = null;
      filters.costMax             = null;
      filters.includeTwin         = true;
      filters.powerMin            = null;
      filters.powerMax            = null;
    }

    // Return a deep snapshot of the current filter state
    function _snapshot() {
      return {
        freeword:            filters.freeword,
        freewordMode:        filters.freewordMode,
        colorMode:           { mono: filters.colorMode.mono, multi: filters.colorMode.multi },
        civilization:        filters.civilization.slice(),
        excludeCivilization: filters.excludeCivilization.slice(),
        costMin:             filters.costMin,
        costMax:             filters.costMax,
        includeTwin:         filters.includeTwin,
        powerMin:            filters.powerMin,
        powerMax:            filters.powerMax,
      };
    }

    return panel;
  }

  function _el(tag, props) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) { el[k] = props[k]; });
    return el;
  }

  return { build: build, defaultFilters: defaultFilters };

}());
