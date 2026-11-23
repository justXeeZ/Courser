import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { PrerequisitePicker } from '@/components/editor/PrerequisitePicker';
import { MaterialsEditor } from '@/components/editor/MaterialsEditor';
import { formatLessonPositionTag } from '@/lib/courseIds';
import type { Chapter, SubLesson } from '@/types/course';

interface LessonEditorCardProps {
  lesson: SubLesson;
  lessonIndex: number;
  totalLessons: number;
  chapterOrder: number;
  chapterId: string;
  derivedLessonId: string;
  courseCode: string;
  allChapters: Chapter[];
  isExpanded: boolean;
  errorPrefix?: string;
  fieldErrors?: Record<string, string>;
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
  chapterOrder,
  chapterId,
  derivedLessonId,
  courseCode,
  allChapters,
  isExpanded,
  errorPrefix,
  fieldErrors,
  onToggleExpand,
  onUpdate,
  onMove,
  onRemove,
  onTogglePrerequisite,
}: LessonEditorCardProps) {
  const titleErrorKey = errorPrefix ? `${errorPrefix}.title` : undefined;
  const summaryErrorKey = errorPrefix ? `${errorPrefix}.summary` : undefined;
  const titleError = titleErrorKey ? fieldErrors?.[titleErrorKey] : undefined;
  const summaryError = summaryErrorKey ? fieldErrors?.[summaryErrorKey] : undefined;
  const [isStuck, setIsStuck] = useState<boolean>(false);
  const headerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isExpanded) {
      setIsStuck(false);
      return;
    }

    const updateStuck = () => {
      const el = headerRef.current;
      if (!el) return;
      const computedTop = parseFloat(window.getComputedStyle(el).top);
      const targetTop = Number.isFinite(computedTop) ? computedTop : 168;
      const rect = el.getBoundingClientRect();
      setIsStuck(window.scrollY > 0 && Math.abs(rect.top - targetTop) <= 1.5);
    };

    updateStuck();
    window.addEventListener('scroll', updateStuck, { passive: true });
    window.addEventListener('resize', updateStuck);
    return () => {
      window.removeEventListener('scroll', updateStuck);
      window.removeEventListener('resize', updateStuck);
    };
  }, [isExpanded]);

  const headerCornerClass = isExpanded
    ? isStuck
      ? 'sticky top-[var(--editor-lesson-sticky-top,168px)] z-10 rounded-t-none'
      : 'sticky top-[var(--editor-lesson-sticky-top,168px)] z-10 rounded-t-md'
    : 'rounded-md';

  return (
    <div data-edit-lesson={lesson.id} className="py-2.5 first:pt-0 last:pb-0">
      {/* Lesson Header Row — sticky below chapter header when expanded; identical colors in collapsed & expanded states */}
      <div
        ref={headerRef}
        data-sticky-header="lesson"
        data-stuck={isStuck ? 'true' : 'false'}
        className={`flex flex-wrap items-center justify-between gap-2 border border-slate-200 border-l-4 border-l-blue-500 bg-slate-100 px-3 py-2 dark:border-slate-700 dark:border-l-blue-400 dark:bg-[#1b2436] ${headerCornerClass}`}
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
          <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-blue-800 dark:bg-blue-400/15 dark:text-blue-300">
            {formatLessonPositionTag(chapterOrder, lessonIndex + 1)}
          </span>
          <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {lesson.title || 'Untitled Lesson'}
          </span>
          <span className="hidden rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-600 sm:inline dark:bg-[#0d131f] dark:text-slate-300">
            {derivedLessonId}
          </span>
          <span
            data-testid="lesson-resource-count-tag"
            className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-800 dark:bg-blue-400/15 dark:text-blue-300"
          >
            {lesson.resources.length} {lesson.resources.length === 1 ? 'resource' : 'resources'}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
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
                placeholder="e.g. Course Introduction"
                aria-label="Sub-Lesson Title"
                aria-invalid={Boolean(titleError)}
                data-error-key={titleErrorKey}
                data-field-error={titleError ? 'true' : undefined}
                className={`w-full rounded-md border bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:bg-[#0d131f] dark:text-slate-100 dark:placeholder:text-slate-500 ${
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
              placeholder="Brief summary of what students will learn..."
              aria-label="Lesson Summary"
              aria-invalid={Boolean(summaryError)}
              data-error-key={summaryErrorKey}
              data-field-error={summaryError ? 'true' : undefined}
              className={`w-full rounded-md border bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:bg-[#0d131f] dark:text-slate-100 dark:placeholder:text-slate-500 ${
                summaryError
                  ? 'border-red-500 ring-1 ring-red-500/30 dark:border-red-500'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
            />
            {summaryError && (
              <p role="alert" className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                {summaryError}
              </p>
            )}
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
            errorPrefix={errorPrefix ? `${errorPrefix}.resources` : undefined}
            fieldErrors={fieldErrors}
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
