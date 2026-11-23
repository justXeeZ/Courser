import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  FileEdit,
  GitFork,
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
  formatChapterPositionTag,
  formatLessonPositionTag,
  rekeyCourseContentIds,
} from '@/lib/courseIds';
import { layoutCourseTree } from '@/lib/layoutTree';
import { CourseTreeCanvas } from '@/components/CourseTreeCanvas';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EditorStickyBar } from '@/components/editor/EditorStickyBar';
import { ChapterEditorCard } from '@/components/editor/ChapterEditorCard';
import { ImportCourseDialog } from '@/components/editor/ImportCourseDialog';
import {
  type Chapter,
  type CourseTree,
  type LessonResource,
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
    year: undefined,
    semester: undefined,
    credits: undefined,
    description: 'Course overview and learning outcomes.',
    chapters: [
      {
        id: deriveChapterId(code, 1, '1. Foundations'),
        order: 1,
        title: '1. Foundations',
        weekRange: undefined,
        description: 'Core introductory concepts for this course.',
        lessons: [
          {
            id: deriveLessonId(code, 1, 1, 'Course Introduction'),
            title: 'Course Introduction',
            summary: 'Key terminology, setup, and roadmap for the semester.',
            resources: [],
          },
        ],
      },
    ],
  };
}

function buildCollapsedChaptersMap(course: CourseTree): Record<string, boolean> {
  return Object.fromEntries(course.chapters.map((ch) => [ch.id, true]));
}

function isValidHttpUrlString(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

interface ValidationResult {
  fieldErrors: Record<string, string>;
  firstErrorMsg: string | null;
  chaptersToExpand: string[];
  lessonsToExpand: string[];
}

function validateCourseDraft(
  draft: CourseTree,
  yearError: string | null
): ValidationResult {
  const fieldErrors: Record<string, string> = {};
  const chaptersToExpand: string[] = [];
  const lessonsToExpand: string[] = [];
  let firstErrorMsg: string | null = null;

  const recordError = (
    key: string,
    msg: string,
    expandLessonId?: string,
    expandChapterId?: string
  ) => {
    if (!fieldErrors[key]) {
      fieldErrors[key] = msg;
    }
    if (!firstErrorMsg) {
      firstErrorMsg = msg;
    }
    if (expandChapterId && !chaptersToExpand.includes(expandChapterId)) {
      chaptersToExpand.push(expandChapterId);
    }
    if (expandLessonId && !lessonsToExpand.includes(expandLessonId)) {
      lessonsToExpand.push(expandLessonId);
    }
  };

  if (!draft.code.trim()) {
    recordError('code', 'Course Metadata: Please enter a Course Code.');
  }
  if (!draft.title.trim()) {
    recordError('title', 'Course Metadata: Please enter a Course Title.');
  }
  if (!draft.department.trim()) {
    recordError('department', 'Course Metadata: Please enter a Department.');
  }
  if (yearError) {
    recordError('year', `Course Metadata: ${yearError}`);
  }
  if (!draft.slug.trim()) {
    recordError('slug', 'Course Metadata: Please enter a URL Slug.');
  }
  if (!draft.description.trim()) {
    recordError('description', 'Course Metadata: Please enter a Course Description.');
  }

  const validateResource = (
    res: LessonResource,
    rIdx: number,
    locationLabel: string,
    keyPrefix: string,
    expandLessonId?: string,
    expandChapterId?: string
  ) => {
    const matNum = rIdx + 1;
    const matTitle = res.title.trim();
    const matLabel = matTitle
      ? `Material #${matNum} ("${matTitle}")`
      : `Material #${matNum}`;
    const errKey = `${keyPrefix}.${rIdx}`;

    if (!matTitle) {
      recordError(
        errKey,
        `${locationLabel}, Material #${matNum}: Please enter a title for this material.`,
        expandLessonId,
        expandChapterId
      );
      return;
    }

    const hasUrl = Boolean(res.url && res.url.trim().length > 0);
    const hasFile = Boolean(res.file);
    const hasAssessment = Boolean(res.assessment);
    const sourceCount = Number(hasUrl) + Number(hasFile) + Number(hasAssessment);

    if (sourceCount === 0) {
      const hint =
        res.kind === 'exam' || res.kind === 'assignment'
          ? 'Please enter a valid URL (https://...), upload a file, or configure an interactive assessment.'
          : 'Please enter a valid URL (https://...) or upload a file.';
      recordError(
        errKey,
        `${locationLabel}, ${matLabel}: ${hint}`,
        expandLessonId,
        expandChapterId
      );
      return;
    }

    if (hasUrl && !isValidHttpUrlString(res.url!.trim())) {
      recordError(
        errKey,
        `${locationLabel}, ${matLabel}: Please enter a valid URL starting with http:// or https://.`,
        expandLessonId,
        expandChapterId
      );
      return;
    }

    if (hasAssessment && res.assessment!.questions.length === 0) {
      recordError(
        errKey,
        `${locationLabel}, ${matLabel}: Interactive assessment must contain at least one question.`,
        expandLessonId,
        expandChapterId
      );
    }
  };

  draft.chapters.forEach((chapter, cIdx) => {
    const chOrder = cIdx + 1;
    const chTag = formatChapterPositionTag(chOrder);
    const chTitle = chapter.title.trim();
    const chLabel = chTitle ? `${chTag} ("${chTitle}")` : chTag;
    const chPrefix = `chapters.${cIdx}`;

    if (!chTitle) {
      recordError(
        `${chPrefix}.title`,
        `${chTag}: Please enter a Chapter Title.`,
        undefined,
        chapter.id
      );
    }
    if (!chapter.description.trim()) {
      recordError(
        `${chPrefix}.description`,
        `${chLabel}: Please enter a Chapter Description.`,
        undefined,
        chapter.id
      );
    }

    (chapter.resources ?? []).forEach((res, rIdx) => {
      validateResource(res, rIdx, chLabel, `${chPrefix}.resources`, undefined, chapter.id);
    });

    chapter.lessons.forEach((lesson, lIdx) => {
      const lOrder = lIdx + 1;
      const lTag = formatLessonPositionTag(chOrder, lOrder);
      const lTitle = lesson.title.trim();
      const lLabel = lTitle ? `${lTag} ("${lTitle}")` : lTag;
      const lPrefix = `${chPrefix}.lessons.${lIdx}`;

      if (!lTitle) {
        recordError(
          `${lPrefix}.title`,
          `${lTag}: Please enter a Sub-Lesson Title.`,
          lesson.id,
          chapter.id
        );
      }
      if (!lesson.summary.trim()) {
        recordError(
          `${lPrefix}.summary`,
          `${lLabel}: Please enter a Sub-Lesson Summary.`,
          lesson.id,
          chapter.id
        );
      }

      lesson.resources.forEach((res, rIdx) => {
        validateResource(res, rIdx, lLabel, `${lPrefix}.resources`, lesson.id, chapter.id);
      });
    });
  });

  return { fieldErrors, firstErrorMsg, chaptersToExpand, lessonsToExpand };
}

export function CourseEditorPage() {
  const { slug } = useParams();
  const isEditing = Boolean(slug);
  const navigate = useNavigate();
  const location = useLocation();
  const { courses, getCourseBySlug, addCourse, updateCourse, deleteCourse } = useCourses();
  const { remapCourseProgress, forgetCourse } = useProgress();

  const existingCourse = slug ? getCourseBySlug(slug) : undefined;

  const [draft, setDraft] = useState<CourseTree>(() =>
    existingCourse ? structuredClone(existingCourse) : createBlankCourse()
  );
  const [baselineJson, setBaselineJson] = useState<string>(() =>
    JSON.stringify(existingCourse ? structuredClone(existingCourse) : createBlankCourse())
  );
  const [yearInput, setYearInput] = useState<string>(() =>
    existingCourse?.year !== undefined ? String(existingCourse.year) : ''
  );
  const [slugTouched, setSlugTouched] = useState<boolean>(isEditing);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>(() =>
    buildCollapsedChaptersMap(existingCourse ?? createBlankCourse())
  );
  const [expandedLessons, setExpandedLessons] = useState<Record<string, boolean>>({});
  const [focusedChapterId, setFocusedChapterId] = useState<string | null>(null);
  const [focusedLessonId, setFocusedLessonId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importBanner, setImportBanner] = useState<{ warnings: string[] } | null>(null);
  const [stickyBarHeight, setStickyBarHeight] = useState<number>(56);

  const editorRegionRef = useRef<HTMLDivElement | null>(null);
  const prevRouteSlugRef = useRef<string | undefined>(slug);
  const pendingScrollChapterIdRef = useRef<string | null>(null);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== baselineJson,
    [draft, baselineJson]
  );

  useEffect(() => {
    if (prevRouteSlugRef.current === slug) return;
    prevRouteSlugRef.current = slug;

    const targetCourse = slug ? getCourseBySlug(slug) : undefined;
    const nextDraft = targetCourse ? structuredClone(targetCourse) : createBlankCourse();
    setDraft(nextDraft);
    setBaselineJson(JSON.stringify(nextDraft));
    setYearInput(nextDraft.year !== undefined ? String(nextDraft.year) : '');
    setSlugTouched(Boolean(slug));
    setCollapsedChapters(buildCollapsedChaptersMap(nextDraft));
    setExpandedLessons({});
    setFocusedChapterId(null);
    setFocusedLessonId(null);
    setErrorMsg(null);
    setFieldErrors({});
    setPendingNavPath(null);
    setImportBanner(null);
    setConfirmDeleteOpen(false);
    setImportOpen(false);
  }, [slug, getCourseBySlug]);

  useEffect(() => {
    if (!isDirty) return;

    const handleDocumentClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const target = e.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const rawHref = anchor.getAttribute('href');
      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
        return;
      }

      try {
        const resolved = new URL(anchor.href, window.location.origin);
        if (resolved.origin !== window.location.origin) return;
        const targetPath = `${resolved.pathname}${resolved.search}${resolved.hash}`;
        if (resolved.pathname !== location.pathname) {
          e.preventDefault();
          e.stopPropagation();
          setPendingNavPath(targetPath);
        }
      } catch {
        // Ignore malformed hrefs
      }
    };

    document.addEventListener('click', handleDocumentClickCapture, true);
    return () => document.removeEventListener('click', handleDocumentClickCapture, true);
  }, [isDirty, location.pathname]);

  useEffect(() => {
    const targetId = pendingScrollChapterIdRef.current;
    if (!targetId) return;
    pendingScrollChapterIdRef.current = null;
    const targetEl = Array.from(document.querySelectorAll('[data-edit-chapter]')).find(
      (node) => node.getAttribute('data-edit-chapter') === targetId
    );
    if (targetEl && typeof targetEl.scrollIntoView === 'function') {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [draft.chapters]);

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
    const lessonIdx = focusedChapterEntry.chapter.lessons.findIndex(
      (l) => l.id === focusedLessonId
    );
    if (lessonIdx === -1) return null;
    return {
      lesson: focusedChapterEntry.chapter.lessons[lessonIdx],
      order: lessonIdx + 1,
    };
  }, [focusedChapterEntry, focusedLessonId]);

  if (isEditing && !existingCourse) {
    return (
      <main className="min-h-[calc(100vh-64px)] bg-slate-50 px-4 py-16 text-slate-900 dark:bg-[#0b0f17] dark:text-slate-100">
        <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-xs dark:border-slate-700/80 dark:bg-[#121926]">
          <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-slate-100">
            Course Not Found
          </h1>
          <p className="mb-5 text-sm text-slate-600 dark:text-slate-400">
            Could not find course <code className="font-mono">{slug}</code> to edit.
          </p>
          <Link
            to="/"
            className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-[#1b2436] dark:hover:bg-slate-700"
          >
            Back to All Courses
          </Link>
        </div>
      </main>
    );
  }

  const coursePrefix = deriveCoursePrefix(draft.code);
  const existingSlugs = courses.map((c) => c.slug);

  const YEAR_VALIDATION_ERROR = 'Year must be an integer from 1 to 10.';
  const yearError = (() => {
    const trimmed = yearInput.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
      return YEAR_VALIDATION_ERROR;
    }
    return null;
  })();

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
    const nextOrder = draft.chapters.length + 1;
    const existingIds = new Set(
      draft.chapters.flatMap((c) => [c.id, ...c.lessons.map((l) => l.id)])
    );
    const newChapterTitle = `${nextOrder}. New Chapter`;
    const newChapterId = deriveChapterId(draft.code, nextOrder, newChapterTitle, existingIds);
    const newLessonId = deriveLessonId(draft.code, nextOrder, 1, `Topic ${nextOrder}.1`, existingIds);
    const newChapter: Chapter = {
      id: newChapterId,
      order: nextOrder,
      title: newChapterTitle,
      weekRange: undefined,
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

    pendingScrollChapterIdRef.current = newChapterId;
    setDraft((prev) => ({ ...prev, chapters: [...prev.chapters, newChapter] }));
    setCollapsedChapters((prev) => ({ ...prev, [newChapterId]: false }));
    setExpandedLessons((exp) => ({ ...exp, [newLessonId]: true }));
    setFocusedChapterId(newChapterId);
    setFocusedLessonId(newLessonId);
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
      const newId = deriveLessonId(prev.code, chapterIdx + 1, nextNum, title, existingIds);
      const newLesson: SubLesson = {
        id: newId,
        title,
        summary: 'Brief summary of what students will learn.',
        resources: [],
      };
      const parentChapterId = prev.chapters[chapterIdx]?.id;
      if (parentChapterId) {
        setCollapsedChapters((col) => ({ ...col, [parentChapterId]: false }));
      }
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

  const scrollFirstErrorIntoView = () => {
    requestAnimationFrame(() => {
      const firstErrEl = document.querySelector('[data-field-error="true"]');
      if (firstErrEl && typeof firstErrEl.scrollIntoView === 'function') {
        firstErrEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  };

  const handleSave = (redirectTarget?: string): boolean => {
    setErrorMsg(null);
    setFieldErrors({});

    const validation = validateCourseDraft(draft, yearError);
    if (validation.firstErrorMsg) {
      setActiveTab('editor');
      setFieldErrors(validation.fieldErrors);
      setErrorMsg(validation.firstErrorMsg);
      if (validation.chaptersToExpand.length > 0) {
        setCollapsedChapters((prev) => {
          const next = { ...prev };
          for (const cid of validation.chaptersToExpand) {
            delete next[cid];
          }
          return next;
        });
      }
      if (validation.lessonsToExpand.length > 0) {
        setExpandedLessons((prev) => {
          const next = { ...prev };
          for (const lid of validation.lessonsToExpand) {
            next[lid] = true;
          }
          return next;
        });
      }
      scrollFirstErrorIntoView();
      return false;
    }

    if (isEditing && slug) {
      const result = updateCourse(slug, draft);
      if (!result.ok) {
        setActiveTab('editor');
        setErrorMsg(result.error);
        scrollFirstErrorIntoView();
        return false;
      }
      remapCourseProgress(result.previousSlug, result.course.slug, result.idMap);
      setBaselineJson(JSON.stringify(draft));
      navigate(redirectTarget ?? `/course/${result.course.slug}`);
      return true;
    }

    const result = addCourse(draft);
    if (!result.ok) {
      setActiveTab('editor');
      setErrorMsg(result.error);
      scrollFirstErrorIntoView();
      return false;
    }
    setBaselineJson(JSON.stringify(draft));
    navigate(redirectTarget ?? `/course/${result.course.slug}`);
    return true;
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
    setYearInput(imported.year !== undefined ? String(imported.year) : '');
    setSlugTouched(true);
    setErrorMsg(null);
    setFieldErrors({});
    setFocusedChapterId(null);
    setFocusedLessonId(null);
    setCollapsedChapters(buildCollapsedChaptersMap(imported));
    setExpandedLessons({});
    setImportBanner({ warnings });
  };

  const hasExpandedLessons = Object.values(expandedLessons).some(Boolean);
  const hasExpandedChapters = draft.chapters.some((ch) => !collapsedChapters[ch.id]);
  const effectiveStickyBarHeight =
    stickyBarHeight > 56 ? stickyBarHeight : errorMsg ? 92 : 56;

  const inputClass =
    'w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-100 dark:placeholder:text-slate-500';

  return (
    <main
      style={
        {
          '--editor-sticky-bar-height': `${effectiveStickyBarHeight}px`,
          '--editor-chapter-sticky-top': `calc(64px + ${effectiveStickyBarHeight}px)`,
        } as React.CSSProperties
      }
      className="min-h-[calc(100vh-64px)] bg-slate-50 pb-16 text-slate-900 dark:bg-[#0b0f17] dark:text-slate-100"
    >
      {/* Header Bar */}
      <section className="border-b border-slate-200 bg-white dark:border-slate-700/80 dark:bg-[#121926]">
        <div className="mx-auto max-w-5xl px-4 pt-5 sm:px-6 sm:pt-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Link
              to={isEditing ? `/course/${slug}` : '/'}
              onClick={(e) => {
                if (isDirty) {
                  e.preventDefault();
                  e.stopPropagation();
                  setPendingNavPath(isEditing ? `/course/${slug}` : '/');
                }
              }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              {isEditing ? `Back to ${existingCourse?.code}` : 'All Courses'}
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 sm:text-sm dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import Course
                </button>
              )}

              {isEditing && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 sm:text-sm dark:border-red-800/60 dark:bg-[#0d131f] dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Course
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSave()}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-yellow-400 px-3.5 text-xs font-semibold text-black transition-colors hover:bg-yellow-500 sm:text-sm"
              >
                <Save className="h-3.5 w-3.5" />
                Save Course
              </button>
            </div>
          </div>

          <div className="mb-5">
            <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded bg-slate-900 px-2 py-0.5 font-mono font-semibold text-white dark:bg-[#1b2436] dark:text-amber-400">
                {isEditing ? 'EDIT COURSE' : 'NEW COURSE'}
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-700 dark:bg-[#1b2436] dark:text-slate-300">
                ID Prefix: {coursePrefix}-*
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-600 dark:bg-[#1b2436] dark:text-slate-300">
                /course/{draft.slug || '...'}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100">
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
                  ? 'border-slate-900 text-slate-900 dark:border-yellow-400 dark:text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
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
                  ? 'border-slate-900 text-slate-900 dark:border-yellow-400 dark:text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
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
            focusedLessonEntry
              ? {
                  order: focusedLessonEntry.order,
                  title: focusedLessonEntry.lesson.title,
                }
              : null
          }
          hasExpandedLessons={hasExpandedLessons || hasExpandedChapters}
          errorMsg={errorMsg}
          onDismissError={() => setErrorMsg(null)}
          onHeightChange={setStickyBarHeight}
          onAddChapter={addChapter}
          onCollapseAll={() => {
            setExpandedLessons({});
            setCollapsedChapters(
              Object.fromEntries(draft.chapters.map((ch) => [ch.id, true]))
            );
            setFocusedLessonId(null);
          }}
          onSave={() => handleSave()}
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
            className="mb-5 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-400/10 dark:text-amber-200"
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
                className="rounded p-1 hover:bg-amber-200/60 dark:hover:bg-amber-400/20"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'preview' ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-700/80 dark:bg-[#121926]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 text-xs text-slate-500 dark:border-slate-700/80 dark:text-slate-400">
              <span>
                Live SVG layout preview — all chapter and lesson IDs auto-derived with prefix{' '}
                <code className="rounded bg-slate-100 px-1 font-mono text-slate-800 dark:bg-[#1b2436] dark:text-slate-200">
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
              framed={false}
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
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-700/80 dark:bg-[#121926]"
            >
              <h2 className="mb-4 text-sm font-bold tracking-wide text-slate-700 uppercase dark:text-slate-300">
                Course Metadata
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="course-code"
                    className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Course Code *
                  </label>
                  <input
                    id="course-code"
                    type="text"
                    value={draft.code}
                    onChange={(e) => updateMeta({ code: e.target.value })}
                    placeholder="e.g. MATH201"
                    aria-invalid={Boolean(fieldErrors.code)}
                    data-error-key="code"
                    data-field-error={fieldErrors.code ? 'true' : undefined}
                    className={`${inputClass} font-mono ${
                      fieldErrors.code
                        ? 'border-red-500 ring-1 ring-red-500/30 dark:border-red-500'
                        : ''
                    }`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="course-title"
                    className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Course Title *
                  </label>
                  <input
                    id="course-title"
                    type="text"
                    value={draft.title}
                    onChange={(e) => updateMeta({ title: e.target.value })}
                    placeholder="e.g. Linear Algebra"
                    aria-invalid={Boolean(fieldErrors.title)}
                    data-error-key="title"
                    data-field-error={fieldErrors.title ? 'true' : undefined}
                    className={`${inputClass} ${
                      fieldErrors.title
                        ? 'border-red-500 ring-1 ring-red-500/30 dark:border-red-500'
                        : ''
                    }`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="course-dept"
                    className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Department *
                  </label>
                  <input
                    id="course-dept"
                    type="text"
                    value={draft.department}
                    onChange={(e) => updateMeta({ department: e.target.value })}
                    placeholder="e.g. Preparatory"
                    aria-invalid={Boolean(fieldErrors.department)}
                    data-error-key="department"
                    data-field-error={fieldErrors.department ? 'true' : undefined}
                    className={`${inputClass} ${
                      fieldErrors.department
                        ? 'border-red-500 ring-1 ring-red-500/30 dark:border-red-500'
                        : ''
                    }`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="course-year"
                    className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Year
                  </label>
                  <input
                    id="course-year"
                    type="number"
                    min={1}
                    max={10}
                    value={yearInput}
                    aria-invalid={Boolean(yearError || fieldErrors.year)}
                    data-error-key="year"
                    data-field-error={yearError || fieldErrors.year ? 'true' : undefined}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setYearInput(raw);
                      const trimmed = raw.trim();
                      if (!trimmed) {
                        updateMeta({ year: undefined });
                        if (errorMsg?.includes(YEAR_VALIDATION_ERROR)) {
                          setErrorMsg(null);
                        }
                        if (fieldErrors.year) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.year;
                            return next;
                          });
                        }
                        return;
                      }
                      const parsed = Number(trimmed);
                      if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 10) {
                        updateMeta({ year: parsed });
                        if (errorMsg?.includes(YEAR_VALIDATION_ERROR)) {
                          setErrorMsg(null);
                        }
                        if (fieldErrors.year) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.year;
                            return next;
                          });
                        }
                      } else {
                        updateMeta({ year: undefined });
                      }
                    }}
                    placeholder="e.g. 2"
                    className={`${inputClass} ${
                      yearError || fieldErrors.year
                        ? 'border-red-500 ring-1 ring-red-500/30 focus:border-red-500 dark:border-red-500'
                        : ''
                    }`}
                  />
                  {yearError && (
                    <p role="alert" className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                      {yearError}
                    </p>
                  )}
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Semester
                    </span>
                    {draft.semester !== undefined && (
                      <button
                        type="button"
                        onClick={() => updateMeta({ semester: undefined })}
                        className="text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div
                    role="radiogroup"
                    aria-label="Semester"
                    className="flex h-[34px] items-center gap-3 rounded-md border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-[#0d131f]"
                  >
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200">
                      <input
                        type="radio"
                        name="course-semester"
                        value="1"
                        checked={draft.semester === 1}
                        onChange={() => updateMeta({ semester: 1 })}
                        className="accent-slate-900 dark:accent-yellow-400"
                      />
                      1st
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200">
                      <input
                        type="radio"
                        name="course-semester"
                        value="2"
                        checked={draft.semester === 2}
                        onChange={() => updateMeta({ semester: 2 })}
                        className="accent-slate-900 dark:accent-yellow-400"
                      />
                      2nd
                    </label>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="course-credits"
                    className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
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
                    placeholder="e.g. 3"
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-3">
                  <label
                    htmlFor="course-slug"
                    className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
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
                    placeholder="e.g. cs101-new-college-course"
                    aria-invalid={Boolean(fieldErrors.slug)}
                    data-error-key="slug"
                    data-field-error={fieldErrors.slug ? 'true' : undefined}
                    className={`${inputClass} font-mono text-xs ${
                      fieldErrors.slug
                        ? 'border-red-500 ring-1 ring-red-500/30 dark:border-red-500'
                        : ''
                    }`}
                  />
                </div>

                <div className="sm:col-span-3">
                  <label
                    htmlFor="course-desc"
                    className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Course Description *
                  </label>
                  <textarea
                    id="course-desc"
                    rows={2}
                    value={draft.description}
                    onChange={(e) => updateMeta({ description: e.target.value })}
                    placeholder="Course overview and learning outcomes..."
                    aria-invalid={Boolean(fieldErrors.description)}
                    data-error-key="description"
                    data-field-error={fieldErrors.description ? 'true' : undefined}
                    className={`${inputClass} ${
                      fieldErrors.description
                        ? 'border-red-500 ring-1 ring-red-500/30 dark:border-red-500'
                        : ''
                    }`}
                  />
                </div>
              </div>
            </section>

            {/* 2. Chapters & Sub-Lessons Builder */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold tracking-wide text-slate-700 uppercase dark:text-slate-300">
                  Chapters &amp; Sub-Lessons ({draft.chapters.length} chapters)
                </h2>
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
                    isExpanded={!collapsedChapters[chapter.id]}
                    expandedLessons={expandedLessons}
                    fieldErrors={fieldErrors}
                    onToggleChapterExpand={() =>
                      setCollapsedChapters((prev) => ({
                        ...prev,
                        [chapter.id]: !prev[chapter.id],
                      }))
                    }
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

      {pendingNavPath && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => setPendingNavPath(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Unsaved changes"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700/80 dark:bg-[#121926]"
          >
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Unsaved changes
              </h2>
            </div>

            <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
              You have unsaved edits to <strong className="font-semibold text-slate-900 dark:text-slate-100">{draft.code || 'this course'}</strong>. Would you like to save your changes or discard them before leaving?
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingNavPath(null)}
                className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 sm:text-sm dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = pendingNavPath;
                  setPendingNavPath(null);
                  navigate(target);
                }}
                className="inline-flex h-9 items-center rounded-md border border-red-200 bg-white px-3.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 sm:text-sm dark:border-red-800/60 dark:bg-[#0d131f] dark:text-red-400 dark:hover:bg-red-950/40"
              >
                Discard Edits
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = pendingNavPath;
                  setPendingNavPath(null);
                  handleSave(target);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-yellow-400 px-3.5 text-xs font-semibold text-black transition-colors hover:bg-yellow-500 sm:text-sm"
              >
                <Save className="h-3.5 w-3.5" />
                Save &amp; Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
