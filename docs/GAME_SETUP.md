# Game Setup

## Initial Game Setup Rules

When a game starts, the following setup should be performed.

---

### 1. Deck Initialization

- Load a deck from a deck source (e.g. JSON file, user selection, or future API)
- Create card instances based on the deck definition
- Place all cards into the Deck zone
- Cards in the Deck should be face-down by default

---

### 2. Shuffle

- Shuffle all stacks in the Deck zone

---

### 3. Shield Setup (Default Rule)

- Take the top 5 cards from the Deck
- Move them to the Shield zone
- Cards moved to Shield should be face-down by default

---

### 4. Initial Hand (Default Rule)

- Draw 5 cards from the Deck
- Move them to the Hand zone
- Cards in Hand should be face-up by default

---

### 5. Zone Initialization

- Zones such as Battlefield, Mana, Graveyard, Resolution should start empty by default
- Some zones (e.g. EX, GR) may optionally be pre-populated depending on the deck definition

---

## Notes

- All movements must use MOVE_CARDS action
- Deck order must be preserved after shuffle
- Visibility (face-up / face-down) is a state and may change after setup
- Setup rules may vary depending on game mode or deck configuration