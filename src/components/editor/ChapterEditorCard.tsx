import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { LessonEditorCard } from '@/components/editor/LessonEditorCard';
import { MaterialsEditor } from '@/components/editor/MaterialsEditor';
import { PrerequisitePicker } from '@/components/editor/PrerequisitePicker';
import type { Chapter, SubLesson } from '@/types/course';

interface ChapterEditorCardProps {
  chapter: Chapter;
  chapterIndex: number;
  totalChapters: number;
  derivedChapterId: string;
  derivedLessonIds: string[];
  courseCode: string;
  allChapters: Chapter[];
  expandedLessons: Record<string, boolean>;
  fieldErrors?: Record<string, string>;
  onToggleLessonExpand: (lessonId: string) => void;
  onUpdateChapter: (updater: (ch: Chapter) => Chapter) => void;
  onMoveChapter: (direction: -1 | 1) => void;
  onRemoveChapter: () => void;
  onToggleChapterPrerequisite: (prereqId: string) => void;
  onAddLesson: () => void;
  onUpdateLesson: (lessonIndex: number, updater: (lesson: SubLesson) => SubLesson) => void;
  onMoveLesson: (lessonIndex: number, direction: -1 | 1) => void;
  onRemoveLesson: (lessonIndex: number) => void;
  onToggleLessonPrerequisite: (lessonIndex: number, prereqId: string) => void;
}

export function ChapterEditorCard({
  chapter,
  chapterIndex,
  totalChapters,
  derivedChapterId,
  derivedLessonIds,
  courseCode,
  allChapters,
  expandedLessons,
  fieldErrors,
  onToggleLessonExpand,
  onUpdateChapter,
  onMoveChapter,
  onRemoveChapter,
  onToggleChapterPrerequisite,
  onAddLesson,
  onUpdateLesson,
  onMoveLesson,
  onRemoveLesson,
  onToggleLessonPrerequisite,
}: ChapterEditorCardProps) {
  const isLeafChapter = chapter.lessons.length === 0;
  const chapterOrder = chapterIndex + 1;
  const chapterPrefix = `chapters.${chapterIndex}`;
  const titleErrorKey = `${chapterPrefix}.title`;
  const descriptionErrorKey = `${chapterPrefix}.description`;
  const titleError = fieldErrors?.[titleErrorKey];
  const descriptionError = fieldErrors?.[descriptionErrorKey];

  const isRedundantWeekRange = Boolean(
    chapter.weekRange &&
      new RegExp(
        `^(?:ch(?:apter)?|part|unit|module|section)\\s*0*${chapterOrder}$`,
        'i'
      ).test(chapter.weekRange.trim())
  );

  return (
    <div
      data-edit-chapter={chapter.id}
      className="scroll-mt-32 rounded-lg border border-slate-200 bg-white shadow-xs dark:border-slate-700/80 dark:bg-[#121926]"
    >
      {/* Compact Sticky Chapter Header Row (NO overflow-hidden on outer container!) */}
      <div className="sticky top-[120px] z-20 flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-t-lg border-b border-slate-200 border-l-4 border-l-amber-400 bg-slate-50 px-4 py-2 dark:border-slate-700/80 dark:border-l-amber-400 dark:bg-[#1b2436]">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white dark:bg-[#0d131f] dark:text-amber-400">
            Ch {chapterOrder}
          </span>
          <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {chapter.title || 'Untitled Chapter'}
          </span>
          <span
            className="hidden rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-700 sm:inline dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-300"
            title="Auto-derived chapter ID"
          >
            {derivedChapterId}
          </span>
          <span className="hidden rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 md:inline dark:bg-amber-400/15 dark:text-amber-300">
            {isLeafChapter
              ? '0 lessons'
              : `${chapter.lessons.length} ${chapter.lessons.length === 1 ? 'lesson' : 'lessons'}`}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={chapterIndex === 0}
            onClick={() => onMoveChapter(-1)}
            title="Move chapter up"
            aria-label="Move chapter up"
            className="rounded border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-600 dark:bg-[#121926] dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={chapterIndex === totalChapters - 1}
            onClick={() => onMoveChapter(1)}
            title="Move chapter down"
            aria-label="Move chapter down"
            className="rounded border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-600 dark:bg-[#121926] dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemoveChapter}
            title="Delete chapter"
            aria-label="Delete chapter"
            className="rounded border border-red-200 bg-white p-1 text-red-600 hover:bg-red-50 dark:border-red-800/60 dark:bg-[#0d131f] dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Chapter Details & Content */}
      <div className="space-y-4 rounded-b-lg p-4">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Chapter Title *
            </label>
            <input
              type="text"
              value={chapter.title}
              onChange={(e) =>
                onUpdateChapter((ch) => ({ ...ch, title: e.target.value }))
              }
              placeholder="Chapter Title"
              aria-label={`Chapter ${chapterOrder} title`}
              aria-invalid={Boolean(titleError)}
              data-error-key={titleErrorKey}
              data-field-error={titleError ? 'true' : undefined}
              className={`w-full rounded-md border bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:bg-[#0d131f] dark:text-slate-100 dark:placeholder:text-slate-500 ${
                titleError
                  ? 'border-red-500 ring-1 ring-red-500/30 dark:border-red-500'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
            />
            {titleError && (
              <p role="alert" className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                {titleError}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Week Range (optional)
            </label>
            <input
              type="text"
              value={chapter.weekRange ?? ''}
              onChange={(e) =>
                onUpdateChapter((ch) => ({
                  ...ch,
                  weekRange: e.target.value || undefined,
                }))
              }
              placeholder="e.g. Weeks 1–3"
              aria-label={`Chapter ${chapterOrder} week range`}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {isRedundantWeekRange && (
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Hidden on syllabus views since it duplicates Ch {chapterOrder}.
              </p>
            )}
          </div>

          <div className="sm:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Description *
            </label>
            <input
              type="text"
              value={chapter.description}
              onChange={(e) =>
                onUpdateChapter((ch) => ({ ...ch, description: e.target.value }))
              }
              placeholder="Chapter description"
              aria-label={`Chapter ${chapterOrder} description`}
              aria-invalid={Boolean(descriptionError)}
              data-error-key={descriptionErrorKey}
              data-field-error={descriptionError ? 'true' : undefined}
              className={`w-full rounded-md border bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:bg-[#0d131f] dark:text-slate-100 dark:placeholder:text-slate-500 ${
                descriptionError
                  ? 'border-red-500 ring-1 ring-red-500/30 dark:border-red-500'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
            />
            {descriptionError && (
              <p role="alert" className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                {descriptionError}
              </p>
            )}
          </div>

          <div className="sm:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Chapter Notes (optional)
            </label>
            <textarea
              rows={2}
              value={chapter.notes ?? ''}
              onChange={(e) =>
                onUpdateChapter((ch) => ({
                  ...ch,
                  notes: e.target.value || undefined,
                }))
              }
              placeholder="Overview notes, study guidance, or milestone instructions..."
              aria-label={`Chapter ${chapterOrder} notes`}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        <PrerequisitePicker
          chapters={allChapters}
          currentId={chapter.id}
          currentKind="chapter"
          selectedIds={chapter.prerequisites ?? []}
          onToggle={onToggleChapterPrerequisite}
        />

        <MaterialsEditor
          resources={chapter.resources ?? []}
          courseCode={courseCode}
          titleLabel="Chapter Materials"
          errorPrefix={`${chapterPrefix}.resources`}
          fieldErrors={fieldErrors}
          onChange={(nextResources) =>
            onUpdateChapter((ch) => ({
              ...ch,
              resources: nextResources.length > 0 ? nextResources : undefined,
            }))
          }
        />

        {/* Sub-Lessons List */}
        <div className="border-t border-slate-200 pt-3 dark:border-slate-700/80">
          {isLeafChapter ? (
            <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-400/10 dark:text-amber-200">
              No sub-lessons — students can check off this chapter directly.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700/80">
              {chapter.lessons.map((lesson, lIdx) => (
                <LessonEditorCard
                  key={lesson.id}
                  lesson={lesson}
                  lessonIndex={lIdx}
                  totalLessons={chapter.lessons.length}
                  chapterOrder={chapterOrder}
                  chapterId={chapter.id}
                  derivedLessonId={derivedLessonIds[lIdx] ?? lesson.id}
                  courseCode={courseCode}
                  allChapters={allChapters}
                  isExpanded={Boolean(expandedLessons[lesson.id])}
                  errorPrefix={`${chapterPrefix}.lessons.${lIdx}`}
                  fieldErrors={fieldErrors}
                  onToggleExpand={() => onToggleLessonExpand(lesson.id)}
                  onUpdate={(updater) => onUpdateLesson(lIdx, updater)}
                  onMove={(dir) => onMoveLesson(lIdx, dir)}
                  onRemove={() => onRemoveLesson(lIdx)}
                  onTogglePrerequisite={(prereqId) =>
                    onToggleLessonPrerequisite(lIdx, prereqId)
                  }
                />
              ))}
            </div>
          )}

          <div className="pt-3">
            <button
              type="button"
              onClick={onAddLesson}
              className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-slate-50/70 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#1b2436]/60 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-[#1b2436]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Sub-Lesson to Chapter {chapterOrder}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
