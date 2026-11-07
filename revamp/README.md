# Isolated Vector Drift UX preview

Branch: `codex/site-ux-rework`.

Preview: http://localhost:8100/revamp/

All implementation changes are inside `revamp/`. The original root site, boot, audio, signup integration, download gate and Worker files are unchanged. This preview shares the existing font, intent vocabulary, Snake and pi assets. Media remains labelled sample art; signup is a local demonstration.

## Changes

- One shared home, directory, content pane and console. Home and Escape retain the session.
- Browser Back/Forward and direct section hashes work. Program routes can also be reopened.
- Clear game introduction, visible media and email actions, plain descriptions alongside filenames. Preview options are folded away.
- Assistance, controls, release questions and frame selection support ordinary wording as well as commands. Sentence failures do not receive unrelated single-word spelling guesses.
- Stop/quit ends the current game. Fold/close-console only hides the console. Practice and number games cannot silently replace each other.
- RPS suggestions use full commands. Context-dependent yes/no and play-choice buttons expire after another interaction.
- New replies start at their beginning; older output stays scrollable. Read all opens the full response in the content pane; each response has its own history entry (`#reference/<id>`) and a reloaded id falls back to the console guide with a notice. Reopening the console shows the latest lines. Resizing preserves the automatic transcript anchor until the visitor scrolls manually.
- Phone controls have at least 44px height. Short landscape layouts scroll normally, retain a sticky console, and keep the media viewer visible.

## Run and verify

From this worktree:

```sh
python3 -m http.server 8100
node --test revamp/console-tests/*.test.cjs
npm test
```

96 preview tests and 35 existing production tests pass (counts as of the 2026-11-06 second-audit fixes). Headless Chrome (CDP, scripted input) exercised: wrong-game wording, per-response Back/Forward, guide routing, cancel/pause, reload of a stale reader URL, scrolled-transcript READ ALL clicks (including content growing during a press), stale yes/no, rapid navigation, and 390×844, 844×390 and 320×568 layouts. Not verified: Safari, audio, a physical phone keyboard, a physical mouse, and the original intermittent READ ALL miss (never reproduced, so the pointer-hold guard is a hardening, not a confirmed cause fix).


## Review checklist

1. Open media, type `echo remember this`, click the logo. History remains. Visit About then Links; use browser Back and Forward.
2. Try `help me`, `what commands can I use`, `show me the controls`, `can you tell me when the demo comes out`, and `show me frame 3`.
3. Enter `rps`, then `echo ready`, then click the earlier Rock button. It still plays a round.
4. Enter `download`, then `echo move on`. The earlier yes/no options are visibly disabled. A fresh download question accepts `yes please`.
5. Enter `simulate`, `collect`, `stop the game`, `simulate`. The second run starts with hull 5 and LUX 0. Try `close the console` during a run; reopening retains it.
6. Enter `help all`, click Read all, and scroll the main content. The console remains available. Type another command from there.
7. Test portrait and landscape, then repeat with the phone keyboard open.

Edge cases to stress: switch sections immediately after a frame command; resize while reading output or scrolling older history; stop Snake/pi from the parent console; type a draft and fold/reopen; try an expired reply after navigating elsewhere.

Local reload resets the session. No live email submissions or downloads occur in this preview. Nothing has been deployed or pushed.

## OST preview player (2026-11-06)

`ost` (also `music`, `soundtrack`, "play some music", the **[ LISTEN TO THE OST ]** button in the media heading) opens `ost.exe`, a third console program next to snake and pi. It plays 45-second preview clips of all 23 tracks with each track's own 1024px cover (480px copy). Keys: Space/Enter play-pause, Up/Down or P/N track, Left/Right seek 5 s, +/- volume, Q/Esc quit; the ASCII bar is click-to-seek; rows are clickable; OS media keys and lock-screen art work via the Media Session API.

- Assets: `revamp/ost/NN.mp3` (96 kbps, starts 20% in, 0.4 s fade-in, 2 s fade-out, no embedded art) and `NN.jpg`. About 12.8 MB total. **Full tracks are never shipped.** Rebuild with `revamp/build-ost-previews.sh "<OST folder>"` (it prints the title table that `ost.js` embeds; tracks are ordered alphabetically by file name).
- Autoplay: allowed only when the visitor typed/clicked to open it. A deep link (`#ost`) or Back lands on "PRESS ENTER OR CLICK A TRACK TO PLAY".
- Porting to the real site: copy `ost.js` + `ost/`, load `ost.js` where `snake.js`/`pi.js` load, add `media-src 'self'` (audio currently falls back to `default-src`), and duck or stop the boot hum while the player runs.

## Live-readiness pass (2026-11-06)

Made the preview shippable as a site: all mockup/placeholder wording removed (page title, review bar is now "DISPLAY OPTIONS", section copy, console strings); every page ends in onward actions and a persistent footer (contact, jonsimo.com, Instagram) so there are no dead ends; the top logo is the home link from every state (sections, programs, guide, console open). New `contact` section (`yo@jonsimo.com`, `https://www.jonsimo.com`, `https://www.instagram.com/jonsimo`; command `contact`, "who made this", rail button, footer). The email page now posts to Kit through `../uplink.js` (same public form as the live terminal): validation, sending state, double-submit guard, success and failure messages with a mailto fallback; a typed address in the console pre-fills the form and is only sent on SIGN UP. Discord has no invite yet: set `DISCORD_URL` in `sections.js` and the rail/section become a real external link.

Not verified: a real subscription (tested with a stubbed fetch; Kit's CORS preflight answers 200), Safari/iOS, audible OST. **Deploying is not done**: this lives in `revamp/` on `codex/site-ux-rework`; making it the live site needs a decision on `/revamp/` vs replacing the root, plus the root CSP (`connect-src` already allows app.kit.com; add `media-src 'self'` for the OST).

Second pass (same night): Discord invite wired (`https://discord.gg/Z8Kt8cDUX8`, verified valid and non-expiring via Discord's invite API); external links checked (discord, jonsimo.com, instagram all 200; jonsimo.com has Google MX for yo@); 131 internal buttons/links clicked across all sections with zero dead ends; console exercised from 20 section/command combinations plus from inside the OST and snake programs; history Back/Forward walk; phone nav and console. Fixed: console `previous`/`prev`; media thumbnails and rail were clipped by the new footer on 768px-tall laptops (now fit down to 720px tall except a 5px rail scroll; 650px tall still scrolls the media page).

## Boot -> site handoff (2026-11-06, Jon's call: option 1)

Flow: boot and logo reveal (unchanged) -> the first console message is a directory outline (`about.txt`, `media/`, `devlog/`, `links.lnk`, `download.exe`) with the reticle pointer -> clicking a file clears the console lines bottom-up, fades the hum, saves the big logo's on-screen box in `sessionStorage` (`vd_handoff`) and loads `revamp/?from=boot#<section>`, where `arrive-head.js` keeps the first paint black, `arrive.js` lands the masthead logo from that box and then loads the page in line by line. The old terminal stays fully typeable below the outline.

- Root files: `handoff.js` (+ `handoff.css`) prints the outline and runs the departure; `reticle.js` (+ `reticle.css`) is the CSP-safe production pointer (the mockup `revamp/dir-cursors.js` and its chips are no longer loaded). `terminal.js` changes: calls `VDHandoff.printOutline()` after the logo and before the prompt (desktop and mobile), fires `vd:console-ready`, adds `VDFadeOutAudio`, and skips the boot when coming back (Back button or the site footer's `terminal` link, only after a handoff this session).
- Direct visits to `/revamp/` are unchanged (no animation). Stale (>15 s), forged or reduced-motion handoffs are ignored and the page never stays hidden (3.5 s failsafe).
- Verified in headless Chrome: outline on desktop and 390px, hover lock, click -> departure -> arrival for media and about, Back and `?terminal` land on logo + outline + prompt in about 1 s with a working console. Not verified: audible hum fade, Safari, a real phone, a real touch tap.
