// ui/importHelper.js
//
// Shared helper for file-based import with conflict resolution.
// Used by CardEditor, CardManagerUI, DeckBuilderUI, and DeckEditorUI.
//
// Rules:
//   - DOM access only via #modal-layer (shared overlay)
//   - Never accesses storage directly — delegates to DataPorter
//   - Single public function: ImportHelper.trigger(onComplete)
//     Opens a file picker, checks for conflicts, shows a modal if needed,
//     then calls onComplete({ ok, stats, deckName, errors }) when done.

var ImportHelper = (function () {

  // ── Field labels for diff display ─────────────────────────────────────────

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

  // ── Conflict modal ────────────────────────────────────────────────────────

  function _closeModal() {
    var layer = document.getElementById('modal-layer');
    if (layer) { layer.classList.remove('is-open'); layer.innerHTML = ''; }
  }

  function _showConflictModal(analysis, jsonText, onDone) {
    var layer = document.getElementById('modal-layer');
    if (!layer) {
      onDone(DataPorter.confirmImport(jsonText, true));
      return;
    }

    layer.innerHTML = '';
    layer.classList.add('is-open');

    var panel = _el('div', 'modal-panel');

    // Header
    var header = _el('div', 'modal-header');
    header.appendChild(_elText('span', 'modal-title', 'カード情報の競合'));
    header.appendChild(_btn('✕', 'modal-close-btn', _closeModal));
    panel.appendChild(header);

    // Body
    var body = _el('div', 'import-conflict-body');

    var summary = '';
    summary += analysis.conflictCards.length + ' 枚のカード情報が登録済みのものと異なります。';
    if (analysis.newCards.length) summary += '新規追加: ' + analysis.newCards.length + ' 枚。';
    body.appendChild(_elText('p', 'import-conflict-summary', summary));

    var listEl = _el('ul', 'import-conflict-list');

    analysis.conflictCards.forEach(function (item) {
      var li = document.createElement('li');
      var details = document.createElement('details');
      var summaryEl = document.createElement('summary');
      summaryEl.textContent = item.incoming.name;
      details.appendChild(summaryEl);

      // Per-field diff
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

    layer.appendChild(panel);
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

  // ── Core flow ─────────────────────────────────────────────────────────────

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

  // Opens a file picker and runs the import flow.
  // Handles deck-share, cards, and legacy formats transparently.
  // onComplete(result) — result shape: { ok, stats?, deckName?, errors?, error? }
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

  return { trigger: trigger };

})();
