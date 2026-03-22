// parser/cardParser.js
//
// Parses wiki-format card text into a CardDefinition-shaped object.
// Pure function — no DOM access, no side effects.
//
// Supported input format (key: value lines, full/half-width colons, ■ bullets):
//
//   ボルシャック・ドラゴン
//   文明：火
//   コスト：6
//   種類：クリーチャー
//   種族：アーマード・ドラゴン
//   パワー：6000
//   テキスト：スピードアタッカー
//
// Returns a CardDefinition object, or null if parsing fails.

(function () {

  // ── Mapping tables ──────────────────────────────────────────────────────────

  var CIV_MAP = {
    '光':   'light',
    '水':   'water',
    '闇':   'darkness',
    '火':   'fire',
    '自然': 'nature',
  };

  var TYPE_MAP = {
    'クリーチャー':   'creature',
    '呪文':          'spell',
    'ツインパクト':  'twin',
    'クロスギア':    'crossgear',
    'フォートレス':  'fortress',
    'タマシード':    'tamaseed',
    'オーラ':        'aura',
  };

  var RARITY_MAP = {
    'コモン': 'common',     'C':  'common',
    'アンコモン': 'uncommon', 'UC': 'uncommon',
    'レア': 'rare',          'R':  'rare',
    'ベリーレア': 'very_rare', 'VR': 'very_rare',
    'スーパーレア': 'super_rare', 'SR': 'super_rare',
    'レジェンドレア': 'legend_rare', 'LR': 'legend_rare',
    'マスターレア': 'master_rare', 'MR': 'master_rare',
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  // Parse "火" or "火/自然" or "火・自然" into civilization array.
  function parseCivilization(str) {
    if (!str) return [];
    var parts = str.split(/[\/・,、\s]+/);
    var civs  = [];
    parts.forEach(function (p) {
      var c = CIV_MAP[p.trim()];
      if (c && civs.indexOf(c) === -1) civs.push(c);
    });
    return civs;
  }

  // Extract first integer from a string (e.g. "6" or "(6)" or "6000").
  function parseNumber(str) {
    var m = str.match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

  function parseType(str) {
    var t = str.trim();
    return TYPE_MAP[t] || t.toLowerCase();
  }

  function parseRarity(str) {
    var t = str.trim();
    return RARITY_MAP[t] || t;
  }

  // Split a line into [label, value] around the first ： or :
  // Strips leading ■ • ※ ◆ decorators.
  // Returns [null, line] when no separator is found.
  function splitLabelValue(line) {
    var cleaned = line.replace(/^[■•※◆]\s*/, '');
    var idx = cleaned.search(/[：:]/);
    if (idx !== -1) {
      return [cleaned.slice(0, idx).trim(), cleaned.slice(idx + 1).trim()];
    }
    // Tab-separated (table paste)
    var tab = cleaned.indexOf('\t');
    if (tab !== -1) {
      return [cleaned.slice(0, tab).trim(), cleaned.slice(tab + 1).trim()];
    }
    return [null, cleaned.trim()];
  }

  // Map a Japanese label string to a canonical field key, or null.
  function normalizeLabel(label) {
    if (!label) return null;
    var L = label.trim();
    if (/^(名前|カード名)$/.test(L))                    return 'name';
    if (/^(文明|文明色)$/.test(L))                      return 'civilization';
    if (/^(コスト|マナコスト|使用マナ)$/.test(L))       return 'cost';
    if (/^(種類|タイプ|カードタイプ|カード種別)$/.test(L)) return 'type';
    if (/^(種族|クリーチャータイプ)$/.test(L))          return 'race';
    if (/^(パワー|P)$/.test(L))                         return 'power';
    if (/^(テキスト|効果|能力テキスト|テキスト・フレーバー)$/.test(L)) return 'text';
    if (/^(レアリティ|希少度|レア度)$/.test(L))         return 'rarity';
    if (/^(マナ|マナ数)$/.test(L))                      return 'mana';
    return null;
  }

  // Generate a stable card ID from a card name.
  function generateCardId(name) {
    var slug = name
      .replace(/\s+/g, '-')
      .replace(/[^\w\u3000-\u9fff\u30a0-\u30ff\u3040-\u309f\uff00-\uffef-]+/g, '')
      .toLowerCase()
      .slice(0, 40);
    var rand = Math.random().toString(36).slice(2, 6);
    return 'card_' + (slug || 'unknown') + '_' + rand;
  }

  // ── Main parser ─────────────────────────────────────────────────────────────

  function parseCardText(text) {
    if (!text || !text.trim()) return null;

    var lines        = text.split(/\r?\n/);
    var fields       = {};       // canonical key → raw string
    var abilityLines = [];       // collected ability/text lines
    var candidateName = null;    // first unlabeled line → name

    lines.forEach(function (rawLine) {
      var line = rawLine.trim();
      if (!line) return;

      var pair  = splitLabelValue(line);
      var label = normalizeLabel(pair[0]);
      var value = pair[1];

      if (label) {
        if (label === 'text') {
          if (value) abilityLines.push(value);
        } else {
          fields[label] = value;
        }
        return;
      }

      // No recognized label.
      // Lines that start with ■/•/※ (after stripping) are ability text.
      if (/^[■•※◆]/.test(rawLine.trim())) {
        var clean = rawLine.trim().replace(/^[■•※◆]\s*/, '');
        if (clean) abilityLines.push(clean);
        return;
      }

      // First unlabeled, non-decorated line is treated as the card name.
      if (!candidateName) {
        candidateName = line;
        return;
      }

      // Remaining unlabeled lines → ability text.
      abilityLines.push(line);
    });

    var name = fields.name || candidateName;
    if (!name) return null;

    var civs = parseCivilization(fields.civilization || '');
    var cost   = fields.cost != null    ? parseNumber(fields.cost)   : null;
    var power  = fields.power != null   ? parseNumber(fields.power)  : null;
    var mana   = fields.mana != null    ? parseNumber(fields.mana)   : 1;
    var type   = fields.type            ? parseType(fields.type)     : 'creature';
    var race   = fields.race            || null;
    var rarity = fields.rarity          ? parseRarity(fields.rarity) : null;

    var def = {
      id:           generateCardId(name),
      name:         name,
      type:         type,
      civilization: civs.length === 1 ? civs[0] : (civs.length > 1 ? civs : null),
      cost:         cost,
      race:         race,
      power:        power,
      mana:         mana != null ? mana : 1,
      abilities:    abilityLines,
    };

    if (rarity) def.rarity = rarity;

    return def;
  }

  // ── Export ──────────────────────────────────────────────────────────────────
  window.parseCardText = parseCardText;

})();
