import { useCallback, useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export default function useMainMenuGsap(rootRef) {
  const gsapRef = useRef(null);
  const contextRef = useRef(null);
  const exitInProgressRef = useRef(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    if (prefersReducedMotion()) {
      root.classList.remove('is-gsap-preparing');
      root.classList.add('is-gsap-ready', 'is-gsap-settled');
      return undefined;
    }

    let cancelled = false;
    const removeListeners = [];
    const ambientAnimations = [];

    import('gsap')
      .then(({ gsap }) => {
        if (cancelled || !rootRef.current) return;

        gsapRef.current = gsap;
        const liveRoot = rootRef.current;
        contextRef.current = gsap.context(() => {
          const topbar = liveRoot.querySelector('[data-gsap-reveal="topbar"]');
          const projectDesk = liveRoot.querySelector('[data-gsap-reveal="project"]');
          const launchpad = liveRoot.querySelector('[data-gsap-reveal="launchpad"]');
          const footer = liveRoot.querySelector('[data-gsap-reveal="footer"]');
          const metrics = gsap.utils.toArray('[data-gsap-metric]', liveRoot);
          const workspaceCards = gsap.utils.toArray('[data-gsap-workspace]', liveRoot);
          const toolCards = gsap.utils.toArray('[data-gsap-tool]', liveRoot);
          const editorialLines = gsap.utils.toArray('[data-gsap-editorial-line]', liveRoot);
          const projectEditorialLines = gsap.utils.toArray('[data-gsap-editorial-line]', projectDesk);
          const workspaceEditorialLines = gsap.utils.toArray('[data-gsap-editorial-line]', launchpad);
          const projectSignal = liveRoot.querySelector('[data-gsap-signal]');
          const signalRings = gsap.utils.toArray('[data-project-signal]', liveRoot);
          const signalGuides = gsap.utils.toArray('[data-project-signal-guide]', liveRoot);
          const projectPanels = gsap.utils.toArray('[data-gsap-project-panel]', projectDesk);
          const deskSeam = projectDesk?.querySelector('[data-gsap-desk-seam]');
          const fileActions = gsap.utils.toArray('[data-gsap-file-action]', projectDesk);
          const atmosphere = liveRoot.querySelector('.main-menu__atmosphere');

          gsap.set([topbar, projectDesk, launchpad, footer].filter(Boolean), { autoAlpha: 0 });
          gsap.set(topbar, { y: -10 });
          gsap.set([projectDesk, launchpad, footer].filter(Boolean), { y: 14 });
          gsap.set(metrics, { autoAlpha: 0, y: 8 });
          gsap.set([...workspaceCards, ...toolCards], { autoAlpha: 0, y: 12 });
          gsap.set(editorialLines, { yPercent: 112 });
          gsap.set(signalRings, { strokeDashoffset: 100, transformOrigin: '50% 50%' });
          gsap.set(signalGuides, { strokeDasharray: 1, strokeDashoffset: 1 });
          gsap.set(projectPanels, { autoAlpha: 0, x: index => index === 0 ? -16 : 16 });
          gsap.set(fileActions, { autoAlpha: 0, y: 8 });
          if (deskSeam) gsap.set(deskSeam, { scaleY: 0, transformOrigin: '50% 0%' });
          workspaceCards.forEach(card => {
            const detail = card.querySelector('[data-gsap-workspace-detail]');
            if (detail) gsap.set(detail, { autoAlpha: 0, clipPath: 'inset(0 100% 0 0)' });
          });
          liveRoot.classList.remove('is-gsap-preparing');
          liveRoot.classList.add('is-gsap-ready');

          const entrance = gsap.timeline({
            defaults: { ease: 'power3.out' },
            onComplete: () => {
              // Entrance transforms must not remain on the structural grid panels.
              // Keeping an identity transform here makes Chromium include the
              // animated signal layer when measuring the Continue action on hover.
              gsap.set(projectPanels, { clearProps: 'transform' });
              liveRoot.classList.add('is-gsap-settled');
            },
          });
          entrance
            .to(topbar, { autoAlpha: 1, y: 0, duration: 0.42 })
            .to(projectDesk, { autoAlpha: 1, y: 0, duration: 0.62 }, '-=0.2')
            .to(projectPanels, { autoAlpha: 1, x: 0, duration: 0.58, stagger: 0.08 }, '-=0.5')
            .to(deskSeam, { scaleY: 1, duration: 0.64, ease: 'power2.inOut' }, '-=0.54')
            .to(projectEditorialLines, { yPercent: 0, duration: 0.58, stagger: 0.075 }, '-=0.48')
            .to(signalGuides, { strokeDashoffset: 0, duration: 0.88, stagger: 0.1, ease: 'power2.inOut' }, '-=0.56')
            .to(signalRings, { strokeDashoffset: 0, duration: 0.9, stagger: 0.08, ease: 'power2.out' }, '-=0.7')
            .to(fileActions, { autoAlpha: 1, y: 0, duration: 0.34, stagger: 0.06 }, '-=0.36')
            .to(metrics, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.055 }, '-=0.3')
            .to(launchpad, { autoAlpha: 1, y: 0, duration: 0.48 }, '-=0.28')
            .to(workspaceCards, { autoAlpha: 1, y: 0, duration: 0.44, stagger: 0.065 }, '-=0.3')
            .to(workspaceEditorialLines, { yPercent: 0, duration: 0.46, stagger: 0.055 }, '-=0.48')
            .to(toolCards, { autoAlpha: 1, y: 0, duration: 0.36, stagger: 0.035 }, '-=0.25')
            .to(footer, { autoAlpha: 1, y: 0, duration: 0.32 }, '-=0.18');

          gsap.utils.toArray('[data-gsap-count]', liveRoot).forEach(node => {
            const target = Number(node.dataset.gsapCount);
            if (!Number.isFinite(target)) return;
            const counter = { value: 0 };
            gsap.to(counter, {
              value: target,
              duration: 0.9,
              delay: 0.28,
              ease: 'power2.out',
              snap: { value: 1 },
              onUpdate: () => {
                node.textContent = Math.round(counter.value).toLocaleString();
              },
            });
          });

          if (atmosphere) {
            const drift = gsap.to(atmosphere, {
              y: -4,
              scale: 1.018,
              duration: 8,
              repeat: -1,
              yoyo: true,
              ease: 'sine.inOut',
            });
            ambientAnimations.push(drift);

            const projectSurface = liveRoot.querySelector('.main-menu__studio-intro');
            if (projectSurface) {
              const moveX = gsap.quickTo(atmosphere, 'x', { duration: 0.8, ease: 'power3.out' });
              const onPointerMove = event => {
                const bounds = projectSurface.getBoundingClientRect();
                const normalizedX = ((event.clientX - bounds.left) / bounds.width) - 0.5;
                moveX(normalizedX * 10);
              };
              const onPointerLeave = () => moveX(0);
              projectSurface.addEventListener('pointermove', onPointerMove);
              projectSurface.addEventListener('pointerleave', onPointerLeave);
              removeListeners.push(() => {
                projectSurface.removeEventListener('pointermove', onPointerMove);
                projectSurface.removeEventListener('pointerleave', onPointerLeave);
              });
            }
          }

          if (projectSignal && signalRings.length) {
            const signalDrift = gsap.to(signalRings, {
              rotation: index => index % 2 === 0 ? 360 : -360,
              duration: index => 34 + (index * 9),
              repeat: -1,
              ease: 'none',
            });
            ambientAnimations.push(signalDrift);

            const projectSurface = liveRoot.querySelector('.main-menu__active-project');
            if (projectSurface) {
              const moveX = gsap.quickTo(projectSignal, 'x', { duration: 0.9, ease: 'power3.out' });
              const onPointerMove = event => {
                const bounds = projectSurface.getBoundingClientRect();
                moveX((((event.clientX - bounds.left) / bounds.width) - 0.5) * 8);
              };
              const onPointerLeave = () => moveX(0);
              projectSurface.addEventListener('pointermove', onPointerMove);
              projectSurface.addEventListener('pointerleave', onPointerLeave);
              removeListeners.push(() => {
                projectSurface.removeEventListener('pointermove', onPointerMove);
                projectSurface.removeEventListener('pointerleave', onPointerLeave);
              });
            }

            gsap.utils.toArray('[data-project-signal-source]', liveRoot).forEach(source => {
              const signalId = source.dataset.projectSignalSource;
              const target = liveRoot.querySelector(`[data-project-signal="${signalId}"]`);
              if (!target) return;
              const onEnter = () => {
                gsap.to(signalRings, { opacity: 0.12, duration: 0.28, overwrite: 'auto' });
                gsap.to(target, { opacity: 0.95, scale: 1.035, duration: 0.32, ease: 'power2.out', overwrite: 'auto' });
              };
              const onLeave = () => {
                gsap.to(signalRings, {
                  opacity: 0.46,
                  scale: 1,
                  duration: 0.36,
                  ease: 'power3.out',
                  overwrite: 'auto',
                  onComplete: () => gsap.set(signalRings, { clearProps: 'opacity' }),
                });
              };
              source.addEventListener('pointerenter', onEnter);
              source.addEventListener('pointerleave', onLeave);
              removeListeners.push(() => {
                source.removeEventListener('pointerenter', onEnter);
                source.removeEventListener('pointerleave', onLeave);
              });
            });
          }

          const resetWorkspaceComposition = () => {
            gsap.to(workspaceCards, { opacity: 1, duration: 0.34, ease: 'power2.out', overwrite: 'auto' });
            workspaceCards.forEach(card => {
              card.classList.remove('is-composed');
              const detail = card.querySelector('[data-gsap-workspace-detail]');
              if (detail) gsap.to(detail, {
                autoAlpha: 0,
                clipPath: 'inset(0 100% 0 0)',
                duration: 0.24,
                overwrite: 'auto',
              });
            });
          };

          workspaceCards.forEach(activeCard => {
            const detail = activeCard.querySelector('[data-gsap-workspace-detail]');
            const compose = () => {
              workspaceCards.forEach(card => card.classList.toggle('is-composed', card === activeCard));
              gsap.to(workspaceCards, {
                opacity: (_, card) => card === activeCard ? 1 : 0.72,
                duration: 0.32,
                ease: 'power2.out',
                overwrite: 'auto',
              });
              if (detail) gsap.to(detail, {
                autoAlpha: 1,
                clipPath: 'inset(0 0% 0 0)',
                duration: 0.38,
                ease: 'power3.out',
                overwrite: 'auto',
              });
            };
            activeCard.addEventListener('pointerenter', compose);
            activeCard.addEventListener('pointerleave', resetWorkspaceComposition);
            activeCard.addEventListener('focus', compose);
            activeCard.addEventListener('blur', resetWorkspaceComposition);
            removeListeners.push(() => {
              activeCard.removeEventListener('pointerenter', compose);
              activeCard.removeEventListener('pointerleave', resetWorkspaceComposition);
              activeCard.removeEventListener('focus', compose);
              activeCard.removeEventListener('blur', resetWorkspaceComposition);
            });
          });

          gsap.utils.toArray('[data-gsap-interactive]', liveRoot).forEach(node => {
            const arrow = node.querySelector('.main-menu__motion-arrow');
            const onEnter = () => {
              if (arrow) gsap.to(arrow, { x: 4, duration: 0.24, ease: 'power2.out', overwrite: 'auto' });
            };
            const onLeave = () => {
              if (arrow) gsap.to(arrow, { x: 0, duration: 0.28, ease: 'power3.out', overwrite: 'auto' });
            };
            node.addEventListener('pointerenter', onEnter);
            node.addEventListener('pointerleave', onLeave);
            removeListeners.push(() => {
              node.removeEventListener('pointerenter', onEnter);
              node.removeEventListener('pointerleave', onLeave);
            });
          });

          const onVisibilityChange = () => {
            ambientAnimations.forEach(animation => animation.paused(document.hidden));
          };
          document.addEventListener('visibilitychange', onVisibilityChange);
          removeListeners.push(() => document.removeEventListener('visibilitychange', onVisibilityChange));
        }, liveRoot);
      })
      .catch(() => {
        root.classList.remove('is-gsap-preparing');
        root.classList.add('is-gsap-ready', 'is-gsap-settled');
      });

    return () => {
      cancelled = true;
      removeListeners.forEach(remove => remove());
      contextRef.current?.revert();
      contextRef.current = null;
      gsapRef.current = null;
      exitInProgressRef.current = false;
    };
  }, [rootRef]);

  return useCallback((onComplete) => {
    if (typeof onComplete !== 'function' || exitInProgressRef.current) return;
    const root = rootRef.current;
    if (!root || prefersReducedMotion() || typeof document.startViewTransition !== 'function') {
      onComplete();
      return;
    }

    exitInProgressRef.current = true;
    root.classList.add('is-gsap-exiting');

    try {
      const transition = document.startViewTransition(() => {
        flushSync(() => onComplete());
      });
      const finishTransition = () => {
        exitInProgressRef.current = false;
        root.classList.remove('is-gsap-exiting');
      };
      transition.finished.then(finishTransition, finishTransition);
    } catch {
      exitInProgressRef.current = false;
      root.classList.remove('is-gsap-exiting');
      onComplete();
    }
  }, [rootRef]);
}
