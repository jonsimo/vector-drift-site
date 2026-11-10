/* Website console. Pure command/state engine; no DOM, network, eval,
   filesystem access or automatic signup/download actions. Story copy here is
   proposed website writing based on the supplied bible, not finalized canon. */
(function(root,factory){
  const local=typeof module==='object'&&module.exports;
  const api=factory(local?require('../terminal-intents.js'):root.VDIntents,local?require('./console-language.js'):root.VDConsoleLanguage);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.VDConsoleEngine=api;
})(typeof self!=='undefined'?self:this,function(VDI,Language){
  'use strict';
  const C=(id,category,usage,description,aliases=[])=>({id,category,usage,description,aliases:[id,...aliases]});
  const COMMANDS=[
    C('help','discovery','help [category|all]','Browse commands by topic.',['?','commands','command list','show commands','what can i do','what do i do','options','menu','instructions']),
    C('man','discovery','man <command>','Usage and examples for one command.',['manual']),
    C('apropos','discovery','apropos <word>','Find commands by name or description.'),
    C('suggest','discovery','suggest','Get three useful next actions.',['surprise me','what next','guide me']),
    C('ls','files','ls [-alh] [path]','List the mounted virtual files.',['dir','list','files','show files']),
    C('tree','files','tree','Show the virtual directory tree.'),
    C('pwd','files','pwd','Show the current site path.',['path','current directory']),
    C('cd','files','cd <section|..>','Move between site sections.'),
    C('open','files','open <file|section>','Open a section or read a virtual file.',['run','start','execute']),
    C('cat','files','cat <file>','Read a virtual text file.',['read','type','less','more']),
    C('find','files','find <word>','Search virtual file names.',['locate','search']),
    C('guide','site','guide','Open the console guide.',['console guide','command guide','command reference']),
    C('home','site','home','Return to the expanded /root directory.',['root','back']),
    C('about','site','about','Read about Vector Drift.',['about.txt','info','information','what is vector drift','tell me about the game']),
    C('media','site','media','Open the media archive.',['media/','media.exe','screenshots','framegrabs','show screenshots']),
    C('trailer','site','trailer','There is no trailer yet; opens the screenshots.',['video','videos','watch trailer','play trailer','gameplay']),
    C('frame','site','frame <1-6>','Select an individual framegrab.',['screenshot']),
    C('devlog','site','devlog','Open development updates.',['devlog/','news','updates']),
    C('links','site','links','Open public links.',['links.lnk','socials','social']),
    C('discord','site','discord','Open the Discord page.',['join discord','community']),
    C('contact','site','contact','Show how to reach Jon Simo: email, website and Instagram.',['contact me','contact jon','contact info','contact details','get in touch','reach jon','who made this','who made this game','who made vector drift']),
    C('email','site','email','Open signup; nothing is sent until you press SIGN UP.',['email.exe','signup','sign up','subscribe','newsletter','mailing list','join alpha','join beta']),
    C('download','site','download','Show the held demo status.',['download.exe','dl','install']),
    C('alpha','site','alpha','Show alpha access information.',['alpha_tracker.exe','tracker']),
    C('status','system','status','Inspect this console session.',['health','diag','diagnostics','system status']),
    C('version','system','version','Show the website console version.',['ver','build']),
    C('whoami','system','whoami','Show your local terminal identity.',['who am i','identify me']),
    C('hostname','system','hostname','Show the fictional terminal host name.'),
    C('uptime','system','uptime','Show elapsed time in this console session.'),
    C('date','system','date','Display the current local date.'),
    C('time','system','time','Display the current local time.'),
    C('echo','system','echo <text>','Print text exactly as entered.'),
    C('history','system','history','List recent commands.',['recent','recent commands','command history','show history']),
    C('clear','system','clear','Clear output; retain discoveries and progress.',['cls']),
    C('cancel','system','cancel','Drop a pending question or end the active game or program.',['cancel that','never mind','nevermind','forget it','nvm','scrap that']),
    C('exit','system','exit','Close the active program, or fold the console.',['quit','close','logout','bye','goodbye','stop']),
    C('fold','system','fold','Fold the console while retaining game progress.',['hide console']),
    C('reset','system','reset confirm','Reset only this local console story/game session.'),
    C('green','appearance','green <0|1|2>','Compare small shifts toward green.',['colour','color']),
    C('glow','appearance','glow <tight|original>','Choose the existing light comparison.',['bloom']),
    C('motion','appearance','motion <reduce|system>','Reduce motion or follow the OS preference.'),
    C('banner','toys','banner','Print a small ASCII Vector Drift mark.',['ascii','logo']),
    C('stars','toys','stars','Print a small procedural star field.',['starfield']),
    C('map','explore','map','Inspect the relay map.',['starmap']),
    C('ping','explore','ping [relay]','Run a fictional relay self-test.'),
    C('scan','explore','scan','Survey the relay for an unassigned signal.',['scan sector','scan system']),
    C('trace','explore','trace <signal>','Follow a discovered signal.',['traceroute']),
    C('decode','explore','decode <text>','Decode a ROT13 string.',['decrypt']),
    C('archive','story','archive','List recovered fragments and locked leads.',['archives']),
    C('journal','story','journal','Summarize discoveries.',['log','logs','events']),
    C('profile','story','profile','Read a profile derived from your console actions.'),
    C('lux','story','lux','Inspect the LUX field.',['what is lux','tell me about lux']),
    C('factions','story','factions','Inspect partially identified contact groups.',['enemies']),
    C('dossier','story','dossier <name>','Read a short faction identity fragment.',['inspect']),
    C('mission','story','mission','Start or inspect the relay recovery objective.',['objective','quest']),
    C('hint','story','hint','Get a specific next step without restarting.'),
    C('inventory','story','inventory','List recovered local fragments.',['items','fragments']),
    C('guess','games','guess [1-20]','Play a six-attempt number game.',['guess.exe','guess game']),
    C('rps','games','rps <rock|paper|scissors>','Play rock, paper, scissors.',['rock paper scissors']),
    C('roll','games','roll [NdM]','Roll up to six dice with up to 100 sides.',['dice']),
    C('flip','games','flip','Flip a coin.',['coin','coinflip']),
    C('fortune','toys','fortune','Read a changing terminal fortune.'),
    C('joke','toys','joke','Request low-quality terminal humour.',['tell me a joke']),
    C('haiku','toys','haiku','Print a short drift poem.',['poem']),
    C('calc','tools','calc <expression>','Arithmetic with parentheses and exponentiation.',['calculate','math']),
    C('rot13','tools','rot13 <text>','Encode or decode a ROT13 string.'),
    C('binary','tools','binary <text>','Encode a short message as binary.'),
    C('hex','tools','hex <text>','Encode a short message as hexadecimal.'),
    C('simulate','games','simulate','Start a small turn-based flight trial.',['launch','flight','play']),
    C('fire','games','fire','Attack in the text flight trial.',['shoot','pew','pew pew']),
    C('evade','games','evade','Evade and study a contact in the text trial.',['dodge','left','right']),
    C('collect','games','collect','Choose whether to risk taking LUX in the trial.',['loot','take lux']),
    C('upgrade','games','upgrade <shield|weapon>','Spend trial LUX on a real state change.',['buy']),
    C('dock','games','dock','End the text trial and read its diagnostic.',['land','abort']),
    C('snake','games','snake','Launch the existing ASCII Snake program.',['snake.exe','play snake']),
    C('pi','toys','pi','Launch the existing pi digit stream.',['pi.exe','pie','count pi']),
    C('ost','site','ost','Play 45-second previews of the Vector Drift soundtrack, with cover art.',['ost.exe','music','soundtrack','jukebox','play music','play the ost','play ost','play the music','play the soundtrack','play some music','play songs','play the songs']),
    C('sudo','system','sudo [command]','Ask for authority. It never grants real access.'),
    C('privacy','system','privacy','Explain local state and the absence of tracking.',['telemetry','tracking']),
  ];
  const PROGRAMS=['snake','pi','ost'];
  // Cut 2026-11-10 (Jon: "all this nonsense"): the relay story, faction/lux lore, the text flight
  // trial and the little games. The console answers real questions and runs real programs only.
  const CUT=new Set(['map','scan','trace','decode','archive','journal','profile','lux','factions','dossier','mission','hint','inventory','guess','rps','roll','flip','simulate','fire','evade','collect','upgrade','dock']);
  for(let i=COMMANDS.length-1;i>=0;i--)if(CUT.has(COMMANDS[i].id))COMMANDS.splice(i,1);
  const BY_ID=Object.assign(Object.create(null),Object.fromEntries(COMMANDS.map(c=>[c.id,c])));
  const ALIASES=new Map();
  for(const c of COMMANDS)for(const alias of c.aliases){if(ALIASES.has(alias))throw Error('Duplicate command alias: '+alias);ALIASES.set(alias,c.id);}
  const CATEGORIES=[...new Set(COMMANDS.map(c=>c.category))];
  const SECTIONS=Object.assign(Object.create(null),{about:'about',media:'media',devlog:'devlog',links:'links',contact:'contact',discord:'discord',email:'email',download:'download',home:'root',reference:'reference',guide:'reference'});
  // A command whose usage is just its own name accepts no arguments. Anything
  // else after its alias is a mistake, not something to ignore and run anyway.
  const TAKES_ARGS=new Set(COMMANDS.filter(c=>c.usage!==c.id).map(c=>c.id));
  const FILLER=/^(?:please|pls|now|again|thanks|thank you|for me|for me please|now please|please now)$/;
  const FILES=Object.assign(Object.create(null),{
    '/root/about.txt':['VECTOR DRIFT','A retro vector space shooter.','Platforms: macOS / Windows / Linux.','Use media for visuals or email for release updates.'],
    '/root/readme.txt':['VECTOR DRIFT RELAY','Ask normally or use commands. Use help all for the full catalog; Tab completes names.','This console is a self-contained interface.','Nothing typed here runs on your computer as a shell command.'],
    '/root/controls.txt':['CONSOLE CONTROLS','/ focus console | Tab complete | Up/Down history','Ctrl+C cancel current input | Escape fold console','Scroll up for older output. Read all opens long answers in the content pane.'],
    '/root/media/index.txt':['MEDIA ARCHIVE','frame_01.jpg ... frame_06.jpg','Six framegrabs. There is no trailer yet.'],
    '/root/links.lnk':['PUBLIC RELAYS','discord / email updates / contact / media','Discord: discord.gg/Z8Kt8cDUX8 // Contact: yo@jonsimo.com // jonsimo.com // instagram.com/jonsimo'],
    '/root/download.exe':['ALPHA DEMO IS NOT YET AVAILABLE.','The download hold is still active. No key is requested.'],
    '/root/archive/1187.log':null,
  });
  const FACTIONS=Object.assign(Object.create(null),{
    axiom:['AXIOM // CONTACT DOSSIER','Geometric machine enforcement.','Formation language: order, correction, recursion.','Authority source: [REDACTED]'],
    xenophage:['XENOPHAGE // CONTACT DOSSIER','Organic predation and mutation.','Repeated patterns may produce unfamiliar responses.','Origin: [REDACTED]'],
    varrax:['VARRAX // CONTACT DOSSIER','Salvage fleets and opportunistic aggression.','Nothing abandoned remains unclaimed.','Ownership: contested'],
    auralis:['FIELD CONTACT // DESIGNATION UNRESOLVED','Resonance, portal phenomena, LUX-linked distortion.','Designation: [UNCONFIRMED]'],
    nethyr:['FIELD CONTACT // DESIGNATION UNRESOLVED','Resonance, portal phenomena, LUX-linked distortion.','Designation: [UNCONFIRMED]'],
  });
  function createSession({rng=Math.random,now=Date.now()}={}){return {rng,started:now,totalCommands:0,history:[],counts:{},categories:{},rotations:{},unknowns:0,discoveries:[],scanCount:0,traced:false,followup:null,conversationTopic:null,lastFrame:0,profileSeen:false,guess:null,flight:null,lastFlight:null,legacy:VDI.createSession()};}
  const rotate=(s,key,arr)=>{const index=s.rotations[key]||0;s.rotations[key]=index+1;return arr[index%arr.length];};
  const random=(s,arr)=>arr[Math.floor(s.rng()*arr.length)];
  const result=(lines=[],effects=[],suggestions=[])=>({lines:Array.isArray(lines)?lines:[lines],effects,suggestions});
  const go=(section,lines)=>result(lines||(section==='reference'?'OPENING CONSOLE GUIDE.':`OPENED /root/${section==='root'?'':section}`),[section==='reference'?{type:'navigate',section,view:'guide'}:{type:'navigate',section}]);
  const rot13=text=>text.replace(/[a-z]/gi,c=>String.fromCharCode(c.charCodeAt(0)+(c.toLowerCase()<='m'?13:-13)));
  function discover(s,id){if(!s.discoveries.includes(id)){s.discoveries.push(id);return true;}return false;}
  function pathFor(raw,section){
    const text=String(raw||'').replace(/^['"]|['"]$/g,'');
    if(!text||text==='.')return section==='media'?'/root/media':'/root';
    if(text==='/root')return '/root';
    let parts=(text.startsWith('/')?text:'/root/'+(section==='media'?'media/':'')+text).split('/');
    const clean=[];for(const p of parts){if(!p||p==='.')continue;if(p==='..')clean.pop();else clean.push(p);}
    return '/'+clean.join('/');
  }
  function readFile(s,name,section){
    let path=pathFor(name,section);
    if(!Object.hasOwn(FILES,path)&&Object.hasOwn(FILES,'/root/'+name))path='/root/'+name;
    if(path==='/root/archive/1187.log'){
      if(!s.traced)return result(['ARCHIVE NOT MOUNTED.','The relay survey has not identified a route.'],[],['scan']);
      discover(s,'1187.log');
      return result(['RECOVERED 1187.log','GHOSTBUF.DAT ....... 1187 samples indexed / 1 unassigned signature','OBSERVER INTERFACE . ABSENT / ENUMERATION DEFERRED','CORTEX BRIDGE ...... PRESENT / OWNER UNASSIGNED','PILOT.CHANNEL ...... no local pilot detected','REMOTE.AUTH ........ authority source unresolved'],[],['journal','profile']);
    }
    if(FILES[path])return result(FILES[path]);
    return result([`FILE NOT FOUND: ${name||'(no file supplied)'}`,'This is a virtual archive, not access to your device files.'],[],['ls','find readme']);
  }
  function distance(a,b){const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return row[b.length];}
  function nextSteps(s){return ['media','ost','contact'];}
  function calculate(source){
    let rest=source.trim(),tokens=[];
    while(rest){const match=rest.match(/^(\d+(?:\.\d*)?(?:e[+-]?\d+)?|\.\d+|[()+\-*/%^])/i);if(!match)throw Error('Use numbers, parentheses and + - * / % ^ only.');tokens.push(match[0]);rest=rest.slice(match[0].length).trim();}
    if(!tokens.length||tokens.length>100)throw Error('Enter an expression of up to 100 tokens.');
    let at=0;
    function expr(min=0){let t=tokens[at++],left;if(t==='+'||t==='-'){left=(t==='-'?-1:1)*expr(3);}else if(t==='('){left=expr();if(tokens[at++]!==')')throw Error('Missing closing parenthesis.');}else if(t!==undefined&&/^\d|^\.\d/.test(t)){left=Number(t);}else throw Error('Expected a number.');
      const priority={'+':1,'-':1,'*':2,'/':2,'%':2,'^':4};
      while(at<tokens.length&&(priority[tokens[at]]||0)>min){const op=tokens[at++],p=priority[op],right=expr(op==='^'?p-1:p);left=op==='+'?left+right:op==='-'?left-right:op==='*'?left*right:op==='/'?left/right:op==='%'?left%right:left**right;if(!Number.isFinite(left))throw Error('Result is not finite; check division by zero or exponent size.');}return left;}
    const value=expr();if(at!==tokens.length)throw Error('Unexpected token: '+tokens[at]);if(!Number.isFinite(value))throw Error('Result is not finite.');return value;
  }
  // Intent steps -> console lines. Typed lines read as their final text; a goto step
  // becomes a real navigation, a link step shows the destination.
  function fromSteps(s,steps,context={}){
    const lines=[],byId=new Map(),effects=[];
    for(const step of steps){
      if(step.type==='print'){if(step.id)byId.set(step.id,lines.length);lines.push(step.text);}
      else if(step.type==='rewrite'&&byId.has(step.targetId))lines[byId.get(step.targetId)]=step.text;
      else if(step.type==='typed'){let cur='',before=null;for(const op of step.ops){if(op.k==='t')cur+=op.s;else if(op.k==='b'){if(before===null)before=cur;cur=cur.slice(0,-op.n);}}if(before!==null)lines.push(before);lines.push(step.text);}
      else if(step.type==='open'||step.type==='link')lines.push(step.text.replace(/^>\s*/,''));
      else if(step.type==='clock'){const d=new Date(context.now??Date.now());lines.push('local clock ............ '+(context.time||d.toLocaleTimeString())+'  '+(context.date||d.toLocaleDateString()));}
      else if(step.type==='goto')effects.push({type:'navigate',section:step.section});
    }
    return result(lines.length?lines:['Channel remains open.'],effects,nextSteps(s).slice(0,2));
  }
  function legacyResponse(s,resolution){
    const response=VDI.selectResponse(resolution,s.legacy,s.rng),lines=[],byId=new Map();
    return fromSteps(s,response.steps);
  }
  function endFlight(s){
    const f=s.flight;s.lastFlight={...f};s.flight=null;
    return result(['TRIAL ENDED',`LUX ${f.lux} / CONTACTS CLEARED ${f.kills}`,`DRIFT PROFILE: ${f.greed>f.aggression?'GREED':f.evasion>f.aggression?'CAUTIOUS':'AGGRESSION'}`,'Your trial choices have been recorded in this session.'],[],['profile','simulate']);
  }
  function execute(raw,s,context={}){
    const original=String(raw??'').trim();
    let n=VDI.normalizeTerminalInput(original).normalized,language=null;
    if(!n)return result([],[],['help','scan','simulate']);
    if(original.length>512)return result('INPUT TOO LONG. Keep a command under 512 characters.');
    const email=/(?:^|\s)[^\s@]+@[^\s@]+\.[^\s@]+(?:$|\s)/.test(original)||/^[^\s@]+@[^\s@]*$/.test(original);
    const sensitive=email||/^(?:download key|key|password|token|secret)(?:\s+|=|:)/i.test(n);
    const echo=sensitive?'[PRIVATE INPUT OMITTED]':original;
    const finish=r=>{
      if(language?.opening)r.lines.unshift(language.opening);
      if(language?.suggestions)r.suggestions=language.suggestions;
      return Object.assign(r,{echo});
    };
    if(sensitive){s.followup=null;return finish(email?result(['ADDRESS RECOGNIZED.','Opening signup with it filled in. Nothing is sent until you press SIGN UP.'],[{type:'navigate',section:'email'}]):result(['PRIVATE INPUT OMITTED.','This console never needs a password or token. The demo download remains held.']));}
    s.history.push(original);s.totalCommands++;if(s.history.length>80)s.history.shift();
    const protectedResolution=VDI.resolveCommand(n);
    if(protectedResolution.kind==='protected'){s.followup={kind:'updates'};s.conversationTopic='availability';return finish(result(['ALPHA DEMO IS NOT YET AVAILABLE.','Want email updates when there is news?'],[],['Yes please','No thanks']));}
    if(/[;|]|&&|\$\(|`/.test(n)&&!/^echo\s/.test(n)){s.followup=null;return finish(result(['ONE INSTRUCTION AT A TIME.','This relay is not a shell; pasted code and command chains are never executed.'],[],['help']));}
    const section=context.section||'root',previousFollowup=s.followup;
    language=Language.interpret(original,{...context,session:s});
    s.followup=language?.followup||null;
    if(language)s.conversationTopic=language.topic;
    if(language?.reply)return finish(result(language.reply,[],language.suggestions));
    const instruction=language?.command||original;
    if(language?.command)n=VDI.normalizeTerminalInput(instruction).normalized;
    let id=ALIASES.get(n),args='',rawArgs='';
    if(!id){const [head,...tail]=n.split(' ');id=ALIASES.get(head);args=tail.join(' ');rawArgs=instruction.slice(instruction.indexOf(' ')+1);}
    // File syntax owns its punctuation. The conversation normalizer strips
    // sentence-ending dots, which must never turn `ls ..` into bare `ls`.
    const syntax=instruction.replace(/[’‘]/g,"'").replace(/\s+/g,' ').replace(/^\.\//,'').toLowerCase();
    const fileSyntax=syntax.match(/^(\S+)\s+(.+)$/);
    const fileCommand=fileSyntax&&ALIASES.get(fileSyntax[1]);
    if(['ls','cd','open','cat','find'].includes(fileCommand)){id=fileCommand;args=fileSyntax[2];rawArgs=instruction.slice(instruction.indexOf(' ')+1);}
    let rejected=null;
    if(id&&args&&!TAKES_ARGS.has(id)){
      if(FILLER.test(args))args='';
      else{rejected={id,head:n.split(' ')[0],args};id=null;args='';rawArgs='';}
    }
    if(!id&&/^[\d\s()+\-*/%.^]+$/.test(n)&&/\d/.test(n)){id='calc';args=n;}
    if(!id&&/^(what is|what's|calculate)\s+[\d(]/.test(n)){id='calc';args=n.replace(/^(what is|what's|calculate)\s+/,'');}
    if(!id&&/^(?:can you |please )?(?:show me|show|open|take me to|go to) (?:the )?(media|screenshots|trailer|about|devlog|links|discord|email|contact)(?: page)?$/.test(n)){
      const match=n.match(/(media|screenshots|trailer|about|devlog|links|discord|email|contact)(?: page)?$/);id=match[1]==='screenshots'?'media':match[1];
    }
    if(!id&&Object.hasOwn(FACTIONS,n)){id='dossier';args=n;}
    if(!id&&['observer','cortex','consent','organic','ghost','1980','1187','0x00007f00'].includes(n)){
      if(n==='1187'){id='trace';args='1187';}else {id='dossier';args=n;}
    }
    if(!id&&/^(?:rm|delete|format|wipe|shutdown|reboot|reboot.exe)\b/.test(n))return finish(result(['REQUEST REFUSED.','The archive prefers to remain an archive. Nothing was deleted or restarted.'],[],['sudo','clear']));
    if(!id&&/^(?:thanks|thank you|cheers)$/.test(n))return finish(result(rotate(s,'thanks',['Acknowledged.','Courtesy recorded. No surcharge.','You are welcome. The channel remains open.'])));
    if(!id&&/^(?:how are you|how's it going|what's up|sup|greetings)$/.test(n))return finish(result(rotate(s,'smalltalk',['Interface stable. No complaints logged.','The channel is clear. That is as close as I get to fine.','Operational. The rest is above my clearance.']),[],['suggest']));
    if(!id&&/\b(?:ai|chatgpt|chatbot|llm)\b/.test(n))return finish(result(['This is a scripted, stateful terminal.','No remote AI service interprets your commands.'],[],['help','privacy']));
    if(!id&&/\b(?:secret|mystery|hidden)\b/.test(n))return finish(result(['The directory is a complete inventory.','Nothing is hidden here.'],[],nextSteps(s)));
    if(!id&&/\b(?:download|install)\b/.test(n))return finish(result(['LOOKING FOR THE DEMO?','ALPHA DEMO IS NOT YET AVAILABLE.'],[],['email','download']));
    if(!id&&/\b(?:mac|macos|windows|linux|steam deck|iphone|android|mobile)\b/.test(n))return finish(result(['The currently listed game platforms are macOS, Windows and Linux.','Other platforms have not been confirmed.'],[],['about','email']));
    if(!id&&/\b(?:play a game|play something|mini games|minigames)\b/.test(n))return finish(result(['AVAILABLE DIVERSIONS','A text flight trial, number lock, rock-paper-scissors, dice, and ASCII Snake.'],[],['simulate','guess','rps rock','snake']));
    if(!id&&/^(?:fuck|shit|damn|wtf|fuck you|this sucks)$/.test(n))return finish(result(['FRUSTRATION ACKNOWLEDGED.','Try something with a more predictable outcome.'],[],['joke','simulate','help']));
    if(!id&&/\b(release date|when .*release|when .*available|how much|price|steam|wishlist)\b/.test(n))return finish(result(['No confirmed release date, price or Steam page is configured here.','Use email for announcements; the demo remains held.'],[],['email','download']));
    if(!id&&/\b(lux|axiom|xenophage|varrax|auralis|nethyr)\b/.test(n)){const term=n.match(/\b(lux|axiom|xenophage|varrax|auralis|nethyr)\b/)[1];id=term==='lux'?'lux':'dossier';args=term;}
    if(!id&&protectedResolution.kind==='intent'){
      const mapped={help:'help',inspect:'ls',version:'version',history:'history',exit:'exit',status:'status'}[protectedResolution.id];
      if(mapped)id=mapped;else if(protectedResolution.id==='identity'&&protectedResolution.subtype==='user')id='whoami';
      else return finish(legacyResponse(s,protectedResolution));
    }
    if(!id&&rejected){
      s.unknowns++;
      if(rejected.id==='simulate')return finish(result([`PLAY WHAT? "${rejected.args}" is not something this console can play.`,'Pick one below. Nothing was started.'],[],Language.GAMES));
      return finish(result([`UNRESOLVED: ${original}`,`"${rejected.head}" takes no options, so "${rejected.args}" was not understood. Nothing was run.`],[],[rejected.id,'help']));
    }
    if(!id){
      s.unknowns++;
      const head=n.split(' ')[0];
      const transposed=(a,b)=>a.length===b.length&&[...a].some((_,i)=>i+1<a.length&&a.slice(0,i)+a[i+1]+a[i]+a.slice(i+2)===b);
      const matches=/^[a-z][a-z0-9_.-]*$/.test(n)?COMMANDS.map(c=>({id:c.id,d:distance(head,c.id)})).filter(x=>x.d<=1||transposed(head,x.id)).sort((a,b)=>a.d-b.d||a.id.localeCompare(b.id)):[];
      if(matches.length)return finish(result([`UNRESOLVED: ${original}`,`Did you mean ${matches.slice(0,3).map(x=>x.id).join(', ')}? Nothing was auto-executed.`],[],matches.slice(0,3).map(x=>x.id)));
      const hooks=s.scanCount?nextSteps(s):Language.START;
      if(VDI.isConversational(n)){const r=fromSteps(s,VDI.selectUnknown(s.legacy,s.rng,n).steps,context);r.suggestions=hooks.slice(0,3);return finish(r);}
      return finish(result([rotate(s,'unknown',[
        'REQUEST NOT RECOGNIZED. Try one of the requests below.',
        'No matching action found. You can choose a request below or type help.',
        'The relay could not match that request. Try asking another way.',
      ])],[],hooks));
    }
    if(!BY_ID[id])return finish(result(['REQUEST NOT RECOGNIZED. Try one of the requests below.'],[],Language.START));
    s.counts[id]=(s.counts[id]||0)+1;s.categories[BY_ID[id].category]=(s.categories[BY_ID[id].category]||0)+1;
    if(!language?.topic)s.conversationTopic=({scan:'explore',trace:'explore',journal:'explore',media:'media',frame:'media',trailer:'media',about:'about',simulate:'flight',guess:'guess',rps:'rps'})[id]||null;
    if(id==='cat'&&/(?:^|\/)1187\.log$/.test(args)||['open','cd'].includes(id)&&args==='archive')s.conversationTopic='explore';
    const usage=()=>result(`USAGE: ${BY_ID[id].usage}`);
    let r;
    switch(id){
      case 'help':{
        if(!args){r=result(['Pick a request, or type help all for every command.'],[],Language.START);break;}
        if(args!=='all'&&!CATEGORIES.includes(args)){r=BY_ID[args]?result([BY_ID[args].usage,BY_ID[args].description]):result('Unknown category. Try help, help all, or man <command>.');break;}
        r=result(COMMANDS.filter(c=>args==='all'||c.category===args).map(c=>`${c.usage.padEnd(30)} ${c.description}`),[],args==='games'?['simulate','guess','snake']:args==='story'?['mission','scan','journal']:args==='tools'?['calc 2*(3+4)','rot13 hello']:[]);break;
      }
      case 'man':{const c=BY_ID[ALIASES.get(args)||args];r=c?result([c.usage,c.description,`CATEGORY: ${c.category}`,`ALSO: ${c.aliases.join(', ')}`]):result('No manual entry for that name.',[],['help']);break;}
      case 'apropos':r=args?result(COMMANDS.filter(c=>(c.id+' '+c.description).toLowerCase().includes(args)).map(c=>c.usage+' — '+c.description)):usage();if(!r.lines.length)r=result('No matching command. Try help all.');break;
      case 'suggest':r=result(['NEXT TRANSMISSIONS',...nextSteps(s).map(c=>'> '+c)],[],nextSteps(s));break;
      case 'ls':{const directory=args.split(' ').filter(token=>!/^-[alh]+$/.test(token)).join(' ');const p=pathFor(directory,section);if(directory&&p!=='/root'&&!['/root/media','/root/media/','/root/archive','/root/archive/'].includes(p)){r=result('DIRECTORY NOT MOUNTED: '+directory,[],['tree']);break;}r=p.includes('archive')?result(['1187.log '+(s.traced?'[MOUNTED]':'[UNLOCATED]')]):p.includes('media')?result(Array.from({length:6},(_,i)=>`frame_0${i+1}.jpg`)):result(['about.txt  media/  devlog/  links.lnk  download.exe','readme.txt  controls.txt  archive/','Only virtual site files are mounted.'],[],['cat readme.txt','scan']);break;}
      case 'tree':r=result(['/root','|-- about.txt','|-- media/ [6 frames]','|-- devlog/','|-- links.lnk','|-- download.exe [HELD]','|-- readme.txt','|-- controls.txt','`-- archive/ '+(s.traced?'[MOUNTED]':'[UNLOCATED]')]);break;
      case 'pwd':r=result('/root'+(section==='root'?'':'/'+section));break;
      case 'cd':case 'open':{
        let target=args.replace(/^\/root\/?/,'').replace(/\/$/,'');target=target==='..'||target==='/'||target===''?'home':target;
        const alias=ALIASES.get(target)||target;
        if(SECTIONS[alias])r=go(SECTIONS[alias]);else if(PROGRAMS.includes(alias))r=result(`LOADING ${alias}.exe`,[{type:'program',name:alias}]);
        else if(target==='archive')r=result(['ARCHIVE DIRECTORY',`1187.log: ${s.traced?'mounted':'unlocated'}`],[],['scan','journal']);
        else r=readFile(s,args,section);break;
      }
      case 'cat':r=args?readFile(s,args,section):usage();break;
      case 'find':r=args?result(Object.keys(FILES).filter(p=>p.includes(args))):usage();if(!r.lines.length)r=result('No matching virtual files.',[],['tree']);break;
      case 'guide':r=go('reference');break;
      case 'home':r=go('root');break;
      case 'about':case 'media':case 'devlog':case 'links':case 'discord':case 'email':case 'contact':r=go(SECTIONS[id]);break;
      case 'trailer':s.lastFrame=1;r=result(['THERE IS NO TRAILER YET.','Opening the framegrabs instead.'],[{type:'navigate',section:'media'},{type:'frame',number:1}]);break;
      case 'frame':{const n=Number(args);if(/^[1-6]$/.test(args))s.lastFrame=n;r=/^[1-6]$/.test(args)?result(`FRAME 0${n} SELECTED.`,[{type:'navigate',section:'media'},{type:'frame',number:n}]):usage();break;}
      case 'download':s.followup={kind:'updates'};r=result(['ALPHA DEMO IS NOT YET AVAILABLE.','Want email updates when there is news?'],[],['Yes please','No thanks']);break;
      case 'alpha':r=result(['ALPHA RELAY','The demo is not available yet. No account or key is requested.'],[],['email','download']);break;
      case 'status':r=result(['RELAY STATUS','interface ............. ONLINE',`commands .............. ${s.totalCommands}`,`discoveries ........... ${s.discoveries.length}/2`,`profile categories .... ${Object.keys(s.categories).length}`,'download .............. HELD','command relay ......... LOCAL'],[],nextSteps(s).slice(0,2));break;
      case 'version':r=result(['VECTOR DRIFT // WEBSITE CONSOLE',`command families ....... ${COMMANDS.length}`,'game build version .... not listed']);break;
      case 'whoami':r=result(['LOCAL VISITOR','identity .............. unassigned','authority ............. read-only','profile ............... console actions in this tab only'],[],['profile']);break;
      case 'hostname':r=result('vector_drift // fictional relay host');break;
      case 'uptime':r=result(`SESSION UPTIME: ${Math.max(0,Math.floor(((context.now??Date.now())-s.started)/1000))} seconds`);break;
      case 'date':r=result(context.date||new Date().toLocaleDateString());break;
      case 'time':r=result(context.time||new Date().toLocaleTimeString());break;
      case 'echo':r=result(rawArgs||'');break;
      case 'history':r=result(s.history.map((h,i)=>`${String(i+1).padStart(2,'0')}  ${h}`));break;
      case 'clear':r=result([], [{type:'clear'}]);break;
      case 'exit':
        if(PROGRAMS.includes(section))r=result(section+'.exe // program closed',[{type:'navigate',section:'root'}]);
        else if(s.flight)r=endFlight(s);
        else if(s.guess){s.guess=null;r=result('NUMBER GAME ENDED.',[],['guess','simulate']);}
        else if(previousFollowup?.kind==='rps')r=result('ROCK PAPER SCISSORS ENDED.',[],['rps','snake']);
        else r=result('CHANNEL REMAINS OPEN. Session retained.',[{type:'collapse'}]);break;
      case 'cancel':
        if(PROGRAMS.includes(section))r=result(section+'.exe // program closed',[{type:'navigate',section:'root'}]);
        else if(previousFollowup)r=result(previousFollowup.kind==='rps'?'ROCK PAPER SCISSORS ENDED.':['CANCELLED.','The open question was dropped. Nothing was opened or sent.'],[],['help']);
        else if(s.flight)r=endFlight(s);
        else if(s.guess){s.guess=null;r=result('NUMBER GAME ENDED.',[],['guess','simulate']);}
        else r=result(['NOTHING TO CANCEL.','No question, game or program is active. Fold hides the console; Ctrl+C clears typed input.'],[],['help']);break;
      case 'fold':r=result('CONSOLE FOLDED. Progress retained.',[{type:'collapse'}]);break;
      case 'reset':if(args==='confirm'){const fresh=createSession({rng:s.rng,now:context.now??Date.now()});Object.assign(s,fresh);r=result('LOCAL SESSION RESET. No site, account or game files were changed.');}else r=result('This resets local discoveries and text games. Type reset confirm to proceed.');break;
      case 'green':r=/^[012]$/.test(args)?result(`GREEN STEP ${args}.`,[{type:'green',step:+args}]):usage();break;
      case 'glow':r=['tight','original'].includes(args)?result('LIGHT: '+args.toUpperCase(),[{type:'glow',mode:args}]):usage();break;
      case 'motion':r=['reduce','system'].includes(args)?result(args==='reduce'?'REDUCED MOTION ENABLED.':'FOLLOWING YOUR SYSTEM MOTION PREFERENCE.',[{type:'motion',mode:args}]):usage();break;
      case 'banner':r=result([' V E C T O R',' === D R I F T ===','       /\\','      /__\\']);break;
      case 'stars':r=result(Array.from({length:7},()=>Array.from({length:36},()=>s.rng()<.08?'*':s.rng()<.08?'.':' ').join('')));break;
      case 'map':r=result(['RELAY MAP [FICTIONAL]','LOCAL ---- ARCHIVE ---- [UNASSIGNED]','              |','           SIGNAL 1187',`route .... ${s.traced?'recovered':'unlocated'}`],[],['scan','trace 1187']);break;
      case 'ping':r=result([`RELAY SELF-TEST: ${args||'local'}`,'SIMULATED echo: 001 ms / 002 ms / 001 ms','No packet was sent to a real server.'],[],['scan']);break;
      case 'scan':s.scanCount++;discover(s,'signal');r=result(['RELAY SURVEY',`pass .................. ${s.scanCount}`,'ordinary channels ..... nominal','unassigned return ..... 1187',s.scanCount>1?'The return persists. Repeating the survey will not identify its owner.':'The directory does not list a corresponding owner.'],[],['trace 1187','map']);break;
      case 'trace':if(!s.scanCount)r=result('NO SIGNAL ACQUIRED. Survey the relay first.',[],['scan']);else if(!['1187','signal','ghost','orphan'].includes(args))r=result('Target not acquired. The current return is 1187.',[],['trace 1187']);else{s.traced=true;r=result(['TRACE 1187','origin ................ local','owner ................. unassigned','archive route ......... /root/archive/1187.log','The file was not in the first listing.'],[],['cat /root/archive/1187.log']);}break;
      case 'decode':case 'rot13':r=args?result('ROT13: '+rot13(rawArgs||args)):usage();break;
      case 'archive':r=result(['RECOVERY INDEX',`signal ........ ${s.scanCount?'ACQUIRED':'UNLOCATED'}`,`1187.log ...... ${s.discoveries.includes('1187.log')?'READ':s.traced?'MOUNTED':'UNLOCATED'}`],[],nextSteps(s));break;
      case 'journal':case 'inventory':r=result(s.discoveries.length?['RECOVERED IN THIS SESSION',...s.discoveries.map(x=>'> '+x)]:['NO FRAGMENTS RECOVERED.'],[],nextSteps(s));break;
      case 'profile':{s.profileSeen=true;const exploratory=(s.categories.explore||0)+(s.categories.story||0),practical=(s.categories.site||0)+(s.categories.files||0);r=result(['LOCAL DRIFT PROFILE',`exploration actions ... ${exploratory}`,`practical actions ..... ${practical}`,`game actions .......... ${s.categories.games||0}`,`repeated scans ........ ${s.scanCount}`,`classification ........ ${exploratory>practical?'CURIOUS':practical>exploratory?'DIRECT':'UNASSIGNED'}`,'Sample source: only commands typed into this local console.',...(s.lastFlight?[`last trial actions .... fire ${s.lastFlight.aggression} / evade ${s.lastFlight.evasion} / collect ${s.lastFlight.greed}`]:[]),'Profile scope: this terminal session only.'],[],['privacy','mission']);break;}
      case 'lux':r=result(['LUX FIELD','A resource used in the Vector Drift upgrade loop.','Try collecting and spending it in a practice run.'],[],['simulate']);break;
      case 'factions':r=result(['CONTACT INDEX','GEOMETRY .... enforcement','HUNGER ...... mutation','SALVAGE ..... opportunism','FIELD ....... designation unresolved','Query a known name with dossier <name>.'],[],['dossier axiom','dossier xenophage','dossier varrax']);break;
      case 'dossier':if(FACTIONS[args])r=result(FACTIONS[args]);else if(['observer','cortex','consent','organic','ghost','1980','0x00007f00'].includes(args))r=result([args.toUpperCase()+' // INTERFACE FRAGMENT',rotate(s,'dossier',['Owner field: unassigned.','The record predates your current session.','A local endpoint is present. Authority remains unresolved.'])],[],['scan','profile']);else r=result('No identified dossier for '+(args||'that input')+'.',[],['factions']);break;
      case 'mission':r=result(['OPTIONAL RELAY RECOVERY','1. Survey the relay.','2. Trace the unassigned return.','3. Read the recovered log.',s.discoveries.includes('1187.log')?'STATUS: RECOVERY COMPLETE.':'STATUS: INCOMPLETE'],[],[nextSteps(s)[0]]);break;
      case 'hint':r=result(['NEXT STEP: '+nextSteps(s)[0],s.discoveries.includes('1187.log')?'You recovered the record. Try a flight trial or inspect your profile.':'You can click the suggestion or ask to look around, follow the signal, or read the file.'],[],[nextSteps(s)[0]]);break;
      case 'guess':{
        if(!args){if(s.flight){r=result('A practice flight is active. End it before starting the number game.',[],['dock']);break;}s.guess={secret:1+Math.floor(s.rng()*20),attempts:0};r=result('NUMBER LOCK: 1–20. Six attempts. Reply with a number, or use guess <number>.');break;}
        if(!s.guess){r=result('Start a number lock with guess first.',[],['guess']);break;}
        const value=Number(args);if(!/^\d+$/.test(args)||value<1||value>20){r=usage();break;}
        s.guess.attempts++;if(value===s.guess.secret){r=result(`LOCK OPEN after ${s.guess.attempts} attempt(s).`);s.guess=null;}else if(s.guess.attempts>=6){r=result(`LOCK CLOSED. The number was ${s.guess.secret}.`,[],['guess']);s.guess=null;}else r=result(`${value<s.guess.secret?'HIGHER':'LOWER'}. ${6-s.guess.attempts} attempts remain.`);break;
      }
      case 'rps':{const choices=['rock','paper','scissors'];if(!args){s.followup={kind:'rps'};r=result('Rock, paper, or scissors? Reply with your choice, or use rps <choice>.',[],choices.map(choice=>'rps '+choice));break;}if(!choices.includes(args)){r=usage();break;}s.followup={kind:'rps'};const other=random(s,choices),win=choices[(choices.indexOf(args)+2)%3]===other;r=result([`YOU: ${args} / RELAY: ${other} / ${args===other?'DRAW':win?'YOU WIN':'RELAY WINS'}`,'Another round? Choose rock, paper, or scissors.'],[],choices.map(choice=>'rps '+choice));break;}
      case 'roll':{const m=(args||'1d6').match(/^(\d{1,2})d(\d{1,3})$/);if(!m||+m[1]<1||+m[1]>6||+m[2]<2||+m[2]>100){r=result('Use roll NdM: 1–6 dice, 2–100 sides.');break;}const values=Array.from({length:+m[1]},()=>1+Math.floor(s.rng()*+m[2]));r=result(values.join(' + ')+' = '+values.reduce((a,b)=>a+b,0));break;}
      case 'flip':r=result(random(s,['HEADS','TAILS'])+'. The relay denies any bias.');break;
      case 'fortune':r=result(rotate(s,'fortune',['A clean trajectory is still a trajectory someone can predict.','The cheapest upgrade is knowing when to leave.','What you collect is not the only thing being counted.','The next return may belong to you.']));break;
      case 'joke':r=result(rotate(s,'joke',['Why did the pilot bring a ladder? The difficulty kept scaling.','I told the ship to take a break. It entered an infinite loop.','There are 10 kinds of pilots: those who understand binary and those who dodge.']));break;
      case 'haiku':r=result(['Cold vectors divide','A pilot follows the light','The ledger stays warm']);break;
      case 'calc':try{r=result('= '+calculate(args));}catch(error){r=result('CALC: '+error.message);}break;
      case 'binary':case 'hex':{if(!args){r=usage();break;}if((rawArgs||args).length>80){r=result('Encode at most 80 characters at once.');break;}const bytes=new TextEncoder().encode(rawArgs||args);r=result([...bytes].map(b=>b.toString(id==='hex'?16:2).padStart(id==='hex'?2:8,'0')).join(' '));break;}
      case 'simulate':if(s.guess){r=result('A number game is active. Type exit to end it first.',[],['exit']);break;}if(s.flight){r=result(`TRIAL ALREADY ACTIVE. HULL ${s.flight.hull} / LUX ${s.flight.lux}.`,[],['fire','evade','dock']);break;}s.flight={hull:5,lux:0,weapon:1,shield:0,turn:0,kills:0,aggression:0,evasion:0,greed:0,contact:3};r=result(['TEXT FLIGHT TRIAL // FICTIONAL','HULL 5 / LUX 0 / CONTACT 3','Choose shoot, dodge or take the LUX. Commands fire / evade / collect work too. End the trial with dock.','Input source: LOCAL TRIAL'],[],['fire','evade','collect']);break;
      case 'fire':case 'evade':case 'collect':case 'upgrade':case 'dock':{
        const f=s.flight;if(!f){r=result('NO FLIGHT TRIAL ACTIVE.',[],['simulate']);break;}
        if(id==='dock'){r=endFlight(s);break;}
        if(id==='upgrade'){if(!['weapon','shield'].includes(args)){r=usage();break;}if(f.lux<3){r=result('UPGRADE COST: 3 LUX. Current balance: '+f.lux);break;}f.lux-=3;if(args==='weapon')f.weapon++;else f.shield+=2;r=result(`UPGRADE APPLIED: ${args.toUpperCase()}. LUX ${f.lux}.`);break;}
        f.turn++;
        if(id==='fire'){f.aggression++;f.contact-=f.weapon;if(f.contact<=0){f.kills++;f.lux+=2;f.contact=3;r=result(['CONTACT CLEARED. +2 LUX.','A new return enters the field.']);}else r=result('CONTACT INTEGRITY: '+f.contact);}
        if(id==='evade'){f.evasion++;r=result('TRAJECTORY CHANGED. This turn avoids incoming damage.');}
        if(id==='collect'){f.greed++;f.lux+=2;r=result('LUX CACHE TAKEN. +2 LUX. Exposure increased.');}
        if(id!=='evade'&&(f.turn%2===0||id==='collect')){if(f.shield>0){f.shield--;r.lines.push('SHIELD ABSORBED A HIT.');}else{f.hull--;r.lines.push('HULL -1.');}}
        r.lines.push(`HULL ${f.hull} / LUX ${f.lux} / WEAPON ${f.weapon} / SHIELD ${f.shield}`);
        if(f.hull<=0){r.lines.push('TRIAL TERMINATED. No real ship was harmed.');s.flight=null;r.suggestions=['simulate'];}else r.suggestions=['fire','evade','upgrade shield','dock'];break;
      }
      case 'snake':case 'pi':r=result(`LOADING ${id}.exe`,[{type:'program',name:id}]);break;
      case 'ost':r=result(['OPENING THE OST PREVIEWS.','23 tracks, 45-second clips, each with its own cover. Space pauses, N skips, Esc leaves.'],[{type:'program',name:'ost'}]);break;
      case 'sudo':r=result(rotate(s,'sudo',['LOCAL AUTHORITY UNAVAILABLE.','REMOTE AUTHORITY DECLINED.','REQUEST RECORDED. No privileges changed.']),[],['whoami','privacy']);break;
      case 'privacy':r=result(['LOCAL CONSOLE STATE','Commands, discoveries and text games live in this page memory.','No analytics, real gameplay telemetry, AI service or network calls power this console.','A typed email address opens signup, filled in. It is sent to the mailing list (Kit) only when you press SIGN UP, and is never added to history.','Narrative observation refers to this fictional relay.','Reload clears this session.']);break;
      default:r=result('Command handler unavailable.',[],['help']);
    }
    return finish(r);
  }
  function complete(raw){
    const text=String(raw||'').toLowerCase();
    const match=text.match(/^(help|man|cd|open|dossier|frame|green|glow|motion) (.*)$/);
    if(match){const [,head,prefix]=match;const values=head==='help'?[...CATEGORIES,'all']:head==='man'?COMMANDS.map(c=>c.id):head==='dossier'?Object.keys(FACTIONS):head==='frame'?['1','2','3','4','5','6']:head==='green'?['0','1','2']:head==='glow'?['tight','original']:head==='motion'?['reduce','system']:['about','media','devlog','links','download','discord','email','guide','home'];return values.filter(x=>x.startsWith(prefix)).map(x=>head+' '+x);}
    const q=text.trim();if(!q)return [];return COMMANDS.map(c=>c.id).filter(id=>id.startsWith(q));
  }
  return {COMMANDS,CATEGORIES,createSession,execute,complete,calculate,rot13};
});
