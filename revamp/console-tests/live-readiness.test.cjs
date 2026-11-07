'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const E=require('../console-engine.js');
const fresh=()=>E.createSession({rng:()=>.5});
const run=(input,s=fresh(),ctx={})=>E.execute(input,s,{section:'root',...ctx});
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

test('contact is reachable by command and by everyday wording',()=>{
 for(const input of ['contact','contact me','get in touch','how do i contact you','who made this','open contact','show me the contact page','go to the contact page'])
  assert.deepEqual(run(input).effects,[{type:'navigate',section:'contact'}],input);
});

test('contact details are exactly the supplied ones',()=>{
 const js=read('sections.js'),html=read('index.html');
 for(const text of ['yo@jonsimo.com','https://www.jonsimo.com','https://www.instagram.com/jonsimo']){assert.ok(js.includes(text),'sections.js '+text);assert.ok(html.includes(text),'footer '+text);}
});

test('a typed address opens signup without echoing, retaining or sending it',()=>{
 const s=fresh(),r=run('pilot@example.com',s);
 assert.deepEqual(r.effects,[{type:'navigate',section:'email'}]);
 assert.ok(!JSON.stringify(r).includes('pilot@'));assert.equal(s.history.length,0);
});

test('no mockup or placeholder wording ships in the page chrome or section copy',()=>{
 for(const file of ['index.html','sections.js']){
  const text=read(file);
  assert.ok(!/MOCKUP|LOCAL PREVIEW|layout study|PLACEHOLDER FRAMEGRABS|not been supplied|UX PREVIEW|SAMPLE MEDIA/i.test(text),file);
 }
});

test('signup page is wired to the real uplink, which is loaded before sections.js',()=>{
 const html=read('index.html');
 assert.ok(html.indexOf('../uplink.js')>0&&html.indexOf('../uplink.js')<html.indexOf('sections.js'));
 assert.ok(/VDUplink\.subscribe/.test(read('sections.js')));
});

test('discord invite is the supplied permanent link, in the page, footer and links',()=>{
 const url='https://discord.gg/Z8Kt8cDUX8';
 assert.ok(read('sections.js').includes('const DISCORD_URL = "'+url+'"'));
 assert.ok(read('index.html').includes(url));
 assert.deepEqual(run('join discord').effects,[{type:'navigate',section:'discord'}]);
});

test('previous and next step through the framegrabs and wrap',()=>{
 const f=(q,frame)=>run(q,fresh(),{section:'media',frame}).effects.find(e=>e.type==='frame').number;
 assert.equal(f('previous',4),3);assert.equal(f('prev',1),6);assert.equal(f('next',6),1);assert.equal(f('next',2),3);
});
