# Actions

All game operations are represented as Actions.

---

## DRAW_CARD

payload:
playerId

---

## SHUFFLE_DECK

payload:
playerId

---

## RESET_GAME

payload:
none

---

## MOVE_CARDS

Move one or more cards to a zone or onto a stack.

payload:
cardIds: string[]

target:
  type: "zone" | "stack"
  zone?: ZoneType
  stackId?: string

position:
  "top" | "bottom"

---

## MOVE_SELECTED_CARDS

Move currently selected cards.

payload:
target:
  type: "zone" | "stack"
  zone?: ZoneType
  stackId?: string

position:
  "top" | "bottom"

---

## CREATE_STACK

Create a new stack from selected cards in a zone.

payload:
zone: ZoneType

---

## SPLIT_STACK

Split a stack into two stacks.

payload:
stackId: string
cardIndex: number

description:
Split the stack at the given index.
Cards above the index form a new stack.

---

## MERGE_STACK

Merge two stacks.

payload:
sourceStackId: string
targetStackId: string
position: "top" | "bottom"

---

## TOGGLE_TAP_STACK

Toggle tap state of a stack.

payload:
stackId: string

---

## TOGGLE_TAP_SELECTED_STACKS

Toggle tap state of stacks that contain selected cards.

payload:
none

description:
If multiple selected cards belong to different stacks,
all those stacks will be toggled.

---

## TOGGLE_FACE_CARDS

Toggle face state of specific cards.

payload:
cardIds: string[]

---

## TOGGLE_FACE_SELECTED_CARDS

Toggle face state of selected cards.

payload:
none

---

## SELECT_CARDS

Set selected cards.

payload:
cardIds: string[]

---

## ADD_SELECTION

Add cards to current selection.

payload:
cardIds: string[]

---

## CLEAR_SELECTION

Clear all selected cards.

payload:
none