// Zone is represented in state as: { id, name, cardIds: [] }

const ZONE_IDS = {
  DECK: "deck",
  HAND: "hand",
  BATTLEFIELD: "battlefield",
  SHIELD: "shield",
  GRAVEYARD: "graveyard",
  MANA: "mana",
};

function createZone(id, name) {
  return {
    id,
    name,
    cardIds: [],
  };
}

function removeCardId(zone, cardId) {
  return {
    ...zone,
    cardIds: zone.cardIds.filter((id) => id !== cardId),
  };
}

function addCardIdOnTop(zone, cardId) {
  return {
    ...zone,
    cardIds: [cardId, ...zone.cardIds],
  };
}

function addCardIdToBottom(zone, cardId) {
  return {
    ...zone,
    cardIds: [...zone.cardIds, cardId],
  };
}