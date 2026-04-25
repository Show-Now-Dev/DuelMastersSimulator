// parser/cardParser.js
//
// Parses Duel Masters Wiki card text into CardDefinition objects.
// Spec: docs/CARD_FORMAT.md
//
// Pure function — no DOM access, no side effects.
//
// Entry point:
//   parseCardText(text) → { card: CardDefinition | null, errors: string[] }

(function () {

  // ── Civilization mapping ──────────────────────────────────────────────────
  // Source: CARD_FORMAT.md §General Rules ("文明" suffix is stripped before lookup)

  var CIV_MAP = {
    '光':   'light',
    '水':   'water',
    '闇':   'darkness',
    '火':   'fire',
    '自然': 'nature',
  };

  // ── Whitespace: matches full-width (U+3000) and half-width space/tab ──────

  var WS  = '[\\s\\u3000]';     // one whitespace char
  var WSP = '[\\s\\u3000]+';    // one or more whitespace chars

  // ── Civilization string → string[] ───────────────────────────────────────
  //
  // "光文明"              → ["light"]
  // "光/水/闇/火/自然文明" → ["light","water","darkness","fire","nature"]
  // "無色"               → []   (colorless — no civilizations)

  function parseCivilizationString(str) {
    if (!str) return [];
    var s = str.trim();
    if (s === '無色') return [];
    // Strip trailing 文明 (only the last occurrence, covering "光/水文明")
    s = s.replace(/文明$/, '');
    return s.split('/').reduce(function (acc, part) {
      var c = CIV_MAP[part.trim()];
      if (c && acc.indexOf(c) === -1) acc.push(c);
      return acc;
    }, []);
  }

  // ── Header line parser ────────────────────────────────────────────────────
  //
  // Format: カード名　レアリティ　文明　(コスト)
  //
  // Strategy: strip the last three whitespace-separated fields from the right.
  //   1. cost   → token matching \(\d+\) at end
  //   2. civ    → token ending with 文明 or equal to 無色
  //   3. rarity → any remaining last token
  //   4. name   → everything before rarity (preserves internal spaces)
  //
  // Returns { name, civilization, cost } or null on failure.

  function parseHeaderLine(line) {
    // Normalize full-width parentheses（）to half-width () so cost parsing works
    // regardless of which bracket style the user pastes from the wiki.
    var s = line.trim().replace(/（/g, '(').replace(/）/g, ')');

    // Step 1 — strip cost: "...(6)" or "...(∞)"
    var costRe = new RegExp('\\(([\\d∞]+)\\)' + WS + '*$');
    var costM  = s.match(costRe);
    if (!costM) return null;
    var cost = costM[1] === '∞' ? '∞' : parseInt(costM[1], 10);
    s = s.slice(0, costM.index).replace(new RegExp(WSP + '$'), '');

    // Step 2 — strip civilization: last token ending in 文明 or equal to 無色,
    // optionally followed by a bracket annotation such as [ジョーカーズ].
    // Captures: group2 = civ string, group3 = bracket tag (may be undefined).
    var civRe = new RegExp('(' + WSP + ')([^\\s\\u3000]+文明|無色)(\\[[^\\]]*\\])?$');
    var civM  = s.match(civRe);
    if (!civM) return null;
    var civStr  = civM[2];                   // "無色" / "水/闇文明" etc. — no bracket
    var civTag  = civM[3]                    // "[ジョーカーズ]" or undefined
                  ? civM[3].slice(1, -1)     // strip the surrounding [ ]
                  : null;
    s = s.slice(0, s.length - civM[0].length);

    // Step 3 — strip rarity: last non-whitespace token
    var rarityRe = new RegExp('(' + WSP + ')(\\S+)$');
    var rarityM  = s.match(rarityRe);
    if (!rarityM) return null;
    s = s.slice(0, s.length - rarityM[0].length);

    var name = s.trim();
    if (!name) return null;

    return {
      name:         name,
      civilization: parseCivilizationString(civStr),
      cost:         cost,
      rarity:       rarityM[2],
      jokers:       civTag === 'ジョーカーズ',
    };
  }

  // ── Type line parser ──────────────────────────────────────────────────────
  //
  // Creature formats (CARD_FORMAT.md §1):
  //   クリーチャー：種族　パワー
  //   進化クリーチャー：種族　パワー
  //   G-NEOクリーチャー：種族　パワー
  //   エグザイル・クリーチャー：種族1/種族2　パワー
  //   (any type label containing "クリーチャー" before "：")
  //
  // Non-creature formats (CARD_FORMAT.md §2):
  //   呪文  /  呪文：サブタイプ
  //   タマシード：種族1/種族2
  //   D2フィールド  /  クロスギア  / etc.
  //
  // Returns { type: string, races: string[], power: number | null }

  function parseTypeLine(line) {
    if (!line || !line.trim()) {
      return { type: 'unknown', races: [], power: null };
    }
    var s = line.trim();

    // ── Creature branch ───────────────────────────────────────────────────
    if (s.indexOf('クリーチャー') !== -1) {
      var colonIdx = s.indexOf('：');
      if (colonIdx === -1) {
        // No colon: bare "クリーチャー" — use the whole line as the type label.
        return { type: s.trim(), races: [], power: null };
      }

      // Use the text before '：' as the type label (e.g. "進化クリーチャー").
      var typeLabel  = s.slice(0, colonIdx).trim();
      var afterColon = s.slice(colonIdx + 1).trim();

      // Power: last whitespace-separated token — integer (possibly negative), \d+\+?, or ∞.
      var powerRe = new RegExp('(' + WSP + ')(-\\d+|\\d+\\+?|∞)$');
      var powerM  = afterColon.match(powerRe);
      var power   = null;
      var racePart = afterColon;

      if (powerM) {
        power    = powerM[2] === '∞' ? '∞' : parseInt(powerM[2], 10);
        racePart = afterColon.slice(0, afterColon.length - powerM[0].length).trim();
      }

      var races = racePart
        ? racePart.split('/').map(function (r) { return r.trim(); }).filter(Boolean)
        : [];

      return { type: typeLabel, races: races, power: power };
    }

    // ── Non-creature branch ───────────────────────────────────────────────
    // Store the Japanese type string as-is (no English mapping).
    var colonIdx2 = s.indexOf('：');
    var typeName  = colonIdx2 !== -1 ? s.slice(0, colonIdx2).trim() : s;

    // Races: only extracted for タマシード
    var races2 = [];
    if (colonIdx2 !== -1 && typeName === 'タマシード') {
      races2 = s.slice(colonIdx2 + 1).trim()
        .split('/').map(function (r) { return r.trim(); }).filter(Boolean);
    }

    return { type: typeName, races: races2, power: null };
  }

  // ── Single block → single CardDefinition ─────────────────────────────────
  //
  // lines: string[] — trimmed, non-empty lines of one card block.
  //   lines[0] → header
  //   lines[1] → type line
  //   lines[2+] → abilities

  // ── Reading line parser ───────────────────────────────────────────────────
  //
  // If the first line of a block matches 《...》 (full-width angle brackets),
  // the inner text is extracted as the card's reading (読み仮名) and the
  // remaining lines are used for normal parsing.
  //
  // Returns { reading: string|null, lines: string[] }

  function extractReadingLine(lines) {
    if (lines.length > 0 && /^《(.+)》$/.test(lines[0])) {
      return {
        reading: lines[0].slice(1, -1),
        lines:   lines.slice(1),
      };
    }
    return { reading: null, lines: lines };
  }

  function parseSingleCard(lines) {
    var errors = [];

    // Extract optional reading line before parsing the rest
    var extracted = extractReadingLine(lines);
    var reading   = extracted.reading;
    var cardLines = extracted.lines;

    var header = parseHeaderLine(cardLines[0]);
    if (!header) {
      errors.push('ヘッダー行の解析に失敗しました: ' + (cardLines[0] || lines[0]));
      return { card: null, errors: errors };
    }

    if (cardLines.length < 2) {
      errors.push('タイプ行がありません (カード: ' + header.name + ')');
      return { card: null, errors: errors };
    }

    var typeInfo  = parseTypeLine(cardLines[1]);
    var abilities = cardLines.slice(2).map(function (l) { return l.trim(); }).filter(Boolean);

    var card = {
      name:         header.name,
      civilization: header.civilization,
      cost:         header.cost,
      rarity:       header.rarity,
      type:         typeInfo.type,
      races:        typeInfo.races,
      power:        typeInfo.power,
      abilities:    abilities,
      mana:         1,
      jokers:       header.jokers || false,
    };

    if (reading != null) card.reading = reading;

    return { card: card, errors: errors };
  }

  // ── Two blocks → twin pact CardDefinition ────────────────────────────────
  //
  // CARD_FORMAT.md §3 — Expected output:
  //   { type: "twin", name: "A / B", sides: [sideA, sideB] }

  function parseTwinPact(blockA, blockB) {
    // Extract reading from blockA's first line if present.
    // Format: 《上面読み仮名／下面読み仮名》 — split by full-width slash ／
    var readingA = null;
    var readingB = null;
    var actualBlockA = blockA;
    if (blockA.length > 0 && /^《(.+)》$/.test(blockA[0])) {
      var fullReading = blockA[0].slice(1, -1);
      actualBlockA = blockA.slice(1);
      var parts = fullReading.split('／');
      readingA = (parts[0] || '').trim() || null;
      readingB = (parts[1] || '').trim() || null;
    }

    var rA = parseSingleCard(actualBlockA);
    var rB = parseSingleCard(blockB);
    var errors = rA.errors.concat(rB.errors);

    if (!rA.card || !rB.card) {
      return { card: null, errors: errors };
    }

    if (readingA != null) rA.card.reading = readingA;
    if (readingB != null) rB.card.reading = readingB;

    var card = {
      name:  rA.card.name + ' / ' + rB.card.name,
      type:  'twin',
      mana:  1,
      sides: [rA.card, rB.card],
    };

    return { card: card, errors: errors };
  }

  // ── Split raw text into card blocks ───────────────────────────────────────
  //
  // Blocks are separated by empty (or whitespace-only) lines.
  // "---" document separator lines are stripped before splitting.

  function splitBlocks(text) {
    var normalized = text
      .replace(/\r\n/g, '\n')
      .replace(/^[ \t\u3000]*---[ \t\u3000]*$/gm, ''); // strip markdown rulers

    var rawBlocks = normalized.split(/\n[ \t\u3000]*\n/);

    return rawBlocks.map(function (block) {
      return block.split('\n')
        .map(function (l) { return l.trim(); })
        .filter(function (l) { return l.length > 0; });
    }).filter(function (block) { return block.length > 0; });
  }

  // ── Main entry point ──────────────────────────────────────────────────────
  //
  // parseCardText(text)
  // Returns { card: CardDefinition | null, errors: string[] }
  //
  // Dispatches to:
  //   1 block  → parseSingleCard
  //   2 blocks → parseTwinPact (CARD_FORMAT.md §3)
  //   0 blocks → error

  function parseCardText(text) {
    if (!text || !text.trim()) {
      return { card: null, errors: ['テキストが空です'] };
    }

    var blocks = splitBlocks(text);

    if (blocks.length === 0) {
      return { card: null, errors: ['有効なテキストが見つかりません'] };
    }

    if (blocks.length === 1) {
      return parseSingleCard(blocks[0]);
    }

    if (blocks.length === 2) {
      return parseTwinPact(blocks[0], blocks[1]);
    }

    // More than 2 blocks: parse first two as twin, warn about extras.
    var result = parseTwinPact(blocks[0], blocks[1]);
    result.errors.push(
      '警告: ' + blocks.length + ' ブロックを検出しました。最初の2つをツインパクトとして解析しました。'
    );
    return result;
  }

  // ── Export ────────────────────────────────────────────────────────────────
  window.parseCardText = parseCardText;

})();
