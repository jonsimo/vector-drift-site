'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../console-engine.js');
const V=require('../../terminal-intents.js');
const session=()=>E.createSession({rng:V.makeRng(42),now:1000});
const text=r=>r.lines.join('\n');
const run=(input,s=session(),ctx={section:'media',now:11000})=>E.execute(input,s,ctx);
const recover=s=>['scan','trace 1187','cat /root/archive/1187.log'].map(x=>run(x,s));

test('old natural-language vocabulary remains recognized, all 143 aliases',()=>{
 for(const group of V.INTENTS)for(const alias of group.aliases){const r=run(alias);assert.ok(r.lines.length||r.effects.length,alias);assert.doesNotMatch(text(r),/^UNRESOLVED:/,alias);}
});
test('catalog has unique command names and aliases',()=>{
 const aliases=[];for(const c of E.COMMANDS){assert.ok(c.usage&&c.description&&c.category);aliases.push(...c.aliases);}
 assert.equal(new Set(aliases).size,aliases.length);
});
test('every command family produces a response with its documented arguments',()=>{
 const inputs={man:'man scan',apropos:'apropos game',cd:'cd about',open:'open media',cat:'cat readme.txt',find:'find readme',frame:'frame 2',reset:'reset confirm',green:'green 1',glow:'glow tight',motion:'motion reduce',trace:'trace 1187',decode:'decode uryyb',dossier:'dossier axiom',rps:'rps rock',roll:'roll 2d6',calc:'calc 2+2',rot13:'rot13 hello',binary:'binary hello',hex:'hex hello',upgrade:'upgrade shield'};
 for(const c of E.COMMANDS){const r=run(inputs[c.id]||c.id);assert.ok(r.lines.length||r.effects.length,c.id);}
});
test('download allowlist remains held and never yields a transfer effect',()=>{
 for(const input of ['download','./DOWNLOAD.EXE!!','get the game','please download','run download.exe','install','download beta','download the alpha']){const r=run(input);assert.match(text(r),/NOT YET AVAILABLE/);assert.deepEqual(r.effects,[],input);}
});
test('download typos do not navigate or transfer',()=>{
 for(const input of ['downloader','download.exe.exe','downlod','run downlod','please download everything']){const r=run(input);assert.ok(!r.effects.some(e=>e.type==='download'||e.section==='download'),input);}
});
test('private addresses are neither echoed nor retained, including prefixed signup',()=>{
 for(const input of ['pilot@example.invalid','email pilot@example.invalid','subscribe pilot@example.invalid','broken@']){const s=session(),r=run(input,s);assert.equal(r.echo,'[PRIVATE INPUT OMITTED]');assert.equal(s.history.length,0);assert.ok(!JSON.stringify(r).includes(input));assert.deepEqual(r.effects,[{type:'navigate',section:'email'}]);}
});
test('keys/tokens are omitted and never open an access flow',()=>{
 for(const input of ['download key ABC-123','password=secretvalue','token:secretvalue','key abc']){const s=session(),r=run(input,s);assert.equal(r.echo,'[PRIVATE INPUT OMITTED]');assert.equal(s.history.length,0);assert.deepEqual(r.effects,[]);}
});
test('normalization accepts case, punctuation, and existing executable aliases',()=>{
 assert.equal(run('  ./MeDiA.ExE!!  ').effects[0].section,'media');
 assert.equal(run('Who are you?').lines.length>0,true);
});
test('natural-language navigation opens actual site sections',()=>{
 for(const input of ['show screenshots','can you show the media page','please open the about page','take me to discord'])assert.equal(run(input).effects[0].type,'navigate');
});
test('common free-form topics get relevant answers without inventing actions',()=>{
 for(const input of ['how are you','are you a chatbot','tell me a secret','how can I download the game','can I play on Linux','let me play a game']){
  const response=run(input);assert.ok(response.lines.length,input);assert.deepEqual(response.effects,[],input);assert.doesNotMatch(text(response),/^UNRESOLVED:/,input);
 }
});
test('virtual files cannot access local/system paths',()=>{
 for(const path of ['/etc/passwd','../../../../etc/passwd','/Users/jonsimo/.ssh/id_rsa','constructor','__proto__'])assert.match(text(run('cat '+path)),/FILE NOT FOUND/);
});
test('directory listings respect the current media path, parent path and common flags',()=>{
 assert.match(text(run('ls -la')),/frame_01\.jpg/);
 assert.match(text(run('ls ..')),/readme\.txt/);
 assert.match(text(run('ls -lh /root')),/controls\.txt/);
});
test('prototype property names cannot be interpreted as command objects',()=>{
 for(const input of ['constructor','man constructor','help __proto__','open constructor','dossier __proto__','open toString'])assert.doesNotThrow(()=>run(input));
});
test('unknown input always responds, gives usable suggestions, and does not execute them',()=>{
 const s=session(),a=run('blorp',s),b=run('another unfamiliar thing',s);
 assert.ok(a.lines.length&&a.suggestions.length);assert.notEqual(a.lines[0],b.lines[0]);assert.deepEqual(a.effects,[]);assert.equal(s.scanCount,0);
});
test('misspellings suggest commands without changing progress',()=>{
 const s=session(),r=run('scna',s);assert.ok(r.suggestions.includes('scan'));assert.equal(s.scanCount,0);assert.deepEqual(r.effects,[]);
});
test('arbitrary input and shell chains are data, not executable code',()=>{
 for(const input of ['<img src=x onerror=alert(1)>','rm -rf /','media; download.exe','$(whoami)','eval(1+1)'])assert.deepEqual(run(input).effects,[],input);
 assert.match(text(run('rm -rf /')),/Nothing was deleted/);
});
test('unknown words cannot reveal named factions',()=>{
 const s=session();for(const input of ['blorp','random text','hello','why','who are you'])assert.doesNotMatch(text(run(input,s)),/AXIOM|XENOPHAGE|VARRAX|AURALIS|NETHYR/);
});
test('repeated scans give progress-aware next steps',()=>{
 const s=session();run('scan',s);assert.match(text(run('scan',s)),/Repeating the survey/);assert.equal(s.discoveries.length,1);assert.equal(s.scanCount,2);
});
test('archive recovery is ordered; generic decoding cannot unlock it',()=>{
 const s=session();assert.match(text(run('trace 1187',s)),/NO SIGNAL/);assert.match(text(run('cat /root/archive/1187.log',s)),/NOT MOUNTED/);
 assert.equal(text(run('decode uryyb',s)),'ROT13: hello');assert.deepEqual(s.discoveries,[]);
});
test('complete recovery echoes public boot clues without a late-game reveal',()=>{
 const s=session();recover(s);assert.deepEqual(s.discoveries,['signal','1187.log']);
 assert.match(text(run('mission',s)),/COMPLETE/);assert.match(text(run('cat /root/archive/1187.log',s)),/1187 samples indexed \/ 1 unassigned signature/);
 assert.match(text(run('cat /root/archive/lux.fragment',s)),/FILE NOT FOUND/);
});
test('re-reading records does not duplicate discoveries',()=>{
 const s=session();recover(s);recover(s);assert.equal(s.discoveries.length,2);
});
test('story progress and game state are isolated between sessions',()=>{
 const a=session(),b=session();recover(a);run('simulate',a);assert.deepEqual(b.discoveries,[]);assert.equal(b.flight,null);assert.equal(b.traced,false);
});
test('clear removes output via an effect without deleting progress',()=>{
 const s=session();recover(s);assert.deepEqual(run('clear',s).effects,[{type:'clear'}]);assert.ok(s.discoveries.includes('1187.log'));
});
test('reset needs an explicit confirm and clears the local session only',()=>{
 const s=session();recover(s);run('reset',s);assert.ok(s.discoveries.includes('1187.log'));run('reset confirm',s);assert.deepEqual(s.discoveries,[]);assert.equal(s.totalCommands,0);assert.deepEqual(s.history,[]);
});
test('history is bounded while total command count remains accurate',()=>{
 const s=session();for(let i=0;i<120;i++)run('echo '+i,s);assert.equal(s.history.length,80);assert.equal(s.totalCommands,120);assert.equal(s.history[0],'echo 40');
});
test('echo preserves case, spaces, and angle brackets as text',()=>{
 assert.equal(text(run('echo Hello  <pilot>')),'Hello  <pilot>');
});
test('calculator has real precedence, right-associative powers, and unary minus',()=>{
 for(const [expression,expected] of [['2+3*4',14],['(2+3)*4',20],['2^3^2',512],['-2^2',-4],['2^-2',.25],['3+-2',1],['.5*8',4]])assert.equal(E.calculate(expression),expected,expression);
 assert.equal(text(run('2+2')),'= 4');assert.equal(text(run('what is 2+2?')),'= 4');
});
test('calculator rejects code, incomplete syntax and non-finite results',()=>{
 for(const input of ['globalThis.process.exit()','1/0','1e9999','2*(3+','2 3'])assert.throws(()=>E.calculate(input),input);
 assert.match(text(run('calc 1/0')),/CALC:/);
});
test('Tab completion supports both command names and documented arguments',()=>{
 assert.deepEqual(E.complete('sc'),['scan']);assert.deepEqual(E.complete('help ga'),['help games']);assert.deepEqual(E.complete('frame 6'),['frame 6']);assert.ok(E.complete('dossier ').includes('dossier axiom'));assert.deepEqual(E.complete('no-such-prefix'),[]);
});
test('appearance commands validate their ranges and emit only known effects',()=>{
 assert.deepEqual(run('green 2').effects,[{type:'green',step:2}]);assert.deepEqual(run('green 200').effects,[]);assert.deepEqual(run('glow tight').effects,[{type:'glow',mode:'tight'}]);
});
test('number lock requires starting and validates guesses before consuming attempts',()=>{
 const s=session();assert.match(text(run('guess 5',s)),/Start a number/);run('guess',s);run('guess 900',s);assert.equal(s.guess.attempts,0);const secret=s.guess.secret;assert.match(text(run('guess '+secret,s)),/LOCK OPEN/);assert.equal(s.guess,null);
});
test('text trial has meaningful risk, spending, upgrades and a completion profile',()=>{
 const s=session();run('simulate',s);run('collect',s);run('collect',s);assert.equal(s.flight.lux,4);assert.equal(s.flight.hull,3);run('upgrade shield',s);assert.equal(s.flight.lux,1);assert.equal(s.flight.shield,2);run('dock',s);assert.equal(s.flight,null);assert.equal(s.lastFlight.greed,2);assert.match(text(run('profile',s)),/last trial actions/);
});
test('relaunch does not silently discard an active flight trial',()=>{
 const s=session();run('simulate',s);run('collect',s);run('launch',s);assert.equal(s.flight.lux,2);
});
test('dice limits and terminal toys remain bounded',()=>{
 assert.match(text(run('roll 1000d1000')),/1–6 dice/);assert.equal(run('stars').lines.length,7);assert.equal(text(run('hex Hi')),'48 69');assert.equal(text(run('binary A')),'01000001');
});
test('fortunes vary within a session',()=>{
 const s=session();assert.notEqual(text(run('fortune',s)),text(run('fortune',s)));
});
test('seeded games are reproducible',()=>{
 assert.equal(text(run('roll 6d20',session())),text(run('roll 6d20',session())));assert.equal(text(run('rps rock',session())),text(run('rps rock',session())));
});
test('invalid media requests never select a frame',()=>{
 assert.deepEqual(run('frame 7').effects,[]);assert.equal(run('frame 4').effects[1].number,4);
});
test('program launches are explicitly whitelisted and do not borrow parent input',()=>{
 for(const name of ['snake','pi'])assert.deepEqual(run(name).effects,[{type:'program',name}]);assert.equal(run('open javascript:alert(1)').effects.length,0);
});
test('exit stops an active program; otherwise it only folds the console',()=>{
 assert.deepEqual(run('exit',session(),{section:'snake'}).effects,[{type:'navigate',section:'root'}]);
 assert.deepEqual(run('stop',session(),{section:'pi'}).effects,[{type:'navigate',section:'root'}]);
 assert.deepEqual(run('exit').effects,[{type:'collapse'}]);
});
test('long input is bounded before any history/state mutation',()=>{
 const s=session();assert.match(text(run('a'.repeat(513),s)),/INPUT TOO LONG/);assert.equal(s.history.length,0);
});
