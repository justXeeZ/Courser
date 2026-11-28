import { useEffect, useId, useState } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { EditorCardHeader } from '@/components/editor/EditorCardHeader';
import { LessonEditorCard } from '@/components/editor/LessonEditorCard';
import { MaterialsEditor } from '@/components/editor/MaterialsEditor';
import { PrerequisitePicker } from '@/components/editor/PrerequisitePicker';
import { SupplementEditorCard } from '@/components/editor/SupplementEditorCard';
import { useStickyHeader } from '@/hooks/useStickyHeader';
import {
  deriveChapterSupplementId,
  formatChapterPositionTag,
  formatChapterSupplementTag,
} from '@/lib/courseIds';
import type { Chapter, SpineSupplement, SubLesson, Supplement } from '@/types/course';

export function parseWeekRangeBounds(weekRange?: string): { from: string; to: string } {
  if (!weekRange) return { from: '', to: '' };
  const match = weekRange.trim().match(/^Weeks?\s+([1-9]\d*)(?:\s*[-–]\s*([1-9]\d*))?$/i);
  if (!match) return { from: '', to: '' };
  return {
    from: match[1] ?? '',
    to: match[2] ?? '',
  };
}

export function formatWeekRangeBounds(fromStr: string, toStr: string): string | undefined {
  const fromTrim = fromStr.trim();
  if (!fromTrim || !/^[1-9]\d*$/.test(fromTrim)) return undefined;
  const fromNum = Number(fromTrim);
  const toTrim = toStr.trim();
  if (!toTrim || !/^[1-9]\d*$/.test(toTrim)) {
    return `Week ${fromNum}`;
  }
  const toNum = Number(toTrim);
  if (toNum === fromNum) {
    return `Week ${fromNum}`;
  }
  return `Week ${fromNum}-${toNum}`;
}

interface ChapterEditorCardProps {
  chapter: Chapter;
  chapterIndex: number;
  totalChapters: number;
  derivedChapterId: string;
  derivedLessonIds: string[];
  derivedSupplementIds?: string[];
  derivedLessonSupplementIds?: Record<string, string[]>;
  courseCode: string;
  allChapters: Chapter[];
  allSpineSupplements?: SpineSupplement[];
  isExpanded?: boolean;
  expandedLessons: Record<string, boolean>;
  expandedSupplements?: Record<string, boolean>;
  fieldErrors?: Record<string, string>;
  onToggleChapterExpand?: () => void;
  onToggleLessonExpand: (lessonId: string) => void;
  onToggleSupplementExpand?: (nodeId: string) => void;
  onUpdateChapter: (updater: (ch: Chapter) => Chapter) => void;
  onMoveChapter: (direction: -1 | 1) => void;
  onRemoveChapter: () => void;
  onToggleChapterPrerequisite: (prereqId: string) => void;
  onAddLesson: () => void;
  onUpdateLesson: (lessonIndex: number, updater: (lesson: SubLesson) => SubLesson) => void;
  onMoveLesson: (lessonIndex: number, direction: -1 | 1) => void;
  onRemoveLesson: (lessonIndex: number) => void;
  onToggleLessonPrerequisite: (lessonIndex: number, prereqId: string) => void;
  onAddChapterSupplement?: () => void;
  onUpdateChapterSupplement?: (cnIdx: number, updater: (cn: Supplement) => Supplement) => void;
  onRemoveChapterSupplement?: (cnIdx: number) => void;
  onAddLessonSupplement?: (lessonIdx: number) => void;
  onUpdateLessonSupplement?: (
    lessonIdx: number,
    cnIdx: number,
    updater: (cn: Supplement) => Supplement
  ) => void;
  onRemoveLessonSupplement?: (lessonIdx: number, cnIdx: number) => void;
}

export function ChapterEditorCard({
  chapter,
  chapterIndex,
  totalChapters,
  derivedChapterId,
  derivedLessonIds,
  derivedSupplementIds = [],
  derivedLessonSupplementIds = {},
  courseCode,
  allChapters,
  allSpineSupplements = [],
  isExpanded = true,
  expandedLessons,
  expandedSupplements = {},
  fieldErrors,
  onToggleChapterExpand,
  onToggleLessonExpand,
  onToggleSupplementExpand,
  onUpdateChapter,
  onMoveChapter,
  onRemoveChapter,
  onToggleChapterPrerequisite,
  onAddLesson,
  onUpdateLesson,
  onMoveLesson,
  onRemoveLesson,
  onToggleLessonPrerequisite,
  onAddChapterSupplement,
  onUpdateChapterSupplement,
  onRemoveChapterSupplement,
  onAddLessonSupplement,
  onUpdateLessonSupplement,
  onRemoveLessonSupplement,
}: ChapterEditorCardProps) {
  const isLeafChapter =
    chapter.lessons.length === 0 && (chapter.supplements?.length ?? 0) === 0;
  const chapterResourceCount = chapter.resources?.length ?? 0;
  const chapterOrder = chapterIndex + 1;
  const chapterPrefix = `chapters.${chapterIndex}`;
  const titleErrorKey = `${chapterPrefix}.title`;
  const descriptionErrorKey = `${chapterPrefix}.description`;
  const titleError = fieldErrors?.[titleErrorKey];
  const descriptionError = fieldErrors?.[descriptionErrorKey];

  const [weekFrom, setWeekFrom] = useState<string>(() => parseWeekRangeBounds(chapter.weekRange).from);
  const [weekTo, setWeekTo] = useState<string>(() => parseWeekRangeBounds(chapter.weekRange).to);
  const [chapterHeaderHeight, setChapterHeaderHeight] = useState<number>(48);
  const { headerRef, isStuck } = useStickyHeader(isExpanded, 120);
  const titleId = useId();
  const descriptionId = useId();
  const notesId = useId();

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const measureHeader = () => {
      const h = el.offsetHeight;
      if (h > 0) {
        setChapterHeaderHeight(h);
      }
    };

    measureHeader();

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(measureHeader);
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, [isExpanded, chapter.title, chapterResourceCount, chapter.lessons.length]);

  useEffect(() => {
    const parsed = parseWeekRangeBounds(chapter.weekRange);
    setWeekFrom((prevFrom) => {
      const currentFormatted = formatWeekRangeBounds(prevFrom, weekTo);
      if (currentFormatted === chapter.weekRange) return prevFrom;
      return parsed.from;
    });
    setWeekTo((prevTo) => {
      const currentFormatted = formatWeekRangeBounds(weekFrom, prevTo);
      if (currentFormatted === chapter.weekRange) return prevTo;
      return parsed.to;
    });
  }, [chapter.id, chapter.weekRange]);

  return (
    <div
      data-edit-chapter={chapter.id}
      style={
        {
          '--editor-chapter-header-height': `${chapterHeaderHeight}px`,
          '--editor-lesson-sticky-top':
            'calc(var(--editor-chapter-sticky-top, 120px) + var(--editor-chapter-header-height, 48px))',
        } as React.CSSProperties
      }
      className="editor-entry-amber scroll-mt-[var(--editor-chapter-sticky-top,120px)] rounded-lg border border-slate-200 bg-white shadow-xs dark:border-slate-700/80 dark:bg-[#121926]"
    >
      {/* Compact Sticky Chapter Header Row (NO overflow-hidden on outer container!) */}
      <EditorCardHeader
        ref={headerRef}
        level="primary"
        accent="amber"
        dataStickyHeader="chapter"
        isExpanded={isExpanded}
        isStuck={isStuck}
        stickyClassName="top-[var(--editor-chapter-sticky-top,120px)] z-20"
        positionTag={formatChapterPositionTag(chapterOrder)}
        title={chapter.title || 'Untitled Chapter'}
        derivedId={derivedChapterId}
        derivedIdTitle="Auto-derived chapter ID"
        ariaLabel={
          isExpanded
            ? `Collapse Chapter ${chapterOrder}`
            : `Expand Chapter ${chapterOrder}`
        }
        onToggleExpand={() => onToggleChapterExpand?.()}
        extraTags={
          <>
            <span className="hidden shrink-0 rounded border border-[var(--tag-amber-border)] bg-[var(--tag-amber-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--tag-amber-text)] md:inline">
              {isLeafChapter
                ? '0 lessons'
                : `${chapter.lessons.length} ${chapter.lessons.length === 1 ? 'lesson' : 'lessons'}`}
            </span>
            {chapterResourceCount > 0 && (
              <span
                data-testid="chapter-resource-count-tag"
                className="shrink-0 rounded border border-[var(--tag-amber-border)] bg-[var(--tag-amber-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--tag-amber-text)]"
              >
                {chapterResourceCount} {chapterResourceCount === 1 ? 'material' : 'materials'}
              </span>
            )}
          </>
        }
        reorderProps={{
          canMoveUp: chapterIndex > 0,
          canMoveDown: chapterIndex < totalChapters - 1,
          onMove: onMoveChapter,
          upLabel: 'Move chapter up',
          downLabel: 'Move chapter down',
        }}
        deleteProps={{
          onDelete: onRemoveChapter,
          disabled: totalChapters <= 1,
          title: totalChapters <= 1 ? 'A course must have at least one chapter' : 'Delete chapter',
          ariaLabel: 'Delete chapter',
        }}
      />

      {/* Chapter Details & Content */}
      {isExpanded && (
      <div className="space-y-4 rounded-b-lg p-4">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor={titleId} className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Chapter Title *
            </label>
            <input
              id={titleId}
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
              className={`w-full rounded-md border bg-[var(--surface-inset)] px-2.5 py-1.5 text-sm font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none ${
                titleError
                  ? 'border-[var(--status-danger-border)] ring-1 ring-[var(--status-danger-border)]/30'
                  : 'border-[var(--border-strong)]'
              }`}
            />
            {titleError && (
              <p role="alert" className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                {titleError}
              </p>
            )}
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Week Range (optional)
            </span>
            <div className="flex items-center gap-1.5">
              <div className="min-w-0 flex-1">
                <input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={weekFrom}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    if (raw !== '' && !/^[1-9]\d*$/.test(raw)) {
                      return;
                    }
                    setWeekFrom(raw);
                    if (raw === '') {
                      setWeekTo('');
                      onUpdateChapter((ch) => ({
                        ...ch,
                        weekRange: undefined,
                      }));
                    } else {
                      onUpdateChapter((ch) => ({
                        ...ch,
                        weekRange: formatWeekRangeBounds(raw, weekTo),
                      }));
                    }
                  }}
                  placeholder="From"
                  aria-label={`Chapter ${chapterOrder} week from`}
                  className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none"
                />
              </div>
              <ArrowRight
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500"
              />
              <div className="min-w-0 flex-1">
                <input
                  type="number"
                  min={weekFrom ? Number(weekFrom) : 1}
                  step={1}
                  inputMode="numeric"
                  value={weekTo}
                  disabled={weekFrom === ''}
                  onChange={(e) => {
                    if (weekFrom === '') return;
                    const raw = e.target.value.trim();
                    if (raw !== '' && !/^[1-9]\d*$/.test(raw)) {
                      return;
                    }
                    setWeekTo(raw);
                    onUpdateChapter((ch) => ({
                      ...ch,
                      weekRange: formatWeekRangeBounds(weekFrom, raw),
                    }));
                  }}
                  placeholder="To"
                  aria-label={`Chapter ${chapterOrder} week to`}
                  aria-invalid={Boolean(
                    weekFrom !== '' && weekTo !== '' && Number(weekTo) < Number(weekFrom)
                  )}
                  className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
            {weekFrom !== '' && weekTo !== '' && Number(weekTo) < Number(weekFrom) && (
              <p role="alert" className="mt-1 text-[11px] text-[var(--status-danger-text)]">
                To week must be greater than or equal to From week.
              </p>
            )}
          </div>

          <div className="sm:col-span-3">
            <label htmlFor={descriptionId} className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Description *
            </label>
            <input
              id={descriptionId}
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
              className={`w-full rounded-md border bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none dark:bg-[#0d131f] dark:text-slate-100 dark:placeholder:text-slate-500 ${
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
            <label htmlFor={notesId} className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Chapter Notes (optional)
            </label>
            <textarea
              id={notesId}
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
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        <PrerequisitePicker
          chapters={allChapters}
          spineSupplements={allSpineSupplements}
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
        <div className="border-t border-[var(--border-subtle)] pt-3">
          {isLeafChapter ? (
            <div className="rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2.5 text-xs text-[var(--status-warning-text)]">
              No sub-lessons added yet — chapters with 0 sub-lessons appear as direct milestones on the course tree.
            </div>
          ) : (
            <div className="space-y-2.5">
              {chapter.lessons.map((lesson, lIdx) => (
                <LessonEditorCard
                  key={lesson.id}
                  lesson={lesson}
                  lessonIndex={lIdx}
                  totalLessons={chapter.lessons.length}
                  chapterOrder={chapterOrder}
                  chapterId={chapter.id}
                  derivedLessonId={derivedLessonIds[lIdx] ?? lesson.id}
                  derivedSupplementIds={derivedLessonSupplementIds[lesson.id] ?? []}
                  courseCode={courseCode}
                  allChapters={allChapters}
                  allSpineSupplements={allSpineSupplements}
                  isExpanded={Boolean(expandedLessons[lesson.id])}
                  expandedSupplements={expandedSupplements}
                  errorPrefix={`${chapterPrefix}.lessons.${lIdx}`}
                  fieldErrors={fieldErrors}
                  onToggleExpand={() => onToggleLessonExpand(lesson.id)}
                  onToggleSupplementExpand={onToggleSupplementExpand}
                  onUpdate={(updater) => onUpdateLesson(lIdx, updater)}
                  onMove={(dir) => onMoveLesson(lIdx, dir)}
                  onRemove={() => onRemoveLesson(lIdx)}
                  onTogglePrerequisite={(prereqId) =>
                    onToggleLessonPrerequisite(lIdx, prereqId)
                  }
                  onAddSupplement={
                    onAddLessonSupplement ? () => onAddLessonSupplement(lIdx) : undefined
                  }
                  onUpdateSupplement={
                    onUpdateLessonSupplement
                      ? (cnIdx, updater) => onUpdateLessonSupplement(lIdx, cnIdx, updater)
                      : undefined
                  }
                  onRemoveSupplement={
                    onRemoveLessonSupplement
                      ? (cnIdx) => onRemoveLessonSupplement(lIdx, cnIdx)
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          {(chapter.supplements?.length ?? 0) > 0 && (
            <div className="mt-3 space-y-2.5">
              {chapter.supplements!.map((cn, cnIdx) => (
                <SupplementEditorCard
                  key={cn.id}
                  node={cn}
                  placement="chapter"
                  positionTag={formatChapterSupplementTag(chapterOrder, cnIdx + 1)}
                  derivedId={
                    derivedSupplementIds[cnIdx] ??
                    deriveChapterSupplementId(
                      courseCode,
                      chapterOrder,
                      cnIdx + 1,
                      cn.title || `Child Supplement ${cnIdx + 1}`
                    )
                  }
                  courseCode={courseCode}
                  allChapters={allChapters}
                  allSpineSupplements={allSpineSupplements}
                  isExpanded={Boolean(expandedSupplements[cn.id])}
                  errorPrefix={`${chapterPrefix}.supplements.${cnIdx}`}
                  fieldErrors={fieldErrors}
                  onToggleExpand={() => onToggleSupplementExpand?.(cn.id)}
                  onUpdate={(updater) =>
                    onUpdateChapterSupplement?.(cnIdx, (prev) => updater(prev) as Supplement)
                  }
                  onRemove={() => onRemoveChapterSupplement?.(cnIdx)}
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-3">
            <button
              type="button"
              onClick={onAddLesson}
              className="dashed-box inline-flex items-center gap-1.5 rounded-md bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--tag-peach-text)] transition-colors hover:border-[var(--tag-peach-border)] hover:bg-[var(--tag-peach-bg)]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Sub-Lesson to Chapter {chapterOrder}
            </button>
            {onAddChapterSupplement && (
              <button
                type="button"
                onClick={onAddChapterSupplement}
                className="dashed-box inline-flex items-center gap-1.5 rounded-md bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--tag-teal-text)] transition-colors hover:border-[var(--tag-teal-border)] hover:bg-[var(--tag-teal-bg)]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Child Supplement to Chapter {chapterOrder}
              </button>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
