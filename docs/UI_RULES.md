# UI Rules

## Size Rules

All layout sizes must be based on card units.

### Card Unit
- 1 card width = base unit width
- 1 card height = base unit height
- Include margin/padding in the unit

### Zone Width Rules
- Battle Zone: 8 cards width
- Mana Zone: 8 cards width
- Hand: 8 cards width

- Stack: 2 cards width

- Deck: 1 card width
- Graveyard: 1 card width
- EX Zone: 1 card width
- GR Zone: 1 card width

### Height Rules
- All zones in the same row must have the same height
- Shield row and Deck/Grave/EX/GR must align vertically

### Overflow Rules
- Cards must never overflow outside their zone
- If cards exceed width, overlap them horizontally

### Strict Layout Requirement
- CSS Grid must match both:
  - structure (grid-template-areas)
  - AND size (grid-template-columns / rows)
- Do NOT auto-size zones
- Do NOT use content-based sizing

## Card Layout

- Cards must NEVER overflow their zone
- If cards exceed width:
  → overlap them horizontally

- Do NOT use scrollbars

## Responsive Behavior

- Layout must not break on resize
- If space is limited:
  → reduce card size proportionally

## Tap Behavior

- Rotated cards must stay inside zone
- Use center rotation

## Zone Constraints

- All zones must remain visible