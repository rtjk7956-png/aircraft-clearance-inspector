(() => {
  'use strict';
  const rows = document.getElementById('csv-inspection-rows');
  const summary = document.getElementById('csv-inspection-summary');
  const badge = document.getElementById('csv-inspection-verdict');
  const status = document.getElementById('csv-inspection-status');
  const button = document.getElementById('csv-inspection-run');
  const chart = document.getElementById('csv-inspection-chart');
  const defect = document.getElementById('csv-defect-count');
  let controller, lastData;
  let partCatalog = [], catalogKey = '', catalogName = '';
  const storageKey = 'aeropipe-inspection-rows-v1';
  let storageError = false;
  let saved = {entries:{},last:''};
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (value && value.entries && typeof value.entries === 'object') saved = value;
  } catch {}
  const manualRows = Array.from({length:6}, () => ({picks:['',''],measurement:null}));
  function emptyRows() {
    for (const row of manualRows) {row.picks=['',''];row.measurement=null;}
  }
  function restoreRows(key) {
    const entry = saved.entries[key || '__csv__'];
    emptyRows();
    if (!entry || !Array.isArray(entry.rows)) return;
    for (let i=0;i<manualRows.length;i++) {
      const value=entry.rows[i];
      if (!value || !Array.isArray(value.picks) || value.picks.length!==2 || !value.picks.every(id=>typeof id==='string')) continue;
      manualRows[i].picks=[...value.picks];
      const m=value.measurement;
      if (m && m.fileKey===key && Array.isArray(m.ids) && m.ids.length===2 && m.ids.every((id,j)=>id===value.picks[j]) &&
          m.ids[0]!==m.ids[1] && typeof m.value==='number' && Number.isFinite(m.value) && m.value>=0) {
        const validImage=image=>typeof image==='string' && image.length<=700000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image) ? image : null;
        manualRows[i].measurement={fileKey:key,ids:[...m.ids],value:m.value,quality:m.quality,image:validImage(m.image),overviewImage:validImage(m.overviewImage)};
      }
    }
  }
  function saveRows() {
    const key=catalogKey || '__csv__';
    saved.entries[key]={fileKey:catalogKey,name:catalogName,parts:partCatalog,rows:manualRows};
    // Detach each file's rows from the mutable editor state.
    saved.entries[key]=JSON.parse(JSON.stringify(saved.entries[key]));
    saved.last=key;
    try {localStorage.setItem(storageKey,JSON.stringify(saved));storageError=false;}
    catch {storageError=true;}
  }
  const previous=saved.entries[saved.last];
  if (previous && typeof previous.fileKey==='string' && Array.isArray(previous.parts)) {
    catalogKey=previous.fileKey;
    catalogName=typeof previous.name==='string' ? previous.name : '';
    partCatalog=previous.parts.filter(p=>p && typeof p.id==='string' && typeof p.label==='string');
    restoreRows(catalogKey);
  }
  const specCache = new Map(), specRequests = new Set();
  function rowSpecification(selected) {
    if (!selected.every(Boolean)) return {status:'empty',message:'검사할 부품 A와 B를 선택하세요.'};
    if (partCatalog.length && selected.some(p => !p.type)) return {status:'unknown',message:'STEP 측정기에서 두 부품의 계통을 지정하세요.'};
    const pair = selected.map(p => partCatalog.length ? p.type : p.label).join(' ↔ ');
    if (specCache.has(pair)) return specCache.get(pair);
    if (!specRequests.has(pair)) {
      specRequests.add(pair);
      fetch('/api/specification?' + new URLSearchParams({pair}))
        .then(async response => { const result=await response.json(); if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : '규격 조회 실패'); return result; })
        .then(result => specCache.set(pair,result))
        .catch(error => specCache.set(pair,{status:'error',message:'규격 조회 오류: ' + error.message}))
        .finally(() => {specRequests.delete(pair);if(lastData)render(lastData);});
    }
    return {status:'loading',message:'Python 규격표에서 기준치를 조회하고 있습니다.'};
  }
  const frame = document.getElementById('step-measurer-frame');
  function syncParts() {
    const app = frame?.contentWindow?.stepMeasure;
    if (!app?.getParts) return;
    const snapshot = app.getParts();
    // An empty iframe on return must not erase the saved inspection.
    if (!snapshot.fileKey || !Array.isArray(snapshot.parts) || !snapshot.parts.length) return;
    if (snapshot.fileKey !== catalogKey) {
      saveRows();
      catalogKey = snapshot.fileKey;
      restoreRows(catalogKey);
    }
    partCatalog = snapshot.parts;
    catalogName = app.model?.name || saved.entries[catalogKey]?.name || '';
  }
  function choices(data) {
    if (partCatalog.length) return partCatalog;
    return [...new Set(data.results.flatMap(r => [r.item_a,r.item_b]).filter(Boolean))]
      .map(name => ({id:'csv:' + name,label:name}));
  }
  function partPicker(side, data, index) {
    const state = manualRows[index], picks = state.picks;
    const label = element('label', (side === 0 ? 'A' : 'B'), 'flex items-center gap-1 text-[10px] text-outline mb-1');
    const select = element('select', '', 'block flex-1 w-full min-w-0 rounded border border-outline-variant bg-surface-container-lowest text-on-surface px-1 py-0.5 text-[11px] leading-5');
    select.id = 'csv-inspection-part-' + (side === 0 ? 'a' : 'b') + '-' + (index + 1);
    select.setAttribute('aria-label', `${index + 1}번 검사 부품 ` + (side === 0 ? 'A' : 'B'));
    select.add(new Option('부품을 선택하세요', ''));
    for (const part of choices(data)) {
      const option = new Option(part.label, String(part.id));
      option.disabled = String(part.id) === picks[1-side];
      select.add(option);
    }
    select.value = picks[side];
    select.title = choices(data).find(p => String(p.id) === picks[side])?.label || '부품을 선택하세요';
    select.addEventListener('change', () => { picks[side] = select.value; state.measurement = null; render(lastData); });
    label.append(select);
    return label;
  }
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== frame?.contentWindow) return;
    const message = event.data;
    if (!['step-measurer-parts-updated','step-measurer-model-loaded','step-measurer-gap-measured'].includes(message?.type)) return;
    syncParts();
    if (message.type === 'step-measurer-gap-measured') {
      const target = message.row ?? 1;
      if (!Number.isInteger(target) || target < 1 || target > manualRows.length) return;
      const state = manualRows[target-1];
      const ids = message.ids;
      if (!catalogKey || message.fileKey !== catalogKey || !Array.isArray(ids) || ids.length !== 2 ||
          ids[0] === ids[1] || !ids.every(id => typeof id === 'string' && partCatalog.some(p => String(p.id) === id)) ||
          typeof message.distance_mm !== 'number' || !Number.isFinite(message.distance_mm) || message.distance_mm < 0) return;
      state.picks = [...ids];
      state.measurement = {fileKey:catalogKey,ids:[...ids],value:message.distance_mm,quality:message.quality,overviewImage:typeof message.overviewImage==='string' && message.overviewImage.length<=700000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(message.overviewImage) ? message.overviewImage : null,
        image:typeof message.image==='string' && message.image.length<=700000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(message.image) ? message.image : null};
    }
    if (lastData) render(lastData);
  });
  frame?.addEventListener('load', () => { syncParts(); if (lastData) render(lastData); });
  const mm = value => value == null ? '—' : `${Number(value).toLocaleString('ko-KR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} mm`;
  const color = verdict => verdict === 'PASS' ? 'text-secondary' : verdict === 'FAIL' ? 'text-error' : 'text-tertiary';
  function element(tag, text, classes = '') {
    const node = document.createElement(tag);
    node.textContent = text;
    node.className = classes;
    return node;
  }
  function invalidate(message) {
    try {sessionStorage.removeItem('aeropipe-fail-report-v1');} catch {}
    rows.replaceChildren();
    chart.replaceChildren();
    badge.textContent = '확인 필요';
    badge.className = 'text-tertiary font-bold';
    summary.textContent = message;
    defect.textContent = '검사 결과 미확인';
  }
  function render(data) {
    lastData = data;
    syncParts();
    const options = choices(data);
    const results = data.results.map((item,index) => {
      if (index >= manualRows.length) return item;
      const state = manualRows[index];
      state.picks = state.picks.map(id => options.some(p => String(p.id) === id) ? id : '');
      const selected = state.picks.map(id => options.find(p => String(p.id) === id));
      const measurement = state.measurement;
      const measured = measurement?.fileKey === catalogKey && state.picks.every((id,i) => id === measurement.ids[i]) ? measurement.value : null;
      const spec = rowSpecification(selected);
      const minimum = spec.status === 'ok' && spec.rule_kind === 'clearance' && Number.isFinite(spec.minimum_mm) ? spec.minimum_mm : null;
      const delta = measured != null && minimum != null ? measured - minimum : null;
      const verdict = delta == null ? 'REVIEW' : measured >= minimum && (spec.maximum_mm == null || measured <= spec.maximum_mm) ? 'PASS' : 'FAIL';
      return {...item,item_a:selected[0]?.label || '부품 A',item_b:selected[1]?.label || '부품 B',item_a_type:selected[0]?.type || '',item_b_type:selected[1]?.type || '',
        minimum_mm:minimum,measured_mm:measured,deviation_mm:delta,verdict,condition:'',source:spec.source || '',
        display_verdict:minimum != null ? (measured == null ? '측정 대기' : verdict) : spec.status === 'empty' ? '선택 대기' : spec.status === 'loading' ? '조회 중' : '규격 없음',
        message:minimum != null ? selected.map(p => p.type || p.label).join(' ↔ ') + (measured == null ? ' · 실측치를 넣어주세요.' : ' · 최소 이격 기준') : spec.message || '해당 조합의 규격이 없습니다.'};
    });
    rows.replaceChildren();
    chart.replaceChildren();
    for (const [index,item] of results.entries()) {
      const editable = index < manualRows.length, state = manualRows[index];
      const row = element('div', '', 'grid grid-cols-12 items-center gap-1 px-3 py-1.5 border-b border-outline-variant/30');
      const name = element('div', '', 'col-span-4 min-w-0');
      if (editable) { name.append(partPicker(0,data,index), partPicker(1,data,index)); }
      else name.append(element('div', `${item.id}. ${item.item_a} ↔ ${item.item_b}`, 'break-words font-semibold'));
      const note = element('div',item.condition || item.message,'text-outline text-[10px] leading-4 truncate');
      note.title = item.condition || item.message || '';
      name.append(note);
      if (item.source) {
        const cell = item.source.match(/Sheet[^!]*![A-Z]+\d+/);
        const sourceNote = element('div',cell ? '규격집 · ' + cell[0] : item.source,'text-outline text-[10px] leading-4 truncate');
        sourceNote.title = item.source;
        name.append(sourceNote);
      }
      row.append(name);
      row.append(element('div', item.minimum_mm == null ? '—' : `≥ ${mm(item.minimum_mm)}`, 'col-span-2 text-right text-xs'));
      const measuredCell = element('div', '', 'col-span-2 text-right text-xs');
      if (editable) measuredCell.id = 'csv-inspection-measured-' + (index + 1);
      measuredCell.append(element('div', mm(item.measured_mm)));
      if (editable && item.measured_mm != null) {
        measuredCell.append(element('div','STEP 메시 근사','text-outline text-[10px]'));
        measuredCell.title = 'STEP 부품 표면의 최소 이격 · 메시 정밀도: ' + ({fast:'빠름',normal:'보통',fine:'정밀'}[state.measurement.quality] || '보통');
      }
      row.append(measuredCell);
      row.append(element('div', `${item.deviation_mm > 0 ? '+' : ''}${mm(item.deviation_mm)}`, `col-span-2 text-right text-xs ${color(item.verdict)}`));
      row.append(element('div', editable ? item.display_verdict : item.verdict === 'REVIEW' ? '확인 필요' : item.verdict, `col-span-2 text-center text-xs font-bold ${color(item.verdict)}`));
      rows.append(row);
      if (item.deviation_mm != null) {
        const line = element('div', '', 'grid grid-cols-12 items-center gap-2 text-xs');
        line.append(element('span', `${item.item_a} ↔ ${item.item_b}`, 'col-span-5 break-words'));
        const track = element('div', '', 'col-span-4 h-2 bg-surface-container-high rounded overflow-hidden');
        const bar = element('div', '', `h-full ${item.verdict === 'PASS' ? 'bg-secondary' : 'bg-error'}`);
        const max = Math.max(1, ...results.map(value => Math.abs(value.deviation_mm || 0)));
        bar.style.width = `${Math.abs(item.deviation_mm) / max * 100}%`;
        track.append(bar);
        line.append(track, element('span', mm(item.deviation_mm), `col-span-3 text-right ${color(item.verdict)}`));
        chart.append(line);
      }
    }
    const report = {version:1,created_at:new Date().toISOString(),file_key:catalogKey,
      file_name:catalogName,
      failures:results.slice(0,manualRows.length).filter(r => r.verdict === 'FAIL').map(r => ({
        row:r.id,item_a:r.item_a,item_b:r.item_b,item_a_type:r.item_a_type,item_b_type:r.item_b_type,minimum_mm:r.minimum_mm,
        measured_mm:r.measured_mm,deviation_mm:r.deviation_mm,source:r.source,verdict:'FAIL',image:manualRows[r.id-1]?.measurement?.image || null,overviewImage:manualRows[r.id-1]?.measurement?.overviewImage || null
      }))};
    let reportStored = true;
    try {sessionStorage.setItem('aeropipe-fail-report-v1',JSON.stringify(report));} catch {reportStored=false;}
    const s = {total:results.length, pass:results.filter(r => r.verdict === 'PASS').length,
      fail:results.filter(r => r.verdict === 'FAIL').length, review:results.filter(r => r.verdict === 'REVIEW').length};
    s.verdict = s.fail ? 'FAIL' : s.review ? 'REVIEW' : 'PASS';
    badge.textContent = s.verdict === 'REVIEW' ? '확인 필요' : s.verdict;
    badge.className = `${color(s.verdict)} font-bold`;
    summary.textContent = s.total ? `총 ${s.total}건 · PASS ${s.pass}건 · FAIL ${s.fail}건 · 확인 필요 ${s.review}건` : '측정 CSV에 검사 항목이 없습니다.';
    defect.textContent = `FAIL ${s.fail}건 · 확인 필요 ${s.review}건`;
    saveRows();
    status.textContent = '기준치: Python specification_data.csv · 실측치: 선택한 STEP 최소 이격(메시 근사) · 편차 = 실측치 − 기준치' + (reportStored ? '' : ' · 브라우저 저장이 차단되어 보고서로 결과를 전달할 수 없습니다.') + (storageError ? ' · 검사 행 자동 저장 실패: 브라우저 저장 공간을 확인하세요.' : ' · 검사 행 자동 저장');
  }
  async function load(method = 'GET') {
    if (controller) controller.abort();
    controller = new AbortController();
    const active = controller;
    button.disabled = true;
    invalidate('CSV를 읽어 검사하고 있습니다.');
    status.textContent = '검사 중…';
    try {
      if (location.protocol === 'file:') throw new Error('start.cmd 실행 후 http://127.0.0.1:8766/page2.html에서 열어 주세요.');
      const response = await fetch('/api/inspections', {method, signal: active.signal});
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : '검사 요청을 처리하지 못했습니다.');
      render(data);
    } catch (error) {
      if (error.name === 'AbortError') return;
      invalidate('결과를 불러오지 못했습니다.');
      status.textContent = error.message;
    } finally {
      if (controller === active) button.disabled = false;
    }
  }
  button.addEventListener('click', () => {specCache.clear();load('POST');});
  document.getElementById('csv-inspection-clear')?.addEventListener('click', () => {
    emptyRows();
    saveRows();
    try {sessionStorage.removeItem('aeropipe-mail-context-v1');} catch {}
    if (lastData) render(lastData);
  });
  load();
})();
