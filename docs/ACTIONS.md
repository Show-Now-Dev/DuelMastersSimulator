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
  zoneId?: string      // required when type is "zone"
  stackId?: string     // required when type is "stack"

position: "top" | "bottom" | number
  // Used when target.type is "zone"
  // Ignored when target.type is "stack" (cards always go on top of stack)
  // number = 0-based insert index in zone.stackIds (deck insertion at arbitrary position)

behavior by target type:

  target.type === "zone" && zoneId === "deck":
    - position "top"    → insert card(s) at index 0 of deck.stackIds
    - position "bottom" → append card(s) at end of deck.stackIds
    - position number N → insert card(s) at index N of deck.stackIds
    - Deck order is strictly preserved; no implicit shuffling

  target.type === "zone" && zoneId === "graveyard":
    - Card(s) are always placed on top (index 0) of graveyard.cardIds
    - The position field is ignored for graveyard

  target.type === "zone" && zoneId is other (hand, battlefield, mana, shield, ex, gr):
    - Each card becomes its own new single-card stack in the zone
    - position "top"    → insert at index 0
    - position "bottom" → append at end
    - position number N → insert at index N

  target.type === "stack":
    - Card(s) are merged into the target stack
    - position "top"    → placed on top of the stack (end of cardIds)
    - position "bottom" → placed on bottom of the stack (start of cardIds)

notes:
  Stack operations are expressed as MOVE_CARDS:
  - "Create stack": move cards to an existing stack target
  - "Split stack":  move a subset of cards to a zone target
  - "Merge stacks": move all cards of one stack onto another stack target

---

## MOVE_SELECTED_CARDS

Move currently selected cards using the same behavior as MOVE_CARDS.

payload:
target:
  type: "zone" | "stack"
  zoneId?: string
  stackId?: string

position: "top" | "bottom"

behavior:
- Identical to MOVE_CARDS but operates on the current selection
- Selection is cleared after the move

---

## TOGGLE_TAP_STACK

Toggle tap state of a stack.

payload:
stackId: string

---

## TOGGLE_TAP_SELECTED_CARDS

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

Replace the current selection with a new list of card IDs.

payload:
cardIds: string[]

---

## TOGGLE_CARD_SELECTION

Toggle one card in/out of the current selection.

payload:
cardId: string

---

## CLEAR_SELECTION

Clear all selected cards.

payload:
none

---

## UI ACTIONS (UI State Only)

These actions do NOT affect GameState.
They are handled separately in UI state (uiState.js).

---

### SET_SELECTED_TARGET_ZONE

Set the currently selected target zone in the UI (e.g. dropdown value).

payload:
zoneId: string | null

---

### OPEN_MODAL

Open the CARD_SELECTOR modal for browsing cards in a stack or zone.

payload:
source:
  type: "stack" | "zone"
  id:   string            // stackId when type is "stack"; ZoneType when type is "zone"
selectionMode: "single" | "multiple"   // default "multiple"
visibility:    "all" | "top-n" | "hidden"  // default "all"
topN:          number                  // used when visibility is "top-n", default 3

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

---

### PEEK_CARDS

Add cards to the peeked set (displayed face-up without changing game state isFaceDown).

payload:
cardIds: string[]

behavior:
- Union operation — duplicate IDs are ignored

---

### REMOVE_PEEKED_CARDS

Remove specific cards from the peeked set (call after moving peeked cards).

payload:
cardIds: string[]

---

### CLEAR_PEEKED_CARDS

Clear all peeked cards.

payload:
none

---

## PLACE_FROM_DECK

Move the top card of the deck to a zone with explicit face and tap state.
Used for Deck → Mana / Shield drag-and-drop where the user chooses face/tap
in the confirmation modal.

payload:
zoneId:     string    // target zone ("mana" | "shield")
isFaceDown: boolean   // explicit face state (overrides zone default)
isTapped:   boolean   // tap state applied to the newly created stack

behavior:
- Takes the top card of the deck (index 0 of deck.stackIds, top cardId of that stack)
- Moves it to the target zone as a new single-card stack (position: "bottom")
- Overrides the zone default isFaceDown with the explicit isFaceDown payload value
- Sets isTapped on the newly created stack to the isTapped payload value
- Returns early with a "Deck is empty" status if the deck has no cards
