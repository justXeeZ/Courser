# Agent Instructions — College Course Trees

College Course Trees is a local-first React + TypeScript web app for building and studying college course syllabi as interactive roadmap.sh-style chapter and sub-lesson prerequisite trees.

## 1. Repository Commands
Run from the repository root:
- `npm run dev` — start local Vite dev server (stop any dev server you started before finishing)
- `npm run typecheck` — run `tsc --noEmit`
- `npm run test` — run Vitest test suite (`vitest run`)
- `npm run build` — run `tsc -b && vite build`

## 2. Core Guardrails
- **Tailwind CSS v4 dark mode:** Keep `@custom-variant dark (&:where(.dark, .dark *));` in `src/index.css` (no `tailwind.config.*`) and the pre-paint `.dark` FOUC script in `index.html`.
- **Persistent sticky dark `Navbar`:** Keep `src/components/Navbar.tsx` sticky and dark in both Light and Dark modes. All other pages, cards, drawers, and modals must support both Light and Dark modes cleanly.
- **Strict clean schema (no legacy hacks):** Never add backwards-compatibility fallbacks or coercions for dropped schemas (`'reading'`, string `semester` options, or legacy v1 catalog storage keys).
- **Decouple brand strings from persistence:** Put user-facing brand copy in `src/config/brand.ts` (`BRAND`). Never tie `localStorage` keys, IndexedDB identifiers, or export envelope `format` identifiers to `BRAND`.
- **Workspace hygiene & user self-test:** Never create `.agents/teamwork/` metadata folders inside the repository (use external scratch directories only). When fixing an issue or adding a feature, kindly invite the user to test the changed feature themselves when needed to confirm everything went smoothly.
- **Ongoing changelog maintenance:** After completing any task that adds, changes, fixes, or removes behavior, update `CHANGELOG.md` before finishing. Add entries under "Unreleased" in the correct category, and move or reword existing entries if the task reverses an earlier change. Don't create entries for pure refactors, formatting, or comment changes unless they affect behavior.

## 3. Documentation Routing Table
Read only the document that matches your task:

| Task Area | Document to Read |
|---|---|
| UI, theming, layout, reusable components, copy tone, accessibility, or new pages | [`docs/design.md`](./docs/design.md) |
| Data schemas, IDs, progress math, file validation/GC, storage keys, import/export, or non-goals | [`docs/data-model.md`](./docs/data-model.md) |
| Adding, renaming, or removing a feature, schema field, resource kind, route, or UI label | [`docs/change-protocol.md`](./docs/change-protocol.md) |
| Milestone roadmap and planned future work | [`PLAN.md`](./PLAN.md) |
| Resolving known inconsistencies and open design questions | [`ISSUES.md`](./ISSUES.md) |

**Do not read the other docs unless the task needs them.**
