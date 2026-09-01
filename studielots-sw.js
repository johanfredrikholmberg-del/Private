const STUDIELOTS_PATCH='2026-09-01-p';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
const latestPatch='<script id="studielots-latest-patch-js" src="/studielots-v603.js?v=603"><\/script>';
self.addEventListener('fetch',event=>{
  const u=new URL(event.request.url);
  if(u.pathname==='/share-ladok'&&event.request.method==='POST'){
    event.respondWith((async()=>{
      try{
        const form=await event.request.formData(),file=form.get('ladokPdf');
        if(!file)return Response.redirect('/?studielots-share-error=1',303);
        const c=await caches.open('studielots-share-v1');
        await c.put('/__studielots_shared_pdf__',new Response(file,{headers:{'content-type':file.type||'application/pdf','x-studielots-filename':file.name||'Ladok-resultatintyg.pdf'}}));
        return Response.redirect('/?studielots-share=1',303);
      }catch(e){return Response.redirect('/?studielots-share-error=1',303)}
    })());
    return;
  }
  if(event.request.mode==='navigate'&&event.request.method==='GET'&&u.origin===self.location.origin){
    event.respondWith((async()=>{
      try{
        const response=await fetch(event.request,{cache:'no-store'}),type=response.headers.get('content-type')||'';
        if(!type.includes('text/html'))return response;
        let html=await response.text();
        html=html
          .replace(/<style id="studielots-latest-patch">[\s\S]*?<\/style>/g,'')
          .replace(/<script id="studielots-latest-patch-js"[\s\S]*?<\/script>/g,'')
          .replace('</body>',latestPatch+'\n</body>');
        const headers=new Headers(response.headers);
        headers.delete('content-length');
        headers.set('cache-control','no-store, max-age=0');
        headers.set('x-studielots-patch',STUDIELOTS_PATCH);
        return new Response(html,{status:response.status,statusText:response.statusText,headers});
      }catch(e){return fetch(event.request)}
    })());
  }
});