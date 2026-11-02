/*
  tournament.js — Tournament mode (round robin).

  Open play asks "who has waited longest?" and builds a match out of whoever
  that is. A tournament asks nothing: the teams are fixed, the schedule is
  drawn before the first serve, and every team plays every other team once.
  Those are opposite ideas, so this is a mode rather than a setting — the
  rotation, the game limit, court skill levels and fixed partners all stand
  down while it is on, because the draw has already decided everything they
  would have decided.

  What stays exactly the same: the court cards, entering a score, the rating
  maths, history, the leaderboard and the badges. A tournament match is an
  ordinary round with a fixture id on it, so everything downstream of the
  score is code that was already there.

  The draw is the circle method: fix the first team, rotate the rest, and
  after N-1 rounds everyone has met. With an odd number of teams one sits out
  each round -- that is the bye, and it is a real rest, not a walkover.

  Nothing here is destructive on its own. Ending a tournament puts the mode
  back to open play and keeps every result that was recorded.
*/
(function () {
  const T = () => state.tournament;
  const on = () => state.mode === "tournament";
  const started = () => on() && T().started;

  /* ---------- teams ---------- */
  const teams = () => T().teams;
  const teamOf = id => teams().find(t => t.id === Number(id)) || null;
  const seedOf = id => teams().findIndex(t => t.id === Number(id)) + 1;
  function teamName(t) {
    if (!t) return "—";
    const names = t.players.map(id => (player(id) || {}).name).filter(Boolean);
    return names.length ? names.join(" + ") : "(empty team)";
  }
  const teamOfPlayer = id => teams().find(t => t.players.some(p => Number(p) === Number(id))) || null;
  const onATeam = id => !!teamOfPlayer(id);

  // The combined rating of a team, which is all the auto-draw sorts by.
  const teamRating = t => t.players.reduce((s, id) => s + Number((player(id) || {}).rating || 3), 0);

  function addTeam(aId, bId) {
    if (started()) return toast("The draw is already made. Scrap it first to change the teams.");
    const a = Number(aId), b = Number(bId);
    const pa = player(a), pb = player(b);
    if (!pa || !pb) return toast("Pick two players to make a team.");
    if (a === b) return toast("A player cannot partner themselves.");
    if (pa.active === false || pb.active === false) return toast("Both players must still be in the session.");
    if (onATeam(a)) return toast(`${pa.name} is already on ${teamName(teamOfPlayer(a))}.`);
    if (onATeam(b)) return toast(`${pb.name} is already on ${teamName(teamOfPlayer(b))}.`);
    T().teams.push({ id: T().nextTeamId++, players: [a, b] });
    draft = { a: "", b: "" };
    saveState();
    toast(`Team ${teams().length}: ${pa.name} + ${pb.name}.`);
  }

  function removeTeam(id) {
    if (started()) return toast("The draw is already made. Scrap it first to change the teams.");
    const t = teamOf(id);
    if (!t) return;
    T().teams = teams().filter(x => x !== t);
    saveState();
    toast(`${teamName(t)} removed. Both players are free to be picked again.`);
  }

  // Strongest with weakest, working inwards. It is the standard way to draw
  // a social tournament: it does not make the teams equal (nothing does), but
  // it stops the two best players ending up together, which is the one draw
  // that makes the whole afternoon a formality.
  function autoDraw() {
    if (started()) return toast("The draw is already made. Scrap it first to change the teams.");
    const pool = activePlayers().slice().sort((a, b) =>
      Number(b.rating) - Number(a.rating) || String(a.name).localeCompare(String(b.name)));
    if (pool.length < 4) return toast("You need at least 4 players to draw two teams.");

    const made = [];
    while (pool.length >= 2) made.push([pool.shift().id, pool.pop().id]);
    const spare = pool.length ? pool[0] : null;   // odd player out

    T().teams = made.map(players => ({ id: T().nextTeamId++, players }));
    draft = { a: "", b: "" };
    saveState();
    toast(`${made.length} teams drawn, strongest with weakest.`
      + (spare ? ` ${spare.name} is not on a team — add a player or pair them by hand.` : ""));
  }

  function clearTeams() {
    if (started()) return toast("End the tournament first.");
    if (!teams().length) return;
    if (!confirm("Clear every team and start the draw again?")) return;
    T().teams = [];
    saveState();
    toast("Teams cleared.");
  }

  /* ---------- the draw ---------- */
  // Circle method. One team is pinned and the rest rotate around it, so after
  // N-1 rounds every pair has met exactly once. An odd count gets a phantom
  // team (0) whose opponent each round simply rests.
  function buildSchedule(ids) {
    const list = ids.slice();
    if (list.length % 2) list.push(0);
    const n = list.length;
    const out = [];
    for (let r = 0; r < n - 1; r++) {
      for (let i = 0; i < n / 2; i++) {
        const x = list[i], y = list[n - 1 - i];
        if (!x || !y) continue;                       // this one has the bye
        // The circle method would otherwise put the same team on the same
        // side of every scorecard. Flipping the pinned team's fixture on
        // alternate rounds spreads it: no team ends up more than one match
        // out of balance between Team A and Team B.
        const [home, away] = (i === 0 && r % 2) ? [y, x] : [x, y];
        out.push({ id: T().nextFixtureId++, round: r + 1, a: home, b: away });
      }
      list.splice(1, 0, list.pop());                  // rotate all but the first
    }
    return out;
  }

  function start() {
    if (started()) return;
    if (teams().length < 2) return toast("A round robin needs at least 2 teams.");
    const missing = teams().filter(t => t.players.some(id => !player(id)));
    if (missing.length) return toast("A team has a player who is no longer in the session. Fix the teams first.");

    T().fixtures = buildSchedule(teams().map(t => t.id));
    T().started = true;
    T().startedAt = new Date().toISOString();
    saveState();
    const rounds = Math.max(...T().fixtures.map(f => f.round));
    const n = T().fixtures.length;
    toast(`Draw made: ${teams().length} teams, ${rounds} round${rounds === 1 ? "" : "s"}, `
      + `${n} match${n === 1 ? "" : "es"}. Press Start Next Match.`);
  }

  // Leaving the mode changes nothing but the mode. The teams, the draw and
  // every result stay where they are, so turning it back on resumes the
  // tournament exactly where it stopped -- and a session saved afterwards
  // still carries the standings.
  function setMode(wanted) {
    const want = wanted ? "tournament" : "open";
    if (state.mode === want) return;
    if (state.rounds.some(r => r.status === "pending")) {
      return toast("Finish or cancel the match in play before switching modes.");
    }
    state.mode = want;
    saveState();
    if (!wanted) return toast("Back to open play. The draw is kept — switch back any time.");
    toast(started() ? "Tournament mode on — the draw continues."
      : teams().length ? "Tournament mode on." : "Tournament mode on — draw your teams.");
  }

  // The destructive one, and the only way back to the team builder once a
  // draw is made. Results of the tournament being scrapped stay in history,
  // but they leave the standings with the fixtures they belonged to.
  function resetDraw() {
    if (!started()) return;
    const left = remaining().length;
    if (!confirm("Scrap this draw and go back to the teams?"
      + (left ? `\n\n${left} match${left === 1 ? "" : "es"} not yet played will be dropped.` : "")
      + "\n\nMatches already played stay in History, but they leave the standings.")) return;
    state.rounds = state.rounds.filter(r => !(r.status === "pending" && r.fixtureId));
    T().started = false;
    T().fixtures = [];
    saveState();
    toast("Draw scrapped. Adjust the teams and draw again.");
  }

  /* ---------- fixtures ---------- */
  const fixtures = () => T().fixtures;
  const fixture = id => fixtures().find(f => f.id === Number(id)) || null;
  const roundFor = f => state.rounds.find(r => Number(r.fixtureId) === f.id) || null;
  const played = f => { const r = roundFor(f); return !!r && r.status === "completed"; };
  const live = f => { const r = roundFor(f); return !!r && r.status === "pending"; };
  const remaining = () => fixtures().filter(f => !roundFor(f));
  const totalRounds = () => (fixtures().length ? Math.max(...fixtures().map(f => f.round)) : 0);
  // The round being played: the earliest one with a match still to finish.
  function currentRound() {
    const open = fixtures().filter(f => !played(f));
    return open.length ? Math.min(...open.map(f => f.round)) : totalRounds();
  }

  // The teams on a court right now; they cannot be drawn into a second match.
  function busyTeams() {
    const ids = new Set();
    state.rounds.filter(r => r.status === "pending" && r.fixtureId).forEach(r => {
      const f = fixture(r.fixtureId);
      if (f) { ids.add(f.a); ids.add(f.b); }
    });
    return ids;
  }

  // Tournament mode's answer to Generate Matches: take the next fixtures off
  // the schedule rather than picking players out of a queue. Matches are put
  // up in schedule order, except that a team already on court is skipped so
  // two courts can run at once.
  function fill(silent) {
    if (!started()) return toast("Draw the teams and press Start tournament first.");
    const pending = state.rounds.filter(r => r.status === "pending");
    const maxPending = state.courtCount === 1 ? 1 : 2;
    if (pending.length >= maxPending) {
      return toast(maxPending === 1
        ? "Court 1 is in play. Enter its score to move on."
        : "Both courts are in play. Enter a score to move on.");
    }
    const left = remaining();
    if (!left.length) {
      return toast(fixtures().length
        ? "Every match in the draw has been played. The standings are final."
        : "No draw yet.");
    }

    const busy = busyTeams();
    const taken = new Set();
    const occupied = new Set(pending.map(r => Number(r.court) || 1));
    const free = courtsInUse().filter(c => !occupied.has(c));
    const created = [];

    free.forEach(court => {
      const next = left.find(f => !taken.has(f.id) && !busy.has(f.a) && !busy.has(f.b));
      if (!next) return;
      taken.add(next.id);
      busy.add(next.a); busy.add(next.b);
      const round = makeRound(next, court);
      state.rounds.push(round);
      created.push({ fixture: next, round });
    });

    if (!created.length) {
      return toast("The next match needs a team that is already on the other court. Enter that score first.");
    }
    saveState();
    if (!silent) {
      const text = created.map(c => `Court ${c.round.court}: ${teamName(teamOf(c.fixture.a))} vs ${teamName(teamOf(c.fixture.b))}`).join(" · ");
      toast(`Round ${created[0].fixture.round} — ${text}`);
    }
  }

  // The same shape of round open play creates, plus the fixture it came from.
  // Partner and opponent history is still written, so the figures the rest of
  // the app reads mean the same thing in either mode.
  function makeRound(f, court) {
    const roundId = state.nextRoundId++;
    const a = teamOf(f.a), b = teamOf(f.b);
    const teamA = a.players.slice(), teamB = b.players.slice();
    [...teamA, ...teamB].forEach(id => {
      const p = player(id);
      if (!p) return;
      p.lastPlayedRound = roundId;
      p.queueSeq = state.queueSeq++;
    });
    teamA.forEach(x => teamA.forEach(y => { if (x !== y) player(x).partners[y] = roundId; }));
    teamB.forEach(x => teamB.forEach(y => { if (x !== y) player(x).partners[y] = roundId; }));
    teamA.forEach(x => teamB.forEach(y => {
      player(x).opponents[y] = roundId;
      player(y).opponents[x] = roundId;
    }));
    return {
      id: roundId, court, status: "pending", teamA, teamB,
      createdAt: Date.now(), fixtureId: f.id, tRound: f.round
    };
  }

  /* ---------- standings ---------- */
  // Which of two teams won when they met. A single round robin plays that
  // match once, so this is exact for a two-way tie. In a three-way tie it can
  // point in a circle, and the comparisons before it are what decide; this
  // only ever breaks what is still level after them.
  function headToHead(x, y) {
    const r = state.rounds.find(round => {
      if (round.status !== "completed" || !round.fixtureId) return false;
      const f = fixture(round.fixtureId);
      return f && ((f.a === x && f.b === y) || (f.a === y && f.b === x));
    });
    if (!r) return 0;
    const f = fixture(r.fixtureId);
    const winner = r.winner === "A" ? f.a : f.b;
    return winner === x ? -1 : 1;
  }

  function standings() {
    const rows = teams().map((t, i) => ({
      team: t, seed: i + 1, played: 0, wins: 0, losses: 0, pf: 0, pa: 0, diff: 0
    }));
    const by = new Map(rows.map(r => [r.team.id, r]));
    state.rounds.filter(r => r.status === "completed" && r.fixtureId).forEach(r => {
      const f = fixture(r.fixtureId);
      if (!f) return;
      const A = by.get(f.a), B = by.get(f.b);
      if (!A || !B) return;
      const sa = Number(r.scoreA) || 0, sb = Number(r.scoreB) || 0;
      A.played++; B.played++;
      A.pf += sa; A.pa += sb; B.pf += sb; B.pa += sa;
      if (r.winner === "A") { A.wins++; B.losses++; } else { B.wins++; A.losses++; }
    });
    rows.forEach(r => { r.diff = r.pf - r.pa; });
    // A team that has not played yet goes below every team that has, the same
    // way the player leaderboard treats someone with no games. Sorting it on
    // nil points would otherwise put it above a team that has played and lost,
    // and the table would show a placed team under an unplaced one.
    return rows.sort((x, y) =>
      (x.played ? 0 : 1) - (y.played ? 0 : 1) ||
      y.wins - x.wins || y.diff - x.diff || y.pf - x.pf ||
      headToHead(x.team.id, y.team.id) || x.seed - y.seed);
  }

  // The leaderboard's order while a tournament is on. The podium has to be the
  // tournament's podium: a table on the same screen saying one team won while
  // the badges went to somebody from mid-table would be the app contradicting
  // itself. Inside a team the two players are level on the thing being ranked,
  // so their own point difference separates them.
  function playerOrder(list, diff) {
    const place = new Map();
    standings().forEach((row, i) => row.team.players.forEach(id => place.set(Number(id), i)));
    return [...list].sort((a, b) => {
      const aPlayed = (Number(a.games) || 0) > 0, bPlayed = (Number(b.games) || 0) > 0;
      if (aPlayed !== bPlayed) return aPlayed ? -1 : 1;          // unplayed last, as in open play
      const pa = place.has(Number(a.id)), pb = place.has(Number(b.id));
      if (pa !== pb) return pa ? -1 : 1;                         // not on a team: below everyone on one
      if (pa && place.get(Number(a.id)) !== place.get(Number(b.id))) {
        return place.get(Number(a.id)) - place.get(Number(b.id));
      }
      return (diff[b.id] || 0) - (diff[a.id] || 0) || b.wins - a.wins ||
        String(a.name).localeCompare(String(b.name));
    });
  }

  /* ---------- what the rest of the app asks for ---------- */
  // The tag on a tournament court card, and the team labels in place of
  // "Team A" / "Team B".
  function cardTags(r) {
    const f = fixture(r.fixtureId);
    if (!f) return "";
    return `<span class="t-round-tag">🏆 Round ${f.round} of ${totalRounds()}</span>`;
  }
  function sideLabel(r, side) {
    const f = fixture(r.fixtureId);
    if (!f) return side === "A" ? "Team A" : "Team B";
    return `#${seedOf(side === "A" ? f.a : f.b)} ${teamName(teamOf(side === "A" ? f.a : f.b))}`;
  }

  // Goes into the spreadsheet with the session, so a saved tournament is
  // readable without the app.
  function summary() {
    if (!fixtures().length) return null;
    const table = standings();
    return {
      teams: teams().length,
      rounds: totalRounds(),
      matches: fixtures().length,
      played: fixtures().filter(played).length,
      champion: table.length && table[0].played ? teamName(table[0].team) : "",
      standings: table.map((r, i) => ({
        place: i + 1, team: teamName(r.team), played: r.played, wins: r.wins,
        losses: r.losses, pointsFor: r.pf, pointsAgainst: r.pa, diff: r.diff
      }))
    };
  }

  /* ---------- the Tournament panel on the page ---------- */
  function renderPanel() {
    const panel = document.getElementById("tournamentPanel");
    if (!panel) return;
    panel.classList.toggle("hidden", !started());
    if (!started()) return;

    const sub = document.getElementById("tournamentSubtitle");
    const left = remaining().length;
    if (sub) {
      sub.textContent = left
        ? `Round ${currentRound()} of ${totalRounds()} · ${left} match${left === 1 ? "" : "es"} to play`
        : `Complete · ${fixtures().length} matches played`;
    }

    const table = standings();
    const anyPlayed = table.some(r => r.played);
    document.getElementById("standings").innerHTML = `
      <div class="rank-row rank-head t-row">
        <div>#</div><div>Team</div><div class="lb-cell optional">P</div><div class="lb-cell">W</div>
        <div class="lb-cell optional">L</div><div class="lb-cell optional">Pts</div><div class="lb-cell">Diff</div>
      </div>
      ${table.map((r, i) => {
        const place = r.played ? (i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1) : "–";
        const d = r.diff > 0 ? `+${r.diff}` : String(r.diff);
        return `<div class="rank-row t-row${i === 0 && anyPlayed && !left ? " t-champion" : ""}">
          <div class="rank">${place}</div>
          <div>
            <div class="lb-name">${esc(teamName(r.team))}</div>
            <div class="lb-muted">Seed ${r.seed}${r.played ? ` · ${r.pf}–${r.pa} points` : " · not played yet"}</div>
          </div>
          <div class="lb-cell optional">${r.played}</div>
          <div class="lb-cell"><b>${r.wins}</b></div>
          <div class="lb-cell optional">${r.losses}</div>
          <div class="lb-cell optional">${r.pf}</div>
          <div class="lb-cell rating">${r.played ? d : "–"}</div>
        </div>`;
      }).join("")}
      <div class="lb-note">Ranked by <b>wins</b>, then point difference, then points scored. Two teams level on all three are split by the match they played against each other.</div>`;

    renderSchedule();
  }

  function renderSchedule() {
    const el = document.getElementById("tSchedule");
    if (!el) return;
    const byRound = {};
    fixtures().forEach(f => { (byRound[f.round] = byRound[f.round] || []).push(f); });
    const now = currentRound();
    el.innerHTML = Object.keys(byRound).map(Number).sort((a, b) => a - b).map(n => {
      const resting = restingTeam(byRound[n]);
      return `<div class="t-round${n === now ? " is-now" : ""}">
        <div class="t-round-head">Round ${n}${n === now && remaining().length ? " · now" : ""}</div>
        ${byRound[n].map(fixtureLine).join("")}
        ${resting ? `<div class="t-bye">${esc(teamName(resting))} rests this round</div>` : ""}
      </div>`;
    }).join("");
  }

  // With an odd number of teams exactly one is left out of each round.
  function restingTeam(list) {
    if (teams().length % 2 === 0) return null;
    const playing = new Set(list.flatMap(f => [f.a, f.b]));
    return teams().find(t => !playing.has(t.id)) || null;
  }

  function fixtureLine(f) {
    const r = roundFor(f);
    const done = r && r.status === "completed";
    const cls = done ? "done" : r ? "live" : "";
    const score = done
      ? `<b>${r.scoreA}–${r.scoreB}</b>`
      : r ? `<em>on court ${r.court}</em>` : `<em>to play</em>`;
    const winner = done ? (r.winner === "A" ? f.a : f.b) : 0;
    const side = (id) => `<span class="${winner === id ? "t-win" : ""}">${esc(teamName(teamOf(id)))}</span>`;
    return `<div class="t-fixture ${cls}">${side(f.a)}<span class="t-vs">vs</span>${side(f.b)}<span class="t-score">${score}</span></div>`;
  }

  /* ---------- the Tournament modal ---------- */
  let draft = { a: "", b: "" };

  function renderModal() {
    const sw = document.getElementById("tModeToggle");
    if (!sw) return;
    sw.classList.toggle("on", on());
    sw.setAttribute("aria-checked", String(on()));
    document.getElementById("tModeState").textContent = on() ? "On" : "Off";
    document.getElementById("tModeHint").textContent = on()
      ? "Fixed teams play a full round robin. Rotation, game limit, court levels and fixed partners are paused."
      : "Open play: fair rotation picks who plays next, and partners change every match.";

    const body = document.getElementById("tBody");
    body.classList.toggle("is-off", !on());
    document.getElementById("tDrawBox").classList.toggle("hidden", started());
    document.getElementById("tLiveBox").classList.toggle("hidden", !started());

    if (started()) {
      const left = remaining().length;
      document.getElementById("tLiveNote").textContent =
        `${teams().length} teams · ${totalRounds()} rounds · ${fixtures().length} matches, `
        + (left ? `${left} still to play.` : "all played.");
      document.getElementById("tEndBtn").textContent = left ? "Scrap the draw" : "Scrap the draw & re-draw";
      return;
    }

    const selA = document.getElementById("tPlayerA");
    const selB = document.getElementById("tPlayerB");
    const free = activePlayers().filter(p => !onATeam(p.id))
      .sort((x, y) => String(x.name).localeCompare(String(y.name)));
    const options = skip => `<option value="">Choose a player…</option>` + free
      .filter(p => String(p.id) !== String(skip))
      .map(p => `<option value="${p.id}">${esc(p.name)} — ${ratingLabel(p.rating)}</option>`).join("");
    selA.innerHTML = options(draft.b);
    selB.innerHTML = options(draft.a);
    if (!free.some(p => String(p.id) === draft.a)) draft.a = "";
    if (!free.some(p => String(p.id) === draft.b)) draft.b = "";
    selA.value = draft.a; selB.value = draft.b;
    const tooFew = free.length < 2;
    selA.disabled = selB.disabled = tooFew || !on();
    document.getElementById("tAddBtn").disabled = tooFew || !draft.a || !draft.b || !on();
    document.getElementById("tAutoBtn").disabled = !on() || activePlayers().length < 4;
    document.getElementById("tStartBtn").disabled = !on() || teams().length < 2;
    document.getElementById("tClearBtn").disabled = !on() || !teams().length;

    const list = document.getElementById("tTeamList");
    list.innerHTML = teams().length
      ? teams().map((t, i) => `
        <div class="pair-item">
          <div class="pair-names">
            <b>#${i + 1} ${esc(teamName(t))}</b>
            <em class="pair-status ok">Combined ${teamRating(t).toFixed(2)}</em>
          </div>
          <button type="button" class="pair-unlink" data-drop-team="${t.id}" aria-label="Remove team">Remove</button>
        </div>`).join("")
      : `<div class="pair-empty">No teams yet. Draw them automatically, or pick two players and add them.</div>`;

    const n = teams().length;
    const rounds = n < 2 ? 0 : (n % 2 ? n : n - 1);
    const matches = n < 2 ? 0 : (n * (n - 1)) / 2;
    document.getElementById("tDrawNote").textContent = n < 2
      ? "A round robin needs at least 2 teams. Every team plays every other team once."
      : `${n} teams → ${rounds} rounds, ${matches} matches.`
        + (n % 2 ? " With an odd number of teams, one team rests each round." : "")
        + ` ${free.length} player${free.length === 1 ? "" : "s"} not on a team.`;
  }

  function paint() { renderModal(); renderPanel(); }

  /* ---------- wiring ---------- */
  function wire() {
    const sw = document.getElementById("tModeToggle");
    if (!sw) return;
    sw.addEventListener("click", () => setMode(!on()));
    document.getElementById("tAddBtn").addEventListener("click", () => addTeam(draft.a, draft.b));
    document.getElementById("tAutoBtn").addEventListener("click", autoDraw);
    document.getElementById("tClearBtn").addEventListener("click", clearTeams);
    document.getElementById("tStartBtn").addEventListener("click", start);
    document.getElementById("tEndBtn").addEventListener("click", resetDraw);
    ["tPlayerA", "tPlayerB"].forEach(id => {
      document.getElementById(id).addEventListener("change", e => {
        draft[id === "tPlayerA" ? "a" : "b"] = e.target.value;
        renderModal();
      });
    });
    document.getElementById("tTeamList").addEventListener("click", e => {
      const btn = e.target.closest("[data-drop-team]");
      if (btn) removeTeam(btn.dataset.dropTeam);
    });
  }

  wire();
  window.Tournament = {
    on, started, fill, render: paint, standings, playerOrder, summary,
    setMode, resetDraw,
    cardTags, sideLabel, totalRounds, currentRound,
    remaining: () => remaining().length
  };
  // app.js renders the page once at the end of its own file, before this
  // module exists. A session that was left mid-tournament would therefore
  // draw its courts as though it were open play -- "Team A" against "Team B",
  // with CHANGE buttons the draw does not allow. Render it again now.
  if (typeof window.render === "function") window.render(); else paint();
})();
