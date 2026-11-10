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
 for(const text of ['yo@jonsimo.com','https://www.jonsimo.com','https://www.instagram.com/jonsimo']){assert.ok(js.includes(text),'sections.js '+text);if(text!=='https://www.jonsimo.com')assert.ok(html.includes(text),'header icons '+text);}
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

test('sound: ambient is 3 dB down, phones start off, the toggle persists, and the display-options bar is gone',()=>{
 const amb=read('ambient.js'),html=read('index.html');
 assert.ok(/VOL = 0\.354,/.test(amb)&&/vd_sound/.test(amb)&&/BEEP = 0\.2/.test(amb));
 assert.ok(/HUM_VOLUME = 0\.354;/.test(fs.readFileSync(path.join(__dirname,'..','..','terminal.js'),'utf8')));
 assert.ok(/id="sound-toggle"[\s\S]*sound-state">\[ON\]/.test(html));
 assert.ok(!/DISPLAY OPTIONS|class="review"/.test(html));
 assert.ok(html.indexOf('ambient.js')>0&&html.indexOf('ambient.js')<html.indexOf('sections.js')+1000);
});

test('the logo goes back to the start page, and the prompt reads console>root:/',()=>{
 const html=read('index.html');
 assert.ok(/class="brand vd-banner" href="\.\.\/\?terminal"/.test(html));
 assert.ok(/root:\//.test(read('sections.js'))&&!/vector_drift:\/root/.test(read('sections.js')));
 assert.ok(/finalPrompt = "console>root:\/"/.test(fs.readFileSync(path.join(__dirname,'..','..','terminal.js'),'utf8')));
});

test('phone console: prompt is always console> and the keyboard mode can be undone',()=>{
 const root=path.join(__dirname,'..','..');
 const t=fs.readFileSync(path.join(root,'terminal.js'),'utf8');
 assert.ok(!/appendMobilePrompt\("root:\/"\)/.test(t)&&!/\? "operator>" : "root:\/"/.test(t),'no root:/ prompt after a reply');
 assert.ok(t.includes('mobilePromptLabel() { return livePromptLabel() || "console>"'));
 assert.ok(t.includes('[ SHOW LINKS ]')&&t.includes('setMobileTyping'));
 for(const f of ['GO/index.html','expo/index.html']){const h=fs.readFileSync(path.join(root,f),'utf8');assert.ok(h.includes('id="ex"')&&h.includes('SHOW LINKS'),f);}
});

test('phone: tapping an outline link (name, dots, description) is navigation, not typing',()=>{
 const root=path.join(__dirname,'..','..');
 const t=fs.readFileSync(path.join(root,'terminal.js'),'utf8'),h=fs.readFileSync(path.join(root,'handoff.js'),'utf8');
 assert.ok(t.includes('function isLinkTap')&&t.includes('mobileMode && isLinkTap(e.target)'));
 assert.ok(h.includes('dots.addEventListener("click", viaRow)')&&h.includes('desc.addEventListener("click", viaRow)'));
});

test('boot outline recovers when Back restores it mid-departure or the connection stalls',()=>{
 const h=fs.readFileSync(path.join(__dirname,'..','..','handoff.js'),'utf8'),t=fs.readFileSync(path.join(__dirname,'..','..','terminal.js'),'utf8');
 assert.ok(h.includes('function resetDeparture')&&h.includes('"pageshow"')&&h.includes('setTimeout(resetDeparture, 6000)'));
 assert.ok(t.includes('window.VDResumeAmbient'));
});

test('audio guard: every page that makes sound loads it first, and it covers media and audio contexts',()=>{
 const root=path.join(__dirname,'..','..');
 const g=fs.readFileSync(path.join(root,'audio-guard.js'),'utf8');
 assert.ok(g.includes('visibilitychange')&&g.includes('pagehide')&&g.includes('HTMLMediaElement')&&g.includes('AudioContext'));
 const main=fs.readFileSync(path.join(root,'index.html'),'utf8'),rv=fs.readFileSync(path.join(root,'revamp','index.html'),'utf8');
 assert.ok(main.indexOf('audio-guard.js')>0&&main.indexOf('audio-guard.js')<main.indexOf('terminal.js'));
 assert.ok(rv.indexOf('audio-guard.js')>0&&rv.indexOf('audio-guard.js')<rv.indexOf('ambient.js'));
});

test('audio guard exempts only the OST player',()=>{
 const root=path.join(__dirname,'..','..');
 assert.ok(fs.readFileSync(path.join(root,'revamp','ost.js'),'utf8').includes('audio.vdKeepPlaying = true'));
 assert.equal((fs.readFileSync(path.join(root,'audio-guard.js'),'utf8').match(/vdKeepPlaying/g)||[]).length>=3,true);
 for(const f of ['terminal.js','handoff.js','logo-reveal.js','revamp/ambient.js'])assert.ok(!fs.readFileSync(path.join(root,f),'utf8').includes('vdKeepPlaying'),f);
});
