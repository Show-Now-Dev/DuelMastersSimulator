// config/zoneTypes.js
//
// Zone classification config for CardDefinitions.
//
// ZONE_TYPE_KEYWORDS maps zone IDs to keyword arrays.
// A card whose "type" string contains any keyword is auto-assigned to that zone.
// "main" is the default fallback zone.
//
// To add a new zone or new card type keywords, edit this file only —
// no changes to parser, repository, or UI logic are required.
//
// Zone IDs:
//   "main"          — standard 40-card main deck
//   "hyperspatial"  — 超次元ゾーン (max 8 cards, same-name 4 limit)
//   "superGR"       — 超GRゾーン (0 or 12 cards, same-name 2 limit)

var ZONE_TYPE_KEYWORDS = {
  hyperspatial: ['サイキック', 'ドラグハート', 'ルール・プラス', 'デュエルメイト'],
  superGR:      ['GR'],
};

// Detect zone from a card type string.
// Returns 'hyperspatial', 'superGR', or 'main' (default).
function detectZone(typeString) {
  if (!typeString) return 'main';
  for (var zone in ZONE_TYPE_KEYWORDS) {
    var keywords = ZONE_TYPE_KEYWORDS[zone];
    for (var i = 0; i < keywords.length; i++) {
      if (typeString.indexOf(keywords[i]) !== -1) return zone;
    }
  }
  return 'main';
}

// Human-readable label for each zone.
var ZONE_LABELS = {
  main:         'メイン',
  hyperspatial: '超次元',
  superGR:      '超GR',
};

// Deck constraints per zone.
var ZONE_LIMITS = {
  main:         { max: 40, sameNameMax: 4 },
  hyperspatial: { max: 8,  sameNameMax: 4 },
  superGR:      { max: 12, sameNameMax: 2, mustBeZeroOrMax: true },
};
