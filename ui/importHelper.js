// ui/importHelper.js
//
// Shared helper for import/export flows with conflict resolution.
// Used by CardEditor, CardManagerUI, DeckBuilderUI, and DeckEditorUI.
//
// Rules:
//   - DOM access only via #modal-layer (shared overlay)
//   - Never accesses storage directly — delegates to DataPorter
//
// Public API:
//   ImportHelper.trigger(onComplete)            — file picker → import
//   ImportHelper.triggerText(onComplete)        — text modal → import
//   ImportHelper.showTextExport(title, jsonText) — text modal → copy/close

var ImportHelper = (function () {

  // ── Constants ─────────────────────────────────────────────────────────────

  // Maximum number of conflict <details> elements to render in the DOM.
  // Above this threshold, only names are listed (no expandable diffs).
  var _MAX_CONFLICTS_DOM = 50;

  var _FIELD_LABELS = {
    civilization: '文明',
    cost:         'コスト',
    type:         '種類',
    races:        '種族',
    power:        'パワー',
    abilities:    'テキスト',
    jokers:       'ジョーカーズ',
  };

  var _DIFF_FIELDS = ['civilization', 'cost', 'type', 'races', 'power', 'abilities', 'jokers'];

  // ── File picker ───────────────────────────────────────────────────────────

  function _pickFile(onText) {
    var input = document.createElement('input');
    input.type    = 'file';
    input.accept  = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      document.body.removeChild(input);
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) { onText(e.target.result); };
      reader.readAsText(file);
    });
    input.click();
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function _closeModal() {
    var layer = document.getElementById('modal-layer');
    if (layer) { layer.classList.remove('is-open'); layer.innerHTML = ''; }
  }

  function _openModal(panel) {
    var layer = document.getElementById('modal-layer');
    if (!layer) return;
    layer.innerHTML = '';
    layer.classList.add('is-open');
    layer.appendChild(panel);
  }

  function _buildPanel(title) {
    var panel  = _el('div', 'modal-panel');
    var header = _el('div', 'modal-header');
    header.appendChild(_elText('span', 'modal-title', title));
    header.appendChild(_btn('✕', 'modal-close-btn', _closeModal));
    panel.appendChild(header);
    return panel;
  }

  // ── Text export modal ─────────────────────────────────────────────────────

  // Shows a modal with a readonly textarea of jsonText and a copy button.
  // title: string shown in the modal header.
  function showTextExport(title, jsonText) {
    var panel = _buildPanel(title);

    var body = _el('div', 'import-text-body');
    var ta   = document.createElement('textarea');
    ta.className = 'import-text-area';
    ta.readOnly  = true;
    ta.value     = jsonText;
    body.appendChild(ta);
    panel.appendChild(body);

    var footer  = _el('div', 'modal-footer');
    var copyBtn = _btn('コピー', 'btn btn--primary', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(jsonText)
          .then(function ()  { _flashBtn(copyBtn, 'コピーしました！', 'コピー'); })
          .catch(function () { _execCopy(ta, copyBtn); });
      } else {
        _execCopy(ta, copyBtn);
      }
    });
    footer.appendChild(copyBtn);
    footer.appendChild(_btn('閉じる', 'btn', _closeModal));
    panel.appendChild(footer);

    _openModal(panel);
  }

  function _execCopy(ta, btn) {
    ta.select();
    try {
      document.execCommand('copy');
      _flashBtn(btn, 'コピーしました！', 'コピー');
    } catch (e) {
      alert('コピーに失敗しました。テキストエリアを長押しして全選択→コピーしてください。');
    }
  }

  function _flashBtn(btn, tempText, originalText) {
    btn.textContent = tempText;
    setTimeout(function () { btn.textContent = originalText; }, 1500);
  }

  // ── Text import modal ─────────────────────────────────────────────────────

  // Shows a modal with a writable textarea plus paste / import / cancel buttons.
  // onComplete(result) is called after a successful import.
  function triggerText(onComplete) {
    var panel = _buildPanel('テキストからインポート');

    var body = _el('div', 'import-text-body');
    var desc = _elText('p', 'import-text-desc',
      'エクスポートしたJSONテキストを貼り付けてください。');
    body.appendChild(desc);

    var ta = document.createElement('textarea');
    ta.className   = 'import-text-area';
    ta.placeholder = '{ "format": "deck-share", "version": 1, ... }';
    body.appendChild(ta);
    panel.appendChild(body);

    var footer    = _el('div', 'modal-footer');
    var pasteBtn  = _btn('貼り付け', 'btn', function () {
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText()
          .then(function (text) { ta.value = text; })
          .catch(function ()    {
            ta.focus();
            alert('貼り付けの許可が必要です。テキストエリアに直接貼り付けてください。');
          });
      } else {
        ta.focus();
        alert('このブラウザでは貼り付けボタンを使用できません。テキストエリアに直接貼り付けてください。');
      }
    });
    var importBtn = _btn('インポート', 'btn btn--primary', function () {
      var text = ta.value.trim();
      if (!text) { alert('テキストを入力してください。'); return; }
      _closeModal();
      _runImport(text, onComplete);
    });

    footer.appendChild(pasteBtn);
    footer.appendChild(importBtn);
    footer.appendChild(_btn('キャンセル', 'btn', _closeModal));
    panel.appendChild(footer);

    _openModal(panel);
  }

  // ── Conflict modal ────────────────────────────────────────────────────────

  function _showConflictModal(analysis, jsonText, onDone) {
    var layer = document.getElementById('modal-layer');
    if (!layer) {
      onDone(DataPorter.confirmImport(jsonText, true));
      return;
    }

    var panel = _buildPanel('カード情報の競合');

    // Body
    var body     = _el('div', 'import-conflict-body');
    var totalConflicts = analysis.conflictCards.length;

    var summaryText = totalConflicts + ' 枚のカード情報が登録済みのものと異なります。';
    if (analysis.newCards.length) summaryText += '新規追加: ' + analysis.newCards.length + ' 枚。';
    body.appendChild(_elText('p', 'import-conflict-summary', summaryText));

    var listEl  = _el('ul', 'import-conflict-list');
    var display = analysis.conflictCards.slice(0, _MAX_CONFLICTS_DOM);
    var truncated = totalConflicts - display.length;

    display.forEach(function (item) {
      var li      = document.createElement('li');
      var details = document.createElement('details');
      var summEl  = document.createElement('summary');
      summEl.textContent = item.incoming.name;
      details.appendChild(summEl);

      var diffEl = _el('div', 'import-conflict-diff');
      _buildDiff(item.local, item.incoming).forEach(function (df) {
        var row = _el('div', 'import-conflict-diff-row');
        row.appendChild(_elText('span', 'import-conflict-diff-field', df.field));
        row.appendChild(_elText('span', 'import-conflict-diff-old',   df.old));
        row.appendChild(_elText('span', 'import-conflict-diff-new',   df.new));
        diffEl.appendChild(row);
      });
      details.appendChild(diffEl);
      li.appendChild(details);
      listEl.appendChild(li);
    });

    if (truncated > 0) {
      var note = _elText('li', 'import-conflict-truncation',
        '… 他 ' + truncated + ' 枚（差分表示は省略）');
      listEl.appendChild(note);
    }

    body.appendChild(listEl);
    panel.appendChild(body);

    // Footer
    var footer = _el('div', 'modal-footer');
    footer.appendChild(_btn('全て上書き', 'btn btn--primary', function () {
      _closeModal();
      onDone(DataPorter.confirmImport(jsonText, true));
    }));
    footer.appendChild(_btn('全て保持', 'btn', function () {
      _closeModal();
      onDone(DataPorter.confirmImport(jsonText, false));
    }));
    footer.appendChild(_btn('キャンセル', 'btn', _closeModal));
    panel.appendChild(footer);

    _openModal(panel);
  }

  // ── Diff builder ──────────────────────────────────────────────────────────

  function _buildDiff(local, incoming) {
    var diffs = [];
    _DIFF_FIELDS.forEach(function (f) {
      var a = JSON.stringify(local[f]    !== undefined ? local[f]    : null);
      var b = JSON.stringify(incoming[f] !== undefined ? incoming[f] : null);
      if (a !== b) {
        diffs.push({
          field: _FIELD_LABELS[f] || f,
          old:   '現在: ' + a,
          new:   '新規: ' + b,
        });
      }
    });
    return diffs;
  }

  // ── Core import flow ──────────────────────────────────────────────────────

  function _runImport(jsonText, onDone) {
    var analysis = DataPorter.checkConflicts(jsonText);
    if (!analysis.ok) { onDone({ ok: false, error: analysis.error }); return; }

    if (analysis.conflictCards.length > 0) {
      _showConflictModal(analysis, jsonText, onDone);
    } else {
      onDone(DataPorter.confirmImport(jsonText, false));
    }
  }

  // ── Public ────────────────────────────────────────────────────────────────

  // File picker → import flow.
  function trigger(onComplete) {
    _pickFile(function (jsonText) {
      _runImport(jsonText, onComplete);
    });
  }

  // ── DOM helpers ───────────────────────────────────────────────────────────

  function _el(tag, cls) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  }

  function _elText(tag, cls, text) {
    var el = _el(tag, cls);
    el.textContent = text;
    return el;
  }

  function _btn(text, cls, handler) {
    var b = document.createElement('button');
    b.textContent = text;
    b.className   = cls;
    b.addEventListener('click', handler);
    return b;
  }

  return {
    trigger:        trigger,
    triggerText:    triggerText,
    showTextExport: showTextExport,
  };

})();
