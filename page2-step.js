(() => {
  'use strict';
  const frame = document.getElementById('step-measurer-frame');
  const status = document.getElementById('step-measurer-status');
  if (!frame || !status) return;
  let selectedFile = null;
  let loadSequence = 0;
  function measurer() {
    return frame.contentWindow?.stepMeasure;
  }
  async function display(file) {
    selectedFile = file;
    const sequence = ++loadSequence;
    const app = measurer();
    if (!app) {
      status.textContent = '측정기를 준비하고 있습니다. 준비되면 선택한 파일을 표시합니다.';
      return;
    }
    status.textContent = file.name + ' · STEP 측정기에서 불러오는 중…';
    try {
      const loaded = await app.loadFile(file);
      if (sequence !== loadSequence) return;
      status.textContent = loaded && app.model?.name === file.name
        ? file.name + ' · 부품을 선택하고 치수 또는 최소 이격을 측정하세요.'
        : '파일을 불러오지 못했습니다. 측정기 내부의 오류 메시지를 확인하세요.';
    } catch (error) {
      if (sequence === loadSequence) status.textContent = '파일을 불러오지 못했습니다: ' + error.message;
    }
  }
  // Preserve the existing index / file-library selection flow on this page.
  document.addEventListener('catia-preview-file', event => {
    if (event.detail instanceof File) display(event.detail);
  });
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type !== 'step-measurer-model-loaded' || typeof event.data.name !== 'string') return;
    status.textContent = event.data.name + ' · 부품을 선택하고 치수 또는 최소 이격을 측정하세요.';
  });
  frame.addEventListener('load', () => {
    if (!measurer()) {
      status.textContent = 'STEP 측정기를 준비하지 못했습니다. 인터넷 연결을 확인하고 새로고침하세요.';
      return;
    }
    if (selectedFile) display(selectedFile);
  });
  for (const [id,view] of Object.entries({viewIsoBtn:'iso',viewTopBtn:'top',viewFrontBtn:'front',viewRightBtn:'right'})) {
    document.getElementById(id)?.addEventListener('click', () => {
      if (!measurer()?.model) { status.textContent = '먼저 STEP 파일을 불러오세요.'; return; }
      measurer().setView(view);
    });
  }
  document.getElementById('step-measurer-fullscreen')?.addEventListener('click', async () => {
    try { await frame.requestFullscreen(); }
    catch { status.textContent = '전체 화면을 열지 못했습니다. 브라우저의 전체 화면 허용 여부를 확인하세요.'; }
  });
})();
