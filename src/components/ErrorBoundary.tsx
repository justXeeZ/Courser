import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught application error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--surface-canvas)] p-6 text-[var(--text-primary)]">
          <div className="w-full max-w-md rounded-xl border border-[var(--status-danger-border)] bg-[var(--surface-1)] p-6 shadow-lg">
            <div className="flex items-center gap-3 text-[var(--status-danger-text)]">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h1 className="text-lg font-bold">Something went wrong</h1>
            </div>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {this.state.message}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--cta-bg)] px-3.5 py-2 text-xs font-semibold text-[var(--cta-text)] hover:bg-[var(--cta-bg-hover)]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reload App
              </button>
              <a
                href={import.meta.env.BASE_URL || '/'}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--surface-2)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
              >
                <Home className="h-3.5 w-3.5" />
                Return to Catalog
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
