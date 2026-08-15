import { config, type SpringConfig } from '@react-spring/web';
import type { PageMotionKind } from '@/lib/motion';

export type SpringFrame = { opacity: number; transform: string };

export type SpringPresetName = 'gentle' | 'snappy' | 'molasses' | 'wobbly' | 'stiff';

/** Configs reutilizables de React Spring */
export const springPresets: Record<SpringPresetName, SpringConfig> = {
  gentle: { ...config.gentle, clamp: true },
  snappy: { tension: 300, friction: 28, clamp: true },
  molasses: { ...config.molasses, clamp: true },
  wobbly: { ...config.wobbly, clamp: true },
  stiff: { ...config.stiff, clamp: true },
};

/** Frames from→to por tipo de página */
export function springPageFrames(kind: PageMotionKind): { from: SpringFrame; to: SpringFrame } {
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
        from: { opacity: 0, transform: 'translate3d(0,0,0)' },
        to: { opacity: 1, transform: 'translate3d(0,0,0)' },
      };
    default:
      return {
        from: { opacity: 0, transform: 'translate3d(0,12px,0)' },
        to: { opacity: 1, transform: 'translate3d(0,0,0)' },
      };
  }
}

/** Preset de spring según el tipo de página */
export function springPresetFor(kind: PageMotionKind): SpringConfig {
  switch (kind) {
    case 'side':
      return springPresets.snappy;
    case 'scale':
      return springPresets.gentle;
    case 'soft':
      return springPresets.gentle;
    case 'fade':
      return springPresets.molasses;
    default:
      return springPresets.gentle;
  }
}

/** Fade simple para overlays / toasts */
export const springFadeIn = {
  from: { opacity: 0 },
  to: { opacity: 1 },
  config: springPresets.gentle,
};

/** Pop de chip / status */
export const springPop = {
  from: { opacity: 0, transform: 'scale(0.92)' },
  to: { opacity: 1, transform: 'scale(1)' },
  config: springPresets.snappy,
};
