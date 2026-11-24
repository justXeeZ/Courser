import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { X, Download, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { BRAND } from '@/config/brand';
import { useDialogFocus } from '@/hooks/useDialogFocus';
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
    exportProgressJson,
    importProgressJson,
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
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [activeViewerMaterial, setActiveViewerMaterial] = useState<LessonResource | null>(null);
  const [activeAssessmentMaterial, setActiveAssessmentMaterial] = useState<{
    itemId: string;
    resource: LessonResource;
  } | null>(null);
  const [importText, setImportText] = useState('');
  const [importNotice, setImportNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const backupDialogRef = useRef<HTMLDivElement | null>(null);

  useDialogFocus({
    isOpen: backupModalOpen && !confirmRestoreOpen,
    containerRef: backupDialogRef,
    onEscape: () => setBackupModalOpen(false),
  });

  useEffect(() => {
    setActiveViewerMaterial(null);
    setActiveAssessmentMaterial(null);
    setBackupModalOpen(false);
    setConfirmRestoreOpen(false);
    setExportModalOpen(false);
    setConfirmDeleteOpen(false);
    setContextMenu(null);
  }, [slug]);

  const hasSubModalOpen = Boolean(
    activeViewerMaterial ||
      activeAssessmentMaterial ||
      backupModalOpen ||
      confirmRestoreOpen ||
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

  const handleExportJsonFile = () => {
    const blob = new Blob([exportProgressJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = BRAND.progressBackupFilename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = () => {
    setConfirmRestoreOpen(true);
  };

  const handleConfirmRestore = () => {
    setConfirmRestoreOpen(false);
    const result = importProgressJson(importText);
    if (result.ok) {
      setImportNotice({ ok: true, text: 'Progress restored successfully.' });
      setImportText('');
    } else {
      setImportNotice({ ok: false, text: result.error });
    }
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
        onOpenBackup={() => {
          setImportNotice(null);
          setBackupModalOpen(true);
        }}
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
      {backupModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-modal)] p-4"
          onClick={() => setBackupModalOpen(false)}
        >
          <div
            ref={backupDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Backup and Restore Progress"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 text-[var(--text-primary)] shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Backup &amp; Restore Progress
              </h2>
              <button
                type="button"
                onClick={() => setBackupModalOpen(false)}
                aria-label="Close backup dialog"
                className="rounded-md bg-[var(--surface-2)] p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-xs text-[var(--text-secondary)]">
              Your progress is saved locally in this browser. Export a JSON backup to transfer
              across devices or keep a semester copy.
            </p>

            <button
              type="button"
              onClick={handleExportJsonFile}
              className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--cta-bg)] px-3 py-2 text-sm font-medium text-[var(--cta-text)] hover:bg-[var(--cta-bg-hover)]"
            >
              <Download className="h-4 w-4" />
              Download Progress JSON
            </button>

            <div className="border-t border-[var(--border-subtle)] pt-3">
              <label
                htmlFor="import-progress-json"
                className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
              >
                Restore from JSON
              </label>
              <textarea
                id="import-progress-json"
                rows={4}
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setImportNotice(null);
                }}
                placeholder='Paste exported JSON here (e.g. {"version":1,...})'
                className="mb-2 w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-inset)] p-2 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none"
              />
              {importNotice && (
                <div
                  role={importNotice.ok ? 'status' : 'alert'}
                  className={`mb-2 flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs ${
                    importNotice.ok
                      ? 'border-[var(--status-done-border)] bg-[var(--status-done-bg)] text-[var(--status-done-text)]'
                      : 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
                  }`}
                >
                  {importNotice.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {importNotice.text}
                </div>
              )}
              <button
                type="button"
                onClick={handleImportSubmit}
                disabled={!importText.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--solid-bg)] px-3 py-2 text-sm font-semibold text-[var(--solid-text)] hover:bg-[var(--solid-bg-hover)] disabled:opacity-40"
              >
                <Upload className="h-4 w-4" />
                Restore Progress
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmRestoreOpen}
        title="Restore progress from JSON?"
        description="This will overwrite your current saved progress, bookmarks, and assessment scores across all courses."
        confirmLabel="Restore Progress"
        onConfirm={handleConfirmRestore}
        onCancel={() => setConfirmRestoreOpen(false)}
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
