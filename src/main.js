import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createBlobCreature } from './blobCreature.js';
import { createGPUFurPhysics } from './gpuPhysics.js';
import { createGPUFurSystem } from './furSystem.js';
import { createMinimalUI, FUR_PRESETS } from './ui.js';
import { createEnvironmentManager } from './environments.js';
import { createPetBrain, loadSavedPetData } from './petBrain.js';

const container = document.getElementById('canvas-container');
const uiContainer = document.getElementById('ui-root');
const hudHint = document.getElementById('hud-hint');

const urlSearchParams = new URLSearchParams(window.location.search);
const forceWebGL = urlSearchParams.get('gpuFur') === '0' || urlSearchParams.get('mode') === 'webgl';
const initialGpuFur = !forceWebGL;

// Load saved appearance and profile if present, defaulting to Cozy Desk ('highrise') and WebGPU Fur
const savedData = loadSavedPetData();
const savedApp = savedData?.appearance || {};
const savedProf = savedData?.profile || {};

const simState = {
  ...FUR_PRESETS[0],
  ...savedApp,
  accessory: savedProf.accessory || savedApp.accessory || 'none',
  eyeColor: savedProf.eyeColor || savedApp.eyeColor || '#3d285c',
  petName: savedProf.name || 'Mochi-Puff',
  keyColor: savedApp.keyColor || '#ffd8a8',
  lightAngle: savedApp.lightAngle ?? 108,
  lightIntensity: savedApp.lightIntensity ?? 1.38,
  rimIntensity: savedApp.rimIntensity ?? 0.50,
  windStrength: savedApp.windStrength ?? 0.24,
  environment: savedApp.environment || 'highrise', // Cozy Desk default
  gpuFurEnabled: savedApp.gpuFurEnabled !== undefined ? Boolean(savedApp.gpuFurEnabled) : initialGpuFur,
};

// Detect software WebGL for automatic performance fallback on weaker devices
const isSoftwareGl = (() => {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
})();

// 1. Initialize WebGL2 Renderer
const renderer = new THREE.WebGLRenderer({
  antialias: !isSoftwareGl,
  powerPreference: 'high-performance',
  alpha: true,
});
const defaultDPR = isSoftwareGl ? 1.0 : Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(defaultDPR);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = !isSoftwareGl;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
if (container) container.appendChild(renderer.domElement);

// Handle WebGL context loss & restoration gracefully
renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
});

// 2. Scene & Camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  80
);
camera.position.set(0.0, 0.45, 6.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = !isSoftwareGl;
controls.dampingFactor = 0.06;
controls.minDistance = 2.6;
controls.maxDistance = 15.0;
controls.maxPolarAngle = Math.PI * 0.62;
controls.target.set(0, 0.05, 0);

// 3. Synchronized 3-Point Studio Lighting Rig
const keyLight = new THREE.DirectionalLight('#ffd8a8', simState.lightIntensity * 1.4);
keyLight.castShadow = !isSoftwareGl;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.bias = -0.0005;
keyLight.shadow.radius = 2.5;
keyLight.shadow.camera.left = -2.2;
keyLight.shadow.camera.right = 2.2;
keyLight.shadow.camera.top = 2.2;
keyLight.shadow.camera.bottom = -2.2;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 10.0;
keyLight.shadow.camera.updateProjectionMatrix();
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight('#f472b6', simState.rimIntensity * 1.2);
rimLight.position.set(-2.4, 1.8, -3.2);
scene.add(rimLight);

const hemiLight = new THREE.HemisphereLight('#818cf8', '#c2410c', 0.96);
scene.add(hemiLight);

// 4. Create Stylized Blob Creature ("Mochi-Puff") + Hybrid GPU Fur + GPGPU Physics
const creature = createBlobCreature();
creature.setAccessory(simState.accessory);
creature.setEyeColor(simState.eyeColor);
scene.add(creature.root);

const gpuPhysics = createGPUFurPhysics(renderer);
if (simState.gpuFurEnabled && !gpuPhysics.isGPGPUActive) {
  simState.gpuFurEnabled = false;
}
const furSystem = createGPUFurSystem(creature.bodyGeometry, simState);

creature.root.add(furSystem.shellMesh);
creature.root.add(furSystem.strandMesh);

// Initialize multi-environment manager (Cozy Desk default, Studio, Cloud Sky, AR Camera)
const envManager = createEnvironmentManager({
  scene,
  renderer,
  container,
  keyLight,
  rimLight,
  hemiLight,
  furSystem,
  camera,
});

function updateLightingFromState() {
  const rad = (simState.lightAngle * Math.PI) / 180.0;
  const lx = Math.sin(rad) * 2.8;
  const ly = 2.1;
  const lz = Math.cos(rad) * 2.8;

  keyLight.position.set(lx, ly, lz);
  keyLight.intensity = simState.lightIntensity * 1.35;
  rimLight.intensity = simState.rimIntensity * 1.15;
  if (simState.keyColor) {
    keyLight.color.set(simState.keyColor);
    furSystem.sharedUniforms.uKeyLightColor.value.set(simState.keyColor);
  }

  furSystem.sharedUniforms.uKeyLightDir.value.set(lx, ly, lz).normalize();
  furSystem.sharedUniforms.uKeyLightIntensity.value = simState.lightIntensity;
  furSystem.sharedUniforms.uRimIntensity.value = simState.rimIntensity;

  creature.skinMaterial.color.set(simState.baseColor).multiplyScalar(0.55);
}

function applyCameraFramingForEnvironment(envId) {
  const isDesk = envId === 'highrise';
  const isAR = envId === 'ar';
  const s = isDesk || isAR ? 0.25 : 1.0;
  const deskX = isDesk ? -0.14 : 0.0;
  const deskZ = isDesk ? 0.42 : 0.0;
  creature.setEnvironmentScale(s, deskX, deskZ);

  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const mobileZoomOut = isMobile
    ? Math.max(1.45, Math.min(1.95, 0.82 / Math.max(0.42, aspect)))
    : 1.0;

  if (isAR) {
    const targetY = -0.94 * (1.0 - s) + 0.05 * s;
    controls.target.set(0.0, targetY, 0.0);
    camera.position.set(0.0, 0.35, 6.2 * mobileZoomOut);
    controls.minDistance = 1.4;
    controls.maxDistance = 14.0 * mobileZoomOut;
    controls.update();
  } else {
    const targetY = -0.94 * (1.0 - s) + 0.05 * s;
    controls.target.set(deskX, targetY, deskZ);
    camera.position.set(deskX, targetY + 0.40 * s, deskZ + 6.4 * s * mobileZoomOut);
    controls.minDistance = 2.6 * s;
    controls.maxDistance = 15.0 * s * mobileZoomOut;
    controls.update();
  }
}

function applyEnvironmentPreset(envId) {
  const prevEnv = simState.environment;
  simState.environment = envId;

  if (typeof creature !== 'undefined' && creature.resetPlacement) {
    if ((prevEnv === 'ar' && envId !== 'ar') || (envId !== 'ar' && creature.isPlaced && creature.isPlaced())) {
      creature.resetPlacement(false);
    }
  }

  const envPreset = envManager.setEnvironment(envId);
  const u = furSystem.sharedUniforms;
  if (envPreset) {
    if (envPreset.keyColor !== undefined) {
      simState.keyColor = envPreset.keyColor;
    }
    simState.lightAngle = envPreset.lightAngle;
    simState.lightIntensity = envPreset.lightIntensity;
    simState.rimIntensity = envPreset.rimIntensity;
    simState.windStrength = envPreset.windStrength;
    u.uWindStrength.value = envPreset.windStrength;
  }
  applyCameraFramingForEnvironment(envId);
  updateLightingFromState();
}

const ALLOWED_ENV_IDS = new Set(['studio', 'meadow', 'highrise', 'ar']);
const urlEnvParam = new URLSearchParams(window.location.search).get('env');
const initialEnvId = urlEnvParam && ALLOWED_ENV_IDS.has(urlEnvParam) ? urlEnvParam : simState.environment;
applyEnvironmentPreset(initialEnvId);

let isMovePetMode = false;
let boopShockwave = 0.0;

// 5. Build Minimal UI & Bind AI Pet Brain
const ui = createMinimalUI(uiContainer, simState, (key, value) => {
  const u = furSystem.sharedUniforms;
  switch (key) {
    case 'environment': {
      applyEnvironmentPreset(value);
      ui.syncUI();
      break;
    }
    case 'toggleGPUFur': {
      const enabled = Boolean(value);
      simState.gpuFurEnabled = enabled;
      furSystem.setGPUFurEnabled(enabled);
      ui.setGPUFurEnabled(enabled);
      break;
    }
    case 'toggleMovePetMode': {
      isMovePetMode = Boolean(value);
      break;
    }
    case 'accessory': {
      simState.accessory = value;
      creature.setAccessory(value);
      if (petBrain) petBrain.updateProfile({ accessory: value });
      break;
    }
    case 'eyeColor': {
      simState.eyeColor = value;
      creature.setEyeColor(value);
      if (petBrain) petBrain.updateProfile({ eyeColor: value });
      break;
    }
    case 'triggerTrick': {
      if (value && value.emotion) {
        creature.setEmotion(value.emotion);
        if (petBrain) petBrain.state.emotions.currentMood = value.emotion;
      }
      if (value && value.action) {
        creature.triggerAction(value.action);
        if (value.action === 'puff_fur') boopShockwave = 1.5;
        if (value.action === 'bounce') boopShockwave = 1.3;
        if (value.action === 'wiggle') boopShockwave = 1.0;
      }
      if (petBrain) {
        petBrain.notifyDirectTouch('trick');
        petBrain.saveToStorage();
      }
      break;
    }
    case 'arToggleMirror': {
      const mirrored = envManager.toggleMirror();
      ui.setMirrorLabel(mirrored);
      break;
    }
    case 'arFlipCamera':
      envManager.flipCamera();
      break;
    case 'furLength':
      u.uFurLength.value = value;
      break;
    case 'furDensity':
      furSystem.updateDensity(value);
      break;
    case 'clumping':
      u.uClumping.value = value;
      break;
    case 'curliness':
      u.uCurliness.value = value;
      break;
    case 'baseColor':
      u.uBaseColor.value.set(value);
      creature.skinMaterial.color.set(value).multiplyScalar(0.55);
      break;
    case 'tipColor':
      u.uTipColor.value.set(value);
      break;
    case 'roughness':
      u.uRoughness.value = value;
      break;
    case 'specular':
      u.uSpecular.value = value;
      break;
    case 'keyColor':
    case 'lightAngle':
    case 'lightIntensity':
    case 'rimIntensity':
      updateLightingFromState();
      break;
    case 'windStrength':
      u.uWindStrength.value = value;
      break;
    case 'arToggleTapPlace':
      tapToPlaceEnabled = Boolean(value);
      break;
    case 'arToggleLightEst': {
      const enabled = Boolean(value);
      envManager.setLightEstimationEnabled(enabled);
      break;
    }
    case 'arResetPosition':
      creature.resetPlacement();
      envManager.resetARAnchor();
      break;
    default:
      break;
  }
});

const petBrain = createPetBrain({
  creature,
  simState,
  onStateChange: (brainState, relInfo) => {
    ui.updatePetState(brainState, relInfo);
  },
  onSubtitleChange: (text, visible) => {
    ui.setSubtitle(text, visible);
  },
});

ui.bindPetBrain(petBrain);
ui.syncUI();

let tapToPlaceEnabled = true;

envManager.onARStatusChange((statusText, isLive) => {
  ui.setARStatus(statusText, isLive);
});

envManager.onPlaneDetected((planeInfo) => {
  ui.setARPlaneStatus(
    planeInfo.surfaceType,
    planeInfo.planeY,
    planeInfo.confidence,
    planeInfo.featureCount
  );
});

envManager.onLightEstimated((lightInfo) => {
  if (simState.environment !== 'ar') return;
  if (!lightInfo.isManualReset && !envManager.isLightEstimationEnabled()) return;
  simState.keyColor = lightInfo.keyColor;
  simState.lightAngle = lightInfo.lightAngle;
  simState.lightIntensity = lightInfo.lightIntensity;
  simState.rimIntensity = lightInfo.rimIntensity;
  updateLightingFromState();
  ui.setARLightStatus(lightInfo);
});

// 6. Interactive 3D Pointer Raycasting for Petting, Combing, Booping & Gentle Moving
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2(0, 0);
const pointerLocalPos = new THREE.Vector3(0, 0, 2);
const prevPointerLocalPos = new THREE.Vector3(0, 0, 2);
const pointerVelocity = new THREE.Vector3(0, 0, 0);
let isPointerOverCreature = false;
let isDraggingCreature = false;
let pointerDownPos = { x: 0, y: 0 };
let prevDragClient = { x: 0, y: 0 };

function isEventOnUIOverlay(e) {
  return Boolean(
    e.target &&
      typeof e.target.closest === 'function' &&
      (e.target.closest('#pet-top-bar') ||
        e.target.closest('#chat-dock') ||
        e.target.closest('.pet-modal-card') ||
        e.target.closest('.voice-subtitle-wrap') ||
        e.target.closest('.exit-compact-btn') ||
        e.target.closest('#page-nav') ||
        e.target.closest('#scene-nav'))
  );
}

window.addEventListener('pointermove', (e) => {
  if (isEventOnUIOverlay(e)) {
    isPointerOverCreature = false;
    return;
  }

  pointerNDC.x = (e.clientX / window.innerWidth) * 2.0 - 1.0;
  pointerNDC.y = -(e.clientY / window.innerHeight) * 2.0 + 1.0;

  if (isDraggingCreature && (isMovePetMode || e.shiftKey)) {
    const dx = ((e.clientX - prevDragClient.x) / window.innerWidth) * 2.2;
    const dz = ((e.clientY - prevDragClient.y) / window.innerHeight) * 1.6;
    prevDragClient.x = e.clientX;
    prevDragClient.y = e.clientY;
    creature.addDragOffset(dx, dz);
    petBrain.notifyDirectTouch('pet');
    return;
  }

  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObject(creature.bodyMesh, false);
  if (hits.length > 0) {
    prevPointerLocalPos.copy(pointerLocalPos);
    pointerLocalPos.copy(hits[0].point);
    creature.root.worldToLocal(pointerLocalPos);

    if (isPointerOverCreature) {
      pointerVelocity.subVectors(pointerLocalPos, prevPointerLocalPos).multiplyScalar(32.0);
      if (isDraggingCreature || pointerVelocity.lengthSq() > 0.15) {
        petBrain.notifyDirectTouch('pet');
      }
    }
    isPointerOverCreature = true;
    if (container) container.style.cursor = isMovePetMode ? 'move' : 'pointer';
    if (simState.environment === 'ar') {
      envManager.updateARCursor(pointerNDC.x, pointerNDC.y, false);
    }
  } else {
    isPointerOverCreature = false;
    pointerVelocity.multiplyScalar(0.5);
    if (container) container.style.cursor = 'grab';
    if (simState.environment === 'ar' && tapToPlaceEnabled) {
      envManager.updateARCursor(pointerNDC.x, pointerNDC.y, true);
    }
  }
});

window.addEventListener('pointerdown', (e) => {
  pointerDownPos.x = e.clientX;
  pointerDownPos.y = e.clientY;
  prevDragClient.x = e.clientX;
  prevDragClient.y = e.clientY;
  if (isEventOnUIOverlay(e)) {
    return;
  }
  if (isPointerOverCreature) {
    isDraggingCreature = true;
    controls.enabled = false;
  }
});

window.addEventListener('pointerup', (e) => {
  isDraggingCreature = false;
  controls.enabled = true;
  const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  if (moveDist < 6) {
    if (isEventOnUIOverlay(e)) {
      return;
    }
    if (isPointerOverCreature) {
      creature.triggerBoop();
      boopShockwave = 1.0;
      petBrain.notifyDirectTouch('boop');
    } else if (simState.environment === 'ar' && tapToPlaceEnabled) {
      const planeHit = envManager.estimatePlaneAt(pointerNDC.x, pointerNDC.y);
      if (planeHit && planeHit.point) {
        pointerNDC.set(0, 0);
        creature.placeAt(planeHit.point, planeHit.normal, true, camera.position);
        envManager.triggerPlacementPulse(planeHit.point);
      }
    }
  }
});

let targetDPR = defaultDPR;
let currentDPR = targetDPR;
let lowFpsFrames = 0;
let highFpsFrames = 0;
let wasMobileViewport = window.matchMedia('(max-width: 768px)').matches;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(currentDPR);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const isMobileNow = window.matchMedia('(max-width: 768px)').matches;
  if (isMobileNow || isMobileNow !== wasMobileViewport) {
    wasMobileViewport = isMobileNow;
    applyCameraFramingForEnvironment(simState.environment);
  }
});

// 7. Zero-GC Real-Time Render Loop (Decoupled from AI Network Requests)
const clock = new THREE.Clock();
let elapsedTime = 0.0;
const webglInertiaDisp = new THREE.Vector3(0, 0, 0);
const webglInertiaVel = new THREE.Vector3(0, 0, 0);
const webglForceTmp = new THREE.Vector3(0, 0, 0);

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.033);
  elapsedTime += dt;

  // Automatic performance fallback guard for weaker devices
  if (dt > 0.026) {
    lowFpsFrames++;
    highFpsFrames = 0;
    if (lowFpsFrames > 50 && currentDPR > 1.0) {
      currentDPR = 1.0;
      renderer.setPixelRatio(1.0);
      lowFpsFrames = 0;
    }
  } else if (dt < 0.018 && !isSoftwareGl) {
    highFpsFrames++;
    if (highFpsFrames > 300 && currentDPR < targetDPR) {
      currentDPR = targetDPR;
      renderer.setPixelRatio(targetDPR);
      highFpsFrames = 0;
    }
  }

  controls.update();

  // Decay boop shockwave
  if (boopShockwave > 0.001) {
    boopShockwave *= Math.exp(-dt * 2.8);
  } else {
    boopShockwave = 0.0;
  }

  // Decay pointer velocity smoothly
  pointerVelocity.multiplyScalar(Math.exp(-dt * 12.0));

  // Step AI Pet Brain (Autonomous state machine & real-time TTS voice lip-sync amplitude)
  const { voiceAmplitude } = petBrain.update(dt);

  // Update creature breathing, eye tracking, mouth lip-sync, expressions & bounce inertia
  creature.update(dt, pointerNDC, camera.position, simState.environment === 'ar');

  // Update active 3D / AR environment
  envManager.update(elapsedTime, simState.windStrength, creature.root);

  // Combine boop shockwave with live voice resonance so Mochi's fur vibrates & moves with speech
  const effectiveShockwave = Math.max(boopShockwave, voiceAmplitude * 0.36);

  let physicsTexture = gpuPhysics.fallbackTexture;
  if (simState.gpuFurEnabled) {
    physicsTexture = gpuPhysics.step({
      time: elapsedTime,
      dt,
      windStrength: simState.windStrength,
      creatureVelocity: creature.animState.velocity,
      creatureAngularVel: creature.animState.angularVelocity,
      pointerLocalPos,
      pointerVelocity,
      pointerActive: isPointerOverCreature,
      boopShockwave: effectiveShockwave,
    });
  } else {
    webglForceTmp.set(0, -0.32, 0);
    webglForceTmp.addScaledVector(creature.animState.velocity, -1.65);
    if (isPointerOverCreature) {
      webglForceTmp.addScaledVector(pointerVelocity, 0.85);
    }
    webglForceTmp.addScaledVector(webglInertiaDisp, -24.0);
    webglInertiaVel.addScaledVector(webglForceTmp, dt);
    webglInertiaVel.multiplyScalar(Math.exp(-5.5 * dt));
    webglInertiaDisp.addScaledVector(webglInertiaVel, dt);
    if (webglInertiaDisp.lengthSq() > 0.64) {
      webglInertiaDisp.normalize().multiplyScalar(0.8);
    }
  }

  // Update shared fur uniforms (synchronizing fur length puffiness & voice shockwave)
  const u = furSystem.sharedUniforms;
  u.uPhysicsTex.value = physicsTexture;
  u.uTime.value = elapsedTime;
  u.uFurLength.value = simState.furLength * creature.getFurLengthMultiplier();
  u.uPointerLocalPos.value.copy(pointerLocalPos);
  u.uPointerActive.value = isPointerOverCreature ? 1.0 : 0.0;
  u.uWebGLInertia.value.copy(webglInertiaDisp);
  u.uBoopShockwave.value = effectiveShockwave;

  renderer.render(scene, camera);
}

animate();
