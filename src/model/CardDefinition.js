// Simple static card definitions for the simulator.

const CARD_DEFINITIONS = [
  { id: "c1", name: "Soldier", type: "creature" },
  { id: "c2", name: "Archer", type: "creature" },
  { id: "c3", name: "Knight", type: "creature" },
  { id: "c4", name: "Fireball", type: "spell" },
  { id: "c5", name: "Heal", type: "spell" },
  { id: "c6", name: "Island", type: "land" },
  { id: "c7", name: "Mountain", type: "land" },
  { id: "c8", name: "Forest", type: "land" },
];

function getInitialDeckCardInstances() {
  // Starter deck: 40 cards (placeholder OK).
  const instances = [];
  let nextId = 1;

  CARD_DEFINITIONS.forEach((def) => {
    for (let copy = 0; copy < 5; copy += 1) {
      const instanceId = `ci_${nextId++}`;
      instances.push({
        id: instanceId,
        definitionId: def.id,
        name: def.name,
        type: def.type,
        // Zone rules will ultimately control visibility, but deck starts face-down.
        isFaceDown: true,
      });
    }
  });

  return instances;
}