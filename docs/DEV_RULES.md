# Development Rules

## Scope Control

- Fix only the requested area
- Do NOT modify unrelated files

## Change Policy

- Prefer minimal changes
- Do NOT refactor entire codebase

## Safety

- Do NOT break existing features
- Do NOT change layout structure

## Documentation

- If behavior changes:
  → update corresponding docs


## Documentation Sync Rule

Whenever you change implementation:

- You MUST update related documentation files:
  - ACTIONS.md
  - UI_LAYOUT.md
  - UI_RULES.md
  - ARCHITECTURE.md (if needed)

- Implementation and documentation must always stay consistent

- If there is any mismatch:
  → Fix the documentation

- Do NOT leave outdated documentation