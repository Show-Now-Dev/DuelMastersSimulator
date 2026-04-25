// ui/shared/deckVisualPanel.js
//
// Shared deck visual panel: grid of card-like slots.
// Shows the current zone's adopted cards sorted by cost → civilization.
//
// Slot interaction:
//   click (no drag)       → open card detail modal with count control
//   drag up (deltaY < -8) → increment count +1
//   drag down (deltaY > 8)→ decrement count -1
//
// Usage:
//   var panel = DeckVisualPanel.build({
//     getZone:       function () { return _activeZone; },
//     getCounts:     function () { return _countsByZone[_activeZone]; },
//     getCards:      function () { return _allCards; },
//     onDecrement:   function (cardId) { /* decrement + refresh everything */ },
//     onIncrement:   function (cardId) { /* increment + refresh everything */ },
//     getMaxForCard: function (cardId) { return 4; /* zone same-name max */ },
//   });
//   container.appendChild(panel.el);
//   // call panel.refresh() whenever counts change
//
// Main-zone slot expansion rule:
//   Standard = 40 slots. If total > 40, show ceil((total-40)/5)*5 extra slots.
//   Extension slots (41+) use a distinct accent-outlined style.

var DeckVisualPanel = (function () {

  var CIV_COLORS = {
    light:    '#eab308',
    water:    '#2563eb',
    darkness: '#18181b',
    fire:     '#dc2626',
    nature:   '#16a34a',
  };
  var CIV_ORDER = ['light', 'water', 'darkness', 'fire', 'nature'];

  var CIV_LABELS = { light:'光', water:'水', darkness:'闇', fire:'火', nature:'自然' };
  var TYPE_LABELS = {
    creature:     'クリーチャー',
    spell:        '呪文',
    evolution:    '進化クリーチャー',
    'cross-gear': 'クロスギア',
    fortres:      '城',
    unknown:      '不明',
  };

  // Column counts per zone
  var ZONE_COLS = { main: 8, hyperspatial: 8, superGR: 6 };
  // Standard (reference) max per zone
  var ZONE_STD  = { main: 40, hyperspatial: 8, superGR: 12 };

  // How many slots to display for the main zone given a total count.
  function _mainSlotCount(total) {
    if (total <= 40) return 40;
    return 40 + Math.ceil((total - 40) / 5) * 5;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  function build(opts) {
    var getZone       = opts.getZone;
    var getCounts     = opts.getCounts;
    var getCards      = opts.getCards;
    var onDecrement   = opts.onDecrement   || function () {};
    var onIncrement   = opts.onIncrement   || function () {};
    var getMaxForCard = opts.getMaxForCard || function () { return 4; };
    var startOpen     = !!opts.startOpen;

    // ── Panel shell ───────────────────────────────────────────────────────────
    var panel = _el('div', { className: 'dvp-panel' });

    // Header: title + count badge + toggle
    var header    = _el('div', { className: 'dvp-header' });
    var titleEl   = _el('span', { className: 'dvp-title', textContent: 'デッキ構成' });
    var countEl   = _el('span', { className: 'dvp-count' });
    var toggleBtn = _el('button', { type: 'button', className: 'dvp-toggle', textContent: startOpen ? '▲' : '▼' });
    header.appendChild(titleEl);
    header.appendChild(countEl);
    header.appendChild(toggleBtn);
    panel.appendChild(header);

    // Grid wrapper — default state controlled by startOpen
    var gridWrap = _el('div', { className: 'dvp-grid-wrap' + (startOpen ? '' : ' is-collapsed') });
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
      } else {
        if (total === std)    cls += ' is-valid';
        else if (total > std) cls += ' is-over';
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
          slot = _buildFilledSlot(
            byId[cardId], isExt, cardId,
            getCounts, getMaxForCard,
            onDecrement, onIncrement, refresh
          );
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

  function _buildFilledSlot(card, isExt, cardId, getCounts, getMaxForCard, onDecrement, onIncrement, refresh) {
    var isTwin = card && card.type === 'twin';

    var slot = _el('div', {
      className: 'dvp-slot dvp-slot--filled' + (isExt ? ' dvp-slot--ext-filled' : ''),
    });

    if (isTwin) {
      _buildTwinSlotContent(slot, card);
    } else {
      _buildNormalSlotContent(slot, card);
    }

    // ── Drag-or-click detection ─────────────────────────────────────────────
    //
    // PC (mouse): mouseup is tracked at document level so cross-slot drag
    // is still detected correctly even when released over a different element.
    //
    // Mobile (touch): touchmove calls preventDefault() to suppress page scroll
    // while the user is interacting with a slot.
    //
    // Threshold: |deltaY| < 8px → click (open modal), else increment/decrement.

    var startY = 0;

    function _act(delta) {
      if (Math.abs(delta) < 8) {
        _openCardModal(card, cardId, getCounts, getMaxForCard, onDecrement, onIncrement, refresh);
      } else if (delta < 0) {
        onIncrement(cardId);
      } else {
        onDecrement(cardId);
      }
    }

    // ── Mouse (desktop) ──────────────────────────────────────────────────────
    slot.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;  // left button only
      startY = e.clientY;
      e.preventDefault();          // prevent text-selection during drag

      function onDocMouseUp(ev) {
        document.removeEventListener('mouseup', onDocMouseUp);
        _act(ev.clientY - startY);
      }
      document.addEventListener('mouseup', onDocMouseUp);
    });

    // ── Touch (mobile) ───────────────────────────────────────────────────────
    slot.addEventListener('touchstart', function (e) {
      if (e.touches.length) startY = e.touches[0].clientY;
    }, { passive: true });

    // Block page scroll while the finger is on a slot
    slot.addEventListener('touchmove', function (e) {
      e.preventDefault();
    }, { passive: false });

    slot.addEventListener('touchend', function (e) {
      if (e.changedTouches.length) _act(e.changedTouches[0].clientY - startY);
    });

    return slot;
  }

  function _buildNormalSlotContent(slot, card) {
    var civs = _getCardCivs(card);
    slot.style.background = _civBackground(civs);
    slot.title = card.name;

    // Top row: cost + name
    var topRow = _el('div', { className: 'dvp-slot-top' });
    var costTxt = _costText(card);
    if (costTxt !== '') {
      topRow.appendChild(_el('span', { className: 'dvp-slot-cost', textContent: costTxt }));
    }
    topRow.appendChild(_el('span', { className: 'dvp-slot-name', textContent: card.name }));
    slot.appendChild(topRow);

    // Power at bottom-left
    var power = _getPower(card);
    if (power != null) {
      var powerEl = _el('div', { className: 'dvp-slot-power', textContent: String(power) });
      slot.appendChild(powerEl);
    }
  }

  function _buildTwinSlotContent(slot, card) {
    slot.classList.add('dvp-slot--twin');
    slot.title = card.name;

    var sides = card.sides || [];
    sides.forEach(function (side, i) {
      var sideCivs = Array.isArray(side.civilization)
        ? side.civilization
        : (side.civilization ? [side.civilization] : []);
      var half = _el('div', {
        className: 'dvp-slot-half dvp-slot-half--' + (i === 0 ? 'top' : 'bottom'),
      });
      half.style.background = _civBackground(sideCivs);

      var topRow = _el('div', { className: 'dvp-slot-top' });
      if (side.cost != null) {
        topRow.appendChild(_el('span', { className: 'dvp-slot-cost', textContent: String(side.cost) }));
      }
      topRow.appendChild(_el('span', { className: 'dvp-slot-name', textContent: side.name || '' }));
      half.appendChild(topRow);

      if (side.power != null) {
        half.appendChild(_el('div', { className: 'dvp-slot-power', textContent: String(side.power) }));
      }

      slot.appendChild(half);
    });
  }

  // ── Card detail modal ────────────────────────────────────────────────────────

  function _openCardModal(card, cardId, getCounts, getMaxForCard, onDecrement, onIncrement, refreshPanel) {
    var layer = document.getElementById('modal-layer');
    if (!layer) return;

    layer.innerHTML = '';
    layer.classList.add('is-open');

    var overlay = _el('div', { className: 'dvp-modal-overlay' });

    // ── Close on backdrop click ───────────────────────────────────────────────
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) _closeModal(layer);
    });

    var panel = _el('div', { className: 'dvp-modal-panel' });

    // ── Close button ──────────────────────────────────────────────────────────
    var closeBtn = _el('button', { className: 'dvp-modal-close', textContent: '✕' });
    closeBtn.addEventListener('click', function () { _closeModal(layer); });
    panel.appendChild(closeBtn);

    // ── Card preview ──────────────────────────────────────────────────────────
    var preview = _buildCardPreview(card);
    panel.appendChild(preview);

    // ── Card details ──────────────────────────────────────────────────────────
    var details = _buildCardDetails(card);
    panel.appendChild(details);

    // ── Count control ─────────────────────────────────────────────────────────
    var ctrl = _el('div', { className: 'dvp-modal-ctrl' });

    var minusBtn = _el('button', { className: 'dvp-modal-ctrl__btn', textContent: '−' });
    var countEl  = _el('span',  { className: 'dvp-modal-ctrl__count' });
    var plusBtn  = _el('button', { className: 'dvp-modal-ctrl__btn', textContent: '＋' });

    function _updateCountDisplay() {
      var cur = (getCounts()[cardId] || 0);
      var max = getMaxForCard(cardId);
      countEl.textContent = cur + ' / ' + max + '枚';
      minusBtn.disabled = (cur <= 0);
      plusBtn.disabled  = (cur >= max);
    }
    _updateCountDisplay();

    minusBtn.addEventListener('click', function () {
      onDecrement(cardId);
      refreshPanel();
      _updateCountDisplay();
    });
    plusBtn.addEventListener('click', function () {
      onIncrement(cardId);
      refreshPanel();
      _updateCountDisplay();
    });

    ctrl.appendChild(minusBtn);
    ctrl.appendChild(countEl);
    ctrl.appendChild(plusBtn);
    panel.appendChild(ctrl);

    overlay.appendChild(panel);
    layer.appendChild(overlay);
  }

  function _closeModal(layer) {
    if (!layer) return;
    layer.classList.remove('is-open');
    layer.innerHTML = '';
  }

  // ── Card preview (mini card face) ────────────────────────────────────────────

  function _buildCardPreview(card) {
    var wrap = _el('div', { className: 'dvp-modal-preview' });
    var isTwin = card && card.type === 'twin';

    if (isTwin) {
      wrap.classList.add('dvp-modal-preview--twin');
      var sides = card.sides || [];
      sides.forEach(function (side, i) {
        var sideCivs = Array.isArray(side.civilization)
          ? side.civilization
          : (side.civilization ? [side.civilization] : []);
        var half = _el('div', {
          className: 'dvp-modal-half dvp-modal-half--' + (i === 0 ? 'top' : 'bottom'),
        });
        half.style.background = _civBackground(sideCivs);

        var topRow = _el('div', { className: 'dvp-modal-top-row' });
        if (side.cost != null) {
          topRow.appendChild(_el('span', { className: 'dvp-modal-cost', textContent: String(side.cost) }));
        }
        topRow.appendChild(_el('span', { className: 'dvp-modal-name', textContent: side.name || '' }));
        half.appendChild(topRow);

        if (side.power != null) {
          half.appendChild(_el('div', { className: 'dvp-modal-power', textContent: String(side.power) }));
        }
        wrap.appendChild(half);
      });
    } else {
      var civs = _getCardCivs(card);
      wrap.style.background = _civBackground(civs);

      var topRow2 = _el('div', { className: 'dvp-modal-top-row' });
      var costTxt = _costText(card);
      if (costTxt !== '') {
        topRow2.appendChild(_el('span', { className: 'dvp-modal-cost', textContent: costTxt }));
      }
      topRow2.appendChild(_el('span', { className: 'dvp-modal-name', textContent: card.name || '' }));
      wrap.appendChild(topRow2);

      var power = _getPower(card);
      if (power != null) {
        wrap.appendChild(_el('div', { className: 'dvp-modal-power', textContent: String(power) }));
      }
    }

    return wrap;
  }

  // ── Card details (text info below preview) ───────────────────────────────────

  function _buildCardDetails(card) {
    var isTwin = card && card.type === 'twin';
    var wrap = _el('div', { className: 'dvp-modal-details' });

    function _row(label, value) {
      if (!value && value !== 0) return;
      var row = _el('div', { className: 'dvp-modal-detail-row' });
      row.appendChild(_el('span', { className: 'dvp-modal-detail-label', textContent: label }));
      row.appendChild(_el('span', { className: 'dvp-modal-detail-value', textContent: String(value) }));
      wrap.appendChild(row);
    }

    if (isTwin) {
      var sides = card.sides || [];
      sides.forEach(function (side, i) {
        var label = i === 0 ? '上面' : '下面';
        var sideCivs = Array.isArray(side.civilization)
          ? side.civilization
          : (side.civilization ? [side.civilization] : []);
        var civStr = sideCivs.map(function (c) { return CIV_LABELS[c] || c; }).join('/');

        var divider = _el('div', { className: 'dvp-modal-side-label', textContent: '── ' + label });
        wrap.appendChild(divider);
        _row('文明', civStr || '無色');
        _row('コスト', side.cost);
        if (side.type) _row('種類', TYPE_LABELS[side.type] || side.type);
        if (side.races && side.races.length) _row('種族', side.races.join(' / '));
        if (side.power != null) _row('パワー', side.power);
        if (side.abilities && side.abilities.length) {
          var abRow = _el('div', { className: 'dvp-modal-detail-row dvp-modal-detail-row--block' });
          abRow.appendChild(_el('span', { className: 'dvp-modal-detail-label', textContent: 'テキスト' }));
          var abText = _el('span', { className: 'dvp-modal-detail-value dvp-modal-abilities' });
          abText.textContent = side.abilities.join('\n');
          abRow.appendChild(abText);
          wrap.appendChild(abRow);
        }
      });
    } else {
      var civs2  = _getCardCivs(card);
      var civStr2 = civs2.map(function (c) { return CIV_LABELS[c] || c; }).join('/');
      _row('文明', civStr2 || '無色');
      _row('コスト', _costText(card));
      if (card.type) _row('種類', TYPE_LABELS[card.type] || card.type);
      if (card.races && card.races.length) _row('種族', card.races.join(' / '));
      var pwr = _getPower(card);
      if (pwr != null) _row('パワー', pwr);
      if (card.abilities && card.abilities.length) {
        var abRow2 = _el('div', { className: 'dvp-modal-detail-row dvp-modal-detail-row--block' });
        abRow2.appendChild(_el('span', { className: 'dvp-modal-detail-label', textContent: 'テキスト' }));
        var abText2 = _el('span', { className: 'dvp-modal-abilities' });
        abText2.textContent = card.abilities.join('\n');
        abRow2.appendChild(abText2);
        wrap.appendChild(abRow2);
      }
    }

    return wrap;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function _getPower(card) {
    if (!card) return null;
    if (card.power != null) return card.power;
    if (card.type === 'twin') {
      // Show top-face power for normal display
      var top = (card.sides || [])[0];
      return top && top.power != null ? top.power : null;
    }
    if (Array.isArray(card.forms) && card.forms.length) {
      return card.forms[0].power != null ? card.forms[0].power : null;
    }
    return null;
  }

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
