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
  const BG_SRC = "badge-bg.webp";
  const BC = window.BadgeCore;
  const W = 680, H = 960;

  /* ---------- small helpers ---------- */
  const checkOf = BC.checkOf, b64uEnc = BC.b64uEnc, codeLabel = BC.codeLabel;
  const clean = v => String(v == null ? "" : v).replace(/[|]/g, "/").trim();

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
    return sha256(seed).slice(0, 5).toUpperCase();
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

  // The published winners page, which is where a scanned badge should land.
  function toplistUrl() {
    return location.origin + location.pathname.replace(/[^/]*$/, "") + "toplist/";
  }
  // What the QR actually carries. Over http(s) it is a link to the Top List
  // page; from a file:// page there is no URL worth sharing, so it carries
  // readable text instead.
  function qrTextFor(signed, e, day, code) {
    if (location.protocol === "http:" || location.protocol === "https:") {
      return `${toplistUrl()}#b=${b64uEnc(signed)}`;
    }
    return `PICKLEMATCH TOP ${e.rank} | ${e.name} | ${e.wins}W-${e.losses}L | ${day} | ${code}`;
  }

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
      const { signed, code } = BC.sign(e, day, sid);
      return { e, day, sid, signed, code, qrText: qrTextFor(signed, e, day, code) };
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
        <button type="button" class="badge-zoom-btn" data-zoom="${i}" title="Tap to enlarge">
          <canvas id="badgeCv${i}" width="${W}" height="${H}" role="img"
            aria-label="Top ${b.e.rank} badge for ${esc(b.e.name)} — tap to enlarge"></canvas>
        </button>
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

    // Tap a badge to blow it up, so a player can photograph their own.
    list.querySelectorAll("[data-zoom]").forEach(btn => {
      btn.addEventListener("click", () => openZoom(Number(btn.dataset.zoom), top));
    });

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

  /* ---------- full-screen badge ---------- */
  function openZoom(index, top) {
    const src = document.getElementById("badgeCv" + index);
    const b = top[index];
    if (!src || !b) return;
    const wrap = document.getElementById("badgeZoom");
    const big = document.getElementById("badgeZoomCanvas");
    big.width = src.width; big.height = src.height;
    big.getContext("2d").drawImage(src, 0, 0);
    document.getElementById("badgeZoomName").textContent = `Top ${b.e.rank} · ${b.e.name}`;
    document.getElementById("badgeZoomCode").textContent = b.code;
    wrap.classList.remove("hidden");
    wrap.dataset.index = String(index);
    document.getElementById("badgeZoomClose").focus();
  }
  function closeZoom() {
    document.getElementById("badgeZoom").classList.add("hidden");
  }
  document.getElementById("badgeZoomClose").addEventListener("click", closeZoom);
  document.getElementById("badgeZoom").addEventListener("click", e => {
    if (e.target.id === "badgeZoom") closeZoom();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !document.getElementById("badgeZoom").classList.contains("hidden")) {
      e.stopImmediatePropagation();
      closeZoom();
    }
  }, true);

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

  /* ---------- publishing to the Top List ---------- */
  // Merges this session's podium into the published record and hands back a
  // toplist.json to commit. The app cannot write to the repository itself, and
  // that is the point: the list only changes when someone pushes.
  async function publishWinners() {
    const top = badgeData();
    if (!top.length) return toast("No finished matches yet, so there are no winners to publish.");

    let current = { app: "PickleMatch", format: 1, entries: [] };
    try {
      const res = await fetch(toplistUrl() + "toplist.json?t=" + Date.now(), { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.entries)) current = json;
      }
    } catch { /* first publish, or opened as a file: start from an empty list */ }

    const byId = new Map(current.entries.map(e => [e.id, e]));
    let added = 0;
    top.forEach(b => {
      const info = BC.parse(b.signed);
      const id = BC.entryId(info);
      const entry = {
        id, rank: info.rank, name: info.name, wins: info.wins, losses: info.losses,
        day: info.day, session: info.session, code: info.code
      };
      entry.hash = sha256(BC.canonical(entry));
      if (!byId.has(id)) added++;
      byId.set(id, entry);
    });

    const entries = [...byId.values()].sort((a, b) =>
      b.day.localeCompare(a.day) || a.session.localeCompare(b.session) || a.rank - b.rank);
    const out = {
      app: "PickleMatch", format: 1,
      updated: new Date().toISOString().slice(0, 10),
      fingerprint: sha256(entries.map(e => sha256(BC.canonical(e))).join("\n")).slice(0, 32),
      entries
    };

    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "toplist.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(`toplist.json saved — ${added} new winner${added === 1 ? "" : "s"}, ${entries.length} in total. `
      + "Replace toplist/toplist.json with it and push to publish.");
  }

  /* ---------- wiring ---------- */
  document.getElementById("badgeBtn").addEventListener("click", openBadges);
  document.getElementById("badgePublishBtn").addEventListener("click", publishWinners);
})();
