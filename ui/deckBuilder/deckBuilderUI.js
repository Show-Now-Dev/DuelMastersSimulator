// ui/deckBuilder/deckBuilderUI.js
//
// Deck builder UI module.
// Lets the user select registered cards and quantities, then save a DeckDefinition.
//
// Rules:
//   - No game state access
//   - No DOM manipulation outside the provided container
//   - Reads cards via CardRepository; saves decks via DeckRepository
//   - Delegates count logic to logic/deckBuilder.js

var DeckBuilderUI = (function () {

  var TARGET_COUNT = 40;

  var _container = null;
  var _onSave    = null;  // callback(deckDef) — called after a deck is saved
  var _cards     = [];    // CardDefinition[] currently loaded from storage
  var _counts    = {};    // cardId → count (the deck being built)

  // Mount the builder into a container element.
  function init(container, onSave) {
    _container = container;
    _onSave    = onSave;
  }

  // Reload cards from repository and re-render.
  // Call this each time the screen becomes visible.
  function show() {
    _cards  = CardRepository.getAllCards();
    _counts = {};
    _render();
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  function _render() {
    _container.innerHTML = '';

    var heading = document.createElement('h2');
    heading.textContent = 'デッキビルダー';
    _container.appendChild(heading);

    if (!_cards.length) {
      var notice = document.createElement('p');
      notice.className   = 'screen-desc';
      notice.textContent = 'カードが登録されていません。先にカード登録画面でカードを追加してください。';
      _container.appendChild(notice);
      return;
    }

    // Deck name input
    var nameRow   = document.createElement('div');
    nameRow.className = 'deck-builder__name-row';

    var nameLabel = document.createElement('label');
    nameLabel.textContent = 'デッキ名:';

    var nameInput = document.createElement('input');
    nameInput.type        = 'text';
    nameInput.className   = 'deck-builder__name-input';
    nameInput.placeholder = '新しいデッキ';

    nameRow.appendChild(nameLabel);
    nameRow.appendChild(nameInput);
    _container.appendChild(nameRow);

    // Total counter (updated reactively)
    var totalEl = document.createElement('div');
    totalEl.className = 'deck-builder__total';
    _container.appendChild(totalEl);

    // Card list
    var cardList = document.createElement('div');
    cardList.className = 'deck-builder__card-list';

    _cards.forEach(function (card) {
      var civs = Array.isArray(card.civilization)
        ? card.civilization
        : (card.civilization ? [card.civilization] : []);

      var row = document.createElement('div');
      row.className = 'deck-builder__row';

      var infoEl = document.createElement('div');
      infoEl.className = 'deck-builder__card-info';

      var nameEl = document.createElement('span');
      nameEl.className   = 'deck-builder__card-name';
      nameEl.textContent = card.name;

      var civEl = document.createElement('span');
      civEl.className   = 'deck-builder__card-civ';
      civEl.textContent = civs.join('/') || '—';

      infoEl.appendChild(nameEl);
      infoEl.appendChild(civEl);

      var countCtrl = document.createElement('div');
      countCtrl.className = 'deck-builder__count-ctrl';

      var minusBtn = document.createElement('button');
      minusBtn.textContent = '−';
      minusBtn.className   = 'btn btn--small';

      var countNum = document.createElement('span');
      countNum.className   = 'deck-builder__count-num';
      countNum.textContent = '0';

      var plusBtn = document.createElement('button');
      plusBtn.textContent = '＋';
      plusBtn.className   = 'btn btn--small';

      minusBtn.addEventListener('click', function () {
        _counts[card.id] = Math.max(0, (_counts[card.id] || 0) - 1);
        countNum.textContent = String(_counts[card.id]);
        _updateTotal(totalEl);
      });

      plusBtn.addEventListener('click', function () {
        _counts[card.id] = (_counts[card.id] || 0) + 1;
        countNum.textContent = String(_counts[card.id]);
        _updateTotal(totalEl);
      });

      countCtrl.appendChild(minusBtn);
      countCtrl.appendChild(countNum);
      countCtrl.appendChild(plusBtn);

      row.appendChild(infoEl);
      row.appendChild(countCtrl);
      cardList.appendChild(row);
    });

    _container.appendChild(cardList);

    // Save button
    var saveBtn = document.createElement('button');
    saveBtn.textContent = 'デッキを保存';
    saveBtn.className   = 'btn btn--primary deck-builder__save-btn';

    saveBtn.addEventListener('click', function () {
      var total = _totalCount();
      if (total !== TARGET_COUNT) {
        alert('デッキは ' + TARGET_COUNT + ' 枚にしてください（現在: ' + total + ' 枚）');
        return;
      }

      var deckName = nameInput.value.trim() || '新しいデッキ';
      var entries = Object.keys(_counts)
        .filter(function (id) { return _counts[id] > 0; })
        .map(function (id) { return { cardId: id, count: _counts[id] }; });

      // Delegate to DeckRepository — id is generated there.
      var result = DeckRepository.addDeck(createDeckDefinition('', deckName, entries));
      if (!result.ok) {
        alert('保存失敗: ' + result.error);
        return;
      }

      var deck = DeckRepository.getDeckById(result.id);
      if (_onSave) _onSave(deck);
      alert('デッキを保存しました: ' + deckName);

      // Reset counts after save
      _counts = {};
      show();
    });

    _container.appendChild(saveBtn);

    _updateTotal(totalEl);
  }

  function _totalCount() {
    return Object.keys(_counts).reduce(function (sum, id) {
      return sum + (_counts[id] || 0);
    }, 0);
  }

  function _updateTotal(el) {
    var total = _totalCount();
    var over  = total > TARGET_COUNT;
    var exact = total === TARGET_COUNT;
    el.textContent = '合計: ' + total + ' / ' + TARGET_COUNT + ' 枚';
    el.className = 'deck-builder__total'
      + (exact ? ' is-valid' : '')
      + (over  ? ' is-over'  : '');
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  return { init: init, show: show };

})();
