// CardInstance is a lightweight data object; we keep it as plain JSON.
// Note: isTapped is NOT on CardInstance — it belongs to CardStack.

function createCardInstance(raw) {
  return {
    id:           raw.id,
    definitionId: raw.definitionId,
    name:         raw.name,
    type:         raw.type,
    isFaceDown:   raw.isFaceDown != null ? raw.isFaceDown : false,
  };
}

function cloneCardInstance(instance) {
  return Object.assign({}, instance);
}
