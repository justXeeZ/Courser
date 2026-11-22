# College Course Trees — Living Specification (`SPEC.md`)

> **Status Legend**
> Every capability, token, schema field, and file reference in this specification is tagged as:
> - `[current]` — Implemented and verified in the repository (through Milestone 3 / M7).
> - `[planned]` — Reserved for unbuilt future enhancements (all Milestone 3 deliverables are now `[current]`).
>
> **How to use this document:** Read Sections 1–10 before changing UI, schemas, storage, or documentation. Follow Section 4 (**Change Protocol**) on every change, and update this file in the same change whenever a design or feature decision changes.

---

## 1. Purpose & Audience

- **Product purpose (`[current]`):** **College Course Trees** is a local-first, client-side web application for structuring college courses as interactive chapter-and-lesson study roadmaps inspired by roadmap.sh. Students and instructors can browse visual prerequisite trees, inspect study notes and materials, track completion (`todo`, `learning`, `done`, `skipped`), build or edit courses visually, and share portable `.course.json`, `.assessment.json`, or progress backup JSON files without any server account.
- **Milestone 3 standardization & enhancements (`[current]`):** Standardized Light and Dark mode contrast across the entire app (while keeping `Navbar` dark in both modes), fixed all 15 verified UI/UX issues, enforced a strict production-clean schema (dropping legacy v1/string-semester/`'reading'` fallbacks), added interactive LaTeX-capable exams and assignments with persisted scores, added an in-app native material viewer for uploaded files and cloud/video embeds, and centralized user-facing brand copy in `src/config/brand.ts`.
- **Target audience (`[current]`):**
  - **College students** planning semester coursework, studying chapter-by-chapter, taking self-assessments, and tracking progress locally in their browser.
  - **Course authors / instructors / LLM-assisted creators** authoring shareable `.course.json` course trees and `.assessment.json` exam packs.
  - **Contributors & AI coding agents** extending the codebase according to the conventions, tokens, and change protocol below.

---

## 2. Design Principles & UI System

### 2.1 Core Visual Principles
- **Local-first clarity (`[current]`):** Dense academic syllabi stay scannable through high-contrast typography, clean card borders, explicit status badges, and unmistakable primary actions.
- **Persistent dark navigation (`[current]`):** `Navbar` (`src/components/Navbar.tsx`) stays dark (`bg-slate-900 text-white border-slate-800/80`) in **both** Light and Dark modes, anchoring the workspace while all page bodies, cards, drawers, and modals adapt to the active theme.
- **4-tier neutral surface hierarchy (`[current]`):** Both Light and Dark modes avoid flat `slate-950`-on-`slate-900` inputs and muddy warning tints (`dark:bg-yellow-950/30`), using crisp border separation across canvas, surface-1, surface-2, and inset controls.

### 2.2 Colors

#### Page Canvas, Surfaces & Accents (`[current]`)
- **CSS variables & base rules (`src/index.css`, `index.html`):**
  - `src/index.css` defines `:root` and `.dark` CSS variables (`--surface-canvas`, `--surface-1`, `--surface-2`, `--surface-inset`, `--border-subtle`, `--border-strong`, `--text-primary`, `--text-secondary`, `--text-muted`), `.roadmap-canvas-frame`, `.roadmap-svg` node hover/status styles, and `.dark .katex` / `.katex-display` / `.katex-error` legibility rules.
  - `index.html` sets `<body class="bg-slate-50 text-slate-900 dark:bg-[#0b0f17] dark:text-slate-100 antialiased">` and runs the pre-paint `.dark` FOUC guard.
- **Light mode surface hierarchy:**
  - Canvas: `#f8fafc` (`bg-slate-50`)
  - Surface-1 (cards, headers, drawers, dialogs, `ProgressStrip`): `#ffffff` (`bg-white`)
  - Surface-2 (elevated rows, sticky section headers, nested `LessonEditorCard` headers): `#f1f5f9` (`bg-slate-100` / `bg-slate-50`)
  - Inset controls (`input`, `select`, `textarea`, inner dropzones): `#ffffff` with `border-slate-300`
  - Borders: crisp `slate-200` / `slate-300`
  - Text: `slate-900` primary, `slate-600` secondary, `slate-500` muted
  - Accents: `bg-yellow-400 text-black hover:bg-yellow-500` primary CTA, `bg-slate-900 text-white hover:bg-slate-800` secondary CTA, warm `amber-400` / `yellow-400` highlights (`border-l-4 border-l-amber-400` in `ChecklistView` and `ChapterEditorCard`), and red destructive accents (`text-red-600 border-red-200 hover:bg-red-50`).
- **Dark mode surface hierarchy:**
  - Canvas: `#0b0f17` (`dark:bg-[#0b0f17]`)
  - Surface-1 (cards, drawers, dialogs, `ProgressStrip`, `CourseHeader`): `#121926` (`dark:bg-[#121926]`)
  - Surface-2 (elevated rows, sticky headers, `LessonEditorCard` headers): `#1b2436` (`dark:bg-[#1b2436]`)
  - Inset controls (`input`, `select`, `textarea`, inner code/dropzones): `#0d131f` (`dark:bg-[#0d131f]`) with crisp `dark:border-slate-600` (`#3b4a62`)
  - Text: `#f8fafc` primary (`dark:text-slate-100`), `#cbd5e1` secondary (`dark:text-slate-300`), `#94a3b8` muted (`dark:text-slate-400`)
- **Theme rules & verified fixes:**
  - `Navbar` (`src/components/Navbar.tsx`): remains dark (`border-b border-slate-800/80 bg-slate-900 text-white`) in **both** Light and Dark modes.
  - `CatalogPage`, `CourseCard`, `SearchModal`: full Light & Dark mode support using the 4-tier palette.
  - `ProgressStrip`: clean neutral surface (`bg-white border-slate-200 shadow-xs dark:border-slate-700/80 dark:bg-[#121926]`) with neutral filter container (`dark:bg-[#0d131f]`).
  - `ChecklistView` chapter header: `border-l-4 border-l-amber-400 bg-slate-50 dark:border-l-amber-400 dark:bg-[#1b2436]`.
  - `LessonEditorCard` header: identical surface & border classes (`border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-[#1b2436]`) when collapsed vs. expanded (toggling only `sticky top-[104px] z-10 rounded-t-md` vs. `rounded-md`).
  - KaTeX math formulas: legible contrast in `.dark` (`src/index.css`).

#### SVG Roadmap Palette (`src/lib/theme.ts` & `src/index.css`)
- **`ROADMAP_COLORS` (`src/lib/theme.ts`, `[current]`):**
  - `chapterFill: '#fdff00'`, `chapterHover: '#d6d700'`
  - `lessonFill: '#ffe599'`, `lessonHover: '#f3c950'`
  - `nodeStroke: '#000000'`, `nodeText: '#000000'`, `edgeBlue: '#2b78e4'`
  - `statusDoneFill: '#cbcbcb'`, `statusLearningFill: '#dad1fd'`, `statusSkippedFill: '#64748b'`, `statusSkippedText: '#ffffff'`
  - `canvasBg: '#f9fafb'`, `darkNavBg: '#0f172b'`
- **SVG state CSS classes (`src/index.css`, `[current]`):**
  - `.roadmap-svg g.node-done > rect.node-rect` (`#cbcbcb` + `line-through` text `#000000`)
  - `.roadmap-svg g.node-learning > rect.node-rect` (`#dad1fd` + `underline` text `#000000`)
  - `.roadmap-svg g.node-skipped > rect.node-rect` (`#64748b` + `line-through` text `#ffffff`)
  - `.roadmap-svg g.node-highlighted > rect.node-rect` (`stroke: #2b78e4`, `stroke-width: 3.4`)

#### Resource Kind Badges (`RESOURCE_BADGE_STYLES` in `src/lib/theme.ts`)
- **`[current]` M2 distinct Light & Dark palette (9 kinds, zero collisions):**
  - `document` *(replaces `reading`)*: `{ label: 'Document', className: 'bg-sky-200 text-slate-950 dark:bg-sky-400/20 dark:text-sky-200' }`
  - `course`: **red** (`bg-red-600 text-white dark:bg-red-500 dark:text-white`)
  - `textbook`: **teal** (`bg-teal-600 text-white dark:bg-teal-500 dark:text-slate-950`)
  - `official`: **blue** (`bg-blue-600 text-white dark:bg-blue-500 dark:text-white`)
  - `slides`: **amber** (`bg-amber-300 text-slate-950 dark:bg-amber-400/25 dark:text-amber-200`)
  - `video`: **purple** (`bg-purple-300 text-slate-950 dark:bg-purple-400/25 dark:text-purple-200`)
  - `lab`: **emerald** (`bg-emerald-400 text-slate-950 dark:bg-emerald-400/25 dark:text-emerald-200`)
  - `exam`: dark-mode-safe slate/white (`bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950`)
  - `assignment`: **indigo** (`bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white`)

### 2.3 Typography
- **Body font stack (`src/index.css`, `[current]`):** `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
- **Roadmap SVG font (`src/index.css`, `[current]`):** `.font-roadmap` (`"Balsamiq Sans", ui-sans-serif, system-ui, sans-serif`) bundled locally via `@fontsource/balsamiq-sans/400.css` and `700.css` (imported in `src/index.css`, zero external Google Fonts requests).
- **Monospace (`[current]`):** Tailwind `font-mono` for course codes (`CS101`), slugs, chapter/lesson IDs, percentages, file sizes, `<kbd>` shortcuts, and JSON `<pre>` blocks.
- **Mathematical notation (`[current]`):** `katex` (`katex/dist/katex.min.css` imported in `src/index.css`) rendered by `src/lib/mathRender.ts` and `src/components/RichMathText.tsx` for inline (`$...$`, `\(...\)`) and display (`$$...$$`, `\[...\]`) LaTeX inside interactive exams/assignments and live builder previews.

### 2.4 Spacing, Border Radius, Shadows & Icons
- **Icons (`[current]`):** `lucide-react` exclusively (`^0.511.0`, `package.json`).
- **Page & component spacing (`[current]`):**
  - Standard centered pages: `mx-auto max-w-5xl px-4 sm:px-6` (`Navbar`, `CatalogPage`, `CourseHeader`, `CourseEditorPage`, `EditorStickyBar`); `ProgressStrip` uses `mx-auto max-w-5xl px-3 py-2.5`.
  - Wide workspace & guide containers: `CoursePage.tsx` (`mx-auto max-w-6xl px-4 py-5 sm:px-6`) and `DataFormatsPage.tsx` (`mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-10`).
  - Checklist container (`ChecklistView.tsx`): `mx-auto max-w-4xl space-y-5 pb-12`.
  - Drawer padding (`DrawerShell.tsx`): `sm:max-w-[600px]` with `p-4 sm:p-6`.
- **SVG layout metrics (`src/lib/layoutTree.ts`, `[current]`):**
  - `NODE_LINE_HEIGHT = 20`, `BASE_NODE_HEIGHT = 46`, `CHAPTER_MIN_WIDTH = 256`, `CHAPTER_MAX_WIDTH = 340`, `CHAPTER_FONT_SIZE = 17`, `LESSON_MIN_WIDTH = 172`, `LESSON_MAX_WIDTH = 300`, `LESSON_FONT_SIZE = 16.5`, `BRANCH_GAP_X = 72`, `LESSON_GAP_Y = 16`, `CHAPTER_GAP_Y = 64`, `PADDING_X = 40`, `PADDING_TOP = 36`, `PADDING_BOTTOM = 48`, `rx = 5`, `strokeWidth = 2.7` (`3.4` highlighted, `3.5` edges).
- **Border radius (`[current]`):**
  - `rounded-sm`: `ResourceBadge`
  - `rounded`: inline status pills, `<kbd>`, filter toggles
  - `rounded-md`: buttons, inputs, `ProgressStrip`, material rows, navbar logo mark
  - `rounded-lg`: `CourseCard`, `ConfirmDialog`, `ExportCourseDialog`, `ImportCourseDialog`, `ChecklistView` cards, `<pre>` blocks
  - `rounded-xl`: `SearchModal`, `DataFormatsPage` section & TOC cards, `CoursePage` backup modal, `AssessmentBuilderModal`, `AssessmentRunnerModal`, `MaterialViewerModal`
  - `rounded-full`: count badges, `Navbar` theme toggle & `+ New Course`, `CourseCard` term pill, `DataFormatsPage` badge pill
- **Shadows (`[current]`):** `shadow-xs` (cards/sections), `shadow-lg` (`QuickStatusPill`), `shadow-xl` (`CoursePage` backup modal), `shadow-2xl` (`DrawerShell`, `SearchModal`, `ConfirmDialog`, `ExportCourseDialog`, `ImportCourseDialog`, `AssessmentBuilderModal`, `AssessmentRunnerModal`, `MaterialViewerModal`).

### 2.5 Layout Patterns
- **Top navigation shell (`src/App.tsx`, `src/components/Navbar.tsx`, `[current]`):** Persistent `h-16` dark `<header>` above `<main className="min-h-[calc(100vh-64px)] ...">`.
- **Sticky editor bars (`[current]`):**
  - `EditorStickyBar` (`src/components/editor/EditorStickyBar.tsx`): `sticky top-0 z-30 min-h-14` (`data-testid="editor-sticky-bar"`) with sticky `+ Add Chapter`, `Collapse all`, and `Save` controls.
  - `ChapterEditorCard` (`src/components/editor/ChapterEditorCard.tsx`): `sticky top-14 z-20 min-h-12`.
  - `LessonEditorCard` (`src/components/editor/LessonEditorCard.tsx`): `sticky top-[104px] z-10` when expanded.
- **Right slide-over drawer (`src/components/DrawerShell.tsx`, `[current]`):** Fixed `z-30` backdrop + `z-40` right `<aside>` (`h-dvh w-full sm:max-w-[600px]`), sticky header (`headerLeft` / `headerRight` + close `X`), scrollable body, optional `footer`.
- **Centered & top-aligned modals (`[current]`):** `fixed inset-0 z-50 flex items-center justify-center p-4` (`max-w-md` for `ConfirmDialog`, `ExportCourseDialog`, and `CoursePage` backup modal; `max-w-lg` for `ImportCourseDialog`; `max-w-4xl` for `AssessmentRunnerModal`; `max-w-5xl` for `AssessmentBuilderModal` and `MaterialViewerModal`); `SearchModal` uses top-aligned `fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-20 dark:bg-black/70` with `max-w-lg`.
- **Documentation TOC (`src/pages/DataFormatsPage.tsx`, `[current]`):** Structured Table of Contents (`lg:` sticky sidebar TOC + `"On this page"` vertical TOC card on mobile/tablet).

### 2.6 Reusable Components & When to Use Them

| Component | Source Path | Status | When to Use |
|---|---|---|---|
| `Navbar` | `src/components/Navbar.tsx` | `[current]` | Global top bar (`BRAND.mark`, `BRAND.shortName`, bookmarks count, search trigger, theme cycler, `+ New Course`); stays dark in both Light & Dark modes. |
| `DrawerShell` | `src/components/DrawerShell.tsx` | `[current]` | Standard `600px` right slide-over panel with `Escape` + backdrop close for reading/marking items (`ChapterDrawer`, `LessonDrawer`). |
| `StatusSegmentedControl` | `src/components/StatusSegmentedControl.tsx` | `[current]` | Marking an item `learning` / `done` / `skipped` (and optional `todo` reset via `showReset`). Use `itemRole="menuitem"` in popovers, `"button"` in drawers. |
| `QuickStatusPill` | `src/components/QuickStatusPill.tsx` | `[current]` | Fixed `z-50` floating status popover triggered by right-click (`onContextMenu`) on SVG tree nodes (`Shift+Click` calls `toggleDone` directly). |
| `ConfirmDialog` | `src/components/ConfirmDialog.tsx` | `[current]` | Destructive confirmations (e.g., deleting a course from catalog, course page, or editor). |
| `ExportCourseDialog` | `src/components/ExportCourseDialog.tsx` | `[current]` | Exporting `.course.json` with optional base64 IndexedDB file attachment bundling and size summary. |
| `ImportCourseDialog` | `src/components/editor/ImportCourseDialog.tsx` | `[current]` | Importing a `.course.json` file or pasted JSON into `/editor/new` with error list and warning banner. |
| `ResourceBadge` | `src/components/ResourceBadge.tsx` | `[current]` | Compact category pill for any `LessonResource` using `RESOURCE_BADGE_STYLES`. |
| `MaterialList` | `src/components/MaterialList.tsx` | `[current]` | Rendering lesson/chapter materials; pins `recommended: true` to top with badge, displays `Best: XX%` assessment score pills, and routes clicks to `MaterialViewerModal` or `AssessmentRunnerModal`. |
| `ProgressStrip` | `src/components/ProgressStrip.tsx` | `[current]` | Course progress bar (`% DONE`, counts, status filter pills, interaction hint) with clean neutral Light/Dark surface. |
| `RichMathText` | `src/components/RichMathText.tsx` | `[current]` | Rendering prose mixed with inline/display KaTeX math (`$...$`, `$$...$$`, `\(...\)`, `\[...\]`) safely via `mathRender.ts`. |
| `AssessmentBuilderModal` | `src/components/assessment/AssessmentBuilderModal.tsx` | `[current]` | Visual authoring/editing modal for interactive exams & assignments (LaTeX live preview, image header upload/URL, JSON import/export). |
| `AssessmentRunnerModal` | `src/components/assessment/AssessmentRunnerModal.tsx` | `[current]` | Distraction-free interactive exam/assignment player (Exam timer/flagging/submit/review vs. Assignment instant-check/hints, persisted scores). |
| `MaterialViewerModal` | `src/components/viewer/MaterialViewerModal.tsx` | `[current]` | In-app fast viewer for uploaded files (PDF, video w/ speed + shortcuts, audio, zoomable images, line-numbered code/text/Markdown/JSON/CSV) and embeddable links (Google Drive/Docs/Slides/Sheets, OneDrive/SharePoint w/ fallback card, YouTube, Vimeo). |

### 2.7 Tone of Voice & Accessibility Conventions
- **Tone of voice (`[current]`):** Concise, student-oriented, action-first labels (`"All Courses"`, `"Course Tree"`, `"Syllabus Checklist"`, `"Edit Course"`, `"Export Course"`, `"Backup Progress"`, `"Download SVG"`, `"Delete Course"`). Empty states pair a clear statement with an actionable CTA or hint.
- **Landmarks & semantics (`[current]`):** `<header>`, `<nav>`, `<main>`, `<footer>`, `role="tablist"` + `role="tab"` + `aria-selected`, `role="dialog" aria-modal="true"` (`aria-label` or `aria-labelledby`), and `role="alert"` for validation/storage errors.
- **Keyboard interactions (`[current]`):**
  - Global (`src/App.tsx`): `Ctrl/Cmd+K` toggles `SearchModal`; `/` opens `SearchModal` when focus is not inside `INPUT`, `TEXTAREA`, or `contentEditable` (`SELECT` is guarded in `ChapterDrawer`, `LessonDrawer`, and `MaterialViewerModal`).
  - Drawers & dialogs: `Escape` closes the topmost dialog/drawer (`CoursePage` guards drawer `Escape` and status/navigation shortcuts while sub-modals are open via `hasSubModalOpen`); `ChapterDrawer` (standalone) and `LessonDrawer` bind `L` (Learning), `D` (Done), `S` (Skipped), `ArrowLeft` / `ArrowRight` (prev/next item) guarded against typing in inputs.
  - SVG tree nodes (`CourseTreeCanvas.tsx`): `<g role="button" tabIndex={0} aria-label={...}>` supporting `Enter` / `Space`.
  - Video viewer (`MaterialViewerModal.tsx`): `Space` play/pause, `ArrowLeft`/`ArrowRight` seek 5s, `F` fullscreen, `Escape` close.

### 2.8 Checklist: "When Building a New Page"
1. Wrap content in `<main className="min-h-[calc(100vh-64px)] ...">` using the **4-tier Light/Dark neutral palette** (`#f8fafc` / `#0b0f17` canvas, `#ffffff` / `#121926` surface-1, `#f1f5f9` / `#1b2436` surface-2, crisp borders) — never hardcode dark-only or light-only backgrounds.
2. Keep `Navbar` dark in both modes (do not override `Navbar` for individual pages).
3. Use `mx-auto max-w-5xl px-4 sm:px-6` (`max-w-6xl` for wide canvas/sidebar layouts like `CoursePage` and `DataFormatsPage`) and test at both desktop (`1440x900`) and mobile (`390x844`) with zero horizontal overflow.
4. Read brand strings from `BRAND` (`src/config/brand.ts`) rather than hardcoding product names or backup filenames.
5. Register the route in `src/App.tsx` and keep `/` fallback routing intact; verify whether startup `garbageCollectFiles` in `App.tsx` should skip or run on the new route.
6. Ensure proper landmarks (`<main>`, headings hierarchy `h1` -> `h2`), `aria-label` on icon-only buttons, `Escape` handling on any modal/drawer, and keyboard-accessible controls.
7. Add Vitest + Testing Library component tests in the co-located `__tests__/` directory covering Light/Dark classes, routing, and accessibility roles.

---

## 3. Features

### 3.1 Catalog & Discovery
- **Home Catalog (`CatalogPage.tsx`, `CourseCard.tsx`, `[current]`):**
  - Displays courses grouped by `department` (`'Preparatory'` ordered first, then alphabetical; sorted within department by term then `code` via `getCoursesByDepartment` in `src/data/courses/index.ts`).
  - Tabs: `'all'` (`BRAND.shortName` / `"Course Trees"`), `'bookmarked'` (`/?tab=bookmarked`), `'in-progress'` (`/?tab=in-progress`).
  - Full Light & Dark mode adaptation (while `Navbar` stays dark); displays `formatCourseTerm(course)` on `CourseCard`; footer link `"Data formats →"`; uses `BRAND` constants (`name`, `shortName`, `heroDescription`, `footerNote`).
- **Global Search Modal (`SearchModal.tsx`, `src/App.tsx`, `[current]`):**
  - Triggered via `Navbar` button, `Ctrl/Cmd+K`, or `/`. Searches courses, departments, chapters, and sub-lessons.
  - Full Light & Dark mode styling and `formatCourseTerm(course)` display.

### 3.2 Course Viewing, Tree Canvas, Checklist & Progress Tracking
- **Course Header (`CourseHeader.tsx`, `[current]`):**
  - Displays back link (`All Courses`), course code/department/`formatCourseTerm(course)`/credits, title, description, `Course Tree` / `Syllabus Checklist` tabs, and action controls (`Bookmark`, `Edit Course`, `Export Course`, `Backup Progress`, `Download SVG`, `Delete Course`).
  - **Bookmark** stays a standalone icon button; `Edit Course`, `Export Course`, `Backup Progress`, `Download SVG`, and `Delete Course` collapse into compact icon-only buttons that smoothly reveal their text labels on hover/focus (`group-hover/btn` / `group-focus-visible/btn`). On narrow/mobile viewports (`< sm`), extra controls collapse behind a toggle button (`ChevronLeft`) that smoothly reveals them horizontally **to the left** of the toggle button with zero horizontal overflow.
- **Progress Strip (`ProgressStrip.tsx`, `useProgressStore.tsx`, `[current]`):**
  - Shows `% DONE`, `done of required Required Items Done` (`required = Math.max(0, total - skipped)`), `Learning` & `Skipped` counts, status filter (`All`, `Todo`, `Learning`, `Done`, `Skipped`), and interaction hint on a clean neutral Light/Dark surface (`dark:border-slate-700/80 dark:bg-[#121926]`).
- **Interactive SVG Tree (`CourseTreeCanvas.tsx`, `layoutTree.ts`, `[current]`):**
  - Pure SVG layout engine (`layoutCourseTree`) placing chapters down center spine and balancing sub-lessons left/right with straight spine edges and cubic Bezier branch edges (with hover highlighting for prerequisites; `layoutCourseTree` also accepts an unused `rtl?: boolean` option with no UI toggle), smooth zoom (`70%`–`140%` + reset via `transition-[width,max-width] duration-200 ease-out`), `Download SVG` (via `CourseHeader`), click-to-open drawer, right-click (`onContextMenu`) to open `QuickStatusPill`, and `Shift+Click` to call `toggleDone` (`onQuickToggleDone`).
  - Dims non-matching standalone and multi-lesson chapters (`opacity: 0.3`) when `statusFilter !== 'all'`; renders `0/0` pill in slate `#64748b` when all lessons in a chapter are skipped (`stats.required === 0 && stats.skipped > 0`); hides the top-right circular status badge on standalone chapters when `chapterStatus === 'todo'` (showing it only when `chapterStatus !== 'todo'`).
- **Syllabus Checklist (`ChecklistView.tsx`, `[current]`):**
  - Accessible list view with chapter cards (`border-l-4 border-l-amber-400 bg-slate-50 dark:bg-[#1b2436]`), expand/collapse, sub-lesson check toggles, and `Open` drawer triggers.
  - Standalone chapters (`lessons: []`) render without a `"Standalone"` badge or redundant child row—placing the interactive status toggle directly on the chapter header bar (with material count + `Open` on the right) and dimming non-matching standalone chapters (`data-filtered-out="true"`, `opacity-40`) when filtered.
- **Chapter & Lesson Drawers (`ChapterDrawer.tsx`, `LessonDrawer.tsx`, `[current]`):**
  - 600px `DrawerShell` showing overview/notes, clickable prerequisites (skipped items styled distinctly), status segmented control, keyboard shortcuts (`L`/`D`/`S`/`←`/`→`), and `MaterialList`.
  - On multi-lesson chapters (`!standalone`), hides the `Chapter Materials` section completely when `resources.length === 0` (keeping the empty state on standalone chapters and sub-lessons), names the multi-lesson first tab `Overview`, and forwards `onOpenMaterialViewer` and `onOpenAssessment` callbacks.
- **Materials Display (`MaterialList.tsx`, `ResourceBadge.tsx`, `[current]`):**
  - Sorts `recommended: true` items to top with a **Recommended** pin badge (preserving relative order), renders collision-free `ResourceBadge` colors, shows persisted `Best: XX%` score pills on interactive assessments, opens `MaterialViewerModal` on uploaded files & embeddable/media URLs (with a secondary `"Open in new tab"` link; falling back to `openStoredFile` if `onOpenMaterialViewer` is omitted), and opens `AssessmentRunnerModal` on interactive `assessment` resources.

### 3.3 Course Authoring, Storage & Import/Export
- **Course Editor (`CourseEditorPage.tsx`, `EditorStickyBar.tsx`, `ChapterEditorCard.tsx`, `LessonEditorCard.tsx`, `PrerequisitePicker.tsx`, `MaterialsEditor.tsx`, `[current]`):**
  - Routes `/editor/new` and `/course/:slug/edit`. Live split/tabbed editor + SVG preview, auto-derived canonical IDs (`rekeyCourseContentIdsWithMap`), progress/bookmark/assessment-score remapping on save (`remapCourseProgress`), deletion with `forgetCourse`.
  - High-contrast 4-tier Light & Dark palette across all editor cards, inputs, and dialogs.
  - Structured term controls: `Year` (`<input type="number" min={1} max={10} />`) + `Semester` (`1st` / `2nd` radio group + `Clear` action).
  - Sticky `+ Add Chapter` button in `EditorStickyBar` (scrolling smoothly to the new `ChapterEditorCard`).
  - Stable `LessonEditorCard` header surface & border across collapsed and expanded states.
  - `MaterialsEditor` includes `Pin as recommended` toggle (`recommended?: boolean`), `'document'` default/suggestion, and 3rd material source mode **`Interactive`** (`Build / Edit` -> `AssessmentBuilderModal`, `Import JSON`, `Export JSON`).
- **Local Persistence & File Store (`useCourseStore.tsx`, `useProgressStore.tsx`, `useThemeStore.tsx`, `localRepositories.ts`, `fileStore.ts`, `materialValidation.ts`, `[current]`):**
  - `localStorage` keys: `COURSES_STORAGE_KEY = 'college_course_trees_catalog_v2'`, `PROGRESS_STORAGE_KEY = 'college_course_trees_progress_v1'`, `THEME_STORAGE_KEY = 'college_course_trees_theme'`.
  - IndexedDB: `FILE_DB_NAME = 'college_course_trees'`, `FILE_DB_VERSION = 1`, `FILE_STORE_NAME = 'files'` (`collectReferencedFileIds`, `garbageCollectFiles`, `putFile`, `getFile`, `deleteFile`, `listFileIds`, `openStoredFile`).
  - Strict clean schema (R3): zero legacy v1 migration/coercion hacks (`LEGACY_COURSES_STORAGE_KEY`, `LEGACY_SEED_SLUGS`, `migrateLegacyV1Catalog` absent). `collectReferencedFileIds` also scans `resource.assessment?.questions[].header.imageFile?.id`, and `openStoredFile` supports aligned `.mov`/`.m4v`/`.wav`/`.m4a`/`.ogg` & `.tsx`/`.jsx`/`.hpp`/`.cs`/`.go`/`.rs`/`.sql` extensions. `ProgressState` includes `assessmentScores` (`getAssessmentScoreKey`, `recordAssessmentScore`, `getAssessmentScore`, remap/forget).
- **Course & Progress Import/Export (`courseExchange.ts`, `ExportCourseDialog.tsx`, `ImportCourseDialog.tsx`, `CoursePage.tsx`, `[current]`):**
  - `.course.json` (`COURSE_EXPORT_FORMAT = 'college-course-tree'`, `COURSE_EXPORT_VERSION = 1`) with optional base64 attachments (`buildCourseExport`, `parseCourseImport`) and `.json` progress backup (`exportProgressJson`, `importProgressJson`).
  - Strict schema (R3): no legacy `'reading' -> 'document'` coercion and no legacy `"Year N - First/Second Semester"` string migration; bundles & restores `assessment.questions[].header.imageFile` attachments via fresh `deriveFileId(course.code)`. Backup download filename in `CoursePage.tsx` reads `BRAND.progressBackupFilename` (`college-course-progress.json`).

### 3.4 Interactive Exams & Assignments (`[current]` — R4)
- **Standalone & Embedded Exchange (`src/lib/assessmentExchange.ts`, `[current]`):**
  - Envelope format: `ASSESSMENT_EXPORT_FORMAT = 'college-assessment'`, `ASSESSMENT_EXPORT_VERSION = 1` (`buildAssessmentExport`, `parseAssessmentImport`) supporting standalone `.assessment.json` (or bare `AssessmentData`) plus optional base64 image attachments.
- **Math Rendering (`src/lib/mathRender.ts`, `src/components/RichMathText.tsx`, `[current]`):**
  - Safe tokenizer splitting plain prose (rendered as React text nodes — zero HTML injection/XSS surface) from inline (`$...$`, `\(...\)`) and display (`$$...$$`, `\[...\]`) KaTeX math (`throwOnError: false`, ignoring escaped `\$` and currency like `$50`).
- **Visual Builder (`src/components/assessment/AssessmentBuilderModal.tsx`, `[current]`):**
  - Configure `mode` (`'exam' | 'assignment'`), LaTeX `instructions` (with live preview), `timeLimitMinutes`, `passingScorePercent`, `shuffleQuestions`.
  - Manage questions (Add, Duplicate, Reorder Up/Down, Delete; protecting the last remaining question) across 4 types (`mcq`, `multi-select`, `true-false`, `short-answer`).
  - Question header supports LaTeX text with live preview and/or raster header image (uploaded to IndexedDB via `putFile` + `deriveFileId` or `http://`/`https://` URL), plus `points`, `hint`, and `explanation`.
  - Top actions: `Import JSON`, `Export JSON`, `Cancel`, `Save`.
- **Interactive Runner (`src/components/assessment/AssessmentRunnerModal.tsx`, `[current]`):**
  - **Assignment mode:** Per-question `Check Answer`, optional `Show Hint`/`Hide Hint` toggle, instant feedback + LaTeX explanation, `Finish Assignment` summary.
  - **Exam mode:** Optional countdown timer (auto-submitting at `00:00`), `Flag for review`, jumpable question navigator, single `Submit Exam`, graded results screen (% score, `Passed` / `Not Passed` pill, full per-question review), `Retake`.
  - Persists best/latest score and pass status to `useProgressStore` (`assessmentScores`) for display in `MaterialList` (`Best: XX%`) and export in Progress Backup JSON.

### 3.5 Native Fast Material Viewer (`[current]` — R5)
- **URL Embed Resolver (`src/lib/embedResolver.ts`, `[current]`):**
  - Pure classifier (`resolveEmbedUrl(rawUrl)`) mapping `https://` URLs to:
    - `google-drive`: transforms Google Drive (`/file/d/<id>/view`, `open?id=<id>`, `uc?id=<id>`), Docs, Slides, and Sheets URLs into `/preview` or `/embed` iframe URLs (folders -> `embeddable: false`).
    - `onedrive`: converts supported OneDrive / SharePoint embed/share URLs to embeddable iframe URLs (`embeddable: true`), or marks non-embeddable share URLs (`embeddable: false`) to trigger a clean fallback card with `"Open in new tab"`.
    - `youtube` / `vimeo`: privacy-enhanced embed URLs (`youtube-nocookie.com` / `player.vimeo.com/?dnt=1`).
    - `direct-pdf` (`.pdf`), `direct-video` (`.mp4`, `.webm`, `.mov`, `.m4v`), `direct-audio` (`.mp3`, `.wav`, `.m4a`, `.ogg`), `direct-image` (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`).
    - `external`: standard web pages (open in new tab).
    - *(Non-goal: Notion embeds are explicitly excluded.)*
- **Viewer Modal (`src/components/viewer/MaterialViewerModal.tsx`, `src/pages/CoursePage.tsx`, `[current]`):**
  - Header toolbar: `ResourceBadge`, title, metadata, Fullscreen toggle, Open in new tab, Download (for uploaded files), Close (`Esc`).
  - Renderers: native `<iframe src={blobUrl}>` for PDFs; HTML5 `<video controls playsInline>` with playback speed (`0.75x`, `1x`, `1.25x`, `1.5x`, `2x`) and keyboard shortcuts (`Space`, `←/→`, `F`); audio player card; zoomable image viewer (`-`, `100%`, `+`, `Fit`); UTF-8 monospace code/text/Markdown/JSON/CSV reader with line numbers, `Wrap` toggle, and `Copy`; iframe embeds for Google Drive/Docs/Slides/Sheets, OneDrive/SharePoint (with non-embeddable fallback card), YouTube, and Vimeo; download card for unsupported archives/Office binaries (`.pptx`, `.docx`, `.zip`).
  - Strictly revokes any created Blob object URL (`URL.revokeObjectURL`) on close/unmount/switch.

### 3.6 Documentation, Brand Config & Seed Courses
- **Centralized Brand Strings (`src/config/brand.ts`, `[current]` — R5):**
  - Exports `BRAND` (`name`, `shortName`, `mark`, `heroDescription`, `footerNote`, `documentTitle`, `progressBackupFilename`), wired into `Navbar.tsx`, `CatalogPage.tsx`, `CoursePage.tsx`, and `DataFormatsPage.tsx` while keeping storage keys and `.course.json` / `.assessment.json` format strings decoupled so future rebrands never wipe user data or break imports.
- **Data Formats Page (`src/pages/DataFormatsPage.tsx`, `[current]`):**
  - Route `/docs/data-formats`. Exports `LLM_AUTHORING_PROMPT`, `LLM_EXAM_PROMPT`, and `EXAMPLE_ASSESSMENT_EXPORT`.
  - Structured 6-section Table of Contents (`lg:` sticky sidebar TOC + mobile `"On this page"` card), clean Section 6 heading without `<Sparkles />`, Light/Dark `<pre>` contrast, full `.course.json` & `.assessment.json` schemas, KaTeX LaTeX syntax & JSON escaping guide, and `assessmentScores` in Progress Backup JSON.
- **Seed Courses & Examples (`src/data/`, `CONTRIBUTING_COURSES.md`, `[current]`):**
  - `GUIDE101` (`src/data/courses/guide101-quick-start.ts`), `DEMO201` (`src/data/courses/demo201-feature-showcase.ts`), `EXAMPLE_COURSE_EXPORT` (`src/data/exampleCourseExport.ts`), `EXAMPLE_PROGRESS_BACKUP` (`src/data/exampleProgressBackup.ts`).
  - `GUIDE101` documents Light/Dark catalog, Material Viewer, recommended pinning, and interactive exams; `DEMO201` includes `recommended: true` pins, a LaTeX interactive exam, and an interactive assignment with hints; `EXAMPLE_COURSE_EXPORT` & `EXAMPLE_PROGRESS_BACKUP` include an embedded LaTeX exam and `assessmentScores`; `CONTRIBUTING_COURSES.md` documents the full M3 workflow.

---

## 4. Change Protocol

Whenever you **add, edit, rename, or remove** any feature, schema field, resource kind, UI label, config key, storage format, or route, complete **every** step below before finishing:

1. **Search the entire codebase (including docs and tests):** Run ripgrep/text searches across `src/`, `index.html`, `CONTRIBUTING_COURSES.md`, `SPEC.md`, and `AGENTS.md` for every symbol, string literal, CSS class, schema key, and UI label being changed.
2. **Update types, validation & pure logic:**
   - Check `src/types/course.ts`, `src/lib/storage/types.ts`, `src/lib/courseIds.ts`, `src/lib/courseItems.ts`, `src/lib/materialValidation.ts`, `src/lib/fileStore.ts` (`collectReferencedFileIds`), `src/lib/courseExchange.ts`, `src/lib/assessmentExchange.ts` (`[current]`), `src/lib/embedResolver.ts` (`[current]`), `src/lib/mathRender.ts` (`[current]`), `src/lib/theme.ts`, and `src/config/brand.ts` (`[current]`).
3. **Update stores & dependent UI:**
   - Check `useCourseStore.tsx`, `useProgressStore.tsx`, `useThemeStore.tsx`, `CatalogPage`, `CourseCard`, `SearchModal`, `CourseHeader`, `CourseTreeCanvas`, `ChecklistView`, `ChapterDrawer`, `LessonDrawer`, `MaterialList`, `ResourceBadge`, `CourseEditorPage`, `MaterialsEditor`, `ExportCourseDialog`, `ImportCourseDialog`, and modals (`AssessmentBuilderModal`, `AssessmentRunnerModal`, `MaterialViewerModal`).
   - Verify UI labels, keyboard shortcuts, and aria-labels stay consistent across views.
4. **Update config, storage & brand boundaries:**
   - Keep `localStorage` keys (`college_course_trees_catalog_v2`, `college_course_trees_progress_v1`, `college_course_trees_theme`), IndexedDB identifiers (`college_course_trees` / `files`), and format constants (`college-course-tree`, `college-assessment`) decoupled from `BRAND` display strings.
   - Follow the strict clean schema rule (no legacy migration/coercion hacks unless explicitly specified).
5. **Update all documentation, seed courses & examples:**
   - `src/pages/DataFormatsPage.tsx` (tables, examples, `LLM_AUTHORING_PROMPT`, `LLM_EXAM_PROMPT`)
   - `src/data/courses/guide101-quick-start.ts` (`GUIDE101`)
   - `src/data/courses/demo201-feature-showcase.ts` (`DEMO201`)
   - `src/data/exampleCourseExport.ts` & `src/data/exampleProgressBackup.ts`
   - `CONTRIBUTING_COURSES.md`
6. **Update and expand tests:**
   - Update affected assertions and add behavior-focused tests under `src/**/__tests__/` (checking `validateCourse.test.ts`, `examples.test.ts`, `courseExchange.test.ts`, `assessmentExchange.test.ts`, `materialValidation.test.ts`, `fileStore.test.ts`, `useCourseStore.test.tsx`, `useProgressStore.test.tsx`, `CourseEditor.test.tsx`, `CoursePage.test.tsx`, `ShellAndCatalog.test.tsx`, etc.).
   - Run `npm run typecheck`, `npm run test`, and `npm run build`.
7. **Update `SPEC.md` and report every touched reference:**
   - Update `SPEC.md` in the same change (`[current]` vs `[planned]`, schemas, components, Section 9/10) whenever a design or feature decision changes.
   - In your final summary/handoff, explicitly list the search performed and **every file and reference updated**.

---

## 5. Non-Goals

- **No backend server, authentication, or cloud multi-user sync (`[current]`):** All data lives locally in browser `localStorage` and IndexedDB, exchanged via portable `.course.json`, `.assessment.json`, and progress backup JSON files.
- **No Notion embed support (`[current]`):** Per user decision (`ORIGINAL_REQUEST.md` R5), Notion URLs are treated as regular external links (opened in a new tab), not embedded in `MaterialViewerModal`.
- **No legacy backwards-compatibility hacks (`[current]` — R3):** `'reading' -> 'document'` coercion, `"Year N - First/Second Semester"` string migration, `LEGACY_COURSES_STORAGE_KEY`, and `migrateLegacyV1Catalog` are completely absent.
- **No timed/scheduled course duration fields (`[current]`):** Courses do not track lesson minutes/hours (`LLM_AUTHORING_PROMPT` & `CourseEditor.test.tsx` explicitly forbid invented duration fields).
- **No arbitrary HTML injection (`[current]`):** Course notes, descriptions, and LaTeX math never render raw unsanitized HTML (`mathRender.ts` renders prose as React text nodes and math strictly via KaTeX).

---

## 6. Tech Stack & Architecture

### 6.1 Frameworks & Libraries
- **Core (`package.json`, `[current]`):** React `^19.1.0`, React DOM `^19.1.0`, React Router DOM `^7.6.0`, TypeScript `^5.8.3` (`strict: true`, `noUnusedLocals`, `noUnusedParameters`), Vite `^6.3.5`, Tailwind CSS v4 (`@tailwindcss/vite` `^4.1.7`, `tailwindcss` `^4.1.7`), Zod `^3.25.0`, `lucide-react` `^0.511.0`, `@fontsource/balsamiq-sans` `^5.2.5`.
- **Math (`[current]`):** `katex` (`^0.19.1`) + `@types/katex` (`^0.16.8`) for zero-network, offline-safe LaTeX rendering.
- **Testing (`package.json`, `vite.config.ts`, `[current]`):** Vitest `^3.1.4`, `jsdom` `^26.1.0`, `@testing-library/react` `^16.3.0`, `@testing-library/jest-dom` `^6.6.3`, `fake-indexeddb` `^6.2.8`.

### 6.2 Folder Structure
```text
d:\Creative Work\Vibes\vibe_roadmap.sh_college_fork\
├── index.html                        # [current] Title, inline SVG favicon, pre-paint .dark FOUC script
├── package.json                      # [current] Scripts & dependencies
├── tsconfig.json                     # [current] Strict TS + @/* path alias
├── vite.config.ts                    # [current] Vite + Tailwind v4 + Vitest jsdom config
├── CONTRIBUTING_COURSES.md           # [current] Course contributor guide
├── SPEC.md                           # [current] This living specification
├── AGENTS.md                         # [current] Agent session rules & Change Protocol pointer
└── src/
    ├── App.tsx                       # [current] Providers, routes, global search shortcuts, mount GC
    ├── main.tsx                      # [current] BrowserRouter entry
    ├── index.css                     # [current] Tailwind v4 @custom-variant dark, fonts, KaTeX CSS, 4-tier tokens, SVG node states
    ├── config/
    │   └── brand.ts                  # [current] Centralized BRAND display strings
    ├── types/
    │   └── course.ts                 # [current] Core Zod schemas & TS types
    ├── lib/
    │   ├── courseIds.ts              # [current] Slug/ID derivation, validateRawCourseReferences, rekeyCourseContentIdsWithMap
    │   ├── courseItems.ts            # [current] isStandaloneChapter, getTrackableItems, findCourseItem, getAllItemRefs
    │   ├── layoutTree.ts             # [current] Pure SVG tree geometry & label wrapping
    │   ├── materialValidation.ts     # [current] Dangerous file blocklist, kind suggestion, formatBytes
    │   ├── fileStore.ts              # [current] IndexedDB Blob store, collectReferencedFileIds, garbageCollectFiles, openStoredFile
    │   ├── courseExchange.ts         # [current] .course.json export/import + base64 attachments
    │   ├── assessmentExchange.ts     # [current] .assessment.json export/import + image attachments
    │   ├── embedResolver.ts          # [current] GDrive, OneDrive/SharePoint, YouTube, Vimeo, direct media resolver
    │   ├── mathRender.ts             # [current] Safe LaTeX/text tokenizer + KaTeX renderToString
    │   ├── theme.ts                  # [current] ROADMAP_COLORS & RESOURCE_BADGE_STYLES
    │   ├── storage/
    │   │   ├── types.ts              # [current] Repository interfaces & ProgressStateSchema
    │   │   └── localRepositories.ts  # [current] localStorage repository implementations
    │   └── __tests__/                # [current] 10 Vitest unit test suites
    ├── store/
    │   ├── useCourseStore.tsx        # [current] Catalog context & mutations
    │   ├── useProgressStore.tsx      # [current] Progress, bookmarks, stats, assessmentScores
    │   ├── useThemeStore.tsx         # [current] light | dark | system mode & .dark class toggling
    │   └── __tests__/                # [current] 3 store test suites
    ├── data/
    │   ├── validateCourse.ts         # [current] Seed parser & item helpers
    │   ├── exampleCourseExport.ts    # [current] STAT101 example .course.json
    │   ├── exampleProgressBackup.ts  # [current] STAT101 example progress backup JSON
    │   ├── courses/
    │   │   ├── index.ts              # [current] COURSES registry, getCoursesByDepartment, getCourseBySlug
    │   │   ├── guide101-quick-start.ts
    │   │   └── demo201-feature-showcase.ts
    │   └── __tests__/                # [current] 2 data/docs test suites
    ├── components/
    │   ├── Navbar.tsx, CourseCard.tsx, CourseHeader.tsx, ProgressStrip.tsx
    │   ├── CourseTreeCanvas.tsx, ChecklistView.tsx, ChapterDrawer.tsx, LessonDrawer.tsx
    │   ├── DrawerShell.tsx, QuickStatusPill.tsx, StatusSegmentedControl.tsx
    │   ├── MaterialList.tsx, ResourceBadge.tsx, SearchModal.tsx
    │   ├── ConfirmDialog.tsx, ExportCourseDialog.tsx
    │   ├── RichMathText.tsx          # [current]
    │   ├── editor/                   # [current] CourseEditorPage subcomponents + ImportCourseDialog + __tests__/
    │   ├── assessment/               # [current] AssessmentBuilderModal, AssessmentRunnerModal
    │   ├── viewer/                   # [current] MaterialViewerModal
    │   └── __tests__/                # [current] 10 component test suites
    ├── pages/
    │   ├── CatalogPage.tsx, CoursePage.tsx, CourseEditorPage.tsx, DataFormatsPage.tsx
    │   └── __tests__/                # [current] CoursePage.test.tsx
    └── test/
        └── setup.ts                  # [current] jest-dom & fake-indexeddb/auto
```

### 6.3 Key Architectural Decisions & Things Not to Swap Out
- **Repository boundary (`src/lib/storage/types.ts`, `[current]`):** `PremadeRoadmapRepository`, `UserRoadmapRepository`, `ProgressRepository`, and `MaterialFileRepository` decouple persistence from React UI.
- **Deterministic rekeying (`src/lib/courseIds.ts`, `[current]`):** Saves and imports validate raw IDs (`validateRawCourseReferences`), re-derive canonical chapter/lesson IDs (`rekeyCourseContentIdsWithMap`), and call `remapCourseProgress` so edited titles/codes never orphan user progress.
- **Things NOT to swap out or couple to `BRAND`:**
  - `localStorage` keys: `college_course_trees_catalog_v2`, `college_course_trees_progress_v1`, `college_course_trees_theme` (and inline FOUC script in `index.html`).
  - IndexedDB identifiers: `FILE_DB_NAME = 'college_course_trees'`, `FILE_DB_VERSION = 1`, `FILE_STORE_NAME = 'files'`.
  - Export envelope identifiers: `COURSE_EXPORT_FORMAT = 'college-course-tree'` (`version: 1`) and `ASSESSMENT_EXPORT_FORMAT = 'college-assessment'` (`version: 1`).
  - Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *));` in `src/index.css`.

---

## 7. Data Model

### 7.1 `CourseTree`, `Chapter`, `SubLesson` (`src/types/course.ts`)
- **`CourseTree` (`[current]`):**
  - `slug`: string matching `/^[a-z0-9-]+$/` (unique across catalog).
  - `code`: string (min 2 chars, e.g., `DEMO201`).
  - `title`: string (min 2 chars).
  - `department`: string (trim, min 2 chars; `[current]` uses `.catch('Preparatory')`).
  - Term fields (`[current]` — R2 #3 + R3): `year?: number` (`z.number().int().min(1).max(10).optional()`) and `semester?: 1 | 2` (`z.union([z.literal(1), z.literal(2)]).optional()`, no `.catch(undefined)`), plus `formatCourseTerm(course)` returning e.g. `"Year 2 · 1st Semester"`, `"Year 1"`, `"2nd Semester"`, or `null`.
  - `credits?: number` (positive integer).
  - `description`: non-empty string.
  - `chapters`: non-empty `Chapter[]`.
- **`Chapter` (`[current]`):**
  - `id` (unique across chapters & lessons in course, prefixed with `${deriveCoursePrefix(course.code)}-`), `order` (positive integer), `title`, `weekRange?`, `description`, `notes?`, `prerequisites?` (same-course item IDs, no self-reference), `resources?: LessonResource[]`, `lessons: SubLesson[]` (`[]` = standalone chapter counted as 1 trackable item).
- **`SubLesson` (`[current]`):**
  - `id` (shared uniqueness namespace & prefix rule), `title`, `summary`, `notes?`, `side?: 'left' | 'right'`, `prerequisites?`, `resources: LessonResource[]`.

### 7.2 `LessonResource`, `StoredFileRef` & `AssessmentData` (`src/types/course.ts`)
- **`ResourceKind` (`[current]`):** `'slides' | 'video' | 'lab' | 'document' | 'textbook' | 'course' | 'official' | 'exam' | 'assignment'` (`'document'` replaced `'reading'` strictly).
- **`StoredFileRef` (`[current]`):** `{ id: string, name: string, mimeType: string, sizeBytes: number }`.
- **`LessonResource` (`[current]`):** `{ title, kind, recommended?: boolean, url?, file?, assessment? }` with **strict 3-way XOR** (`url` XOR `file` XOR `assessment`).
- **`AssessmentData` (`[current]` — R4):**
  - `AssessmentQuestionHeader`: `{ text?: string, imageUrl?: string, imageFile?: StoredFileRef }` (at least one of `text`, `imageUrl`, or `imageFile` required; `imageUrl` validates `http://` or `https://`).
  - `AssessmentQuestion`: `{ id: string, type: 'mcq' | 'multi-select' | 'true-false' | 'short-answer', header: AssessmentQuestionHeader, options?: string[], correctIndices?: number[], acceptedAnswers?: string[], caseSensitive?: boolean, points?: number, hint?: string, explanation?: string }`.
  - `AssessmentData`: `{ mode: 'exam' | 'assignment', instructions?: string, timeLimitMinutes?: number, passingScorePercent?: number, shuffleQuestions?: boolean, questions: AssessmentQuestion[] }` (`timeLimitMinutes` is `z.number().int().positive().optional()`, `passingScorePercent` is `z.number().min(0).max(100).optional()`).

### 7.3 `ProgressState` & File Garbage Collection (`src/lib/storage/types.ts`, `src/lib/fileStore.ts`)
- **`LessonStatus` (`[current]`):** `'todo' | 'learning' | 'done' | 'skipped'` (`'todo'` omitted from stored `statuses` map).
- **`ProgressState` (`[current]`):** `{ version: 1, statuses: Record<string, Record<string, LessonStatus>>, bookmarks: string[], assessmentScores?: Record<string, Record<string, AssessmentScoreRecord>> }` where `AssessmentScoreRecord` = `{ bestScorePercent: number, latestScorePercent: number, attempts: number, passed: boolean, updatedAt: string }`, keyed deterministically via `getAssessmentScoreKey(itemId, resourceTitle)`.
- **File references (`collectReferencedFileIds`, `[current]`):** scans `chapter.resources[].file?.id`, `lesson.resources[].file?.id`, and `resource.assessment?.questions[].header.imageFile?.id` for export bundling, import re-IDing, and orphan GC.

---

## 8. Conventions

- **Naming (`[current]`):**
  - Components & Pages: `PascalCase.tsx` (`CourseHeader.tsx`, `CourseEditorPage.tsx`).
  - Libs, data, config: `camelCase.ts` (`courseExchange.ts`, `embedResolver.ts`, `brand.ts`).
  - Hooks / stores: `use<Domain>Store.tsx` (`useCourseStore.tsx`).
  - Course slugs: lowercase kebab-case (`/^[a-z0-9-]+$/`); item IDs: `${prefix}-ch${order}-${slug}` (chapters) and `${prefix}-${slug}` (lessons); file IDs: `${prefix}-file-${8 hex}`.
- **File organization & imports (`[current]`):**
  - Use the `@/*` TypeScript/Vite alias (`./src/*`).
  - Co-locate tests in `__tests__/*.test.{ts,tsx}` beside the modules they test.
  - Keep `.agents/teamwork/` completely outside the repository (use external Teamwork scratch directories only).
- **Code style (`[current]`):**
  - Strict TypeScript (`noUnusedLocals`, `noUnusedParameters`).
  - Validate untrusted JSON boundaries (imports, storage loads) with Zod (`safeParse`).
  - Prefer pure logic functions in `src/lib/` (layout, validation, URL resolving, math tokenizing, exchange) separate from React UI.
- **Testing (`[current]`):**
  - Vitest + `jsdom` + `@testing-library/react` + `fake-indexeddb/auto` (`src/test/setup.ts`).
  - Clear `localStorage` and delete all IndexedDB files (`listFileIds` / `deleteFile`) in `beforeEach`; spy/mock `window.open`, `URL.createObjectURL` / `URL.revokeObjectURL`, `matchMedia`, and `navigator.clipboard` cleanly.
  - Test behavior and edge cases (validation failures, XSS safety, URL revocation, keyboard shortcuts, progress remapping/deletion).
- **Git habits (`[current]`):**
  - Work on `main` with focused commits using conventional prefixes (`feat:`, `fix:`, `docs:`, `chore:`).
  - Never leave a local `vite` dev server running after manual/browser QA.

---

## 9. Current Status

### Implemented (`[current]` — Baseline through Milestone 3 / M7)
- `[current]` Core React 19 + Vite 6 + Tailwind v4 + Zod SPA with routes `/`, `/editor/new`, `/course/:slug`, `/course/:slug/edit`, `/docs/data-formats`, `*`.
- `[current]` `ThemeProvider` (`.dark` class toggling + FOUC script), `CourseProvider`, `ProgressProvider` (with skip math, `assessmentScores`, & progress JSON backup), IndexedDB `fileStore` (including `assessment.questions[].header.imageFile` GC/exchange & aligned inline MIME/extension handling) + `materialValidation`.
- `[current]` Foundation & strict schema (M2/Wave 0 + R3): `katex` + `@types/katex`; `src/config/brand.ts` (`BRAND`); `src/index.css` 4-tier neutral tokens & `.dark` KaTeX contrast; `RESOURCE_BADGE_STYLES` collision-free palette (`'document'`, red `'course'`, teal `'textbook'`); strict `year`/`semester` (`1 | 2`), `formatCourseTerm`, `recommended`, 3-way XOR `assessment`, removal of `LEGACY_COURSES_STORAGE_KEY`/`migrateLegacyV1Catalog`/`SEMESTER_OPTIONS`/`getCoursesByYear`; `embedResolver.ts`, `mathRender.ts`, `RichMathText.tsx`.
- `[current]` UI/UX & Viewing (M3/Wave 1A+1B): Persistent dark `Navbar`; full Light & Dark `CatalogPage`, `CourseCard`, `SearchModal`, and dialogs; neutral `ProgressStrip`; `CourseHeader` hover-reveal actions + mobile left-expanding tray; `CourseTreeCanvas` (`layoutCourseTree`) smooth zoom, filter dimming, skipped `0/0` slate pill, and hidden standalone `todo` badge; `ChecklistView` standalone header toggle & amber-accented chapter headers; `ChapterDrawer` hidden empty multi-lesson materials + `Overview` tab; `MaterialList` `recommended` pinning + `Best: XX%` badges.
- `[current]` Course Editor Overhaul (M4/Wave 1C): Light/Dark 4-tier editor palette; `Year` numeric input + `1st`/`2nd` `Semester` radios + `Clear`; sticky `+ Add Chapter` in `EditorStickyBar`; identical `LessonEditorCard` collapsed/expanded header styling; `MaterialsEditor` `Pin as recommended` toggle and `Interactive` mode (`Build / Edit`, `Import JSON`, `Export JSON`).
- `[current]` Interactive Exams & Native Viewer (M5/Wave 1D+1E): `assessmentExchange.ts` (`.assessment.json`), `AssessmentBuilderModal.tsx`, `AssessmentRunnerModal.tsx`, `MaterialViewerModal.tsx` (uploaded PDF/video/audio/image/code + Google Drive/Docs/Slides/Sheets + OneDrive/SharePoint w/ fallback + YouTube/Vimeo + `URL.revokeObjectURL` cleanup).
- `[current]` Integration, Docs & Verification (M6–M7/Wave 2): Wired modals & `BRAND` across `CoursePage.tsx` / shell; `DataFormatsPage.tsx` sticky/mobile TOC, clean Section 6 heading, Light/Dark `<pre>` blocks, `EXAMPLE_ASSESSMENT_EXPORT`, `LLM_EXAM_PROMPT`, and KaTeX/score docs; updated `GUIDE101`, `DEMO201`, `EXAMPLE_COURSE_EXPORT`, `EXAMPLE_PROGRESS_BACKUP`, and `CONTRIBUTING_COURSES.md`; `npm run typecheck`, `npm run test` (`27` test files / `164` tests), and `npm run build` all passing.

### Planned (`[planned]`)
- No unbuilt Milestone 3 items remain. Any future work (such as addressing optional open items in Section 10) will be scoped separately.

---

## 10. Known Inconsistencies & Open Questions

All items below were empirically verified in the `[current]` codebase during the Milestone 3 / M7 audit:

1. **Modal & drawer backdrop opacity variations (`[current]`):** Standard dialogs (`ConfirmDialog.tsx:34`, `ExportCourseDialog.tsx:96`, `ImportCourseDialog.tsx:76`, `SearchModal.tsx:122`, and `CoursePage.tsx:339` backup modal) use `bg-black/50 dark:bg-black/70`, whereas `AssessmentBuilderModal.tsx:636` uses `bg-black/50 dark:bg-black/75`, `AssessmentRunnerModal.tsx:418` and `MaterialViewerModal.tsx:863` use `bg-black/60 dark:bg-black/75`, and `DrawerShell.tsx:37` uses `bg-black/40 dark:bg-black/60`.
2. **Container max-width variations across views (`[current]`):** `Navbar`, `CatalogPage`, `CourseHeader`, `ProgressStrip`, `CourseEditorPage`, and `EditorStickyBar` use `max-w-5xl`; `CoursePage.tsx:218` and `DataFormatsPage.tsx:336` use `max-w-6xl` (for wide SVG trees and desktop sidebar TOC + content); and `ChecklistView.tsx:44` uses `max-w-4xl`.
3. **AppShell wrapper background override (`[current]`):** `src/App.tsx:55` wraps routes in `<div className="min-h-screen bg-gray-50 dark:bg-slate-950">`, which is visually overridden by each page's `<main className="... bg-slate-50 ... dark:bg-[#0b0f17]">`.
4. **Duplicated SVG status hex literals vs. `ROADMAP_COLORS` (`[current]`):** `src/lib/theme.ts:1-15` exports `ROADMAP_COLORS` (`chapterHover`, `lessonHover`, `statusDoneFill`, `statusLearningFill`, `statusSkippedFill`, `statusSkippedText`, `canvasBg`, `darkNavBg`), while `src/index.css:54-91` and `CoursePage.tsx:161-166` (`handleDownloadSvg`) still duplicate raw hex strings (`#cbcbcb`, `#dad1fd`, `#64748b`, `#ffffff`).
5. **Inconsistent drawer tab names & editor count abbreviation (`[current]`):** `ChapterDrawer.tsx:136,149` labels tabs `"Materials"` (standalone) / `"Overview"` (multi-lesson) and `"Notes"`, whereas `LessonDrawer.tsx:112,125` labels them `"Resources"` and `"Study Notes"`. `LessonEditorCard.tsx:66` displays `"{lesson.resources.length} res"` while `ChecklistView.tsx:29-31` uses `formatMaterialCount` (`"1 material"` / `"2 materials"`).
6. **Standalone badge retention outside `ChecklistView` (`[current]`):** `ChecklistView` removed the `"Standalone"` pill per R2 #7, while `ChapterDrawer.tsx:242-246` and `ChapterEditorCard.tsx:70-72` retain `"Standalone"` indicator badges.
7. **Modal focus trapping, `h-screen` fullscreen & SVG keyboard parity (`[current]`):** Modals and `DrawerShell` lack `Tab` focus traps and focus restoration on close; `MaterialViewerModal.tsx:875` fullscreen uses `h-screen w-screen` (while `DrawerShell.tsx:46` uses `h-dvh`); and `CourseTreeCanvas` `onKeyDown` (`lines 282, 393`) does not mirror `Shift+Click` (`Shift+Enter`/`Shift+Space`) or keyboard context menu (`ContextMenu` / `Shift+F10`).
8. **Dead / test-only helpers (`[current]`):** `getAllLessons`, `getAllLessonIds`, `findLessonWithChapter` (`src/data/validateCourse.ts:21-42`) and `getCourse` / `resetCatalog` aliases on `CourseContextValue` (`src/store/useCourseStore.tsx:106,111`) remain unused in runtime UI.
9. **Duplicate export envelope interfaces (`[current]`):** `CourseExportEnvelope` / `CourseAttachment` (`src/lib/courseExchange.ts:29-43`) are duplicated as `CourseExportEnvelope` / `CourseExportAttachment` in `src/data/exampleCourseExport.ts:3-17`.
10. **Viewer vs. `openStoredFile` text extension set (`[current]`):** `MaterialViewerModal.tsx:75-105` (`TEXT_EXTENSIONS`) previews additional text/config extensions (`.markdown`, `.jsonl`, `.mjs`, `.cjs`, `.cc`, `.yaml`, `.yml`, `.toml`, `.xml`, `.css`), whereas `openStoredFile` (`src/lib/fileStore.ts:45-65`) only opens the core `TEXT_CODE_EXTENSIONS` list inline in new tabs.
11. **`AssessmentSchema` vs. `DataFormatsPage.tsx` numeric bounds (`[current]`):** `src/types/course.ts:175-176` validates `timeLimitMinutes` as `.int().positive()` (no `300` cap) and `passingScorePercent` as `.min(0).max(100)` (allowing non-integers), whereas `DataFormatsPage.tsx:950,956` and `LLM_EXAM_PROMPT` (`lines 139, 175-176`) document `int 1..300` and `int 0..100`. Also `MaterialList.tsx:177` and `MaterialsEditor.tsx:756` use truthy `{assessment.timeLimitMinutes && ...}` checks (safe because `AssessmentSchema` enforces `.positive()`).
12. **Question header `imageUrl` protocol vs. UI copy (`[current]`):** `AssessmentQuestionHeaderSchema` (`src/types/course.ts:56`) and `isSafeHttpUrl` accept both `http://` and `https://`, while UI labels in `AssessmentBuilderModal.tsx:1140` and `DataFormatsPage.tsx:1054` say `https://`.
13. **Silent `.catch('Preparatory')` coercion on `department` (`[current]`):** `CourseTreeSchema` (`src/types/course.ts:247`) retains `.catch('Preparatory')` on `department` per `DataFormatsPage` / `courseExchange` specs.
14. **Repository `StorageLike` adapter asymmetry (`[current]`):** `createLocalProgressRepository` (`src/lib/storage/localRepositories.ts:88-127`) checks `typeof window !== 'undefined'` directly instead of using `resolveStorage`, and `useCourseStore.tsx:37-41,86-90` builds dummy no-op `getItem`/`removeItem` stubs to call `userRepo.saveCourses`.
15. **One-shot IndexedDB GC (`[current]`):** `src/App.tsx:21-30` runs `garbageCollectFiles` only once on initial mount (`gcRanRef`), so deleting/replacing files or courses in-session leaves orphaned blobs until a reload on a non-editor route.
16. **`SearchModal` scope & missing `README.md` (`[current]`):** `SearchModal.tsx:50-55` does not search `course.description` or material titles (unlike `DataFormatsPage.tsx:566`, which notes `description` is shown in search), and the repository root currently has no `README.md`.
