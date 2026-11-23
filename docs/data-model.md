# Data Model, Storage & Non-Goals

## 1. Sources of Truth
Inspect schema and interface definitions in code rather than duplicating field lists in docs:
- Core course, chapter, sub-lesson, resource, and assessment schemas: `src/types/course.ts`
- Progress state, assessment score records, and repository interfaces: `src/lib/storage/types.ts`
- Local repository implementations: `src/lib/storage/localRepositories.ts`
- Brand display configuration: `src/config/brand.ts`

## 2. Schema Rules & Domain Invariants
- **Course & structured term fields (`CourseTreeSchema` in `src/types/course.ts`):**
  - `slug`: lowercase kebab-case (`/^[a-z0-9-]+$/`), unique across the catalog.
  - `department`: trimmed string (min 2 chars), defaulting/catching to `'Preparatory'`. `getCoursesByDepartment` (`src/data/courses/index.ts`) orders `'Preparatory'` first, then alphabetical departments, sorting courses within each department by term then `code`.
  - Term fields: optional `year` (integer `1..10`) and optional `semester` (`1 | 2`), formatted via `formatCourseTerm(course)` (`"Year N · 1st Semester"`, `"Year N"`, `"2nd Semester"`, or `null`).
- **Shared ID namespace, standardized position tags & deterministic rekeying (`src/lib/courseIds.ts`):**
  - `deriveCoursePrefix(course.code)` extracts the lowercase alphanumeric prefix.
  - Every chapter ID (`${prefix}-ch${order}-${slug}` via `deriveChapterId`) and sub-lesson ID (`${prefix}-ch${chapterOrder}-l${lessonOrder}-${slug}` via `deriveLessonId`) shares **one** uniqueness namespace per course and starts with `${prefix}-`.
  - Position tags use `formatChapterPositionTag(chapterOrder)` (`"Ch1"`) and `formatLessonPositionTag(chapterOrder, lessonOrder)` (`"Ch1 / L3"`), matching the `ch<N>-l<M>` ID and URL query structure (`/course/:slug?chapter=<chapterId>` and `/course/:slug?lesson=<lessonId>`).
  - Uploaded file IDs (`${prefix}-file-${8 hex}` via `deriveFileId`) are never altered when chapter or lesson titles change.
  - Saves (`useCourseStore.tsx`) and imports (`courseExchange.ts`) first run `validateRawCourseReferences` (rejecting duplicate raw IDs, self-prerequisites, and unknown prerequisite IDs), then run `rekeyCourseContentIdsWithMap` to derive canonical IDs and remap prerequisites, and call `remapCourseProgress` so user statuses, bookmarks, and assessment scores survive renames and code changes.
- **Leaf chapters vs. multi-lesson chapters (`src/lib/courseItems.ts`):**
  - A chapter with `lessons: []` (`isLeafChapter(chapter) === true`) is a leaf chapter counting as `1` trackable item in `getTrackableItems(course)` and supporting `notes`, `prerequisites`, and `resources`.
  - Multi-lesson chapters track completion across `chapter.lessons`; `findCourseItem(course, id)` resolves both chapters and sub-lessons.
- **Progress statuses & skip math (`src/store/useProgressStore.tsx`):**
  - `LessonStatus`: `'todo' | 'learning' | 'done' | 'skipped'` (`'todo'` is omitted from persisted `statuses`). Deleting a course calls `forgetCourse(slug)` to purge statuses, bookmark, and assessment scores.
  - `required = Math.max(0, total - skipped)`; `percentDone = required === 0 ? (total > 0 ? 100 : 0) : Math.round((done / required) * 100)`.
- **Material kinds, recommended pinning & 3-way XOR (`LessonResourceSchema` in `src/types/course.ts`):**
  - `ResourceKindSchema`: `'slides' | 'video' | 'audio' | 'lab' | 'document' | 'textbook' | 'course' | 'official' | 'exam' | 'assignment'`.
  - `recommended?: boolean`: when `true`, `MaterialList` pins the resource to the top (preserving relative order within pinned and unpinned items) with a `Recommended` badge.
  - **Strict 3-way XOR payload:** every `LessonResource` must define **exactly one** of `url`, `file` (`StoredFileRef`), or `assessment` (`AssessmentData`). In `MaterialsEditor`, the `Interactive` source tab is shown only when `kind` is `'exam'` or `'assignment'`.
- **Upload validation & IndexedDB garbage collection (`src/lib/materialValidation.ts`, `src/lib/fileStore.ts`, `src/App.tsx`):**
  - Light validation enforces **no file size cap**, rejects `0`-byte files, and blocks executable/scriptable extensions and MIME types (`DANGEROUS_EXTENSIONS` / `DANGEROUS_MIME_TYPES`, including `.exe`, `.bat`, `.sh`, `.msi`, `.dll`, `.cmd`, `.ps1`, `.html`, `.svg`). It auto-suggests a `ResourceKind` (including `'audio'` for `.mp3`, `.wav`, `.m4a`, `.ogg`, `.aac`, `.flac`) from the filename and warns non-blockingly on unusual extensions.
  - `collectReferencedFileIds(courses)` scans `chapter.resources[].file?.id`, `lesson.resources[].file?.id`, and `resource.assessment?.questions[].header.imageFile?.id`.
  - `garbageCollectFiles` runs once on initial mount in `src/App.tsx`, skipped on `/editor*` and `*/edit` routes so unsaved editor uploads are preserved.
- **Interactive assessments, LaTeX math & score persistence (`src/types/course.ts`, `src/lib/mathRender.ts`, `src/lib/storage/types.ts`):**
  - `AssessmentSchema`: `mode` (`'exam' | 'assignment'`), optional `instructions`, `timeLimitMinutes`, `passingScorePercent`, `shuffleQuestions`, and non-empty `questions` with unique IDs across 4 types (`'mcq'`, `'multi-select'`, `'true-false'`, `'short-answer'`).
  - `AssessmentQuestionHeaderSchema`: requires at least one of non-empty `text`, `imageUrl` (`http://` or `https://`), or `imageFile` (`StoredFileRef`).
  - `mathRender.ts` & `RichMathText.tsx`: render prose as React text nodes (no raw HTML/XSS) and inline/display math via KaTeX (`throwOnError: false`, ignoring escaped `\$` and currency like `$50`).
  - `ProgressState.assessmentScores`: maps `courseSlug -> getAssessmentScoreKey(itemId, resourceTitle) -> AssessmentScoreRecord` (`bestScorePercent`, `latestScorePercent`, `attempts`, `passed`, `updatedAt`).
- **Embed resolver & Blob URL cleanup (`src/lib/embedResolver.ts`, `src/components/viewer/MaterialViewerModal.tsx`):**
  - `resolveEmbedUrl(url)` classifies URLs into `google-drive` (Drive files, Docs, Slides, Sheets → `/preview` or `/embed`; folders mark `embeddable: false`), `onedrive` (OneDrive/SharePoint embed/share URLs → iframe when supported, or `embeddable: false` fallback card with `"Open in new tab"`), `youtube`, `vimeo`, `direct-pdf`, `direct-video`, `direct-audio`, `direct-image`, or `external` (opens in new tab).
  - `MaterialViewerModal`, `AssessmentBuilderModal`, and `AssessmentRunnerModal` must call `URL.revokeObjectURL` whenever a Blob object URL is closed, replaced, or unmounted.

## 3. Immutable Persistence & Exchange Identifiers (Never Swap Out or Couple to `BRAND`)
Keep display copy in `src/config/brand.ts` (`BRAND`) strictly decoupled from these identifiers so rebranding never wipes user storage or breaks imports:
- **`localStorage` keys:**
  - `COURSES_STORAGE_KEY = 'college_course_trees_catalog_v2'` (`src/lib/storage/localRepositories.ts`, `src/store/useCourseStore.tsx`)
  - `PROGRESS_STORAGE_KEY = 'college_course_trees_progress_v1'` (`src/lib/storage/types.ts`, `src/store/useProgressStore.tsx`)
  - `THEME_STORAGE_KEY = 'college_course_trees_theme'` (`src/store/useThemeStore.tsx` and FOUC script in `index.html`)
- **IndexedDB identifiers (`src/lib/fileStore.ts`):**
  - `FILE_DB_NAME = 'college_course_trees'`, `FILE_DB_VERSION = 1`, `FILE_STORE_NAME = 'files'`
- **Export envelope constants:**
  - `.course.json` (`src/lib/courseExchange.ts`): `COURSE_EXPORT_FORMAT = 'college-course-tree'`, `COURSE_EXPORT_VERSION = 1` (`buildCourseExport`, `parseCourseImport`; accepts envelope or bare `CourseTree`, suffixes duplicate slugs with `-2`, `-3`, and restores base64 file/image attachments under fresh `deriveFileId` IDs).
  - `.assessment.json` (`src/lib/assessmentExchange.ts`): `ASSESSMENT_EXPORT_FORMAT = 'college-assessment'`, `ASSESSMENT_EXPORT_VERSION = 1` (`buildAssessmentExport`, `parseAssessmentImport`; accepts envelope or bare `AssessmentData` with optional base64 image attachments).
  - Progress backup (`src/lib/storage/types.ts`, `src/store/useProgressStore.tsx`): `ProgressStateSchema` (`version: 1`).
- **Repository interfaces (`src/lib/storage/types.ts`):** `PremadeRoadmapRepository`, `UserRoadmapRepository`, `ProgressRepository`, `MaterialFileRepository`.

## 4. Non-Goals
- **No backend server, authentication, or cloud sync in the current app:** Everything runs locally via `localStorage`, IndexedDB, and portable JSON files.
- **No Notion embeds:** Notion URLs are treated as regular `external` links that open in a new tab.
- **No legacy schema fallbacks:** Do not reintroduce `'reading' -> 'document'` coercion, string `semester` parsing, `LEGACY_COURSES_STORAGE_KEY`, or `migrateLegacyV1Catalog`.
- **No estimated time / duration fields:** Courses, chapters, and lessons do not track time estimates.
- **No unsanitized HTML rendering:** Notes, descriptions, and math expressions never inject raw HTML.
