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
    textarea.placeholder = 'Wikiからコピーしたテキストをここへ貼り付け';

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

    // ── メインゾーン サンプル ──────────────────────────────────────────────────
    // ▼ サンプル内容を変更したい場合は faces 配列を編集してください。
    //   _buildSampleWidget の使い方は下記の関数定義のコメントを参照。
    container.appendChild(_buildSampleWidget({
      summaryText: 'Wikiからのコピー方法（サンプル）',
      faces: [
        // ── 上面 ──────────────────────────────────────────────────────────────
        // nameHTML: ルビ付きカード名を HTML で記述（<ruby>漢字<rt>ふりがな</rt></ruby>）
        {
          nameHTML: '《<ruby>満韻炎霊<rt>イフリート・フリート</rt></ruby>キャノンボール》',
          rows: [
            '満韻炎霊 キャノンボール　R　火文明　(3)',
            'クリーチャー：マジック・アウトレイジ　3000',
            '相手のクリーチャーが、相手の手札以外から出た時、自分のツインパクト・クリーチャー1体の呪文側を、バトルゾーンに置いたままコストを支払わずに唱えてもよい。',
          ],
        },
        // ── ツインパクトの区切り（貼り付けテキストでは上下の間を1行空ける） ──
        { divider: '（ツインパクトは1行空ける）' },
        // ── 下面 ──────────────────────────────────────────────────────────────
        {
          nameHTML: '《♪<ruby>夏草<rt>なつくさ</rt></ruby>や イフリートによる <ruby>夢<rt>ゆめ</rt></ruby>の<ruby>跡<rt>あと</rt></ruby>》',
          rows: [
            '♪夏草や イフリートによる 夢の跡　R　火文明　(5)',
            '呪文：マジック・ソング',
            'S・トリガー',
            '相手のパワー12000以下のクリーチャーを1体選び、破壊する。',
          ],
        },
      ],
    }));

    container.appendChild(parseBtn);
    container.appendChild(clearBtn);
  }

  // ── 超次元 input ─────────────────────────────────────────────────────────────

  function _addHyperspatialInputs(container, preview, saveBtn, setParsed) {
    var taObjs = [];

    // ── 超次元 サンプル（全面まとめて表示） ──────────────────────────────────
    // ▼ サンプル内容を変更したい場合は faces 配列を編集してください。
    //   各面は実際には別々のテキストボックスへ貼り付けます（面1→ボックス1、面2→ボックス2）。
    //   _buildSampleWidget の使い方は下記の関数定義のコメントを参照。
    container.appendChild(_buildSampleWidget({
      summaryText: 'Wikiからのコピー方法（サンプル）',
      faces: [
        // ── 面1（覚醒前 / ウエポン など） ────────────────────────────────────
        // nameText: ルビなしの場合はこちら（《》ごと書く）
        {
          nameText: '《ガイアール・カイザー》',
          rows: [
            'ガイアール・カイザー R 火文明 (8)',
            'クリーチャー：レッド・コマンド・ドラゴン/サムライ 7000',
            'スピードアタッカー（このクリーチャーは召喚酔いしない）',
            'W・ブレイカー（このクリーチャーはシールドを2枚ブレイクする）',
          ],
        },
        // ── 面の区切り ────────────────────────────────────────────────────────
        { divider: '── 面2（それぞれのテキストボックスへ別々に貼り付け）──' },
        // ── 面2（覚醒後 / フォートレス など） ───────────────────────────────
        {
          nameText: '《ガイアール・オウドラゴン》',
          rows: [
            'ガイアール・オウドラゴン R 火文明 (8)',
            '進化クリーチャー：レッド・コマンド・ドラゴン/サムライ 13000',
            'スピードアタッカー',
            'T・ブレイカー（このクリーチャーはシールドを3枚ブレイクする）',
          ],
        },
      ],
    }));

    function _makeTA(label) {
      var block = _el('div', { className: 'card-editor__face-block' });
      block.appendChild(_el('div', { className: 'card-editor__face-label', textContent: label }));
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

    // ── 超GR サンプル ─────────────────────────────────────────────────────────
    // ▼ サンプル内容を変更したい場合は faces 配列内のブロックを編集してください。
    //   _buildSampleWidget の使い方は下記の関数定義のコメントを参照。
    container.appendChild(_buildSampleWidget({
      faces: [
        {
          nameText: '《インビンシブル・テクノロジー》',
          rows: [
            'インビンシブル・テクノロジー R 光文明 (7)',
            'クリーチャー：メカ・デル・ソル 5500',
            'ブロッカー',
            'このクリーチャーがバトルゾーンに出た時、相手のクリーチャーを1体選び、タップする。そのクリーチャーは次の相手のターンのはじめにアンタップしない。',
          ],
        },
      ],
    }));

    container.appendChild(parseBtn);
    container.appendChild(clearBtn);
  }

  // ── Wiki-style sample section builder ────────────────────────────────────────
  //
  // _buildSampleWidget(config) でサンプルウィジェット（折りたたみ）を生成する。
  // メイン・超次元・超GR のすべてで共通して使う関数。
  //
  // ■ config の構造
  // {
  //   summaryText: string,  // 折りたたみ見出し（省略時 'サンプルを見る'）
  //   faces: Array          // 表示するブロックの配列（下記参照）
  // }
  //
  // ■ faces 配列の要素は 2 種類
  //
  // 【カードブロック】― 1 枚分のカード情報を Wiki 風に表示する
  // {
  //   nameHTML: string,  // ヘッダーに表示するHTML（<ruby>タグでルビを付けられる）
  //                      //   例: '《<ruby>満韻炎霊<rt>イフリート・フリート</rt></ruby>キャノンボール》'
  //   nameText: string,  // ルビが不要なら nameText に文字列で書く（nameHTML が優先）
  //                      //   例: '《ガイアール・カイザー》'
  //   rows:    string[], // データ行（Wiki からコピーした各行をそのまま配列に）
  // }
  //
  // 【区切り行】― ツインパクトや面の切れ目を示す青いセパレータ行
  // {
  //   divider: string    // 区切り行に表示するテキスト
  // }
  //
  // ■ サンプル内容の変更方法
  //   ・カード名（ヘッダー）: nameHTML または nameText を書き換える
  //   ・データ行: rows 配列の文字列を書き換える
  //   ・行を増減: rows 配列に要素を追加・削除する
  //
  // ■ サンプルブロックを増やす／構成を変える方法
  //   faces 配列の要素数と順序で表示内容が決まる。
  //
  //   単体カード（通常）:
  //     faces: [ { nameText: '《カード名》', rows: ['行1', '行2'] } ]
  //
  //   ツインパクト:
  //     faces: [
  //       { nameHTML: '《上面名》', rows: [...] },
  //       { divider: '（ツインパクトは1行空ける）' },
  //       { nameHTML: '《下面名》', rows: [...] },
  //     ]
  //
  //   多面カード（超次元など）:
  //     faces: [
  //       { nameText: '《面1名》', rows: [...] },
  //       { divider: '── 面2 ──' },
  //       { nameText: '《面2名》', rows: [...] },
  //     ]
  //
  // ■ ルビ（読み仮名）の書き方
  //   nameHTML を使い、<ruby> タグで漢字とふりがなをペアにする。
  //   例: '<ruby>夏草<rt>なつくさ</rt></ruby>'
  //   ルビが不要なカードは nameText: '《カード名》' でシンプルに書ける。

  function _buildSampleWidget(config) {
    var summaryText = config.summaryText || 'サンプルを見る';
    var faces       = config.faces || [];

    var det = document.createElement('details');
    det.className = 'card-editor__sample';

    var sum = _el('summary', { className: 'card-editor__sample-summary', textContent: summaryText });
    det.appendChild(sum);

    var body = _el('div', { className: 'card-editor__sample-body' });
    var box  = _el('div', { className: 'dm-wiki-box' });

    faces.forEach(function (face) {
      if (face.divider != null) {
        // 区切り行（ツインパクトの面の切れ目・多面カードの区切りなど）
        box.appendChild(_el('div', { className: 'dm-wiki-box__face-label', textContent: face.divider }));
      } else {
        // カードブロック: ヘッダー（カード名）
        var hdr = _el('div', { className: 'dm-wiki-box__header' });
        var nameDiv = _el('div', { className: 'dm-wiki-box__name' });
        if (face.nameHTML) {
          nameDiv.innerHTML = face.nameHTML;  // <ruby>タグなどを含むHTML
        } else {
          nameDiv.textContent = face.nameText || '';
        }
        hdr.appendChild(nameDiv);
        box.appendChild(hdr);
        // データ行
        (face.rows || []).forEach(function (row) { box.appendChild(_wikiRow(row)); });
      }
    });

    body.appendChild(box);
    det.appendChild(body);
    return det;
  }

  // Helper: one data row in the wiki visual mock.
  function _wikiRow(text) {
    return _el('div', { className: 'dm-wiki-box__row', textContent: text || '\u00a0' });
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
      ['名前',     def.name    || '—'],
      ['読み仮名', def.reading || '（なし）'],
      ['文明',     civs],
      ['コスト',   def.cost  != null ? def.cost  : '—'],
      ['種類',     def.type  || '—'],
      ['種族',     races],
      ['パワー',   def.power != null ? def.power : '—'],
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
