# UI Layout

## UI Layers

- Base Layer:
  Contains the main board layout

- Modal Layer:
  Renders overlay UI above the board
  Used for:
  - Stack card selection
  - Zone card selection (Deck, Graveyard, ExZone, GRZone)
  - Future selection dialogs

  Must:
  - Cover entire viewport
  - Be centered
  - Use semi-transparent background

## Board Structure

① Battlefield
② Stack
③ Shield
④ Deck
⑤ Graveyard
⑥ ExZone
⑦ GRZone
⑧ Mana
⑨ Hand

Row 1:
[------------①------------][--②--][control]

Row 2:
[---------③---------][④][⑤][⑥][⑦][control]

Row 3:
[------------⑧------------][space][control]

Row 4:
[------------⑨------------][space][-logs-]

---

## Zone Definitions

- control:
  UI control area.
  Contains buttons such as:
  - Draw
  - Shuffle
  - Move
  - Toggle tap/face

- logs:
  Log display area.
  Shows game actions and history.

- space:
  Flexible empty area.
  Expands to fill remaining horizontal space.
  Must not contain cards or interactive elements.

- Stack:
  Temporary zone for resolving effects.
  Cards do not remain here.
  Displays cards stacked in a single pile.
  Clicking a stack opens the modal (type: "stack").

- Deck:
  Ordered card pile. Top card = index 0.
  Rendered as a CardStack container (stacked appearance).
  Clicking the deck opens the modal (type: "zone", targetId: "deck").
  Cards are never displayed spread out directly in the zone.

- Graveyard:
  Discard pile. Newest card is always on top (index 0).
  Rendered as a CardStack container (stacked appearance).
  Clicking the graveyard opens the modal (type: "zone", targetId: "graveyard").
  Cards are never displayed spread out directly in the zone.

- ExZone:
  Extra deck zone. Cards can be played from here.
  Rendered as a CardStack container (stacked appearance).
  Clicking the ExZone opens the modal (type: "zone", targetId: "ex").
  Cards are never displayed spread out directly in the zone.

- GRZone:
  Special summon zone. May contain 0 or multiple cards.
  Rendered as a CardStack container (stacked appearance).
  Clicking the GRZone opens the modal (type: "zone", targetId: "gr").
  Cards are never displayed spread out directly in the zone.

---

## Stacked Zone Behavior

Deck, Graveyard, ExZone, and GRZone are all stacked zones.

A stacked zone:
- Renders its cards as a single stacked pile (CardStack visual)
- Shows only the top card face (or a card-back indicator)
- Shows a card count badge
- Does NOT display cards spread out in the zone itself
- Clicking the zone triggers OPEN_MODAL with the appropriate type and targetId
- Card selection and inspection happens exclusively through the modal

---

## Layout Constraints

- control:
  Fixed width (approx. 200px)
  Height matches row height

- logs:
  Fixed width (approx. 200px)
  Height fills available vertical space
  Vertical scroll enabled

Main zones (Battlefield, Shield, Mana, Hand):
- Must occupy their defined unit width
- Must stretch to fill available horizontal space

---

## Layout Units

- 1 unit = width of 1 card + margin

Zone widths:
- Battlefield: 8 card-units
- Shield: 6 card-units
- Mana: 8 card-units
- Hand: 8 card-units
- Stack: 2 card-units
- Deck / Graveyard / ExZone / GRZone:
  1 zone-unit each

---

## Row Width Constraint

- Each row must be exactly 10 card-units wide (excluding control/logs)

Row composition:

- Row 1:
  Battlefield (8) + Stack (2) = 10

- Row 2:
  Shield (6) + Deck (1) + Graveyard (1) + ExZone (1) + GRZone (1) = 10

- Row 3:
  Mana (8) + space (2) = 10

- Row 4:
  Hand (8) + space (2) = 10

- No row may exceed or shrink below 10 units
- All rows must align to the same right edge

---

## Grid Requirement

- Layout must be implemented using CSS Grid
- grid-template-columns must represent 10 units
- Each zone must occupy exact number of units
- Do NOT use auto-sizing (no auto / no content-based width)

---

## Unit Types

- card-unit:
  Width of a standard card

- zone-unit:
  Minimum width for single-card zones
  Must be larger than card-unit

---
