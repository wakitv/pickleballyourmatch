/*
  sheets.js — save a session to a Google Sheet.

  The organiser deploys the Apps Script in sheets/Code.gs as a Web App and
  pastes its URL and secret phrase into Match settings. Pressing Save sends
  the session's standings there, which appends a row per player and one for
  the session itself.

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
    save: el("sheetSaveBtn"), test: el("sheetTestBtn"), forget: el("sheetForgetBtn"),
    status: el("sheetStatus"), quick: el("sheetQuickBtn")
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
    const ready = configured();
    ui.save.disabled = !ready;
    ui.test.disabled = !ready;
    ui.forget.disabled = !cfg.url && !cfg.token;
    if (ui.quick) ui.quick.classList.toggle("hidden", !ready);
    if (!ui.status.textContent || ui.status.dataset.idle === "1") {
      ui.status.dataset.idle = "1";
      if (!cfg.url) say("Not connected. Paste your Web App URL and secret phrase to save sessions to a sheet.");
      else if (!looksLikeUrl()) say("That does not look like a URL.", "warn");
      else if (!cfg.token) say("Add the secret phrase you set in the script.", "warn");
      else if (!isAppsScript()) say("Ready, though that is not a script.google.com address — check it is the Web App URL.", "warn");
      else say(cfg.lastSaved ? `Connected. Last saved ${cfg.lastSaved}.` : "Connected. Nothing saved from this browser yet.", "ok");
    }
  }

  /* ---------- what gets sent ---------- */
  function payload(extra) {
    const summary = buildSessionSummary();
    const names = activePlayers().map(p => p.name);
    const standings = summary.standings || [];
    return Object.assign({
      token: cfg.token,
      app: "PickleMatch",
      savedAt: new Date().toISOString(),
      session: BadgeCore.sessionId(state.rounds, names),
      date: new Date().toISOString().slice(0, 10),
      playerCount: summary.players,
      matchesPlayed: summary.matchesPlayed,
      courts: summary.courts,
      gamesPerPlayer: summary.gamesPerPlayer,
      top: standings.filter(p => p.rank && p.rank <= 3),
      players: standings
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

  async function saveSession(silent) {
    if (!configured()) return;
    const completed = state.rounds.filter(r => r.status === "completed").length;
    if (!completed) {
      say("Nothing to save yet — finish at least one match first.", "warn");
      ui.status.dataset.idle = "";
      return;
    }
    say("Saving…");
    ui.status.dataset.idle = "";
    try {
      const out = await post(payload());
      if (!out.ok) return say(out.error || "The script refused the save.", "bad");
      cfg.lastSaved = new Date().toLocaleString();
      store();
      const replaced = out.replacedRows ? ` (replacing ${out.replacedRows} earlier row${out.replacedRows === 1 ? "" : "s"})` : "";
      say(`Saved session ${out.session}: ${out.playersSaved} player rows${replaced}.`, "ok");
      if (!silent) toast(`Session saved to "${out.sheet}".`);
    } catch (err) {
      say(failure(err), "bad");
      if (!silent) toast("Could not save to the spreadsheet. See Match settings for what went wrong.");
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
  ui.save.addEventListener("click", () => saveSession(false));
  ui.forget.addEventListener("click", () => {
    if (!confirm("Forget the spreadsheet URL and secret phrase on this device?")) return;
    cfg = { url: "", token: "", lastSaved: "" };
    store(); ui.status.dataset.idle = "1"; render();
    toast("Spreadsheet connection forgotten on this device.");
  });
  if (ui.quick) ui.quick.addEventListener("click", () => saveSession(false));

  render();
})();
