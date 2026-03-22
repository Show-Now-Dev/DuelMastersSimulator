// storage/cardStorage.js
//
// Persistence layer for card definitions and deck definitions.
// Uses localStorage as the backing store.
// This module can be replaced with a server-side implementation later.
//
// Keys:
//   cardgame_cards → CardDefinition[]
//   cardgame_decks → DeckDefinition[]

(function () {

  var CARDS_KEY = 'cardgame_cards';
  var DECKS_KEY = 'cardgame_decks';

  function saveCards(cards) {
    try {
      localStorage.setItem(CARDS_KEY, JSON.stringify(cards));
    } catch (e) {
      console.error('CardStorage.saveCards failed:', e);
    }
  }

  function loadCards() {
    try {
      var raw = localStorage.getItem(CARDS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('CardStorage.loadCards failed:', e);
      return [];
    }
  }

  function saveDecks(decks) {
    try {
      localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
    } catch (e) {
      console.error('CardStorage.saveDecks failed:', e);
    }
  }

  function loadDecks() {
    try {
      var raw = localStorage.getItem(DECKS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('CardStorage.loadDecks failed:', e);
      return [];
    }
  }

  window.CardStorage = {
    saveCards: saveCards,
    loadCards: loadCards,
    saveDecks: saveDecks,
    loadDecks: loadDecks,
  };

})();
