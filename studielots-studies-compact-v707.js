(()=>{
'use strict';
const VERSION='707';
function addStyles(){
  if(document.getElementById('sl707-studies-style')) return;
  const s=document.createElement('style');
  s.id='sl707-studies-style';
  s.textContent=`
  #studies .top{gap:12px;align-items:flex-end;margin-bottom:12px}
  #studies .top h1{margin-bottom:3px}
  #studies .top p{margin-bottom:0}
  #studies .top>.primary{padding:11px 16px;min-height:44px;white-space:nowrap}
  #studies .import-guide{padding:16px!important;margin-bottom:12px!important;border-radius:20px}
  #studies .import-guide>strong{display:block;font-size:20px;line-height:1.15;margin-bottom:2px}
  #studies .import-choice-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px!important;margin:12px 0!important}
  #studies .import-choice{min-width:0!important;min-height:88px!important;padding:11px 9px!important;border-radius:15px!important;text-align:left!important;display:flex!important;flex-direction:column!important;justify-content:flex-start!important;gap:5px!important}
  #studies .import-choice b{font-size:14px!important;line-height:1.15!important}
  #studies .import-choice span{font-size:11.5px!important;line-height:1.25!important}
  #studies .import-choice .recommended{display:inline-block!important;font-size:9px!important;line-height:1!important;padding:4px 5px!important;margin:3px 0 0!important;white-space:nowrap}
  #studies .sl707-guide-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 8px}
  #studies .sl707-guide-actions>.primary,#studies .sl707-guide-actions>a.primary{margin:0!important;min-height:44px!important;padding:10px 9px!important;border-radius:12px!important;font-size:14px!important;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important}
  #studies details.sl707-steps{margin:7px 0 4px;border-top:1px solid rgba(15,65,58,.10);padding-top:5px}
  #studies details.sl707-steps summary{cursor:pointer;color:#176b5b;font-weight:700;font-size:13px;padding:6px 0;list-style:none}
  #studies details.sl707-steps summary::-webkit-details-marker{display:none}
  #studies details.sl707-steps summary:after{content:'›';float:right;font-size:18px;transform:rotate(90deg);transition:.15s}
  #studies details.sl707-steps[open] summary:after{transform:rotate(-90deg)}
  #studies details.sl707-steps ol{margin:8px 0 6px;padding-left:20px}
  #studies details.sl707-steps h3{font-size:15px!important;margin:7px 0 3px!important}
  #studies details.sl707-steps .muted{font-size:12px!important}
  #studies .missing-merits{margin-top:5px!important}
  #studies .v533-import-privacy{margin-top:10px!important;padding:10px!important}
  #studies .v533-import-privacy small{font-size:11px!important;line-height:1.25!important}
  #studies .v533-import-privacy button{font-size:11px!important}
  #studies .study-summary{margin-top:10px!important}
  @media(max-width:390px){
    #studies .top{display:block}
    #studies .top>.primary{width:100%;margin-top:10px}
    #studies .import-choice{padding:9px 7px!important;min-height:84px!important}
    #studies .import-choice b{font-size:13px!important}
    #studies .import-choice span{font-size:10.5px!important}
  }
  `;
  document.head.appendChild(s);
}
function wrapGuide(id,label){
  const guide=document.getElementById(id);
  if(!guide||guide.dataset.sl707==='1') return;
  guide.dataset.sl707='1';
  const link=guide.querySelector('a.primary');
  const action=guide.querySelector('.import-action');
  if(link&&action){
    const row=document.createElement('div');
    row.className='sl707-guide-actions';
    link.parentNode.insertBefore(row,link);
    row.appendChild(link);
    const upload=action.querySelector('button.primary');
    if(upload) row.appendChild(upload);
    action.style.display='none';
  }
  const ol=guide.querySelector('ol.small');
  if(ol&&!ol.closest('.sl707-steps')){
    const details=document.createElement('details');
    details.className='sl707-steps';
    const summary=document.createElement('summary');
    summary.textContent=label||'Så gör du';
    details.appendChild(summary);
    const h3=guide.querySelector('h3');
    const note=h3?.nextElementSibling?.classList?.contains('muted')?h3.nextElementSibling:null;
    if(h3) details.appendChild(h3);
    if(note) details.appendChild(note);
    ol.parentNode.insertBefore(details,ol);
    details.appendChild(ol);
  }
}
function compact(){
  addStyles();
  const box=document.getElementById('importBox');
  if(!box) return;
  box.classList.add('sl707-compact');
  wrapGuide('ladokGuide','Så hämtar du intyget');
  wrapGuide('antagningGuide','Så hämtar du PDF');
  window.__studielotsBuild={...(window.__studielotsBuild||{}),studiesCompact:VERSION};
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',compact,{once:true}); else compact();
window.addEventListener('studielots:screen-rendered',compact);
})();
