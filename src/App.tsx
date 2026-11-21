import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { CourseProvider, useCourses } from '@/store/useCourseStore';
import { ProgressProvider, useProgress } from '@/store/useProgressStore';
import { ThemeProvider } from '@/store/useThemeStore';
import { collectReferencedFileIds, garbageCollectFiles } from '@/lib/fileStore';
import { Navbar } from '@/components/Navbar';
import { SearchModal } from '@/components/SearchModal';
import { CatalogPage } from '@/pages/CatalogPage';
import { CoursePage } from '@/pages/CoursePage';
import { CourseEditorPage } from '@/pages/CourseEditorPage';
import { DataFormatsPage } from '@/pages/DataFormatsPage';

function AppShell() {
  const { courses } = useCourses();
  const { state } = useProgress();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const gcRanRef = useRef(false);

  useEffect(() => {
    if (gcRanRef.current) return;
    if (location.pathname.startsWith('/editor') || location.pathname.endsWith('/edit')) {
      return;
    }
    gcRanRef.current = true;
    void garbageCollectFiles(collectReferencedFileIds(courses)).catch(() => {
      // Ignore IndexedDB unavailability in restricted browser contexts
    });
  }, [courses, location.pathname]);

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <Navbar
        bookmarkCount={state.bookmarks.length}
        onOpenSearch={() => setSearchOpen(true)}
      />
      <Routes>
        <Route path="/" element={<CatalogPage />} />
        <Route path="/editor/new" element={<CourseEditorPage />} />
        <Route path="/course/:slug" element={<CoursePage />} />
        <Route path="/course/:slug/edit" element={<CourseEditorPage />} />
        <Route path="/docs/data-formats" element={<DataFormatsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <CourseProvider>
        <ProgressProvider>
          <AppShell />
        </ProgressProvider>
      </CourseProvider>
    </ThemeProvider>
  );
}
