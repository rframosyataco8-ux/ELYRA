import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { useSpring, animated, config } from '@react-spring/web';
import type { AppPage } from '@/lib/users';
import { pageMotionKind, type PageMotionKind } from '@/lib/motion';

interface PageTransitionProps {
  page: AppPage;
  className?: string;
  children: ReactNode;
}

type SpringFrom = { opacity: number; transform: string };

function springEnter(kind: PageMotionKind): { from: SpringFrom; to: SpringFrom } {
  switch (kind) {
    case 'side':
      return {
        from: { opacity: 0, transform: 'translate3d(18px,0,0)' },
        to: { opacity: 1, transform: 'translate3d(0,0,0)' },
      };
    case 'scale':
      return {
        from: { opacity: 0, transform: 'scale(0.97)' },
        to: { opacity: 1, transform: 'scale(1)' },
      };
    case 'soft':
      return {
        from: { opacity: 0, transform: 'translate3d(0,6px,0) scale(0.985)' },
        to: { opacity: 1, transform: 'translate3d(0,0,0) scale(1)' },
      };
    case 'fade':
      return {
        from: { opacity: 0, transform: 'none' },
        to: { opacity: 1, transform: 'none' },
      };
    default:
      return {
        from: { opacity: 0, transform: 'translate3d(0,12px,0)' },
        to: { opacity: 1, transform: 'translate3d(0,0,0)' },
      };
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Transición de página con React Spring.
 * Solo anima la entrada al cambiar `page` (opacity + transform3d → GPU).
 * No desmonta el árbol anterior con leave (evita desync con children de React).
 */
export function PageTransition({ page, className = '', children }: PageTransitionProps) {
  const kind = pageMotionKind(page);
  const frames = useMemo(() => springEnter(kind), [kind]);
  const reduced = prefersReducedMotion();

  const [style, api] = useSpring(() => ({
    opacity: 1,
    transform: 'translate3d(0,0,0)',
    config: { ...config.gentle, clamp: true },
  }));

  useEffect(() => {
    if (reduced) {
      api.set({ opacity: 1, transform: 'none' });
      return;
    }
    api.start({
      from: frames.from,
      to: frames.to,
    });
  }, [page, frames, reduced, api]);

  return (
    <animated.div
      key={page}
      className={`flex-1 flex flex-col min-h-0 ${className}`.trim()}
      style={style}
    >
      {children}
    </animated.div>
  );
}
