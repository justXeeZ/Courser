import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  GitFork,
  FileEdit,
  Link2,
} from 'lucide-react';
import { useCourses } from '@/store/useCourseStore';
import {
  deriveChapterId,
  deriveCoursePrefix,
  deriveCourseSlug,
  deriveLessonId,
  rekeyCourseContentIds,
} from '@/lib/courseIds';
import { layoutCourseTree } from '@/lib/layoutTree';
import { RESOURCE_BADGE_STYLES } from '@/lib/theme';
import { CourseTreeCanvas } from '@/components/CourseTreeCanvas';
import { ResourceBadge } from '@/components/ResourceBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { Chapter, CourseTree, LessonResource, ResourceKind, SubLesson } from '@/types/course';

const RESOURCE_KINDS = Object.keys(RESOURCE_BADGE_STYLES) as ResourceKind[];

function createBlankCourse(): CourseTree {
  const code = 'CS101';
  const title = 'New College Course';
  return {
    slug: deriveCourseSlug(code, title),
    code,
    title,
    department: 'Computer Science',
    semester: 'Year 1 · Fall',
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
            estimatedMinutes: 30,
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
  const { getCourseBySlug, addCourse, updateCourse, deleteCourse } = useCourses();

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const normalizedPreviewCourse = useMemo(() => rekeyCourseContentIds(draft), [draft]);
  const previewLayout = useMemo(
    () => layoutCourseTree(normalizedPreviewCourse),
    [normalizedPreviewCourse]
  );

  if (isEditing && !existingCourse) {
    return (
      <main className="min-h-[calc(100vh-64px)] bg-gray-50 px-4 py-16">
        <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center">
          <h1 className="mb-2 text-xl font-bold text-gray-900">Course Not Found</h1>
          <p className="mb-5 text-sm text-gray-500">
            Could not find course <code className="font-mono">{slug}</code> to edit.
          </p>
          <Link
            to="/"
            className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Back to All Courses
          </Link>
        </div>
      </main>
    );
  }

  const coursePrefix = deriveCoursePrefix(draft.code);

  const allLessonRefs = draft.chapters.flatMap((ch) =>
    ch.lessons.map((l) => ({ id: l.id, title: l.title, chapterTitle: ch.title }))
  );

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
      const existingChIds = new Set(prev.chapters.map((c) => c.id));
      const existingLessonIds = new Set(prev.chapters.flatMap((c) => c.lessons.map((l) => l.id)));
      const newChapterTitle = `${nextOrder}. New Chapter`;
      const newLessonId = deriveLessonId(prev.code, `Topic ${nextOrder}.1`, existingLessonIds);
      const newChapter: Chapter = {
        id: deriveChapterId(prev.code, nextOrder, newChapterTitle, existingChIds),
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
      const removedIds = new Set(prev.chapters[chapterIdx].lessons.map((l) => l.id));
      const remaining = prev.chapters
        .filter((_, idx) => idx !== chapterIdx)
        .map((ch, idx) => ({
          ...ch,
          order: idx + 1,
          lessons: ch.lessons.map((l) => ({
            ...l,
            prerequisites: l.prerequisites?.filter((id) => !removedIds.has(id)),
          })),
        }));
      return { ...prev, chapters: remaining };
    });
  };

  const addLesson = (chapterIdx: number) => {
    setDraft((prev) => {
      const existingIds = new Set(prev.chapters.flatMap((c) => c.lessons.map((l) => l.id)));
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
      return {
        ...prev,
        chapters: prev.chapters.map((ch, cIdx) => ({
          ...ch,
          lessons: ch.lessons
            .filter((_, lIdx) => !(cIdx === chapterIdx && lIdx === lessonIdx))
            .map((l) => ({
              ...l,
              prerequisites: l.prerequisites?.filter((id) => id !== removedId),
            })),
        })),
      };
    });
  };

  const togglePrerequisite = (chapterIdx: number, lessonIdx: number, prereqId: string) => {
    updateLesson(chapterIdx, lessonIdx, (lesson) => {
      const current = lesson.prerequisites ?? [];
      const exists = current.includes(prereqId);
      const next = exists ? current.filter((id) => id !== prereqId) : [...current, prereqId];
      return { ...lesson, prerequisites: next.length > 0 ? next : undefined };
    });
  };

  const addResource = (chapterIdx: number, lessonIdx: number) => {
    const newRes: LessonResource = {
      title: 'Lecture Slides',
      url: 'https://example.edu/resource',
      kind: 'slides',
    };
    updateLesson(chapterIdx, lessonIdx, (lesson) => ({
      ...lesson,
      resources: [...lesson.resources, newRes],
    }));
  };

  const updateResource = (
    chapterIdx: number,
    lessonIdx: number,
    resIdx: number,
    patch: Partial<LessonResource>
  ) => {
    updateLesson(chapterIdx, lessonIdx, (lesson) => ({
      ...lesson,
      resources: lesson.resources.map((r, idx) => (idx === resIdx ? { ...r, ...patch } : r)),
    }));
  };

  const removeResource = (chapterIdx: number, lessonIdx: number, resIdx: number) => {
    updateLesson(chapterIdx, lessonIdx, (lesson) => ({
      ...lesson,
      resources: lesson.resources.filter((_, idx) => idx !== resIdx),
    }));
  };

  const handleSave = () => {
    setErrorMsg(null);
    const result = isEditing
      ? updateCourse(slug!, draft)
      : addCourse(draft);

    if (!result.ok) {
      setErrorMsg(result.error);
      return;
    }

    navigate(`/course/${result.course.slug}`);
  };

  const handleConfirmDelete = () => {
    if (slug) {
      deleteCourse(slug);
    }
    setConfirmDeleteOpen(false);
    navigate('/');
  };

  return (
    <main className="min-h-[calc(100vh-64px)] bg-gray-50 pb-16">
      {/* Crisp White Header Bar (matches CourseHeader) */}
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 pt-5 sm:px-6 sm:pt-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Link
              to={isEditing ? `/course/${slug}` : '/'}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-black"
            >
              <ArrowLeft className="h-4 w-4" />
              {isEditing ? `Back to ${existingCourse?.code}` : 'All Courses'}
            </Link>

            <div className="flex items-center gap-2">
              {isEditing && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 sm:text-sm"
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
              <span className="rounded bg-slate-900 px-2 py-0.5 font-mono font-semibold text-white">
                {isEditing ? 'EDIT COURSE' : 'NEW COURSE'}
              </span>
              <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-gray-700">
                ID Prefix: {coursePrefix}-*
              </span>
              <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-gray-600">
                /course/{draft.slug || '...'}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-4xl">
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
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
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
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <GitFork className="h-4 w-4" />
              Live Tree Preview
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {errorMsg && (
          <div
            role="alert"
            className="mb-5 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {activeTab === 'preview' ? (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2 text-xs text-gray-500">
              <span>
                Live SVG layout preview — all chapter and lesson IDs auto-derived with prefix{' '}
                <code className="rounded bg-gray-100 px-1 font-mono text-gray-800">
                  {coursePrefix}-
                </code>
              </span>
              <span>
                {normalizedPreviewCourse.chapters.length} chapters ·{' '}
                {normalizedPreviewCourse.chapters.reduce((s, c) => s + c.lessons.length, 0)} lessons
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
            <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-xs">
              <h2 className="mb-4 text-sm font-bold tracking-wide text-gray-700 uppercase">
                Course Metadata
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="course-code" className="mb-1 block text-xs font-medium text-gray-700">
                    Course Code *
                  </label>
                  <input
                    id="course-code"
                    type="text"
                    value={draft.code}
                    onChange={(e) => updateMeta({ code: e.target.value })}
                    placeholder="e.g. MATH201"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="course-title" className="mb-1 block text-xs font-medium text-gray-700">
                    Course Title *
                  </label>
                  <input
                    id="course-title"
                    type="text"
                    value={draft.title}
                    onChange={(e) => updateMeta({ title: e.target.value })}
                    placeholder="e.g. Linear Algebra"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="course-dept" className="mb-1 block text-xs font-medium text-gray-700">
                    Department *
                  </label>
                  <input
                    id="course-dept"
                    type="text"
                    value={draft.department}
                    onChange={(e) => updateMeta({ department: e.target.value })}
                    placeholder="e.g. Computer Science"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="course-semester" className="mb-1 block text-xs font-medium text-gray-700">
                    Semester
                  </label>
                  <input
                    id="course-semester"
                    type="text"
                    value={draft.semester ?? ''}
                    onChange={(e) => updateMeta({ semester: e.target.value || undefined })}
                    placeholder="e.g. Year 2 · Spring"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="course-credits" className="mb-1 block text-xs font-medium text-gray-700">
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
                      updateMeta({ credits: Number.isFinite(val) && val > 0 ? val : undefined });
                    }}
                    placeholder="3"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="course-slug" className="mb-1 block text-xs font-medium text-gray-700">
                    URL Slug * (auto-derived from code + title)
                  </label>
                  <input
                    id="course-slug"
                    type="text"
                    value={draft.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      updateMeta({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') });
                    }}
                    className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 font-mono text-xs text-gray-800 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="course-desc" className="mb-1 block text-xs font-medium text-gray-700">
                    Course Description *
                  </label>
                  <textarea
                    id="course-desc"
                    rows={2}
                    value={draft.description}
                    onChange={(e) => updateMeta({ description: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </section>

            {/* 2. Chapters & Sub-Lessons Builder */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold tracking-wide text-gray-700 uppercase">
                  Chapters &amp; Sub-Lessons ({draft.chapters.length} chapters)
                </h2>
                <button
                  type="button"
                  onClick={addChapter}
                  className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Chapter
                </button>
              </div>

              {draft.chapters.map((chapter, cIdx) => {
                const derivedChapterId =
                  normalizedPreviewCourse.chapters[cIdx]?.id ?? chapter.id;

                return (
                  <div
                    key={chapter.id}
                    className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs"
                  >
                    {/* Yellow roadmap.sh Chapter Header Strip */}
                    <div className="border-b border-gray-200 bg-[#fdff00]/35 px-4 py-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                            Ch {cIdx + 1}
                          </span>
                          <span
                            className="rounded bg-white/80 px-2 py-0.5 font-mono text-[11px] text-gray-700"
                            title="Auto-derived chapter ID"
                          >
                            {derivedChapterId}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={cIdx === 0}
                            onClick={() => moveChapter(cIdx, -1)}
                            title="Move chapter up"
                            aria-label="Move chapter up"
                            className="rounded border border-gray-300 bg-white p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={cIdx === draft.chapters.length - 1}
                            onClick={() => moveChapter(cIdx, 1)}
                            title="Move chapter down"
                            aria-label="Move chapter down"
                            className="rounded border border-gray-300 bg-white p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeChapter(cIdx)}
                            title="Delete chapter"
                            aria-label="Delete chapter"
                            className="rounded border border-red-200 bg-white p-1 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        <input
                          type="text"
                          value={chapter.title}
                          onChange={(e) =>
                            updateChapter(cIdx, (ch) => ({ ...ch, title: e.target.value }))
                          }
                          placeholder="Chapter Title"
                          aria-label={`Chapter ${cIdx + 1} title`}
                          className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 focus:border-blue-500 focus:outline-none sm:col-span-2"
                        />
                        <input
                          type="text"
                          value={chapter.weekRange ?? ''}
                          onChange={(e) =>
                            updateChapter(cIdx, (ch) => ({
                              ...ch,
                              weekRange: e.target.value || undefined,
                            }))
                          }
                          placeholder="Weeks (e.g. Weeks 1–3)"
                          aria-label={`Chapter ${cIdx + 1} week range`}
                          className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 focus:border-blue-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={chapter.description}
                          onChange={(e) =>
                            updateChapter(cIdx, (ch) => ({ ...ch, description: e.target.value }))
                          }
                          placeholder="Chapter description"
                          aria-label={`Chapter ${cIdx + 1} description`}
                          className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none sm:col-span-3"
                        />
                      </div>
                    </div>

                    {/* Sub-Lessons List */}
                    <div className="divide-y divide-gray-100 p-4">
                      {chapter.lessons.length === 0 ? (
                        <p className="py-2 text-xs text-gray-500">
                          No sub-lessons yet. Add one below.
                        </p>
                      ) : (
                        chapter.lessons.map((lesson, lIdx) => {
                          const isExpanded = Boolean(expandedLessons[lesson.id]);
                          const derivedLessonId =
                            normalizedPreviewCourse.chapters[cIdx]?.lessons[lIdx]?.id ?? lesson.id;

                          return (
                            <div
                              key={lesson.id}
                              className="py-2.5 first:pt-0 last:pb-0"
                            >
                              {/* Sub-lesson Collapsed Header */}
                              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200/80 bg-[#ffe599]/35 px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedLessons((prev) => ({
                                      ...prev,
                                      [lesson.id]: !prev[lesson.id],
                                    }))
                                  }
                                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4 shrink-0 text-gray-600" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 shrink-0 text-gray-600" />
                                  )}
                                  <span className="truncate text-sm font-semibold text-gray-900">
                                    {lesson.title || 'Untitled Lesson'}
                                  </span>
                                  <span className="hidden rounded bg-white/80 px-1.5 py-0.5 font-mono text-[11px] text-gray-600 sm:inline">
                                    {derivedLessonId}
                                  </span>
                                </button>

                                <div className="flex items-center gap-1">
                                  <span className="rounded bg-white/80 px-1.5 py-0.5 text-[11px] text-gray-600">
                                    {lesson.resources.length} res
                                  </span>
                                  <button
                                    type="button"
                                    disabled={lIdx === 0}
                                    onClick={() => moveLesson(cIdx, lIdx, -1)}
                                    title="Move lesson up"
                                    aria-label="Move lesson up"
                                    className="rounded border border-gray-300 bg-white p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                                  >
                                    <ArrowUp className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={lIdx === chapter.lessons.length - 1}
                                    onClick={() => moveLesson(cIdx, lIdx, 1)}
                                    title="Move lesson down"
                                    aria-label="Move lesson down"
                                    className="rounded border border-gray-300 bg-white p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                                  >
                                    <ArrowDown className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeLesson(cIdx, lIdx)}
                                    title="Delete sub-lesson"
                                    aria-label={`Delete ${lesson.title}`}
                                    className="rounded border border-red-200 bg-white p-1 text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Sub-lesson Expanded Fields */}
                              {isExpanded && (
                                <div className="mt-2.5 space-y-3 rounded-md border border-gray-200 bg-gray-50/70 p-3.5">
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                                    <div className="sm:col-span-2">
                                      <label className="mb-1 block text-xs font-medium text-gray-700">
                                        Sub-Lesson Title *
                                      </label>
                                      <input
                                        type="text"
                                        value={lesson.title}
                                        onChange={(e) =>
                                          updateLesson(cIdx, lIdx, (l) => ({
                                            ...l,
                                            title: e.target.value,
                                          }))
                                        }
                                        className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-1 block text-xs font-medium text-gray-700">
                                        Branch Side
                                      </label>
                                      <select
                                        value={lesson.side ?? ''}
                                        onChange={(e) =>
                                          updateLesson(cIdx, lIdx, (l) => ({
                                            ...l,
                                            side:
                                              e.target.value === 'left' ||
                                              e.target.value === 'right'
                                                ? e.target.value
                                                : undefined,
                                          }))
                                        }
                                        className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                                      >
                                        <option value="">Auto</option>
                                        <option value="left">Left</option>
                                        <option value="right">Right</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label className="mb-1 block text-xs font-medium text-gray-700">
                                        Est. Minutes
                                      </label>
                                      <input
                                        type="number"
                                        min={5}
                                        value={lesson.estimatedMinutes ?? ''}
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value, 10);
                                          updateLesson(cIdx, lIdx, (l) => ({
                                            ...l,
                                            estimatedMinutes:
                                              Number.isFinite(val) && val > 0 ? val : undefined,
                                          }));
                                        }}
                                        placeholder="45"
                                        className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700">
                                      Summary *
                                    </label>
                                    <textarea
                                      rows={2}
                                      value={lesson.summary}
                                      onChange={(e) =>
                                        updateLesson(cIdx, lIdx, (l) => ({
                                          ...l,
                                          summary: e.target.value,
                                        }))
                                      }
                                      className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none"
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700">
                                      Study Notes (optional)
                                    </label>
                                    <textarea
                                      rows={2}
                                      value={lesson.notes ?? ''}
                                      onChange={(e) =>
                                        updateLesson(cIdx, lIdx, (l) => ({
                                          ...l,
                                          notes: e.target.value || undefined,
                                        }))
                                      }
                                      placeholder="Key takeaways, formulas, or exam tips..."
                                      className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none"
                                    />
                                  </div>

                                  {/* Prerequisites Selector */}
                                  {allLessonRefs.length > 1 && (
                                    <div>
                                      <div className="mb-1.5 text-xs font-medium text-gray-700">
                                        Prerequisites (click to toggle)
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {allLessonRefs
                                          .filter((ref) => ref.id !== lesson.id)
                                          .map((ref) => {
                                            const active = Boolean(
                                              lesson.prerequisites?.includes(ref.id)
                                            );
                                            return (
                                              <button
                                                key={ref.id}
                                                type="button"
                                                onClick={() =>
                                                  togglePrerequisite(cIdx, lIdx, ref.id)
                                                }
                                                className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                                                  active
                                                    ? 'border-blue-600 bg-blue-600 text-white'
                                                    : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
                                                }`}
                                              >
                                                {ref.title}
                                              </button>
                                            );
                                          })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Resources Manager */}
                                  <div className="border-t border-gray-200 pt-2.5">
                                    <div className="mb-2 flex items-center justify-between">
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700">
                                        <Link2 className="h-3.5 w-3.5" />
                                        Course Materials ({lesson.resources.length})
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => addResource(cIdx, lIdx)}
                                        className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                                      >
                                        <Plus className="h-3 w-3" />
                                        Add Material
                                      </button>
                                    </div>

                                    {lesson.resources.length > 0 && (
                                      <div className="space-y-2">
                                        {lesson.resources.map((res, rIdx) => (
                                          <div
                                            key={rIdx}
                                            className="grid grid-cols-1 items-center gap-2 rounded border border-gray-200 bg-white p-2 sm:grid-cols-12"
                                          >
                                            <div className="flex items-center gap-1.5 sm:col-span-3">
                                              <ResourceBadge kind={res.kind} />
                                              <select
                                                value={res.kind}
                                                onChange={(e) =>
                                                  updateResource(cIdx, lIdx, rIdx, {
                                                    kind: e.target.value as ResourceKind,
                                                  })
                                                }
                                                aria-label="Resource kind"
                                                className="w-full rounded border border-gray-300 px-1.5 py-1 text-xs text-gray-800"
                                              >
                                                {RESOURCE_KINDS.map((k) => (
                                                  <option key={k} value={k}>
                                                    {RESOURCE_BADGE_STYLES[k].label}
                                                  </option>
                                                ))}
                                              </select>
                                            </div>
                                            <input
                                              type="text"
                                              value={res.title}
                                              onChange={(e) =>
                                                updateResource(cIdx, lIdx, rIdx, {
                                                  title: e.target.value,
                                                })
                                              }
                                              placeholder="Material title"
                                              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 sm:col-span-4"
                                            />
                                            <input
                                              type="url"
                                              value={res.url}
                                              onChange={(e) =>
                                                updateResource(cIdx, lIdx, rIdx, {
                                                  url: e.target.value,
                                                })
                                              }
                                              placeholder="https://..."
                                              className="rounded border border-gray-300 px-2 py-1 font-mono text-xs text-gray-700 sm:col-span-4"
                                            />
                                            <div className="flex justify-end sm:col-span-1">
                                              <button
                                                type="button"
                                                onClick={() => removeResource(cIdx, lIdx, rIdx)}
                                                aria-label="Remove material"
                                                className="rounded p-1 text-red-500 hover:bg-red-50"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}

                      <div className="pt-3">
                        <button
                          type="button"
                          onClick={() => addLesson(cIdx)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-gray-500 hover:bg-gray-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Sub-Lesson to Chapter {cIdx + 1}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          </div>
        )}
      </div>

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
