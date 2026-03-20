// Zone holds an ordered list of CardStack IDs (left → right).
// Zones do NOT directly hold cardIds — cards live inside stacks.

const ZONE_IDS = {
  DECK:            "deck",
  HAND:            "hand",
  BATTLEFIELD:     "battlefield",
  SHIELD:          "shield",
  GRAVEYARD:       "graveyard",
  MANA:            "mana",
  RESOLUTION_ZONE: "resolutionZone",
  EX:              "ex",
  GR:              "gr",
};

function createZone(id, name) {
  return {
    id:       id,
    name:     name,
    stackIds: [],
  };
}

function removeStackId(zone, stackId) {
  return {
    ...zone,
    stackIds: zone.stackIds.filter(function (id) { return id !== stackId; }),
  };
}

// addStackIdFirst / Last correspond to "top" / "bottom" of a zone's order.
// "top" = front of the list (e.g. top of deck, drawn first).
function addStackIdFirst(zone, stackId) {
  return {
    ...zone,
    stackIds: [stackId].concat(zone.stackIds),
  };
}

function addStackIdLast(zone, stackId) {
  return {
    ...zone,
    stackIds: zone.stackIds.concat([stackId]),
  };
}
