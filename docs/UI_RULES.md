# UI Rules

---

## Core Principles (Highest Priority)

- UI must fit entirely within the viewport
- No horizontal scrolling allowed
- All zones must remain visible at all times
- Zone labels must always be visible

---

## Priority Rules

If rules conflict, follow this priority:

1. Core Principles
2. Architecture Rules
3. Layout / Rendering Rules

---

## Architecture Rules

### Layout Architecture Requirements

- The entire game board must be horizontally centered within the viewport
- Use layout-based centering (flex/grid/auto margins)
- Do NOT use hardcoded margins for centering

- The layout must scale proportionally based on viewport size
- Card size must be controlled via a single variable (e.g. CSS variable)
- Do NOT use fixed pixel sizes for core layout

---

### Zone Independence

- Each zone must be implemented as a reusable component
- Zones must NOT depend on their absolute position in the layout
- Do NOT hardcode layout logic inside zone styles

---

### Layout vs Logic Separation

- Layout (CSS Grid structure) must be independent from game logic
- Card behavior (tap, move, select) must NOT affect layout structure
- No layout changes should be required when adding game features

---

### Future Multiplayer Support

- The layout must support rendering multiple players' zones
- It must be possible to duplicate the entire board for an opponent
- It must be possible to flip the opponent's board visually without changing DOM structure

---

### No Hard Dependencies

- Do NOT rely on fixed ordering of DOM elements
- Use grid areas or explicit layout definitions

---

### Forbidden Practices

- Do NOT use fixed pixel-based layout for core structure
- Do NOT duplicate layout code for responsiveness
- Do NOT create separate mobile layouts
- Do NOT hardcode spacing based on screen size

---

## Size System

### Card Unit

- 1 card width = base unit width
- 1 card height = base unit height
- Unit includes margin/padding

---

## Layout Enforcement

- CSS Grid must match both:
  - grid-template-areas (structure)
  - grid-template-columns / rows (size)

- Do NOT auto-size zones
- Do NOT use content-based sizing

- All zones in the same row must have equal height

---

## Card Size Rules

- Card aspect ratio must be fixed (e.g. 5:7)
- Zone height must be based on card height
- Card size must scale proportionally

---

## Card Content Rules

- All card information must be contained within the card element
- No text or UI should exist outside the card bounds

Card must include:
- Name
- Cost
- Attributes (future)

- Content must scale with card size
- Font size must scale proportionally

---

## Card Layout & Overflow

- Cards are left-aligned
- Cards must stay within their zone boundaries
- Cards must NEVER overflow outside their zone

- Default horizontal gap must be minimal

If cards exceed available width:
→ overlap them horizontally

- Do NOT use scrollbars

---

## Tap / Rotation Behavior

- Tapped cards rotate 90 degrees
- Rotation must use center origin
- Rotated cards must remain inside their zone

- Overlap is allowed when cards are tapped

---

## Alignment Rules

- Single-card zones (Deck, Graveyard, ExZone, GRZone):
  Cards must be centered both vertically and horizontally

---

## Architecture Extension Rule

- The board layout must allow reconfiguration (mobile / opponent view)
  without rewriting the entire CSS
- Zones must be reusable components
- Player perspective must be switchable without changing DOM structure