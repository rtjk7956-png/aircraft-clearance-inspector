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
  let sourceMode = 'step', vbaData = null;
  const vbaButton = document.getElementById('vba-csv-load');
  const stepButton = document.getElementById('step-inspection-mode');
  const vbaStatus = document.getElementById('vba-csv-status');
  let vbaIndex = new Map();
  const pairKey = (a,b) => JSON.stringify([a,b].sort());
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
        manualRows[i].measurement={fileKey:key,ids:[...m.ids],value:m.value,quality:m.quality,image:validImage(m.image),overviewImage:validImage(m.overviewImage),source:m.source,sourceFile:m.sourceFile,measuredAt:m.measuredAt};
      }
    }
  }
  function saveRows() {
    const key=catalogKey || '__csv__';
    saved.entries[key]={fileKey:catalogKey,name:catalogName,parts:partCatalog,rows:manualRows};
    // Detach each file's rows from the mutable editor state.
    saved.entries[key]=JSON.parse(JSON.stringify(saved.entries[key]));
    saved.last=key;
    if (sourceMode === 'step') saved.stepLast=key;
    try {localStorage.setItem(storageKey,JSON.stringify(saved));storageError=false;}
    catch {storageError=true;}
  }
  const previous=saved.entries[saved.stepLast || (saved.last === '__vba_csv__' ? '' : saved.last)];
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
    if (sourceMode === 'vba') return;
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
  function vbaPairPicker(index) {
    const state = manualRows[index];
    const wrapper = element('label', `${index + 1}번 · TRUE 부품 조합`, 'col-span-12 block text-sm text-primary mb-2');
    const select = element('select', '', 'block w-full min-w-0 rounded border border-outline-variant bg-surface-container-lowest text-on-surface px-2 py-2 text-sm mt-1');
    select.id = 'vba-inspection-pair-' + (index + 1);
    select.setAttribute('aria-label', `${index + 1}번 TRUE 부품 조합`);
    select.add(new Option('TRUE 부품 조합을 선택하세요', ''));
    const groups = new Map();
    for (const record of vbaData.measurements) {
      const a = partCatalog.find(p=>p.sourceId === record.part_a);
      const b = partCatalog.find(p=>p.sourceId === record.part_b);
      const groupName = [a?.type || record.group_a,b?.type || record.group_b].sort().join(' ↔ ');
      if (!groups.has(groupName)) groups.set(groupName,[]);
      groups.get(groupName).push(record);
    }
    for (const [groupName,records] of groups) {
      const group = document.createElement('optgroup');
      group.label = `${groupName} · TRUE ${records.length}건`;
      for (const record of records.sort((a,b)=>a.part_a.localeCompare(b.part_a)||a.part_b.localeCompare(b.part_b))) {
        const option = new Option(`${record.part_a} ↔ ${record.part_b} · ${mm(record.distance_mm)}`,pairKey(record.part_a,record.part_b));
        option.title = record.source_file;
        group.append(option);
      }
      select.append(group);
    }
    const names = state.picks.map(id=>partCatalog.find(p=>p.id === id)?.sourceId);
    select.value = names.every(Boolean) && vbaIndex.has(pairKey(...names)) ? pairKey(...names) : '';
    select.addEventListener('change',()=>{
      const record = vbaIndex.get(select.value);
      state.picks = record ? ['vba:'+record.part_a,'vba:'+record.part_b] : ['',''];
      state.measurement = null;
      render(lastData);
    });
    wrapper.append(select);
    return wrapper;
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
    if (sourceMode === 'vba') return;
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
  const mm = value => value == null ? '—' : `${Number(value).toLocaleString('ko-KR', {minimumFractionDigits: sourceMode === 'vba' ? 3 : 2, maximumFractionDigits: sourceMode === 'vba' ? 3 : 2})} mm`;
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
      if (sourceMode === 'vba') {
        const found = selected.every(Boolean) ? vbaIndex.get(pairKey(selected[0].sourceId,selected[1].sourceId)) : null;
        state.measurement = found ? {fileKey:catalogKey,ids:[...state.picks],value:found.distance_mm,
          source:'vba',sourceFile:found.source_file,measuredAt:found.measured_at} : null;
      }
      const measurement = state.measurement;
      const measured = measurement?.fileKey === catalogKey && state.picks.every((id,i) => id === measurement.ids[i]) ? measurement.value : null;
      const spec = rowSpecification(selected);
      const minimum = spec.status === 'ok' && spec.rule_kind === 'clearance' && Number.isFinite(spec.minimum_mm) ? spec.minimum_mm : null;
      const delta = measured != null && minimum != null ? measured - minimum : null;
      const verdict = delta == null ? 'REVIEW' : measured >= minimum && (spec.maximum_mm == null || measured <= spec.maximum_mm) ? 'PASS' : 'FAIL';
      return {...item,item_a:selected[0]?.label || '부품 A',item_b:selected[1]?.label || '부품 B',item_a_type:selected[0]?.type || '',item_b_type:selected[1]?.type || '',
        minimum_mm:minimum,measured_mm:measured,deviation_mm:delta,verdict,condition:'',source:spec.source || '',measurement_source:measurement?.source === 'vba' ? 'CATIA VBA CSV' : 'STEP 메시 근사',measurement_file:measurement?.sourceFile || '',
        display_verdict:minimum != null ? (measured == null ? (sourceMode === 'vba' ? 'CSV 값 없음' : '측정 대기') : verdict) : spec.status === 'empty' ? '선택 대기' : spec.status === 'loading' ? '조회 중' : '규격 없음',
        message:minimum != null ? selected.map(p => p.type || p.label).join(' ↔ ') + (measured == null ? (sourceMode === 'vba' ? ' · 이 부품 조합은 CSV에 없습니다.' : ' · 실측치를 넣어주세요.') : ' · 최소 이격 기준') : spec.message || '해당 조합의 규격이 없습니다.'};
    });
    rows.replaceChildren();
    chart.replaceChildren();
    for (const [index,item] of results.entries()) {
      const editable = index < manualRows.length, state = manualRows[index];
      const row = element('div', '', 'grid grid-cols-12 items-center gap-1 px-3 py-1.5 border-b border-outline-variant/30');
      const name = element('div', '', 'col-span-4 min-w-0');
      if (editable && sourceMode === 'vba') {
        row.append(vbaPairPicker(index));
        name.append(element('div','A · ' + item.item_a,'text-xs break-words mb-1'),element('div','B · ' + item.item_b,'text-xs break-words'));
      } else if (editable) { name.append(partPicker(0,data,index), partPicker(1,data,index)); }
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
      if (editable && sourceMode === 'vba' && item.measurement_file) {
        const sourceNote = element('div','CSV · ' + item.measurement_file,'text-outline text-[10px] leading-4 truncate');
        sourceNote.title = item.measurement_file;
        name.append(sourceNote);
      }
      row.append(name);
      row.append(element('div', item.minimum_mm == null ? '—' : `≥ ${mm(item.minimum_mm)}`, 'col-span-2 text-right text-xs'));
      const measuredCell = element('div', '', 'col-span-2 text-right text-xs');
      if (editable) measuredCell.id = 'csv-inspection-measured-' + (index + 1);
      measuredCell.append(element('div', mm(item.measured_mm)));
      if (editable && item.measured_mm != null) {
        const fromVba = state.measurement?.source === 'vba';
        measuredCell.append(element('div',fromVba ? 'VBA CSV 실측' : 'STEP 메시 근사','text-outline text-[10px]'));
        measuredCell.title = fromVba ? state.measurement.sourceFile : 'STEP 부품 표면의 최소 이격 · 메시 정밀도: ' + ({fast:'빠름',normal:'보통',fine:'정밀'}[state.measurement.quality] || '보통');
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
        measured_mm:r.measured_mm,deviation_mm:r.deviation_mm,source:r.source,measurement_source:r.measurement_source,measurement_file:r.measurement_file,verdict:'FAIL',image:manualRows[r.id-1]?.measurement?.image || null,overviewImage:manualRows[r.id-1]?.measurement?.overviewImage || null
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
    status.textContent = '기준치: Python specification_data.csv · 실측치: ' + (sourceMode === 'vba' ? 'CATIA VBA CSV 결과' : '선택한 STEP 최소 이격(메시 근사)') + ' · 편차 = 실측치 − 기준치' + (reportStored ? '' : ' · 브라우저 저장이 차단되어 보고서로 결과를 전달할 수 없습니다.') + (storageError ? ' · 검사 행 자동 저장 실패: 브라우저 저장 공간을 확인하세요.' : ' · 검사 행 자동 저장');
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
  function updateModeButtons() {
    vbaButton?.setAttribute('aria-pressed',String(sourceMode === 'vba'));
    stepButton?.setAttribute('aria-pressed',String(sourceMode === 'step'));
    if (stepButton) stepButton.disabled = sourceMode === 'step';
    const label = button.querySelector('span:last-child');
    if (label) label.textContent = sourceMode === 'vba' ? 'VBA CSV 새로고침' : 'CSV 재검사';
  }
  async function loadVba() {
    if (vbaButton.disabled) return;
    vbaButton.disabled = true;
    vbaStatus.textContent = 'VBA CSV 폴더에서 결과를 읽고 있습니다…';
    try {
      if (!lastData) await load();
      if (!lastData) throw new Error('검사 행을 먼저 불러와 주세요.');
      const response = await fetch('/api/vba/measurements');
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'VBA CSV를 읽지 못했습니다.');
      if (!Array.isArray(data.parts) || !Array.isArray(data.measurements) || !data.parts.length) throw new Error('VBA CSV에 부품 데이터가 없습니다.');
      const selectedRecords = data.measurements.filter(r=>r.selected === true);
      const selectedNames = new Set(selectedRecords.flatMap(r=>[r.part_a,r.part_b]));
      const trueDefaults = new Map();
      for (const record of selectedRecords) {
        const group = pairKey(record.group_a,record.group_b);
        if (!trueDefaults.has(group) || record.distance_mm < trueDefaults.get(group).distance_mm) trueDefaults.set(group,record);
      }
      data.measurements = selectedRecords;
      data.parts = data.parts.filter(p=>selectedNames.has(p.sourceId));
      data.default_pairs = [...trueDefaults.values()];
      const previousPicks = manualRows.map(row=>row.picks.map(id=>partCatalog.find(p=>String(p.id)===id)));
      saveRows();
      sourceMode = 'vba'; vbaData = data;
      vbaIndex = new Map(data.measurements.map(r=>[pairKey(r.part_a,r.part_b),r]));
      catalogKey = '__vba_csv__'; catalogName = 'CATIA VBA CSV · Output'; partCatalog = data.parts;
      const hasSaved = Array.isArray(saved.entries[catalogKey]?.rows);
      restoreRows(catalogKey);
      if (!hasSaved) {
        for (const [i,picks] of previousPicks.entries()) {
          manualRows[i].picks = picks.map(part=>{
            const names = [part?.sourceId,part?.label,part?.name].filter(Boolean);
            const exact = data.parts.filter(p=>names.includes(p.sourceId));
            return exact.length === 1 ? exact[0].id : '';
          });
        }
        if (!manualRows.some(r=>r.picks.some(Boolean))) {
          for (const [i,pair] of (data.default_pairs || []).slice(0,6).entries())
            manualRows[i].picks = ['vba:'+pair.part_a,'vba:'+pair.part_b];
        }
      }
      for (const state of manualRows) {
        const names = state.picks.map(id=>partCatalog.find(p=>p.id === id)?.sourceId);
        if (!names.every(Boolean) || !vbaIndex.has(pairKey(...names))) { state.picks=['','']; state.measurement=null; }
      }
      specCache.clear(); updateModeButtons(); render(lastData);
      vbaStatus.textContent = selectedRecords.length ? `${data.file_count}개 CSV · 전체 ${data.row_count}건 중 TRUE ${selectedRecords.length}건. 계통별 드롭다운에서 조합을 선택하면 부품 A/B와 실측값이 함께 들어갑니다.` : `${data.file_count}개 CSV에 Selected = TRUE인 측정 조합이 없습니다.`;
    } catch(error) {
      vbaStatus.textContent = 'VBA CSV 오류: ' + error.message;
    } finally { vbaButton.disabled = false; }
  }
  function useStep() {
    if (sourceMode === 'step') return;
    saveRows(); sourceMode = 'step';
    const previous = saved.entries[saved.stepLast];
    catalogKey = previous?.fileKey || ''; catalogName = previous?.name || '';
    partCatalog = previous?.parts || []; restoreRows(catalogKey);
    specCache.clear(); updateModeButtons();
    vbaStatus.textContent = '기존 STEP 측정으로 전환했습니다. 저장된 검사 행을 그대로 불러왔습니다.';
    if (lastData) render(lastData);
  }
  let preparingReport = false;
  for (const link of document.querySelectorAll('a[href="page3.html"]')) {
    link.addEventListener('click',async event=>{
      if (sourceMode !== 'vba') return;
      event.preventDefault();
      if (preparingReport) return;
      preparingReport = true;
      try {
        vbaStatus.textContent = 'STP 전체 배치를 보고서에 연결하고 있습니다…';
        const deadline = Date.now() + 15000;
        let app;
        while (Date.now() < deadline) {
          app = frame?.contentWindow?.stepMeasure;
          if (app?.model && app?.captureVbaOverview) break;
          await new Promise(resolve=>setTimeout(resolve,150));
        }
        if (sourceMode !== 'vba') return;
        if (!app?.model || !app?.captureVbaOverview) throw new Error('STP 모델이 준비되지 않았습니다. 왼쪽에서 해당 STP 파일을 선택하세요.');
        render(lastData);
        const report = JSON.parse(sessionStorage.getItem('aeropipe-fail-report-v1') || 'null');
        if (!report || !Array.isArray(report.failures)) throw new Error('검사 결과를 먼저 불러와 주세요.');
        for (const failure of report.failures) {
          const capture = app.captureVbaOverview({partA:failure.item_a,partB:failure.item_b,distanceMm:failure.measured_mm,row:failure.row});
          failure.overviewImage = capture.overviewImage;
          failure.geometry_source = 'STP'; failure.geometry_file_name = capture.modelName;
          report.file_name = capture.modelName; report.file_key = capture.modelKey;
        }
        sessionStorage.setItem('aeropipe-fail-report-v1',JSON.stringify(report));
        location.href = link.href;
      } catch(error) {
        vbaStatus.textContent = '전체 배치 연결 오류: ' + error.message;
      } finally { preparingReport = false; }
    });
  }
  vbaButton?.addEventListener('click',loadVba);
  stepButton?.addEventListener('click',useStep);
  button.addEventListener('click', () => {specCache.clear();sourceMode === 'vba' ? loadVba() : load('POST');});
  updateModeButtons();
  document.getElementById('csv-inspection-clear')?.addEventListener('click', () => {
    emptyRows();
    saveRows();
    try {sessionStorage.removeItem('aeropipe-mail-context-v1');} catch {}
    if (lastData) render(lastData);
  });
  load();
})();
