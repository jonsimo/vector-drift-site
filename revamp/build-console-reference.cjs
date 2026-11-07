/* Regenerate the local audit's examples from the same engine used in-browser. */
const fs=require('node:fs');
const E=require('./console-engine.js');
const V=require('../terminal-intents.js');
const fresh=()=>E.createSession({rng:V.makeRng(42),now:1000});
const ctx={section:'root',now:11000,date:'2026-11-04',time:'12:00:00'};
const run=(input,s)=>E.execute(input,s,ctx);
const inputs={man:'man scan',apropos:'apropos game',cd:'cd about',open:'open media',cat:'cat readme.txt',find:'find readme',frame:'frame 2',reset:'reset confirm',green:'green 1',glow:'glow tight',motion:'motion reduce',trace:'trace 1187',decode:'decode uryyb',dossier:'dossier axiom',rps:'rps rock',roll:'roll 2d6',calc:'calc 2+2',rot13:'rot13 hello',binary:'binary hello',hex:'hex hello',upgrade:'upgrade shield'};
const setup={trace:['scan'],archive:['scan','trace 1187'],journal:['scan','trace 1187','cat /root/archive/1187.log'],inventory:['scan','trace 1187','cat /root/archive/1187.log'],profile:['scan'],fire:['simulate'],evade:['simulate'],collect:['simulate'],upgrade:['simulate','collect','collect'],dock:['simulate','evade']};
let md=`# Vector Drift console: audit and command reference

Local review artifact — 2026-11-04. This is the isolated revamp preview on codex/site-ux-rework. Regenerate examples with \`node revamp/build-console-reference.cjs\`.

## Findings

- The original split mockup had section navigation and basic help/history, but no substantial command interpreter or games.
- The existing production intent layer has 12 intent groups and 143 natural-language aliases. The mockup preserves that vocabulary and adds ${E.COMMANDS.length} command families, arguments, utilities, exploration, and games.
- Both interfaces work together: \`open media\`, \`run media.exe\`, and “show me the game” open the same view. No mode switch is needed.
- Short answers use explicit context: yes/no after an updates question; numbers during a number game; rock/paper/scissors after that game prompts; next picture in media.
- Ambiguous requests ask a short question. Unrecognized text gets a response and clickable suggestions. This is a scripted interpreter and does not understand arbitrary conversation.
- The demo remains unavailable. Email requests open a local signup preview; nothing is automatically submitted. Recognized addresses and credential-style input are omitted from echo and history.

## Architecture and ownership

- \`console-language.js\` interprets ordinary phrases and follow-up replies into canonical commands or clarification text. It owns no UI, network access, or game execution.
- \`console-engine.js\` owns session history, pending questions, discoveries, game state, counters and response selection. Both input styles use its same handlers and effects. Original visitor wording is preserved in recall and echo.
- Pending questions are cleared by unrelated commands. An old confirmation cannot affect a newer interaction.
- \`sections.js\` owns focus/hover, a bounded scrollable transcript, readable suggestion labels, whitelisted effects, and cancellable navigation. First opening shows four clickable starting points. Suggestion tooltips expose their command when different.
- Snake/pi use a same-origin frame; their keyboard listeners cannot consume parent console input. Removing the frame disposes its timers and listeners.
- State is local to page memory. Reload resets it. There is no remote AI, shell execution, physical filesystem access or actual game telemetry.
- Production boot/audio, real signup, Worker and download gate are unchanged.

## Try both styles

| Command / run-dialogue input | Ordinary wording |
| --- | --- |
| \`open media\` / \`run media.exe\` | Show me the game |
| \`frame 2\` | Next picture (uses current frame) |
| \`email\` | Keep me updated |
| \`download\` | Can I play? → yes please / no thanks |
| \`snake\` / \`run snake.exe\` | Play snake |
| \`simulate\` → \`fire\` → \`evade\` → \`dock\` | Fly a practice run → shoot them → play it safe → I am done |
| \`guess\` → \`guess 10\` | Guess a number → 10 |
| \`rps\` → \`rps rock\` | Rock paper scissors → rock |
| \`scan\` → \`trace 1187\` → \`cat /root/archive/1187.log\` | Look around → follow it → read that file |
| \`help all\` / \`man scan\` | What can I do? |

Technical controls remain: Tab completion (including arguments), Up/Down recall, Ctrl+C cancels input, Escape folds the console; / focuses it. Empty submissions offer starting suggestions.

## Narrative scope

The supplied PDF and newer SITE_CONSOLE_COMMAND_IDEAS_2026-11-04.html are reference material, including their embedded proposals. The newer command ideas and read-only game boot source supersede the earlier cipher draft.

- Exploration is optional: scan acquires a signal, trace locates a record, reading it records a discovery. Repetition acknowledges progress.
- The recovered record echoes public boot details: 1187 samples, one unassigned signature, observer absence, unassigned cortex owner and unresolved authority.
- The former encoded reveal and fourth recovery step were removed. Decode remains a general ROT13 utility; it cannot unlock a story fragment.
- No clean Messenger dialogue or website-only essential story explanation was added. Existing mockup narrative copy remains draft writing rather than finalized canon.
- Profile reflects console categories and practice-trial choices only.
- The game's suggested command list is not a claim of implemented parity: many entries in the HTML are proposals. No game files were edited.

## Verification

Prototype tests (node --test revamp/console-tests/*.test.cjs) and the 35 production tests (npm test) pass at generation time; run them for current counts. Tests cover all existing aliases, paired CLI/conversation effects, stale confirmations, ambiguous play requests, context-sensitive numbers, media wraparound, exploration order, game-state equivalence, privacy and literal CLI arguments.

Browser checks: natural-language media navigation, next frame, held availability → clickable yes → signup view, bare-number guessing, conversational three-step recovery, run-dialogue navigation, and flagged directory listing. The 390px layout has 44px phone controls and fits without horizontal overflow. The 844×390 landscape viewer remains visible. Home preserves the console session; Back/Forward restores sections and the exact full response that was open. Old RPS buttons remain executable and old yes/no replies are disabled. Long answers open in the persistent shell content pane. Safari, a physical mouse and real phone keyboard behavior remain unverified.

## Full command reference

Samples below execute the actual engine with a seeded session. Setup inputs are listed where needed. Output may vary for rotating or random replies.
`;
for(const category of E.CATEGORIES){
 md+='\n### '+category.toUpperCase()+'\n';
 for(const c of E.COMMANDS.filter(x=>x.category===category)){
  const s=fresh();for(const input of setup[c.id]||[])run(input,s);
  const input=inputs[c.id]||c.id,r=run(input,s);
  md+='\n#### `'+c.usage+'`\n\n'+c.description+'\n\nAliases: '+c.aliases.map(a=>'`'+a+'`').join(', ')+'.\n';
  if(setup[c.id])md+='\nSetup: '+setup[c.id].map(x=>'`'+x+'`').join(' → ')+'.\n';
  md+='\nInput: `'+input+'`\n\n```text\n'+(r.lines.join('\n')||'(no text output)')+'\n```\n';
  if(r.effects.length)md+='\nEffects: `'+JSON.stringify(r.effects)+'`.\n';
  if(r.suggestions.length)md+='\nSuggestions: '+r.suggestions.map(x=>'`'+x+'`').join(', ')+'.\n';
 }
}
fs.writeFileSync(__dirname+'/CONSOLE_COMMAND_AUDIT.md',md.replace(/[ \t]+$/gm,''));
process.stdout.write('Updated reference for '+E.COMMANDS.length+' command families.\n');
