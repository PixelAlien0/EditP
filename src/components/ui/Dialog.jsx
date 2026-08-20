import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import { cx } from './utils.js';
import { MOTION_TRANSITION, MOTION_VARIANTS } from './motionConfig.js';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

export function Dialog({
  open = true,
  onClose,
  children,
  className,
  overlayClassName,
  labelledBy,
  describedBy,
  role = 'dialog',
  initialFocusRef,
  closeOnBackdrop = true
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTarget = initialFocusRef?.current || dialogRef.current?.querySelector(FOCUSABLE_SELECTOR) || dialogRef.current;
    focusTarget?.focus?.();

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || [])];
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [initialFocusRef, open]);

  return createPortal(
    <AnimatePresence initial={false}>
      {open && (
        <m.div
          className={cx('ui-dialog-overlay', overlayClassName)}
          variants={MOTION_VARIANTS.fade}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={MOTION_TRANSITION.exit}
          onPointerDown={event => {
            if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
          }}
        >
          <m.section
            ref={dialogRef}
            className={cx('ui-dialog', className)}
            role={role}
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            tabIndex={-1}
            variants={MOTION_VARIANTS.dialog}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={MOTION_TRANSITION.enter}
          >
            {children}
          </m.section>
        </m.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
