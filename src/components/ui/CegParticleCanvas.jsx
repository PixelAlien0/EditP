import { useCallback, useEffect, useRef, useState } from 'react';
import { getSoundAudioUrls } from '../../utils/barAssets.js';

export default function CegParticleCanvas({ cegTag = '', soundName = '', aoe = 120, className = '' }) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const animFrameRef = useRef(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const getThemeColors = (tag) => {
    const lower = String(tag).toLowerCase();
    if (lower.includes('lightning') || lower.includes('emp')) {
      return { primary: '#38bdf8', secondary: '#818cf8', spark: '#e0f2fe', smoke: 'rgba(56, 189, 248, 0.15)' };
    }
    if (lower.includes('fire') || lower.includes('flame') || lower.includes('pyro')) {
      return { primary: '#f97316', secondary: '#ef4444', spark: '#fef08a', smoke: 'rgba(120, 53, 15, 0.3)' };
    }
    if (lower.includes('plasma') || lower.includes('nuke') || lower.includes('atomic')) {
      return { primary: '#a855f7', secondary: '#ec4899', spark: '#f472b6', smoke: 'rgba(88, 28, 135, 0.3)' };
    }
    return { primary: '#f59e0b', secondary: '#ea580c', spark: '#fef3c7', smoke: 'rgba(75, 85, 99, 0.25)' };
  };

  const triggerDetonation = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const colors = getThemeColors(cegTag);

    // Audio detonation sync
    if (soundEnabled && soundName) {
      const urls = getSoundAudioUrls(soundName);
      if (urls.length) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(urls[0]);
        audioRef.current = audio;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      }
    }

    // Create particle systems
    const sparkCount = 45;
    const smokeCount = 20;

    const sparks = Array.from({ length: sparkCount }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 7;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 2.5,
        life: 1,
        decay: 0.02 + Math.random() * 0.03,
        color: Math.random() > 0.3 ? colors.spark : colors.primary
      };
    });

    const smoke = Array.from({ length: smokeCount }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 12;
      return {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: Math.cos(angle) * (0.4 + Math.random() * 0.8),
        vy: Math.sin(angle) * (0.4 + Math.random() * 0.8) - 0.3,
        radius: 6 + Math.random() * 10,
        maxRadius: 22 + Math.random() * 18,
        life: 1,
        decay: 0.015 + Math.random() * 0.015
      };
    });

    let shockwaveRadius = 0;
    const maxShockwaveRadius = Math.min(Math.max(aoe * 0.45, 30), width * 0.45);

    const render = () => {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.fillRect(0, 0, width, height);

      let activeCount = 0;

      // Render expanding shockwave ring
      if (shockwaveRadius < maxShockwaveRadius) {
        shockwaveRadius += (maxShockwaveRadius - shockwaveRadius) * 0.18 + 1.5;
        const alpha = Math.max(0, 1 - shockwaveRadius / maxShockwaveRadius);
        ctx.beginPath();
        ctx.arc(cx, cy, shockwaveRadius, 0, Math.PI * 2);
        ctx.strokeStyle = colors.primary;
        ctx.globalAlpha = alpha * 0.8;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
        activeCount += 1;
      }

      // Render smoke particles
      smoke.forEach(p => {
        if (p.life > 0) {
          p.x += p.vx;
          p.y += p.vy;
          p.radius += (p.maxRadius - p.radius) * 0.05;
          p.life -= p.decay;

          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1, p.radius), 0, Math.PI * 2);
          ctx.fillStyle = colors.smoke;
          ctx.globalAlpha = Math.max(0, p.life * 0.6);
          ctx.fill();
          ctx.globalAlpha = 1;
          activeCount += 1;
        }
      });

      // Render spark particles
      sparks.forEach(p => {
        if (p.life > 0) {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.95;
          p.vy *= 0.95;
          p.life -= p.decay;

          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.5, p.size * p.life), 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fill();
          ctx.globalAlpha = 1;
          activeCount += 1;
        }
      });

      if (activeCount > 0) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    render();
  }, [aoe, cegTag, soundEnabled, soundName]);

  useEffect(() => {
    triggerDetonation();
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [triggerDetonation]);

  return (
    <div className={`ceg-particle-container ${className}`}>
      <div className="ceg-particle-viewport">
        <canvas ref={canvasRef} width={260} height={150} className="ceg-particle-canvas" />
        <div className="ceg-particle-overlay">
          <span className="ceg-particle-tag"><code>{cegTag || 'custom:explosion'}</code></span>
          {soundName && <span className="ceg-particle-sound">🔊 {soundName}</span>}
        </div>
      </div>
      <div className="ceg-particle-controls">
        <button
          type="button"
          className="ceg-detonate-btn"
          onClick={triggerDetonation}
        >
          💥 Detonate FX
        </button>
        {soundName && (
          <button
            type="button"
            className={`ceg-audio-toggle ${soundEnabled ? 'is-active' : ''}`}
            onClick={() => setSoundEnabled(v => !v)}
            title={soundEnabled ? 'Audio sync enabled' : 'Audio sync muted'}
          >
            {soundEnabled ? '🔊 Sound On' : '🔇 Muted'}
          </button>
        )}
      </div>
    </div>
  );
}
