import { useEffect, useRef, useState } from 'react';

export function useStickyHeader(isExpanded: boolean, fallbackTop: number) {
  const [isStuck, setIsStuck] = useState(false);
  const headerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isExpanded) {
      setIsStuck(false);
      return;
    }

    const updateStuck = () => {
      const el = headerRef.current;
      if (!el) return;
      const computedTop = parseFloat(window.getComputedStyle(el).top);
      const targetTop = Number.isFinite(computedTop) ? computedTop : fallbackTop;
      const rect = el.getBoundingClientRect();
      setIsStuck(window.scrollY > 0 && Math.abs(rect.top - targetTop) <= 1.5);
    };

    updateStuck();
    window.addEventListener('scroll', updateStuck, { passive: true });
    window.addEventListener('resize', updateStuck);
    return () => {
      window.removeEventListener('scroll', updateStuck);
      window.removeEventListener('resize', updateStuck);
    };
  }, [isExpanded, fallbackTop]);

  return { headerRef, isStuck };
}
