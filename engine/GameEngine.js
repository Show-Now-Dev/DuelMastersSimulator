// Minimal Redux-style store wrapper around the game reducer.

const GameEngine = (function () {
  function createStore(reducer) {
    let currentState = reducer(undefined, { type: "@@INIT" });
    let listeners = [];

    function getState() {
      return currentState;
    }

    function dispatch(action) {
      currentState = reducer(currentState, action);
      listeners.forEach((l) => l());
    }

    function subscribe(listener) {
      listeners.push(listener);
      return function unsubscribe() {
        listeners = listeners.filter((l) => l !== listener);
      };
    }

    return {
      getState,
      dispatch,
      subscribe,
    };
  }

  return {
    createStore,
  };
})();