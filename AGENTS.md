# Agent Instructions — College Course Trees

Every coding agent or contributor working in this repository **must** follow these rules:

## 1. Mandatory First Read
- **Read [`SPEC.md`](./SPEC.md) in full before starting any task.** It is the living source of truth for design tokens, reusable components, data schemas, storage keys, architecture, `[current]` vs `[planned]` status, and known inconsistencies.

## 2. Follow `SPEC.md` §4 (Change Protocol) on Every Edit
Whenever you add, edit, rename, or remove any feature, option, schema field, resource kind, UI label, config key, or route:
1. **Search the entire codebase** (including `src/`, `index.html`, `CONTRIBUTING_COURSES.md`, `SPEC.md`, and `src/**/__tests__/`) for every reference before finishing.
2. **Update all dependent layers together**, especially:
   - Schemas & pure libs (`src/types/course.ts`, `src/lib/storage/types.ts`, `src/lib/materialValidation.ts`, `src/lib/fileStore.ts`, `src/lib/courseExchange.ts`, `src/lib/theme.ts`)
   - Stores & UI components (`src/store/`, `src/components/`, `src/pages/`)
   - Documentation & authoring prompts (`src/pages/DataFormatsPage.tsx`, `src/data/courses/guide101-quick-start.ts`, `CONTRIBUTING_COURSES.md`)
   - Seed courses, examples & tests (`src/data/courses/demo201-feature-showcase.ts`, `src/data/exampleCourseExport.ts`, `src/data/exampleProgressBackup.ts`, and `src/**/__tests__/`)
3. **Update `SPEC.md` in the same change** whenever a design decision, schema rule, component interface, status (`[current]` / `[planned]`), or known inconsistency changes.
4. **Report every reference updated** in your final summary/handoff.

## 3. Repository Commands
Run from `d:\Creative Work\Vibes\vibe_roadmap.sh_college_fork`:
- `npm run dev` — start local Vite dev server (stop any dev server you started before finishing)
- `npm run typecheck` — run `tsc --noEmit`
- `npm run test` — run Vitest test suite (`vitest run`)
- `npm run build` — run `tsc -b && vite build`

## 4. Key Architectural Guardrails
- **Tailwind CSS v4 dark mode:** Uses `@custom-variant dark (&:where(.dark, .dark *));` in `src/index.css` (no `tailwind.config.*`). Never remove the `.dark` class selector or FOUC script in `index.html`.
- **Persistent dark `Navbar`:** Keep `Navbar` (`src/components/Navbar.tsx`) dark in both Light and Dark modes. All other pages, cards, drawers, and modals must support both Light and Dark modes cleanly.
- **Strict clean schema (no legacy hacks):** Do not introduce backwards-compatibility fallbacks for dropped schemas (e.g., `'reading'`, string `semester` options, or legacy v1 catalog storage keys).
- **Decouple brand strings from persistence:** User-facing brand copy belongs in `src/config/brand.ts` (`BRAND`); **never** tie `localStorage` keys (`college_course_trees_catalog_v2`, `college_course_trees_progress_v1`, `college_course_trees_theme`), IndexedDB identifiers (`college_course_trees` / `files`), or export envelope `format` identifiers (`college-course-tree`, `college-assessment`) to display brand strings.
- **Workspace hygiene:** Never create `.agents/teamwork/` metadata folders inside the repository; keep agent coordination files strictly in external scratch directories.
