# Vector Drift console: audit and command reference

Local review artifact — 2026-11-04. This is the isolated revamp preview on codex/site-ux-rework. Regenerate examples with `node revamp/build-console-reference.cjs`.

## Findings

- The original split mockup had section navigation and basic help/history, but no substantial command interpreter or games.
- The existing production intent layer has 12 intent groups and 143 natural-language aliases. The mockup preserves that vocabulary and adds 79 command families, arguments, utilities, exploration, and games.
- Both interfaces work together: `open media`, `run media.exe`, and “show me the game” open the same view. No mode switch is needed.
- Short answers use explicit context: yes/no after an updates question; numbers during a number game; rock/paper/scissors after that game prompts; next picture in media.
- Ambiguous requests ask a short question. Unrecognized text gets a response and clickable suggestions. This is a scripted interpreter and does not understand arbitrary conversation.
- The demo remains unavailable. Email requests open a local signup preview; nothing is automatically submitted. Recognized addresses and credential-style input are omitted from echo and history.

## Architecture and ownership

- `console-language.js` interprets ordinary phrases and follow-up replies into canonical commands or clarification text. It owns no UI, network access, or game execution.
- `console-engine.js` owns session history, pending questions, discoveries, game state, counters and response selection. Both input styles use its same handlers and effects. Original visitor wording is preserved in recall and echo.
- Pending questions are cleared by unrelated commands. An old confirmation cannot affect a newer interaction.
- `sections.js` owns focus/hover, a bounded scrollable transcript, readable suggestion labels, whitelisted effects, and cancellable navigation. First opening shows four clickable starting points. Suggestion tooltips expose their command when different.
- Snake/pi use a same-origin frame; their keyboard listeners cannot consume parent console input. Removing the frame disposes its timers and listeners.
- State is local to page memory. Reload resets it. There is no remote AI, shell execution, physical filesystem access or actual game telemetry.
- Production boot/audio, real signup, Worker and download gate are unchanged.

## Try both styles

| Command / run-dialogue input | Ordinary wording |
| --- | --- |
| `open media` / `run media.exe` | Show me the game |
| `frame 2` | Next picture (uses current frame) |
| `email` | Keep me updated |
| `download` | Can I play? → yes please / no thanks |
| `snake` / `run snake.exe` | Play snake |
| `simulate` → `fire` → `evade` → `dock` | Fly a practice run → shoot them → play it safe → I am done |
| `guess` → `guess 10` | Guess a number → 10 |
| `rps` → `rps rock` | Rock paper scissors → rock |
| `scan` → `trace 1187` → `cat /root/archive/1187.log` | Look around → follow it → read that file |
| `help all` / `man scan` | What can I do? |

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

### DISCOVERY

#### `help [category|all]`

Browse commands by topic.

Aliases: `help`, `?`, `commands`, `command list`, `show commands`, `what can i do`, `what do i do`, `options`, `menu`, `instructions`.

Input: `help`

```text
Pick a request, or type help all for every command.
```

Suggestions: `Show me the game`, `Tell me about the game`, `Look around`, `Play something`.

#### `man <command>`

Usage and examples for one command.

Aliases: `man`, `manual`.

Input: `man scan`

```text
scan
Survey the relay for an unassigned signal.
CATEGORY: explore
ALSO: scan, scan sector, scan system
```

#### `apropos <word>`

Find commands by name or description.

Aliases: `apropos`.

Input: `apropos game`

```text
cancel — Drop a pending question or end the active game or program.
fold — Fold the console while retaining game progress.
reset confirm — Reset only this local console story/game session.
guess [1-20] — Play a six-attempt number game.
```

#### `suggest`

Get three useful next actions.

Aliases: `suggest`, `surprise me`, `what next`, `guide me`.

Input: `suggest`

```text
NEXT TRANSMISSIONS
> scan
> simulate
> help games
```

Suggestions: `scan`, `simulate`, `help games`.

### FILES

#### `ls [-alh] [path]`

List the mounted virtual files.

Aliases: `ls`, `dir`, `list`, `files`, `show files`.

Input: `ls`

```text
about.txt  media/  devlog/  links.lnk  download.exe
readme.txt  controls.txt  archive/
Only virtual site files are mounted.
```

Suggestions: `cat readme.txt`, `scan`.

#### `tree`

Show the virtual directory tree.

Aliases: `tree`.

Input: `tree`

```text
/root
|-- about.txt
|-- media/ [6 frames]
|-- devlog/
|-- links.lnk
|-- download.exe [HELD]
|-- readme.txt
|-- controls.txt
`-- archive/ [UNLOCATED]
```

#### `pwd`

Show the current site path.

Aliases: `pwd`, `path`, `current directory`.

Input: `pwd`

```text
/root
```

#### `cd <section|..>`

Move between site sections.

Aliases: `cd`.

Input: `cd about`

```text
OPENED /root/about
```

Effects: `[{"type":"navigate","section":"about"}]`.

#### `open <file|section>`

Open a section or read a virtual file.

Aliases: `open`, `run`, `start`, `execute`.

Input: `open media`

```text
Opening the media view.
OPENED /root/media
```

Effects: `[{"type":"navigate","section":"media"}]`.

Suggestions: `Can I play?`, `Keep me updated`.

#### `cat <file>`

Read a virtual text file.

Aliases: `cat`, `read`, `type`, `less`, `more`.

Input: `cat readme.txt`

```text
VECTOR DRIFT RELAY
Ask normally or use commands. Use help all for the full catalog; Tab completes names.
This console is a self-contained interface.
Nothing typed here runs on your computer as a shell command.
```

#### `find <word>`

Search virtual file names.

Aliases: `find`, `locate`, `search`.

Input: `find readme`

```text
/root/readme.txt
```

### SITE

#### `guide`

Open the console guide.

Aliases: `guide`, `console guide`, `command guide`, `command reference`.

Input: `guide`

```text
OPENING CONSOLE GUIDE.
```

Effects: `[{"type":"navigate","section":"reference","view":"guide"}]`.

#### `home`

Return to the expanded /root directory.

Aliases: `home`, `root`, `back`.

Input: `home`

```text
OPENED /root/
```

Effects: `[{"type":"navigate","section":"root"}]`.

#### `about`

Read about Vector Drift.

Aliases: `about`, `about.txt`, `info`, `information`, `what is vector drift`, `tell me about the game`.

Input: `about`

```text
OPENED /root/about
```

Effects: `[{"type":"navigate","section":"about"}]`.

#### `media`

Open the media archive.

Aliases: `media`, `media/`, `media.exe`, `screenshots`, `framegrabs`, `show screenshots`.

Input: `media`

```text
OPENED /root/media
```

Effects: `[{"type":"navigate","section":"media"}]`.

#### `trailer`

There is no trailer yet; opens the screenshots.

Aliases: `trailer`, `video`, `videos`, `watch trailer`, `play trailer`, `gameplay`.

Input: `trailer`

```text
THERE IS NO TRAILER YET.
Opening the framegrabs instead.
```

Effects: `[{"type":"navigate","section":"media"},{"type":"frame","number":1}]`.

#### `frame <1-6>`

Select an individual framegrab.

Aliases: `frame`, `screenshot`.

Input: `frame 2`

```text
FRAME 02 SELECTED.
```

Effects: `[{"type":"navigate","section":"media"},{"type":"frame","number":2}]`.

#### `devlog`

Open development updates.

Aliases: `devlog`, `devlog/`, `news`, `updates`.

Input: `devlog`

```text
OPENED /root/devlog
```

Effects: `[{"type":"navigate","section":"devlog"}]`.

#### `links`

Open public links.

Aliases: `links`, `links.lnk`, `socials`, `social`.

Input: `links`

```text
OPENED /root/links
```

Effects: `[{"type":"navigate","section":"links"}]`.

#### `discord`

Open the Discord page.

Aliases: `discord`, `join discord`, `community`.

Input: `discord`

```text
OPENED /root/discord
```

Effects: `[{"type":"navigate","section":"discord"}]`.

#### `contact`

Show how to reach Jon Simo: email, website and Instagram.

Aliases: `contact`, `contact me`, `contact jon`, `contact info`, `contact details`, `get in touch`, `reach jon`, `who made this`, `who made this game`, `who made vector drift`.

Input: `contact`

```text
OPENED /root/contact
```

Effects: `[{"type":"navigate","section":"contact"}]`.

#### `email`

Open signup; nothing is sent until you press SIGN UP.

Aliases: `email`, `email.exe`, `signup`, `sign up`, `subscribe`, `newsletter`, `mailing list`, `join alpha`, `join beta`.

Input: `email`

```text
OPENED /root/email
```

Effects: `[{"type":"navigate","section":"email"}]`.

#### `download`

Show the held demo status.

Aliases: `download`, `download.exe`, `dl`, `install`.

Input: `download`

```text
ALPHA DEMO IS NOT YET AVAILABLE.
Want email updates when there is news?
```

Suggestions: `Yes please`, `No thanks`.

#### `alpha`

Show alpha access information.

Aliases: `alpha`, `alpha_tracker.exe`, `tracker`.

Input: `alpha`

```text
ALPHA RELAY
The demo is not available yet. No account or key is requested.
```

Suggestions: `email`, `download`.

#### `ost`

Play 45-second previews of the Vector Drift soundtrack, with cover art.

Aliases: `ost`, `ost.exe`, `music`, `soundtrack`, `jukebox`, `play music`, `play the ost`, `play ost`, `play the music`, `play the soundtrack`, `play some music`, `play songs`, `play the songs`.

Input: `ost`

```text
OPENING THE OST PREVIEWS.
23 tracks, 45-second clips, each with its own cover. Space pauses, N skips, Q quits.
```

Effects: `[{"type":"program","name":"ost"}]`.

### SYSTEM

#### `status`

Inspect this console session.

Aliases: `status`, `health`, `diag`, `diagnostics`, `system status`.

Input: `status`

```text
RELAY STATUS
interface ............. ONLINE
commands .............. 1
discoveries ........... 0/2
profile categories .... 1
download .............. HELD
command relay ......... LOCAL
```

Suggestions: `scan`, `simulate`.

#### `version`

Show the website console version.

Aliases: `version`, `ver`, `build`.

Input: `version`

```text
VECTOR DRIFT // WEBSITE CONSOLE
command families ....... 79
game build version .... not listed
```

#### `whoami`

Show your local terminal identity.

Aliases: `whoami`, `who am i`, `identify me`.

Input: `whoami`

```text
LOCAL VISITOR
identity .............. unassigned
authority ............. read-only
profile ............... console actions in this tab only
```

Suggestions: `profile`.

#### `hostname`

Show the fictional terminal host name.

Aliases: `hostname`.

Input: `hostname`

```text
vector_drift // fictional relay host
```

#### `uptime`

Show elapsed time in this console session.

Aliases: `uptime`.

Input: `uptime`

```text
SESSION UPTIME: 10 seconds
```

#### `date`

Display the current local date.

Aliases: `date`.

Input: `date`

```text
2026-11-04
```

#### `time`

Display the current local time.

Aliases: `time`.

Input: `time`

```text
12:00:00
```

#### `echo <text>`

Print text exactly as entered.

Aliases: `echo`.

Input: `echo`

```text
(no text output)
```

#### `history`

List recent commands.

Aliases: `history`, `recent`, `recent commands`, `command history`, `show history`.

Input: `history`

```text
01  history
```

#### `clear`

Clear output; retain discoveries and progress.

Aliases: `clear`, `cls`.

Input: `clear`

```text
(no text output)
```

Effects: `[{"type":"clear"}]`.

#### `cancel`

Drop a pending question or end the active game or program.

Aliases: `cancel`, `cancel that`, `never mind`, `nevermind`, `forget it`, `nvm`, `scrap that`.

Input: `cancel`

```text
NOTHING TO CANCEL.
No question, game or program is active. Fold hides the console; Ctrl+C clears typed input.
```

Suggestions: `help`.

#### `exit`

Close the active program, or fold the console.

Aliases: `exit`, `quit`, `close`, `logout`, `bye`, `goodbye`, `stop`.

Input: `exit`

```text
CHANNEL REMAINS OPEN. Session retained.
```

Effects: `[{"type":"collapse"}]`.

#### `fold`

Fold the console while retaining game progress.

Aliases: `fold`, `hide console`.

Input: `fold`

```text
CONSOLE FOLDED. Progress retained.
```

Effects: `[{"type":"collapse"}]`.

#### `reset confirm`

Reset only this local console story/game session.

Aliases: `reset`.

Input: `reset confirm`

```text
LOCAL SESSION RESET. No site, account or game files were changed.
```

#### `sudo [command]`

Ask for authority. It never grants real access.

Aliases: `sudo`.

Input: `sudo`

```text
LOCAL AUTHORITY UNAVAILABLE.
```

Suggestions: `whoami`, `privacy`.

#### `privacy`

Explain local state and the absence of tracking.

Aliases: `privacy`, `telemetry`, `tracking`.

Input: `privacy`

```text
LOCAL CONSOLE STATE
Commands, discoveries and text games live in this page memory.
No analytics, real gameplay telemetry, AI service or network calls power this console.
A typed email address opens signup, filled in. It is sent to the mailing list (Kit) only when you press SIGN UP, and is never added to history.
Narrative observation refers to this fictional relay.
Reload clears this session.
```

### APPEARANCE

#### `green <0|1|2>`

Compare small shifts toward green.

Aliases: `green`, `colour`, `color`.

Input: `green 1`

```text
GREEN STEP 1.
```

Effects: `[{"type":"green","step":1}]`.

#### `glow <tight|original>`

Choose the existing light comparison.

Aliases: `glow`, `bloom`.

Input: `glow tight`

```text
LIGHT: TIGHT
```

Effects: `[{"type":"glow","mode":"tight"}]`.

#### `motion <reduce|system>`

Reduce motion or follow the OS preference.

Aliases: `motion`.

Input: `motion reduce`

```text
REDUCED MOTION ENABLED.
```

Effects: `[{"type":"motion","mode":"reduce"}]`.

### TOYS

#### `banner`

Print a small ASCII Vector Drift mark.

Aliases: `banner`, `ascii`, `logo`.

Input: `banner`

```text
 V E C T O R
 === D R I F T ===
       /\
      /__\
```

#### `stars`

Print a small procedural star field.

Aliases: `stars`, `starfield`.

Input: `stars`

```text
         * *.. .   **      *     *
*                          .    *  .
               .            .*
    .     *           . *  .      ..
  .                           *    *
    *           .*    *
 . .               .  ..  *   ..
```

#### `fortune`

Read a changing terminal fortune.

Aliases: `fortune`.

Input: `fortune`

```text
A clean trajectory is still a trajectory someone can predict.
```

#### `joke`

Request low-quality terminal humour.

Aliases: `joke`, `tell me a joke`.

Input: `joke`

```text
Why did the pilot bring a ladder? The difficulty kept scaling.
```

#### `haiku`

Print a short drift poem.

Aliases: `haiku`, `poem`.

Input: `haiku`

```text
Cold vectors divide
A pilot follows the light
The ledger stays warm
```

#### `pi`

Launch the existing pi digit stream.

Aliases: `pi`, `pi.exe`, `pie`, `count pi`.

Input: `pi`

```text
LOADING pi.exe — the console remains available outside the program.
```

Effects: `[{"type":"program","name":"pi"}]`.

### EXPLORE

#### `map`

Inspect the relay map.

Aliases: `map`, `starmap`.

Input: `map`

```text
RELAY MAP [FICTIONAL]
LOCAL ---- ARCHIVE ---- [UNASSIGNED]
              |
           SIGNAL 1187
route .... unlocated
```

Suggestions: `scan`, `trace 1187`.

#### `ping [relay]`

Run a fictional relay self-test.

Aliases: `ping`.

Input: `ping`

```text
RELAY SELF-TEST: local
SIMULATED echo: 001 ms / 002 ms / 001 ms
No packet was sent to a real server.
```

Suggestions: `scan`.

#### `scan`

Survey the relay for an unassigned signal.

Aliases: `scan`, `scan sector`, `scan system`.

Input: `scan`

```text
RELAY SURVEY
pass .................. 1
ordinary channels ..... nominal
unassigned return ..... 1187
The directory does not list a corresponding owner.
```

Suggestions: `trace 1187`, `map`.

#### `trace <signal>`

Follow a discovered signal.

Aliases: `trace`, `traceroute`.

Setup: `scan`.

Input: `trace 1187`

```text
TRACE 1187
origin ................ local
owner ................. unassigned
archive route ......... /root/archive/1187.log
The file was not in the first listing.
```

Suggestions: `cat /root/archive/1187.log`.

#### `decode <text>`

Decode a ROT13 string.

Aliases: `decode`, `decrypt`.

Input: `decode uryyb`

```text
ROT13: hello
```

### STORY

#### `archive`

List recovered fragments and locked leads.

Aliases: `archive`, `archives`.

Setup: `scan` → `trace 1187`.

Input: `archive`

```text
RECOVERY INDEX
signal ........ ACQUIRED
1187.log ...... MOUNTED
```

Suggestions: `cat /root/archive/1187.log`, `journal`, `hint`.

#### `journal`

Summarize discoveries.

Aliases: `journal`, `log`, `logs`, `events`.

Setup: `scan` → `trace 1187` → `cat /root/archive/1187.log`.

Input: `journal`

```text
RECOVERED IN THIS SESSION
> signal
> 1187.log
```

Suggestions: `profile`, `factions`, `simulate`.

#### `profile`

Read a profile derived from your console actions.

Aliases: `profile`.

Setup: `scan`.

Input: `profile`

```text
LOCAL DRIFT PROFILE
exploration actions ... 2
practical actions ..... 0
game actions .......... 0
repeated scans ........ 1
classification ........ CURIOUS
Sample source: only commands typed into this local console.
Profile scope: this terminal session only.
```

Suggestions: `privacy`, `mission`.

#### `lux`

Inspect the LUX field.

Aliases: `lux`, `what is lux`, `tell me about lux`.

Input: `lux`

```text
LUX FIELD
A resource used in the Vector Drift upgrade loop.
Try collecting and spending it in a practice run.
```

Suggestions: `simulate`.

#### `factions`

Inspect partially identified contact groups.

Aliases: `factions`, `enemies`.

Input: `factions`

```text
CONTACT INDEX
GEOMETRY .... enforcement
HUNGER ...... mutation
SALVAGE ..... opportunism
FIELD ....... designation unresolved
Query a known name with dossier <name>.
```

Suggestions: `dossier axiom`, `dossier xenophage`, `dossier varrax`.

#### `dossier <name>`

Read a short faction identity fragment.

Aliases: `dossier`, `inspect`.

Input: `dossier axiom`

```text
AXIOM // CONTACT DOSSIER
Geometric machine enforcement.
Formation language: order, correction, recursion.
Authority source: [REDACTED]
```

#### `mission`

Start or inspect the relay recovery objective.

Aliases: `mission`, `objective`, `quest`.

Input: `mission`

```text
OPTIONAL RELAY RECOVERY
1. Survey the relay.
2. Trace the unassigned return.
3. Read the recovered log.
STATUS: INCOMPLETE
```

Suggestions: `scan`.

#### `hint`

Get a specific next step without restarting.

Aliases: `hint`.

Input: `hint`

```text
NEXT STEP: scan
You can click the suggestion or ask to look around, follow the signal, or read the file.
```

Suggestions: `scan`.

#### `inventory`

List recovered local fragments.

Aliases: `inventory`, `items`, `fragments`.

Setup: `scan` → `trace 1187` → `cat /root/archive/1187.log`.

Input: `inventory`

```text
RECOVERED IN THIS SESSION
> signal
> 1187.log
```

Suggestions: `profile`, `factions`, `simulate`.

### GAMES

#### `guess [1-20]`

Play a six-attempt number game.

Aliases: `guess`, `guess.exe`, `guess game`.

Input: `guess`

```text
NUMBER LOCK: 1–20. Six attempts. Reply with a number, or use guess <number>.
```

#### `rps <rock|paper|scissors>`

Play rock, paper, scissors.

Aliases: `rps`, `rock paper scissors`.

Input: `rps rock`

```text
YOU: rock / RELAY: paper / RELAY WINS
Another round? Choose rock, paper, or scissors.
```

Suggestions: `rps rock`, `rps paper`, `rps scissors`.

#### `roll [NdM]`

Roll up to six dice with up to 100 sides.

Aliases: `roll`, `dice`.

Input: `roll 2d6`

```text
4 + 3 = 7
```

#### `flip`

Flip a coin.

Aliases: `flip`, `coin`, `coinflip`.

Input: `flip`

```text
TAILS. The relay denies any bias.
```

#### `simulate`

Start a small turn-based flight trial.

Aliases: `simulate`, `launch`, `flight`, `play`.

Input: `simulate`

```text
TEXT FLIGHT TRIAL // FICTIONAL
HULL 5 / LUX 0 / CONTACT 3
Choose shoot, dodge or take the LUX. Commands fire / evade / collect work too. End the trial with dock.
Input source: LOCAL TRIAL
```

Suggestions: `fire`, `evade`, `collect`.

#### `fire`

Attack in the text flight trial.

Aliases: `fire`, `shoot`, `pew`, `pew pew`.

Setup: `simulate`.

Input: `fire`

```text
CONTACT INTEGRITY: 2
HULL 5 / LUX 0 / WEAPON 1 / SHIELD 0
```

Suggestions: `fire`, `evade`, `upgrade shield`, `dock`.

#### `evade`

Evade and study a contact in the text trial.

Aliases: `evade`, `dodge`, `left`, `right`.

Setup: `simulate`.

Input: `evade`

```text
TRAJECTORY CHANGED. This turn avoids incoming damage.
HULL 5 / LUX 0 / WEAPON 1 / SHIELD 0
```

Suggestions: `fire`, `evade`, `upgrade shield`, `dock`.

#### `collect`

Choose whether to risk taking LUX in the trial.

Aliases: `collect`, `loot`, `take lux`.

Setup: `simulate`.

Input: `collect`

```text
LUX CACHE TAKEN. +2 LUX. Exposure increased.
HULL -1.
HULL 4 / LUX 2 / WEAPON 1 / SHIELD 0
```

Suggestions: `fire`, `evade`, `upgrade shield`, `dock`.

#### `upgrade <shield|weapon>`

Spend trial LUX on a real state change.

Aliases: `upgrade`, `buy`.

Setup: `simulate` → `collect` → `collect`.

Input: `upgrade shield`

```text
UPGRADE APPLIED: SHIELD. LUX 1.
```

#### `dock`

End the text trial and read its diagnostic.

Aliases: `dock`, `land`, `abort`.

Setup: `simulate` → `evade`.

Input: `dock`

```text
TRIAL ENDED
LUX 0 / CONTACTS CLEARED 0
DRIFT PROFILE: CAUTIOUS
Your trial choices have been recorded in this session.
```

Suggestions: `profile`, `simulate`.

#### `snake`

Launch the existing ASCII Snake program.

Aliases: `snake`, `snake.exe`, `play snake`.

Input: `snake`

```text
LOADING snake.exe — the console remains available outside the program.
```

Effects: `[{"type":"program","name":"snake"}]`.

### TOOLS

#### `calc <expression>`

Arithmetic with parentheses and exponentiation.

Aliases: `calc`, `calculate`, `math`.

Input: `calc 2+2`

```text
= 4
```

#### `rot13 <text>`

Encode or decode a ROT13 string.

Aliases: `rot13`.

Input: `rot13 hello`

```text
ROT13: uryyb
```

#### `binary <text>`

Encode a short message as binary.

Aliases: `binary`.

Input: `binary hello`

```text
01101000 01100101 01101100 01101100 01101111
```

#### `hex <text>`

Encode a short message as hexadecimal.

Aliases: `hex`.

Input: `hex hello`

```text
68 65 6c 6c 6f
```
