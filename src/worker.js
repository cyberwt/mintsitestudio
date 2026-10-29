// Mint Site Studio Worker.
//   mintsitestudio.com          -> Mint Puzzles (daily games, public/index.html + /word /hive /box /sum /sudoku /nonogram)
//                                  /<game>/YYYY-MM-DD serves that game's page for a past day; /creators -> seller.
//                                  /embed/<game> is the game page made for an iframe on someone else's site.
//                                  Once the iPhone app is live, every page gets the App Store banner tag.
//   www.mintsitestudio.com      -> 301 to the apex
//   seller.mintsitestudio.com /  -> creator pitch page (public/creators.html); other paths -> apex
//   demo.mintsitestudio.com  /  -> demo deal feed, /studio card tool, /creators pitch, /api/draft

const DEMO_PATHS = {
  "/": "/demo/",
  "/studio": "/demo/studio",
  "/deals.json": "/demo/deals.json",
};

// Keep in sync with LAUNCH in public/assets/mint.js.
const LAUNCH = "2026-10-21";
const GAMES = {
  word: "Mint Word",
  hive: "Mint Hive",
  box: "Mint Box",
  sum: "Mint Sum",
  sudoku: "Mini Sudoku",
  nonogram: "Mint Nonogram",
};
const SITE_PAGES = ["/", "/archive", "/how-to", "/embed", "/about", "/privacy"];
const HOW_TO = ["word", "hive", "box", "sum", "sudoku", "nonogram"];
// Mint Puzzles on the App Store (ASC app 6826092706). The banner tag goes out only once
// the iTunes lookup API returns it, i.e. after Apple approves and releases the app.
const APP_STORE_ID = "6826092706";
// Public by design: IndexNow checks it against https://mintsitestudio.com/<key>.txt.
const INDEXNOW_KEY = "c6ec84f59db39c6516ece9b760180dd2";

export default {
  // Daily cron: tell Bing (via IndexNow) about the day's new puzzle pages.
  async scheduled(event, env, ctx) {
    const day = lastPuzzleDay();
    const urlList = Object.keys(GAMES).map((g) => `https://mintsitestudio.com/${g}/${day}`);
    ctx.waitUntil(
      fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host: "mintsitestudio.com",
          key: INDEXNOW_KEY,
          keyLocation: `https://mintsitestudio.com/${INDEXNOW_KEY}.txt`,
          urlList,
        }),
      }),
    );
  },

  async fetch(request, env) {
    return withBeacon(await route(request, env));
  },
};

async function route(request, env) {
  const url = new URL(request.url);
  // `wrangler dev` acts as the apex so the puzzle site can be checked locally.
  if (url.hostname === "localhost") url.hostname = "mintsitestudio.com";

  if (url.hostname === "www.mintsitestudio.com") {
    url.hostname = "mintsitestudio.com";
    return Response.redirect(url.toString(), 301);
  }

  if (url.hostname === "seller.mintsitestudio.com") {
    if (url.pathname === "/" || url.pathname === "/creators") {
      return env.ASSETS.fetch(new Request(new URL("/creators", url.origin), request));
    }
    if (url.pathname in DEMO_PATHS || url.pathname.startsWith("/demo")) {
      return Response.redirect(`https://demo.mintsitestudio.com${url.pathname === "/demo/" ? "/" : url.pathname}`, 302);
    }
    if (url.pathname === "/robots.txt" || url.pathname === "/favicon.ico") return env.ASSETS.fetch(request);
    return Response.redirect(`https://mintsitestudio.com${url.pathname}${url.search}`, 301);
  }

  if (url.hostname === "mintsitestudio.com") {
    if (url.pathname === "/creators") return Response.redirect("https://seller.mintsitestudio.com/", 301);
    if (url.pathname in DEMO_PATHS && url.pathname !== "/" || url.pathname.startsWith("/demo")) {
      return Response.redirect(`https://demo.mintsitestudio.com${url.pathname === "/demo/" ? "/" : url.pathname}`, 302);
    }
    if (url.pathname === "/sitemap.xml") return sitemap();
    const m = url.pathname.match(/^\/(word|hive|box|sum|sudoku|nonogram)\/(\d{4}-\d{2}-\d{2})\/?$/);
    if (m) return withAppBanner(await dailyPage(request, env, m[1], m[2]));
    const e = url.pathname.match(/^\/embed\/(word|hive|box|sum|sudoku|nonogram)\/?$/);
    if (e) return embedPage(request, env, e[1]);
    return withAppBanner(await env.ASSETS.fetch(request));
  }

  if (url.pathname === "/api/draft") {
    if (request.method !== "POST") return json({ error: "POST only" }, 405);
    return draftCard(request);
  }

  const mapped = DEMO_PATHS[url.pathname];
  if (mapped) {
    const assetUrl = new URL(mapped, url.origin);
    return env.ASSETS.fetch(new Request(assetUrl, request));
  }
  return env.ASSETS.fetch(request);
}

// Cloudflare Web Analytics goes on every HTML page from here, not by Cloudflare's automatic
// injection (off for this zone), so browsers marked internal skip it: ?mint_internal=1 marks
// this browser (localStorage) for our own checks, ?mint_internal=0 clears it.
const CF_BEACON = `<script data-cfasync="false">(function(){try{var q=new URLSearchParams(location.search).get("mint_internal"),l=localStorage;if(q==="1")l.setItem("mint_internal","1");else if(q==="0")l.removeItem("mint_internal");if(l.getItem("mint_internal")==="1")return}catch(e){}var b=document.createElement("script");b.defer=true;b.src="https://static.cloudflareinsights.com/beacon.min.js";b.setAttribute("data-cf-beacon",'{"token": "5bc59af4c2c44eab9ae69c462fc9afe4"}');document.head.appendChild(b)})();</script>`;

function withBeacon(res) {
  if (!(res.headers.get("content-type") || "").includes("text/html")) return res;
  return new HTMLRewriter().on("head", { element: (el) => el.append(CF_BEACON, { html: true }) }).transform(res);
}

// ---- Mint Puzzles ----------------------------------------------------------
// Puzzles are generated in the browser from the date, so a past day is the game
// page with its own title and canonical URL. Days before launch or in the future 404.
// Day pages are noindex,follow and stay out of the sitemap: their HTML is the game page's
// shell (the puzzle is drawn client-side), so Google sees six near-duplicates a day.
// /archive links them for players; the indexable pages are the game hubs and guides.

function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function lastPuzzleDay() {
  // UTC+14 is the earliest time zone, so "today" somewhere can be tomorrow in UTC.
  return addDays(new Date().toISOString().slice(0, 10), 1);
}

function prettyDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });
}

function puzzleNumber(iso) {
  const [a, b] = [LAUNCH, iso].map((s) => Date.UTC(...s.split("-").map((x, i) => Number(x) - (i === 1 ? 1 : 0))));
  return Math.round((b - a) / 86400000) + 1;
}

async function dailyPage(request, env, game, date) {
  if (date < LAUNCH || date > lastPuzzleDay() || addDays(date, 0) !== date) {
    return env.ASSETS.fetch(new Request(new URL("/no-such-page", request.url), request));
  }
  const page = await env.ASSETS.fetch(new Request(new URL(`/${game}/`, request.url), request));
  const name = `${GAMES[game]} No. ${puzzleNumber(date)}`;
  const when = prettyDate(date);
  return new HTMLRewriter()
    .on("title", { element: (el) => el.setInnerContent(`${name}, ${when} | Mint Puzzles`) })
    .on('meta[name="description"]', {
      element: (el) => el.setAttribute("content", `Play ${name}, the free ${GAMES[game]} puzzle for ${when}. No signup, works on phones.`),
    })
    .on('link[rel="canonical"]', { element: (el) => el.setAttribute("href", `https://mintsitestudio.com/${game}/${date}`) })
    .on("head", { element: (el) => el.append('<meta name="robots" content="noindex, follow">', { html: true }) })
    .transform(page);
}

// The game page inside someone else's iframe: no index, links open a new tab, a credit
// link back to the game. Embedding sites paste the snippet from /embed.
async function embedPage(request, env, game) {
  const page = await env.ASSETS.fetch(new Request(new URL(`/${game}/`, request.url), request));
  return new HTMLRewriter()
    .on("head", {
      element: (el) => el.append('<meta name="robots" content="noindex"><base target="_blank">', { html: true }),
    })
    .on("body", {
      element(el) {
        el.setAttribute("class", `${el.getAttribute("class") || ""} embed`.trim());
        el.append(`<a class="embed-credit" href="https://mintsitestudio.com/${game}/?utm_source=embed">Free daily puzzles at <b>Mint Puzzles</b> ↗</a>`, { html: true });
      },
    })
    .transform(page);
}

// Is the app on the App Store yet? Asks Apple's public lookup API, cached for 6 hours
// at the edge and for the life of this isolate once it says yes.
let appLiveSeen = false;
async function appLive() {
  if (appLiveSeen) return true;
  try {
    const res = await fetch(`https://itunes.apple.com/lookup?id=${APP_STORE_ID}&country=us`, {
      cf: { cacheTtl: 21600, cacheEverything: true },
      signal: AbortSignal.timeout(1500),
    });
    const data = await res.json();
    appLiveSeen = data.resultCount > 0;
  } catch {}
  return appLiveSeen;
}

async function withAppBanner(res) {
  if (!(res.headers.get("content-type") || "").includes("text/html") || !(await appLive())) return res;
  return new HTMLRewriter()
    .on("head", { element: (el) => el.append(`<meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}">`, { html: true }) })
    .transform(res);
}

function sitemap() {
  const urls = SITE_PAGES.map((p) => `https://mintsitestudio.com${p}`);
  for (const g of HOW_TO) urls.push(`https://mintsitestudio.com/how-to/${g}`);
  for (const g of Object.keys(GAMES)) urls.push(`https://mintsitestudio.com/${g}/`);
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

// ---- Card drafting -------------------------------------------------------
// Input: { url, was, now, note, amazonTag }
// Best-effort fetch of the product page for title/brand/image/price, then a
// rule-based Chinese hook. No paid APIs; if the store blocks us, the creator
// fills the title by hand.

async function draftCard(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const raw = String(body.url || "").trim();
  let target;
  try {
    target = new URL(raw);
    if (!/^https?:$/.test(target.protocol)) throw new Error();
  } catch {
    return json({ error: "请粘贴一个以 http(s) 开头的商品链接" }, 400);
  }

  const meta = await fetchMeta(target);
  const was = num(body.was) ?? meta.listPrice ?? null;
  const now = num(body.now) ?? meta.price ?? null;
  const title = String(body.title || "").trim() || meta.title || "";
  const brand = meta.brand || prettyHost(target.hostname);
  const note = String(body.note || "").trim().slice(0, 40);

  const link = wrapLink(target, String(body.amazonTag || "").trim());
  const off = was && now && now < was ? now / was : null;

  const hook = makeHook({ off, note, brand });
  const priceLine = makePriceLine(was, now);
  const card = {
    hook,
    brand,
    title: title.slice(0, 80),
    priceLine,
    image: meta.image || null,
    link,
    fetched: meta.ok,
  };
  const wechat = [hook, title ? `${brand} ${title}` : brand, priceLine, link].filter(Boolean).join("\n");
  return json({ card, wechat });
}

function num(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function prettyHost(h) {
  const base = h.replace(/^www\.|^shop\.|^m\./, "").split(".")[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function zhe(ratio) {
  // 0.7 -> "7折", 0.55 -> "55折", 0.42 -> "42折"
  const n = Math.round(ratio * 100);
  return n % 10 === 0 ? `${n / 10}折` : `${n}折`;
}

function makeHook({ off, note, brand }) {
  const parts = [];
  if (off) {
    if (off <= 0.4) parts.push(`【骨折价！${zhe(off)}】`);
    else if (off <= 0.5) parts.push(`【史低级好价 ${zhe(off)}】`);
    else parts.push(`【${zhe(off)}】`);
  } else {
    parts.push(`【${brand} 好价】`);
  }
  if (note) parts.push(`【${note}】`);
  return parts.join("");
}

function makePriceLine(was, now) {
  const f = (n) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
  if (was && now && now < was) return `${f(was)} ➡️ ${f(now)}`;
  if (now) return f(now);
  return "";
}

function wrapLink(u, amazonTag) {
  const out = new URL(u.toString());
  if (amazonTag && /(^|\.)amazon\.com$/.test(out.hostname)) {
    out.searchParams.set("tag", amazonTag.replace(/[^a-zA-Z0-9-]/g, ""));
  }
  return out.toString();
}

async function fetchMeta(u) {
  const empty = { ok: false };
  try {
    const res = await fetch(u.toString(), {
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return empty;
    const html = (await res.text()).slice(0, 600_000);
    const og = (p) => matchMeta(html, p);
    const out = {
      ok: true,
      title: clean(og("og:title") || (html.match(/<title[^>]*>([^<]{1,200})<\/title>/i) || [])[1] || ""),
      image: og("og:image") ? clean(og("og:image")) : null,
      brand: clean(og("og:site_name") || ""),
    };
    // Bot walls and interstitials come back 200 with a useless title.
    if (BLOCKED_TITLE.test(out.title)) return empty;
    const ld = parseProductLd(html);
    if (ld) {
      out.title = out.title || ld.name;
      out.brand = ld.brand || out.brand;
      out.price = ld.price;
      out.image = out.image || ld.image;
    }
    const metaPrice = num(og("product:price:amount") || og("og:price:amount"));
    if (!out.price && metaPrice) out.price = metaPrice;
    out.title = tidyTitle(out.title, out.brand || prettyHost(u.hostname));
    return out;
  } catch {
    return empty;
  }
}

function matchMeta(html, prop) {
  const esc = prop.replace(/[.:]/g, "\\$&");
  const a = new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]+content=["']([^"']+)["']`, "i");
  const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${esc}["']`, "i");
  return (html.match(a) || html.match(b) || [])[1] || null;
}

function parseProductLd(html) {
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const b of blocks) {
    const body = b.replace(/^[\s\S]*?>/, "").replace(/<\/script>$/i, "");
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      continue;
    }
    const items = [].concat(data["@graph"] || data);
    for (const it of items) {
      const type = [].concat(it && it["@type"]);
      if (!type.includes("Product")) continue;
      const offers = [].concat(it.offers || [])[0] || {};
      return {
        name: clean(it.name || ""),
        brand: clean(typeof it.brand === "string" ? it.brand : it.brand?.name || ""),
        price: num(offers.price ?? offers.lowPrice),
        image: [].concat(it.image || [])[0] || null,
      };
    }
  }
  return null;
}

const BLOCKED_TITLE = /hang tight|access denied|just a moment|attention required|are you a robot|captcha|robot check|pardon our interruption|page not found|404/i;

// "Amazon.com: Owala FreeSip ... : Sports & Outdoors" -> "Owala FreeSip ..."
// "COTTON FLEECE HOODIE | HEATHER GREY | SKIMS"     -> "COTTON FLEECE HOODIE | HEATHER GREY"
function tidyTitle(title, brand) {
  let t = title.replace(/^amazon\.com\s*:\s*/i, "").replace(/\s*:\s*[A-Z][\w &,'-]+$/, "");
  const b = brand.toLowerCase();
  const parts = t.split(/\s+[|–—-]\s+/);
  while (parts.length > 1 && parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, "").includes(b.replace(/[^a-z0-9]/g, ""))) parts.pop();
  return parts.join(" | ").trim();
}

function clean(s) {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
