import { useEffect, useRef, useState } from 'react';
import { ACESFilmicToneMapping, DoubleSide, RepeatWrapping, SRGBColorSpace } from 'three/src/constants.js';
import { Box3 } from 'three/src/math/Box3.js';
import { Color } from 'three/src/math/Color.js';
import { Vector3 } from 'three/src/math/Vector3.js';
import { BufferAttribute } from 'three/src/core/BufferAttribute.js';
import { BufferGeometry } from 'three/src/core/BufferGeometry.js';
import { Group } from 'three/src/objects/Group.js';
import { Mesh } from 'three/src/objects/Mesh.js';
import { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera.js';
import { Scene } from 'three/src/scenes/Scene.js';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial.js';
import { TextureLoader } from 'three/src/loaders/TextureLoader.js';
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer.js';
import { Button, Type } from './ui.jsx';
import { countS3oPieces, parseS3oModel } from '../utils/s3oModel.js';
import './BarModelViewer.css';

const MODEL_ASSETS = Object.freeze({
  model: '/bar-models/corak/corak.s3o',
  color: '/bar-models/corak/cor_color.webp',
  teamMask: '/bar-models/corak/cor_team.webp',
  emissive: '/bar-models/corak/cor_emissive.webp',
});

const TEAM_COLORS = Object.freeze([
  { id: 'cortex', label: 'Cortex red', value: '#b94f52' },
  { id: 'blue', label: 'Alliance blue', value: '#4d85b8' },
  { id: 'green', label: 'Field green', value: '#71906b' },
  { id: 'gold', label: 'Command gold', value: '#b89552' },
]);

const VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform sampler2D baseMap;
  uniform sampler2D teamMask;
  uniform sampler2D emissiveMap;
  uniform vec3 teamColor;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vec3 base = texture2D(baseMap, vUv).rgb;
    float mask = texture2D(teamMask, vUv).r;
    float glow = texture2D(emissiveMap, vUv).r;
    vec3 albedo = mix(base, teamColor, mask * 0.64);
    vec3 lightDirection = normalize(vec3(0.45, 0.76, 0.48));
    float diffuse = max(dot(normalize(vNormal), lightDirection), 0.0);
    vec3 color = albedo * (0.52 + diffuse * 0.62) + albedo * glow * 0.58;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function buildPiece(piece, material) {
  const group = new Group();
  group.name = piece.name;
  group.position.fromArray(piece.offset);
  if (piece.positions.length > 0 && piece.indices.length > 0) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(piece.positions, 3));
    geometry.setAttribute('normal', new BufferAttribute(piece.normals, 3));
    geometry.setAttribute('uv', new BufferAttribute(piece.uvs, 2));
    geometry.setIndex(new BufferAttribute(piece.indices, 1));
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, material);
    mesh.name = `${piece.name}-mesh`;
    group.add(mesh);
  }
  piece.children.forEach(child => group.add(buildPiece(child, material)));
  return group;
}

function disposeObject(object) {
  object.traverse(node => node.geometry?.dispose());
}

export default function BarModelViewer() {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const viewerRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [teamColor, setTeamColor] = useState(TEAM_COLORS[0].value);
  const [modelFacts, setModelFacts] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return undefined;

    const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new Scene();
    const camera = new PerspectiveCamera(34, 1, 0.1, 2000);
    const textureLoader = new TextureLoader();
    const render = () => renderer.render(scene, camera);
    let pointer = null;
    let center = new Vector3();
    let baseDistance = 80;
    const lookAtModel = () => {
      camera.lookAt(center);
      render();
    };
    const zoom = factor => {
      const offset = camera.position.clone().sub(center);
      const nextDistance = Math.max(baseDistance * 0.35, Math.min(baseDistance * 3.25, offset.length() * factor));
      camera.position.copy(center).add(offset.normalize().multiplyScalar(nextDistance));
      lookAtModel();
    };
    const onPointerDown = event => {
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = event => {
      if (!pointer || pointer.id !== event.pointerId || !viewerRef.current?.root) return;
      const deltaX = event.clientX - pointer.x;
      const deltaY = event.clientY - pointer.y;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      const root = viewerRef.current.root;
      root.rotation.y += deltaX * 0.009;
      root.rotation.x = Math.max(-0.42, Math.min(0.42, root.rotation.x + deltaY * 0.006));
      render();
    };
    const onPointerUp = event => {
      if (pointer?.id === event.pointerId) pointer = null;
    };
    const onWheel = event => {
      event.preventDefault();
      zoom(event.deltaY > 0 ? 1.12 : 0.89);
    };
    const onKeyDown = event => {
      const root = viewerRef.current?.root;
      if (!root) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        root.rotation.y += event.key === 'ArrowLeft' ? -0.12 : 0.12;
        render();
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoom(0.88);
      } else if (event.key === '-') {
        event.preventDefault();
        zoom(1.12);
      }
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('keydown', onKeyDown);

    Promise.all([
      fetch(MODEL_ASSETS.model).then(response => {
        if (!response.ok) throw new Error(`Model request failed (${response.status}).`);
        return response.arrayBuffer();
      }),
      textureLoader.loadAsync(MODEL_ASSETS.color),
      textureLoader.loadAsync(MODEL_ASSETS.teamMask),
      textureLoader.loadAsync(MODEL_ASSETS.emissive),
    ]).then(([modelBuffer, colorMap, teamMask, emissiveMap]) => {
      if (cancelled) return;
      const model = parseS3oModel(modelBuffer);
      [colorMap, teamMask, emissiveMap].forEach(texture => {
        texture.flipY = false;
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      });
      colorMap.colorSpace = SRGBColorSpace;

      const uniforms = {
        baseMap: { value: colorMap },
        teamMask: { value: teamMask },
        emissiveMap: { value: emissiveMap },
        teamColor: { value: new Color(TEAM_COLORS[0].value) },
      };
      const material = new ShaderMaterial({
        uniforms,
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        side: DoubleSide,
        toneMapped: true,
      });
      const root = buildPiece(model.root, material);
      root.rotation.y = -0.42;
      scene.add(root);

      const bounds = new Box3().setFromObject(root);
      center = bounds.getCenter(new Vector3());
      const size = bounds.getSize(new Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z);
      baseDistance = maxDimension * 1.95;
      const resetView = () => {
        camera.position.set(center.x + maxDimension * 1.1, center.y + maxDimension * 0.72, center.z + maxDimension * 1.55);
        camera.near = Math.max(0.1, maxDimension / 100);
        camera.far = Math.max(500, maxDimension * 12);
        camera.updateProjectionMatrix();
        root.rotation.set(0, -0.42, 0);
        lookAtModel();
      };
      viewerRef.current = { renderer, scene, camera, material, uniforms, root, resetView, textures: [colorMap, teamMask, emissiveMap] };
      setModelFacts({ pieces: countS3oPieces(model.root), texture: model.texture1, radius: model.radius });
      setStatus('ready');
      resetView();
    }).catch(reason => {
      if (cancelled) return;
      setError(reason instanceof Error ? reason.message : 'The model could not be loaded.');
      setStatus('error');
    });

    const resize = () => {
      const width = Math.max(1, stage.clientWidth);
      const height = Math.max(1, stage.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    };
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    resize();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('keydown', onKeyDown);
      const active = viewerRef.current;
      if (active?.root) disposeObject(active.root);
      active?.material?.dispose();
      active?.textures?.forEach(texture => texture.dispose());
      renderer.dispose();
      viewerRef.current = null;
    };
  }, []);

  const selectTeamColor = value => {
    setTeamColor(value);
    const active = viewerRef.current;
    if (!active) return;
    active.uniforms.teamColor.value.set(value);
    active.renderer.render(active.scene, active.camera);
  };

  const enterFullscreen = async () => {
    if (!stageRef.current?.requestFullscreen) return;
    await stageRef.current.requestFullscreen();
  };

  return (
    <section className="bar-model-viewer" aria-label="CORAK 3D model reference">
      <header className="bar-model-viewer__header">
        <div>
          <Type variant="eyebrow">Interactive model reference</Type>
          <Type as="h4" variant="subsection-title">CORAK · Grunt</Type>
        </div>
        <span className="bar-model-viewer__prototype">Prototype</span>
      </header>

      <div ref={stageRef} className="bar-model-viewer__stage">
        <canvas ref={canvasRef} role="img" tabIndex="0" aria-label="Interactive 3D model of the BAR Grunt unit. Drag to rotate, use the mouse wheel or plus and minus keys to zoom, and arrow keys to turn." />
        {status === 'loading' && <div className="bar-model-viewer__loading" role="status">Preparing model and textures…</div>}
        {status === 'error' && <div className="bar-model-viewer__error" role="alert">{error}</div>}
        <div className="bar-model-viewer__stage-actions">
          <Button size="sm" variant="quiet" disabled={status !== 'ready'} onClick={() => viewerRef.current?.resetView()}>Reset view</Button>
          <Button size="sm" variant="quiet" disabled={status !== 'ready'} onClick={enterFullscreen}>Fullscreen</Button>
        </div>
      </div>

      <div className="bar-model-viewer__controls">
        <fieldset>
          <legend>Team colour</legend>
          <div>
            {TEAM_COLORS.map(color => (
              <button
                type="button"
                key={color.id}
                className={teamColor === color.value ? 'is-active' : ''}
                aria-label={color.label}
                aria-pressed={teamColor === color.value}
                title={color.label}
                style={{ '--team-swatch': color.value }}
                onClick={() => selectTeamColor(color.value)}
              />
            ))}
          </div>
        </fieldset>
        <p>Drag to rotate · Scroll to zoom</p>
      </div>

      {modelFacts && (
        <dl className="bar-model-viewer__facts">
          <div><dt>Pieces</dt><dd>{modelFacts.pieces}</dd></div>
          <div><dt>Draw radius</dt><dd>{modelFacts.radius.toFixed(1)}</dd></div>
          <div><dt>Material</dt><dd>{modelFacts.texture}</dd></div>
        </dl>
      )}
      <footer>Pinned BAR snapshot · Static pose · Reference Library only</footer>
    </section>
  );
}
