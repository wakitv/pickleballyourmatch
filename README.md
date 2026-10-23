# PickleMatch v6.5 — Batch Winners

## What changed in v6.5
- The Top List is now organised into **numbered batches**, one per published session, newest first:

```
Batch Winners #2      2026-10-23 · session BBB22
  🥇 TOP 1   ana     CHAMPION · 4W / 0L
  🥈 TOP 2   ben     RUNNER-UP · 3W / 1L
  🥉 TOP 3   cleo    THIRD PLACE · 2W / 2L

Batch Winners #1      2026-10-21 · session AAA11
  🥇 TOP 1   mark    CHAMPION · 3W / 0L
  ...
```

- **Scanning a badge lands on its batch.** The result reads *"Official — Batch Winners #1"*, links straight to that batch, and highlights both the batch and the winner's row.
- **Publish winners** assigns the batch number: a new session opens the next batch, and re-publishing a session already on the list updates that batch instead of opening a duplicate. Verified both ways — a second session became #3, and re-publishing it reported "0 new winners" and left the count at 9 across 3 batches.
- The batch number is part of each entry's SHA-256 hash, so it cannot be changed without the fingerprint saying so.

**Note:** this changes the hash format. A `toplist.json` published before v6.5 will report a fingerprint mismatch — press **Publish winners** again to regenerate it.

## What changed in v6.3
### Scanning a badge opens a public Top List page
Badge QR codes no longer open the app — they open **`/toplist/`**, a page of its own that shows the scanned badge's result and the published winners list it is checked against. On GitHub Pages that is `https://<user>.github.io/<repo>/toplist/`.

A scan lands on one of five answers, so nothing is ambiguous:

| | |
|---|---|
| **Official** | The badge is intact and appears on the published list |
| **Genuine, not published** | The badge is intact but this result has not been published yet |
| **Does not match** | A badge with this code is listed, but with different details |
| **Altered** | The result on the badge does not match the checksum in its QR |
| **Not a badge** | The link carries nothing we can read |

### How "no one can edit it" actually works
Worth being plain about this, because it shapes the design. PickleMatch is a static site with no server, so a badge **cannot** be cryptographically signed: any key shipped to a browser is public, and a signature anyone can forge proves nothing. Pretending otherwise would be security theatre.

What does work, and is genuinely strong:

- **The published list is the record.** `toplist/toplist.json` lives in the repository, so changing it means pushing a commit. That is a real boundary — GitHub accounts, not JavaScript — and every change is in the repository's history.
- **Every entry is fingerprinted.** Each row carries a SHA-256 hash of its own contents, and the list carries a hash over all of them. The Top List page recomputes both rather than trusting the file, so an edited list is flagged on sight. Tested by editing a published record: the scan was rejected *and* the fingerprint was reported as not matching.
- **Every badge carries a checksum**, so an edited badge is caught before the list is even consulted. Renames, inflated records and rank promotions were all rejected in testing.
- **Every entry has a unique id** — session plus badge code — so two winners can never collide.

`sha256.js` implements SHA-256 in-house (checked against the standard vectors and 600 random inputs cross-checked against Node, including the million-character case) because `crypto.subtle` only exists in a secure context, and the list gets read over plain http on the local network at a court.

### Publish winners
**Publish winners** in the Top 3 Badges screen merges the session's podium into the existing list, recomputes the hashes, and saves a `toplist.json`. Replace `toplist/toplist.json` with it and push. The app deliberately cannot write to the repository itself — that is what makes the list trustworthy.

### Tap a badge to enlarge it
Tapping a badge opens it full screen so a player can photograph or screenshot their own, with the name and code beneath it. Escape, the close button, or a tap outside dismisses it.

## What changed in v6.0
- **Badges now sit on the pickleball artwork** instead of a plain black crest. The illustration fills the badge, dimmed under a scrim that is heaviest at the top and bottom so the gold lettering, the record and the QR all stay readable, and the text carries a soft dark halo over the busier middle.
- **W/L is the only stat on a badge now.** Score, games and rating are gone from the badge, from the QR payload and from the Badge check screen, so what you scan matches what you see.
- Dropping three stats made the QR payload much shorter, which keeps a typical GitHub Pages URL at a low QR version — the modules stay chunky and easy to scan. The decorative laurels were removed too; the artwork carries that job now.
- **Saving still works, and says so when it cannot.** Drawing an image into a canvas locks it against read-back when the page is opened straight from a file, which would break Save PNG. The badge screen now checks for that as it draws and explains the fix (run `serve.bat`, or use the Pages link) instead of failing on the click. Served or published, saving works normally.
- `badge-bg.webp` is the artwork, resized to 1000x1000 and re-encoded to 140 KB from the 375 KB original.

## What changed in v5.8
### Ready to publish on GitHub Pages
PickleMatch is a plain folder of HTML, CSS and JavaScript with no build step and no dependencies, so GitHub Pages can serve it as-is.

**To publish it:**
1. Push this folder to a GitHub repository.
2. In the repository, open **Settings → Pages**.
3. Under *Build and deployment*, set **Source** to *Deploy from a branch*, pick your branch and the **/ (root)** folder, and Save.
4. After a minute the app is live at `https://<your-username>.github.io/<repo-name>/`.

Details that were checked rather than assumed:
- **Every asset path is relative**, so the app works just as well at `/<repo-name>/` as at a domain root. Tested by serving it under a subdirectory and confirming the page, all five scripts and the stylesheet load, badges generate, and the QR carries the subpath correctly.
- **File names match their references exactly**, including case — GitHub Pages serves from Linux, where `App.js` and `app.js` are different files.
- **`.nojekyll`** stops GitHub from running the files through Jekyll.
- **`.gitignore`** keeps the editor's `.claude/` folder and exported session files out of the repository.

**Badge QR codes get better on Pages.** A badge's QR holds a link back to the page it was made on, so a badge made at `localhost` opens nowhere on someone else's phone. Published to Pages, the link is a public HTTPS address that any phone can open — which is what makes the Badge check screen useful. The badge screen now tells you which address the QR will use and warns when that address only works on your own computer.

### Running it locally
`serve.bat` (double-click on Windows) or `python serve.py` starts the app on your own network, prints a `http://192.168.x.x:8000/` address your phone can reach, and opens it. Use that address rather than `localhost` so locally made badges are scannable too. It also serves with no-cache headers, so edits show up on reload without bumping the `?v=` numbers.

### Smaller QR, bigger badge
The badge is now 680x960 and its QR is drawn larger, while the payload got shorter (compact date, rating as hundredths). Together those keep a typical Pages URL at QR version 6-7, so the modules stay chunky enough to scan off a phone screen rather than needing a printout.

## What changed in v5.6
### Get Top 3 Badges
- A gold **Get Top 3 Badges** button now sits in the **Top Players** header. It builds a crest for each of the top three — crown, laurels, **TOP 1 / 2 / 3**, the player's name, their score, games, W/L and rating, the session date, and a QR code. **Save PNG** downloads any of them to share.
- Each badge carries a **verification code** (like `T1-Q1YPWC`) and a QR holding the same result. Scanning it opens PickleMatch's **Badge check** screen, which reads the details back and says whether they still match the code.
- **What the check is and is not.** PickleMatch runs entirely in your browser, so the code is a *check code*, not a signature: it catches a badge whose details have been edited (rename the player, bump the score, promote Top 3 to Top 1 — all are rejected), but it cannot prove the badge came from an official event, because anyone running the app could mint one. The verify screen says this plainly rather than implying more.
- **Served vs opened from disk.** Over `http://` or `https://` the QR holds a link back to the app, so a phone opens the Badge check screen. Opened straight from the file (`file://`) there is no URL worth sharing, so the QR holds readable text instead — the result in plain words, with the code. To get the scannable verify link, run `serve.bat` or publish to GitHub Pages.

### A QR encoder, written in-house
PickleMatch still ships no libraries, so `qr.js` generates the codes itself — byte mode, ECC level L and M, versions 1 to 15, with Reed-Solomon error correction and all eight data masks scored by the standard's penalty rules.

It was checked two ways rather than trusted:
- **Against a reference encoder**, module for module, across payload lengths covering every supported version at both ECC levels. Two real bugs turned up and were fixed: the two format-information copies were written to each other's positions, and the Reed-Solomon generator polynomial was built constant-term-first but consumed leading-term-first, which corrupted every error-correction codeword.
- **By decoding the result with an independent decoder** (jsQR): 56 of 56 payloads round-tripped exactly, including Unicode names, both ECC levels and two render scales. The finished badges were then re-scanned straight off the rendered canvas to confirm the QR survives the badge artwork at its printed size.

## What changed in v5.4
- **The teams are now Red and Blue.** The left pair wear red, the right pair blue, across the pixel match, the scoreboard and the Arena buttons. They read far better against the green court than the old lime and mint did. The fault call (NET / OUT) moved to amber so it is never mistaken for the red team.
- **The free-pesos clock is every 20 minutes**, not every hour. Time away still counts, capped at 24 top-ups (8 hours, ₱2,400).
- **The clock does not start until you first press Generate Matches.** Until then the Arena says so instead of showing a timer that is not running; go broke before starting it and the line reads *"Out of pesos — press Generate Matches to start the ₱100 timer"*. Later presses do not restart it, and Reset puts it back to dormant along with the fresh ₱1,000.
- Verified: the clock starts on the first press and only the first, 65 minutes away pays ₱300, a dormant clock pays nothing however long you are gone, a very long absence caps at ₱2,400, and 19 minutes pays nothing while 20 pays ₱100.

## What changed in v5.3
- **Reset now gives you a fresh ₱1,000** in Pickle Arena, along with a clean W/L record, a stake back at 100 and the top-up clock back to dormant. The confirm dialog says so before you commit.
- If a bet is **riding when you Reset**, the game it was on is thrown away and the stake is simply gone with it — the wallet goes straight to ₱1,000, and the abandoned match pays out nothing when it finishes.
- The wallet still lives in its own `picklematch_arena` key and is still left out of session Export / Import. Reset is now the one place the two meet, over a `picklematch:reset` event, so `app.js` has no dependency on the Arena being loaded.
- **Reset is deliberately a second way back in.** Run out of pesos and you can either wait an hour for the ₱100 top-up or press Reset for a clean ₱1,000. Reset also clears the whole session, so it is not a free refill during real play — but on an empty board it is instant.

## What changed in v5.2
### Pickle Arena — bet on the match in the hero
A side game sitting under the hero animation. Back one of the two teams, and if they win your stake comes back **doubled**.

- **Wallet starts at ₱1,000.** Pick **Red Team** or **Blue Team**, set a stake (−/+ in 50s, or the 50 / 100 / 250 / 500 / ALL IN presets), and press **Start game**. The stake leaves your wallet straight away.
- The hero animation **resets to 0-0 and plays a fresh game to 11** for your bet, at 3x the ambient pace — about 70-90 seconds, longer if it goes to deuce. A caret on the scoreboard marks the side you backed, and the Arena bar shows the live score.
- A bet keeps playing even if you **scroll the hero out of view or switch tabs**. The ambient animation still pauses to save battery, but a riding stake holds the match open, and time lost to a background tab is made up when you come back (up to 5 minutes).
- Win and you get **2x your stake back** (a ₱250 bet returns ₱500). Lose and the stake is gone. Your running W/L shows in the bar.
- **₱100 is added every 20 minutes** (every hour until v5.4), with a live countdown. Lose everything and the wait to be back in is short. Time away counts, capped at 24 top-ups (₱2,400) so a long absence cannot hand you a fortune.
- Stakes can never exceed the wallet — presets above your balance grey out, ALL IN takes exactly what is left, and the + button stops at your balance.
- Closing the tab mid-game **refunds the stake** on your next visit, since the game it was riding on is gone.
- It is **play money only**: nothing is purchased, nothing is cashed out, and the wallet lives in its own `picklematch_arena` localStorage key — so it is never part of a session Export (from v5.3, Reset does refill it).
- Tested: win and loss payouts, the stake cap, an empty wallet, one / three / one-hundred hours away, an interrupted bet, and a clock moved backwards.

## What changed in v5.1
### The hero animation now plays real points to 11
The pixel scene is no longer a loop of the same rally. It simulates a doubles game, so the play and the winner are different every time.

- **Shot types, with the tactics to match.** Every rally runs the pattern a real doubles point does: **serve** (underhand, cross-court) → **return** → **third-shot drop** → a **dink** battle at the kitchen → someone **speeds it up** with a drive → a **block**, a **lob** or a **smash** ends it. Each shot has its own arc, speed and swing — a dink is struck low and soft, a drive is flat and fast, a smash is taken from above the head and comes down steeply. The shot's name flashes over the player as they hit it.
- **Players move like a doubles team.** The serving team starts at the baseline, the returner follows their return in, and the serving team works up to the kitchen line behind their third shot — so points end with all four at the net, which is where doubles is really played. A lob pushes a team back off the line.
- **Rallies end the way they do in real life:** a put-away winner, a ball into the net, or one sailing out, each with its own call (WINNER / NET / OUT). The chance of each depends on the shot — a smash usually ends it, a dink rarely does.
- **Scored to 11, win by 2**, with a scoreboard at the top and a dot marking the serving side. When a game ends the score flashes with **GAME**, then a fresh game starts 0-0 with a random server. Rallies run about 7 shots, so the score moves every few seconds.
- Simulated over 20 minutes of play while testing: all 8 shot types appear at believable rates, rallies end in a sensible mix of winners and errors, and games finished 11-8, 11-5, 12-10 and so on — win-by-2 included.
- Still cheap to run: 16fps, and it stops drawing entirely when the tab is hidden or the hero is scrolled out of view. With `prefers-reduced-motion: reduce` it draws a single still frame and never animates.
- **Note for editing:** `index.html` loads the CSS and JS with a version query (`app.js?v=6.5`). Bump that number whenever you edit `style.css`, `app.js` or `hero-scene.js`, or browsers will keep serving the old cached copy.

## What changed in v5.0
### Pixel-art doubles rally in the hero
- The hero's body text is gone — the "Rotation board" label and the paragraph of explanation. In their place is an **animated pixel-art scene of four players rallying in doubles**, under the kept "Fair matches. Continuous play." heading. The Session live / Courts / Active matches chips and the Generate Matches button are unchanged.
- The scene is drawn pixel by pixel onto a small 200x59 canvas that CSS blows up with `image-rendering: pixelated`, so it stays crisp and chunky at any width and needs no image files.
- It is a real rally, not a loop of canned frames: the ball flies on an arc from one paddle to the other, and the player about to hit winds up, swings through contact and follows through. The two players on each side take turns, so all four play.
- Each player has their own hair, skin tone, paddle and kit, with the left pair in lime and the right pair in mint.
- Built to stay cheap: it runs at 14fps (pixel art reads better a little under 60), and **stops drawing entirely** when the tab is hidden or the hero is scrolled off screen. With `prefers-reduced-motion: reduce` it draws a single still frame and never animates.
- Lives in its own file, `hero-scene.js`, and touches nothing in the session logic.
- CSS and JS are now loaded with a version query (`style.css?v=…`) so browsers pick up changes instead of serving a stale cached copy.

## What changed in v4.9
### Fixed partners (Match settings)
- New **Fixed partners** card in Match Settings. Pick two players and press **Lock pair** to keep them on the same team for the rest of the session — the "me and my partner play together all night" case.
- A locked pair is picked as **one unit**: both play or neither does. If one partner is in the other match, has reached the games-per-player limit, or does not match a court's skill level, the pair waits instead of being split up.
- The usual **"avoid recent partners" penalty is switched off** for a locked pair, so the matchmaker never fights the partnership you set.
- **Fair rotation is unchanged.** Of every combination that adds up to 4 players, only those with the fewest games played survive; pairing quality and randomness choose among those. Verified over 120 rounds with 2 locked pairs and 10 players: every player finished on exactly the same number of games, and the pairs were never split.
- Each pair shows its live status — **Ready**, **In play now**, **Court 1 / 2 only**, **Waiting — <name> reached the game limit**, or **No court matches both levels** — so it is obvious when a partnership is blocking itself.
- **UNLINK** ends a partnership at any time; removing a player from the rotation dissolves theirs automatically (the confirm dialog says so).
- **CHANGE** leaves locked players out of the substitute list, because bringing one in without their partner would break their partnership. If you substitute a paired player the dialog warns that it splits them **for that round only** — the partnership stays on for the matches after it.
- Generate Matches explains a pair-related stall instead of failing silently, e.g. *"Ann + Bob: one partner has reached the 5-game limit, so the pair cannot play. Raise the limit or unlink them in Match settings."*
- Court cards mark the locked team with **🤝 Fixed pair**, and the Player List tags each partner with their partner's name.
- Saved with the session and included in Export / Import. Sessions from v4.8 and earlier import with no pairs.
- **Fix:** on phones the Match Settings grid could scroll sideways because the Court 1 / Court 2 Min and Max steppers sat side by side. They now stack, and settings cards can no longer stretch the grid past the screen.

## What changed in v4.8
### Court skill levels (Match settings)
- New **Court skill levels** card in Match Settings. Turn it on and each court is reserved for a rating band, so you can run **Court 1 for beginners and Court 2 for 3.0 and up** at the same time.
- Each active court gets its own editor: quick levels (**Any level, Beginner, Intermediate, Advanced, 3.0 & up**) plus **Min / Max** steppers for a custom band in 0.1 steps.
- The edges are open-ended on purpose: **Min 2.0 means no lower limit** and **Max 5.0 means no upper limit**, so a player whose PDDR rating drifts past the slider range is never locked out of an "Any level" court.
- Each court card shows a live count — "4 of 8 players match this level" — and turns amber when fewer than 4 players qualify, which is the point where that court cannot be filled.
- **Generate Matches** only picks players whose rating fits the court. The most restrictive court is filled first, so an "Any level" court cannot steal the last beginner from a beginners-only court. If one court is short it still fills the other and says why: *"Court 1 (Beginner · Up to 2.9): only 1 available player at that level — 4 needed."*
- **CHANGE** substitutes must match the court too, so swapping a player cannot quietly put a 4.5 on the beginners court.
- Fair rotation is unchanged, it just applies inside each band: among the players a court accepts, fewest games plays next, ties to the longest wait. Note that a band with fewer players gives each of them more games — 5 players sharing a court play more often than 6 sharing the other.
- Matches **already in play are never changed** when you edit a level, and a pending match is never cancelled.
- The hero shows a chip like "⭐ C1 Up to 2.9 · C2 3.0 & up"; each match card shows its court's level; the Player List tags players with "Court 1 only" / "Court 2 only", or "No matching court" if their rating falls between two bands.
- Switching to **1 Court** hides the Court 2 editor but keeps its setting for when you switch back.
- The setting is saved with the session and included in Export / Import. Sessions from v4.7 and earlier import with the feature simply off.

## What changed in v4.7
- **Export now saves the complete session** with a date and time in the file name (e.g. `picklematch-session-2026-10-10_1924.json`). The file contains:
  - `state`: everything the app needs to continue exactly where you left off: players (ratings, starting ratings, W/L, games, partner/opponent history, removed players), every match (finished and active, scores, rating changes, player changes), courts and games-per-player settings.
  - `summary`: the full leaderboard / top players, as easy-to-read standings (rank, score, W/L, point difference, rating) and every match result with player names.
  - `app`, `version`, `exportedAt`.
- **New Import button** (next to Export). Pick a saved `.json` file and a preview popup shows when it was saved, players, matches played, active matches, courts, games per player and the top 3 players (same order as the Leaderboard). Press **Import this session** to restore it.
  - If a session is already running, the popup warns that it will be replaced and offers **Export current first**.
  - Older exports (v4.6 and earlier, raw state files) also import.
  - Invalid or non-PickleMatch files show an error and change nothing.
- **Bug fix (from v4.6):** the saved session was lost on page reload because a setting was read before it was defined. Data now loads correctly after a refresh.
- On phones the Import / Export / Reset buttons sit on their own row so nothing is cut off.


## What changed in v4.6
### Games per player (Match settings)
- New **Games per player** setting: No limit (default), or a cap such as 5 games each. Use − / + (1–30) or the quick buttons (3, 4, 5, 6, 8, 10).
- Players who reach the limit are marked **✅ DONE** in the Player List, left out of Next Rotation, and are never picked by Generate Matches or offered as a CHANGE replacement.
- Game counts show as **3/5 games** while a limit is on. The hero shows a chip like "🎯 5 games each · 8/10 done".
- When fewer than 4 players still have games left, Generate Matches explains why; when everyone is done it says **Session complete**.
- If players × games is not divisible by 4 (e.g. 10 players × 5 = 50 seats), a few players end 1 game short. The settings card warns about this.
- You can raise or lower the limit at any time; the setting is saved with the session. Rotation order, pairing, ratings and leaderboard are otherwise unchanged.

### Rating slider (Add player)
- **Starting doubles rating is now a slider** in the Add player popup, like a volume control: drag left for Beginner (2.0), right for Competitive (5.0).
- Moves in **0.1 steps** (e.g. 3.3, 4.7). The big number and level name (Beginner → Adv. beginner → Intermediate → Adv. intermediate → Advanced → Advanced+ → Competitive) update live.
- **− / +** buttons adjust by 0.1 for fine tuning; tap a number under the slider (2.0, 2.5 … 5.0) to jump straight to it. Arrow keys work too.
- The slider keeps its position between adds, so registering several players at the same level is still quick.
- Rotation, pairing, rating and leaderboard logic are unchanged.


## What changed in v4.5
- **Leaderboard ranking is now based on results, not starting rating.** Before, rank was sorted by rating first, so a player who started at 4.0 stayed on top even after winning 1 of 3 games.
- New **Score** = (wins + 2.5) / (games + 5), shown as 0-100. It is the win rate pulled toward 50% until a player has enough games, so a 1-0 start cannot beat someone who has won 7 of 9.
- Ties are broken by **point difference** (shown as "Pts" under each name), then wins, then games played, then rating.
- Players with **no finished games** are listed last and unranked (–).
- The rating (and starting rating) is still shown, but no longer decides rank.
- Added a "Fair Leaderboard" card to How it works.

## What changed in v4.4
- **Fixed the top menu so it actually stays pinned while scrolling.** It looked sticky before, but its wrapper had no extra height for it to "stick" within, so it silently scrolled away with the rest of the page. The menu now stays visible at the top of the screen no matter how far down the page you scroll.

## What changed in v4.3
- **Removed "In Rotation"** from Waiting Players. That section (and its CHANGE button) is gone.
- **CHANGE now lives directly on each player inside Active Matches** — every player chip on a pending match card has its own CHANGE button, so swapping someone out is one click from the match itself, right where lineup issues usually come up.
- **Removed REMOVE from Next Rotation.** That list is now informational only (name, rating, queue position).
- **New "Player List" section at the very bottom of the page.** It lists every active player — playing or waiting — and this is now the one place to REMOVE a player from the rotation. Removing someone currently in a match cancels that match's pending round, same as before.

## What changed in v4.2
- Removed the duplicate Auto match buttons that lived inside the Active Matches and Waiting Players sections. There is now just **one** button, in the hero at the top of the page, that creates the next match(es).
- Renamed **"Auto match" to "Generate Matches"** everywhere it appears: the button itself, toasts, and the notes in Match Settings and How it works.

## What changed in v4.1
- **Active Matches** and **Waiting Players** are no longer popups. They now live directly on the main page, right below the Players / Waiting / Courts / Rounds played stat cards — **Active Matches first, then Waiting Players** below it.
- Removed from the top menu are now just: Add player, Match settings, Leaderboard, History, How it works.
- Nothing about how these two sections work has changed — same Auto match buttons, same balance badges, same rotation queue — they're just always visible now instead of behind a click.

## What changed in v4.0
- **Removed the floating Add player / Submit scores buttons.** Use the menu instead: **Add player** opens the same quick-add popup, and each match already has its own **Enter score** button inside **Active matches**.
- **"Current matches" renamed to "Active matches"** everywhere it appears: the top menu, the popup title, and the matching label in Match Settings.

## What changed in v3.9
- **Menu buttons are now much easier to see:** each item has its own solid background, border, and icon (👤 ⚙️ 🟢 🏓 🏆 📋 💡) instead of plain text, and the buttons are larger.
- The active section now glows lime with a visible ring, so it's obvious which popup is open.
- Added a **fade + arrow hint** on the right edge of the menu bar so it's clear there are more items to scroll to (it disappears once you've scrolled to the last item).

## What changed in v3.8
- **Every menu item now opens its section as a popup**, the same way Add player already did: Match settings, Waiting players, Current matches, Leaderboard, History, and How it works.
- **History** and **How PickleMatch Works** are now in the top menu too (History shows a live count of finished matches).
- The main page is now just the hero and the stat cards; everything else lives behind the menu, so the page stays short and uncluttered.
- Each popup has its own **×** close button, closes on Esc, and closes if you tap outside it.
- The floating **Add player** / **Submit scores** buttons still work exactly as before — close the popup you're in to reach them if one is open.

## What changed in v3.7
- **Dark mode redesign:** deep green background, lime/mint accents, a court-line hero. Applies across every panel, dialog, and the leaderboard.
- **Floating buttons** (bottom-right on desktop, a bottom bar on phones):
  - **Add player** opens a quick-add window with a tap-to-pick rating grid. It stays open so you can register several players in a row without re-opening it each time.
  - **Submit scores** opens straight to the score dialog when one match is in play, or a small picker when two courts are running. It shows a live count of matches waiting to be scored, and dims when there is nothing to score.
- Score entry now has **− / +** stepper buttons next to each score field, plus the existing Enter-to-save shortcut.
- Kept the existing Add Player panel and Enter score buttons on the match cards — the floating buttons are a shortcut, not a replacement.

## What changed in v3.6
- **Top menu (sticky):** Add player, Match settings, Waiting players, Current matches, Leaderboard. Tapping a link scrolls to that section; the menu highlights the section you are viewing and scrolls sideways on phones.
- Small counters on the menu show how many players are waiting and how many matches are in play.
- **Current matches** now shows only matches in play.
- **Finished matches** moved to the very bottom, below How PickleMatch Works (latest 6, with Show all).

## What changed in v3.5

### Fair rotation (no one left behind)
- **Root cause fixed:** the old selector compared partner repeats *before* games played, so a player on 0 games could be skipped to avoid a repeat partner while others reached 2-3 games.
- New rule, like real open play: **fewest games always plays next; ties go to the longest-waiting player.** Nobody is skipped to improve a pairing. Pairing choices only happen between players tied on games.
- **Late arrivals** join the back of the queue at the current minimum instead of taking every court until they catch up.
- Waiting players who haven't played yet show a "Not played yet" tag.

### Pairing
- Strong players are paired with weaker ones (3.0 + 2.0, 3.0 + 2.5). A split where one team is entirely stronger (3.0+3.0 vs 2.0+2.0) is heavily penalised.
- Combined team ratings stay close; recent partners and opponents are still avoided.
- Among near-equal splits the choice is **random**, so matchups vary.

### Tested
Simulated 60 matches with 11 players + 1 late joiner, switching 2 courts to 1: game counts never differed by more than 1 between players, and no match had one team entirely stronger.

## What changed in v3.4

### Fixes
- **Startup crash:** a stray `window.recordResult = recordResult` referenced a function that doesn't exist and stopped the script before the first render. Removed; `recordScore` is now exposed correctly.
- **Auto match toasts:** the button passed the click event as the `silent` flag, so confirmation messages never appeared.
- **Stats:** "Waiting" now counts players who are actually waiting, and "Rounds played" counts finished matches only.
- **Change player:** now uses the built-in dialog (with a suggested replacement) instead of a browser prompt.
- **Leaderboard on phones:** header and rows no longer break the 4-column mobile layout.
- Storage errors (full or blocked) now show a message instead of failing silently.

### System
- **Cancel match:** cancel a pending match; players return to the queue and the pairing is not counted as a repeat partner/opponent.
- **Balance badge:** each match in play shows Evenly matched / Close match / Uneven match from the combined-rating gap.
- **Export:** download the whole session as JSON.
- Keyboard: Esc closes dialogs, Enter saves a score.
- Match list: matches in play first, finished matches below (latest 6, with Show all).

### UI
- New court-line hero, Bricolage Grotesque + DM Sans, sentence-case labels, larger small text.
- Player ratings shown per player on match cards; winner and score highlighted on finished matches.
- Visible keyboard focus, reduced-motion support, dialog labels, live toast.

## Important
This is PickleMatch's own matchmaking logic. It is not an official DUPR algorithm.
