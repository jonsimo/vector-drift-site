/* Plain-language interpretation for the SAME command engine. No network or AI
   service. Returns a canonical instruction or a short clarification; execution,
   progress, privacy, and side effects remain owned by console-engine.js. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.VDConsoleLanguage=api;})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const START=['Show me the game','Tell me about the game','Look around','Play something'];
  const GAMES=['Play snake','Play the OST'];
  const yes=/^(?:yes|yep|yeah|yea|yup|sure|ok|okay|absolutely|yes please|please do|go ahead|do it|sounds good|yes keep me updated)$/;
  const no=/^(?:no|nope|nah|no thanks|not now|maybe later|no thank you)$/;
  function normal(text){return String(text).replace(/[’‘]/g,"'").toLowerCase().trim().replace(/\s+/g,' ').replace(/[.!?,]+$/,'').replace(/\bu\b/g,'you').replace(/\bpls\b/g,'please');}
  const reply=(lines,suggestions=START,followup=null,topic=null)=>({reply:Array.isArray(lines)?lines:[lines],suggestions,followup,topic});
  const CUT=new Set(['map','scan','trace','decode','archive','journal','profile','lux','factions','dossier','mission','hint','inventory','guess','rps','roll','flip','simulate','fire','evade','collect','upgrade','dock']);
  const command=(value,topic=null,opening=null,suggestions=null)=>CUT.has(String(value).split(' ')[0])?null:({command:value,topic,opening,suggestions,followup:null});
  function interpret(raw,context={}){
    const t=normal(raw),s=context.session||{},pending=s.followup;
    if(!t)return null;
    if(pending?.kind==='updates'){
      if(yes.test(t))return command('email','updates','Opening the email signup. You choose whether to submit your address.');
      if(no.test(t))return reply('No problem. What would you like to try instead?');
    }
    if(pending?.kind==='play-choice'){
      if(/^(?:vector drift|the game|the actual game|the real game|first|the first one|1)$/.test(t))return command('download','availability');
      if(/^(?:something here|a console game|in here|here|second|the second one|2)$/.test(t))return reply('Pick something to play.',GAMES,{kind:'games'},'games');
      if(yes.test(t))return reply('Which one: Vector Drift, or something to play here?',['Vector Drift','Something here'],pending,'games');
      if(no.test(t))return reply('No problem. The channel stays open.');
    }
    if(pending?.kind==='rps'&&['rock','paper','scissors'].includes(t))return command('rps '+t,'rps');
    if(yes.test(t))return reply('Sure. What would you like to do?',START);
    if(no.test(t))return reply('Understood. We can try something else.',START);
    if(s.guess){const guess=t.match(/^(?:(?:i think|maybe|is it|my guess is|i guess) )?(\d{1,2})$/);if(guess)return command('guess '+guess[1],'guess');}

    // Exact technical syntax is untouched unless the wording below explicitly
    // expresses the same action in ordinary language.
    const request=t
      .replace(/^(?:hey|hi|hello)[, ]+(?=can|could|would|i |show|tell|please)/,'')
      .replace(/^(?:(?:can|could|would|will) you (?:please )?|please )/,'')
      .replace(/^(?:i would like to |i'd like to |i want to |i wanna |let me |can i )/,'')
      .replace(/^please /,'')
      .replace(/\s+(?:please|pls)$/,'');

    if(/^(?:hi|hello|hey|yo|hello there|hi there)$/.test(t))return reply('Link established. What would you like to do?',START,null,'welcome');
    if(/^(?:i'?m new|i am new|i'?m lost|i am lost|idk|i don'?t know|where do i start|what should i try|what should i do|what can i do|what can i do here|help me|i need help|help please|show me help|what commands can i use|what can i type|how do i use this|how does this work|i don'?t know commands|i can'?t use command line)$/.test(t))return reply('Commands or everyday requests work here. Pick a starting point.',START,null,'welcome');
    if(/^(?:what is this|what'?s this|what kind of game is this|what is this game|what'?s vector drift|what is vector drift|what'?s the game about)$/.test(t)||/^(?:tell me about|explain) (?:the game|vector drift)$/.test(request))return reply(['Vector Drift is a retro vector space shooter for macOS, Windows and Linux.','Want to see it or check whether you can play?'],['Show me the game','Can I play?','Keep me updated'],null,'about');
    if(/^(?:show me|show|see|view|open|look at|take me to) (?:the |some )?(?:game|vector drift|screenshots|pictures|photos|images|media|framegrabs)(?: please)?$/.test(request)||/^(?:got any|do you have any|where are the) (?:screenshots|pictures|photos|images)$/.test(t))return command('media','media','Opening the media view.',['Can I play?','Keep me updated']);
    if(/^(?:show me|show|see|watch|play|open) (?:the |some )?(?:trailer|video|gameplay|gameplay video)(?: please)?$/.test(request)||/^(?:got any|do you have a|is there a) (?:trailer|video)$/.test(t))return command('trailer','media',null,['Can I play?','Keep me updated']);
    if(/^(?:show me|show|open|view|see) (?:the )?(?:frame|screenshot|picture) (\d+)$/.test(request))return command('frame '+request.match(/(\d+)$/)[1],'media');
    if(/^(?:show me|show|open|see|read) (?:the )?(?:controls|keyboard controls|console controls|website controls)$/.test(request)||/^(?:controls|keyboard shortcuts|what are the controls)$/.test(t))return command('cat controls.txt','controls','Website console controls:');
    if(/^(?:how do i play|how to play|what are the game controls|show me the game controls)$/.test(t))return reply(['The full demo is not available here yet.','You can see the game or try a small text practice run in the console.'],['Show me the game','Fly a practice run','Keep me updated'],null,'about');
    if(/^(?:tell me|do you know|when|what|is there|any news).*(?:release|comes? out|coming out|release date|when.*(?:ready|available))/.test(request)||/^(?:release date|when is it out|when is the demo available)$/.test(t))return reply(['No release date is confirmed here.','Want email updates when there is news?'],['Yes please','No thanks'],{kind:'updates'},'availability');
    if(/^(?:tell me when it'?s out|let me know when it'?s (?:out|ready|available)|i want updates|i'?d like updates|keep me updated|keep me posted|keep me informed|i want to sign up|i'?d like to sign up|sign me up|notify me|send me updates|email me updates|yes keep me updated)$/.test(t)||/^(?:get|receive|sign up for) (?:email )?(?:updates|announcements|news)$/.test(request))return command('email','updates','Opening the signup view.');
    if(/^(?:can i play|can i play it|can i play the game|can i try it|can i download it|is the demo available|is it out|is it available|where can i get it|where do i get it|how can i download the game|where can i download it|i want to download it)$/.test(t)||/^(?:play|download|install|try) (?:the game|the demo|it|vector drift)$/.test(request))return command('download','availability');
    if(/^(?:i want to play|i'?d like to play|i wanna play|can we play|let'?s play)$/.test(t))return reply('Do you mean Vector Drift, or something to play here?',['Vector Drift','Something here'],{kind:'play-choice'},'games');
    if(/^(?:i'?m bored|i am bored|entertain me|something fun|play something|what can i play|what can i play here|let me play a game)$/.test(t)||/^(?:play|try) (?:a game|a minigame|a mini game|something fun)$/.test(request))return reply('Pick something to play.',GAMES,{kind:'games'},'games');
    if(/^(?:(?:fly|do|start|try|begin|play|launch|run) (?:a |the |my )?(?:practice (?:run|mission|flight)|flight (?:trial|test|sim|simulation|game)|text flight(?: trial| game)?|simulation)|practice flying|try the flight trial)$/.test(request))return command('simulate','flight');
    if(/^(?:(?:play|start|do|try|begin|launch|let'?s play) )?(?:a |the )?(?:number(?: guessing)? game|guessing game|number guess(?:ing)?|guess(?:ing)? (?:a |the )?number(?: game)?)$/.test(request)||/^let'?s guess a number$/.test(t))return command('guess','guess');
    if(/^(?:(?:play|start|do|try|let'?s play) )?(?:a |the |some )?(?:rock[ ,-]*paper[ ,-]*scissors|rps)(?: game)?$/.test(request))return command('rps','rps');
    if(/^(?:(?:play|start|launch|open|run|put on|hear|listen to|show me|show|let me hear|let me listen to|i want to hear|i want to listen to|i'?d like to hear|listen to|can i hear|can i listen to|can you play|let'?s hear|let'?s listen to) )?(?:a |the |some |your |vector drift )*(?:ost|o\.s\.t|soundtrack|music|songs?|tunes|tracks|jukebox)(?: previews?| samples?| clips?)?(?: player)?(?: for me)?$/.test(request)||/^(?:what does it sound like|what does the game sound like|is there (?:any )?music|do you have (?:any )?music|got any music)$/.test(t))return command('ost','ost');
    if(/^(?:how (?:do|can) i (?:contact|reach|email|get in touch with) (?:you|jon|the dev|the developer|the creator)|where can i contact (?:you|jon)|who(?:'s| is) (?:behind|making) (?:this|the game|vector drift))$/.test(t))return command('contact','contact','Opening contact details.');
    if(/^(?:play|start|launch|try|let'?s play) (?:a |the |some )?(?:game of )?snake(?: game| program)?$/.test(request))return command('snake','snake');
    if(/^(?:show me|show|open|view|see|read|take me to|go to|where is) (?:the |a )?(?:console |command |commands |site )?(?:guide|reference)$/.test(request))return command('guide','guide','Opening the console guide.');
    if(/^(?:cancel|stop|abort|forget) (?:that|this|it)$/.test(request)||/^(?:cancel|forget|drop) (?:the |that )?(?:question|request)$/.test(request))return command('cancel');
    if(/^(?:pause|pause (?:the |this )?(?:game|trial|flight|practice run)|hold on|wait|wait a (?:sec|second|moment)|one moment)$/.test(request)){
      if(pending)return reply('Take your time. The question is still open.',pending.kind==='updates'?['Yes please','No thanks']:START,pending,'availability');
      if(s.flight)return reply(['The trial is turn-based: it already waits for your next input.','Nothing advances until you act. End it any time with dock.'],['fire','evade','dock'],null,'flight');
      if(s.guess)return reply('The number lock waits for your next guess. Nothing advances on its own.',['help'],null,'guess');
      return reply('Nothing is running, so there is nothing to pause. The console only acts when you do.',START);
    }
    if(/^(?:flip a coin|toss a coin)$/.test(t))return command('flip','games');
    if(/^(?:roll a die|roll a dice|roll some dice)$/.test(t))return command('roll','games');
    if(/^(?:show me the links|where can i follow you|show me your socials|social links)$/.test(t))return command('links','links','Opening the links.');
    if(/^(?:join the discord|take me to discord|i want to join discord|where is the discord)$/.test(t))return command('discord','links','Opening the Discord view.');
    if(/^(?:what'?s new|any news|show me the updates|development updates|show me the devlog)$/.test(t))return command('devlog','news','Opening development updates.');
    if(/^(?:go back|take me back|back to the start|take me home|back to the menu|show me the menu)$/.test(t))return command('home','welcome','Back to the directory.');
    if(/^(?:clear the screen|clear this|clear the console|clean this up)$/.test(t))return command('clear');
    if(/^(?:what should i investigate|give me a hint|i need a hint)$/.test(t))return command('hint','explore');
    if(/^(?:what have i found|what did i find|show my discoveries|show me what i found)$/.test(t))return command('journal','explore');
    if(/^(?:what do you know about me|what have you learned about me|show my profile)$/.test(t))return command('profile','profile');
    if(/^(?:look around|look for something unusual|show me something strange|look for a signal|is there anything here|what else is here|tell me a secret)$/.test(t))return command('scan','explore');
    if(/^(?:follow (?:it|that|the signal|that signal)|look closer|investigate (?:it|that|the signal)|what'?s that signal|what is that signal|where does it lead|trace that signal)$/.test(t))return command(s.scanCount?'trace 1187':'scan','explore');
    if(/^(?:read (?:it|that|the file|that file|the record|that record)|open (?:it|that file)|show me the file|what does it say)$/.test(t)){
      if(s.conversationTopic!=='explore')return reply('Which file would you like to read? You can ask to look around or show the files.',['Look around','ls']);
      if(!s.scanCount)return command('scan','explore');
      if(!s.traced)return command('trace 1187','explore');
      return command('cat /root/archive/1187.log','explore');
    }
    if(/^(?:more|tell me more|go on|keep going|what next|what now|what does that mean|i don'?t understand|explain that)$/.test(t)){
      if(s.conversationTopic==='explore'||s.conversationTopic==='scan')return command(!s.scanCount?'scan':!s.traced?'trace 1187':!s.discoveries?.includes('1187.log')?'cat /root/archive/1187.log':'journal','explore');
      if(['about','media'].includes(s.conversationTopic)||context.section==='media')return reply('Want to see another picture, check availability, or get updates?',['Show me another picture','Can I play?','Keep me updated'],null,'media');
      return reply('We can look around, see the game, or play something.',START);
    }
    if(/^(?:next|next picture|next screenshot|next one|the next one|another one|another picture|show me another picture|show me the next picture|show me another screenshot)$/.test(t)&&(['media'].includes(s.conversationTopic)||context.section==='media')){
      const current=Number.isInteger(context.frame)?context.frame:(s.lastFrame||0);
      return command('frame '+(current%6+1),'media','Showing the next frame.');
    }
    if(/^(?:previous|prev|previous picture|previous screenshot|previous one|the previous one|last picture|go back a picture|show me the previous picture|show me the previous screenshot)$/.test(t)&&(['media'].includes(s.conversationTopic)||context.section==='media')){
      const current=Number.isInteger(context.frame)&&context.frame>0?context.frame:(s.lastFrame||1);
      return command('frame '+((current+4)%6+1),'media','Showing the previous frame.');
    }
    if(/^(?:stop the game|end the game|quit the game|stop playing|end this game|quit playing)$/.test(request))return command('exit','games');
    if(/^(?:close|hide|minimize|fold) (?:the )?console$/.test(request))return command('fold');
    if(s.flight){
      if(/^(?:shoot them|shoot it|attack it|attack|fire at them|use my weapon)$/.test(t))return command('fire','flight');
      if(/^(?:get out of the way|avoid it|dodge it|move out of the way|play it safe)$/.test(t))return command('evade','flight');
      if(/^(?:take the reward|take it|grab it|grab the lux|take the lux|collect it|grab the loot)$/.test(t))return command('collect','flight');
      if(/^(?:i want a better shield|upgrade my shield|buy a shield|get a better shield)$/.test(t))return command('upgrade shield','flight');
      if(/^(?:upgrade my weapon|buy a better weapon|get a better weapon)$/.test(t))return command('upgrade weapon','flight');
      if(/^(?:i'?m done|i am done|that'?s enough|end the trial|stop the trial|finish the trial|stop playing)$/.test(t))return command('dock','games');
    }
    if(/^(?:i'?m done|i am done|close this|close the console|stop playing|quit the game)$/.test(t))return command('exit');
    if(request!==t)return interpret(request,context);
    return null;
  }
  const LABELS={help:'What can I do?',media:'Show me the game',about:'Tell me about the game',email:'Keep me updated',discord:'Join the Discord',scan:'Look around','trace 1187':'Follow that signal','cat /root/archive/1187.log':'Read that file',journal:'What have I found?',profile:'What do you know about me?',simulate:'Fly a practice run',snake:'Play snake',guess:'Guess a number','help games':'What can I play?',fire:'Shoot',evade:'Dodge',collect:'Take the LUX','upgrade shield':'Upgrade my shield',dock:'End the trial',mission:'What should I investigate?',hint:'Give me a hint','rps rock':'Rock','rps paper':'Paper','rps scissors':'Scissors','cat controls.txt':'Console controls',fold:'Close console',guide:'Open the console guide'};
  function label(command){return LABELS[command]||command;}
  return {interpret,label,START,GAMES};
});
