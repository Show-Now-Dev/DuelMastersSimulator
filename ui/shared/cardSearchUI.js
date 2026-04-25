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
//   freeword:            string    — space-separated words
//   freewordMode:        'or'|'and'
//   freewordTargets:     { name: bool, text: bool, race: bool }  — which fields to search
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
      freewordTargets:     { name: true, text: true, race: true },
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
    var filters            = options.filters  || defaultFilters();
    var onChange           = options.onChange || function () {};
    // When true (default): freeword + search/clear buttons are always visible;
    // the remaining filter rows (checkboxes, cost, etc.) start collapsed.
    // Pass alwaysShowFreeword: false to revert to the old fully-collapsed accordion.
    var alwaysShowFreeword = options.alwaysShowFreeword !== false;

    // Back-fill any missing keys so the panel always has a complete state
    if (filters.freeword             == null) filters.freeword            = '';
    if (filters.freewordMode         == null) filters.freewordMode        = 'or';
    if (!filters.freewordTargets)             filters.freewordTargets     = { name: true, text: true, race: true };
    if (!filters.colorMode)                   filters.colorMode           = { mono: true, multi: true };
    if (!filters.civilization)                filters.civilization        = [];
    if (!filters.excludeCivilization)         filters.excludeCivilization = [];
    if (filters.includeTwin          == null) filters.includeTwin         = true;

    var panel = _el('div', { className: 'cm-search-panel' });

    // ── Accordion header ──────────────────────────────────────────────────────
    // In alwaysShowFreeword mode, the header label changes to "詳細条件" and
    // the collapsible starts closed (freeword+buttons remain always visible).
    var accordionHeader = _el('div', { className: 'cm-search-accordion-header' });
    accordionHeader.appendChild(_el('span', {
      className:   'cm-search-accordion-label',
      textContent: alwaysShowFreeword ? '詳細条件' : '絞り込み',
    }));
    var accordionToggle = _el('button', {
      type:      'button',
      className: 'cm-search-accordion-toggle',
      textContent: '▼',
    });
    accordionHeader.appendChild(accordionToggle);

    // ── Collapsible content ───────────────────────────────────────────────────
    var collapsible = _el('div', {
      className: 'cm-search-collapsible' + (alwaysShowFreeword ? ' is-collapsed' : ''),
    });

    accordionToggle.addEventListener('click', function () {
      var isOpen = !collapsible.classList.contains('is-collapsed');
      collapsible.classList.toggle('is-collapsed', isOpen);
      accordionToggle.textContent = isOpen ? '▲' : '▼';
    });

    // ── Row 1: Free-word ─────────────────────────────────────────────────────
    var freewordRow = _el('div', { className: 'cm-search-row' });
    freewordRow.appendChild(_el('label', { className: 'cm-search-label', textContent: 'フリーワード:' }));

    var wordInput = _el('input', {
      type:        'text',
      className:   'cm-search-input cm-search-input--wide',
      placeholder: 'スペース区切りで複数ワード',
      value:       filters.freeword || '',
    });
    freewordRow.appendChild(wordInput);

    var orAndPill = _el('div', { className: 'cm-or-and-pill' });
    orAndPill.dataset.mode = filters.freewordMode || 'or';
    var orSeg  = _el('span', { className: 'cm-or-and-pill__seg cm-or-and-pill__seg--or',  textContent: 'OR'  });
    var andSeg = _el('span', { className: 'cm-or-and-pill__seg cm-or-and-pill__seg--and', textContent: 'AND' });
    orAndPill.appendChild(orSeg);
    orAndPill.appendChild(andSeg);
    orAndPill.addEventListener('click', function () {
      filters.freewordMode = (filters.freewordMode === 'or') ? 'and' : 'or';
      orAndPill.dataset.mode = filters.freewordMode;
    });
    freewordRow.appendChild(orAndPill);
    // In alwaysShowFreeword mode: freeword row is pinned above the detail accordion.
    // In normal mode: freeword row is the first row inside the collapsible.
    if (alwaysShowFreeword) {
      panel.appendChild(freewordRow);    // always-visible freeword
      panel.appendChild(accordionHeader); // "詳細条件 ▼" below it
    } else {
      panel.appendChild(accordionHeader); // "絞り込み ▼" at top
      collapsible.appendChild(freewordRow);
    }

    // ── Row 1b: Freeword target checkboxes ───────────────────────────────────
    var targetRow  = _el('div', { className: 'cm-search-row cm-search-row--sub' });
    var tgtGroup   = _el('div', { className: 'cm-civ-group' });
    var tgt        = filters.freewordTargets;

    var nameLbl = document.createElement('label');
    nameLbl.className = 'cm-civ-label cm-target-label';
    var nameCbT = document.createElement('input');
    nameCbT.type    = 'checkbox';
    nameCbT.checked = tgt.name !== false;
    nameLbl.appendChild(nameCbT);
    nameLbl.appendChild(document.createTextNode('カード名'));
    tgtGroup.appendChild(nameLbl);

    var textLbl = document.createElement('label');
    textLbl.className = 'cm-civ-label cm-target-label';
    var textCbT = document.createElement('input');
    textCbT.type    = 'checkbox';
    textCbT.checked = tgt.text !== false;
    textLbl.appendChild(textCbT);
    textLbl.appendChild(document.createTextNode('テキスト'));
    tgtGroup.appendChild(textLbl);

    var raceLbl = document.createElement('label');
    raceLbl.className = 'cm-civ-label cm-target-label';
    var raceCbT = document.createElement('input');
    raceCbT.type    = 'checkbox';
    raceCbT.checked = tgt.race !== false;
    raceLbl.appendChild(raceCbT);
    raceLbl.appendChild(document.createTextNode('種族'));
    tgtGroup.appendChild(raceLbl);

    targetRow.appendChild(tgtGroup);
    collapsible.appendChild(targetRow);

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
    collapsible.appendChild(colorModeRow);

    // ── Row 3: Civilization include ──────────────────────────────────────────
    var civRow = _el('div', { className: 'cm-search-row cm-civ-row' });
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
    collapsible.appendChild(civRow);

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
    collapsible.appendChild(excludeRow);

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
    collapsible.appendChild(twinRow);

    collapsible.appendChild(costRow);

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
    collapsible.appendChild(powerRow);

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

    // In alwaysShowFreeword mode: buttons are pinned below the collapsible.
    // In normal mode: buttons are the last item inside the collapsible.
    if (alwaysShowFreeword) {
      panel.appendChild(collapsible);
      panel.appendChild(btnRow);
    } else {
      collapsible.appendChild(btnRow);
      panel.appendChild(collapsible);
    }

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
      filters.freeword                 = wordInput.value.trim();
      filters.freewordTargets.name     = nameCbT.checked;
      filters.freewordTargets.text     = textCbT.checked;
      filters.freewordTargets.race     = raceCbT.checked;
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
      orAndPill.dataset.mode = 'or';

      nameCbT.checked = true;
      textCbT.checked = true;
      raceCbT.checked = true;
      filters.freewordTargets = { name: true, text: true, race: true };

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
        freewordTargets:     { name: filters.freewordTargets.name, text: filters.freewordTargets.text, race: filters.freewordTargets.race },
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
