// ui/shared/cardSearchUI.js
//
// Shared card search / filter panel builder.
// Returns a DOM element — has no side effects and no module-level state.
//
// Usage:
//   var panel = CardSearchUI.build({
//     filters:  { name: '', civilization: [] },   // initial state (mutated in place)
//     onChange: function (filters) { … }          // called after search or clear
//   });
//   container.appendChild(panel);
//
// Supported filter keys:
//   name           — substring match on card.name (case-insensitive)
//   civilization   — array of civilization strings; card matches if any civ overlaps

var CardSearchUI = (function () {

  var CIVS = ['light', 'water', 'darkness', 'fire', 'nature'];
  var CIV_LABELS = {
    light: '光', water: '水', darkness: '闇', fire: '火', nature: '自然',
  };

  // Build and return a search panel element.
  // options.filters   — initial filter state object (modified in place on search/clear)
  // options.onChange  — function(filters) called when the user applies or clears a search
  function build(options) {
    var filters  = options.filters  || { name: '', civilization: [] };
    var onChange = options.onChange || function () {};

    var panel = _el('div', { className: 'cm-search-panel' });

    // ── Name filter ──────────────────────────────────────────────────────────
    var nameRow = _el('div', { className: 'cm-search-row' });
    nameRow.appendChild(_el('label', { className: 'cm-search-label', textContent: 'カード名:' }));
    var nameInput = _el('input', {
      type:        'text',
      className:   'cm-search-input',
      placeholder: '名前で絞り込み',
      value:       filters.name || '',
    });
    nameRow.appendChild(nameInput);
    panel.appendChild(nameRow);

    // ── Civilization filter ──────────────────────────────────────────────────
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
    civRow.appendChild(civGroup);
    panel.appendChild(civRow);

    // ── Buttons ──────────────────────────────────────────────────────────────
    var searchBtn = document.createElement('button');
    searchBtn.textContent = '検索';
    searchBtn.className   = 'btn';
    searchBtn.addEventListener('click', function () {
      filters.name         = nameInput.value.trim();
      filters.civilization = CIVS.filter(function (c) { return civChecks[c].checked; });
      onChange(Object.assign({}, filters));
    });
    panel.appendChild(searchBtn);

    var clearBtn = document.createElement('button');
    clearBtn.textContent = 'クリア';
    clearBtn.className   = 'btn';
    clearBtn.addEventListener('click', function () {
      filters.name         = '';
      filters.civilization = [];
      nameInput.value = '';
      CIVS.forEach(function (c) { civChecks[c].checked = false; });
      onChange({ name: '', civilization: [] });
    });
    panel.appendChild(clearBtn);

    return panel;
  }

  function _el(tag, props) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) { el[k] = props[k]; });
    return el;
  }

  return { build: build };

}());
