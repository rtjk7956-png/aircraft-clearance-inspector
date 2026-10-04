(() => {
  const to=document.getElementById('mail-to'),cc=document.getElementById('mail-cc'),subject=document.getElementById('mail-subject');
  const button=document.getElementById('mail-ai-route'),status=document.getElementById('mail-routing-status'),reason=document.getElementById('mail-routing-reason');
  if(!to || !cc || !subject || !button)return;
  let draft;
  try{draft=JSON.parse(sessionStorage.getItem('aeropipe-mail-context-v1') || 'null');}catch{}
  const prepare=new URLSearchParams(location.search).get('compose')==='1';
  if(prepare)history.replaceState(null,'',location.pathname);
  const storageKey='aeropipe-mail-saved-drafts-v2';
  let saved={entries:{},last:null};
  try{
    const data=JSON.parse(localStorage.getItem(storageKey) || 'null');
    if(data && typeof data.entries==='object' && data.entries && !Array.isArray(data.entries))saved=data;
  }catch{}
  if(!draft?.inspection && saved.last && saved.entries[saved.last]?.context)draft=saved.entries[saved.last].context;
  const item=draft?.inspection;
  const itemKey=item?JSON.stringify([item.file_key || '',item.file_name || '',item.row,item.item_a,item.item_b,item.item_a_type,item.item_b_type,item.minimum_mm,item.measured_mm,item.source || '']):null;
  const previous=itemKey?(saved.entries[itemKey] || Object.values(saved.entries).find(record=>{
    const old=record.context?.inspection;
    return old && !old.file_key && JSON.stringify([old.file_name || '',old.row,old.item_a,old.item_b,old.item_a_type,old.item_b_type,old.minimum_mm,old.measured_mm,old.source || ''])===JSON.stringify([item.file_name || '',item.row,item.item_a,item.item_b,item.item_a_type,item.item_b_type,item.minimum_mm,item.measured_mm,item.source || '']);
  })):null;
  const body=document.getElementById('mail-report-body');
  if(!item){status.textContent='보고서에서 검사 항목을 선택한 뒤 메일 발송 준비 버튼을 눌러 주세요.';button.disabled=true;}
  if(body){body.value='';body.placeholder=item?'AI가 수신·참조·제목과 메일 본문을 자동으로 작성합니다…':'보고서에서 검사 항목을 선택해 주세요.';}
  const bodyMarker='\n\n[메일 본문]\n';
  const withHeaders=content=>`수신: ${to.value.trim() || '수신자 작성 대기'}\n참조: ${cc.value.trim() || '없음'}\n제목: ${subject.value.trim() || '제목 작성 대기'}${bodyMarker}${content}`;
  for(const field of [to,cc,subject])field.addEventListener('input',()=>{
    if(!body)return;
    const split=body.value.indexOf(bodyMarker);
    if(split>=0)body.value=withHeaders(body.value.slice(split+bodyMarker.length));
  });
  // Legacy summaries are not complete AI mail drafts.
  let completed=Boolean(!prepare && previous?.saved_by_user===true && ['to','cc','subject','body'].every(key=>typeof previous[key]==='string') &&
    (previous.completed===true || (previous.completed===undefined && previous.to.trim() && previous.body.includes(bodyMarker))));
  function saveDraft(){
    if(!itemKey || !body || !completed || button.disabled){status.textContent='메일 작성이 완료된 뒤 임시 저장을 눌러 주세요.';return false;}
    const record={completed:true,saved_by_user:true,context:draft,to:to.value,cc:cc.value,subject:subject.value,body:body.value,reason:reason.textContent,updated_at:new Date().toISOString()};
    try{
      // Merge with other inspections saved since this page opened.
      const current=JSON.parse(localStorage.getItem(storageKey) || 'null');
      if(current?.entries && typeof current.entries==='object' && !Array.isArray(current.entries))saved=current;
      saved.entries[itemKey]=record;saved.last=itemKey;
      localStorage.setItem(storageKey,JSON.stringify(saved));return true;
    }catch{status.textContent='메일 초안을 저장하지 못했습니다. 브라우저 저장 공간 설정을 확인해 주세요.';return false;}
  }
  const restored=completed;
  if(restored){
    to.value=previous.to;cc.value=previous.cc;subject.value=previous.subject;if(body)body.value=previous.body;
    reason.textContent=typeof previous.reason==='string'?previous.reason:'';
    status.textContent='임시 저장한 메일을 불러왔습니다. 수정 후 임시 저장을 다시 눌러 주세요.';
  }
  for(const field of [to,cc,subject,body].filter(Boolean))field.addEventListener('input',()=>{
    status.textContent='수정 중 · 내용을 보관하려면 임시 저장을 눌러 주세요.';
  });
  let controller=null,requestVersion=0;
  window.addEventListener('pagehide',()=>{
    ++requestVersion;controller?.abort();
    for(const field of [to,cc,subject,body].filter(Boolean))field.value='';
    reason.textContent='';
  });
  window.addEventListener('pageshow',event=>{
    if(!event.persisted)return;
    let record;
    try{record=JSON.parse(localStorage.getItem(storageKey) || 'null')?.entries?.[itemKey];}catch{}
    if(record?.saved_by_user){to.value=record.to;cc.value=record.cc;subject.value=record.subject;if(body)body.value=record.body;reason.textContent=record.reason || '';completed=true;status.textContent='임시 저장한 메일을 불러왔습니다.';}
    else{completed=false;status.textContent='저장하지 않은 메일은 삭제되었습니다. 보고서에서 발송 준비를 눌러 주세요.';}
    button.disabled=!item;[to,cc,subject,body].filter(Boolean).forEach(input=>input.readOnly=false);
  });
  document.getElementById('mail-save-draft')?.addEventListener('click',()=>{
    if(saveDraft())status.textContent='메일 초안을 저장했습니다.';
  });
  const undoButton=document.getElementById('mail-undo-delete');
  let deletedMail=null;
  const readSaved=()=>{
    const value=JSON.parse(localStorage.getItem(storageKey) || 'null');
    return value?.entries && typeof value.entries==='object' && !Array.isArray(value.entries) ? value : {entries:{},last:null};
  };
  document.getElementById('mail-delete')?.addEventListener('click',()=>{
    const snapshot={fields:[to,cc,subject,body].map(field=>field?.value || ''),reason:reason.textContent,completed,entries:[],last:null};
    try {
      const current=readSaved();snapshot.last=current.last;
      for(const [id,record] of Object.entries(current.entries)) {
        const old=record.context?.inspection;
        const legacy=old && item && !old.file_key && JSON.stringify([old.file_name || '',old.row,old.item_a,old.item_b,old.item_a_type,old.item_b_type,old.minimum_mm,old.measured_mm,old.source || ''])===JSON.stringify([item.file_name || '',item.row,item.item_a,item.item_b,item.item_a_type,item.item_b_type,item.minimum_mm,item.measured_mm,item.source || '']);
        if(id===itemKey || legacy) {snapshot.entries.push([id,record]);delete current.entries[id];}
      }
      if(!current.entries[current.last])current.last=Object.keys(current.entries).at(-1) || null;
      localStorage.setItem(storageKey,JSON.stringify(current));saved=current;
    } catch {status.textContent='저장된 메일을 삭제하지 못했습니다. 브라우저 저장 공간 설정을 확인해 주세요.';return;}
    ++requestVersion;controller?.abort();completed=false;
    for(const field of [to,cc,subject,body].filter(Boolean)){field.value='';field.readOnly=false;}
    reason.textContent='';button.disabled=!item;
    deletedMail=snapshot;if(undoButton)undoButton.hidden=false;
    status.textContent='현재 메일과 해당 임시 저장본을 삭제했습니다. 필요하면 삭제 취소를 누르세요.';
  });
  undoButton?.addEventListener('click',()=>{
    if(!deletedMail)return;
    try {
      const current=readSaved();
      for(const [id,record] of deletedMail.entries)current.entries[id]=record;
      if(deletedMail.entries.length)current.last=deletedMail.last;
      localStorage.setItem(storageKey,JSON.stringify(current));saved=current;
    } catch {status.textContent='메일을 복원하지 못했습니다. 브라우저 저장 공간 설정을 확인해 주세요.';return;}
    ++requestVersion;controller?.abort();
    [to,cc,subject,body].forEach((field,i)=>{if(field){field.value=deletedMail.fields[i];field.readOnly=false;}});
    reason.textContent=deletedMail.reason;completed=deletedMail.completed;button.disabled=!item;
    deletedMail=null;undoButton.hidden=true;status.textContent='삭제한 메일을 복원했습니다.';
  });
  const display=people=>people.map(p=>p.email?`[${p.system}] ${p.name} <${p.email}>`:`[${p.system}] ${p.name} (이메일 미등록)`).join('; ');
  const fields=document.getElementById('mail-contact-fields'),contactStatus=document.getElementById('mail-contact-status');
  async function loadDirectory(){
    const response=await fetch('/api/mail/contacts');const data=await response.json();
    if(!response.ok)throw new Error(data.detail || '담당자 목록 조회 실패');
    fields.replaceChildren();
    for(const entry of data.contacts){
      const box=document.createElement('div');box.dataset.system=entry.system;box.className='flex flex-col gap-1';
      const title=document.createElement('span');title.textContent=entry.system;title.className='text-xs text-outline';box.append(title);
      for(const key of ['name','email']){const input=document.createElement('input');input.dataset.field=key;input.type=key==='email'?'email':'text';input.value=entry[key] || '';input.placeholder=key==='name'?'담당자 이름':'이메일 주소';input.setAttribute('aria-label',entry.system+' '+(key==='name'?'담당자 이름':'이메일'));input.className='rounded bg-surface-container-lowest px-2 py-1.5 text-xs text-on-surface';box.append(input);}
      fields.append(box);
    }
  }
  document.getElementById('mail-save-contacts').addEventListener('click',async()=>{
    const entries=[...fields.children].map(box=>({system:box.dataset.system,name:box.querySelector('[data-field="name"]').value,email:box.querySelector('[data-field="email"]').value}));
    try{const response=await fetch('/api/mail/contacts',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({contacts:entries})});const data=await response.json();if(!response.ok)throw new Error(data.detail || '담당자 저장 실패');contactStatus.textContent='계통별 담당자를 저장했습니다. AI 선택을 다시 실행해 주세요.';}
    catch(error){contactStatus.textContent=error.message;}
  });
  async function selectRecipients(){
    const version=++requestVersion;controller?.abort();controller=new AbortController();
    button.disabled=true;[to,cc,subject,body].filter(Boolean).forEach(input=>input.readOnly=true);status.textContent='LM Studio가 검사 보고서를 바탕으로 수신·참조·제목과 메일 본문을 작성하고 있습니다…';reason.textContent='';
    try{
      const response=await fetch('/api/ai/mail-routing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...item,report_body:draft.analysis?.report?.body || '',risk:draft.analysis?.risk?.level || 'UNKNOWN'}),signal:controller.signal});
      const data=await response.json();if(version!==requestVersion)return;if(!response.ok)throw new Error(data.detail || '수신자 선택에 실패했습니다.');
      if(!Array.isArray(data.to) || !data.to.length || !Array.isArray(data.cc))throw new Error('수신자 응답을 확인할 수 없습니다.');
      if(typeof data.body!=='string' || !data.body.trim())throw new Error('AI 메일 본문을 확인할 수 없습니다. 다시 작성해 주세요.');
      to.value=display(data.to);cc.value=display(data.cc);subject.value=data.subject;if(body)body.value=withHeaders(data.body);
      reason.textContent='AI 선택 이유: '+data.reason;
      status.textContent='AI 메일 초안 작성 완료 · 수신·참조·제목·본문'+(data.to.concat(data.cc).some(p=>!p.email)?' · 담당자 이메일을 추가해 주세요.':' · 보관하려면 임시 저장을 눌러 주세요.');
      completed=true;
    }catch(error){if(error.name!=='AbortError' && version===requestVersion)status.textContent=error.message;}
    finally{if(version===requestVersion){button.disabled=false;[to,cc,subject,body].filter(Boolean).forEach(input=>input.readOnly=false);}}
  }
  button.addEventListener('click',selectRecipients);
  loadDirectory().then(()=>{if(item && prepare)selectRecipients();else if(item && !restored)status.textContent='보고서의 발송 준비 버튼을 누르면 AI가 메일을 작성합니다. 임시 저장한 메일은 없습니다.';}).catch(error=>{status.textContent=error.message;});
})();
