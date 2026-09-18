(()=>{'use strict';
const style=document.createElement('style');style.textContent=`
#planner .course{border:1px solid #e0e9e8;border-radius:22px;background:#fff;padding:18px 20px;margin:10px 0;box-shadow:0 2px 12px rgba(14,54,48,.025)}
#planner .course .course-main{gap:12px}#planner .course .match-note{display:block;margin-top:9px;color:#667775;font-weight:500}#planner .course .match-note b{font-weight:750}
#planner .course .status{display:inline-flex;align-items:center;max-width:100%;width:max-content;border-radius:14px;padding:8px 12px;margin-top:10px;font-weight:750;font-size:.92rem;line-height:1.35;border:0;background:#e2f7ec;color:#116344}
#planner .course .status[data-evidence="strong"]{background:#dff6e9;color:#116344}
#planner .course .status[data-evidence="relevant"]{background:#fff1d5;color:#805817}
#planner .course .status[data-evidence="limited"]{background:#ffe5e8;color:#a31e35}
#planner .course .status[data-evidence="none"]{background:#edf2f1;color:#546562}
#ordinaryPlan .evidence-details{display:none!important}
#fastPlan .evidence-details{margin-top:12px;padding:12px 0 0;border-top:1px solid #e5eeeb;color:#24483f}#fastPlan .evidence-details summary{cursor:pointer;font-weight:700}#fastPlan .evidence-details li{margin:8px 0}#fastPlan .evidence-details small{display:block;margin-top:10px;color:#60716c}
`;document.head.appendChild(style);
const labels={strong:'✓ Starkt underlag',relevant:'− Relevant underlag',limited:'× Begränsat underlag'};
function update(){document.querySelectorAll('#planner .course').forEach(card=>{const note=card.querySelector('.match-note b'),status=card.querySelector('.status');if(!status)return;const noteText=(note?.textContent||'').toLowerCase(),statusText=(status.textContent||'').toLowerCase();let level=noteText.includes('begränsat')||statusText.includes('begränsat')?'limited':noteText.includes('relevant')||statusText.includes('relevant')?'relevant':noteText.includes('starkt')||statusText.includes('starkt')?'strong':null;
if(!level&&statusText.includes('matchad merit')){status.dataset.evidence='none';status.textContent='✓ Matchad merit';return}
if(!level)return;status.dataset.evidence=level;status.textContent=labels[level];if(note){note.textContent='';note.parentElement?.removeAttribute('hidden')}const detail=card.querySelector('.match-note');if(detail){const text=detail.textContent.replace(/^\s*[·•]\s*/,'').trim();if(!text)detail.remove();else detail.textContent=text} });}
let scheduled=false;const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;observer.disconnect();update();observer.observe(document.querySelector('#planner')||document.body,{childList:true,subtree:true})})});observer.observe(document.querySelector('#planner')||document.body,{childList:true,subtree:true});update();
})();