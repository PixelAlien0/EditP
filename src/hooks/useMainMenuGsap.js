import { useCallback, useLayoutEffect, useRef } from 'react';

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
      root.classList.add('is-gsap-ready');
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
          const atmosphere = liveRoot.querySelector('.main-menu__atmosphere');

          gsap.set([topbar, projectDesk, launchpad, footer].filter(Boolean), { autoAlpha: 0 });
          gsap.set(topbar, { y: -10 });
          gsap.set([projectDesk, launchpad, footer].filter(Boolean), { y: 14 });
          gsap.set(metrics, { autoAlpha: 0, y: 8 });
          gsap.set([...workspaceCards, ...toolCards], { autoAlpha: 0, y: 12 });
          liveRoot.classList.remove('is-gsap-preparing');
          liveRoot.classList.add('is-gsap-ready');

          const entrance = gsap.timeline({ defaults: { ease: 'power3.out' } });
          entrance
            .to(topbar, { autoAlpha: 1, y: 0, duration: 0.42 })
            .to(projectDesk, { autoAlpha: 1, y: 0, duration: 0.62 }, '-=0.2')
            .to(metrics, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.055 }, '-=0.3')
            .to(launchpad, { autoAlpha: 1, y: 0, duration: 0.48 }, '-=0.28')
            .to(workspaceCards, { autoAlpha: 1, y: 0, duration: 0.44, stagger: 0.065 }, '-=0.3')
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
        root.classList.add('is-gsap-ready');
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

  return useCallback((onComplete, selectedElement = null) => {
    if (typeof onComplete !== 'function' || exitInProgressRef.current) return;
    const root = rootRef.current;
    const gsap = gsapRef.current;
    if (!root || !gsap || prefersReducedMotion()) {
      onComplete();
      return;
    }

    exitInProgressRef.current = true;
    root.classList.add('is-gsap-exiting');
    const tools = gsap.utils.toArray('[data-gsap-tool]', root).reverse();
    const workspaces = gsap.utils.toArray('[data-gsap-workspace]', root).reverse();
    const projectDesk = root.querySelector('[data-gsap-reveal="project"]');
    const topbar = root.querySelector('[data-gsap-reveal="topbar"]');

    const timeline = gsap.timeline({
      defaults: { ease: 'power2.in' },
      onComplete,
    });
    if (selectedElement) timeline.to(selectedElement, { scale: 0.99, duration: 0.08 }, 0);
    timeline
      .to(tools, { autoAlpha: 0, y: -5, duration: 0.16, stagger: 0.012 }, 0)
      .to(workspaces, { autoAlpha: 0, y: -7, duration: 0.18, stagger: 0.018 }, 0.03)
      .to(projectDesk, { autoAlpha: 0, y: -9, duration: 0.22 }, 0.08)
      .to(topbar, { autoAlpha: 0, y: -7, duration: 0.16 }, 0.12);
  }, [rootRef]);
}
