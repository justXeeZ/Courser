import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, RotateCcw } from 'lucide-react';
import { BRAND } from '@/config/brand';
import { getCoursesByDepartment } from '@/data/courses';
import { useCourses } from '@/store/useCourseStore';
import { useProgress } from '@/store/useProgressStore';
import { CourseCard } from '@/components/CourseCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { CourseTree } from '@/types/course';

type CatalogTab = 'all' | 'bookmarked' | 'in-progress';

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { courses, deleteCourse, resetCatalogToDefaults } = useCourses();
  const { isBookmarked, toggleBookmark, getCourseStats, forgetCourse } = useProgress();
  const [courseToDelete, setCourseToDelete] = useState<CourseTree | null>(null);

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
    <main className="flex min-h-[calc(100vh-64px)] flex-col bg-slate-50 text-slate-900 dark:bg-[#0b0f17] dark:text-slate-100">
      {/* Light & Dark Hero */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50 dark:border-slate-800/80 dark:from-[#121926] dark:to-[#0b0f17]">
        <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 sm:pt-14">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-900 sm:mb-3 sm:text-5xl dark:bg-gradient-to-b dark:from-amber-50 dark:to-purple-400 dark:bg-clip-text dark:text-transparent">
            {BRAND.name}
          </h1>
          <p className="max-w-2xl text-base text-slate-600 sm:text-lg dark:text-slate-400">
            {BRAND.heroDescription}
          </p>

          {/* Browse Tabs with amber/yellow active underline */}
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
                      ? 'border-amber-500 text-slate-900 dark:border-yellow-400 dark:text-white'
                      : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
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
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-xs dark:border-slate-700/80 dark:bg-[#121926]">
            <p className="mb-1 text-sm font-medium text-slate-900 dark:text-slate-100">
              {courses.length === 0
                ? 'Your course catalog is empty.'
                : activeTab === 'bookmarked'
                  ? 'No bookmarked courses yet.'
                  : 'No courses in progress yet.'}
            </p>
            <p className="mb-5 text-xs text-slate-600 dark:text-slate-400">
              {courses.length === 0
                ? 'Create your own college course tree or restore the default sample courses.'
                : 'Open any course tree to start tracking lessons or click the bookmark icon on a card.'}
            </p>
            {courses.length === 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <Link
                  to="/editor/new"
                  className="inline-flex items-center gap-1.5 rounded-md bg-yellow-400 px-3.5 py-2 text-xs font-semibold text-black hover:bg-yellow-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create First Course
                </Link>
                <button
                  type="button"
                  onClick={resetCatalogToDefaults}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
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
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {department}
                </h2>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
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

      <footer className="border-t border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-[#0b0f17]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-slate-600 sm:px-6 dark:text-slate-400">
          <span>{BRAND.footerNote}</span>
          <Link
            to="/docs/data-formats"
            className="font-medium text-slate-800 transition-colors hover:text-amber-700 dark:text-slate-300 dark:hover:text-yellow-400"
          >
            Data formats →
          </Link>
        </div>
      </footer>

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
