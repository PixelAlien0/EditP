import { LazyMotion, MotionConfig, domAnimation, m } from 'motion/react';
import { cx } from './utils.js';
import { MOTION_TRANSITION, MOTION_VARIANTS } from './motionConfig.js';

export function MotionProvider({ children }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={MOTION_TRANSITION.enter}
    >
      <LazyMotion features={domAnimation} strict>{children}</LazyMotion>
    </MotionConfig>
  );
}

export function MotionPage({ className, children, ...props }) {
  return (
    <m.main
      className={cx('ui-motion-page', className)}
      variants={MOTION_VARIANTS.page}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={MOTION_TRANSITION.enter}
      {...props}
    >
      {children}
    </m.main>
  );
}

export function MotionToast({ children, className }) {
  return (
    <m.div
      className={cx('toast', className)}
      role="status"
      aria-live="polite"
      variants={MOTION_VARIANTS.feedback}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={MOTION_TRANSITION.feedback}
    >
      {children}
    </m.div>
  );
}
