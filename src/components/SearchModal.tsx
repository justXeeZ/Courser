import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, BookOpen, GitFork, Layers } from 'lucide-react';
import { useCourses } from '@/store/useCourseStore';
import { formatCourseTerm } from '@/types/course';

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

interface SearchHit {
  key: string;
  kind: 'course' | 'chapter' | 'lesson';
  title: string;
  subtitle: string;
  to: string;
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const { courses } = useCourses();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const results = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    const courseHits: SearchHit[] = [];
    const chapterHits: SearchHit[] = [];
    const lessonHits: SearchHit[] = [];

    for (const course of courses) {
      const termLabel = formatCourseTerm(course);
      const courseMatches =
        !q ||
        course.title.toLowerCase().includes(q) ||
        course.code.toLowerCase().includes(q) ||
        course.department.toLowerCase().includes(q) ||
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
          }
        }
      }
    }

    return [...courseHits, ...chapterHits, ...lessonHits].slice(0, 18);
  }, [query, courses]);

  if (!open) return null;

  const handleSelect = (to: string) => {
    navigate(to);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-20 dark:bg-black/70"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search courses, chapters, and lessons"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-700/80 dark:bg-[#121926] dark:text-slate-100"
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-3.5 py-3 dark:border-slate-700/80">
          <Search className="h-4 w-4 text-slate-400 dark:text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses, departments, chapters, or lessons..."
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder-slate-500"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#1b2436] dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
              No matching courses, chapters, or lessons found.
            </p>
          ) : (
            <ul className="space-y-1">
              {results.map((hit) => (
                <li key={hit.key}>
                  <button
                    type="button"
                    onClick={() => handleSelect(hit.to)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-100 dark:hover:bg-[#1b2436]"
                  >
                    {hit.kind === 'course' ? (
                      <GitFork className="h-4 w-4 shrink-0 text-amber-600 dark:text-yellow-400" />
                    ) : hit.kind === 'chapter' ? (
                      <Layers className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                    ) : (
                      <BookOpen className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {hit.title}
                      </div>
                      <div className="truncate text-xs text-slate-600 dark:text-slate-400">
                        {hit.subtitle}
                      </div>
                    </div>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 capitalize dark:bg-[#1b2436] dark:text-slate-300">
                      {hit.kind}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
