// ui/zoneRenderer.js
//
// Renders zones, the card detail panel, and the modal overlay.
// Receives all state as parameters — never reads from stores directly.
//
// Depends on (globals):
//   CardRenderer       — ui/cardRenderer.js
//   getCardDefinition  — model/CardDefinition.js
//   ZONE_IDS           — model/Zone.js
//
// Public API:
//
//   ZoneRenderer.renderZone(container, gameState, zone, peekedCardIds, config)
//     config: {
//       stackedZoneIds:       string[]    — zones that open modal on click (not individually selectable)
//       targetStackId:        string|null — currently targeted stack for merge (highlighted)
//       isPickingTargetStack: boolean     — whether pick-target mode is active
//       onCardClick:          function(info) — called on every card button click
//         info: { cardId, stackId, zone, stack, isTopCard, isStacked, stackSize, isPickingTargetStack }
//     }
//
//   ZoneRenderer.renderCardDetail(container, gameState, peekedCardIds)
//     Renders full card definition for the most-recently selected face-up card.
//
//   ZoneRenderer.renderModal(container, gameState, uiSt, callbacks)
//     callbacks: {
//       onClose:          function()
//       onCardClick:      function(cardId)
//       onToggleFace:     function(selectedCardIds)
//       onMove:           function(selectedCardIds, zoneId, position, label)
//       onPeek:           function(selectedCardIds)
//       onConfirm:        function(selectedCardIds)
//       onSelectAll:      function(allCardIds)
//       onClearSelection: function()
//       parseMoveTarget:  function(value) → { zoneId, position }
//     }

var ZoneRenderer = (function () {

  // ── Civilization name map (Japanese) ─────────────────────────────────────────
  var CIV_NAMES_JP = {
    light:    "光文明",
    water:    "水文明",
    darkness: "闇文明",
    fire:     "火文明",
    nature:   "自然文明",
  };

  // ── Internal helpers ─────────────────────────────────────────────────────────

  // Read --card-w CSS variable; fall back to 80px.
  function _getCardWidth() {
    var raw = getComputedStyle(document.documentElement).getPropertyValue("--card-w").trim();
    return parseFloat(raw) || 80;
  }

  // Return card with isFaceDown overridden to false when the card is being peeked.
  // Game state is never mutated.
  function _applyPeek(card, peekedCardIds) {
    if (peekedCardIds && peekedCardIds.indexOf(card.id) !== -1) {
      return Object.assign({}, card, { isFaceDown: false });
    }
    return card;
  }

  // ── Zone rendering ───────────────────────────────────────────────────────────

  function renderZone(container, gameState, zone, peekedCardIds, config) {
    container.innerHTML = "";

    var stacks               = gameState.stacks || {};
    var stackIds             = zone.stackIds    || [];
    var selectedIds          = gameState.selectedCardIds || [];
    var stackedZoneIds       = config.stackedZoneIds       || [];
    var targetStackId        = config.targetStackId        || null;
    var isPickingTargetStack = config.isPickingTargetStack || false;
    var onCardClick          = config.onCardClick;
    var isStacked            = stackedZoneIds.indexOf(zone.id) !== -1;

    // ── Header ──────────────────────────────────────────────────────────────────
    var headerEl = document.createElement("div");
    headerEl.className = "zone-header";

    var titleEl = document.createElement("div");
    titleEl.className   = "zone-title";
    titleEl.textContent = zone.name;

    var countEl = document.createElement("div");
    countEl.className = "zone-count";
    var totalCards = stackIds.reduce(function (sum, sid) {
      var s = stacks[sid];
      return sum + (s ? s.cardIds.length : 0);
    }, 0);
    countEl.textContent = totalCards + " cards";

    headerEl.appendChild(titleEl);
    headerEl.appendChild(countEl);

    // ── Card list ────────────────────────────────────────────────────────────────
    var listEl = document.createElement("div");
    listEl.className      = "card-list";
    listEl.dataset.zoneId = zone.id;

    container.appendChild(headerEl);
    container.appendChild(listEl);

    // Compute horizontal spacing so stacks fit inside the container.
    var cardWidth      = _getCardWidth();
    var stackCount     = stackIds.length;
    var containerWidth = listEl.clientWidth || container.clientWidth || 0;

    var stackSpacing = 0;
    if (stackCount > 1 && containerWidth > 0) {
      var maxFit = (containerWidth - cardWidth) / (stackCount - 1);
      stackSpacing = Math.max(0, Math.min(cardWidth + 4, maxFit));
    }
    if (container.classList.contains("compact-zone")) {
      stackSpacing = 0;
    }

    var DEPTH_OFFSET = Math.max(2, Math.round(cardWidth * 0.04));

    stackIds.forEach(function (stackId, stackIdx) {
      var stack = stacks[stackId];
      if (!stack) return;

      var stackLeft  = stackSpacing * stackIdx;
      var stackSize  = stack.cardIds.length;
      var isTarget   = stackId === targetStackId;
      var stackBaseZ = (stackCount - stackIdx) * 100;

      stack.cardIds.forEach(function (cardId, cardIdx) {
        var card = gameState.cards[cardId];
        if (!card) return;

        var depth     = stackSize - 1 - cardIdx; // 0 = top card
        var isTopCard = (depth === 0);

        var cardEl  = document.createElement("button");
        cardEl.type = "button";

        var cls = "card";
        if (!isStacked && selectedIds.indexOf(cardId) !== -1) cls += " is-selected";
        if (stack.isTapped)                                    cls += " is-tapped";
        if (isTarget)                                          cls += " is-target-stack";
        cardEl.className = cls;

        cardEl.style.zIndex = String(stackBaseZ + cardIdx);
        cardEl.style.left   = (stackLeft + depth) + "px";
        cardEl.style.top    = (depth * DEPTH_OFFSET) + "px";

        CardRenderer.appendFace(cardEl, _applyPeek(card, peekedCardIds));

        cardEl.addEventListener("click", function (e) {
          e.stopPropagation();
          if (onCardClick) {
            onCardClick({
              cardId:               cardId,
              stackId:              stackId,
              zone:                 zone,
              stack:                stack,
              isTopCard:            isTopCard,
              isStacked:            isStacked,
              stackSize:            stackSize,
              isPickingTargetStack: isPickingTargetStack,
            });
          }
        });

        listEl.appendChild(cardEl);
      });

      // Depth badge on multi-card stacks (not shown in stacked zones — count is in header).
      if (stackSize > 1 && !isStacked) {
        var badge       = document.createElement("div");
        badge.className   = "stack-badge";
        badge.textContent = stackSize;
        badge.style.left   = (stackLeft + cardWidth - 26) + "px";
        badge.style.top    = "4px";
        badge.style.zIndex = String(stackBaseZ + stackSize + 1);
        listEl.appendChild(badge);
      }
    });
  }

  // ── Card detail panel ────────────────────────────────────────────────────────
  // Shows the full definition of the most-recently selected face-up card.
  // For twin cards, the panel is split into two halves.

  function renderCardDetail(container, gameState, peekedCardIds) {
    container.innerHTML = "";

    // Find the last face-up card in the selection (most recently added).
    var selectedIds = gameState.selectedCardIds || [];
    var targetCard  = null;
    for (var i = selectedIds.length - 1; i >= 0; i--) {
      var c = gameState.cards[selectedIds[i]];
      if (!c) continue;
      var visible = _applyPeek(c, peekedCardIds);
      if (!visible.isFaceDown) { targetCard = visible; break; }
    }

    if (!targetCard) {
      var ph = document.createElement("div");
      ph.className   = "cd-placeholder";
      ph.textContent = "表向きのカードを選択すると詳細が表示されます";
      container.appendChild(ph);
      return;
    }

    var def = getCardDefinition(targetCard.definitionId);
    if (!def) {
      var ph2 = document.createElement("div");
      ph2.className   = "cd-placeholder";
      ph2.textContent = "カード情報が見つかりません";
      container.appendChild(ph2);
      return;
    }

    if (def.type === "twin") {
      var twinEl = document.createElement("div");
      twinEl.className = "cd-twin";
      (def.sides || []).forEach(function (side) {
        twinEl.appendChild(_buildDetailHalf(side, "cd-twin-half"));
      });
      container.appendChild(twinEl);
    } else {
      container.appendChild(_buildDetailHalf(def));
    }
  }

  // Build one detail section (full card or one side of a twin card).
  function _buildDetailHalf(def, cls) {
    var wrap = document.createElement("div");
    wrap.className = cls || "cd-card";

    // Top row: cost + name.
    var topRow = document.createElement("div");
    topRow.className = "cd-top-row";

    if (def.cost != null) {
      var costEl = document.createElement("span");
      costEl.className   = "cd-cost";
      costEl.textContent = def.cost;
      topRow.appendChild(costEl);
    }

    var nameEl = document.createElement("span");
    nameEl.className   = "cd-name";
    nameEl.textContent = def.name || "—";
    topRow.appendChild(nameEl);
    wrap.appendChild(topRow);

    // Type / race row.
    var meta  = [];
    if (def.type) meta.push(def.type);
    var races = Array.isArray(def.races) ? def.races : (def.race ? [def.race] : []);
    if (races.length) meta.push(races.join(" / "));
    if (meta.length) {
      var typeRow = document.createElement("div");
      typeRow.className   = "cd-type-row";
      typeRow.textContent = meta.join("  ·  ");
      wrap.appendChild(typeRow);
    }

    // Abilities (scrollable).
    var abilities = Array.isArray(def.abilities) ? def.abilities : (def.text ? [def.text] : []);
    if (abilities.length) {
      var abilitiesEl = document.createElement("div");
      abilitiesEl.className = "cd-abilities";
      abilities.forEach(function (line) {
        var p = document.createElement("div");
        p.className   = "cd-ability-line";
        p.textContent = line;
        abilitiesEl.appendChild(p);
      });
      wrap.appendChild(abilitiesEl);
    } else {
      // Spacer keeps power pinned to the bottom even with no abilities.
      var spacer = document.createElement("div");
      spacer.className = "cd-abilities";
      wrap.appendChild(spacer);
    }

    // Power.
    if (def.power != null) {
      var powerEl = document.createElement("div");
      powerEl.className   = "cd-power";
      powerEl.textContent = def.power.toLocaleString();
      wrap.appendChild(powerEl);
    }

    return wrap;
  }

  // ── Modal rendering ──────────────────────────────────────────────────────────
  // The modal layer is rebuilt from scratch on every render call.

  function renderModal(container, gameState, uiSt, callbacks) {
    var modal = uiSt.modal;

    if (!modal) {
      container.classList.remove("is-open");
      container.innerHTML = "";
      return;
    }

    if (modal.type === "CARD_SELECTOR") {
      _renderCardSelectorModal(container, gameState, modal, uiSt.peekedCardIds, callbacks);
    } else if (modal.type === "CARD_DETAIL") {
      _renderCardDetailModal(container, modal, callbacks);
    }

    container.classList.add("is-open");
  }

  // Returns an ordered array of cardIds to display in the modal (top-first).
  // Returns null if the source stack no longer exists.
  function _getModalCardIds(gameState, modal) {
    var source = modal.source;

    if (source.type === "stack") {
      var stack = gameState.stacks[source.id];
      if (!stack) return null; // source was destroyed while modal was open
      // cardIds stored bottom→top; reverse so index 0 = top of stack.
      return stack.cardIds.slice().reverse();
    }

    if (source.type === "zone") {
      var zone = gameState.zones[source.id];
      if (!zone) return [];
      var ordered = [];
      zone.stackIds.forEach(function (stackId) {
        var s = gameState.stacks[stackId];
        if (!s) return;
        s.cardIds.slice().reverse().forEach(function (cardId) { ordered.push(cardId); });
      });
      return ordered;
    }

    return [];
  }

  // Apply visibility rules: "top-n" hides cards beyond the topN limit.
  function _applyVisibility(card, displayIdx, modal) {
    if (modal.visibility === "top-n") {
      var topN = modal.topN || 3;
      if (displayIdx >= topN) {
        return Object.assign({}, card, { isFaceDown: true });
      }
    }
    return card;
  }

  function _getModalTitle(gameState, modal) {
    var source = modal.source;
    var count  = 0;

    if (source.type === "stack") {
      var stack = gameState.stacks[source.id];
      count = stack ? stack.cardIds.length : 0;
      return "Select cards in stack (" + count + ")";
    }

    if (source.type === "zone") {
      var zone = gameState.zones[source.id];
      if (zone) {
        zone.stackIds.forEach(function (sid) {
          var s = gameState.stacks[sid];
          if (s) count += s.cardIds.length;
        });
        return zone.name + " — select cards (" + count + ")";
      }
    }

    return "Select cards";
  }

  function _renderCardSelectorModal(container, gameState, modal, peekedCardIds, cb) {
    var cardIds = _getModalCardIds(gameState, modal);

    // Source stack was destroyed while modal was open — close it next tick.
    if (cardIds === null) {
      container.classList.remove("is-open");
      container.innerHTML = "";
      setTimeout(function () { cb.onClose(); }, 0);
      return;
    }

    container.innerHTML = "";

    var panel = document.createElement("div");
    panel.className = "modal-panel";

    // ── Header ──────────────────────────────────────────────────────────────────
    var header = document.createElement("div");
    header.className = "modal-header";

    var title = document.createElement("span");
    title.className   = "modal-title";
    title.textContent = _getModalTitle(gameState, modal);

    var closeBtn = document.createElement("button");
    closeBtn.className   = "modal-close-btn";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", function () { cb.onClose(); });

    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // ── Card list (top-first) ────────────────────────────────────────────────────
    var cardListEl = document.createElement("div");
    cardListEl.className = "modal-card-list";

    cardIds.forEach(function (cardId, displayIdx) {
      var card = gameState.cards[cardId];
      if (!card) return;

      var isModalSelected = modal.selectedCardIds.indexOf(cardId) !== -1;
      var displayCard     = _applyPeek(_applyVisibility(card, displayIdx, modal), peekedCardIds);

      var cardEl     = document.createElement("button");
      cardEl.type      = "button";
      cardEl.className = "modal-card" + (isModalSelected ? " is-selected" : "");

      CardRenderer.appendFace(cardEl, displayCard);

      // Position label.
      var posLabel       = document.createElement("div");
      posLabel.className   = "modal-card-position";
      posLabel.textContent = displayIdx === 0 ? "Top" : "#" + (displayIdx + 1);
      cardEl.appendChild(posLabel);

      cardEl.addEventListener("click", function () { cb.onCardClick(cardId); });

      cardListEl.appendChild(cardEl);
    });

    panel.appendChild(cardListEl);

    // ── Action bar: face toggle + move ──────────────────────────────────────────
    var actionBar = document.createElement("div");
    actionBar.className = "modal-action-bar";

    var modalFaceBtn       = document.createElement("button");
    modalFaceBtn.textContent = "表向き / 裏向き";
    modalFaceBtn.addEventListener("click", function () {
      cb.onToggleFace(modal.selectedCardIds.slice());
    });
    actionBar.appendChild(modalFaceBtn);

    var modalMoveSelect = document.createElement("select");
    modalMoveSelect.className = "modal-move-select";
    // Options are derived from ZONE_DEFINITIONS — no hardcoded list here.
    ZONE_DEFINITIONS.forEach(function (def) {
      def.ui.moveOptions.forEach(function (moveOpt) {
        var opt = document.createElement("option");
        opt.value       = moveOpt.value;
        opt.textContent = moveOpt.label;
        modalMoveSelect.appendChild(opt);
      });
    });
    actionBar.appendChild(modalMoveSelect);

    var modalMoveBtn       = document.createElement("button");
    modalMoveBtn.textContent = "移動";
    modalMoveBtn.addEventListener("click", function () {
      var sel = modal.selectedCardIds.slice();
      if (!sel.length) return;
      var parsed = cb.parseMoveTarget(modalMoveSelect.value);
      if (!parsed.zoneId) return;
      cb.onMove(
        sel,
        parsed.zoneId,
        parsed.position,
        modalMoveSelect.options[modalMoveSelect.selectedIndex].text
      );
    });
    actionBar.appendChild(modalMoveBtn);

    panel.appendChild(actionBar);

    // ── Footer: bulk actions + confirm ──────────────────────────────────────────
    var footer = document.createElement("div");
    footer.className = "modal-footer";

    var selectAllBtn       = document.createElement("button");
    selectAllBtn.textContent = "すべて選択";
    selectAllBtn.addEventListener("click", function () { cb.onSelectAll(cardIds); });

    var clearBtn       = document.createElement("button");
    clearBtn.textContent = "選択解除";
    clearBtn.addEventListener("click", function () { cb.onClearSelection(); });

    // "見る" button: only shown when visibility is "hidden" (deck modal).
    if (modal.visibility === "hidden") {
      var peekBtn       = document.createElement("button");
      peekBtn.textContent = "見る";
      peekBtn.addEventListener("click", function () {
        var sel = modal.selectedCardIds.slice();
        if (sel.length > 0) cb.onPeek(sel);
      });
      footer.appendChild(peekBtn);
    }

    // Confirm: push modal selection into main game selection, then close.
    var confirmBtn       = document.createElement("button");
    confirmBtn.className   = "modal-confirm-btn";
    confirmBtn.textContent = "選択を確定";
    confirmBtn.addEventListener("click", function () {
      cb.onConfirm(modal.selectedCardIds.slice());
    });

    footer.appendChild(selectAllBtn);
    footer.appendChild(clearBtn);
    footer.appendChild(confirmBtn);
    panel.appendChild(footer);

    container.appendChild(panel);
  }

  // ── Card detail modal ────────────────────────────────────────────────────────
  // Triggered by clicking the card-detail-panel.
  // Layout: fixed header (name + civilization + cost) / scrollable body (abilities) / fixed footer (power).
  // Twin cards: two sections side-by-side, each with its own header / body / footer.

  function _buildCardInfoSection(def) {
    var section = document.createElement("div");
    section.className = "cdi-section";

    // Header: name + civilization + cost (always visible)
    var hd = document.createElement("div");
    hd.className = "cdi-header";

    var nameEl = document.createElement("span");
    nameEl.className   = "cdi-name";
    nameEl.textContent = def.name || "—";
    hd.appendChild(nameEl);

    var civs = Array.isArray(def.civilization) ? def.civilization
      : (def.civilization ? [def.civilization] : []);
    if (civs.length) {
      var civEl = document.createElement("span");
      civEl.className   = "cdi-civ";
      civEl.textContent = civs.map(function (c) { return CIV_NAMES_JP[c] || c; }).join(" / ");
      hd.appendChild(civEl);
    }

    if (def.cost != null) {
      var costEl = document.createElement("span");
      costEl.className   = "cdi-cost";
      costEl.textContent = def.cost;
      hd.appendChild(costEl);
    }

    section.appendChild(hd);

    // Body: abilities / card text (scrollable)
    var body = document.createElement("div");
    body.className = "cdi-body";
    var abilities = Array.isArray(def.abilities) ? def.abilities
      : (def.text ? [def.text] : []);
    abilities.forEach(function (line) {
      var p = document.createElement("div");
      p.className   = "cdi-ability-line";
      p.textContent = line;
      body.appendChild(p);
    });
    section.appendChild(body);

    // Footer: power (always visible)
    if (def.power != null) {
      var ft = document.createElement("div");
      ft.className   = "cdi-footer";
      ft.textContent = def.power.toLocaleString();
      section.appendChild(ft);
    }

    return section;
  }

  function _renderCardDetailModal(container, modal, cb) {
    var def = getCardDefinition(modal.definitionId);
    container.innerHTML = "";

    var panel = document.createElement("div");
    panel.className = "modal-panel modal-panel--card-detail";

    // Close button bar
    var closeBar = document.createElement("div");
    closeBar.className = "cdi-close-bar";
    var closeBtn = document.createElement("button");
    closeBtn.className   = "modal-close-btn";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", function () { cb.onClose(); });
    closeBar.appendChild(closeBtn);
    panel.appendChild(closeBar);

    if (!def) {
      var err = document.createElement("div");
      err.className   = "cd-placeholder";
      err.textContent = "カード情報が見つかりません";
      panel.appendChild(err);
      container.appendChild(panel);
      return;
    }

    if (def.type === "twin") {
      var twinWrap = document.createElement("div");
      twinWrap.className = "cdi-twin";
      (def.sides || []).forEach(function (side) {
        twinWrap.appendChild(_buildCardInfoSection(side));
      });
      panel.appendChild(twinWrap);
    } else {
      panel.appendChild(_buildCardInfoSection(def));
    }

    container.appendChild(panel);
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  return {
    renderZone:       renderZone,
    renderCardDetail: renderCardDetail,
    renderModal:      renderModal,
  };

}());
