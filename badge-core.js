/*
  badge-core.js — the badge payload format, shared by the app and /toplist/.

  Both the page that mints badges and the page that checks them need to agree
  exactly on how a badge is encoded, so that lives here rather than in two
  places that could drift apart.

  On the trust model: this runs in the browser, so the check code below is a
  checksum, not a signature. It proves a badge has not been edited since it
  was made; it cannot prove who made it, because any key shipped to a browser
  is public. The published winners list is what makes a badge official --
  changing that file means pushing a commit, which is a real boundary.
*/
(function () {
  const PREFIX = "PM3";

  function hash32(str) {                 // FNV-1a
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }
  const checkOf = body => hash32(body).toString(36).toUpperCase().padStart(7, "0").slice(-6);
  const codeLabel = (rank, check) => `T${rank}-${check}`;

  const b64uEnc = s => btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64uDec = s => decodeURIComponent(escape(
    atob(String(s).replace(/-/g, "+").replace(/_/g, "/"))));

  const shortDay = iso => iso.slice(2).replace(/-/g, "");            // 2026-10-23 -> 261023
  const longDay = s6 => /^\d{6}$/.test(s6)
    ? `20${s6.slice(0, 2)}-${s6.slice(2, 4)}-${s6.slice(4)}` : s6;

  // body = PM3|rank|name|wins|losses|yymmdd|session ; signed = body|check
  function body(e, day, sid) {
    return [PREFIX, e.rank, e.name, e.wins, e.losses, shortDay(day), sid].join("|");
  }
  function sign(e, day, sid) {
    const b = body(e, day, sid);
    return { signed: `${b}|${checkOf(b)}`, check: checkOf(b), code: codeLabel(e.rank, checkOf(b)) };
  }
  function parse(text) {
    const parts = String(text).split("|");
    if (parts.length !== 8 || parts[0] !== PREFIX) return null;
    const check = parts.pop();
    const [, rank, name, wins, losses, day6, sid] = parts;
    return {
      ok: checkOf(parts.join("|")) === check,
      rank: Number(rank), name, wins: Number(wins), losses: Number(losses),
      day: longDay(day6), session: sid, check, code: codeLabel(Number(rank), check)
    };
  }

  // One badge, one id. The check already folds in name, rank, date and
  // session, so prefixing the session keeps ids readable and unique.
  const entryId = info => `${info.session}-${info.code}`;
  // The exact string an entry's hash is taken over. Order matters; keep it.
  const canonical = e => [e.id, e.rank, e.name, e.wins, e.losses, e.day, e.session, e.code].join("|");

  window.BadgeCore = {
    PREFIX, checkOf, codeLabel, b64uEnc, b64uDec,
    shortDay, longDay, body, sign, parse, entryId, canonical
  };
})();
