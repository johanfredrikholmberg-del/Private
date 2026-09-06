(()=>{
'use strict';
const VERSION='712';
function ensureUniversityDetail(){
  if(document.getElementById('universityDetail'))return true;
  const main=document.querySelector('main.main');
  if(!main)return false;
  const section=document.createElement('section');
  section.id='universityDetail';
  section.className='screen';
  section.innerHTML='<div id="universityDetailContent"></div>';
  const degree=document.getElementById('degreeDetail');
  if(degree&&degree.parentNode===main)degree.insertAdjacentElement('afterend',section);else main.appendChild(section);
  return true;
}
function install(){ensureUniversityDetail();window.__studielotsBuild={...(window.__studielotsBuild||{}),screenRepair:VERSION,universityDetailRestored:true}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
