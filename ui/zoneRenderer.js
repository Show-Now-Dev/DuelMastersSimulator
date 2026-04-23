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
//       onDragStart:          function(info) — called when drag begins on a card
//         info: { cardId, stackId, zone, stack, isTopCard, isStacked, isStackedTopCard }
//       onCardDragOver:       function(info) → boolean — called on dragover a card; return true to accept
//         info: { cardId, stackId, zone, stack, isStacked }
//       onCardDrop:           function(info) — called when a card is dropped onto another card
//         info: { cardId, stackId, zone, stack, isStacked }
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

  // ── Form navigation ─────────────────────────────────────────────────────────
  // Adds ◀ and/or ▶ buttons to a card element so the user can cycle forms.
  // Only the buttons that are meaningful (prev/next exists) are rendered.

  function _appendFormNav(cardEl, cardId, formIndex, formCount, onFormSwitch) {
    if (formIndex > 0) {
      var prevBtn = document.createElement("button");
      prevBtn.type      = "button";
      prevBtn.className = "card__form-nav card__form-nav--prev";
      prevBtn.textContent = "◀";
      prevBtn.setAttribute("aria-label", "前の面");
      prevBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        onFormSwitch(cardId, formIndex - 1);
      });
      cardEl.appendChild(prevBtn);
    }
    if (formIndex < formCount - 1) {
      var nextBtn = document.createElement("button");
      nextBtn.type      = "button";
      nextBtn.className = "card__form-nav card__form-nav--next";
      nextBtn.textContent = "▶";
      nextBtn.setAttribute("aria-label", "次の面");
      nextBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        onFormSwitch(cardId, formIndex + 1);
      });
      cardEl.appendChild(nextBtn);
    }
  }

  // ── Zone rendering ───────────────────────────────────────────────────────────

  function renderZone(container, gameState, zone, peekedCardIds, config) {
    container.innerHTML = "";
    // Apply has-drop-panel early so listEl.clientWidth already accounts for the
    // margin-right when card spacing is computed (prevents cards overlapping the panel).
    container.classList.remove("has-drop-panel");
    if (config.hasDropPanel) container.classList.add("has-drop-panel");

    var stacks               = gameState.stacks || {};
    var stackIds             = zone.stackIds    || [];
    var selectedIds          = gameState.selectedCardIds || [];
    var stackedZoneIds       = config.stackedZoneIds       || [];
    var targetStackId        = config.targetStackId        || null;
    var isPickingTargetStack = config.isPickingTargetStack || false;
    var onCardClick          = config.onCardClick;
    var onDragStart          = config.onDragStart;
    var onCardDragOver       = config.onCardDragOver;
    var onCardDrop           = config.onCardDrop;
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

    // Centred "+" hint — visible behind cards, no pointer-events.
    if (config.hasCenterPlus) {
      var cpEl = document.createElement("div");
      cpEl.className   = "zone-center-plus";
      cpEl.textContent = "+";
      container.appendChild(cpEl);
    }

    // Compute horizontal positions accounting for linked groups (wider than cardWidth).
    var cardWidth      = _getCardWidth();
    var stackCount     = stackIds.length;
    var containerWidth = listEl.clientWidth || container.clientWidth || 0;
    var isCompact      = container.classList.contains("compact-zone");

    // Effective width of each stack (linked groups span multiple card-widths).
    var effectiveWidths = stackIds.map(function (sid) {
      var s = stacks[sid];
      if (!s || !s.isLinked || !s.linkSlots) return cardWidth;
      var nc = 0;
      s.linkSlots.forEach(function (sl) { if (sl.col + 1 > nc) nc = sl.col + 1; });
      return nc * cardWidth;
    });

    // Compute left positions: scale cumulative widths to fit the container.
    // The last stack always renders at full size; everything before it may compress.
    var stackPositions = [];
    if (isCompact || stackCount === 0) {
      stackPositions = stackIds.map(function () { return 0; });
    } else if (stackCount === 1) {
      stackPositions = [0];
    } else {
      var totalEffW = effectiveWidths.reduce(function (sum, w) { return sum + w; }, 0);
      var lastW     = effectiveWidths[effectiveWidths.length - 1];
      // Available horizontal space before the last stack starts.
      var available = containerWidth > 0 ? containerWidth - lastW : 0;
      var prefixW   = totalEffW - lastW; // total width of all stacks except last
      var scale     = (available > 0 && prefixW > available) ? available / prefixW : 1;
      scale = Math.max(0, Math.min(1, scale));

      var cumW = 0;
      effectiveWidths.forEach(function (w) {
        stackPositions.push(Math.round(cumW * scale));
        cumW += w;
      });
    }

    // DEPTH_OFFSET: vertical (and slight horizontal) shift per card in a multi-card stack.
    var DEPTH_OFFSET = Math.max(1, Math.round(cardWidth * 0.02));

    stackIds.forEach(function (stackId, stackIdx) {
      var stack = stacks[stackId];
      if (!stack) return;

      var stackLeft  = stackPositions[stackIdx];
      var stackSize  = stack.cardIds.length;
      var isTarget   = stackId === targetStackId;
      var stackBaseZ = (stackCount - stackIdx) * 100;

      // ── Linked group rendering ────────────────────────────────────────────────
      if (stack.isLinked && stack.linkSlots && !isStacked) {
        var cardHeight   = Math.round(cardWidth * 7 / 5);
        var sortedSlots  = stack.linkSlots.slice().sort(function (a, b) {
          return a.row !== b.row ? a.row - b.row : a.col - b.col;
        });
        var numCols     = 0;
        sortedSlots.forEach(function (s) { if (s.col + 1 > numCols) numCols = s.col + 1; });
        var groupWidth  = numCols * cardWidth;
        var anySelected = stack.cardIds.some(function (id) { return selectedIds.indexOf(id) !== -1; });

        // ── Resolve top card per slot ───────────────────────────────────────────
        var topCards = sortedSlots.map(function (slot) {
          return gameState.cards[slot.group[slot.group.length - 1]] || null;
        });

        // ── 覚醒リンク: check if all slots resolve to the same card name ─────────
        var slotFormNames = topCards.map(function (card) {
          if (!card) return null;
          var def = getCardDefinition(card.definitionId);
          if (!def) return null;
          if (def.forms && Array.isArray(def.forms) && def.forms.length > 0) {
            var idx = Math.min((card.currentFormIndex || 0), def.forms.length - 1);
            return def.forms[idx].name || def.name;
          }
          return def.name;
        });
        var allSameName = slotFormNames.length > 1
          && slotFormNames[0] !== null
          && slotFormNames.every(function (n) { return n !== null && n === slotFormNames[0]; });

        // ── Scale: prevent horizontal overlap with adjacent stacks (issues 1, 4) ─
        var allocatedWidth;
        if (stackIdx < stackCount - 1) {
          allocatedWidth = stackPositions[stackIdx + 1] - stackLeft;
        } else {
          allocatedWidth = containerWidth > 0
            ? Math.max(containerWidth - stackLeft, cardWidth)
            : groupWidth;
        }
        var linkedGroupScale = (allocatedWidth > 0 && allocatedWidth < groupWidth)
          ? allocatedWidth / groupWidth : 1;

        // ── Scale: tapped group must fit within zone height (issues 2, 3) ────────
        // After 90° rotation visual height = groupWidth × scale; must ≤ cardHeight.
        var tappedFinalScale = 1;
        if (stack.isTapped) {
          if (groupWidth > cardHeight) tappedFinalScale = cardHeight / groupWidth;
          // Also constrain by allocated width (rotated visual width = cardHeight × scale).
          if (allocatedWidth > 0 && cardHeight * tappedFinalScale > allocatedWidth) {
            tappedFinalScale = Math.min(tappedFinalScale, allocatedWidth / cardHeight);
          }
        }

        var groupEl = document.createElement("div");
        groupEl.className = "linked-group";
        // No "is-tapped" CSS class — transform is applied in JS for correct origin.
        if (isTarget)    groupEl.classList.add("is-target-stack");
        if (anySelected) groupEl.classList.add("is-selected");
        groupEl.style.left   = stackLeft + "px";
        groupEl.style.top    = "0px";
        groupEl.style.width  = groupWidth + "px";
        groupEl.style.height = cardHeight + "px"; // explicit height for rotation origin
        groupEl.style.zIndex = String(stackBaseZ);

        // Apply CSS transform (rotation and/or scale).
        if (stack.isTapped) {
          // Rotate around the group's own center.
          groupEl.style.transformOrigin = (groupWidth / 2) + "px " + (cardHeight / 2) + "px";
          groupEl.style.transform = tappedFinalScale < 1
            ? "rotate(90deg) scale(" + tappedFinalScale + ")"
            : "rotate(90deg)";
        } else if (linkedGroupScale < 1) {
          // Compress horizontally from the left edge.
          groupEl.style.transformOrigin = "0 0";
          groupEl.style.transform = "scaleX(" + linkedGroupScale + ")";
        }

        // ── 覚醒リンク unified rendering (issue 6) ────────────────────────────────
        if (allSameName) {
          // Render a single card centered within the group width.
          var unifiedCard   = topCards[0];
          var unifiedCardEl = document.createElement("button");
          unifiedCardEl.type      = "button";
          unifiedCardEl.className = "card";
          var centeredLeft = Math.round((groupWidth - cardWidth) / 2);
          unifiedCardEl.style.left   = centeredLeft + "px";
          unifiedCardEl.style.top    = "0px";
          unifiedCardEl.style.zIndex = String(stackBaseZ + 1);

          var displayUnified = _applyPeek(unifiedCard, peekedCardIds);
          if (zone.id === ZONE_IDS.HAND && displayUnified.isFaceDown) {
            displayUnified = Object.assign({}, displayUnified, { isFaceDown: false, isPeeked: true });
          }
          CardRenderer.appendFace(unifiedCardEl, displayUnified);

          unifiedCardEl.addEventListener("click", function (e) {
            e.stopPropagation();
            if (onCardClick) {
              onCardClick({
                cardId:               unifiedCard.id,
                stackId:              stackId,
                zone:                 zone,
                stack:                stack,
                isTopCard:            true,
                isStacked:            false,
                stackSize:            stack.cardIds.length,
                isPickingTargetStack: isPickingTargetStack,
              });
            }
          });

          if (onDragStart) {
            unifiedCardEl.draggable = true;
            unifiedCardEl.addEventListener("dragstart", function (e) {
              e.stopPropagation();
              var cw    = cardWidth;
              var ch    = Math.round(cw * 7 / 5);
              var ghost = document.createElement("div");
              ghost.style.cssText =
                "position:fixed;top:-9999px;left:-9999px;" +
                "width:" + (cw * 2) + "px;height:" + (ch * 2) + "px;" +
                "border-radius:0.65rem;border:1px solid rgba(255,255,255,0.2);" +
                "background:" + getComputedStyle(unifiedCardEl).background + ";" +
                "overflow:hidden;pointer-events:none;" +
                "box-shadow:0 4px 24px rgba(0,0,0,.55);";
              ghost.innerHTML = unifiedCardEl.innerHTML;
              document.body.appendChild(ghost);
              e.dataTransfer.setDragImage(ghost, cw, ch);
              setTimeout(function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 0);
              onDragStart({
                cardId: unifiedCard.id, stackId: stackId, zone: zone, stack: stack,
                isTopCard: true, isStacked: false, isStackedTopCard: false,
              });
              setTimeout(function () { groupEl.classList.add("is-dragging"); }, 0);
            });
            unifiedCardEl.addEventListener("dragend", function () {
              groupEl.classList.remove("is-dragging");
            });
          }

          groupEl.appendChild(unifiedCardEl);

        } else {
          // ── Normal linked group: render cards slot by slot ──────────────────────
          sortedSlots.forEach(function (slot) {
            var colLeft  = slot.col * cardWidth;
            var rowTop   = slot.row * cardHeight;
            var slotSize = slot.group.length;

            slot.group.forEach(function (cardId, cardIdx) {
              var card = gameState.cards[cardId];
              if (!card) return;

              var depth     = slotSize - 1 - cardIdx; // 0 = top of this column
              var cardEl    = document.createElement("button");
              cardEl.type   = "button";
              cardEl.className = "card"; // no per-card tap/select — handled by group container

              cardEl.style.zIndex = String(stackBaseZ + cardIdx);
              cardEl.style.left   = (colLeft + depth) + "px";
              cardEl.style.top    = (rowTop + depth * DEPTH_OFFSET) + "px";

              var displayCard = _applyPeek(card, peekedCardIds);
              if (zone.id === ZONE_IDS.HAND && displayCard.isFaceDown) {
                displayCard = Object.assign({}, displayCard, { isFaceDown: false, isPeeked: true });
              }
              CardRenderer.appendFace(cardEl, displayCard);

              // Card click: always behave as "top card" so selectionManager selects entire group.
              cardEl.addEventListener("click", function (e) {
                e.stopPropagation();
                if (onCardClick) {
                  onCardClick({
                    cardId:               cardId,
                    stackId:              stackId,
                    zone:                 zone,
                    stack:                stack,
                    isTopCard:            true,
                    isStacked:            false,
                    stackSize:            stack.cardIds.length,
                    isPickingTargetStack: isPickingTargetStack,
                  });
                }
              });

              // Dragging any card in the group drags the whole group.
              if (onDragStart) {
                cardEl.draggable = true;
                cardEl.addEventListener("dragstart", function (e) {
                  e.stopPropagation();
                  var cw    = cardWidth;
                  var ch    = Math.round(cw * 7 / 5);
                  var ghost = document.createElement("div");
                  ghost.style.cssText =
                    "position:fixed;top:-9999px;left:-9999px;" +
                    "width:" + (cw * 2) + "px;height:" + (ch * 2) + "px;" +
                    "border-radius:0.65rem;border:1px solid rgba(255,255,255,0.2);" +
                    "background:" + getComputedStyle(cardEl).background + ";" +
                    "overflow:hidden;pointer-events:none;" +
                    "box-shadow:0 4px 24px rgba(0,0,0,.55);";
                  ghost.innerHTML = cardEl.innerHTML;
                  document.body.appendChild(ghost);
                  e.dataTransfer.setDragImage(ghost, cw, ch);
                  setTimeout(function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 0);
                  onDragStart({
                    cardId:           cardId,
                    stackId:          stackId,
                    zone:             zone,
                    stack:            stack,
                    isTopCard:        true,
                    isStacked:        false,
                    isStackedTopCard: false,
                  });
                  setTimeout(function () { groupEl.classList.add("is-dragging"); }, 0);
                });
                cardEl.addEventListener("dragend", function () {
                  groupEl.classList.remove("is-dragging");
                });
              }

              groupEl.appendChild(cardEl);
            });
          });
        }

        // Link badge (∽): click opens card-selector modal.
        // Width: full group width normally; 1-card-wide when unified (覚醒リンク allSameName).
        var badgeEl = document.createElement("button");
        badgeEl.type        = "button";
        badgeEl.className   = "link-badge";
        badgeEl.textContent = "∽";
        if (allSameName) {
          // Single-card unified display: badge is 1 card wide, centered in the group.
          var badgeLeft = Math.round((groupWidth - cardWidth) / 2);
          badgeEl.style.left  = badgeLeft + "px";
          badgeEl.style.right = "auto";
          badgeEl.style.width = cardWidth + "px";
        }
        badgeEl.addEventListener("click", function (e) {
          e.stopPropagation();
          if (onCardClick) {
            onCardClick({
              cardId:               stack.cardIds[0],
              stackId:              stackId,
              zone:                 zone,
              stack:                stack,
              isTopCard:            isPickingTargetStack, // pick mode → pick; else → modal
              isStacked:            false,
              stackSize:            stack.cardIds.length,
              isPickingTargetStack: isPickingTargetStack,
            });
          }
        });
        groupEl.appendChild(badgeEl);

        // ── Form nav for 覚醒リンク (all slots must be multi-form) ─────────────
        // Indicators are positioned inside the group: ◀ at left edge, ▶ at right edge (issue 7).
        if (config.onLinkedFormSwitch) {
          var anchorCard  = topCards[0];
          var anchorDef   = anchorCard ? getCardDefinition(anchorCard.definitionId) : null;
          var allMultiForm = anchorDef && Array.isArray(anchorDef.forms) && anchorDef.forms.length > 1
            && topCards.every(function (tc) {
              if (!tc) return false;
              var d = getCardDefinition(tc.definitionId);
              return d && Array.isArray(d.forms) && d.forms.length > 1;
            });

          if (allMultiForm) {
            var groupFormIdx   = anchorCard.currentFormIndex || 0;
            var groupFormCount = anchorDef.forms.length;

            // When unified (allSameName), buttons must sit inside the single centered card,
            // not at the edges of the full group. badgeLeft = (groupWidth - cardWidth) / 2.
            var navInset = allSameName ? Math.round((groupWidth - cardWidth) / 2) + 4 : 4;

            if (groupFormIdx > 0) {
              var prevNavBtn = document.createElement("button");
              prevNavBtn.type        = "button";
              prevNavBtn.className   = "linked-group__form-nav linked-group__form-nav--prev";
              prevNavBtn.textContent = "◀";
              prevNavBtn.setAttribute("aria-label", "前の面");
              if (allSameName) prevNavBtn.style.left = navInset + "px"; // override CSS left:4px
              prevNavBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                config.onLinkedFormSwitch(stackId, groupFormIdx - 1);
              });
              groupEl.appendChild(prevNavBtn);
            }
            if (groupFormIdx < groupFormCount - 1) {
              var nextNavBtn = document.createElement("button");
              nextNavBtn.type        = "button";
              nextNavBtn.className   = "linked-group__form-nav linked-group__form-nav--next";
              nextNavBtn.textContent = "▶";
              nextNavBtn.setAttribute("aria-label", "次の面");
              if (allSameName) nextNavBtn.style.right = navInset + "px"; // override CSS right:4px
              nextNavBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                config.onLinkedFormSwitch(stackId, groupFormIdx + 1);
              });
              groupEl.appendChild(nextNavBtn);
            }
          }
        }

        // ── Drop target support for linked groups ──────────────────────────────
        // Allows other cards/stacks to be dropped onto a linked group.
        // The reducer auto-unlinks the target when a stack-type MOVE_CARDS lands on it.
        //
        // Prevent dead-space clicks within the group from bubbling to the zone background
        // click handler, which would otherwise trigger zone-wide (select-all) selection.
        // For 覚醒リンク (allSameName), groupEl spans multiple card-widths while only one
        // card is rendered — without this, clicking the empty area selects all zone cards.
        // The same issue affects any linked group (non-allSameName) where gaps between
        // cards are not covered by a child element.
        groupEl.addEventListener("click", function (e) {
          e.stopPropagation();
        });

        if (!isStacked && onCardDragOver) {
          // For unified display, target the actual visible card; otherwise target the whole group.
          var dropTargetEl   = (allSameName && unifiedCardEl) ? unifiedCardEl : groupEl;
          var groupTopCardId = stack.cardIds[stack.cardIds.length - 1];
          dropTargetEl.addEventListener("dragover", function (e) {
            var accepts = onCardDragOver({
              cardId: groupTopCardId, stackId: stackId, zone: zone, stack: stack, isStacked: false,
            });
            if (!accepts) return;
            e.preventDefault();
            e.stopPropagation();
            dropTargetEl.classList.add("drop-target-active");
            document.body.classList.add("drag-over-stack");
            var ddt = window.DragDropTouch && DragDropTouch.DragDropTouch && DragDropTouch.DragDropTouch._instance;
            if (ddt && ddt._img) ddt._img.style.opacity = "0.45";
          });

          dropTargetEl.addEventListener("dragleave", function (e) {
            if (!dropTargetEl.contains(e.relatedTarget)) {
              dropTargetEl.classList.remove("drop-target-active");
              document.body.classList.remove("drag-over-stack");
              var ddt2 = window.DragDropTouch && DragDropTouch.DragDropTouch && DragDropTouch.DragDropTouch._instance;
              if (ddt2 && ddt2._img) ddt2._img.style.opacity = "";
            }
          });

          dropTargetEl.addEventListener("drop", function (e) {
            e.preventDefault();
            e.stopPropagation();
            dropTargetEl.classList.remove("drop-target-active");
            document.body.classList.remove("drag-over-stack");
            var ddt3 = window.DragDropTouch && DragDropTouch.DragDropTouch && DragDropTouch.DragDropTouch._instance;
            if (ddt3 && ddt3._img) ddt3._img.style.opacity = "";
            if (onCardDrop) {
              onCardDrop({ cardId: groupTopCardId, stackId: stackId, zone: zone, stack: stack, isStacked: false });
            }
          });
        }

        listEl.appendChild(groupEl);
        return; // skip the normal per-card rendering below
      }
      // ── End linked group rendering ────────────────────────────────────────────

      stack.cardIds.forEach(function (cardId, cardIdx) {
        var card = gameState.cards[cardId];
        if (!card) return;

        var depth        = stackSize - 1 - cardIdx; // 0 = top card
        var isTopCard = (depth === 0);
        // Top card of any stacked zone is draggable (deck, graveyard, ex, gr, …).
        var isStackedTopCard = isStacked && stackIdx === 0 && isTopCard;
        var canDrag          = !isStacked || isStackedTopCard;

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

        // Hand cards are always shown face-visible to the owner ("見える" state).
        // isFaceDown in game data is preserved; only the rendering differs.
        var displayCard = _applyPeek(card, peekedCardIds);
        if (zone.id === ZONE_IDS.HAND && displayCard.isFaceDown) {
          displayCard = Object.assign({}, displayCard, { isFaceDown: false, isPeeked: true });
        }
        CardRenderer.appendFace(cardEl, displayCard);

        // ── Form navigation indicators (◀ / ▶) ─────────────────────────────
        // Shown on face-up multi-form cards in spread zones only.
        if (!isStacked && !displayCard.isFaceDown && config.onFormSwitch) {
          var vm = buildCardViewModel(displayCard);
          if (vm && vm.isMultiForm && vm.formCount > 1) {
            _appendFormNav(cardEl, cardId, vm.formIndex, vm.formCount, config.onFormSwitch);
          }
        }

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

        // ── Drag and drop ─────────────────────────────────────────────────────
        if (canDrag && onDragStart) {
          cardEl.draggable = true;

          cardEl.addEventListener("dragstart", function (e) {
            e.stopPropagation();

            // Build a 2× ghost image so the dragged card is visible above the finger.
            // Using a custom element avoids DragDropTouch's _copyStyle, which
            // produces a giant image when the source element is detached mid-render.
            // The ghost must be in the DOM when setDragImage is called, so we
            // append it now and remove it on the next tick.
            var cw    = _getCardWidth();
            var ch    = Math.round(cw * 7 / 5);
            var ghost = document.createElement("div");
            ghost.style.cssText =
              "position:fixed;top:-9999px;left:-9999px;" +
              "width:"  + (cw * 2) + "px;" +
              "height:" + (ch * 2) + "px;" +
              "border-radius:0.65rem;" +
              "border:1px solid rgba(255,255,255,0.2);" +
              "background:" + getComputedStyle(cardEl).background + ";" +
              "overflow:hidden;pointer-events:none;" +
              "box-shadow:0 4px 24px rgba(0,0,0,.55);";
            ghost.innerHTML = cardEl.innerHTML;
            document.body.appendChild(ghost);
            // Hotspot at centre of the 2× card so it floats centred on the finger.
            e.dataTransfer.setDragImage(ghost, cw, ch);
            setTimeout(function () {
              if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
            }, 0);

            onDragStart({
              cardId:           cardId,
              stackId:          stackId,
              zone:             zone,
              stack:            stack,
              isTopCard:        isTopCard,
              isStacked:        isStacked,
              isStackedTopCard: isStackedTopCard,
            });
            // Defer class addition so the ghost image is captured before the
            // element becomes transparent.
            setTimeout(function () { cardEl.classList.add("is-dragging"); }, 0);
          });

          cardEl.addEventListener("dragend", function () {
            cardEl.classList.remove("is-dragging");
          });
        }

        if (!isStacked && onCardDragOver) {
          cardEl.addEventListener("dragover", function (e) {
            if (onCardDragOver({ cardId: cardId, stackId: stackId, zone: zone, stack: stack, isStacked: isStacked })) {
              e.preventDefault();
              e.stopPropagation();
              cardEl.classList.add("drop-target-active");
              // Feature 4: Make polyfill ghost semi-transparent when over a stackable card.
              document.body.classList.add("drag-over-stack");
              var ddt = window.DragDropTouch && DragDropTouch.DragDropTouch && DragDropTouch.DragDropTouch._instance;
              if (ddt && ddt._img) ddt._img.style.opacity = "0.45";
            }
          });

          cardEl.addEventListener("dragleave", function (e) {
            if (!cardEl.contains(e.relatedTarget)) {
              cardEl.classList.remove("drop-target-active");
              document.body.classList.remove("drag-over-stack");
              var ddt = window.DragDropTouch && DragDropTouch.DragDropTouch && DragDropTouch.DragDropTouch._instance;
              if (ddt && ddt._img) ddt._img.style.opacity = "";
            }
          });

          cardEl.addEventListener("drop", function (e) {
            e.preventDefault();
            e.stopPropagation();
            cardEl.classList.remove("drop-target-active");
            document.body.classList.remove("drag-over-stack");
            var ddt = window.DragDropTouch && DragDropTouch.DragDropTouch && DragDropTouch.DragDropTouch._instance;
            if (ddt && ddt._img) ddt._img.style.opacity = "";
            if (onCardDrop) {
              onCardDrop({ cardId: cardId, stackId: stackId, zone: zone, stack: stack, isStacked: isStacked });
            }
          });
        }

        listEl.appendChild(cardEl);
      });

      // Depth badge on multi-card stacks (not shown in stacked zones — count is in header).
      // Positioned below the card area (below where power is shown), same width as the card.
      // Tapping the badge opens the card-selector modal for this stack.
      if (stackSize > 1 && !isStacked) {
        var cardHeight   = Math.round(cardWidth * 7 / 5);
        var badge        = document.createElement("button");
        badge.type       = "button";
        badge.className  = "stack-badge";
        badge.textContent = stackSize;
        badge.style.left  = stackLeft + "px";
        badge.style.top   = (cardHeight - 6) + "px";
        badge.style.width = cardWidth + "px";
        badge.style.zIndex = String(stackBaseZ + stackSize + 10);
        badge.addEventListener("click", function (e) {
          e.stopPropagation();
          if (onCardClick) {
            // Simulate a non-top-card click, which opens the stack selector modal.
            onCardClick({
              cardId:               stack.cardIds[0], // bottom card (index 0 = bottom)
              stackId:              stackId,
              zone:                 zone,
              stack:                stack,
              isTopCard:            false,
              isStacked:            false,
              stackSize:            stackSize,
              isPickingTargetStack: isPickingTargetStack,
            });
          }
        });
        listEl.appendChild(badge);
      }
    });

    // ── Drop panel ──────────────────────────────────────────────────────────────
    // A dedicated 1-card-wide drop target at the right edge of spread zones.
    // Stops drag event propagation so the zone's own dragover does not fire when
    // the pointer is over the panel — only the panel itself highlights.
    if (config.hasDropPanel) {
      // has-drop-panel was already added at the top of renderZone.
      var panelEl = document.createElement("div");
      panelEl.className = "zone-drop-panel";
      var plusEl  = document.createElement("span");
      plusEl.className   = "zone-drop-panel__plus";
      plusEl.textContent = "+";
      panelEl.appendChild(plusEl);

      panelEl.addEventListener("dragover", function (e) {
        if (config.onDropPanelDragOver && !config.onDropPanelDragOver()) return;
        e.preventDefault();
        e.stopPropagation(); // prevent zone-level dragover from also firing
        panelEl.classList.add("drop-target-active");
      });

      panelEl.addEventListener("dragleave", function (e) {
        if (!panelEl.contains(e.relatedTarget)) {
          panelEl.classList.remove("drop-target-active");
        }
      });

      panelEl.addEventListener("drop", function (e) {
        e.preventDefault();
        e.stopPropagation();
        // Clear all highlights (zone may still be lit if dragover fired before panel took over).
        var highlighted = document.querySelectorAll(".drop-target-active");
        for (var i = 0; i < highlighted.length; i++) {
          highlighted[i].classList.remove("drop-target-active");
        }
        if (config.onDropPanelDrop) config.onDropPanelDrop();
      });

      container.appendChild(panelEl);
    }
  }

  // ── Card detail panel ────────────────────────────────────────────────────────
  // Shows the full definition of the most-recently selected face-up card.
  // For twin cards, the panel is split into two halves.

  function renderCardDetail(container, gameState, peekedCardIds) {
    container.innerHTML = "";

    var selectedIds = gameState.selectedCardIds || [];

    // ── Linked stack: show merged info ───────────────────────────────────────
    // Find any linked stack whose ALL cards are covered by the current selection.
    // This works even when non-linked cards from other zones are also selected.
    if (selectedIds.length >= 2) {
      var linkedStackForInfo = null;
      for (var sid in gameState.stacks) {
        if (!Object.prototype.hasOwnProperty.call(gameState.stacks, sid)) continue;
        var st = gameState.stacks[sid];
        if (!st || !st.isLinked || !st.linkSlots) continue;
        var allLinkedInSel = st.cardIds.every(function (id) {
          return selectedIds.indexOf(id) !== -1;
        });
        if (allLinkedInSel) { linkedStackForInfo = st; break; }
      }
      if (linkedStackForInfo) {
        var linkedInfo = buildLinkedStackInfo(linkedStackForInfo, gameState.cards);
        if (linkedInfo) {
          // INFO panel uses compact values (sum only, no breakdown).
          var syntheticDef = {
            name:      linkedInfo.name,
            cost:      linkedInfo.cost,        // compact: sum only
            power:     linkedInfo.power,        // compact: sum only
            races:     linkedInfo.races,
            abilities: linkedInfo.abilities,
            type:      "リンク",
          };
          var panelEl = _buildDetailHalf(syntheticDef);
          if (linkedInfo.backgroundStyle) {
            panelEl.style.background = linkedInfo.backgroundStyle;
          }
          container.appendChild(panelEl);
          return;
        }
      }
    }

    // ── Standard single-card detail ───────────────────────────────────────────
    // Find the last face-up card in the selection (most recently added).
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

    // Multi-form card: show the currently displayed form's data.
    if (def.forms && Array.isArray(def.forms) && def.forms.length > 0) {
      var mfIdx = Math.min(
        (targetCard.currentFormIndex != null) ? targetCard.currentFormIndex : 0,
        def.forms.length - 1
      );
      container.appendChild(_buildDetailHalf(Object.assign({}, def, def.forms[mfIdx])));
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

    // Race row — shown immediately below the name.
    var races = Array.isArray(def.races) ? def.races : (def.race ? [def.race] : []);
    if (races.length) {
      var raceRow = document.createElement("div");
      raceRow.className   = "cd-race-row";
      raceRow.textContent = races.join(" / ");
      wrap.appendChild(raceRow);
    }

    // Type row.
    if (def.type) {
      var typeRow = document.createElement("div");
      typeRow.className   = "cd-type-row";
      typeRow.textContent = def.type;
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
      powerEl.textContent = typeof def.power === "number" ? def.power.toLocaleString() : String(def.power);
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
    } else if (modal.type === "LINKED_DETAIL") {
      _renderLinkedDetailModal(container, modal, callbacks);
    } else if (modal.type === "PENDING_DROP") {
      _renderPendingDropModal(container, gameState, modal, callbacks);
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

    // Preserve scroll position across re-renders (selecting a card rebuilds the DOM).
    var prevScrollLeft = 0;
    var prevScrollTop  = 0;
    var prevList = container.querySelector(".modal-card-list");
    if (prevList) {
      prevScrollLeft = prevList.scrollLeft;
      prevScrollTop  = prevList.scrollTop;
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

    header.appendChild(title);

    // Shuffle button: only shown for zone-type modals (e.g. deck, graveyard).
    if (modal.source.type === "zone" && cb.onShuffle) {
      var shuffleBtn = document.createElement("button");
      shuffleBtn.className   = "modal-shuffle-btn";
      shuffleBtn.textContent = "シャッフル";
      shuffleBtn.addEventListener("click", function () { cb.onShuffle(modal.source.id); });
      header.appendChild(shuffleBtn);
    }

    var closeBtn = document.createElement("button");
    closeBtn.className   = "modal-close-btn";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", function () { cb.onClose(); });

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
    // Restore scroll after panel is in the DOM so the browser can apply it.
    cardListEl.scrollLeft = prevScrollLeft;
    cardListEl.scrollTop  = prevScrollTop;
  }

  // ── Linked detail modal ──────────────────────────────────────────────────────
  // Opened by clicking the INFO panel when a linked group is selected.
  // Shows merged linked-group info with full cost/power breakdown.

  function _renderLinkedDetailModal(container, modal, cb) {
    container.innerHTML = "";
    var info = modal.linkedInfo;
    if (!info) { container.classList.remove("is-open"); return; }

    var panel = document.createElement("div");
    panel.className = "modal-panel";

    var header = document.createElement("div");
    header.className = "modal-header";

    var title = document.createElement("span");
    title.className   = "modal-title";
    title.textContent = "リンクカード詳細";

    var closeBtn = document.createElement("button");
    closeBtn.className   = "modal-close-btn";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", function () { cb.onClose(); });

    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Use costDetail / powerDetail (with breakdown) for modal display.
    var syntheticDef = {
      name:      info.name,
      cost:      info.costDetail,    // sum + breakdown
      power:     info.powerDetail,   // sum + breakdown
      races:     info.races,
      abilities: info.abilities,
      type:      "リンク",
    };
    var detailEl = _buildDetailHalf(syntheticDef);
    if (info.backgroundStyle) detailEl.style.background = info.backgroundStyle;
    panel.appendChild(detailEl);

    container.appendChild(panel);
  }

  // ── Pending drop modal ───────────────────────────────────────────────────────
  // Shown when a drag-and-drop needs user confirmation.
  // Which sections are displayed is driven entirely by modal.options —
  // adding a new option requires only changing the options object and this renderer.
  //
  // callbacks used: onClose, onConfirmDrop(cardIds, target, position, faceChoice, tapChoice)

  function _renderPendingDropModal(container, gameState, modal, cb) {
    container.innerHTML = "";

    var opts    = modal.options || {};
    var cardIds = modal.cardIds || [];
    var target  = modal.target  || {};

    var panel = document.createElement("div");
    panel.className = "modal-panel modal-panel--pending-drop";

    // ── Header ────────────────────────────────────────────────────────────────
    var header = document.createElement("div");
    header.className = "modal-header";

    var title = document.createElement("span");
    title.className   = "modal-title";
    title.textContent = "どのように置きますか？";

    var closeBtn = document.createElement("button");
    closeBtn.className   = "modal-close-btn";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", function () { cb.onClose(); });

    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // ── Body: dynamic sections controlled by opts ─────────────────────────────
    var body = document.createElement("div");
    body.className = "pdd-body";

    // Local state for the user's current choices.
    var positionChoice = "top";   // "top" | "bottom"
    // Face default is driven by opts.defaultIsFaceDown (set from target zone's convention).
    // "keep" is used only when showFace is false (face section hidden → no user choice).
    var faceChoice = opts.showFace
      ? (opts.defaultIsFaceDown ? "down" : "up")
      : "keep";
    var tapChoice   = false;    // boolean
    var insertIdx   = 0;        // 0-based deck insert index
    var linkChoice  = false;    // boolean: "リンクして出す" selected
    var stackChoice = "stack";  // "stack" | "split" — used when opts.showStack is true

    // ── Position section ──────────────────────────────────────────────────────
    // When showInsertIndex is also true, position buttons confirm immediately
    // (shortcuts for top/bottom); the dropdown is for precise placement.
    if (opts.showPosition) {
      var posSection = document.createElement("div");
      posSection.className = "pdd-section";

      var posLabel = document.createElement("div");
      posLabel.className   = "pdd-section-label";
      posLabel.textContent = "置く位置";
      posSection.appendChild(posLabel);

      var posRow = document.createElement("div");
      posRow.className = "pdd-button-group";

      var topBtn = document.createElement("button");
      topBtn.type        = "button";
      topBtn.className   = "pdd-choice-btn is-selected";
      topBtn.textContent = "上に置く";

      var bottomBtn = document.createElement("button");
      bottomBtn.type        = "button";
      bottomBtn.className   = "pdd-choice-btn";
      bottomBtn.textContent = "下に置く";

      if (opts.showInsertIndex) {
        // Deck: top/bottom buttons are immediate shortcuts (skip confirm step).
        topBtn.addEventListener("click", function () {
          cb.onConfirmDrop(cardIds, target, "top", faceChoice, tapChoice);
        });
        bottomBtn.addEventListener("click", function () {
          cb.onConfirmDrop(cardIds, target, "bottom", faceChoice, tapChoice);
        });
      } else {
        // Other stacks/zones: buttons update selection, single confirm at bottom.
        topBtn.addEventListener("click", function () {
          positionChoice = "top";
          topBtn.classList.add("is-selected");
          bottomBtn.classList.remove("is-selected");
        });
        bottomBtn.addEventListener("click", function () {
          positionChoice = "bottom";
          bottomBtn.classList.add("is-selected");
          topBtn.classList.remove("is-selected");
        });
      }

      posRow.appendChild(topBtn);
      posRow.appendChild(bottomBtn);
      posSection.appendChild(posRow);
      body.appendChild(posSection);
    }

    // ── Insert index section (deck precise placement) ─────────────────────────
    if (opts.showInsertIndex) {
      var deckZone = gameState.zones[ZONE_IDS.DECK] || { stackIds: [] };
      var deckSize = deckZone.stackIds.length;

      var idxSection = document.createElement("div");
      idxSection.className = "pdd-section";

      var idxLabel = document.createElement("div");
      idxLabel.className   = "pdd-section-label";
      idxLabel.textContent = "任意の枚数目に挿入";
      idxSection.appendChild(idxLabel);

      var idxRow = document.createElement("div");
      idxRow.className = "pdd-insert-row";

      var idxPre = document.createElement("span");
      idxPre.textContent = "上から ";
      idxRow.appendChild(idxPre);

      var idxSelect = document.createElement("select");
      idxSelect.className = "pdd-insert-select";
      for (var n = 1; n <= deckSize + 1; n++) {
        var opt = document.createElement("option");
        opt.value = String(n - 1); // 0-based insert index
        opt.textContent = n === 1            ? "1枚目（一番上）"
                        : n === deckSize + 1 ? n + "枚目（一番下）"
                        :                      n + "枚目";
        idxSelect.appendChild(opt);
      }
      idxSelect.addEventListener("change", function () {
        insertIdx = parseInt(idxSelect.value, 10);
      });
      idxRow.appendChild(idxSelect);

      var idxConfirmBtn = document.createElement("button");
      idxConfirmBtn.type        = "button";
      idxConfirmBtn.className   = "pdd-confirm-btn";
      idxConfirmBtn.textContent = "確定";
      idxConfirmBtn.addEventListener("click", function () {
        cb.onConfirmDrop(cardIds, target, insertIdx, faceChoice, tapChoice);
      });
      idxRow.appendChild(idxConfirmBtn);

      idxSection.appendChild(idxRow);
      body.appendChild(idxSection);
    }

    // ── Stack section: place all cards as one stack or split into individuals ─
    if (opts.showStack) {
      var stackSection = document.createElement("div");
      stackSection.className = "pdd-section";

      var stackSectionLabel = document.createElement("div");
      stackSectionLabel.className   = "pdd-section-label";
      stackSectionLabel.textContent = "スタック扱い";
      stackSection.appendChild(stackSectionLabel);

      var stackRow = document.createElement("div");
      stackRow.className = "pdd-button-group";

      var asStackBtn = document.createElement("button");
      asStackBtn.type        = "button";
      asStackBtn.className   = "pdd-choice-btn is-selected"; // default: one stack
      asStackBtn.textContent = "スタックのまま";

      var splitCardsBtn = document.createElement("button");
      splitCardsBtn.type        = "button";
      splitCardsBtn.className   = "pdd-choice-btn";
      splitCardsBtn.textContent = "バラバラで";

      asStackBtn.addEventListener("click", function () {
        stackChoice = "stack";
        asStackBtn.classList.add("is-selected");
        splitCardsBtn.classList.remove("is-selected");
      });
      splitCardsBtn.addEventListener("click", function () {
        stackChoice = "split";
        splitCardsBtn.classList.add("is-selected");
        asStackBtn.classList.remove("is-selected");
      });

      stackRow.appendChild(asStackBtn);
      stackRow.appendChild(splitCardsBtn);
      stackSection.appendChild(stackRow);
      body.appendChild(stackSection);
    }

    // ── Face section ──────────────────────────────────────────────────────────
    if (opts.showFace) {
      var faceSection = document.createElement("div");
      faceSection.className = "pdd-section";

      var faceSectionLabel = document.createElement("div");
      faceSectionLabel.className   = "pdd-section-label";
      faceSectionLabel.textContent = "表裏";
      faceSection.appendChild(faceSectionLabel);

      var faceRow = document.createElement("div");
      faceRow.className = "pdd-button-group";

      var faceOptions = [
        { value: "up",   label: "表向き" },
        { value: "down", label: "裏向き" },
      ];

      var faceBtnEls = faceOptions.map(function (fo) {
        var btn = document.createElement("button");
        btn.type        = "button";
        var isDefault   = (fo.value === (opts.defaultIsFaceDown ? "down" : "up"));
        btn.className   = "pdd-choice-btn" + (isDefault ? " is-selected" : "");
        btn.textContent = fo.label;
        btn.addEventListener("click", function () {
          faceChoice = fo.value;
          faceBtnEls.forEach(function (b) { b.classList.remove("is-selected"); });
          btn.classList.add("is-selected");
        });
        faceRow.appendChild(btn);
        return btn;
      });

      faceSection.appendChild(faceRow);
      body.appendChild(faceSection);
    }

    // ── Tap section ───────────────────────────────────────────────────────────
    if (opts.showTap) {
      var tapSection = document.createElement("div");
      tapSection.className = "pdd-section";

      var tapSectionLabel = document.createElement("div");
      tapSectionLabel.className   = "pdd-section-label";
      tapSectionLabel.textContent = "タップ状態";
      tapSection.appendChild(tapSectionLabel);

      var tapRow = document.createElement("div");
      tapRow.className = "pdd-button-group";

      var untapBtn = document.createElement("button");
      untapBtn.type        = "button";
      untapBtn.className   = "pdd-choice-btn is-selected";
      untapBtn.textContent = "アンタップ";

      var tapBtn = document.createElement("button");
      tapBtn.type        = "button";
      tapBtn.className   = "pdd-choice-btn";
      tapBtn.textContent = "タップ";

      untapBtn.addEventListener("click", function () {
        tapChoice = false;
        untapBtn.classList.add("is-selected");
        tapBtn.classList.remove("is-selected");
      });
      tapBtn.addEventListener("click", function () {
        tapChoice = true;
        tapBtn.classList.add("is-selected");
        untapBtn.classList.remove("is-selected");
      });

      tapRow.appendChild(untapBtn);
      tapRow.appendChild(tapBtn);
      tapSection.appendChild(tapRow);
      body.appendChild(tapSection);
    }

    // ── Link section: "リンクして出す" ───────────────────────────────────────
    // Shown only when dragging from a non-battlefield zone onto a battlefield stack.
    if (opts.showLink) {
      var linkSection = document.createElement("div");
      linkSection.className = "pdd-section";

      var linkSectionLabel = document.createElement("div");
      linkSectionLabel.className   = "pdd-section-label";
      linkSectionLabel.textContent = "リンク";
      linkSection.appendChild(linkSectionLabel);

      var linkRow = document.createElement("div");
      linkRow.className = "pdd-button-group";

      var normalBtn = document.createElement("button");
      normalBtn.type        = "button";
      normalBtn.className   = "pdd-choice-btn is-selected";
      normalBtn.textContent = "通常で置く";

      var linkAsBtn = document.createElement("button");
      linkAsBtn.type        = "button";
      linkAsBtn.className   = "pdd-choice-btn";
      linkAsBtn.textContent = "リンクして出す";

      normalBtn.addEventListener("click", function () {
        linkChoice = false;
        normalBtn.classList.add("is-selected");
        linkAsBtn.classList.remove("is-selected");
      });
      linkAsBtn.addEventListener("click", function () {
        linkChoice = true;
        linkAsBtn.classList.add("is-selected");
        normalBtn.classList.remove("is-selected");
      });

      linkRow.appendChild(normalBtn);
      linkRow.appendChild(linkAsBtn);
      linkSection.appendChild(linkRow);
      body.appendChild(linkSection);
    }

    panel.appendChild(body);

    // ── Footer: confirm + cancel ──────────────────────────────────────────────
    // Not shown when showInsertIndex is true (that section has its own confirm).
    if (!opts.showInsertIndex) {
      var footer = document.createElement("div");
      footer.className = "pdd-footer";

      var confirmBtn = document.createElement("button");
      confirmBtn.type        = "button";
      confirmBtn.className   = "pdd-confirm-btn";
      confirmBtn.textContent = "確定";
      confirmBtn.addEventListener("click", function () {
        cb.onConfirmDrop(cardIds, target, positionChoice, faceChoice, tapChoice, linkChoice, stackChoice);
      });

      var cancelBtn = document.createElement("button");
      cancelBtn.type        = "button";
      cancelBtn.className   = "pdd-cancel-btn";
      cancelBtn.textContent = "キャンセル";
      cancelBtn.addEventListener("click", function () { cb.onClose(); });

      footer.appendChild(confirmBtn);
      footer.appendChild(cancelBtn);
      panel.appendChild(footer);
    } else {
      // Deck insert: only a cancel button in the footer.
      var footerDeck = document.createElement("div");
      footerDeck.className = "pdd-footer";

      var cancelDeckBtn = document.createElement("button");
      cancelDeckBtn.type        = "button";
      cancelDeckBtn.className   = "pdd-cancel-btn";
      cancelDeckBtn.textContent = "キャンセル";
      cancelDeckBtn.addEventListener("click", function () { cb.onClose(); });

      footerDeck.appendChild(cancelDeckBtn);
      panel.appendChild(footerDeck);
    }

    container.appendChild(panel);
  }

  // ── Card detail modal ────────────────────────────────────────────────────────
  // Triggered by clicking the card-detail-panel.
  // Layout: fixed header (name + civilization + cost) / scrollable body (abilities) / fixed footer (power).
  // Twin cards: two sections side-by-side, each with its own header / body / footer.

  function _buildCardInfoSection(def) {
    var section = document.createElement("div");
    section.className = "cdi-section";

    // ── Header ────────────────────────────────────────────────────────────────
    // Layout: [cost] [name-block]
    //              [name-row: name + type・rarity]
    //              [race]
    //              [civilization]
    var hd = document.createElement("div");
    hd.className = "cdi-header";

    // Cost — left-most
    if (def.cost != null) {
      var costEl = document.createElement("span");
      costEl.className   = "cdi-cost";
      costEl.textContent = def.cost;
      hd.appendChild(costEl);
    }

    // Name block
    var nameBlock = document.createElement("div");
    nameBlock.className = "cdi-name-block";

    // Name row: card name + type / rarity
    var nameRow = document.createElement("div");
    nameRow.className = "cdi-name-row";

    var nameEl = document.createElement("span");
    nameEl.className   = "cdi-name";
    nameEl.textContent = def.name || "—";
    nameRow.appendChild(nameEl);

    var metaParts = [];
    if (def.type)   metaParts.push(def.type);
    if (def.rarity) metaParts.push(def.rarity);
    if (metaParts.length) {
      var metaEl = document.createElement("span");
      metaEl.className   = "cdi-meta";
      metaEl.textContent = metaParts.join(" ・ ");
      nameRow.appendChild(metaEl);
    }
    nameBlock.appendChild(nameRow);

    // Race row
    var races = Array.isArray(def.races) ? def.races : (def.race ? [def.race] : []);
    if (races.length) {
      var raceEl = document.createElement("div");
      raceEl.className   = "cdi-race";
      raceEl.textContent = races.join(" / ");
      nameBlock.appendChild(raceEl);
    }

    // Civilization row
    var civs = Array.isArray(def.civilization) ? def.civilization
      : (def.civilization ? [def.civilization] : []);
    if (civs.length) {
      var civEl = document.createElement("div");
      civEl.className   = "cdi-civ";
      civEl.textContent = civs.map(function (c) { return CIV_NAMES_JP[c] || c; }).join(" / ");
      nameBlock.appendChild(civEl);
    }

    hd.appendChild(nameBlock);
    section.appendChild(hd);

    // ── Body: abilities / card text (scrollable) ──────────────────────────────
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

    // ── Footer: power (always visible) ───────────────────────────────────────
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

    // Multi-form card: show the form that was active when the modal was opened.
    if (def.forms && Array.isArray(def.forms) && def.forms.length > 0) {
      var mfModalIdx = Math.min(
        (modal.formIndex != null) ? modal.formIndex : 0,
        def.forms.length - 1
      );
      panel.appendChild(_buildCardInfoSection(Object.assign({}, def, def.forms[mfModalIdx])));
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
