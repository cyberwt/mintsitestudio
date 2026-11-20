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

  function render(el, q, opts = {}) {
    const multi = q.t === "ma" || q.t === "se" || (q.t === "rc" && q.multi);
    let pick = q.t === "tc" ? q.blanks.map(() => -1) : multi ? new Set() : -1;
    let done = false;

    let body = "";
    if (q.p) body += `<div class="passage"><b>Passage: ${esc(q.p.title)}</b>${esc(q.p.text)}</div>`;
    if (q.t === "qc") {
      if (q.given) body += `<p class="given">${q.given}</p>`;
      body += `<div class="qcab"><div><b>Quantity A</b>${q.a}</div><div><b>Quantity B</b>${q.b}</div></div>`;
    } else if (q.t === "tc") {
      let i = 0;
      body += `<p class="stem">${esc(q.q).replace(/(\((?:i|ii|iii)\) )?___/g, () => `<span class="blank" data-b="${i}">${q.blanks.length > 1 ? `(${ROMAN[i++]})` : (i++, "&nbsp;")}</span>`)}</p>`;
    } else {
      body += `<p class="stem">${q.q}</p>`;
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
    el.innerHTML = `<div class="qcard">
      <div class="qmeta"><span>${opts.label || (q.s === "quant" ? "Quant" : "Verbal")} · ${TYPE[q.t]}</span><span>${esc(q.topic)}</span></div>
      ${body}${hint ? `<p class="hint">${hint}</p>` : ""}
      <div class="actions"><button type="button" class="btn p" data-act="check" disabled>Check answer</button>${opts.next ? `<button type="button" class="btn o" data-act="next">${opts.nextLabel || "Next question"}</button>` : ""}</div>
      <div class="out"></div></div>`;

    const checkBtn = el.querySelector('[data-act="check"]');
    const input = el.querySelector(".ne input");
    function ready() {
      return q.t === "tc" ? pick.every((p) => p >= 0) : q.t === "ne" ? !isNaN(parseNum(input.value)) : multi ? (q.t === "se" ? pick.size === 2 : pick.size > 0) : pick >= 0;
    }
    function paint() {
      el.querySelectorAll(".opt").forEach((b) => {
        const i = +b.dataset.i;
        const on = q.t === "tc" ? pick[+b.dataset.b] === i : multi ? pick.has(i) : pick === i;
        b.classList.toggle("on", on);
      });
      if (q.t === "tc") el.querySelectorAll(".blank").forEach((s) => { const b = +s.dataset.b; if (pick[b] >= 0) s.textContent = q.blanks[b][pick[b]]; });
      checkBtn.disabled = done || !ready();
    }
    el.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => {
      if (done) return;
      const i = +b.dataset.i;
      if (q.t === "tc") pick[+b.dataset.b] = i;
      else if (multi) { if (pick.has(i)) pick.delete(i); else if (q.t !== "se" || pick.size < 2) pick.add(i); }
      else pick = i;
      paint();
    }));
    if (input) {
      input.addEventListener("input", paint);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !checkBtn.disabled) checkBtn.click(); });
    }
    checkBtn.addEventListener("click", () => {
      if (done || !ready()) return;
      done = true;
      let ok;
      if (q.t === "ne") {
        const v = parseNum(input.value);
        ok = Math.abs(v - q.ans) < 1e-9 * Math.max(1, Math.abs(q.ans));
        input.classList.add(ok ? "good" : "bad");
        input.disabled = true;
      } else {
        const want = q.t === "tc" ? null : new Set([].concat(q.ans));
        if (q.t === "tc") ok = pick.every((p, b) => p === q.ans[b]);
        else if (multi) ok = pick.size === want.size && [...pick].every((i) => want.has(i));
        else ok = want.has(pick);
        el.querySelectorAll(".opt").forEach((b) => {
          const i = +b.dataset.i;
          const right = q.t === "tc" ? q.ans[+b.dataset.b] === i : want.has(i);
          const chosen = b.classList.contains("on");
          if (right) b.classList.add("good");
          else if (chosen) b.classList.add("bad");
          b.disabled = true;
        });
      }
      const answer = q.t === "ne" ? (q.frac ? fracText(q.ans) : String(q.ans)) :
        q.t === "tc" ? q.ans.map((a, b) => q.blanks[b][a]).join(", ") :
        [].concat(q.ans).map((i) => L[i]).join(", ");
      el.querySelector(".out").innerHTML = `<div class="verdict ${ok ? "good" : "bad"}"><b class="v">${ok ? "Correct" : "Not quite"}</b>${ok ? "" : `Answer: <b>${answer}</b>. `}${q.ex}</div>`;
      checkBtn.disabled = true;
      save(q.id, ok);
      if (opts.onAnswer) opts.onAnswer(ok);
    });
    const nextBtn = el.querySelector('[data-act="next"]');
    if (nextBtn) nextBtn.addEventListener("click", () => opts.next());
    paint();
  }

  function fracText(v) {
    for (let d = 1; d <= 1000; d++) { const n = Math.round(v * d); if (Math.abs(n / d - v) < 1e-9) return `${n}/${d}`; }
    return String(v);
  }

  window.GRE = { render, load, daily, today, parseNum, TYPE };
})();
