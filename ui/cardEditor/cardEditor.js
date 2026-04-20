// ui/cardEditor/cardEditor.js
//
// Card editor UI module.
// Renders a paste-and-parse interface for registering new CardDefinitions.
//
// Rules:
//   - No game state access
//   - No DOM manipulation outside the provided container
//   - Delegates parsing to parser/cardParser.js
//   - Delegates persistence to CardRepository
//
// Zones:
//   メイン     — single textarea, twin-pact via blank-line delimiter (existing behaviour)
//   超次元     — 2 textareas (face1/face2) + optional 3rd face; builds forms[] card
//   超GR       — single textarea; same as メイン but zone forced to "superGR"

var CardEditor = (function () {

  var _container = null;
  var _onSave    = null;   // callback(savedCardDef)
  var _zone      = 'main'; // persists across tab switches

  function init(container, onSave) {
    _container = container;
    _onSave    = onSave;
    _render();
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  function _render() {
    _container.innerHTML = '';

    _container.appendChild(_el('h2', { textContent: 'カード登録' }));
    _container.appendChild(_el('p', {
      className:   'screen-desc',
      textContent: 'Wikiからコピーしたカードテキストを貼り付けてパースします。',
    }));

    // Import buttons
    var importRow = _el('div', { className: 'card-editor__io-row' });
    function _onCardImport(result) {
      if (!result.ok) { alert('インポート失敗: ' + result.error); return; }
      var s   = result.stats;
      var msg = 'インポート完了: 新規 ' + s.added + ' 枚、更新 ' + s.updated + ' 枚、スキップ ' + s.skipped + ' 枚';
      if (result.errors && result.errors.length) msg += '\n警告:\n' + result.errors.join('\n');
      alert(msg);
    }
    var importBtn     = _el('button', { className: 'btn btn--small', textContent: 'カード読込（ファイル）' });
    importBtn.addEventListener('click', function () { ImportHelper.trigger(_onCardImport); });
    var importTextBtn = _el('button', { className: 'btn btn--small', textContent: 'カード読込（テキスト）' });
    importTextBtn.addEventListener('click', function () { ImportHelper.triggerText(_onCardImport); });
    importRow.appendChild(importBtn);
    importRow.appendChild(importTextBtn);
    _container.appendChild(importRow);

    // Zone tabs
    _container.appendChild(_buildZoneTabs());

    // Zone hint
    var hint = _el('p', { className: 'card-editor__zone-hint screen-desc' });
    if (_zone === 'main') {
      hint.textContent = 'ツインパクトは上面と下面の間1行だけ空けてください。';
    } else if (_zone === 'hyperspatial') {
      hint.textContent = '面ごとにwikiテキストを貼り付けてください。各面は独立して解析されます。';
    } else {
      hint.textContent = 'GRクリーチャーのテキストを貼り付けてください。';
    }
    _container.appendChild(hint);

    // Shared state: parse result + save button (set by zone-specific input handler)
    var currentParsed = null;
    var preview = _el('div', { className: 'card-editor__preview' });
    var saveBtn = _el('button', { className: 'btn btn--primary', textContent: 'カードを保存' });
    saveBtn.disabled = true;

    function setParsed(card) { currentParsed = card; }

    // Zone-specific input area
    if (_zone === 'main') {
      _addMainInputs(_container, preview, saveBtn, setParsed);
    } else if (_zone === 'hyperspatial') {
      _addHyperspatialInputs(_container, preview, saveBtn, setParsed);
    } else {
      _addSuperGRInputs(_container, preview, saveBtn, setParsed);
    }

    _container.appendChild(preview);
    _container.appendChild(saveBtn);

    saveBtn.addEventListener('click', function () {
      if (!currentParsed) return;
      var saveResult = CardRepository.addCard(currentParsed);
      if (!saveResult.ok) {
        preview.innerHTML += '<p class="msg msg--error">保存失敗: ' + saveResult.error + '</p>';
        return;
      }
      var savedCard = currentParsed;
      preview.appendChild(_el('p', { className: 'msg msg--success', textContent: '保存しました！' }));
      saveBtn.disabled = true;
      currentParsed = null;
      if (_onSave) _onSave(savedCard);
    });
  }

  // ── Zone tab row ─────────────────────────────────────────────────────────────

  function _buildZoneTabs() {
    var zones = [
      { id: 'main', label: 'メイン' },
      { id: 'hyperspatial', label: '超次元' },
      { id: 'superGR', label: '超GR' },
    ];
    var row = _el('div', { className: 'zone-tab-row' });
    zones.forEach(function (z) {
      var btn = _el('button', {
        className:   'zone-tab' + (_zone === z.id ? ' is-active' : ''),
        textContent: z.label,
      });
      btn.addEventListener('click', function () {
        if (_zone === z.id) return;
        _zone = z.id;
        _render();
      });
      row.appendChild(btn);
    });
    return row;
  }

  // ── メイン input ─────────────────────────────────────────────────────────────

  function _addMainInputs(container, preview, saveBtn, setParsed) {
    var textarea     = document.createElement('textarea');
    textarea.className   = 'card-editor__input';
    textarea.rows        = 10;
    textarea.placeholder = [
      '(サンプル)超越男　P(R)　光/水/闇/火/自然文明　(5)',
      'クリーチャー：アウトレイジ/ハンター　2000+',
      'S・トリガー',
    ].join('\n');

    var parseBtn = _el('button', { className: 'btn', textContent: '解析する' });
    var clearBtn = _el('button', { className: 'btn', textContent: 'クリア' });

    parseBtn.addEventListener('click', function () {
      var result = parseCardText(textarea.value);
      if (!result.card) {
        preview.innerHTML = '<p class="msg msg--error">解析失敗: ' + (result.errors.join(' / ') || '解析失敗') + '</p>';
        saveBtn.disabled = true;
        setParsed(null);
        return;
      }
      var card = Object.assign({}, result.card);
      if (!card.zone) card.zone = detectZone(card.type || '');
      setParsed(card);
      preview.innerHTML = _buildPreviewHTML(card);
      if (result.errors.length) {
        preview.innerHTML += '<p class="msg msg--error">警告: ' + result.errors.join(' / ') + '</p>';
      }
      saveBtn.disabled = false;
    });

    clearBtn.addEventListener('click', function () {
      textarea.value    = '';
      preview.innerHTML = '';
      saveBtn.disabled  = true;
      setParsed(null);
    });

    container.appendChild(textarea);
    container.appendChild(parseBtn);
    container.appendChild(clearBtn);
  }

  // ── 超次元 input ─────────────────────────────────────────────────────────────

  function _addHyperspatialInputs(container, preview, saveBtn, setParsed) {
    var taObjs = [];

    function _makeTA(labelText) {
      var block = _el('div', { className: 'card-editor__face-block' });
      block.appendChild(_el('div', { className: 'card-editor__face-label', textContent: labelText }));
      var ta = document.createElement('textarea');
      ta.className   = 'card-editor__input card-editor__input--face';
      ta.rows        = 6;
      ta.placeholder = 'wikiテキストを貼り付け';
      block.appendChild(ta);
      return { block: block, ta: ta };
    }

    var ta1 = _makeTA('面1（覚醒前 / ウエポン など）');
    var ta2 = _makeTA('面2（覚醒後 / フォートレス など）');
    taObjs  = [ta1, ta2];
    container.appendChild(ta1.block);
    container.appendChild(ta2.block);

    var addFaceBtn = _el('button', { className: 'btn btn--small', textContent: '3面目を追加' });
    addFaceBtn.addEventListener('click', function () {
      if (taObjs.length >= 3) return;
      var ta3 = _makeTA('面3（○○・スーパー・クリーチャー など）');
      taObjs.push(ta3);
      container.insertBefore(ta3.block, addFaceBtn);
      addFaceBtn.disabled = true;
    });
    container.appendChild(addFaceBtn);

    var parseBtn = _el('button', { className: 'btn', textContent: '解析する' });
    var clearBtn = _el('button', { className: 'btn', textContent: 'クリア' });

    parseBtn.addEventListener('click', function () {
      var forms  = [];
      var errors = [];

      taObjs.forEach(function (obj, i) {
        var val = obj.ta.value.trim();
        if (!val) return;
        var result = parseCardText(val);
        if (result.card) {
          forms.push(result.card);
          result.errors.forEach(function (e) { errors.push('面' + (i + 1) + ': ' + e); });
        } else {
          var errs = result.errors.length ? result.errors : ['解析失敗'];
          errs.forEach(function (e) { errors.push('面' + (i + 1) + ': ' + e); });
        }
      });

      if (!forms.length) {
        preview.innerHTML = '<p class="msg msg--error">解析失敗: ' + (errors.join(' / ') || '入力がありません') + '</p>';
        saveBtn.disabled = true;
        setParsed(null);
        return;
      }

      var card;
      if (forms.length === 1) {
        card = Object.assign({}, forms[0], { zone: 'hyperspatial' });
      } else {
        card = Object.assign({}, forms[0], {
          zone:  'hyperspatial',
          name:  forms[0].name,
          type:  forms[0].type,
          forms: forms,
        });
      }

      setParsed(card);
      preview.innerHTML = _buildHyperspatialPreviewHTML(card, forms);
      if (errors.length) {
        preview.innerHTML += '<p class="msg msg--error">警告: ' + errors.join(' / ') + '</p>';
      }
      saveBtn.disabled = false;
    });

    clearBtn.addEventListener('click', function () {
      taObjs.forEach(function (obj) { obj.ta.value = ''; });
      preview.innerHTML = '';
      saveBtn.disabled  = true;
      setParsed(null);
    });

    container.appendChild(parseBtn);
    container.appendChild(clearBtn);
  }

  // ── 超GR input ───────────────────────────────────────────────────────────────

  function _addSuperGRInputs(container, preview, saveBtn, setParsed) {
    var textarea     = document.createElement('textarea');
    textarea.className   = 'card-editor__input';
    textarea.rows        = 8;
    textarea.placeholder = 'GRクリーチャーのテキストを貼り付け';

    var parseBtn = _el('button', { className: 'btn', textContent: '解析する' });
    var clearBtn = _el('button', { className: 'btn', textContent: 'クリア' });

    parseBtn.addEventListener('click', function () {
      var result = parseCardText(textarea.value);
      if (!result.card) {
        preview.innerHTML = '<p class="msg msg--error">解析失敗: ' + (result.errors.join(' / ') || '解析失敗') + '</p>';
        saveBtn.disabled = true;
        setParsed(null);
        return;
      }
      var card = Object.assign({}, result.card, { zone: 'superGR' });
      setParsed(card);
      preview.innerHTML = _buildPreviewHTML(card);
      if (result.errors.length) {
        preview.innerHTML += '<p class="msg msg--error">警告: ' + result.errors.join(' / ') + '</p>';
      }
      saveBtn.disabled = false;
    });

    clearBtn.addEventListener('click', function () {
      textarea.value    = '';
      preview.innerHTML = '';
      saveBtn.disabled  = true;
      setParsed(null);
    });

    container.appendChild(textarea);
    container.appendChild(parseBtn);
    container.appendChild(clearBtn);
  }

  // ── Preview builders ─────────────────────────────────────────────────────────

  function _buildPreviewHTML(def) {
    if (def.type === 'twin') {
      var partsHTML = (def.sides || []).map(function (side, i) {
        return '<div class="card-preview__twin-label">Side ' + (i + 1) + ': ' + (side.name || '—') + '</div>'
          + _buildSideTableHTML(side);
      }).join('');
      return '<div class="card-preview">'
        + '<div class="card-preview__twin-name">' + def.name + ' <em>(ツインパクト)</em></div>'
        + partsHTML + '</div>';
    }
    return '<div class="card-preview">' + _buildSideTableHTML(def) + '</div>';
  }

  function _buildHyperspatialPreviewHTML(card, forms) {
    var badge = '<span class="card-preview__zone-badge card-preview__zone-badge--hyp">超次元</span>';
    if (!forms || forms.length <= 1) {
      return '<div class="card-preview">' + badge + _buildSideTableHTML(card) + '</div>';
    }
    var partsHTML = forms.map(function (form, i) {
      return '<div class="card-preview__form-label">面' + (i + 1) + ': ' + (form.name || '—') + '</div>'
        + _buildSideTableHTML(form);
    }).join('');
    return '<div class="card-preview">'
      + badge
      + '<div class="card-preview__twin-name">' + (card.name || '—') + ' <em>(' + forms.length + '面)</em></div>'
      + partsHTML + '</div>';
  }

  function _buildSideTableHTML(def) {
    var civs  = Array.isArray(def.civilization) ? def.civilization.join(', ') : (def.civilization || '—');
    var races = Array.isArray(def.races) && def.races.length ? def.races.join(' / ') : (def.race || '—');

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

    var trs = rows.map(function (r) {
      return '<tr><th>' + r[0] + '</th><td>' + r[1] + '</td></tr>';
    }).join('');

    return '<table class="card-preview__table"><tbody>' + trs + '</tbody></table>';
  }

  // ── DOM helper ───────────────────────────────────────────────────────────────

  function _el(tag, props) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) { el[k] = props[k]; });
    return el;
  }

  return { init: init };

})();
