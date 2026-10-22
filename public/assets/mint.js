// Mint Puzzles shared code: seeded random numbers, dates, saved progress, and the
// three daily puzzle generators. Every player gets the same puzzle for a date because
// the generator is seeded with "<game>:<YYYY-MM-DD>". Also loads in Node for tests.
(function (root) {
  // Keep in sync with LAUNCH in src/worker.js.
  const LAUNCH = "2026-10-21";

  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // mulberry32
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  function shuffle(r, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---- Dates ---------------------------------------------------------------

  function today() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function addDays(iso, n) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  }

  function prettyDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });
  }

  function puzzleNumber(iso) {
    const t = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
    return Math.round((t(iso) - t(LAUNCH)) / 86400000) + 1;
  }

  // The date in the URL (/sum/2026-10-21) or the player's local today.
  function pageDate() {
    const m = (root.location ? root.location.pathname : "").match(/(\d{4}-\d{2}-\d{2})\/?$/);
    const t = today();
    if (m && m[1] >= LAUNCH && m[1] <= t) return m[1];
    return t < LAUNCH ? LAUNCH : t;
  }

  // ---- Saved progress (this browser only) ----------------------------------

  const KEY = "mint:v1";
  function load() {
    try { return JSON.parse(root.localStorage.getItem(KEY)) || {}; } catch { return {}; }
  }
  function save(game, date, result) {
    try {
      const all = load();
      all[game] = all[game] || {};
      all[game][date] = result;
      root.localStorage.setItem(KEY, JSON.stringify(all));
    } catch {}
  }
  function result(game, date) {
    return (load()[game] || {})[date] || null;
  }
  // Days in a row, ending today or yesterday, with this game solved.
  function streak(game) {
    const days = load()[game] || {};
    let d = today();
    if (!(days[d] && days[d].solved)) d = addDays(d, -1);
    let n = 0;
    while (days[d] && days[d].solved) { n++; d = addDays(d, -1); }
    return n;
  }

  function fmtTime(sec) {
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  // ---- Mint Sum ------------------------------------------------------------
  // Six numbers and a target. Three rounds a day; each target is built by combining
  // 3, 4 or 5 of the numbers, so every round has at least one exact solution.

  const SUM_LEVELS = [
    { name: "Easy", k: 3, lo: 20, hi: 99 },
    { name: "Medium", k: 4, lo: 100, hi: 299 },
    { name: "Hard", k: 5, lo: 200, hi: 999 },
  ];

  function sumPuzzle(date) {
    const r = rng(hash("sum:" + date));
    const used = new Set();
    return SUM_LEVELS.map((L) => {
      let best = null;
      for (let tries = 0; tries < 2000 && !best; tries++) {
        const nums = [int(r, 1, 9), int(r, 1, 9), int(r, 2, 9), int(r, 3, 9), pick(r, [10, 11, 12, 13, 15]), pick(r, [20, 25, 50])];
        const pool = shuffle(r, nums.slice()).slice(0, L.k).map((v) => ({ v }));
        const steps = [];
        while (pool.length > 1) {
          let a = pool.splice(int(r, 0, pool.length - 1), 1)[0].v;
          let b = pool.splice(int(r, 0, pool.length - 1), 1)[0].v;
          if (a < b) [a, b] = [b, a];
          const ops = ["+", "×", "×"];
          if (a > b) ops.push("−");
          if (b > 1 && a % b === 0) ops.push("÷");
          const op = pick(r, ops);
          const v = op === "+" ? a + b : op === "−" ? a - b : op === "×" ? a * b : a / b;
          steps.push(`${a} ${op} ${b} = ${v}`);
          pool.push({ v });
        }
        const t = pool[0].v;
        if (t >= L.lo && t <= L.hi && !nums.includes(t) && !used.has(t)) {
          best = { level: L.name, nums: nums.slice().sort((x, y) => x - y), target: t, solution: steps };
          used.add(t);
        }
      }
      return best;
    });
  }

  // ---- Mini Sudoku (6×6, 2×3 boxes) ----------------------------------------

  function sudokuCount(g, limit) {
    const i = g.indexOf(0);
    if (i < 0) return 1;
    const r = Math.floor(i / 6), c = i % 6;
    const br = r - (r % 2), bc = c - (c % 3);
    let n = 0;
    for (let v = 1; v <= 6 && n < limit; v++) {
      let ok = true;
      for (let k = 0; k < 6 && ok; k++) {
        if (g[r * 6 + k] === v || g[k * 6 + c] === v) ok = false;
      }
      for (let dr = 0; dr < 2 && ok; dr++) for (let dc = 0; dc < 3 && ok; dc++) if (g[(br + dr) * 6 + bc + dc] === v) ok = false;
      if (!ok) continue;
      g[i] = v;
      n += sudokuCount(g, limit - n);
      g[i] = 0;
    }
    return n;
  }

  function sudokuPuzzle(date) {
    const r = rng(hash("sudoku:" + date));
    const digits = shuffle(r, [1, 2, 3, 4, 5, 6]);
    // Shuffle row pairs (bands), rows within a band, column triples (stacks), columns within a stack.
    const rows = shuffle(r, [0, 1, 2]).flatMap((b) => shuffle(r, [0, 1]).map((i) => b * 2 + i));
    const cols = shuffle(r, [0, 1]).flatMap((s) => shuffle(r, [0, 1, 2]).map((i) => s * 3 + i));
    const base = (row, col) => ((row % 2) * 3 + Math.floor(row / 2) + col) % 6;
    const solution = [];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) solution.push(digits[base(rows[i], cols[j])]);
    const grid = solution.slice();
    let clues = 36;
    const TARGET = 12;
    for (const idx of shuffle(r, [...Array(36).keys()])) {
      if (clues <= TARGET) break;
      const keep = grid[idx];
      grid[idx] = 0;
      if (sudokuCount(grid.slice(), 2) !== 1) grid[idx] = keep;
      else clues--;
    }
    return { grid, solution };
  }

  // ---- Nonogram (10×10) ----------------------------------------------------
  // Random picture, kept only if it can be solved line by line with no guessing,
  // which also proves the solution is unique.

  function runs(line) {
    const out = [];
    let n = 0;
    for (const v of line) {
      if (v) n++;
      else if (n) { out.push(n); n = 0; }
    }
    if (n) out.push(n);
    return out.length ? out : [0];
  }

  // Every way to place `clue` in a line of n cells that agrees with `known` (-1 unknown).
  function placements(clue, n, known) {
    const blocks = clue[0] === 0 ? [] : clue;
    const out = [];
    const cur = new Array(n).fill(0);
    function fits(from, to, v) {
      for (let i = from; i < to; i++) if (known[i] !== -1 && known[i] !== v) return false;
      return true;
    }
    function place(b, start) {
      if (b === blocks.length) {
        if (fits(start, n, 0)) out.push(cur.slice());
        return;
      }
      let rest = 0;
      for (let k = b + 1; k < blocks.length; k++) rest += blocks[k] + 1;
      for (let s = start; s + blocks[b] + rest <= n; s++) {
        if (!fits(start, s, 0)) break;
        if (!fits(s, s + blocks[b], 1)) continue;
        if (s + blocks[b] < n && known[s + blocks[b]] === 1) continue;
        for (let i = s; i < s + blocks[b]; i++) cur[i] = 1;
        place(b + 1, Math.min(n, s + blocks[b] + 1));
        for (let i = s; i < s + blocks[b]; i++) cur[i] = 0;
      }
    }
    place(0, 0);
    return out;
  }

  function lineSolve(rowClues, colClues, n) {
    const g = new Array(n * n).fill(-1);
    let changed = true;
    while (changed) {
      changed = false;
      for (let axis = 0; axis < 2; axis++) {
        for (let i = 0; i < n; i++) {
          const idx = [...Array(n).keys()].map((j) => (axis === 0 ? i * n + j : j * n + i));
          const known = idx.map((k) => g[k]);
          if (!known.includes(-1)) continue;
          const ps = placements(axis === 0 ? rowClues[i] : colClues[i], n, known);
          if (!ps.length) return null;
          for (let j = 0; j < n; j++) {
            if (known[j] !== -1) continue;
            const v = ps[0][j];
            if (ps.every((p) => p[j] === v)) { g[idx[j]] = v; changed = true; }
          }
        }
      }
    }
    return g.includes(-1) ? null : g;
  }

  function nonogramPuzzle(date) {
    const n = 10;
    const r = rng(hash("nonogram:" + date));
    for (let tries = 0; tries < 500; tries++) {
      const density = 0.55 + r() * 0.1;
      const sol = Array.from({ length: n * n }, () => (r() < density ? 1 : 0));
      const rowClues = [], colClues = [];
      for (let i = 0; i < n; i++) {
        rowClues.push(runs(sol.slice(i * n, i * n + n)));
        colClues.push(runs([...Array(n).keys()].map((j) => sol[j * n + i])));
      }
      if (rowClues.concat(colClues).some((c) => c[0] === 0)) continue;
      if (lineSolve(rowClues, colClues, n)) return { n, rowClues, colClues, solution: sol };
    }
    throw new Error("no line-solvable nonogram for " + date);
  }

  // ---- Page helpers ----------------------------------------------------------

  // Links to the other games and to past days, shown under every game.
  function renderMore(el, game) {
    const date = pageDate();
    const names = { sum: "Mint Sum", sudoku: "Mini Sudoku", nonogram: "Mint Nonogram" };
    const others = Object.keys(names).filter((g) => g !== game).map((g) => {
      const done = result(g, today());
      return `<a class="chip" href="/${g}/">${names[g]}${done && done.solved ? " ✓" : ""}</a>`;
    });
    let past = "";
    for (let d = today(), k = 0; d >= LAUNCH && k < 60; d = addDays(d, -1), k++) {
      const done = result(game, d);
      const mark = done ? (done.solved ? " ✓" : " ·") : "";
      past += `<a class="chip${d === date ? " on" : ""}" href="/${game}/${d}">#${puzzleNumber(d)} ${prettyDate(d).replace(/, \d{4}$/, "")}${mark}</a>`;
    }
    el.innerHTML = `<h2>Play next</h2><div class="chips">${others.join("")}</div>
      <h2>Past puzzles</h2><div class="chips">${past}</div>`;
  }

  async function share(text, btn) {
    try {
      if (root.navigator.share && /Mobi|Android|iPhone/.test(root.navigator.userAgent)) {
        await root.navigator.share({ text });
        return;
      }
      await root.navigator.clipboard.writeText(text);
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = "Share result"), 1600);
    } catch {}
  }

  root.Mint = {
    LAUNCH, rng, hash, today, addDays, prettyDate, puzzleNumber, pageDate,
    save, result, streak, fmtTime, renderMore, share,
    sumPuzzle, sudokuPuzzle, sudokuCount, nonogramPuzzle, lineSolve, runs,
  };
})(typeof window !== "undefined" ? window : globalThis);
