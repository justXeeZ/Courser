import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { X, Download, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { findLessonWithChapter } from '@/data/validateCourse';
import { layoutCourseTree } from '@/lib/layoutTree';
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
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { Chapter } from '@/types/course';

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
    getCourseStats,
    exportProgressJson,
    importProgressJson,
  } = useProgress();

  const [activeTab, setActiveTab] = useState<CourseViewTab>('tree');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [contextMenu, setContextMenu] = useState<{
    lessonId: string;
    anchor: NodeAnchorRect;
  } | null>(null);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importNotice, setImportNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const layout = useMemo(() => (course ? layoutCourseTree(course) : null), [course]);

  if (!course || !layout) {
    return (
      <main className="min-h-[calc(100vh-64px)] bg-gray-50 px-4 py-16">
        <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center shadow-xs">
          <h1 className="mb-2 text-xl font-bold text-gray-900">Course Not Found</h1>
          <p className="mb-5 text-sm text-gray-500">
            We could not find a course tree matching <code className="font-mono">{slug}</code>.
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

  const statuses = getCourseStatuses(course.slug);
  const stats = getCourseStats(course);
  const requestedLessonId = searchParams.get('lesson');
  const activeEntry = requestedLessonId
    ? findLessonWithChapter(course, requestedLessonId)
    : undefined;

  const openLesson = (lessonId: string) => {
    setContextMenu(null);
    setSearchParams({ lesson: lessonId }, { replace: false });
  };

  const closeLesson = () => {
    setSearchParams({}, { replace: true });
  };

  const handleSelectChapter = (chapter: Chapter) => {
    const firstLesson = chapter.lessons[0];
    if (firstLesson) {
      openLesson(firstLesson.id);
    }
  };

  const handleDownloadSvg = () => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const styleTag = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleTag.textContent = `
      text { font-family: "Balsamiq Sans", ui-sans-serif, system-ui, sans-serif; }
      g.node-done > rect.node-rect { fill: #cbcbcb; }
      g.node-done > text.node-label { text-decoration: line-through; }
      g.node-learning > rect.node-rect { fill: #dad1fd; }
      g.node-learning > text.node-label { text-decoration: underline; }
      g.node-skipped > rect.node-rect { fill: #496b69; }
      g.node-skipped > text.node-label { fill: #ffffff; text-decoration: line-through; }
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
    a.download = 'college-course-progress.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = () => {
    const result = importProgressJson(importText);
    if (result.ok) {
      setImportNotice({ ok: true, text: 'Progress restored successfully.' });
      setImportText('');
    } else {
      setImportNotice({ ok: false, text: result.error });
    }
  };

  return (
    <main className="min-h-[calc(100vh-64px)] bg-gray-50">
      <CourseHeader
        course={course}
        bookmarked={isBookmarked(course.slug)}
        activeTab={activeTab}
        onToggleBookmark={() => toggleBookmark(course.slug)}
        onDownloadSvg={handleDownloadSvg}
        onOpenBackup={() => {
          setImportNotice(null);
          setBackupModalOpen(true);
        }}
        onRequestDelete={() => setConfirmDeleteOpen(true)}
        onChangeTab={setActiveTab}
      />

      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <ProgressStrip
          stats={stats}
          statusFilter={statusFilter}
          onChangeFilter={setStatusFilter}
        />

        {activeTab === 'tree' ? (
          <CourseTreeCanvas
            layout={layout}
            statuses={statuses}
            activeLessonId={activeEntry?.lesson.id ?? null}
            statusFilter={statusFilter}
            svgRef={svgRef}
            onSelectLesson={openLesson}
            onSelectChapter={handleSelectChapter}
            onQuickToggleDone={(lessonId) => toggleDone(course.slug, lessonId)}
            onContextMenuLesson={(lessonId, anchor) => setContextMenu({ lessonId, anchor })}
          />
        ) : (
          <ChecklistView
            course={course}
            statuses={statuses}
            statusFilter={statusFilter}
            onSelectLesson={openLesson}
            onToggleDone={(lessonId) => toggleDone(course.slug, lessonId)}
          />
        )}
      </div>

      {/* Right-click Quick Status Pill */}
      {contextMenu && (
        <QuickStatusPill
          anchor={contextMenu.anchor}
          currentStatus={getLessonStatus(course.slug, contextMenu.lessonId)}
          onSelectStatus={(next) => setLessonStatus(course.slug, contextMenu.lessonId, next)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 600px Slide-Over Lesson Drawer */}
      {activeEntry && (
        <LessonDrawer
          course={course}
          chapter={activeEntry.chapter}
          lesson={activeEntry.lesson}
          status={getLessonStatus(course.slug, activeEntry.lesson.id)}
          statuses={statuses}
          onChangeStatus={(next) => setLessonStatus(course.slug, activeEntry.lesson.id, next)}
          onNavigateLesson={openLesson}
          onClose={closeLesson}
        />
      )}

      {/* Export / Import Progress Modal */}
      {backupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Backup and Restore Progress"
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Backup &amp; Restore Progress</h2>
              <button
                type="button"
                onClick={() => setBackupModalOpen(false)}
                aria-label="Close backup dialog"
                className="rounded-md bg-gray-100 p-1.5 text-gray-600 hover:bg-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-xs text-gray-600">
              Your progress is saved locally in this browser. Export a JSON backup to transfer
              across devices or keep a semester copy.
            </p>

            <button
              type="button"
              onClick={handleExportJsonFile}
              className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-yellow-400 px-3 py-2 text-sm font-medium text-black hover:bg-yellow-500"
            >
              <Download className="h-4 w-4" />
              Download Progress JSON
            </button>

            <div className="border-t border-gray-200 pt-3">
              <label
                htmlFor="import-progress-json"
                className="mb-1.5 block text-xs font-medium text-gray-700"
              >
                Restore from JSON
              </label>
              <textarea
                id="import-progress-json"
                rows={4}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='Paste exported JSON here (e.g. {"version":1,...})'
                className="mb-2 w-full rounded-md border border-gray-300 p-2 font-mono text-xs text-gray-800 focus:border-blue-500 focus:outline-none"
              />
              {importNotice && (
                <div
                  className={`mb-2 flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs ${
                    importNotice.ok
                      ? 'bg-green-50 text-green-800'
                      : 'bg-red-50 text-red-700'
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
              >
                <Upload className="h-4 w-4" />
                Restore Progress
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={`Delete ${course.code}: ${course.title}?`}
        description="This removes the course and all its chapters and sub-lessons from your local catalog."
        confirmLabel="Delete Course"
        onConfirm={() => {
          deleteCourse(course.slug);
          setConfirmDeleteOpen(false);
          navigate('/');
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </main>
  );
}
