import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Plus, RotateCcw } from 'lucide-react';
import { BRAND } from '@/config/brand';
import { getCoursesByDepartment } from '@/data/courses';
import { useCourses } from '@/store/useCourseStore';
import { useProgress } from '@/store/useProgressStore';
import { CourseCard } from '@/components/CourseCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ProgressBackupDialog } from '@/components/ProgressBackupDialog';
import type { CourseTree } from '@/types/course';

type CatalogTab = 'all' | 'bookmarked' | 'in-progress';

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { courses, deleteCourse, resetCatalogToDefaults } = useCourses();
  const { isBookmarked, toggleBookmark, getCourseStats, forgetCourse } = useProgress();
  const [courseToDelete, setCourseToDelete] = useState<CourseTree | null>(null);
  const [backupModalOpen, setBackupModalOpen] = useState(false);

  const rawTab = searchParams.get('tab');
  const activeTab: CatalogTab =
    rawTab === 'bookmarked' || rawTab === 'in-progress' ? rawTab : 'all';

  const setTab = (tab: CatalogTab) => {
    if (tab === 'all') setSearchParams({}, { replace: true });
    else setSearchParams({ tab }, { replace: true });
  };

  const filteredCourses = courses.filter((course) => {
    if (activeTab === 'bookmarked') return isBookmarked(course.slug);
    if (activeTab === 'in-progress') {
      const stats = getCourseStats(course);
      return stats.done > 0 || stats.learning > 0;
    }
    return true;
  });

  const departmentGroups = Array.from(getCoursesByDepartment(filteredCourses).entries());

  return (
    <main id="main-content" className="flex min-h-[calc(100vh-64px)] flex-col bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      {/* Light & Dark Hero */}
      <section className="border-b border-[var(--border-subtle)] bg-gradient-to-b from-[var(--surface-1)] to-[var(--surface-canvas)]">
        <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 sm:pt-14">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:mb-3 sm:text-5xl dark:bg-gradient-to-b dark:from-amber-50 dark:to-purple-400 dark:bg-clip-text dark:text-transparent">
            {BRAND.name}
          </h1>
          <p className="max-w-2xl text-base text-[var(--text-secondary)] sm:text-lg">
            {BRAND.heroDescription}
          </p>

          {/* Browse Tabs with purple accent active underline */}
          <div className="mt-6 flex min-w-0 items-center justify-between gap-4">
            <div className="flex min-w-0 gap-6 overflow-x-auto sm:gap-8" role="tablist">
              {(
                [
                  { id: 'all', label: BRAND.shortName },
                  { id: 'bookmarked', label: 'Bookmarked' },
                  { id: 'in-progress', label: 'In Progress' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setTab(tab.id)}
                  className={`border-b-2 pb-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-[var(--accent-purple)] text-[var(--text-primary)]'
                      : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Department Sections & 3-Column Card Grid */}
      <section className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        {departmentGroups.length === 0 ? (
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-8 text-center shadow-xs">
            <p className="mb-1 text-sm font-medium text-[var(--text-primary)]">
              {courses.length === 0
                ? 'Your course catalog is empty.'
                : activeTab === 'bookmarked'
                  ? 'No bookmarked courses yet.'
                  : 'No courses in progress yet.'}
            </p>
            <p className="mb-5 text-xs text-[var(--text-secondary)]">
              {courses.length === 0
                ? 'Create your own college course tree or restore the default sample courses.'
                : 'Open any course tree to start tracking lessons or click the bookmark icon on a card.'}
            </p>
            {courses.length === 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <Link
                  to="/editor/new"
                  className="inline-flex items-center gap-1.5 rounded-md bg-[var(--cta-bg)] px-3.5 py-2 text-xs font-semibold text-[var(--cta-text)] hover:bg-[var(--cta-bg-hover)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create First Course
                </Link>
                <button
                  type="button"
                  onClick={resetCatalogToDefaults}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore Sample Courses
                </button>
              </div>
            )}
          </div>
        ) : (
          departmentGroups.map(([department, deptCourses]) => (
            <div key={department}>
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  {department}
                </h2>
                <span className="font-mono text-xs text-[var(--text-muted)]">
                  {deptCourses.length}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                {deptCourses.map((course) => (
                  <CourseCard
                    key={course.slug}
                    course={course}
                    stats={getCourseStats(course)}
                    bookmarked={isBookmarked(course.slug)}
                    onToggleBookmark={() => toggleBookmark(course.slug)}
                    onRequestDelete={() => setCourseToDelete(course)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface-1)]">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-5 text-xs text-[var(--text-secondary)] sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6">
          <span className="leading-relaxed">{BRAND.footerNote}</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border-subtle)] pt-3 sm:shrink-0 sm:border-t-0 sm:pt-0">
            <button
              type="button"
              onClick={() => setBackupModalOpen(true)}
              className="inline-flex items-center gap-1.5 font-medium text-[var(--text-primary)] transition-colors hover:text-[var(--accent-purple)]"
            >
              <Download className="h-3.5 w-3.5" />
              Backup &amp; Restore Progress
            </button>
            <Link
              to="/docs/data-formats"
              className="font-medium text-[var(--text-primary)] transition-colors hover:text-[var(--accent-purple)]"
            >
              Data formats →
            </Link>
          </div>
        </div>
      </footer>

      <ProgressBackupDialog
        open={backupModalOpen}
        onClose={() => setBackupModalOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(courseToDelete)}
        title={
          courseToDelete ? `Delete ${courseToDelete.code}: ${courseToDelete.title}?` : 'Delete Course'
        }
        description="This removes the course and its chapters/sub-lessons from your local catalog."
        confirmLabel="Delete Course"
        onConfirm={() => {
          if (courseToDelete) {
            forgetCourse(courseToDelete.slug);
            deleteCourse(courseToDelete.slug);
          }
          setCourseToDelete(null);
        }}
        onCancel={() => setCourseToDelete(null)}
      />
    </main>
  );
}
