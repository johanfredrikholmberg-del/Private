(()=>{'use strict';
const root=window.StudieLotsV2=window.StudieLotsV2||{};
const savedStartTerm=(()=>{try{const value=localStorage.getItem('studielots_v2_start_term');return /^(HT|VT)\d{2}$/.test(value||'')?value:'HT26'}catch{return'HT26'}})();
const state={page:'home',route:'ordinary',source:'ladok',courses:[],selectedOpportunity:null,plannerData:null,selectedUniversity:'',opportunityLevel:'Grundnivå',startTerm:savedStartTerm};
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)],fmt=n=>Number(n||0).toLocaleString('sv-SE',{maximumFractionDigits:1});
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
function programmeLevel(p){const shared=root.programs?.levelOf;if(shared)return shared(p);return /master|magister|avancerad|second cycle/i.test(`${p?.level||''} ${p?.programName||''}`)?'Avancerad nivå':'Grundnivå'}
root.appContext={state,q,qa,fmt,esc,programmeLevel};
})();