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
  var info   = getDisplayInfo(def);
  var civs   = getCivList(def);
  var civBg  = getCivBackground(civs);
  var isTwin = !!(def && def.type === "twin");

  var vm = {
    id:              card.id,
    name:            info.name,
    cost:            info.cost,
    power:           info.power,
    civilizations:   civs,
    backgroundStyle: _withOverlay(civBg),
    isFaceDown:      card.isFaceDown,
    isTwin:          isTwin,
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
