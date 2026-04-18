// Zone holds an ordered list of CardStack IDs (left → right).
// Zones do NOT directly hold cardIds — cards live inside stacks.
//
// ZONE_DEFINITIONS is the single source of truth for all zone metadata.
// ZONE_IDS and ZONE_DEFS_MAP are derived from it — do not edit them directly.

// ── Zone Definitions ─────────────────────────────────────────────────────────
//
// Ordered by move-select option order (the order that appears in move dropdowns).
//
// Fields:
//   id      — ZoneType string used in GameState (unchanged from previous values)
//   key     — UPPER_SNAKE_CASE key for the backward-compatible ZONE_IDS object
//   name    — English display name (stored in GameState zone.name)
//   ui: {
//     domId           — id of the <section> element rendered on the game board
//     cssClass        — CSS class appended after "zone " on the element
//     type            — "spread" | "stacked"
//                         spread:  cards spread out, individually selectable from board
//                         stacked: rendered as a single pile; clicking opens the modal
//     selectable      — true if clicking the zone background toggles select-all
//     modalVisibility — "all" | "hidden"  (stacked zones only)
//                         "hidden": card faces are hidden in the modal (deck search)
//                         "all":    card faces respect game-state isFaceDown
//     moveOptions     — [{ value, label, position }]
//                         value:    the <option> value / dropdown key
//                         label:    Japanese display text
//                         position: "top" | "bottom" — insertion position in reducer
//   }
//   initial: {
//     placement — "deck" | null
//                   "deck": this zone receives all initial deck cards on game start
//   }

const ZONE_DEFINITIONS = [
  {
    id:   "hand",
    key:  "HAND",
    name: "Hand",
    ui: {
      domId:      "zone-hand",
      cssClass:   "zone--spread",
      type:       "spread",
      selectable: true,
      moveOptions: [
        { value: "hand", label: "手札", position: "bottom" },
      ],
    },
    initial: { placement: null },
  },
  {
    id:   "resolutionZone",
    key:  "RESOLUTION_ZONE",
    name: "Resolution Zone",
    ui: {
      domId:      "zone-stack",     // DOM id intentionally differs from zone id
      cssClass:   "zone--spread",
      type:       "spread",
      selectable: true,
      moveOptions: [
        { value: "resolutionZone", label: "待機ゾーン", position: "bottom" },
      ],
    },
    initial: { placement: null },
  },
  {
    id:   "battlefield",
    key:  "BATTLEFIELD",
    name: "Battlefield",
    ui: {
      domId:      "zone-battlefield",
      cssClass:   "zone--spread",
      type:       "spread",
      selectable: true,
      moveOptions: [
        { value: "battlefield", label: "バトルゾーン", position: "bottom" },
      ],
    },
    initial: { placement: null },
  },
  {
    id:   "shield",
    key:  "SHIELD",
    name: "Shield",
    ui: {
      domId:      "zone-shield",
      cssClass:   "zone--spread",
      type:       "spread",
      selectable: true,
      moveOptions: [
        { value: "shield", label: "シールド", position: "bottom" },
      ],
    },
    initial: { placement: null },
  },
  {
    id:   "graveyard",
    key:  "GRAVEYARD",
    name: "Graveyard",
    ui: {
      domId:           "zone-graveyard",
      cssClass:        "compact-zone",
      type:            "stacked",
      selectable:      false,
      modalVisibility: "all",
      moveOptions: [
        { value: "graveyard", label: "墓地", position: "bottom" },
      ],
    },
    initial: { placement: null },
  },
  {
    id:   "mana",
    key:  "MANA",
    name: "Mana",
    ui: {
      domId:      "zone-mana",
      cssClass:   "zone--spread",
      type:       "spread",
      selectable: true,
      moveOptions: [
        { value: "mana", label: "マナ", position: "bottom" },
      ],
    },
    initial: { placement: null },
  },
  {
    id:   "deck",
    key:  "DECK",
    name: "Deck",
    ui: {
      domId:           "zone-deck",
      cssClass:        "compact-zone",
      type:            "stacked",
      selectable:      false,
      modalVisibility: "hidden",    // deck cards are face-down in the modal
      moveOptions: [
        { value: "deck-top",    label: "山札（上）", position: "top"    },
        { value: "deck-bottom", label: "山札（下）", position: "bottom" },
      ],
    },
    initial: { placement: "deck" }, // receives all initial deck cards
  },
  {
    id:   "ex",
    key:  "EX",
    name: "EX",
    ui: {
      domId:           "zone-ex",
      cssClass:        "compact-zone",
      type:            "stacked",
      selectable:      false,
      modalVisibility: "all",
      moveOptions: [
        { value: "ex", label: "EX", position: "bottom" },
      ],
    },
    initial: { placement: null },
  },
  {
    id:   "gr",
    key:  "GR",
    name: "GR",
    ui: {
      domId:           "zone-gr",
      cssClass:        "compact-zone",
      type:            "stacked",
      selectable:      false,
      modalVisibility: "all",
      moveOptions: [
        { value: "gr", label: "GR", position: "bottom" },
      ],
    },
    initial: { placement: null },
  },
];

// ── Derived constants ─────────────────────────────────────────────────────────

// Backward-compatible ZONE_IDS object: UPPER_SNAKE_CASE key → zone id string.
//   e.g.  ZONE_IDS.DECK            === "deck"
//         ZONE_IDS.RESOLUTION_ZONE === "resolutionZone"
const ZONE_IDS = (function () {
  var ids = {};
  ZONE_DEFINITIONS.forEach(function (def) { ids[def.key] = def.id; });
  return ids;
}());

// O(1) lookup: zone id → ZoneDefinition.
const ZONE_DEFS_MAP = (function () {
  var map = {};
  ZONE_DEFINITIONS.forEach(function (def) { map[def.id] = def; });
  return map;
}());

// ── Zone factory ─────────────────────────────────────────────────────────────

function createZone(id, name) {
  return {
    id:       id,
    name:     name,
    stackIds: [],
  };
}
