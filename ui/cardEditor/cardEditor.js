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
      textContent: 'Wikiからコピーしたカードテキストを貼り付けてパースします。',
    });

    var textarea = document.createElement('textarea');
    textarea.className   = 'card-editor__input';
    textarea.rows        = 10;
    textarea.placeholder = [
      '名前：ボルシャック・ドラゴン',
      '文明：火',
      'コスト：6',
      '種類：クリーチャー',
      '種族：アーマード・ドラゴン',
      'パワー：6000',
      'テキスト：スピードアタッカー',
    ].join('\n');

    var parseBtn = _el('button', { className: 'btn', textContent: '解析する' });

    var preview = _el('div', { className: 'card-editor__preview' });

    var saveBtn = _el('button', {
      className: 'btn btn--primary',
      textContent: 'カードを保存',
    });
    saveBtn.disabled = true;

    var currentParsed = null;

    parseBtn.addEventListener('click', function () {
      var result = parseCardText(textarea.value);
      if (!result) {
        preview.innerHTML = '<p class="msg msg--error">解析失敗: カード名が見つかりませんでした。</p>';
        saveBtn.disabled  = true;
        currentParsed     = null;
        return;
      }
      currentParsed    = result;
      preview.innerHTML = _buildPreviewHTML(result);
      saveBtn.disabled  = false;
    });

    saveBtn.addEventListener('click', function () {
      if (!currentParsed) return;

      var existing = CardStorage.loadCards();

      // If a card with the same name already exists, update it (keep its ID).
      var idx = -1;
      for (var i = 0; i < existing.length; i++) {
        if (existing[i].name === currentParsed.name) { idx = i; break; }
      }
      if (idx !== -1) {
        currentParsed = Object.assign({}, currentParsed, { id: existing[idx].id });
        existing[idx] = currentParsed;
      } else {
        existing.push(currentParsed);
      }

      CardStorage.saveCards(existing);

      var msg = _el('p', { className: 'msg msg--success', textContent: '保存しました！' });
      preview.appendChild(msg);
      saveBtn.disabled = true;

      if (_onSave) _onSave(currentParsed);
    });

    _container.appendChild(heading);
    _container.appendChild(desc);
    _container.appendChild(textarea);
    _container.appendChild(parseBtn);
    _container.appendChild(preview);
    _container.appendChild(saveBtn);
  }

  // Build the card preview table HTML string.
  function _buildPreviewHTML(def) {
    var civs = Array.isArray(def.civilization)
      ? def.civilization.join(', ')
      : (def.civilization || '—');

    var rows = [
      ['名前',   def.name],
      ['文明',   civs],
      ['コスト', def.cost   != null ? def.cost  : '—'],
      ['種類',   def.type   || '—'],
      ['種族',   def.race   || '—'],
      ['パワー', def.power  != null ? def.power : '—'],
    ];

    if (def.abilities && def.abilities.length) {
      rows.push(['テキスト', def.abilities.join('<br>')]);
    }

    var trs = rows.map(function (row) {
      return '<tr><th>' + row[0] + '</th><td>' + row[1] + '</td></tr>';
    }).join('');

    return '<div class="card-preview"><table class="card-preview__table"><tbody>' + trs + '</tbody></table></div>';
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
