// CardInstance is a lightweight data object; we keep it as plain JSON.
// Note: isTapped is NOT on CardInstance — it belongs to CardStack.

function createCardInstance(raw) {
  return {
    id:               raw.id,
    definitionId:     raw.definitionId,
    isFaceDown:       raw.isFaceDown        != null ? raw.isFaceDown        : false,
    currentFormIndex: raw.currentFormIndex  != null ? raw.currentFormIndex  : 0,
    isGRCard:         raw.isGRCard          != null ? raw.isGRCard          : false,
  };
}

function cloneCardInstance(instance) {
  return Object.assign({}, instance);
}
