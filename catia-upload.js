(() => {
  'use strict';
  const zone = document.getElementById('drop-zone');
  const input = document.getElementById('catia-file-input');
  const list = document.getElementById('catia-upload-list');
  const status = document.getElementById('catia-upload-status');
  if (!zone || !input || !list || !status) return;
  const allowed = new Set(['catpart', 'catproduct', 'catdrawing', 'stp', 'step', 'stl', 'obj', 'ply', 'pts', 'xyz', 'las', 'laz', 'e57']);
  const files = [];
  const key = file => `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
  const size = bytes => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  function render() {
    list.replaceChildren();
    for (const file of files) {
      const row = document.createElement('li');
      row.className = 'flex items-center justify-between gap-space-md bg-surface-container-high p-space-md rounded';
      const info = document.createElement('div');
      info.className = 'min-w-0';
      const name = document.createElement('div');
      name.className = 'font-label-md text-label-md text-on-surface break-all';
      name.textContent = file.name;
      const details = document.createElement('div');
      details.className = 'font-label-sm text-label-sm text-on-surface-variant';
      details.textContent = `${size(file.size)} · 선택 완료`;
      info.append(name, details);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'px-space-sm py-1 rounded text-error hover:bg-error-container/30 shrink-0';
      remove.textContent = '제거';
      remove.setAttribute('aria-label', `${file.name} 선택 제거`);
      remove.addEventListener('click', () => {
        files.splice(files.indexOf(file), 1);
        render();
        status.textContent = files.length ? `${files.length}개 파일 선택 완료` : '선택한 파일이 없습니다.';
      });
      const actions = document.createElement('div');
      actions.className = 'flex items-center gap-space-sm shrink-0';
      if (/\.(step|stp)$/i.test(file.name)) {
        const view = document.createElement('button');
        view.type = 'button';
        view.className = 'bg-primary text-on-primary px-space-md py-1 rounded font-label-sm text-label-sm';
        view.textContent = '3D 보기';
        view.addEventListener('click', () => {
          document.dispatchEvent(new CustomEvent('catia-preview-file', { detail: file }));
          document.getElementById('catia-3d-canvas').scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        actions.append(view);
      }
      actions.append(remove);
      row.append(info, actions);
      list.append(row);
    }
    // A later storage integration can consume the original File objects.
    window.catiaUploadFiles = files.slice();
    zone.dispatchEvent(new CustomEvent('catia-files-changed', { detail: files.slice(), bubbles: true }));
  }
  function addFiles(incoming) {
    const errors = [];
    let duplicates = 0;
    for (const file of incoming) {
      const extension = file.name.split('.').pop().toLowerCase();
      if (!allowed.has(extension)) {
        errors.push(`${file.name}: 지원하지 않는 형식`);
        continue;
      }
      if (!file.size) {
        errors.push(`${file.name}: 비어 있는 파일`);
        continue;
      }
      if (files.some(item => key(item) === key(file))) {
        duplicates++;
        continue;
      }
      files.push(file);
    }
    render();
    status.textContent = [`${files.length}개 파일 선택 완료`, duplicates ? `중복 ${duplicates}개 제외` : '', ...errors].filter(Boolean).join(' · ');
  }
  input.addEventListener('change', () => {
    addFiles(Array.from(input.files || []));
    input.value = '';
  });
  zone.addEventListener('click', event => {
    if (!event.target.closest('button, label, input')) input.click();
  });
  zone.addEventListener('keydown', event => {
    if (event.target === zone && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      input.click();
    }
  });
  let depth = 0;
  const highlight = active => {
    zone.style.outline = active ? '2px solid #89ceff' : '';
    zone.style.outlineOffset = active ? '4px' : '';
  };
  zone.addEventListener('dragenter', event => { event.preventDefault(); depth++; highlight(true); });
  zone.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
  zone.addEventListener('dragleave', event => { event.preventDefault(); if (--depth <= 0) { depth = 0; highlight(false); } });
  zone.addEventListener('drop', event => {
    event.preventDefault();
    depth = 0;
    highlight(false);
    addFiles(Array.from(event.dataTransfer.files || []));
  });
  // Prevent dropped files outside the picker from replacing the current page.
  window.addEventListener('dragover', event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); });
  window.addEventListener('drop', event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); });
  render();
})();
