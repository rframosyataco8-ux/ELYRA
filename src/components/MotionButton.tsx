import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { iconButtonMotion, primaryButtonMotion, elyTransition } from '@/lib/motion';

type Variant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'danger';

type Props = Omit<HTMLMotionProps<'button'>, 'children'> &
  ButtonHTMLAttributes<HTMLButtonElement> &
  {
    variant?: Variant;
    children?: ReactNode;
    /** Desactiva scale hover/tap */
    static?: boolean;
  };

const variantClass: Record<Variant, string> = {
  primary: 'ely-btn-primary',
  secondary: 'ely-btn-secondary',
  ghost: 'ely-btn-ghost',
  icon: 'ely-icon-btn',
  danger: 'ely-btn-danger',
};

export const MotionButton = forwardRef<HTMLButtonElement, Props>(function MotionButton(
  { variant = 'ghost', className = '', children, static: isStatic, disabled, ...rest },
  ref,
) {
  const motionProps =
    isStatic || disabled
      ? {}
      : variant === 'icon'
        ? iconButtonMotion
        : variant === 'primary' || variant === 'secondary'
          ? primaryButtonMotion
          : {
              whileHover: { scale: 1.02 },
              whileTap: { scale: 0.97 },
              transition: elyTransition.springSoft,
            };

  return (
    <motion.button
      ref={ref}
      type="button"
      className={`${variantClass[variant]} ${className}`.trim()}
      disabled={disabled}
      {...motionProps}
      {...rest}
    >
      {children}
    </motion.button>
  );
});
