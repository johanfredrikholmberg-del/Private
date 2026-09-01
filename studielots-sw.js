const STUDIELOTS_PATCH='2026-09-01-v611';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
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
});
