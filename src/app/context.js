(()=>{'use strict';
const root=window.StudieLotsV2=window.StudieLotsV2||{};
const state={page:'home',route:'ordinary',source:'ladok',courses:[],selectedOpportunity:null,plannerData:null,selectedUniversity:'',opportunityLevel:'Grundnivå'};
const q=s=>document.querySelector(s);
const qa=s=>[...document.querySelectorAll(s)];
const fmt=n=>Number(n||0).toLocaleString('sv-SE',{maximumFractionDigits:1});
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
root.appContext=Object.freeze({state,q,qa,fmt,esc});
})();
