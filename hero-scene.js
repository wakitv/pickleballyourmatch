/*
  Hero scene — a pixel-art doubles match
  --------------------------------------
  Four players play out real points to 11: serve, return, third-shot drop,
  a dink battle at the kitchen, someone speeds it up, and it ends in a put-away
  or an error. Players work their way to the net the way a doubles team does.
  Every rally is simulated, so the winner is never the same twice.

  It is drawn pixel by pixel onto a small canvas that CSS blows up with
  image-rendering:pixelated, so it stays crisp at any width and needs no
  image files. Nothing here touches the session — it is hero decoration only.
*/
(function () {
  const canvas = document.getElementById("heroScene");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = list => list[(Math.random() * list.length) | 0];
  const chance = p => Math.random() < p;

  /* ---------- palette (follows the app's dark green / lime theme) ---------- */
  const C = {
    courtFar: "#123a26", courtNear: "#0e2e1e",
    line: "#8cc45f", lineFar: "#4a7d4a", lineSoft: "#2f5a3c",
    netTape: "#6f9d85", netMesh: "#284a38", post: "#0a1c12",
    ball: "#eaff8a", ballLit: "#ffffff", ballShade: "#9ab845", ballFaint: "#5c7a33",
    shadow: "#071a10", ink: "#07150d", paddleGrip: "#2a1a10",
    scoreL: "#ff6a5c", scoreR: "#5aa9ff", scoreDim: "#3f6b4e", plate: "#071a1099",
    callGood: "#eaff8a", callBad: "#f4c542"
  };
  // Four different-looking players; the left pair wear lime, the right mint.
  const CAST = [
    { hair: "#3b2416", skin: "#c98f63", jersey: "#ff5f52", shorts: "#2b3f5e", paddle: "#f0a04b" },
    { hair: "#120d0a", skin: "#7b4a2d", jersey: "#d93b30", shorts: "#36323f", paddle: "#c76a3c" },
    { hair: "#c9a227", skin: "#e3b48c", jersey: "#58a8ff", shorts: "#2b3f5e", paddle: "#5fd0c4" },
    { hair: "#8a3b1c", skin: "#9c6342", jersey: "#2f74c9", shorts: "#36323f", paddle: "#7a8fe0" }
  ];
  CAST.forEach(p => { p.shoe = "#e9f6ee"; });

  /* ---------- pixel helpers: every draw lands on a whole pixel ---------- */
  function px(x, y, color) {
    x = x | 0; y = y | 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }
  function hLine(x0, x1, y, color) { for (let x = x0; x <= x1; x++) px(x, y, color); }
  function vLine(x, y0, y1, color) { for (let y = y0; y <= y1; y++) px(x, y, color); }
  function line(x0, y0, x1, y1, color) { // Bresenham
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      px(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function disc(cx, cy, r, color) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r + r * 0.4) px(cx + x, cy + y, color);
    }
  }
  function sprite(rows, x, y, map, flip) {
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        const color = map[row[rx]];
        if (color) px(x + (flip ? row.length - 1 - rx : rx), y + ry, color);
      }
    });
  }

  /* ---------- 3x5 pixel font, for the scoreboard and the shot calls ---------- */
  const GLYPHS = {
    "0": "111101101101111", "1": "010110010010111", "2": "111001111100111",
    "3": "111001111001111", "4": "101101111001001", "5": "111100111001111",
    "6": "111100111101111", "7": "111001010010010", "8": "111101111101111",
    "9": "111101111001111", "-": "000000111000000", "!": "010010010000010",
    " ": "000000000000000",
    A: "111101111101101", B: "110101110101110", C: "111100100100111",
    D: "110101101101110", E: "111100110100111", G: "111100101101111",
    H: "101101111101101", I: "111010010010111", K: "101101110101101",
    L: "100100100100111", M: "101111111101101", N: "110111101101101",
    O: "111101101101111", P: "111101111100100", R: "111101111110101",
    S: "111100111001111", T: "111010010010010", U: "101101101101111",
    V: "101101101101010", W: "101101111111101", Y: "101101010010010"
  };
  function textWidth(s) { return s.length * 4 - 1; }
  function text(s, x, y, color) {
    for (let i = 0; i < s.length; i++) {
      const g = GLYPHS[s[i]];
      if (!g) continue;
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
        if (g[r * 3 + c] === "1") px(x + i * 4 + c, y + r, color);
      }
    }
  }

  /* ---------- the player ---------- */
  const BODY = [
    "...HHHHH...", "..HHHHHHH..", "..HHHHHHH..", "..HSSSSSH..", "..HSSSESH..",
    "...SSSSS...", "....SSS....", "..JJJJJJJ..", ".JJJJJJJJJ.", ".JJJJJJJJJ.",
    ".JJJJJJJJJ.", "..JJJJJJJ..", "..PPPPPPP..", "..PPPPPPP..", "..PP...PP..",
    "..LL...LL..", "..LL...LL..", "..LL...LL..", ".OOO...OOO."
  ];
  const BODY_W = 11, BODY_H = 19;

  // Two depth lanes each side. x moves along the court; the lane fixes depth.
  const PLAYERS = [
    { lane: "far",  side: "L", dir:  1, footY: 41, xBack:  16, xKitchen:  61, cast: 0, bob: 0.0 },
    { lane: "near", side: "L", dir:  1, footY: 57, xBack:  22, xKitchen:  67, cast: 1, bob: 1.7 },
    { lane: "near", side: "R", dir: -1, footY: 57, xBack: 178, xKitchen: 133, cast: 2, bob: 3.1 },
    { lane: "far",  side: "R", dir: -1, footY: 41, xBack: 184, xKitchen: 139, cast: 3, bob: 4.6 }
  ];
  PLAYERS.forEach(p => { p.x = p.xBack; p.mode = "back"; });
  const TEAM = { L: [0, 1], R: [2, 3] };
  const other = s => (s === "L" ? "R" : "L");
  // The diagonal opponent, which is who a serve goes to and where most dinks go.
  const DIAGONAL = { 0: 2, 1: 3, 2: 0, 3: 1 };

  const ARM_R = 7, PADDLE_R = 3, REACH = ARM_R + PADDLE_R;
  const READY_ANGLE = 0.6;

  /* ---------- shots ---------- */
  // swing: [wind-up angle, angle at contact, follow-through angle] in radians.
  // The contact angle also decides how high the ball is struck, so a smash
  // leaves from above the head and a dink from down by the knees.
  const SHOTS = {
    serve:  { label: "SERVE",  dur: 1.10, arc: 26, swing: [-2.2, -1.00,  0.3], win: [0.34, 0.24] },
    ret:    { label: "RETURN", dur: 0.95, arc: 19, swing: [-2.5, -0.10,  1.0], win: [0.28, 0.18] },
    drop:   { label: "DROP",   dur: 1.05, arc: 24, swing: [-1.8, -0.45,  0.5], win: [0.30, 0.20] },
    dink:   { label: "DINK",   dur: 0.72, arc: 11, swing: [-1.0, -0.55, -0.05], win: [0.22, 0.15] },
    drive:  { label: "DRIVE",  dur: 0.52, arc:  7, swing: [-2.6,  0.05,  1.3], win: [0.24, 0.16] },
    smash:  { label: "SMASH",  dur: 0.36, arc:  3, swing: [ 2.5,  1.25, -0.5], win: [0.26, 0.14] },
    lob:    { label: "LOB",    dur: 1.28, arc: 36, swing: [-2.0, -0.60,  0.9], win: [0.30, 0.20] },
    block:  { label: "BLOCK",  dur: 0.78, arc: 13, swing: [-0.9, -0.20,  0.3], win: [0.20, 0.14] }
  };
  // How often each shot ends the rally, and how it tends to end.
  const RISK = {
    serve: { end: 0.03, winner: 0.15 }, ret:   { end: 0.05, winner: 0.10 },
    drop:  { end: 0.08, winner: 0.05 }, dink:  { end: 0.06, winner: 0.08 },
    drive: { end: 0.16, winner: 0.45 }, smash: { end: 0.62, winner: 0.86 },
    lob:   { end: 0.14, winner: 0.20 }, block: { end: 0.11, winner: 0.15 }
  };

  function shoulder(p, lift) {
    return { x: Math.round(p.x) + p.dir * 2, y: p.footY - BODY_H + 10 + (lift || 0) };
  }
  function contactPoint(p, type) {
    const sh = shoulder(p, 0), ang = SHOTS[type].swing[1];
    return { x: Math.round(sh.x + p.dir * REACH * Math.cos(ang)), y: Math.round(sh.y - REACH * Math.sin(ang)) };
  }
  // Where the arm points, given seconds since this player's contact.
  function armAngle(dt, type) {
    const s = SHOTS[type] || SHOTS.dink;
    const [before, after] = s.win;
    if (dt < -before || dt > after) return READY_ANGLE;
    const k = (dt + before) / (before + after), at = before / (before + after);
    const [a, b, c] = s.swing;
    return k <= at ? a + (b - a) * (k / at) : b + (c - b) * ((k - at) / (1 - at));
  }

  /* ---------- match state ---------- */
  const TARGET_SCORE = 11;
  let simTime = 0;
  let score = { L: 0, R: 0 }, server = "L", serverIdx = 0;
  let shot = null;     // ball in flight
  let dead = null;     // ball down, point being awarded
  let gameOver = null; // final score on screen before the next game
  let call = null;     // the little SMASH! / OUT label
  let shotNo = 0;
  // Set by the Arena side game: a speed multiplier, the side the viewer backed,
  // and callbacks fired as the score moves and when a game is decided.
  let speed = 1, backed = null, onEndCb = null, onScoreCb = null;

  function lane(i) { return PLAYERS[i]; }
  function modeX(p) {
    if (p.mode === "kitchen") return p.xKitchen;
    if (p.mode === "mid") return Math.round((p.xBack + p.xKitchen) / 2);
    return p.xBack;
  }

  function startRally() {
    dead = null; call = null; shotNo = 0;
    serverIdx = TEAM[server][Math.random() < 0.5 ? 0 : 1];
    const receiver = DIAGONAL[serverIdx];
    PLAYERS.forEach((p, i) => {
      p.mode = (i === serverIdx || i === receiver) ? "back" : "kitchen";
      p.x = modeX(p); // everyone is set before the serve
    });
    launch(serverIdx, receiver, "serve");
  }

  // Decides what the receiver will play, from what they are facing.
  function replyTo(type) {
    if (type === "serve") return "ret";
    if (type === "ret")   return chance(0.68) ? "drop" : "drive";
    if (type === "drop")  return chance(0.74) ? "dink" : (chance(0.6) ? "drive" : "lob");
    if (type === "dink")  return chance(0.58) ? "dink" : (chance(0.55) ? "drive" : (chance(0.5) ? "drop" : "lob"));
    if (type === "drive") return chance(0.5) ? "block" : (chance(0.6) ? "drive" : "smash");
    if (type === "lob")   return chance(0.72) ? "smash" : "lob";
    if (type === "smash") return chance(0.7) ? "block" : "drive";
    if (type === "block") return chance(0.5) ? "dink" : (chance(0.6) ? "drive" : "drop");
    return "dink";
  }
  // Who takes the next ball. Cross-court is the natural exchange, so the
  // diagonal player gets most of them.
  function nextHitter(fromIdx, type) {
    const side = other(PLAYERS[fromIdx].side);
    const diag = DIAGONAL[fromIdx];
    if (type === "serve") return diag;                 // serves must go cross-court
    if (type === "lob") return TEAM[side][chance(0.5) ? 0 : 1];
    return chance(0.72) ? diag : TEAM[side].find(i => i !== diag);
  }

  function launch(fromIdx, toIdx, type) {
    const def = SHOTS[type];
    const risk = RISK[type];
    const ends = chance(risk.end);
    const p0 = contactPoint(PLAYERS[fromIdx], type);
    let end = null, nextType = null;

    if (ends) {
      end = { kind: chance(risk.winner) ? "winner" : (chance(0.55) ? "net" : "out") };
    } else {
      nextType = replyTo(type);
    }

    shot = {
      from: fromIdx, to: ends ? null : toIdx, type, nextType, end,
      t0: simTime, dur: def.dur * rnd(0.92, 1.08), arc: def.arc, p0
    };
    const hp = PLAYERS[fromIdx];
    call = { text: def.label, x: Math.round(hp.x), y: hp.footY - BODY_H - 6, until: simTime + 0.55, color: C.callGood };

    // Court positioning: the serving team works its way up after the third
    // shot, the returner follows their return in, and a lob pushes a team back.
    const me = PLAYERS[fromIdx];
    if (type === "ret") me.mode = "kitchen";
    if (shotNo === 2) TEAM[me.side].forEach(i => (PLAYERS[i].mode = "kitchen"));
    if (type === "lob" && toIdx != null) TEAM[PLAYERS[toIdx].side].forEach(i => (PLAYERS[i].mode = "mid"));
    if (type === "smash" || type === "drive") me.mode = me.mode === "mid" ? "kitchen" : me.mode;
    shotNo++;
  }

  // Where a rally-ending ball finishes up.
  function endTarget(s) {
    const hitter = PLAYERS[s.from], away = other(hitter.side);
    const dirSign = hitter.dir;
    if (s.end.kind === "net") {
      const x = 101 - dirSign * 3;
      return { x, y: netTop(Math.max(NET_X0, Math.min(NET_X1, x))) + 2 };
    }
    if (s.end.kind === "out") {
      return { x: dirSign > 0 ? W + 6 : -6, y: rnd(34, 46) | 0 };
    }
    const spot = TEAM[away].map(i => PLAYERS[i]);
    const ref = pick(spot);
    return { x: Math.round(ref.x + dirSign * rnd(14, 30)), y: ref.footY - 1 };
  }

  function ballTarget(s) {
    if (s.end) return s.endPoint || (s.endPoint = endTarget(s));
    return contactPoint(PLAYERS[s.to], s.nextType);
  }

  function ballAt(s, t) {
    const a = s.p0, b = ballTarget(s);
    return {
      x: Math.round(a.x + (b.x - a.x) * t),
      y: Math.round(a.y + (b.y - a.y) * t - s.arc * 4 * t * (1 - t))
    };
  }

  function awardPoint(s) {
    const hitter = PLAYERS[s.from];
    const winnerSide = s.end.kind === "winner" ? hitter.side : other(hitter.side);
    score[winnerSide]++;
    const lead = score[winnerSide] - score[other(winnerSide)];
    if (score[winnerSide] >= TARGET_SCORE && lead >= 2) {
      // Hold the final score for the same real time however fast play is running.
      gameOver = { side: winnerSide, until: simTime + 2.6 * speed };
    } else if (winnerSide !== server) {
      server = winnerSide; // side out
    }
    if (onScoreCb) onScoreCb({ ...score }, winnerSide);
    if (gameOver && onEndCb) onEndCb(winnerSide, { ...score });
  }

  function beginDead(s) {
    const target = ballTarget(s);
    dead = { kind: s.end.kind, at: target, t0: simTime, until: simTime + 1.15 };
    const words = { winner: "WINNER", net: "NET", out: "OUT" };
    call = {
      text: words[s.end.kind], x: target.x, y: Math.min(target.y - 12, 30),
      until: simTime + 1.0, color: s.end.kind === "winner" ? C.callGood : C.callBad
    };
    awardPoint(s);
    shot = null;
  }

  function resetGame() {
    score = { L: 0, R: 0 };
    server = chance(0.5) ? "L" : "R";
    gameOver = null;
    startRally();
  }

  function step(dt) {
    dt *= speed;
    simTime += dt;
    // Players walk toward where the tactics put them.
    PLAYERS.forEach(p => {
      const want = modeX(p);
      const d = want - p.x;
      if (Math.abs(d) > 0.4) p.x += Math.sign(d) * Math.min(Math.abs(d), 26 * dt);
      else p.x = want;
    });

    if (gameOver) { if (simTime >= gameOver.until) resetGame(); return; }
    if (dead) { if (simTime >= dead.until) startRally(); return; }
    if (shot && simTime >= shot.t0 + shot.dur) {
      if (shot.end) beginDead(shot);
      else {
        const from = shot.to, type = shot.nextType;
        launch(from, nextHitter(from, type), type);
      }
    }
  }

  /* ---------- court ---------- */
  const FAR_Y = 31, NEAR_Y = 63;
  const NET_X0 = 94, NET_X1 = 108;
  const lerpX = (x, a, b) => Math.round(a + (x - NET_X0) * (b - a) / (NET_X1 - NET_X0));
  const netTop = x => lerpX(x, 35, 47);
  const netBot = x => lerpX(x, 42, 57);

  function drawCourt() {
    for (let y = FAR_Y; y <= NEAR_Y; y++) {
      hLine(0, W - 1, y, (y - FAR_Y) / (NEAR_Y - FAR_Y) < 0.45 ? C.courtFar : C.courtNear);
    }
    hLine(0, W - 1, FAR_Y, C.lineFar);
    hLine(0, W - 1, NEAR_Y, C.line);
    [[62, 74], [128, 140]].forEach(([fx, nx]) => {
      for (let y = FAR_Y + 1; y < NEAR_Y; y++) {
        px(Math.round(fx + (nx - fx) * (y - FAR_Y) / (NEAR_Y - FAR_Y)), y, C.lineSoft);
      }
    });
    hLine(0, 64, 48, C.lineSoft);
    hLine(136, W - 1, 48, C.lineSoft);
  }
  function drawNet() {
    for (let x = NET_X0; x <= NET_X1; x++) {
      const t = netTop(x), b = netBot(x);
      for (let y = t + 2; y <= b; y++) if ((x + y) % 3 === 0) px(x, y, C.netMesh);
      px(x, t + 1, C.netTape);
    }
    vLine(NET_X0 - 1, netTop(NET_X0), netBot(NET_X0), C.post);
    vLine(NET_X1 + 1, netTop(NET_X1), netBot(NET_X1), C.post);
  }

  function drawPlayer(i, time) {
    const p = PLAYERS[i], skin = CAST[p.cast];
    const dt = shot ? (i === shot.from ? simTime - shot.t0
                     : i === shot.to ? simTime - (shot.t0 + shot.dur) : 99) : 99;
    const type = shot ? (i === shot.from ? shot.type : shot.nextType || "dink") : "dink";
    const swinging = dt >= -SHOTS[type].win[0] && dt <= SHOTS[type].win[1];
    const moving = Math.abs(modeX(p) - p.x) > 0.5;
    // Idle bob; a quicker step while moving; planted through the swing.
    const lift = swinging ? 0 : Math.round(Math.sin(time * (moving ? 9 : 2.6) + p.bob) * 0.6);
    const top = p.footY - BODY_H + 1 + lift;
    const left = Math.round(p.x) - ((BODY_W / 2) | 0);

    for (let x = -4; x <= 4; x++) px(Math.round(p.x) + x, p.footY + 1, Math.abs(x) > 2 ? C.courtNear : C.shadow);
    sprite(BODY, left, top, {
      H: skin.hair, S: skin.skin, E: C.ink, J: skin.jersey,
      P: skin.shorts, L: skin.skin, O: skin.shoe
    }, p.dir < 0);

    const ang = armAngle(dt, type);
    const sh = shoulder(p, lift);
    const hand = {
      x: Math.round(sh.x + p.dir * ARM_R * Math.cos(ang)),
      y: Math.round(sh.y - ARM_R * Math.sin(ang))
    };
    line(sh.x, sh.y, hand.x, hand.y, skin.skin);
    line(sh.x, sh.y + 1, hand.x, hand.y + 1, skin.skin);
    const pc = {
      x: Math.round(sh.x + p.dir * REACH * Math.cos(ang)),
      y: Math.round(sh.y - REACH * Math.sin(ang))
    };
    line(hand.x, hand.y, pc.x, pc.y, C.paddleGrip);
    disc(pc.x, pc.y, 2, C.ink);
    disc(pc.x, pc.y, 1, skin.paddle);
  }

  const trail = [];
  function drawBall() {
    let b = null;
    if (shot) {
      b = ballAt(shot, Math.max(0, Math.min(1, (simTime - shot.t0) / shot.dur)));
      trail.unshift(b);
      if (trail.length > 6) trail.pop();
    } else if (dead) {
      // Settle where it finished, with a couple of small bounces.
      const age = simTime - dead.t0, floor = dead.kind === "net" ? netBot(101) : dead.at.y;
      const h = Math.max(0, 9 * Math.exp(-age * 3.2) * Math.abs(Math.sin(age * 8)));
      b = { x: dead.at.x, y: Math.round(floor - h) };
      trail.length = 0;
    }
    if (!b) return;
    const groundY = Math.min(NEAR_Y - 4, Math.max(FAR_Y + 4, b.y + 14));
    const high = Math.max(0, Math.min(1, (groundY - b.y) / 34));
    const sw = 2 - Math.round(high);
    for (let x = -sw; x <= sw; x++) px(b.x + x, groundY, C.shadow);
    if (trail[2]) px(trail[2].x, trail[2].y, C.ballShade);
    if (trail[5]) px(trail[5].x, trail[5].y, C.ballFaint);
    disc(b.x, b.y, 1, C.ball);
    px(b.x, b.y, C.ballLit);
  }

  /* ---------- scoreboard ---------- */
  function drawScore() {
    const l = String(score.L), r = String(score.R);
    const mid = 100;
    const lx = mid - 4 - textWidth(l), rx = mid + 5;
    const flashOn = gameOver && Math.floor(simTime * 5) % 2 === 0;
    ctx.fillStyle = C.plate;
    ctx.fillRect(lx - 6, 1, (rx + textWidth(r) + 6) - (lx - 6), 9);
    text(l, lx, 3, !gameOver || gameOver.side !== "L" || flashOn ? C.scoreL : C.scoreDim);
    text("-", mid - 1, 3, C.scoreDim);
    text(r, rx, 3, !gameOver || gameOver.side !== "R" || flashOn ? C.scoreR : C.scoreDim);
    // A dot on the side that is serving.
    if (!gameOver) {
      const dx = server === "L" ? lx - 4 : rx + textWidth(r) + 2;
      px(dx, 5, server === "L" ? C.scoreL : C.scoreR);
      px(dx, 6, server === "L" ? C.scoreL : C.scoreR);
    } else {
      const g = "GAME";
      text(g, mid - (textWidth(g) >> 1), 11, gameOver.side === "L" ? C.scoreL : C.scoreR);
    }
    if (backed) { // a small caret under the side the viewer backed
      const bx = backed === "L" ? lx + 1 : rx + 1, bc = backed === "L" ? C.scoreL : C.scoreR;
      px(bx - 1, 9, bc); px(bx, 9, bc); px(bx + 1, 9, bc);
    }
  }

  function drawCall() {
    if (!call || simTime > call.until) return;
    const x = Math.max(2, Math.min(W - 2 - textWidth(call.text), call.x - (textWidth(call.text) >> 1)));
    const y = Math.max(11, call.y);
    text(call.text, x + 1, y + 1, C.ink);
    text(call.text, x, y, call.color);
  }

  function frame(time) {
    ctx.clearRect(0, 0, W, H);
    drawCourt();
    [0, 3].forEach(i => drawPlayer(i, time));
    drawNet();
    [1, 2].forEach(i => drawPlayer(i, time));
    drawBall();
    drawScore();
    drawCall();
  }

  /* ---------- loop ---------- */
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  let running = false, visible = true, last = 0, acc = 0;
  // While a bet is riding, the match must finish even if the hero is scrolled
  // away or the tab is in the background — otherwise the stake hangs forever.
  let keepAlive = false, pausedAt = 0;
  const FPS = 16, STEP = 1 / FPS; // pixel art reads better a little under 60fps
  const CATCHUP_CAP = 300;        // seconds of real time we will make up at once

  function tick(now) {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    step(dt);
    acc += dt;
    if (acc >= STEP) { acc = 0; frame(now / 1000); }
    requestAnimationFrame(tick);
  }
  function start() {
    if (running || (!visible && !keepAlive) || (reduced && reduced.matches)) return;
    // rAF does not fire in a background tab, so make up the time we missed
    // rather than leaving the game frozen where it stopped.
    if (keepAlive && pausedAt) {
      let gap = Math.min(CATCHUP_CAP, (Date.now() - pausedAt) / 1000);
      while (gap > 0) { step(Math.min(0.05, gap)); gap -= 0.05; }
    }
    pausedAt = 0;
    running = true; last = performance.now(); acc = STEP;
    requestAnimationFrame(tick);
  }
  function stop() { running = false; pausedAt = Date.now(); }
  function still() { // one readable frame when motion is turned down
    score = { L: 7, R: 9 };
    startRally();
    for (let i = 0; i < 70; i++) step(0.03);
    frame(0);
  }

  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  if (reduced) {
    const onChange = () => (reduced.matches ? (stop(), still()) : start());
    reduced.addEventListener ? reduced.addEventListener("change", onChange) : reduced.addListener(onChange);
  }
  if (window.IntersectionObserver) {
    new IntersectionObserver(e => {
      visible = e[0].isIntersecting;
      if (visible || keepAlive) start(); else stop();
    }, { threshold: 0 }).observe(canvas);
  }

  /* ---------- control surface for the Arena side game ---------- */
  window.PickleArena = {
    // Wipe the score and play a fresh game, optionally faster than ambient pace.
    // Hold the loop open (and catch up lost time) while a stake is riding.
    setKeepAlive(on) { keepAlive = !!on; if (on) start(); },
    newGame(mult) {
      speed = Math.max(1, Number(mult) || 1);
      score = { L: 0, R: 0 };
      server = chance(0.5) ? "L" : "R";
      gameOver = null;
      startRally();
      start();
    },
    setSpeed(mult) { speed = Math.max(1, Number(mult) || 1); },
    setPick(side) { backed = side === "L" || side === "R" ? side : null; },
    onEnd(fn) { onEndCb = typeof fn === "function" ? fn : null; },
    onScore(fn) { onScoreCb = typeof fn === "function" ? fn : null; },
    score: () => ({ ...score }),
    isLive: () => !gameOver
  };

  startRally();
  if (reduced && reduced.matches) still(); else start();
})();
