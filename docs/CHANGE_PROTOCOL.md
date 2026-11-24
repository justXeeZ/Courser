# Change Protocol

Match your verification effort to the scope of the change to avoid burning tokens.

## 1. Localized Fixes (Styling, Copy, Single-Component Bugs)
- Edit only the target file(s). Do **not** search the whole repo or read unrelated files.
- Run `npm run typecheck` and only the relevant test file (`npx vitest run <test-path>`).

## 2. Renaming or Modifying a Shared Symbol / Internal Option
- Grep `src/` for the exact symbol or string being changed and update callers + affected tests.
- Run `npm run typecheck` and affected tests.

## 3. Schema Field, Resource Kind, Storage/Export Format, Route, or Feature Changes
Only when changing data contracts or user-facing features, grep for the changed key/kind and update the affected layers:
1. **Schemas & libs:** `src/types/course.ts` and affected modules in `src/lib/` or `src/config/brand.ts`.
2. **Stores & UI:** Affected files in `src/store/`, `src/components/`, `src/pages/` (keep storage keys and format IDs decoupled from `BRAND`).
3. **Seeds, guides & docs (only if affected):** `src/data/`, `src/pages/DataFormatsPage.tsx`, [`CONTRIBUTING_COURSES.md`](./CONTRIBUTING_COURSES.md), and the matching file in `docs/` ([`DESIGN.md`](./DESIGN.md), [`DATA_MODEL.md`](./DATA_MODEL.md), [`CHANGELOG.md`](./CHANGELOG.md), or [`ISSUES.md`](./ISSUES.md)).
4. **Verify:** Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`.

## 4. Handoff & User Testing
- Finish with one concise line listing the files/areas touched (no exhaustive reference dumps).
- When fixing an issue or adding a feature, list the changed/ added features in an organized way and ask the user to test the feature themselves when needed to confirm everything went smoothly.
