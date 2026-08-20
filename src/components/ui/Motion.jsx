import { LazyMotion, MotionConfig, domAnimation, m, useReducedMotion } from 'motion/react';
import { cx } from './utils.js';
import { MOTION_EASE, MOTION_TIMING } from './motionConfig.js';

export function MotionProvider({ children }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: MOTION_TIMING.enter, ease: MOTION_EASE.enter }}
    >
      <LazyMotion features={domAnimation} strict>{children}</LazyMotion>
    </MotionConfig>
  );
}

export function MotionPage({ className, children, ...props }) {
  const reduceMotion = useReducedMotion();

  return (
    <m.main
      className={cx('ui-motion-page', className)}
      initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
      transition={{ duration: MOTION_TIMING.enter, ease: MOTION_EASE.enter }}
      {...props}
    >
      {children}
    </m.main>
  );
}

export function MotionToast({ children, className }) {
  const reduceMotion = useReducedMotion();
  return (
    <m.div
      className={cx('toast', className)}
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: MOTION_TIMING.feedback, ease: MOTION_EASE.enter }}
    >
      {children}
    </m.div>
  );
}
