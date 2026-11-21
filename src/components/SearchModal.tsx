import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, BookOpen, GitFork, Layers } from 'lucide-react';
import { useCourses } from '@/store/useCourseStore';

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
      const courseMatches =
        !q ||
        course.title.toLowerCase().includes(q) ||
        course.code.toLowerCase().includes(q) ||
        course.department.toLowerCase().includes(q) ||
        (course.semester?.toLowerCase().includes(q) ?? false);

      const courseMeta = `${course.code} · ${course.department}${
        course.semester ? ` · ${course.semester}` : ''
      }`;

      if (courseMatches) {
        courseHits.push({
          key: `course-${course.slug}`,
          kind: 'course',
          title: `${course.code}: ${course.title}`,
          subtitle: `${course.department}${course.semester ? ` · ${course.semester}` : ''} · ${course.chapters.length} chapters`,
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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-20"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search courses, chapters, and lessons"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-white shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-slate-800 px-3.5 py-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses, departments, chapters, or lessons..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-slate-400">
              No matching courses, chapters, or lessons found.
            </p>
          ) : (
            <ul className="space-y-1">
              {results.map((hit) => (
                <li key={hit.key}>
                  <button
                    type="button"
                    onClick={() => handleSelect(hit.to)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-800"
                  >
                    {hit.kind === 'course' ? (
                      <GitFork className="h-4 w-4 shrink-0 text-yellow-400" />
                    ) : hit.kind === 'chapter' ? (
                      <Layers className="h-4 w-4 shrink-0 text-amber-300" />
                    ) : (
                      <BookOpen className="h-4 w-4 shrink-0 text-blue-400" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-100">
                        {hit.title}
                      </div>
                      <div className="truncate text-xs text-slate-400">{hit.subtitle}</div>
                    </div>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-400 capitalize">
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
