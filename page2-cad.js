(() => {
  'use strict';
  const selector = document.getElementById('page2-cad-files');
  const status = document.getElementById('page2-library-status');
  let db;
  const activeId = '__active_step_preview__';
  function read(store, id) {
    return new Promise((resolve, reject) => {
      const request = db.transaction(store, 'readonly').objectStore(store).get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function display(id) {
    if (!id) return;
    const item = await read('files', id);
    if (!item) throw new Error('원본 파일을 찾지 못했습니다. index에서 파일을 다시 선택해 주세요.');
    const file = new File([item.blob], item.name, {type:item.type, lastModified:item.lastModified});
    file._libraryStored = true;
    file._libraryId = item.sourceId || (item.id === '__active_step_preview__' ? null : item.id);
    file._viewerRestored = true;
    document.dispatchEvent(new CustomEvent('catia-preview-file', {detail:file}));
  }
  async function refresh() {
    const metadata = await new Promise((resolve, reject) => {
      const request = db.transaction('metadata', 'readonly').objectStore('metadata').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const items = metadata.filter(item => /\.(step|stp)$/i.test(item.name)).sort((a,b) => b.savedAt-a.savedAt);
    const active = await read('files', activeId);
    selector.replaceChildren(new Option('표시할 STEP/STP 파일 선택', ''));
    if (active) selector.add(new Option('index에서 선택한 파일 · ' + active.name, activeId));
    for (const item of items) selector.add(new Option(item.name + ' · ' + new Date(item.savedAt).toLocaleString('ko-KR'), item.id));
    const initial = active ? activeId : items[0]?.id;
    status.textContent = initial ? 'index의 선택 파일과 저장된 STEP/STP 파일을 여기에서 볼 수 있습니다.' : 'index에서 STEP/STP 파일의 3D 보기를 누르거나 보관함에 저장해 주세요.';
    if (initial) { selector.value = initial; await display(initial); }
  }
  if (window.BroadcastChannel) {
    const channel = new BroadcastChannel('aeropipe-library');
    channel.onmessage = event => {
      if (event.data.type === 'deleted' && db) refresh().catch(error => { status.textContent = error.message; });
    };
  }
  selector.addEventListener('change', () => display(selector.value).catch(error => { status.textContent = error.message; }));
  document.getElementById('page2-cad-refresh').addEventListener('click', () => { if (db) refresh().catch(error => { status.textContent = error.message; }); });
  try {
    const request = indexedDB.open('AeroPipeFileLibrary', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('files', {keyPath:'id'});
      request.result.createObjectStore('metadata', {keyPath:'id'});
    };
    request.onerror = () => { status.textContent = '보관함을 열지 못했습니다. index와 같은 브라우저·주소에서 열어 주세요.'; };
    request.onsuccess = () => {
      db = request.result;
      db.onversionchange = () => db.close();
      refresh().catch(error => { status.textContent = error.message; });
    };
  } catch (error) { status.textContent = '보관함을 사용할 수 없습니다: ' + error.message; }
})();
