/*
  qr.js — a small QR encoder (byte mode, ECC level L or M, versions 1-15)
  ----------------------------------------------------------------------
  PickleMatch ships no libraries, so the badge QR codes are generated here.
  Enough of ISO/IEC 18004 is implemented to produce a correct symbol for the
  short URLs and text payloads a badge carries, and the output was checked
  module for module against a reference encoder across every version below.

  window.QR.encode(text, "M") -> { size, modules }  // modules[row][col] = bool
*/
(function () {
  /* ---------- GF(256), primitive polynomial 0x11D ---------- */
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  for (let i = 0, x = 1; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x <<= 1; if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

  // Generator polynomial for `degree` error-correction codewords: the product
  // of (x - a^d). Built with the constant term first, then reversed, so the
  // division below can read it leading coefficient first.
  function genPoly(degree) {
    let poly = [1];
    for (let d = 0; d < degree; d++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let i = 0; i < poly.length; i++) {
        next[i] ^= mul(poly[i], EXP[d]);
        next[i + 1] ^= poly[i];
      }
      poly = next;
    }
    return poly.reverse();
  }
  function ecBytes(data, ecLen) {
    const gen = genPoly(ecLen); // gen[0] is 1, the leading coefficient
    const res = new Array(data.length + ecLen).fill(0);
    data.forEach((b, i) => (res[i] = b));
    for (let i = 0; i < data.length; i++) {
      const factor = res[i];
      if (!factor) continue;
      for (let j = 0; j < gen.length; j++) res[i + j] ^= mul(gen[j], factor);
    }
    return res.slice(data.length);
  }

  /* ---------- version tables (1-15) ---------- */
  const TOTAL = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655];
  // [ecPerBlock, blocksG1, dataG1, blocksG2, dataG2]
  const BLOCKS = {
    L: [null,
      [7, 1, 19, 0, 0], [10, 1, 34, 0, 0], [15, 1, 55, 0, 0], [20, 1, 80, 0, 0], [26, 1, 108, 0, 0],
      [18, 2, 68, 0, 0], [20, 2, 78, 0, 0], [24, 2, 97, 0, 0], [30, 2, 116, 0, 0], [18, 2, 68, 2, 69],
      [20, 4, 81, 0, 0], [24, 2, 92, 2, 93], [26, 4, 107, 0, 0], [30, 3, 115, 1, 116], [22, 5, 87, 1, 88]],
    M: [null,
      [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
      [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44],
      [30, 1, 50, 4, 51], [22, 6, 36, 2, 37], [22, 8, 37, 1, 38], [24, 4, 40, 5, 41], [24, 5, 41, 5, 42]]
  };
  const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42],
    [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70]];
  const VERSION_BITS = [0, 0, 0, 0, 0, 0, 0, 0x07c94, 0x085bc, 0x09a99, 0x0a4d3, 0x0bbf6,
    0x0c762, 0x0d847, 0x0e60d, 0x0f928];
  const ECC_IND = { L: 1, M: 0 };
  const remainderBits = v => (v === 1 ? 0 : v <= 6 ? 7 : v <= 13 ? 0 : 3);
  const dataCodewords = (v, ecc) => {
    const [, b1, d1, b2, d2] = BLOCKS[ecc][v];
    return b1 * d1 + b2 * d2;
  };

  /* ---------- bit buffer ---------- */
  function Bits() { this.bytes = []; this.len = 0; }
  Bits.prototype.put = function (value, length) {
    for (let i = length - 1; i >= 0; i--) {
      const bit = (value >>> i) & 1;
      if (this.len % 8 === 0) this.bytes.push(0);
      if (bit) this.bytes[this.bytes.length - 1] |= 0x80 >>> (this.len % 8);
      this.len++;
    }
  };

  /* ---------- matrix ---------- */
  function buildMatrix(version, eccLevel, codewords, mask) {
    const size = version * 4 + 17;
    const m = Array.from({ length: size }, () => new Array(size).fill(null)); // null = free
    const set = (r, c, v) => { if (r >= 0 && c >= 0 && r < size && c < size) m[r][c] = v; };

    // Finder patterns and their separators.
    const finder = (r0, c0) => {
      for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
        const inBox = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const on = inBox && ((r === 0 || r === 6 || c === 0 || c === 6) ||
                             (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        set(r0 + r, c0 + c, on);
      }
    };
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

    // Alignment patterns, except where they would sit on a finder.
    const centers = ALIGN[version];
    centers.forEach(r => centers.forEach(c => {
      const nearFinder = (r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8);
      if (nearFinder) return;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
      }
    }));

    // Timing patterns.
    for (let i = 8; i < size - 8; i++) {
      if (m[6][i] === null) m[6][i] = i % 2 === 0;
      if (m[i][6] === null) m[i][6] = i % 2 === 0;
    }
    // Dark module.
    set(size - 8, 8, true);

    // Reserve the format areas so data placement skips them.
    const reserved = Array.from({ length: size }, () => new Array(size).fill(false));
    for (let i = 0; i < 9; i++) { reserved[8][i] = true; reserved[i][8] = true; }
    for (let i = 0; i < 8; i++) { reserved[8][size - 1 - i] = true; reserved[size - 1 - i][8] = true; }
    if (version >= 7) {
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
        reserved[size - 11 + j][i] = true; reserved[i][size - 11 + j] = true;
      }
    }
    const free = (r, c) => m[r][c] === null && !reserved[r][c];

    // Data placement: two-module columns, zigzagging up then down, skipping
    // the vertical timing column.
    let bit = 0, upward = true;
    for (let right = size - 1; right > 0; right -= 2) {
      if (right === 6) right = 5; // column 6 is the timing pattern
      for (let step = 0; step < size; step++) {
        const row = upward ? size - 1 - step : step;
        for (let k = 0; k < 2; k++) {
          const col = right - k;
          if (!free(row, col)) continue;
          const byte = codewords[bit >>> 3];
          let on = byte !== undefined && ((byte >>> (7 - (bit & 7))) & 1) === 1;
          bit++;
          // Mask only the data region.
          const i = row, j = col;
          let flip = false;
          switch (mask) {
            case 0: flip = (i + j) % 2 === 0; break;
            case 1: flip = i % 2 === 0; break;
            case 2: flip = j % 3 === 0; break;
            case 3: flip = (i + j) % 3 === 0; break;
            case 4: flip = (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0; break;
            case 5: flip = ((i * j) % 2) + ((i * j) % 3) === 0; break;
            case 6: flip = (((i * j) % 2) + ((i * j) % 3)) % 2 === 0; break;
            case 7: flip = (((i + j) % 2) + ((i * j) % 3)) % 2 === 0; break;
          }
          m[row][col] = flip ? !on : on;
        }
      }
      upward = !upward;
    }

    // Format information (BCH 15,5 then XOR with the standard mask).
    let fmt = (ECC_IND[eccLevel] << 3) | mask;
    let rem = fmt;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const format = ((fmt << 10) | rem) ^ 0x5412;
    for (let i = 0; i < 15; i++) {
      const on = ((format >>> i) & 1) === 1;
      // Copy 1 runs down column 8, past the timing row.
      if (i < 6) m[i][8] = on;
      else if (i < 8) m[i + 1][8] = on;
      else m[size - 15 + i][8] = on;
      // Copy 2 runs along row 8, from the right edge back to the left.
      if (i < 8) m[8][size - 1 - i] = on;
      else if (i === 8) m[8][7] = on;
      else m[8][14 - i] = on;
    }
    // Version information, v7 and up.
    if (version >= 7) {
      const vb = VERSION_BITS[version];
      for (let i = 0; i < 18; i++) {
        const on = ((vb >>> i) & 1) === 1;
        m[Math.floor(i / 3)][size - 11 + (i % 3)] = on;
        m[size - 11 + (i % 3)][Math.floor(i / 3)] = on;
      }
    }
    return { size, modules: m.map(row => row.map(Boolean)) };
  }

  /* ---------- mask penalty (ISO rules 1-4) ---------- */
  function penalty(mods) {
    const n = mods.length;
    let score = 0;
    const run = line => {
      let total = 0, last = line[0], count = 1;
      for (let i = 1; i < n; i++) {
        if (line[i] === last) count++;
        else { if (count >= 5) total += count - 2; last = line[i]; count = 1; }
      }
      if (count >= 5) total += count - 2;
      return total;
    };
    for (let i = 0; i < n; i++) {
      score += run(mods[i]);
      score += run(mods.map(r => r[i]));
    }
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const v = mods[r][c];
      if (v === mods[r][c + 1] && v === mods[r + 1][c] && v === mods[r + 1][c + 1]) score += 3;
    }
    const pat1 = [true, false, true, true, true, false, true, false, false, false, false];
    const pat2 = [false, false, false, false, true, false, true, true, true, false, true];
    const hasAt = (line, i, pat) => pat.every((p, k) => line[i + k] === p);
    for (let i = 0; i < n; i++) {
      const row = mods[i], col = mods.map(r => r[i]);
      for (let j = 0; j + 11 <= n; j++) {
        if (hasAt(row, j, pat1) || hasAt(row, j, pat2)) score += 40;
        if (hasAt(col, j, pat1) || hasAt(col, j, pat2)) score += 40;
      }
    }
    let dark = 0;
    mods.forEach(r => r.forEach(v => { if (v) dark++; }));
    score += Math.floor(Math.abs(dark * 100 / (n * n) - 50) / 5) * 10;
    return score;
  }

  /* ---------- public encode ---------- */
  function encode(text, eccLevel) {
    eccLevel = eccLevel === "L" ? "L" : "M";
    const data = [];
    // UTF-8 bytes, so names with accents survive the round trip.
    for (const ch of unescape(encodeURIComponent(String(text)))) data.push(ch.charCodeAt(0));

    let version = 0;
    for (let v = 1; v <= 15; v++) {
      const countBits = v <= 9 ? 8 : 16;
      if (4 + countBits + data.length * 8 <= dataCodewords(v, eccLevel) * 8) { version = v; break; }
    }
    if (!version) throw new Error("QR payload too long for version 15 at ECC " + eccLevel);

    const capacity = dataCodewords(version, eccLevel);
    const bits = new Bits();
    bits.put(4, 4);                                  // byte mode
    bits.put(data.length, version <= 9 ? 8 : 16);    // character count
    data.forEach(b => bits.put(b, 8));
    const room = capacity * 8;
    bits.put(0, Math.min(4, room - bits.len));       // terminator
    while (bits.len % 8) bits.put(0, 1);             // pad to a byte
    const words = bits.bytes.slice();
    for (let i = 0; words.length < capacity; i++) words.push(i % 2 === 0 ? 0xec : 0x11);

    // Split into blocks, add error correction, then interleave.
    const [ecLen, b1, d1, b2, d2] = BLOCKS[eccLevel][version];
    const dataBlocks = [], ecBlocks = [];
    let at = 0;
    for (let i = 0; i < b1 + b2; i++) {
      const len = i < b1 ? d1 : d2;
      const block = words.slice(at, at + len);
      at += len;
      dataBlocks.push(block);
      ecBlocks.push(ecBytes(block, ecLen));
    }
    const out = [];
    for (let i = 0; i < Math.max(d1, d2); i++) {
      dataBlocks.forEach(b => { if (i < b.length) out.push(b[i]); });
    }
    for (let i = 0; i < ecLen; i++) ecBlocks.forEach(b => out.push(b[i]));
    if (out.length !== TOTAL[version]) throw new Error("codeword count mismatch");
    // Remainder bits ride along as a trailing zero byte; extra bits are ignored.
    out.push(0);

    let best = null;
    for (let mask = 0; mask < 8; mask++) {
      const cand = buildMatrix(version, eccLevel, out, mask);
      const p = penalty(cand.modules);
      if (!best || p < best.penalty) best = { ...cand, penalty: p, mask, version };
    }
    best.codewords = out;
    return best;
  }

  // _build is exposed so the matrix can be checked against a reference encoder.
  window.QR = { encode, _build: buildMatrix, _dataCodewords: dataCodewords };
})();
