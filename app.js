const STORAGE_KEY = "picklematch_v2";
const GAME_LIMIT_MAX = 30; // must be defined before loadState() runs below

// Court skill levels (v4.8): each court can be restricted to a rating band,
// e.g. Court 1 = beginners only, Court 2 = 3.0 and up. The band edges are
// open-ended: a min at COURT_RATING_MIN means "no floor" and a max at
// COURT_RATING_MAX means "no ceiling", so a player whose PDDR rating drifts
// past the slider range is never locked out of an "Any level" court.
const COURT_RATING_MIN = 2.0, COURT_RATING_MAX = 5.0, COURT_RATING_STEP = 0.1;
const COURT_LEVEL_PRESETS = [
  { key: "any", label: "Any level",    min: 2.0, max: 5.0 },
  { key: "beg", label: "Beginner",     min: 2.0, max: 2.9 },
  { key: "int", label: "Intermediate", min: 3.0, max: 3.9 },
  { key: "adv", label: "Advanced",     min: 4.0, max: 5.0 },
  { key: "3up", label: "3.0 & up",     min: 3.0, max: 5.0 }
];
function defaultCourtRules() {
  return { enabled: false, 1: { min: COURT_RATING_MIN, max: COURT_RATING_MAX }, 2: { min: COURT_RATING_MIN, max: COURT_RATING_MAX } };
}

let state = loadState();
state.players.forEach(p => { if (p.active === undefined) p.active = true; });
// v1.2/v1.3: pending rounds are created only by Generate Matches.
// Keep existing pending rounds intact when the app loads; players in all pending
// rounds remain locked until their results are saved.
let activeResultRoundId = null;

// Games per player: 0 = no limit. Otherwise a player who has finished this many
// games is "Done" and is left out of new matches (and CHANGE replacements).
function hasGamesLeft(p) {
  const limit = Number(state && state.gameLimit) || 0;
  return !limit || (Number(p.games) || 0) < limit;
}
function isDone(p) { return !hasGamesLeft(p); }

/*
  Court skill levels
  ------------------
  When enabled, each court only accepts players inside its rating band, so a
  session can run "Court 1 = beginners, Court 2 = 3.0 and up" at the same time.
  Everything else (fair rotation, pairing, ratings) works exactly as before —
  the band only shrinks the pool a court may draw from.
*/
function clampCourtRating(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const stepped = Math.round(n / COURT_RATING_STEP) * COURT_RATING_STEP;
  return Math.round(Math.max(COURT_RATING_MIN, Math.min(COURT_RATING_MAX, stepped)) * 10) / 10;
}
function courtRulesOn() { return !!(state.courtRules && state.courtRules.enabled); }
function courtRule(court) {
  const rules = state.courtRules || defaultCourtRules();
  return rules[Number(court) === 2 ? 2 : 1] || { min: COURT_RATING_MIN, max: COURT_RATING_MAX };
}
function isOpenCourt(court) {
  const { min, max } = courtRule(court);
  return min <= COURT_RATING_MIN && max >= COURT_RATING_MAX;
}
// Open-ended edges: the lowest min has no floor, the highest max has no ceiling.
function fitsCourt(p, court) {
  if (!courtRulesOn()) return true;
  const { min, max } = courtRule(court);
  const r = Number(p.rating) || 3;
  return (min <= COURT_RATING_MIN || r >= min - 1e-9) && (max >= COURT_RATING_MAX || r <= max + 1e-9);
}
// Pure band helpers, so the Import preview can describe a file's courts
// without touching the live session.
function bandPresetKey(band) {
  const hit = COURT_LEVEL_PRESETS.find(p => p.min === band.min && p.max === band.max);
  return hit ? hit.key : null;
}
function bandRangeText(band) {
  const { min, max } = band;
  if (min <= COURT_RATING_MIN && max >= COURT_RATING_MAX) return "Any level";
  if (min <= COURT_RATING_MIN) return `Up to ${max.toFixed(1)}`;
  if (max >= COURT_RATING_MAX) return `${min.toFixed(1)} & up`;
  return `${min.toFixed(1)} – ${max.toFixed(1)}`;
}
function bandLabel(band) {
  const preset = COURT_LEVEL_PRESETS.find(p => p.key === bandPresetKey(band));
  const range = bandRangeText(band);
  return preset && preset.key !== "any" && preset.label !== range ? `${preset.label} · ${range}` : range;
}
function courtPresetKey(court) { return bandPresetKey(courtRule(court)); }
function courtRangeText(court) { return bandRangeText(courtRule(court)); }
function courtRuleLabel(court) { return bandLabel(courtRule(court)); }
function courtsInUse() { return state.courtCount === 1 ? [1] : [1, 2]; }
function eligibleCourtsFor(p) { return courtsInUse().filter(c => fitsCourt(p, c)); }

/*
  Fixed partners
  --------------
  A fixed pair is two players who always play on the same team for the rest of
  the session. They are picked as one unit: both play or neither does, and the
  "avoid recent partners" penalty is waived for them. Everything else — fair
  rotation, court levels, the games-per-player cap — still applies, so a pair
  whose partner is Done, or who matches no court's level, simply waits.
*/
function fixedPairs() { return Array.isArray(state.fixedPairs) ? state.fixedPairs : []; }
function fixedPartnerId(id) {
  const n = Number(id);
  const pair = fixedPairs().find(p => p[0] === n || p[1] === n);
  if (!pair) return null;
  return pair[0] === n ? pair[1] : pair[0];
}
function fixedPartnerOf(id) {
  const mate = fixedPartnerId(id);
  return mate == null ? null : player(mate);
}
function areFixedPartners(a, b) { return fixedPartnerId(a) === Number(b); }
function isFixedPaired(id) { return fixedPartnerId(id) != null; }
// Pairs with both players still in the rotation — the only ones that can play.
function livePairs() {
  return fixedPairs().filter(([a, b]) => {
    const pa = player(a), pb = player(b);
    return pa && pb && pa.active !== false && pb.active !== false;
  });
}
// Courts a pair could be sent to: both partners must match the court's level.
function pairCourts([a, b]) {
  const pa = player(a), pb = player(b);
  if (!pa || !pb) return [];
  return courtsInUse().filter(c => fitsCourt(pa, c) && fitsCourt(pb, c));
}
function pairLabel([a, b]) {
  const pa = player(a), pb = player(b);
  return `${pa ? pa.name : `#${a}`} + ${pb ? pb.name : `#${b}`}`;
}

function defaultState() {
  return { players: [], rounds: [], nextPlayerId: 1, nextRoundId: 1, queueSeq: 1, courtCount: 2, gameLimit: 0, courtRules: defaultCourtRules(), fixedPairs: [] };
}
function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!raw || typeof raw !== "object") return defaultState();
    return normalizeState(raw);
  } catch {
    return defaultState();
  }
}
// Shared by loadState and Import: fills defaults and fixes types so data from
// any PickleMatch version (or a hand-edited file) is safe to use.
function normalizeState(raw) {
    const s = raw;
    s.players = Array.isArray(s.players) ? s.players : [];
    s.rounds = Array.isArray(s.rounds) ? s.rounds : [];
    s.nextPlayerId = Number(s.nextPlayerId) || 1;
    s.nextRoundId = Number(s.nextRoundId) || 1;
    s.queueSeq = Number(s.queueSeq) || 1;
    s.courtCount = Number(s.courtCount) === 1 ? 1 : 2;
    s.gameLimit = Math.max(0, Math.min(GAME_LIMIT_MAX, Math.round(Number(s.gameLimit) || 0)));

    // Court skill levels: missing (v4.7 and earlier) or malformed rules fall
    // back to "Any level", so older sessions import with the feature simply off.
    const rawRules = s.courtRules && typeof s.courtRules === "object" ? s.courtRules : {};
    const rules = defaultCourtRules();
    rules.enabled = rawRules.enabled === true;
    [1, 2].forEach(c => {
      const band = rawRules[c] && typeof rawRules[c] === "object" ? rawRules[c] : {};
      let min = clampCourtRating(band.min, COURT_RATING_MIN);
      let max = clampCourtRating(band.max, COURT_RATING_MAX);
      if (min > max) [min, max] = [max, min];
      rules[c] = { min, max };
    });
    s.courtRules = rules;

    // Fixed partners: pairs of player ids who always play on the same team.
    // Drop anything malformed, self-paired, pointing at a missing player, or
    // naming a player who already appears in an earlier pair.
    const ids = new Set(s.players.map(p => Number(p.id)));
    const taken = new Set();
    s.fixedPairs = (Array.isArray(s.fixedPairs) ? s.fixedPairs : []).reduce((keep, pair) => {
      if (!Array.isArray(pair) || pair.length !== 2) return keep;
      const a = Number(pair[0]), b = Number(pair[1]);
      if (!ids.has(a) || !ids.has(b) || a === b || taken.has(a) || taken.has(b)) return keep;
      taken.add(a); taken.add(b);
      keep.push([a, b]);
      return keep;
    }, []);

    // Migration/normalization: older PickleMatch versions could store IDs as
    // strings. CHANGE/REMOVE must work regardless of which version created the data.
    s.players.forEach(p => {
      p.id = Number(p.id);
      p.active = p.active !== false;
      p.rating = Number(p.rating) || 3;
      p.startingRating = Number(p.startingRating) || p.rating;
      p.ratingType = "PDDR Doubles";
      p.ratingVersion = 1;
      p.ratingHistory = Array.isArray(p.ratingHistory) ? p.ratingHistory : [];
      p.wins = Number(p.wins) || 0;
      p.losses = Number(p.losses) || 0;
      p.games = Number(p.games) || 0;
      p.lastPlayedRound = Number(p.lastPlayedRound) || 0;
      p.queueSeq = Number(p.queueSeq) || 0;
      p.queueOffset = Number(p.queueOffset) || 0;
      p.partners = p.partners && typeof p.partners === "object" ? p.partners : {};
      p.opponents = p.opponents && typeof p.opponents === "object" ? p.opponents : {};
    });

    s.rounds.forEach(r => {
      r.id = Number(r.id);
      r.court = Number(r.court) || 1;
      r.teamA = Array.isArray(r.teamA) ? r.teamA.map(Number) : [];
      r.teamB = Array.isArray(r.teamB) ? r.teamB.map(Number) : [];
      r.playerChanges = Array.isArray(r.playerChanges) ? r.playerChanges : [];
    });

    // Ensure future IDs cannot collide with migrated records.
    s.nextPlayerId = Math.max(s.nextPlayerId, ...s.players.map(p => p.id + 1), 1);
    s.nextRoundId = Math.max(s.nextRoundId, ...s.rounds.map(r => r.id + 1), 1);
    s.queueSeq = Math.max(s.queueSeq, ...s.players.map(p => Number(p.queueSeq) + 1), 1);
    return s;
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { toast("Could not save: browser storage is full or blocked."); }
  render();
}
function esc(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function ratingLabel(r) {
  const n = Number(r);
  return n.toFixed(2);
}
function initials(name) {
  return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
}
function player(id) {
  const n = Number(id);
  return state.players.find(p => Number(p.id) === n);
}
// Games counted for queue fairness. Late arrivals start at the current minimum
// so they join the back of the line instead of monopolising the courts.
function effG(p) { return (Number(p.games) || 0) + (Number(p.queueOffset) || 0); }
function activePlayers() { return state.players.filter(p => p.active !== false); }
function isPendingPlayer(id) {
  const n = Number(id);
  return pendingRounds().some(r => r.teamA.map(Number).includes(n) || r.teamB.map(Number).includes(n));
}

// Shared by the Add Player panel and the floating Add player button.
function addPlayer(name, rating) {
  name = String(name || "").trim();
  rating = Number(rating);
  if (!name) return false;
  if (state.players.some(p => p.active !== false && p.name.toLowerCase() === name.toLowerCase())) {
    toast("Player name already exists.");
    return false;
  }
  const others = activePlayers();
  const hasHistory = state.rounds.some(r => r.status === "completed");
  const offset = hasHistory && others.length ? Math.min(...others.map(effG)) : 0;
  state.players.push({
    id: state.nextPlayerId++,
    name,
    active: true,
    rating,
    startingRating: rating,
    wins: 0,
    losses: 0,
    games: 0,
    lastPlayedRound: offset ? state.nextRoundId - 1 : 0,
    queueOffset: offset,
    queueSeq: state.queueSeq++,
    partners: {},
    opponents: {}
  });
  saveState();
  toast(`${name} added to the rotation.`);
  return true;
}

document.getElementById("autoMatchBtn").onclick = () => {
  // The Arena's free-pesos clock only starts once play has actually begun.
  document.dispatchEvent(new CustomEvent("picklematch:generate"));
  fillPendingRounds();
};
document.getElementById("courtCount").value = String(state.courtCount);
document.getElementById("courtCount").addEventListener("change", e => {
  const nextCount = Number(e.target.value) === 1 ? 1 : 2;
  const pending = pendingRounds();
  if (nextCount === 1 && pending.some(r => Number(r.court) === 2)) {
    e.target.value = String(state.courtCount);
    return toast("Finish the Court 2 match first before switching to 1 Court.");
  }
  state.courtCount = nextCount;
  saveState();
  toast(`Court setting updated: ${nextCount} Court${nextCount > 1 ? "s" : ""}.`);
});

document.querySelectorAll("[data-court-option]").forEach(btn => {
  btn.addEventListener("click", () => {
    const select = document.getElementById("courtCount");
    if (select) {
      select.value = btn.dataset.courtOption;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
});

function setGameLimit(n) {
  const next = Math.max(0, Math.min(GAME_LIMIT_MAX, Math.round(Number(n) || 0)));
  if (next === state.gameLimit) return render();
  state.gameLimit = next;
  saveState();
  toast(next ? `Games per player set to ${next}.` : "Games per player: no limit.");
}
document.querySelector(".limit-setting").addEventListener("click", e => {
  const step = e.target.closest("[data-limit-step]");
  if (step) {
    const cur = state.gameLimit || 0;
    const d = Number(step.dataset.limitStep);
    // From "No limit", + starts at 1; − from 1 goes back to "No limit".
    return setGameLimit(cur === 0 ? (d > 0 ? 1 : 0) : cur + d);
  }
  const preset = e.target.closest("[data-limit]");
  if (preset) setGameLimit(preset.dataset.limit);
});

/* ---------- Court skill levels (Match settings) ---------- */
function setCourtRulesEnabled(on) {
  state.courtRules.enabled = !!on;
  saveState();
  toast(on
    ? "Court skill levels are on. Generate Matches now respects each court's level."
    : "Court skill levels are off. Any player can be placed on any court.");
}
function setCourtBand(court, min, max, quiet = false) {
  const c = Number(court) === 2 ? 2 : 1;
  let lo = clampCourtRating(min, COURT_RATING_MIN);
  let hi = clampCourtRating(max, COURT_RATING_MAX);
  if (lo > hi) [lo, hi] = [hi, lo];
  state.courtRules[c] = { min: lo, max: hi };
  // Picking a level is a clear signal that the feature is wanted.
  const justEnabled = !state.courtRules.enabled;
  if (justEnabled) state.courtRules.enabled = true;
  saveState();
  if (quiet) return;
  const inPlay = pendingRounds().some(r => (Number(r.court) || 1) === c);
  toast(`Court ${c}: ${courtRuleLabel(c)}.`
    + (justEnabled ? " Court skill levels turned on." : "")
    + (inPlay ? ` The match already in play on Court ${c} is not affected.` : ""));
}
function stepCourtBand(court, edge, dir) {
  const c = Number(court) === 2 ? 2 : 1;
  const band = courtRule(c);
  let { min, max } = band;
  if (edge === "min") {
    min = clampCourtRating(min + dir * COURT_RATING_STEP, min);
    if (min > max) max = min;
  } else {
    max = clampCourtRating(max + dir * COURT_RATING_STEP, max);
    if (max < min) min = max;
  }
  if (min === band.min && max === band.max) return;
  setCourtBand(c, min, max);
}
document.getElementById("courtLevelToggle").addEventListener("click", () => setCourtRulesEnabled(!courtRulesOn()));
document.querySelector(".court-level-setting").addEventListener("click", e => {
  const preset = e.target.closest("[data-court-preset]");
  if (preset) {
    const def = COURT_LEVEL_PRESETS.find(p => p.key === preset.dataset.courtPreset);
    if (def) setCourtBand(preset.dataset.court, def.min, def.max);
    return;
  }
  const step = e.target.closest("[data-band-step]");
  if (step && !step.disabled) stepCourtBand(step.dataset.court, step.dataset.band, Number(step.dataset.bandStep));
});

function renderCourtLevels() {
  const on = courtRulesOn();
  const toggle = document.getElementById("courtLevelToggle");
  if (toggle) {
    toggle.classList.toggle("on", on);
    toggle.setAttribute("aria-checked", String(on));
  }
  const stateText = document.getElementById("courtLevelState");
  if (stateText) stateText.textContent = on ? "On" : "Off";
  const hint = document.getElementById("courtLevelHint");
  if (hint) hint.textContent = on
    ? "Generate Matches only puts matching players on each court."
    : "Any player can be placed on any court.";

  const wrap = document.getElementById("courtLevelCards");
  if (!wrap) return;
  wrap.classList.toggle("is-off", !on);

  const active = activePlayers();
  wrap.innerHTML = courtsInUse().map(c => {
    const band = courtRule(c);
    const matching = active.filter(p => {
      const r = Number(p.rating) || 3;
      return (band.min <= COURT_RATING_MIN || r >= band.min - 1e-9) && (band.max >= COURT_RATING_MAX || r <= band.max + 1e-9);
    }).length;
    const short = on && matching < 4;
    const key = courtPresetKey(c);
    const presets = COURT_LEVEL_PRESETS.map(p => {
      const sel = p.key === key;
      return `<button type="button" data-court="${c}" data-court-preset="${p.key}" class="${sel ? "selected" : ""}" aria-pressed="${sel}">${p.label}</button>`;
    }).join("");
    const edge = (label, which, value, atMin, atMax) => `
      <div class="band-row">
        <em>${label}</em>
        <button type="button" data-court="${c}" data-band="${which}" data-band-step="-1" aria-label="Lower Court ${c} ${label}" ${atMin ? "disabled" : ""}>−</button>
        <b>${value.toFixed(1)}</b>
        <button type="button" data-court="${c}" data-band="${which}" data-band-step="1" aria-label="Raise Court ${c} ${label}" ${atMax ? "disabled" : ""}>+</button>
      </div>`;
    return `
      <div class="court-level-card${short ? " short" : ""}">
        <div class="clc-head"><b>🏓 Court ${c}</b><span class="clc-range">${esc(courtRuleLabel(c))}</span></div>
        <div class="level-presets" role="group" aria-label="Court ${c} level">${presets}</div>
        <div class="band-rows">
          ${edge("Min", "min", band.min, band.min <= COURT_RATING_MIN, band.min >= COURT_RATING_MAX)}
          ${edge("Max", "max", band.max, band.max <= COURT_RATING_MIN, band.max >= COURT_RATING_MAX)}
        </div>
        <div class="clc-count${short ? " warn" : ""}">${matching} of ${active.length} player${active.length === 1 ? "" : "s"} match this level${short ? " · 4 needed for a match" : ""}</div>
      </div>`;
  }).join("");

  const note = document.getElementById("courtLevelNote");
  if (note) {
    if (!on) note.textContent = "Turn this on to reserve each court for a skill level — for example Court 1 for beginners and Court 2 for 3.0 and up. Min 2.0 means no lower limit and max 5.0 means no upper limit.";
    else if (state.courtCount === 1) note.textContent = `Only Court 1 is active (${courtRuleLabel(1)}). Switch to 2 Courts above to give Court 2 its own level.`;
    else note.textContent = `Court 1: ${courtRuleLabel(1)} · Court 2: ${courtRuleLabel(2)}. Players outside a court's level are skipped for that court, and a CHANGE substitute must match it too. Matches already in play are never changed.`;
  }
}

/* ---------- Fixed partners (Match settings) ---------- */
// Keeps the two dropdowns on what the organizer picked while render() rebuilds
// them after every state change.
let pairDraft = { a: "", b: "" };

function addFixedPair(aId, bId) {
  const a = Number(aId), b = Number(bId);
  const pa = player(a), pb = player(b);
  if (!pa || !pb) return toast("Pick two players to lock as partners.");
  if (a === b) return toast("A player cannot be their own partner.");
  if (pa.active === false || pb.active === false) return toast("Both players must be in the active rotation.");
  if (isFixedPaired(a)) return toast(`${pa.name} is already partnered with ${fixedPartnerOf(a).name}.`);
  if (isFixedPaired(b)) return toast(`${pb.name} is already partnered with ${fixedPartnerOf(b).name}.`);

  state.fixedPairs = [...fixedPairs(), [a, b]];
  pairDraft = { a: "", b: "" };
  saveState();

  const courts = pairCourts([a, b]);
  const warn = courtRulesOn() && !courts.length
    ? " ⚠️ No court matches both of their levels right now, so they will not be picked."
    : "";
  const inPlay = pendingRounds().some(r => [...r.teamA, ...r.teamB].some(id => Number(id) === a || Number(id) === b));
  toast(`${pa.name} + ${pb.name} are now fixed partners.${warn}`
    + (inPlay ? " The match already in play is not changed." : ""));
}

function removeFixedPair(aId, bId) {
  const a = Number(aId), b = Number(bId);
  const pair = fixedPairs().find(p => p[0] === a && p[1] === b);
  if (!pair) return;
  state.fixedPairs = fixedPairs().filter(p => p !== pair);
  saveState();
  toast(`${pairLabel(pair)} are no longer fixed partners. They go back to normal rotation.`);
}

document.getElementById("pairAddBtn").addEventListener("click", () => addFixedPair(pairDraft.a, pairDraft.b));
["pairPlayerA", "pairPlayerB"].forEach(id => {
  document.getElementById(id).addEventListener("change", e => {
    pairDraft[id === "pairPlayerA" ? "a" : "b"] = e.target.value;
    renderFixedPairs();
  });
});
document.getElementById("pairList").addEventListener("click", e => {
  const btn = e.target.closest("[data-unpair]");
  if (btn) removeFixedPair(btn.dataset.pairA, btn.dataset.pairB);
});

// What is stopping a pair from being picked right now, if anything.
function pairStatus(pair) {
  const [a, b] = pair;
  const pa = player(a), pb = player(b);
  if (pendingRounds().some(r => [...r.teamA, ...r.teamB].some(id => Number(id) === a))) {
    return { cls: "ok", text: "In play now" };
  }
  if (courtRulesOn() && !pairCourts(pair).length) {
    return { cls: "warn", text: "No court matches both levels" };
  }
  const doneOne = [pa, pb].filter(isDone);
  if (doneOne.length === 1) return { cls: "warn", text: `Waiting — ${doneOne[0].name} reached the game limit` };
  if (doneOne.length === 2) return { cls: "muted", text: "Both done" };
  if (courtRulesOn()) {
    const courts = pairCourts(pair);
    if (courts.length < courtsInUse().length) return { cls: "ok", text: `Court ${courts.join(" / ")} only` };
  }
  return { cls: "ok", text: "Ready" };
}

function renderFixedPairs() {
  const selA = document.getElementById("pairPlayerA");
  const selB = document.getElementById("pairPlayerB");
  const list = document.getElementById("pairList");
  const note = document.getElementById("pairNote");
  const addBtn = document.getElementById("pairAddBtn");
  if (!selA || !selB || !list) return;

  const free = activePlayers().filter(p => !isFixedPaired(p.id)).sort((x, y) => x.name.localeCompare(y.name));
  const options = (skipId) => `<option value="">Choose a player…</option>` + free
    .filter(p => String(p.id) !== String(skipId))
    .map(p => `<option value="${p.id}">${esc(p.name)} — ${ratingLabel(p.rating)}</option>`).join("");

  // A player picked in one dropdown disappears from the other.
  selA.innerHTML = options(pairDraft.b);
  selB.innerHTML = options(pairDraft.a);
  if (!free.some(p => String(p.id) === pairDraft.a)) pairDraft.a = "";
  if (!free.some(p => String(p.id) === pairDraft.b)) pairDraft.b = "";
  selA.value = pairDraft.a;
  selB.value = pairDraft.b;
  const tooFew = free.length < 2;
  selA.disabled = selB.disabled = tooFew;
  if (addBtn) addBtn.disabled = tooFew || !pairDraft.a || !pairDraft.b;

  const pairs = fixedPairs();
  list.innerHTML = pairs.length
    ? pairs.map(pair => {
        const st = pairStatus(pair);
        const [pa, pb] = [player(pair[0]), player(pair[1])];
        const gone = !pa || !pb || pa.active === false || pb.active === false;
        return `
          <div class="pair-item${st.cls === "warn" ? " warn" : ""}">
            <div class="pair-names">
              <b>🤝 ${esc(pairLabel(pair))}</b>
              <em class="pair-status ${gone ? "muted" : st.cls}">${gone ? "Removed from rotation" : esc(st.text)}</em>
            </div>
            <button type="button" class="pair-unlink" data-unpair data-pair-a="${pair[0]}" data-pair-b="${pair[1]}">UNLINK</button>
          </div>`;
      }).join("")
    : `<div class="pair-empty">No fixed partners. Everyone rotates normally.</div>`;

  if (note) {
    if (tooFew && !pairs.length) note.textContent = "Add at least 2 players to lock a partnership.";
    else if (!pairs.length) note.textContent = "Pick two players to keep them on the same team for the rest of the session. They are picked together — both play or neither does — and the usual \"avoid recent partners\" rule is turned off for them.";
    else {
      const locked = pairs.length * 2;
      const rotating = activePlayers().filter(p => !isFixedPaired(p.id)).length;
      note.textContent = `${pairs.length} fixed pair${pairs.length === 1 ? "" : "s"} (${locked} player${locked === 1 ? "" : "s"}) · ${rotating} player${rotating === 1 ? "" : "s"} rotating normally. Fair rotation still decides when each pair plays, and a match already in play is never changed.`;
    }
  }
}

document.getElementById("resetBtn").onclick = () => {
  const hasArena = !!window.PickleArena;
  if (!confirm("Reset all players, rounds and results?"
    + (hasArena ? "\n\nThis also sets Pickle Arena back to ₱1,000." : ""))) return;
  state = defaultState();
  saveState();
  // The Arena keeps its own wallet, so it resets itself when it hears this.
  document.dispatchEvent(new CustomEvent("picklematch:reset"));
  toast(`PickleMatch has been reset.${hasArena ? " Arena wallet back to ₱1,000." : ""}`);
};

document.getElementById("closeModal").onclick = closeModal;
document.getElementById("resultModal").addEventListener("click", e => {
  if (e.target.id === "resultModal") closeModal();
});
document.getElementById("closeChangeModal").onclick = closeChangeModal;
document.getElementById("confirmChangeBtn").addEventListener("click", confirmPlayerChange);
document.getElementById("autoReplaceBtn").addEventListener("click", () => {
  if (!activeChange) return;
  const { roundId, outgoingId } = activeChange;
  autoReplacePlayer(roundId, outgoingId);
  closeChangeModal();
});
document.getElementById("changeModal").addEventListener("click", e => {
  if (e.target.id === "changeModal") closeChangeModal();
});

function pendingRounds() {
  return state.rounds.filter(r => r.status === "pending");
}

function fillPendingRounds(silent = false) {
  // Manual-only: Generate Matches is the only action that creates matches.
  // The selected court count controls how many pending matches can exist.
  const active = activePlayers();
  if (active.length < 4) {
    return toast("You need at least 4 active players to create a match.");
  }

  const pendingCount = pendingRounds().length;
  const maxPending = state.courtCount === 1 ? 1 : 2;
  if (pendingCount >= maxPending) {
    return toast(maxPending === 1
      ? "The selected 1 Court is currently occupied. Finish the match before creating another."
      : "Both courts are currently occupied. Finish a match before creating another.");
  }

  const waiting = getWaitingPlayers().filter(p => !isPendingPlayer(p.id) && hasGamesLeft(p));
  if (state.gameLimit && waiting.length < 4) {
    const stillOwed = activePlayers().filter(hasGamesLeft).length;
    if (!stillOwed) {
      return toast(pendingCount
        ? `Last match${pendingCount > 1 ? "es" : ""} in progress. Everyone else has played ${state.gameLimit} games.`
        : `Session complete! Everyone has played ${state.gameLimit} games.`);
    }
    return toast(`Only ${waiting.length} available player${waiting.length === 1 ? "" : "s"} still ${waiting.length === 1 ? "has" : "have"} games left — need 4 for a match. Raise the limit in Match settings to keep playing.`);
  }
  // Fill the most restrictive court first: a beginner-only court has the
  // smallest pool, so letting an "Any level" court pick first could strand it.
  const occupied = new Set(pendingRounds().map(r => Number(r.court) || 1));
  const openCourts = courtsInUse().filter(c => !occupied.has(c))
    .sort((a, b) => availableForCourt(a).length - availableForCourt(b).length || a - b);

  const created = [];
  const blocked = [];
  openCourts.forEach(court => {
    const match = createNextRound(court);
    if (match) {
      state.rounds.push(match); // pushed now so the next court sees these players as locked
      created.push(match);
    } else {
      blocked.push(court);
    }
  });

  if (!created.length) {
    const restricted = blocked.filter(c => courtRulesOn() && !isOpenCourt(c));
    if (restricted.length) return toast(restricted.map(courtShortfallMessage).join(" "));
    const stuck = pairBlockReason();
    if (stuck) return toast(stuck);
    return toast(waiting.length < 4
      ? "You need at least 4 available players for the next court."
      : "No valid match could be created from the available players.");
  }

  saveState();
  if (!silent) {
    const courts = created.map(r => r.court).sort((a, b) => a - b).map(c => `Court ${c}`).join(" & ");
    const restricted = blocked.filter(c => courtRulesOn() && !isOpenCourt(c));
    const extra = restricted.length ? ` ${restricted.map(courtShortfallMessage).join(" ")}` : "";
    const stranded = livePairs().filter(pair => courtRulesOn() && !pairCourts(pair).length);
    const pairNote = stranded.length
      ? ` ${stranded.map(pairLabel).join(", ")} match no court's skill level and were not placed.`
      : "";
    toast(`${created.length} match${created.length > 1 ? "es" : ""} generated: ${courts}.${extra}${pairNote}`);
  }
}

// Players who could be picked for this court right now: active, not locked in
// another pending match, still owed games, and inside the court's rating band.
function availableForCourt(court) {
  const locked = new Set(pendingRounds().flatMap(r => [...r.teamA, ...r.teamB].map(Number)));
  return activePlayers().filter(p => !locked.has(Number(p.id)) && hasGamesLeft(p) && fitsCourt(p, court));
}
// Explains the case where enough players are free but fixed partnerships mean
// they cannot be formed into a foursome (a partner is Done, or in the other
// match, or the pair matches no court).
function pairBlockReason() {
  const pairs = livePairs();
  if (!pairs.length) return null;
  const waitingIds = new Set(activePlayers()
    .filter(p => !isPendingPlayer(p.id) && hasGamesLeft(p)).map(p => Number(p.id)));
  // A partner who has reached the game limit will never free up, so that pair
  // is stuck until the limit is raised or the partnership is unlinked.
  const stuck = pairs.filter(([a, b]) => isDone(player(a)) !== isDone(player(b)));
  if (stuck.length) {
    return `${stuck.map(pairLabel).join(", ")}: one partner has reached the ${state.gameLimit}-game limit, so the pair cannot play. Raise the limit or unlink them in Match settings.`;
  }
  const held = pairs.filter(([a, b]) => waitingIds.has(a) !== waitingIds.has(b));
  if (held.length) {
    return `Waiting for a fixed partner: ${held.map(pairLabel).join(", ")}. A pair only plays when both partners are free.`;
  }
  const unplaceable = pairs.filter(pair => courtRulesOn() && !pairCourts(pair).length);
  if (unplaceable.length) {
    return `${unplaceable.map(pairLabel).join(", ")} match no court's skill level, so they cannot be placed. Widen a court's level or unlink the pair in Match settings.`;
  }
  return null;
}

function courtShortfallMessage(court) {
  const n = availableForCourt(court).length;
  return `Court ${court} (${courtRuleLabel(court)}): only ${n} available player${n === 1 ? "" : "s"} at that level — 4 needed.`;
}

function createNextRound(court) {
  court = Number(court) || 1;
  const teams = pickMatch(court);
  if (!teams) return null;

  const roundId = state.nextRoundId++;
  const ids = [...teams.teamA, ...teams.teamB];
  ids.forEach(id => {
    const p = player(id);
    p.lastPlayedRound = roundId;
    p.queueSeq = state.queueSeq++;
  });

  // Store partner/opponent history as round numbers.
  teams.teamA.forEach(a => teams.teamA.forEach(b => {
    if (a !== b) player(a).partners[b] = roundId;
  }));
  teams.teamB.forEach(a => teams.teamB.forEach(b => {
    if (a !== b) player(a).partners[b] = roundId;
  }));
  teams.teamA.forEach(a => teams.teamB.forEach(b => {
    player(a).opponents[b] = roundId;
    player(b).opponents[a] = roundId;
  }));

  return {
    id: roundId,
    court,
    status: "pending",
    teamA: teams.teamA,
    teamB: teams.teamB,
    createdAt: Date.now()
  };
}

/*
  Open-play selection (who plays next)
  ------------------------------------
  Same idea as a real open-play paddle queue:
    1) Whoever has played the FEWEST games always plays next.
    2) Among players with the same number of games, the one who has waited
       the longest goes first.
    3) Nobody is skipped to make the teams "prettier". Partner variety and
       skill mixing only choose between players who are already tied on
       games played, so a player on 0 games can never be passed over by
       someone who already has 2-3 games.
*/
const byPriority = (a, b) =>
  effG(a) - effG(b) ||
  (Number(a.lastPlayedRound) || 0) - (Number(b.lastPlayedRound) || 0) ||
  (Number(a.queueSeq) || 0) - (Number(b.queueSeq) || 0);

function combinations(list, k) {
  if (k === 0) return [[]];
  if (list.length < k) return [];
  const [head, ...rest] = list;
  return [...combinations(rest, k - 1).map(c => [head, ...c]), ...combinations(rest, k)];
}

function pickMatch(court = 1) {
  // When court skill levels are on, the pool is the court's rating band only.
  // Fair rotation then applies inside that band: the band decides WHO may play
  // on this court, the queue still decides WHICH of them plays next.
  const eligible = availableForCourt(court).sort(byPriority);
  // Fixed partners need a different selection pass (players are picked two at
  // a time), so the original open-play selector below is left exactly as it
  // was for every session that does not use the feature.
  if (livePairs().length) return pickMatchWithPairs(eligible);
  if (eligible.length < 4) return null;

  const cutoffGames = effG(eligible[3]);
  // Everyone below the cutoff is guaranteed a seat (at most 3 players).
  const must = eligible.filter(p => effG(p) < cutoffGames);
  // The remaining seats go to players tied at the cutoff, longest wait first.
  const tier = eligible.filter(p => effG(p) === cutoffGames);
  const need = 4 - must.length;
  const tierPool = tier.slice(0, Math.min(tier.length, need + 3));

  const options = [];
  combinations(tierPool, need).forEach(combo => {
    const four = [...must, ...combo];
    [[[0,1],[2,3]], [[0,2],[1,3]], [[0,3],[1,2]]].forEach(([x, y]) => {
      const teamA = x.map(i => Number(four[i].id));
      const teamB = y.map(i => Number(four[i].id));
      options.push({ teamA, teamB, score: teamScore(teamA, teamB) });
    });
  });
  if (!options.length) return null;

  // Random choice among near-equal options, so the same four players do not
  // always get the same split and sessions feel like real open play.
  const best = Math.min(...options.map(o => o.score));
  const near = options.filter(o => o.score <= best + 4.5);
  return near[Math.floor(Math.random() * near.length)];
}

/*
  Selection with fixed partners
  -----------------------------
  The queue is built from "units" instead of players: a live fixed pair is one
  unit of two, everybody else is a unit of one. A paired player whose partner
  is not available (in the other match, Done, or outside this court's level)
  is left out entirely — the pair plays together or not at all.

  Fairness is still a hard rule, not a preference: of every combination of
  units that adds up to exactly 4 players, only those with the fewest games
  played survive. Pairing quality and randomness then choose among those, so
  no one is skipped to make the teams prettier.
*/
function pickMatchWithPairs(eligible) {
  const inPool = new Set(eligible.map(p => Number(p.id)));
  const units = [];
  const seen = new Set();
  eligible.forEach(p => {
    const id = Number(p.id);
    if (seen.has(id)) return;
    const mate = fixedPartnerId(id);
    if (mate == null) { seen.add(id); units.push([p]); return; }
    seen.add(id);
    if (!inPool.has(mate)) return; // partner cannot play, so neither does this player
    seen.add(mate);
    units.push([p, player(mate)].sort(byPriority));
  });
  if (units.reduce((n, u) => n + u.length, 0) < 4) return null;

  // Only consider units near the front of the queue: enough for a real choice,
  // few enough that the subset search stays small.
  const window = [];
  let covered = 0;
  for (const u of units) {
    window.push(u);
    covered += u.length;
    if (covered >= 7 && window.length >= 4) break;
  }

  const foursomes = [];
  const walk = (i, chosen, size) => {
    if (size === 4) return foursomes.push(chosen);
    if (i >= window.length || size > 4) return;
    if (size + window[i].length <= 4) walk(i + 1, [...chosen, window[i]], size + window[i].length);
    walk(i + 1, chosen, size);
  };
  walk(0, [], 0);
  if (!foursomes.length) return null;

  // Hard fairness filter: fewest games played wins, ties broken by who has
  // been waiting longest.
  const games = f => f.flat().reduce((s, p) => s + effG(p), 0);
  const waited = f => f.flat().reduce((s, p) => s + (Number(p.lastPlayedRound) || 0), 0);
  const fewest = Math.min(...foursomes.map(games));
  let fairest = foursomes.filter(f => games(f) === fewest);
  const longest = Math.min(...fairest.map(waited));
  fairest = fairest.filter(f => waited(f) === longest);

  const options = [];
  fairest.forEach(f => splitsKeepingPairs(f).forEach(([teamA, teamB]) => {
    options.push({ teamA, teamB, score: teamScore(teamA, teamB) });
  }));
  if (!options.length) return null;

  const best = Math.min(...options.map(o => o.score));
  const near = options.filter(o => o.score <= best + 4.5);
  return near[Math.floor(Math.random() * near.length)];
}

// Every 2v2 split of a foursome that keeps each fixed pair on one team.
function splitsKeepingPairs(units) {
  const ids = u => u.map(p => Number(p.id));
  const pairs = units.filter(u => u.length === 2);
  const singles = units.filter(u => u.length === 1).flat().map(p => Number(p.id));
  if (pairs.length === 2) return [[ids(pairs[0]), ids(pairs[1])]];
  if (pairs.length === 1) return [[ids(pairs[0]), singles]];
  return [[[singles[0], singles[1]], [singles[2], singles[3]]],
          [[singles[0], singles[2]], [singles[1], singles[3]]],
          [[singles[0], singles[3]], [singles[1], singles[2]]]];
}

/*
  Team split (who partners with who)
  ----------------------------------
  Strong players are paired with weaker ones (3.0 + 2.0, 3.0 + 2.5 ...):
    - a split where one team is completely stronger than the other
      (e.g. 3.0+3.0 vs 2.0+2.0) is heavily penalised
    - combined team ratings should be close
    - recent partners / recent opponents are avoided
  Lower score is better.
*/
function teamScore(a, b) {
  const rating = id => Number(player(id)?.rating || 3);
  const ra = a.map(rating), rb = b.map(rating);
  const sumA = ra.reduce((s, x) => s + x, 0), sumB = rb.reduce((s, x) => s + x, 0);
  let score = Math.abs(sumA - sumB) * 8;

  const spread = Math.max(...ra, ...rb) - Math.min(...ra, ...rb);
  const oneSideStronger = Math.min(...ra) > Math.max(...rb) || Math.min(...rb) > Math.max(...ra);
  if (spread > 0 && oneSideStronger) score += 40;

  const now = state.nextRoundId;
  const partnerPenalty = team => {
    // A fixed pair is meant to repeat, so the repeat-partner penalty is off.
    if (areFixedPartners(team[0], team[1])) return 0;
    const last = Number(player(team[0])?.partners?.[team[1]] || 0);
    if (!last) return 0;
    const age = Math.max(1, now - last);
    return age <= 3 ? (4 - age) * 14 : 1;
  };
  score += partnerPenalty(a) + partnerPenalty(b);

  for (const px of a) for (const py of b) {
    const last = Number(player(px)?.opponents?.[py] || 0);
    if (last) {
      const age = Math.max(1, now - last);
      score += age <= 3 ? (4 - age) * 3 : 0.5;
    }
  }
  return score;
}

function openResult(roundId) {
  activeResultRoundId = roundId;
  const round = state.rounds.find(r=>r.id===roundId);
  if (!round || round.status !== "pending") return;
  const a = round.teamA.map(id=>player(id).name).join(" + ");
  const b = round.teamB.map(id=>player(id).name).join(" + ");
  document.getElementById("resultTitle").textContent = `Round ${round.id} result`;
  document.getElementById("resultHelp").textContent = "Enter the final score. The higher score determines the winning team and updates player ratings.";
  document.getElementById("resultButtons").innerHTML = `
    <div class="score-teams">
      <div class="score-team">
        <div class="score-label">Team A</div>
        <div class="score-names">${esc(a)}</div>
        <div class="stepper"><button type="button" class="step-btn" data-step="-1" data-for="scoreA" aria-label="Team A minus one">−</button><input id="scoreA" class="score-input" type="number" min="0" max="99" inputmode="numeric" value="0" aria-label="Team A score"><button type="button" class="step-btn" data-step="1" data-for="scoreA" aria-label="Team A plus one">+</button></div>
      </div>
      <div class="score-vs">VS</div>
      <div class="score-team">
        <div class="score-label">Team B</div>
        <div class="score-names">${esc(b)}</div>
        <div class="stepper"><button type="button" class="step-btn" data-step="-1" data-for="scoreB" aria-label="Team B minus one">−</button><input id="scoreB" class="score-input" type="number" min="0" max="99" inputmode="numeric" value="0" aria-label="Team B score"><button type="button" class="step-btn" data-step="1" data-for="scoreB" aria-label="Team B plus one">+</button></div>
      </div>
    </div>
    <button class="btn btn-primary submit-score" onclick="recordScore()">Save result</button>
  `;
  document.getElementById("resultModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("scoreA")?.focus(), 0);
}
window.openResult = openResult;

function recordScore() {
  const round = state.rounds.find(r=>r.id===activeResultRoundId);
  if (!round || round.status !== "pending") return closeModal();

  const scoreA = Number(document.getElementById("scoreA")?.value);
  const scoreB = Number(document.getElementById("scoreB")?.value);
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
    return toast("Enter both scores first.");
  }
  if (scoreA === scoreB) {
    return toast("The score cannot be tied. Enter the final score to determine the winner.");
  }

  const winner = scoreA > scoreB ? "A" : "B";
  const winningIds = winner === "A" ? round.teamA : round.teamB;
  const losingIds = winner === "A" ? round.teamB : round.teamA;

  // Capture the ratings BEFORE the result changes them. This is important for
  // a fair rating calculation because every player in the match is evaluated
  // using the same pre-match strength snapshot.
  const preRatings = {};
  [...round.teamA, ...round.teamB].forEach(id => {
    preRatings[id] = Number(player(id).rating);
  });

  const ratingChanges = calculateDoublesRatingChanges(round, scoreA, scoreB, preRatings);

  winningIds.forEach(id => { player(id).wins++; player(id).games++; });
  losingIds.forEach(id => { player(id).losses++; player(id).games++; });

  Object.entries(ratingChanges).forEach(([id, change]) => {
    const p = player(Number(id));
    p.rating = roundRating(Math.max(2.0, Math.min(8.0, p.rating + change)));
    p.lastRatingChange = roundRating(change);
    p.lastRatingRound = round.id;
    p.ratingType = "PDDR Doubles";
    p.ratingVersion = 1;
    p.ratingHistory = Array.isArray(p.ratingHistory) ? p.ratingHistory : [];
    p.ratingHistory.push({ roundId: round.id, before: roundRating(p.rating - change), change: roundRating(change), after: p.rating, at: Date.now() });
    if (p.ratingHistory.length > 50) p.ratingHistory = p.ratingHistory.slice(-50);
  });

  round.status = "completed";
  round.winner = winner;
  round.scoreA = scoreA;
  round.scoreB = scoreB;
  round.ratingChanges = ratingChanges;
  round.preRatings = preRatings;
  round.completedAt = Date.now();
  closeModal();
  saveState();

  const winnerNames = winningIds.map(id => player(id).name).join(" + ");
  const deltaText = winningIds.map(id => `+${ratingChanges[id].toFixed(2)}`).join(" / ");
  toast(`Round ${round.id} saved. ${winnerNames} won (${deltaText} rating). Press Generate Matches for the next match.`);
}

/*
  PickleMatch Dynamic Doubles Rating (PDDR)
  ------------------------------------------------
  This is PickleMatch's own club rating model. It is NOT an official DUPR
  rating and does not submit results to DUPR. It follows public pickleball
  rating principles: performance vs expectation, opponent/team strength,
  score margin, and higher volatility for players with fewer results.

  Scale: 2.00–8.00
  Type: Doubles
  Provisional: first 5 games

  The exact DUPR formula is proprietary, so PDDR deliberately does not claim
  to reproduce it. Instead, it uses a transparent, deterministic model that
  is suitable for a private club leaderboard.
*/
function calculateDoublesRatingChanges(round, scoreA, scoreB, preRatings) {
  const idsA = round.teamA.map(Number);
  const idsB = round.teamB.map(Number);
  const avg = ids => ids.reduce((sum, id) => sum + Number(preRatings[id] ?? player(id)?.rating ?? 3), 0) / ids.length;

  const teamA = avg(idsA);
  const teamB = avg(idsB);

  // Expected win probability from the pre-match doubles rating gap.
  // The 0.50 denominator gives meaningful movement without making ratings
  // swing wildly from one large mismatch.
  const expectedA = 1 / (1 + Math.pow(10, (teamB - teamA) / 0.50));
  const actualA = scoreA > scoreB ? 1 : 0;

  // Convert the final score into a performance share. This makes 11–8 a
  // materially different signal from 11–2 while avoiding huge rewards for
  // unusually high scores.
  const total = Math.max(1, scoreA + scoreB);
  const rawShareA = scoreA / total;
  const actualShareA = 0.5 + (rawShareA - 0.5) * 0.90;
  const expectedShareA = 0.5 + (expectedA - 0.5) * 0.90;

  // Blend win/loss outcome and score performance. The score component is
  // deliberately stronger, reflecting the principle that performance versus
  // expectation matters rather than win/loss alone.
  const outcomeSignal = actualA - expectedA;
  const scoreSignal = actualShareA - expectedShareA;
  const performanceSignal = (outcomeSignal * 0.35) + (scoreSignal * 0.65);

  const gamesA = idsA.reduce((sum, id) => sum + Number(player(id)?.games || 0), 0) / idsA.length;
  const gamesB = idsB.reduce((sum, id) => sum + Number(player(id)?.games || 0), 0) / idsB.length;

  // Provisional players establish their rating faster; established players
  // stabilize gradually. This prevents one lucky game from dominating a
  // long record.
  const volatilityFor = games => games < 5 ? 1.55 : games < 10 ? 1.30 : games < 20 ? 1.10 : games < 40 ? 0.95 : 0.82;
  const volatilityA = volatilityFor(gamesA);
  const volatilityB = volatilityFor(gamesB);

  // Close matches provide cleaner rating information than blowouts. A very
  // large mismatch therefore cannot create unlimited rating movement.
  const pointMargin = Math.abs(scoreA - scoreB);
  const closeFactor = Math.max(0.72, Math.min(1.12, 1.08 - (pointMargin / Math.max(1, total)) * 0.75));

  const baseK = 0.30 * closeFactor;
  let deltaA = baseK * volatilityA * performanceSignal;
  let deltaB = baseK * volatilityB * (-performanceSignal);

  // Keep individual match movement controlled.
  deltaA = Math.max(-0.30, Math.min(0.30, deltaA));
  deltaB = Math.max(-0.30, Math.min(0.30, deltaB));

  const changes = {};
  idsA.forEach(id => { changes[id] = roundRating(deltaA); });
  idsB.forEach(id => { changes[id] = roundRating(deltaB); });
  return changes;
}

function roundRating(n) { return Math.round(n*100)/100; }
window.recordScore = recordScore;

function closeModal() {
  document.getElementById("resultModal").classList.add("hidden");
  activeResultRoundId = null;
}

function render() {
  document.getElementById("playerCount").textContent = activePlayers().length;
  const courtStat = document.getElementById("courtStat");
  if (courtStat) courtStat.textContent = state.courtCount;
  const courtSelect = document.getElementById("courtCount");
  if (courtSelect) courtSelect.value = String(state.courtCount);
  const courtWord = state.courtCount === 1 ? "court" : "courts";
  const matchWord = state.courtCount === 1 ? "match" : "matches";
  const matchLimitText = document.getElementById("matchLimitText");
  if (matchLimitText) matchLimitText.textContent = `${state.courtCount} Court${state.courtCount === 1 ? "" : "s"}`;
  const matchesSubtitle = document.getElementById("matchesSubtitle");
  if (matchesSubtitle) matchesSubtitle.textContent = `Up to ${state.courtCount} ${courtWord} / ${state.courtCount} pending ${matchWord} at a time`;
  const heroCourtChip = document.getElementById("heroCourtChip");
  if (heroCourtChip) heroCourtChip.textContent = `🏓 ${state.courtCount} Court${state.courtCount === 1 ? "" : "s"}`;
  const heroMatchChip = document.getElementById("heroMatchChip");
  if (heroMatchChip) {
    const pc = pendingRounds().length;
    heroMatchChip.textContent = `${pc} Active Match${pc === 1 ? "" : "es"}`;
  }
  document.querySelectorAll("[data-court-option]").forEach(btn => {
    const active = Number(btn.dataset.courtOption) === state.courtCount;
    btn.classList.toggle("selected", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  const courtNote = document.getElementById("courtSettingNote");
  if (courtNote) courtNote.textContent = state.courtCount === 1 ? "Only Court 1 can be filled by Generate Matches." : "Court 1 and Court 2 can run at the same time.";
  renderGameLimit();
  renderCourtLevels();
  renderFixedPairs();
  const heroLevelChip = document.getElementById("heroLevelChip");
  if (heroLevelChip) {
    const on = courtRulesOn();
    heroLevelChip.classList.toggle("hidden", !on);
    if (on) heroLevelChip.textContent = state.courtCount === 1
      ? `⭐ C1 ${courtRangeText(1)}`
      : `⭐ C1 ${courtRangeText(1)} · C2 ${courtRangeText(2)}`;
  }
  const inCount = activePlayers().filter(p => isPendingPlayer(p.id)).length;
  const nextCount = activePlayers().filter(p => !isPendingPlayer(p.id) && hasGamesLeft(p)).length;
  document.getElementById("waitingCount").textContent = nextCount;
  document.getElementById("roundCount").textContent = state.rounds.filter(r => r.status === "completed").length;
  document.getElementById("queueSubtitle").textContent = `${inCount} in current matches · ${nextCount} waiting`;
  renderRotationDashboard(inCount, nextCount);
  renderWaiting();
  renderPlayerList();
  renderMatches();
  renderHistory();
  renderLeaderboard();
  const nh = document.getElementById("navHistory");
  if (nh) nh.textContent = state.rounds.filter(r => r.status !== "pending").length;
}

function renderGameLimit() {
  const limit = state.gameLimit || 0;
  const active = activePlayers();
  const done = active.filter(isDone).length;
  const val = document.getElementById("gameLimitValue");
  const unit = document.getElementById("gameLimitUnit");
  const note = document.getElementById("gameLimitNote");
  if (val) val.textContent = limit ? String(limit) : "No limit";
  if (unit) unit.textContent = limit ? `game${limit === 1 ? "" : "s"} each` : "";
  document.querySelectorAll(".limit-presets [data-limit]").forEach(b => {
    const on = Number(b.dataset.limit) === limit;
    b.classList.toggle("selected", on);
    b.setAttribute("aria-pressed", String(on));
  });
  const minus = document.querySelector('[data-limit-step="-1"]');
  const plus = document.querySelector('[data-limit-step="1"]');
  if (minus) minus.disabled = limit === 0;
  if (plus) plus.disabled = limit >= GAME_LIMIT_MAX;
  if (note) {
    if (!limit) note.textContent = "Players keep rotating until you stop the session.";
    else {
      const slots = active.length * limit;
      const short = active.length && slots % 4 ? ` With ${active.length} players, ${(slots % 4)} player${slots % 4 === 1 ? "" : "s"} may end 1 game short.` : "";
      note.textContent = `${done} of ${active.length} player${active.length === 1 ? "" : "s"} done. Players who reach ${limit} games sit out new matches.${short}`;
    }
  }
  const chip = document.getElementById("heroLimitChip");
  if (chip) {
    chip.classList.toggle("hidden", !limit);
    if (limit) chip.textContent = `🎯 ${limit} game${limit === 1 ? "" : "s"} each · ${done}/${active.length} done`;
  }
}

function getWaitingPlayers() {
  // Show all active players, but separate the locked current-match players
  // from players who are eligible for the next Generate Matches.
  return [...activePlayers()].sort((a,b) =>
    effG(a)-effG(b) || a.lastPlayedRound-b.lastPlayedRound || a.queueSeq-b.queueSeq
  );
}

let activeChange = null;

function getChangeAvailablePlayers(roundId, outgoingId) {
  const rid = Number(roundId);
  const oid = Number(outgoingId);
  const round = state.rounds.find(r => Number(r.id) === rid);
  const court = Number(round && round.court) || 1;
  const locked = new Set(
    pendingRounds()
      .filter(r => Number(r.id) !== rid)
      .flatMap(r => [...r.teamA, ...r.teamB].map(Number))
  );
  // A substitute must also match the court's skill level, otherwise a CHANGE
  // could quietly put a 4.5 player on the beginners court. Players in a fixed
  // partnership are left out too: bringing one in without their partner would
  // break the partnership the organizer set up.
  return activePlayers()
    .filter(p => !locked.has(Number(p.id)) && Number(p.id) !== oid && hasGamesLeft(p)
      && fitsCourt(p, court) && !isFixedPaired(p.id))
    .sort(byPriority);
}

function replacementScore(candidate, round, outgoingId) {
  const remainingIds = [...round.teamA, ...round.teamB].filter(id => id !== outgoingId);
  const outgoingWasA = round.teamA.includes(outgoingId);
  const teammateIds = outgoingWasA ? round.teamA.filter(id => id !== outgoingId) : round.teamB.filter(id => id !== outgoingId);
  const opponentIds = outgoingWasA ? round.teamB : round.teamA;
  const candidateRating = Number(candidate.rating);
  const teammateAvg = teammateIds.reduce((s,id)=>s+Number(player(id).rating),0) / Math.max(1, teammateIds.length);
  const opponentAvg = opponentIds.reduce((s,id)=>s+Number(player(id).rating),0) / Math.max(1, opponentIds.length);

  let score = 0;
  // Rotation fairness: fewer games and longer wait are better.
  score += effG(candidate) * 5;
  score += candidate.lastPlayedRound * 0.15;
  score += candidate.queueSeq * 0.001;
  // Keep the replacement reasonably close to the removed player's level.
  score += Math.abs(candidateRating - Number(player(outgoingId)?.rating || candidateRating)) * 7;
  // Prefer a balanced replacement for the remaining teammate/opponents.
  score += Math.abs((teammateAvg + candidateRating) - (opponentAvg * 2)) * 3;

  const now = state.nextRoundId;
  teammateIds.forEach(id => {
    const last = player(id).partners[candidate.id] || 0;
    if (last && now-last <= 3) score += (4-(now-last))*3;
  });
  opponentIds.forEach(id => {
    const last = player(id).opponents[candidate.id] || 0;
    if (last && now-last <= 3) score += (4-(now-last))*1.5;
  });
  return score;
}

function chooseReplacementPlayer(round, outgoingId) {
  const available = getChangeAvailablePlayers(round.id, outgoingId);
  if (!available.length) return null;
  available.sort((a,b) => replacementScore(a, round, outgoingId) - replacementScore(b, round, outgoingId));
  return available[0];
}

function changePlayerNow(roundId, outgoingId) {
  const rid = Number(roundId), oid = Number(outgoingId);
  const round = state.rounds.find(r => Number(r.id) === rid && r.status === "pending");
  const outgoing = player(oid);
  if (!round || !outgoing) return toast("This pending match/player could not be found.");

  const available = getChangeAvailablePlayers(rid, oid);
  if (!available.length) return toast("No available active player can replace this player right now.");

  // Use a native prompt as the final fallback. It is deliberately independent
  // of the modal/event system, so CHANGE still works even if a stale cached
  // modal or CSS layer is present in an older browser tab.
  const choices = available.map((p, i) => `${i + 1}. ${p.name} — ${ratingLabel(p.rating)} rating · ${p.games} games`).join("\n");
  const suggested = chooseReplacementPlayer(round, oid);
  const suggestedIndex = Math.max(0, available.findIndex(p => p.id === suggested?.id));
  const answer = window.prompt(
    `CHANGE PLAYER\n\nCurrent player: ${outgoing.name}\n\nChoose a replacement by number:\n\n${choices}\n\nEnter a number (suggested: ${suggestedIndex + 1}).`,
    String(suggestedIndex + 1)
  );
  if (answer === null) return;
  const index = Number(answer) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= available.length) {
    return toast("Invalid replacement number.");
  }
  const replacement = available[index];
  if (!applyPlayerChange(rid, oid, replacement.id)) return;
  saveState();
  toast(`${outgoing.name} was changed to ${replacement.name}.`);
}
window.changePlayerNow = changePlayerNow;

function openChangePlayer(roundId, outgoingId) {
  roundId = Number(roundId);
  outgoingId = Number(outgoingId);
  const round = state.rounds.find(r => Number(r.id) === roundId);
  const outgoing = player(outgoingId);
  if (!round || round.status !== "pending" || !outgoing) return;

  const available = getChangeAvailablePlayers(roundId, outgoingId);

  activeChange = { roundId, outgoingId };
  const suggested = chooseReplacementPlayer(round, outgoingId);
  document.getElementById("changeTitle").textContent = `Change ${outgoing.name}`;
  const mate = fixedPartnerOf(outgoingId);
  const mateHere = mate && [...round.teamA, ...round.teamB].map(Number).includes(Number(mate.id));
  document.getElementById("changeDescription").textContent =
    `Remove ${outgoing.name} from this court and choose who will take the open slot. The match stays on the same Court and Round.`
    + (mateHere ? ` ⚠️ ${outgoing.name} is a fixed partner of ${mate.name}. Substituting splits them for this round only — the partnership stays on for the matches after it.` : "");
  const select = document.getElementById("changeSelect");
  select.innerHTML = available.length
    ? available.map(p =>
        `<option value="${p.id}" ${suggested && p.id === suggested.id ? "selected" : ""}>${esc(p.name)} — ${ratingLabel(p.rating)} rating · ${p.games} games</option>`
      ).join("")
    : `<option value="">No available active player</option>`;
  select.disabled = !available.length;
  document.getElementById("changeModal").classList.remove("hidden");
}
window.openChangePlayer = openChangePlayer;

function closeChangeModal() {
  document.getElementById("changeModal").classList.add("hidden");
  const select = document.getElementById("changeSelect");
  select.disabled = false;
  activeChange = null;
}
window.closeChangeModal = closeChangeModal;

function applyPlayerChange(roundId, outgoingId, replacementId) {
  roundId = Number(roundId);
  outgoingId = Number(outgoingId);
  replacementId = Number(replacementId);
  const round = state.rounds.find(r => Number(r.id) === roundId);
  const outgoing = player(outgoingId);
  const replacement = player(replacementId);
  if (!round || round.status !== "pending" || !outgoing || !replacement) return false;
  if (replacement.id === outgoing.id || replacement.active === false || isPendingPlayer(replacement.id)) {
    toast("That player is not available for this change.");
    return false;
  }

  round.teamA = round.teamA.map(Number);
  round.teamB = round.teamB.map(Number);
  const wasA = round.teamA.includes(outgoingId);
  const team = wasA ? round.teamA : round.teamB;
  const idx = team.indexOf(outgoingId);
  if (idx < 0) return false;

  // Remove only the pending match relationship created for this round.
  [...round.teamA, ...round.teamB].forEach(id => {
    if (id === outgoingId) return;
    const other = player(id);
    if (other.partners[outgoingId] === round.id) delete other.partners[outgoingId];
    if (other.opponents[outgoingId] === round.id) delete other.opponents[outgoingId];
  });
  Object.keys(outgoing.partners || {}).forEach(id => {
    if (outgoing.partners[id] === round.id) delete outgoing.partners[id];
  });
  Object.keys(outgoing.opponents || {}).forEach(id => {
    if (outgoing.opponents[id] === round.id) delete outgoing.opponents[id];
  });

  team[idx] = replacement.id;

  const teammateIds = team.filter(id => id !== replacement.id);
  const opponentIds = wasA ? round.teamB : round.teamA;
  teammateIds.forEach(id => {
    player(id).partners[replacement.id] = round.id;
    replacement.partners[id] = round.id;
  });
  opponentIds.forEach(id => {
    player(id).opponents[replacement.id] = round.id;
    replacement.opponents[id] = round.id;
  });

  replacement.lastPlayedRound = round.id;
  replacement.queueSeq = state.queueSeq++;
  round.playerChanges = round.playerChanges || [];
  round.playerChanges.push({
    outgoingId,
    incomingId: replacement.id,
    outgoingName: outgoing.name,
    incomingName: replacement.name,
    changedAt: Date.now()
  });

  return true;
}

function confirmPlayerChange() {
  if (!activeChange) return;
  const replacementId = Number(document.getElementById("changeSelect").value);
  const { roundId, outgoingId } = activeChange;
  if (!replacementId) return toast("Choose a replacement player first.");
  if (!applyPlayerChange(roundId, outgoingId, replacementId)) return;
  const outgoing = player(outgoingId);
  const replacement = player(replacementId);
  closeChangeModal();
  saveState();
  toast(`${outgoing.name} was changed to ${replacement.name}.`);
}
window.confirmPlayerChange = confirmPlayerChange;

function autoReplacePlayer(roundId, outgoingId) {
  const round = state.rounds.find(r => r.id === roundId);
  if (!round || round.status !== "pending") return;
  const replacement = chooseReplacementPlayer(round, outgoingId);
  if (!replacement) return toast("No available active player can replace this player right now.");
  if (!applyPlayerChange(roundId, outgoingId, replacement.id)) return;
  const outgoing = player(outgoingId);
  saveState();
  toast(`${outgoing.name} was automatically changed to ${replacement.name}.`);
}
window.autoReplacePlayer = autoReplacePlayer;

function removePlayer(id) {
  const p = player(id);
  if (!p) return;

  const pendingWithPlayer = pendingRounds().filter(r =>
    r.teamA.includes(id) || r.teamB.includes(id)
  );

  const mate = fixedPartnerOf(id);
  const message = (pendingWithPlayer.length
    ? `${p.name} is assigned to a pending round. Remove this player anyway? Their pending round(s) will be canceled. You can press Generate Matches to refill the open slot.`
    : `Remove ${p.name} from the active rotation?`)
    + (mate ? `\n\nThis also ends the fixed partnership with ${mate.name}, who goes back to normal rotation.` : "");

  if (!confirm(message)) return;

  // A partnership needs both players, so removing one dissolves it.
  if (mate) state.fixedPairs = fixedPairs().filter(pair => !pair.includes(Number(id)));

  // Soft-delete: keeps completed match history intact while removing the player
  // from future rotation and the active leaderboard.
  p.active = false;

  // Cancel pending rounds containing this player. Completed history remains.
  state.rounds = state.rounds.filter(r =>
    r.status !== "pending" || (!r.teamA.includes(id) && !r.teamB.includes(id))
  );

  saveState();
  // IMPORTANT: removing a player must NEVER create/refill a match automatically.
  // The organizer must press Generate Matches to create the next pending rounds.
  toast(`${p.name} removed from the active rotation. Press Generate Matches to create the next match(es).`);
}
window.removePlayer = removePlayer;

function getRotationFairness() {
  const active = activePlayers();
  if (!active.length) return { gameGap: 0, repeats: 0, avgPartners: 0 };
  const games = active.map(effG);
  const pairCounts = {};
  state.rounds.forEach(r => {
    const teams = [r.teamA || [], r.teamB || []];
    teams.forEach(team => {
      for (let i=0;i<team.length;i++) for (let j=i+1;j<team.length;j++) {
        const a = Number(team[i]), b = Number(team[j]);
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      }
    });
  });
  const repeats = Object.values(pairCounts).reduce((sum,n) => sum + Math.max(0,n-1), 0);
  const uniquePartners = active.reduce((sum,p) => sum + Object.keys(p.partners || {}).length, 0) / Math.max(1, active.length);
  return { gameGap: Math.max(...games) - Math.min(...games), repeats, avgPartners: uniquePartners };
}

function renderRotationDashboard(inCount, nextCount) {
  const el = document.getElementById("rotationDashboard");
  if (!el) return;
  const f = getRotationFairness();
  const gameLabel = f.gameGap === 0 ? "Even" : `±${f.gameGap}`;
  const repeatLabel = f.repeats === 0 ? "None" : String(f.repeats);
  el.innerHTML = `
    <div class="rotation-metric"><span>🏓 PLAYING</span><strong>${inCount}</strong><small>locked in matches</small></div>
    <div class="rotation-metric"><span>🔜 NEXT</span><strong>${nextCount}</strong><small>priority queue</small></div>
    <div class="rotation-metric"><span>⚖️ GAME GAP</span><strong>${gameLabel}</strong><small>highest vs lowest</small></div>
    <div class="rotation-metric"><span>🔄 PARTNER REPEATS</span><strong>${repeatLabel}</strong><small>historical repeats</small></div>`;
}

// Shared row markup for both the Next Rotation list and the Player List at the
// bottom of the page. `badgeHtml`/`badgeClass` describe the player's queue
// status; `showRemove` controls whether the REMOVE button is drawn (Player
// List only — Next Rotation is informational, and CHANGE now lives on the
// match card itself, inside Active Matches).
// Shows which courts a player's rating allows, but only when that is actually
// a restriction — a player who fits every active court needs no chip.
function courtChipFor(p) {
  if (!courtRulesOn()) return "";
  const courts = eligibleCourtsFor(p);
  if (!courts.length) return ` <span class="court-chip none">No matching court</span>`;
  if (courts.length >= courtsInUse().length) return "";
  return ` <span class="court-chip">Court ${courts.join(" / ")} only</span>`;
}

function pairChipFor(p) {
  const mate = fixedPartnerOf(p.id);
  return mate ? ` <span class="pair-chip">🤝 ${esc(mate.name)}</span>` : "";
}

function playerRow(p, badgeHtml, badgeClass, showRemove) {
  const pid = Number(p.id);
  return `
    <div class="waiting-player ${badgeClass === "active-badge" ? "is-in-rotation" : "is-next"}">
      <div class="player-meta">
        <div class="avatar">${esc(initials(p.name))}</div>
        <div>
          <div class="player-name">${esc(p.name)}</div>
          <div class="player-sub">${ratingLabel(p.rating)} rating · ${state.gameLimit ? `${p.games}/${state.gameLimit}` : p.games} games · ${p.wins}W / ${p.losses}L${p.games === 0 ? ` <span class="fresh-chip">Not played yet</span>` : ""}${pairChipFor(p)}${courtChipFor(p)}</div>
        </div>
      </div>
      <div class="queue-actions">
        <span class="queue-badge ${badgeClass}">${badgeHtml}</span>
        ${showRemove ? `<button type="button" class="remove-next-btn" data-pm-action="remove" data-player-id="${pid}">REMOVE</button>` : ""}
      </div>
    </div>`;
}

function renderWaiting() {
  const el = document.getElementById("waitingList");
  const players = getWaitingPlayers();

  if (!players.length) {
    el.className = "waiting-list empty";
    el.innerHTML = "No active players. Add players above to start the rotation.";
    return;
  }

  const nextRotation = players.filter(p => !isPendingPlayer(p.id) && hasGamesLeft(p));
  const doneCount = players.filter(p => !isPendingPlayer(p.id) && isDone(p)).length;

  el.className = "waiting-list";
  el.innerHTML = `
    <div class="queue-section">
      <div class="queue-section-title">
        <span>🔜 Next Rotation</span>
        <small>${nextRotation.length} players waiting for the next available round${doneCount ? ` · ${doneCount} done (reached ${state.gameLimit} games)` : ""}</small>
      </div>
      <div class="queue-cards">
        ${nextRotation.length ? nextRotation.map((p,i)=>playerRow(p, `#${i + 1} NEXT`, "", false)).join("") : `<div class="section-empty">${doneCount ? "Nobody else has games left." : "Everyone is currently in the two pending rounds."}</div>`}
      </div>
    </div>`;
}

// Player List: every active player, playing or waiting, with a single REMOVE
// action — the one place player lineup removal happens now.
function renderPlayerList() {
  const el = document.getElementById("playerListEl");
  const sub = document.getElementById("playerListSubtitle");
  const players = getWaitingPlayers();

  if (!players.length) {
    el.className = "waiting-list empty";
    el.innerHTML = "No players yet. Add players above to get started.";
    if (sub) sub.textContent = "0 players";
    return;
  }
  if (sub) sub.textContent = `${players.length} player${players.length === 1 ? "" : "s"}`;

  const roundForId = (id) => {
    const n = Number(id);
    const r = pendingRounds().find(r => r.teamA.map(Number).includes(n) || r.teamB.map(Number).includes(n));
    return r ? Number(r.id) : null;
  };

  let nextIndex = 0;
  el.className = "waiting-list";
  el.innerHTML = `<div class="queue-cards">${players.map(p => {
    if (isPendingPlayer(p.id)) return playerRow(p, `🏓 Round ${roundForId(p.id)}`, "active-badge", true);
    if (isDone(p)) return playerRow(p, "✅ DONE", "done-badge", true);
    nextIndex += 1;
    return playerRow(p, `#${nextIndex} NEXT`, "", true);
  }).join("")}</div>`;

  el.querySelectorAll('button[data-pm-action="remove"]').forEach(btn => {
    btn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const pid = Number(this.dataset.playerId);
      if (!Number.isFinite(pid)) return toast("Unable to identify this player.");
      removePlayer(pid);
    });
  });
}

let showAllHistory = false;
function balanceInfo(gap) {
  if (gap <= 0.25) return { cls: "even", label: "Evenly matched" };
  if (gap <= 0.75) return { cls: "close", label: "Close match" };
  return { cls: "uneven", label: "Uneven match" };
}
function playerChips(list, roundId) {
  return list.map(p => `
    <span class="pchip">
      <span class="pchip-info">${esc(p.name)} <b>${Number(p.rating).toFixed(2)}</b></span>
      ${roundId ? `<button type="button" class="pchip-change" data-pm-action="change" data-round-id="${roundId}" data-player-id="${p.id}">CHANGE</button>` : ""}
    </span>`).join("");
}
// Marks a team that is a locked partnership, so it is obvious on the court
// card why those two keep playing together.
function pairTag(team) {
  return team.length === 2 && areFixedPartners(team[0], team[1])
    ? ` <span class="team-pair-tag">🤝 Fixed pair</span>` : "";
}

function matchCard(r) {
  const aP = r.teamA.map(id => player(id)).filter(Boolean);
  const bP = r.teamB.map(id => player(id)).filter(Boolean);
  const aR = aP.reduce((s,p) => s + Number(p.rating || 3), 0);
  const bR = bP.reduce((s,p) => s + Number(p.rating || 3), 0);
  const bal = balanceInfo(Math.abs(aR - bR));
  const won = w => r.status === "completed" && r.winner === w ? " winner" : "";
  return `
    <div class="match-card ${r.status}">
      <div class="match-head">
        <div class="round-title">Court ${r.court || 1} <span>Round ${r.id}</span></div>
        <div class="head-tags">
          ${courtRulesOn() && !isOpenCourt(r.court || 1) ? `<span class="court-level-tag">⭐ ${esc(courtRangeText(r.court || 1))}</span>` : ""}
          ${r.status === "pending" ? `<span class="bal ${bal.cls}" title="Team rating difference ${Math.abs(aR-bR).toFixed(2)}">${bal.label}</span>` : ""}
          <span class="status ${r.status}">${r.status === "pending" ? "In play" : "Final"}</span>
        </div>
      </div>
      <div class="teams">
        <div class="team${won("A")}"><div class="team-label">Team A${won("A") ? " · won" : ""}${pairTag(r.teamA)}</div><div class="team-chips">${playerChips(aP, r.status === "pending" ? r.id : null)}</div><div class="team-rating">Combined <b>${aR.toFixed(2)}</b>${r.status === "completed" ? `<em class="score">${r.scoreA}</em>` : ""}</div></div>
        <div class="vs">vs</div>
        <div class="team right${won("B")}"><div class="team-label">Team B${won("B") ? " · won" : ""}${pairTag(r.teamB)}</div><div class="team-chips">${playerChips(bP, r.status === "pending" ? r.id : null)}</div><div class="team-rating">Combined <b>${bR.toFixed(2)}</b>${r.status === "completed" ? `<em class="score">${r.scoreB}</em>` : ""}</div></div>
      </div>
      ${r.playerChanges?.length ? `<div class="player-change-log"><b>Substitutions:</b> ${r.playerChanges.map(c => `${esc(c.outgoingName)} → ${esc(c.incomingName)}`).join(" · ")}</div>` : ""}
      ${r.status === "pending"
        ? `<div class="match-actions"><span class="match-lock">Players are locked until the score is saved</span><button type="button" class="btn-cancel" onclick="cancelRound(${r.id})">Cancel match</button><button type="button" class="btn-result" onclick="openResult(${r.id})">Enter score</button></div>`
        : `<div class="rating-result">${renderRatingChanges(r)}</div>`}
    </div>`;
}

// Active matches: only matches in play.
function renderMatches() {
  const el = document.getElementById("matchesList");
  const pending = pendingRounds().sort((a,b) => a.court - b.court);
  if (!pending.length) {
    el.className = "matches-list empty";
    el.textContent = state.players.length ? "No match in play. Press Generate Matches to start the next one." : "No matches yet. Add at least 4 players, then press Generate Matches.";
    return;
  }
  el.className = "matches-list";
  el.innerHTML = `<div class="match-group ${pending.length > 1 ? "two-courts" : ""}">${pending.map(matchCard).join("")}</div>`;

  el.querySelectorAll('button[data-pm-action="change"]').forEach(btn => {
    btn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      const rid = Number(this.getAttribute("data-round-id"));
      const pid = Number(this.getAttribute("data-player-id"));
      if (!Number.isFinite(rid) || !Number.isFinite(pid)) return toast("Unable to identify this player/round.");
      openChangePlayer(rid, pid);
    });
  });
}

// Finished matches: history lives at the bottom of the page.
function renderHistory() {
  const el = document.getElementById("historyList");
  const sub = document.getElementById("historySubtitle");
  const done = state.rounds.filter(r => r.status !== "pending").sort((a,b) => b.id - a.id);
  if (!done.length) {
    el.className = "matches-list empty";
    el.textContent = "No finished matches yet.";
    if (sub) sub.textContent = "Completed matches appear here";
    return;
  }
  const shown = showAllHistory ? done : done.slice(0, 6);
  if (sub) sub.textContent = `${done.length} finished · newest first`;
  el.className = "matches-list";
  el.innerHTML = `<div class="match-group history">${shown.map(matchCard).join("")}</div>` +
    (done.length > 6 ? `<div class="history-more"><button type="button" class="link-btn" onclick="toggleHistory()">${showAllHistory ? "Show latest 6" : `Show all ${done.length}`}</button></div>` : "");
}
function toggleHistory() { showAllHistory = !showAllHistory; renderHistory(); }
window.toggleHistory = toggleHistory;

function cancelRound(roundId) {
  roundId = Number(roundId);
  const round = state.rounds.find(r => r.id === roundId && r.status === "pending");
  if (!round) return;
  if (!confirm(`Cancel Round ${round.id}? Its four players return to the waiting list and the pairing is not counted as played.`)) return;
  const ids = [...round.teamA, ...round.teamB].map(Number);
  ids.forEach(id => {
    const p = player(id); if (!p) return;
    [p.partners, p.opponents].forEach(map => Object.keys(map).forEach(k => { if (map[k] === round.id) delete map[k]; }));
    const prev = state.rounds.filter(r => r.status === "completed" && [...r.teamA, ...r.teamB].includes(id)).map(r => r.id);
    p.lastPlayedRound = prev.length ? Math.max(...prev) : 0;
  });
  state.rounds = state.rounds.filter(r => r.id !== round.id);
  saveState();
  toast(`Round ${round.id} cancelled. Press Generate Matches to build a new one.`);
}
window.cancelRound = cancelRound;

function renderRatingChanges(round) {
  if (!round.ratingChanges) return "";
  const entries = Object.entries(round.ratingChanges).map(([id, change]) => {
    const p = player(Number(id));
    if (!p) return "";
    const n = Number(change);
    return `<span class="rating-chip">${esc(p.name)} <b>${n >= 0 ? "+" : ""}${n.toFixed(2)}</b></span>`;
  }).join("");
  return entries ? `<span class="rating-label">Rating change</span>${entries}` : "";
}

/*
  Fair leaderboard ranking
  ------------------------
  Players start at different self-assigned ratings (e.g. 4.0 vs 2.0), so ranking
  by rating alone rewards the starting number, not results. Rank is based on
  performance this session instead:

    Score = (wins + 2.5) / (games + 5)

  i.e. win rate pulled toward 50% until a player has played enough games. A 1-0
  start cannot jump ahead of someone who has won 7 of 9, and a long run of wins
  steadily lifts the score. Ties go to point differential, then wins, then
  games played, then rating. Players with no finished games are listed last
  and unranked.
*/
const RANK_PRIOR_GAMES = 5;
function performanceScore(p) {
  const games = Number(p.games) || 0;
  const wins = Number(p.wins) || 0;
  return (wins + RANK_PRIOR_GAMES / 2) / (games + RANK_PRIOR_GAMES);
}
function pointDiffByPlayer(rounds = state.rounds) {
  const diff = {};
  rounds.filter(r => r.status === "completed").forEach(r => {
    const a = Number(r.scoreA) || 0, b = Number(r.scoreB) || 0;
    r.teamA.forEach(id => { diff[Number(id)] = (diff[Number(id)] || 0) + (a - b); });
    r.teamB.forEach(id => { diff[Number(id)] = (diff[Number(id)] || 0) + (b - a); });
  });
  return diff;
}

function leaderboardOrder(list, diff = pointDiffByPlayer()) {
  return [...list].sort((a, b) => {
    const aPlayed = (Number(a.games) || 0) > 0, bPlayed = (Number(b.games) || 0) > 0;
    if (aPlayed !== bPlayed) return aPlayed ? -1 : 1;           // unplayed go last
    return performanceScore(b) - performanceScore(a) ||
      (diff[b.id] || 0) - (diff[a.id] || 0) ||
      b.wins - a.wins || b.games - a.games || b.rating - a.rating ||
      String(a.name).localeCompare(String(b.name));
  });
}

function renderLeaderboard() {
  const el = document.getElementById("leaderboard");
  const currentPlayers = activePlayers();
  if (!currentPlayers.length) {
    el.className = "leaderboard empty";
    el.textContent = "No active players yet.";
    return;
  }

  const diff = pointDiffByPlayer();
  const sorted = leaderboardOrder(currentPlayers, diff);

  let rank = 0;
  el.className = "leaderboard";
  el.innerHTML = `
    <div class="lb-note">Ranked by <b>Score</b>: win rate adjusted for games played, so a lucky start can't jump the board. Starting rating does not affect rank.</div>
    <div class="rank-row rank-head">
      <div>#</div><div>Player</div><div class="lb-cell optional">Wins</div><div class="lb-cell">Games</div><div class="lb-cell optional">Win rate</div><div class="lb-cell optional">Rating</div><div class="lb-cell">Score</div>
    </div>
    ${sorted.map(p => {
      const played = (Number(p.games) || 0) > 0;
      if (played) rank += 1;
      const wr = p.games ? Math.round(p.wins / p.games * 100) : 0;
      const change = Number(p.lastRatingChange || 0);
      const changeText = change > 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
      const provisional = p.games < 5 ? `<span class="lb-provisional">Provisional</span>` : "";
      const trend = change > 0 ? "up" : change < 0 ? "down" : "flat";
      const pd = diff[p.id] || 0;
      const pdText = pd > 0 ? `+${pd}` : String(pd);
      const rankCell = !played ? "–" : rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank;
      return `<div class="rank-row">
        <div class="rank">${rankCell}</div>
        <div>
          <div class="lb-name">${esc(p.name)} ${provisional}</div>
          <div class="lb-muted">Rating ${ratingLabel(p.rating)} (start ${ratingLabel(p.startingRating)}) · Last <span class="trend ${trend}">${changeText}</span>${played ? ` · Pts ${pdText}` : ""}</div>
        </div>
        <div class="lb-cell optional">${p.wins}</div>
        <div class="lb-cell">${p.games}</div>
        <div class="lb-cell optional">${wr}%</div>
        <div class="lb-cell optional">${ratingLabel(p.rating)}</div>
        <div class="lb-cell rating">${played ? Math.round(performanceScore(p) * 100) : "–"}</div>
      </div>`;
    }).join("")}
  `;
}

let toastTimer;
function toast(msg) {
  const el=document.getElementById("toast");
  el.textContent=msg; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),3600);
}


// ---- Add player popup (opened from the top menu) ----
let quickRating = 3;
let quickAddedNames = [];
function renderQuickAdded() {
  const el = document.getElementById("quickAdded");
  el.innerHTML = quickAddedNames.length
    ? `<span class="quick-added-label">Added now</span>` + quickAddedNames.map(n => `<span class="quick-chip">${esc(n)}</span>`).join("")
    : "";
}
function openAddModal() {
  quickAddedNames = [];
  renderQuickAdded();
  document.getElementById("addModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("quickName").focus(), 0);
}
function closeAddModal() {
  document.getElementById("addModal").classList.add("hidden");
  const btn = document.querySelector('#mainMenu .menu-btn[data-modal="modalAddPlayer"]');
  if (btn) { btn.classList.remove("active"); btn.removeAttribute("aria-current"); }
}

document.getElementById("closeAddModal").onclick = closeAddModal;
document.getElementById("quickDone").onclick = closeAddModal;
document.getElementById("addModal").addEventListener("click", e => { if (e.target.id === "addModal") closeAddModal(); });
// rating slider: drag left (Beginner) to right (Competitive), 0.1 steps
const RATING_MIN = 2, RATING_MAX = 5;
function ratingLevelName(r) {
  if (r >= 5) return "Competitive";
  if (r >= 4.5) return "Advanced+";
  if (r >= 4) return "Advanced";
  if (r >= 3.5) return "Adv. intermediate";
  if (r >= 3) return "Intermediate";
  if (r >= 2.5) return "Adv. beginner";
  return "Beginner";
}
function setQuickRating(value) {
  const r = Math.round(Math.min(RATING_MAX, Math.max(RATING_MIN, Number(value) || 3)) * 10) / 10;
  quickRating = r;
  const range = document.getElementById("ratingRange");
  range.value = String(r);
  const pct = ((r - RATING_MIN) / (RATING_MAX - RATING_MIN)) * 100;
  range.style.setProperty("--fill", pct + "%");
  const label = ratingLevelName(r);
  document.getElementById("ratingValue").textContent = r.toFixed(1);
  document.getElementById("ratingLevel").textContent = label;
  range.setAttribute("aria-valuetext", `${r.toFixed(1)} ${label}`);
  document.querySelectorAll("#ratingPicker .rs-ticks button").forEach(b => b.classList.toggle("on", Number(b.dataset.rating) <= r + 1e-9));
}
document.getElementById("ratingRange").addEventListener("input", e => setQuickRating(e.target.value));
document.getElementById("ratingPicker").addEventListener("click", e => {
  const step = e.target.closest(".rs-step");
  if (step) { setQuickRating(quickRating + Number(step.dataset.step)); return; }
  const tick = e.target.closest(".rs-ticks button");
  if (tick) setQuickRating(tick.dataset.rating);
});
setQuickRating(quickRating);
document.getElementById("quickAddForm").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("quickName");
  const name = input.value.trim();
  if (addPlayer(name, quickRating)) {
    quickAddedNames.push(name);
    renderQuickAdded();
    input.value = "";
  }
  input.focus();
});

// score steppers (- / +) inside the score dialog
document.getElementById("resultButtons").addEventListener("click", e => {
  const btn = e.target.closest(".step-btn");
  if (!btn) return;
  const input = document.getElementById(btn.dataset.for);
  if (!input) return;
  const next = Math.min(99, Math.max(0, (Number(input.value) || 0) + Number(btn.dataset.step)));
  input.value = String(next);
  input.focus();
});

// ---- keyboard: Esc closes dialogs, Enter saves a score ----
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeAllModals(); }
  if (e.key === "Enter" && e.target.classList?.contains("score-input")) { e.preventDefault(); recordScore(); }
});

// ---- backup: export / import the whole session as a JSON file ----
// The file holds the complete state (players, every match, ratings, settings)
// under "state", plus a human-readable "summary" (standings + match results)
// for reading the file outside the app. Import only uses "state".
const APP_VERSION = "6.0";
function pad2(n) { return String(n).padStart(2, "0"); }
function fileStamp(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}`;
}
function buildSessionSummary() {
  const diff = pointDiffByPlayer();
  const name = id => (player(id) || {}).name || `#${id}`;
  let rank = 0;
  const completed = state.rounds.filter(r => r.status === "completed");
  return {
    players: state.players.filter(p => p.active !== false).length,
    removedPlayers: state.players.filter(p => p.active === false).length,
    matchesPlayed: completed.length,
    pendingMatches: pendingRounds().length,
    courts: state.courtCount,
    gamesPerPlayer: state.gameLimit || "No limit",
    fixedPartners: fixedPairs().length ? fixedPairs().map(pairLabel) : "None",
    courtLevels: courtRulesOn()
      ? Object.fromEntries(courtsInUse().map(c => [`court${c}`, courtRuleLabel(c)]))
      : "Off (any player on any court)",
    standings: leaderboardOrder(activePlayers(), diff).map(p => {
      const played = (Number(p.games) || 0) > 0;
      if (played) rank += 1;
      return {
        rank: played ? rank : null, name: p.name,
        score: played ? Math.round(performanceScore(p) * 100) : null,
        games: p.games, wins: p.wins, losses: p.losses, pointDiff: diff[p.id] || 0,
        rating: roundRating(p.rating), startingRating: roundRating(p.startingRating)
      };
    }),
    matches: completed.map(r => ({
      round: r.id, court: r.court,
      teamA: r.teamA.map(name), teamB: r.teamB.map(name),
      score: `${r.scoreA}-${r.scoreB}`, winner: r.winner === "A" ? "Team A" : "Team B"
    }))
  };
}
document.getElementById("exportBtn").addEventListener("click", exportSession);
function exportSession() {
  const now = new Date();
  const file = {
    app: "PickleMatch",
    version: APP_VERSION,
    exportedAt: now.toISOString(),
    summary: buildSessionSummary(),
    state
  };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `picklematch-session-${fileStamp(now)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Session exported: ${state.players.filter(p => p.active !== false).length} players, ${state.rounds.filter(r => r.status === "completed").length} matches.`);
}

let pendingImport = null;
document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", e => {
  const file = e.target.files && e.target.files[0];
  e.target.value = ""; // allow picking the same file again later
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try { parsed = JSON.parse(String(reader.result)); }
    catch { return toast("That file is not a valid PickleMatch export (not JSON)."); }
    // New exports wrap the data in { app, exportedAt, state }; v4.6 and older
    // exported the raw state object directly. Accept both.
    const raw = parsed && typeof parsed === "object" && parsed.state && typeof parsed.state === "object" ? parsed.state : parsed;
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.players) || !Array.isArray(raw.rounds)) {
      return toast("That file is not a PickleMatch session export.");
    }
    let next;
    try { next = normalizeState(JSON.parse(JSON.stringify(raw))); }
    catch { return toast("This session file is damaged and could not be read."); }
    pendingImport = next;
    openImportPreview(next, parsed.exportedAt, file.name);
  };
  reader.onerror = () => toast("Could not read that file.");
  reader.readAsText(file);
});
function openImportPreview(next, exportedAt, fileName) {
  const active = next.players.filter(p => p.active !== false);
  const done = next.rounds.filter(r => r.status === "completed").length;
  const pend = next.rounds.filter(r => r.status === "pending").length;
  const when = exportedAt && !isNaN(new Date(exportedAt)) ? new Date(exportedAt).toLocaleString() : "Unknown date (older export)";
  // Same order as the Leaderboard (score, then point difference, wins ...).
  const top = leaderboardOrder(active.filter(p => p.games > 0), pointDiffByPlayer(next.rounds)).slice(0, 3)
    .map((p, i) => `${["🥇", "🥈", "🥉"][i]} ${esc(p.name)}`).join("&nbsp; ");
  const curPlayers = activePlayers().length, curDone = state.rounds.filter(r => r.status === "completed").length;
  document.getElementById("importSummary").innerHTML = `
    <div class="import-file">📄 ${esc(fileName)}</div>
    <div class="import-grid">
      <div><span>Saved</span><b>${esc(when)}</b></div>
      <div><span>Players</span><b>${active.length}</b></div>
      <div><span>Matches played</span><b>${done}</b></div>
      <div><span>Active matches</span><b>${pend}</b></div>
      <div><span>Courts</span><b>${next.courtCount}</b></div>
      <div><span>Games per player</span><b>${next.gameLimit || "No limit"}</b></div>
      <div><span>Fixed partners</span><b>${(next.fixedPairs || []).length || "None"}</b></div>
      <div><span>Court levels</span><b>${next.courtRules && next.courtRules.enabled
        ? esc([1, 2].slice(0, next.courtCount).map(c => `C${c} ${bandRangeText(next.courtRules[c])}`).join(" · "))
        : "Off"}</b></div>
    </div>
    ${top ? `<div class="import-top">🏆 Top players: ${top}</div>` : ""}
    ${curPlayers || curDone ? `<div class="import-warn">⚠️ This replaces the current session (${curPlayers} player${curPlayers === 1 ? "" : "s"}, ${curDone} match${curDone === 1 ? "" : "es"}). Export it first if you want to keep it.</div>` : ""}`;
  document.getElementById("importBackupBtn").classList.toggle("hidden", !(curPlayers || curDone));
  closeAllModals();
  document.getElementById("importModal").classList.remove("hidden");
}
function closeImportModal() {
  document.getElementById("importModal").classList.add("hidden");
  pendingImport = null;
}
document.getElementById("closeImportModal").onclick = closeImportModal;
document.getElementById("importCancelBtn").onclick = closeImportModal;
document.getElementById("importBackupBtn").onclick = exportSession;
document.getElementById("importConfirmBtn").onclick = () => {
  if (!pendingImport) return closeImportModal();
  state = pendingImport;
  pendingImport = null;
  document.getElementById("importModal").classList.add("hidden");
  saveState();
  toast(`Session imported: ${activePlayers().length} players, ${state.rounds.filter(r => r.status === "completed").length} matches restored.`);
};

// ---- top menu: every item opens its section as a popup, like Add player ----
function closeAllModals() {
  closeModal();
  closeChangeModal();
  closeAddModal();
  document.querySelectorAll(".modal").forEach(m => m.classList.add("hidden"));
  document.querySelectorAll("#mainMenu .menu-btn").forEach(b => { b.classList.remove("active"); b.removeAttribute("aria-current"); });
}
function openMenuModal(id) {
  closeAllModals();
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("hidden");
  const btn = document.querySelector(`#mainMenu .menu-btn[data-modal="${id}"]`);
  if (btn) { btn.classList.add("active"); btn.setAttribute("aria-current", "true"); }
  const focusable = modal.querySelector("input, select, button:not(.modal-close)");
  if (focusable) setTimeout(() => focusable.focus(), 0);
}
(function initMenu() {
  const menu = document.getElementById("mainMenu");
  if (!menu) return;
  // Fade out the right-edge "more items" hint once the menu is scrolled to its end.
  const wrap = menu.closest(".menu-wrap");
  function updateFade() {
    if (!wrap) return;
    const atEnd = menu.scrollWidth - menu.clientWidth <= menu.scrollLeft + 2;
    wrap.classList.toggle("at-end", atEnd || menu.scrollWidth <= menu.clientWidth);
  }
  menu.addEventListener("scroll", updateFade, { passive: true });
  window.addEventListener("resize", updateFade);
  updateFade();
  menu.querySelectorAll(".menu-btn[data-modal]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.modal;
      if (id === "modalAddPlayer") { closeAllModals(); openAddModal(); btn.classList.add("active"); btn.setAttribute("aria-current", "true"); return; }
      openMenuModal(id);
    });
  });
  // Generic close: the "×" button and clicking the dark overlay, for every
  // section modal that doesn't already have its own specific close handler.
  document.querySelectorAll(".modal-close").forEach(btn => {
    if (btn.id) return; // closeModal / closeChangeModal / closeAddModal already bound to these
    btn.addEventListener("click", closeAllModals);
  });
  document.querySelectorAll(".modal").forEach(m => {
    m.addEventListener("click", e => { if (e.target === m) closeAllModals(); });
  });
})();

render();
