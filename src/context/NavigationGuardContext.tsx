import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export interface NavigationGuard {
  isDirty: boolean;
  onBlockedNavigate: (to: string) => void;
}

interface NavigationGuardContextValue {
  registerGuard: (guard: NavigationGuard) => () => void;
  navigateWithGuard: (to: string) => void;
}

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null);

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const guardRef = useRef<NavigationGuard | null>(null);

  const registerGuard = useCallback((guard: NavigationGuard) => {
    guardRef.current = guard;
    return () => {
      if (guardRef.current === guard) {
        guardRef.current = null;
      }
    };
  }, []);

  const navigateWithGuard = useCallback(
    (to: string) => {
      if (guardRef.current?.isDirty) {
        guardRef.current.onBlockedNavigate(to);
        return;
      }
      navigate(to);
    },
    [navigate]
  );

  return (
    <NavigationGuardContext.Provider value={{ registerGuard, navigateWithGuard }}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard(): NavigationGuardContextValue {
  const ctx = useContext(NavigationGuardContext);
  const navigate = useNavigate();
  if (!ctx) {
    return {
      registerGuard: () => () => {},
      navigateWithGuard: (to: string) => navigate(to),
    };
  }
  return ctx;
}
