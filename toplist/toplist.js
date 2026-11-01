/*
  toplist.js — the public winners page.

  Reads the spreadsheet through the Apps Script Web App in source.js, renders
  it, and — when a badge QR sent you here — checks that badge against it.

  The spreadsheet is the whole record. There is no committed winners file any
  more: the script's Badges tab holds every minted badge with its code, its
  batch number and a fingerprint of its own payload, and this page recomputes
  that fingerprint rather than believing it.
*/
(function () {
  const esc = v => String(v).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MEDAL = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
  const WORD = ["CHAMPION", "RUNNER-UP", "THIRD PLACE"];

  let data = { entries: [] };

  /* ---------- the record, straight from the spreadsheet ---------- */
  const sheetUrl = () => (window.TOPLIST_SOURCE && window.TOPLIST_SOURCE.url || "").trim();

  // The Badges tab is authoritative for anyone on the podium: it holds the
  // code the badge was minted with and the batch the script gave it. The
  // Players tab fills in everyone else, and the games and score a badge does
  // not carry.
  function entriesFrom(sessions, badges) {
    const badgeAt = new Map();
    badges.forEach(b => badgeAt.set(`${b.session}|${b.rank}`, b));

    const entries = [];
    sessions.forEach((s, i) => {
      // The script numbers batches; a sheet saved before it did falls back to
      // the order the sessions came back in, which is oldest first.
      const batch = Number(s.batch) || i + 1;
      (s.winners || []).forEach(w => {
        const rank = Number(w.rank);
        const badge = badgeAt.get(`${s.session}|${rank}`);
        const e = {
          batch, rank,
          name: String(badge ? badge.name : w.name),
          wins: Number(badge ? badge.wins : w.wins) || 0,
          losses: Number(badge ? badge.losses : w.losses) || 0,
          games: Number(w.games) || 0,
          score: w.score == null ? null : Number(w.score),
          day: String((badge && badge.day) || s.day || ""),
          session: String(s.session || "")
        };
        if (rank <= 3) {
          // A badge row carries its own code; without one the code is derived
          // the same way the app minted it, so an older sheet still matches.
          e.code = badge && badge.code ? badge.code : BadgeCore.sign(e, e.day, e.session).code;
          e.id = badge && badge.id ? badge.id : `${e.session}-${e.code}`;
          e.fingerprint = badge ? String(badge.fingerprint || "") : "";
          e.intact = !e.fingerprint || e.fingerprint === BadgeCore.fingerprint(e);
        } else {
          e.id = `${e.session}-R${rank}`;
          e.intact = true;
        }
        entries.push(e);
      });
    });
    return entries;
  }

  async function loadList() {
    const url = sheetUrl();
    if (!url) { data = { entries: [], noSource: true }; return data; }
    try {
      const res = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(),
        { cache: "no-store", redirect: "follow" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "the script reported a problem");
      data = {
        entries: entriesFrom(json.sessions || [], json.badges || []),
        updated: (json.updated || "").slice(0, 10), live: true, sheet: json.sheet
      };
    } catch (err) {
      data = { entries: [], error: String(err.message || err) };
    }
    return data;
  }

  // Recomputed here rather than trusted, so a doctored file shows up.
  function fingerprintOf(entries) {
    return sha256(entries.map(e => sha256(BadgeCore.canonical(e))).join("\n")).slice(0, 32);
  }

  // Groups entries into numbered batches, highest first. A file written before
  // batch numbers existed still groups sensibly: its sessions are numbered by
  // date, oldest first.
  function groupIntoBatches(entries) {
    const needsNumbers = entries.some(e => !Number(e.batch));
    let fallback = new Map();
    if (needsNumbers) {
      const sessions = [...new Set(entries.map(e => `${e.day}|${e.session}`))].sort();
      sessions.forEach((key, i) => fallback.set(key, i + 1));
    }
    const numberOf = e => Number(e.batch) || fallback.get(`${e.day}|${e.session}`) || 1;

    const byBatch = new Map();
    entries.forEach(e => {
      const n = numberOf(e);
      if (!byBatch.has(n)) byBatch.set(n, { batch: n, day: e.day, session: e.session, rows: [] });
      byBatch.get(n).rows.push(e);
    });
    return [...byBatch.values()]
      .map(g => ({ ...g, rows: g.rows.sort((a, b) => a.rank - b.rank) }))
      .sort((a, b) => b.batch - a.batch);
  }

  // A colour per batch, taken from its session id so it never moves between
  // reloads, and spread far enough apart to be told apart at a glance.
  function batchHue(group) {
    const key = String(group.session || group.batch);
    let sum = 0;
    for (let i = 0; i < key.length; i++) sum = (sum * 31 + key.charCodeAt(i)) % 100000;
    return (sum * 47) % 360;
  }

  function renderList() {
    const body = document.getElementById("listBody");
    const summary = document.getElementById("listSummary");
    const fp = document.getElementById("fingerprint");

    // The spreadsheet is the only source now, so there are just three ways
    // for this to come up empty: no URL, the script unreachable, or no
    // session saved yet.
    if (data.noSource) {
      body.className = "toplist-body empty";
      body.innerHTML = "No spreadsheet is connected yet, so there is nothing to show."
        + "<br><br>Open <code>toplist/source.js</code> and paste your Apps Script Web App URL "
        + "between the quotes, then reload.";
      summary.textContent = "No spreadsheet connected";
      fp.textContent = "—";
      return;
    }
    if (data.error) {
      body.className = "toplist-body empty";
      body.innerHTML = "The winners could not be read from the spreadsheet ("
        + esc(data.error) + ")."
        + "<br><br>Check that the URL in <code>toplist/source.js</code> ends in <code>/exec</code> "
        + "and that the deployment is set to <b>Anyone</b>."
        + (location.protocol === "file:"
          ? "<br><br>This page is also open straight from a file, which some browsers refuse to "
            + "let make requests at all. Run <code>serve.bat</code> and use the address it prints."
          : "");
      summary.textContent = "List unavailable";
      fp.textContent = "—";
      return;
    }
    if (!data.entries.length) {
      body.className = "toplist-body empty";
      body.textContent = "No winners yet. Finish a session in PickleMatch and press Reset — "
        + "that is what writes it to the spreadsheet, and it appears here straight away.";
      summary.textContent = "Nothing saved yet";
      fp.textContent = "—";
      return;
    }

    fp.textContent = fingerprintOf(data.entries);
    const altered = data.entries.filter(e => e.intact === false).length;
    if (altered) {
      fp.insertAdjacentHTML("afterend",
        ` <b class="fp-mismatch">— ${altered} badge row${altered === 1 ? "" : "s"} in the `
        + `spreadsheet no longer match${altered === 1 ? "es" : ""} the badge it records</b>`);
    }

    // One batch per published session, newest first, podium in order inside.
    const groups = groupIntoBatches(data.entries);

    const podium = data.entries.filter(e => e.rank <= 3).length;
    summary.textContent = `${podium} winner${podium === 1 ? "" : "s"} and `
      + `${data.entries.length - podium} other player${data.entries.length - podium === 1 ? "" : "s"} across `
      + `${groups.length} batch${groups.length === 1 ? "" : "es"}`
      + (data.live ? " · live from the spreadsheet" : "")
      + (data.updated ? ` · updated ${esc(data.updated)}` : "");

    body.className = "toplist-body";
    body.innerHTML = groups.map(g => `
        <div class="toplist-batch" id="batch-${g.batch}" style="--batch-hue:${batchHue(g)}">
          <div class="toplist-batch-head">
            <b>Batch Winners #${g.batch}</b>
            <span>${esc(g.day)} · session ${esc(g.session)}</span>
          </div>
          ${g.rows.map(e => {
            const podium = e.rank <= 3;
            const detail = [WORD[e.rank - 1], `${e.wins}W / ${e.losses}L`]
              .concat(e.games ? [`${e.games} games`] : [])
              .concat(e.score == null ? [] : [`score ${e.score}`])
              .filter(Boolean).join(" · ");
            return `
            <div class="toplist-row${podium ? "" : " plain"}" id="row-${esc(e.id)}">
              <span class="toplist-medal">${podium ? MEDAL[e.rank - 1] : ""}</span>
              <span class="toplist-place">${podium ? "TOP " + e.rank : "#" + e.rank}</span>
              <div class="toplist-who">
                <b>${esc(e.name)}</b>
                <em>${esc(detail)}</em>
              </div>
              ${podium ? `<code class="toplist-code">${esc(e.code)}</code>` : ""}
            </div>`;
          }).join("")}
        </div>`).join("");
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
      const unreadable = !!(data.error || data.noSource);
      const why = unreadable
        ? "The badge itself is intact, but the winners list could not be read here, so it cannot be "
          + "checked against the record."
        : "The badge itself is intact, but this session has not been saved to the spreadsheet yet, "
          + "so it cannot be confirmed as official. Pressing Reset in PickleMatch is what saves it.";
      box.innerHTML = `<div class="scan-head">⚠ ${unreadable
        ? "Badge is intact, list unavailable" : "Genuine badge, not on the list yet"}</div>${card}
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
    const hashOk = listed.intact !== false;
    const group = groupIntoBatches(data.entries).find(g => g.rows.some(r => r.id === id));
    const batchNo = group ? group.batch : null;
    box.className = "scan-result good";
    box.innerHTML = `<div class="scan-head">✓ Official — Batch Winners #${batchNo}</div>${card}
      <p>This badge matches the spreadsheet${hashOk ? "" : ", though that row's own fingerprint does not match, so it has been edited"}.
      <a href="#batch-${batchNo}">See batch #${batchNo} below.</a></p>`;
    const row = document.getElementById("row-" + id);
    if (row) row.classList.add("highlight");
    const batchEl = batchNo && document.getElementById("batch-" + batchNo);
    if (batchEl) batchEl.classList.add("batch-highlight");
  }

  async function boot() {
    await loadList();
    renderList();
    showScan();
  }
  window.addEventListener("hashchange", () => { renderList(); showScan(); });

  const refresh = document.getElementById("refreshBtn");
  if (refresh) {
    refresh.addEventListener("click", async () => {
      refresh.disabled = true;
      const was = refresh.textContent;
      refresh.textContent = "Checking…";
      await boot();
      refresh.textContent = was;
      refresh.disabled = false;
    });
  }
  // A list left open on a screen should keep up on its own, but only while it
  // is actually being looked at.
  setInterval(() => {
    if (sheetUrl() && !document.hidden) boot();
  }, 120000);

  boot();
})();
