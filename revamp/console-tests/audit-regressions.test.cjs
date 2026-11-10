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
