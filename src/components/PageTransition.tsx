import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useTransition, animated, config } from '@react-spring/web';
import type { AppPage } from '@/lib/users';
import { pageMotionKind, type PageMotionKind } from '@/lib/motion';

interface PageTransitionProps {
  page: AppPage;
  className?: string;
  children: ReactNode;
}

type SpringFrom = { opacity: number; transform: string };

function springKeyframes(kind: PageMotionKind): {
  from: SpringFrom;
  enter: SpringFrom;
  leave: SpringFrom;
} {
  switch (kind) {
    case 'side':
      return {
        from: { opacity: 0, transform: 'translate3d(20px,0,0)' },
        enter: { opacity: 1, transform: 'translate3d(0,0,0)' },
        leave: { opacity: 0, transform: 'translate3d(-12px,0,0)' },
      };
    case 'scale':
      return {
        from: { opacity: 0, transform: 'scale(0.97)' },
        enter: { opacity: 1, transform: 'scale(1)' },
        leave: { opacity: 0, transform: 'scale(0.99)' },
      };
    case 'soft':
      return {
        from: { opacity: 0, transform: 'translate3d(0,6px,0) scale(0.985)' },
        enter: { opacity: 1, transform: 'translate3d(0,0,0) scale(1)' },
        leave: { opacity: 0, transform: 'translate3d(0,-4px,0) scale(0.99)' },
      };
    case 'fade':
      return {
        from: { opacity: 0, transform: 'none' },
        enter: { opacity: 1, transform: 'none' },
        leave: { opacity: 0, transform: 'none' },
      };
    default:
      return {
        from: { opacity: 0, transform: 'translate3d(0,14px,0)' },
        enter: { opacity: 1, transform: 'translate3d(0,0,0)' },
        leave: { opacity: 0, transform: 'translate3d(0,-8px,0)' },
      };
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Transición de página con React Spring.
 * - Solo opacity + transform (GPU, buen rendimiento).
 * - exitBeforeEnter: evita solapar vistas.
 * - Respeta prefers-reduced-motion.
 */
export function PageTransition({ page, className = '', children }: PageTransitionProps) {
  const kind = pageMotionKind(page);
  const frames = useMemo(() => springKeyframes(kind), [kind]);
  const reduced = prefersReducedMotion();

  const transitions = useTransition(page, {
    from: reduced ? { opacity: 1, transform: 'none' } : frames.from,
    enter: reduced ? { opacity: 1, transform: 'none' } : frames.enter,
    leave: reduced ? { opacity: 1, transform: 'none' } : frames.leave,
    config: reduced ? { duration: 0 } : { ...config.gentle, clamp: true },
    exitBeforeEnter: true,
    immediate: reduced,
  });

  return (
    <>
      {transitions((style, currentPage) =>
        currentPage === page ? (
          <animated.div
            key={currentPage}
            className={`flex-1 flex flex-col min-h-0 ${className}`.trim()}
            style={{
              ...style,
              // will-change solo durante la animación implícita de spring
              position: 'relative',
            }}
          >
            {children}
          </animated.div>
        ) : null,
      )}
    </>
  );
}
