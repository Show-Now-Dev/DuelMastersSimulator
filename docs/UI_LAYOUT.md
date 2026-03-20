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
- Must occupy their defined unit width (8 units)
- Must stretch to fill available horizontal space
---

## Layout Units

- 1 unit = width of 1 card + margin

Zone widths:
- Battlefield: 8 units
- Shield: 6 units
- Mana: 8 units
- Hand: 8 units
- Stack: 2 units
- Deck / Graveyard / ExZone / GRZone:
  Must display only one card at a time

---

