import type { ReactNode } from 'react';
import { LazyMotion, domAnimation, MotionConfig } from 'framer-motion';

/**
 * Proveedor ligero de Framer Motion.
 * - LazyMotion + domAnimation: bundle más pequeño (solo APIs DOM).
 * - reducedMotion: "user" respeta prefers-reduced-motion del SO.
 * - strict desactivado: el Sidebar y demás usan `motion.*` sin migrar a `m`.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
