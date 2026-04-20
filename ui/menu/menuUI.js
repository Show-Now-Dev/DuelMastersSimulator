// ui/menu/menuUI.js
//
// Menu screen UI module.
// Manages the pre-game flow: deck selection, card editor, deck builder.
//
// Screens managed:
//   screen-menu         — deck list + navigation
//   screen-card-editor  — card registration
//   screen-deck-builder — deck building
//
// Rules:
//   - No game state access (GameState, stores)
//   - Delegates to CardEditor and DeckBuilderUI for sub-screen rendering
//   - Calls onStart(cardDefs, deckInstances) when a game is launched

var MenuUI = (function () {

  var _onStart = null;  // callback(cardDefs, deckInstances)

  // Initialize all pre-game screens and show the menu.
  // onStart(cardDefs, deckInstances) is called when the user starts a simulation.
  function init(onStart) {
    _onStart = onStart;

    _initCardEditorScreen();
    _initDeckBuilderScreen();
    _initCardManagerScreen();
    _initDeckEditorScreen();
    _showScreen('menu');
    _renderMenu();
  }

  // ── Screen navigation ────────────────────────────────────────────────────────

  function _showScreen(name) {
    ['menu', 'card-editor', 'deck-builder', 'card-manager', 'deck-editor'].forEach(function (s) {
      var el = document.getElementById('screen-' + s);
      if (el) el.classList.toggle('is-active', s === name);
    });

    if (name === 'deck-builder')  DeckBuilderUI.show();
    if (name === 'card-manager')  CardManagerUI.show();
  }

  // ── Menu screen ──────────────────────────────────────────────────────────────

  function _renderMenu() {
    var container = document.getElementById('screen-menu');
    if (!container) return;
    container.innerHTML = '';

    // Navigation buttons
    var nav = document.createElement('div');
    nav.className = 'menu__nav';

    var toEditorBtn = _btn('カード登録', 'btn', function () {
      _showScreen('card-editor');
    });
    var toCardMgrBtn = _btn('カード管理', 'btn', function () {
      _showScreen('card-manager');
    });
    var toDeckBtn = _btn('デッキビルダー', 'btn', function () {
      _showScreen('deck-builder');
    });

    nav.appendChild(toEditorBtn);
    nav.appendChild(toCardMgrBtn);
    nav.appendChild(toDeckBtn);
    container.appendChild(nav);

    // Deck list heading + import buttons
    var deckSectionHeader = document.createElement('div');
    deckSectionHeader.className = 'menu__deck-section-header';

    var heading = document.createElement('h2');
    heading.textContent = 'デッキを選択';
    deckSectionHeader.appendChild(heading);

    var importBtns = document.createElement('div');
    importBtns.className = 'menu__import-btns';
    function _onDeckImport(result) {
      if (!result.ok) { alert('インポート失敗: ' + result.error); return; }
      var s = result.stats;
      var msg = 'インポート完了: 新規 ' + s.added + ' 枚、更新 ' + s.updated + ' 枚、スキップ ' + s.skipped + ' 枚';
      if (result.deckName) msg += '\nデッキ追加: ' + result.deckName;
      if (result.errors && result.errors.length) msg += '\n警告:\n' + result.errors.join('\n');
      alert(msg);
      _renderMenu();
    }
    importBtns.appendChild(_btn('デッキ読込（ファイル）', 'btn btn--small', function () { ImportHelper.trigger(_onDeckImport); }));
    importBtns.appendChild(_btn('デッキ読込（テキスト）', 'btn btn--small', function () { ImportHelper.triggerText(_onDeckImport); }));
    deckSectionHeader.appendChild(importBtns);

    container.appendChild(deckSectionHeader);

    // Saved deck list — read via repositories, never CardStorage directly.
    var decks = DeckRepository.getAllDecks();
    var cards = CardRepository.getAllCards();

    if (decks.length) {
      var listEl = document.createElement('div');
      listEl.className = 'menu__deck-list';

      decks.forEach(function (deck) {
        var item = document.createElement('div');
        item.className = 'menu__deck-item';

        var headerRow = document.createElement('div');
        headerRow.className = 'menu__deck-header';

        var nameEl = document.createElement('span');
        nameEl.className   = 'menu__deck-name';
        nameEl.textContent = deck.name;

        headerRow.appendChild(nameEl);

        var actionsRow = document.createElement('div');
        actionsRow.className = 'menu__deck-actions';

        var countEl = document.createElement('span');
        countEl.className   = 'menu__deck-count';
        countEl.textContent = DeckBuilder.deckCardCount(deck) + ' 枚';

        var editBtn = _btn('編集', 'btn btn--small', (function (d) {
          return function () {
            DeckEditorUI.showEdit(d.id);
            _showScreen('deck-editor');
          };
        }(deck)));

        var deleteBtn = _btn('削除', 'btn btn--small btn--danger', function () {
          if (!confirm(deck.name + ' を削除しますか？')) return;
          DeckRepository.deleteDeck(deck.id);
          _renderMenu();
        });

        var startBtn = _btn('シミュレーション開始', 'btn btn--primary', function () {
          _startGame(deck, cards);
        });

        actionsRow.appendChild(countEl);
        actionsRow.appendChild(editBtn);
        actionsRow.appendChild(deleteBtn);
        actionsRow.appendChild(startBtn);

        item.appendChild(headerRow);
        item.appendChild(actionsRow);
        listEl.appendChild(item);
      });

      container.appendChild(listEl);
    } else {
      var notice = document.createElement('p');
      notice.className   = 'screen-desc';
      notice.textContent = '保存されたデッキがありません。デッキビルダーでデッキを作成するか、サンプルデッキで開始してください。';
      container.appendChild(notice);
    }

    // Sample decks from src/data/decks.json
    _renderSampleDecks(container);
  }

  // ── Card editor screen ────────────────────────────────────────────────────────

  function _initCardEditorScreen() {
    var container = document.getElementById('screen-card-editor');
    if (!container) return;

    var back = _btn('← メニューに戻る', 'btn screen__back-btn', function () {
      _showScreen('menu');
      _renderMenu();
    });
    container.appendChild(back);

    var mount = document.createElement('div');
    container.appendChild(mount);

    CardEditor.init(mount, function (/*savedDef*/) {
      // Card saved — menu will refresh on next show
    });
  }

  // ── Deck builder screen ───────────────────────────────────────────────────────

  function _initDeckBuilderScreen() {
    var container = document.getElementById('screen-deck-builder');
    if (!container) return;

    var back = _btn('← メニューに戻る', 'btn screen__back-btn', function () {
      _showScreen('menu');
      _renderMenu();
    });
    container.appendChild(back);

    var mount = document.createElement('div');
    container.appendChild(mount);

    DeckBuilderUI.init(mount, function (/*savedDeck*/) {
      // Deck saved; menu will show updated list on next _renderMenu call
    });
  }

  // ── Card manager screen ────────────────────────────────────────────────────────

  function _initCardManagerScreen() {
    var container = document.getElementById('screen-card-manager');
    if (!container) return;

    var back = _btn('← メニューに戻る', 'btn screen__back-btn', function () {
      _showScreen('menu');
      _renderMenu();
    });
    container.appendChild(back);

    var mount = document.createElement('div');
    container.appendChild(mount);

    CardManagerUI.init(mount);
  }

  // ── Deck editor screen ─────────────────────────────────────────────────────────

  function _initDeckEditorScreen() {
    var container = document.getElementById('screen-deck-editor');
    if (!container) return;

    var back = _btn('← メニューに戻る', 'btn screen__back-btn', function () {
      _showScreen('menu');
      _renderMenu();
    });
    container.appendChild(back);

    var mount = document.createElement('div');
    container.appendChild(mount);

    DeckEditorUI.init(mount);
  }

  // ── Game start ────────────────────────────────────────────────────────────────

  function _startGame(deck, cardDefs) {
    var result = DeckBuilder.buildDeckInstances(deck, cardDefs);

    if (result.errors.length) {
      alert('デッキにエラーがあります:\n' + result.errors.join('\n'));
      return;
    }
    if (!result.instances.length) {
      alert('デッキにカードがありません。');
      return;
    }

    var exResult = DeckBuilder.buildHyperspatialInstances(deck, cardDefs);
    var grResult = DeckBuilder.buildSuperGRInstances(deck, cardDefs);

    if (_onStart) _onStart(cardDefs, result.instances, exResult.instances, grResult.instances);
  }

  // Render all sample decks from the bundled JSON files.
  function _renderSampleDecks(container) {
    var heading = document.createElement('h3');
    heading.className   = 'menu__sample-heading';
    heading.textContent = 'サンプルデッキ';
    container.appendChild(heading);

    Promise.all([
      fetch('./src/data/cards.json').then(function (r) { return r.json(); }),
      fetch('./src/data/decks.json').then(function (r) { return r.json(); }),
    ]).then(function (results) {
      var cardDefs   = results[0];
      var sampleDecks = results[1];

      if (!sampleDecks || !sampleDecks.length) {
        var none = document.createElement('p');
        none.className   = 'screen-desc';
        none.textContent = 'サンプルデッキがありません。';
        container.appendChild(none);
        return;
      }

      var listEl = document.createElement('div');
      listEl.className = 'menu__deck-list';

      sampleDecks.forEach(function (deck) {
        var item = document.createElement('div');
        item.className = 'menu__deck-item';

        var headerRow = document.createElement('div');
        headerRow.className = 'menu__deck-header';

        var nameEl = document.createElement('span');
        nameEl.className   = 'menu__deck-name';
        nameEl.textContent = deck.name;

        headerRow.appendChild(nameEl);

        var actionsRow = document.createElement('div');
        actionsRow.className = 'menu__deck-actions';

        var countEl = document.createElement('span');
        countEl.className   = 'menu__deck-count';
        countEl.textContent = DeckBuilder.deckCardCount(deck) + ' 枚';

        var startBtn = _btn('開始', 'btn btn--primary', function () {
          _startGame(deck, cardDefs);
        });

        actionsRow.appendChild(countEl);
        actionsRow.appendChild(startBtn);

        item.appendChild(headerRow);
        item.appendChild(actionsRow);
        listEl.appendChild(item);
      });

      container.appendChild(listEl);
    }).catch(function (e) {
      var err = document.createElement('p');
      err.className   = 'msg msg--error';
      err.textContent = 'サンプルデッキの読み込みに失敗しました: ' + e.message;
      container.appendChild(err);
    });
  }

  // ── Helper ────────────────────────────────────────────────────────────────────

  function _btn(text, cls, handler) {
    var b = document.createElement('button');
    b.textContent = text;
    b.className   = cls;
    b.addEventListener('click', handler);
    return b;
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  // Re-shows the menu screen without re-running full init.
  // Called by the simulation board's "return to menu" button.
  function showMenu() {
    _showScreen('menu');
    _renderMenu();
  }

  return { init: init, showMenu: showMenu };

})();
