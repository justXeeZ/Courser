# Changelog

All notable user-visible changes to **College Course Trees** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions prior to a formal release are grouped chronologically from the project's git history.

## [Unreleased]

### Added
- Course edit mode: added Move material up and Move material down arrow buttons on material rows to reorder materials with persisted order.
- Chapter and lesson overviews: added the Link2 icon before materials headings and a Layers icon before the Sub-Lessons heading in Chapter Overview.
- Material rows: external links now display a truncated URL with full-URL tooltip on the right alongside the external-link icon; uploaded files display File badge, filename, and size inline on the right with an Eye icon at the far right end.
- In-app Material Viewer: clicking any external URL resource now opens inside the native viewer (native preview for supported types, or a sandboxed embedded webpage with an inline warning beside the header URL).
- Tree view: added two-finger pinch-to-zoom support on touchscreens alongside the zoom buttons.

### Changed
- Chapter and lesson overviews: renamed headings to **CHAPTER MATERIALS & RESOURCES** and **LESSON MATERIALS & RESOURCES**, unified materials into a single bordered divider-row card with recommended materials grouped inside under a purple star **RECOMMENDED** subtitle with a shared dashed purple outline and mild purple tint, matched the uploaded-file Eye icon's default and hover colors to the external-link icon, and updated active overview/notes tabs to use the shared `--solid-bg`/`--solid-text` tokens in both Light and Dark modes.
- Course edit mode: removed divider lines between sub-lesson cards, grouped added materials inside a single bordered container (with pinned resources grouped inside the shared dashed purple "Recommended" container with a purple star icon), matched material delete buttons to chapter and sub-lesson delete buttons, and styled Semester radio buttons in amber in both Light and Dark modes.
- Course page: aligned the Tree View and Syllabus Checklist container max widths (`max-w-5xl`) to match the Progress Strip, and centered Progress Strip stats and filters on mobile screens.
- Data formats page: updated `weekRange` examples to `"Week 1"` / `"Week 1-3"`, `SubLesson.notes` reference to the Study Notes tab, and `timeLimitMinutes` schema constraint to positive integers (`int > 0`).
- Tree view: restored the centered floating Done / Learning / Skip status toolbar (keeping hover + right-click triggers and conditional Reset to Todo button) and kept it open after selecting a status until pointer-leave (hover) or click/focus-out (right-click).

### Fixed
- Course edit mode: validation errors (both inline field errors and the sticky error banner) now clear automatically as soon as the offending field becomes valid.
- Tree view: centered the tree spine by default on smaller/mobile screens, centered the floating Done / Learning / Skip toolbar accurately over its node, kept it synchronized with the node while scrolling, and prevented hovering other nodes from dismissing or replacing a right-click-opened toolbar.

## [0.8.0]

### Added
- Course edit mode: clicking any chapter or sub-lesson in the Live Tree Preview tab switches back to the editor, expands the target entry (and its parent chapter if collapsed), scrolls it into view, and focuses its title field.
- Tree view: hovering over a sub-lesson node now shows the Done / Learning / Skip status toolbar above it with a hover bridge and grace delay, alongside the existing right-click trigger.
- Shared Light/Dark CSS theme tokens for purple recommended containers, high-contrast solid fills, and WCAG AA amber/light-blue tags.

### Changed
- Chapter and lesson overviews: recommended resources are now grouped inside a purple-accented container labeled "Recommended" instead of displaying individual amber "Recommended" tags.
- Course edit mode: the "Prerequisites (click to toggle)" section now starts collapsed by default and displays a selected-count badge when prerequisites are linked.
- Course edit mode: the sticky toolbar breadcrumb now renders the amber `Ch[number]` tag beside the chapter title instead of plain `Ch [number]:` text.
- Course edit mode: clicking anywhere on a chapter or sub-lesson header row (including side padding) now toggles expand/collapse, while interactive buttons inside the header retain their own actions.
- Course edit mode: empty chapter notice text changed from "No sub-lessons — students can check off this chapter directly." to "No sub-lessons are added yet".
- Dark mode: solid-filled tags and primary buttons now use high-contrast light fills with dark text so they stand out clearly against dark surfaces (WCAG AA+).
- Light mode: amber chapter tags and light-blue sub-lesson tags now use darker text, stronger fills, and visible borders for WCAG AA+ contrast while leaving dark mode styling unchanged.

### Removed
- Chapter and lesson overviews: removed individual per-item amber "Recommended" badges (replaced by the purple-accented Recommended container).

## [0.7.0]

### Changed
- Course edit mode: prerequisite options now display only an amber `Ch[number]` tag (chapters) or light-blue `Ch[number] / L[number]` tag (sub-lessons) beside each title, with amber fill for selected chapters and light-blue fill for selected sub-lessons, while keeping `Ch[number]: [Chapter title]` group headings.
- Light mode: chapter `Ch[number]` tags and sub-lesson `Ch[number] / L[number]` tags now use consistent amber and light-blue fills across Chapter Overview, Lesson Overview, and Course Edit Mode instead of dark slate pills.

### Fixed
- Course edit mode: sticky chapter and sub-lesson headers now offset dynamically below the sticky error banner when validation errors are visible, preventing overlap.
- Course edit mode: chapter and sub-lesson sticky headers now drop their top rounded corners while stuck and restore them when unstuck.

### Removed
- Course edit mode: removed the duplicate page-top validation error summary banner (keeping inline field errors and the sticky error banner).
- Syllabus checklist view: removed the redundant `Open →` link on chapter and sub-lesson rows since clicking any entry opens its overview drawer.

## [0.6.0]

### Added
- Course edit mode: replaced the single week-range text input with two optional positive-integer ($\ge 1$) **From** and **To** number inputs separated by a right-pointing arrow (`To` stays disabled until `From` has a value); displays nothing when empty, `Week 1` when `From` is set alone or equals `To`, and `Week 1-2` when `From` and `To` differ.
- Course edit mode: sub-lessons now show a live light-blue resource-count tag immediately after the derived sub-lesson ID, and chapters show a live amber resource-count tag beside the lessons-count tag whenever the chapter has at least one resource.

### Changed
- Sample courses: reworked `DEMO201` (Course A) into a full-application feature overview and `GUIDE101` (Course B) into a step-by-step usage tutorial reflecting the current feature set and `Week X` / `Week X-Y` format.
- Course edit mode: optional fields now start empty with placeholders only, while required fields start with default values and also include placeholders when cleared.
- Course edit mode: existing chapters and sub-lessons now load collapsed by default, while newly added chapters and sub-lessons open expanded immediately.

### Fixed
- Syllabus checklist view: chapter tags now stack vertically on smaller/mobile screens so chapter titles have room, while keeping the horizontal layout on desktop.

### Removed
- Removed the special case that hid `Part [number]` / `Ch [number]` week ranges from syllabus views and displayed "Hidden on syllabus views since it duplicates Ch [num]." (behavior was never intended).

## [0.5.0]

### Added
- Tree view: added 2D free panning with mouse drag on desktop and touch-swipe gestures on mobile.
- Course edit mode: chapters can now be manually collapsed and expanded individually, and **Collapse all** collapses both chapters and sub-lessons.
- Course edit mode: sub-lesson entries now display a light-blue left accent bar matching the chapter amber accent pattern, with matching blue sub-lesson tag text.

### Changed
- Standardized lesson position tags across the app to the compact `Ch2 / L1` format (replacing `Ch 2 - L 1`).
- Chapter and lesson overviews: moved the `Ch1` chapter tag and added the `Ch2 / L1` sub-lesson tag to the top-right corner of the drawer header.

### Fixed
- Tree view: clamped 2D panning to the viewport and tree bounds so the canvas can no longer be panned endlessly off-screen.

## [0.4.0]

### Added
- Materials: added the `audio` resource kind with a centered audio player inside the in-app Material Viewer.
- Chapter overview: added independent checkmark toggles beside each sub-lesson row so lessons can be marked Done directly from the chapter drawer without navigating away.
- Course edit mode: added unsaved-changes confirmation modal before leaving with unsaved edits, plus field-highlighted validation errors in the sticky bar.

### Changed
- Tree view: tuned mobile/small-viewport sizing and increased maximum zoom from 140% to 250% with smooth animated zoom transitions.
- Chapter and lesson overviews: hid the Notes / Study Notes tab automatically when no notes exist, and hid the empty Chapter Materials box on multi-lesson chapters.
- Course edit mode: temporarily added suppression of `Part [number]` / `Ch [number]` week ranges on syllabus views with an inline editor note (later removed in `0.6.0`).

### Fixed
- Course header and navbar: refined mobile responsive layout and expandable action buttons.
- Material Viewer: centered native PDF, image, video, and audio previews cleanly across viewport sizes.

### Removed
- Data formats page: removed decorative `Sparkles` icon from the documentation header.

## [0.3.0]

### Added
- Interactive Assessments: added visual Assessment Builder modal and interactive Exam & Assignment Runner modal supporting MCQ, multi-select, true/false, short-answer, KaTeX LaTeX math rendering, question header images, hints, timers, weighted scoring, and `.assessment.json` import/export.
- Native Material Viewer modal: in-app viewer for uploaded PDFs, videos, zoomable images, line-numbered code/text files, YouTube/Vimeo, Google Drive/Docs/Slides/Sheets, and OneDrive/SharePoint links (with open-in-new-tab fallback).
- Progress persistence: added per-course interactive assessment score tracking (`Best: X%` badges) alongside statuses and bookmarks.
- Materials: added a "Pin as Recommended" toggle in the editor and pinned recommended resources to the top of material lists (initially styled with amber badges, later replaced by a purple container in `0.8.0`).
- Brand configuration: centralized user-facing brand copy in `BRAND` while keeping storage keys and export formats decoupled.

### Changed
- Standardized Light and Dark mode styling across the catalog, course header, tree, checklist, drawers, dialogs, and course editor while keeping the sticky top Navbar persistently dark.
- Course metadata: replaced free-text semester options with structured numeric `Year` (1–10) and `Semester` (`1st` / `2nd`) inputs, with inline year validation.
- Course edit mode: moved `+ Add Chapter` into the sticky editor bar with smooth scrolling to newly added chapters, and added 3-way Link / Upload / Interactive material mode toggling.
- Data Formats documentation page: expanded with structured Table of Contents, `.course.json` and `.assessment.json` schemas, KaTeX syntax guide, copyable examples, and LLM authoring prompts.

### Removed
- Removed the `'reading'` resource kind (replaced by `'document'`).
- Removed string `semester` options and legacy v1 catalog storage compatibility fallbacks in favor of a strict clean schema.

## [0.2.0]

### Added
- Chapter Overview drawer: clicking a chapter spine node opens a dedicated chapter overview with progress stats, prerequisites, chapter-level materials, notes, and sub-lesson list.
- Direct milestone chapters: chapters with 0 sub-lessons can be tracked directly as Todo, Learning, Done, or Skipped in both Tree View and Checklist View.
- Local file uploads: attach study files stored in browser IndexedDB (with extension safety checks, kind auto-suggestion, and no file-size cap).
- Portable course exchange: export courses as `.course.json` (optionally embedding uploaded files as base64) and import them into new editor drafts with automatic slug conflict resolution.
- Dark mode: added Light / Dark / System theme toggle in the navbar with pre-paint FOUC prevention.
- Course edit mode: added sticky editing context bar, collapsible sub-lesson cards, prerequisite picker, and **Collapse all** action.
- Data Formats documentation page (`/docs/data-formats`) and new seed courses (`GUIDE101: Quick Start` and `DEMO201: Feature Showcase`).

### Changed
- Progress math: marking an item as Skipped styles it in slate gray (replacing teal) and reduces the required denominator in chapter and course completion fractions.
- Course deletion: deleting a course from the catalog or editor now also clears its saved progress and bookmarks.

### Fixed
- Tree view: wrapped long chapter and sub-lesson node labels cleanly within clamped node widths and added an inline favicon.
- Import validation and skipped prerequisite chips: hardened course import validation and rendered skipped leaf-chapter prerequisite chips in slate gray with a Ban icon instead of green Done.

### Removed
- Removed original sample courses `CS201: Data Structures` and `CS301: Operating Systems` (replaced by `GUIDE101` and `DEMO201`).
- Removed estimated time / duration (`estimatedMinutes`) fields from course data and the course editor.

## [0.1.0]

### Added
- Initial local-first **College Course Trees** web application (reconstructed from baseline commit `0e92b1e`):
  - Homepage course catalog grouped by department with Course Trees, Bookmarked, and In Progress tabs, plus `Ctrl+K` global search modal.
  - Interactive SVG roadmap.sh-style Tree View with central chapter spine, left/right sub-lesson branches, zoom controls, Shift+Click Done toggle, and right-click Quick Status Pill.
  - Linear Syllabus Checklist View with chapter sections, material counts, and status filters (`All`, `Todo`, `Learning`, `Done`, `Skipped`).
  - Slide-over Lesson Drawer with Resources and Study Notes tabs, prerequisite chips, `L`/`D`/`S`/`←`/`→`/`Esc` keyboard shortcuts, and URL query sync.
  - Course Editor (`/editor/new` and `/course/:slug/edit`) with auto-derived chapter/lesson IDs, progress remapping on rename, and Live Tree Preview tab.
  - Local `localStorage` persistence for custom courses, bookmarks, and lesson statuses, plus JSON Progress Backup/Restore and SVG tree download.
