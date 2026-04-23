// ui/viewModel.js
//
// Pure transformation layer: GameState data → UI-ready display objects.
//
// Rules:
//   - No DOM access
//   - No mutation
//   - No side effects
//   - Depends only on model/CardDefinition.js (getCardDefinition)

// ── Civilization color map ────────────────────────────────────────────────────

var CIV_COLORS = {
  light:    "#eab308",
  water:    "#2563eb",
  darkness: "#18181b",
  fire:     "#dc2626",
  nature:   "#16a34a",
};

// Fixed display order for multi-civ gradients (yellow→blue→black→red→green).
var CIV_ORDER = ["light", "water", "darkness", "fire", "nature"];

// ── Internal helpers ──────────────────────────────────────────────────────────

// Extracts a flat, deduplicated civilization array from a card definition.
// - Normal cards: def.civilization is a string or array.
// - Twin cards (type "twin"): merges civilizations from all sides[].
// Returns an array of civilization strings (may be empty).
function getCivList(def) {
  if (!def) return [];
  if (def.type === "twin") {
    var merged = [];
    (def.sides || []).forEach(function (side) {
      [].concat(side.civilization || []).forEach(function (c) {
        if (merged.indexOf(c) === -1) merged.push(c);
      });
    });
    return merged;
  }
  if (!def.civilization) return [];
  return Array.isArray(def.civilization) ? def.civilization : [def.civilization];
}

// Returns a CSS background value (solid color or diagonal linear-gradient)
// for an array of civilization strings.
// Unknown or empty → white fallback.
// Multiple civs → evenly-spaced color stops from top-left to bottom-right.
function getCivBackground(civs) {
  if (!civs || !civs.length) return "#ffffff";
  var ordered = CIV_ORDER.filter(function (c) { return civs.indexOf(c) !== -1; });
  if (!ordered.length) return "#ffffff";
  if (ordered.length === 1) return CIV_COLORS[ordered[0]];
  var colors = ordered.map(function (c) { return CIV_COLORS[c]; });
  var stops  = colors.map(function (color, i) {
    var pct = Math.round(i / (colors.length - 1) * 100);
    return color + " " + pct + "%";
  });
  return "linear-gradient(135deg, " + stops.join(", ") + ")";
}

// Returns { name, cost, power } for display.
// Twin cards show "top / bottom" for name and cost.
function getDisplayInfo(def) {
  if (!def) return { name: "?", cost: null, power: null };
  if (def.type === "twin") {
    var top    = (def.sides || [])[0] || {};
    var bottom = (def.sides || [])[1] || {};
    return {
      name:  (top.name || "?") + " / " + (bottom.name || "?"),
      cost:  (top.cost != null ? top.cost : "?") + "/" + (bottom.cost != null ? bottom.cost : "?"),
      power: top.power != null ? top.power : null,
    };
  }
  return {
    name:  def.name,
    cost:  def.cost  != null ? def.cost  : null,
    power: def.power != null ? def.power : null,
  };
}

// Returns a CSS background with the dark readability overlay applied.
function _withOverlay(civBg) {
  return "linear-gradient(rgba(0,0,0,0.28), rgba(0,0,0,0.28)), " + civBg;
}

// ── Public API ────────────────────────────────────────────────────────────────

// Builds a UI-ready view model for a single card instance.
//
// Returns:
// {
//   id,
//   name,            — display name (twin: "TopName / BottomName")
//   cost,            — display cost (twin: "5/3")
//   power,           — power value or null
//   civilizations,   — string[]
//   backgroundStyle, — CSS background (solid color or gradient + dark overlay)
//   isFaceDown,
//   isTwin,          — true for twin cards
//   sides,           — (twin only) [{ name, cost, power, backgroundStyle }, ...]
// }
function buildCardViewModel(card, gameState) {  // eslint-disable-line no-unused-vars
  if (!card) return null;
  var def    = getCardDefinition(card.definitionId);
  var isTwin = !!(def && def.type === "twin");

  // ── Multi-form card (超次元 with forms[]) ────────────────────────────────
  if (def && Array.isArray(def.forms) && def.forms.length > 0) {
    var formIdx = (card.currentFormIndex != null) ? card.currentFormIndex : 0;
    formIdx = Math.min(formIdx, def.forms.length - 1);
    var form       = def.forms[formIdx];
    var formCivs   = Array.isArray(form.civilization) ? form.civilization
                   : (form.civilization ? [form.civilization] : []);
    var formCivBg  = getCivBackground(formCivs);
    return {
      id:              card.id,
      name:            form.name  || def.name || "?",
      cost:            form.cost  != null ? form.cost  : null,
      power:           form.power != null ? form.power : null,
      civilizations:   formCivs,
      backgroundStyle: _withOverlay(formCivBg),
      isFaceDown:      card.isFaceDown,
      isTwin:          false,
      jokers:          !!(def.jokers || form.jokers),
      sides:           null,
      isMultiForm:     true,
      formIndex:       formIdx,
      formCount:       def.forms.length,
    };
  }

  var info   = getDisplayInfo(def);
  var civs   = getCivList(def);
  var civBg  = getCivBackground(civs);

  // jokers: true if any side (or the card itself) carries the jokers flag.
  var isJokers = !!(def && (def.jokers || (isTwin && (def.sides || []).some(function (s) { return s.jokers; }))));

  var vm = {
    id:              card.id,
    name:            info.name,
    cost:            info.cost,
    power:           info.power,
    civilizations:   civs,
    backgroundStyle: _withOverlay(civBg),
    isFaceDown:      card.isFaceDown,
    isTwin:          isTwin,
    jokers:          isJokers,
    sides:           null,
  };

  if (isTwin) {
    vm.sides = (def.sides || []).map(function (side) {
      var sideCivs = Array.isArray(side.civilization)
        ? side.civilization
        : (side.civilization ? [side.civilization] : []);
      return {
        name:            side.name  || "?",
        cost:            side.cost  != null ? side.cost  : null,
        power:           side.power != null ? side.power : null,
        backgroundStyle: _withOverlay(getCivBackground(sideCivs)),
      };
    });
  }

  return vm;
}

// ── buildLinkedStackInfo ──────────────────────────────────────────────────────
// Builds merged display info for a linked stack (for the INFO panel).
//
// Merging rules:
//   name        — "X / Y / Z" (slash-separated)
//   cost        — sum, with breakdown: "3（1+2）"
//   power       — sum of non-null values, with breakdown: "3000（1000+2000）"
//   civilizations — union of all civs
//   races         — union of all races
//   abilities     — each card's text lines concatenated, separated by "──────" dividers
//   backgroundStyle — gradient from merged civilizations
//
// Returns null when linkedStack is not actually linked.
function buildLinkedStackInfo(linkedStack, cards) {  // eslint-disable-line no-unused-vars
  if (!linkedStack || !linkedStack.isLinked || !linkedStack.linkSlots) return null;

  // Sort slots by (row, col) so merging follows display order.
  var sortedSlots = linkedStack.linkSlots.slice().sort(function (a, b) {
    return a.row !== b.row ? a.row - b.row : a.col - b.col;
  });

  // Resolve the effective definition for each slot's top card (handles multi-form).
  var slotDefs = sortedSlots.map(function (slot) {
    var topCardId = slot.group[slot.group.length - 1];
    var card      = cards && cards[topCardId];
    if (!card) return null;
    var def = getCardDefinition(card.definitionId);
    if (!def) return null;
    if (def.forms && Array.isArray(def.forms) && def.forms.length > 0) {
      var idx = Math.min((card.currentFormIndex || 0), def.forms.length - 1);
      return Object.assign({}, def, def.forms[idx]);
    }
    return def;
  }).filter(Boolean);

  if (!slotDefs.length) return null;

  // ── 覚醒リンク同一定義チェック ─────────────────────────────────────────────
  // 全スロットが同じカード名に解決された場合（例: 同名両面カードの裏面が全スロット共通）、
  // 合算ではなく単体カードとして表示する。
  var allSameName = slotDefs.length > 1 && slotDefs.every(function (def) {
    return def.name === slotDefs[0].name;
  });
  if (allSameName) {
    var sd   = slotDefs[0];
    var sdCivs = Array.isArray(sd.civilization) ? sd.civilization
               : (sd.civilization ? [sd.civilization] : []);
    var sdCostStr  = sd.cost  != null ? String(sd.cost)              : null;
    var sdPowerStr = sd.power != null ? sd.power.toLocaleString()    : null;
    return {
      name:            sd.name || "?",
      cost:            sdCostStr,
      costDetail:      sdCostStr,
      power:           sdPowerStr,
      powerDetail:     sdPowerStr,
      civilizations:   sdCivs,
      races:           Array.isArray(sd.races) ? sd.races : (sd.race ? [sd.race] : []),
      abilities:       Array.isArray(sd.abilities) ? sd.abilities : (sd.text ? [sd.text] : []),
      backgroundStyle: _withOverlay(getCivBackground(sdCivs)),
    };
  }

  // Name.
  var mergedName = slotDefs.map(function (def) { return def.name || "?"; }).join(" / ");

  // Cost: sum (compact) + sum＋breakdown (detail).
  var costVals = slotDefs.map(function (def) { return def.cost != null ? Number(def.cost) : null; });
  var validCosts = costVals.filter(function (c) { return c != null; });
  var mergedCost       = null;  // compact: sum only
  var mergedCostDetail = null;  // detail: "sum（a+b）"
  if (validCosts.length) {
    var costSum = validCosts.reduce(function (a, b) { return a + b; }, 0);
    mergedCost       = String(costSum);
    mergedCostDetail = validCosts.length > 1
      ? costSum + "（" + validCosts.join("+") + "）"
      : String(costSum);
  }

  // Power: sum (compact) + sum＋breakdown (detail).
  var powerVals = slotDefs.map(function (def) { return def.power != null ? Number(def.power) : null; });
  var validPowers = powerVals.filter(function (p) { return p != null; });
  var mergedPower       = null;
  var mergedPowerDetail = null;
  if (validPowers.length) {
    var powerSum = validPowers.reduce(function (a, b) { return a + b; }, 0);
    mergedPower       = powerSum.toLocaleString();
    mergedPowerDetail = validPowers.length > 1
      ? powerSum.toLocaleString() + "（" + validPowers.map(function (p) { return p.toLocaleString(); }).join("+") + "）"
      : validPowers[0].toLocaleString();
  }

  // Civilizations: union, keeping display order.
  var civSeen = {};
  var mergedCivs = [];
  slotDefs.forEach(function (def) {
    var civs = def.civilization
      ? (Array.isArray(def.civilization) ? def.civilization : [def.civilization])
      : [];
    civs.forEach(function (c) {
      if (!civSeen[c]) { civSeen[c] = true; mergedCivs.push(c); }
    });
  });

  // Races: union.
  var raceSeen = {};
  var mergedRaces = [];
  slotDefs.forEach(function (def) {
    var races = Array.isArray(def.races) ? def.races : (def.race ? [def.race] : []);
    races.forEach(function (r) {
      if (!raceSeen[r]) { raceSeen[r] = true; mergedRaces.push(r); }
    });
  });

  // Abilities: concatenated with dividers between cards.
  var mergedAbilities = [];
  slotDefs.forEach(function (def, i) {
    var abilities = Array.isArray(def.abilities) ? def.abilities : (def.text ? [def.text] : []);
    if (i > 0 && abilities.length) mergedAbilities.push("──────────");
    abilities.forEach(function (a) { mergedAbilities.push(a); });
  });

  return {
    name:            mergedName,
    cost:            mergedCost,        // sum only (for INFO zone)
    costDetail:      mergedCostDetail,  // sum + breakdown (for modal)
    power:           mergedPower,       // sum only (for INFO zone)
    powerDetail:     mergedPowerDetail, // sum + breakdown (for modal)
    civilizations:   mergedCivs,
    races:           mergedRaces,
    abilities:       mergedAbilities,
    backgroundStyle: _withOverlay(getCivBackground(mergedCivs)),
  };
}
