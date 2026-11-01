/*
  verify.js — the page a scanned badge lands on.

  One badge, one verdict. The Top List answers "who won"; this answers "is
  this particular badge real", which is the question someone holding a phone
  in front of a badge is actually asking.

  Two checks, in order, because they fail for different reasons:

    1. The badge against itself. Its QR carries a checksum over the result
       printed on it, so an edited badge is caught before anything is read
       from the spreadsheet.

    2. The badge against the spreadsheet. Intact is not the same as official:
       anyone can mint a badge in their own browser. It counts only if the
       organiser's sheet holds the same row -- and the row's own fingerprint
       is recomputed here rather than believed, so an edit made in the sheet
       after the fact fails too.
*/
(function () {
  const esc = v => String(v).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MEDAL = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
  const WORD = ["CHAMPION", "RUNNER-UP", "THIRD PLACE"];
  const box = document.getElementById("verdict");

  const payload = () => {
    const m = /[#&]b=([A-Za-z0-9_-]+)/.exec(location.hash || "");
    return m ? m[1] : "";
  };

  function show(kind, head, inner) {
    box.className = "certificate " + kind;
    box.innerHTML = `<div class="cert-head">${head}</div>${inner}`;
  }

  // The certificate proper: what a player wants to photograph.
  function card(info, batch) {
    return `
      <div class="cert-card">
        <div class="cert-seal">${MEDAL[info.rank - 1] || "\u{1F3C5}"}</div>
        <div class="cert-rank">TOP ${info.rank}</div>
        <div class="cert-word">${esc(WORD[info.rank - 1] || "")}</div>
        <div class="cert-name">${esc(info.name)}</div>
        <div class="cert-record">
          <span>WINS / LOSSES</span>
          <b>${info.wins} - ${info.losses}</b>
        </div>
        <dl class="cert-meta">
          <div><dt>Batch</dt><dd>${batch ? "#" + batch : "—"}</dd></div>
          <div><dt>Session</dt><dd>${esc(info.session)}</dd></div>
          <div><dt>Date</dt><dd>${esc(info.day)}</dd></div>
          <div><dt>Badge code</dt><dd>${esc(info.code)}</dd></div>
        </dl>
      </div>`;
  }

  function note(text, link) {
    return `<p class="cert-note">${text}${link ? ` <a href="${link}">${link.startsWith("#")
      ? "See the batch on the Top List." : "Open the Top List."}</a>` : ""}</p>`;
  }

  async function run() {
    const raw = payload();
    if (!raw) {
      return show("bad", "✕ Nothing to check",
        note("This page checks a badge, and no badge came with the link. Scan the QR on a "
          + "badge, or on a row of the Top List.", "index.html"));
    }

    let info = null;
    try { info = BadgeCore.parse(BadgeCore.b64uDec(raw)); } catch { info = null; }

    if (!info) {
      return show("bad", "✕ Not a BuenasxPickle badge",
        note("This link does not carry badge details this page can read."));
    }
    if (!info.ok) {
      return show("bad", "✕ This badge has been altered",
        card(info, null)
        + note("The result printed on the badge does not match the checksum inside its own QR "
          + "code, so something on it has been changed since it was made."));
    }

    // Intact. Now the only question that matters: is it in the sheet?
    const data = await window.TopListFeed.load();
    const listed = data.entries.find(e => e.id === BadgeCore.entryId(info));

    if (data.noSource || data.error) {
      return show("warn", "⚠ Badge is intact, record unavailable",
        card(info, null)
        + note(data.noSource
          ? "The badge's own checksum passes, but no spreadsheet is connected to this page, so "
            + "it cannot be confirmed as official."
          : "The badge's own checksum passes, but the spreadsheet could not be reached ("
            + esc(data.error) + "), so it cannot be confirmed as official right now."));
    }
    if (!listed) {
      return show("warn", "⚠ Genuine badge, not on the record",
        card(info, null)
        + note("The badge's own checksum passes, so nothing on it has been edited. It is not in "
          + "the organiser's spreadsheet though, which usually means the session has not been "
          + "saved yet — pressing Reset in BuenasxPickle is what saves it.", "index.html"));
    }

    // A row whose own fingerprint fails is the spreadsheet's problem, not the
    // badge holder's, so say that before comparing the two -- otherwise an
    // edit made in the sheet reads as though the badge were the forgery.
    if (listed.intact === false) {
      return show("warn", "⚠ The record itself has been edited",
        card(info, listed.batch)
        + note("This badge's own checksum passes, but the spreadsheet row recording it no longer "
          + "matches its own fingerprint, so the sheet has been edited by hand since the session "
          + "was saved. Ask the organiser.", "index.html"));
    }

    const same = listed.name === info.name && Number(listed.rank) === info.rank
      && Number(listed.wins) === info.wins && Number(listed.losses) === info.losses;
    if (!same) {
      return show("bad", "✕ Does not match the record",
        card(info, listed.batch)
        + note("A badge with this code is in the spreadsheet, but the details recorded there "
          + "differ from the ones on this badge.", "index.html"));
    }

    show("good", "✓ Certified",
      card(info, listed.batch)
      + note(`This badge is genuine and is recorded in the organiser's spreadsheet as `
        + `<b>Top ${info.rank}</b> of Batch Winners #${listed.batch}`
        + (data.sheet ? ` in "${esc(data.sheet)}"` : "") + ".",
        "index.html#batch-" + listed.batch));
  }

  window.addEventListener("hashchange", run);
  run();
})();
