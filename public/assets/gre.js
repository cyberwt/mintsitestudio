// Mint GRE practice engine. Renders one question from window.GRE_BANK into a container,
// grades it the way the GRE does (all-or-nothing, no partial credit) and saves results
// in this browser only (localStorage "gre:v1" = { [id]: { ok, at } }).
(function () {
  const KEY = "gre:v1";
  const L = "ABCDEFGHIJ";
  const ROMAN = ["i", "ii", "iii"];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function save(id, ok) {
    const all = load();
    all[id] = { ok, at: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {}
    try { if (window.gtag) gtag("event", "gre_answer", { question_id: id, correct: ok }); } catch (e) {}
  }

  // Fractions or decimals: "2/15", "12/90", "0.1333". Equivalent fractions count, as on the test.
  function parseNum(s) {
    s = String(s).trim().replace(/,/g, "");
    const f = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
    if (f) return Number(f[2]) === 0 ? NaN : Number(f[1]) / Number(f[2]);
    return s === "" ? NaN : Number(s);
  }

  // Local calendar day, so the daily question flips at the reader's midnight.
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  // Daily question: a fixed shuffle of the ids walked one per day, so no repeat until the bank runs out.
  function daily(date) {
    const ids = GRE_BANK.map((q) => q.id).sort((a, b) => hash("gre:" + a) - hash("gre:" + b));
    const [y, m, d] = (date || today()).split("-").map(Number);
    const n = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
    return GRE_BANK.find((q) => q.id === ids[n % ids.length]);
  }

  const TYPE = { qc: "Quantitative comparison", mc: "Multiple choice", ma: "Select all that apply", ne: "Numeric entry", tc: "Text completion", se: "Sentence equivalence", rc: "Reading comprehension" };

  // pick shapes: one answer -> index (-1 = none); select-all / sentence equivalence -> array;
  // text completion -> one index per blank; numeric entry -> the typed string.
  function isMulti(q) { return q.t === "ma" || q.t === "se" || (q.t === "rc" && !!q.multi); }
  function answered(q, p) {
    if (p == null) return false;
    if (q.t === "tc") return p.every((x) => x >= 0);
    if (q.t === "ne") return !isNaN(parseNum(p));
    if (isMulti(q)) return q.t === "se" ? p.length === 2 : p.length > 0;
    return p >= 0;
  }
  function grade(q, p) {
    if (!answered(q, p)) return false;
    if (q.t === "ne") return Math.abs(parseNum(p) - q.ans) < 1e-9 * Math.max(1, Math.abs(q.ans));
    if (q.t === "tc") return p.every((x, b) => x === q.ans[b]);
    if (isMulti(q)) { const w = [].concat(q.ans); return p.length === w.length && p.every((i) => w.includes(i)); }
    return p === q.ans;
  }
  function answerText(q) {
    return q.t === "ne" ? (q.frac ? fracText(q.ans) : String(q.ans)) :
      q.t === "tc" ? q.ans.map((a, b) => q.blanks[b][a]).join(", ") :
      [].concat(q.ans).map((i) => L[i]).join(", ");
  }

  // opts.mode: "practice" (check button, instant feedback, saves result), "exam" (no feedback;
  // reports every change through opts.onPick) or "review" (shows opts.initial graded, read-only).
  function render(el, q, opts = {}) {
    const mode = opts.mode || "practice";
    const multi = isMulti(q);
    const blankPick = () => (q.t === "tc" ? q.blanks.map(() => -1) : q.t === "ne" ? "" : multi ? [] : -1);
    let pick = opts.initial != null ? JSON.parse(JSON.stringify(opts.initial)) : blankPick();
    let done = mode === "review";

    let body = "";
    if (q.p) body += `<div class="passage"><b>Passage: ${esc(q.p.title)}</b>${esc(q.p.text)}</div>`;
    if (q.t === "qc") {
      if (q.given) body += `<p class="given">${q.given}</p>`;
      body += `<div class="qcab"><div><b>Quantity A</b>${q.a}</div><div><b>Quantity B</b>${q.b}</div></div>`;
    } else if (q.t === "tc") {
      let i = 0;
      body += `<p class="stem">${esc(q.q).replace(/(\((?:i|ii|iii)\) )?___/g, () => `<span class="blank" data-b="${i}">${q.blanks.length > 1 ? `(${ROMAN[i++]})` : (i++, "&nbsp;")}</span>`)}</p>`;
    } else {
      body += `<div class="stem">${q.q}</div>`;
    }

    if (q.t === "tc") {
      body += `<div class="blanks" style="--n:${q.blanks.length}">${q.blanks.map((col, b) =>
        `<div class="col">${q.blanks.length > 1 ? `<b>Blank (${ROMAN[b]})</b>` : ""}<div class="opts">${col.map((w, i) =>
          `<button type="button" class="opt r" data-b="${b}" data-i="${i}"><span class="k">${L[i]}</span><span>${esc(w)}</span></button>`).join("")}</div></div>`).join("")}</div>`;
    } else if (q.t === "ne") {
      body += `<div class="ne"><input inputmode="decimal" autocomplete="off" aria-label="Your answer" placeholder="${q.frac ? "e.g. 3/8" : "Your answer"}"></div>`;
    } else {
      body += `<div class="opts">${q.c.map((c, i) => `<button type="button" class="opt ${multi ? "c" : "r"}" data-i="${i}"><span class="k">${L[i]}</span><span>${c}</span></button>`).join("")}</div>`;
    }
    const hint = q.t === "se" ? "Pick the two answers that each complete the sentence and give it the same meaning." :
      multi ? "Select every correct answer. No partial credit." :
      q.t === "tc" && q.blanks.length > 1 ? "Choose one word for each blank. Every blank must be right." :
      q.t === "ne" && q.frac ? "Enter a fraction such as 3/8. It doesn't have to be reduced." : "";
    const actions = mode === "practice"
      ? `<div class="actions"><button type="button" class="btn p" data-act="check" disabled>Check answer</button>${opts.next ? `<button type="button" class="btn o" data-act="next">${opts.nextLabel || "Next question"}</button>` : ""}</div>` : "";
    el.innerHTML = `<div class="qcard">
      <div class="qmeta"><span>${opts.label || (q.s === "quant" ? "Quant" : "Verbal")} · ${TYPE[q.t]}</span><span>${esc(q.topic)}</span></div>
      ${body}${hint ? `<p class="hint">${hint}</p>` : ""}${actions}
      <div class="out"></div></div>`;

    const checkBtn = el.querySelector('[data-act="check"]');
    const input = el.querySelector(".ne input");
    if (input) input.value = typeof pick === "string" ? pick : "";
    function paint() {
      el.querySelectorAll(".opt").forEach((b) => {
        const i = +b.dataset.i;
        b.classList.toggle("on", q.t === "tc" ? pick[+b.dataset.b] === i : multi ? pick.includes(i) : pick === i);
      });
      if (q.t === "tc") el.querySelectorAll(".blank").forEach((s) => { const b = +s.dataset.b; if (pick[b] >= 0) s.textContent = q.blanks[b][pick[b]]; });
      if (checkBtn) checkBtn.disabled = done || !answered(q, pick);
    }
    function changed() { paint(); if (opts.onPick) opts.onPick(JSON.parse(JSON.stringify(pick))); }
    el.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => {
      if (done) return;
      const i = +b.dataset.i;
      if (q.t === "tc") pick[+b.dataset.b] = i;
      else if (multi) { const k = pick.indexOf(i); if (k >= 0) pick.splice(k, 1); else if (q.t !== "se" || pick.length < 2) pick.push(i); }
      else pick = i;
      changed();
    }));
    if (input) {
      input.addEventListener("input", () => { pick = input.value; changed(); });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter" && checkBtn && !checkBtn.disabled) checkBtn.click(); });
    }
    function reveal() {
      const ok = grade(q, pick);
      if (input) { input.classList.add(ok ? "good" : "bad"); input.disabled = true; }
      el.querySelectorAll(".opt").forEach((b) => {
        const i = +b.dataset.i;
        const right = q.t === "tc" ? q.ans[+b.dataset.b] === i : [].concat(q.ans).includes(i);
        if (right) b.classList.add("good");
        else if (b.classList.contains("on")) b.classList.add("bad");
        b.disabled = true;
      });
      const head = ok ? "Correct" : answered(q, pick) ? "Not quite" : "Not answered";
      el.querySelector(".out").innerHTML = `<div class="verdict ${ok ? "good" : "bad"}"><b class="v">${head}</b>${ok ? "" : `Answer: <b>${answerText(q)}</b>. `}${q.ex}</div>`;
      return ok;
    }
    if (checkBtn) checkBtn.addEventListener("click", () => {
      if (done || !answered(q, pick)) return;
      done = true;
      const ok = reveal();
      checkBtn.disabled = true;
      save(q.id, ok);
      if (opts.onAnswer) opts.onAnswer(ok);
    });
    const nextBtn = el.querySelector('[data-act="next"]');
    if (nextBtn) nextBtn.addEventListener("click", () => opts.next());
    paint();
    if (mode === "review") reveal();
  }

  function fracText(v) {
    for (let d = 1; d <= 1000; d++) { const n = Math.round(v * d); if (Math.abs(n / d - v) < 1e-9) return `${n}/${d}`; }
    return String(v);
  }

  window.GRE = { render, grade, answered, load, daily, today, parseNum, TYPE };
})();
