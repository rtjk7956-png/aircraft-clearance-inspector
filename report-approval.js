(() => {
  const button=document.getElementById('report-qa-approve');
  const status=document.getElementById('report-qa-approval-status');
  const note=document.getElementById('report-qa-approval-note');
  if(!button || !status)return;
  button.addEventListener('click',()=>{
    status.textContent='승인 완료';
    status.className='px-1 py-0.5 rounded bg-secondary-container/40 text-secondary font-label-sm text-label-sm';
    if(note)note.textContent='승인 완료';
    button.textContent='승인 완료';
    button.disabled=true;
    button.classList.add('opacity-60','cursor-default');
  });
  document.addEventListener('report-failure-selected',()=>{
    status.textContent='승인 대기중';
    status.className='px-1 py-0.5 rounded bg-tertiary-container/30 text-tertiary font-label-sm text-label-sm';
    if(note)note.textContent='Pending Approval';
    button.textContent='즉시 승인';button.disabled=false;
    button.classList.remove('opacity-60','cursor-default');
  });
})();
