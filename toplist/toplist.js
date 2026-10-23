/*
  toplist.js — the public winners page.

  Reads toplist.json (the published record), renders it, and — when a badge
  QR sent you here — checks that badge against it.
*/
(function () {
  const esc = v => String(v).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MEDAL = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
  const WORD = ["CHAMPION", "RUNNER-UP", "THIRD PLACE"];

  let data = { entries: [] };

  /* ---------- the published record ---------- */
  async function loadList() {
    // Browsers refuse to fetch a local file from a local page, so opening this
    // straight from disk can never read the list. Say so rather than showing a
    // bare CORS error.
    if (location.protocol === "file:") {
      data = { entries: [], fromFile: true };
      return data;
    }
    try {
      const res = await fetch("toplist.json?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      data = json && Array.isArray(json.entries) ? json : { entries: [] };
    } catch (err) {
      data = { entries: [], error: String(err.message || err) };
    }
    return data;
  }

  // Recomputed here rather than trusted, so a doctored file shows up.
  function fingerprintOf(entries) {
    return sha256(entries.map(e => sha256(BadgeCore.canonical(e))).join("\n")).slice(0, 32);
  }

  function renderList() {
    const body = document.getElementById("listBody");
    const summary = document.getElementById("listSummary");
    const fp = document.getElementById("fingerprint");

    if (data.fromFile) {
      body.className = "toplist-body empty";
      body.innerHTML = "This page was opened straight from a file, and a browser will not let a "
        + "local page read a local file, so the winners list cannot be shown here.<br><br>"
        + "Run <code>serve.bat</code> and open the address it prints, or publish to GitHub Pages.";
      summary.textContent = "List unavailable from a file";
      fp.textContent = "—";
      return;
    }
    if (data.error) {
      body.className = "toplist-body empty";
      body.textContent = "The winners list could not be loaded (" + data.error + ").";
      summary.textContent = "List unavailable";
      fp.textContent = "—";
      return;
    }
    if (!data.entries.length) {
      body.className = "toplist-body empty";
      body.textContent = "No winners published yet. Finish a session in PickleMatch, open Top 3 Badges and press Publish winners.";
      summary.textContent = "Nothing published yet";
      fp.textContent = "—";
      return;
    }

    const computed = fingerprintOf(data.entries);
    fp.textContent = computed;
    if (data.fingerprint && data.fingerprint !== computed) {
      fp.insertAdjacentHTML("afterend",
        ' <b class="fp-mismatch">does not match the fingerprint stored in the file</b>');
    }

    // Newest sessions first, and the podium in order inside each.
    const bySession = new Map();
    data.entries.forEach(e => {
      const key = `${e.day}|${e.session}`;
      if (!bySession.has(key)) bySession.set(key, []);
      bySession.get(key).push(e);
    });
    const groups = [...bySession.entries()].sort((a, b) => b[0].localeCompare(a[0]));

    summary.textContent = `${data.entries.length} winner${data.entries.length === 1 ? "" : "s"} across `
      + `${groups.length} session${groups.length === 1 ? "" : "s"}`
      + (data.updated ? ` · updated ${esc(data.updated)}` : "");

    body.className = "toplist-body";
    body.innerHTML = groups.map(([key, rows]) => {
      const [day, session] = key.split("|");
      return `
        <div class="toplist-session">
          <div class="toplist-session-head"><b>${esc(day)}</b><span>session ${esc(session)}</span></div>
          ${rows.sort((a, b) => a.rank - b.rank).map(e => `
            <div class="toplist-row" id="row-${esc(e.id)}">
              <span class="toplist-medal">${MEDAL[e.rank - 1] || ""}</span>
              <div class="toplist-who">
                <b>${esc(e.name)}</b>
                <em>${esc(WORD[e.rank - 1] || "TOP " + e.rank)} · ${e.wins}W / ${e.losses}L</em>
              </div>
              <code class="toplist-code">${esc(e.code)}</code>
            </div>`).join("")}
        </div>`;
    }).join("");
  }

  /* ---------- a scanned badge ---------- */
  function showScan() {
    const m = /[#&]b=([A-Za-z0-9_-]+)/.exec(location.hash || "");
    const box = document.getElementById("scanResult");
    if (!m) return;

    let info = null;
    try { info = BadgeCore.parse(BadgeCore.b64uDec(m[1])); } catch { info = null; }

    box.classList.remove("hidden");
    if (!info) {
      box.className = "scan-result bad";
      box.innerHTML = `<div class="scan-head">✕ Not a PickleMatch badge</div>
        <p>This link does not carry badge details we can read.</p>`;
      return;
    }
    if (!info.ok) {
      box.className = "scan-result bad";
      box.innerHTML = `<div class="scan-head">✕ This badge has been altered</div>
        <p>The result printed on the badge does not match the checksum inside its QR code,
        so it has been changed since it was made.</p>`;
      return;
    }

    const id = BadgeCore.entryId(info);
    const listed = data.entries.find(e => e.id === id);
    const card = `
      <div class="scan-card">
        <div class="scan-rank">${MEDAL[info.rank - 1] || ""} TOP ${info.rank} · ${esc(WORD[info.rank - 1] || "")}</div>
        <div class="scan-name">${esc(info.name)}</div>
        <div class="scan-stats">Wins / Losses <b>${info.wins} - ${info.losses}</b></div>
        <div class="scan-meta">${esc(info.day)} · session ${esc(info.session)} · ${esc(info.code)}</div>
      </div>`;

    if (!listed) {
      box.className = "scan-result warn";
      const why = data.fromFile || data.error
        ? "The badge itself is intact, but the winners list could not be read here, so it cannot be "
          + "checked against the published record."
        : "The badge itself is intact, but this result has not been published to the winners "
          + "list below, so it cannot be confirmed as official yet.";
      box.innerHTML = `<div class="scan-head">⚠ ${data.fromFile || data.error
        ? "Badge is intact, list unavailable" : "Genuine badge, not on the published list"}</div>${card}
        <p>${why}</p>`;
      return;
    }
    const matches = listed.name === info.name && Number(listed.rank) === info.rank
      && Number(listed.wins) === info.wins && Number(listed.losses) === info.losses;
    if (!matches) {
      box.className = "scan-result bad";
      box.innerHTML = `<div class="scan-head">✕ Does not match the published record</div>${card}
        <p>A badge with this code is on the list, but its details differ from the ones above.</p>`;
      return;
    }
    const hashOk = !listed.hash || listed.hash === sha256(BadgeCore.canonical(listed));
    box.className = "scan-result good";
    box.innerHTML = `<div class="scan-head">✓ Official — on the published winners list</div>${card}
      <p>This badge matches the published record${hashOk ? "" : ", though that record's own fingerprint does not match"}.
      <a href="#row-${esc(id)}">See it in the list below.</a></p>`;
    const row = document.getElementById("row-" + id);
    if (row) row.classList.add("highlight");
  }

  async function boot() {
    await loadList();
    renderList();
    showScan();
  }
  window.addEventListener("hashchange", () => { renderList(); showScan(); });
  boot();
})();
