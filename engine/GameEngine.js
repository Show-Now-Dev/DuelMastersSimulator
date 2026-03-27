// Minimal Redux-style store wrapper around the game reducer.
//
// createStore(reducer, context?)
//   context — optional object forwarded as the third argument to every reducer call.
//             Allows pure reducers to receive external dependencies (e.g. cardDefinitionsMap)
//             without reading global variables directly.

const GameEngine = (function () {
  function createStore(reducer, context) {
    let currentState = reducer(undefined, { type: "@@INIT" }, context);
    let listeners = [];

    function getState() {
      return currentState;
    }

    function dispatch(action) {
      currentState = reducer(currentState, action, context);
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