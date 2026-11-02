# BuenasxPickle v8.4.1 — Readable Dropdowns

## Fixed in v8.4.1
The player dropdowns opened as a white list of near-white names — only the highlighted
one could be read.

The cause was one line of CSS: the dark theme defined `--inset` as `var(--inset)`, a
self-reference, which CSS treats as a cycle and throws away. Every `background:
var(--inset)` in dark mode was therefore transparent, the `<select>` had no background
of its own, and the platform drew its dropdown on white while the names kept the page's
near-white text colour. Dark mode now has a real inset colour (`#120d08`), which also
brings back the recessed well on the eleven other surfaces that use it — match cards,
the stepper rows, the court level cards, the fixed-partner row, the fixture lines and
the playoff columns.

The open list is drawn by the platform and does not inherit the select's colours, so
`option` now states its own background and text colour. The list reads in both themes
whatever the platform would have painted.

## What changed in v8.4
A playoff bracket can now finish with a **third-place match**. Turn it on beside the
playoff size and the two beaten semi-finalists play off for third instead of sharing it.

### Only where there are semi-finals to lose
The option appears for a **top 4 or top 8** playoff and nowhere else — a top 2 is a
final on its own, with nobody beaten in a semi-final to play. Drop the size back to
top 2 and the control disappears; put it back to top 4 and your setting is still there.
Like the playoff size, it is changeable right up until the bracket is drawn.

### Drawn beside the final
The match is created at the same moment as the final, out of the two teams that lost
the semi-finals — so with two courts free, **the final and the third-place match run
side by side**. It sits in its own column of the bracket, under its own heading.

### It decides a place, not an exit
The group table is unmoved by it, as by every other playoff result. What it changes is
the **order below the runner-up**: without it the two beaten semi-finalists are split by
their group position; with it, by the match they just played. The table says
`Third place` and `Fourth place` where it used to say `Semi-finalist` twice, and the
player leaderboard, the Top 3 badges and the Top List follow.

### In the spreadsheet
**Format** reads `Round robin tournament, top 4 knockout + third place`, and the saved
finishing order carries `Third place` and `Fourth place` by name.

### Checked
Top 4 and top 8 with the third-place match played out end to end: the extra match drawn
from the right two teams, the right total (N matches for a bracket of N, up from N − 1),
the group table untouched, and the finishing order reading champion, runner-up, third,
fourth. An upset in the third-place match swaps third and fourth and nothing else.

Also checked: the final and the third-place match filling two courts at once; the
control hidden at top 2 and the setting remembered when the size goes back up; a session
saved between the semi-finals and the final reloaded with both matches intact; and a top
2 bracket refusing the option outright. Both themes at 1280px and 375px — the bracket's
three columns stack on a phone with no horizontal overflow — and no console errors.

## What changed in v8.3
A tournament can now finish with a **knockout**. Each court picks its playoff size —
**None**, **Top 2**, **Top 4** or **Top 8** — and when the round robin ends, that many
teams go through to a straight elimination bracket. Without playoffs nothing changes:
whoever tops the table wins it, exactly as in v8.2.

### The group decides who, the knockout decides what
The round robin becomes a **group stage**: it still ranks everybody by wins, then point
difference, then points scored, then their own matches against each other — but with
playoffs on it is seeding, not a title. The table says so, and the medals move to the
bracket. A playoff result **never moves the group table**; the two are separate
competitions inside one bracket, and the standings panel shows both.

### Seeding, and why the top two cannot meet early
The first playoff round pairs **1 v 4 and 2 v 3** (or 1 v 8, 2 v 7, 3 v 6, 4 v 5 for a
top 8). Each later round pairs match *i*'s winner with match (last − *i*)'s, which is
what keeps the two best-placed teams on opposite sides of the draw: they can only meet
in the final.

A size is only offered when the court has **at least that many teams**, so no team is
ever handed a bye into a round it did not play.

### Drawn a round at a time
The bracket cannot be drawn in full up front, because its seeds are not known until the
round before has been played. So it is built as it becomes knowable: the quarter-finals
the moment the group ends, the semi-finals when the quarters are in, the final when the
semis are. Each stage is drawn both when a score completes the round before it **and**
when Start Next Match is pressed — so a reload, or playoffs switched on after the group
has already finished, still finds its matches.

Matches still to come include the rounds not yet drawn. Without that, two semi-finals
on court at once would read as "nothing left" and Start Next Match would switch itself
off with a final to play.

### Where each team finished
The podium follows the knockout, not the table. The order is champion, runner-up, the
teams that went out in the semi-finals, then the quarter-finals, then whoever did not
qualify — teams level on how far they got are separated by their group position. The
player leaderboard, the Top 3 badges and the Top List all follow that order, so the
champions lead the board even when they finished fourth in the group.

The table itself wears the result: `Champion`, `Runner-up`, `Semi-finalist`,
`Quarter-finalist`, or nothing at all for the group stage, with a dotted line across
the table showing where the cut falls.

### Set per court, changeable until it is drawn
Playoffs are per court like the division and the length, so Court 1 can run a top 4 for
the intermediate-to-advanced bracket while Court 2's beginners play a straight final.
The size stays changeable right up until the bracket is drawn — it seeds off the final
table, so nothing before then depends on it — and after that it takes scrapping the
draw. Ties need no rule: a knockout cannot allow one, and a tied score was already
refused.

### In the spreadsheet
**Format** reads `Round robin tournament, top 4 knockout`, or names each court when they
differ. **Champion** is the winner of the final, not the top of the table. The saved
record carries both orders — the group standings with each team's result, and the
finishing order — because they are different things.

### Checked
Top 2, top 4 and top 8 verified end to end: the right number of matches (N − 1 for a
bracket of N), the right pairings at every round, and seeds 1 and 2 meeting only in the
final. A top 4 played out as a run of upsets — seed 4 beating seed 1, seed 3 beating
seed 2, then seed 4 winning the final — left the group table byte-for-byte unchanged and
put the champion pair at the top of the player leaderboard.

Also checked: both brackets running different playoff sizes at once; a size larger than
the field refused; playoffs switched on after the group had already finished; a session
saved mid-knockout and reloaded, then played to the end; scrapping the draw clearing the
bracket but keeping the setting; and a knockout left behind with no group stage dropped
on load. Both themes at 1280px and 375px, no horizontal overflow, no console errors.

## What changed in v8.2
Each court's tournament now has a **length**. A stepper beside the division sets how
many games every team gets, and the draw goes round that many times: single, double,
triple or quadruple round robin.

### Why it steps in whole cycles
One trip round the draw gives every team exactly one game against every other, so
games per team is always **(teams − 1) × cycles**. With 4 teams a step is 3 games;
with 6 teams it is 5. Stopping part-way through a cycle would leave some teams having
met twice while others met once, and the table would no longer be comparing like with
like — so the control moves a whole cycle at a time and the note says what a step
costs before you press it.

The stepper is labelled in games, not cycles, because that is the question an organiser
actually asks: `4 games each · double`.

### The return leg
A second trip round swaps the sides of the first, so a team that was Team A against
someone the first time is Team B the second. Combined with the pinned-fixture flip from
v8.0, no team ends up more than one match out of balance between the two halves of the
scorecard, at any length. Fixtures from a later leg carry a small `#2` by the *vs* in
the draw.

### Head-to-head, over more than one meeting
The tiebreak had to grow up. Two teams can now meet two, three or four times, so a tie
on wins, point difference and points scored is settled by the **aggregate of their own
meetings**: who won more of them, and failing that the points between just the two.
A single round robin behaves exactly as before, because there is only one meeting to
aggregate.

### Set per court
Length is per court, like the division, so Court 1 can be a double round robin for the
intermediate-to-advanced bracket while Court 2 plays a single for the beginners. The
court tab, the standings header and the saved session all say which is which.

### Checked
The draw verified for **2 to 9 teams at every length from 1 to 4**: every team plays
exactly (teams − 1) × cycles games, every pair meets exactly `cycles` times, the match
and round counts are right, no team appears twice in a round, side imbalance never
exceeds one match, fixture ids are unique and legs number 1..K.

The head-to-head rule isolated over two meetings: two teams finishing level on wins,
points scored and point difference swap places when — and only when — the results of
their own two matches swap. Sessions from v8.1 and v8.0 load as single round robins.
Both themes at 1280px and 375px, no horizontal overflow, no console errors.

## What changed in v8.1
A tournament now runs **one bracket per court**. Court 1 can be the
intermediate-to-advanced tournament while Court 2 is the beginners' — two separate
competitions, side by side, each with its own teams, its own draw, its own standings
and its own champion. The two never meet.

### Divisions
Each court gets a **division**, picked from the same rating bands the courts already
use: All levels, Beginner (up to 2.9), Intermediate (3.0–3.9), Advanced (4.0 & up) or
Intermediate–Advanced (3.0 & up). The edges are open-ended, so a 5.2 is still
Advanced — a rating that drifts past the slider range never shuts a player out of
their own division.

Only players inside a court's band can be drawn into it, and **nobody is on two
teams**: a player eligible for both bands belongs to whichever bracket takes them
first. Eligibility is a draw-time question, so a rating that crosses a band edge
mid-tournament changes nothing — the teams are already fixed.

Changing a division once teams exist asks first, and names the teams that would have
to go.

### The builder
The Tournament panel now opens on a **court tab** — Court 1 or Court 2, each showing
its team count and division. Everything below acts on the court you are looking at:
*Draw Court 2 automatically*, *Clear Court 2*, the two dropdowns, the team list. With
one court selected in Match settings the tabs disappear and it reads as it did before.

**Make the draw & start** builds every bracket at once. A court with one team is
refused — a round robin needs at least two, or none.

### Playing two at once
**Start Next Match** fills each court from its own draw. A court with no bracket of
its own is **spare**: it takes whichever bracket has the longest queue left, which is
how a single tournament still runs across both courts — put every team on Court 1,
leave Court 2 empty, and it behaves exactly as v8.0 did. When a fixture is played away
from its own court, its card says so: `🏆 Round 2 of 3 (Court 1 draw)`.

Court cards wear their bracket's division tag, and seeds are numbered **within a
bracket**, so Court 2's teams are #1, #2, #3 in their own competition rather than #4
onwards in somebody else's.

### Two champions
The standings panel shows **a table per court**, each headed with its court and
division, and the draw below it is grouped the same way. Ranking is unchanged: wins,
then point difference, then points scored, then the match the two teams played against
each other.

The player leaderboard — and so the Top 3 badges and the Top List — is ordered by
**place within a bracket first**, and by court only to break that. Both champion teams
lead the board, then both runners-up. There is no way for one Top-3 list to crown two
champions properly, so the standings panel is where each bracket's own champion lives,
and it says as much underneath.

### In the spreadsheet
The saved session carries one record per bracket. **Format** reads
`Round robin tournament — Court 1: Intermediate–Advanced · 3.0 & up · Court 2:
Beginner · Up to 2.9`, and **Champion** names both. A single all-levels bracket still
reads plainly as `Round robin tournament`, as it did in v8.0.

### Checked
Court 1 intermediate-to-advanced and Court 2 beginners drawn and played out together:
every match landed on its own court, the beginners stayed out of the advanced bracket
and nobody appeared on two teams. The spare-court case verified with one bracket across
both courts, including the `(Court 1 draw)` tag. A court with one team is refused and
names that court. Sessions from v8.0 load with their teams and fixtures on Court 1; the
one-division-per-tournament shape v8.1 briefly had migrates to Court 1's division. Open
play re-checked unchanged, and one-court mode hides the tabs. Both themes at 1280px and
375px, no horizontal overflow, no console errors.

## What changed in v8.0
The app has a **second mode**. Open play is what it has always been: fair rotation picks who plays next and partners change every match. **Tournament mode** is the opposite — fixed teams of two, and a draw made before the first serve in which every team plays every other team once.

They are opposite ideas rather than two settings, so while a tournament is on, **fair rotation, the game limit, court skill levels and fixed partners all stand down**: the draw has already decided everything they would have decided. Only the court count still applies. Match settings says so at the top while it is running.

### Making the draw
A new **Tournament** item in the menu holds the whole thing:

- **Draw teams automatically** pairs the strongest player with the weakest, working inwards. It does not make the teams equal — nothing does — but it stops the two best players ending up together, which is the one draw that makes the whole afternoon a formality.
- Or pick two players and **Add team**, as many times as you like.
- **Make the draw & start** builds the schedule. The note above it says what you are about to get: `6 teams → 5 rounds, 15 matches`.

The draw is the circle method — pin one team, rotate the rest — so after N‑1 rounds every pair has met exactly once. With an **odd number of teams one rests each round**, and the schedule says which. That is a real rest, not a walkover.

One detail worth the code it took: the circle method would otherwise put the same team on the same side of every single scorecard. Flipping the pinned fixture on alternate rounds spreads it, so no team ends up more than one match out of balance between Team A and Team B. Checked for 2 to 11 teams.

### Playing it
**Generate Matches becomes Start Next Match**, and takes the next fixtures off the draw instead of picking players out of a queue. Both courts still run at once — a team already on court is skipped rather than drawn twice. Everything downstream is the code that was already there: the same court cards, the same score entry, the same rating maths, the same history. A tournament match is an ordinary round with a fixture id on it.

The cards name the teams from the draw instead of *Team A* and *Team B*, wear a `🏆 Round 2 of 5` tag, and drop the CHANGE buttons — substituting a player would break the team the draw is built on.

### Standings
A **Tournament Standings** panel appears under Active Matches: played, won, lost, points for and point difference, plus the whole draw round by round with results as they come in.

Ranked by **wins**, then point difference, then points scored. Two teams still level on all three are split by **the match they played against each other**, which in a single round robin settles a two-way tie exactly. In a three-way tie it can point in a circle; it is deliberately left to decide nothing there, and the comparisons before it are what rank the table. A team that has not played yet sorts below every team that has, the same way the player leaderboard treats someone with no games.

### Where the podium comes from
While a tournament is running, the **player leaderboard follows the tournament standings** — the champions first, then the runners-up. It has to: a table saying one team won, next to badges awarded to somebody from mid-table, would be the app contradicting itself on one screen. Inside a team the player with the better point difference is listed first. Top 3 badges and the Top List follow from that automatically, unchanged.

### Ending one
Switching the toggle off goes back to open play and **keeps the draw**, so a tournament can be picked up later and a session saved afterwards still carries its standings. **Scrap the draw** is the destructive one, and the only way back to the team builder; matches already played stay in History but leave the standings with the fixtures they belonged to. Fixture ids never restart, so a round played under a scrapped draw can never be confused with a new one.

### In the spreadsheet
The Sessions tab gains **Format** and **Champion** columns. Existing sheets pick them up on the next save — `sheetFor()` adds missing columns on the end rather than shifting anything. **This needs the script redeployed** (Deploy → Manage deployments → Edit → Version: New version).

### Checked
The draw verified for 2–11 teams: right number of matches and rounds, every pair exactly once, no team twice in a round, one rest per round when odd, unique fixture ids. A full 4-team tournament played through the real score path end to end. The head-to-head rule isolated by seeding two level teams so seed order and head-to-head disagree — head-to-head wins. Sessions from v7.9 load as open play with an empty tournament; deliberately corrupted tournament data loads with the bad teams and fixtures dropped and no console errors. Open play re-checked unchanged. Both themes at 1280px and 375px, no horizontal overflow.

One real bug found in testing and fixed: app.js renders the page at the end of its own file, before tournament.js exists, so a session left mid-tournament drew its courts as open play — *Team A* against *Team B*, with CHANGE buttons the draw does not allow. The module renders the page again once it has loaded.

## What changed in v7.9
A court with a match on it now says **LIVE**, with an orange dot that breathes, where it used to say *In play*. One word, the one a scoreboard would use, and the pulse makes the difference between a court that is playing and one that is finished readable at a glance rather than by reading.

Finished matches say **Final** as before. The chip is `.status.live`; the animation is a ring expanding out of the dot, and `prefers-reduced-motion` already turns every animation in the app off, so the chip still reads LIVE for anyone who asks for less movement.

*In play now* in **Match settings** is untouched — that is a sentence about a pair, not a court's status chip.

Checked in both themes at 1280px and 375px: every pending court shows the chip, with no horizontal overflow.

## What changed in v7.8
A **☀️ / 🌙 button** in the top bar of all three pages switches between dark and light. The choice is remembered in that browser; without one, the page follows the device, so a phone in dark mode opens dark.

**The theme is set before the first paint**, by a few lines inline in each `<head>` rather than by `theme.js`. A page that renders dark and then turns white is worse than either, and a stylesheet cannot be waited on for that. `theme.js` only wires the button to what those lines already decided.

### What this needed first
Light mode was not just a second set of colours — a handful of surfaces were written as literals in the rules that used them, so they could not invert:

- `--inset` (the wells behind inputs, court cards and pair rows), `--tint` (the barely-there raise on chips and the QR tile), `--menu-bg` (the sticky menu bar) and `--toast-bg` / `--toast-ink` are tokens now.
- The page wash behind everything is `--wash`, so light mode gets a softer one rather than the dark mode's glow at full strength.
- The orange **deepens** to `#e85d04` in light mode. `#ff7a18` on white is too pale to read at small sizes; on near-black it is not.

### Two things that stay dark in both
The **hero** and the **badge crest on the certificate** are artwork, not surface, so they keep their own dark backing — and their text no longer inherits the page's text colour. That was a real bug in the first pass: in light mode the hero heading went dark-on-dark and vanished, as did the certificate's Batch/Session/Date values.

Checked in both modes at 1280px and 375px — main page, Match settings, the Top List and the certificate — with no horizontal overflow, the switch persisting across a reload, and the key-shadow under Generate Matches warmed in light mode so it reads as depth rather than a grey slab.

## What changed in v7.7
The app is **BuenasxPickle** now, in orange and white, with your logo as its mark.

- **The name** is in the title, the top bar, the badge footer, the Top List and the certificate page. The top bar sets it the way the logo does: *Buenas* in white, *xPickle* in orange.
- **The logo** (`logo.webp`) is the brand mark on all three pages, and `icon.webp` is the browser-tab icon. Both are resized from the original — 512px and 180px — so a 1254px image is not downloaded on every page load. The artwork has a white background, so it sits on a white tile, which is also the other half of the brand's two colours.
- **The palette is orange on a warm near-black**, with white text. The accent token is still called `--lime` so every rule that already pointed at the accent moved with it; its value is now `#ff7a18`. Backgrounds, borders, inputs, the sticky menu bar and the hero all moved from green to warm neutrals, and the badge canvas followed.

### Where green survives, and why
Green is kept for the handful of places it carries meaning rather than brand: a **result saved**, a **match won**, an **evenly matched** pairing, and a **verified badge** on the certificate. Turning those orange would have merged them with *pending*, *in play* and every other accent, which is exactly the distinction they exist to make. Everything decorative — avatars, CHANGE buttons, counts, chips — is orange.

### What deliberately did not change
`picklematch_v2` and `picklematch_sheet` in localStorage, the `picklematch:changed` event, and the `PM3` prefix inside every badge QR. Renaming those would orphan sessions already saved in a browser and invalidate every badge already printed. They are internal identifiers; nobody sees them.

Checked on every screen at 1280px and 375px — main page, Match settings, the badges modal, the Top List and the certificate — with no horizontal overflow, and the badge canvas now reads BUENASXPICKLE.

## What changed in v7.6
**Generate Matches moved out of the hero and into the Active Matches heading**, beside the courts it fills. It was sitting at the top of the page, a panel away from the thing it acts on, and the empty state right underneath it had to say *"press Generate Matches"* to point back up at it.

It keeps the pressed-key depth it had in the hero, so it still reads as the main action on the page. On a phone it goes full width under the heading rather than being squeezed beside it.

Checked at desktop and 375px: the button generates a match from the new position, and neither width overflows.

## What changed in v7.5
The certificate page now carries the same pickleball artwork the printed badges use, so a scanned badge and a printed one look like the same thing.

- **`badge-bg.webp` sits behind the crest**, under the treatment the badge already gives it: a flat scrim to kill the white, a veil heaviest at the top and bottom where the lettering sits, and a warm glow behind the rank. The record and detail tiles sit on their own dark plates so they stay readable over the busy middle.
- **The crest is a portrait card now**, 470px at most and centred, rather than stretching the full width of the panel. Across a wide panel the square artwork was cropped to a band of midriffs; at this width both players are in frame, and it reads as a certificate rather than a banner.

### A rejected badge must not look like an award
With artwork behind it, **✕ This badge has been altered** still rendered as a glossy gold certificate — the headline said no and everything under it said yes. So the crest is now drained unless the verdict is **✓ Certified**: grayscale and dimmed for a failed badge, lightly muted for one that merely cannot be confirmed yet. Gold is reserved for a badge that passed.

Checked at desktop and 375px, on every verdict: certified in full colour, *not on the record* muted, *altered* grey and dead, and no horizontal overflow on either page.

## What changed in v7.4
- **Every winner on the Top List now carries its own QR**, beside the row. A player can scan their result straight off the screen, or tap it on the page. Only the podium has one, because only the podium has a badge.
- **Scanning lands on a certificate page**, [`toplist/verify.html`](toplist/verify.html) — one badge, one verdict, rather than the whole list with a result box at the top. It shows TOP 1 / 2 / 3, the player, the win–loss record, the batch, the session, the date and the badge code, over a gold crest meant to be photographed.
- **Badge QRs point there too.** A QR printed on a Top 3 badge now opens the certificate instead of the Top List. Badges made before this still work: the Top List keeps its own scan box, so an old QR is still checked and answered.

### What the certificate actually checks
Two checks, in this order, because they fail for different reasons and the order decides who gets blamed:

| Verdict | What happened |
|---|---|
| **✓ Certified** | Intact, in the spreadsheet, and the row's fingerprint still matches |
| **⚠ The record itself has been edited** | The badge is fine; the *spreadsheet row* no longer matches its own fingerprint |
| **⚠ Genuine badge, not on the record** | Intact, but the session has not been saved yet |
| **⚠ Badge is intact, record unavailable** | The sheet could not be reached, or none is connected |
| **✕ Does not match the record** | That code is in the sheet, with different details |
| **✕ This badge has been altered** | The result on the badge fails its own checksum |
| **✕ Not a PickleMatch badge / Nothing to check** | The link carries nothing readable, or no badge at all |

The fingerprint check runs **before** the comparison deliberately. If the organiser's sheet has been edited by hand, the honest answer is "the record was edited", not "your badge does not match" — the second blames the person holding the badge for someone else's edit.

### Also
- The spreadsheet reader moved into [`toplist/feed.js`](toplist/feed.js), shared by both pages. The list and the certificate must answer the same question the same way, and two copies of that logic would eventually disagree.
- On a phone the row stacks: rank and QR on the top line, the player across the width below, so nothing is squeezed to a few characters.

Verified against a mock feed carrying real badge codes: all seven verdicts above were reproduced, including a spreadsheet row edited by hand behind a genuine badge; the QR a badge mints was checked to be the certificate URL; an old-style badge link still verified on the Top List; and both pages were checked at 375px with no horizontal overflow.

## What changed in v7.3
**Reset is the only thing that saves now, and badges live in the spreadsheet.**

- **Save now is gone**, from the top bar and from Match settings. There was more than one way to write a session, which made it unclear which one was the real one. Pressing **Reset** sends the finished session and only then clears it — that is the whole of it. A failed save still refuses to clear anything.
- **Badges are stored by the Apps Script, not in a JSON file.** The script keeps a third tab, **Badges**, with one row per Top 3 badge: its code, its batch number, the record it was minted from and a SHA-256 fingerprint of the badge's own payload. The app mints the badges and sends them with the session; the script assigns the batch number, because only the spreadsheet knows how many sessions came before.
- **`toplist/toplist.json` has been deleted, and with it the publishing step.** The ⬆ Publish winners button is gone — it saved a file you then had to commit and push. Nothing to press, nothing to commit: finish a session, press Reset, and the badge is on the Top List. (This replaces the "Publish winners" section under v6.3 below, which is now history.)
- **The Top List reads the Badges tab.** Codes and batch numbers come from the sheet rather than being derived on the page, and each badge's fingerprint is **recomputed, not believed** — edit a name or a record in the spreadsheet by hand and that row is called out under the list fingerprint.

**What this changes about trust.** The record used to be a file in this repository, so changing it meant pushing a commit. The record is now the organiser's Google Sheet, so changing it means holding that sheet — and adding to it means holding the secret phrase as well. The Top List page says so.

**You must redeploy the script.** `Code.gs` changed. In Apps Script: **Deploy → Manage deployments → Edit → Version: New version**. Until you do, the Badges tab is never created and the Top List derives codes the old way, which still works but gives no batch numbers of its own.

Verified: the script was run in Node against a fake spreadsheet — two sessions numbered as batch #1 and #2, re-saving the first kept its number and replaced its rows instead of duplicating them, badge rows landed in the new tab, each session tinted its own colour, and a wrong secret was refused. The Top List was then served against a mock feed carrying the real badge codes: three batches rendered, all players listed, a scanned badge read *Official — Batch Winners #1*, and a deliberately doctored badge row was reported as no longer matching. The codes the app mints were checked against the codes the page expects — identical.

## What changed in v7.2
The Top List said only that it could not read a local file when opened from disk, which hid the more likely reason: no spreadsheet is connected. It now names the real cause first — that `toplist/source.js` has no URL in it — and mentions the file problem underneath only when that applies too.

Nothing else changed. The page works as before: with a URL in `toplist/source.js` it reads live from the sheet, without one it falls back to the committed `toplist/toplist.json`, and neither can be read at all when the page is opened straight from a file.

## What changed in v7.1
- **A session is written once, when it ends.** Nothing is sent while you play; **Reset** saves the finished session and only then clears it. No session is written twice, and the row holds its final figures rather than whatever was true after the first match.
- **A failed save never costs you the session.** If the sheet cannot be reached, Reset does not clear anything — it tells you why and asks whether to drop the session anyway. With no file export, the sheet is the only copy, so this had to be the careful path.
- **Every session's rows are tinted** in both spreadsheet tabs, the colour taken from the session id so it is stable, making it obvious where one session ends and the next starts.
- **The Top List shows everyone who played**, not just the podium. The top three keep their medal, rank word and badge code; everyone below is listed plainly underneath with their record, games and score.
- **Each batch has its own colour** on the Top List too — a coloured edge and heading, derived from the session id so it never shifts between reloads.

Verified against a stub sheet: nothing sent during play, the session written on Reset, a second session landing separately, and the Top List showing both batches in distinct colours with all players. The failed-save path was tested by pointing at a dead endpoint — the prompt appeared, declining it left the sessionintact, and the error named the likely cause. The script was checked in Node for the all-players feed and for per-session colouring.

## What changed in v7.0
The spreadsheet is now the one place session data lives, for the public Top List as well as the app.

- **The Top List reads the sheet live.** Paste the same Web App URL into [`toplist/source.js`](toplist/source.js) and past winners appear there as soon as a session saves itself. No Publish step, no commit, no push.
- It refreshes on open, on **↻ Refresh**, and every couple of minutes while the page is actually on screen — not in a background tab.
- **Badges still verify.** The sheet stores the facts, not the badge codes; the page recomputes each code with the same module that minted it. A badge scanned from a session saved this way reads *Official — Batch Winners #2*, highlights its batch and its row.
- **Nothing is stored twice.** No codes, hashes or batch numbers in the sheet — batches are numbered from the order sessions started.
- If the URL is blank, or the sheet cannot be reached, the page falls back to the committed `toplist/toplist.json` and says so in the heading.

Two fixes this needed:

- **A session's date is now the day it started**, for both badges and sheet rows. Both used "today", so a badge made after midnight would have had a different date from its own session's row — and the badge code is derived from that date, so it would no longer have matched.
- **The Apps Script matches columns by heading rather than position**, so adding a column by hand, or a sheet made by an earlier version, no longer shifts the data. A missing column is added on the end instead.

**The trade worth knowing:** `toplist/source.js` is public, so the Web App URL in it is public. Reading the winners is the point and needs no secret; writing still needs the secret phrase, which never leaves the organiser's browser. A stranger with the URL can read your winners, nothing more.

Tested as a whole loop against a stub sheet: played a session and watched it save itself, pressed Reset, played a second, and both appeared on the Top List as Batch #1 and #2 in the right order. A badge from the live session was then scanned and verified. The rewritten script was checked separately in Node for ordering, re-save dedupe and the new column.

## What changed in v6.9
- **Import and Export are gone.** The file-based backup, its preview dialog and all of its code and CSS have been removed. The Google Sheet is where sessions are kept now.
- **Saving is automatic.** Once the Web App URL and secret phrase are in Match settings, any change to players or results schedules a save a few seconds later. **Save now** forces one immediately. Nothing else to press.
- **Reset starts a new session.** Each session carries its own id from the moment it begins, so Reset gives you a genuinely separate set of rows in the sheet.

The session id had to change for this to work. It used to be a fingerprint of the finished results, which meant it changed every time a match was recorded — each auto-save would have landed as a brand new session. It is now generated once when a session starts and held in the session's own state, so a session stays one row that fills in as it is played. Badges use the same id, so a badge and a spreadsheet row still name the same session.

Verified end to end: connected a sheet, played a session and watched it save itself; played more matches and confirmed it re-sent under the same id; sat idle and confirmed nothing further was sent; pressed Reset, played a second session, and confirmed a new id. The three payloads the browser actually sent were then replayed through the real `Code.gs`, which produced exactly two session rows and four player rows each.

**Worth knowing:** the sheet is a record, not a restore point. Nothing reads it back into the app, so Reset still clears the browser's copy for good and an old session cannot be reopened from the spreadsheet. Loading a session back in would be a separate piece of work.

## What changed in v6.8
PickleMatch can now append each session's standings to a Google Sheet you own. Full setup is in **[sheets/README.md](sheets/README.md)**; the short version is: paste `sheets/Code.gs` into your sheet's Apps Script, deploy it as a Web App, and give PickleMatch the URL and a secret phrase.

- **Match settings → Google Sheet** holds the URL and phrase, with **Test connection**, **Save this session** and **Forget**. A **📊 Save to Sheet** button appears in the top bar once a sheet is connected.
- Two tabs are written, created with headings on first use: **Sessions** (one row per save — date, counts, courts, and the top three names) and **Players** (one row per player — rank, score, games, W/L, point difference and ratings).
- **Saving the same session again replaces its earlier rows** instead of duplicating them, so you can save as you go.
- The URL and phrase live in that browser's local storage only. They are never committed and never sent anywhere but Google. Anyone holding both can append to the sheet, so they are treated as a password — hence **Forget**, and the note to set them up per device.

Two details that make this work from a static site, both easy to get wrong:

- The request is sent as `text/plain`. A JSON content type makes the browser send a CORS preflight, which Apps Script does not answer, and the save fails before it leaves the browser. The script parses the body as JSON regardless.
- The deployment must be **Execute as: Me** and **Who has access: Anyone** — the first lets the script write to your sheet, the second lets a browser reach it. "Anyone" is why the secret phrase exists.

Tested by running `Code.gs` against stubbed Google services (correct rows, wrong-secret rejection, and re-saving a session replacing its 4 old rows rather than duplicating), and the browser half against a stub endpoint: real save, wrong phrase, unreachable endpoint and an empty session all report something useful.

## What changed in v6.7
The Mini game is gone: the **Pickle Arena** betting game and the **simulated match animation** have both been removed, along with their code and files.

Removed:
- `arena.js` and `hero-scene.js` — deleted
- The Mini game tab, its modal and the two `<script>` tags in `index.html`
- All Arena and animation CSS (roughly 4 KB of `style.css`), including the `--team-red` / `--team-blue` variables that only the Arena swatches used
- The `picklematch:generate` and `picklematch:reset` events in `app.js`, which existed only so the Arena could start its clock and reset its wallet. Generate Matches and Reset are back to plain handlers, and the Reset dialog no longer mentions a wallet.

Untouched: everything that runs a session — rotation, matchmaking, ratings, the leaderboard, court skill levels, fixed partners, games per player, export/import, and the Top 3 Badges and Top List pages.

**One leftover you cannot see:** a wallet balance may still sit in the `picklematch_arena` key in the browser storage of anyone who played it. Nothing reads that key any more, so it is inert; clearing site data removes it.

## What changed in v6.6
- New **🎮 Mini game** tab in the menu, between Leaderboard and History. The **simulated doubles match** and the **Pickle Arena** betting game both live there now.
- The main page is back to the job it is for: the hero is the heading, the session chips and Generate Matches, then the stats, matches and player list. Nothing of the organiser's workflow moved.
- Moving the animation behind a tab made it cheaper too — it was already set to stop drawing when scrolled out of view, so it now idles whenever the tab is closed and picks up when you open it.
- **A bet still settles with the tab closed.** A riding stake holds the match running regardless of whether the animation is on screen, so you can place a bet, close the tab, run your session, and come back to the result. Verified: bet placed, tab closed, score kept advancing, and it paid out while still closed.

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
- **Note for editing:** `index.html` loads the CSS and JS with a version query (`app.js?v=7.2`). Bump that number whenever you edit `style.css`, `app.js` or `hero-scene.js`, or browsers will keep serving the old cached copy.

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
