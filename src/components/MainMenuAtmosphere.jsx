import { useEffect, useRef } from 'react';

const VERTEX_SHADER = `
  attribute vec2 a_position;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec3 u_ink;

  void main() {
    vec2 point = (gl_FragCoord.xy - (u_resolution * 0.5)) / min(u_resolution.x, u_resolution.y);
    point.x -= 0.16;

    float drift = u_time * 0.000055;
    float fold = sin((point.x * 5.4) + drift) * 0.018;
    fold += sin(((point.x + point.y) * 4.1) - (drift * 0.72)) * 0.012;

    vec2 contourPoint = vec2(point.x * 0.88, (point.y + fold) * 1.18);
    float radius = length(contourPoint);
    float band = abs(fract((radius + fold) * 9.0) - 0.5);
    float contour = 1.0 - smoothstep(0.025, 0.065, band);

    float threadWave = abs(sin(((point.x * 0.72) - point.y) * 16.0 + drift));
    float thread = 1.0 - smoothstep(0.015, 0.055, threadWave);
    float fieldFade = 1.0 - smoothstep(0.18, 0.78, radius);
    float rightBias = mix(0.42, 1.0, smoothstep(-0.42, 0.34, point.x));
    float alpha = ((contour * 0.11) + (thread * 0.025)) * fieldFade * rightBias;

    gl_FragColor = vec4(u_ink * alpha, alpha);
  }
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function readInkColor(canvas) {
  const value = getComputedStyle(canvas)
    .getPropertyValue('--main-menu-atmosphere-rgb')
    .trim()
    .split(/\s+/)
    .map(Number);

  return value.length === 3 && value.every(Number.isFinite) ? value : [0.88, 0.68, 0.72];
}

export default function MainMenuAtmosphere({ themeMode }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: true,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
    });

    if (!canvas || !gl) return undefined;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return undefined;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return undefined;
    }

    const buffer = gl.createBuffer();
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    const timeLocation = gl.getUniformLocation(program, 'u_time');
    const inkLocation = gl.getUniformLocation(program, 'u_ink');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const ink = readInkColor(canvas);
    let frameId = 0;
    let inView = true;

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3f(inkLocation, ink[0], ink[1], ink[2]);
    gl.clearColor(0, 0, 0, 0);

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
      const width = Math.max(1, Math.round(bounds.width * pixelRatio));
      const height = Math.max(1, Math.round(bounds.height * pixelRatio));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, width, height);
      gl.uniform2f(resolutionLocation, width, height);
    };

    const render = time => {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(timeLocation, time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = time => {
      render(time);
      frameId = window.requestAnimationFrame(loop);
    };

    const syncAnimation = () => {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
      resize();
      render(performance.now());

      if (inView && !document.hidden && !reducedMotion.matches) {
        frameId = window.requestAnimationFrame(loop);
      }
    };

    const resizeObserver = new ResizeObserver(syncAnimation);
    const intersectionObserver = new IntersectionObserver(entries => {
      inView = entries[0]?.isIntersecting ?? true;
      syncAnimation();
    }, { threshold: 0.01 });
    const handleVisibility = () => syncAnimation();

    resizeObserver.observe(canvas);
    intersectionObserver.observe(canvas);
    reducedMotion.addEventListener('change', syncAnimation);
    document.addEventListener('visibilitychange', handleVisibility);
    syncAnimation();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      reducedMotion.removeEventListener('change', syncAnimation);
      document.removeEventListener('visibilitychange', handleVisibility);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [themeMode]);

  return (
    <div className="main-menu__atmosphere" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
