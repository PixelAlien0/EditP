export const MOTION_TIMING = Object.freeze({
  instant: 0,
  micro: 0.1,
  feedback: 0.12,
  exit: 0.14,
  enter: 0.18,
  panel: 0.2,
});

export const MOTION_EASE = Object.freeze({
  standard: 'easeOut',
  enter: 'easeOut',
  exit: 'easeIn',
});

export const MOTION_DISTANCE = Object.freeze({
  subtle: 4,
  standard: 8,
  panel: 10,
});

export const MOTION_DELAY = Object.freeze({
  none: 0,
  relatedSection: 0.04,
});

export const MOTION_STAGGER = Object.freeze({
  tight: 0.025,
  standard: 0.04,
});

export const MOTION_TRANSITION = Object.freeze({
  micro: Object.freeze({ duration: MOTION_TIMING.micro, ease: MOTION_EASE.standard }),
  feedback: Object.freeze({ duration: MOTION_TIMING.feedback, ease: MOTION_EASE.standard }),
  enter: Object.freeze({ duration: MOTION_TIMING.enter, ease: MOTION_EASE.enter }),
  exit: Object.freeze({ duration: MOTION_TIMING.exit, ease: MOTION_EASE.exit }),
  panel: Object.freeze({ duration: MOTION_TIMING.panel, ease: MOTION_EASE.enter }),
  layout: Object.freeze({ type: 'spring', stiffness: 500, damping: 42, mass: 0.7 }),
});

export const MOTION_VARIANTS = Object.freeze({
  fade: Object.freeze({
    hidden: Object.freeze({ opacity: 0 }),
    visible: Object.freeze({ opacity: 1 }),
    exit: Object.freeze({ opacity: 0 }),
  }),
  page: Object.freeze({
    hidden: Object.freeze({ opacity: 0, y: MOTION_DISTANCE.standard }),
    visible: Object.freeze({ opacity: 1, y: 0 }),
    exit: Object.freeze({ opacity: 0, y: -MOTION_DISTANCE.subtle }),
  }),
  surface: Object.freeze({
    hidden: Object.freeze({ opacity: 0, y: MOTION_DISTANCE.standard }),
    visible: Object.freeze({ opacity: 1, y: 0 }),
    exit: Object.freeze({ opacity: 0 }),
  }),
  dialog: Object.freeze({
    hidden: Object.freeze({ opacity: 0, y: MOTION_DISTANCE.panel, scale: 0.99 }),
    visible: Object.freeze({ opacity: 1, y: 0, scale: 1 }),
    exit: Object.freeze({ opacity: 0, y: MOTION_DISTANCE.subtle, scale: 0.995 }),
  }),
  popover: Object.freeze({
    hidden: Object.freeze({ opacity: 0, y: -MOTION_DISTANCE.subtle, scale: 0.99 }),
    visible: Object.freeze({ opacity: 1, y: 0, scale: 1 }),
    exit: Object.freeze({ opacity: 0, y: -MOTION_DISTANCE.subtle, scale: 0.99 }),
  }),
  listItem: Object.freeze({
    hidden: Object.freeze({ opacity: 0, y: MOTION_DISTANCE.subtle }),
    visible: Object.freeze({ opacity: 1, y: 0 }),
    exit: Object.freeze({ opacity: 0 }),
  }),
  feedback: Object.freeze({
    hidden: Object.freeze({ opacity: 0, y: -6 }),
    visible: Object.freeze({ opacity: 1, y: 0 }),
    exit: Object.freeze({ opacity: 0 }),
  }),
});
