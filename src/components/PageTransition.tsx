import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AppPage } from '@/lib/users';
import { getPageVariants, pageMotionKind } from '@/lib/motion';

interface PageTransitionProps {
  page: AppPage;
  className?: string;
  children: ReactNode;
}

/**
 * Transición de página con Framer Motion.
 * - mode="wait": sale la vista actual y luego entra la nueva (sin solaparse).
 * - Variante según página (side / scale / soft / default).
 */
export function PageTransition({ page, className = '', children }: PageTransitionProps) {
  const kind = pageMotionKind(page);
  const variants = getPageVariants(kind);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={page}
        className={`flex-1 flex flex-col min-h-0 ${className}`.trim()}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ willChange: 'opacity, transform, filter' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
