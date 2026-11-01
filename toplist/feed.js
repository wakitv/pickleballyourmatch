/*
  feed.js — reading the winners out of the spreadsheet.

  Shared by the Top List and the certificate page, because both ask the same
  question of the same Apps Script Web App and must agree exactly on the
  answer. A badge that the list calls official has to be the same badge the
  certificate certifies.

  The spreadsheet is the whole record. There is no committed winners file: the
  script's Badges tab holds every minted badge with its code, its batch number
  and a fingerprint of its own payload, and that fingerprint is recomputed
  here rather than believed.
*/
(function () {
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

  async function load() {
    const url = sheetUrl();
    if (!url) return { entries: [], noSource: true };
    try {
      const res = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(),
        { cache: "no-store", redirect: "follow" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "the script reported a problem");
      return {
        entries: entriesFrom(json.sessions || [], json.badges || []),
        updated: (json.updated || "").slice(0, 10), live: true, sheet: json.sheet
      };
    } catch (err) {
      return { entries: [], error: String(err.message || err) };
    }
  }

  // Groups entries into numbered batches, highest first. A sheet written
  // before batch numbers existed still groups sensibly: its sessions are
  // numbered by date, oldest first.
  function groupIntoBatches(entries) {
    const needsNumbers = entries.some(e => !Number(e.batch));
    const fallback = new Map();
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

  // Recomputed rather than trusted, so a doctored row shows up.
  const fingerprintOf = entries =>
    sha256(entries.map(e => sha256(BadgeCore.canonical(e))).join("\n")).slice(0, 32);

  // A colour per batch, taken from its session id so it never moves between
  // reloads, and spread far enough apart to be told apart at a glance.
  function batchHue(group) {
    const key = String(group.session || group.batch);
    let sum = 0;
    for (let i = 0; i < key.length; i++) sum = (sum * 31 + key.charCodeAt(i)) % 100000;
    return (sum * 47) % 360;
  }

  // Where a QR for this entry should send a phone: the certificate page,
  // carrying the badge's own payload. Relative, so it works at any address
  // the page is served from.
  const certLink = e => "verify.html#b=" + BadgeCore.b64uEnc(BadgeCore.rebuild(e));

  window.TopListFeed = {
    sheetUrl, load, entriesFrom, groupIntoBatches, fingerprintOf, batchHue, certLink
  };
})();
