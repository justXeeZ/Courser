import { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Ban,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  GitBranch,
} from 'lucide-react';
import type { Chapter, CourseTree, LessonStatus, SubLesson } from '@/types/course';
import { findLessonWithChapter, getAllLessons } from '@/data/validateCourse';
import { ResourceBadge } from '@/components/ResourceBadge';

interface LessonDrawerProps {
  course: CourseTree;
  chapter: Chapter;
  lesson: SubLesson;
  status: LessonStatus;
  statuses: Record<string, LessonStatus>;
  onChangeStatus: (status: LessonStatus) => void;
  onNavigateLesson: (lessonId: string) => void;
  onClose: () => void;
}

export function LessonDrawer({
  course,
  chapter,
  lesson,
  status,
  statuses,
  onChangeStatus,
  onNavigateLesson,
  onClose,
}: LessonDrawerProps) {
  const [activeTab, setActiveTab] = useState<'resources' | 'notes'>('resources');

  const allLessons = getAllLessons(course);
  const currentIndex = allLessons.findIndex((item) => item.lesson.id === lesson.id);
  const prevItem = currentIndex > 0 ? allLessons[currentIndex - 1] : undefined;
  const nextItem =
    currentIndex >= 0 && currentIndex < allLessons.length - 1
      ? allLessons[currentIndex + 1]
      : undefined;

  useEffect(() => {
    setActiveTab('resources');
  }, [lesson.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'l' || e.key === 'L') {
        onChangeStatus(status === 'learning' ? 'todo' : 'learning');
      } else if (e.key === 'd' || e.key === 'D') {
        onChangeStatus(status === 'done' ? 'todo' : 'done');
      } else if (e.key === 's' || e.key === 'S') {
        onChangeStatus(status === 'skipped' ? 'todo' : 'skipped');
      } else if (e.key === 'ArrowLeft' && prevItem) {
        onNavigateLesson(prevItem.lesson.id);
      } else if (e.key === 'ArrowRight' && nextItem) {
        onNavigateLesson(nextItem.lesson.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, prevItem, nextItem, onChangeStatus, onNavigateLesson, onClose]);

  const toggleStatus = (target: LessonStatus) => {
    onChangeStatus(status === target ? 'todo' : target);
  };

  const prereqItems = (lesson.prerequisites ?? [])
    .map((id) => findLessonWithChapter(course, id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-gray-900/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 600px Slide-Over Panel (exact roadmap.sh width & layout) */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={lesson.title}
        className="fixed top-0 right-0 z-40 flex h-screen w-full flex-col overflow-y-auto bg-white p-4 text-gray-900 shadow-2xl focus:outline-0 sm:max-w-[600px] sm:p-6"
      >
        {/* Top Header Row: Left tabs + Right segmented status + Close X */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-4">
          <div className="flex items-center gap-1.5" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'resources'}
              onClick={() => setActiveTab('resources')}
              className={`rounded-md border px-2.5 py-1 text-sm font-medium transition-colors ${
                activeTab === 'resources'
                  ? 'border-black bg-black text-white'
                  : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              Resources
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'notes'}
              onClick={() => setActiveTab('notes')}
              className={`rounded-md border px-2.5 py-1 text-sm font-medium transition-colors ${
                activeTab === 'notes'
                  ? 'border-black bg-black text-white'
                  : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              Study Notes
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Segmented status bar */}
            <div className="inline-flex h-8 items-center overflow-hidden rounded-md border border-gray-300 bg-white">
              <button
                type="button"
                title="Learning (L)"
                aria-pressed={status === 'learning'}
                onClick={() => toggleStatus('learning')}
                className={`inline-flex h-full items-center gap-1 px-2.5 text-xs font-medium transition-colors hover:bg-gray-100 ${
                  status === 'learning' ? 'bg-violet-100 text-violet-900' : 'text-gray-700'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5 text-violet-600" />
                Learning
              </button>
              <button
                type="button"
                title="Done (D)"
                aria-pressed={status === 'done'}
                onClick={() => toggleStatus('done')}
                className={`inline-flex h-full items-center gap-1 border-l border-gray-300 px-2.5 text-xs font-medium transition-colors hover:bg-gray-100 ${
                  status === 'done' ? 'bg-green-100 text-green-900' : 'text-gray-700'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                Done
              </button>
              <button
                type="button"
                title="Skip (S)"
                aria-pressed={status === 'skipped'}
                onClick={() => toggleStatus('skipped')}
                className={`inline-flex h-full items-center gap-1 border-l border-gray-300 px-2 text-xs font-medium transition-colors hover:bg-gray-100 ${
                  status === 'skipped' ? 'bg-teal-100 text-teal-900' : 'text-gray-600'
                }`}
              >
                <Ban className="h-3.5 w-3.5 text-teal-700" />
                Skip
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close lesson drawer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200 text-black transition-colors hover:bg-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 py-5">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="font-semibold text-gray-700">{course.code}</span>
            <span>/</span>
            <span>{chapter.title}</span>
            {chapter.weekRange && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">
                {chapter.weekRange}
              </span>
            )}
          </div>

          <h2 className="mb-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            {lesson.title}
          </h2>

          <p className="mb-5 text-sm leading-relaxed text-gray-700 sm:text-base">
            {lesson.summary}
          </p>

          {/* Prerequisites */}
          {prereqItems.length > 0 && (
            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-gray-600 uppercase">
                <GitBranch className="h-3.5 w-3.5 text-blue-600" />
                Recommended Prerequisites
              </div>
              <div className="flex flex-wrap gap-1.5">
                {prereqItems.map((item) => {
                  const pStatus = statuses[item.lesson.id] ?? 'todo';
                  return (
                    <button
                      key={item.lesson.id}
                      type="button"
                      onClick={() => onNavigateLesson(item.lesson.id)}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:border-blue-500 ${
                        pStatus === 'done'
                          ? 'border-green-300 bg-green-50 text-green-800'
                          : 'border-gray-300 bg-white text-gray-800'
                      }`}
                    >
                      {pStatus === 'done' && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                      {item.lesson.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'resources' ? (
            <div>
              <h3 className="mb-3 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                Course Materials &amp; Resources
              </h3>
              {lesson.resources.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                  No resources linked for this sub-lesson yet.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {lesson.resources.map((res, idx) => (
                    <li key={`${res.url ?? res.file?.id ?? res.title}-${idx}`}>
                      <a
                        href={res.url ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start gap-2.5 rounded-md border border-transparent p-1.5 transition-colors hover:border-gray-200 hover:bg-gray-50"
                      >
                        <ResourceBadge kind={res.kind} />
                        <span className="flex-1 text-sm font-medium text-gray-900 underline decoration-gray-300 underline-offset-2 group-hover:text-blue-700 group-hover:decoration-blue-500">
                          {res.title}
                        </span>
                        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400 group-hover:text-blue-600" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 bg-amber-50/50 p-4">
                <h3 className="mb-2 text-xs font-semibold tracking-wider text-gray-600 uppercase">
                  Key Study Notes
                </h3>
                {lesson.notes ? (
                  <div className="whitespace-pre-line text-sm leading-relaxed text-gray-800">
                    {lesson.notes}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    Review the linked lecture slides and textbook chapters for detailed proofs and worked examples.
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="mb-1 text-xs font-semibold tracking-wider text-gray-600 uppercase">
                  About {chapter.title}
                </h3>
                <p className="text-sm text-gray-700">{chapter.description}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer: Prev / Next Lesson + Shortcuts hint */}
        <div className="mt-auto border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={!prevItem}
              onClick={() => prevItem && onNavigateLesson(prevItem.lesson.id)}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {prevItem ? prevItem.lesson.title : 'Start of course'}
            </button>
            <button
              type="button"
              disabled={!nextItem}
              onClick={() => nextItem && onNavigateLesson(nextItem.lesson.id)}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {nextItem ? nextItem.lesson.title : 'End of course'}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-2.5 text-center text-xs text-gray-400">
            Shortcuts: <kbd className="rounded bg-gray-100 px-1 text-gray-600">L</kbd> Learning ·{' '}
            <kbd className="rounded bg-gray-100 px-1 text-gray-600">D</kbd> Done ·{' '}
            <kbd className="rounded bg-gray-100 px-1 text-gray-600">S</kbd> Skip ·{' '}
            <kbd className="rounded bg-gray-100 px-1 text-gray-600">←/→</kbd> Prev/Next ·{' '}
            <kbd className="rounded bg-gray-100 px-1 text-gray-600">Esc</kbd> Close
          </p>
        </div>
      </aside>
    </>
  );
}
