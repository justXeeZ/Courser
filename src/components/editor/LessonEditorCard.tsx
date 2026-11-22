import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { PrerequisitePicker } from '@/components/editor/PrerequisitePicker';
import { MaterialsEditor } from '@/components/editor/MaterialsEditor';
import type { Chapter, SubLesson } from '@/types/course';

interface LessonEditorCardProps {
  lesson: SubLesson;
  lessonIndex: number;
  totalLessons: number;
  chapterId: string;
  derivedLessonId: string;
  courseCode: string;
  allChapters: Chapter[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updater: (lesson: SubLesson) => SubLesson) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onTogglePrerequisite: (prereqId: string) => void;
}

export function LessonEditorCard({
  lesson,
  lessonIndex,
  totalLessons,
  chapterId,
  derivedLessonId,
  courseCode,
  allChapters,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onMove,
  onRemove,
  onTogglePrerequisite,
}: LessonEditorCardProps) {
  return (
    <div data-edit-lesson={lesson.id} className="py-2.5 first:pt-0 last:pb-0">
      {/* Lesson Header Row — sticky below chapter header when expanded; identical colors in collapsed & expanded states */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 border border-slate-200 bg-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-[#1b2436] ${
          isExpanded ? 'sticky top-[104px] z-10 rounded-t-md' : 'rounded-md'
        }`}
      >
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" />
          )}
          <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {lesson.title || 'Untitled Lesson'}
          </span>
          <span className="hidden rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-600 sm:inline dark:bg-[#0d131f] dark:text-slate-300">
            {derivedLessonId}
          </span>
        </button>

        <div className="flex items-center gap-1">
          <span className="rounded bg-white px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-[#0d131f] dark:text-slate-300">
            {lesson.resources.length} res
          </span>
          <button
            type="button"
            disabled={lessonIndex === 0}
            onClick={() => onMove(-1)}
            title="Move lesson up"
            aria-label="Move lesson up"
            className="rounded border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-600 dark:bg-[#121926] dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            disabled={lessonIndex === totalLessons - 1}
            onClick={() => onMove(1)}
            title="Move lesson down"
            aria-label="Move lesson down"
            className="rounded border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-600 dark:bg-[#121926] dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <ArrowDown className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="Delete sub-lesson"
            aria-label={`Delete ${lesson.title}`}
            className="rounded border border-red-200 bg-white p-1 text-red-600 hover:bg-red-50 dark:border-red-800/60 dark:bg-[#0d131f] dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Expanded Lesson Body */}
      {isExpanded && (
        <div className="space-y-3 rounded-b-md border border-t-0 border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-[#121926]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Sub-Lesson Title *
              </label>
              <input
                type="text"
                value={lesson.title}
                onChange={(e) =>
                  onUpdate((l) => ({
                    ...l,
                    title: e.target.value,
                  }))
                }
                aria-label="Sub-Lesson Title"
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Branch Side
              </label>
              <select
                value={lesson.side ?? ''}
                onChange={(e) =>
                  onUpdate((l) => ({
                    ...l,
                    side:
                      e.target.value === 'left' || e.target.value === 'right'
                        ? e.target.value
                        : undefined,
                  }))
                }
                aria-label="Branch Side"
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-100"
              >
                <option value="">Auto</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Summary *
            </label>
            <textarea
              rows={2}
              value={lesson.summary}
              onChange={(e) =>
                onUpdate((l) => ({
                  ...l,
                  summary: e.target.value,
                }))
              }
              aria-label="Lesson Summary"
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Study Notes (optional)
            </label>
            <textarea
              rows={2}
              value={lesson.notes ?? ''}
              onChange={(e) =>
                onUpdate((l) => ({
                  ...l,
                  notes: e.target.value || undefined,
                }))
              }
              placeholder="Key takeaways, formulas, or exam tips..."
              aria-label="Lesson Notes"
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <PrerequisitePicker
            chapters={allChapters}
            currentId={lesson.id}
            currentKind="lesson"
            parentChapterId={chapterId}
            selectedIds={lesson.prerequisites ?? []}
            onToggle={onTogglePrerequisite}
          />

          <MaterialsEditor
            resources={lesson.resources}
            courseCode={courseCode}
            onChange={(nextResources) =>
              onUpdate((l) => ({
                ...l,
                resources: nextResources,
              }))
            }
          />
        </div>
      )}
    </div>
  );
}
