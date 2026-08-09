import { useEffect, useRef, useState } from 'react';
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BasicShadowMap,
  PCFShadowMap,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three/src/constants.js';
import { AnimationMixer } from 'three/src/animation/AnimationMixer.js';
import { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera.js';
import { Timer } from 'three/src/core/Timer.js';
import { PMREMGenerator } from 'three/src/extras/PMREMGenerator.js';
import { TextureLoader } from 'three/src/loaders/TextureLoader.js';
import { AmbientLight } from 'three/src/lights/AmbientLight.js';
import { DirectionalLight } from 'three/src/lights/DirectionalLight.js';
import { HemisphereLight } from 'three/src/lights/HemisphereLight.js';
import { Box3 } from 'three/src/math/Box3.js';
import { Color } from 'three/src/math/Color.js';
import { Vector2 } from 'three/src/math/Vector2.js';
import { Vector3 } from 'three/src/math/Vector3.js';
import { MeshLambertMaterial } from 'three/src/materials/MeshLambertMaterial.js';
import { MeshStandardMaterial } from 'three/src/materials/MeshStandardMaterial.js';
import { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial.js';
import { Mesh } from 'three/src/objects/Mesh.js';
import { PlaneGeometry } from 'three/src/geometries/PlaneGeometry.js';
import { SphereGeometry } from 'three/src/geometries/SphereGeometry.js';
import { Scene } from 'three/src/scenes/Scene.js';
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getBarModelEffectProfile, getBarModelNodeEffect } from '../config/barModelEffects.js';
import { Button, Type } from './ui.jsx';
import './BarModelViewer.css';

const TEAM_COLORS = Object.freeze([
  { id: 'cortex', label: 'Cortex red', value: '#e53f46' },
  { id: 'blue', label: 'Alliance blue', value: '#2f72e6' },
  { id: 'green', label: 'Field green', value: '#62a765' },
  { id: 'gold', label: 'Command gold', value: '#c99a42' },
]);

const GROUND_COLORS = Object.freeze([
  { id: 'slate', label: 'Slate ground', value: '#20262a' },
  { id: 'charcoal', label: 'Charcoal ground', value: '#151311' },
  { id: 'earth', label: 'Earth ground', value: '#30251d' },
  { id: 'sand', label: 'Sand ground', value: '#4a4032' },
]);

const STUDIO_LIGHTING = Object.freeze({
  exposure: 0.94,
  ambient: 0.04,
  hemisphere: 0.3,
  key: 1.08,
  fill: 0.18,
  environment: 0.66,
  emissive: 0.92,
});

function prepareTexture(texture, renderer, colorSpace = NoColorSpace) {
  texture.flipY = false;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.colorSpace = colorSpace;
  return texture;
}

function createBarMaterial(textures, teamUniform) {
  const material = new MeshStandardMaterial({
    map: textures.color,
    roughnessMap: textures.pbr,
    metalnessMap: textures.pbr,
    normalMap: textures.normal,
    normalScale: new Vector2(1, 1.8),
    emissive: new Color(0xffffff),
    emissiveMap: textures.emissive,
    emissiveIntensity: STUDIO_LIGHTING.emissive,
    roughness: 0.68,
    metalness: 1,
    envMapIntensity: STUDIO_LIGHTING.environment,
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.barTeamMap = { value: textures.teamMask };
    shader.uniforms.barTeamColor = teamUniform;
    shader.fragmentShader = `uniform sampler2D barTeamMap;\nuniform vec3 barTeamColor;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       float barTeamMask = texture2D(barTeamMap, vMapUv).r;
       float barTeamBlend = smoothstep(0.22, 0.78, barTeamMask);
       diffuseColor.rgb = mix(diffuseColor.rgb, barTeamColor, barTeamBlend * 0.82);`,
    );
  };
  material.customProgramCacheKey = () => 'bar-reference-pbr-team-v2';
  return material;
}

function tuneNativeMaterial(material) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach(tuneNativeMaterial);
    return;
  }
  if ('envMapIntensity' in material) {
    material.envMapIntensity = Math.min(
      Number.isFinite(material.envMapIntensity) ? material.envMapIntensity : 1,
      STUDIO_LIGHTING.environment,
    );
  }
  if ('emissiveIntensity' in material) {
    material.emissiveIntensity = Math.min(
      Number.isFinite(material.emissiveIntensity) ? material.emissiveIntensity : 1,
      STUDIO_LIGHTING.emissive,
    );
  }
  material.needsUpdate = true;
}

function createEffectMaterial(effect) {
  const color = new Color(effect.color);
  return new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: effect.emissiveIntensity,
    transparent: true,
    opacity: effect.opacity,
    roughness: 0.24,
    metalness: 0.04,
    envMapIntensity: 0.18,
    blending: AdditiveBlending,
    depthWrite: false,
  });
}

function registerEffectAnimation(effectAnimations, object, effect, phase = 0) {
  effectAnimations.push({
    object,
    effect,
    phase,
    baseScale: object.scale.clone(),
    baseRotationY: object.rotation.y,
  });
}

function createProceduralEffect(root, bounds, effect, effectAnimations, phase) {
  root.updateMatrixWorld(true);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  const footprintDimension = Math.sqrt(Math.max(size.x * size.z, 0));
  const anchor = root.getObjectByName(effect.anchor);
  const position = anchor
    ? anchor.getWorldPosition(new Vector3())
    : center.clone().add(new Vector3(0, size.y * 0.22, 0));
  root.worldToLocal(position);

  const sizeBasis = effect.sizeBasis === 'footprint'
    ? footprintDimension
    : maxDimension;
  const radius = Math.max(
    effect.diameterRatio
      ? (sizeBasis * effect.diameterRatio) / 2
      : maxDimension * (effect.radiusFactor || 0.1),
    0.01,
  );
  const orb = new Mesh(
    new SphereGeometry(radius, 24, 16),
    createEffectMaterial(effect),
  );
  orb.name = `editp_effect_${effect.anchor || 'orb'}`;
  orb.position.copy(position);
  orb.renderOrder = 3;

  const aura = new Mesh(
    new SphereGeometry(radius * 1.16, 20, 14),
    new MeshBasicMaterial({
      color: new Color(effect.color),
      transparent: true,
      opacity: 0.12,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  aura.renderOrder = 2;
  orb.add(aura);
  root.add(orb);
  registerEffectAnimation(effectAnimations, orb, effect, phase);
  return orb;
}

function disposeMaterial(material) {
  if (Array.isArray(material)) material.forEach(disposeMaterial);
  else material?.dispose?.();
}

function disposeObject(object) {
  object?.traverse(node => {
    node.geometry?.dispose?.();
    disposeMaterial(node.material);
  });
}

function selectPreviewClip(animations) {
  return animations.find(clip => /idle|stand|breathe/i.test(clip.name))
    ?? animations.find(clip => /walk|move/i.test(clip.name))
    ?? animations[0]
    ?? null;
}

export default function BarModelViewer({ entry, fallbackUrl = '' }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const viewerRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [teamColor, setTeamColor] = useState(TEAM_COLORS[0].value);
  const [groundColor, setGroundColor] = useState(GROUND_COLORS[0].value);
  const [shadowQuality, setShadowQuality] = useState('compatibility');
  const [verticalOffset, setVerticalOffset] = useState(0);
  const [modelFacts, setModelFacts] = useState(null);
  const [isRotating, setIsRotating] = useState(true);
  const [isAnimating, setIsAnimating] = useState(true);
  const teamColorRef = useRef(TEAM_COLORS[0].value);
  const groundColorRef = useRef(GROUND_COLORS[0].value);
  const shadowQualityRef = useRef('compatibility');

  useEffect(() => {
    let cancelled = false;
    let resizeObserver;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return undefined;

    setStatus('loading');
    setError('');
    setModelFacts(null);
    setIsAnimating(true);
    setVerticalOffset(0);
    let renderer;
    try {
      renderer = new WebGLRenderer({ canvas, alpha: false, antialias: true, powerPreference: 'high-performance' });
    } catch {
      setStatus('error');
      setError('WebGL is unavailable on this device.');
      return undefined;
    }
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = STUDIO_LIGHTING.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = shadowQualityRef.current === 'soft' ? PCFShadowMap : BasicShadowMap;
    renderer.setClearColor(0x090807, 1);
    const compactDevice = window.matchMedia('(max-width: 760px)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compactDevice ? 1.25 : 2));

    const scene = new Scene();
    const camera = new PerspectiveCamera(35, 1, 0.1, 2000);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.95;
    controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    controls.autoRotateSpeed = 0.72;
    if (!controls.autoRotate) setIsRotating(false);

    const ambient = new AmbientLight(0xfff7ef, STUDIO_LIGHTING.ambient);
    const hemisphere = new HemisphereLight(0xdce5eb, 0x1b1410, STUDIO_LIGHTING.hemisphere);
    const keyLight = new DirectionalLight(0xffead8, STUDIO_LIGHTING.key);
    keyLight.position.set(4.5, 7, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.00035;
    const fillLight = new DirectionalLight(0xc9d4df, STUDIO_LIGHTING.fill);
    fillLight.position.set(-4, 3.5, -5);
    scene.add(ambient, hemisphere, keyLight, fillLight);

    const environmentScene = new RoomEnvironment();
    const pmrem = new PMREMGenerator(renderer);
    const environmentTarget = pmrem.fromScene(environmentScene, 0.04);
    scene.environment = environmentTarget.texture;
    pmrem.dispose();
    disposeObject(environmentScene);

    const textureLoader = new TextureLoader();
    const gltfLoader = new GLTFLoader();
    const timer = new Timer();
    timer.connect(document);
    const teamUniform = { value: new Color(teamColorRef.current) };
    let frameId = 0;
    let root = null;
    let floor = null;
    let floorMaterial = null;
    let material = null;
    let mixer = null;
    let previewAction = null;
    let textures = [];
    let effectTime = 0;
    const effectAnimations = [];

    const renderFrame = timestamp => {
      timer.update(timestamp);
      const delta = Math.min(timer.getDelta(), 0.05);
      if (mixer && previewAction && !previewAction.paused) mixer.update(delta);
      effectTime += delta;
      effectAnimations.forEach(({ object, effect, phase, baseScale, baseRotationY }) => {
        const pulse = 1 + Math.sin((effectTime * effect.pulseSpeed) + phase) * effect.pulseAmount;
        object.scale.copy(baseScale).multiplyScalar(pulse);
        object.rotation.y = baseRotationY + (effectTime * effect.rotationSpeed);
      });
      controls.update(delta);
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(renderFrame);
    };

    const resize = () => {
      const width = Math.max(1, stage.clientWidth);
      const height = Math.max(1, stage.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    resize();
    renderFrame();

    const texturePromise = entry.textures
      ? Promise.all([
          textureLoader.loadAsync(entry.textures.color),
          textureLoader.loadAsync(entry.textures.pbr),
          textureLoader.loadAsync(entry.textures.normal),
          textureLoader.loadAsync(entry.textures.teamMask),
          textureLoader.loadAsync(entry.textures.emissive),
        ])
      : Promise.resolve(null);

    Promise.all([gltfLoader.loadAsync(entry.model), texturePromise]).then(([gltf, loadedTextures]) => {
      if (cancelled) return;
      if (loadedTextures) {
        const [colorMap, pbrMap, normalMap, teamMask, emissiveMap] = loadedTextures;
        textures = [
          prepareTexture(colorMap, renderer, SRGBColorSpace),
          prepareTexture(pbrMap, renderer),
          prepareTexture(normalMap, renderer),
          prepareTexture(teamMask, renderer),
          prepareTexture(emissiveMap, renderer, SRGBColorSpace),
        ];
        material = createBarMaterial({
          color: colorMap,
          pbr: pbrMap,
          normal: normalMap,
          teamMask,
          emissive: emissiveMap,
        }, teamUniform);
      }

      root = gltf.scene;
      root.rotation.y = -0.48;
      let meshCount = 0;
      const effectProfile = getBarModelEffectProfile(entry.modelPath);
      const replacedMaterials = new Set();
      root.traverse(node => {
        if (!node.isMesh) return;
        meshCount += 1;
        const nodeEffect = getBarModelNodeEffect(effectProfile, node.name);
        if (nodeEffect) {
          if (Array.isArray(node.material)) node.material.forEach(entry => replacedMaterials.add(entry));
          else if (node.material) replacedMaterials.add(node.material);
          node.material = createEffectMaterial(nodeEffect);
          node.renderOrder = 3;
          registerEffectAnimation(effectAnimations, node, nodeEffect, effectAnimations.length * 0.85);
        } else if (material) {
          if (Array.isArray(node.material)) node.material.forEach(entry => replacedMaterials.add(entry));
          else if (node.material) replacedMaterials.add(node.material);
          node.material = material;
        } else {
          tuneNativeMaterial(node.material);
        }
        node.castShadow = true;
        node.receiveShadow = true;
      });
      replacedMaterials.forEach(entry => entry.dispose?.());
      scene.add(root);

      const modelBounds = new Box3().setFromObject(root);
      effectProfile?.proceduralEffects?.forEach((effect, index) => {
        createProceduralEffect(root, modelBounds, effect, effectAnimations, index * 0.85);
      });
      const bounds = new Box3().setFromObject(root);
      const center = bounds.getCenter(new Vector3());
      const size = bounds.getSize(new Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z);
      const distance = maxDimension / (2 * Math.tan((camera.fov * Math.PI / 180) / 2)) * 1.18;
      const resetView = () => {
        root.rotation.set(0, -0.48, 0);
        camera.position.set(center.x + distance * 0.66, center.y + distance * 0.26, center.z + distance * 0.82);
        camera.near = Math.max(0.01, maxDimension / 250);
        camera.far = Math.max(300, maxDimension * 40);
        camera.updateProjectionMatrix();
        controls.target.copy(center).add(new Vector3(0, size.y * 0.04, 0));
        controls.minDistance = distance * 0.42;
        controls.maxDistance = distance * 2.6;
        controls.update();
      };

      const shadowExtent = maxDimension * 1.35;
      keyLight.shadow.camera.left = -shadowExtent;
      keyLight.shadow.camera.right = shadowExtent;
      keyLight.shadow.camera.top = shadowExtent;
      keyLight.shadow.camera.bottom = -shadowExtent;
      keyLight.shadow.camera.near = 0.1;
      keyLight.shadow.camera.far = maxDimension * 12;
      keyLight.shadow.camera.updateProjectionMatrix();

      floorMaterial = new MeshLambertMaterial({
        color: new Color(groundColorRef.current),
      });
      floor = new Mesh(
        new PlaneGeometry(maxDimension * 5, maxDimension * 5),
        floorMaterial,
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = bounds.min.y - maxDimension * 0.008;
      floor.receiveShadow = true;
      scene.add(floor);

      const previewClip = selectPreviewClip(gltf.animations);
      if (previewClip) {
        mixer = new AnimationMixer(root);
        previewAction = mixer.clipAction(previewClip);
        previewAction.play();
      } else {
        setIsAnimating(false);
      }

      viewerRef.current = {
        renderer,
        scene,
        camera,
        controls,
        root,
        rootBaseY: root.position.y,
        modelHeight: size.y,
        resetView,
        teamUniform,
        floorMaterial,
        previewAction,
      };
      setModelFacts({
        pieces: meshCount,
        animations: gltf.animations.length,
        material: entry.materialMode === 'bar-pbr' ? 'GLB · BAR PBR' : 'GLB · Native material',
        size: entry.modelBytes ? `${Math.max(1, Math.round(entry.modelBytes / 1024))} KB` : 'Streamed',
      });
      setStatus('ready');
      resetView();
    }).catch(reason => {
      if (cancelled) return;
      setError(reason instanceof Error ? reason.message : 'The model could not be loaded.');
      setStatus('error');
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      controls.dispose();
      timer.dispose();
      if (root) disposeObject(root);
      if (floor) disposeObject(floor);
      material?.dispose();
      textures.forEach(texture => texture.dispose());
      environmentTarget.dispose();
      renderer.dispose();
      viewerRef.current = null;
    };
  }, [entry]);

  const selectTeamColor = value => {
    setTeamColor(value);
    teamColorRef.current = value;
    viewerRef.current?.teamUniform.value.set(value);
  };

  const selectGroundColor = value => {
    setGroundColor(value);
    groundColorRef.current = value;
    viewerRef.current?.floorMaterial.color.set(value);
  };

  const selectVerticalOffset = value => {
    const next = Number(value);
    setVerticalOffset(next);
    const viewer = viewerRef.current;
    if (viewer?.root) {
      viewer.root.position.y = viewer.rootBaseY + (viewer.modelHeight * next / 100);
    }
  };

  const selectShadowQuality = value => {
    setShadowQuality(value);
    shadowQualityRef.current = value;
    const renderer = viewerRef.current?.renderer;
    if (!renderer) return;
    renderer.shadowMap.type = value === 'soft' ? PCFShadowMap : BasicShadowMap;
    renderer.shadowMap.needsUpdate = true;
  };

  const resetViewer = () => {
    selectVerticalOffset(0);
    viewerRef.current?.resetView();
  };

  const toggleRotation = () => {
    setIsRotating(current => {
      const next = !current;
      if (viewerRef.current) viewerRef.current.controls.autoRotate = next;
      return next;
    });
  };

  const toggleAnimation = () => {
    setIsAnimating(current => {
      const next = !current;
      if (viewerRef.current?.previewAction) viewerRef.current.previewAction.paused = !next;
      return next;
    });
  };

  const enterFullscreen = async () => {
    if (!stageRef.current?.requestFullscreen) return;
    await stageRef.current.requestFullscreen();
  };

  return (
    <section className="bar-model-viewer" aria-label={`${entry.name} 3D model reference`}>
      <header className="bar-model-viewer__header">
        <div>
          <Type variant="eyebrow">Interactive model reference</Type>
          <Type as="h4" variant="subsection-title">{entry.unitId.toUpperCase()} · {entry.name}</Type>
        </div>
        <span className="bar-model-viewer__prototype">Official GLB</span>
      </header>

      <div ref={stageRef} className="bar-model-viewer__stage">
        <canvas ref={canvasRef} role="img" tabIndex="0" aria-label={`Interactive 3D model of ${entry.name}. Drag to orbit and use the mouse wheel to zoom.`} />
        {status === 'loading' && <div className="bar-model-viewer__loading" role="status">Streaming the model…</div>}
        {status === 'error' && (
          <div className="bar-model-viewer__error" role="alert">
            {fallbackUrl && <img src={fallbackUrl} alt="" />}
            <span>{error}</span>
          </div>
        )}
        <div className="bar-model-viewer__stage-actions">
          <Button size="sm" variant="quiet" disabled={status !== 'ready'} aria-pressed={isRotating} onClick={toggleRotation}>{isRotating ? 'Rotation on' : 'Rotation off'}</Button>
          <Button size="sm" variant="quiet" disabled={status !== 'ready' || !modelFacts?.animations} aria-pressed={isAnimating} onClick={toggleAnimation}>{isAnimating ? 'Motion on' : 'Motion off'}</Button>
          <Button size="sm" variant="quiet" disabled={status !== 'ready'} onClick={resetViewer}>Reset</Button>
          <Button size="sm" variant="quiet" disabled={status !== 'ready'} onClick={enterFullscreen}>Fullscreen</Button>
        </div>
      </div>

      <div className="bar-model-viewer__controls">
        <div className="bar-model-viewer__palettes">
          <fieldset disabled={!entry.textures}>
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
                  style={{ '--viewer-swatch': color.value }}
                  onClick={() => selectTeamColor(color.value)}
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Ground colour</legend>
            <div>
              {GROUND_COLORS.map(color => (
                <button
                  type="button"
                  key={color.id}
                  className={groundColor === color.value ? 'is-active' : ''}
                  aria-label={color.label}
                  aria-pressed={groundColor === color.value}
                  title={color.label}
                  style={{ '--viewer-swatch': color.value }}
                  onClick={() => selectGroundColor(color.value)}
                />
              ))}
            </div>
          </fieldset>
        </div>
        <label className="bar-model-viewer__axis-control">
          <span>
            <span>Model Y</span>
            <output>{verticalOffset > 0 ? '+' : ''}{verticalOffset}%</output>
          </span>
          <input
            type="range"
            min="-50"
            max="100"
            step="1"
            value={verticalOffset}
            disabled={status !== 'ready'}
            aria-label="Model vertical position"
            onChange={event => selectVerticalOffset(event.target.value)}
          />
        </label>
        <div className="bar-model-viewer__shadow-control" role="group" aria-label="Shadow quality">
          <span>Shadows</span>
          <div>
            <button
              type="button"
              className={shadowQuality === 'compatibility' ? 'is-active' : ''}
              aria-pressed={shadowQuality === 'compatibility'}
              disabled={status !== 'ready'}
              title="Stable hard-edged shadows with the broadest WebGL compatibility"
              onClick={() => selectShadowQuality('compatibility')}
            >
              Compatible
            </button>
            <button
              type="button"
              className={shadowQuality === 'soft' ? 'is-active' : ''}
              aria-pressed={shadowQuality === 'soft'}
              disabled={status !== 'ready'}
              title="Softer shadows; some graphics drivers may report a harmless WebGL warning"
              onClick={() => selectShadowQuality('soft')}
            >
              Soft
            </button>
          </div>
        </div>
        <p>{entry.textures ? 'Drag to orbit · Scroll to zoom' : 'Native material · Drag to orbit · Scroll to zoom'}</p>
      </div>

      {modelFacts && (
        <dl className="bar-model-viewer__facts">
          <div><dt>Mesh pieces</dt><dd>{modelFacts.pieces}</dd></div>
          <div><dt>Motion clips</dt><dd>{modelFacts.animations}</dd></div>
          <div><dt>Model payload</dt><dd>{modelFacts.size}</dd></div>
        </dl>
      )}
      <footer>{entry.role} reference · {modelFacts?.material || 'GLB'} · Lazy official asset · Reference Library only</footer>
    </section>
  );
}
