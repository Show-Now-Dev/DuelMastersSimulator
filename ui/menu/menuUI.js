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
    _showScreen('menu');
    _renderMenu();
  }

  // ── Screen navigation ────────────────────────────────────────────────────────

  function _showScreen(name) {
    ['menu', 'card-editor', 'deck-builder'].forEach(function (s) {
      var el = document.getElementById('screen-' + s);
      if (el) el.classList.toggle('is-active', s === name);
    });

    if (name === 'deck-builder') {
      DeckBuilderUI.show();
    }
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
    var toDeckBtn = _btn('デッキビルダー', 'btn', function () {
      _showScreen('deck-builder');
    });

    nav.appendChild(toEditorBtn);
    nav.appendChild(toDeckBtn);
    container.appendChild(nav);

    // Deck list heading
    var heading = document.createElement('h2');
    heading.textContent = 'デッキを選択';
    container.appendChild(heading);

    // Saved deck list — read via repositories, never CardStorage directly.
    var decks = DeckRepository.getAllDecks();
    var cards = CardRepository.getAllCards();

    if (decks.length) {
      var listEl = document.createElement('div');
      listEl.className = 'menu__deck-list';

      decks.forEach(function (deck) {
        var item = document.createElement('div');
        item.className = 'menu__deck-item';

        var nameEl = document.createElement('span');
        nameEl.className   = 'menu__deck-name';
        nameEl.textContent = deck.name;

        var countEl = document.createElement('span');
        countEl.className   = 'menu__deck-count';
        countEl.textContent = DeckBuilder.deckCardCount(deck) + ' 枚';

        var deleteBtn = _btn('削除', 'btn btn--danger', function () {
          if (!confirm(deck.name + ' を削除しますか？')) return;
          DeckRepository.deleteDeck(deck.id);
          _renderMenu();
        });

        var startBtn = _btn('シミュレーション開始', 'btn btn--primary', function () {
          _startGame(deck, cards);
        });

        item.appendChild(nameEl);
        item.appendChild(countEl);
        item.appendChild(deleteBtn);
        item.appendChild(startBtn);
        listEl.appendChild(item);
      });

      container.appendChild(listEl);
    } else {
      var notice = document.createElement('p');
      notice.className   = 'screen-desc';
      notice.textContent = '保存されたデッキがありません。デッキビルダーでデッキを作成するか、サンプルデッキで開始してください。';
      container.appendChild(notice);
    }

    // Fallback: start with the bundled sample deck
    var sampleBtn = _btn('サンプルデッキで開始', 'btn', function () {
      _startWithSampleDeck();
    });
    container.appendChild(sampleBtn);
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

    if (_onStart) _onStart(cardDefs, result.instances);
  }

  function _startWithSampleDeck() {
    Promise.all([
      fetch('./src/data/cards.json').then(function (r) { return r.json(); }),
      fetch('./src/data/decks.json').then(function (r) { return r.json(); }),
    ]).then(function (results) {
      var cardDefs = results[0];
      var deck     = results[1][0];
      if (!deck) { alert('サンプルデッキが見つかりません。'); return; }
      _startGame(deck, cardDefs);
    }).catch(function (e) {
      alert('サンプルデッキの読み込みに失敗しました: ' + e.message);
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

  return { init: init };

})();
