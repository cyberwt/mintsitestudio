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
    // One GA4 event per finished puzzle (solved or given up).
    if (typeof root.gtag === "function") {
      root.gtag("event", "puzzle_complete", { game, solved: !!result.solved, past_day: date !== today() });
    }
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
    const names = NAMES;
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
      <h2>Archive</h2><p class="sub" style="margin-top:-6px">Every past puzzle is free to play.</p><div class="chips">${past}</div>`;
  }

  // ---- Look: icons, splash screen, result card ---------------------------------

  const NAMES = { sum: "Mint Sum", sudoku: "Mini Sudoku", nonogram: "Mint Nonogram" };
  const TAGS = {
    sum: "Make the numbers hit the target.",
    sudoku: "Fill the grid with 1 to 6. Six minutes of calm.",
    nonogram: "Use the clues to reveal the picture.",
  };
  const COLORS = { sum: "#8fd8b8", sudoku: "#ffcb57", nonogram: "#bcaeff" };
  const INK = "#121212";
  function icon(game) {
    const frame = `<rect x="2" y="2" width="44" height="44" rx="10" fill="${COLORS[game]}" stroke="${INK}" stroke-width="3"/>`;
    const art = {
      sum: `<path d="M10 24h12M16 18v12M27 20.5h11M27 27.5h11" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
      sudoku: `<path d="M24 3.5v41M3.5 17.3h41M3.5 30.7h41" stroke="${INK}" stroke-width="2.5"/><rect x="24" y="17.3" width="20.5" height="13.4" fill="${INK}"/>`,
      nonogram: [[0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [1, 3], [2, 1], [2, 2], [3, 0], [3, 3]]
        .map(([r, c]) => `<rect x="${10 + c * 7.5}" y="${10 + r * 7.5}" width="6.5" height="6.5" rx="1" fill="${INK}"/>`).join(""),
    }[game];
    return `<svg class="icon" viewBox="0 0 48 48" aria-hidden="true">${frame}${art}</svg>`;
  }

  // Full-color welcome screen. Stays up until the player taps Play.
  function splash(game) {
    root.document.querySelectorAll("[data-icon]").forEach((x) => (x.innerHTML = icon(x.dataset.icon)));
    const el = root.document.getElementById("splash");
    if (!el) return;
    const date = pageDate();
    const r = result(game, date);
    el.innerHTML = `${icon(game)}<h1>${NAMES[game]}</h1><p class="tag">${TAGS[game]}</p>
      <button class="btn p" id="splashGo">${r ? "See your result" : date === today() ? "Play" : "Play this day"}</button>
      <div class="meta"><b>${prettyDate(date)}</b>No. ${puzzleNumber(date)}</div>
      <div class="free">Free to play · No account</div>`;
    root.document.body.classList.add("splashing");
    el.hidden = false;
    root.document.getElementById("splashGo").onclick = () => {
      el.hidden = true;
      root.document.body.classList.remove("splashing");
      if (r) { const d = root.document.getElementById("done"); if (d) d.scrollIntoView({ block: "center" }); }
    };
  }

  // Result card shown when a puzzle is finished. stats = [[label, value], ...]
  function renderDone(el, { eyebrow, title, stats, shareText }) {
    el.hidden = false;
    el.innerHTML = `<div class="eyebrow">${eyebrow}</div><b>${title}</b>
      <div class="stats">${stats.map(([k, v]) => `<div><span>${v}</span>${k}</div>`).join("")}</div>
      <div class="row" style="justify-content:center"><button class="btn p" id="share">Share</button><a class="btn o" href="/">More puzzles</a></div>`;
    el.querySelector("#share").onclick = (e) => share(shareText, e.target);
    // A puzzle just finished (not a result restored behind the splash): bring the card into view.
    if (!root.document.body.classList.contains("splashing")) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 350);
    }
  }

  async function share(text, btn) {
    try {
      if (root.navigator.share && /Mobi|Android|iPhone/.test(root.navigator.userAgent)) {
        await root.navigator.share({ text });
        return;
      }
      await root.navigator.clipboard.writeText(text);
      const was = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = was), 1600);
    } catch {}
  }

  root.Mint = {
    LAUNCH, rng, hash, today, addDays, prettyDate, puzzleNumber, pageDate,
    save, result, streak, fmtTime, renderMore, share, icon, splash, renderDone, NAMES,
    sumPuzzle, sudokuPuzzle, sudokuCount, nonogramPuzzle, lineSolve, runs,
  };
})(typeof window !== "undefined" ? window : globalThis);
