(()=>{'use strict';
const original=window.fetch.bind(window);
window.fetch=(input,init)=>{
  try{
    const raw=typeof input==='string'?input:input?.url;
    if(raw){const u=new URL(raw,location.href);if(u.pathname==='/api/susa-offerings'&&u.searchParams.get('type')==='course'&&u.searchParams.get('standaloneOnly')==='true'){u.pathname='/api/verified-offerings';return original(u.href,init)}}
  }catch(_){}
  return original(input,init);
};
})();
