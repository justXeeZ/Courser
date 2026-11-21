import { Link } from 'react-router-dom';
import { Search, Bookmark, Plus, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, type ThemeMode } from '@/store/useThemeStore';

interface NavbarProps {
  bookmarkCount: number;
  onOpenSearch: () => void;
}

const THEME_META: Record<ThemeMode, { label: string; next: string }> = {
  light: { label: 'Theme: Light', next: 'Switch to Dark mode' },
  dark: { label: 'Theme: Dark', next: 'Switch to System mode' },
  system: { label: 'Theme: System', next: 'Switch to Light mode' },
};

export function Navbar({ bookmarkCount, onOpenSearch }: NavbarProps) {
  const { mode, cycleMode } = useTheme();
  const themeMeta = THEME_META[mode];
  const themeTitle = `${themeMeta.label} (${themeMeta.next})`;

  return (
    <header className="border-b border-slate-800/80 bg-slate-900 text-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2.5 text-lg font-medium text-white transition-opacity hover:opacity-90"
          >
            <span className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-md bg-white font-mono text-lg font-extrabold tracking-tight text-slate-900">
              c.
            </span>
            <span className="hidden font-semibold tracking-tight sm:inline">Course Trees</span>
          </Link>

          <nav className="flex items-center gap-3 text-sm text-slate-300 sm:gap-5">
            <Link to="/" className="shrink-0 transition-colors hover:text-white">
              Courses
            </Link>
            <Link
              to="/?tab=bookmarked"
              aria-label={`Bookmarked (${bookmarkCount})`}
              className="inline-flex shrink-0 items-center gap-1.5 transition-colors hover:text-white"
            >
              <Bookmark className="h-3.5 w-3.5 text-yellow-400" />
              <span className="hidden sm:inline">Bookmarked</span>
              {bookmarkCount > 0 && (
                <span className="rounded-full bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-200">
                  {bookmarkCount}
                </span>
              )}
            </Link>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-slate-700 bg-slate-800/80 px-2.5 text-xs text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
            aria-label="Search courses and lessons"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search lessons...</span>
            <kbd className="hidden rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] text-slate-400 sm:inline">
              Ctrl K
            </kbd>
          </button>

          <button
            type="button"
            onClick={cycleMode}
            title={themeTitle}
            aria-label={themeTitle}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800/80 text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
          >
            {mode === 'light' ? (
              <Sun className="h-3.5 w-3.5 text-yellow-400" />
            ) : mode === 'dark' ? (
              <Moon className="h-3.5 w-3.5 text-blue-300" />
            ) : (
              <Monitor className="h-3.5 w-3.5" />
            )}
          </button>

          <Link
            to="/editor/new"
            aria-label="New Course"
            title="New Course"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center gap-1 rounded-full bg-gradient-to-r from-blue-500 to-blue-700 p-0 text-xs font-medium text-white transition-opacity hover:opacity-90 sm:w-auto sm:px-3.5"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">New Course</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
