import * as THREE from 'three';

/**
 * Evaluates the anatomical follicle growth mask at a local position on the blob surface.
 * Returns a float in [0.0, 1.0]:
 * - 0.0 inside eye sockets and mouth recess (prevents hair from poking through eyes/mouth)
 * - Smoothly tapers (0.2 -> 1.0) around the eye rims, nose bridge, and paw pads
 * - Slightly longer/fluffier (1.15) on the cheek tufts, chest fluff, and ear tips
 */
export function evaluateFollicleMask(x, y, z) {
  // Left and right eye centers in local space
  const lx = x + 0.31;
  const rx = x - 0.31;
  const ey = y - 0.16;
  const ez = z - 0.88;

  const distLeftEye = Math.sqrt(lx * lx + ey * ey * 1.1 + ez * ez);
  const distRightEye = Math.sqrt(rx * rx + ey * ey * 1.1 + ez * ez);
  const minEyeDist = Math.min(distLeftEye, distRightEye);

  // Tightly match the cornea radius (r < 0.148 = 0), then transition immediately
  // into short velvety eyelash/brow fuzz (0.28 -> 1.0) so there is NO bald skin ring!
  if (minEyeDist < 0.145) {
    return 0.0;
  }
  const eyeMask = 0.28 + 0.72 * smoothstep(0.145, 0.25, minEyeDist);

  // Small mask right under the pink nose button & mouth
  const mx = x / 1.25;
  const my = (y - 0.04) * 1.4;
  const mz = z - 0.96;
  const distMouth = Math.sqrt(mx * mx + my * my + mz * mz);
  const mouthMask = 0.22 + 0.78 * smoothstep(0.065, 0.16, distMouth);

  // Bottom belly contact pad taper
  const bottomMask = smoothstep(-1.05, -0.72, y);

  // Extra fluff boost on cheeks and chest tuft
  const cheekDist = Math.min(
    Math.hypot(x + 0.56, y - 0.02, z - 0.68),
    Math.hypot(x - 0.56, y - 0.02, z - 0.68)
  );
  const cheekFluff = 1.0 + 0.22 * (1.0 - smoothstep(0.0, 0.42, cheekDist));

  return Math.max(0.0, Math.min(1.25, eyeMask * mouthMask * bottomMask * cheekFluff));
}

/**
 * Computes the biological grooming flow tangent vector on the blob surface.
 * Hairs part naturally from a crown whorl at the top of the head, sweep around
 * the eye sockets, and flow downward with a subtle cheek/belly swirl.
 */
export function evaluateGroomFlow(x, y, z, nx, ny, nz) {
  // Base gravity/growth direction from crown (0, 1.05, 0.1)
  let fx = x * 0.25;
  let fy = -0.85;
  let fz = (z - 0.15) * 0.25;

  // Sweep tangentially around the left and right eyes like real facial fur
  const eyeCenters = [
    [-0.33, 0.17, 0.86],
    [0.33, 0.17, 0.86]
  ];
  for (let i = 0; i < 2; i++) {
    const [ex, ey, ez] = eyeCenters[i];
    const dx = x - ex;
    const dy = y - ey;
    const dz = z - ez;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-5;
    if (d < 0.48) {
      const influence = (1.0 - d / 0.48) * 0.85;
      fx += (dx / d) * influence;
      fy += (dy / d) * influence * 0.6;
      fz += (dz / d) * influence * 0.3;
    }
  }

  // Project onto the tangent plane orthogonal to surface normal N
  const dotFN = fx * nx + fy * ny + fz * nz;
  let tx = fx - dotFN * nx;
  let ty = fy - dotFN * ny;
  let tz = fz - dotFN * nz;
  const len = Math.sqrt(tx * tx + ty * ty + tz * tz);
  if (len > 1e-5) {
    tx /= len;
    ty /= len;
    tz /= len;
  } else {
    tx = 1.0;
    ty = 0.0;
    tz = 0.0;
  }
  return [tx, ty, tz];
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0.0, Math.min(1.0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3.0 - 2.0 * t);
}

/**
 * Sculpt a unit sphere vertex into our cute "Mochi-Puff" blob creature with
 * chubby pear cheeks, perky ears, stubby side arms, and recessed eye sockets.
 */
function sculptBlobPosition(u, v, w) {
  let x = u;
  let y = v;
  let z = w;

  // 1. Pear/Mochi silhouette: chubby lower cheeks & belly, slightly tapered crown
  const bellyWidth = 1.0 + 0.22 * Math.exp(-Math.pow((y + 0.24) / 0.55, 2.0));
  const cheekPuff = 1.0 + 0.14 * Math.exp(-Math.pow((y + 0.05) / 0.38, 2.0)) * Math.max(0, z);
  x *= bellyWidth * cheekPuff;
  z *= (0.94 + 0.12 * Math.exp(-Math.pow((y + 0.22) / 0.6, 2.0)));
  y *= 0.96;

  // Slightly flatten the base so Mochi-Puff sits cozily on the ground
  if (y < -0.55) {
    const t = (-0.55 - y) / 0.45;
    y = -0.55 - Math.tanh(t * 1.15) * 0.32;
  }

  // 2. Perky sculptural ears on top-left and top-right
  const leftEarDir = normalize3(-0.46, 0.86, 0.06);
  const rightEarDir = normalize3(0.46, 0.86, 0.06);
  const dotLEar = Math.max(0.0, u * leftEarDir[0] + v * leftEarDir[1] + w * leftEarDir[2]);
  const dotREar = Math.max(0.0, u * rightEarDir[0] + v * rightEarDir[1] + w * rightEarDir[2]);
  const earProfile = Math.pow(Math.max(dotLEar, dotREar), 14.0) * 0.44;
  x += u * earProfile * 0.75;
  y += v * earProfile * 1.15;
  z += w * earProfile * 0.55;

  // 3. Cute stubby side nubbins (little arms)
  const leftArmDir = normalize3(-0.94, -0.08, 0.28);
  const rightArmDir = normalize3(0.94, -0.08, 0.28);
  const dotLArm = Math.max(0.0, u * leftArmDir[0] + v * leftArmDir[1] + w * leftArmDir[2]);
  const dotRArm = Math.max(0.0, u * rightArmDir[0] + v * rightArmDir[1] + w * rightArmDir[2]);
  const armProfile = Math.pow(Math.max(dotLArm, dotRArm), 18.0) * 0.24;
  x += u * armProfile * 1.1;
  y += v * armProfile * 0.6;
  z += w * armProfile * 0.9;

  // 4. Subtle anatomical eye socket indentation so the glossy eyes sit nested inside the plush fur
  const lx = x + 0.33;
  const rx = x - 0.33;
  const ey = y - 0.17;
  const ez = z - 0.86;
  const dEye = Math.min(
    Math.sqrt(lx * lx + ey * ey + ez * ez),
    Math.sqrt(rx * rx + ey * ey + ez * ez)
  );
  if (dEye < 0.32) {
    const indent = (1.0 - smoothstep(0.0, 0.32, dEye)) * 0.065;
    z -= indent;
  }

  return [x, y, z];
}

function normalize3(x, y, z) {
  const l = Math.sqrt(x * x + y * y + z * z) || 1.0;
  return [x / l, y / l, z / l];
}

/**
 * Builds the continuous organic blob geometry with baked vertex attributes:
 * - `aFollicleMask`: float [0..1.25] controlling fur length & density mask
 * - `aGroomTangent`: vec3 biological fur flow direction
 */
export function createOrganicBlobGeometry(widthSegments = 96, heightSegments = 72) {
  const geom = new THREE.SphereGeometry(1.0, widthSegments, heightSegments);
  const posAttr = geom.attributes.position;
  const count = posAttr.count;

  for (let i = 0; i < count; i++) {
    const u = posAttr.getX(i);
    const v = posAttr.getY(i);
    const w = posAttr.getZ(i);
    const [sx, sy, sz] = sculptBlobPosition(u, v, w);
    posAttr.setXYZ(i, sx, sy, sz);
  }

  geom.computeVertexNormals();

  const normAttr = geom.attributes.normal;
  const follicleMaskArray = new Float32Array(count);
  const groomTangentArray = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const nx = normAttr.getX(i);
    const ny = normAttr.getY(i);
    const nz = normAttr.getZ(i);

    follicleMaskArray[i] = evaluateFollicleMask(x, y, z);
    const [tx, ty, tz] = evaluateGroomFlow(x, y, z, nx, ny, nz);
    groomTangentArray[i * 3] = tx;
    groomTangentArray[i * 3 + 1] = ty;
    groomTangentArray[i * 3 + 2] = tz;
  }

  geom.setAttribute('aFollicleMask', new THREE.BufferAttribute(follicleMaskArray, 1));
  geom.setAttribute('aGroomTangent', new THREE.BufferAttribute(groomTangentArray, 3));

  return geom;
}

/**
 * Builds procedural 3D accessories that sit naturally on Mochi-Puff's head/ears/face.
 */
function createAccessoriesMap() {
  const map = {};

  // 1. Golden Star Crown (rests proudly atop the head fur)
  const crownGroup = new THREE.Group();
  crownGroup.position.set(0, 1.25, 0.08);
  crownGroup.rotation.x = 0.10;
  crownGroup.scale.set(1.2, 1.2, 1.2);
  const goldMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fbbf24'),
    roughness: 0.18,
    metalness: 0.88,
    emissive: new THREE.Color('#78350f'),
    emissiveIntensity: 0.25,
  });
  const gemMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f43f5e'),
    roughness: 0.12,
    metalness: 0.2,
    emissive: new THREE.Color('#e11d48'),
    emissiveIntensity: 0.65,
  });
  const baseBand = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.032, 14, 36), goldMat);
  baseBand.rotation.x = Math.PI / 2;
  crownGroup.add(baseBand);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 14), goldMat);
    spike.position.set(Math.sin(angle) * 0.23, 0.09, Math.cos(angle) * 0.23);
    crownGroup.add(spike);
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), gemMat);
    pearl.position.set(Math.sin(angle) * 0.23, 0.185, Math.cos(angle) * 0.23);
    crownGroup.add(pearl);
  }
  crownGroup.visible = false;
  map.crown = crownGroup;

  // 2. Sakura Ear Ribbon Bow (perched on the left ear)
  const bowGroup = new THREE.Group();
  bowGroup.position.set(-0.54, 1.18, 0.24);
  bowGroup.rotation.set(-0.12, -0.22, 0.40);
  bowGroup.scale.set(1.35, 1.35, 1.35);
  const ribbonMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fb7185'),
    roughness: 0.35,
    metalness: 0.12,
    emissive: new THREE.Color('#be123c'),
    emissiveIntensity: 0.22,
  });
  const knotMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffe4e6'),
    roughness: 0.28,
    metalness: 0.1,
    emissive: new THREE.Color('#fda4af'),
    emissiveIntensity: 0.25,
  });
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 14), knotMat);
  bowGroup.add(knot);
  for (const side of [-1, 1]) {
    const loopGeo = new THREE.ConeGeometry(0.12, 0.24, 16);
    loopGeo.rotateZ(side * Math.PI * 0.5);
    const loop = new THREE.Mesh(loopGeo, ribbonMat);
    loop.position.set(side * 0.12, 0.015, 0);
    loop.scale.set(1, 0.88, 0.55);
    bowGroup.add(loop);
  }
  bowGroup.visible = false;
  map.bow = bowGroup;

  // 3. Cozy Round Wireframe Glasses (rests right over the eyes)
  const glassesGroup = new THREE.Group();
  glassesGroup.position.set(0, 0.16, 1.12);
  glassesGroup.scale.set(1.08, 1.08, 1.08);
  const frameMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fcd34d'),
    roughness: 0.15,
    metalness: 0.9,
    emissive: new THREE.Color('#b45309'),
    emissiveIntensity: 0.25,
  });
  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.018, 14, 38), frameMat);
    rim.position.set(side * 0.31, 0.0, 0.0);
    rim.rotation.y = side * 0.18;
    glassesGroup.add(rim);
  }
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.26, 10), frameMat);
  bridge.rotation.z = Math.PI / 2;
  bridge.position.set(0, 0.02, 0.035);
  glassesGroup.add(bridge);
  glassesGroup.visible = false;
  map.glasses = glassesGroup;

  // 4. Fresh Leaf Sprout (emerges proudly from the crown)
  const sproutGroup = new THREE.Group();
  sproutGroup.position.set(0, 1.25, 0.08);
  sproutGroup.scale.set(1.25, 1.25, 1.25);
  const leafMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4ade80'),
    roughness: 0.3,
    metalness: 0.05,
    emissive: new THREE.Color('#15803d'),
    emissiveIntensity: 0.28,
  });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.26, 10), leafMat);
  stem.position.y = 0.12;
  sproutGroup.add(stem);
  for (const side of [-1, 1]) {
    const leafGeo = new THREE.SphereGeometry(0.105, 16, 12);
    leafGeo.scale(1.4, 0.34, 0.75);
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(side * 0.105, 0.24, 0);
    leaf.rotation.z = -side * 0.38;
    sproutGroup.add(leaf);
  }
  sproutGroup.visible = false;
  map.sprout = sproutGroup;

  // 5. Cozy Artist Beret (rests tilted atop the head)
  const beretGroup = new THREE.Group();
  beretGroup.position.set(0.12, 1.22, 0.05);
  beretGroup.rotation.set(0.10, 0.0, -0.22);
  beretGroup.scale.set(1.4, 1.22, 1.4);
  const beretMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#e11d48'),
    roughness: 0.75,
    metalness: 0.04,
    emissive: new THREE.Color('#881337'),
    emissiveIntensity: 0.22,
  });
  const beretDomeGeo = new THREE.SphereGeometry(0.40, 28, 20);
  beretDomeGeo.scale(1.15, 0.40, 1.12);
  const beretDome = new THREE.Mesh(beretDomeGeo, beretMat);
  beretGroup.add(beretDome);
  const beretTip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.10, 8), beretMat);
  beretTip.position.y = 0.16;
  beretGroup.add(beretTip);
  beretGroup.visible = false;
  map.beret = beretGroup;

  // 6. Starlight Halo (hovers glowing above the creature)
  const haloGroup = new THREE.Group();
  haloGroup.position.set(0, 1.50, 0.04);
  haloGroup.rotation.x = Math.PI / 2 + 0.1;
  haloGroup.scale.set(1.2, 1.2, 1.2);
  const haloMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fef08a'),
    roughness: 0.1,
    metalness: 0.1,
    emissive: new THREE.Color('#eab308'),
    emissiveIntensity: 0.95,
  });
  const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.026, 14, 48), haloMat);
  haloGroup.add(haloRing);
  haloGroup.visible = false;
  map.halo = haloGroup;

  return map;
}

/**
 * Creates the complete Stylized Blob Creature group ("Mochi-Puff"):
 * - Base velvety under-skin mesh
 * - Multi-layered glossy 3D eyes with customizable iris color, pupil tracking, eyelids, and dual catchlights
 * - Rosy translucent cheek blush patches that react to emotion & petting
 * - Articulated 3D mouth & tongue synchronized with voice speech & emotional expressions
 * - 3D customizable accessories
 * - Interactive boop/jump, breathing, stretching, wiggling, sleepy, and autonomous physics states
 */
export function createBlobCreature() {
  const root = new THREE.Group();
  root.name = 'MochiPuffCreature';

  const bodyGeometry = createOrganicBlobGeometry(96, 72);

  // Under-skin velvety material (visible at roots and around eyes/mouth)
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4a3248'),
    roughness: 0.78,
    metalness: 0.02
  });

  const bodyMesh = new THREE.Mesh(bodyGeometry, skinMaterial);
  bodyMesh.name = 'BlobBodyMesh';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  root.add(bodyMesh);

  // Facial features container so eyes, blush, nose, mouth, and accessories move with head tilt
  const faceGroup = new THREE.Group();
  faceGroup.name = 'FacialFeatures';
  root.add(faceGroup);

  const eyeMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#120d1a'),
    roughness: 0.04,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    reflectivity: 1.0
  });

  const irisMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#3d285c')
  });

  const highlightMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ffffff')
  });

  const warmHighlightMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ffe4f2')
  });

  const eyes = [];
  const eyeSides = [-1, 1];

  for (const side of eyeSides) {
    const eyePivot = new THREE.Group();
    eyePivot.position.set(side * 0.31, 0.16, 0.94);
    eyePivot.rotation.y = side * 0.22;
    eyePivot.rotation.x = -0.06;

    // Dark glossy cornea
    const eyeballGeo = new THREE.SphereGeometry(0.17, 32, 24);
    eyeballGeo.scale(0.96, 1.08, 0.68);
    const eyeball = new THREE.Mesh(eyeballGeo, eyeMaterial);
    eyePivot.add(eyeball);

    // Radiant customizable eye iris crescent
    const irisGeo = new THREE.SphereGeometry(0.145, 24, 16);
    irisGeo.scale(0.95, 0.98, 0.44);
    const iris = new THREE.Mesh(irisGeo, irisMaterial);
    iris.position.set(0, -0.015, 0.098);
    eyePivot.add(iris);

    // Primary large anime catchlight (top-inner)
    const catchlightMainGeo = new THREE.SphereGeometry(0.045, 16, 12);
    catchlightMainGeo.scale(1.0, 1.18, 0.32);
    const catchlightMain = new THREE.Mesh(catchlightMainGeo, highlightMat);
    catchlightMain.position.set(-side * 0.042, 0.052, 0.112);
    eyePivot.add(catchlightMain);

    // Secondary lower rim catchlight
    const catchlightSubGeo = new THREE.SphereGeometry(0.023, 14, 10);
    catchlightSubGeo.scale(1.0, 1.0, 0.32);
    const catchlightSub = new THREE.Mesh(catchlightSubGeo, warmHighlightMat);
    catchlightSub.position.set(side * 0.048, -0.052, 0.11);
    eyePivot.add(catchlightSub);

    faceGroup.add(eyePivot);
    eyes.push({
      pivot: eyePivot,
      basePos: eyePivot.position.clone(),
      iris,
      catchlightMain,
      catchlightSub,
      side
    });
  }

  // Rosy glowing blush ovals nestled right below the eyes on the plush cheeks
  const blushMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ff5c93'),
    transparent: true,
    opacity: 0.55,
    depthWrite: false
  });

  const blushMeshes = [];
  for (const side of eyeSides) {
    const blushGeo = new THREE.SphereGeometry(0.12, 20, 16);
    blushGeo.scale(1.4, 0.75, 0.35);
    const blush = new THREE.Mesh(blushGeo, blushMat);
    blush.position.set(side * 0.49, 0.0, 0.96);
    blush.rotation.y = side * 0.34;
    blush.rotation.z = -side * 0.1;
    faceGroup.add(blush);
    blushMeshes.push(blush);
  }

  // Cute bright pink nose button + W-shaped cat smile positioned proudly on the muzzle surface
  const noseMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ff94b8')
  });
  const noseGeo = new THREE.SphereGeometry(0.048, 18, 14);
  noseGeo.scale(1.3, 0.88, 0.75);
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, 0.075, 1.05);
  faceGroup.add(nose);

  // Cute W-mouth made from two torus arcs
  const mouthMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#3a102e') });
  const mouthArcs = [];
  for (const side of [-1, 1]) {
    const arcGeo = new THREE.TorusGeometry(0.046, 0.013, 10, 20, Math.PI * 0.92);
    const arc = new THREE.Mesh(arcGeo, mouthMat);
    arc.position.set(side * 0.043, 0.035, 1.045);
    arc.rotation.x = Math.PI + 0.15;
    arc.rotation.y = side * 0.14;
    faceGroup.add(arc);
    mouthArcs.push({ mesh: arc, side });
  }

  // Articulated 3D inner mouth cavity & tongue for real-time voice lip-sync and yawns/expressions
  const openMouthGroup = new THREE.Group();
  openMouthGroup.position.set(0, -0.008, 1.035);

  const cavityGeo = new THREE.SphereGeometry(0.056, 20, 16);
  cavityGeo.scale(1.15, 0.95, 0.35);
  const cavityMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#2a0821') });
  const cavityMesh = new THREE.Mesh(cavityGeo, cavityMat);
  openMouthGroup.add(cavityMesh);

  const tongueGeo = new THREE.SphereGeometry(0.038, 16, 12);
  tongueGeo.scale(1.1, 0.65, 0.32);
  const tongueMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6b9d') });
  const tongueMesh = new THREE.Mesh(tongueGeo, tongueMat);
  tongueMesh.position.set(0, -0.016, 0.008);
  openMouthGroup.add(tongueMesh);

  openMouthGroup.scale.set(0.001, 0.001, 0.001);
  openMouthGroup.visible = false;
  faceGroup.add(openMouthGroup);

  // Attach procedural 3D accessories
  const accessoriesMap = createAccessoriesMap();
  Object.values(accessoriesMap).forEach((acc) => {
    faceGroup.add(acc);
  });
  let currentAccessoryId = 'none';

  // Animation, Emotion, Action & Voice Synchronization state
  const animState = {
    time: 0,
    baseScale: 1.0,
    baseX: 0.0,
    baseY: 0.0,
    baseZ: 0.0,
    blinkTimer: 0,
    nextBlink: 2.8,
    boopImpulse: 0,
    boopPhase: 0,
    prevPosition: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    angularVelocity: new THREE.Vector3(),
    targetLook: new THREE.Vector2(0, 0),
    currentLook: new THREE.Vector2(0, 0),
    // AI Pet extensions
    emotion: 'happy',
    behaviorState: 'idle', // idle | looking | wandering | playing | listening | speaking | reacting | sleeping
    mouthOpenness: 0.0,
    targetMouthOpenness: 0.0,
    isSpeaking: false,
    pettingIntensity: 0.0,
    furLengthMultiplier: 1.0,
    targetFurLengthMultiplier: 1.0,
    // Action timers
    actionType: 'none',
    actionTimer: 0.0,
    actionDuration: 0.0,
    // Autonomous wandering / looking offset
    wanderOffset: new THREE.Vector2(0, 0),
    targetWanderOffset: new THREE.Vector2(0, 0),
    autonomousLook: new THREE.Vector2(0, 0),
    useAutonomousLook: false,
    userDragOffset: new THREE.Vector2(0, 0)
  };

  // Spatial anchor position & viewer-facing orientation for AR plane placement
  const anchorPos = new THREE.Vector3(0, 0, 0);
  const targetAnchorPos = new THREE.Vector3(0, 0, 0);
  const startAnchorPos = new THREE.Vector3(0, 0, 0);
  let isPlaced = false;
  let isPlacing = false;
  let placeProgress = 1.0;
  let placeHopHeight = 0.0;
  let facingYaw = 0.0;
  let facingPitch = 0.0;
  let targetFacingYaw = 0.0;
  let targetFacingPitch = 0.0;
  let faceViewerHoldTimer = 0.0;

  function placeAt(targetWorldPos, normal, animate = true, cameraPos = null) {
    if (!targetWorldPos) return;
    isPlaced = true;
    const s = animState.baseScale;
    const targetCenterY = targetWorldPos.y + 0.94 * s;

    animState.targetLook.set(0, 0);
    animState.currentLook.set(0, 0);
    faceViewerHoldTimer = 1.4;

    if (cameraPos) {
      const dx = cameraPos.x - targetWorldPos.x;
      const dy = cameraPos.y - targetCenterY;
      const dz = cameraPos.z - targetWorldPos.z;
      const horizDist = Math.max(0.001, Math.hypot(dx, dz));
      targetFacingYaw = Math.atan2(dx, dz);
      targetFacingPitch = -Math.atan2(dy, horizDist) * 0.72;
      if (!animate) {
        facingYaw = targetFacingYaw;
        facingPitch = targetFacingPitch;
      }
    }

    if (animate) {
      startAnchorPos.copy(anchorPos);
      targetAnchorPos.set(targetWorldPos.x, targetCenterY, targetWorldPos.z);
      placeProgress = 0.0;
      isPlacing = true;
      placeHopHeight = Math.min(0.65, Math.max(0.18, startAnchorPos.distanceTo(targetAnchorPos) * 0.22));
      animState.boopImpulse = 0.85;
      animState.boopPhase = 0.0;
    } else {
      anchorPos.set(targetWorldPos.x, targetCenterY, targetWorldPos.z);
      targetAnchorPos.copy(anchorPos);
      isPlacing = false;
      placeProgress = 1.0;
    }
  }

  function resetPlacement(animate = true) {
    isPlaced = false;
    targetFacingYaw = 0.0;
    targetFacingPitch = 0.0;
    faceViewerHoldTimer = 0.0;
    animState.targetLook.set(0, 0);
    animState.currentLook.set(0, 0);
    animState.userDragOffset.set(0, 0);
    const s = animState.baseScale;
    const ox = animState.baseX || 0.0;
    const oz = animState.baseZ || 0.0;
    const targetY = -0.94 + 0.94 * s;
    if (animate) {
      startAnchorPos.copy(anchorPos);
      targetAnchorPos.set(ox, targetY, oz);
      placeProgress = 0.0;
      isPlacing = true;
      placeHopHeight = Math.min(0.55, Math.max(0.18, startAnchorPos.distanceTo(targetAnchorPos) * 0.22));
      animState.boopImpulse = 0.85;
      animState.boopPhase = 0.0;
    } else {
      anchorPos.set(ox, targetY, oz);
      targetAnchorPos.set(ox, targetY, oz);
      startAnchorPos.set(ox, targetY, oz);
      facingYaw = 0.0;
      facingPitch = 0.0;
      isPlacing = false;
      placeProgress = 1.0;
      animState.boopImpulse = 0.0;
      animState.boopPhase = 0.0;
    }
  }

  function setEnvironmentScale(scale, offsetX = 0.0, offsetZ = 0.0) {
    const s = Number.isFinite(scale) && scale > 0 ? scale : 1.0;
    const ox = Number.isFinite(offsetX) ? offsetX : 0.0;
    const oz = Number.isFinite(offsetZ) ? offsetZ : 0.0;
    animState.baseScale = s;
    animState.baseX = ox;
    animState.baseY = -0.94 * (1.0 - s);
    animState.baseZ = oz;
    if (!isPlaced) {
      anchorPos.set(ox, -0.94 + 0.94 * s, oz);
      targetAnchorPos.copy(anchorPos);
      startAnchorPos.copy(anchorPos);
      facingYaw = 0.0;
      facingPitch = 0.0;
      targetFacingYaw = 0.0;
      targetFacingPitch = 0.0;
    }
  }

  function triggerBoop() {
    animState.boopImpulse = 1.0;
    animState.boopPhase = 0.0;
  }

  function setEmotion(emotion) {
    if (typeof emotion === 'string' && emotion.trim()) {
      animState.emotion = emotion.trim().toLowerCase();
      if (animState.emotion === 'excited' || animState.emotion === 'surprised') {
        animState.targetFurLengthMultiplier = 1.14;
      } else if (animState.emotion === 'sleepy' || animState.emotion === 'sad') {
        animState.targetFurLengthMultiplier = 0.94;
      } else {
        animState.targetFurLengthMultiplier = 1.0;
      }
    }
  }

  function setBehaviorState(stateName) {
    animState.behaviorState = stateName || 'idle';
  }

  function triggerAction(actionType) {
    if (!actionType || actionType === 'none') return;
    animState.actionType = actionType;
    animState.actionTimer = 0.0;

    switch (actionType) {
      case 'bounce':
        animState.actionDuration = 1.6;
        animState.boopImpulse = 1.6;
        animState.boopPhase = 0.0;
        break;
      case 'stretch':
        animState.actionDuration = 2.2;
        break;
      case 'wiggle':
        animState.actionDuration = 1.8;
        animState.targetFurLengthMultiplier = 1.28;
        break;
      case 'nod':
        animState.actionDuration = 1.4;
        break;
      case 'tilt_head':
        animState.actionDuration = 2.0;
        break;
      case 'puff_fur':
        animState.actionDuration = 2.5;
        animState.targetFurLengthMultiplier = 1.65;
        animState.boopImpulse = 1.2;
        animState.boopPhase = 0.0;
        break;
      case 'yawn':
        animState.actionDuration = 2.6;
        break;
      default:
        animState.actionDuration = 1.4;
        break;
    }
  }

  function setMouthOpenness(openness) {
    animState.targetMouthOpenness = Math.max(0.0, Math.min(1.0, Number(openness) || 0.0));
  }

  function setSpeaking(speaking) {
    animState.isSpeaking = Boolean(speaking);
    if (!animState.isSpeaking) {
      animState.targetMouthOpenness = 0.0;
    }
  }

  function setPettingIntensity(intensity) {
    animState.pettingIntensity = Math.max(0.0, Math.min(1.0, Number(intensity) || 0.0));
  }

  function setEyeColor(hexColor) {
    try {
      irisMaterial.color.set(hexColor);
    } catch {
      // ignore invalid hex
    }
  }

  function setAccessory(accessoryId) {
    currentAccessoryId = accessoryId || 'none';
    Object.keys(accessoriesMap).forEach((id) => {
      accessoriesMap[id].visible = id === currentAccessoryId;
    });
  }

  function setAutonomousGaze(lookX, lookY, active = true) {
    animState.autonomousLook.set(lookX, lookY);
    animState.useAutonomousLook = Boolean(active);
  }

  function setWanderTarget(wx, wz) {
    animState.targetWanderOffset.set(
      Math.max(-0.45, Math.min(0.45, wx)),
      Math.max(-0.28, Math.min(0.28, wz))
    );
  }

  function addDragOffset(dx, dz) {
    animState.userDragOffset.x = Math.max(-0.65, Math.min(0.65, animState.userDragOffset.x + dx));
    animState.userDragOffset.y = Math.max(-0.42, Math.min(0.42, animState.userDragOffset.y + dz));
  }

  function update(dt, pointerNDC, cameraPos = null, isARMode = false) {
    const safeDt = Math.min(Math.max(dt, 0.001), 0.05);
    animState.time += safeDt;

    if (faceViewerHoldTimer > 0) {
      faceViewerHoldTimer = Math.max(0, faceViewerHoldTimer - safeDt);
    }

    // Advance active action timer
    let stretchFactor = 0.0;
    let wiggleYaw = 0.0;
    let nodPitch = 0.0;
    let headTiltRoll = 0.0;
    let yawnMouth = 0.0;
    let actionHop = 0.0;

    if (animState.actionType !== 'none') {
      animState.actionTimer += safeDt;
      const p = Math.min(1.0, animState.actionTimer / Math.max(0.1, animState.actionDuration));
      const env = Math.sin(p * Math.PI);

      if (animState.actionType === 'bounce') {
        const hopCycle = Math.abs(Math.sin(p * Math.PI * 3.0));
        actionHop = hopCycle * 0.65 * env;
        stretchFactor = (hopCycle - 0.25) * 0.35 * env;
        animState.boopImpulse = Math.max(animState.boopImpulse, 1.4 * env);
      } else if (animState.actionType === 'stretch') {
        stretchFactor = Math.sin(p * Math.PI) * 0.50;
        actionHop = stretchFactor * 0.28;
      } else if (animState.actionType === 'wiggle') {
        wiggleYaw = Math.sin(animState.actionTimer * 30.0) * 0.38 * env;
        headTiltRoll = Math.cos(animState.actionTimer * 30.0) * 0.22 * env;
      } else if (animState.actionType === 'nod') {
        nodPitch = Math.sin(animState.actionTimer * 16.0) * 0.28 * env;
      } else if (animState.actionType === 'tilt_head') {
        headTiltRoll = Math.sin(p * Math.PI) * 0.52;
      } else if (animState.actionType === 'puff_fur') {
        stretchFactor = -Math.sin(p * Math.PI) * 0.28;
        animState.targetFurLengthMultiplier = 1.65;
        actionHop = Math.sin(p * Math.PI * 2.0) * 0.12 * env;
      } else if (animState.actionType === 'yawn') {
        stretchFactor = Math.sin(p * Math.PI) * 0.25;
        yawnMouth = Math.pow(Math.sin(p * Math.PI), 1.3) * 0.95;
      }

      if (animState.actionTimer >= animState.actionDuration) {
        animState.actionType = 'none';
        animState.actionTimer = 0.0;
        if (animState.emotion !== 'excited' && animState.emotion !== 'surprised') {
          animState.targetFurLengthMultiplier = 1.0;
        }
      }
    }

    // Smoothly interpolate wander offset
    animState.wanderOffset.lerp(animState.targetWanderOffset, Math.min(1.0, safeDt * 2.2));
    // Gently relax userDragOffset slowly back toward rest only when resetting, or keep it stable

    // Smooth eye/head tracking toward pointer or autonomous gaze
    if (faceViewerHoldTimer > 0) {
      animState.targetLook.set(0, 0);
    } else if (animState.useAutonomousLook) {
      animState.targetLook.copy(animState.autonomousLook);
    } else if (pointerNDC) {
      animState.targetLook.set(pointerNDC.x * 0.35, pointerNDC.y * 0.25);
    }
    animState.currentLook.lerp(animState.targetLook, Math.min(1.0, safeDt * 7.5));

    // Decay petting intensity smoothly
    animState.pettingIntensity *= Math.exp(-safeDt * 2.5);

    // Breathing & happy idle bobbing + boop jump impulse
    if (animState.boopImpulse > 0.001) {
      animState.boopPhase += safeDt * 14.0;
      animState.boopImpulse *= Math.exp(-safeDt * 3.6);
    } else {
      animState.boopImpulse = 0.0;
    }

    // Parabolic placement leap towards target anchor plane
    let hop = 0.0;
    if (isPlacing) {
      placeProgress += safeDt * 3.4;
      if (placeProgress >= 1.0) {
        placeProgress = 1.0;
        isPlacing = false;
        anchorPos.copy(targetAnchorPos);
        triggerBoop();
      } else {
        const p = placeProgress;
        anchorPos.lerpVectors(startAnchorPos, targetAnchorPos, p);
        hop = Math.sin(p * Math.PI) * placeHopHeight;
      }
    }

    // When placed in AR mode, keep Mochi's front face oriented directly towards the viewer
    if ((isPlaced || isARMode) && cameraPos) {
      const dx = cameraPos.x - anchorPos.x;
      const dy = cameraPos.y - anchorPos.y;
      const dz = cameraPos.z - anchorPos.z;
      const horizDist = Math.max(0.001, Math.hypot(dx, dz));
      targetFacingYaw = Math.atan2(dx, dz);
      targetFacingPitch = -Math.atan2(dy, horizDist) * 0.72;
    } else if (!isPlaced) {
      targetFacingYaw = 0.0;
      targetFacingPitch = 0.0;
    }

    const yawDiff = Math.atan2(Math.sin(targetFacingYaw - facingYaw), Math.cos(targetFacingYaw - facingYaw));
    facingYaw += yawDiff * Math.min(1.0, safeDt * 12.0);
    facingPitch += (targetFacingPitch - facingPitch) * Math.min(1.0, safeDt * 12.0);

    // Adjust breathing speed & amplitude by emotional/behavior state
    const isSleeping = animState.behaviorState === 'sleeping' || animState.emotion === 'sleepy';
    const isExcited = animState.emotion === 'excited' || animState.behaviorState === 'playing';
    const breathFreq = isSleeping ? 1.35 : isExcited ? 3.4 : 2.3;
    const breathAmp = isSleeping ? 0.048 : isExcited ? 0.052 : 0.035;

    const s = animState.baseScale;
    const breath = Math.sin(animState.time * breathFreq) * breathAmp;
    const bodyLookScale = (isPlaced || isARMode) ? (faceViewerHoldTimer > 0 ? 0.0 : 0.06) : 1.0;

    // Speaking subtle rhythmic bounce
    const speechBob = animState.isSpeaking
      ? Math.abs(Math.sin(animState.time * 11.0)) * animState.mouthOpenness * 0.045
      : 0.0;

    const swayX = (
      Math.sin(animState.time * (isSleeping ? 0.7 : 1.35)) * (isSleeping ? 0.025 : 0.06) +
      animState.currentLook.x * 0.15 * bodyLookScale +
      animState.wanderOffset.x +
      animState.userDragOffset.x
    ) * s;

    const swayZ = (animState.wanderOffset.y + animState.userDragOffset.y) * s;

    const jumpY =
      (Math.sin(animState.time * breathFreq) * (isSleeping ? 0.02 : 0.045) +
        Math.abs(Math.sin(animState.boopPhase)) * animState.boopImpulse * 0.32 +
        stretchFactor * 0.36 +
        speechBob) *
        s;

    const squash =
      1.0 +
      breath +
      stretchFactor +
      speechBob * 0.8 -
      animState.pettingIntensity * 0.08 +
      Math.cos(animState.boopPhase * 2.0) * animState.boopImpulse * 0.14;

    const prevX = root.position.x;
    const prevY = root.position.y;
    const prevZ = root.position.z;
    const prevRotZ = root.rotation.z;
    const prevRotY = root.rotation.y;

    const trickVertical = actionHop * Math.max(0.75, s * 2.4);
    root.position.set(
      anchorPos.x + swayX,
      anchorPos.y + jumpY + hop + trickVertical,
      anchorPos.z + swayZ
    );
    root.scale.set((1.0 / Math.sqrt(squash)) * s, squash * s, (1.0 / Math.sqrt(squash)) * s);

    // Emotion-specific head/body tilt
    const curiousRoll = (animState.emotion === 'curious' || animState.behaviorState === 'listening')
      ? 0.14 * Math.sin(animState.time * 1.8)
      : 0.0;

    root.rotation.y =
      facingYaw +
      animState.currentLook.x * 0.38 * bodyLookScale +
      wiggleYaw +
      Math.sin(animState.time * 0.9) * (isPlaced ? 0.03 : 0.08);

    root.rotation.x =
      facingPitch -
      animState.currentLook.y * 0.22 * bodyLookScale +
      nodPitch +
      (isSleeping ? 0.08 : 0.0) +
      Math.cos(animState.time * 1.8) * (isPlaced ? 0.02 : 0.04);

    root.rotation.z =
      -(swayX / s) * 0.25 +
      headTiltRoll +
      curiousRoll +
      Math.sin(animState.boopPhase) * animState.boopImpulse * 0.18;

    // Compute instantaneous creature velocity & angular velocity for GPGPU fur inertia
    animState.velocity.set(
      (root.position.x - prevX) / (safeDt * s),
      (root.position.y - prevY) / (safeDt * s),
      (root.position.z - prevZ) / (safeDt * s)
    );
    animState.angularVelocity.set(
      0,
      (root.rotation.y - prevRotY) / safeDt,
      (root.rotation.z - prevRotZ) / safeDt
    );

    // Update dynamic fur length multiplier (puffs up with excitement, voice, or puff_fur action)
    const voiceFurPulse = animState.isSpeaking ? animState.mouthOpenness * 0.07 : 0.0;
    const desiredFurMult = animState.targetFurLengthMultiplier + voiceFurPulse + animState.pettingIntensity * 0.05;
    animState.furLengthMultiplier += (desiredFurMult - animState.furLengthMultiplier) * Math.min(1.0, safeDt * 6.0);

    // Update Mouth Lip-Sync & Yawn / Expression Openness
    const effectiveTargetMouth = Math.max(
      animState.targetMouthOpenness,
      yawnMouth,
      animState.emotion === 'surprised' ? 0.48 : 0.0,
      animState.emotion === 'excited' && animState.boopImpulse > 0.2 ? 0.55 : 0.0
    );
    animState.mouthOpenness += (effectiveTargetMouth - animState.mouthOpenness) * Math.min(1.0, safeDt * 18.0);

    if (animState.mouthOpenness > 0.025) {
      openMouthGroup.visible = true;
      const mOpen = animState.mouthOpenness;
      openMouthGroup.scale.set(
        0.58 + mOpen * 0.52,
        0.18 + mOpen * 1.15,
        0.8
      );
      tongueMesh.position.y = -0.018 + Math.sin(animState.time * 16.0) * 0.004 * mOpen;
    } else {
      openMouthGroup.visible = false;
      openMouthGroup.scale.set(0.001, 0.001, 0.001);
    }

    // Animate upper W-lip arcs & nose with mouth movement and emotion
    const smileLift = (animState.emotion === 'happy' || animState.emotion === 'loving' || animState.emotion === 'excited')
      ? 0.006
      : animState.emotion === 'sad'
      ? -0.006
      : 0.0;

    nose.position.y = 0.075 + animState.mouthOpenness * 0.01 + smileLift;
    for (const arcObj of mouthArcs) {
      arcObj.mesh.position.y = 0.035 + animState.mouthOpenness * 0.012 + smileLift;
      arcObj.mesh.rotation.z = arcObj.side * (
        animState.emotion === 'sad' ? -0.18 : (0.06 * animState.mouthOpenness)
      );
    }

    // Cheek blush intensity reacts to happiness, loving emotion, and petting
    const targetBlushOpacity =
      animState.emotion === 'loving' || animState.pettingIntensity > 0.25
        ? 0.85
        : animState.emotion === 'happy' || animState.emotion === 'excited'
        ? 0.68
        : animState.emotion === 'sad' || isSleeping
        ? 0.36
        : 0.55;
    blushMat.opacity += (targetBlushOpacity - blushMat.opacity) * Math.min(1.0, safeDt * 6.0);

    // Blinking and emotion-based eye expressions
    animState.blinkTimer += safeDt;
    let blinkScaleY = 1.0;
    let eyeScaleX = 1.0;

    if (isSleeping) {
      blinkScaleY = 0.14 + Math.sin(animState.time * 1.4) * 0.03;
    } else {
      if (animState.blinkTimer > animState.nextBlink) {
        const blinkProgress = (animState.blinkTimer - animState.nextBlink) / 0.16;
        if (blinkProgress < 1.0) {
          blinkScaleY = Math.max(0.08, Math.abs(Math.cos(blinkProgress * Math.PI)));
        } else {
          animState.blinkTimer = 0;
          animState.nextBlink = 2.4 + Math.random() * 2.5;
        }
      }

      if (animState.emotion === 'surprised' || animState.emotion === 'excited') {
        blinkScaleY = Math.min(1.18, blinkScaleY * 1.15);
        eyeScaleX = 1.1;
      } else if (animState.emotion === 'loving' || animState.pettingIntensity > 0.35) {
        blinkScaleY = Math.min(blinkScaleY, 0.42);
        eyeScaleX = 1.06;
      } else if (animState.emotion === 'sleepy') {
        blinkScaleY = Math.min(blinkScaleY, 0.48);
      }
    }

    if (animState.boopImpulse > 0.25 || yawnMouth > 0.35) {
      blinkScaleY = Math.min(blinkScaleY, 0.18);
    }

    for (const eye of eyes) {
      eye.pivot.scale.y += (blinkScaleY - eye.pivot.scale.y) * Math.min(1.0, safeDt * 18.0);
      eye.pivot.scale.x += (eyeScaleX - eye.pivot.scale.x) * Math.min(1.0, safeDt * 12.0);
      eye.pivot.rotation.z =
        eye.side * (animState.emotion === 'sad' ? -0.15 : animState.emotion === 'happy' ? 0.05 : 0.0);
      eye.catchlightMain.position.x = -eye.side * 0.042 + animState.currentLook.x * 0.028;
      eye.catchlightMain.position.y = 0.052 + animState.currentLook.y * 0.025;
    }

    // Gently float the halo or animate sprout if active
    if (currentAccessoryId === 'halo' && accessoriesMap.halo) {
      accessoriesMap.halo.position.y = 1.50 + Math.sin(animState.time * 3.0) * 0.05;
      accessoriesMap.halo.rotation.z = animState.time * 0.6;
    } else if (currentAccessoryId === 'sprout' && accessoriesMap.sprout) {
      accessoriesMap.sprout.rotation.z = Math.sin(animState.time * 4.0) * 0.08;
    }
  }

  return {
    root,
    bodyMesh,
    bodyGeometry,
    skinMaterial,
    animState,
    setEnvironmentScale,
    triggerBoop,
    setEmotion,
    setBehaviorState,
    triggerAction,
    setMouthOpenness,
    setSpeaking,
    setPettingIntensity,
    setEyeColor,
    setAccessory,
    setAutonomousGaze,
    setWanderTarget,
    addDragOffset,
    getFurLengthMultiplier: () => animState.furLengthMultiplier,
    placeAt,
    resetPlacement,
    isPlaced: () => isPlaced,
    getAnchorPosition: () => anchorPos,
    update
  };
}
