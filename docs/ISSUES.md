# Known Inconsistencies & Open Questions

All pre-release audit items have been resolved for **Courser**:

1. **Modal & drawer backdrop opacity variations:** *Resolved.* Standardized on `--backdrop-modal` (`rgba(0, 0, 0, 0.5)`) and `--backdrop-drawer` (`rgba(0, 0, 0, 0.4)`) CSS variables in `src/index.css`.
2. **Removed** (per-layout container max-widths are intentional).
3. **`AppShell` wrapper background classes:** *Resolved.* `src/App.tsx` now uses `bg-[var(--surface-canvas)] text-[var(--text-primary)]`.
4. **Duplicated SVG status hex literals:** *Resolved.* `ROADMAP_COLORS` (`src/lib/theme.ts`) is the single source of truth for SVG node/badge fills and `handleDownloadSvg` inline export styles.
5. **Drawer tab names & material count phrasing:** *Resolved.* Standardized on `"Materials"` / `"Notes"` and `"materials"` counts across `ChapterDrawer`, `LessonDrawer`, `ChecklistView`, `ChapterEditorCard`, and `LessonEditorCard` (`"Overview"` kept only for multi-lesson chapters with no chapter materials).
6. **Modal focus trap, fullscreen viewport unit & SVG keyboard shortcuts:** *Resolved.* Added shared `useDialogFocus` (`Tab` trap, initial focus, focus restore, topmost `Escape`), `h-dvh` in `MaterialViewerModal`, and `Shift+Enter`/`Shift+Space` + `M`/`Shift+F10` on SVG nodes.
7. **Unused / test-only helpers:** *Kept* for test convenience.
8. **Duplicate export envelope interfaces:** *Kept* separate to avoid circular imports (`src/data/exampleCourseExport.ts`).
9. **Viewer vs. `openStoredFile` text extension list:** *Resolved.* Shared `TEXT_CODE_EXTENSIONS` exported from `src/lib/fileStore.ts`.
10. **`AssessmentSchema` vs. `DataFormatsPage` numeric bounds:** *Resolved.* Kept `passingScorePercent` as `number 0..100` and `timeLimitMinutes` as `int > 0`, and aligned `DataFormatsPage` docs.
11. **Question header `imageUrl` protocol vs. UI copy:** *Resolved.* Updated `AssessmentBuilderModal` and `DataFormatsPage` labels to `http(s)://`.
12. **`.catch('Preparatory')` fallback on `department`:** *Resolved.* Removed `.catch('Preparatory')` from strict `CourseTreeSchema.department`; kept `'Preparatory'` default only in lenient import pre-pass (`courseExchange.ts`).
13. **Repository `StorageLike` adapter asymmetry:** *Resolved.* Cleaned up `localRepositories.ts` (`PersistResult`, corrupt backup & per-course recovery).
14. **One-shot IndexedDB garbage collection:** *Resolved.* Added multi-tab editor lease guard (`EDITOR_LEASE_STORAGE_KEY`) and post-save/delete GC in `CourseEditorPage`.
15. **`SearchModal` query fields & missing `README.md`:** *Resolved.* Added `course.description` matching and keyboard `ArrowUp`/`ArrowDown`/`Enter` navigation in `SearchModal`, and added root `README.md` + `LICENSE` (MIT).
