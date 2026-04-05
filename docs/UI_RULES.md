# UI Rules

## Modal / Overlay Rules

- Modal must be rendered above all UI layers
- Modal must use a semi-transparent background overlay
- Modal content must be centered on screen

- Modal must NOT affect layout structure
- Modal must NOT shift or resize underlying zones

- Modal must be controlled via UI state (not Game state)

### Modal Types

The modal system is reusable and supports two distinct types:

#### type: "stack"
  - Triggered by clicking any CardStack in the battlefield or Stack zone
  - Displays all cards in the stack
  - Supports card selection within the modal
  - Cards shown in stack order (index 0 = top)

#### type: "zone"
  - Triggered by clicking any stacked zone: Deck, Graveyard, ExZone, GRZone
  - Displays all cards in the zone
  - For Deck: cards shown in strict order (index 0 = top of deck)
  - For Graveyard: cards shown with newest on top (index 0)
  - For ExZone / GRZone: cards shown in current order
  - Supports card selection within the modal

### Modal State

- Modal state lives in UI state only (not GameState)
- Modal state contains:
  - isOpen: boolean
  - type: "stack" | "zone" | null
  - targetId: string | null  // stackId or ZoneType
  - selectedCardIds: string[]  // modal-local selection, independent of main selection

### Modal Interaction Rules

- Opening a modal dispatches OPEN_MODAL
- Closing without action dispatches CLOSE_MODAL
- Selecting cards within modal dispatches SELECT_MODAL_CARDS
- Confirming a move from the modal dispatches MOVE_CARDS with the modal's selectedCardIds
- Modal selection is separate from and does not affect the main board selection
- Only one modal may be open at a time

- Modal must support:
  - Close (cancel)
  - Confirm actions
  - Multi-selection

### Modal Layout Rules

The modal panel is divided into three fixed regions:

```
┌─────────────────────────────┐
│ Header (title + close)      │  ← always visible, does not scroll
├─────────────────────────────┤
│                             │
│  Card list  (scrollable)    │  ← fills remaining space, scrolls
│                             │
├─────────────────────────────┤
│ Action bar + Footer         │  ← always visible, does not scroll
└─────────────────────────────┘
```

- Header and action/footer areas must always be fully visible within the viewport
- The card list area fills all remaining space between them
- Cards are displayed at full size (never scaled down to fit)
- Cards must not overflow outside the modal panel

#### Card list scroll direction

- Cards are always arranged in a single horizontal row, regardless of screen orientation
- Card list scrolls horizontally (overflow-x: auto)
- No vertical scrolling within the card list

#### Implementation

- Modal panel uses `display: flex; flex-direction: column`
- Header: `flex-shrink: 0`
- Card list: `flex-direction: row; flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden`
- Action bar + footer: `flex-shrink: 0`

---

---

## Drag and Drop

Cards can be dragged to move them between zones and stacks.

### Drag Sources

| Source | Behavior |
|---|---|
| Card in spread zone (not selected) and single-card stack | Drag that card alone |
| Card in spread zone (not selected) and multi-card stack | Drag the entire stack |
| Card in spread zone that is in the current selection | Drag all selected cards |
| Deck top card | Deck drag (see Deck Drag section) |
| Cards in Graveyard / Ex / GR | Not draggable from the board; use modal |

### Drop Targets and Behavior

| Drop Target | Behavior |
|---|---|
| Spread zone background (Hand / Mana / Shield / Battlefield / ResolutionZone) | Immediate MOVE_CARDS, position "bottom" |
| Graveyard zone | Immediate MOVE_CARDS, position "top" (fixed) |
| Existing stack card in a spread zone | Opens PENDING_DROP modal (position + face) |
| Ex / GR zone | Opens PENDING_DROP modal (position only) |
| Deck zone | Opens PENDING_DROP modal (position shortcuts + insert-at-N) |

### Deck Drag

Dragging the top card of the Deck allows placing it in specific zones:

| Target | Behavior |
|---|---|
| Hand | Immediate DRAW_CARD |
| Graveyard | Immediate MOVE_CARDS, position "top" |
| Mana / Shield | Opens PENDING_DROP modal (face + tap) → dispatches PLACE_FROM_DECK |
| Other zones | Drop not accepted |

### PENDING_DROP Modal

Shown when a drop requires user confirmation.
Which sections appear is controlled by the `DROP_TARGET_OPTIONS` table in `ui.js` —
no changes to the modal renderer or other files are needed to add a new option.

```
┌──────────────────────────────┐
│ どのように置きますか？  [✕]  │
├──────────────────────────────┤
│ 置く位置 (showPosition)      │
│   [上に置く*]  [下に置く]    │
├──────────────────────────────┤
│ 任意の枚数目に挿入            │  ← showInsertIndex (deck only)
│   上から [N▼] [確定]         │
├──────────────────────────────┤
│ 表裏 (showFace)              │  ← stack drops only
│   [そのまま*] [表向き] [裏向き]│
├──────────────────────────────┤
│ タップ状態 (showTap)         │  ← deck→mana/shield only
│   [アンタップ*]  [タップ]    │
├──────────────────────────────┤
│              [確定] [キャンセル]│
└──────────────────────────────┘
```

- Each section is shown only when its option flag is `true`
- `showInsertIndex: true` makes the position buttons act as immediate shortcuts
  (clicking "上に置く" / "下に置く" confirms immediately without the "確定" button)
- `* ` = default selection

### Visual Feedback

- `.is-dragging`: applied to the card being dragged (semi-transparent)
- `.drop-target-active`: applied to zones and cards that accept the current drag (dashed outline)

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