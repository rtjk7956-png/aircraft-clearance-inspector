(() => {
  'use strict';
  const select=document.getElementById('report-clearance-failure');
  const measured=document.getElementById('report-clearance-measured');
  const standard=document.getElementById('report-clearance-standard');
  const verdict=document.getElementById('report-clearance-verdict');
  const source=document.getElementById('report-clearance-source');
  const deviationValue=document.getElementById('report-deviation-value');
  const shortage=document.getElementById('report-deviation-shortage');
  const deviationVerdict=document.getElementById('report-deviation-verdict');
  const deviationNote=document.getElementById('report-deviation-note');
  if (!select || !measured || !standard) return;
  const imageCaption=document.getElementById('report-inspection-image-caption');
  const overview=document.getElementById('report-inspection-overview');
  const overviewFigure=document.getElementById('report-inspection-overview-figure');
  const missingOverview=document.getElementById('report-overview-missing');
  function displayImage(item) {
    const hasOverview=typeof item?.overviewImage==='string' && item.overviewImage.length<=700000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(item.overviewImage);
    if(overviewFigure)overviewFigure.hidden=!hasOverview;
    if(missingOverview)missingOverview.hidden=!item || hasOverview;
    if(overview){if(hasOverview){overview.src=item.overviewImage;overview.alt=`${item.row}번 검사 전체 배치: ${item.item_a} ↔ ${item.item_b}`;}else overview.removeAttribute('src');}
    if(imageCaption)imageCaption.textContent=item?`${item.row}번 · ${item.item_a} ↔ ${item.item_b}`:'FAIL 검사 항목의 전체 배치 이미지가 표시됩니다.';
  }
  const mm=value=>Number(value).toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2})+' mm';
  function displayTable(item) {
    const values=item?{
      item:`${item.row}번 · 부품 사이 최소 이격`,
      'part-a':item.item_a+(item.item_a_type?` (${item.item_a_type})`:''),
      'part-b':item.item_b+(item.item_b_type?` (${item.item_b_type})`:''),
      minimum:'≥ '+mm(item.minimum_mm),measured:mm(item.measured_mm),
      deviation:mm(item.measured_mm-item.minimum_mm),shortage:mm(item.minimum_mm-item.measured_mm),
      verdict:'FAIL',source:typeof item.source==='string'?item.source:'—'
    }:{};
    for(const key of ['item','part-a','part-b','minimum','measured','deviation','shortage','verdict','source']) {
      const cell=document.getElementById('report-result-'+key);
      if(cell)cell.textContent=values[key] || '—';
    }
    const status=document.getElementById('report-result-status');
    if(status)status.textContent=item?`${item.row}번 검사 · FAIL`:'FAIL 검사 항목 없음';
  }
  let report,failures=[];
  try {
    report=JSON.parse(sessionStorage.getItem('aeropipe-fail-report-v1') || 'null');
    if (report?.version===1 && Array.isArray(report.failures)) failures=report.failures.filter(item=>
      item.verdict==='FAIL' && typeof item.item_a==='string' && typeof item.item_b==='string' &&
      Number.isFinite(item.minimum_mm) && item.minimum_mm>=0 && Number.isFinite(item.measured_mm) &&
      item.measured_mm>=0 && item.measured_mm<item.minimum_mm);
  } catch {}
  select.replaceChildren();
  if (!failures.length) {
    displayImage(null);displayTable(null);
    try{sessionStorage.removeItem('aeropipe-mail-context-v1');}catch{}
    select.add(new Option('FAIL 항목 없음',''));
    measured.value='';standard.textContent='— mm';
    verdict.textContent='검사 결과 대기';source.textContent='';
    if(deviationValue)deviationValue.textContent='—';
    if(shortage)shortage.textContent='— mm';
    if(deviationVerdict)deviationVerdict.textContent='판정 대기';
    if(deviationNote)deviationNote.textContent='FAIL 검사 결과가 없습니다.';
    return;
  }
  failures.forEach((item,index)=>select.add(new Option(`${item.row}번 · ${item.item_a} ↔ ${item.item_b}`,String(index))));
  select.disabled=false;
  const selectionKey='aeropipe-report-selection-v1';
  const inspectionKey=item=>JSON.stringify([item.file_key || '',item.file_name || '',item.row,item.item_a,item.item_b,item.item_a_type || '',item.item_b_type || '',item.minimum_mm,item.measured_mm,item.source || '']);
  const withFile=item=>({...item,file_name:report.file_name || '',file_key:report.file_key || ''});
  function display(event) {
    const item=failures[Number(select.value)];if (!item) return;
    try{localStorage.setItem(selectionKey,inspectionKey(withFile(item)));}catch{}
    displayImage(item);displayTable(item);
    measured.value=Number(item.measured_mm).toFixed(2);
    standard.textContent='≥ '+mm(item.minimum_mm);
    if(deviationValue){deviationValue.textContent=Number(item.measured_mm-item.minimum_mm).toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2});deviationValue.className='font-headline-xl text-headline-xl text-error font-mono';}
    if(shortage)shortage.textContent=mm(item.minimum_mm-item.measured_mm);
    if(deviationVerdict){deviationVerdict.textContent='FAIL';deviationVerdict.className='px-1 py-0.5 rounded bg-error/20 text-error font-label-sm text-label-sm';}
    if(deviationNote)deviationNote.textContent=`${item.row}번 검사 · 최소 이격 기준 미달`;
    verdict.textContent='FAIL';
    verdict.className='px-1 py-0.5 rounded bg-error/20 text-error font-label-sm text-label-sm';
    source.textContent=typeof item.source==='string' ? item.source : '';
    const {image:storedImage,overviewImage:storedOverview,...analysisItem}=item;
    try{sessionStorage.setItem('aeropipe-mail-context-v1',JSON.stringify({inspection:{...analysisItem,file_name:report.file_name || '',file_key:report.file_key || ''},analysis:null}));}catch{}
    document.dispatchEvent(new CustomEvent('report-failure-selected',{detail:{...analysisItem,file_name:report.file_name || '',file_key:report.file_key || '',reset_report:event?.type==='change'}}));
  }
  select.addEventListener('change',display);
  let restoredIndex=-1;
  try{const id=localStorage.getItem(selectionKey);restoredIndex=failures.findIndex(item=>inspectionKey(withFile(item))===id);}catch{}
  select.value=String(restoredIndex>=0 ? restoredIndex : 0);display();
})();
