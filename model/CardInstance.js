// CardInstance is a lightweight data object; we keep it as plain JSON.

function createCardInstance(raw) {
  return {
    id: raw.id,
    definitionId: raw.definitionId,
    name: raw.name,
    type: raw.type,
    isFaceDown: raw.isFaceDown ?? false,
    isTapped: raw.isTapped ?? false,
  };
}

function cloneCardInstance(instance) {
  return { ...instance };
}