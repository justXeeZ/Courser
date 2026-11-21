import { Link } from 'react-router-dom';
import { Search, Bookmark, Plus } from 'lucide-react';

interface NavbarProps {
  bookmarkCount: number;
  onOpenSearch: () => void;
}

export function Navbar({ bookmarkCount, onOpenSearch }: NavbarProps) {
  return (
    <header className="border-b border-slate-800/80 bg-slate-900 text-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-lg font-medium text-white transition-opacity hover:opacity-90"
          >
            <span className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-md bg-white font-mono text-lg font-extrabold tracking-tight text-slate-900">
              c.
            </span>
            <span className="hidden font-semibold tracking-tight sm:inline">Course Trees</span>
          </Link>

          <nav className="flex items-center gap-5 text-sm text-slate-300">
            <Link to="/" className="transition-colors hover:text-white">
              Courses
            </Link>
            <Link
              to="/?tab=bookmarked"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-white"
            >
              <Bookmark className="h-3.5 w-3.5 text-yellow-400" />
              Bookmarked
              {bookmarkCount > 0 && (
                <span className="rounded-full bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-200">
                  {bookmarkCount}
                </span>
              )}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-700 bg-slate-800/80 px-2.5 text-xs text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
            aria-label="Search courses and lessons"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search lessons...</span>
            <kbd className="hidden rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] text-slate-400 sm:inline">
              Ctrl K
            </kbd>
          </button>

          <Link
            to="/editor/new"
            className="inline-flex h-8 items-center justify-center gap-1 rounded-full bg-gradient-to-r from-blue-500 to-blue-700 px-3.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Course</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
