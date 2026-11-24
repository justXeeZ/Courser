import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { findCourseItem } from '@/lib/courseItems';
import { layoutCourseTree } from '@/lib/layoutTree';
import { ROADMAP_COLORS } from '@/lib/theme';
import { useCourses } from '@/store/useCourseStore';
import { useProgress } from '@/store/useProgressStore';
import { CourseHeader, type CourseViewTab } from '@/components/CourseHeader';
import { ProgressStrip } from '@/components/ProgressStrip';
import {
  CourseTreeCanvas,
  type NodeAnchorRect,
  type StatusFilter,
} from '@/components/CourseTreeCanvas';
import { ChecklistView } from '@/components/ChecklistView';
import { QuickStatusPill } from '@/components/QuickStatusPill';
import { LessonDrawer } from '@/components/LessonDrawer';
import { ChapterDrawer } from '@/components/ChapterDrawer';
import { ExportCourseDialog } from '@/components/ExportCourseDialog';
import { ProgressBackupDialog } from '@/components/ProgressBackupDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MaterialViewerModal } from '@/components/viewer/MaterialViewerModal';
import { AssessmentRunnerModal } from '@/components/assessment/AssessmentRunnerModal';
import type { Chapter, LessonResource } from '@/types/course';

export function CoursePage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getCourseBySlug, deleteCourse } = useCourses();
  const course = getCourseBySlug(slug);

  const {
    getCourseStatuses,
    getLessonStatus,
    setLessonStatus,
    toggleDone,
    isBookmarked,
    toggleBookmark,
    forgetCourse,
    getCourseStats,
  } = useProgress();

  const [activeTab, setActiveTab] = useState<CourseViewTab>('tree');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [contextMenu, setContextMenu] = useState<{
    itemId: string;
    anchor: NodeAnchorRect;
    trigger: 'hover' | 'contextmenu';
  } | null>(null);
  const hoverCloseTimerRef = useRef<number | null>(null);

  const clearHoverCloseTimer = () => {
    if (hoverCloseTimerRef.current !== null) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const scheduleHoverClose = (expectedItemId?: string) => {
    clearHoverCloseTimer();
    hoverCloseTimerRef.current = window.setTimeout(() => {
      setContextMenu((prev) => {
        if (!prev || prev.trigger !== 'hover') return prev;
        if (expectedItemId && prev.itemId !== expectedItemId) return prev;
        return null;
      });
      hoverCloseTimerRef.current = null;
    }, 220);
  };

  useEffect(() => {
    return () => clearHoverCloseTimer();
  }, []);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [activeViewerMaterial, setActiveViewerMaterial] = useState<LessonResource | null>(null);
  const [activeAssessmentMaterial, setActiveAssessmentMaterial] = useState<{
    itemId: string;
    resource: LessonResource;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    setActiveViewerMaterial(null);
    setActiveAssessmentMaterial(null);
    setBackupModalOpen(false);
    setExportModalOpen(false);
    setConfirmDeleteOpen(false);
    setContextMenu(null);
  }, [slug]);

  const hasSubModalOpen = Boolean(
    activeViewerMaterial ||
      activeAssessmentMaterial ||
      backupModalOpen ||
      exportModalOpen ||
      confirmDeleteOpen
  );

  const layout = useMemo(() => (course ? layoutCourseTree(course) : null), [course]);

  if (!course || !layout) {
    return (
      <main id="main-content" className="min-h-[calc(100vh-64px)] bg-[var(--surface-canvas)] px-4 py-16 text-[var(--text-primary)]">
        <div className="mx-auto max-w-md rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 text-center shadow-xs">
          <h1 className="mb-2 text-xl font-bold text-[var(--text-primary)]">
            Course Not Found
          </h1>
          <p className="mb-5 text-sm text-[var(--text-secondary)]">
            We could not find a course tree matching <code className="font-mono">{slug}</code>.
          </p>
          <Link
            to="/"
            className="inline-flex items-center rounded-md bg-[var(--solid-bg)] px-4 py-2 text-sm font-semibold text-[var(--solid-text)] hover:bg-[var(--solid-bg-hover)]"
          >
            Back to All Courses
          </Link>
        </div>
      </main>
    );
  }

  const statuses = getCourseStatuses(course.slug);
  const stats = getCourseStats(course);
  const requestedLessonId = searchParams.get('lesson');
  const requestedChapterId = searchParams.get('chapter');

  const resolvedItem = requestedLessonId
    ? findCourseItem(course, requestedLessonId)
    : requestedChapterId
      ? findCourseItem(course, requestedChapterId)
      : undefined;

  const activeLessonEntry = resolvedItem?.kind === 'lesson' ? resolvedItem : undefined;
  const activeChapterEntry = resolvedItem?.kind === 'chapter' ? resolvedItem : undefined;

  const openItem = (itemId: string) => {
    if (hasSubModalOpen) return;
    setContextMenu(null);
    const item = findCourseItem(course, itemId);
    if (!item) return;
    if (item.kind === 'chapter') {
      setSearchParams({ chapter: item.id }, { replace: false });
    } else {
      setSearchParams({ lesson: item.id }, { replace: false });
    }
  };

  const closeDrawer = () => {
    if (hasSubModalOpen) return;
    setSearchParams({}, { replace: true });
  };

  const handleSelectChapter = (chapter: Chapter) => {
    if (hasSubModalOpen) return;
    setContextMenu(null);
    setSearchParams({ chapter: chapter.id }, { replace: false });
  };

  const handleDownloadSvg = () => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const styleTag = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleTag.textContent = `
      :root {
        --svg-chapter-fill: ${ROADMAP_COLORS.chapterFill};
        --svg-lesson-fill: ${ROADMAP_COLORS.lessonFill};
        --svg-edge-color: ${ROADMAP_COLORS.edgeBlue};
      }
      text { font-family: "Balsamiq Sans", ui-sans-serif, system-ui, sans-serif; }
      g.node-done > rect.node-rect { fill: ${ROADMAP_COLORS.statusDoneFill}; }
      g.node-done > text.node-label { fill: ${ROADMAP_COLORS.nodeText}; text-decoration: line-through; }
      g.node-learning > rect.node-rect { fill: ${ROADMAP_COLORS.statusLearningFill}; }
      g.node-learning > text.node-label { fill: ${ROADMAP_COLORS.nodeText}; text-decoration: underline; }
      g.node-skipped > rect.node-rect { fill: ${ROADMAP_COLORS.statusSkippedFill}; }
      g.node-skipped > text.node-label { fill: ${ROADMAP_COLORS.statusSkippedText}; text-decoration: line-through; }
      g.node-highlighted > rect.node-rect { stroke: ${ROADMAP_COLORS.edgeBlue}; stroke-width: 3.4; }
    `;
    clone.prepend(styleTag);

    const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${course.slug}-tree.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main id="main-content" className="min-h-[calc(100vh-64px)] bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <CourseHeader
        course={course}
        bookmarked={isBookmarked(course.slug)}
        activeTab={activeTab}
        onToggleBookmark={() => toggleBookmark(course.slug)}
        onDownloadSvg={handleDownloadSvg}
        onOpenExport={() => setExportModalOpen(true)}
        onOpenBackup={() => setBackupModalOpen(true)}
        onRequestDelete={() => setConfirmDeleteOpen(true)}
        onChangeTab={setActiveTab}
      />

      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        <ProgressStrip
          stats={stats}
          statusFilter={statusFilter}
          onChangeFilter={setStatusFilter}
        />

        {activeTab === 'tree' ? (
          <CourseTreeCanvas
            layout={layout}
            statuses={statuses}
            activeLessonId={activeLessonEntry?.lesson.id ?? null}
            activeChapterId={activeChapterEntry?.chapter.id ?? null}
            statusFilter={statusFilter}
            svgRef={svgRef}
            onSelectLesson={openItem}
            onSelectChapter={handleSelectChapter}
            onQuickToggleDone={(itemId) => toggleDone(course.slug, itemId)}
            onContextMenuLesson={(itemId, anchor) => {
              clearHoverCloseTimer();
              setContextMenu({ itemId, anchor, trigger: 'contextmenu' });
            }}
            onHoverLesson={(itemId, anchor) => {
              setContextMenu((prev) => {
                if (prev?.trigger === 'contextmenu') {
                  return prev;
                }
                clearHoverCloseTimer();
                return { itemId, anchor, trigger: 'hover' };
              });
            }}
            onLeaveLesson={(itemId) => {
              scheduleHoverClose(itemId);
            }}
          />
        ) : (
          <ChecklistView
            course={course}
            statuses={statuses}
            statusFilter={statusFilter}
            onSelectLesson={openItem}
            onSelectChapter={handleSelectChapter}
            onToggleDone={(itemId) => toggleDone(course.slug, itemId)}
          />
        )}
      </div>

      {/* Right-click / Hover Quick Status Pill */}
      {contextMenu && (
        <QuickStatusPill
          itemId={contextMenu.itemId}
          anchor={contextMenu.anchor}
          currentStatus={getLessonStatus(course.slug, contextMenu.itemId)}
          onSelectStatus={(next) => setLessonStatus(course.slug, contextMenu.itemId, next)}
          onMouseEnter={clearHoverCloseTimer}
          onMouseLeave={() => {
            if (contextMenu.trigger === 'hover') {
              scheduleHoverClose(contextMenu.itemId);
            }
          }}
          onClose={() => {
            clearHoverCloseTimer();
            setContextMenu(null);
          }}
        />
      )}

      {/* 600px Slide-Over Lesson Drawer */}
      {activeLessonEntry && (
        <LessonDrawer
          course={course}
          chapter={activeLessonEntry.chapter}
          lesson={activeLessonEntry.lesson}
          status={getLessonStatus(course.slug, activeLessonEntry.lesson.id)}
          statuses={statuses}
          courseSlug={course.slug}
          onChangeStatus={(next) => {
            if (!hasSubModalOpen) {
              setLessonStatus(course.slug, activeLessonEntry.lesson.id, next);
            }
          }}
          onSelectItem={openItem}
          onOpenMaterialViewer={(resource) => setActiveViewerMaterial(resource)}
          onOpenAssessment={(resource) =>
            setActiveAssessmentMaterial({
              itemId: activeLessonEntry.lesson.id,
              resource,
            })
          }
          onClose={closeDrawer}
        />
      )}

      {/* 600px Slide-Over Chapter Overview Drawer */}
      {activeChapterEntry && (
        <ChapterDrawer
          course={course}
          chapter={activeChapterEntry.chapter}
          status={getLessonStatus(course.slug, activeChapterEntry.chapter.id)}
          statuses={statuses}
          courseSlug={course.slug}
          onChangeStatus={(next) => {
            if (!hasSubModalOpen) {
              setLessonStatus(course.slug, activeChapterEntry.chapter.id, next);
            }
          }}
          onSelectItem={openItem}
          onToggleLessonDone={(lessonId) => toggleDone(course.slug, lessonId)}
          onOpenMaterialViewer={(resource) => setActiveViewerMaterial(resource)}
          onOpenAssessment={(resource) =>
            setActiveAssessmentMaterial({
              itemId: activeChapterEntry.chapter.id,
              resource,
            })
          }
          onClose={closeDrawer}
        />
      )}

      {/* Native In-App Material Viewer Modal */}
      <MaterialViewerModal
        isOpen={Boolean(activeViewerMaterial)}
        resource={activeViewerMaterial}
        onClose={() => setActiveViewerMaterial(null)}
      />

      {/* Interactive Exam / Assignment Runner Modal */}
      {activeAssessmentMaterial && (
        <AssessmentRunnerModal
          isOpen={true}
          courseSlug={course.slug}
          itemId={activeAssessmentMaterial.itemId}
          resource={activeAssessmentMaterial.resource}
          onClose={() => setActiveAssessmentMaterial(null)}
        />
      )}

      {/* Export Course (.course.json) Dialog */}
      <ExportCourseDialog
        open={exportModalOpen}
        course={course}
        onClose={() => setExportModalOpen(false)}
      />

      {/* Export / Import Progress Modal */}
      <ProgressBackupDialog
        open={backupModalOpen}
        onClose={() => setBackupModalOpen(false)}
        course={{ slug: course.slug, code: course.code, title: course.title }}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={`Delete ${course.code}: ${course.title}?`}
        description="This removes the course and all its chapters and sub-lessons from your local catalog."
        confirmLabel="Delete Course"
        onConfirm={() => {
          forgetCourse(course.slug);
          deleteCourse(course.slug);
          setConfirmDeleteOpen(false);
          navigate('/');
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </main>
  );
}
