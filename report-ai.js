(() => {
  'use strict';
  const button=document.getElementById('report-ai-analyze');
  const status=document.getElementById('report-ai-status');
  if(!button || !status)return;
  let selected=null,controller=null,revision=0;
  const cache=new Map();
  const key=item=>JSON.stringify([item.file_key || '',item.file_name || '',item.row,item.item_a,item.item_b,item.item_a_type || '',item.item_b_type || '',item.minimum_mm,item.measured_mm,item.source || '']);
  const storageKey='aeropipe-ai-reports-v1';
  try {
    const records=JSON.parse(localStorage.getItem(storageKey) || 'null');
    if(records && records.version===1 && Array.isArray(records.entries)) {
      for(const entry of records.entries) if(Array.isArray(entry) && entry.length===2 && typeof entry[0]==='string') cache.set(entry[0],entry[1]);
    }
  } catch {}
  function saveReports() {
    try {
      // Merge other saved inspections before updating the current result.
      const records=JSON.parse(localStorage.getItem(storageKey) || 'null');
      const merged=new Map(records?.version===1 && Array.isArray(records.entries) ? records.entries : []);
      for(const [id,result] of cache) merged.set(id,result);
      localStorage.setItem(storageKey,JSON.stringify({version:1,entries:[...merged]}));
      return true;
    } catch {return false;}
  }
  const riskLevel=document.getElementById('report-ai-risk-level');
  const riskReason=document.getElementById('report-ai-risk-reason');
  const riskChecks=document.getElementById('report-ai-risk-checks');
  const reportTitle=document.getElementById('report-ai-document-title');
  const reportBody=document.getElementById('report-ai-document-body');
  const reportState=document.getElementById('report-ai-document-status');
  const reportContext=document.getElementById('report-ai-document-context');
  const reportSource=document.getElementById('report-ai-document-source');
  function clear(){
    reportTitle.textContent='AI 보고서 제목';reportBody.textContent='AI 분석·보고서 작성을 누르면 선택한 FAIL 항목의 보고서가 작성됩니다.';
    reportState.textContent='작성 대기';reportSource.textContent='';
    reportContext.textContent=selected ? `${selected.row}번 · ${selected.item_a} ↔ ${selected.item_b}` : 'FAIL 검사 항목을 선택하세요.';
    riskLevel.textContent='분석 대기';riskLevel.className='self-start rounded px-2 py-1 bg-surface-container-high text-on-surface-variant font-semibold';
    riskReason.textContent='AI 원인 분석을 누르면 선택한 FAIL 항목의 위험 수준과 판단 근거가 표시됩니다.';riskChecks.textContent='';
    for(const [key,label] of [['immediate','즉시'],['process','공정'],['quality','품질']]){
      document.getElementById(`report-ai-action-${key}-title`).textContent=label+' 조치 계획 · 분석 대기';
      document.getElementById(`report-ai-action-${key}-description`).textContent='선택한 FAIL 항목을 분석하면 권장 계획이 표시됩니다.';
      document.getElementById(`report-ai-action-${key}-completion`).textContent='';
    }
    for(let i=1;i<=3;i++){
      document.getElementById(`report-ai-cause-${i}-title`).textContent=`AI 추정 발생 원인 ${i}`;
      document.getElementById(`report-ai-cause-${i}-status`).textContent='분석 대기';
      document.getElementById(`report-ai-cause-${i}-description`).textContent='선택한 FAIL 항목을 분석하면 추정 원인이 표시됩니다.';
      document.getElementById(`report-ai-cause-${i}-verification`).textContent='';
    }
  }
  function show(result){
    if(!result.report || typeof result.report.title!=='string' || !result.report.title.trim() || typeof result.report.body!=='string' || !result.report.body.trim())throw new Error('AI 보고서 응답 형식을 확인할 수 없습니다.');
    const actions=result.actions;
    if(!actions || !['immediate','process','quality'].every(key=>actions[key] && ['title','description','completion'].every(field=>typeof actions[key][field]==='string' && actions[key][field].trim())))throw new Error('AI 시정 조치 계획 형식을 확인할 수 없습니다.');
    const risk=result.risk;
    if(!risk || !['HIGH','MEDIUM','LOW','UNKNOWN'].includes(risk.level) || typeof risk.reason!=='string' || typeof risk.checks!=='string')throw new Error('AI 위험도 결과 형식을 확인할 수 없습니다.');
    if(!Array.isArray(result.causes) || result.causes.length!==3 || !result.causes.every(cause=>cause && ['title','description','verification'].every(field=>typeof cause[field]==='string')))throw new Error('AI 결과 형식을 확인할 수 없습니다.');
    result.causes.forEach((cause,index)=>{
      const i=index+1;
      document.getElementById(`report-ai-cause-${i}-title`).textContent=cause.title;
      document.getElementById(`report-ai-cause-${i}-status`).textContent='추정';
      document.getElementById(`report-ai-cause-${i}-description`).textContent=cause.description;
      document.getElementById(`report-ai-cause-${i}-verification`).textContent='확인 방법: '+cause.verification;
    });
    for(const key of ['immediate','process','quality']){
      document.getElementById(`report-ai-action-${key}-title`).textContent=actions[key].title;
      document.getElementById(`report-ai-action-${key}-description`).textContent=actions[key].description;
      document.getElementById(`report-ai-action-${key}-completion`).textContent='완료 확인: '+actions[key].completion;
    }
    reportTitle.textContent=result.report.title;reportBody.textContent=result.report.body;reportState.textContent='AI 초안 작성 완료';
    const file=result.context?.file_name || selected.file_name || '';
    reportContext.textContent=`${file ? file+' · ' : ''}${selected.row}번 · ${selected.item_a} ↔ ${selected.item_b}`;
    reportSource.textContent='규격 근거: '+(result.context?.source || selected.source || '') + (result.generated_at ? ' · 작성: '+new Date(result.generated_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}) : '');
    const labels={HIGH:'높음',MEDIUM:'중간',LOW:'낮음',UNKNOWN:'판단 보류'};
    const colors={HIGH:'bg-error/20 text-error',MEDIUM:'bg-tertiary/20 text-tertiary',LOW:'bg-secondary/20 text-secondary',UNKNOWN:'bg-surface-container-high text-on-surface-variant'};
    riskLevel.textContent=labels[risk.level];riskLevel.className='self-start rounded px-2 py-1 font-semibold '+colors[risk.level];
    riskReason.textContent=risk.reason;riskChecks.textContent='추가 확인: '+risk.checks;
    try{sessionStorage.setItem('aeropipe-mail-context-v1',JSON.stringify({inspection:selected,analysis:{report:result.report,risk:result.risk}}));}catch{}
    status.textContent=`${selected.row}번 FAIL 항목 · ${result.provider} / ${result.model} · 원인·위험도·시정 계획·보고서 작성 완료`;
  }
  document.addEventListener('report-failure-selected',event=>{
    const {reset_report:resetReport,...inspection}=event.detail;
    selected=inspection;++revision;controller?.abort();clear();button.disabled=false;
    if(resetReport) {
      const id=key(selected);
      cache.delete(id);
      try {
        const records=JSON.parse(localStorage.getItem(storageKey) || 'null');
        if(records?.version===1 && Array.isArray(records.entries)) {
          records.entries=records.entries.filter(entry=>Array.isArray(entry) && entry[0]!==id);
          localStorage.setItem(storageKey,JSON.stringify(records));
        }
      } catch {
        status.textContent='보고서는 초기화됐지만 저장된 보고서를 지우지 못했습니다. 브라우저 저장 공간을 확인하세요.';
        return;
      }
    }
    status.textContent=`${selected.row}번 FAIL 항목 · AI 원인 분석을 눌러 원인을 작성하세요.`;
    if(cache.has(key(selected))) {
      try {show(cache.get(key(selected)));status.textContent+=' · 저장된 보고서 복원';}
      catch {cache.delete(key(selected));clear();status.textContent='저장된 보고서 형식을 확인할 수 없습니다. AI 분석·보고서 작성으로 다시 작성하세요.';}
    }
  });
  button.addEventListener('click',async()=>{
    if(!selected)return;
    const item=selected,version=++revision;controller?.abort();controller=new AbortController();
    button.disabled=true;clear();reportState.textContent='AI 작성 중…';status.textContent='선택한 FAIL 데이터를 바탕으로 AI가 원인·위험도·시정 조치 계획과 보고서를 작성하고 있습니다…';
    try{
      const response=await fetch('/api/ai/causes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item),signal:controller.signal});
      const result=await response.json();
      if(!response.ok)throw new Error(typeof result.detail==='string'?result.detail:'AI 분석 요청에 실패했습니다.');
      if(version!==revision)return;
      show(result);cache.set(key(item),result);
      status.textContent+=saveReports() ? ' · 보고서 자동 저장 완료' : ' · 보고서 자동 저장 실패: 브라우저 저장 공간을 확인하세요.';
    }catch(error){if(error.name!=='AbortError' && version===revision){status.textContent=error.message;reportState.textContent='작성 실패 · 다시 시도';}}
    finally{if(version===revision)button.disabled=false;}
  });
})();
