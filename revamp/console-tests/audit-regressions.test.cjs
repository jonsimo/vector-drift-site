'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../console-engine.js');
const fresh=()=>E.createSession({rng:()=>.5});
const run=(input,s=fresh(),ctx={})=>E.execute(input,s,{section:'root',...ctx});
const text=r=>r.lines.join('\n');

test('novice assistance asks are guidance rather than invalid command arguments',()=>{
 for(const input of ['help me','what commands can I use','what can I type?','please help me']){
  const r=run(input);assert.doesNotMatch(text(r),/Unknown category|UNRESOLVED|Did you mean/);assert.ok(r.suggestions.includes('Show me the game'));
 }
});
test('controls requests return the actual console controls',()=>{
 for(const input of ['show me the controls','Can you show me the console controls?']){
  const r=run(input);assert.match(text(r),/Ctrl\+C cancel/);assert.doesNotMatch(text(r),/glow|Did you mean/);
 }
});
test('release questions answer availability and own a valid updates follow-up',()=>{
 const s=fresh(),r=run('can you tell me when the demo comes out',s);
 assert.match(text(r),/No release date is confirmed/);assert.equal(s.followup.kind,'updates');
 assert.deepEqual(run('yes please',s).effects,[{type:'navigate',section:'email'}]);
});
test('ordinary frame selection reaches the same effects as its CLI equivalent',()=>{
 assert.deepEqual(run('show me frame 3').effects,run('frame 3').effects);
 assert.deepEqual(run('show me frame 99').effects,[]);
});
test('full sentences never receive unrelated single-word typo guesses',()=>{
 for(const input of ['what commands are possible around here','show me a banana','can you tell me something entirely unknown'])assert.doesNotMatch(text(run(input)),/Did you mean (?:cat|glow|man)/);
 assert.ok(run('scna').suggestions.includes('scan'));
});
test('stop ends the active flight and allows a clean new run',()=>{
 for(const stop of ['stop the game','stop','quit','exit','quit playing']){
  const s=fresh();run('simulate',s);run('collect',s);assert.match(text(run(stop,s)),/TRIAL ENDED/);assert.equal(s.flight,null);assert.equal(s.lastFlight.lux,2);
  run('simulate',s);assert.equal(s.flight.lux,0);assert.equal(s.flight.hull,5);
 }
});
test('fold and close-console retain a game while stop ends number games',()=>{
 const s=fresh();run('simulate',s);run('collect',s);
 for(const input of ['fold','close the console']){assert.deepEqual(run(input,s).effects,[{type:'collapse'}]);assert.equal(s.flight.lux,2);}
 run('stop',s);run('guess',s);assert.match(text(run('stop the game',s)),/NUMBER GAME ENDED/);assert.equal(s.guess,null);
});
test('rock paper scissors buttons are standalone commands across unrelated turns',()=>{
 const s=fresh(),r=run('rps',s);assert.deepEqual(r.suggestions,['rps rock','rps paper','rps scissors']);
 run('echo ready',s);assert.match(text(run(r.suggestions[0],s)),/YOU: rock/);
});
test('starting another sustained game does not silently abandon an active one',()=>{
 const s=fresh();run('simulate',s);run('guess',s);assert.equal(s.guess,null);assert.ok(s.flight);
 run('stop',s);run('guess',s);run('simulate',s);assert.ok(s.guess);assert.equal(s.flight,null);
});
