// ui/cardEditor/cardEditor.js
//
// Card editor UI module.
// Renders a paste-and-parse interface for registering new CardDefinitions.
//
// Rules:
//   - No game state access
//   - No DOM manipulation outside the provided container
//   - Delegates parsing to parser/cardParser.js
//   - Delegates persistence to storage/cardStorage.js

var CardEditor = (function () {

  var _container = null;
  var _onSave    = null;  // callback(savedCardDef) — called after a card is saved

  // Mount the editor into a container element.
  // onSave(cardDef) is called each time a card is successfully saved.
  function init(container, onSave) {
    _container = container;
    _onSave    = onSave;
    _render();
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  function _render() {
    _container.innerHTML = '';

    var heading = _el('h2', { textContent: 'カード登録' });
    var desc    = _el('p',  {
      className: 'screen-desc',
      textContent: 'Wikiからコピーしたカードテキストを貼り付けてパースします。ツインパクトは上面と下面の間1行だけ空けてね',
    });

    // Card import buttons
    var importRow = _el('div', { className: 'card-editor__io-row' });

    function _onCardImport(result) {
      if (!result.ok) { alert('インポート失敗: ' + result.error); return; }
      var s = result.stats;
      var msg = 'インポート完了: 新規 ' + s.added + ' 枚、更新 ' + s.updated + ' 枚、スキップ ' + s.skipped + ' 枚';
      if (result.errors && result.errors.length) msg += '\n警告:\n' + result.errors.join('\n');
      alert(msg);
    }

    var importBtn = _el('button', { className: 'btn btn--small', textContent: 'カード読込（ファイル）' });
    importBtn.addEventListener('click', function () { ImportHelper.trigger(_onCardImport); });

    var importTextBtn = _el('button', { className: 'btn btn--small', textContent: 'カード読込（テキスト）' });
    importTextBtn.addEventListener('click', function () { ImportHelper.triggerText(_onCardImport); });

    importRow.appendChild(importBtn);
    importRow.appendChild(importTextBtn);

    var textarea = document.createElement('textarea');
    textarea.className   = 'card-editor__input';
    textarea.rows        = 10;
    textarea.placeholder = [
      '(サンプル)超越男　P(R)　光/水/闇/火/自然文明　(5)',
      'クリーチャー：アウトレイジ/へドリアン/シノビ/ダイナモ/ハンター/チルドレン/ロスト・クルセイダー/カレーパン/ピアニスト/ワールドアイドル　2000+',
      'U・ソウル',
      'S・トリガー',
      'S・バック：多色',
      'シールド・ゴー',
      'ニンジャ・ストライク 5',
      'ロスト・プリズム',
      'ガードマン',
      'スレイヤー',
      'エスケープ',
      'パワーアタッカー+1000',
      'ハンティング',
      'ダイナモ',
    ].join('\n');

    var parseBtn  = _el('button', { className: 'btn', textContent: '解析する' });
    var clearBtn  = _el('button', { className: 'btn', textContent: 'クリア' });

    var preview = _el('div', { className: 'card-editor__preview' });

    var saveBtn = _el('button', {
      className: 'btn btn--primary',
      textContent: 'カードを保存',
    });
    saveBtn.disabled = true;

    var currentParsed = null;

    clearBtn.addEventListener('click', function () {
      textarea.value    = '';
      preview.innerHTML = '';
      saveBtn.disabled  = true;
      currentParsed     = null;
    });

    parseBtn.addEventListener('click', function () {
      // parseCardText now returns { card, errors } per CARD_FORMAT.md spec.
      var result = parseCardText(textarea.value);
      if (!result.card) {
        var errMsg = result.errors.length ? result.errors.join(' / ') : '解析失敗';
        preview.innerHTML = '<p class="msg msg--error">解析失敗: ' + errMsg + '</p>';
        saveBtn.disabled  = true;
        currentParsed     = null;
        return;
      }
      currentParsed     = result.card;
      preview.innerHTML = _buildPreviewHTML(result.card);
      // Show non-fatal warnings if any
      if (result.errors.length) {
        preview.innerHTML += '<p class="msg msg--error">警告: ' + result.errors.join(' / ') + '</p>';
      }
      saveBtn.disabled = false;
    });

    saveBtn.addEventListener('click', function () {
      if (!currentParsed) return;

      // Delegate to CardRepository — never call CardStorage directly from UI.
      var saveResult = CardRepository.addCard(currentParsed);
      if (!saveResult.ok) {
        preview.innerHTML += '<p class="msg msg--error">保存失敗: ' + saveResult.error + '</p>';
        return;
      }

      var savedCard = currentParsed;

      var msg = _el('p', { className: 'msg msg--success', textContent: '保存しました！' });
      preview.appendChild(msg);
      saveBtn.disabled  = true;
      textarea.value    = '';
      currentParsed     = null;

      if (_onSave) _onSave(savedCard);
    });

    _container.appendChild(heading);
    _container.appendChild(desc);
    _container.appendChild(importRow);
    _container.appendChild(textarea);
    _container.appendChild(parseBtn);
    _container.appendChild(clearBtn);
    _container.appendChild(preview);
    _container.appendChild(saveBtn);
  }

  // Build preview HTML for a parsed CardDefinition.
  // Handles single cards and twin pact cards (type: "twin").
  function _buildPreviewHTML(def) {
    if (def.type === 'twin') {
      var partsHTML = (def.sides || []).map(function (side, i) {
        return '<div class="card-preview__twin-label">Side ' + (i + 1) + ': ' + (side.name || '—') + '</div>'
          + _buildSideTableHTML(side);
      }).join('');
      return '<div class="card-preview">'
        + '<div class="card-preview__twin-name">' + def.name + ' <em>(ツインパクト)</em></div>'
        + partsHTML
        + '</div>';
    }
    return '<div class="card-preview">' + _buildSideTableHTML(def) + '</div>';
  }

  // Build one <table> for a card or side.
  function _buildSideTableHTML(def) {
    var civs = Array.isArray(def.civilization)
      ? def.civilization.join(', ')
      : (def.civilization || '—');

    var races = Array.isArray(def.races) && def.races.length
      ? def.races.join(' / ')
      : (def.race || '—');

    var rows = [
      ['名前',   def.name  || '—'],
      ['文明',   civs],
      ['コスト', def.cost  != null ? def.cost  : '—'],
      ['種類',   def.type  || '—'],
      ['種族',   races],
      ['パワー', def.power != null ? def.power : '—'],
    ];

    if (def.abilities && def.abilities.length) {
      rows.push(['テキスト', def.abilities.join('<br>')]);
    }

    var trs = rows.map(function (row) {
      return '<tr><th>' + row[0] + '</th><td>' + row[1] + '</td></tr>';
    }).join('');

    return '<table class="card-preview__table"><tbody>' + trs + '</tbody></table>';
  }

  // ── Minimal DOM helper ──────────────────────────────────────────────────────

  function _el(tag, props) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) { el[k] = props[k]; });
    return el;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  return { init: init };

})();
