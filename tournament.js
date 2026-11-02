/*
  tournament.js — Tournament mode (round robin), one bracket per court.

  Open play asks "who has waited longest?" and builds a match out of whoever
  that is. A tournament asks nothing: the teams are fixed, the schedule is
  drawn before the first serve, and every team plays every other team once.
  Those are opposite ideas, so this is a mode rather than a setting — the
  rotation, the game limit, court skill levels and fixed partners all stand
  down while it is on, because the draw has already decided everything they
  would have decided.

  Each court runs its own bracket: its own division, its own teams, its own
  draw and its own standings. That is how a club actually runs an afternoon --
  Court 1 the intermediate-to-advanced tournament, Court 2 the beginners' --
  and the two never meet, so there are two champions, not one.

  A court with no bracket of its own is spare: whichever bracket needs a court
  next may use it. With every team on Court 1 and Court 2 left empty, that is
  one tournament across two courts, which is what a single-bracket draw was
  before brackets existed.

  What stays exactly the same: the court cards, entering a score, the rating
  maths, history, the leaderboard and the badges. A tournament match is an
  ordinary round with a fixture id on it, so everything downstream of the
  score is code that was already there.

  The draw is the circle method: fix the first team, rotate the rest, and
  after N-1 rounds everyone has met. With an odd number of teams one sits out
  each round -- that is the bye, and it is a real rest, not a walkover.

  Nothing here is destructive on its own. Leaving the mode keeps the draw.
*/
(function () {
  const T = () => state.tournament;
  const on = () => state.mode === "tournament";
  const started = () => on() && T().started;

  /* ---------- brackets ---------- */
  // One bracket per court, identified by its court number. The division is
  // what makes a bracket a competition rather than just a pile of teams: only
  // players inside the band can be drawn into it.
  const courts = () => courtsInUse();
  const divisionFor = court => (T().divisions || {})[Number(court)] || "all";
  const teamsOn = court => teams().filter(t => Number(t.court) === Number(court));
  const fixturesOn = court => fixtures().filter(f => Number(f.court) === Number(court));
  // The group stage and the knockout are different competitions inside one
  // bracket: the table is the group's, and a playoff result must never move
  // it. Everything that reads the table filters to the group first.
  const groupOn = court => fixturesOn(court).filter(f => f.stage !== "ko");
  const koOn = court => fixturesOn(court).filter(f => f.stage === "ko");
  const groupDone = court => groupOn(court).length > 0 && groupOn(court).every(played);
  // Courts with a competition on them. A court with one team is an error the
  // draw refuses; a court with none is spare.
  const liveCourts = () => courts().filter(c => teamsOn(c).length >= 2);

  // Who may still be drawn into this court's bracket: in its band, in the
  // session, and not already on a team anywhere. A player belongs to one
  // bracket only, even when two bands would both accept them.
  const eligibleFor = court => activePlayers()
    .filter(p => fitsDivision(p, divisionFor(court)) && !onATeam(p.id));

  // How many times the draw goes round. One cycle gives every team exactly
  // one game against every other, so games per team is (teams - 1) x cycles --
  // which is why this is set in cycles and shown in games: a whole number of
  // cycles is the only way every team plays the same opponents the same
  // number of times.
  const CYCLE_MAX = 4;
  const CYCLE_WORDS = ["", "single", "double", "triple", "quadruple"];
  const cyclesFor = court => {
    const n = Number((T().cycles || {})[Number(court)]) || 1;
    return Math.max(1, Math.min(CYCLE_MAX, n));
  };
  const gamesEach = (teamCount, cycles) => teamCount < 2 ? 0 : (teamCount - 1) * cycles;
  const gamesEachOn = court => gamesEach(teamsOn(court).length, cyclesFor(court));

  function setCycles(court, n) {
    if (started()) return toast("The draw is already made. Scrap it first to change the length.");
    court = Number(court);
    n = Math.max(1, Math.min(CYCLE_MAX, Number(n) || 1));
    if (n === cyclesFor(court)) return;
    T().cycles[court] = n;
    saveState();
    const teamCount = teamsOn(court).length;
    toast(teamCount < 2
      ? `Court ${court}: ${CYCLE_WORDS[n]} round robin.`
      : `Court ${court}: ${CYCLE_WORDS[n]} round robin — ${gamesEach(teamCount, n)} games each.`);
  }

  // The playoffs: the top few teams from the group table play a straight
  // knockout. Off, or a bracket of 2 (final), 4 (semi-finals) or 8
  // (quarter-finals) -- never with byes, so a size is only offered when the
  // court has that many teams.
  const PLAYOFF_SIZES = [0, 2, 4, 8];
  const KO_NAMES = { 2: "Final", 4: "Semi-final", 8: "Quarter-final", 16: "Round of 16" };
  const koName = size => KO_NAMES[size] || `Round of ${size}`;
  const playoffsFor = court => {
    const raw = Number((T().playoffs || {})[Number(court)]) || 0;
    const n = PLAYOFF_SIZES.includes(raw) ? raw : 0;
    if (!n) return 0;
    // A top 4 needs four teams. Teams may have gone since the size was picked,
    // so it is checked against the field every time rather than at the click.
    // A bracket already drawn stands whatever happens afterwards.
    if (koOn(court).length) return n;
    return teamsOn(court).length >= n ? n : 0;
  };

  // The third-place match: the two beaten semi-finalists play off for it. Only
  // a bracket with semi-finals has two of them, so a top 2 cannot have one.
  const thirdPlaceOn = court =>
    playoffsFor(court) >= 4 && (T().thirdPlace || {})[Number(court)] === true;
  const finalOn = court => koOn(court).find(f => Number(f.koSize) === 2 && !f.third) || null;
  const thirdOn = court => koOn(court).find(f => f.third) || null;
  // Every match a playoff is worth: a knockout of N is N-1, plus the third-place
  // match if it is being played.
  const koTotal = court => {
    const size = playoffsFor(court);
    return size ? size - 1 + (thirdPlaceOn(court) ? 1 : 0) : 0;
  };

  function setThirdPlace(court, want) {
    court = Number(court);
    want = want === true;
    if (want === ((T().thirdPlace || {})[court] === true)) return;
    if (koOn(court).length) {
      return toast(`Court ${court}'s playoffs have already started. Scrap the draw to change them.`);
    }
    if (want && playoffsFor(court) < 4) {
      return toast("A third-place match needs semi-finals — pick a top 4 or top 8 playoff first.");
    }
    T().thirdPlace[court] = want;
    saveState();
    toast(want
      ? `Court ${court}: the beaten semi-finalists will play off for third.`
      : `Court ${court}: no third-place match — both semi-finalists share third.`);
  }

  // "1 v 4, 2 v 3" -- the seeding, said the way a draw sheet says it.
  const pairText = size => {
    const parts = [];
    for (let i = 1; i <= size / 2; i++) parts.push(`${i} v ${size + 1 - i}`);
    return parts.join(", ");
  };
  // What comes after the first playoff round.
  const tailText = size => size <= 2 ? ""
    : size === 4 ? ", then the final"
      : `, then ${KO_NAMES[size / 2].toLowerCase()}s and the final`;

  function setPlayoffs(court, size) {
    court = Number(court);
    size = Number(size) || 0;
    if (!PLAYOFF_SIZES.includes(size) || size === playoffsFor(court)) return;
    // Changeable right up until the bracket is drawn, because it seeds from
    // the final table and nothing before then depends on it.
    if (koOn(court).length) {
      return toast(`Court ${court}'s playoffs have already started. Scrap the draw to change them.`);
    }
    if (size && teamsOn(court).length < size) {
      return toast(`Court ${court} has ${teamsOn(court).length} teams — `
        + `a top ${size} playoff needs ${size}.`);
    }
    T().playoffs[court] = size;
    saveState();
    toast(size
      ? `Court ${court}: top ${size} go through to the ${koName(size).toLowerCase()}s.`
      : `Court ${court}: no playoffs — the group table decides it.`);
  }

  function setDivision(court, key) {
    if (started()) return toast("The draw is already made. Scrap it first to change a division.");
    court = Number(court);
    if (!TOURNAMENT_DIVISIONS.some(d => d.key === key) || key === divisionFor(court)) return;
    // Teams that no longer belong to the competition have to go, so the
    // organiser is asked before the division moves rather than after.
    const strays = teamsOn(court).filter(t => t.players.some(id => !fitsDivision(player(id) || {}, key)));
    if (strays.length && !confirm(`${strays.length} team${strays.length === 1 ? "" : "s"} on Court ${court} `
      + `(${strays.map(teamName).join(", ")}) fall outside ${divisionLabel(key)}.\n\n`
      + `Switch the division and remove ${strays.length === 1 ? "it" : "them"}?`)) return;
    T().divisions[court] = key;
    T().teams = teams().filter(t => !strays.includes(t));
    draft = { a: "", b: "" };
    saveState();
    const n = eligibleFor(court).length;
    toast(`Court ${court}: ${divisionLabel(key)} — ${n} player${n === 1 ? "" : "s"} free to draw.`
      + (strays.length ? ` ${strays.length} team${strays.length === 1 ? "" : "s"} removed.` : ""));
  }

  /* ---------- teams ---------- */
  const teams = () => T().teams;
  const teamOf = id => teams().find(t => t.id === Number(id)) || null;
  // Seeds are per bracket, because a bracket is its own competition.
  const seedOf = id => {
    const t = teamOf(id);
    return t ? teamsOn(t.court).indexOf(t) + 1 : 0;
  };
  function teamName(t) {
    if (!t) return "—";
    const names = t.players.map(id => (player(id) || {}).name).filter(Boolean);
    return names.length ? names.join(" + ") : "(empty team)";
  }
  const teamOfPlayer = id => teams().find(t => t.players.some(p => Number(p) === Number(id))) || null;
  const onATeam = id => !!teamOfPlayer(id);

  // The combined rating of a team, which is all the auto-draw sorts by.
  const teamRating = t => t.players.reduce((s, id) => s + Number((player(id) || {}).rating || 3), 0);

  function addTeam(court, aId, bId) {
    if (started()) return toast("The draw is already made. Scrap it first to change the teams.");
    court = Number(court);
    const a = Number(aId), b = Number(bId);
    const pa = player(a), pb = player(b);
    if (!pa || !pb) return toast("Pick two players to make a team.");
    if (a === b) return toast("A player cannot partner themselves.");
    if (pa.active === false || pb.active === false) return toast("Both players must still be in the session.");
    if (onATeam(a)) return toast(`${pa.name} is already on ${teamName(teamOfPlayer(a))}.`);
    if (onATeam(b)) return toast(`${pb.name} is already on ${teamName(teamOfPlayer(b))}.`);
    const outside = [pa, pb].filter(p => !fitsDivision(p, divisionFor(court)));
    if (outside.length) {
      return toast(`${outside.map(p => `${p.name} (${ratingLabel(p.rating)})`).join(" and ")} `
        + `${outside.length === 1 ? "is" : "are"} outside Court ${court}'s ${divisionLabel(divisionFor(court))}.`);
    }
    T().teams.push({ id: T().nextTeamId++, players: [a, b], court });
    draft = { a: "", b: "" };
    saveState();
    toast(`Court ${court}, team ${teamsOn(court).length}: ${pa.name} + ${pb.name}.`);
  }

  function removeTeam(id) {
    if (started()) return toast("The draw is already made. Scrap it first to change the teams.");
    const t = teamOf(id);
    if (!t) return;
    T().teams = teams().filter(x => x !== t);
    saveState();
    toast(`${teamName(t)} removed. Both players are free to be picked again.`);
  }

  // Strongest with weakest, working inwards, inside one court's band. It is
  // the standard way to draw a social tournament: it does not make the teams
  // equal (nothing does), but it stops the two best players ending up
  // together, which is the one draw that makes the whole afternoon a
  // formality.
  function autoDraw(court) {
    if (started()) return toast("The draw is already made. Scrap it first to change the teams.");
    court = Number(court);
    const key = divisionFor(court);
    const pool = eligibleFor(court).slice().sort((a, b) =>
      Number(b.rating) - Number(a.rating) || String(a.name).localeCompare(String(b.name)));
    if (pool.length < 4) {
      return toast(`Only ${pool.length} player${pool.length === 1 ? "" : "s"} free for Court ${court}`
        + (key === "all" ? "" : ` in ${divisionLabel(key)}`) + " — 4 needed for two teams.");
    }

    const made = [];
    while (pool.length >= 2) made.push([pool.shift().id, pool.pop().id]);
    const spare = pool.length ? pool[0] : null;   // odd player out

    // Only this court's teams are replaced; the other bracket is untouched.
    T().teams = teams().filter(t => Number(t.court) !== court)
      .concat(made.map(players => ({ id: T().nextTeamId++, players, court })));
    draft = { a: "", b: "" };
    saveState();
    toast(`Court ${court}: ${made.length} teams drawn`
      + (key === "all" ? "" : ` for ${divisionLabel(key)}`) + ", strongest with weakest."
      + (spare ? ` ${spare.name} is not on a team — add a player or pair them by hand.` : ""));
  }

  function clearTeams(court) {
    if (started()) return toast("Scrap the draw first.");
    court = Number(court);
    if (!teamsOn(court).length) return;
    if (!confirm(`Clear Court ${court}'s teams and draw them again?`)) return;
    T().teams = teams().filter(t => Number(t.court) !== court);
    saveState();
    toast(`Court ${court}'s teams cleared.`);
  }

  /* ---------- the draw ---------- */
  // Circle method. One team is pinned and the rest rotate around it, so after
  // N-1 rounds every pair has met exactly once. An odd count gets a phantom
  // team (0) whose opponent each round simply rests.
  function buildSchedule(ids, court, div, cycles) {
    const out = [];
    const width = (ids.length % 2 ? ids.length + 1 : ids.length) - 1;  // rounds per cycle
    for (let c = 0; c < Math.max(1, cycles); c++) {
      const list = ids.slice();
      if (list.length % 2) list.push(0);
      const n = list.length;
      // The return leg swaps the sides of the first leg, so a team that was
      // Team A against someone the first time is Team B the second.
      const leg = c % 2 === 1;
      for (let r = 0; r < n - 1; r++) {
        for (let i = 0; i < n / 2; i++) {
          const x = list[i], y = list[n - 1 - i];
          if (!x || !y) continue;                     // this one has the bye
          // The circle method would otherwise put the same team on the same
          // side of every scorecard. Flipping the pinned team's fixture on
          // alternate rounds spreads it: no team ends up more than one match
          // out of balance between Team A and Team B.
          let [home, away] = (i === 0 && r % 2) ? [y, x] : [x, y];
          if (leg) [home, away] = [away, home];
          out.push({ id: T().nextFixtureId++, round: c * width + r + 1,
            a: home, b: away, court, div, leg: c + 1, stage: "group" });
        }
        list.splice(1, 0, list.pop());                // rotate all but the first
      }
    }
    return out;
  }

  function start() {
    if (started()) return;
    const lonely = courts().filter(c => teamsOn(c).length === 1);
    if (lonely.length) {
      return toast(lonely.length === 1
        ? `Court ${lonely[0]} has one team. A round robin needs at least two, or remove it.`
        : `Courts ${lonely.join(" and ")} have one team each. A round robin needs at least two on a court, or remove them.`);
    }
    const live = liveCourts();
    if (!live.length) return toast("A round robin needs at least 2 teams on a court.");
    if (teams().some(t => t.players.some(id => !player(id)))) {
      return toast("A team has a player who is no longer in the session. Fix the teams first.");
    }

    T().fixtures = live.flatMap(c =>
      buildSchedule(teamsOn(c).map(t => t.id), c, divisionFor(c), cyclesFor(c)));
    T().started = true;
    T().startedAt = new Date().toISOString();
    saveState();
    const parts = live.map(c => {
      const n = groupOn(c).length;
      const size = playoffsFor(c);
      return `Court ${c}: ${teamsOn(c).length} teams, ${n} match${n === 1 ? "" : "es"}, `
        + `${gamesEachOn(c)} game${gamesEachOn(c) === 1 ? "" : "s"} each`
        + (size ? `, then a top ${size} knockout` : "")
        + (thirdPlaceOn(c) ? " with a third-place match" : "");
    });
    toast(`Draw made — ${parts.join(" · ")}. Press Start Next Match.`);
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
  const remaining = () => fixtures().filter(f => !roundFor(f));
  const roundsOn = court => {
    const list = groupOn(court);
    return list.length ? Math.max(...list.map(f => f.round)) : 0;
  };
  // The group round being played on a court: the earliest with a match
  // unfinished.
  function currentRoundOn(court) {
    const open = groupOn(court).filter(f => !played(f));
    return open.length ? Math.min(...open.map(f => f.round)) : roundsOn(court);
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
  // the schedule rather than picking players out of a queue. A court plays its
  // own bracket. A court with no bracket of its own is spare, and takes
  // whichever bracket has the longest queue left to get through.
  function fill(silent) {
    if (!started()) return toast("Draw the teams and press Make the draw first.");
    // A court whose group has just finished gets its playoff bracket here as
    // well as on the score that finished it, so a reload or a playoff switched
    // on after the event still finds its matches.
    if (courts().filter(c => ensureKnockout(c)).length) saveState();
    const pending = state.rounds.filter(r => r.status === "pending");
    const maxPending = state.courtCount === 1 ? 1 : 2;
    if (pending.length >= maxPending) {
      return toast(maxPending === 1
        ? "Court 1 is in play. Enter its score to move on."
        : "Both courts are in play. Enter a score to move on.");
    }
    if (!remaining().length) {
      if (!fixtures().length) return toast("No draw yet.");
      // Nothing to start is not the same as nothing left: the last match may
      // be on court, or a final may be waiting on a semi-final.
      if (matchesLeft()) {
        return toast(pending.length === 1
          ? "The next match is waiting on the one being played. Enter its score."
          : "The next match is waiting on the ones being played. Enter a score.");
      }
      const champs = liveCourts().map(c => {
        const t = championOn(c);
        return t ? `Court ${c}: ${teamName(t)}` : "";
      }).filter(Boolean);
      return toast(champs.length
        ? `The tournament is over. ${champs.join(" · ")}.`
        : "Every match in the draw has been played. The standings are final.");
    }

    const busy = busyTeams();
    const taken = new Set();
    const occupied = new Set(pending.map(r => Number(r.court) || 1));
    const free = courts().filter(c => !occupied.has(c));
    const created = [];
    const nextFor = list => list.find(f =>
      !roundFor(f) && !taken.has(f.id) && !busy.has(f.a) && !busy.has(f.b));

    free.forEach(court => {
      // Its own bracket first; failing that, the busiest bracket that still
      // has a fixture whose teams are free.
      let next = nextFor(fixturesOn(court));
      if (!next) {
        const byQueue = liveCourts()
          .filter(c => c !== court)
          .sort((x, y) => fixturesOn(y).filter(f => !roundFor(f)).length
            - fixturesOn(x).filter(f => !roundFor(f)).length || x - y);
        for (const other of byQueue) {
          next = nextFor(fixturesOn(other));
          if (next) break;
        }
      }
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
      toast(created.map(c => `Court ${c.round.court} · Round ${c.fixture.round}: `
        + `${teamName(teamOf(c.fixture.a))} vs ${teamName(teamOf(c.fixture.b))}`).join(" — "));
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

  /* ---------- the playoffs ---------- */
  // The bracket is drawn one round at a time, because its seeds are not known
  // until the round before it has been played. The first round seeds straight
  // off the final group table; after that, match i's winner meets match
  // (last - i)'s, which is what keeps the top two seeds apart until the final.
  function ensureKnockout(court) {
    court = Number(court);
    const size = playoffsFor(court);
    if (!size || !groupDone(court)) return false;

    const ko = koOn(court);
    if (!ko.length) {
      const through = standingsOn(court).slice(0, size).map(r => r.team.id);
      if (through.length < size) return false;      // a team has gone missing
      return addKoRound(court, through, size);
    }

    const smallest = Math.min(...ko.map(f => Number(f.koSize)));
    const last = ko.filter(f => Number(f.koSize) === smallest)
      .sort((a, b) => a.slot - b.slot);
    if (smallest <= 2) return false;                // the final has been drawn
    if (!last.every(played)) return false;          // this round is still being played
    const winners = last.map(f => {
      const r = roundFor(f);
      return r.winner === "A" ? f.a : f.b;
    });
    addKoRound(court, winners, smallest / 2);
    // Losing a semi-final is where the third-place match comes from, so it is
    // drawn at the same moment as the final it sits beside.
    if (smallest === 4 && thirdPlaceOn(court)) {
      const losers = last.map(f => {
        const r = roundFor(f);
        return r.winner === "A" ? f.b : f.a;
      });
      T().fixtures.push({ id: T().nextFixtureId++, round: 0, a: losers[0], b: losers[1],
        court, div: divisionFor(court), leg: 1, stage: "ko", koSize: 2, slot: 1, third: true });
    }
    return true;
  }

  // `order` is seeded best-first; the pairing is first against last.
  function addKoRound(court, order, size) {
    const div = divisionFor(court);
    for (let i = 0; i < order.length / 2; i++) {
      T().fixtures.push({
        id: T().nextFixtureId++, round: 0, a: order[i], b: order[order.length - 1 - i],
        court, div, leg: 1, stage: "ko", koSize: size, slot: i
      });
    }
    return true;
  }

  // Playoff matches that exist but have not been drawn yet, because the round
  // before them is still being played. Without these, "matches left" would
  // read zero the moment both semi-finals were on court and the Start Next
  // Match button would switch itself off with a final still to come.
  function undrawnPlayoffs(court) {
    const size = playoffsFor(court);
    if (!size || !groupOn(court).length) return 0;  // no draw, nothing to come
    return koTotal(court) - koOn(court).length;
  }
  const matchesLeft = () => remaining().length
    + courts().reduce((n, c) => n + undrawnPlayoffs(c), 0);

  // Called after every tournament score. A result can be the one that
  // completes a group or a knockout round, and the next round has to exist
  // before the state is written, so this runs inside recordScore.
  function afterScore(round) {
    const f = round && round.fixtureId ? fixture(round.fixtureId) : null;
    if (!f || !started()) return "";
    const court = Number(f.court) || 1;
    if (!ensureKnockout(court)) return "";
    const ko = koOn(court);
    const size = Math.min(...ko.map(x => Number(x.koSize)));
    const fresh = ko.filter(x => Number(x.koSize) === size).sort((a, b) => a.slot - b.slot);
    const names = fresh.map(x =>
      `${teamName(teamOf(x.a))} vs ${teamName(teamOf(x.b))}`).join(" · ");
    return ` Court ${court} ${koName(size).toLowerCase()}${fresh.length === 1 ? "" : "s"}: ${names}.`;
  }

  // Where each team finished, once the playoffs are taken into account: the
  // winner of the final first, then the team it beat, then whoever went out in
  // the round before, and so on down to the teams that did not qualify. Teams
  // level on how far they got are separated by the group table, which is also
  // the whole order when there are no playoffs.
  function placementOn(court) {
    const group = standingsOn(court);
    if (!playoffsFor(court) || !koOn(court).length) return group.map(r => r.team);
    const pos = new Map(group.map((r, i) => [r.team.id, i]));
    const size = playoffsFor(court);
    const through = new Set(group.slice(0, size).map(r => r.team.id));
    // The round each team went out at. A bigger round means an earlier exit.
    const out = new Map();
    koOn(court).forEach(f => {
      if (f.third) return;                   // a place, not an exit
      const r = roundFor(f);
      if (!r || r.status !== "completed") return;
      const loser = r.winner === "A" ? f.b : f.a;
      out.set(loser, Math.max(out.get(loser) || 0, Number(f.koSize)));
    });
    // Both beaten semi-finalists went out at the same point, so where they
    // played off for third, that match separates them rather than the table.
    const third = thirdOn(court);
    const tr = third && roundFor(third);
    const thirdRank = new Map();
    if (tr && tr.status === "completed") {
      thirdRank.set(tr.winner === "A" ? third.a : third.b, 0);
      thirdRank.set(tr.winner === "A" ? third.b : third.a, 1);
    }
    const tier = t => !through.has(t.id) ? Infinity : (out.get(t.id) || 0);
    const place = t => thirdRank.has(t.id) ? thirdRank.get(t.id) : 0;
    return group.map(r => r.team).sort((a, b) =>
      tier(a) - tier(b) || place(a) - place(b) || pos.get(a.id) - pos.get(b.id));
  }

  // How far a team got, for the table and for the saved session. The words are
  // the ones a player would use: you were the champion, or the runner-up, or
  // you went out in the semi-finals, or you did not qualify.
  const EXIT_WORDS = { 2: "Runner-up", 4: "Semi-finalist", 8: "Quarter-finalist" };
  function exitLabel(court, id) {
    const size = playoffsFor(court);
    if (!size) return "";
    const champ = championOn(court);
    if (champ && champ.id === id) return "Champion";
    const through = standingsOn(court).slice(0, size).map(r => r.team.id);
    if (!through.includes(id)) return "Group stage";
    // A played third-place match turns "semi-finalist" into a placing.
    const third = thirdOn(court);
    const tr = third && roundFor(third);
    if (tr && tr.status === "completed" && (third.a === id || third.b === id)) {
      return (tr.winner === "A" ? third.a : third.b) === id ? "Third place" : "Fourth place";
    }
    const lost = koOn(court).find(f => {
      if (f.third) return false;
      const r = roundFor(f);
      return r && r.status === "completed" && (r.winner === "A" ? f.b : f.a) === id;
    });
    if (!lost) return koOn(court).length ? "Still in" : "Qualified";
    return EXIT_WORDS[Number(lost.koSize)] || `Out in the ${koName(lost.koSize).toLowerCase()}`;
  }

  // Who actually won the thing. Without playoffs that is the top of the table;
  // with them it is the winner of the final, and nobody until it is played.
  function championOn(court) {
    const size = playoffsFor(court);
    const table = standingsOn(court);
    if (!size) return table.length && table[0].played ? table[0].team : null;
    const final = finalOn(court);
    const r = final && roundFor(final);
    if (!r || r.status !== "completed") return null;
    return teamOf(r.winner === "A" ? final.a : final.b);
  }

  /* ---------- standings ---------- */
  // Which of two teams won when they met. A single round robin plays that
  // match once, so this is exact for a two-way tie. In a three-way tie it can
  // point in a circle, and the comparisons before it are what decide; this
  // only ever breaks what is still level after them.
  function headToHead(x, y) {
    // Two teams can meet more than once when the draw goes round more than
    // once, so this is the aggregate of their meetings: who won more of them,
    // and failing that the points between just the two of them.
    let wins = 0, points = 0;
    state.rounds.forEach(round => {
      if (round.status !== "completed" || !round.fixtureId) return;
      const f = fixture(round.fixtureId);
      if (!f) return;
      if (f.stage === "ko") return;                // group meetings only
      if (!((f.a === x && f.b === y) || (f.a === y && f.b === x))) return;
      const sa = Number(round.scoreA) || 0, sb = Number(round.scoreB) || 0;
      const forX = f.a === x ? sa - sb : sb - sa;
      points += forX;
      const winner = round.winner === "A" ? f.a : f.b;
      wins += winner === x ? 1 : -1;
    });
    return wins ? (wins > 0 ? -1 : 1) : points ? (points > 0 ? -1 : 1) : 0;
  }

  // One table per bracket. A court's table only counts matches between its own
  // teams, which is every match it has, since brackets never meet.
  function standingsOn(court) {
    const rows = teamsOn(court).map((t, i) => ({
      team: t, seed: i + 1, played: 0, wins: 0, losses: 0, pf: 0, pa: 0, diff: 0
    }));
    const by = new Map(rows.map(r => [r.team.id, r]));
    state.rounds.filter(r => r.status === "completed" && r.fixtureId).forEach(r => {
      const f = fixture(r.fixtureId);
      if (!f || f.stage === "ko") return;          // playoffs do not move the table
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
  // itself. With two brackets there are two champions, so the board is ordered
  // by place within a bracket first and by court only to break that -- the
  // champions lead it, then the runners-up. Inside a team the two players are
  // level on the thing being ranked, so their own point difference separates
  // them.
  function playerOrder(list, diff) {
    const place = new Map();
    // The final placings, not the group table: once a knockout has been played
    // the champion is the team that won the final, and the podium has to say so.
    liveCourts().forEach(c => placementOn(c).forEach((team, i) =>
      team.players.forEach(id => place.set(Number(id), { place: i, court: c }))));
    const at = p => place.get(Number(p.id));
    return [...list].sort((a, b) => {
      const aPlayed = (Number(a.games) || 0) > 0, bPlayed = (Number(b.games) || 0) > 0;
      if (aPlayed !== bPlayed) return aPlayed ? -1 : 1;          // unplayed last, as in open play
      const pa = at(a), pb = at(b);
      if (!pa !== !pb) return pa ? -1 : 1;                       // not on a team: below everyone on one
      if (pa && pb && (pa.place !== pb.place || pa.court !== pb.court)) {
        return pa.place - pb.place || pa.court - pb.court;
      }
      return (diff[b.id] || 0) - (diff[a.id] || 0) || b.wins - a.wins ||
        String(a.name).localeCompare(String(b.name));
    });
  }

  /* ---------- what the rest of the app asks for ---------- */
  // The tags on a tournament court card: the bracket it belongs to, and where
  // the fixture sits in that bracket's draw.
  function cardTags(r) {
    const f = fixture(r.fixtureId);
    if (!f) return "";
    const d = divisionOf(f.div);
    const court = Number(f.court) || 1;
    const elsewhere = court !== (Number(r.court) || 1) ? ` (Court ${court} draw)` : "";
    // A knockout match is not round n of m: it is the semi-final.
    const where = f.stage === "ko"
      ? (f.third ? "Third-place match"
        : `${koName(f.koSize)}${Number(f.koSize) > 2 ? ` ${Number(f.slot) + 1}` : ""}`)
      : `Round ${f.round} of ${roundsOn(court)}`;
    return (d.key === "all" ? "" : `<span class="t-round-tag t-div-tag">🏅 ${esc(d.label)}</span>`)
      + `<span class="t-round-tag${f.stage === "ko" ? " t-ko-tag" : ""}">🏆 ${esc(where)}${esc(elsewhere)}</span>`;
  }
  function sideLabel(r, side) {
    const f = fixture(r.fixtureId);
    if (!f) return side === "A" ? "Team A" : "Team B";
    const id = side === "A" ? f.a : f.b;
    return `#${seedOf(id)} ${teamName(teamOf(id))}`;
  }

  // Where a court is up to: a group round, or the playoff round being played.
  // Once the final is won it is the champion that matters, not the round.
  function stageOn(court) {
    const size = playoffsFor(court);
    if (!groupDone(court)) return `Round ${currentRoundOn(court)} of ${roundsOn(court)}`;
    if (!size) return "Group complete";
    const ko = koOn(court);
    if (!ko.length) return "Playoffs to draw";
    const open = ko.filter(f => !played(f));
    if (open.length) {
      return open.every(f => f.third) ? "Third-place match"
        : koName(Math.min(...open.map(f => Number(f.koSize))));
    }
    const champ = championOn(court);
    return champ ? `Won by ${teamName(champ)}` : "Playoffs complete";
  }
  function stageShortOn(court) {
    const size = playoffsFor(court);
    if (!groupDone(court)) return `${currentRoundOn(court)}/${roundsOn(court)}`;
    if (!size) return "done";
    const open = koOn(court).filter(f => !played(f));
    if (!koOn(court).length) return "playoffs";
    if (!open.length) return "won";
    return open.every(f => f.third) ? "3rd place"
      : koName(Math.min(...open.map(f => Number(f.koSize)))).toLowerCase();
  }

  // What the hero chip and the Active Matches subtitle say. One bracket reads
  // as a tournament; two read as two.
  function headline() {
    if (!started()) {
      const n = teams().length;
      return n ? `Tournament · ${n} team${n === 1 ? "" : "s"} drawn, no schedule yet` : "Tournament · no draw yet";
    }
    const live = liveCourts();
    if (live.length === 1) {
      const c = live[0];
      const d = divisionOf(divisionFor(c));
      return `${d.key === "all" ? "Tournament" : d.label} · ${stageOn(c)}`;
    }
    return live.map(c => {
      const d = divisionOf(divisionFor(c));
      return `C${c} ${d.key === "all" ? "open" : d.label} ${stageShortOn(c)}`;
    }).join(" · ");
  }

  // Goes into the spreadsheet with the session, so a saved tournament is
  // readable without the app. One entry per bracket, each with its own
  // champion, because each is its own competition.
  function summary() {
    if (!fixtures().length) return null;
    const drawn = [...new Set(fixtures().map(f => Number(f.court) || 1))].sort((a, b) => a - b);
    const brackets = drawn.map(c => {
      const table = standingsOn(c);
      const list = fixturesOn(c);
      const size = playoffsFor(c);
      const champ = championOn(c);
      return {
        court: c,
        division: divisionLabel(list.length ? list[0].div : divisionFor(c)),
        teams: teamsOn(c).length,
        rounds: roundsOn(c),
        format: `${CYCLE_WORDS[cyclesFor(c)]} round robin`
          + (size ? ` + top ${size} knockout` : "")
          + (thirdPlaceOn(c) ? " with a third-place match" : ""),
        playoffs: size
          ? `Top ${size} knockout${thirdPlaceOn(c) ? " + third place" : ""}` : "None",
        gamesPerTeam: gamesEachOn(c),
        matches: list.length,
        played: list.filter(played).length,
        champion: champ ? teamName(champ) : "",
        standings: table.map((r, i) => ({
          place: i + 1, team: teamName(r.team), played: r.played, wins: r.wins,
          losses: r.losses, pointsFor: r.pf, pointsAgainst: r.pa, diff: r.diff,
          result: exitLabel(c, r.team.id)
        })),
        // The group table and the final order are different things once a
        // knockout has been played, so both are saved.
        finishing: size ? placementOn(c).map((t, i) => ({
          place: i + 1, team: teamName(t), result: exitLabel(c, t.id)
        })) : null
      };
    });
    return {
      brackets,
      // Flat fields so a one-bracket tournament reads the way it always did.
      division: brackets.map(b => `Court ${b.court}: ${b.division}`).join(" · "),
      playoffs: brackets.some(b => b.playoffs !== "None")
        ? brackets.map(b => `Court ${b.court}: ${b.playoffs}`).join(" · ") : "None",
      champion: brackets.filter(b => b.champion)
        .map(b => brackets.length > 1 ? `${b.division}: ${b.champion}` : b.champion).join(" · "),
      teams: teams().length,
      matches: fixtures().length + courts().reduce((n, c) => n + undrawnPlayoffs(c), 0),
      played: fixtures().filter(played).length
    };
  }

  /* ---------- the Tournament panel on the page ---------- */
  function renderPanel() {
    const panel = document.getElementById("tournamentPanel");
    if (!panel) return;
    panel.classList.toggle("hidden", !started());
    if (!started()) return;

    const live = liveCourts();
    const sub = document.getElementById("tournamentSubtitle");
    const left = matchesLeft();
    if (sub) {
      sub.textContent = (live.length > 1 ? `${live.length} brackets · ` : "")
        + (left ? `${left} match${left === 1 ? "" : "es"} to play` : `Complete · ${fixtures().length} played`);
    }

    document.getElementById("standings").innerHTML = live.map(c => {
      const table = standingsOn(c);
      const d = divisionOf(divisionFor(c));
      const size = playoffsFor(c);
      const champ = championOn(c);
      const courtLeft = fixturesOn(c).filter(f => !roundFor(f)).length + undrawnPlayoffs(c);
      const done = !courtLeft;
      return `
        <div class="t-bracket">
          <div class="t-bracket-head">
            <b>Court ${c}</b>
            <span class="t-bracket-div">${d.key === "all" ? "All levels" : esc(divisionLabel(d.key))}</span>
            ${cyclesFor(c) > 1 ? `<span class="t-bracket-div t-bracket-legs">${CYCLE_WORDS[cyclesFor(c)]} round robin</span>` : ""}
            ${size ? `<span class="t-bracket-div t-bracket-ko">Top ${size} playoff</span>` : ""}
            <em>${esc(stageOn(c))}</em>
          </div>
          <div class="rank-row rank-head t-row">
            <div>#</div><div>Team</div><div class="lb-cell optional">P</div><div class="lb-cell">W</div>
            <div class="lb-cell optional">L</div><div class="lb-cell optional">Pts</div><div class="lb-cell">Diff</div>
          </div>
          ${table.map((r, i) => {
            // With playoffs the medals belong to the knockout, not the table:
            // topping the group is a seeding, not a title.
            const place = !r.played ? "–"
              : size ? i + 1 : (i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1);
            const dd = r.diff > 0 ? `+${r.diff}` : String(r.diff);
            const won = size ? champ && champ.id === r.team.id : i === 0 && r.played && done;
            const how = size ? exitLabel(c, r.team.id) : "";
            const cut = size && i === size - 1 && i < table.length - 1
              ? `<div class="t-cut">Top ${size} go through to the ${esc(koName(size).toLowerCase())}${size > 2 ? "s" : ""}</div>`
              : "";
            return `<div class="rank-row t-row${won ? " t-champion" : ""}">
              <div class="rank">${place}</div>
              <div>
                <div class="lb-name">${esc(teamName(r.team))}${
                  how && how !== "Qualified" && how !== "Group stage"
                    ? ` <span class="t-exit">${esc(how)}</span>` : ""}</div>
                <div class="lb-muted">Seed ${r.seed}${r.played ? ` · ${r.pf}–${r.pa} points` : " · not played yet"}</div>
              </div>
              <div class="lb-cell optional">${r.played}</div>
              <div class="lb-cell"><b>${r.wins}</b></div>
              <div class="lb-cell optional">${r.losses}</div>
              <div class="lb-cell optional">${r.pf}</div>
              <div class="lb-cell rating">${r.played ? dd : "–"}</div>
            </div>${cut}`;
          }).join("")}
          ${renderBracket(c)}
        </div>`;
    }).join("")
      + `<div class="lb-note">Ranked by <b>wins</b>, then point difference, then points scored. Two teams level on all three are split by their own matches against each other — who won more of them, then the points between just the two.`
      + (live.some(c => playoffsFor(c))
        ? ` Where playoffs are on, this table seeds them — the title is won in the final, not here.` : "")
      + (live.length > 1 ? ` Each court is its own tournament with its own champion — the two never meet.` : "")
      + `</div>`;

    renderSchedule();
  }

  // The knockout, drawn as the tree it is: a column per round, left to right,
  // with the rounds that cannot be seeded yet saying what they are waiting for
  // rather than sitting there empty.
  function renderBracket(court) {
    const size = playoffsFor(court);
    if (!size) return "";
    const ko = koOn(court);
    const rounds = [];
    for (let n = size; n >= 2; n /= 2) rounds.push(n);
    const champ = championOn(court);
    const title = n => n > 2 ? `${koName(n)}s` : koName(n);
    const third = thirdOn(court);
    const thirdOpen = thirdPlaceOn(court) && (!third || !played(third));
    return `<div class="t-ko-box">
      <div class="t-ko-head">Playoffs · top ${size}${thirdPlaceOn(court) ? " + third place" : ""}${
        groupDone(court) ? "" : ` · seeded from this table when the group ends (${pairText(size)})`}</div>
      <div class="t-ko-grid">
        ${rounds.map(n => {
          // The third-place match shares the final's size but not its column.
          const list = ko.filter(f => Number(f.koSize) === n && !f.third)
            .sort((a, b) => a.slot - b.slot);
          const now = list.length && list.some(f => !played(f));
          return `<div class="t-ko-round${now ? " is-now" : ""}">
            <div class="t-round-head">${esc(title(n))}${now ? " · now" : ""}</div>
            ${list.length
              ? list.map(fixtureLine).join("")
              : `<div class="t-bye">${n === size
                ? `Seeds ${esc(pairText(size))}`
                : `Winners of the ${esc(title(n * 2).toLowerCase())}`}</div>`}
          </div>`;
        }).join("")}
        ${thirdPlaceOn(court) ? `<div class="t-ko-round t-ko-third${thirdOpen && third ? " is-now" : ""}">
          <div class="t-round-head">Third place${thirdOpen && third ? " · now" : ""}</div>
          ${third ? fixtureLine(third)
            : `<div class="t-bye">Losers of the ${esc(title(4).toLowerCase())}</div>`}
        </div>` : ""}
      </div>
      ${champ ? `<div class="t-ko-champ">🏆 ${esc(teamName(champ))} win Court ${court}</div>` : ""}
    </div>`;
  }

  function renderSchedule() {
    const el = document.getElementById("tSchedule");
    if (!el) return;
    el.innerHTML = liveCourts().map(court => {
      // The group only: a knockout match has no round number, and it has its
      // own tree under the court's table.
      const byRound = {};
      groupOn(court).forEach(f => { (byRound[f.round] = byRound[f.round] || []).push(f); });
      const now = currentRoundOn(court);
      const anyLeft = groupOn(court).some(f => !roundFor(f));
      const d = divisionOf(divisionFor(court));
      return `<div class="t-draw-group">
        <div class="t-draw-title">Court ${court}${d.key === "all" ? "" : ` · ${esc(d.label)}`}</div>
        <div class="t-schedule-grid">
          ${Object.keys(byRound).map(Number).sort((a, b) => a - b).map(n => {
            const resting = restingTeam(court, byRound[n]);
            return `<div class="t-round${n === now && anyLeft ? " is-now" : ""}">
              <div class="t-round-head">Round ${n}${n === now && anyLeft ? " · now" : ""}</div>
              ${byRound[n].map(fixtureLine).join("")}
              ${resting ? `<div class="t-bye">${esc(teamName(resting))} rests this round</div>` : ""}
            </div>`;
          }).join("")}
        </div>
      </div>`;
    }).join("");
  }

  // With an odd number of teams in a bracket, exactly one is left out of each
  // of its rounds.
  function restingTeam(court, list) {   // group rounds only; a knockout has no byes
    if (teamsOn(court).length % 2 === 0) return null;
    const playing = new Set(list.flatMap(f => [f.a, f.b]));
    return teamsOn(court).find(t => !playing.has(t.id)) || null;
  }

  function fixtureLine(f) {
    const r = roundFor(f);
    const done = r && r.status === "completed";
    const cls = done ? "done" : r ? "live" : "";
    const score = done
      ? `<b>${r.scoreA}–${r.scoreB}</b>`
      : r ? `<em>on court ${r.court}</em>` : `<em>to play</em>`;
    const winner = done ? (r.winner === "A" ? f.a : f.b) : 0;
    const side = id => `<span class="${winner === id ? "t-win" : ""}">${esc(teamName(teamOf(id)))}</span>`;
    const leg = Number(f.leg) > 1 ? `<span class="t-leg">#${f.leg}</span>` : "";
    return `<div class="t-fixture ${cls}">${side(f.a)}<span class="t-vs">vs${leg}</span>${side(f.b)}<span class="t-score">${score}</span></div>`;
  }

  /* ---------- the Tournament modal ---------- */
  let draft = { a: "", b: "" };
  let editing = 1;                         // the court whose bracket is being built

  function renderCourtTabs() {
    const box = document.getElementById("tCourtTabs");
    if (!box) return;
    const list = courts();
    if (!list.includes(editing)) editing = list[0];
    box.classList.toggle("hidden", list.length < 2);
    box.innerHTML = list.map(c => {
      const n = teamsOn(c).length;
      const d = divisionOf(divisionFor(c));
      const picked = c === editing;
      const k = cyclesFor(c);
      return `<button type="button" data-court-tab="${c}" class="${picked ? "selected" : ""}"
        aria-pressed="${picked}"${!on() ? " disabled" : ""}>Court ${c}
        <em>${n} team${n === 1 ? "" : "s"}${d.key === "all" ? "" : ` · ${esc(d.label)}`}${
          k > 1 ? ` · ${CYCLE_WORDS[k]}` : ""}</em></button>`;
    }).join("");
  }

  function renderDivisions() {
    const box = document.getElementById("tDivisions");
    if (!box) return;
    box.innerHTML = TOURNAMENT_DIVISIONS.map(d => {
      const n = activePlayers().filter(p => fitsDivision(p, d.key)).length;
      const picked = d.key === divisionFor(editing);
      return `<button type="button" data-division="${d.key}" class="${picked ? "selected" : ""}"
        aria-pressed="${picked}"${!on() || started() ? " disabled" : ""}
        title="${esc(divisionLabel(d.key))}">${esc(d.label)} <em>${n}</em></button>`;
    }).join("");
    const label = document.getElementById("tDivisionLabel");
    if (label) label.textContent = courts().length > 1 ? `🏅 Court ${editing} division` : "🏅 Division";
    const note = document.getElementById("tDivisionNote");
    if (!note) return;
    const key = divisionFor(editing);
    const free = eligibleFor(editing).length;
    note.textContent = started()
      ? `Court ${editing} is running as ${divisionLabel(key)}. Scrap the draw to change it.`
      : key === "all"
        ? `Any player can be drawn into Court ${editing}. Pick a band to run a beginners' or an intermediate-to-advanced tournament on this court`
          + (courts().length > 1 ? ` and another band on the other.` : `.`)
        : `${free} player${free === 1 ? "" : "s"} free to draw into Court ${editing}'s ${divisionLabel(key)}.`;
  }

  function renderLength() {
    const label = document.getElementById("tLengthLabel");
    if (!label) return;
    const k = cyclesFor(editing);
    const n = teamsOn(editing).length;
    const games = gamesEach(n, k);
    label.textContent = courts().length > 1
      ? `🔁 Court ${editing} · games per team` : "🔁 Games per team";
    document.getElementById("tLengthValue").textContent = games || "—";
    document.getElementById("tLengthUnit").textContent = games
      ? `game${games === 1 ? "" : "s"} each · ${CYCLE_WORDS[k]}`
      : `${CYCLE_WORDS[k]} round robin`;
    const minus = document.querySelector('[data-cycle-step="-1"]');
    const plus = document.querySelector('[data-cycle-step="1"]');
    const locked = !on() || started();
    if (minus) minus.disabled = locked || k <= 1;
    if (plus) plus.disabled = locked || k >= CYCLE_MAX;
    const note = document.getElementById("tLengthNote");
    if (!note) return;
    // Games per team only moves in whole cycles, so say what a step buys
    // rather than letting the stepper look broken between them.
    note.textContent = started()
      ? `Court ${editing} is a ${CYCLE_WORDS[cyclesFor(editing)]} round robin: `
        + `${gamesEachOn(editing)} games each. Scrap the draw to change it.`
      : n < 2
        ? `Every team plays every other team ${k} time${k === 1 ? "" : "s"}. Draw the teams to see how many games that is.`
        : (() => {
          const rounds = (n % 2 ? n : n - 1) * k;
          const matches = (n * (n - 1) / 2) * k;
          return `Every team plays every other team ${k} time${k === 1 ? "" : "s"} — `
            + `${rounds} round${rounds === 1 ? "" : "s"}, ${matches} match${matches === 1 ? "" : "es"}. `
            + `A step is ${n - 1} game${n - 1 === 1 ? "" : "s"} each, because a part-finished `
            + `cycle would leave some teams having met twice and others once.`;
        })();
  }

  function renderPlayoffs() {
    const box = document.getElementById("tPlayoffs");
    if (!box) return;
    const n = teamsOn(editing).length;
    const picked = playoffsFor(editing);
    const drawn = koOn(editing).length > 0;
    box.innerHTML = PLAYOFF_SIZES.map(size => {
      const is = size === picked;
      return `<button type="button" data-playoff="${size}" class="${is ? "selected" : ""}"
        aria-pressed="${is}"${!on() || drawn || size > n ? " disabled" : ""}
        title="${esc(size ? `${size} teams through to the ${koName(size).toLowerCase()}${size > 2 ? "s" : ""}`
          : "The group table decides it")}">${size ? `Top ${size}` : "None"}${
        size ? ` <em>${esc(koName(size))}</em>` : ""}</button>`;
    }).join("");

    // The third-place match is a yes/no beside the sizes, and only means
    // anything where there are semi-finals to lose.
    const thirdBox = document.getElementById("tThird");
    if (thirdBox) {
      const want = thirdPlaceOn(editing);
      thirdBox.classList.toggle("hidden", picked < 4);
      thirdBox.innerHTML = `<button type="button" data-third="1" class="${want ? "selected" : ""}"
        aria-pressed="${want}"${!on() || drawn || picked < 4 ? " disabled" : ""}
        title="The two beaten semi-finalists play off for third">🥉 Third-place match
        <em>${want ? "on" : "off"}</em></button>`;
    }

    const label = document.getElementById("tPlayoffLabel");
    if (label) label.textContent = courts().length > 1 ? `🥇 Court ${editing} playoffs` : "🥇 Playoffs";
    const note = document.getElementById("tPlayoffNote");
    if (!note) return;
    const tooBig = PLAYOFF_SIZES.filter(x => x && x > n);
    const short = n >= 2 && tooBig.length
      ? ` Top ${tooBig.join(" and top ")} need${tooBig.length === 1 ? "s" : ""} more teams than the ${n} on this court.`
      : "";
    note.textContent = drawn
      ? `Court ${editing}'s top ${picked} playoff is under way. Scrap the draw to change it.`
      : n < 2
        ? "Draw at least two teams to finish with a knockout."
        : picked
          ? `The top ${picked} of Court ${editing}'s table play off: seeds ${pairText(picked)}${tailText(picked)}`
            + (thirdPlaceOn(editing) ? `, plus a third-place match between the beaten semi-finalists` : "")
            + ` — ${koTotal(editing)} extra match${koTotal(editing) === 1 ? "" : "es"} after the round robin.`
            + ` The champion is whoever wins the final, not whoever tops the table.`
          : `No playoffs: whoever tops Court ${editing}'s table wins it. Pick a size to finish`
            + ` with a knockout instead.` + short;
  }

  function renderModal() {
    const sw = document.getElementById("tModeToggle");
    if (!sw) return;
    sw.classList.toggle("on", on());
    sw.setAttribute("aria-checked", String(on()));
    document.getElementById("tModeState").textContent = on() ? "On" : "Off";
    document.getElementById("tModeHint").textContent = on()
      ? "Fixed teams play a full round robin. Rotation, game limit, court levels and fixed partners are paused."
      : "Open play: fair rotation picks who plays next, and partners change every match.";

    renderCourtTabs();
    renderDivisions();
    renderLength();
    renderPlayoffs();
    const body = document.getElementById("tBody");
    body.classList.toggle("is-off", !on());
    document.getElementById("tDrawBox").classList.toggle("hidden", started());
    document.getElementById("tLiveBox").classList.toggle("hidden", !started());

    if (started()) {
      const left = matchesLeft();
      document.getElementById("tLiveNote").textContent = liveCourts().map(c => {
        const d = divisionOf(divisionFor(c));
        const size = playoffsFor(c);
        return `Court ${c} (${d.key === "all" ? "all levels" : d.label}): `
          + `${teamsOn(c).length} teams, ${roundsOn(c)} rounds, ${groupOn(c).length} matches, `
          + `${gamesEachOn(c)} games each`
          + (size ? `, then a top ${size} knockout` : "")
          + (thirdPlaceOn(c) ? " with a third-place match" : "");
      }).join(" · ") + (left ? ` — ${left} still to play.` : " — all played.");
      document.getElementById("tEndBtn").textContent = left ? "Scrap the draw" : "Scrap the draw & re-draw";
      return;
    }

    const selA = document.getElementById("tPlayerA");
    const selB = document.getElementById("tPlayerB");
    const free = eligibleFor(editing).sort((x, y) => String(x.name).localeCompare(String(y.name)));
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
    document.getElementById("tAutoBtn").disabled = !on() || free.length < 4;
    document.getElementById("tStartBtn").disabled = !on() || !liveCourts().length
      || courts().some(c => teamsOn(c).length === 1);
    document.getElementById("tClearBtn").disabled = !on() || !teamsOn(editing).length;
    document.getElementById("tAutoBtn").textContent = courts().length > 1
      ? `Draw Court ${editing} automatically` : "Draw teams automatically";
    document.getElementById("tClearBtn").textContent = courts().length > 1
      ? `Clear Court ${editing}` : "Clear teams";

    const mine = teamsOn(editing);
    const list = document.getElementById("tTeamList");
    list.innerHTML = mine.length
      ? mine.map((t, i) => `
        <div class="pair-item">
          <div class="pair-names">
            <b>#${i + 1} ${esc(teamName(t))}</b>
            <em class="pair-status ok">Combined ${teamRating(t).toFixed(2)}</em>
          </div>
          <button type="button" class="pair-unlink" data-drop-team="${t.id}" aria-label="Remove team">Remove</button>
        </div>`).join("")
      : `<div class="pair-empty">No teams on Court ${editing} yet. Draw them automatically, or pick two players and add them.</div>`;

    const n = mine.length;
    const k = cyclesFor(editing);
    const rounds = n < 2 ? 0 : (n % 2 ? n : n - 1) * k;
    const matches = n < 2 ? 0 : ((n * (n - 1)) / 2) * k;
    const spare = `${free.length} player${free.length === 1 ? "" : "s"} free to draw.`;
    const others = courts().filter(c => c !== editing && teamsOn(c).length >= 2)
      .map(c => `Court ${c} has ${teamsOn(c).length} teams.`).join(" ");
    document.getElementById("tDrawNote").textContent = (n === 1
      ? `Court ${editing} has one team. A round robin needs at least two, or remove it. `
      : n < 2
        ? `A round robin needs at least 2 teams on this court. Every team plays every other team once. `
        : `Court ${editing}: ${n} teams → ${rounds} round${rounds === 1 ? "" : "s"}, `
          + `${matches} match${matches === 1 ? "" : "es"}, ${gamesEachOn(editing)} games each.`
          + (n % 2 ? " With an odd number of teams, one team rests each round." : "") + " ")
      + spare + (others ? " " + others : "");
  }

  function paint() { renderModal(); renderPanel(); }

  /* ---------- wiring ---------- */
  function wire() {
    const sw = document.getElementById("tModeToggle");
    if (!sw) return;
    sw.addEventListener("click", () => setMode(!on()));
    document.getElementById("tAddBtn").addEventListener("click", () => addTeam(editing, draft.a, draft.b));
    document.getElementById("tAutoBtn").addEventListener("click", () => autoDraw(editing));
    document.getElementById("tClearBtn").addEventListener("click", () => clearTeams(editing));
    document.getElementById("tStartBtn").addEventListener("click", start);
    document.getElementById("tEndBtn").addEventListener("click", resetDraw);
    ["tPlayerA", "tPlayerB"].forEach(id => {
      document.getElementById(id).addEventListener("change", e => {
        draft[id === "tPlayerA" ? "a" : "b"] = e.target.value;
        renderModal();
      });
    });
    document.getElementById("tCourtTabs").addEventListener("click", e => {
      const btn = e.target.closest("[data-court-tab]");
      if (!btn || btn.disabled) return;
      editing = Number(btn.dataset.courtTab);
      draft = { a: "", b: "" };
      renderModal();
    });
    document.querySelectorAll("[data-cycle-step]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        setCycles(editing, cyclesFor(editing) + Number(btn.dataset.cycleStep));
      });
    });
    document.getElementById("tPlayoffs").addEventListener("click", e => {
      const btn = e.target.closest("[data-playoff]");
      if (btn && !btn.disabled) setPlayoffs(editing, btn.dataset.playoff);
    });
    document.getElementById("tThird").addEventListener("click", e => {
      const btn = e.target.closest("[data-third]");
      if (btn && !btn.disabled) setThirdPlace(editing, !thirdPlaceOn(editing));
    });
    document.getElementById("tDivisions").addEventListener("click", e => {
      const btn = e.target.closest("[data-division]");
      if (btn && !btn.disabled) setDivision(editing, btn.dataset.division);
    });
    document.getElementById("tTeamList").addEventListener("click", e => {
      const btn = e.target.closest("[data-drop-team]");
      if (btn) removeTeam(btn.dataset.dropTeam);
    });
  }

  wire();
  window.Tournament = {
    on, started, fill, render: paint, playerOrder, summary,
    setMode, resetDraw, setDivision, setCycles, autoDraw, addTeam, start,
    cyclesFor, gamesEachOn,
    standingsOn, liveCourts, divisionFor, headline,
    cardTags, sideLabel,
    setPlayoffs, playoffsFor, playoffSizes: () => PLAYOFF_SIZES, koName,
    setThirdPlace, thirdPlaceOn,
    afterScore, placementOn, championOn,
    remaining: matchesLeft
  };
  // app.js renders the page once at the end of its own file, before this
  // module exists. A session that was left mid-tournament would therefore
  // draw its courts as though it were open play -- "Team A" against "Team B",
  // with CHANGE buttons the draw does not allow. Render it again now.
  if (typeof window.render === "function") window.render(); else paint();
})();
