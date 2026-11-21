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
  const isStandalone = chapter.lessons.length === 0;

  return (
    <div
      data-edit-chapter={chapter.id}
      className="rounded-lg border border-gray-200 bg-white shadow-xs dark:border-slate-700 dark:bg-slate-900"
    >
      {/* Compact Sticky Chapter Header Row (NO overflow-hidden on outer container!) */}
      <div className="sticky top-14 z-20 flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-t-lg border-b border-gray-200 border-l-4 border-l-[#fdff00] bg-white px-4 py-2 dark:border-slate-700 dark:border-l-[#fdff00] dark:bg-slate-900">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white dark:bg-slate-800">
            Ch {chapterIndex + 1}
          </span>
          <span className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">
            {chapter.title || 'Untitled Chapter'}
          </span>
          <span
            className="hidden rounded bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-700 sm:inline dark:bg-slate-800 dark:text-slate-300"
            title="Auto-derived chapter ID"
          >
            {derivedChapterId}
          </span>
          <span className="hidden rounded bg-amber-100/80 px-1.5 py-0.5 text-[11px] font-medium text-amber-900 md:inline dark:bg-amber-900/30 dark:text-amber-300">
            {isStandalone ? 'Standalone' : `${chapter.lessons.length} lessons`}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={chapterIndex === 0}
            onClick={() => onMoveChapter(-1)}
            title="Move chapter up"
            aria-label="Move chapter up"
            className="rounded border border-gray-300 bg-white p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={chapterIndex === totalChapters - 1}
            onClick={() => onMoveChapter(1)}
            title="Move chapter down"
            aria-label="Move chapter down"
            className="rounded border border-gray-300 bg-white p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemoveChapter}
            title="Delete chapter"
            aria-label="Delete chapter"
            className="rounded border border-red-200 bg-white p-1 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-950 dark:text-red-400 dark:hover:bg-red-950/50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Chapter Details & Content */}
      <div className="space-y-4 rounded-b-lg p-4">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">
              Chapter Title *
            </label>
            <input
              type="text"
              value={chapter.title}
              onChange={(e) =>
                onUpdateChapter((ch) => ({ ...ch, title: e.target.value }))
              }
              placeholder="Chapter Title"
              aria-label={`Chapter ${chapterIndex + 1} title`}
              className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">
              Week Range
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
              placeholder="Weeks (e.g. Weeks 1–3)"
              aria-label={`Chapter ${chapterIndex + 1} week range`}
              className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">
              Description *
            </label>
            <input
              type="text"
              value={chapter.description}
              onChange={(e) =>
                onUpdateChapter((ch) => ({ ...ch, description: e.target.value }))
              }
              placeholder="Chapter description"
              aria-label={`Chapter ${chapterIndex + 1} description`}
              className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">
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
              aria-label={`Chapter ${chapterIndex + 1} notes`}
              className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
          onChange={(nextResources) =>
            onUpdateChapter((ch) => ({
              ...ch,
              resources: nextResources.length > 0 ? nextResources : undefined,
            }))
          }
        />

        {/* Sub-Lessons List */}
        <div className="border-t border-gray-200 pt-3 dark:border-slate-700">
          {isStandalone ? (
            <div className="rounded-md border border-dashed border-amber-300 bg-amber-50/70 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200">
              Standalone chapter — students can check it off directly
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {chapter.lessons.map((lesson, lIdx) => (
                <LessonEditorCard
                  key={lesson.id}
                  lesson={lesson}
                  lessonIndex={lIdx}
                  totalLessons={chapter.lessons.length}
                  chapterId={chapter.id}
                  derivedLessonId={derivedLessonIds[lIdx] ?? lesson.id}
                  courseCode={courseCode}
                  allChapters={allChapters}
                  isExpanded={Boolean(expandedLessons[lesson.id])}
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
              className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-gray-500 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Sub-Lesson to Chapter {chapterIndex + 1}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
