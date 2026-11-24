# Project Roadmap & Milestone Plan

## Completed Milestones
- **Milestone 1 (Core Greenfield App):** Built the local-first React + TypeScript + Tailwind v4 SPA with roadmap.sh-inspired SVG chapter spine and sub-lesson branches (`layoutTree.ts`, `CourseTreeCanvas.tsx`), slide-over drawers, syllabus checklist, `localStorage` progress & JSON backup, `Download SVG`, global `Ctrl/Cmd+K` search, and visual course CRUD with deterministic course-derived IDs (`courseIds.ts`).
- **Milestone 2 (Uploads, Single-Unit Chapters, Exchange & Dark Mode):** Added IndexedDB material file storage (`fileStore.ts`) with light validation (`materialValidation.ts`) and startup GC, leaf chapters without sub-lessons (`lessons: []`), Chapter Overview drawer (`ChapterDrawer.tsx`), skip denominator reduction (`required = total - skipped`), sticky editor headers, `.course.json` import/export with base64 attachments (`courseExchange.ts`), `GUIDE101` & `DEMO201` seed courses, Light/Dark/System theme store with FOUC guard, and `/docs/data-formats` (`DataFormatsPage.tsx`).
- **Milestone 3 (UI/UX Overhaul, Strict Schema, Interactive LaTeX Assessments, Native Viewer & Branding Prep):**
  - Standardized the 4-tier neutral Light & Dark surface palette across all views while keeping `Navbar` dark in both modes.
  - Fixed all 15 UI/UX issues: neutral `ProgressStrip`, responsive hover-reveal + mobile left-expanding `CourseHeader` actions, structured `year` (`1..10`) + `semester` (`1 | 2`) inputs, sticky `+ Add Chapter`, stable `LessonEditorCard` header color on expand, leaf chapter header check toggle in `ChecklistView`, hidden empty multi-lesson `Chapter Materials`, smooth zoom in/out transitions, multi-lesson chapter filter dimming, hidden leaf chapter `'todo'` status blob, `'document'` / red `'course'` / teal `'textbook'` badges, `recommended` material pinning, and structured Table of Contents on `DataFormatsPage`.
  - Enforced strict clean schema (removed legacy `'reading'` coercion, string `semester` options, and v1 catalog migration code).
  - Added 3-way XOR interactive assessments (`AssessmentSchema`, `assessmentExchange.ts`, `AssessmentBuilderModal.tsx`, `AssessmentRunnerModal.tsx`) with KaTeX LaTeX rendering (`mathRender.ts`, `RichMathText.tsx`), text/image headers, and persisted `assessmentScores` (`Best: XX%` badges).
  - Added `MaterialViewerModal.tsx` and `embedResolver.ts` for in-app viewing of uploaded PDF/video/audio/image/code files and Google Drive/Docs/Slides/Sheets, OneDrive/SharePoint (with non-embeddable fallback card), YouTube, and Vimeo links.
  - Centralized display branding in `src/config/brand.ts` (`BRAND`), decoupled from storage keys and export format identifiers.
- **Milestone 4 (Navigation, Tree Panning & Mobile Zoom, Editor Validation & Unsaved Guard, Standardized Lesson IDs, Audio Kind & Drawer Polish):**
  - Sticky `Navbar`, smoother course tool hover expansion, click-and-drag tree panning, and tuned mobile tree view sizing + zoom range up to `250%`.
  - Clear human-readable field validation errors with sticky notification and scroll-to-error in `CourseEditorPage`, plus Save/Discard confirmation popup on unsaved editor changes.
  - Standardized `Ch X - L Y` position badges and `${prefix}-ch${chapterOrder}-l${lessonOrder}-${slug}` lesson IDs across editor, tree, drawers, and URLs.
  - Direct sub-lesson completion toggling inside `ChapterDrawer`, conditional `Notes` tab visibility, removal of redundant schedule tags, `'audio'` (`Audio`) material kind with centered viewer embeds, and `'exam'`/`'assignment'`-only `Interactive` material mode tab.

- **Milestone 5 (0.8.0 & Pre-Release Hardening — Courser):**
  - Rebranded UI to **Courser** (`c.`) with MIT `LICENSE`, root `README.md`, GitHub Pages SPA routing (`base: '/Courser/'`, `public/404.html`), `ErrorBoundary`, `React.lazy` route splitting, and Vite `manualChunks`.
  - Standardized 56 semantic CSS tokens in `src/index.css` (warm Light neutrals, Oxford Blue Dark surfaces, Purple primary/Navbar CTAs, Burnt Peach lesson tags `--tag-peach-*`, Amber chapter tags `--tag-amber-*`, WCAG 2.1 AA badge contrast, and `ROADMAP_COLORS` SVG export sync).
  - Redesigned `AssessmentRunnerModal` (Pre-Start Overview, 2-column Active view with icon-only Flag and hidden-by-default Hint under question header, Pre-Submit Review, Results filter pills, and mid-attempt/unanswered `ConfirmDialog` guards), made `ChecklistView` chapters collapsible, and standardized `ChX / LY` tags & `"Materials"`/`"Notes"` copy.
  - Hardened data integrity, security, and accessibility (`useDialogFocus` across all modals/drawers, corrupt `localStorage` backup/recovery, `QuotaExceededError` alerts, `http(s)://` URL validation & sandboxed iframe, `To >= From` week validation, `beforeunload`/router unsaved-changes guard, and ESLint setup).

## Planned Future Work
- **Multi-User Backend Deployment (Future):** Implement remote API-backed versions of `PremadeRoadmapRepository`, `UserRoadmapRepository`, `ProgressRepository`, and `MaterialFileRepository` (`src/lib/storage/types.ts`) so premade roadmaps are author-managed while authenticated users maintain custom roadmaps and per-user progress.
