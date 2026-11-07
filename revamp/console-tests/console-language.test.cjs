'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../console-engine.js');
const L=require('../console-language.js');
const session=()=>E.createSession({rng:()=>.5,now:1000});
const run=(input,s=session(),context={})=>E.execute(input,s,{section:'root',now:2000,...context});
const text=r=>r.lines.join('\n');

test('plain language, CLI and run-dialogue navigation share the same effects',()=>{
 for(const [command,phrases] of [
  ['open media',['Show me the game','Could u show me some pictures please?','Can I see the screenshots?','run media.exe','start media']],
  ['trailer',['show me the trailer','I want to watch the video']],
  ['email',['Keep me updated','please sign me up','run email.exe']],
  ['snake',['play snake','Could you please play snake?','run snake.exe']],
 ])for(const phrase of phrases)assert.deepEqual(run(phrase).effects,run(command).effects,phrase);
});
test('canonical interpretation executes once and preserves the original history and echo',()=>{
 const s=session(),r=run('Could you show me the game?',s);
 assert.equal(r.echo,'Could you show me the game?');assert.deepEqual(s.history,['Could you show me the game?']);assert.equal(s.totalCommands,1);assert.equal(s.counts.media,1);
});
test('ambiguous play request asks before choosing the full game or a console game',()=>{
 const s=session();assert.deepEqual(run('I want to play',s).effects,[]);assert.equal(s.flight,null);
 assert.match(text(run('yes',s)),/Which one/);assert.equal(s.flight,null);
 assert.deepEqual(run('Something here',s).suggestions,L.GAMES);
 assert.deepEqual(run('Play snake',s).effects,[{type:'program',name:'snake'}]);
 const other=session();run('I want to play',other);assert.match(text(run('Vector Drift',other)),/NOT YET AVAILABLE/);
});
test('yes opens the signup view only after the updates question',()=>{
 for(const wording of ['Can I play?','download','run download.exe']){
  const s=session();const held=run(wording,s);assert.deepEqual(held.effects,[]);assert.match(text(held),/Want email updates/);
  assert.deepEqual(run('yes please',s).effects,[{type:'navigate',section:'email'}]);
  assert.equal(s.followup,null);assert.deepEqual(run('yes',s).effects,[]);
 }
});
test('no dismisses the question and unrelated commands invalidate pending confirmations',()=>{
 const s=session();run('download',s);assert.deepEqual(run('No thanks',s).effects,[]);assert.equal(s.followup,null);
 run('download',s);run('ls -la',s);assert.deepEqual(run('yes',s).effects,[]);
 run('download',s);run('password=hunter2',s);assert.equal(s.followup,null);
});
test('bare number is a guess only during a started number game',()=>{
 const s=session();assert.equal(text(run('11',s)),'= 11');run('Guess a number',s);assert.match(text(run('maybe 4',s)),/HIGHER/);assert.equal(s.guess.attempts,1);
 run('guess 900',s);assert.equal(s.guess.attempts,1);assert.match(text(run('11',s)),/LOCK OPEN/);assert.equal(s.guess,null);
});
test('rock paper scissors accepts both full syntax and context-only replies',()=>{
 const s=session();assert.match(text(run('Rock paper scissors',s)),/Reply with your choice/);
 assert.match(text(run('rock',s)),/YOU: rock/);assert.match(text(run('rps paper',s)),/YOU: paper/);
 run('help all',s);assert.doesNotMatch(text(run('scissors',s)),/YOU: scissors/);
});
test('conversational exploration and technical exploration reach identical discoveries',()=>{
 const a=session(),b=session();
 for(const input of ['Look around','follow it','what does it say?'])run(input,a);
 for(const input of ['scan','trace 1187','cat /root/archive/1187.log'])run(input,b);
 assert.deepEqual(a.discoveries,b.discoveries);assert.deepEqual(a.discoveries,['signal','1187.log']);assert.equal(a.traced,true);
 assert.match(text(run('what have I found?',a)),/1187.log/);
});
test('contextual more advances exploration while unbound read-it asks which file',()=>{
 const s=session();assert.match(text(run('read it',s)),/Which file/);assert.equal(s.scanCount,0);
 run('scan',s);run('tell me more',s);assert.equal(s.traced,true);run('more',s);assert.ok(s.discoveries.includes('1187.log'));
});
test('next picture respects the currently selected UI frame, with wraparound',()=>{
 const s=session();assert.deepEqual(run('next picture',s).effects,[]);
 assert.deepEqual(run('next picture',s,{section:'media',frame:6}).effects,[{type:'navigate',section:'media'},{type:'frame',number:1}]);
 assert.equal(run('show me another picture',s,{section:'media',frame:3}).effects[1].number,4);
 run('frame 5',s);assert.equal(run('next one',s).effects[1].number,6);
});
test('flight conversation mutates the same game state as technical commands',()=>{
 const a=session(),b=session();
 for(const input of ['Fly a practice run','shoot them','play it safe','grab the loot'])run(input,a);
 for(const input of ['simulate','fire','evade','collect'])run(input,b);
 assert.deepEqual(a.flight,b.flight);run('I am done',a);run('dock',b);assert.equal(a.flight,null);assert.deepEqual(a.lastFlight,b.lastFlight);
});
test('conversation does not reinterpret literal CLI arguments',()=>{
 assert.equal(text(run('echo yes')),'yes');assert.equal(text(run('rot13 Keep me updated')),'ROT13: Xrrc zr hcqngrq');
 assert.match(text(run('cat controls.txt')),/CONSOLE CONTROLS/);assert.match(text(run('ls ..',session(),{section:'media'})),/readme.txt/);
 assert.match(text(run('man open')),/open <file\|section>/);assert.equal(run('help all').lines.length,E.COMMANDS.length);
});
test('polite input cannot turn command chains or private data into ordinary history',()=>{
 const s=session();assert.deepEqual(run('please show me media; run snake.exe',s).effects,[]);
 const privateResult=run('Please sign up pilot@example.invalid',s);assert.equal(privateResult.echo,'[PRIVATE INPUT OMITTED]');assert.equal(s.history.length,1);
});
test('starter guidance offers clickable plain language without requiring syntax',()=>{
 for(const input of ['hi','I am lost','what can I do?']){const r=run(input);assert.deepEqual(r.suggestions,L.START);assert.deepEqual(r.effects,[]);}
 for(const choice of L.START)assert.doesNotMatch(text(run(choice)),/UNRESOLVED|No matching instruction/);
});

test('a file pronoun does not resume an old exploration after unrelated commands',()=>{
 const s=session();run('scan',s);run('cat controls.txt',s);assert.match(text(run('read it',s)),/Which file/);assert.equal(s.traced,false);
});
