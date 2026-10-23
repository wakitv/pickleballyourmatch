/*
  badges.js — Top 3 badges with a scannable QR
  --------------------------------------------
  Turns the top three of the leaderboard into gold crest images you can save
  and share. Each badge carries a QR code holding the result itself plus a
  check code, so scanning it opens PickleMatch and shows the badge details
  back with a pass/fail on that check.

  Honest about what the check is worth: everything runs in the browser, so the
  check code proves the badge has not been casually edited, not that it came
  from an official event. The verify screen says as much.
*/
(function () {
  const PREFIX = "PM3";                  // payload format marker
  const BG_SRC = "badge-bg.webp";
  const W = 680, H = 960;

  /* ---------- small helpers ---------- */
  function hash32(str) {                 // FNV-1a, a check digit not a signature
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }
  const checkOf = payload => hash32(payload).toString(36).toUpperCase().padStart(7, "0").slice(-6);
  const b64uEnc = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64uDec = s => decodeURIComponent(escape(atob(String(s).replace(/-/g, "+").replace(/_/g, "/"))));
  const clean = s => String(s == null ? "" : s).replace(/[|]/g, "/").trim();

  const RANKS = [
    { word: "CHAMPION",   gold: ["#fff4c2", "#f6d44a", "#b8860b"], medal: "\u{1F947}" },
    { word: "RUNNER-UP",  gold: ["#f4f7fa", "#c9d4de", "#8a97a3"], medal: "\u{1F948}" },
    { word: "THIRD PLACE", gold: ["#f8ddc0", "#d79a5b", "#95603088"], medal: "\u{1F949}" }
  ];

  /* ---------- session identity ---------- */
  // A short fingerprint of this session's finished results, so two different
  // sessions never mint the same badge.
  function sessionId() {
    const done = state.rounds.filter(r => r.status === "completed");
    const seed = done.map(r => `${r.id}:${r.scoreA}-${r.scoreB}`).join(",")
      + "#" + activePlayers().map(p => p.name).sort().join(",");
    return hash32(seed).toString(36).toUpperCase().slice(0, 5);
  }

  function topThree() {
    const diff = pointDiffByPlayer();
    return leaderboardOrder(activePlayers().filter(p => (Number(p.games) || 0) > 0), diff)
      .slice(0, 3)
      .map((p, i) => ({
        rank: i + 1,
        name: clean(p.name),
        wins: Number(p.wins) || 0,
        losses: Number(p.losses) || 0
      }));
  }

  const shortDay = iso => iso.slice(2).replace(/-/g, "");        // 2026-10-23 -> 261023
  const longDay = s6 => /^\d{6}$/.test(s6) ? `20${s6.slice(0,2)}-${s6.slice(2,4)}-${s6.slice(4)}` : s6;

  // The badge shows rank, name and W/L, so that is all the QR carries — which
  // also keeps the symbol a version or two smaller.
  function payloadFor(e, day, sid) {
    return [PREFIX, e.rank, e.name, e.wins, e.losses, shortDay(day), sid].join("|");
  }
  function parsePayload(text) {
    const parts = String(text).split("|");
    if (parts.length !== 8 || parts[0] !== PREFIX) return null;
    const check = parts.pop();
    const body = parts.join("|");
    const [, rank, name, wins, losses, day6, sid] = parts;
    return {
      ok: checkOf(body) === check,
      rank: Number(rank), name, wins: Number(wins), losses: Number(losses),
      day: longDay(day6), sid, check
    };
  }

  // What the QR actually carries. Over http(s) it is a link back into this app
  // so a phone can open the verify screen; from a file:// page there is no URL
  // worth sharing, so it carries readable text instead.
  function qrTextFor(signed, e, day) {
    if (location.protocol === "http:" || location.protocol === "https:") {
      return `${location.origin}${location.pathname}#badge=${b64uEnc(signed)}`;
    }
    return `PICKLEMATCH TOP ${e.rank} | ${e.name} | ${e.wins}W-${e.losses}L | ${day} | ${codeLabel(e.rank, checkOf(signed.slice(0, signed.lastIndexOf("|"))))}`;
  }
  const codeLabel = (rank, check) => `T${rank}-${check}`;

  /* ---------- background art ---------- */
  let bgImage = null, bgTried = false;
  function loadBackground() {
    if (bgTried) return Promise.resolve(bgImage);
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => { bgTried = true; bgImage = img; resolve(img); };
      img.onerror = () => { bgTried = true; resolve(null); };   // badge still works without it
      img.src = BG_SRC;
    });
  }

  /* ---------- drawing ---------- */
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function goldFill(g, y0, y1, stops) {
    const grad = g.createLinearGradient(0, y0, 0, y1);
    grad.addColorStop(0, stops[0]);
    grad.addColorStop(0.5, stops[1]);
    grad.addColorStop(1, stops[2]);
    return grad;
  }
  function crown(g, cx, y, w, fill) {
    const h = w * 0.62, half = w / 2;
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(cx - half, y + h);
    g.lineTo(cx - half, y + h * 0.25);
    g.lineTo(cx - half * 0.45, y + h * 0.72);
    g.lineTo(cx, y);
    g.lineTo(cx + half * 0.45, y + h * 0.72);
    g.lineTo(cx + half, y + h * 0.25);
    g.lineTo(cx + half, y + h);
    g.closePath();
    g.fill();
    [[cx - half, y + h * 0.25], [cx, y], [cx + half, y + h * 0.25]].forEach(([x, cy]) => {
      g.beginPath(); g.arc(x, cy, w * 0.07, 0, Math.PI * 2); g.fill();
    });
  }
  // Text over artwork needs a soft dark halo to stay readable.
  function withHalo(g, on) {
    g.shadowColor = on ? "rgba(0,0,0,.9)" : "transparent";
    g.shadowBlur = on ? 10 : 0;
  }

  function drawBadge(cv, e, qr, day, sid, code) {
    const g = cv.getContext("2d");
    const rank = RANKS[e.rank - 1];
    cv.width = W; cv.height = H;

    // Backdrop: the court art, then a scrim so the gold text still reads.
    g.fillStyle = "#07090c";
    g.fillRect(0, 0, W, H);
    if (bgImage) {
      const scale = Math.max(W / bgImage.width, H / bgImage.height);
      const dw = bgImage.width * scale, dh = bgImage.height * scale;
      g.save();
      g.globalAlpha = 0.85;
      g.drawImage(bgImage, (W - dw) / 2, (H - dh) / 2, dw, dh);
      g.restore();
      g.fillStyle = "rgba(7,9,12,.56)";
      g.fillRect(0, 0, W, H);
      // Extra cover at the top and bottom, where the text sits.
      const veil = g.createLinearGradient(0, 0, 0, H);
      veil.addColorStop(0, "rgba(7,9,12,.82)");
      veil.addColorStop(0.34, "rgba(7,9,12,.18)");
      veil.addColorStop(0.62, "rgba(7,9,12,.42)");
      veil.addColorStop(1, "rgba(7,9,12,.88)");
      g.fillStyle = veil;
      g.fillRect(0, 0, W, H);
    }
    const glow = g.createRadialGradient(W / 2, 285, 20, W / 2, 285, 470);
    glow.addColorStop(0, "rgba(246,212,74,.16)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);

    // Crest frame
    g.lineWidth = 6;
    g.strokeStyle = goldFill(g, 20, H - 20, rank.gold);
    roundRect(g, 20, 20, W - 40, H - 40, 38); g.stroke();
    g.lineWidth = 1.5;
    g.strokeStyle = "rgba(246,212,74,.35)";
    roundRect(g, 36, 36, W - 72, H - 72, 30); g.stroke();

    const gold = goldFill(g, 68, 340, rank.gold);
    withHalo(g, true);
    crown(g, W / 2, 64, 108, gold);

    g.textAlign = "center";
    g.fillStyle = gold;
    g.font = "800 104px 'Bricolage Grotesque', system-ui, sans-serif";
    g.fillText(`TOP ${e.rank}`, W / 2, 262);

    g.fillStyle = "#e9f6ee";
    g.font = "700 29px 'DM Sans', system-ui, sans-serif";
    g.fillText(rank.word, W / 2, 308);

    // Name, shrunk to fit rather than overflowing the crest.
    let size = 52;
    g.font = `800 ${size}px 'Bricolage Grotesque', system-ui, sans-serif`;
    while (g.measureText(e.name).width > W - 150 && size > 22) {
      size -= 2;
      g.font = `800 ${size}px 'Bricolage Grotesque', system-ui, sans-serif`;
    }
    g.fillStyle = "#ffffff";
    g.fillText(e.name, W / 2, 382);

    // Win-loss record, the one stat the badge carries.
    const bw = 280, bh = 92, bx = (W - bw) / 2, by = 408;
    g.fillStyle = "rgba(7,9,12,.72)";
    roundRect(g, bx, by, bw, bh, 16); g.fill();
    g.strokeStyle = "rgba(246,212,74,.3)"; g.lineWidth = 1.5;
    roundRect(g, bx, by, bw, bh, 16); g.stroke();
    g.fillStyle = "#9bb0a4";
    g.font = "700 15px 'DM Sans', system-ui, sans-serif";
    g.fillText("WINS / LOSSES", W / 2, by + 30);
    g.fillStyle = gold;
    g.font = "800 42px 'Bricolage Grotesque', system-ui, sans-serif";
    g.fillText(`${e.wins} - ${e.losses}`, W / 2, by + 74);

    // QR, on white with a quiet zone so it actually scans. The module size is
    // derived from a fixed target box, because the symbol's version — and so
    // its module count — changes with the length of the payload.
    withHalo(g, false);   // the QR must stay hard-edged
    const quiet = 4, target = 300;
    const qrPx = Math.max(3, Math.floor(target / (qr.size + quiet * 2)));
    const box = (qr.size + quiet * 2) * qrPx;
    const qx = Math.round((W - box) / 2), qy = 530;
    g.fillStyle = "#ffffff";
    roundRect(g, qx - 10, qy - 10, box + 20, box + 20, 12); g.fill();
    g.fillStyle = "#000000";
    for (let r = 0; r < qr.size; r++) for (let c = 0; c < qr.size; c++) {
      if (qr.modules[r][c]) g.fillRect(qx + (c + quiet) * qrPx, qy + (r + quiet) * qrPx, qrPx, qrPx);
    }

    const afterQr = qy + box + 28;
    withHalo(g, true);
    g.fillStyle = "#dfe9e3";
    g.font = "700 15px 'DM Sans', system-ui, sans-serif";
    g.fillText("SCAN TO VERIFY", W / 2, afterQr);
    g.fillStyle = gold;
    g.font = "800 29px ui-monospace, 'DM Sans', monospace";
    g.fillText(code, W / 2, afterQr + 38);

    g.fillStyle = "rgba(233,246,238,.8)";
    g.font = "600 16px 'DM Sans', system-ui, sans-serif";
    g.fillText(`PICKLEMATCH  ·  ${day}  ·  SESSION ${sid}`, W / 2, H - 40);
    withHalo(g, false);
  }

  /* ---------- modal ---------- */
  function badgeData() {
    const day = new Date().toISOString().slice(0, 10);
    const sid = sessionId();
    return topThree().map(e => {
      const body = payloadFor(e, day, sid);
      const signed = `${body}|${checkOf(body)}`;
      return { e, day, sid, signed, code: codeLabel(e.rank, checkOf(body)), qrText: qrTextFor(signed, e, day) };
    });
  }

  async function openBadges() {
    const list = document.getElementById("badgeList");
    const top = badgeData();
    closeAllModals();
    document.getElementById("modalBadges").classList.remove("hidden");

    if (!top.length) {
      list.className = "badge-list empty";
      list.textContent = "No finished matches yet. Play at least one match and the top 3 badges appear here.";
      return;
    }
    list.className = "badge-list";
    list.innerHTML = top.map((b, i) => `
      <figure class="badge-item">
        <canvas id="badgeCv${i}" width="${W}" height="${H}" role="img"
          aria-label="Top ${b.e.rank} badge for ${esc(b.e.name)}"></canvas>
        <figcaption>
          <b>${esc(b.e.name)}</b>
          <span>${b.code}</span>
          <button type="button" class="btn btn-ghost badge-save" data-badge="${i}">Save PNG</button>
        </figcaption>
      </figure>`).join("");

    showHint();
    await loadBackground();
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch { /* ignore */ } }
    top.forEach((b, i) => {
      const cv = document.getElementById("badgeCv" + i);
      if (!cv) return;
      drawBadge(cv, b.e, QR.encode(b.qrText, "M"), b.day, b.sid, b.code);
    });

    // A locked canvas means Save PNG cannot work; say so before it is clicked.
    const probe = document.getElementById("badgeCv0");
    if (probe) {
      try { probe.getContext("2d").getImageData(0, 0, 1, 1); }
      catch {
        const el = document.getElementById("badgeHint");
        if (el) {
          el.className = "badge-hint warn";
          el.textContent = "The badge artwork cannot be read back when the page is opened straight from a file, "
            + "so Save PNG will not work here. Run serve.bat, or open the GitHub Pages link.";
        }
      }
    }

    list.querySelectorAll("[data-badge]").forEach(btn => {
      btn.addEventListener("click", () => {
        const b = top[Number(btn.dataset.badge)];
        const cv = document.getElementById("badgeCv" + btn.dataset.badge);
        if (!cv || !cv.toBlob) return;
        try {
          cv.toBlob(blob => {
            if (!blob) return toast("The badge image could not be created.");
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `picklematch-top${b.e.rank}-${b.e.name.replace(/[^\w]+/g, "-").toLowerCase()}.png`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            toast(`Top ${b.e.rank} badge saved.`);
          }, "image/png");
        } catch {
          toast("Saving is blocked when the page is opened as a file. Run serve.bat, or use the GitHub Pages link.");
        }
      });
    });
  }

  // Says where a scanned badge will actually land, because a QR made at
  // localhost or from a file cannot open on anyone else's phone.
  function showHint() {
    const el = document.getElementById("badgeHint");
    if (!el) return;
    const host = location.hostname;
    const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    if (location.protocol === "file:") {
      el.className = "badge-hint warn";
      el.textContent = "Opened straight from the file, so the QR holds the result as plain text — "
        + "readable when scanned, but there is no verify screen to open. Run serve.bat and use the "
        + "address it prints to make badges with a scannable link.";
    } else if (local) {
      el.className = "badge-hint warn";
      el.textContent = `The QR points at ${location.origin}, which only resolves on this computer — `
        + "a phone scanning it will get nothing. Run serve.bat and open the phone address it prints, "
        + "then make the badges again.";
    } else {
      el.className = "badge-hint";
      el.textContent = `The QR opens ${location.origin} — scan it with any phone on the same network.`;
    }
  }

  /* ---------- verify (opened by scanning a badge) ---------- */
  function showVerify(raw) {
    let info = null;
    try { info = parsePayload(b64uDec(raw)); } catch { info = null; }
    const body = document.getElementById("verifyBody");
    if (!info) {
      body.innerHTML = `<div class="verify-head bad">✕ Not a PickleMatch badge</div>
        <p class="verify-note">This link does not carry badge details we can read.</p>`;
    } else {
      const rank = RANKS[Math.min(3, Math.max(1, info.rank)) - 1];
      body.innerHTML = `
        <div class="verify-head ${info.ok ? "good" : "bad"}">
          ${info.ok ? "✓ Badge details check out" : "✕ Check code does not match"}
        </div>
        <div class="verify-card">
          <div class="verify-rank">${rank.medal} TOP ${info.rank} · ${rank.word}</div>
          <div class="verify-name">${esc(info.name)}</div>
          <div class="verify-stats"><span>Wins / Losses <b>${info.wins} - ${info.losses}</b></span></div>
          <div class="verify-meta">${esc(info.day)} · session ${esc(info.sid)} · code ${esc(codeLabel(info.rank, info.check))}</div>
        </div>
        <p class="verify-note">${info.ok
          ? "The details above match the badge's check code, so they have not been altered since the badge was made."
          : "The details do not match the check code on this badge, so it has been changed or rebuilt."}
          PickleMatch runs entirely in your browser, so this confirms the badge is intact — it is not proof of an official result.</p>`;
    }
    closeAllModals();
    document.getElementById("modalVerify").classList.remove("hidden");
  }

  function checkHash() {
    const m = /[#&]badge=([A-Za-z0-9_-]+)/.exec(location.hash || "");
    if (!m) return;
    history.replaceState(null, "", location.pathname + location.search);
    showVerify(m[1]);
  }

  /* ---------- wiring ---------- */
  document.getElementById("badgeBtn").addEventListener("click", openBadges);
  window.addEventListener("hashchange", checkHash);
  checkHash();
})();
