import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { CourseProvider } from '@/store/useCourseStore';
import { ProgressProvider, useProgress } from '@/store/useProgressStore';
import { Navbar } from '@/components/Navbar';
import { SearchModal } from '@/components/SearchModal';
import { CatalogPage } from '@/pages/CatalogPage';
import { CoursePage } from '@/pages/CoursePage';
import { CourseEditorPage } from '@/pages/CourseEditorPage';

function AppShell() {
  const { state } = useProgress();
  const [searchOpen, setSearchOpen] = useState(false);

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
    <div className="min-h-screen bg-black">
      <Navbar
        bookmarkCount={state.bookmarks.length}
        onOpenSearch={() => setSearchOpen(true)}
      />
      <Routes>
        <Route path="/" element={<CatalogPage />} />
        <Route path="/editor/new" element={<CourseEditorPage />} />
        <Route path="/course/:slug" element={<CoursePage />} />
        <Route path="/course/:slug/edit" element={<CourseEditorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <CourseProvider>
      <ProgressProvider>
        <AppShell />
      </ProgressProvider>
    </CourseProvider>
  );
}
