'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const E=require('../console-engine.js');
const R=require('../route-state.js');
const fresh=()=>E.createSession({rng:()=>.5});
const run=(input,s=fresh(),ctx={})=>E.execute(input,s,{section:'root',...ctx});
const OST=[{type:'program',name:'ost'}];

test('music wording, CLI or everyday, opens the OST previews',()=>{
 for(const input of ['ost','ost.exe','music','soundtrack','play music','play the ost','play some music','Could you please play the soundtrack?','listen to the music','let me hear the music','i want to hear the soundtrack','is there music','what does the game sound like','open ost','show me the soundtrack'])
  assert.deepEqual(run(input).effects,OST,input);
});

test('music wording does not disturb the games or the unknown bank',()=>{
 assert.deepEqual(run('play snake').effects,[{type:'program',name:'snake'}]);
 assert.deepEqual(run('play something').effects,[]);
 assert.deepEqual(run('tell me about the music').effects,[]);
 assert.deepEqual(run('play banjo').effects,[]);
});

test('exit and cancel inside the OST program return to the directory',()=>{
 assert.deepEqual(run('exit',fresh(),{section:'ost'}).effects,[{type:'navigate',section:'root'}]);
 assert.deepEqual(run('cancel',fresh(),{section:'ost'}).effects,[{type:'navigate',section:'root'}]);
});

test('#ost is a valid program route',()=>{
 assert.deepEqual(R.parseHash('#ost',['root','media']),{section:'ost',reader:null});
});

test('every track in ost.js has its preview clip and cover on disk, and nothing else is shipped',()=>{
 let tracks;global.window={};global.document={};
 delete require.cache[require.resolve('../ost.js')];require('../ost.js');tracks=global.window.VDOst.TRACKS;delete global.window;delete global.document;
 assert.equal(tracks.length,23);
 const dir=path.join(__dirname,'..','ost');
 const expected=[];
 tracks.forEach(([title,secs],i)=>{
  const n=String(i+1).padStart(2,'0');
  assert.ok(title&&secs>0,'track '+n);
  for(const ext of ['mp3','jpg']){const f=path.join(dir,n+'.'+ext);expected.push(n+'.'+ext);assert.ok(fs.existsSync(f),n+'.'+ext);}
  assert.ok(fs.statSync(path.join(dir,n+'.mp3')).size<1.2e6,n+'.mp3 is a short clip, not a full track');
 });
 assert.deepEqual(fs.readdirSync(dir).sort(),expected.sort());
});

test('soundtrack/ is its own directory entry that mounts the player in the page (no iframe, no seek/volume/quit buttons)',()=>{
 const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
 const html=read('index.html'),js=read('sections.js'),ost=read('ost.js'),prog=read('console-program.js');
 assert.ok(/data-section="soundtrack"[^>]*>[^<]*<span class="mark"> <\/span>soundtrack\//.test(html));
 assert.ok(html.indexOf('ost.js')<html.indexOf('sections.js'),'ost.js loads before sections.js');
 assert.ok(js.includes('"soundtrack"')&&js.includes('VDOst.mount')&&js.includes('[ 45S PREVIEWS ]'));
 assert.ok(!/\bost:\s*\[/.test(prog),'ost no longer runs inside the iframe program frame');
 assert.ok(!/-5S|\+5S|VOL -|VOL \+|QUIT/.test(ost+js.slice(js.indexOf('"soundtrack"'))),'no -5s/+5s/volume/quit buttons');
 assert.ok(ost.includes('ost-gauge')&&ost.includes('ost-ico'));
 assert.ok(R.parseHash('#soundtrack',['root','soundtrack']).section==='soundtrack');
});
