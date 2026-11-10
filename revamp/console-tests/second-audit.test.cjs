'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../console-engine.js');
const R=require('../route-state.js');
const fresh=()=>E.createSession({rng:()=>.5});
const run=(input,s=fresh(),ctx={})=>E.execute(input,s,{section:'root',...ctx});
const text=r=>r.lines.join('\n');
const snapshot=s=>JSON.stringify({flight:s.flight,guess:s.guess,counts:s.counts,scan:s.scanCount,followup:s.followup});

// A. wrong-game routing ------------------------------------------------------
test('play snake, politely or not, reaches snake and never the flight trial',()=>{
 for(const input of ['snake','run snake.exe','play snake','play snake please','Play Snake, please!','can you play snake','i want to play snake please']){
  const s=fresh(),r=run(input,s);
  assert.deepEqual(r.effects,[{type:'program',name:'snake'}],input);assert.equal(s.flight,null,input);
 }
});
test('commands without arguments tolerate only polite filler',()=>{
 for(const input of ['scan please','scan now','status thanks','simulate again']){const r=run(input);assert.doesNotMatch(text(r),/UNRESOLVED|PLAY WHAT/,input);}
 for(const c of E.COMMANDS.filter(c=>c.usage===c.id&&!['clear','exit','fold','cancel','lux'].includes(c.id))){ // lux: a mention of the word anywhere is answered by design (read-only lore line)
  const a=fresh(),b=fresh();a.scanCount=b.scanCount=1;
  const bare=run(c.id,a),tail=run(`${c.id} zzqx`,b);
  assert.ok(text(tail)!==text(bare)||JSON.stringify(tail.effects)!==JSON.stringify(bare.effects),`${c.id} ran despite an unsupported argument`);
  assert.deepEqual(tail.effects,[],c.id);
 }
});
test('literal CLI payloads keep their exact text, politeness included',()=>{
 assert.equal(text(run('echo please do not change this')),'please do not change this');
 assert.equal(text(run('echo Thanks, PLEASE!')),'Thanks, PLEASE!');
 assert.match(text(run('rot13 hello please')),/uryyb cyrnfr/);
 assert.match(text(run('ls ..',fresh(),{section:'media'})),/readme\.txt/);
});

// D. console guide -----------------------------------------------------------
test('the console guide is reachable in both input styles with the same effect',()=>{
 const guide=[{type:'navigate',section:'reference',view:'guide'}];
 for(const input of ['guide','console guide','open guide','open reference','cd guide','open the console guide','show me the command guide','Can you open the console guide?','take me to the guide'])assert.deepEqual(run(input).effects,guide,input);
 assert.ok(E.COMMANDS.some(c=>c.id==='guide'));
});

// E. cancellation --------------------------------------------------------------
test('cancel drops a pending question without opening signup',()=>{
 const s=fresh();run('download',s);assert.equal(s.followup.kind,'updates');
 const r=run('cancel',s);assert.deepEqual(r.effects,[]);assert.equal(s.followup,null);assert.match(text(r),/CANCELLED/);
 const yes=run('yes please',s);assert.deepEqual(yes.effects,[]);assert.doesNotMatch(text(yes),/signup/i);
});
test('cancel inside a program closes it; idle cancel changes nothing',()=>{
 assert.deepEqual(run('cancel',fresh(),{section:'snake'}).effects,[{type:'navigate',section:'root'}]);
 const s=fresh(),before=snapshot(s),r=run('cancel',s);assert.match(text(r),/NOTHING TO CANCEL/);assert.deepEqual(r.effects,[]);assert.equal(snapshot(s).replace(/"counts":\{[^}]*\},?/,''),before.replace(/"counts":\{[^}]*\},?/,''));
 assert.equal(s.discoveries.length,0);
});

// B. route and response identity ----------------------------------------------
const SECTIONS=['root','about','media','devlog','links','download','discord','email','reference'];
test('every stored response keeps its own identity, order and return context',()=>{
 const store=R.createReaderStore({tag:'t1'});
 const help=store.add({title:'help all',lines:['H1','H2'],from:'about'});
 const status=store.add({title:'status',lines:['S1'],from:'root'});
 assert.notEqual(help,status);
 assert.deepEqual([...store.get(help).lines],['H1','H2']);assert.equal(store.get(help).from,'about');
 assert.equal(store.get(status).title,'status');
 assert.throws(()=>{'use strict';store.get(help).title='x';});
});
test('help to home to status then back twice resolves to the original help record',()=>{
 const store=R.createReaderStore({tag:'t2'});
 const history=[{section:'root',reader:null}];
 const visit=route=>history.push(route);
 const helpId=store.add({title:'help all',lines:['HELP'],from:'root'});visit({section:'reference',reader:helpId});
 visit({section:'root',reader:null});
 const statusId=store.add({title:'status',lines:['STATUS'],from:'root'});visit({section:'reference',reader:statusId});
 const at=i=>{const r=R.resolveRoute(R.parseHash('#'+R.routeHash(history[i]),SECTIONS),store);return r.route.reader&&store.get(r.route.reader).title;};
 assert.equal(at(3),'status');assert.equal(at(1),'help all');assert.equal(at(0),null);assert.equal(at(3),'status');
 assert.notEqual(R.routeKey(history[1]),R.routeKey(history[3]));
});
test('a reloaded or evicted response URL degrades to the guide with a notice',()=>{
 const before=R.createReaderStore({tag:'aaaa'});const id=before.add({title:'help all',lines:['x']});
 const after=R.createReaderStore({tag:'bbbb'});after.add({title:'status',lines:['y']});
 const r=R.resolveRoute(R.parseHash('#reference/'+id,SECTIONS),after);
 assert.deepEqual(r.route,{section:'reference',reader:null});assert.equal(r.notice,R.MISSING);
 const small=R.createReaderStore({tag:'cccc',limit:2});const first=small.add({title:'a',lines:[]});small.add({title:'b',lines:[]});small.add({title:'c',lines:[]});
 assert.equal(small.has(first),false);assert.equal(small.size,2);
 assert.equal(R.resolveRoute({section:'reference',reader:first},small).notice,R.MISSING);
 assert.equal(R.resolveRoute({section:'reference',reader:null},small).notice,'');
});
test('route parsing falls back safely and tells the guide from a response',()=>{
 assert.deepEqual(R.parseHash('#nonsense',SECTIONS),{section:'root',reader:null});
 assert.deepEqual(R.parseHash('#reference',SECTIONS),{section:'reference',reader:null});
 assert.deepEqual(R.parseHash('#reference/ab12-3',SECTIONS),{section:'reference',reader:'ab12-3'});
 assert.deepEqual(R.parseHash('#snake',SECTIONS),{section:'snake',reader:null});
 assert.notEqual(R.routeKey({section:'reference',reader:null}),R.routeKey({section:'reference',reader:'ab12-3'}));
});

// Media: framegrabs only, no trailer
test('trailer wording says there is no trailer and opens frame 1 of the framegrabs',()=>{
 for(const input of ['trailer','show me the trailer','watch the video']){
  const r=run(input);assert.match(text(r),/NO TRAILER YET/,input);
  assert.deepEqual(r.effects,[{type:'navigate',section:'media'},{type:'frame',number:1}],input);
 }
 assert.doesNotMatch(text(run('ls media/',fresh(),{section:'media'})),/trailer|\.vid/);
 assert.match(text(run('ls',fresh(),{section:'media'})),/frame_06\.jpg/);
});
