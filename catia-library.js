(() => {
  'use strict';
  const save = document.getElementById('catia-save-files');
  const rows = document.getElementById('catia-library-rows');
  const status = document.getElementById('catia-library-status');
  const search = document.getElementById('catia-library-search');
  const count = document.getElementById('catia-library-count');
  if (!save || !rows || !status || !search || !count) return;
  let db, items = [], saving = false;
  const size = n => `${(n / 1024 / 1024).toFixed(2)} MB`;
  const extension = name => name.split('.').pop().toLowerCase();
  const failure = error => error.name === 'QuotaExceededError' ? '저장 공간이 부족합니다. 원본은 저장되지 않았습니다.' : `저장 처리 실패: ${error.message || error.name}`;
  function transaction(mode, operation) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['files', 'metadata'], mode);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('저장 작업이 중단되었습니다.'));
      try { result = operation(tx.objectStore('files'), tx.objectStore('metadata')); }
      catch (error) { tx.abort(); reject(error); }
    });
  }
  async function refresh() {
    let request;
    await transaction('readonly', (_, metadata) => { request = metadata.getAll(); });
    items = request.result.sort((a, b) => b.savedAt - a.savedAt);
    render();
  }
  async function getFile(id) {
    let request;
    await transaction('readonly', files => { request = files.get(id); });
    if (!request.result) throw new Error('저장된 원본을 찾을 수 없습니다.');
    const item = request.result;
    const file = new File([item.blob], item.name, { type: item.type, lastModified: item.lastModified });
    file._libraryStored = true;
    file._libraryId = item.id;
    return file;
  }
  function cell(text) {
    const td = document.createElement('td');
    td.className = 'py-3 px-space-md';
    td.textContent = text;
    return td;
  }
  function button(label, action) {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.className = 'px-space-md py-1.5 rounded bg-surface-container-high hover:bg-primary hover:text-on-primary font-label-sm text-label-sm';
    element.addEventListener('click', async () => {
      element.disabled = true;
      try { await action(); } catch (error) { status.textContent = failure(error); }
      finally { element.disabled = false; }
    });
    return element;
  }
  function confirmRemoval(name) {
    return new Promise(resolve => {
      const dialog = document.createElement('dialog');
      dialog.style.cssText = 'background:#171f33;color:#dae2fd;border:1px solid #3e4850;border-radius:12px;padding:24px;max-width:440px;width:calc(100% - 32px);box-sizing:border-box;box-shadow:0 24px 80px #0009;';
      dialog.setAttribute('aria-label', '저장 파일 삭제 확인');
      const heading = document.createElement('h3');
      heading.textContent = '저장 파일을 삭제할까요?';
      heading.style.cssText = 'font-size:18px;font-weight:600;margin:0 0 16px';
      const filename = document.createElement('p');
      filename.textContent = name;
      filename.style.cssText = 'word-break:break-all;color:#89ceff;margin-bottom:12px';
      const explanation = document.createElement('p');
      explanation.textContent = '보관함에 저장한 원본이 삭제됩니다. 컴퓨터에 있는 원본 파일은 삭제하지 않습니다.';
      explanation.style.cssText = 'font-size:13px;color:#bec8d2;line-height:1.6;margin-bottom:20px';
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;justify-content:flex-end;gap:12px';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = '취소';
      cancel.style.cssText = 'padding:8px 16px;border-radius:6px;background:#2d3449;color:#dae2fd;cursor:pointer';
      const confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.textContent = '삭제 확인';
      confirm.style.cssText = 'padding:8px 16px;border-radius:6px;background:#93000a;color:#ffdad6;cursor:pointer';
      cancel.addEventListener('click', () => dialog.close('cancel'));
      confirm.addEventListener('click', () => dialog.close('delete'));
      dialog.addEventListener('close', () => {
        const accepted = dialog.returnValue === 'delete';
        dialog.remove();
        resolve(accepted);
      }, {once:true});
      actions.append(cancel, confirm);
      dialog.append(heading, filename, explanation, actions);
      document.body.append(dialog);
      dialog.showModal();
      cancel.focus();
    });
  }

  function render() {
    rows.replaceChildren();
    const query = search.value.trim().toLowerCase();
    const visible = items.filter(item => item.name.toLowerCase().includes(query));
    count.textContent = `저장 ${items.length}개 · ${size(items.reduce((sum, item) => sum + item.size, 0))} · 표시 ${visible.length}개`;
    if (!visible.length) {
      const row = document.createElement('tr');
      const td = cell(items.length ? '검색한 파일이 없습니다.' : '업로드 영역에서 파일을 선택하고 보관함에 저장을 눌러 주세요.');
      td.colSpan = 5;
      row.append(td);
      rows.append(row);
      return;
    }
    for (const item of visible) {
      const row = document.createElement('tr');
      row.className = 'hover:bg-surface-container-highest/40';
      const name = cell('');
      const canPreview = ['step', 'stp'].includes(extension(item.name));
      const preview = async () => {
        const file = await getFile(item.id);
        document.dispatchEvent(new CustomEvent('catia-preview-file', { detail: file }));
        document.getElementById('catia-3d-canvas').scrollIntoView({behavior:'smooth',block:'center'});
        status.textContent = `${item.name} · 저장된 원본을 3D 미리보기로 열었습니다.`;
      };
      if (canPreview) {
        const open = button(item.name, preview);
        open.className = 'text-primary hover:underline text-left break-all';
        name.append(open);
      } else name.textContent = item.name;
      const actions = cell('');
      const deck = document.createElement('div');
      deck.className = 'flex flex-wrap gap-space-xs';
      if (canPreview) deck.append(button('3D 보기', preview));
      deck.append(button('원본 다운로드', async () => {
        const file = await getFile(item.id);
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = item.name;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }));
      const remove = button('삭제', async () => {
        if (!await confirmRemoval(item.name)) return;
        await transaction('readwrite', (files, metadata) => {
          files.delete(item.id);
          metadata.delete(item.id);
          const request = files.get('__active_step_preview__');
          request.onsuccess = () => {
            const active = request.result;
            if (active && (active.sourceId === item.id || (!active.sourceId && active.name === item.name && active.lastModified === item.lastModified && active.blob.size === item.size))) {
              files.delete('__active_step_preview__');
            }
          };
        });
        document.dispatchEvent(new CustomEvent('catia-library-file-deleted', {detail:item}));
        if (window.BroadcastChannel) {
          const channel = new BroadcastChannel('aeropipe-library');
          channel.postMessage({type:'deleted', item});
          channel.close();
        }
        await refresh();
        status.textContent = `${item.name} · 보관함에서 삭제했습니다.`;
      });
      remove.className = 'px-space-md py-1.5 rounded bg-error-container/30 text-error hover:bg-error-container font-label-sm text-label-sm';
      remove.setAttribute('aria-label', item.name + ' 저장 파일 삭제');
      deck.append(remove);
      actions.append(deck);
      row.append(name, cell(extension(item.name).toUpperCase()), cell(size(item.size)), cell(new Date(item.savedAt).toLocaleString('ko-KR')), actions);
      rows.append(row);
    }
  }
  search.addEventListener('input', render);
  document.getElementById('catia-library-refresh').addEventListener('click', () => { if (db) refresh().catch(error => { status.textContent = failure(error); }); });
  save.addEventListener('click', async () => {
    if (!db || saving) return;
    const selected = (window.catiaUploadFiles || []).slice();
    if (!selected.length) { status.textContent = '먼저 업로드 영역에서 파일을 선택해 주세요.'; return; }
    saving = true;
    save.disabled = true;
    let saved = 0, duplicate = 0;
    try {
      for (const file of selected) {
        status.textContent = `${file.name} 저장 중… (${saved + duplicate + 1}/${selected.length})`;
        const buffer = await file.arrayBuffer();
        if (!crypto.subtle) throw new Error('이 브라우저 주소에서는 안전한 파일 해시를 사용할 수 없습니다. Chrome/Edge 또는 localhost에서 열어 주세요.');
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), n => n.toString(16).padStart(2,'0')).join('');
        const id = JSON.stringify([file.name, hash]);
        const info = { id, name:file.name, size:file.size, type:file.type, lastModified:file.lastModified, savedAt:Date.now(), hash };
        let exists = false;
        await transaction('readwrite', (files, metadata) => {
          const request = metadata.get(id);
          request.onsuccess = () => {
            if (request.result) { exists = true; return; }
            files.add({...info, blob:file});
            metadata.add(info);
          };
        });
        if (exists) duplicate++; else saved++;
      }
      await refresh();
      status.textContent = `저장 완료 ${saved}개 · 동일 파일 ${duplicate}개는 기존 보관 유지`;
    } catch (error) {
      await refresh().catch(() => {});
      status.textContent = `${saved}개 저장 완료 · ${failure(error)}`;
    } finally { saving = false; save.disabled = false; }
  });
  save.disabled = true;
  try {
    const request = indexedDB.open('AeroPipeFileLibrary', 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore('files', {keyPath:'id'});
      database.createObjectStore('metadata', {keyPath:'id'});
    };
    request.onblocked = () => { status.textContent = '다른 탭을 닫고 보관함을 다시 열어 주세요.'; };
    request.onerror = () => { status.textContent = failure(request.error); };
    request.onsuccess = async () => {
      db = request.result;
      db.onversionchange = () => { db.close(); db = null; save.disabled = true; status.textContent = '보관함이 변경되었습니다. 새로고침해 주세요.'; };
      try {
        await refresh();
        save.disabled = false;
        status.textContent = '저장된 파일을 선택하면 3D 미리보기를 다시 열 수 있습니다. STEP/STP 형식을 지원합니다.';
      } catch (error) { status.textContent = failure(error); }
    };
  } catch (error) { status.textContent = failure(error); }
})();
