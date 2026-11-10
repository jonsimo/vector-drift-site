'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const H=require('../../handoff.js');
const root=f=>fs.readFileSync(path.join(__dirname,'..','..',f),'utf8');

test('the boot outline lists exactly the six directory entries and each leads to a real site section',()=>{
 assert.deepEqual(H.OUTLINE.map(r=>r[0]),['about.txt','media/','soundtrack/','devlog/','links.lnk','download.exe']);
 const sections=root('revamp/sections.js').match(/const sections = \[([^\]]+)\]/)[1];
 for(const [,section] of H.OUTLINE){assert.ok(sections.includes('"'+section+'"'),section);assert.equal(H.urlFor(section),'revamp/?from=boot#'+section);}
});

test('a handoff carries the logo box and goes stale after 15 seconds',()=>{
 const h=H.build('media',{left:233,top:37,width:704,height:259},1440,813,1000);
 assert.deepEqual(h,{t:1000,section:'media',x:233,y:37,w:704,h:259,vw:1440,vh:813});
 assert.ok(H.isFresh(h,1000+14000));assert.ok(!H.isFresh(h,1000+16000));assert.ok(!H.isFresh(null,0));
 assert.ok(!H.isFresh({...h,w:0},1000));
});

test('boot wiring: outline prints after the logo and before the prompt, console-ready fires, Back skips the boot',()=>{
 const t=root('terminal.js'),idx=root('index.html');
 assert.ok(t.indexOf('VDHandoff.printOutline')>0&&t.indexOf('VDHandoff.printOutline')<t.indexOf('Beep plays, then the root prompt'));
 assert.equal((t.match(/vd:console-ready/g)||[]).length,2);
 assert.ok(/vd_site_entered/.test(t)&&/back_forward/.test(t));
 for(const f of ['reticle.js','handoff.js'])assert.ok(idx.indexOf(f)>0&&idx.indexOf(f)<idx.indexOf('terminal.js'),f);
 assert.ok(/media-src 'self'/.test(idx),'CSP allows media');
});

test('the site picks the handoff up and has a way back to the terminal',()=>{
 const html=root('revamp/index.html');
 assert.ok(html.indexOf('arrive-head.js')<html.indexOf('sections.css'));
 assert.ok(html.includes('href="../?terminal"'));
 assert.ok(/vd_handoff/.test(root('revamp/arrive-head.js'))&&/__vdHandoff/.test(root('revamp/arrive.js')));
});
