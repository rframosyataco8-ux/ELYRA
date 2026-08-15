import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { useSpring, animated } from '@react-spring/web';
import type { AppPage } from '@/lib/users';
import { pageMotionKind } from '@/lib/motion';
import { springPageFrames, springPresetFor } from '@/lib/springVariants';

interface PageTransitionProps {
  page: AppPage;
  className?: string;
  children: ReactNode;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Transición de página con React Spring + variantes por ruta.
 * Solo opacity + transform3d (GPU).
 */
export function PageTransition({ page, className = '', children }: PageTransitionProps) {
  const kind = pageMotionKind(page);
  const frames = useMemo(() => springPageFrames(kind), [kind]);
  const springConfig = useMemo(() => springPresetFor(kind), [kind]);
  const reduced = prefersReducedMotion();

  const [style, api] = useSpring(() => ({
    opacity: 1,
    transform: 'translate3d(0,0,0)',
    config: springConfig,
  }));

  useEffect(() => {
    if (reduced) {
      api.set({ opacity: 1, transform: 'translate3d(0,0,0)' });
      return;
    }
    api.start({
      from: frames.from,
      to: frames.to,
      config: springConfig,
    });
  }, [page, frames, springConfig, reduced, api]);

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
