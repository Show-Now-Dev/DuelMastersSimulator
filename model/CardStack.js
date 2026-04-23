// CardStack is an ordered grouping of cards (bottom → top).
// isTapped belongs to the stack, not to individual cards.
//
// When isLinked === true, linkSlots describes the 2-D grid of link positions:
//   linkSlots: Array of { col: number, row: number, group: string[] }
//     col  — column index (0-based, x-axis)
//     row  — row index   (0-based, y-axis; 0 for all current implementations)
//     group — cardIds bottom→top for this slot's sub-stack
//   cardIds is always kept as the flat concat of linkSlots (sorted by row then col).
//
// When isLinked === false, linkSlots is null and cardIds works as before.

function createCardStack(id, cardIds) {
  return {
    id:         id,
    cardIds:    cardIds ? cardIds.slice() : [],
    isTapped:   false,
    isLinked:   false,
    linkSlots:  null,
  };
}

// Derives the flat cardIds array from linkSlots (sorted by row then col).
// Called by the reducer whenever linkSlots is created or modified.
function deriveCardIdsFromLinkSlots(linkSlots) {
  if (!linkSlots || !linkSlots.length) return [];
  var sorted = linkSlots.slice().sort(function (a, b) {
    return a.row !== b.row ? a.row - b.row : a.col - b.col;
  });
  var result = [];
  sorted.forEach(function (slot) {
    result = result.concat(slot.group);
  });
  return result;
}
