import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  FileEdit,
  GitFork,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCourses } from '@/store/useCourseStore';
import { useProgress } from '@/store/useProgressStore';
import {
  deriveChapterId,
  deriveCoursePrefix,
  deriveCourseSlug,
  deriveLessonId,
  rekeyCourseContentIds,
} from '@/lib/courseIds';
import { layoutCourseTree } from '@/lib/layoutTree';
import { CourseTreeCanvas } from '@/components/CourseTreeCanvas';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EditorStickyBar } from '@/components/editor/EditorStickyBar';
import { ChapterEditorCard } from '@/components/editor/ChapterEditorCard';
import { ImportCourseDialog } from '@/components/editor/ImportCourseDialog';
import {
  SEMESTER_OPTIONS,
  type Chapter,
  type CourseTree,
  type SubLesson,
} from '@/types/course';

function createBlankCourse(): CourseTree {
  const code = 'CS101';
  const title = 'New College Course';
  return {
    slug: deriveCourseSlug(code, title),
    code,
    title,
    department: 'Preparatory',
    semester: undefined,
    credits: 3,
    description: 'Course overview and learning outcomes.',
    chapters: [
      {
        id: deriveChapterId(code, 1, '1. Foundations'),
        order: 1,
        title: '1. Foundations',
        weekRange: 'Weeks 1–3',
        description: 'Core introductory concepts for this course.',
        lessons: [
          {
            id: deriveLessonId(code, 'Course Introduction'),
            title: 'Course Introduction',
            summary: 'Key terminology, setup, and roadmap for the semester.',
            side: 'left',
            resources: [],
          },
        ],
      },
    ],
  };
}

export function CourseEditorPage() {
  const { slug } = useParams();
  const isEditing = Boolean(slug);
  const navigate = useNavigate();
  const { courses, getCourseBySlug, addCourse, updateCourse, deleteCourse } = useCourses();
  const { remapCourseProgress, forgetCourse } = useProgress();

  const existingCourse = slug ? getCourseBySlug(slug) : undefined;

  const [draft, setDraft] = useState<CourseTree>(() =>
    existingCourse ? structuredClone(existingCourse) : createBlankCourse()
  );
  const [slugTouched, setSlugTouched] = useState<boolean>(isEditing);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [expandedLessons, setExpandedLessons] = useState<Record<string, boolean>>(() => {
    const firstLessonId = (existingCourse ?? createBlankCourse()).chapters[0]?.lessons[0]?.id;
    return firstLessonId ? { [firstLessonId]: true } : {};
  });
  const [focusedChapterId, setFocusedChapterId] = useState<string | null>(null);
  const [focusedLessonId, setFocusedLessonId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importBanner, setImportBanner] = useState<{ warnings: string[] } | null>(null);

  const editorRegionRef = useRef<HTMLDivElement | null>(null);
  const prevRouteSlugRef = useRef<string | undefined>(slug);

  useEffect(() => {
    if (prevRouteSlugRef.current === slug) return;
    prevRouteSlugRef.current = slug;

    const targetCourse = slug ? getCourseBySlug(slug) : undefined;
    const nextDraft = targetCourse ? structuredClone(targetCourse) : createBlankCourse();
    setDraft(nextDraft);
    setSlugTouched(Boolean(slug));
    const firstLessonId = nextDraft.chapters[0]?.lessons[0]?.id;
    setExpandedLessons(firstLessonId ? { [firstLessonId]: true } : {});
    setFocusedChapterId(null);
    setFocusedLessonId(null);
    setErrorMsg(null);
    setImportBanner(null);
    setConfirmDeleteOpen(false);
    setImportOpen(false);
  }, [slug, getCourseBySlug]);

  const updateFocusContextFromTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return;
    if (target.closest('[data-testid="editor-sticky-bar"]')) return;

    const lessonEl = target.closest('[data-edit-lesson]') as HTMLElement | null;
    const chapterEl = target.closest('[data-edit-chapter]') as HTMLElement | null;

    if (chapterEl) {
      setFocusedChapterId(chapterEl.dataset.editChapter ?? null);
      setFocusedLessonId(lessonEl?.dataset.editLesson ?? null);
    } else if (target.closest('[data-edit-metadata]')) {
      setFocusedChapterId(null);
      setFocusedLessonId(null);
    }
  };

  useEffect(() => {
    const node = editorRegionRef.current;
    if (!node) return;
    const handleFocusIn = (e: FocusEvent) => {
      updateFocusContextFromTarget(e.target);
    };
    node.addEventListener('focusin', handleFocusIn);
    return () => node.removeEventListener('focusin', handleFocusIn);
  }, []);

  const normalizedPreviewCourse = useMemo(() => rekeyCourseContentIds(draft), [draft]);
  const previewLayout = useMemo(
    () => layoutCourseTree(normalizedPreviewCourse),
    [normalizedPreviewCourse]
  );

  const focusedChapterEntry = useMemo(() => {
    if (!focusedChapterId) return null;
    const idx = draft.chapters.findIndex((c) => c.id === focusedChapterId);
    if (idx === -1) return null;
    return { chapter: draft.chapters[idx], order: idx + 1 };
  }, [draft.chapters, focusedChapterId]);

  const focusedLessonEntry = useMemo(() => {
    if (!focusedChapterEntry || !focusedLessonId) return null;
    return (
      focusedChapterEntry.chapter.lessons.find((l) => l.id === focusedLessonId) ?? null
    );
  }, [focusedChapterEntry, focusedLessonId]);

  if (isEditing && !existingCourse) {
    return (
      <main className="min-h-[calc(100vh-64px)] bg-gray-50 px-4 py-16 dark:bg-slate-950">
        <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
          <h1 className="mb-2 text-xl font-bold text-gray-900 dark:text-slate-100">
            Course Not Found
          </h1>
          <p className="mb-5 text-sm text-gray-500 dark:text-slate-400">
            Could not find course <code className="font-mono">{slug}</code> to edit.
          </p>
          <Link
            to="/"
            className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            Back to All Courses
          </Link>
        </div>
      </main>
    );
  }

  const coursePrefix = deriveCoursePrefix(draft.code);
  const existingSlugs = courses.map((c) => c.slug);

  const updateMeta = (patch: Partial<CourseTree>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      if (!slugTouched && (patch.code !== undefined || patch.title !== undefined)) {
        next.slug = deriveCourseSlug(next.code, next.title);
      }
      return next;
    });
  };

  const updateChapter = (chapterIdx: number, updater: (ch: Chapter) => Chapter) => {
    setDraft((prev) => ({
      ...prev,
      chapters: prev.chapters.map((ch, idx) => (idx === chapterIdx ? updater(ch) : ch)),
    }));
  };

  const addChapter = () => {
    setDraft((prev) => {
      const nextOrder = prev.chapters.length + 1;
      const existingIds = new Set(
        prev.chapters.flatMap((c) => [c.id, ...c.lessons.map((l) => l.id)])
      );
      const newChapterTitle = `${nextOrder}. New Chapter`;
      const newChapterId = deriveChapterId(prev.code, nextOrder, newChapterTitle, existingIds);
      const newLessonId = deriveLessonId(prev.code, `Topic ${nextOrder}.1`, existingIds);
      const newChapter: Chapter = {
        id: newChapterId,
        order: nextOrder,
        title: newChapterTitle,
        weekRange: '',
        description: 'Chapter overview.',
        lessons: [
          {
            id: newLessonId,
            title: `Topic ${nextOrder}.1`,
            summary: 'Sub-lesson overview.',
            resources: [],
          },
        ],
      };
      setExpandedLessons((exp) => ({ ...exp, [newLessonId]: true }));
      return { ...prev, chapters: [...prev.chapters, newChapter] };
    });
  };

  const moveChapter = (chapterIdx: number, direction: -1 | 1) => {
    setDraft((prev) => {
      const target = chapterIdx + direction;
      if (target < 0 || target >= prev.chapters.length) return prev;
      const next = [...prev.chapters];
      [next[chapterIdx], next[target]] = [next[target], next[chapterIdx]];
      return {
        ...prev,
        chapters: next.map((ch, idx) => ({ ...ch, order: idx + 1 })),
      };
    });
  };

  const removeChapter = (chapterIdx: number) => {
    setDraft((prev) => {
      if (prev.chapters.length <= 1) {
        setErrorMsg('A course must have at least one chapter.');
        return prev;
      }
      const targetChapter = prev.chapters[chapterIdx];
      const removedIds = new Set([
        targetChapter.id,
        ...targetChapter.lessons.map((l) => l.id),
      ]);
      const filterPrereqs = (prereqs: string[] | undefined) => {
        const next = prereqs?.filter((id) => !removedIds.has(id));
        return next && next.length > 0 ? next : undefined;
      };

      const remaining = prev.chapters
        .filter((_, idx) => idx !== chapterIdx)
        .map((ch, idx) => ({
          ...ch,
          order: idx + 1,
          prerequisites: filterPrereqs(ch.prerequisites),
          lessons: ch.lessons.map((l) => ({
            ...l,
            prerequisites: filterPrereqs(l.prerequisites),
          })),
        }));
      return { ...prev, chapters: remaining };
    });
  };

  const toggleChapterPrerequisite = (chapterIdx: number, prereqId: string) => {
    updateChapter(chapterIdx, (chapter) => {
      const current = chapter.prerequisites ?? [];
      const exists = current.includes(prereqId);
      const next = exists ? current.filter((id) => id !== prereqId) : [...current, prereqId];
      return { ...chapter, prerequisites: next.length > 0 ? next : undefined };
    });
  };

  const addLesson = (chapterIdx: number) => {
    setDraft((prev) => {
      const existingIds = new Set(
        prev.chapters.flatMap((c) => [c.id, ...c.lessons.map((l) => l.id)])
      );
      const nextNum = prev.chapters[chapterIdx].lessons.length + 1;
      const title = `New Sub-Lesson ${nextNum}`;
      const newId = deriveLessonId(prev.code, title, existingIds);
      const newLesson: SubLesson = {
        id: newId,
        title,
        summary: 'Brief summary of what students will learn.',
        resources: [],
      };
      setExpandedLessons((exp) => ({ ...exp, [newId]: true }));
      return {
        ...prev,
        chapters: prev.chapters.map((ch, idx) =>
          idx === chapterIdx ? { ...ch, lessons: [...ch.lessons, newLesson] } : ch
        ),
      };
    });
  };

  const updateLesson = (
    chapterIdx: number,
    lessonIdx: number,
    updater: (lesson: SubLesson) => SubLesson
  ) => {
    updateChapter(chapterIdx, (ch) => ({
      ...ch,
      lessons: ch.lessons.map((l, idx) => (idx === lessonIdx ? updater(l) : l)),
    }));
  };

  const moveLesson = (chapterIdx: number, lessonIdx: number, direction: -1 | 1) => {
    updateChapter(chapterIdx, (ch) => {
      const target = lessonIdx + direction;
      if (target < 0 || target >= ch.lessons.length) return ch;
      const next = [...ch.lessons];
      [next[lessonIdx], next[target]] = [next[target], next[lessonIdx]];
      return { ...ch, lessons: next };
    });
  };

  const removeLesson = (chapterIdx: number, lessonIdx: number) => {
    setDraft((prev) => {
      const removedId = prev.chapters[chapterIdx].lessons[lessonIdx]?.id;
      const filterPrereqs = (prereqs: string[] | undefined) => {
        const next = prereqs?.filter((id) => id !== removedId);
        return next && next.length > 0 ? next : undefined;
      };
      return {
        ...prev,
        chapters: prev.chapters.map((ch, cIdx) => ({
          ...ch,
          prerequisites: filterPrereqs(ch.prerequisites),
          lessons: ch.lessons
            .filter((_, lIdx) => !(cIdx === chapterIdx && lIdx === lessonIdx))
            .map((l) => ({
              ...l,
              prerequisites: filterPrereqs(l.prerequisites),
            })),
        })),
      };
    });
  };

  const toggleLessonPrerequisite = (
    chapterIdx: number,
    lessonIdx: number,
    prereqId: string
  ) => {
    updateLesson(chapterIdx, lessonIdx, (lesson) => {
      const current = lesson.prerequisites ?? [];
      const exists = current.includes(prereqId);
      const next = exists ? current.filter((id) => id !== prereqId) : [...current, prereqId];
      return { ...lesson, prerequisites: next.length > 0 ? next : undefined };
    });
  };

  const handleSave = () => {
    setErrorMsg(null);

    if (isEditing && slug) {
      const result = updateCourse(slug, draft);
      if (!result.ok) {
        setErrorMsg(result.error);
        return;
      }
      remapCourseProgress(result.previousSlug, result.course.slug, result.idMap);
      navigate(`/course/${result.course.slug}`);
      return;
    }

    const result = addCourse(draft);
    if (!result.ok) {
      setErrorMsg(result.error);
      return;
    }
    navigate(`/course/${result.course.slug}`);
  };

  const handleConfirmDelete = () => {
    if (slug) {
      forgetCourse(slug);
      deleteCourse(slug);
    }
    setConfirmDeleteOpen(false);
    navigate('/');
  };

  const handleCourseImported = (imported: CourseTree, warnings: string[]) => {
    setDraft(imported);
    setSlugTouched(true);
    setErrorMsg(null);
    setFocusedChapterId(null);
    setFocusedLessonId(null);
    const firstLessonId = imported.chapters[0]?.lessons[0]?.id;
    setExpandedLessons(firstLessonId ? { [firstLessonId]: true } : {});
    setImportBanner({ warnings });
  };

  const hasExpandedLessons = Object.values(expandedLessons).some(Boolean);

  return (
    <main className="min-h-[calc(100vh-64px)] bg-gray-50 pb-16 text-gray-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Header Bar */}
      <section className="border-b border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto max-w-5xl px-4 pt-5 sm:px-6 sm:pt-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Link
              to={isEditing ? `/course/${slug}` : '/'}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-black dark:text-slate-400 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              {isEditing ? `Back to ${existingCourse?.code}` : 'All Courses'}
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import Course
                </button>
              )}

              {isEditing && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 sm:text-sm dark:border-red-900/60 dark:bg-slate-950 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Course
                </button>
              )}

              <button
                type="button"
                onClick={handleSave}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-yellow-400 px-3.5 text-xs font-semibold text-black transition-colors hover:bg-yellow-500 sm:text-sm"
              >
                <Save className="h-3.5 w-3.5" />
                Save Course
              </button>
            </div>
          </div>

          <div className="mb-5">
            <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded bg-slate-900 px-2 py-0.5 font-mono font-semibold text-white dark:bg-slate-800">
                {isEditing ? 'EDIT COURSE' : 'NEW COURSE'}
              </span>
              <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-gray-700 dark:bg-slate-800 dark:text-slate-300">
                ID Prefix: {coursePrefix}-*
              </span>
              <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                /course/{draft.slug || '...'}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-slate-100">
              {draft.title || 'Untitled Course'}
            </h1>
          </div>

          <div className="flex items-center gap-6" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'editor'}
              onClick={() => setActiveTab('editor')}
              className={`inline-flex items-center gap-1.5 border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === 'editor'
                  ? 'border-black text-black dark:border-yellow-400 dark:text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <FileEdit className="h-4 w-4" />
              Course &amp; Content Editor
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'preview'}
              onClick={() => setActiveTab('preview')}
              className={`inline-flex items-center gap-1.5 border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === 'preview'
                  ? 'border-black text-black dark:border-yellow-400 dark:text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <GitFork className="h-4 w-4" />
              Live Tree Preview
            </button>
          </div>
        </div>
      </section>

      {activeTab === 'editor' && (
        <EditorStickyBar
          courseCode={draft.code}
          focusedChapter={
            focusedChapterEntry
              ? {
                  order: focusedChapterEntry.order,
                  title: focusedChapterEntry.chapter.title,
                }
              : null
          }
          focusedLesson={
            focusedLessonEntry ? { title: focusedLessonEntry.title } : null
          }
          hasExpandedLessons={hasExpandedLessons}
          onCollapseAll={() => {
            setExpandedLessons({});
            setFocusedLessonId(null);
          }}
          onSave={handleSave}
        />
      )}

      <div
        ref={editorRegionRef}
        onFocusCapture={(e) => updateFocusContextFromTarget(e.target)}
        onClickCapture={(e) => updateFocusContextFromTarget(e.target)}
        className="mx-auto max-w-5xl px-4 py-6 sm:px-6"
      >
        {importBanner && (
          <div
            role="status"
            className="mb-5 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 dark:border-yellow-700/70 dark:bg-yellow-950/40 dark:text-yellow-200"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Imported — review and click Save</p>
                  {importBanner.warnings.length > 0 && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                      {importBanner.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportBanner(null)}
                aria-label="Dismiss import notice"
                className="rounded p-1 hover:bg-yellow-200/60 dark:hover:bg-yellow-900/50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="mb-5 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {activeTab === 'preview' ? (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2 text-xs text-gray-500 dark:border-slate-800 dark:text-slate-400">
              <span>
                Live SVG layout preview — all chapter and lesson IDs auto-derived with prefix{' '}
                <code className="rounded bg-gray-100 px-1 font-mono text-gray-800 dark:bg-slate-800 dark:text-slate-200">
                  {coursePrefix}-
                </code>
              </span>
              <span>
                {normalizedPreviewCourse.chapters.length} chapters ·{' '}
                {normalizedPreviewCourse.chapters.reduce((s, c) => s + c.lessons.length, 0)}{' '}
                lessons
              </span>
            </div>
            <CourseTreeCanvas
              layout={previewLayout}
              statuses={{}}
              onSelectLesson={() => {}}
              onQuickToggleDone={() => {}}
              onContextMenuLesson={() => {}}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. Course Metadata Card */}
            <section
              data-edit-metadata="true"
              className="rounded-lg border border-gray-200 bg-white p-5 shadow-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <h2 className="mb-4 text-sm font-bold tracking-wide text-gray-700 uppercase dark:text-slate-300">
                Course Metadata
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="course-code"
                    className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300"
                  >
                    Course Code *
                  </label>
                  <input
                    id="course-code"
                    type="text"
                    value={draft.code}
                    onChange={(e) => updateMeta({ code: e.target.value })}
                    placeholder="e.g. MATH201"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="course-title"
                    className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300"
                  >
                    Course Title *
                  </label>
                  <input
                    id="course-title"
                    type="text"
                    value={draft.title}
                    onChange={(e) => updateMeta({ title: e.target.value })}
                    placeholder="e.g. Linear Algebra"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="course-dept"
                    className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300"
                  >
                    Department *
                  </label>
                  <input
                    id="course-dept"
                    type="text"
                    value={draft.department}
                    onChange={(e) => updateMeta({ department: e.target.value })}
                    placeholder="e.g. Preparatory"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="course-semester"
                    className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300"
                  >
                    Semester
                  </label>
                  <select
                    id="course-semester"
                    value={draft.semester ?? ''}
                    onChange={(e) =>
                      updateMeta({
                        semester: (e.target.value || undefined) as CourseTree['semester'],
                      })
                    }
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="">— Not scheduled —</option>
                    {SEMESTER_OPTIONS.map((sem) => (
                      <option key={sem} value={sem}>
                        {sem}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="course-credits"
                    className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300"
                  >
                    Credits
                  </label>
                  <input
                    id="course-credits"
                    type="number"
                    min={1}
                    max={12}
                    value={draft.credits ?? ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      updateMeta({
                        credits: Number.isFinite(val) && val > 0 ? val : undefined,
                      });
                    }}
                    placeholder="3"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label
                    htmlFor="course-slug"
                    className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300"
                  >
                    URL Slug * (auto-derived from code + title)
                  </label>
                  <input
                    id="course-slug"
                    type="text"
                    value={draft.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      updateMeta({
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                      });
                    }}
                    className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 font-mono text-xs text-gray-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:bg-slate-950"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label
                    htmlFor="course-desc"
                    className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300"
                  >
                    Course Description *
                  </label>
                  <textarea
                    id="course-desc"
                    rows={2}
                    value={draft.description}
                    onChange={(e) => updateMeta({ description: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>
            </section>

            {/* 2. Chapters & Sub-Lessons Builder */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold tracking-wide text-gray-700 uppercase dark:text-slate-300">
                  Chapters &amp; Sub-Lessons ({draft.chapters.length} chapters)
                </h2>
                <button
                  type="button"
                  onClick={addChapter}
                  className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Chapter
                </button>
              </div>

              {draft.chapters.map((chapter, cIdx) => {
                const derivedChapter = normalizedPreviewCourse.chapters[cIdx];
                const derivedChapterId = derivedChapter?.id ?? chapter.id;
                const derivedLessonIds =
                  derivedChapter?.lessons.map((l) => l.id) ??
                  chapter.lessons.map((l) => l.id);

                return (
                  <ChapterEditorCard
                    key={chapter.id}
                    chapter={chapter}
                    chapterIndex={cIdx}
                    totalChapters={draft.chapters.length}
                    derivedChapterId={derivedChapterId}
                    derivedLessonIds={derivedLessonIds}
                    courseCode={draft.code}
                    allChapters={draft.chapters}
                    expandedLessons={expandedLessons}
                    onToggleLessonExpand={(lessonId) =>
                      setExpandedLessons((prev) => ({
                        ...prev,
                        [lessonId]: !prev[lessonId],
                      }))
                    }
                    onUpdateChapter={(updater) => updateChapter(cIdx, updater)}
                    onMoveChapter={(dir) => moveChapter(cIdx, dir)}
                    onRemoveChapter={() => removeChapter(cIdx)}
                    onToggleChapterPrerequisite={(prereqId) =>
                      toggleChapterPrerequisite(cIdx, prereqId)
                    }
                    onAddLesson={() => addLesson(cIdx)}
                    onUpdateLesson={(lIdx, updater) => updateLesson(cIdx, lIdx, updater)}
                    onMoveLesson={(lIdx, dir) => moveLesson(cIdx, lIdx, dir)}
                    onRemoveLesson={(lIdx) => removeLesson(cIdx, lIdx)}
                    onToggleLessonPrerequisite={(lIdx, prereqId) =>
                      toggleLessonPrerequisite(cIdx, lIdx, prereqId)
                    }
                  />
                );
              })}
            </section>
          </div>
        )}
      </div>

      <ImportCourseDialog
        open={importOpen}
        existingSlugs={existingSlugs}
        onImported={handleCourseImported}
        onClose={() => setImportOpen(false)}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={`Delete ${draft.code}: ${draft.title}?`}
        description="This removes the course and all its chapters and sub-lessons from your catalog. You can restore the default sample courses anytime from the catalog page."
        confirmLabel="Delete Course"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </main>
  );
}
