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

  // The link in a shared result: the same day's puzzle, tagged so GA4 counts the
  // visit under source "share".
  function shareUrl(game, date) {
    return `https://mintsitestudio.com/${game}/${date}?utm_source=share`;
  }

  // A past day for this game, preferring one this browser hasn't played. Null on launch day.
  function randomPastDay(game) {
    const days = [];
    for (let d = addDays(today(), -1); d >= LAUNCH; d = addDays(d, -1)) days.push(d);
    if (!days.length) return null;
    const fresh = days.filter((d) => !result(game, d));
    const pool = fresh.length ? fresh : days;
    return pool[Math.floor(Math.random() * pool.length)];
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

  // ---- Word games: Mint Word, Mint Hive, Mint Box -----------------------------
  // Built from the frozen list in /assets/words-v1.js (root.MintWords). Seeds carry
  // "v1" so a future words-v2.js can start from a cutover date without touching old days.

  let W = null;
  function words() {
    if (W) return W;
    if (!root.MintWords) throw new Error("load /assets/words-v1.js first");
    const { common, mid, extra } = root.MintWords;
    W = { common: common.split(" "), mid: mid.split(" ") };
    W.all = new Set(W.common.concat(W.mid, extra.split(" ")));
    return W;
  }
  const isWord = (w) => words().all.has(w);

  // One five-letter answer a day, walking a fixed shuffle of everyday words (no
  // plain plurals or -ed forms), so no answer repeats until the list runs out.
  function wordPuzzle(date) {
    const w = words();
    if (!w.answers) w.answers = shuffle(rng(hash("word:v1")), w.common.filter((x) => x.length === 5 && !/[^s]s$|ed$/.test(x)));
    return { answer: w.answers[(puzzleNumber(date) - 1) % w.answers.length] };
  }

  // Seven letters from an everyday word with seven different letters (no S), one in
  // the middle that every word must use. Kept only if it makes 20 to 55 answers.
  function hiveScore(word) {
    return (word.length === 4 ? 1 : word.length) + (new Set(word).size === 7 ? 7 : 0);
  }
  function hivePuzzle(date) {
    const w = words();
    if (!w.pangrams) {
      w.pangrams = w.common.filter((x) => !x.includes("s") && new Set(x).size === 7);
      w.hivePool = w.common.concat(w.mid).filter((x) => x.length >= 4 && !x.includes("s") && new Set(x).size <= 7);
    }
    const r = rng(hash("hive:v1:" + date));
    for (let tries = 0; tries < 400; tries++) {
      const letters = [...new Set(pick(r, w.pangrams))];
      const center = pick(r, letters);
      const set = new Set(letters);
      const answers = w.hivePool.filter((x) => x.includes(center) && [...x].every((c) => set.has(c)));
      if (answers.length < 20 || answers.length > 55) continue;
      return {
        center,
        outer: shuffle(r, letters.filter((c) => c !== center)),
        answers: answers.sort(),
        max: answers.reduce((s, x) => s + hiveScore(x), 0),
      };
    }
    throw new Error("no hive for " + date);
  }

  // Twelve letters, three per side of a square. Built from two everyday words that
  // chain (the first ends where the second starts) and use all twelve letters, so
  // there is always a two-word answer. Consecutive letters of a word sit on
  // different sides.
  function boxPuzzle(date) {
    const w = words();
    if (!w.boxSeeds) {
      w.boxSeeds = w.common.filter((x) => x.length >= 5 && x.length <= 9 && !/(.)\1/.test(x));
      w.boxByFirst = {};
      for (const x of w.boxSeeds) (w.boxByFirst[x[0]] = w.boxByFirst[x[0]] || []).push(x);
    }
    const r = rng(hash("box:v1:" + date));
    for (let tries = 0; tries < 5000; tries++) {
      const a = pick(r, w.boxSeeds);
      const b = pick(r, w.boxByFirst[a[a.length - 1]] || [a]);
      const letters = [...new Set(a + b)];
      if (a === b || letters.length !== 12) continue;
      const near = new Set();
      for (const x of [a, b]) for (let i = 1; i < x.length; i++) near.add(x[i - 1] + x[i]).add(x[i] + x[i - 1]);
      const sides = [[], [], [], []];
      const place = (k) => {
        if (k === letters.length) return true;
        for (const s of sides) {
          if (s.length === 3 || s.some((c) => near.has(c + letters[k]))) continue;
          s.push(letters[k]);
          if (place(k + 1)) return true;
          s.pop();
        }
        return false;
      };
      shuffle(r, letters);
      if (place(0)) return { sides: shuffle(r, sides.map((s) => shuffle(r, s))), solution: [a, b] };
    }
    throw new Error("no box for " + date);
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
    const y = addDays(today(), -1), rnd = randomPastDay(game);
    const jump = y >= LAUNCH
      ? `<div class="chips jump"><a class="chip" href="/${game}/${y}">Play yesterday’s</a>${rnd ? `<a class="chip" href="/${game}/${rnd}">Random past puzzle</a>` : ""}<a class="chip" href="/archive">All games, every day →</a></div>`
      : "";
    el.innerHTML = `<h2>Play next</h2><div class="chips">${others.join("")}</div>
      <h2>Archive</h2><p class="sub" style="margin-top:-6px">Every past puzzle is free to play.</p>${jump}<div class="chips">${past}</div>`;
  }

  // ---- Look: icons, toolbar, splash, modals, result card ------------------------

  const NAMES = { sum: "Mint Sum", sudoku: "Mini Sudoku", nonogram: "Mint Nonogram", word: "Mint Word", hive: "Mint Hive", box: "Mint Box" };
  const TAGS = {
    sum: "Make the numbers hit the target.",
    sudoku: "Fill the grid with 1 to 6. Six minutes of calm.",
    nonogram: "Use the clues to reveal the picture.",
    word: "Find the hidden five-letter word in six tries.",
    hive: "Make words from seven letters. Always use the middle one.",
    box: "Link letters around the box. Use all twelve.",
  };
  const LENGTHS = { sum: "About 5 minutes", sudoku: "About 6 minutes", nonogram: "About 10 minutes", word: "About 3 minutes", hive: "Play as long as you like", box: "About 8 minutes" };
  const COLORS = { sum: "#8fd8b8", sudoku: "#ffcb57", nonogram: "#bcaeff", word: "#8cc8ff", hive: "#ffa47e", box: "#ff9ec4" };
  const INK = "#121212";
  function icon(game) {
    const frame = `<rect x="2" y="2" width="44" height="44" rx="10" fill="${COLORS[game]}" stroke="${INK}" stroke-width="3"/>`;
    const art = {
      sum: `<path d="M10 24h12M16 18v12M27 20.5h11M27 27.5h11" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
      sudoku: `<path d="M24 3.5v41M3.5 17.3h41M3.5 30.7h41" stroke="${INK}" stroke-width="2.5"/><rect x="24" y="17.3" width="20.5" height="13.4" fill="${INK}"/>`,
      nonogram: [[0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [1, 3], [2, 1], [2, 2], [3, 0], [3, 3]]
        .map(([r, c]) => `<rect x="${10 + c * 7.5}" y="${10 + r * 7.5}" width="6.5" height="6.5" rx="1" fill="${INK}"/>`).join(""),
      word: [0, 1, 2].map((i) => `<rect x="${9 + i * 10.5}" y="18" width="9" height="12" rx="1.5" fill="${i === 1 ? INK : "#fff"}" stroke="${INK}" stroke-width="2"/>`).join(""),
      hive: `<path d="M24 12.5l9.5 5.5v11L24 34.5 14.5 29V18z" fill="${INK}"/><path d="M24 17.5l5 3v6l-5 3-5-3v-6z" fill="#fff"/>`,
      box: `<rect x="13" y="13" width="22" height="22" fill="#fff" stroke="${INK}" stroke-width="3"/><path d="M13 20L35 28M24 13L18 35" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
    }[game];
    return `<svg class="icon" viewBox="0 0 48 48" aria-hidden="true">${frame}${art}</svg>`;
  }

  // Played, solve rate, current and longest streak, from this browser's history.
  function stats(game) {
    const days = load()[game] || {};
    const keys = Object.keys(days).sort();
    let max = 0, run = 0, prev = null;
    for (const k of keys) {
      if (days[k].solved) run = prev && days[prev].solved && addDays(prev, 1) === k ? run + 1 : 1;
      else run = 0;
      max = Math.max(max, run);
      prev = k;
    }
    const solved = keys.filter((k) => days[k].solved).length;
    return { played: keys.length, pct: keys.length ? Math.round((solved / keys.length) * 100) : 0, current: streak(game), max };
  }

  // The game clock in the toolbar. Starts on the first move, pauses with the pause
  // screen or when the tab is hidden, and stops when the puzzle is finished.
  const clock = {
    secs: 0, running: false, paused: false, done: false, t: null,
    start() {
      if (this.running || this.done) return;
      this.running = true;
      this.t = setInterval(() => { if (!this.paused) { this.secs++; this.show(); } }, 1000);
    },
    stop() { this.done = true; this.running = false; clearInterval(this.t); this.show(); },
    set(s) { this.secs = s; this.show(); },
    show() {
      const el = root.document.getElementById("timer");
      if (el) el.textContent = fmtTime(this.secs);
      const b = root.document.getElementById("clock");
      if (b) b.classList.toggle("live", this.running && !this.paused);
    },
    pause() {
      if (!this.running || this.paused) return;
      this.paused = true; this.show();
      openOverlay("pause", `${icon(Mint.game)}<h2>Your game is paused.</h2><p class="tag">Ready to play?</p>
        <button class="btn p" data-close>Resume</button><div class="meta"><b>${fmtTime(this.secs)}</b>on the clock</div>`,
        () => { this.paused = false; this.show(); });
    },
  };

  // Full-screen colored overlay (splash and pause share it).
  function openOverlay(kind, html, onClose) {
    const el = root.document.getElementById("splash");
    if (!el) return;
    el.className = "splash " + kind;
    el.innerHTML = html;
    el.hidden = false;
    root.document.body.classList.add("splashing");
    const close = () => {
      el.hidden = true;
      root.document.body.classList.remove("splashing");
      if (onClose) onClose();
    };
    el.querySelectorAll("[data-close]").forEach((b) => (b.onclick = close));
    const first = el.querySelector("button");
    if (first) first.focus({ preventScroll: true });
    return close;
  }

  // Centered card over a dimmed page. Esc, the ✕ or the backdrop closes it.
  let closeModal = null;
  function modal(html, cls = "") {
    if (closeModal) closeModal();
    const d = root.document;
    const wrap = d.createElement("div");
    wrap.className = "modal " + cls;
    wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><button class="x" aria-label="Close">✕</button>${html}</div>`;
    d.body.appendChild(wrap);
    d.body.classList.add("modaling");
    const last = d.activeElement;
    const onKey = (e) => { if (e.key === "Escape") closeModal(); };
    closeModal = () => {
      wrap.remove();
      d.body.classList.remove("modaling");
      d.removeEventListener("keydown", onKey);
      clearInterval(wrap._tick);
      closeModal = null;
      if (last && last.focus) last.focus({ preventScroll: true });
    };
    wrap.onclick = (e) => { if (e.target === wrap || e.target.closest(".x,[data-close]")) closeModal(); };
    d.addEventListener("keydown", onKey);
    wrap.querySelector(".x").focus({ preventScroll: true });
    return wrap;
  }

  function help(game) {
    const how = root.document.querySelector(".how");
    modal(`<div class="mh">${icon(game)}<div><h2>How to play</h2><p>${TAGS[game]}</p></div></div>
      <ul class="how">${how ? how.innerHTML : ""}</ul>
      <p class="fine">A new puzzle every day at midnight, your time. Every past puzzle stays free in the archive.</p>
      <button class="btn p wide" data-close>Got it</button>`, "help");
    try { root.localStorage.setItem("mint:seen:" + game, "1"); } catch {}
  }

  function untilMidnight() {
    const now = new Date(), next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((next - now) / 1000));
    const p = (n) => String(n).padStart(2, "0");
    return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
  }

  // Your stats, plus "Next puzzle in" and the games still to play today.
  function statsHtml(game) {
    const s = stats(game);
    const cells = [["Played", s.played], ["Solved %", s.pct], ["Current streak", s.current], ["Max streak", s.max]];
    const next = Object.keys(NAMES).filter((g) => g !== game && !result(g, today()));
    const isToday = pageDate() === today();
    return `<div class="sh">Your statistics</div>
      <div class="kpis">${cells.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join("")}</div>
      ${isToday
        ? `<div class="next"><span>Next puzzle in</span><b data-count>${untilMidnight()}</b></div>`
        : `<div class="next"><span>You’re playing No. ${puzzleNumber(pageDate())}</span><a href="/${game}/">Play today’s →</a></div>`}
      ${pastLinks(game)}${appLine()}
      ${next.length ? `<div class="sh">Up next</div><div class="upnext">${next.map((g) => `<a href="/${g}/" style="--c:${COLORS[g]}">${icon(g)}<span><b>${NAMES[g]}</b>${TAGS[g]}</span><i>Play</i></a>`).join("")}</div>` : ""}`;
  }
  // "Can't wait for tomorrow?" links: yesterday (if unplayed) and a random past day.
  function pastLinks(game) {
    const y = addDays(today(), -1), rnd = randomPastDay(game);
    if (!rnd) return "";
    const links = [];
    if (y >= LAUNCH && !result(game, y) && pageDate() !== y) links.push(`<a href="/${game}/${y}">Play yesterday’s</a>`);
    links.push(`<a href="/${game}/${rnd}">Random past puzzle</a>`, `<a href="/archive">Archive</a>`);
    return `<div class="next past"><span>Want another?</span><span class="links">${links.join("")}</span></div>`;
  }

  // On iPhone/iPad Safari, once the Worker has added the App Store banner tag (the app is
  // live), point players at the app. Never inside the app itself.
  function appLine() {
    const d = root.document;
    if (!d || root.ReactNativeWebView || !/iPhone|iPad|iPod/.test(root.navigator.userAgent)) return "";
    const tag = d.querySelector('meta[name="apple-itunes-app"]');
    const id = tag && (tag.content.match(/app-id=(\d+)/) || [])[1];
    if (!id) return "";
    return `<a class="appline" href="https://apps.apple.com/app/id${id}" onclick="typeof gtag==='function'&&gtag('event','app_click',{placement:'result'})"><b>Get Mint Puzzles for iPhone</b><span>All six games offline, streak reminders, Game Center.</span></a>`;
  }

  function tickCountdown(wrap) {
    const el = wrap.querySelector("[data-count]");
    if (el) wrap._tick = setInterval(() => (el.textContent = untilMidnight()), 1000);
  }
  function showStats(game) {
    const w = modal(`<div class="mh">${icon(game)}<div><h2>${NAMES[game]}</h2><p>${prettyDate(pageDate())} · No. ${puzzleNumber(pageDate())}</p></div></div>${statsHtml(game)}`, "stats");
    tickCountdown(w);
  }

  // Toolbar buttons and auto-pause. Called once per game page by splash().
  function toolbar(game) {
    const d = root.document, $ = (id) => d.getElementById(id);
    if ($("clock")) $("clock").onclick = () => clock.pause();
    if ($("helpBtn")) $("helpBtn").onclick = () => help(game);
    if ($("statsBtn")) $("statsBtn").onclick = () => (lastDone ? openResult() : showStats(game));
    d.addEventListener("visibilitychange", () => { if (d.hidden) clock.pause(); });
    d.addEventListener("keydown", (e) => { if (e.key === "Escape" && !closeModal && clock.running && !clock.paused) clock.pause(); });
  }

  // Full-color welcome screen. Stays up until the player taps Play.
  function splash(game) {
    Mint.game = game;
    const d = root.document;
    d.querySelectorAll("[data-icon]").forEach((x) => (x.innerHTML = icon(x.dataset.icon)));
    toolbar(game);
    const date = pageDate();
    const r = result(game, date);
    const s = streak(game);
    const line = r ? (r.solved ? "You solved this one." : "You’ve played this one.")
      : s ? `You’re on a ${s}-day streak. Keep it going.` : LENGTHS[game] + ".";
    openOverlay("welcome", `<a class="home" href="/">‹ All puzzles</a>
      <div class="art">${icon(game)}</div><h1>${NAMES[game]}</h1><p class="tag">${TAGS[game]}</p>
      <div class="cta"><button class="btn p" data-close id="splashGo">${r ? "See your result" : date === today() ? "Play" : "Play this day"}</button>
      <button class="btn o" id="splashHow">How to play</button></div>
      <p class="line">${line}</p>
      <div class="meta"><b>${prettyDate(date)}</b>No. ${puzzleNumber(date)}</div>
      <div class="free">Free to play · No account</div>`, () => {
      if (r) { if (lastDone) openResult(); return; }
      let seen = false;
      try { seen = !!root.localStorage.getItem("mint:seen:" + game); } catch {}
      if (!seen) help(game);
    });
    d.getElementById("splashHow").onclick = () => help(game);
  }

  // Result: an inline card under the board, and a modal the moment a puzzle is finished.
  // stats = [[label, value], ...] for this puzzle.
  let lastDone = null;
  function resultHtml({ eyebrow, title, stats: rows }, compact) {
    return `<div class="rh" style="--c:${COLORS[Mint.game]}">${icon(Mint.game)}<div class="eyebrow">${eyebrow}</div><b>${title}</b>
      <div class="stats">${rows.map(([k, v]) => `<div><span>${v}</span>${k}</div>`).join("")}</div></div>
      <div class="row acts"><button class="btn p share">Share your result</button>${compact ? `<button class="btn o more">See stats</button>` : ""}</div>`;
  }
  function openResult() {
    const w = modal(resultHtml(lastDone) + statsHtml(Mint.game), "result");
    w.querySelector(".share").onclick = (e) => share(lastDone.shareText, e.target);
    tickCountdown(w);
  }
  function renderDone(el, opts) {
    lastDone = opts;
    clock.stop();
    el.hidden = false;
    el.innerHTML = resultHtml(opts, true);
    el.querySelector(".share").onclick = (e) => share(opts.shareText, e.target);
    el.querySelector(".more").onclick = openResult;
    // Restored results stay quiet behind the splash; a puzzle just finished celebrates.
    if (!root.document.body.classList.contains("splashing")) {
      root.document.body.classList.add("won");
      setTimeout(openResult, 650);
    }
  }

  async function share(text, btn) {
    const track = (method) => {
      if (typeof root.gtag === "function") root.gtag("event", "share", { method, content_type: Mint.game, item_id: pageDate() });
    };
    try {
      if (root.navigator.share && /Mobi|Android|iPhone/.test(root.navigator.userAgent)) {
        await root.navigator.share({ text });
        track("native");
        return;
      }
      await root.navigator.clipboard.writeText(text);
      track("copy");
      const was = btn.textContent;
      btn.textContent = "Copied to clipboard";
      setTimeout(() => (btn.textContent = was), 1600);
    } catch {}
  }

  root.Mint = {
    LAUNCH, rng, hash, today, addDays, prettyDate, puzzleNumber, pageDate, shareUrl, randomPastDay,
    save, result, streak, stats, fmtTime, renderMore, share, icon, splash, renderDone, NAMES,
    clock, help, showStats,
    sumPuzzle, sudokuPuzzle, sudokuCount, nonogramPuzzle, lineSolve, runs,
    words, isWord, wordPuzzle, hivePuzzle, hiveScore, boxPuzzle, modal,
  };
})(typeof window !== "undefined" ? window : globalThis);
