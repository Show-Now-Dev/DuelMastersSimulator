// ui/shared/deckVisualPanel.js
//
// Shared deck visual panel: 8-column grid of coloured card slots.
// Shows the current zone's adopted cards sorted by cost → civilization.
// Clicking a filled slot decrements that card's count by 1.
//
// Usage:
//   var panel = DeckVisualPanel.build({
//     getZone:     function () { return _activeZone; },
//     getCounts:   function () { return _countsByZone[_activeZone]; },
//     getCards:    function () { return _allCards; },
//     onDecrement: function (cardId) { /* decrement + refresh everything */ },
//   });
//   container.appendChild(panel.el);
//   // call panel.refresh() whenever counts change
//
// Main-zone slot expansion rule:
//   Standard = 40 slots.  If total > 40, show ceil((total-40)/5)*5 extra slots.
//   Extension slots (41+) use a distinct accent-outlined style.
//   Saving with > 40 cards shows a confirmation dialog (handled by callers).

var DeckVisualPanel = (function () {

  var CIV_COLORS = {
    light:    '#eab308',
    water:    '#2563eb',
    darkness: '#18181b',
    fire:     '#dc2626',
    nature:   '#16a34a',
  };
  var CIV_ORDER = ['light', 'water', 'darkness', 'fire', 'nature'];

  // Column counts per zone
  var ZONE_COLS = { main: 8, hyperspatial: 8, superGR: 6 };
  // Standard (reference) max per zone
  var ZONE_STD  = { main: 40, hyperspatial: 8, superGR: 12 };

  // How many slots to display for the main zone given a total count.
  // Stays at 40 below the threshold; expands in increments of 5 above it.
  function _mainSlotCount(total) {
    if (total <= 40) return 40;
    return 40 + Math.ceil((total - 40) / 5) * 5;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  function build(opts) {
    var getZone     = opts.getZone;
    var getCounts   = opts.getCounts;
    var getCards    = opts.getCards;
    var onDecrement = opts.onDecrement || function () {};

    // ── Panel shell ───────────────────────────────────────────────────────────
    var panel = _el('div', { className: 'dvp-panel' });

    // Header: title + count badge + toggle
    var header    = _el('div', { className: 'dvp-header' });
    var titleEl   = _el('span', { className: 'dvp-title', textContent: 'デッキ構成' });
    var countEl   = _el('span', { className: 'dvp-count' });
    var toggleBtn = _el('button', { type: 'button', className: 'dvp-toggle', textContent: '▼' });
    header.appendChild(titleEl);
    header.appendChild(countEl);
    header.appendChild(toggleBtn);
    panel.appendChild(header);

    // Grid wrapper — starts collapsed
    var gridWrap = _el('div', { className: 'dvp-grid-wrap is-collapsed' });
    panel.appendChild(gridWrap);

    toggleBtn.addEventListener('click', function () {
      var closing = !gridWrap.classList.contains('is-collapsed');
      gridWrap.classList.toggle('is-collapsed', closing);
      toggleBtn.textContent = closing ? '▼' : '▲';
    });

    // ── Refresh ───────────────────────────────────────────────────────────────
    function refresh() {
      var zone   = getZone();
      var counts = getCounts();
      var cards  = getCards();
      var std    = ZONE_STD[zone]  || 40;
      var cols   = ZONE_COLS[zone] || 8;

      // Index cards by id for fast lookup
      var byId = {};
      cards.forEach(function (c) { byId[c.id] = c; });

      // Collect adopted card ids, sorted cost → civilization
      var adoptedIds = Object.keys(counts).filter(function (id) {
        return (counts[id] || 0) > 0 && byId[id];
      });
      adoptedIds.sort(function (a, b) {
        var diff = _minCost(byId[a]) - _minCost(byId[b]);
        if (diff !== 0) return diff;
        return _primCivOrder(byId[a]) - _primCivOrder(byId[b]);
      });

      // Expand to one entry per physical copy
      var slots = [];
      adoptedIds.forEach(function (id) {
        var n = counts[id] || 0;
        for (var i = 0; i < n; i++) slots.push(id);
      });

      var total     = slots.length;
      var slotCount = (zone === 'main') ? _mainSlotCount(total) : std;

      // ── Header count ──────────────────────────────────────────────────────
      countEl.textContent = total + ' / ' + std;
      var cls = 'dvp-count';
      if (zone === 'superGR') {
        cls += (total === 0 || total === std) ? ' is-valid' : ' is-over';
      } else if (zone === 'main') {
        if (total === std)       cls += ' is-valid';
        else if (total > std)    cls += ' is-over';
      } else {
        if (total === std)       cls += ' is-valid';
        else if (total > std)    cls += ' is-over';
      }
      countEl.className = cls;

      // ── Grid ─────────────────────────────────────────────────────────────
      gridWrap.innerHTML = '';
      var grid = _el('div', { className: 'dvp-grid' });
      grid.style.setProperty('--dvp-cols', String(cols));

      for (var s = 0; s < slotCount; s++) {
        var cardId = slots[s];   // undefined → empty slot
        var isExt  = s >= std;   // extension territory (main > 40)
        var slot;

        if (cardId) {
          slot = _buildFilledSlot(byId[cardId], isExt, cardId, onDecrement);
        } else {
          slot = _el('div', {
            className: 'dvp-slot ' + (isExt ? 'dvp-slot--ext-empty' : 'dvp-slot--empty'),
          });
        }
        grid.appendChild(slot);
      }

      gridWrap.appendChild(grid);
    }

    refresh();
    return { el: panel, refresh: refresh };
  }

  // ── Slot builder ────────────────────────────────────────────────────────────

  function _buildFilledSlot(card, isExt, cardId, onDecrement) {
    var slot = _el('div', {
      className: 'dvp-slot dvp-slot--filled' + (isExt ? ' dvp-slot--ext-filled' : ''),
      title:     card.name + '（クリックで−1）',
    });
    slot.style.background = _civBackground(_getCardCivs(card));

    var costTxt = _costText(card);
    if (costTxt !== '') {
      slot.appendChild(_el('span', { className: 'dvp-slot-cost', textContent: costTxt }));
    }
    slot.appendChild(_el('span', { className: 'dvp-slot-name', textContent: card.name }));

    slot.addEventListener('click', function () { onDecrement(cardId); });
    return slot;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function _minCost(card) {
    if (!card) return 999;
    if (card.cost === '∞') return 998;
    if (typeof card.cost === 'number') return card.cost;
    if (card.type === 'twin') {
      var tc = (card.sides || []).map(function (s) { return s.cost; })
                                  .filter(function (c) { return typeof c === 'number'; });
      return tc.length ? Math.min.apply(null, tc) : 999;
    }
    if (Array.isArray(card.forms) && card.forms.length) {
      var fc = card.forms.map(function (f) { return f.cost; })
                         .filter(function (c) { return typeof c === 'number'; });
      return fc.length ? Math.min.apply(null, fc) : 999;
    }
    return 999;
  }

  function _costText(card) {
    if (!card) return '';
    if (card.cost === '∞') return '∞';
    if (typeof card.cost === 'number') return String(card.cost);
    if (card.type === 'twin') {
      var tc = (card.sides || []).map(function (s) { return s.cost; })
                                  .filter(function (c) { return c != null; });
      return tc.length ? tc.join('/') : '';
    }
    if (Array.isArray(card.forms) && card.forms.length) {
      var fc = card.forms.map(function (f) { return f.cost; })
                         .filter(function (c) { return c != null; });
      return fc.length ? fc.join('/') : '';
    }
    return '';
  }

  function _primCivOrder(card) {
    var civs = _getCardCivs(card);
    if (!civs.length) return 999;
    var idx = CIV_ORDER.indexOf(civs[0]);
    return idx === -1 ? 999 : idx;
  }

  function _getCardCivs(card) {
    if (!card) return [];
    if (card.type === 'twin') {
      var m = [];
      (card.sides || []).forEach(function (s) {
        [].concat(s.civilization || []).forEach(function (c) {
          if (m.indexOf(c) === -1) m.push(c);
        });
      });
      return m;
    }
    if (Array.isArray(card.forms) && card.forms.length) {
      var fm = [];
      card.forms.forEach(function (f) {
        [].concat(f.civilization || []).forEach(function (c) {
          if (fm.indexOf(c) === -1) fm.push(c);
        });
      });
      return fm;
    }
    if (!card.civilization) return [];
    return Array.isArray(card.civilization) ? card.civilization : [card.civilization];
  }

  function _civBackground(civs) {
    if (!civs || !civs.length) return '#334155';
    var ordered = CIV_ORDER.filter(function (c) { return civs.indexOf(c) !== -1; });
    if (!ordered.length) return '#334155';
    if (ordered.length === 1) return CIV_COLORS[ordered[0]];
    var stops = ordered.map(function (c, i) {
      return CIV_COLORS[c] + ' ' + Math.round(i / (ordered.length - 1) * 100) + '%';
    });
    return 'linear-gradient(135deg, ' + stops.join(', ') + ')';
  }

  function _el(tag, props) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) { el[k] = props[k]; });
    return el;
  }

  return { build: build };

}());
