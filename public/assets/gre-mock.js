// Mint GRE mock tests: full-length, timed, section-level adaptive like the current GRE.
// Order: Analytical Writing (30 min) → Verbal 1 (12 q, 18 min) → Verbal 2 (15 q, 23 min)
//        → Quant 1 (12 q, 21 min) → Quant 2 (15 q, 26 min).
// Section 2 of each measure is the harder set when section 1 had >= HARD_AT right.
// In-progress state survives a reload (localStorage "gre:mock:<id>"); finished attempts go to
// "gre:mock:hist". Scores are a rough estimate from our own questions, NOT ETS's scale.
(function () {
  const HARD_AT = 7;
  const MOCKS = [
    {
      id: "m1",
      title: "Mock Test 1",
      essay: {
        claim: "Communities should spend more on preserving historic buildings than on constructing new ones.",
        task: "Write a response in which you discuss how far you agree or disagree with the claim. Explain your reasoning, and consider ways in which the claim might or might not hold true.",
      },
      verbal: {
        s1: ["v3", "v7", "v8", "v9", "v11", "v12", "v15", "v21", "v17", "v18", "v19", "v20"],
        easy: ["v1", "v2", "v5", "v6", "v38", "v39", "v42", "v13", "v14", "v16", "v40", "v41", "v22", "v23", "v24"],
        hard: ["v4", "v25", "v37", "v10", "v26", "v27", "v28", "v29", "v30", "v31", "v32", "v33", "v34", "v35", "v36"],
      },
      quant: {
        s1: ["q2", "q4", "q6", "q7", "q15", "q16", "q17", "q19", "q22", "q23", "q25", "q28"],
        easy: ["q1", "q3", "q5", "q9", "q10", "q11", "q12", "q13", "q14", "q26", "q27", "q32", "q33", "q34", "q35"],
        hard: ["q8", "q37", "q42", "q18", "q20", "q21", "q24", "q38", "q41", "q29", "q30", "q31", "q40", "q36", "q39"],
      },
    },
  ];
  const STAGES = [
    { key: "aw", name: "Analytical Writing", min: 30 },
    { key: "v1", name: "Verbal Reasoning", measure: "verbal", sec: 1, min: 18 },
    { key: "v2", name: "Verbal Reasoning", measure: "verbal", sec: 2, min: 23 },
    { key: "q1", name: "Quantitative Reasoning", measure: "quant", sec: 1, min: 21 },
    { key: "q2", name: "Quantitative Reasoning", measure: "quant", sec: 2, min: 26 },
  ];
  const BY_ID = Object.fromEntries(GRE_BANK.map((q) => [q.id, q]));
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const ev = (name, p) => { try { if (window.gtag) gtag("event", name, p); } catch (e) {} };

  let mock, st, tick;
  const key = () => "gre:mock:" + mock.id;
  const persist = () => store.set(key(), st);

  function ids(stage) {
    const m = mock[stage.measure];
    return stage.sec === 1 ? m.s1 : m[st.path[stage.measure]];
  }
  function rawRight(list) { return list.filter((id) => GRE.grade(BY_ID[id], st.picks[id])).length; }
  // Rough 130–170 estimate. Easy second section tops out at 155, like a real lower-tier route.
  function estimate(measure) {
    const all = mock[measure].s1.concat(mock[measure][st.path[measure]]);
    const r = rawRight(all), n = all.length;
    return { r, n, est: st.path[measure] === "hard" ? 140 + Math.round((r * 30) / n) : 130 + Math.round((r * 25) / n) };
  }

  // ---------------------------------------------------------------- hub
  function hub() {
    clearInterval(tick);
    document.body.classList.remove("in-test");
    const hist = store.get("gre:mock:hist", []);
    $("mock").innerHTML = MOCKS.map((m) => {
      const live = store.get("gre:mock:" + m.id, null);
      const last = hist.filter((h) => h.id === m.id).slice(-1)[0];
      return `<div class="qcard mockcard">
        <div class="qmeta"><span>Full-length · section-adaptive</span><span>1 hr 58 min</span></div>
        <h2 style="margin:0 0 6px">${m.title}</h2>
        <p class="stem" style="margin:0 0 10px">1 Issue essay + 27 Verbal + 27 Quant questions, timed like the real test. Your second Verbal and Quant sections get harder or easier based on how the first one goes.</p>
        ${last ? `<p class="hint">Last attempt ${new Date(last.at).toLocaleDateString()}: Verbal ≈ ${last.v}, Quant ≈ ${last.q}</p>` : ""}
        <label class="hint" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="skipaw-${m.id}"> Skip the essay (start with Verbal)</label>
        <div class="actions">${live && live.stage < STAGES.length ? `<button class="btn p" data-resume="${m.id}">Resume</button><button class="btn o" data-start="${m.id}">Start over</button>` : `<button class="btn p" data-start="${m.id}">Start ${m.title}</button>`}</div>
      </div>`;
    }).join("");
    document.querySelectorAll("[data-start]").forEach((b) => b.onclick = () => start(b.dataset.start, $("skipaw-" + b.dataset.start).checked));
    document.querySelectorAll("[data-resume]").forEach((b) => b.onclick = () => { mock = MOCKS.find((m) => m.id === b.dataset.resume); st = store.get(key()); run(); });
  }

  function start(id, skipEssay) {
    mock = MOCKS.find((m) => m.id === id);
    st = { stage: skipEssay ? 1 : 0, idx: 0, picks: {}, marked: {}, path: {}, essay: "", ends: 0, review: false, startedAt: Date.now(), skipEssay };
    st.ends = Date.now() + STAGES[st.stage].min * 60000;
    persist();
    ev("gre_mock_start", { mock_id: id, skip_essay: skipEssay });
    run();
  }

  // ---------------------------------------------------------------- test screen
  function run() {
    document.body.classList.add("in-test");
    window.scrollTo(0, 0);
    if (st.stage >= STAGES.length) return results();
    clearInterval(tick);
    tick = setInterval(timer, 500);
    draw();
  }
  function timer() {
    const left = Math.max(0, st.ends - Date.now());
    const el = $("mt-time");
    if (el) el.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}`;
    if (el) el.classList.toggle("low", left < 60000);
    if (left <= 0) endSection(true);
  }
  function bar(stage, right) {
    const n = STAGES.filter((s, i) => !(st.skipEssay && i === 0)).length;
    const pos = st.stage - (st.skipEssay ? 1 : 0) + 1;
    return `<div class="mt-bar"><div><b>${mock.title}</b> · ${stage.name}${stage.sec ? "" : ""} · Section ${pos} of ${n}</div>
      <div class="mt-r">${right}<span class="mt-timer"><span id="mt-time"></span><button class="mt-link" id="mt-hide">${st.hideTime ? "Show" : "Hide"} time</button></span></div></div>`;
  }
  function draw() {
    const stage = STAGES[st.stage];
    if (stage.key === "aw") return drawEssay(stage);
    const list = ids(stage);
    if (st.review) return drawReview(stage, list);
    const id = list[st.idx];
    $("mock").innerHTML = bar(stage, `<span>Question ${st.idx + 1} of ${list.length}</span>`) +
      `<div id="mt-q"></div>
      <div class="mt-nav">
        <button class="btn o" id="mt-back" ${st.idx === 0 ? "disabled" : ""}>Back</button>
        <button class="btn o ${st.marked[id] ? "on" : ""}" id="mt-mark">${st.marked[id] ? "Unmark" : "Mark"}</button>
        <button class="btn o" id="mt-rev">Review</button>
        <button class="btn p" id="mt-next">${st.idx === list.length - 1 ? "Review section" : "Next"}</button>
      </div>`;
    GRE.render($("mt-q"), BY_ID[id], { mode: "exam", label: `Question ${st.idx + 1}`, initial: st.picks[id], onPick: (p) => { st.picks[id] = p; persist(); } });
    wireTimer();
    $("mt-back").onclick = () => { st.idx--; persist(); draw(); };
    $("mt-next").onclick = () => { if (st.idx === list.length - 1) st.review = true; else st.idx++; persist(); draw(); window.scrollTo(0, 0); };
    $("mt-mark").onclick = () => { st.marked[id] = !st.marked[id]; persist(); draw(); };
    $("mt-rev").onclick = () => { st.review = true; persist(); draw(); };
  }
  function wireTimer() {
    $("mt-time").style.visibility = st.hideTime ? "hidden" : "visible";
    $("mt-hide").onclick = () => { st.hideTime = !st.hideTime; persist(); $("mt-time").style.visibility = st.hideTime ? "hidden" : "visible"; $("mt-hide").textContent = (st.hideTime ? "Show" : "Hide") + " time"; };
    timer();
  }
  function drawReview(stage, list) {
    const done = list.filter((id) => GRE.answered(BY_ID[id], st.picks[id])).length;
    $("mock").innerHTML = bar(stage, `<span>Review</span>`) + `<div class="qcard">
      <h2 style="margin:0 0 6px">Section review</h2>
      <p class="hint">${done} of ${list.length} answered${Object.keys(st.marked).filter((k) => st.marked[k] && list.includes(k)).length ? " · ⚑ = marked" : ""}. Wrong answers cost nothing, so answer every question before you end the section.</p>
      <div class="mt-grid">${list.map((id, i) => {
        const a = GRE.answered(BY_ID[id], st.picks[id]);
        return `<button class="mt-cell ${a ? "a" : ""}" data-go="${i}">${i + 1}${st.marked[id] ? " ⚑" : ""}<small>${a ? "Answered" : "Not answered"}</small></button>`;
      }).join("")}</div>
      <div class="actions"><button class="btn o" id="mt-ret">Return to question ${st.idx + 1}</button><button class="btn p" id="mt-end">End section</button></div></div>`;
    wireTimer();
    document.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => { st.idx = +b.dataset.go; st.review = false; persist(); draw(); });
    $("mt-ret").onclick = () => { st.review = false; persist(); draw(); };
    $("mt-end").onclick = () => {
      const left = list.length - done;
      if (confirm(left ? `${left} question${left > 1 ? "s are" : " is"} unanswered. End this section anyway? You can't come back to it.` : "End this section? You can't come back to it.")) endSection(false);
    };
  }
  function drawEssay(stage) {
    $("mock").innerHTML = bar(stage, `<span id="mt-wc"></span>`) + `<div class="qcard">
      <div class="qmeta"><span>Analyze an Issue</span><span>30 minutes</span></div>
      <p class="stem"><b>${esc(mock.essay.claim)}</b></p>
      <p class="hint" style="margin:0 0 12px">${esc(mock.essay.task)}</p>
      <textarea id="mt-essay" class="mt-essay" spellcheck="false" placeholder="Type your response here. (Like the real test, there is no spell check.)"></textarea>
      <div class="actions"><button class="btn p" id="mt-end">End section</button></div></div>`;
    const ta = $("mt-essay");
    ta.value = st.essay || "";
    const wc = () => { $("mt-wc").textContent = (ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0) + " words"; };
    ta.oninput = () => { st.essay = ta.value; persist(); wc(); };
    wc();
    wireTimer();
    $("mt-end").onclick = () => { if (confirm("End the writing section? You can't come back to it.")) endSection(false); };
  }

  function endSection(timeUp) {
    const stage = STAGES[st.stage];
    if (stage.sec === 1) st.path[stage.measure] = rawRight(mock[stage.measure].s1) >= HARD_AT ? "hard" : "easy";
    st.stage++;
    st.idx = 0;
    st.review = false;
    if (st.stage < STAGES.length) st.ends = Date.now() + STAGES[st.stage].min * 60000;
    persist();
    clearInterval(tick);
    if (st.stage >= STAGES.length) return finish();
    const next = STAGES[st.stage];
    $("mock").innerHTML = `<div class="qcard" style="text-align:center;padding:40px 20px">
      <h2 style="margin:0 0 8px">${timeUp ? "Time’s up for that section" : "Section complete"}</h2>
      <p class="stem">Next: <b>${next.name}</b>, ${next.min} minutes. The timer starts when you continue.</p>
      <div class="actions" style="justify-content:center"><button class="btn p" id="mt-go">Continue</button></div></div>`;
    $("mt-go").onclick = () => { st.ends = Date.now() + next.min * 60000; persist(); run(); };
  }

  function finish() {
    const v = estimate("verbal"), q = estimate("quant");
    const hist = store.get("gre:mock:hist", []);
    hist.push({ id: mock.id, at: Date.now(), v: v.est, q: q.est, vr: v.r, qr: q.r, path: st.path });
    store.set("gre:mock:hist", hist.slice(-20));
    for (const id of Object.keys(st.picks)) {
      const all = store.get("gre:v1", {});
      all[id] = { ok: GRE.grade(BY_ID[id], st.picks[id]), at: Date.now() };
      store.set("gre:v1", all);
    }
    ev("gre_mock_finish", { mock_id: mock.id, verbal: v.est, quant: q.est });
    results();
  }

  // ---------------------------------------------------------------- results
  function results() {
    clearInterval(tick);
    document.body.classList.remove("in-test");
    const v = estimate("verbal"), q = estimate("quant");
    const words = (st.essay || "").trim() ? st.essay.trim().split(/\s+/).length : 0;
    const sec = (title, list) => `<h3>${title}</h3>` + list.map((id, i) => `<div id="rv-${id}" data-n="${i + 1}"></div>`).join("");
    $("mock").innerHTML = `<div class="qcard">
      <div class="qmeta"><span>${mock.title} · results</span><span>${new Date().toLocaleDateString()}</span></div>
      <section class="facts" style="grid-template-columns:repeat(3,1fr)">
        <div><b>≈ ${v.est}</b><span>Verbal estimate · ${v.r}/${v.n} right · ${st.path.verbal} 2nd section</span></div>
        <div><b>≈ ${q.est}</b><span>Quant estimate · ${q.r}/${q.n} right · ${st.path.quant} 2nd section</span></div>
        <div><b>${st.skipEssay ? "Skipped" : words + " words"}</b><span>Issue essay (self-score below)</span></div>
      </section>
      <p class="hint">Estimates come from our own questions and a simple conversion, not from ETS’s scoring. Use them to track progress between mocks; for an official-style score, take ETS’s free POWERPREP tests.</p>
      <div class="actions"><button class="btn p" id="mt-again">Back to mock tests</button><a class="btn o" href="/gre/practice/?s=${v.r / v.n < q.r / q.n ? "verbal" : "quant"}">Practice your weaker section</a></div></div>
      ${st.skipEssay ? "" : `<h2>Your essay</h2><div class="qcard"><p class="stem"><b>${esc(mock.essay.claim)}</b></p><div class="mt-essayout">${esc(st.essay || "(empty)")}</div>
      <p class="hint"><b>Self-check (what high-scoring Issue essays do):</b> take a clear position on the claim; support it with specific, relevant reasons and examples; consider where the claim might not hold; organize ideas logically with clear transitions; and write in clear, varied sentences with few errors. Around 400–600 well-organized words is a common length for strong responses, but reasoning matters more than length.</p></div>`}
      <h2>Review every question</h2>
      ${sec("Verbal · section 1", mock.verbal.s1)}${sec(`Verbal · section 2 (${st.path.verbal})`, mock.verbal[st.path.verbal])}
      ${sec("Quant · section 1", mock.quant.s1)}${sec(`Quant · section 2 (${st.path.quant})`, mock.quant[st.path.quant])}`;
    for (const el of document.querySelectorAll("[id^=rv-]")) {
      const id = el.id.slice(3);
      GRE.render(el, BY_ID[id], { mode: "review", label: "Question " + el.dataset.n, initial: st.picks[id] });
    }
    $("mt-again").onclick = () => { store.del(key()); hub(); window.scrollTo(0, 0); };
  }

  // Leaving mid-section keeps the clock running, like the real test; the page warns first.
  window.addEventListener("beforeunload", (e) => { if (document.body.classList.contains("in-test") && st && st.stage < STAGES.length) { e.preventDefault(); e.returnValue = ""; } });
  hub();
})();
