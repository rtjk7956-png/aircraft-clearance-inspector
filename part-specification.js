(() => {
  const input = document.getElementById('inspection-part-pair-1');
  const criterion = document.getElementById('inspection-standard-1');
  const note = document.getElementById('inspection-spec-note-1');
  const source = document.getElementById('inspection-spec-source-1');
  const condition = document.getElementById('inspection-condition-1');
  const diameter = document.getElementById('inspection-diameter-1');
  const diameterLabel = document.getElementById('inspection-diameter-label-1');
  const measured = document.getElementById('inspection-measured-1');
  const deviation = document.getElementById('inspection-deviation-1');
  const verdict = document.getElementById('inspection-verdict-1');
  let activeSpec = null;
  if (!input || !criterion || !measured) return;
  let timer, request = 0, controller;
  const mm = value => Number(value).toLocaleString('ko-KR',{maximumFractionDigits:3}) + ' mm';
  function setVerdict(text, state) {
    verdict.textContent = text;
    const colors = state === 'pass' ? 'bg-secondary-container/40 text-secondary' : state === 'fail' ? 'bg-error text-on-error' : 'bg-surface-container-high text-on-surface-variant';
    verdict.className = 'px-2 py-0.5 rounded font-label-sm text-[10px] ' + colors;
  }
  function clearOutcome() {
    deviation.textContent = '—';
    deviation.className = 'col-span-2 text-right font-label-sm text-label-sm text-on-surface-variant font-semibold';
    setVerdict('입력 대기');
  }
  function updateOutcome() {
    clearOutcome();
    if (measured.validity.badInput || !measured.validity.valid) {
      setVerdict('입력 확인');
      return;
    }
    if (measured.value === '') return;
    const value = measured.valueAsNumber;
    if (!Number.isFinite(value) || value < 0) {
      setVerdict('입력 확인');
      return;
    }
    if (!activeSpec || activeSpec.status !== 'ok' || !Number.isFinite(activeSpec.minimum_mm)) {
      setVerdict('규격 확인 필요');
      return;
    }
    const minimum = activeSpec.minimum_mm;
    const maximum = activeSpec.maximum_mm;
    if (maximum != null && !Number.isFinite(maximum)) {
      setVerdict('규격 확인 필요');
      return;
    }
    const delta = value - minimum;
    const pass = value >= minimum && (maximum == null || value <= maximum);
    deviation.textContent = (delta > 0 ? '+' : '') + mm(delta);
    deviation.className = 'col-span-2 text-right font-label-sm text-label-sm font-semibold ' + (pass ? 'text-secondary' : 'text-error');
    setVerdict(pass ? 'PASS' : 'FAIL', pass ? 'pass' : 'fail');
  }
  async function lookup(version) {
    if (version !== request) return;
    if (!input.value.trim()) { criterion.textContent='—'; note.textContent='부품 A ↔ 부품 B 조합을 선택해 주세요.'; return; }
    if (location.protocol === 'file:') { criterion.textContent='조회 필요'; note.textContent='start.cmd를 실행하고 로컬 페이지에서 열어 주세요.'; return; }
    controller = new AbortController();
    try {
      const params = new URLSearchParams({pair:input.value,condition:condition.value,diameter:diameter.value});
      const response = await fetch('/api/specification?' + params, {signal:controller.signal});
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Python 규격 조회 서버에 연결하지 못했습니다. start.cmd로 다시 실행해 주세요.');
      if (version !== request) return;
      criterion.textContent = result.status === 'ok' ? (result.maximum_mm != null ? `${mm(result.minimum_mm)} ~ ${mm(result.maximum_mm)}` : '≥ ' + mm(result.minimum_mm)) : '확인 필요';
      activeSpec = result;
      updateOutcome();
      note.textContent = result.message;
      source.textContent = result.source || '';
      source.title = result.source || '';
      const current = condition.value;
      condition.replaceChildren(new Option('설치·굽힘 조건 선택',''));
      for (const value of result.conditions || []) condition.add(new Option(value,value));
      if ((result.conditions || []).includes(current)) condition.value=current;
      condition.hidden = !(result.conditions || []).length;
      const needsDiameter = !!result.reference;
      diameterLabel.hidden = !needsDiameter;
      diameter.placeholder = ({WIRE_OD:'전선 직경 (mm)',MAX_WIRE_OD:'가장 굵은 전선 직경 (mm)',CABLE_OD:'케이블 직경 (mm)'})[result.reference] || '직경 (mm)';
      diameter.setAttribute('aria-label',diameter.placeholder);
    } catch (error) {
      if (error.name === 'AbortError' || version !== request) return;
      criterion.textContent='조회 오류';
      note.textContent=error.message;
    }
  }
  function update(reset) {
    const version = ++request;
    clearTimeout(timer);
    if (controller) controller.abort();
    activeSpec = null;
    if (reset) { measured.value=''; condition.value=''; diameter.value=''; condition.hidden=true; diameterLabel.hidden=true; }
    updateOutcome();
    source.textContent='';
    criterion.textContent = input.value.trim() ? '조회 중…' : '—';
    timer = setTimeout(()=>lookup(version),350);
  }
  input.addEventListener('change',()=>update(true));
  condition.addEventListener('change',()=>update(false));
  diameter.addEventListener('input',()=>update(false));
  measured.addEventListener('input',updateOutcome);
  async function loadOptions() {
    input.disabled = true;
    note.textContent = '등록된 부품 조합을 불러오고 있습니다.';
    try {
      if (location.protocol === 'file:') throw new Error('웹_뷰어_시작.cmd 실행 후 로컬 페이지에서 열어 주세요.');
      const response = await fetch('/api/specification/options');
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : '부품 조합을 불러오지 못했습니다.');
      input.replaceChildren(new Option('부품 A ↔ 부품 B 선택', ''));
      for (const group of data.groups) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = group.label;
        for (const item of group.options) optgroup.append(new Option(item.label, item.value));
        if (group.options.length) input.append(optgroup);
      }
      input.disabled = !data.groups.some(group => group.options.length);
      update(true);
      if (input.disabled) note.textContent = 'CSV에 등록된 부품 조합이 없습니다.';
    } catch (error) {
      input.replaceChildren(new Option('부품 목록 조회 오류', ''));
      note.textContent = error.message;
    }
  }
  loadOptions();
})();
