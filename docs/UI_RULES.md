# UI Rules

## Core Principles

- UI must fit within viewport
- No horizontal scrolling allowed
- All zones must remain visible
- Zone labels must always be visible

---

## Size System

### Card Unit

- 1 card width = base unit width
- 1 card height = base unit height
- Include margin/padding in the unit

---

## Layout Enforcement

- CSS Grid must match both:
  - grid-template-areas (structure)
  - grid-template-columns / rows (size)

- Do NOT auto-size zones
- Do NOT use content-based sizing

- All zones in the same row must have equal height

---

## Card Layout

- Cards are left-aligned
- Cards have minimal horizontal gap
- Cards must stay within their zone boundaries

- If cards exceed available width:
  → overlap them horizontally

- Do NOT use scrollbars

---

## Tap / Rotation Behavior

- Tapped cards rotate 90 degrees
- Rotation must use center origin
- Rotated cards must stay inside their zone

- Overlap is allowed when cards are tapped

---

## Overflow Control

- Cards must NEVER overflow outside their zone
- Zones must include internal padding to prevent overflow (especially when rotated)
- Use clipping if necessary

---

## Alignment Rules

- Single-card zones (Deck, Graveyard, ExZone, GRZone):
  Cards must be centered both vertically and horizontally

---

## Responsive Behavior

- Layout must adapt to smaller screens
- Layout must not break on resize
- Layout must not overflow viewport width

- Cards must scale proportionally
- Maintain aspect ratio

- Use relative units (%, vw, flex, grid)