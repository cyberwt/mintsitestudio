// Builds the Mint GRE pages (the apex homepage, /gre/*) plus /about and /privacy from one
// shared header and footer. Run after editing any page here or src/pages/*.body.html:
//   node scripts/build-gre.mjs
// Game pages (public/<game>/index.html) are NOT built here: the iPhone app bundles them as-is.
import fs from "node:fs";
import path from "node:path";

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const pub = path.join(root, "public");
const ORIGIN = "https://mintsitestudio.com";

// GA4 + Grow snippets, copied from the puzzle homepage so every page loads the same tags.
const puzzleHome = fs.readFileSync(path.join(pub, "puzzles/index.html"), "utf8");
const TAGS = puzzleHome.slice(puzzleHome.indexOf('<script async src="https://www.googletagmanager'), puzzleHome.indexOf("</head>")).trim();
if (!TAGS.includes("G-Z6MWGC8P1P")) throw new Error("analytics snippet not found in puzzles/index.html");

const NAV = [
  ["/gre/practice/", "Practice"],
  ["/gre/mock/", "Mock test"],
  ["/gre/vocab/", "Vocab"],
  ["/gre/format", "Format"],
  ["/gre/scoring", "Scores"],
  ["/gre/study-plan", "Study plan"],
  ["/gre/math-formulas", "Math"],
  ["/puzzles/", "Puzzles"],
];

function page({ file, url, title, desc, body, extraHead = "", scripts = "", home = false, jsonld }) {
  const nav = NAV.map(([h, t]) => `<a href="${h}"${h === url ? ' class="on"' : ""}>${t}</a>`).join("");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${ORIGIN}${url}">
${home ? '<meta name="msvalidate.01" content="8F15DC2668203FF46531441753DB2DFD">\n' : ""}<meta property="og:type" content="website"><meta property="og:title" content="${title}"><meta property="og:description" content="${desc}"><meta property="og:url" content="${ORIGIN}${url}">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;600;700;800&family=Zilla+Slab:wght@400;700&display=swap">
<link rel="stylesheet" href="/assets/mint.css">
<link rel="stylesheet" href="/assets/gre.css">
${extraHead}${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n` : ""}${TAGS}
</head>
<body>
<header class="top"><div class="wrap">
  <a class="logo gre" href="/"><i></i>Mint GRE</a>
  <nav class="nav">${nav}</nav>
</div></header>
${body}
<footer><div class="wrap">
  <div class="fbrand"><a class="logo gre" href="/"><i></i>Mint GRE</a><p>Free GRE prep: original practice questions with full explanations, a daily question, vocab flashcards and study guides.</p><p class="disclaim">GRE® is a registered trademark of ETS. Mint GRE is not affiliated with or endorsed by ETS.</p></div>
  <div class="fcol"><b>GRE prep</b><a href="/gre/practice/">Practice questions</a><a href="/gre/mock/">Full mock test</a><a href="/gre/practice/?s=quant">Quant practice</a><a href="/gre/practice/?s=verbal">Verbal practice</a><a href="/gre/vocab/">Vocabulary</a><a href="/gre/format">Test format</a><a href="/gre/scoring">Scoring</a><a href="/gre/study-plan">Study plan</a><a href="/gre/math-formulas">Math formulas</a></div>
  <div class="fcol"><b>More</b><a href="/puzzles/">Mint Puzzles</a><a href="/about">About</a><a href="/privacy">Privacy</a><span>© Mint Site Studio</span></div>
</div></footer>
${scripts}</body>
</html>
`;
  const out = path.join(pub, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  return url;
}

const BANK = (() => { const w = {}; new Function("window", fs.readFileSync(path.join(pub, "assets/gre-bank.js"), "utf8"))(w); return w.GRE_BANK; })();
const NQ = BANK.filter((q) => q.s === "quant").length, NV = BANK.filter((q) => q.s === "verbal").length;
const built = [];
const P = (o) => built.push(page(o));

// ---------------------------------------------------------------- home
P({
  file: "index.html", url: "/", home: true,
  title: "Mint GRE: free GRE practice questions, vocab and study guides",
  desc: "Free GRE prep for the current shorter test: original Quant and Verbal practice questions with full explanations, a new question every day, vocabulary flashcards, a study plan and a math formula sheet. No account needed.",
  jsonld: { "@context": "https://schema.org", "@type": "WebSite", name: "Mint GRE", url: ORIGIN + "/" },
  body: `<main class="wrap gwrap">
  <section class="ghero">
    <p class="kicker">Free GRE prep, no account</p>
    <h1>Practice for the GRE, a question at a time.</h1>
    <p class="sub">Original Quant and Verbal questions in every GRE format, each with a full explanation. Plus a daily question, vocabulary flashcards and plain-English guides to the current test.</p>
    <p class="go"><a class="btn p" href="/gre/practice/">Start practicing</a><a class="btn o" href="/gre/mock/">Take a full mock test</a></p>
  </section>

  <div class="gsec" id="daily"><h2>Today’s GRE question</h2><span id="dday"></span></div>
  <div id="dq"><noscript><p>Turn on JavaScript to answer the daily question, or browse the <a href="/gre/practice/">practice questions</a>.</p></noscript></div>

  <div class="gsec"><h2>Practice by section</h2><span id="prog">Your progress is saved in this browser</span></div>
  <section class="tiles">
    <a class="tile" href="/gre/practice/?s=quant"><b>Quantitative Reasoning</b><span>Quantitative comparison, multiple choice, select-all and numeric entry. Arithmetic, algebra, geometry and data.</span><em id="pq">${NQ} questions</em></a>
    <a class="tile" href="/gre/practice/?s=verbal"><b>Verbal Reasoning</b><span>Text completion, sentence equivalence and reading comprehension, with the logic of every answer explained.</span><em id="pv">${NV} questions</em></a>
    <a class="tile" href="/gre/vocab/"><b>GRE vocabulary</b><span>120 high-frequency words with short definitions and example sentences. Flip through them as flashcards.</span><em>120 words</em></a>
  </section>

  <div class="gsec"><h2>Full-length mock test</h2><span>1 hr 58 min, timed like test day</span></div>
  <section class="tiles"><a class="tile" href="/gre/mock/" style="grid-column:1/-1"><b>GRE Mock Test 1</b><span>An Issue essay plus two Verbal and two Quant sections on the real clock. Your second section of each measure adapts to how the first went, then every question is reviewed with its explanation and you get an estimated 130–170 score.</span><em>Start the mock test</em></a></section>

  <div class="gsec"><h2>The GRE at a glance</h2><span>Current shorter test, since September 2023</span></div>
  <section class="facts">
    <div><b>1 hr 58 min</b><span>Total testing time</span></div>
    <div><b>130–170</b><span>Verbal and Quant score scale</span></div>
    <div><b>0–6</b><span>Analytical Writing, in half points</span></div>
    <div><b>5 years</b><span>How long scores can be reported</span></div>
  </section>

  <div class="gsec"><h2>Guides</h2></div>
  <section class="tiles">
    <a class="tile" href="/gre/format"><b>GRE test format</b><span>Every section, how many questions, how much time, and how the adaptive second section works.</span><em>Read the guide</em></a>
    <a class="tile" href="/gre/scoring"><b>How GRE scoring works</b><span>The 130–170 scale, why you should never leave a question blank, and when scores arrive.</span><em>Read the guide</em></a>
    <a class="tile" href="/gre/study-plan"><b>8-week study plan</b><span>A week-by-week plan with a 4-week fast track, built around practice and review.</span><em>Read the guide</em></a>
    <a class="tile" href="/gre/math-formulas"><b>GRE math formulas</b><span>The formulas and rules Quant actually tests, on one page.</span><em>Read the guide</em></a>
  </section>

  <p class="break">Need a study break? <a href="/puzzles/">Mint Puzzles</a> has six free daily word and logic puzzles, and they’re good vocabulary practice too.</p>
</main>`,
  scripts: `<script src="/assets/gre-bank.js"></script>
<script src="/assets/gre.js"></script>
<script>
(() => {
  const t = GRE.today(), q = GRE.daily(t);
  const [y, m, d] = t.split("-").map(Number);
  document.getElementById("dday").textContent = new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  GRE.render(document.getElementById("dq"), q, { label: "Daily question", next: () => { location.href = "/gre/practice/?s=" + q.s; }, nextLabel: "More " + (q.s === "quant" ? "Quant" : "Verbal") + " practice" });
  const done = GRE.load();
  for (const [s, id] of [["quant", "pq"], ["verbal", "pv"]]) {
    const qs = GRE_BANK.filter((x) => x.s === s), n = qs.filter((x) => done[x.id]).length;
    if (n) document.getElementById(id).textContent = n + " of " + qs.length + " answered";
  }
})();
</script>
`,
});

// ---------------------------------------------------------------- practice
P({
  file: "gre/practice/index.html", url: "/gre/practice/",
  title: "Free GRE Practice Questions with Explanations | Mint GRE",
  desc: "Free GRE practice questions for Quantitative and Verbal Reasoning in every question format: quantitative comparison, numeric entry, text completion, sentence equivalence and reading comprehension. Every answer explained.",
  body: `<main class="wrap prose">
  <p class="kick"><a href="/">Mint GRE</a> · Practice</p>
  <h1>GRE practice questions</h1>
  <p class="lede">Original questions in every GRE format, graded the way the test grades them: all parts right or no credit. Your results stay in this browser.</p>
  <div class="chips" id="sec"><button class="chip" data-s="all">All</button><button class="chip" data-s="quant">Quant</button><button class="chip" data-s="verbal">Verbal</button></div>
  <div class="chips" id="typ"></div>
  <div class="chips" id="mode"><button class="chip" data-m="order">In order</button><button class="chip" data-m="new">Unanswered first</button><button class="chip" data-m="missed">Missed only</button></div>
  <div class="stats" id="stats"></div>
  <div class="bar"><i id="barfill" style="width:0"></i></div>
  <div id="q"><noscript><p>Practice needs JavaScript turned on.</p></noscript></div>
  <h2>How to use these questions</h2>
  <p>Answer first, then read the explanation even when you got it right: the explanations show the fastest route, which is what saves time on test day. When you miss one, note the reason (a careless slip, a concept you didn’t know, or a trap you fell for) and come back with <b>Missed only</b> a few days later.</p>
  <p>New to the question types? The <a href="/gre/format">GRE format guide</a> explains each one, and the <a href="/gre/math-formulas">math formula sheet</a> covers what Quant expects you to know.</p>
</main>`,
  scripts: `<script src="/assets/gre-bank.js"></script>
<script src="/assets/gre.js"></script>
<script>
(() => {
  const qs = new URLSearchParams(location.search);
  const st = { s: ["quant", "verbal"].includes(qs.get("s")) ? qs.get("s") : "all", t: "all", m: "new", i: 0 };
  const $ = (id) => document.getElementById(id);
  const TYPES = { quant: ["qc", "mc", "ma", "ne"], verbal: ["tc", "se", "rc"] };
  function list() {
    const done = GRE.load();
    let l = GRE_BANK.filter((q) => (st.s === "all" || q.s === st.s) && (st.t === "all" || q.t === st.t));
    if (st.m === "missed") l = l.filter((q) => done[q.id] && !done[q.id].ok);
    if (st.m === "new") l = l.filter((q) => !done[q.id]).concat(l.filter((q) => done[q.id]));
    return l;
  }
  function chips() {
    const types = st.s === "all" ? [] : TYPES[st.s];
    $("typ").innerHTML = types.length ? ['<button class="chip" data-t="all">All types</button>'].concat(types.map((t) => '<button class="chip" data-t="' + t + '">' + GRE.TYPE[t] + '</button>')).join("") : "";
    document.querySelectorAll("[data-s]").forEach((b) => b.classList.toggle("on", b.dataset.s === st.s));
    document.querySelectorAll("[data-t]").forEach((b) => b.classList.toggle("on", b.dataset.t === st.t));
    document.querySelectorAll("[data-m]").forEach((b) => b.classList.toggle("on", b.dataset.m === st.m));
    $("typ").querySelectorAll("[data-t]").forEach((b) => b.onclick = () => { st.t = b.dataset.t; st.i = 0; show(); });
  }
  function stats() {
    const done = GRE.load();
    const pool = GRE_BANK.filter((q) => st.s === "all" || q.s === st.s);
    const a = pool.filter((q) => done[q.id]), ok = a.filter((q) => done[q.id].ok);
    $("stats").innerHTML = "<span><b>" + a.length + "</b> of " + pool.length + " answered</span><span><b>" + ok.length + "</b> correct" + (a.length ? " (" + Math.round(100 * ok.length / a.length) + "%)" : "") + "</span>";
    $("barfill").style.width = (pool.length ? 100 * a.length / pool.length : 0) + "%";
  }
  function show() {
    chips(); stats();
    const l = list();
    if (!l.length) {
      $("q").innerHTML = '<div class="qcard"><p class="stem">' + (st.m === "missed" ? "Nothing missed here. Nice work." : "No questions match.") + '</p><div class="actions"><button class="btn o" id="reset">Show all</button></div></div>';
      $("reset").onclick = () => { st.m = "order"; st.t = "all"; st.i = 0; show(); };
      return;
    }
    const q = l[st.i % l.length];
    GRE.render($("q"), q, {
      label: "Question " + ((st.i % l.length) + 1) + " of " + l.length,
      next: () => { st.i++; if (st.m !== "order") st.i = st.i % Math.max(1, list().length); show(); window.scrollTo({ top: $("q").offsetTop - 70, behavior: "smooth" }); },
      onAnswer: (ok) => { stats(); if (st.m === "new" || (st.m === "missed" && ok)) st.i--; },
    });
  }
  document.querySelectorAll("[data-s]").forEach((b) => b.onclick = () => { st.s = b.dataset.s; st.t = "all"; st.i = 0; history.replaceState(null, "", st.s === "all" ? location.pathname : "?s=" + st.s); show(); });
  document.querySelectorAll("[data-m]").forEach((b) => b.onclick = () => { st.m = b.dataset.m; st.i = 0; show(); });
  show();
})();
</script>
`,
});

// ---------------------------------------------------------------- mock test
P({
  file: "gre/mock/index.html", url: "/gre/mock/",
  title: "Free Full-Length GRE Mock Test (Timed, Adaptive) | Mint GRE",
  desc: "Take a free full-length GRE mock test: Issue essay, two Verbal and two Quant sections on the real 1 hr 58 min clock, an adaptive second section, an estimated 130–170 score and explanations for every question.",
  body: `<main class="wrap prose">
  <div class="mock-intro">
  <p class="kick"><a href="/">Mint GRE</a> · Mock test</p>
  <h1>Free full-length GRE mock test</h1>
  <p class="lede">Timed and structured like the current GRE: one Issue essay, then two Verbal and two Quant sections. Inside a section you can skip, mark and come back to questions; once you end a section, it’s closed.</p>
  <div class="tablewrap"><table class="t">
    <tr><th>Section</th><th>Questions</th><th>Time</th></tr>
    <tr><td>Analytical Writing (Issue)</td><td>1 essay</td><td>30 min</td></tr>
    <tr><td>Verbal 1 → Verbal 2 (adaptive)</td><td>12 + 15</td><td>18 + 23 min</td></tr>
    <tr><td>Quant 1 → Quant 2 (adaptive)</td><td>12 + 15</td><td>21 + 26 min</td></tr>
  </table></div>
  <p class="hint">Find 2 hours without interruptions. Progress is saved in this browser, so a reload won’t lose your answers, but the clock keeps running, just like test day.</p>
  </div>
  <div id="mock"><noscript><p>The mock test needs JavaScript turned on.</p></noscript></div>
</main>`,
  scripts: `<script src="/assets/gre-bank.js"></script>
<script src="/assets/gre.js"></script>
<script src="/assets/gre-mock.js"></script>
`,
});

// ---------------------------------------------------------------- vocab
const WORDS = (() => { const w = {}; new Function("window", fs.readFileSync(path.join(pub, "assets/gre-words.js"), "utf8"))(w); return w.GRE_WORDS; })();
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
P({
  file: "gre/vocab/index.html", url: "/gre/vocab/",
  title: `GRE Vocabulary: ${WORDS.length} High-Frequency Words with Flashcards | Mint GRE`,
  desc: `${WORDS.length} high-frequency GRE vocabulary words with short definitions and example sentences, plus free flashcards that remember which words you still need to learn.`,
  body: `<main class="wrap prose">
  <p class="kick"><a href="/">Mint GRE</a> · Vocabulary</p>
  <h1>GRE vocabulary: ${WORDS.length} words</h1>
  <p class="lede">Words that keep showing up in text completion and sentence equivalence. Flip a card, say whether you knew it, and the deck brings back the ones you’re still learning.</p>
  <div class="chips" id="deck"><button class="chip" data-d="learning">Still learning</button><button class="chip" data-d="all">All words</button></div>
  <div class="flash" id="card"><noscript>Flashcards need JavaScript; the full list is below.</noscript></div>
  <div class="actions" id="acts" style="justify-content:center"></div>
  <p class="stats" id="vstats" style="justify-content:center"></p>
  <h2>How to learn GRE words</h2>
  <p>Learn words in context, not as isolated definitions: the GRE tests whether a word fits a sentence’s logic. Say each example sentence out loud, then try writing your own. Ten new words a day, reviewed the next day and again a week later, beats cramming two hundred the week before the test.</p>
  <p>Notice the pairs: sentence equivalence answers are near-synonyms (<i>soporific</i> and <i>monotonous</i>, <i>aloof</i> and <i>reserved</i>), and the wrong options often include a second synonym pair with the opposite meaning. Try them in the <a href="/gre/practice/?s=verbal">Verbal practice questions</a>.</p>
  <h2>The full word list</h2>
  <ul class="wordlist">${WORDS.map(([w, pos, d, x]) => `<li><b>${esc(w)}</b> <i>${pos}</i> ${esc(d)}. <span>${esc(x)}</span></li>`).join("")}</ul>
</main>`,
  scripts: `<script src="/assets/gre-words.js"></script>
<script>
(() => {
  const KEY = "gre:vocab:v1", $ = (id) => document.getElementById(id);
  let known = {}; try { known = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) {}
  let deck = "learning", order = [], i = 0, flipped = false;
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  function build() {
    order = GRE_WORDS.filter((w) => deck === "all" || !known[w[0]]);
    for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
    i = 0; flipped = false;
    document.querySelectorAll("[data-d]").forEach((b) => b.classList.toggle("on", b.dataset.d === deck));
    draw();
  }
  function draw() {
    const n = Object.keys(known).filter((k) => known[k]).length;
    $("vstats").innerHTML = "<span><b>" + n + "</b> of " + GRE_WORDS.length + " marked as known</span>";
    if (!order.length) {
      $("card").innerHTML = '<div class="w">All done</div><div class="d">You’ve marked every word as known.</div>';
      $("acts").innerHTML = '<button class="btn o" id="again">Review all words</button>';
      $("again").onclick = () => { deck = "all"; build(); };
      return;
    }
    const [w, pos, d, x] = order[i % order.length];
    $("card").innerHTML = '<div class="w">' + esc(w) + '</div><div class="pos">' + pos + '</div>' + (flipped ? '<div class="d">' + esc(d) + '</div><div class="x">' + esc(x) + '</div>' : "");
    $("acts").innerHTML = flipped
      ? '<button class="btn o" id="no">Still learning</button><button class="btn p" id="yes">I knew it</button>'
      : '<button class="btn p" id="flip">Show meaning</button>';
    if (flipped) {
      $("yes").onclick = () => mark(w, true);
      $("no").onclick = () => mark(w, false);
    } else $("flip").onclick = () => { flipped = true; draw(); };
  }
  function mark(w, k) {
    known[w] = k; try { localStorage.setItem(KEY, JSON.stringify(known)); } catch (e) {}
    if (k && deck === "learning") order.splice(i % order.length, 1); else i++;
    flipped = false; draw();
  }
  document.querySelectorAll("[data-d]").forEach((b) => b.onclick = () => { deck = b.dataset.d; build(); });
  build();
})();
</script>
`,
});

// ---------------------------------------------------------------- guides
const guide = (file, url, title, desc, h1, body) => P({
  file, url, title: `${title} | Mint GRE`, desc,
  jsonld: { "@context": "https://schema.org", "@type": "Article", headline: h1, dateModified: "2026-11-19", publisher: { "@type": "Organization", name: "Mint Site Studio" } },
  body: `<main class="wrap prose">
  <p class="kick"><a href="/">Mint GRE</a> · Guide · Updated November 19, 2026</p>
  <h1>${h1}</h1>
${body}
  <div class="callout">Ready to try it? <a href="/gre/practice/">Practice questions</a> in every format, each with a full explanation.</div>
</main>`,
});

guide("gre/format.html", "/gre/format", "GRE Test Format 2026: Sections, Questions and Timing",
  "The current GRE General Test takes 1 hour 58 minutes: one Analytical Writing task, two Verbal sections and two Quant sections. Question counts, timing and how the adaptive sections work.",
  "GRE test format: sections, questions and timing", `
  <p class="lede">The GRE General Test was shortened in September 2023. It now takes about 1 hour and 58 minutes and has five sections.</p>
  <div class="tablewrap"><table class="t">
    <tr><th>Section</th><th>Questions</th><th>Time</th></tr>
    <tr><td>Analytical Writing: Analyze an Issue</td><td>1 essay task</td><td>30 min</td></tr>
    <tr><td>Verbal Reasoning, section 1</td><td>12</td><td>18 min</td></tr>
    <tr><td>Verbal Reasoning, section 2</td><td>15</td><td>23 min</td></tr>
    <tr><td>Quantitative Reasoning, section 1</td><td>12</td><td>21 min</td></tr>
    <tr><td>Quantitative Reasoning, section 2</td><td>15</td><td>26 min</td></tr>
    <tr><th>Total</th><th>54 questions + 1 essay</th><th>1 hr 58 min</th></tr>
  </table></div>
  <p>Analytical Writing always comes first. The Verbal and Quant sections follow, and their order can vary. The test is offered at test centers and at home.</p>
  <h2>The adaptive second section</h2>
  <p>Verbal and Quant are <b>section-level adaptive</b>: how well you do on the first section of a measure decides how hard the second one is. Within a section, every question counts the same, and you can skip, mark and come back to questions or change answers before time runs out.</p>
  <h2>Verbal Reasoning question types</h2>
  <h3>Reading comprehension</h3>
  <p>Passages from one paragraph to several, from the sciences, humanities and everyday topics. Most questions have five choices and one answer; some ask you to select every correct answer from three choices; some ask you to pick a sentence in the passage.</p>
  <h3>Text completion</h3>
  <p>A passage of one to five sentences with one, two or three blanks. One-blank questions have five choices; two- and three-blank questions have three choices per blank. You only get credit if every blank is right.</p>
  <h3>Sentence equivalence</h3>
  <p>One sentence, one blank, six choices. Pick the <b>two</b> words that each complete the sentence and give it the same meaning. Both must be right for credit.</p>
  <h2>Quantitative Reasoning question types</h2>
  <h3>Quantitative comparison</h3>
  <p>Compare Quantity A with Quantity B and choose: A is greater, B is greater, they are equal, or the relationship cannot be determined.</p>
  <h3>Multiple choice: one answer</h3>
  <p>Five choices, one correct answer.</p>
  <h3>Multiple choice: one or more answers</h3>
  <p>Select every correct choice. The question may or may not tell you how many to pick. No partial credit.</p>
  <h3>Numeric entry</h3>
  <p>Type an integer, a decimal or a fraction. Fractions don’t have to be reduced.</p>
  <p>Some Quant questions come in <b>data interpretation</b> sets that share a table or graph. An on-screen calculator is available for the Quant sections.</p>
  <h2>What Quant covers</h2>
  <p>Arithmetic, algebra, geometry and data analysis at roughly a high-school level. Our <a href="/gre/math-formulas">GRE math formula sheet</a> lists the rules that come up most.</p>
  <p class="disclaim">Source: ETS’s official GRE General Test structure page, checked November 2026. ETS can change the test; check <a href="https://www.ets.org/gre/test-takers/general-test/prepare/test-structure.html" rel="nofollow">ets.org</a> before you book.</p>`);

guide("gre/scoring.html", "/gre/scoring", "How GRE Scoring Works: Score Scale, Timing and Retakes",
  "GRE Verbal and Quant are scored 130 to 170 in one-point steps, and Analytical Writing 0 to 6 in half points. How scores are calculated, when they arrive, how long they last and how retakes work.",
  "How GRE scoring works", `
  <p class="lede">Your GRE score report has three numbers: Verbal Reasoning, Quantitative Reasoning and Analytical Writing.</p>
  <div class="tablewrap"><table class="t">
    <tr><th>Measure</th><th>Score scale</th></tr>
    <tr><td>Verbal Reasoning</td><td>130–170, in 1-point increments</td></tr>
    <tr><td>Quantitative Reasoning</td><td>130–170, in 1-point increments</td></tr>
    <tr><td>Analytical Writing</td><td>0–6, in half-point increments</td></tr>
  </table></div>
  <h2>How Verbal and Quant are calculated</h2>
  <p>For each measure, your score starts from the number of questions you answered correctly across both sections. Because the second section is adaptive, ETS then adjusts for the difficulty of the questions you saw, so the same number of correct answers can be worth more after a harder second section.</p>
  <div class="callout"><b>Never leave a question blank.</b> There is no penalty for a wrong answer, so a guess can only help. If you’re running out of time, mark a guess on every remaining question.</div>
  <p>Multi-part questions (select all that apply, two- and three-blank text completion, sentence equivalence) earn credit only when every part is right. There is no partial credit, and our <a href="/gre/practice/">practice questions</a> are graded the same way.</p>
  <h2>Analytical Writing</h2>
  <p>The Issue essay is scored on a 0–6 scale by a trained reader and by ETS’s scoring engine. Strong essays take a clear position, support it with specific reasons and examples, and stay organized. Polish matters less than clear reasoning.</p>
  <h2>When scores arrive and how long they last</h2>
  <ul>
    <li>You see unofficial Verbal and Quant scores on screen at the end of the test.</li>
    <li>Official scores, including Analytical Writing, are usually available about 8–10 days after test day.</li>
    <li>Scores can be reported to schools for 5 years after your test date.</li>
  </ul>
  <h2>Retakes and ScoreSelect</h2>
  <p>You can take the GRE General Test once every 21 days, up to five times in any rolling 12-month period. With ScoreSelect you choose which test dates’ scores to send to schools.</p>
  <h2>What is a good GRE score?</h2>
  <p>It depends on the programs you’re applying to. Look up the median or typical scores your target programs publish, and aim a few points above them. ETS publishes percentile tables that show how each score compares with recent test takers.</p>
  <p class="disclaim">Source: ETS’s GRE scores and registration pages, checked November 2026. Policies can change; confirm on <a href="https://www.ets.org/gre/test-takers/general-test/scores.html" rel="nofollow">ets.org</a>.</p>`);

guide("gre/study-plan.html", "/gre/study-plan", "GRE Study Plan: 8 Weeks (with a 4-Week Fast Track)",
  "A free week-by-week GRE study plan: diagnose, build Quant and Verbal skills, then switch to timed sections and full practice tests. Includes a 4-week version.",
  "An 8-week GRE study plan", `
  <p class="lede">About 8–10 hours a week for 8 weeks is enough for most people to improve meaningfully. If you only have a month, use the 4-week version below.</p>
  <h2>Before you start</h2>
  <ul>
    <li><b>Take a timed diagnostic.</b> ETS offers free official practice tests (POWERPREP). Your starting scores tell you where the hours should go.</li>
    <li><b>Set a target.</b> Look up typical scores for the programs you want and write down your Verbal and Quant goals.</li>
    <li><b>Book the test.</b> A date on the calendar keeps the plan real. You can retake after 21 days if you need to.</li>
  </ul>
  <h2>The 8-week plan</h2>
  <div class="tablewrap"><table class="t">
    <tr><th>Week</th><th>Focus</th><th>Do this</th></tr>
    <tr><td>1</td><td>Diagnose and learn the formats</td><td>Read the <a href="/gre/format">format guide</a>. Try every question type untimed. Start 10 <a href="/gre/vocab/">vocab words</a> a day.</td></tr>
    <tr><td>2</td><td>Arithmetic and number properties</td><td>Fractions, percents, ratios, primes, divisibility, odd/even rules. Review the <a href="/gre/math-formulas">formula sheet</a>.</td></tr>
    <tr><td>3</td><td>Algebra and text completion</td><td>Linear equations, inequalities, exponents, absolute value. Text completion: find the clue and the signal word before looking at choices.</td></tr>
    <tr><td>4</td><td>Geometry and sentence equivalence</td><td>Triangles, circles, polygons, coordinate geometry. Sentence equivalence: predict a word, then find the two choices that match it.</td></tr>
    <tr><td>5</td><td>Data analysis and reading</td><td>Mean, median, standard deviation, probability, counting, reading graphs. One reading passage a day, summarizing each paragraph in a few words.</td></tr>
    <tr><td>6</td><td>Timed sections</td><td>Practice sections under real timing (about 1.5 minutes per Verbal question, 1.75 per Quant). Review every miss.</td></tr>
    <tr><td>7</td><td>Full practice test + Issue essay</td><td>Take a full timed test. Write two timed 30-minute Issue essays.</td></tr>
    <tr><td>8</td><td>Weak spots and rest</td><td>Redo missed questions. Take a final practice test early in the week, then taper. Sleep well the last two nights.</td></tr>
  </table></div>
  <h2>The 4-week fast track</h2>
  <ul>
    <li><b>Week 1:</b> diagnostic, formats, arithmetic and algebra.</li>
    <li><b>Week 2:</b> geometry, data analysis, text completion and sentence equivalence.</li>
    <li><b>Week 3:</b> reading comprehension daily and timed sections; one Issue essay.</li>
    <li><b>Week 4:</b> a full practice test, a review of every miss, a second test, then rest.</li>
  </ul>
  <h2>Habits that move scores</h2>
  <ul>
    <li><b>Keep an error log.</b> For every miss, write why: careless, didn’t know the concept, or fell for a trap. Patterns show you what to study.</li>
    <li><b>Review right answers too.</b> If you got it right slowly, the explanation probably shows a faster route.</li>
    <li><b>Practice a little every day.</b> The <a href="/#daily">daily question</a> on our homepage takes two minutes.</li>
  </ul>`);

guide("gre/math-formulas.html", "/gre/math-formulas", "GRE Math Formulas: The Quant Cheat Sheet",
  "The formulas and rules GRE Quant tests most: percents, ratios, exponents, algebra, triangles, circles, coordinate geometry, statistics, probability and counting, on one page.",
  "GRE math formulas: the Quant cheat sheet", `
  <p class="lede">GRE Quant is high-school math tested cleverly. These are the rules that come up again and again. No formula sheet is provided on test day, so know them cold.</p>
  <h2>Arithmetic and number properties</h2>
  <ul>
    <li><b>Percent change</b> = (new − old) ÷ old × 100%.</li>
    <li>A rise of p% then a fall of p% leaves you <b>below</b> where you started: (1 + p)(1 − p) = 1 − p².</li>
    <li><b>Compound interest:</b> A = P(1 + r)<sup>t</sup>. Simple interest: I = Prt.</li>
    <li>odd × odd = odd; anything × even = even; odd ± odd = even; odd ± even = odd.</li>
    <li>Number of divisors: write n = p<sup>a</sup>q<sup>b</sup>…, then the count is (a + 1)(b + 1)…</li>
    <li>Divisible by 3 (or 9) when the digit sum is; by 4 when the last two digits are.</li>
  </ul>
  <h2>Exponents and roots</h2>
  <ul>
    <li>x<sup>a</sup> · x<sup>b</sup> = x<sup>a+b</sup>; x<sup>a</sup> ÷ x<sup>b</sup> = x<sup>a−b</sup>; (x<sup>a</sup>)<sup>b</sup> = x<sup>ab</sup>; x<sup>0</sup> = 1; x<sup>−a</sup> = 1/x<sup>a</sup>.</li>
    <li>x<sup>n</sup> + x<sup>n</sup> = 2x<sup>n</sup>, not x<sup>2n</sup>. For example, 2<sup>10</sup> + 2<sup>10</sup> = 2<sup>11</sup>.</li>
    <li>For 0 &lt; x &lt; 1: x³ &lt; x² &lt; x &lt; √x.</li>
    <li>If x² = k (k &gt; 0), then x = ±√k. Don’t forget the negative root.</li>
  </ul>
  <h2>Algebra</h2>
  <ul>
    <li>(a + b)² = a² + 2ab + b²; (a − b)² = a² − 2ab + b²; a² − b² = (a + b)(a − b).</li>
    <li>|x − c| &lt; d means c − d &lt; x &lt; c + d.</li>
    <li>Quadratic formula: x = (−b ± √(b² − 4ac)) ÷ 2a.</li>
    <li><b>Rate × time = distance</b> (or work). Average speed = total distance ÷ total time.</li>
    <li>Working together: 1/T = 1/A + 1/B.</li>
  </ul>
  <h2>Geometry</h2>
  <ul>
    <li>Triangle angles sum to 180°. Polygon interior angles sum to (n − 2) × 180°.</li>
    <li>Area of a triangle = ½ × base × height. Pythagorean theorem: a² + b² = c². Common triples: 3-4-5, 5-12-13, 8-15-17.</li>
    <li>45-45-90 triangle sides: x, x, x√2. 30-60-90 triangle sides: x, x√3, 2x.</li>
    <li>Circle: area πr², circumference 2πr. An arc or sector is (central angle ÷ 360) of the whole.</li>
    <li>Square with diagonal d has area d²/2. Rectangular box volume = lwh; cylinder volume = πr²h.</li>
    <li>Third side of a triangle is between the difference and the sum of the other two sides.</li>
  </ul>
  <h2>Coordinate geometry</h2>
  <ul>
    <li>Slope = (y₂ − y₁) ÷ (x₂ − x₁). Line: y = mx + b.</li>
    <li>Parallel lines have equal slopes; perpendicular slopes multiply to −1.</li>
    <li>Distance = √((x₂ − x₁)² + (y₂ − y₁)²).</li>
  </ul>
  <h2>Statistics</h2>
  <ul>
    <li>Mean = sum ÷ count, so sum = mean × count.</li>
    <li>Median: middle value (average of the two middle values for an even count). Mode: most frequent. Range: max − min.</li>
    <li>Standard deviation measures spread around the mean. Adding a constant to every value doesn’t change it; multiplying every value by k multiplies it by |k|.</li>
    <li>In a normal distribution, about 68% of values are within 1 SD of the mean and about 95% within 2 SD.</li>
  </ul>
  <h2>Counting and probability</h2>
  <ul>
    <li>Arrangements of n items: n!. Ordered picks of k from n: n! ÷ (n − k)!. Unordered (combinations): n! ÷ (k!(n − k)!).</li>
    <li>P(A or B) = P(A) + P(B) − P(A and B). Independent events: P(A and B) = P(A) × P(B).</li>
    <li>“Without replacement” means the second probability uses one fewer item.</li>
    <li>Inclusion–exclusion: |A or B| = |A| + |B| − |both|.</li>
  </ul>`);

// ---------------------------------------------------------------- about / privacy
for (const [name, title, desc] of [
  ["about", "About Mint Site Studio: Mint GRE and Mint Puzzles", "Who makes Mint GRE prep and Mint Puzzles, how the practice questions and puzzles are made, and how to contact us."],
  ["privacy", "Privacy | Mint Site Studio", "What Mint GRE, Mint Puzzles and the Mint Puzzles iPhone app collect (very little) and why."],
]) {
  P({ file: `${name}.html`, url: `/${name}`, title, desc, body: fs.readFileSync(path.join(root, `src/pages/${name}.body.html`), "utf8").trim() });
}

console.log(`built ${built.length} pages:`, built.join(" "));
