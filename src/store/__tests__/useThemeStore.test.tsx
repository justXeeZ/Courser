import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { THEME_STORAGE_KEY, ThemeProvider, useTheme } from '@/store/useThemeStore';

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

function createMatchMediaMock(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const mql = {
    get matches() {
      return matches;
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn((_type: string, cb: (event: MediaQueryListEvent) => void) => {
      listeners.add(cb);
    }),
    removeEventListener: vi.fn((_type: string, cb: (event: MediaQueryListEvent) => void) => {
      listeners.delete(cb);
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };

  return {
    matchMedia: vi.fn().mockReturnValue(mql),
    setMatches(next: boolean) {
      matches = next;
      const event = { matches: next, media: '(prefers-color-scheme: dark)' } as MediaQueryListEvent;
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}

describe('useThemeStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('defaults to system mode, follows OS preference changes, and toggles .dark class', () => {
    const mm = createMatchMediaMock(true);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: mm.matchMedia,
    });

    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.mode).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => {
      mm.setMatches(false);
    });
    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists explicit mode selection and supports cycleMode', () => {
    const mm = createMatchMediaMock(false);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: mm.matchMedia,
    });

    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.mode).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => {
      result.current.cycleMode();
    });
    expect(result.current.mode).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    act(() => {
      result.current.cycleMode();
    });
    expect(result.current.mode).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    act(() => {
      result.current.setMode('dark');
    });
    expect(result.current.mode).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
