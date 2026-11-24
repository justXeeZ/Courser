import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { CourseProvider, useCourses } from '@/store/useCourseStore';
import { ProgressProvider, useProgress } from '@/store/useProgressStore';
import { ThemeProvider } from '@/store/useThemeStore';
import { NavigationGuardProvider } from '@/context/NavigationGuardContext';
import {
  collectReferencedFileIds,
  garbageCollectFiles,
  hasActiveEditorLease,
} from '@/lib/fileStore';
import { Navbar } from '@/components/Navbar';
import { SearchModal } from '@/components/SearchModal';
import { CatalogPage } from '@/pages/CatalogPage';

const CoursePage = lazy(() =>
  import('@/pages/CoursePage').then((m) => ({ default: m.CoursePage }))
);
const CourseEditorPage = lazy(() =>
  import('@/pages/CourseEditorPage').then((m) => ({ default: m.CourseEditorPage }))
);
const DataFormatsPage = lazy(() =>
  import('@/pages/DataFormatsPage').then((m) => ({ default: m.DataFormatsPage }))
);

function AppShell() {
  const {
    courses,
    catalogRecovery,
    dismissCatalogRecovery,
    persistError: coursePersistError,
    dismissPersistError: dismissCoursePersistError,
  } = useCourses();
  const {
    state,
    persistError: progressPersistError,
    dismissPersistError: dismissProgressPersistError,
  } = useProgress();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const gcRanRef = useRef(false);

  useEffect(() => {
    if (gcRanRef.current) return;
    if (catalogRecovery !== null) return;
    if (location.pathname.startsWith('/editor') || location.pathname.endsWith('/edit')) {
      return;
    }
    if (hasActiveEditorLease()) {
      return;
    }
    gcRanRef.current = true;
    void garbageCollectFiles(collectReferencedFileIds(courses)).catch(() => {
      // Ignore IndexedDB unavailability in restricted browser contexts
    });
  }, [courses, location.pathname, catalogRecovery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (!isTyping && e.key === '/') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeAlert = catalogRecovery
    ? {
        message:
          catalogRecovery.status === 'corrupt'
            ? `Stored course catalog could not be parsed and was reset to defaults.${catalogRecovery.backedUp ? ' A backup of the raw data was saved in browser storage.' : ''}`
            : `Recovered course catalog with ${catalogRecovery.droppedCount} invalid course${catalogRecovery.droppedCount === 1 ? '' : 's'} skipped.${catalogRecovery.backedUp ? ' A backup of the raw data was saved in browser storage.' : ''}`,
        onDismiss: dismissCatalogRecovery,
      }
    : coursePersistError
      ? {
          message: coursePersistError,
          onDismiss: dismissCoursePersistError,
        }
      : progressPersistError
        ? {
            message: progressPersistError,
            onDismiss: dismissProgressPersistError,
          }
        : null;

  return (
    <div className="min-h-screen bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-[var(--cta-bg)] focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-[var(--cta-text)] focus:shadow-lg"
      >
        Skip to main content
      </a>
      <Navbar
        bookmarkCount={state.bookmarks.length}
        onOpenSearch={() => setSearchOpen(true)}
      />
      {activeAlert && (
        <div
          role="alert"
          className="border-b border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-2.5 text-sm text-[var(--status-danger-text)]"
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{activeAlert.message}</span>
            </div>
            <button
              type="button"
              onClick={activeAlert.onDismiss}
              aria-label="Dismiss storage alert"
              className="rounded p-1 hover:bg-[var(--surface-hover)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <Suspense
        fallback={
          <div className="mx-auto max-w-5xl px-4 py-12 text-center text-sm text-[var(--text-muted)]">
            Loading...
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/editor/new" element={<CourseEditorPage />} />
          <Route path="/course/:slug" element={<CoursePage />} />
          <Route path="/course/:slug/edit" element={<CourseEditorPage />} />
          <Route path="/docs/data-formats" element={<DataFormatsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <CourseProvider>
        <ProgressProvider>
          <NavigationGuardProvider>
            <AppShell />
          </NavigationGuardProvider>
        </ProgressProvider>
      </CourseProvider>
    </ThemeProvider>
  );
}
