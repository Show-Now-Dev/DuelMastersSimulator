# UI Layout

## Board Structure
①Battle Zone
②stack
③Shield Zone
④Deck
⑤Grave Yard
⑥Ex-dim Zone
⑦GR Zone
⑧Mana Zone
⑨Hand 
[------------①------------][--②--][control] [---------③---------][④][⑤][⑥][⑦][control] [------------⑧------------][ space ][control] [------------⑨------------][ space ][-logs-]

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
  Empty flexible area.
  Used for layout spacing.
  Must not contain cards.

- stack:
  Temporary zone for resolving effects.
  Cards do not remain here.

- Ex-dim Zone:
  Extra deck zone.
  Cards can be played from here.

- GR Zone:
  Special summon zone.
  May contain 0 or multiple cards.


## Layout Constraints

- Deck / Grave / Ex-dim / GR:
  Must be sized to fit ONE card only

- control:
  Fixed width column

- logs:
  Scrollable vertical area

- main zones (Battle / Shield / Mana / Hand):
  Must expand horizontally