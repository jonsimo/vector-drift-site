/* Pure route and response-record state for the preview. No DOM: sections.js owns
   rendering, this owns identity. A route is a section plus, for a full console
   response, the id of an immutable record. Ids carry a per-page-load tag, so a
   reloaded or shared #reference/<id> URL can never resolve to a newer answer. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.VDRouteState=api;})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const MISSING='THAT RESPONSE IS NO LONGER AVAILABLE. SHOWING THE CONSOLE GUIDE.';
  const PROGRAMS=['snake','pi','ost'];
  function parseHash(hash,sections){
    const name=String(hash||'').replace(/^#/,'');
    if(name.startsWith('reference/'))return {section:'reference',reader:name.slice(10)||null};
    return {section:sections.includes(name)||PROGRAMS.includes(name)?name:'root',reader:null};
  }
  const routeKey=route=>route.section+(route.reader?'/'+route.reader:'');
  const routeHash=route=>route.section+(route.reader?'/'+route.reader:'');
  function createReaderStore({tag=Math.random().toString(36).slice(2,6),limit=24}={}){
    const records=new Map();let count=0;
    return {
      tag,
      add({title,lines,from}){
        const id=`${tag}-${++count}`;
        records.set(id,Object.freeze({title:title||'CONSOLE RESPONSE',lines:Object.freeze([...lines]),from:from||'root'}));
        if(records.size>limit)records.delete(records.keys().next().value);
        return id;
      },
      get:id=>records.get(id)||null,
      has:id=>records.has(id),
      get size(){return records.size;},
    };
  }
  // Turn a requested route into one that can actually be shown. An unknown
  // response id degrades to the console guide with an explanation.
  function resolveRoute(route,store){
    if(route.section==='reference'&&route.reader&&!store.has(route.reader))return {route:{section:'reference',reader:null},notice:MISSING};
    return {route:{section:route.section,reader:route.reader||null},notice:''};
  }
  return {MISSING,parseHash,routeKey,routeHash,createReaderStore,resolveRoute};
});
