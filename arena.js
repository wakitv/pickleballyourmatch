/*
  Pickle Arena — a play-money side game
  -------------------------------------
  Back one of the two teams in the pixel match above. Win and your stake comes
  back doubled; lose and it is gone. The wallet starts at 1,000 and tops up by
  100 every hour, so running dry costs you an hour, not the game.

  It is play money only: no purchase, no cash out, no connection to the real
  session. The wallet lives in its own localStorage key, so it is never part of
  a session Export or wiped by Reset.
*/
(function () {
  const panel = document.getElementById("arenaBar");
  if (!panel || !window.PickleArena) return;

  const KEY = "picklematch_arena";
  const START_BALANCE = 1000;
  const REGEN_MINUTES = 20;
  const REGEN_MS = REGEN_MINUTES * 60 * 1000;
  const REGEN_AMOUNT = 100;
  const MAX_CATCHUP = 24;            // at most 24 top-ups (8 hours) accrue while away
  const BET_SPEED = 3;               // bet games run faster than the ambient demo
  const STAKE_STEP = 50;
  const TEAM = { L: "RED", R: "BLUE" };

  const el = id => document.getElementById(id);
  const ui = {
    balance: el("arenaBalance"), regen: el("arenaRegen"), teams: el("arenaTeams"),
    stake: el("arenaStake"), stakeBox: el("arenaStakeBox"), start: el("arenaStart"),
    status: el("arenaStatus"), setup: el("arenaSetup")
  };

  const peso = n => "₱" + Number(n).toLocaleString("en-US");

  /* ---------- wallet ---------- */
  let wallet = load();
  let stake = 100;
  let picked = null;
  let live = null;   // { side, stake } while a game is being played for money

  function load() {
    let w = null;
    try { w = JSON.parse(localStorage.getItem(KEY)); } catch { w = null; }
    if (!w || typeof w !== "object") w = {};
    const out = {
      balance: Number.isFinite(Number(w.balance)) ? Math.max(0, Math.round(Number(w.balance))) : START_BALANCE,
      lastRegen: Number(w.lastRegen) || Date.now(),
      held: Number(w.held) || 0,   // a stake that was riding when the page closed
      started: w.started === true, // the top-up clock waits for the first Generate Matches
      won: Number(w.won) || 0, lost: Number(w.lost) || 0
    };
    // A timestamp in the future means the clock moved; restart the wait from now.
    if (out.lastRegen > Date.now()) {
      out.lastRegen = Date.now();
      try { localStorage.setItem(KEY, JSON.stringify(out)); } catch { /* ignore */ }
    }
    return out;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(wallet)); } catch { /* storage full or blocked */ }
  }

  // Grant one top-up per whole hour since the last one, including time away.
  function applyRegen() {
    if (!wallet.started) return 0;
    const due = Math.floor((Date.now() - wallet.lastRegen) / REGEN_MS);
    if (due < 1) return 0;
    const grant = Math.min(due, MAX_CATCHUP);
    wallet.balance += grant * REGEN_AMOUNT;
    wallet.lastRegen += due * REGEN_MS; // consume the whole wait, capped payout
    save();
    return grant * REGEN_AMOUNT;
  }
  function msToRegen() {
    return Math.max(0, REGEN_MS - (Date.now() - wallet.lastRegen));
  }
  function clock(ms) {
    const total = Math.ceil(ms / 1000);
    return String((total / 60) | 0).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
  }

  /* ---------- status line ---------- */
  let flash = null; // { text, cls, until }
  function say(text, cls, holdMs) {
    flash = { text, cls: cls || "", until: Date.now() + (holdMs || 6000) };
    render();
  }

  /* ---------- betting ---------- */
  function maxStake() { return wallet.balance; }
  function setStake(n) {
    const cap = maxStake();
    stake = Math.max(0, Math.min(cap, Math.round(Number(n) || 0)));
    render();
  }
  function canBet() { return !live && picked && stake > 0 && stake <= wallet.balance; }

  function placeBet() {
    if (!canBet()) return;
    wallet.balance -= stake;
    wallet.held = stake;
    live = { side: picked, stake };
    save();
    window.PickleArena.setPick(picked);
    window.PickleArena.setKeepAlive(true); // the game must finish even if they scroll away
    window.PickleArena.newGame(BET_SPEED);
    say(`₱${stake.toLocaleString("en-US")} on ${TEAM[picked]} — first to 11 takes it.`, "live");
  }

  function settle(winnerSide, finalScore) {
    if (!live) return;
    const bet = live;
    live = null;
    wallet.held = 0;
    window.PickleArena.setPick(null);
    window.PickleArena.setKeepAlive(false);
    window.PickleArena.setSpeed(1); // back to the ambient demo pace
    const line = `${TEAM[winnerSide]} wins ${finalScore.L}-${finalScore.R}`;
    if (winnerSide === bet.side) {
      const payout = bet.stake * 2;
      wallet.balance += payout;
      wallet.won++;
      say(`${line}. You win ${peso(payout)} — ${peso(bet.stake)} profit.`, "win", 12000);
    } else {
      wallet.lost++;
      say(`${line}. You lose ${peso(bet.stake)}.`, "lose", 12000);
    }
    setStake(Math.min(stake, wallet.balance));
    save();
  }

  /* ---------- render ---------- */
  function render() {
    ui.balance.textContent = Number(wallet.balance).toLocaleString("en-US");

    const broke = wallet.balance <= 0;
    ui.regen.textContent = !wallet.started
      ? (broke ? `Out of pesos — press Generate Matches to start the ${peso(REGEN_AMOUNT)} timer`
               : `${peso(REGEN_AMOUNT)} every ${REGEN_MINUTES} min — starts at your first Generate Matches`)
      : broke ? `Out of pesos — ${peso(REGEN_AMOUNT)} in ${clock(msToRegen())}`
      : `+${peso(REGEN_AMOUNT)} in ${clock(msToRegen())}`;
    ui.regen.classList.toggle("urgent", broke);

    ui.setup.classList.toggle("hidden", !!live);
    ui.teams.querySelectorAll("[data-team]").forEach(b => {
      const on = b.dataset.team === picked;
      b.classList.toggle("selected", on);
      b.setAttribute("aria-pressed", String(on));
      b.disabled = !!live;
    });
    ui.stake.textContent = Number(stake).toLocaleString("en-US");
    ui.stakeBox.querySelectorAll("button").forEach(b => {
      if (b.dataset.stake) {
        const v = b.dataset.stake === "all" ? maxStake() : Number(b.dataset.stake);
        b.classList.toggle("selected", stake > 0 && stake === v);
        b.disabled = !!live || v <= 0 || v > maxStake();
      } else {
        const d = Number(b.dataset.stakeStep);
        b.disabled = !!live || (d < 0 ? stake <= 0 : stake >= maxStake());
      }
    });

    ui.start.disabled = !canBet();
    ui.start.textContent = live ? "Game in play…"
      : broke ? "No pesos left"
      : !picked ? "Pick a team"
      : stake <= 0 ? "Set a stake"
      : `Start game · ${peso(stake)}`;

    if (live) {
      const s = window.PickleArena.score();
      ui.status.className = "arena-status live";
      ui.status.textContent = `${peso(live.stake)} on ${TEAM[live.side]} · ${s.L} - ${s.R}`;
    } else if (flash && Date.now() < flash.until) {
      ui.status.className = "arena-status " + flash.cls;
      ui.status.textContent = flash.text;
    } else {
      ui.status.className = "arena-status";
      ui.status.textContent = wallet.won + wallet.lost
        ? `${wallet.won}W / ${wallet.lost}L so far · a winning bet pays double.`
        : "Back a team, set a stake, and a winning bet pays double.";
    }
  }

  // The app's Reset wipes the session; it starts the Arena over too, back to
  // the opening 1,000 with a clean record and a fresh hour on the clock.
  function resetWallet() {
    if (live) { // a stake riding on a game that is about to be thrown away
      live = null;
      window.PickleArena.setPick(null);
      window.PickleArena.setKeepAlive(false);
      window.PickleArena.setSpeed(1);
    }
    wallet = { balance: START_BALANCE, lastRegen: Date.now(), held: 0, started: false, won: 0, lost: 0 };
    picked = null;
    save();
    setStake(100);
    say(`Arena reset — back to ${peso(START_BALANCE)}.`, "win", 8000);
  }
  document.addEventListener("picklematch:reset", resetWallet);

  // First Generate Matches of the session sets the free-pesos clock running.
  document.addEventListener("picklematch:generate", () => {
    if (wallet.started) return;
    wallet.started = true;
    wallet.lastRegen = Date.now();
    save();
    say(`Top-up clock started — ${peso(REGEN_AMOUNT)} every ${REGEN_MINUTES} minutes.`, "win", 8000);
  });

  /* ---------- wiring ---------- */
  ui.teams.addEventListener("click", e => {
    const b = e.target.closest("[data-team]");
    if (!b || live) return;
    picked = picked === b.dataset.team ? null : b.dataset.team;
    render();
  });
  ui.stakeBox.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b || b.disabled || live) return;
    if (b.dataset.stake) setStake(b.dataset.stake === "all" ? maxStake() : b.dataset.stake);
    else setStake(stake + Number(b.dataset.stakeStep));
  });
  ui.start.addEventListener("click", placeBet);

  window.PickleArena.onEnd((side, finalScore) => { if (live) settle(side, finalScore); });
  window.PickleArena.onScore(() => { if (live) render(); });

  // A stake that was riding when the tab closed is handed back: the game it was
  // placed on no longer exists.
  if (wallet.held > 0) {
    wallet.balance += wallet.held;
    const refunded = wallet.held;
    wallet.held = 0;
    save();
    flash = { text: `Last game was interrupted — ${peso(refunded)} refunded.`, cls: "", until: Date.now() + 9000 };
  }

  const granted = applyRegen();
  if (granted) flash = { text: `Welcome back — ${peso(granted)} added while you were away.`, cls: "win", until: Date.now() + 9000 };

  setStake(Math.min(100, wallet.balance));
  setInterval(() => {
    const got = applyRegen();
    if (got) say(`Hourly top-up: ${peso(got)} added.`, "win", 8000);
    else render();
  }, 1000);
  render();
})();
