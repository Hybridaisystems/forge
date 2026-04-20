// ── 3D PREVIEW ────────────────────────────────────────────────────────────────
import { state } from './state.js';

export function render(project) {
  const el = document.getElementById('tab-preview');
  if(!el) return;

  el.innerHTML = `
    <div style="max-width:900px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="section-title" style="margin:0">3D Preview</div>
        <div style="font-size:12px;color:var(--muted)">Drag to rotate · Scroll to zoom · Right-click to pan</div>
      </div>
      <div id="three-container" style="height:480px;border-radius:var(--r-lg);overflow:hidden;border:1px solid var(--border)"></div>
      <div class="ai-question" style="margin-top:12px">
        <div class="ai-icon">ℹ️</div>
        <div class="ai-text">This is an approximated 3D representation based on your design brief. For precise 3D models, export your engineering drawings to a CAD application like Fusion 360 or FreeCAD.</div>
      </div>
    </div>
  `;

  // Load Three.js and render
  loadThreeJS().then(() => initThreeScene(project));
}

function loadThreeJS() {
  return new Promise((resolve) => {
    if(window.THREE) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

function initThreeScene(project) {
  const container = document.getElementById('three-container');
  if(!container || !window.THREE) return;
  const THREE = window.THREE;

  // Scene
  const scene    = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a26);

  // Camera
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(3, 2, 4);
  camera.lookAt(0, 0, 0);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 10, 7);
  dirLight.castShadow = true;
  scene.add(dirLight);
  const blueLight = new THREE.PointLight(0x2563eb, 0.6, 20);
  blueLight.position.set(-4, 3, -4);
  scene.add(blueLight);

  // Grid
  const grid = new THREE.GridHelper(10, 20, 0x333355, 0x222244);
  scene.add(grid);

  // Build product approximation from brief
  const brief = project.brief || {};
  const type  = brief.product_type || 'mechanical';

  const material = new THREE.MeshPhongMaterial({
    color: 0x2563eb,
    specular: 0x4080ff,
    shininess: 60,
    transparent: true,
    opacity: 0.9
  });
  const darkMat = new THREE.MeshPhongMaterial({ color: 0x1a1a2e, shininess: 30 });
  const accentMat = new THREE.MeshPhongMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 0.3 });

  // Main body — approximate from product type
  let mainBody;
  if(type === 'electronic' || type === 'electromechanical') {
    // Box with rounded feel — PCB-style product
    mainBody = new THREE.BoxGeometry(2, 0.4, 1.4);
    const mesh = new THREE.Mesh(mainBody, material);
    mesh.castShadow = true;
    scene.add(mesh);

    // Add some detail geometry
    const screen = new THREE.BoxGeometry(1.2, 0.05, 0.8);
    const screenMesh = new THREE.Mesh(screen, new THREE.MeshPhongMaterial({ color: 0x0a0a1a, emissive: 0x1133aa, emissiveIntensity: 0.3 }));
    screenMesh.position.set(0, 0.23, 0);
    scene.add(screenMesh);

    const btnGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.06, 12);
    for(let i = 0; i < 3; i++) {
      const btn = new THREE.Mesh(btnGeo, accentMat);
      btn.position.set(-0.7 + i*0.3, 0.23, -0.55);
      scene.add(btn);
    }
  } else {
    // Mechanical product — more complex shape
    mainBody = new THREE.BoxGeometry(1.8, 1.2, 1);
    const mesh = new THREE.Mesh(mainBody, material);
    mesh.castShadow = true;
    scene.add(mesh);

    // Add cylindrical feature
    const cylGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.4, 20);
    const cyl = new THREE.Mesh(cylGeo, darkMat);
    cyl.position.set(0.6, 0, 0);
    cyl.rotation.z = Math.PI/2;
    scene.add(cyl);

    // Accent strip
    const strip = new THREE.BoxGeometry(1.8, 0.08, 1.02);
    const stripMesh = new THREE.Mesh(strip, accentMat);
    stripMesh.position.set(0, 0.4, 0);
    scene.add(stripMesh);
  }

  // Shadow plane
  const planeGeo = new THREE.PlaneGeometry(20, 20);
  const planeMat = new THREE.ShadowMaterial({ opacity: 0.2 });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI/2;
  plane.position.y = -0.7;
  plane.receiveShadow = true;
  scene.add(plane);

  // Mouse controls (simple orbit)
  let mouseDown = false, lastX = 0, lastY = 0;
  let rotX = 0.3, rotY = 0.5;
  let radius = 5;

  renderer.domElement.addEventListener('mousedown', e => { mouseDown = true; lastX = e.clientX; lastY = e.clientY; });
  renderer.domElement.addEventListener('mousemove', e => {
    if(!mouseDown) return;
    rotY += (e.clientX - lastX) * 0.01;
    rotX += (e.clientY - lastY) * 0.01;
    rotX = Math.max(-1.2, Math.min(1.2, rotX));
    lastX = e.clientX; lastY = e.clientY;
    camera.position.x = radius * Math.sin(rotY) * Math.cos(rotX);
    camera.position.y = radius * Math.sin(rotX) + 0.5;
    camera.position.z = radius * Math.cos(rotY) * Math.cos(rotX);
    camera.lookAt(0, 0, 0);
  });
  renderer.domElement.addEventListener('mouseup', () => mouseDown = false);
  renderer.domElement.addEventListener('wheel', e => {
    radius = Math.max(2, Math.min(12, radius + e.deltaY * 0.01));
    camera.position.setLength(radius);
    camera.lookAt(0, 0, 0);
  });

  // Animate
  let animId;
  const animate = () => {
    animId = requestAnimationFrame(animate);
    if(!mouseDown) {
      rotY += 0.003;
      camera.position.x = radius * Math.sin(rotY) * Math.cos(rotX);
      camera.position.z = radius * Math.cos(rotY) * Math.cos(rotX);
      camera.lookAt(0, 0, 0);
    }
    renderer.render(scene, camera);
  };
  animate();

  // Cleanup on tab switch
  const observer = new MutationObserver(() => {
    if(!document.contains(renderer.domElement)) {
      cancelAnimationFrame(animId);
      renderer.dispose();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Resize
  window.addEventListener('resize', () => {
    if(!container.clientWidth) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
}

export const preview3d = { render };
window.forge = window.forge || {};
window.forge.preview3d = preview3d;
