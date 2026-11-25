import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Sparkles, X, BookOpen, GitFork, Layers } from 'lucide-react';
import { useCourses } from '@/store/useCourseStore';
import { useNavigationGuard } from '@/context/NavigationGuardContext';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import { formatCourseTerm } from '@/types/course';

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

interface SearchHit {
  key: string;
  kind: 'course' | 'chapter' | 'lesson' | 'supplement';
  title: string;
  subtitle: string;
  to: string;
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const { courses } = useCourses();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { navigateWithGuard } = useNavigationGuard();

  useDialogFocus({
    isOpen: open,
    containerRef: dialogRef,
    initialFocusRef: inputRef,
    onEscape: onClose,
  });

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  const results = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    const courseHits: SearchHit[] = [];
    const chapterHits: SearchHit[] = [];
    const lessonHits: SearchHit[] = [];
    const supplementHits: SearchHit[] = [];

    for (const course of courses) {
      const termLabel = formatCourseTerm(course);
      const courseMatches =
        !q ||
        course.title.toLowerCase().includes(q) ||
        course.code.toLowerCase().includes(q) ||
        course.department.toLowerCase().includes(q) ||
        course.description.toLowerCase().includes(q) ||
        (termLabel?.toLowerCase().includes(q) ?? false);

      const courseMeta = `${course.code} · ${course.department}${
        termLabel ? ` · ${termLabel}` : ''
      }`;

      if (courseMatches) {
        courseHits.push({
          key: `course-${course.slug}`,
          kind: 'course',
          title: `${course.code}: ${course.title}`,
          subtitle: `${course.department}${termLabel ? ` · ${termLabel}` : ''} · ${course.chapters.length} chapters`,
          to: `/course/${course.slug}`,
        });
      }

      if (q) {
        for (const chapter of course.chapters) {
          const chapterMatches =
            chapter.title.toLowerCase().includes(q) ||
            chapter.description.toLowerCase().includes(q) ||
            (chapter.notes?.toLowerCase().includes(q) ?? false) ||
            course.department.toLowerCase().includes(q);

          if (chapterMatches) {
            chapterHits.push({
              key: `chapter-${course.slug}-${chapter.id}`,
              kind: 'chapter',
              title: chapter.title,
              subtitle: courseMeta,
              to: `/course/${course.slug}?chapter=${chapter.id}`,
            });
          }

          for (const lesson of chapter.lessons) {
            if (
              lesson.title.toLowerCase().includes(q) ||
              lesson.summary.toLowerCase().includes(q) ||
              (lesson.notes?.toLowerCase().includes(q) ?? false) ||
              chapter.title.toLowerCase().includes(q) ||
              course.department.toLowerCase().includes(q)
            ) {
              lessonHits.push({
                key: `lesson-${course.slug}-${lesson.id}`,
                kind: 'lesson',
                title: lesson.title,
                subtitle: `${course.code} · ${course.department} › ${chapter.title}`,
                to: `/course/${course.slug}?lesson=${lesson.id}`,
              });
            }

            for (const cn of lesson.supplements ?? []) {
              if (
                cn.title.toLowerCase().includes(q) ||
                cn.summary.toLowerCase().includes(q) ||
                (cn.notes?.toLowerCase().includes(q) ?? false) ||
                lesson.title.toLowerCase().includes(q) ||
                chapter.title.toLowerCase().includes(q) ||
                course.department.toLowerCase().includes(q)
              ) {
                supplementHits.push({
                  key: `supplement-${course.slug}-${cn.id}`,
                  kind: 'supplement',
                  title: cn.title,
                  subtitle: `${course.code} · ${chapter.title} › ${lesson.title}`,
                  to: `/course/${course.slug}?supplement=${cn.id}`,
                });
              }
            }
          }

          for (const cn of chapter.supplements ?? []) {
            if (
              cn.title.toLowerCase().includes(q) ||
              cn.summary.toLowerCase().includes(q) ||
              (cn.notes?.toLowerCase().includes(q) ?? false) ||
              chapter.title.toLowerCase().includes(q) ||
              course.department.toLowerCase().includes(q)
            ) {
              supplementHits.push({
                key: `supplement-${course.slug}-${cn.id}`,
                kind: 'supplement',
                title: cn.title,
                subtitle: `${course.code} · ${chapter.title}`,
                to: `/course/${course.slug}?supplement=${cn.id}`,
              });
            }
          }
        }

        for (const scn of course.supplements ?? []) {
          if (
            scn.title.toLowerCase().includes(q) ||
            scn.summary.toLowerCase().includes(q) ||
            (scn.notes?.toLowerCase().includes(q) ?? false) ||
            course.department.toLowerCase().includes(q)
          ) {
            supplementHits.push({
              key: `supplement-${course.slug}-${scn.id}`,
              kind: 'supplement',
              title: scn.title,
              subtitle: `${course.code} · Supplement`,
              to: `/course/${course.slug}?supplement=${scn.id}`,
            });
          }
          for (const child of scn.children ?? []) {
            if (
              child.title.toLowerCase().includes(q) ||
              child.summary.toLowerCase().includes(q) ||
              (child.notes?.toLowerCase().includes(q) ?? false) ||
              scn.title.toLowerCase().includes(q) ||
              course.department.toLowerCase().includes(q)
            ) {
              supplementHits.push({
                key: `supplement-${course.slug}-${child.id}`,
                kind: 'supplement',
                title: child.title,
                subtitle: `${course.code} · ${scn.title}`,
                to: `/course/${course.slug}?supplement=${child.id}`,
              });
            }
          }
        }
      }
    }

    return [...courseHits, ...chapterHits, ...lessonHits, ...supplementHits].slice(0, 18);
  }, [query, courses]);

  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  useEffect(() => {
    const activeEl = itemRefs.current[activeIndex];
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  if (!open) return null;

  const handleSelect = (to: string) => {
    onClose();
    navigateWithGuard(to);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      const chosen = results[activeIndex] ?? results[0];
      if (chosen) {
        e.preventDefault();
        handleSelect(chosen.to);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--backdrop-modal)] px-4 pt-20"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search courses, chapters, and lessons"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--text-primary)] shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3.5 py-3 focus-within:ring-2 focus-within:ring-[var(--border-focus)] focus-within:ring-inset">
          <Search className="h-4 w-4 text-[var(--text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search courses, departments, chapters, or lessons..."
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          <div className="sr-only" role="status" aria-live="polite">
            {results.length === 0
              ? 'No matching courses, chapters, or lessons found.'
              : `${results.length} result${results.length === 1 ? '' : 's'} available.`}
          </div>
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">
              No matching courses, chapters, or lessons found.
            </p>
          ) : (
            <ul className="space-y-1">
              {results.map((hit, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <li key={hit.key}>
                    <button
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
                      type="button"
                      onClick={() => handleSelect(hit.to)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      data-active={isActive ? 'true' : undefined}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                        isActive
                          ? 'bg-[var(--surface-hover)]'
                          : 'hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      {hit.kind === 'course' ? (
                        <GitFork className="h-4 w-4 shrink-0 text-[var(--accent-purple)]" />
                      ) : hit.kind === 'chapter' ? (
                        <Layers className="h-4 w-4 shrink-0 text-[var(--accent-amber)]" />
                      ) : hit.kind === 'supplement' ? (
                        <Sparkles className="h-4 w-4 shrink-0 text-[var(--accent-teal)]" />
                      ) : (
                        <BookOpen className="h-4 w-4 shrink-0 text-[var(--accent-peach)]" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {hit.title}
                        </div>
                        <div className="truncate text-xs text-[var(--text-secondary)]">
                          {hit.subtitle}
                        </div>
                      </div>
                      <span className="rounded bg-[var(--surface-warm-muted)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)] capitalize">
                        {hit.kind}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
