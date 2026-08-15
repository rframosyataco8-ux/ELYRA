import type { ReactNode } from 'react';
import { LazyMotion, domAnimation, MotionConfig } from 'framer-motion';

/**
 * Proveedor ligero de Framer Motion.
 * - LazyMotion + domAnimation: carga solo features DOM (menos JS).
 * - reducedMotion: "user" respeta prefers-reduced-motion del SO.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
