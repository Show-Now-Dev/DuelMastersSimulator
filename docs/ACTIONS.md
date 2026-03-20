# Actions

All game operations are represented as Actions.

---

## DRAW_CARD

Draw the top card of the deck into hand.

payload:
playerId

behavior:
- Always removes the card at index 0 (top) of deck.cardIds
- Card is added to hand.cardIds

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
  zone?: ZoneType      // required when type is "zone"
  stackId?: string     // required when type is "stack"

position: "top" | "bottom"
  // Used when target.type is "zone"
  // Ignored when target.type is "stack" (cards always go on top of stack)

behavior by target type:

  target.type === "zone" && zone === "deck":
    - position "top"    → insert card(s) at index 0 of deck.cardIds
    - position "bottom" → append card(s) at end of deck.cardIds
    - Deck order is strictly preserved; no implicit shuffling

  target.type === "zone" && zone === "graveyard":
    - Card(s) are always placed on top (index 0) of graveyard.cardIds
    - The position field is ignored for graveyard

  target.type === "zone" && zone is other (hand, battlefield, mana, shield, ex, gr):
    - position "top"    → insert at index 0
    - position "bottom" → append at end

  target.type === "stack":
    - Card(s) are placed on top of the target stack
    - The position field is ignored

---

## MOVE_SELECTED_CARDS

Move currently selected cards using the same behavior as MOVE_CARDS.

payload:
target:
  type: "zone" | "stack"
  zone?: ZoneType
  stackId?: string

position: "top" | "bottom"

behavior:
- Identical to MOVE_CARDS but operates on the current selection
- Selection is cleared after the move

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

---

## UI ACTIONS (UI State Only)

These actions do NOT affect GameState.
They are handled separately in UI state.

---

### OPEN_MODAL

Open the modal for card selection within a stack or zone.

payload:
type: "stack" | "zone"
targetId: string
  // When type is "stack": targetId is the stackId
  // When type is "zone":  targetId is the ZoneType (e.g. "deck", "graveyard", "ex", "gr")

---

### CLOSE_MODAL

Close the modal and discard any modal-local selection.

payload:
none

---

### SELECT_MODAL_CARDS

Set the card selection within the modal (does not affect main selection).

payload:
cardIds: string[]
