(() => {
  'use strict';
  const host = document.getElementById('catia-3d-canvas');
  const message = document.getElementById('catia-3d-status');
  const title = document.getElementById('catia-3d-name');
  if (!host || !message || !title) return;
  const base = 'https://cdn.jsdelivr.net/npm/';
  let renderer, scene, camera, controls, model, worker, currentFile;
  let version = 0;
  let initializing;
  const loaded = new Map();
  function script(url) {
    if (!loaded.has(url)) loaded.set(url, new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = url;
      tag.onload = resolve;
      tag.onerror = () => { loaded.delete(url); tag.remove(); reject(new Error('3D 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인하세요.')); };
      document.head.append(tag);
    }));
    return loaded.get(url);
  }
function stepColorPalette(part) {
  const valid = color => Array.isArray(color) && color.length === 3 && color.every(n => Number.isFinite(n) && n >= 0 && n <= 1);
  const colors = [valid(part.color) ? part.color : [0.7, 0.7, 0.7]];
  const palette = new Map([[colors[0].join(','), 0]]);
  const triangleCount = part.index.array.length / 3;
  const assignments = new Uint32Array(triangleCount);
  let hasOriginalColor = valid(part.color);
  for (const face of part.brep_faces || []) {
    if (!valid(face.color) || !Number.isInteger(face.first) || !Number.isInteger(face.last)) continue;
    const first = Math.max(0, face.first), last = Math.min(triangleCount - 1, face.last);
    if (first > last) continue;
    hasOriginalColor = true;
    const key = face.color.join(',');
    if (!palette.has(key)) { palette.set(key, colors.length); colors.push(face.color); }
    assignments.fill(palette.get(key), first, last + 1);
  }
  const groups = [];
  for (let first = 0; first < triangleCount;) {
    const material = assignments[first];
    let last = first + 1;
    while (last < triangleCount && assignments[last] === material) last++;
    groups.push({start:first * 3, count:(last - first) * 3, materialIndex:material});
    first = last;
  }
  return {colors, groups, hasOriginalColor};
}

  async function initialize() {
    if (renderer) return;
    if (initializing) return initializing;
    initializing = (async () => {
      await script(base + 'three@0.128.0/build/three.min.js');
      await script(base + 'three@0.128.0/examples/js/controls/OrbitControls.js');
      const nextRenderer = new THREE.WebGLRenderer({ antialias: true });
      renderer = nextRenderer;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x101b2d);
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.setAttribute('aria-label', 'STEP 모델 3D 미리보기');
      host.append(renderer.domElement);
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000000);
      camera.up.set(0, 0, 1);
      camera.position.set(10, -10, 10);
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 0.85));
      const light = new THREE.DirectionalLight(0xffffff, 0.6);
      light.position.set(1, -2, 3);
      scene.add(light);
      const resize = () => {
        const width = Math.max(host.clientWidth, 1), height = Math.max(host.clientHeight, 1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      new ResizeObserver(resize).observe(host);
      resize();
      renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
    })();
    try { await initializing; } finally { initializing = null; }
  }
  function clear() {
    if (!model) return;
    scene.remove(model);
    model.traverse(item => {
      if (item.geometry) item.geometry.dispose();
      if (item.material) (Array.isArray(item.material) ? item.material : [item.material]).forEach(m => m.dispose());
    });
    model = null;
  }
  function fit() {
    if (!model) return;
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, 0.001);
    const angle = Math.min(camera.fov * Math.PI / 360, Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect));
    const distance = radius / Math.sin(angle) * 1.15;
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(1, -1, 0.8).normalize().multiplyScalar(distance));
    camera.near = Math.max(radius / 10000, 0.000001);
    camera.far = distance + radius * 100;
    controls.maxDistance = distance * 30;
    camera.updateProjectionMatrix();
    controls.update();
  }
  function remember(file) {
    if (file._viewerRestored) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AeroPipeFileLibrary', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('files', {keyPath:'id'});
        request.result.createObjectStore('metadata', {keyPath:'id'});
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const tx = database.transaction('files', 'readwrite');
        tx.objectStore('files').put({id:'__active_step_preview__', sourceId:file._libraryId || null, name:file.name, type:file.type, lastModified:file.lastModified, blob:file});
        tx.oncomplete = () => { database.close(); resolve(); };
        tx.onerror = tx.onabort = () => { database.close(); reject(tx.error); };
      };
    });
  }
  async function show(file) {
    const request = ++version;
    currentFile = file;
    if (worker) { worker.terminate(); worker = null; }
    clear();
    title.textContent = file.name;
    message.textContent = 'STEP 형상을 읽고 있습니다… 큰 조립품은 시간이 걸릴 수 있습니다.';
    try {
      await remember(file).catch(() => {});
      await initialize();
      if (request !== version) return;
      const bytes = await file.arrayBuffer();
      if (request !== version) return;
      const workerSource = `
        self.onmessage = async event => {
          try {
            importScripts('${base}occt-import-js@0.0.23/dist/occt-import-js.js');
            const occt = await occtimportjs({locateFile: name => '${base}occt-import-js@0.0.23/dist/' + name});
            const result = occt.ReadStepFile(new Uint8Array(event.data), {linearUnit: 'millimeter', linearDeflectionType: 'bounding_box_ratio', linearDeflection: 0.002, angularDeflection: 0.5});
            if (!result.success || !result.meshes.length) throw new Error('STEP 파일에서 표시 가능한 3D 형상을 찾지 못했습니다.');
            self.postMessage({meshes: result.meshes});
          } catch (error) { self.postMessage({error: error.message || String(error)}); }
        };`;
      const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
      try { worker = new Worker(url); } finally { URL.revokeObjectURL(url); }
      const activeWorker = worker;
      activeWorker.onerror = () => {
        if (request === version) message.textContent = '3D 변환을 시작하지 못했습니다. 인터넷 연결과 브라우저의 WebAssembly 지원을 확인하세요.';
        activeWorker.terminate();
        if (worker === activeWorker) worker = null;
      };
      activeWorker.onmessage = event => {
        activeWorker.terminate();
        if (worker === activeWorker) worker = null;
        if (request !== version) return;
        try {
          if (event.data.error) throw new Error(event.data.error);
          model = new THREE.Group();
          let triangles = 0, coloredParts = 0;
          for (const part of event.data.meshes) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.attributes.position.array, 3));
            geometry.setIndex(part.index.array);
            if (part.attributes.normal) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(part.attributes.normal.array, 3));
            else geometry.computeVertexNormals();
            const palette = stepColorPalette(part);
            if (palette.hasOriginalColor) coloredParts++;
            geometry.clearGroups();
            for (const group of palette.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
            const materials = palette.colors.map(rgb => new THREE.MeshPhongMaterial({
              color: new THREE.Color(...rgb).convertSRGBToLinear(),
              side: THREE.DoubleSide,
              shininess: 20,
              specular: 0x161616,
              wireframe: document.getElementById('catia-3d-wireframe').checked
            }));
            const mesh = new THREE.Mesh(geometry, materials);
            mesh.name = part.name || '';
            model.add(mesh);
            triangles += part.index.array.length / 3;
          }
          scene.add(model);
          fit();
          message.textContent = `표시 완료 · ${model.children.length.toLocaleString()}개 형상 · ${triangles.toLocaleString()}개 삼각형 · ${coloredParts ? "원본 색상 적용 " + coloredParts.toLocaleString() + "개 형상" : "STEP에 색상 정보가 없어 기본 회색으로 표시"}`;
        } catch (error) { clear(); message.textContent = '3D 표시 실패: ' + error.message; }
      };
      activeWorker.postMessage(bytes, [bytes]);
    } catch (error) { if (request === version) message.textContent = '3D 표시 실패: ' + error.message; }
  }
  document.addEventListener('catia-preview-file', event => show(event.detail));
  document.addEventListener('catia-files-changed', event => {
    if (currentFile && !currentFile._libraryStored && !event.detail.includes(currentFile)) {
      version++;
      if (worker) { worker.terminate(); worker = null; }
      clear();
      currentFile = null;
      title.textContent = 'STEP / STP 3D 미리보기';
      message.textContent = '선택한 STEP/STP 파일의 3D 보기를 눌러 주세요.';
    }
  });
  function onSavedFileDeleted(item) {
    if (!currentFile) return;
    const matches = currentFile._libraryId === item.id || (!currentFile._libraryId && currentFile.name === item.name && currentFile.size === item.size && currentFile.lastModified === item.lastModified);
    if (!matches) return;
    version++;
    if (worker) { worker.terminate(); worker = null; }
    clear();
    currentFile = null;
    title.textContent = 'STEP / STP 3D 미리보기';
    message.textContent = '보관함에서 삭제한 파일입니다. 다른 파일을 선택해 주세요.';
  }
  document.addEventListener('catia-library-file-deleted', event => onSavedFileDeleted(event.detail));
  if (window.BroadcastChannel) {
    const channel = new BroadcastChannel('aeropipe-library');
    channel.onmessage = event => { if (event.data.type === 'deleted') onSavedFileDeleted(event.data.item); };
  }
  function preset(direction) {
    if (!model) return;
    const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
    const distance = camera.position.distanceTo(controls.target);
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(...direction).normalize().multiplyScalar(distance));
    controls.update();
  }
  for (const [id, direction] of Object.entries({viewIsoBtn:[1,-1,0.8],viewTopBtn:[0,-0.0001,1],viewFrontBtn:[0,-1,0],viewRightBtn:[1,0,0]})) {
    document.getElementById(id)?.addEventListener('click', () => {
      preset(direction);
      for (const buttonId of ['viewIsoBtn','viewTopBtn','viewFrontBtn','viewRightBtn']) {
        const button = document.getElementById(buttonId);
        if (button) { button.classList.toggle('bg-primary-container',buttonId===id); button.classList.toggle('text-on-primary-container',buttonId===id); }
      }
    });
  }
  document.getElementById('catia-3d-fit').addEventListener('click', fit);
  document.getElementById('catia-3d-wireframe').addEventListener('change', event => {
    if (model) model.traverse(item => { if (item.material) (Array.isArray(item.material) ? item.material : [item.material]).forEach(material => { material.wireframe = event.target.checked; }); });
  });
})();
