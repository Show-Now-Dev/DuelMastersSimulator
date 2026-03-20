# UI Layout

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
  Displays cards stacked in a single pile

- ExZone:
  Extra deck zone.
  Cards can be played from here.

- GRZone:
  Special summon zone.
  May contain 0 or multiple cards.

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