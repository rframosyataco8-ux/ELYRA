import type { Transition, Variants } from 'framer-motion';
import type { AppPage } from '@/lib/users';

/** Transiciones reutilizables (Material-like) */
export const elyTransition = {
  standard: { duration: 0.28, ease: [0.2, 0, 0, 1] } as Transition,
  emphasized: { duration: 0.38, ease: [0.05, 0.7, 0.1, 1] } as Transition,
  spring: { type: 'spring', stiffness: 420, damping: 28 } as Transition,
  springSoft: { type: 'spring', stiffness: 280, damping: 24 } as Transition,
  fast: { duration: 0.16, ease: [0.2, 0, 0, 1] } as Transition,
};

/** Entrada vertical + blur (Inicio / Conversación) */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 14, filter: 'blur(4px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: elyTransition.emphasized,
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: 'blur(2px)',
    transition: elyTransition.fast,
  },
};

/** Entrada lateral (Laboratorio) */
export const pageSideVariants: Variants = {
  initial: { opacity: 0, x: 22, filter: 'blur(3px)' },
  animate: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: elyTransition.emphasized,
  },
  exit: {
    opacity: 0,
    x: -14,
    filter: 'blur(2px)',
    transition: elyTransition.fast,
  },
};

/** Entrada con escala (Configuración) */
export const pageScaleVariants: Variants = {
  initial: { opacity: 0, scale: 0.96, filter: 'blur(3px)' },
  animate: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: elyTransition.emphasized,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    filter: 'blur(2px)',
    transition: elyTransition.fast,
  },
};

/** Solo fade (suave, poco movimiento) */
export const pageFadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.32, ease: [0.2, 0, 0, 1] },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.18 },
  },
};

/** Fade + scale muy sutil */
export const pageSoftVariants: Variants = {
  initial: { opacity: 0, scale: 0.985, y: 6 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: elyTransition.emphasized,
  },
  exit: {
    opacity: 0,
    scale: 0.99,
    y: -4,
    transition: elyTransition.fast,
  },
};

export type PageMotionKind = 'default' | 'side' | 'scale' | 'fade' | 'soft';

/** Elige variante según la página de la app */
export function pageMotionKind(page: AppPage): PageMotionKind {
  if (
    page === 'productos' ||
    page === 'afq' ||
    page === 'registro-prensa' ||
    page === 'cronograma'
  ) {
    return 'side';
  }
  if (page === 'config') return 'scale';
  if (page === 'asistente') return 'soft';
  return 'default';
}

export function getPageVariants(kind: PageMotionKind): Variants {
  switch (kind) {
    case 'side':
      return pageSideVariants;
    case 'scale':
      return pageScaleVariants;
    case 'fade':
      return pageFadeVariants;
    case 'soft':
      return pageSoftVariants;
    default:
      return pageVariants;
  }
}

/** Stagger de lista / nav */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.04, delayChildren: 0.04 },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: elyTransition.standard,
  },
};

/** Collapse altura (laboratorio / sidebar groups) */
export const collapseVariants: Variants = {
  open: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: elyTransition.emphasized,
      opacity: { duration: 0.2 },
    },
  },
  closed: {
    height: 0,
    opacity: 0,
    transition: {
      height: elyTransition.standard,
      opacity: { duration: 0.15 },
    },
  },
};

/** Microinteracción de botón */
export const buttonTap = { scale: 0.96 };
export const buttonHover = { scale: 1.02 };

export const iconButtonMotion = {
  whileHover: { scale: 1.08 },
  whileTap: { scale: 0.92 },
  transition: elyTransition.spring,
};

export const primaryButtonMotion = {
  whileHover: { scale: 1.02, y: -1 },
  whileTap: { scale: 0.97 },
  transition: elyTransition.springSoft,
};
