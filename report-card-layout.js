(() => {
  const imageCard=document.getElementById('report-inspection-image-card');
  const tableCard=document.getElementById('report-inspection-table-card');
  const image=document.getElementById('report-inspection-overview');
  if(!imageCard || !tableCard || !image)return;
  const sideBySide=window.matchMedia('(min-width: 768px)');
  function alignCards() {
    tableCard.style.height=sideBySide.matches && !document.getElementById('report-inspection-overview-figure')?.hidden && image.complete && image.naturalWidth>0
      ? `${imageCard.getBoundingClientRect().height}px` : '';
  }
  new ResizeObserver(alignCards).observe(imageCard);
  image.addEventListener('load',alignCards);
  image.addEventListener('error',()=>{tableCard.style.height='';});
  sideBySide.addEventListener('change',alignCards);
  alignCards();
})();
