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
import { useNavigationGuard } from '@/context/NavigationGuardContext';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import {
  deriveChapterId,
  deriveChapterSupplementId,
  deriveCoursePrefix,
  deriveCourseSlug,
  deriveLessonId,
  deriveLessonSupplementId,
  deriveSpineChildSupplementId,
  deriveSpineSupplementId,
  formatChapterPositionTag,
  formatChapterSupplementTag,
  formatLessonPositionTag,
  formatLessonSupplementTag,
  formatSpineChildSupplementTag,
  formatSpineSupplementTag,
  rekeyCourseContentIds,
} from '@/lib/courseIds';
import { isValidDmyDate } from '@/lib/dateValidation';
import { layoutCourseTree } from '@/lib/layoutTree';
import {
  EDITOR_LEASE_STORAGE_KEY,
  collectReferencedFileIds,
  garbageCollectFiles,
} from '@/lib/fileStore';
import { CourseTreeCanvas } from '@/components/CourseTreeCanvas';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EditorStickyBar } from '@/components/editor/EditorStickyBar';
import { ChapterEditorCard } from '@/components/editor/ChapterEditorCard';
import { SupplementEditorCard } from '@/components/editor/SupplementEditorCard';
import { ImportCourseDialog } from '@/components/editor/ImportCourseDialog';
import {
  type Chapter,
  type CourseTree,
  type LessonResource,
  type SpineSupplement,
  type SubLesson,
  type Supplement,
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
  supplementsToExpand: string[];
}

function validateCourseDraft(
  draft: CourseTree,
  yearError: string | null,
  otherSlugs: string[] = []
): ValidationResult {
  const fieldErrors: Record<string, string> = {};
  const chaptersToExpand: string[] = [];
  const lessonsToExpand: string[] = [];
  const supplementsToExpand: string[] = [];
  let firstErrorMsg: string | null = null;

  const recordError = (
    key: string,
    msg: string,
    expandLessonId?: string,
    expandChapterId?: string,
    expandSupplementIds: string[] = []
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
    for (const sid of expandSupplementIds) {
      if (sid && !supplementsToExpand.includes(sid)) {
        supplementsToExpand.push(sid);
      }
    }
  };

  const codeTrimmed = draft.code.trim();
  if (!codeTrimmed) {
    recordError('code', 'Course Metadata: Please enter a Course Code.');
  } else if (codeTrimmed.length < 2) {
    recordError('code', 'Course Metadata: Course Code must be at least 2 characters.');
  }

  const titleTrimmed = draft.title.trim();
  if (!titleTrimmed) {
    recordError('title', 'Course Metadata: Please enter a Course Title.');
  } else if (titleTrimmed.length < 2) {
    recordError('title', 'Course Metadata: Course Title must be at least 2 characters.');
  }

  const deptTrimmed = draft.department.trim();
  if (!deptTrimmed) {
    recordError('department', 'Course Metadata: Please enter a Department.');
  } else if (deptTrimmed.length < 2) {
    recordError('department', 'Course Metadata: Department must be at least 2 characters.');
  }

  if (yearError) {
    recordError('year', `Course Metadata: ${yearError}`);
  }

  const slugTrimmed = draft.slug.trim();
  if (!slugTrimmed) {
    recordError('slug', 'Course Metadata: Please enter a URL Slug.');
  } else if (!/^[a-z0-9-]+$/.test(slugTrimmed)) {
    recordError(
      'slug',
      'Course Metadata: URL Slug must contain only lowercase letters, numbers, and hyphens.'
    );
  } else if (otherSlugs.includes(slugTrimmed)) {
    recordError('slug', `Course Metadata: A course with slug "${slugTrimmed}" already exists.`);
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
    if (chapter.weekRange) {
      const rangeMatch = /^Week\s+(\d+)\s*-\s*(\d+)$/i.exec(chapter.weekRange.trim());
      if (rangeMatch && Number(rangeMatch[2]) < Number(rangeMatch[1])) {
        recordError(
          `${chPrefix}.weekRange`,
          `${chLabel}: To week must be greater than or equal to From week.`,
          undefined,
          chapter.id
        );
      }
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

      const validateSupplementFields = (
        sup: Supplement,
        supLabel: string,
        supPrefix: string,
        expandLessonId?: string,
        expandChapterId?: string,
        expandSupIds: string[] = [sup.id]
      ) => {
        (sup.customFields ?? []).forEach((field, fIdx) => {
          const fieldNum = fIdx + 1;
          const fLabel = field.label.trim();
          const fieldDesc = fLabel
            ? `Custom Field #${fieldNum} ("${fLabel}")`
            : `Custom Field #${fieldNum}`;
          if (!fLabel) {
            recordError(
              `${supPrefix}.customFields.${fIdx}.label`,
              `${supLabel}, Custom Field #${fieldNum}: Please enter a field label.`,
              expandLessonId,
              expandChapterId,
              expandSupIds
            );
          }
          const fVal = field.value.trim();
          if (!fVal) {
            recordError(
              `${supPrefix}.customFields.${fIdx}.value`,
              `${supLabel}, ${fieldDesc}: Please enter a value.`,
              expandLessonId,
              expandChapterId,
              expandSupIds
            );
          } else if (field.type === 'link' && !isValidHttpUrlString(fVal)) {
            recordError(
              `${supPrefix}.customFields.${fIdx}.value`,
              `${supLabel}, ${fieldDesc}: Please enter a valid URL starting with http:// or https://.`,
              expandLessonId,
              expandChapterId,
              expandSupIds
            );
          } else if (field.type === 'date' && !isValidDmyDate(fVal)) {
            recordError(
              `${supPrefix}.customFields.${fIdx}.value`,
              `${supLabel}, ${fieldDesc}: Please enter a valid date in DD/MM/YYYY format.`,
              expandLessonId,
              expandChapterId,
              expandSupIds
            );
          }
        });
      };

      (lesson.supplements ?? []).forEach((cn, cnIdx) => {
        const cnTag = formatLessonSupplementTag(chOrder, lOrder, cnIdx + 1);
        const cnTitle = cn.title.trim();
        const cnLabel = cnTitle ? `${cnTag} ("${cnTitle}")` : cnTag;
        const cnPrefix = `${lPrefix}.supplements.${cnIdx}`;
        if (!cnTitle) {
          recordError(`${cnPrefix}.title`, `${cnTag}: Please enter a Supplement Title.`, lesson.id, chapter.id, [cn.id]);
        }
        if (!cn.summary.trim()) {
          recordError(`${cnPrefix}.summary`, `${cnLabel}: Please enter a Supplement Summary.`, lesson.id, chapter.id, [cn.id]);
        }
        validateSupplementFields(cn, cnLabel, cnPrefix, lesson.id, chapter.id, [cn.id]);
        (cn.resources ?? []).forEach((res, rIdx) => {
          validateResource(res, rIdx, cnLabel, `${cnPrefix}.resources`, lesson.id, chapter.id);
        });
      });
    });

    (chapter.supplements ?? []).forEach((cn, cnIdx) => {
      const cnTag = formatChapterSupplementTag(chOrder, cnIdx + 1);
      const cnTitle = cn.title.trim();
      const cnLabel = cnTitle ? `${cnTag} ("${cnTitle}")` : cnTag;
      const cnPrefix = `${chPrefix}.supplements.${cnIdx}`;
      if (!cnTitle) {
        recordError(`${cnPrefix}.title`, `${cnTag}: Please enter a Supplement Title.`, undefined, chapter.id, [cn.id]);
      }
      if (!cn.summary.trim()) {
        recordError(`${cnPrefix}.summary`, `${cnLabel}: Please enter a Supplement Summary.`, undefined, chapter.id, [cn.id]);
      }
      (cn.customFields ?? []).forEach((field, fIdx) => {
        const fieldNum = fIdx + 1;
        const fLabel = field.label.trim();
        const fieldDesc = fLabel ? `Custom Field #${fieldNum} ("${fLabel}")` : `Custom Field #${fieldNum}`;
        if (!fLabel) {
          recordError(`${cnPrefix}.customFields.${fIdx}.label`, `${cnLabel}, Custom Field #${fieldNum}: Please enter a field label.`, undefined, chapter.id, [cn.id]);
        }
        const fVal = field.value.trim();
        if (!fVal) {
          recordError(`${cnPrefix}.customFields.${fIdx}.value`, `${cnLabel}, ${fieldDesc}: Please enter a value.`, undefined, chapter.id, [cn.id]);
        } else if (field.type === 'link' && !isValidHttpUrlString(fVal)) {
          recordError(`${cnPrefix}.customFields.${fIdx}.value`, `${cnLabel}, ${fieldDesc}: Please enter a valid URL starting with http:// or https://.`, undefined, chapter.id, [cn.id]);
        } else if (field.type === 'date' && !isValidDmyDate(fVal)) {
          recordError(`${cnPrefix}.customFields.${fIdx}.value`, `${cnLabel}, ${fieldDesc}: Please enter a valid date in DD/MM/YYYY format.`, undefined, chapter.id, [cn.id]);
        }
      });
      (cn.resources ?? []).forEach((res, rIdx) => {
        validateResource(res, rIdx, cnLabel, `${cnPrefix}.resources`, undefined, chapter.id);
      });
    });
  });

  (draft.supplements ?? []).forEach((scn, sIdx) => {
    const sTag = formatSpineSupplementTag(sIdx + 1);
    const sTitle = scn.title.trim();
    const sLabel = sTitle ? `${sTag} ("${sTitle}")` : sTag;
    const sPrefix = `supplements.${sIdx}`;
    if (!sTitle) {
      recordError(`${sPrefix}.title`, `${sTag}: Please enter a Supplement Title.`, undefined, undefined, [scn.id]);
    }
    if (!scn.summary.trim()) {
      recordError(`${sPrefix}.summary`, `${sLabel}: Please enter a Supplement Summary.`, undefined, undefined, [scn.id]);
    }
    (scn.customFields ?? []).forEach((field, fIdx) => {
      const fieldNum = fIdx + 1;
      const fLabel = field.label.trim();
      const fieldDesc = fLabel ? `Custom Field #${fieldNum} ("${fLabel}")` : `Custom Field #${fieldNum}`;
      if (!fLabel) {
        recordError(`${sPrefix}.customFields.${fIdx}.label`, `${sLabel}, Custom Field #${fieldNum}: Please enter a field label.`, undefined, undefined, [scn.id]);
      }
      const fVal = field.value.trim();
      if (!fVal) {
        recordError(`${sPrefix}.customFields.${fIdx}.value`, `${sLabel}, ${fieldDesc}: Please enter a value.`, undefined, undefined, [scn.id]);
      } else if (field.type === 'link' && !isValidHttpUrlString(fVal)) {
        recordError(`${sPrefix}.customFields.${fIdx}.value`, `${sLabel}, ${fieldDesc}: Please enter a valid URL starting with http:// or https://.`, undefined, undefined, [scn.id]);
      } else if (field.type === 'date' && !isValidDmyDate(fVal)) {
        recordError(`${sPrefix}.customFields.${fIdx}.value`, `${sLabel}, ${fieldDesc}: Please enter a valid date in DD/MM/YYYY format.`, undefined, undefined, [scn.id]);
      }
    });
    (scn.resources ?? []).forEach((res, rIdx) => {
      validateResource(res, rIdx, sLabel, `${sPrefix}.resources`);
    });
    (scn.children ?? []).forEach((child, cIdx) => {
      const cTag = formatSpineChildSupplementTag(sIdx + 1, cIdx + 1);
      const cTitle = child.title.trim();
      const cLabel = cTitle ? `${cTag} ("${cTitle}")` : cTag;
      const cPrefix = `${sPrefix}.children.${cIdx}`;
      if (!cTitle) {
        recordError(`${cPrefix}.title`, `${cTag}: Please enter a Supplement Title.`, undefined, undefined, [scn.id, child.id]);
      }
      if (!child.summary.trim()) {
        recordError(`${cPrefix}.summary`, `${cLabel}: Please enter a Supplement Summary.`, undefined, undefined, [scn.id, child.id]);
      }
      (child.customFields ?? []).forEach((field, fIdx) => {
        const fieldNum = fIdx + 1;
        const fLabel = field.label.trim();
        const fieldDesc = fLabel ? `Custom Field #${fieldNum} ("${fLabel}")` : `Custom Field #${fieldNum}`;
        if (!fLabel) {
          recordError(`${cPrefix}.customFields.${fIdx}.label`, `${cLabel}, Custom Field #${fieldNum}: Please enter a field label.`, undefined, undefined, [scn.id, child.id]);
        }
        const fVal = field.value.trim();
        if (!fVal) {
          recordError(`${cPrefix}.customFields.${fIdx}.value`, `${cLabel}, ${fieldDesc}: Please enter a value.`, undefined, undefined, [scn.id, child.id]);
        } else if (field.type === 'link' && !isValidHttpUrlString(fVal)) {
          recordError(`${cPrefix}.customFields.${fIdx}.value`, `${cLabel}, ${fieldDesc}: Please enter a valid URL starting with http:// or https://.`, undefined, undefined, [scn.id, child.id]);
        } else if (field.type === 'date' && !isValidDmyDate(fVal)) {
          recordError(`${cPrefix}.customFields.${fIdx}.value`, `${cLabel}, ${fieldDesc}: Please enter a valid date in DD/MM/YYYY format.`, undefined, undefined, [scn.id, child.id]);
        }
      });
      (child.resources ?? []).forEach((res, rIdx) => {
        validateResource(res, rIdx, cLabel, `${cPrefix}.resources`);
      });
    });
  });

  return { fieldErrors, firstErrorMsg, chaptersToExpand, lessonsToExpand, supplementsToExpand };
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
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>(() => {
    if (existingCourse) {
      return buildCollapsedChaptersMap(existingCourse);
    }
    return {};
  });
  const [expandedLessons, setExpandedLessons] = useState<Record<string, boolean>>(() => {
    if (!existingCourse) {
      const starter = createBlankCourse();
      const firstLessonId = starter.chapters[0]?.lessons[0]?.id;
      return firstLessonId ? { [firstLessonId]: true } : {};
    }
    return {};
  });
  const [expandedSupplements, setExpandedSupplements] = useState<Record<string, boolean>>({});
  const [focusedChapterId, setFocusedChapterId] = useState<string | null>(null);
  const [focusedLessonId, setFocusedLessonId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [storeErrorMsg, setStoreErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDeleteChapterIdx, setPendingDeleteChapterIdx] = useState<number | null>(null);
  const [pendingDeleteLesson, setPendingDeleteLesson] = useState<{
    chapterIdx: number;
    lessonIdx: number;
  } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importBanner, setImportBanner] = useState<{ warnings: string[] } | null>(null);
  const [stickyBarHeight, setStickyBarHeight] = useState<number>(56);

  const editorRegionRef = useRef<HTMLDivElement | null>(null);
  const unsavedDialogRef = useRef<HTMLDivElement | null>(null);
  const { registerGuard } = useNavigationGuard();
  const prevRouteSlugRef = useRef<string | undefined>(slug);
  const pendingScrollTargetRef = useRef<{
    attr: 'data-edit-chapter' | 'data-edit-supplement';
    id: string;
  } | null>(null);
  const pendingPreviewJumpRef = useRef<
    | { kind: 'chapter'; chapterId: string }
    | { kind: 'lesson'; chapterId: string; lessonId: string }
    | null
  >(null);

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

  useDialogFocus({
    isOpen: Boolean(pendingNavPath),
    containerRef: unsavedDialogRef,
    onEscape: () => setPendingNavPath(null),
  });

  useEffect(() => {
    return registerGuard({
      isDirty,
      onBlockedNavigate: (to) => setPendingNavPath(to),
    });
  }, [registerGuard, isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      setPendingNavPath('__BACK__');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

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
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleDocumentClickCapture, true);
    };
  }, [isDirty, location.pathname]);

  useEffect(() => {
    const target = pendingScrollTargetRef.current;
    if (!target) return;
    pendingScrollTargetRef.current = null;
    const targetEl = Array.from(document.querySelectorAll(`[${target.attr}]`)).find(
      (node) => node.getAttribute(target.attr) === target.id
    );
    if (targetEl && typeof targetEl.scrollIntoView === 'function') {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const firstInput = targetEl?.querySelector<HTMLElement>('input, textarea');
    if (firstInput && typeof firstInput.focus === 'function') {
      try {
        firstInput.focus({ preventScroll: true });
      } catch {
        firstInput.focus();
      }
    }
  }, [draft.chapters, draft.supplements]);

  useEffect(() => {
    if (activeTab !== 'editor') return;
    const jump = pendingPreviewJumpRef.current;
    if (!jump) return;

    const targetEl =
      jump.kind === 'lesson'
        ? Array.from(document.querySelectorAll('[data-edit-lesson]')).find(
            (node) => node.getAttribute('data-edit-lesson') === jump.lessonId
          )
        : Array.from(document.querySelectorAll('[data-edit-chapter]')).find(
            (node) => node.getAttribute('data-edit-chapter') === jump.chapterId
          );

    if (!targetEl) return;
    pendingPreviewJumpRef.current = null;

    if (typeof targetEl.scrollIntoView === 'function') {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const firstInput =
      jump.kind === 'lesson'
        ? targetEl.querySelector<HTMLElement>('input[aria-label="Sub-Lesson Title"], input, textarea')
        : targetEl.querySelector<HTMLElement>(
            'input[aria-label^="Chapter "][aria-label$=" title"], input, textarea'
          );
    if (firstInput && typeof firstInput.focus === 'function') {
      try {
        firstInput.focus({ preventScroll: true });
      } catch {
        firstInput.focus();
      }
    }
  }, [activeTab, collapsedChapters, expandedLessons]);

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

  useEffect(() => {
    const writeLease = () => {
      try {
        window.localStorage.setItem(EDITOR_LEASE_STORAGE_KEY, String(Date.now()));
      } catch {
        // Ignore storage errors
      }
    };
    writeLease();
    const id = window.setInterval(writeLease, 20_000);
    return () => {
      window.clearInterval(id);
      try {
        window.localStorage.removeItem(EDITOR_LEASE_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
    };
  }, []);

  const normalizedPreviewCourse = useMemo(() => rekeyCourseContentIds(draft), [draft]);
  const previewLayout = useMemo(
    () => (activeTab === 'preview' ? layoutCourseTree(normalizedPreviewCourse) : null),
    [activeTab, normalizedPreviewCourse]
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

  const otherSlugs = useMemo(
    () => courses.filter((c) => !isEditing || c.slug !== slug).map((c) => c.slug),
    [courses, isEditing, slug]
  );

  useEffect(() => {
    setStoreErrorMsg(null);
  }, [draft]);

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  useEffect(() => {
    if (!hasFieldErrors && !errorMsg) return;

    const liveValidation = validateCourseDraft(draft, yearError, otherSlugs);

    if (hasFieldErrors) {
      setFieldErrors((prev) => {
        let changed = false;
        const next: Record<string, string> = {};
        for (const [key, prevMsg] of Object.entries(prev)) {
          const currentMsg = liveValidation.fieldErrors[key];
          if (currentMsg) {
            next[key] = currentMsg;
            if (currentMsg !== prevMsg) changed = true;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }

    if (errorMsg) {
      if (errorMsg === 'A course must have at least one chapter.') {
        if (draft.chapters.length > 1) {
          setErrorMsg(null);
        }
        return;
      }

      const liveMessages = Object.values(liveValidation.fieldErrors);
      if (!liveMessages.includes(errorMsg)) {
        setErrorMsg(liveValidation.firstErrorMsg);
      }
    }
  }, [draft, yearError, hasFieldErrors, errorMsg]);

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
            className="inline-flex items-center rounded-md bg-[var(--solid-bg)] px-4 py-2 text-sm font-medium text-[var(--solid-text)] hover:bg-[var(--solid-bg-hover)]"
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

    pendingScrollTargetRef.current = { attr: 'data-edit-chapter', id: newChapterId };
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

  const performRemoveChapter = (chapterIdx: number) => {
    setDraft((prev) => {
      if (prev.chapters.length <= 1) {
        return prev;
      }
      const targetChapter = prev.chapters[chapterIdx];
      if (!targetChapter) return prev;
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

  const removeChapter = (chapterIdx: number) => {
    if (draft.chapters.length <= 1) {
      setErrorMsg('A course must have at least one chapter.');
      return;
    }
    const targetChapter = draft.chapters[chapterIdx];
    if (!targetChapter) return;
    const isPopulated =
      targetChapter.lessons.length > 0 ||
      (targetChapter.resources?.length ?? 0) > 0 ||
      Boolean(targetChapter.notes?.trim());
    if (isPopulated) {
      setPendingDeleteChapterIdx(chapterIdx);
      return;
    }
    performRemoveChapter(chapterIdx);
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
    const targetChapter = draft.chapters[chapterIdx];
    if (!targetChapter) return;
    const existingIds = new Set(
      draft.chapters.flatMap((c) => [c.id, ...c.lessons.map((l) => l.id)])
    );
    const nextNum = targetChapter.lessons.length + 1;
    const title = `New Sub-Lesson ${nextNum}`;
    const newId = deriveLessonId(draft.code, chapterIdx + 1, nextNum, title, existingIds);
    const newLesson: SubLesson = {
      id: newId,
      title,
      summary: 'Brief summary of what students will learn.',
      resources: [],
    };
    setCollapsedChapters((col) => ({ ...col, [targetChapter.id]: false }));
    setExpandedLessons((exp) => ({ ...exp, [newId]: true }));
    setDraft((prev) => ({
      ...prev,
      chapters: prev.chapters.map((ch, idx) =>
        idx === chapterIdx ? { ...ch, lessons: [...ch.lessons, newLesson] } : ch
      ),
    }));
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

  const performRemoveLesson = (chapterIdx: number, lessonIdx: number) => {
    setDraft((prev) => {
      const removedId = prev.chapters[chapterIdx]?.lessons[lessonIdx]?.id;
      if (!removedId) return prev;
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

  const removeLesson = (chapterIdx: number, lessonIdx: number) => {
    const targetLesson = draft.chapters[chapterIdx]?.lessons[lessonIdx];
    if (!targetLesson) return;
    const isPopulated =
      targetLesson.resources.length > 0 || Boolean(targetLesson.notes?.trim());
    if (isPopulated) {
      setPendingDeleteLesson({ chapterIdx, lessonIdx });
      return;
    }
    performRemoveLesson(chapterIdx, lessonIdx);
  };

  const toggleSupplementExpand = (nodeId: string) => {
    setExpandedSupplements((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const addChapterSupplement = (chapterIdx: number) => {
    const ch = draft.chapters[chapterIdx];
    if (!ch) return;
    const nextNum = (ch.supplements?.length ?? 0) + 1;
    const title = `Child Supplement ${nextNum}`;
    const newId = deriveChapterSupplementId(draft.code, chapterIdx + 1, nextNum, title);
    const newNode: Supplement = {
      id: newId,
      title,
      summary: 'Supplement overview.',
      resources: [],
    };
    setCollapsedChapters((prev) => ({ ...prev, [ch.id]: false }));
    setExpandedSupplements((prev) => ({ ...prev, [newId]: true }));
    updateChapter(chapterIdx, (c) => ({
      ...c,
      supplements: [...(c.supplements ?? []), newNode],
    }));
  };

  const updateChapterSupplement = (
    chapterIdx: number,
    cnIdx: number,
    updater: (cn: Supplement) => Supplement
  ) => {
    updateChapter(chapterIdx, (ch) => ({
      ...ch,
      supplements: (ch.supplements ?? []).map((cn, idx) =>
        idx === cnIdx ? updater(cn) : cn
      ),
    }));
  };

  const removeChapterSupplement = (chapterIdx: number, cnIdx: number) => {
    updateChapter(chapterIdx, (ch) => {
      const next = (ch.supplements ?? []).filter((_, idx) => idx !== cnIdx);
      return { ...ch, supplements: next.length > 0 ? next : undefined };
    });
  };

  const addLessonSupplement = (chapterIdx: number, lessonIdx: number) => {
    const ch = draft.chapters[chapterIdx];
    const lesson = ch?.lessons[lessonIdx];
    if (!ch || !lesson) return;
    const nextNum = (lesson.supplements?.length ?? 0) + 1;
    const title = `Child Supplement ${nextNum}`;
    const newId = deriveLessonSupplementId(
      draft.code,
      chapterIdx + 1,
      lessonIdx + 1,
      nextNum,
      title
    );
    const newNode: Supplement = {
      id: newId,
      title,
      summary: 'Child supplement overview.',
      resources: [],
    };
    setCollapsedChapters((prev) => ({ ...prev, [ch.id]: false }));
    setExpandedLessons((prev) => ({ ...prev, [lesson.id]: true }));
    setExpandedSupplements((prev) => ({ ...prev, [newId]: true }));
    updateLesson(chapterIdx, lessonIdx, (l) => ({
      ...l,
      supplements: [...(l.supplements ?? []), newNode],
    }));
  };

  const updateLessonSupplement = (
    chapterIdx: number,
    lessonIdx: number,
    cnIdx: number,
    updater: (cn: Supplement) => Supplement
  ) => {
    updateLesson(chapterIdx, lessonIdx, (l) => ({
      ...l,
      supplements: (l.supplements ?? []).map((cn, idx) =>
        idx === cnIdx ? updater(cn) : cn
      ),
    }));
  };

  const removeLessonSupplement = (
    chapterIdx: number,
    lessonIdx: number,
    cnIdx: number
  ) => {
    updateLesson(chapterIdx, lessonIdx, (l) => {
      const next = (l.supplements ?? []).filter((_, idx) => idx !== cnIdx);
      return { ...l, supplements: next.length > 0 ? next : undefined };
    });
  };

  const addSpineSupplement = () => {
    const nextNum = (draft.supplements?.length ?? 0) + 1;
    const title = `Supplement ${nextNum}`;
    const newId = deriveSpineSupplementId(draft.code, nextNum, title);
    const newNode: SpineSupplement = {
      id: newId,
      title,
      summary: 'Supplement overview.',
      afterChapterOrder: draft.chapters.length,
      resources: [],
    };
    pendingScrollTargetRef.current = { attr: 'data-edit-supplement', id: newId };
    setExpandedSupplements((prev) => ({ ...prev, [newId]: true }));
    setDraft((prev) => ({
      ...prev,
      supplements: [...(prev.supplements ?? []), newNode],
    }));
  };

  const updateSpineSupplement = (
    sIdx: number,
    updater: (node: SpineSupplement) => SpineSupplement
  ) => {
    setDraft((prev) => ({
      ...prev,
      supplements: (prev.supplements ?? []).map((n, idx) =>
        idx === sIdx ? updater(n) : n
      ),
    }));
  };

  const moveSpineSupplement = (sIdx: number, direction: -1 | 1) => {
    setDraft((prev) => {
      const list = [...(prev.supplements ?? [])];
      const target = sIdx + direction;
      if (target < 0 || target >= list.length) return prev;
      [list[sIdx], list[target]] = [list[target], list[sIdx]];
      return { ...prev, supplements: list };
    });
  };

  const removeSpineSupplement = (sIdx: number) => {
    setDraft((prev) => {
      const next = (prev.supplements ?? []).filter((_, idx) => idx !== sIdx);
      return { ...prev, supplements: next.length > 0 ? next : undefined };
    });
  };

  const addSpineChildSupplement = (sIdx: number) => {
    const parent = draft.supplements?.[sIdx];
    if (!parent) return;
    const nextNum = (parent.children?.length ?? 0) + 1;
    const title = `Child Supplement ${nextNum}`;
    const newId = deriveSpineChildSupplementId(draft.code, sIdx + 1, nextNum, title);
    const child: Supplement = {
      id: newId,
      title,
      summary: 'Child supplement overview.',
      resources: [],
    };
    setExpandedSupplements((prev) => ({ ...prev, [parent.id]: true, [newId]: true }));
    updateSpineSupplement(sIdx, (n) => ({
      ...n,
      children: [...(n.children ?? []), child],
    }));
  };

  const updateSpineChildSupplement = (
    sIdx: number,
    childIdx: number,
    updater: (child: Supplement) => Supplement
  ) => {
    updateSpineSupplement(sIdx, (n) => ({
      ...n,
      children: (n.children ?? []).map((c, idx) =>
        idx === childIdx ? updater(c) : c
      ),
    }));
  };

  const moveSpineChildSupplement = (
    sIdx: number,
    childIdx: number,
    direction: -1 | 1
  ) => {
    updateSpineSupplement(sIdx, (n) => {
      const list = [...(n.children ?? [])];
      const target = childIdx + direction;
      if (target < 0 || target >= list.length) return n;
      [list[childIdx], list[target]] = [list[target], list[childIdx]];
      return { ...n, children: list };
    });
  };

  const removeSpineChildSupplement = (sIdx: number, childIdx: number) => {
    updateSpineSupplement(sIdx, (n) => {
      const next = (n.children ?? []).filter((_, idx) => idx !== childIdx);
      return { ...n, children: next.length > 0 ? next : undefined };
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
      requestAnimationFrame(() => {
        const firstErrEl = document.querySelector<HTMLElement>('[data-field-error="true"]');
        if (!firstErrEl) return;
        if (typeof firstErrEl.scrollIntoView === 'function') {
          const reducedMotion =
            typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          firstErrEl.scrollIntoView({
            behavior: reducedMotion ? 'auto' : 'smooth',
            block: 'center',
          });
        }
        const focusTarget =
          firstErrEl.matches('input, select, textarea')
            ? firstErrEl
            : firstErrEl.querySelector<HTMLElement>('input, select, textarea');
        if (focusTarget && typeof focusTarget.focus === 'function') {
          try {
            focusTarget.focus({ preventScroll: true });
          } catch {
            focusTarget.focus();
          }
        }
      });
    });
  };

  const handleSave = (redirectTarget?: string): boolean => {
    setErrorMsg(null);
    setStoreErrorMsg(null);
    setFieldErrors({});

    const validation = validateCourseDraft(draft, yearError, otherSlugs);
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
      if (validation.supplementsToExpand.length > 0) {
        setExpandedSupplements((prev) => {
          const next = { ...prev };
          for (const sid of validation.supplementsToExpand) {
            next[sid] = true;
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
        setStoreErrorMsg(result.error);
        scrollFirstErrorIntoView();
        return false;
      }
      remapCourseProgress(result.previousSlug, result.course.slug, result.idMap);
      setBaselineJson(JSON.stringify(draft));
      const nextCourses = courses.map((c) => (c.slug === slug ? result.course : c));
      void garbageCollectFiles(collectReferencedFileIds(nextCourses)).catch(() => {});
      if (redirectTarget === '__BACK__') {
        navigate(-1);
      } else {
        navigate(redirectTarget ?? `/course/${result.course.slug}`);
      }
      return true;
    }

    const result = addCourse(draft);
    if (!result.ok) {
      setActiveTab('editor');
      setStoreErrorMsg(result.error);
      scrollFirstErrorIntoView();
      return false;
    }
    setBaselineJson(JSON.stringify(draft));
    void garbageCollectFiles(
      collectReferencedFileIds([...courses, result.course])
    ).catch(() => {});
    if (redirectTarget === '__BACK__') {
      navigate(-1);
    } else {
      navigate(redirectTarget ?? `/course/${result.course.slug}`);
    }
    return true;
  };

  const handleConfirmDelete = () => {
    if (slug) {
      forgetCourse(slug);
      deleteCourse(slug);
      const remaining = courses.filter((c) => c.slug !== slug);
      void garbageCollectFiles(collectReferencedFileIds(remaining)).catch(() => {});
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

  const handlePreviewSelectChapter = (clickedChapter: Chapter) => {
    const chIdx = normalizedPreviewCourse.chapters.findIndex((c) => c.id === clickedChapter.id);
    const targetChapter = draft.chapters[chIdx] ?? draft.chapters.find((c) => c.id === clickedChapter.id);
    if (!targetChapter) return;

    pendingPreviewJumpRef.current = { kind: 'chapter', chapterId: targetChapter.id };
    setCollapsedChapters((prev) => ({ ...prev, [targetChapter.id]: false }));
    setFocusedChapterId(targetChapter.id);
    setFocusedLessonId(null);
    setActiveTab('editor');
  };

  const handlePreviewSelectLesson = (clickedLessonId: string) => {
    let targetChapter: Chapter | undefined;
    let targetLesson: SubLesson | undefined;

    for (let cIdx = 0; cIdx < normalizedPreviewCourse.chapters.length; cIdx++) {
      const lIdx = normalizedPreviewCourse.chapters[cIdx].lessons.findIndex(
        (l) => l.id === clickedLessonId
      );
      if (lIdx !== -1) {
        targetChapter = draft.chapters[cIdx];
        targetLesson = targetChapter?.lessons[lIdx];
        break;
      }
    }

    if (!targetChapter || !targetLesson) return;

    pendingPreviewJumpRef.current = {
      kind: 'lesson',
      chapterId: targetChapter.id,
      lessonId: targetLesson.id,
    };
    setCollapsedChapters((prev) => ({ ...prev, [targetChapter.id]: false }));
    setExpandedLessons((prev) => ({ ...prev, [targetLesson.id]: true }));
    setFocusedChapterId(targetChapter.id);
    setFocusedLessonId(targetLesson.id);
    setActiveTab('editor');
  };

  const handlePreviewSelectSupplement = (previewNodeId: string) => {
    // Check spine supplements
    for (let sIdx = 0; sIdx < (normalizedPreviewCourse.supplements ?? []).length; sIdx++) {
      const pNode = normalizedPreviewCourse.supplements![sIdx];
      const dNode = draft.supplements?.[sIdx];
      if (!dNode) continue;
      if (pNode.id === previewNodeId) {
        pendingScrollTargetRef.current = { attr: 'data-edit-supplement', id: dNode.id };
        setExpandedSupplements((prev) => ({ ...prev, [dNode.id]: true }));
        setActiveTab('editor');
        return;
      }
      const childIdx = (pNode.children ?? []).findIndex((c) => c.id === previewNodeId);
      if (childIdx >= 0 && dNode.children?.[childIdx]) {
        const childId = dNode.children[childIdx].id;
        pendingScrollTargetRef.current = { attr: 'data-edit-supplement', id: childId };
        setExpandedSupplements((prev) => ({
          ...prev,
          [dNode.id]: true,
          [childId]: true,
        }));
        setActiveTab('editor');
        return;
      }
    }
    // Check chapter & lesson supplements
    for (let cIdx = 0; cIdx < normalizedPreviewCourse.chapters.length; cIdx++) {
      const pCh = normalizedPreviewCourse.chapters[cIdx];
      const dCh = draft.chapters[cIdx];
      if (!dCh) continue;
      const chCnIdx = (pCh.supplements ?? []).findIndex((cn) => cn.id === previewNodeId);
      if (chCnIdx >= 0 && dCh.supplements?.[chCnIdx]) {
        const supId = dCh.supplements[chCnIdx].id;
        pendingScrollTargetRef.current = { attr: 'data-edit-supplement', id: supId };
        setCollapsedChapters((prev) => ({ ...prev, [dCh.id]: false }));
        setExpandedSupplements((prev) => ({ ...prev, [supId]: true }));
        setActiveTab('editor');
        return;
      }
      for (let lIdx = 0; lIdx < pCh.lessons.length; lIdx++) {
        const pL = pCh.lessons[lIdx];
        const dL = dCh.lessons[lIdx];
        if (!dL) continue;
        const lCnIdx = (pL.supplements ?? []).findIndex((cn) => cn.id === previewNodeId);
        if (lCnIdx >= 0 && dL.supplements?.[lCnIdx]) {
          const supId = dL.supplements[lCnIdx].id;
          pendingScrollTargetRef.current = { attr: 'data-edit-supplement', id: supId };
          setCollapsedChapters((prev) => ({ ...prev, [dCh.id]: false }));
          setExpandedLessons((prev) => ({ ...prev, [dL.id]: true }));
          setExpandedSupplements((prev) => ({ ...prev, [supId]: true }));
          setActiveTab('editor');
          return;
        }
      }
    }
  };

  const displayErrorMsg = storeErrorMsg ?? errorMsg;
  const hasExpandedLessons = Object.values(expandedLessons).some(Boolean);
  const hasExpandedSupplements = Object.values(expandedSupplements).some(Boolean);
  const hasExpandedChapters = draft.chapters.some((ch) => !collapsedChapters[ch.id]);
  const effectiveStickyBarHeight =
    stickyBarHeight > 56 ? stickyBarHeight : displayErrorMsg ? 92 : 56;

  const inputClass =
    'w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-inset)] px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none';

  return (
    <main
      id="main-content"
      style={
        {
          '--editor-sticky-bar-height': `${effectiveStickyBarHeight}px`,
          '--editor-chapter-sticky-top': `calc(64px + ${effectiveStickyBarHeight}px)`,
        } as React.CSSProperties
      }
      className="min-h-[calc(100vh-64px)] bg-[var(--surface-canvas)] pb-16 text-[var(--text-primary)]"
    >
      {/* Header Bar */}
      <section className="border-b border-[var(--border-subtle)] bg-[var(--surface-1)]">
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
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
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
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--status-danger-border)] bg-[var(--surface-1)] px-3 text-xs font-medium text-[var(--status-danger-text)] transition-colors hover:border-[var(--danger-solid-bg)] hover:bg-[var(--danger-solid-bg)] hover:text-white focus-visible:border-[var(--danger-solid-bg)] focus-visible:bg-[var(--danger-solid-bg)] focus-visible:text-white focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 sm:text-sm"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Course
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSave()}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--cta-bg)] px-3.5 text-xs font-semibold text-[var(--cta-text)] transition-colors hover:bg-[var(--cta-bg-hover)] sm:text-sm"
              >
                <Save className="h-3.5 w-3.5" />
                Save Course
              </button>
            </div>
          </div>

          <div className="mb-5">
            <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded bg-[var(--solid-bg)] px-2 py-0.5 font-mono font-semibold text-[var(--solid-text)]">
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
                  ? 'border-[var(--accent-purple)] text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                  ? 'border-[var(--accent-purple)] text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
          hasExpandedLessons={hasExpandedLessons || hasExpandedSupplements || hasExpandedChapters}
          errorMsg={displayErrorMsg}
          onDismissError={() => {
            setErrorMsg(null);
            setStoreErrorMsg(null);
          }}
          onHeightChange={setStickyBarHeight}
          onAddChapter={addChapter}
          onAddSpineSupplement={addSpineSupplement}
          onCollapseAll={() => {
            setExpandedLessons({});
            setExpandedSupplements({});
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
                {(() => {
                  const supCount =
                    (normalizedPreviewCourse.supplements?.length ?? 0) +
                    (normalizedPreviewCourse.supplements?.reduce(
                      (s, n) => s + (n.children?.length ?? 0),
                      0
                    ) ?? 0) +
                    normalizedPreviewCourse.chapters.reduce(
                      (s, c) =>
                        s +
                        (c.supplements?.length ?? 0) +
                        c.lessons.reduce((ls, l) => ls + (l.supplements?.length ?? 0), 0),
                      0
                    );
                  return supCount > 0 ? ` · ${supCount} ${supCount === 1 ? 'supplement' : 'supplements'}` : '';
                })()}
              </span>
            </div>
            {previewLayout && (
              <CourseTreeCanvas
                layout={previewLayout}
                statuses={{}}
                framed={false}
                onSelectLesson={handlePreviewSelectLesson}
                onSelectChapter={handlePreviewSelectChapter}
                onSelectSupplement={handlePreviewSelectSupplement}
                onQuickToggleDone={() => {}}
                onContextMenuLesson={() => {}}
              />
            )}
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
                        ? 'border-[var(--status-danger-border)] ring-1 ring-[var(--status-danger-border)]/30'
                        : ''
                    }`}
                  />
                  {fieldErrors.code && (
                    <p role="alert" className="mt-1 text-[11px] text-[var(--status-danger-text)]">
                      {fieldErrors.code}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="course-title"
                    className="mb-1 block text-xs font-medium text-[var(--text-secondary)]"
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
                        ? 'border-[var(--status-danger-border)] ring-1 ring-[var(--status-danger-border)]/30'
                        : ''
                    }`}
                  />
                  {fieldErrors.title && (
                    <p role="alert" className="mt-1 text-[11px] text-[var(--status-danger-text)]">
                      {fieldErrors.title}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="course-dept"
                    className="mb-1 block text-xs font-medium text-[var(--text-secondary)]"
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
                        ? 'border-[var(--status-danger-border)] ring-1 ring-[var(--status-danger-border)]/30'
                        : ''
                    }`}
                  />
                  {fieldErrors.department && (
                    <p role="alert" className="mt-1 text-[11px] text-[var(--status-danger-text)]">
                      {fieldErrors.department}
                    </p>
                  )}
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
                        className="accent-[var(--accent-purple)]"
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
                        className="accent-[var(--accent-purple)]"
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
                        ? 'border-[var(--status-danger-border)] ring-1 ring-[var(--status-danger-border)]/30'
                        : ''
                    }`}
                  />
                  {fieldErrors.slug && (
                    <p role="alert" className="mt-1 text-[11px] text-[var(--status-danger-text)]">
                      {fieldErrors.slug}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-3">
                  <label
                    htmlFor="course-desc"
                    className="mb-1 block text-xs font-medium text-[var(--text-secondary)]"
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
                        ? 'border-[var(--status-danger-border)] ring-1 ring-[var(--status-danger-border)]/30'
                        : ''
                    }`}
                  />
                  {fieldErrors.description && (
                    <p role="alert" className="mt-1 text-[11px] text-[var(--status-danger-text)]">
                      {fieldErrors.description}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* 2. Chapters & Sub-Lessons Builder */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold tracking-wide text-[var(--text-secondary)] uppercase">
                  Chapters &amp; Sub-Lessons ({draft.chapters.length}{' '}
                  {draft.chapters.length === 1 ? 'chapter' : 'chapters'})
                </h2>
              </div>

              {draft.chapters.map((chapter, cIdx) => {
                const derivedChapter = normalizedPreviewCourse.chapters[cIdx];
                const derivedChapterId = derivedChapter?.id ?? chapter.id;
                const derivedLessonIds =
                  derivedChapter?.lessons.map((l) => l.id) ??
                  chapter.lessons.map((l) => l.id);
                const derivedSupplementIds =
                  derivedChapter?.supplements?.map((cn) => cn.id) ??
                  chapter.supplements?.map((cn) => cn.id) ??
                  [];
                const derivedLessonSupplementIds = Object.fromEntries(
                  chapter.lessons.map((l, lIdx) => [
                    l.id,
                    derivedChapter?.lessons[lIdx]?.supplements?.map((cn) => cn.id) ??
                      l.supplements?.map((cn) => cn.id) ??
                      [],
                  ])
                );

                return (
                  <ChapterEditorCard
                    key={chapter.id}
                    chapter={chapter}
                    chapterIndex={cIdx}
                    totalChapters={draft.chapters.length}
                    derivedChapterId={derivedChapterId}
                    derivedLessonIds={derivedLessonIds}
                    derivedSupplementIds={derivedSupplementIds}
                    derivedLessonSupplementIds={derivedLessonSupplementIds}
                    courseCode={draft.code}
                    allChapters={draft.chapters}
                    allSpineSupplements={draft.supplements ?? []}
                    isExpanded={!collapsedChapters[chapter.id]}
                    expandedLessons={expandedLessons}
                    expandedSupplements={expandedSupplements}
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
                    onToggleSupplementExpand={toggleSupplementExpand}
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
                    onAddChapterSupplement={() => addChapterSupplement(cIdx)}
                    onUpdateChapterSupplement={(cnIdx, updater) =>
                      updateChapterSupplement(cIdx, cnIdx, updater)
                    }
                    onRemoveChapterSupplement={(cnIdx) =>
                      removeChapterSupplement(cIdx, cnIdx)
                    }
                    onAddLessonSupplement={(lIdx) => addLessonSupplement(cIdx, lIdx)}
                    onUpdateLessonSupplement={(lIdx, cnIdx, updater) =>
                      updateLessonSupplement(cIdx, lIdx, cnIdx, updater)
                    }
                    onRemoveLessonSupplement={(lIdx, cnIdx) =>
                      removeLessonSupplement(cIdx, lIdx, cnIdx)
                    }
                  />
                );
              })}
            </section>

            {/* 3. Spine Supplements Builder */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold tracking-wide text-[var(--text-secondary)] uppercase">
                  Supplements ({(draft.supplements ?? []).length})
                </h2>
              </div>
              {(draft.supplements ?? []).length > 0 && (
                <div className="space-y-3">
                  {(draft.supplements ?? []).map((scn, sIdx) => {
                    const derivedSpine = normalizedPreviewCourse.supplements?.[sIdx];
                    return (
                      <SupplementEditorCard
                        key={scn.id}
                        node={scn}
                        placement="spine"
                        positionTag={formatSpineSupplementTag(sIdx + 1)}
                        derivedId={derivedSpine?.id ?? scn.id}
                        courseCode={draft.code}
                        allChapters={draft.chapters}
                        allSpineSupplements={draft.supplements ?? []}
                        isExpanded={Boolean(expandedSupplements[scn.id])}
                        spineOrder={sIdx + 1}
                        derivedChildIds={derivedSpine?.children?.map((c) => c.id) ?? []}
                        expandedChildIds={expandedSupplements}
                        onToggleChildExpand={toggleSupplementExpand}
                        errorPrefix={`supplements.${sIdx}`}
                        fieldErrors={fieldErrors}
                        canMoveUp={sIdx > 0}
                        canMoveDown={sIdx < (draft.supplements?.length ?? 0) - 1}
                        onToggleExpand={() => toggleSupplementExpand(scn.id)}
                        onUpdate={(updater) =>
                          updateSpineSupplement(sIdx, (prev) => updater(prev) as SpineSupplement)
                        }
                        onMove={(dir) => moveSpineSupplement(sIdx, dir)}
                        onRemove={() => removeSpineSupplement(sIdx)}
                        onAddChild={() => addSpineChildSupplement(sIdx)}
                        onUpdateChild={(cIdx, updater) =>
                          updateSpineChildSupplement(sIdx, cIdx, updater)
                        }
                        onMoveChild={(cIdx, dir) => moveSpineChildSupplement(sIdx, cIdx, dir)}
                        onRemoveChild={(cIdx) => removeSpineChildSupplement(sIdx, cIdx)}
                      />
                    );
                  })}
                </div>
              )}
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

      <ConfirmDialog
        open={pendingDeleteChapterIdx !== null}
        title="Delete populated chapter?"
        description="This chapter contains sub-lessons, materials, or notes. Deleting it will permanently remove them from this draft."
        confirmLabel="Delete Chapter"
        onConfirm={() => {
          if (pendingDeleteChapterIdx !== null) {
            performRemoveChapter(pendingDeleteChapterIdx);
          }
          setPendingDeleteChapterIdx(null);
        }}
        onCancel={() => setPendingDeleteChapterIdx(null)}
      />

      <ConfirmDialog
        open={pendingDeleteLesson !== null}
        title="Delete populated sub-lesson?"
        description="This sub-lesson contains materials or notes. Deleting it will permanently remove them from this draft."
        confirmLabel="Delete Sub-Lesson"
        onConfirm={() => {
          if (pendingDeleteLesson) {
            performRemoveLesson(
              pendingDeleteLesson.chapterIdx,
              pendingDeleteLesson.lessonIdx
            );
          }
          setPendingDeleteLesson(null);
        }}
        onCancel={() => setPendingDeleteLesson(null)}
      />

      {pendingNavPath && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-modal)] p-4 backdrop-blur-xs"
          onClick={() => setPendingNavPath(null)}
        >
          <div
            ref={unsavedDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Unsaved changes"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 shadow-xl"
          >
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Unsaved changes
              </h2>
            </div>

            <p className="mb-6 text-sm text-[var(--text-secondary)]">
              You have unsaved edits to <strong className="font-semibold text-[var(--text-primary)]">{draft.code || 'this course'}</strong>. Would you like to save your changes or discard them before leaving?
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingNavPath(null)}
                className="inline-flex h-9 items-center rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-3.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] sm:text-sm"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = pendingNavPath;
                  setPendingNavPath(null);
                  if (target === '__BACK__') {
                    navigate(-1);
                  } else {
                    navigate(target);
                  }
                }}
                className="inline-flex h-9 items-center rounded-md border border-[var(--status-danger-border)] bg-[var(--surface-1)] px-3.5 text-xs font-medium text-[var(--status-danger-text)] transition-colors hover:border-[var(--danger-solid-bg)] hover:bg-[var(--danger-solid-bg)] hover:text-white focus-visible:border-[var(--danger-solid-bg)] focus-visible:bg-[var(--danger-solid-bg)] focus-visible:text-white focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 sm:text-sm"
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
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--cta-bg)] px-3.5 text-xs font-semibold text-[var(--cta-text)] transition-colors hover:bg-[var(--cta-bg-hover)] sm:text-sm"
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
