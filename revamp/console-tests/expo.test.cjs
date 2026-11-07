'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','..',f),'utf8');
const html=read('expo/index.html');

test('expo page: exactly the three links, in order, with the supplied destinations',()=>{
 const links=[...html.matchAll(/<a class="row" href="([^"]+)">.*?<b>([^<]+)<\/b>/g)].map(m=>[m[2],m[1]]);
 assert.deepEqual(links,[
  ['JOIN THE DISCORD','https://discord.gg/Z8Kt8cDUX8'],
  ['VISIT THE SITE','https://vectordrift.io/?ref=expo'],
  ['FOLLOW THE DEV','https://www.instagram.com/jonsimo'],
 ]);
});

test('expo page is instant: links are plain HTML, scripts are deferred same-origin, nothing external',()=>{
 const scripts=[...html.matchAll(/<script([^>]*)>/g)].map(m=>m[1]);
 assert.equal(scripts.length,4);
 for(const s of scripts){assert.ok(/defer/.test(s)&&/src="\//.test(s),s);}
 assert.ok(/script-src 'self'/.test(html)&&/connect-src 'none'/.test(html)&&/noindex/.test(html)&&/viewport-fit=cover/.test(html));
 assert.ok(!/https?:\/\/[^"' )]*\.(js|css|png|jpg|svg)/i.test(html));
 assert.ok(Buffer.byteLength(html)<9000,'page under 9 KB');
});

test('the short QR path /GO serves the same page as /expo',()=>{
 assert.equal(read('GO/index.html'),html);
});

test('the expo console reuses the site engine and sends section/program effects to the site',()=>{
 const js=read('expo/console.js');
 assert.ok(/VDConsoleEngine/.test(js)&&/\/revamp\/\?ref=expo#/.test(js)&&!/fetch|XMLHttpRequest/.test(js));
 for(const f of ['terminal-intents.js','revamp/console-language.js','revamp/console-engine.js','expo/console.js'])assert.ok(html.includes('src="/'+f+'"'),f);
});

test('phones opening the root go to /GO/, but never in a loop and never past a flag',()=>{
 const js=read('mobile-redirect.js'),idx=read('index.html');
 assert.ok(idx.indexOf('mobile-redirect.js')>0&&idx.indexOf('mobile-redirect.js')<idx.indexOf('styles.css'),'runs before anything else');
 assert.ok(/location\.replace\("\/GO\/"\)/.test(js));
 assert.ok(/utm_\|fbclid/.test(js)&&/plain = false/.test(js),'only tracking params still redirect');
 assert.ok(read('GO/index.html').includes('https://vectordrift.io/?ref=expo'),'the GO visit link carries ?ref so it is not redirected back');
});
