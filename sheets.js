/*
  sheets.js — save a session to a Google Sheet.

  The organiser deploys the Apps Script in sheets/Code.gs as a Web App and
  pastes its URL and secret phrase into Match settings. A session is written
  once, when it ends: pressing Reset is the only thing that saves. It sends
  the finished session and only then clears it, so there is one row per
  session with its final figures and no session is ever written twice.

  Because Reset is what saves, it will not clear a session the save could not
  deliver -- losing a session to a typo in the URL would be unrecoverable.

  What goes up is the standings and the Top 3 badges together, so the public
  Top List has everything it needs from the sheet alone.

  This is the only place a session is kept outside the browser -- there is no
  file export any more. It is a record, not a restore point: nothing reads the
  sheet back into the app.

  Two things worth knowing about how this talks to Apps Script:

  - The request is sent as text/plain. A JSON content type would make the
    browser send a CORS preflight first, which Apps Script does not answer,
    and the save would fail before it left the browser. The script reads the
    body with JSON.parse either way.

  - The URL and phrase live in this browser's storage only. They are never
    committed and never leave this device except to Google. Anyone holding
    both can append to the sheet, so treat the pair like a password.
*/
(function () {
  const KEY = "picklematch_sheet";
  const el = id => document.getElementById(id);
  const ui = {
    url: el("sheetUrl"), token: el("sheetToken"),
    test: el("sheetTestBtn"), forget: el("sheetForgetBtn"),
    status: el("sheetStatus")
  };
  if (!ui.url) return;

  let cfg = load();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && typeof raw === "object") {
        return { url: String(raw.url || ""), token: String(raw.token || ""), lastSaved: raw.lastSaved || "" };
      }
    } catch { /* ignore */ }
    return { url: "", token: "", lastSaved: "" };
  }
  function store() {
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* storage full or blocked */ }
  }

  function say(text, kind) {
    ui.status.className = "sheet-status" + (kind ? " " + kind : "");
    ui.status.textContent = text;
  }
  const looksLikeUrl = () => /^https?:\/\/.+/.test(cfg.url);
  const isAppsScript = () => /^https:\/\/script\.google\.com\//.test(cfg.url);
  const configured = () => looksLikeUrl() && cfg.token.length > 0;

  function render() {
    ui.url.value = cfg.url;
    ui.token.value = cfg.token;
    ui.test.disabled = !configured();
    ui.forget.disabled = !cfg.url && !cfg.token;
    if (!ui.status.textContent || ui.status.dataset.idle === "1") {
      ui.status.dataset.idle = "1";
      if (!cfg.url) say("Not connected. Paste your Web App URL and secret phrase to save sessions to a sheet.");
      else if (!looksLikeUrl()) say("That does not look like a URL.", "warn");
      else if (!cfg.token) say("Add the secret phrase you set in the script.", "warn");
      else if (!isAppsScript()) say("Ready, though that is not a script.google.com address — check it is the Web App URL.", "warn");
      else if (state.savedToSheet === state.sessionId) say("This session has been saved. Press Reset to start the next one.", "ok");
      else say(cfg.lastSaved
        ? `Connected — this session saves when you press Reset. Last saved ${cfg.lastSaved}.`
        : "Connected — this session will be saved when you press Reset.", "ok");
    }
  }

  /* ---------- what gets sent ---------- */
  // The Top 3 badges travel with the session. They are minted here, not in
  // the sheet, because only the app has the module that makes a badge code --
  // the script just keeps the rows.
  function badgeRows() {
    try {
      return window.PickleBadges ? window.PickleBadges.records() : [];
    } catch { return []; }         // a badge failing to mint must not lose the session
  }

  function payload(extra) {
    const summary = buildSessionSummary();
    const standings = summary.standings || [];
    return Object.assign({
      token: cfg.token,
      app: "PickleMatch",
      savedAt: new Date().toISOString(),
      session: state.sessionId,
      date: String(state.startedAt || new Date().toISOString()).slice(0, 10),
      startedAt: state.startedAt || new Date().toISOString(),
      playerCount: summary.players,
      matchesPlayed: summary.matchesPlayed,
      courts: summary.courts,
      gamesPerPlayer: summary.gamesPerPlayer,
      top: standings.filter(p => p.rank && p.rank <= 3),
      players: standings,
      badges: badgeRows()
    }, extra || {});
  }

  // text/plain keeps this a "simple" request, so no CORS preflight is sent.
  async function post(body) {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      redirect: "follow"
    });
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { throw new Error(`The script replied with something other than JSON (HTTP ${res.status}).`); }
  }

  async function testConnection() {
    say("Checking…");
    ui.status.dataset.idle = "";
    try {
      const out = await post({ token: cfg.token, ping: true });
      if (out.ok) say(`Connected to "${out.sheet}".`, "ok");
      else say(out.error || "The script refused the request.", "bad");
    } catch (err) {
      say(failure(err), "bad");
    }
  }

  // fetch gives almost nothing away on a network failure, so spell out the
  // handful of things that actually cause it.
  function failure(err) {
    const msg = String(err && err.message ? err.message : err);
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
      return "Could not reach the script. Check the URL, and that the deployment is set to "
        + '"Execute as: Me" and "Who has access: Anyone".';
    }
    return msg;
  }

  /* ---------- saving at the end of a session ---------- */
  // Reset calls this before it clears anything. Returns true when it is safe
  // to go ahead: either the session was saved, or there was nothing to save,
  // or the organiser chose to drop it anyway.
  async function saveBeforeReset() {
    if (!configured()) return true;                       // no sheet connected
    if (!state.rounds.some(r => r.status === "completed")) return true;
    if (state.savedToSheet === state.sessionId) return true;   // already written

    say("Saving this session before it is cleared…");
    ui.status.dataset.idle = "";
    try {
      const out = await post(payload());
      if (out.ok) {
        state.savedToSheet = state.sessionId;
        cfg.lastSaved = new Date().toLocaleString();
        store();
        const badges = out.badgesSaved
          ? ` and ${out.badgesSaved} badge${out.badgesSaved === 1 ? "" : "s"} as batch #${out.batch}`
          : "";
        say(`Session ${out.session} saved with ${out.playersSaved} players${badges}.`, "ok");
        toast(`Session saved to "${out.sheet}"${out.batch ? ` as batch #${out.batch}` : ""}.`);
        return true;
      }
      return dropAnyway(out.error || "The script refused the save.");
    } catch (err) {
      return dropAnyway(failure(err));
    }
  }

  // A failed save must not take the session with it, so this asks first.
  function dropAnyway(reason) {
    say(reason, "bad");
    ui.status.dataset.idle = "";
    return confirm("This session could not be saved to the spreadsheet.\n\n" + reason
      + "\n\nReset anyway and lose it? Choose Cancel to keep playing and try again.");
  }

  /* ---------- wiring ---------- */
  ui.url.addEventListener("change", () => {
    cfg.url = ui.url.value.trim();
    store(); ui.status.dataset.idle = "1"; render();
  });
  ui.token.addEventListener("change", () => {
    cfg.token = ui.token.value.trim();
    store(); ui.status.dataset.idle = "1"; render();
  });
  ui.test.addEventListener("click", testConnection);
  ui.forget.addEventListener("click", () => {
    if (!confirm("Forget the spreadsheet URL and secret phrase on this device?")) return;
    cfg = { url: "", token: "", lastSaved: "" };
    store(); ui.status.dataset.idle = "1"; render();
    toast("Spreadsheet connection forgotten on this device.");
  });

  window.PickleSheet = { saveBeforeReset };
  window.sheetLinked = configured;
  render();
})();
