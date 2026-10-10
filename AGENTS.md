# Blood Moon: Werewolf Game Master

Narrator's assistant for the Blood Moon werewolf game. One device, fully offline, free. Languages: English, Arabic (right-to-left), French, German.

## Expo HAS CHANGED

This project uses **Expo SDK 57** (React Native 0.86, React 19.2, TypeScript 7).
Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Where the rules come from

The rules are defined in three documents (the single source of truth):
- Rulebook
- Narrator Guide (night order steps 0–40, dawn resolution R0–R9, interactions)
- Role Compendium (all 64 role sheets)

The code must follow them exactly. When the code and a document disagree, the document wins: fix the code, or ask before changing the rule.

## Layout

- `app/` — screens (Expo Router).
- `src/engine/` — game-independent rules core. No React, no UI imports.
- `src/packs/werewolves/` — the Werewolves game pack: role definitions and night order.
- `__tests__/` folders next to the code they test. Run `npm test` and `npm run typecheck`.

## Rules for changes

- Every rule in the engine has a test. A rule change starts with a failing test.
- No network calls, analytics, crash reporting or ads: the app is fully offline.
- No user-visible text inside screens or the engine: all text goes through the translation files.
