// CardStack is an ordered grouping of cards (bottom → top).
// isTapped belongs to the stack, not to individual cards.

function createCardStack(id, cardIds) {
  return {
    id: id,
    cardIds: cardIds ? cardIds.slice() : [],
    isTapped: false,
  };
}
