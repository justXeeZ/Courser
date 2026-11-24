# Design System & UI Rules

## 1. Palette Intent & Theme Sources
- **Sources of truth (inspect code; do not duplicate literals in docs):**
  - Surface/border/text CSS variables, `.dark` overrides, `.roadmap-svg` node state classes, and `.dark .katex` rules: `src/index.css`
  - Pre-paint `.dark` FOUC guard and body base classes: `index.html`
  - Theme mode store (`'light' | 'dark' | 'system'`): `src/store/useThemeStore.tsx`
  - SVG palette (`ROADMAP_COLORS`) and material kind badge classes (`RESOURCE_BADGE_STYLES`): `src/lib/theme.ts`
  - SVG tree geometry and label-wrapping constants: `src/lib/layoutTree.ts`
- **4-tier neutral surface hierarchy (Light & Dark):**
  - **Canvas:** Page background (`<main>` and `<body>`).
  - **Surface-1:** Primary cards, `CourseHeader`, `ProgressStrip`, drawers (`DrawerShell`), and modal dialogs. `ProgressStrip` must use a neutral Surface-1 background in dark mode—never a warm/reddish warning tint.
  - **Surface-2:** Elevated/nested headers and rows (`ChecklistView` chapter headers, `EditorStickyBar`, `ChapterEditorCard` headers, and `LessonEditorCard` headers).
  - **Inset controls:** Form inputs (`input`, `select`, `textarea`), filter pill containers, file dropzones, and code blocks use distinct inset backgrounds and high-contrast borders so inputs never blend into Surface-1 cards in dark mode.
- **Persistent sticky dark `Navbar` exception:** `src/components/Navbar.tsx` stays sticky at the top (`sticky top-0 z-40`) and dark in **both** Light and Dark modes with a Violet-Purple (`from-violet-600 to-purple-600`) `+ New Course` CTA and `text-violet-400` Bookmark icon; `CatalogPage`, `CourseCard`, `SearchModal`, and all other views adapt to the active theme.
- **Semantic CSS variable palette (`src/index.css`):**
  - **Light mode:** Warm neutrals (`--surface-canvas: #f7f5f0`, `--surface-1: #fdfcfa`, `--surface-2: #efede8`, `--border-subtle: #e5e1d8`, `--border-strong: #767067`, `--text-muted: #5c564e`).
  - **Dark mode:** Oxford Blue surfaces (`#0b0f17` / `#121926` / `#1b2436` / `#0d131f`) paired with cool slate-gray muted tokens (`--surface-warm-muted: #1e293b`, `--border-strong: #64748b`, `--text-muted: #94a3b8`, `--status-skipped-bg: #1e293b`).
  - **Semantic accents:** Vibrant Violet-Purple primary CTAs, bookmarks, `CourseCard` progress bars (`1%–99%`), & Recommended containers (`--cta-bg`, `--accent-purple`, `--recommended-*`), **Amber** chapter tags, `ChapterDrawer` icons/notes/`1%–99%` progress bar (`--tag-amber-*`, `--accent-amber`), **Burnt Peach** lesson tags & `LessonDrawer` icons/notes (`--tag-peach-*`, `--accent-peach` anchored on `#E97451` / `#ad3c1a`), Green `Done` / `Passed` / `100%` (`--status-done-*`), Orange `Warning` / `Flag` / `1%–99%` ProgressStrip badge (`--status-warning-*`), and Red `Danger` / `Not Passed` (`--status-danger-*`).
- **Editor card stability:**
  - `ChapterEditorCard` uses a left amber accent border on a neutral Surface-2 bar; `ChecklistView` chapter headers use a left amber accent border on Surface-1 in Light mode (matching child sub-lesson rows) and Surface-2 in Dark mode.
  - `LessonEditorCard` header uses a left burnt-peach accent border (`--tag-peach-border`), keeps identical background and border classes whether collapsed or expanded, and displays a standardized position tag (`Ch X - L Y`).
- **Unified component recipes:**
  - **Recommended container:** `1.5px dashed var(--recommended-border)` with `--recommended-bg` and purple star header.
  - **Delete buttons:** `--status-danger-border` + `--status-danger-text` on `--surface-1`, transitioning to solid `--danger-solid-bg` + white text on hover/focus-visible.
  - **Modals & drawers:** `--backdrop-modal` / `--backdrop-drawer`, `h-dvh` for fullscreen/drawer heights, and shared `useDialogFocus` (`Tab` trap, focus restore, topmost `Escape`).
- **Resource kind badges (`RESOURCE_BADGE_STYLES` in `src/lib/theme.ts`):**
  - Keep all 10 `ResourceKind` badges visually distinct in both Light and Dark modes (`document` sky, `course` red, `textbook` teal, `official` blue, `slides` amber, `video` purple, `audio` rose, `lab` emerald, `exam` inverted high-contrast slate, `assignment` indigo).
- **SVG tree node states (`src/index.css`, `src/lib/theme.ts`, `src/components/CourseTreeCanvas.tsx`):**
  - Spine chapter nodes use Amber fills (`--svg-chapter-fill`), branch sub-lesson nodes use Burnt Peach fills (`--svg-lesson-fill`), both keeping crisp black (`#000000`) borders and text, while connectors and junction dots use Violet-Purple (`--svg-edge-color`).
  - Status classes override node styling: `done` (muted gray fill + strikethrough), `learning` (soft violet fill + underline), `skipped` (slate gray fill + white strikethrough), and active/prerequisite highlight (Violet-Purple stroke).

## 2. Typography, Math & Icons
- **Body copy:** System sans-serif stack (`src/index.css`).
- **Roadmap tree & checklist chapter titles:** `.font-roadmap` (`Balsamiq Sans` bundled locally via `@fontsource/balsamiq-sans`; no external Google Fonts).
- **Monospace (`font-mono`):** Course codes, slugs, derived IDs, position tags (`Ch 1`, `Ch 1 - L 2`), percentages, file sizes, `<kbd>` shortcuts, and JSON blocks.
- **Math:** Render inline (`$...$`, `\(...\)`) and display (`$$...$$`, `\[...\]`) LaTeX via `src/components/RichMathText.tsx` and `src/lib/mathRender.ts` (KaTeX CSS imported in `src/index.css`).
- **Icons:** Use `lucide-react` exclusively.

## 3. Reusable Components

Reuse these components instead of creating one-off patterns:

| Component | Path | When to Use |
|---|---|---|
| `Navbar` | `src/components/Navbar.tsx` | Global sticky dark top bar (`BRAND.mark`, `BRAND.shortName`, bookmarks count, search trigger, theme cycler, `+ New Course`). |
| `CourseCard` | `src/components/CourseCard.tsx` | Catalog card with course code, `formatCourseTerm`, title, item counts, progress bar, and edit/delete/bookmark buttons. |
| `CourseHeader` | `src/components/CourseHeader.tsx` | Course page header with metadata, `Course Tree` / `Syllabus Checklist` tabs, and responsive action controls. |
| `ProgressStrip` | `src/components/ProgressStrip.tsx` | Course completion summary (`% DONE`, required/learning/skipped counts, status filter pills, interaction hint). |
| `CourseTreeCanvas` | `src/components/CourseTreeCanvas.tsx` | Interactive SVG prerequisite tree with zoom controls, click-and-drag panning, mobile responsive scaling, filter dimming, hover highlight, and status triggers. |
| `ChecklistView` | `src/components/ChecklistView.tsx` | Linear collapsible syllabus checklist grouped by chapter (chapters expanded by default). |
| `DrawerShell` | `src/components/DrawerShell.tsx` | `sm:max-w-[600px]` right slide-over panel with backdrop, header slots, body, footer, and `Escape` close (used by `ChapterDrawer` and `LessonDrawer`). |
| `StatusSegmentedControl` | `src/components/StatusSegmentedControl.tsx` | Segmented toggle for `learning` / `done` / `skipped` (plus optional `showReset`). Use `itemRole="menuitem"` in popovers and `"button"` in drawers. |
| `QuickStatusPill` | `src/components/QuickStatusPill.tsx` | Floating status popover anchored to right-clicked SVG tree nodes. |
| `ResourceBadge` | `src/components/ResourceBadge.tsx` | Category pill for `LessonResource.kind` using `RESOURCE_BADGE_STYLES`. |
| `MaterialList` | `src/components/MaterialList.tsx` | Renders chapter/lesson resources; pins `recommended: true` to top, shows `Best: XX%` score badges, and launches `MaterialViewerModal` or `AssessmentRunnerModal`. |
| `RichMathText` | `src/components/RichMathText.tsx` | Safe mixed prose + KaTeX math renderer for exam instructions, question headers, choices, hints, and explanations. |
| `ConfirmDialog` | `src/components/ConfirmDialog.tsx` | Destructive confirmation modal (e.g., course deletion or unsaved-edits prompt). |
| `ExportCourseDialog` | `src/components/ExportCourseDialog.tsx` | `.course.json` export modal with base64 attachment toggle and size summary. |
| `ProgressBackupDialog` | `src/components/ProgressBackupDialog.tsx` | Progress JSON download & restore modal (`.json` file upload or paste) supporting per-course (`CoursePage`) and all-courses (`CatalogPage` footer) scopes. |
| `ImportCourseDialog` | `src/components/editor/ImportCourseDialog.tsx` | `.course.json` file/paste import modal on `/editor/new`. |
| `EditorStickyBar` | `src/components/editor/EditorStickyBar.tsx` | Sticky top bar in `CourseEditorPage` with breadcrumb (`Ch X › Ch X - L Y`) and sticky `+ Add Chapter`, `Collapse all`, and `Save` actions. |
| `ChapterEditorCard` / `LessonEditorCard` | `src/components/editor/` | Sticky-header chapter (`Ch X`) and sub-lesson (`Ch X - L Y`) form cards inside `CourseEditorPage`. |
| `PrerequisitePicker` / `MaterialsEditor` | `src/components/editor/` | Same-course prerequisite chip selector and material editor (`Link` / `Upload`, plus `Interactive` when kind is `exam` or `assignment`) with `Pin as recommended`. |
| `AssessmentBuilderModal` | `src/components/assessment/AssessmentBuilderModal.tsx` | Visual builder for interactive exams/assignments with live KaTeX preview, image header upload/URL, and JSON import/export. |
| `AssessmentRunnerModal` | `src/components/assessment/AssessmentRunnerModal.tsx` | Interactive exam/assignment player with Pre-Start Overview, 2-column Active view (color-coded question navigator, `A/B/C` keycaps, icon-only Flag, hidden-by-default Hint under header), Pre-Submit Review, and Results filter pills. |
| `MaterialViewerModal` | `src/components/viewer/MaterialViewerModal.tsx` | Native in-app viewer for uploaded files (PDF, video, centered audio, zoomable images, line-numbered code/text) and cloud/video embeds. |
| `SearchModal` | `src/components/SearchModal.tsx` | Global `Ctrl/Cmd+K` and `/` command palette searching courses, departments, chapters, and lessons. |

## 4. Layout & View Behavior Rules
- **Page shell (`src/App.tsx`):** Persistent sticky top `Navbar` (`h-16`) above `<main className="min-h-[calc(100vh-64px)] ...">`.
- **Container widths:** `max-w-5xl` for standard pages (`Navbar`, `CatalogPage`, `CourseHeader`, `ProgressStrip`, `CourseEditorPage`, `EditorStickyBar`); `max-w-6xl` for wide canvas/sidebar layouts (`CoursePage`, `DataFormatsPage`); `max-w-4xl` for `ChecklistView`.
- **Responsive `CourseHeader` actions:** Keep `Bookmark` separate. On `sm:`+, `Edit Course`, `Export Course`, `Backup Progress`, `Download SVG`, and `Delete Course` are icon buttons that smoothly expand labels on hover/focus (`duration-300 ease-out`). On `< sm`, collapse those 5 buttons behind a toggle (`ChevronLeft`) that reveals them horizontally **to the left** of the toggle without page overflow.
- **Sticky editor stack (below `h-16` sticky `Navbar`):** `EditorStickyBar` (`sticky top-16 z-30`) → `ChapterEditorCard` header (`sticky top-[120px] z-20`) → expanded `LessonEditorCard` header (`sticky top-[168px] z-10`).
- **Tree canvas (`CourseTreeCanvas.tsx`):** Support smooth zoom transitions (`width` + `max-width`) with an expanded zoom range up to `250%` and mobile-friendly base scaling, plus click-and-drag pointer panning across the tree container; dim (`opacity: 0.3`) non-matching leaf chapters and multi-lesson chapters with zero matching sub-lessons when `statusFilter !== 'all'`; hide leaf chapter top-right status badges when `'todo'`; style all-skipped `0/0` chapter pills in slate gray.
- **Checklist leaf chapters (`ChecklistView.tsx`):** Put the interactive status toggle directly on the chapter header with no child row; dim non-matching leaf chapters under active filters.
- **Chapter & lesson drawers (`ChapterDrawer.tsx`, `LessonDrawer.tsx`):**
  - Hide `Chapter Materials` on multi-lesson chapters (`!isLeafChapter`) when `chapter.resources` is empty (first tab labeled `Overview`); keep empty material states on leaf chapters and sub-lessons.
  - Hide the `Notes` / `Study Notes` tab whenever `notes` is empty/absent on that chapter or sub-lesson.
  - In `ChapterDrawer`'s sub-lessons list, clicking the status checkmark icon toggles the sub-lesson's `done` status directly without navigating, while clicking the sub-lesson title/row opens that sub-lesson.
  - Never display redundant schedule tags that duplicate the chapter number (e.g., suppress `Part 6` / `Ch 6` when it repeats `Ch 6`).
- **Documentation TOC (`DataFormatsPage.tsx`):** Use a structured Table of Contents (`lg:` sticky left sidebar + mobile `"On this page"` card), never tag-like pills.

## 5. Copy Tone & Accessibility Conventions
- **Tone of voice:** Concise, student-focused, action-first labels (`"All Courses"`, `"Course Tree"`, `"Syllabus Checklist"`, `"Edit Course"`, `"Export Course"`, `"Backup Progress"`, `"Download SVG"`, `"Delete Course"`, `"Data formats"`). Validation errors must name the exact chapter, sub-lesson, or material and explain how to fix it in plain language.
- **Semantics:** Use `<header>`, `<nav>`, `<main>`, `<footer>`, `role="tablist"` / `role="tab"` / `aria-selected`, `role="dialog" aria-modal="true"` with `aria-label` or `aria-labelledby`, `role="alert"` for errors, and `aria-label` on all icon-only buttons.
- **Keyboard shortcuts:**
  - Global (`src/App.tsx`): `Ctrl/Cmd+K` toggles `SearchModal`; `/` opens `SearchModal` when focus is outside inputs, textareas, selects, or `contentEditable`.
  - Modals & drawers: `Escape` closes only the topmost active layer (`CoursePage` suppresses drawer shortcuts while sub-modals are open).
  - `LessonDrawer` and leaf `ChapterDrawer`: `L` (Learning), `D` (Done), `S` (Skip), `ArrowLeft` / `ArrowRight` (previous/next item) when not typing in a field.
  - `CourseTreeCanvas`: SVG nodes use `<g role="button" tabIndex={0}>` (`Enter` / `Space` to open); `Shift+Click` toggles `done`; right-click opens `QuickStatusPill`.
  - `MaterialViewerModal` video player: `Space` play/pause, `ArrowLeft` / `ArrowRight` seek 5s, `F` fullscreen, `Escape` close.

## 6. Checklist: When Building a New Page
1. Wrap in `<main className="min-h-[calc(100vh-64px)] ...">` using the 4-tier Light/Dark palette—never hardcode a single theme.
2. Keep `Navbar` sticky and dark in both modes.
3. Use `mx-auto max-w-5xl px-4 sm:px-6` (`max-w-6xl` for wide canvas/sidebar layouts) and verify zero horizontal overflow at desktop (`1440x900`) and mobile (`390x844`).
4. Read brand copy from `BRAND` (`src/config/brand.ts`) instead of hardcoding product names or default filenames.
5. Register the route in `src/App.tsx` and ensure startup `garbageCollectFiles` skips routes holding unsaved editor uploads.
6. Provide semantic landmarks, heading hierarchy (`h1` → `h2`), `aria-label` attributes, and keyboard/`Escape` handling.
7. Add co-located Vitest + Testing Library tests under `__tests__/`.
