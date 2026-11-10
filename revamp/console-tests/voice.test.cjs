'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const V=require('../console-voice.js'),E=require('../console-engine.js');
const run=(q,s=E.createSession())=>V.apply(E.execute(q,s,{section:'root'}).lines,q);

test('opening anything reads like a command line: load <file>',()=>{
 assert.deepEqual(run('about'),['load about.txt']);
 assert.deepEqual(run('frame 3'),['load frame_03.jpg']);
 assert.equal(run('open soundtrack')[0],'load soundtrack/');
});
test('misses read "<cmd>: command not found", with no pleading',()=>{
 assert.deepEqual(run('upper hello'),['upper: command not found']);
 assert.equal(run('qwertyuiop')[0],'qwertyuiop: command not found');
});
test('no full stops, no capitalised prose, no questions in terminal output',()=>{
 for(const q of ['hello','yes','no','cancel','thanks','download','stop','fold','trailer','rm -rf /','play something','release date']){
  for(const l of run(q)){
   assert.ok(!/[.?!]$/.test(l),`"${q}" -> "${l}" ends in punctuation`);
   assert.ok(!/^(Sure|Want|Please|Understood|Acknowledged)/.test(l),`"${q}" -> "${l}" is not terse`);
  }
 }
});
test('key .... value rows stay aligned and keep proper nouns',()=>{
 assert.ok(run('status').some(l=>/^interface \.+ online$/.test(l)));
 assert.ok(run('what is this').join(' ').includes('macOS / windows / linux'));
});
test('settings echo as assignments',()=>{
 assert.deepEqual(run('glow tight'),['glow = tight']);
 assert.deepEqual(run('green 2'),['green = 2']);
});
